import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// Import ffmpeg modules
import ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'
import ffprobeStatic from 'ffprobe-static'
import * as fs from 'fs'

// Configure fluent-ffmpeg to use the bundled static binaries.
// When packaged with electron-builder and asar, the paths change.
// The `replace` ensures that if it's inside `app.asar`, we point to the unpacked binary in `app.asar.unpacked`.
const ffmpegPath = ffmpegStatic?.replace('app.asar', 'app.asar.unpacked')
const ffprobePath = ffprobeStatic.path.replace('app.asar', 'app.asar.unpacked')

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath)
}
ffmpeg.setFfprobePath(ffprobePath)

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.video.compressor')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC Handlers
  ipcMain.handle('get-video-metadata', async (_, filePath: string) => {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          console.error("FFProbe Error:", err)
          reject(err)
        } else {
          resolve(metadata)
        }
      })
    })
  })

  let activeCommand: ffmpeg.FfmpegCommand | null = null

  ipcMain.handle('compress-video', async (event, { inputPath, resolution }) => {
    return new Promise((resolve, reject) => {
      // Create output path in the same directory but with _compressed suffix
      const parsedPath = join(inputPath, '..')
      const fileName = inputPath.split(/[\/\\]/).pop() || 'video.mp4'
      const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')) || fileName
      const ext = fileName.substring(fileName.lastIndexOf('.'))
      
      const outputPath = join(parsedPath, `${nameWithoutExt}_compressed_${resolution}.mp4`)

      const command = ffmpeg(inputPath)
        .output(outputPath)
        .videoCodec('libx264')
        // Constant Rate Factor (CRF) - lower is better quality, higher is smaller size. 
        // 28 is a good balance for very small files that still look okay. 23 is default.
        .outputOptions(['-crf 28', '-preset fast']) 
        .audioCodec('aac')
        .audioBitrate('128k')

      if (resolution === '1080p') {
        command.size('?x1080')
      } else if (resolution === '720p') {
        command.size('?x720')
      }

      command.on('progress', (progress) => {
        // progress.percent can sometimes be undefined or NaN
        if (progress && progress.percent) {
          event.sender.send('compression-progress', Math.round(progress.percent))
        }
      })
      .on('end', () => {
        activeCommand = null
        resolve(outputPath)
      })
      .on('error', (err) => {
        console.error('Compression error:', err)
        activeCommand = null
        reject(err.message)
      })

      activeCommand = command
      command.run()
    })
  })

  ipcMain.handle('cancel-compression', () => {
    if (activeCommand) {
      activeCommand.kill('SIGKILL')
      activeCommand = null
      return true
    }
    return false
  })

  ipcMain.on('open-folder', (_, folderPath: string) => {
    shell.showItemInFolder(folderPath)
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
