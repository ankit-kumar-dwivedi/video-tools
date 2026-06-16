import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      getVideoMetadata: (filePath: string) => Promise<any>
      compressVideo: (options: { inputPath: string; resolution: string }) => Promise<string>
      cancelCompression: () => Promise<boolean>
      openFolder: (folderPath: string) => void
      onProgress: (callback: (progress: number) => void) => void
      removeProgressListener: () => void
    }
  }
}
