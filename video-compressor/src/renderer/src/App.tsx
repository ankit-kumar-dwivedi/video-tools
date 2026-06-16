import { useState, useEffect } from 'react'
import { UploadCloud, Video, Settings, Play, ArrowRight, CheckCircle, FolderOpen } from 'lucide-react'

// Electron API
const api = window.api

function App(): React.JSX.Element {
  const [file, setFile] = useState<File | null>(null)
  const [filePath, setFilePath] = useState<string>('')
  const [resolution, setResolution] = useState('1080p')
  const [isCompressing, setIsCompressing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isDone, setIsDone] = useState(false)
  const [compressedPath, setCompressedPath] = useState<string>('')
  
  // Format bytes to human readable string
  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes'
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
  }

  // Handle Drag and Drop
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile.type.startsWith('video/')) {
        setFile(droppedFile)
        setFilePath(droppedFile.path)
        setIsDone(false)
        setProgress(0)
      } else {
        alert('Please drop a valid video file.')
      }
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setFilePath(e.target.files[0].path)
      setIsDone(false)
      setProgress(0)
    }
  }

  const startCompression = async () => {
    if (!file || !filePath) return
    setIsCompressing(true)
    setProgress(0)
    
    // Listen for progress
    api.onProgress((p) => {
      setProgress(p)
    })

    try {
      const outPath = await api.compressVideo({ inputPath: filePath, resolution })
      setCompressedPath(outPath)
      setProgress(100)
      setIsDone(true)
    } catch (error) {
      alert('Error compressing video: ' + error)
    } finally {
      setIsCompressing(false)
      api.removeProgressListener()
    }
  }

  // Fake estimated size logic (approx 15% of original for 1080p)
  // Later we can enhance this with actual duration/bitrate from get-video-metadata
  const getEstimatedSize = () => {
    if (!file) return '0 MB'
    let factor = 0.15
    if (resolution === '720p') factor = 0.10
    if (resolution === 'Original') factor = 0.50
    return formatBytes(file.size * factor)
  }

  const openOutputFolder = () => {
    if (compressedPath) {
      api.openFolder(compressedPath)
    }
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-950 text-gray-100 p-8 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <div className="w-full max-w-2xl text-center mb-10">
        <div className="inline-flex items-center justify-center p-3 bg-indigo-500/10 rounded-2xl mb-4 ring-1 ring-indigo-500/20">
          <Video className="w-8 h-8 text-indigo-400" />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 mb-2">
          Video Compressor
        </h1>
        <p className="text-gray-400 font-medium">Compress 8K/4K videos to highly compatible formats, completely offline.</p>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-2xl bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl p-8 shadow-2xl">
        
        {/* Upload Zone */}
        {!file && (
          <div 
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-gray-700 rounded-2xl bg-gray-800/20 hover:bg-gray-800/40 hover:border-indigo-500/50 transition-all cursor-pointer group"
          >
            <div className="p-4 bg-gray-800 rounded-full mb-4 group-hover:scale-110 group-hover:bg-indigo-500/20 transition-all duration-300">
              <UploadCloud className="w-8 h-8 text-gray-400 group-hover:text-indigo-400" />
            </div>
            <p className="text-lg font-semibold text-gray-300 mb-1">Drag and drop your video</p>
            <p className="text-sm text-gray-500 mb-4">Supports MP4, MOV, MKV, AVI</p>
            <label className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-full cursor-pointer transition-colors shadow-lg shadow-indigo-500/20">
              Browse Files
              <input type="file" accept="video/*" className="hidden" onChange={handleFileSelect} />
            </label>
          </div>
        )}

        {/* Selected File & Settings */}
        {file && !isDone && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* File Info */}
            <div className="flex items-center justify-between p-4 bg-gray-800/50 border border-gray-700 rounded-2xl">
              <div className="flex items-center gap-4 overflow-hidden">
                <div className="p-3 bg-gray-700/50 rounded-xl">
                  <Video className="w-6 h-6 text-indigo-400" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-medium text-gray-200 truncate">{file.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatBytes(file.size)}</p>
                </div>
              </div>
              {!isCompressing && (
                <button onClick={() => setFile(null)} className="text-sm text-gray-500 hover:text-red-400 transition-colors px-2">
                  Change
                </button>
              )}
            </div>

            {/* Controls */}
            {!isCompressing && (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-800/30 border border-gray-700 rounded-2xl">
                  <div className="flex items-center gap-2 mb-3 text-sm font-medium text-gray-300">
                    <Settings className="w-4 h-4 text-gray-400" />
                    Target Resolution
                  </div>
                  <select 
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 text-gray-200 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 outline-none transition-all"
                  >
                    <option value="1080p">1080p (Recommended)</option>
                    <option value="720p">720p (Smaller Size)</option>
                    <option value="Original">Keep Original</option>
                  </select>
                </div>

                <div className="p-4 bg-gray-800/30 border border-gray-700 rounded-2xl flex flex-col justify-center">
                  <div className="text-xs font-medium text-gray-400 mb-1">Estimated Size</div>
                  <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                    ~{getEstimatedSize()}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Based on standard H.264 compression</div>
                </div>
              </div>
            )}

            {/* Progress UI */}
            {isCompressing ? (
              <div className="p-6 bg-gray-800/50 border border-gray-700 rounded-2xl text-center space-y-4">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-sm font-medium text-indigo-400 animate-pulse">Compressing video...</span>
                  <span className="text-2xl font-bold text-gray-200">{progress}%</span>
                </div>
                <div className="w-full bg-gray-900 rounded-full h-3 overflow-hidden ring-1 ring-gray-700">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-3 rounded-full transition-all duration-300 ease-out" 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 pt-2">Please keep the app open.</p>
              </div>
            ) : (
              <button 
                onClick={startCompression}
                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold rounded-2xl shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                <Play className="w-5 h-5 fill-white" />
                Start Compression
              </button>
            )}
          </div>
        )}

        {/* Success State */}
        {isDone && file && (
          <div className="text-center py-8 animate-in zoom-in-95 duration-500">
            <div className="inline-flex items-center justify-center p-4 bg-emerald-500/10 rounded-full mb-6 ring-1 ring-emerald-500/20">
              <CheckCircle className="w-12 h-12 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-100 mb-2">Compression Complete!</h2>
            <p className="text-gray-400 mb-8">
              Your video was successfully compressed to a highly compatible format.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button onClick={openOutputFolder} className="w-full sm:w-auto px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-colors border border-gray-700">
                <FolderOpen className="w-4 h-4" />
                Open Folder
              </button>
              <button 
                onClick={() => { setFile(null); setIsDone(false); setCompressedPath(''); }}
                className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-500/20"
              >
                Compress Another
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default App
