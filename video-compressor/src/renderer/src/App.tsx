import { useState, useEffect, useRef } from 'react'
import {
  UploadCloud,
  Video,
  Settings,
  Play,
  ArrowRight,
  CheckCircle,
  FolderOpen,
  Clock,
  Film,
  Monitor,
  HardDrive,
  Loader2,
  X
} from 'lucide-react'

// Supported video extensions
const SUPPORTED_EXTENSIONS = [
  '.mp4', '.mkv', '.mov', '.avi', '.wmv', '.flv', '.webm',
  '.m4v', '.mpg', '.mpeg', '.3gp', '.ts', '.mts', '.m2ts', '.vob'
]

interface VideoMeta {
  width: number
  height: number
  duration: number
  codec: string
  format: string
  bitrate: number
  fps: number
  audioCodec: string
  fileSize: number
}

function getResolutionLabel(h: number): string {
  if (h >= 4320) return '8K'
  if (h >= 2160) return '4K'
  if (h >= 1440) return '2K / 1440p'
  if (h >= 1080) return '1080p'
  if (h >= 720) return '720p'
  if (h >= 480) return '480p'
  return `${h}p`
}

function getAvailableResolutions(originalHeight: number): { value: string; label: string; height: number }[] {
  const all = [
    { value: '4320p', label: '8K (4320p)', height: 4320 },
    { value: '2160p', label: '4K (2160p)', height: 2160 },
    { value: '1440p', label: '2K (1440p)', height: 1440 },
    { value: '1080p', label: '1080p (Full HD)', height: 1080 },
    { value: '720p', label: '720p (HD)', height: 720 },
    { value: '480p', label: '480p (SD)', height: 480 },
  ]
  const opts = all.filter((r) => r.height < originalHeight)
  opts.unshift({ value: 'Original', label: `Original (${getResolutionLabel(originalHeight)})`, height: originalHeight })
  return opts
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatBytes(bytes: number, decimals = 2): string {
  if (!+bytes) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

function App(): React.JSX.Element {
  const [file, setFile] = useState<File | null>(null)
  const [filePath, setFilePath] = useState<string>('')
  const [meta, setMeta] = useState<VideoMeta | null>(null)
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [resolution, setResolution] = useState('1080p')
  const [destinationPath, setDestinationPath] = useState<string>('')
  const [isCompressing, setIsCompressing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [eta, setEta] = useState<string>('')
  const [speed, setSpeed] = useState<string>('')
  const [isDone, setIsDone] = useState(false)
  const [compressedPath, setCompressedPath] = useState<string>('')
  const [error, setError] = useState<string>('')

  const startTimeRef = useRef<number>(0)

  // After file selected, extract metadata
  useEffect(() => {
    if (!filePath) return
    setLoadingMeta(true)
    setMeta(null)
    setError('')
    window.api
      .getVideoMetadata(filePath)
      .then((raw: any) => {
        try {
          const videoStream = raw.streams?.find((s: any) => s.codec_type === 'video')
          const audioStream = raw.streams?.find((s: any) => s.codec_type === 'audio')
          if (!videoStream) {
            setError('No video stream found in this file.')
            setLoadingMeta(false)
            return
          }

          // Safe FPS parsing (r_frame_rate is like "30000/1001")
          let fps = 0
          try {
            const fpsStr = videoStream.r_frame_rate || videoStream.avg_frame_rate || '0'
            if (fpsStr.includes('/')) {
              const [num, den] = fpsStr.split('/')
              fps = parseFloat(num) / parseFloat(den)
            } else {
              fps = parseFloat(fpsStr)
            }
            if (isNaN(fps)) fps = 0
          } catch { fps = 0 }

          const info: VideoMeta = {
            width: videoStream.width || 0,
            height: videoStream.height || 0,
            duration: parseFloat(raw.format?.duration || '0'),
            codec: videoStream.codec_name || 'unknown',
            format: raw.format?.format_long_name || raw.format?.format_name || 'unknown',
            bitrate: parseInt(raw.format?.bit_rate || '0', 10),
            fps,
            audioCodec: audioStream?.codec_name || 'none',
            fileSize: parseInt(raw.format?.size || '0', 10),
          }
          setMeta(info)

          // Set best default resolution
          if (info.height > 1080) setResolution('1080p')
          else if (info.height > 720) setResolution('720p')
          else setResolution('Original')

          // Set default destination
          const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
          const dir = lastSlash > 0 ? filePath.substring(0, lastSlash) : '.'
          const baseName = filePath.substring(lastSlash + 1)
          const dotIdx = baseName.lastIndexOf('.')
          const nameNoExt = dotIdx > 0 ? baseName.substring(0, dotIdx) : baseName
          setDestinationPath(`${dir}/${nameNoExt}_compressed.mp4`)
        } catch (parseErr: any) {
          console.error('Metadata parse error:', parseErr)
          setError('Error parsing metadata: ' + (parseErr.message || parseErr))
        }
      })
      .catch((err: any) => {
        console.error(err)
        setError('Failed to read video metadata. The file may be corrupted or unsupported.')
      })
      .finally(() => setLoadingMeta(false))
  }, [filePath])

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      const ext = '.' + droppedFile.name.split('.').pop()?.toLowerCase()
      if (SUPPORTED_EXTENSIONS.includes(ext)) {
        setFile(droppedFile)
        setFilePath(window.api.getFilePath(droppedFile))
        setIsDone(false)
        setProgress(0)
        setError('')
      } else {
        setError(`Unsupported format "${ext}". Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`)
      }
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0]
      setFile(f)
      setFilePath(window.api.getFilePath(f))
      setIsDone(false)
      setProgress(0)
      setError('')
    }
  }

  const pickDestination = async () => {
    const result = await window.api.selectDestination(destinationPath)
    if (result) setDestinationPath(result)
  }

  const startCompression = async () => {
    try {
      if (!window.api) {
        setError('Electron API is not loaded.')
        return
      }
      if (!file || !filePath) {
        setError('No file selected.')
        return
      }
      if (!destinationPath) {
        setError('Please choose a destination path.')
        return
      }

      setIsCompressing(true)
      setProgress(0)
      setEta('')
      setSpeed('')
      setError('')
      startTimeRef.current = Date.now()

      window.api.onProgress((p: any) => {
        const pct = Math.round(p.percent || 0)
        setProgress(pct)

        // Calculate ETA
        if (pct > 0) {
          const elapsed = (Date.now() - startTimeRef.current) / 1000
          const totalEstimate = (elapsed / pct) * 100
          const remaining = totalEstimate - elapsed
          setEta(formatDuration(Math.max(0, remaining)))
        }
        if (p.currentFps) {
          setSpeed(`${Math.round(p.currentFps)} fps`)
        }
      })

      const outPath = await window.api.compressVideo({
        inputPath: filePath,
        outputPath: destinationPath,
        resolution,
      })

      if (outPath === 'cancelled') {
        setIsCompressing(false)
        return
      }

      setCompressedPath(outPath)
      setProgress(100)
      setIsDone(true)
    } catch (err: any) {
      setError('Compression failed: ' + (err.message || err))
    } finally {
      setIsCompressing(false)
      if (window.api?.removeProgressListener) {
        window.api.removeProgressListener()
      }
    }
  }

  const cancelCompression = async () => {
    await window.api.cancelCompression()
    setIsCompressing(false)
    setProgress(0)
  }

  const getEstimatedSize = (): string => {
    if (!meta) return '—'
    const resOpt = getAvailableResolutions(meta.height).find((r) => r.value === resolution)
    const targetHeight = resOpt?.height || meta.height
    const scaleFactor = targetHeight / meta.height
    // CRF 28 roughly gives 15-25% of original bitrate
    const bitrateReduction = 0.20
    const estimated = meta.fileSize * scaleFactor * scaleFactor * bitrateReduction
    return formatBytes(Math.max(estimated, 1024 * 100))
  }

  const openOutputFolder = () => {
    if (compressedPath) window.api.openFolder(compressedPath)
  }

  const resetAll = () => {
    setFile(null)
    setFilePath('')
    setMeta(null)
    setIsDone(false)
    setCompressedPath('')
    setError('')
    setProgress(0)
  }

  const resOptions = meta ? getAvailableResolutions(meta.height) : []

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-950 text-gray-100 p-6 font-sans selection:bg-indigo-500 selection:text-white overflow-y-auto">
      {/* Header */}
      <div className="w-full max-w-2xl text-center mb-8">
        <div className="inline-flex items-center justify-center p-3 bg-indigo-500/10 rounded-2xl mb-3 ring-1 ring-indigo-500/20">
          <Video className="w-7 h-7 text-indigo-400" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 mb-1">
          Video Compressor
        </h1>
        <p className="text-sm text-gray-400 font-medium">
          Compress 8K / 4K / 2K videos offline. Supports MP4, MKV, MOV, AVI, WMV, WebM & more.
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="w-full max-w-2xl mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
          <X className="w-4 h-4 shrink-0 cursor-pointer hover:text-red-300" onClick={() => setError('')} />
          {error}
        </div>
      )}

      {/* Main Card */}
      <div className="w-full max-w-2xl bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl p-6 shadow-2xl">

        {/* ── Upload Zone ── */}
        {!file && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="flex flex-col items-center justify-center w-full h-56 border-2 border-dashed border-gray-700 rounded-2xl bg-gray-800/20 hover:bg-gray-800/40 hover:border-indigo-500/50 transition-all cursor-pointer group"
          >
            <div className="p-4 bg-gray-800 rounded-full mb-3 group-hover:scale-110 group-hover:bg-indigo-500/20 transition-all duration-300">
              <UploadCloud className="w-7 h-7 text-gray-400 group-hover:text-indigo-400" />
            </div>
            <p className="text-base font-semibold text-gray-300 mb-1">Drag and drop your video</p>
            <p className="text-xs text-gray-500 mb-3">MP4, MKV, MOV, AVI, WMV, WebM, MPEG, FLV, TS…</p>
            <label className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-full cursor-pointer transition-colors shadow-lg shadow-indigo-500/20">
              Browse Files
              <input
                type="file"
                accept="video/*,.mkv,.avi,.wmv,.flv,.webm,.m4v,.mpg,.mpeg,.3gp,.ts,.mts,.m2ts,.vob"
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>
          </div>
        )}

        {/* ── File Selected → Metadata + Settings ── */}
        {file && !isDone && (
          <div className="space-y-5">
            {/* File header */}
            <div className="flex items-center justify-between p-3 bg-gray-800/50 border border-gray-700 rounded-xl">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="p-2.5 bg-gray-700/50 rounded-lg">
                  <Film className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-medium text-gray-200 truncate">{file.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatBytes(file.size)}</p>
                </div>
              </div>
              {!isCompressing && (
                <button onClick={resetAll} className="text-xs text-gray-500 hover:text-red-400 transition-colors px-2">
                  Change
                </button>
              )}
            </div>

            {/* Loading metadata */}
            {loadingMeta && (
              <div className="flex items-center justify-center gap-2 py-6 text-gray-400 text-sm">
                <Loader2 className="w-5 h-5 animate-spin" />
                Reading video metadata…
              </div>
            )}

            {/* Metadata Display */}
            {meta && !loadingMeta && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <MetaCard icon={<Monitor className="w-4 h-4" />} label="Resolution" value={`${meta.width}×${meta.height}`} sub={getResolutionLabel(meta.height)} />
                  <MetaCard icon={<Clock className="w-4 h-4" />} label="Duration" value={formatDuration(meta.duration)} />
                  <MetaCard icon={<Film className="w-4 h-4" />} label="Codec" value={meta.codec.toUpperCase()} sub={`Audio: ${meta.audioCodec}`} />
                  <MetaCard icon={<HardDrive className="w-4 h-4" />} label="Bitrate" value={formatBytes(meta.bitrate / 8) + '/s'} sub={`${Math.round(meta.fps)} fps`} />
                </div>

                {/* HEVC Compatibility Notice */}
                {['hevc', 'h265', 'vp9', 'av1'].includes(meta.codec.toLowerCase()) && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-start gap-2">
                    <span className="text-amber-400 text-base leading-none mt-0.5">⚠</span>
                    <div>
                      <span className="font-semibold">Compatibility Issue Detected:</span> This video uses <span className="font-mono font-semibold">{meta.codec.toUpperCase()}</span> which causes "Missing codec (0xc00d5212)" errors on Windows. Compressing will convert it to <span className="font-mono font-semibold">H.264</span> — playable on every device without extra codecs.
                    </div>
                  </div>
                )}

                {/* Controls */}
                {!isCompressing && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Resolution Picker */}
                      <div className="p-4 bg-gray-800/30 border border-gray-700 rounded-xl">
                        <div className="flex items-center gap-2 mb-2 text-xs font-medium text-gray-400">
                          <Settings className="w-3.5 h-3.5" />
                          Target Resolution
                        </div>
                        <select
                          value={resolution}
                          onChange={(e) => setResolution(e.target.value)}
                          className="w-full bg-gray-900 border border-gray-600 text-gray-200 text-sm rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block p-2 outline-none transition-all"
                        >
                          {resOptions.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Estimated Size */}
                      <div className="p-4 bg-gray-800/30 border border-gray-700 rounded-xl flex flex-col justify-center">
                        <div className="text-xs font-medium text-gray-400 mb-1">Estimated Output</div>
                        <div className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                          ~{getEstimatedSize()}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-1">H.264 • CRF 28 • AAC 128k</div>
                      </div>
                    </div>

                    {/* Destination Path */}
                    <div className="p-4 bg-gray-800/30 border border-gray-700 rounded-xl">
                      <div className="flex items-center gap-2 mb-2 text-xs font-medium text-gray-400">
                        <FolderOpen className="w-3.5 h-3.5" />
                        Save To
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={destinationPath}
                          className="flex-1 bg-gray-900 border border-gray-600 text-gray-300 text-xs rounded-lg p-2 outline-none truncate"
                        />
                        <button
                          onClick={pickDestination}
                          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-medium rounded-lg transition-colors shrink-0"
                        >
                          Browse
                        </button>
                      </div>
                    </div>

                    {/* Start Button */}
                    <button
                      onClick={startCompression}
                      className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                    >
                      <Play className="w-5 h-5 fill-white" />
                      Start Compression
                    </button>
                  </div>
                )}

                {/* Progress UI */}
                {isCompressing && (
                  <div className="p-5 bg-gray-800/50 border border-gray-700 rounded-xl space-y-3">
                    <div className="flex justify-between items-end">
                      <span className="text-sm font-medium text-indigo-400 animate-pulse">Compressing…</span>
                      <span className="text-2xl font-bold text-gray-200">{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-900 rounded-full h-2.5 overflow-hidden ring-1 ring-gray-700">
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-2.5 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{speed || '—'}</span>
                      <span>{eta ? `ETA: ${eta}` : 'Calculating…'}</span>
                    </div>
                    <button
                      onClick={cancelCompression}
                      className="w-full mt-1 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-lg border border-red-500/20 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Success State ── */}
        {isDone && file && (
          <div className="text-center py-6">
            <div className="inline-flex items-center justify-center p-4 bg-emerald-500/10 rounded-full mb-5 ring-1 ring-emerald-500/20">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-100 mb-1">Compression Complete!</h2>
            <p className="text-sm text-gray-400 mb-6">
              Your video has been compressed and saved successfully.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={openOutputFolder}
                className="w-full sm:w-auto px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors border border-gray-700"
              >
                <FolderOpen className="w-4 h-4" />
                Open Folder
              </button>
              <button
                onClick={resetAll}
                className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-500/20"
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

function MetaCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="p-3 bg-gray-800/40 border border-gray-700/60 rounded-xl">
      <div className="flex items-center gap-1.5 text-gray-400 mb-1.5">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-sm font-semibold text-gray-200 truncate">{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

export default App
