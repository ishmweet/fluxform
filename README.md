# FluxForm

[![Platform](https://img.shields.io/badge/platform-Linux-blue?logo=linux)](https://github.com/ishmweet/fluxform)
[![Go Version](https://img.shields.io/badge/Go-1.23%2B-00ADD8?logo=go)](https://golang.org)
[![React Version](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![Framework](https://img.shields.io/badge/Framework-Wails%20v2-red)](https://wails.io)

FluxForm is a beautiful, offline file converter for Linux desktops designed to match the native GNOME Libadwaita dark theme. It allows you to convert files between audio, video, image, document, and archive formats securely on your local machine—no uploads, no network requests, and complete privacy.

---

## 🛡️ Key Principles

*   **100% Offline**: Conversions are executed locally using system binaries under sandbox-friendly execution structures. No files ever leave your machine.
*   **GNOME Native Aesthetics**: Integrated with Libadwaita dark theme colors, Cantarell system fonts, and GTK-style popover animations.
*   **Safe Drag & Drop**: Drag files window-wide with blurred overlays and bounce indicators.
*   **Live Dependency Warnings**: Displays inline warnings (`⚠️ Missing tool`) next to the file row if the required converter engine is missing on the host.

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

FluxForm requires the underlying CLI conversion engines to be installed on your Linux system to perform conversions. The application checks for these tools on launch and highlights if a required engine is missing.

### Fedora Linux (RPM-based)
Enable the **RPM Fusion** repository first to fetch multimedia codecs, then install:
```bash
sudo dnf install https://mirrors.rpmfusion.org/free/fedora/rpmfusion-free-release-$(rpm -E %fedora).noarch.rpm https://mirrors.rpmfusion.org/nonfree/fedora/rpmfusion-nonfree-release-$(rpm -E %fedora).noarch.rpm
sudo dnf install ffmpeg ImageMagick pandoc libreoffice-headless zip unzip
```

### Ubuntu / Debian / Linux Mint (Debian-based)
```bash
sudo apt update
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

### Build local executable
To build a production mode package compiled locally on your machine:
```bash
wails build
```
The compiled binary will be placed under `build/bin/fluxform`.

---

## 📦 Packaging for Distribution

You can build native Linux package installers directly from your terminal after compiling the binary.

### Build `.deb` Package (Debian / Ubuntu / Mint)
On any Linux system with `dpkg` installed (run `sudo dnf install dpkg` if on Fedora):
```bash
# 1. Create packaging layout
mkdir -p deb_pkg/DEBIAN
mkdir -p deb_pkg/usr/bin
mkdir -p deb_pkg/usr/share/applications
mkdir -p deb_pkg/usr/share/pixmaps

# 2. Copy compiled assets
cp build/bin/fluxform deb_pkg/usr/bin/
cp build/linux/fluxform.desktop deb_pkg/usr/share/applications/
cp build/appicon.png deb_pkg/usr/share/pixmaps/fluxform.png
cp build/linux/debian/control deb_pkg/DEBIAN/control

# 3. Build deb installer
dpkg-deb --build deb_pkg fluxform_1.0.0_amd64.deb
```

### Build `.rpm` Package (Fedora / RedHat)
On Fedora (run `sudo dnf install rpm-build`):
```bash
# 1. Create local RPM build workspace
mkdir -p rpmbuild/SOURCES rpmbuild/SPECS rpmbuild/RPMS rpmbuild/BUILD rpmbuild/BUILDROOT

# 2. Copy source materials
cp build/bin/fluxform rpmbuild/SOURCES/
cp build/linux/fluxform.desktop rpmbuild/SOURCES/
cp build/appicon.png rpmbuild/SOURCES/
cp build/linux/rpm/fluxform.spec rpmbuild/SPECS/

# 3. Compile RPM installer package
rpmbuild --define "_topdir $(pwd)/rpmbuild" -bb rpmbuild/SPECS/fluxform.spec
```
The compiled package will be placed inside `rpmbuild/RPMS/x86_64/`.
