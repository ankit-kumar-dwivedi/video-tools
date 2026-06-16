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
const ffmpegPath = ffmpegStatic?.replace('app.asar', 'app.asar.unpacked')
const ffprobePath = ffprobeStatic.path.replace('app.asar', 'app.asar.unpacked')

console.log('[VideoCompressor] ffmpeg-static resolved to:', ffmpegStatic)
console.log('[VideoCompressor] ffmpegPath (after asar fix):', ffmpegPath)
console.log('[VideoCompressor] ffmpeg exists:', ffmpegPath ? fs.existsSync(ffmpegPath) : 'N/A')
console.log('[VideoCompressor] ffprobe-static resolved to:', ffprobeStatic.path)
console.log('[VideoCompressor] ffprobePath (after asar fix):', ffprobePath)
console.log('[VideoCompressor] ffprobe exists:', fs.existsSync(ffprobePath))

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
    console.log('[VideoCompressor] get-video-metadata called with:', filePath)
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          console.error('[VideoCompressor] FFProbe Error:', err.message || err)
          console.error('[VideoCompressor] FFProbe Error stack:', err.stack)
          reject(err.message || String(err))
        } else {
          console.log('[VideoCompressor] FFProbe success, streams:', metadata?.streams?.length)
          resolve(metadata)
        }
      })
    })
  })

  ipcMain.handle('select-destination', async (_, defaultPath: string) => {
    const window = BrowserWindow.getFocusedWindow()
    if (!window) return null
    const result = await dialog.showSaveDialog(window, {
      title: 'Save Compressed Video',
      defaultPath,
      filters: [{ name: 'Videos', extensions: ['mp4'] }]
    })
    return result.canceled ? null : result.filePath
  })

  let activeCommand: ffmpeg.FfmpegCommand | null = null

  // Helper: run compression with given codec settings, return a promise
  function runCompression(
    event: Electron.IpcMainInvokeEvent,
    inputPath: string,
    outputPath: string,
    resolution: string,
    codecConfig: { codec: string; outputOptions: string[] }
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .output(outputPath)
        .videoCodec(codecConfig.codec)
        .outputOptions([
          ...codecConfig.outputOptions,
          '-pix_fmt yuv420p',       // Maximum device compatibility (TVs, phones, Windows)
          '-movflags +faststart',   // Enables instant playback without downloading full file
        ])
        .audioCodec('aac')
        .audioBitrate('128k')

      const resMap: Record<string, number> = {
        '480p': 480, '720p': 720, '1080p': 1080,
        '1440p': 1440, '2160p': 2160, '4320p': 4320,
      }
      if (resolution !== 'Original' && resMap[resolution]) {
        command.size(`?x${resMap[resolution]}`)
      }

      command.on('progress', (progress) => {
        if (progress) {
          event.sender.send('compression-progress', progress)
        }
      })
      .on('end', () => {
        activeCommand = null
        resolve(outputPath)
      })
      .on('error', (err) => {
        if (err.message.includes('SIGKILL') || err.message.includes('killed')) {
          console.log('Compression was cancelled manually.')
          resolve('cancelled')
        } else {
          reject(err)
        }
        activeCommand = null
      })

      activeCommand = command
      command.run()
    })
  }

  ipcMain.handle('compress-video', async (event, { inputPath, outputPath, resolution }) => {
    const isMac = process.platform === 'darwin'
    const isWin = process.platform === 'win32'

    // 1. Try hardware encoder first
    if (isMac) {
      // Apple VideoToolbox — hardware H.264 encoder
      // -q:v 65 = quality (1-100, higher = better quality). 65 gives excellent compression ratio.
      console.log('[Compress] Trying Apple VideoToolbox hardware encoder...')
      try {
        return await runCompression(event, inputPath, outputPath, resolution, {
          codec: 'h264_videotoolbox',
          outputOptions: ['-q:v 65', '-allow_sw 1']
        })
      } catch (hwErr: any) {
        console.warn('[Compress] VideoToolbox failed, falling back to software:', hwErr.message)
      }
    } else if (isWin) {
      // Try NVIDIA NVENC first (most common GPU), then Intel QSV, then AMD AMF
      const winCodecs = [
        { codec: 'h264_nvenc', opts: ['-preset p4', '-cq 28', '-rc vbr'] },
        { codec: 'h264_qsv', opts: ['-global_quality 28', '-preset medium'] },
        { codec: 'h264_amf', opts: ['-quality balanced', '-rc cqp', '-qp_i 28', '-qp_p 28'] },
      ]
      for (const wc of winCodecs) {
        console.log(`[Compress] Trying Windows HW encoder: ${wc.codec}...`)
        try {
          return await runCompression(event, inputPath, outputPath, resolution, {
            codec: wc.codec,
            outputOptions: wc.opts
          })
        } catch (hwErr: any) {
          console.warn(`[Compress] ${wc.codec} failed:`, hwErr.message)
        }
      }
    }

    // 2. Fallback: software libx264 with ultrafast preset
    console.log('[Compress] Using software encoder (libx264 ultrafast)...')
    return await runCompression(event, inputPath, outputPath, resolution, {
      codec: 'libx264',
      outputOptions: ['-crf 28', '-preset ultrafast']
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

  app.on('before-quit', () => {
    if (activeCommand) {
      activeCommand.kill('SIGKILL')
    }
  })

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
