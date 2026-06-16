# 🎬 Video Compressor

A free, offline desktop app that compresses large 8K/4K/2K videos into smaller, universally playable files.

**Built for people who get the "Missing codec (0xc00d5212)" error on Windows** — this tool converts HEVC/H.265 videos to H.264, which plays on every device without extra codecs.

---

## 📥 Download

Go to the **[Releases Page](https://github.com/ankit-kumar-dwivedi/video-tools/releases/latest)** and download the installer for your platform:

| Platform | Download |
|----------|----------|
| **Windows 10/11** | `VideoCompressor-*-setup.exe` |
| **macOS** | `VideoCompressor-*.dmg` |
| **Linux (Ubuntu/Debian)** | `video-compressor_*.deb` |

> **Windows Users:** Windows may show a SmartScreen warning since the app isn't code-signed. Click **"More info" → "Run anyway"** to install.

---

## ✨ Features

- 🚀 **Hardware Accelerated** — Uses Apple VideoToolbox (Mac) and NVIDIA/Intel/AMD GPU (Windows) for 10x faster encoding
- 📊 **Video Metadata** — Shows resolution, duration, codec, bitrate, and FPS before compression
- ⏱️ **ETA & Speed** — Real-time progress with estimated time remaining
- 🎯 **Smart Resolution** — Automatically suggests target resolutions based on your source video
- 📁 **Custom Save Location** — Choose exactly where to save the compressed file
- ⚠️ **HEVC Detection** — Warns you when a video uses a codec that causes playback issues on Windows
- 🔌 **100% Offline** — No internet required after installation. FFmpeg is bundled inside the app.
- 🖥️ **Cross-Platform** — Works on Windows, macOS, and Linux

---

## 🖼️ How It Works

1. **Drag & drop** your video file (MP4, MKV, MOV, AVI, WMV, WebM, etc.)
2. **Review metadata** — see the current resolution, codec, duration, and bitrate
3. **Choose target resolution** — pick from available options (1080p, 720p, etc.)
4. **Pick a save location** — or use the default
5. **Click "Start Compression"** — watch the progress bar with ETA
6. **Done!** — Open the folder and share the compressed video

---

## 🛠️ Build from Source

```bash
# Clone the repo
git clone https://github.com/ankit-kumar-dwivedi/video-tools.git
cd video-tools/video-compressor

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for your platform
npm run build:mac    # macOS
npm run build:win    # Windows
npm run build:linux  # Linux
```

---

## 📄 License

MIT
