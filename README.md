# FluxForm

[![Platform](https://img.shields.io/badge/platform-Linux-blue?logo=linux)](https://github.com/ishmweet/fluxform)
[![Go Version](https://img.shields.io/badge/Go-1.23%2B-00ADD8?logo=go)](https://golang.org)
[![React Version](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![Framework](https://img.shields.io/badge/Framework-Wails%20v2-red)](https://wails.io)

FluxForm is a free, open-source, 100% offline file converter for Linux. It allows you to convert files between audio, video, image, document, and archive formats securely on your local machine—no uploads, no internet, and complete privacy.

---

## 🛡️ Key Principles

*   **100% Offline**: Conversions are executed locally using system binaries under sandbox-friendly execution structures. No files ever leave your machine, and no network requests are ever made.
*   **Linux First**: Tailored for Debian-based and RPM-based Linux distributions (Ubuntu, Fedora, Debian, etc.).
*   **Context Menu Integration**: Native right-click context menu hooks for Linux file managers (Nautilus, Dolphin, Thunar).

---

## 📦 Supported Formats

| Category | Input Formats | Output Formats | Conversion Engine |
| :--- | :--- | :--- | :--- |
| **Audio** | `aac`, `aiff`, `ape`, `avi`, `cda`, `flac`, `flv`, `m4a`, `m4b`, `m4v`, `mkv`, `mov`, `mp3`, `mp4`, `mpeg`, `mpg`, `oga`, `ogg`, `ogv`, `opus`, `rm`, `ts`, `vob`, `wav`, `webm`, `wma`, `wmv` *(extracts audio)* | `aac`, `flac`, `m4a`, `mp3`, `ogg`, `opus`, `wav` | **FFmpeg** |
| **Video** | `3gp`, `3gpp`, `avi`, `bik`, `flv`, `gif`, `m4v`, `mkv`, `mov`, `mp4`, `mpeg`, `mpg`, `ogv`, `rm`, `ts`, `vob`, `webm`, `wmv` | `avi`, `gif`, `mkv`, `mov`, `mp4`, `ogv`, `webm` | **FFmpeg** |
| **Image** | `arw`, `avif`, `bmp`, `cr2`, `dds`, `dns`, `exr`, `heic`, `heif`, `ico`, `jfif`, `jpeg`, `jpg`, `nef`, `png`, `psd`, `raf`, `svg`, `tga`, `tif`, `tiff`, `webp` | `avif`, `gif`, `ico`, `jpg`, `png`, `webp` | **ImageMagick (v7)** |
| **Document** | `arw`, `bmp`, `cr2`, `dds`, `docx`, `exr`, `heic`, `heif`, `ico`, `jfif`, `jpeg`, `jpg`, `nef`, `odp`, `ods`, `odt`, `png`, `pptx`, `psd`, `raf`, `svg`, `tga`, `tif`, `tiff`, `txt`, `webp`, `xls`, `xlsx` | `epub`, `html`, `md`, `pdf`, `txt` | **LibreOffice Headless** & **Pandoc** |
| **Archive** | `tar`, `tar.gz`, `tar.xz`, `zip` | `tar.gz`, `tar.xz`, `zip` | **Native `tar`/`zip`/`unzip`** |

---

## ⚙️ System Requirements

To perform conversions locally, FluxForm requires the underlying command-line engines to be installed on your system.

### Fedora Linux (RPM-based)
```bash
sudo dnf install ffmpeg ImageMagick pandoc libreoffice-headless zip unzip
```

### Ubuntu / Debian (Debian-based)
```bash
sudo apt install ffmpeg imagemagick pandoc libreoffice-writer libreoffice-calc zip unzip
```

---

## 🛠️ Development Setup

FluxForm is built with **Wails** (Go Backend + React & TypeScript Frontend).

### Prerequisites
1.  **Go**: Go version 1.23+ is required.
2.  **Node.js & npm**: Node 18+ is required to compile frontend assets.
3.  **GTK3 & WebKit2GTK**: Development libraries are required for building on Linux.
    *   *Fedora:* `sudo dnf install gtk3-devel webkit2gtk4.1-devel`
    *   *Ubuntu/Debian:* `sudo apt install libgtk-3-dev libwebkit2gtk-4.1-dev`
4.  **Wails CLI**: Install the Wails generator tool globally:
    ```bash
    go install github.com/wailsapp/wails/v2/cmd/wails@latest
    ```

### Run Live Development
Start the application in hot-reloading development mode:
```bash
wails dev
```
*Note: The project configuration is preset to build against `webkit2_41` (WebKit2GTK 4.1) automatically on modern distributions.*

### Build local executable
To build a production mode package compiled locally on your machine:
```bash
wails build
```
The compiled binary will be placed under `build/bin/fluxform`.
