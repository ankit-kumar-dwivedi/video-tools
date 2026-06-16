import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      getVideoMetadata: (filePath: string) => Promise<any>
      compressVideo: (options: { inputPath: string; outputPath: string; resolution: string }) => Promise<string>
      cancelCompression: () => Promise<boolean>
      openFolder: (folderPath: string) => void
      selectDestination: (defaultPath: string) => Promise<string | null>
      getFilePath: (file: File) => string
      onProgress: (callback: (progress: any) => void) => void
      removeProgressListener: () => void
    }
  }
}
