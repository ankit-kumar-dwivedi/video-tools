import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  getVideoMetadata: (filePath: string) => ipcRenderer.invoke('get-video-metadata', filePath),
  compressVideo: (options: { inputPath: string; resolution: string }) => ipcRenderer.invoke('compress-video', options),
  cancelCompression: () => ipcRenderer.invoke('cancel-compression'),
  openFolder: (folderPath: string) => ipcRenderer.send('open-folder', folderPath),
  onProgress: (callback: (progress: number) => void) => {
    ipcRenderer.on('compression-progress', (_, progress) => callback(progress))
  },
  removeProgressListener: () => {
    ipcRenderer.removeAllListeners('compression-progress')
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
