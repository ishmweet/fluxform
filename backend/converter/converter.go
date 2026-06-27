package converter

import (
	"context"
	"fmt"
	"strings"
)

// Category represents the type of file (Audio, Video, Image, Document, Archive)
type Category string

const (
	CategoryAudio    Category = "Audio"
	CategoryVideo    Category = "Video"
	CategoryImage    Category = "Image"
	CategoryDocument Category = "Document"
	CategoryArchive  Category = "Archive"
	CategoryUnknown  Category = "Unknown"
)

// Converter defines the interface that all format conversion engines must implement.
type Converter interface {
	Convert(ctx context.Context, srcPath string, destPath string, onProgress func(percent float64)) error
}

// FormatInfo holds metadata about a file format
type FormatInfo struct {
	Extension string   `json:"extension"`
	Category  Category `json:"category"`
	Label     string   `json:"label"`
}

// Supported inputs and outputs mappings
var AudioInputs = []string{
	"3gp", "3gpp", "aac", "aiff", "ape", "avi", "bik", "cda", "flac", "flv", "m4v", "mkv", "mp4",
	"m4a", "m4b", "mp3", "mpg", "mpeg", "mov", "oga", "ogg", "ogv", "opus", "rm", "ts", "vob", "wav", "webm", "wma", "wmv",
}

var AudioOutputs = []string{
	"flac", "aac", "ogg", "mp3", "wav", "opus", "m4a",
}

var VideoInputs = []string{
	"3gp", "3gpp", "avi", "bik", "flv", "gif", "m4v", "mkv", "mp4", "mpg", "mpeg", "mov", "ogv", "rm", "ts", "vob", "webm", "wmv",
}

var VideoOutputs = []string{
	"webm", "mkv", "mp4", "ogv", "avi", "gif", "mov",
}

var ImageInputs = []string{
	"arw", "avif", "bmp", "cr2", "dds", "dns", "exr", "heic", "heif", "ico", "jfif", "jpg", "jpeg",
	"nef", "png", "psd", "raf", "svg", "tif", "tiff", "tga", "webp",
}

var ImageOutputs = []string{
	"png", "jpg", "ico", "webp", "gif", "avif",
}

var DocumentInputs = []string{
	"docx", "odt", "odp", "ods", "pptx", "xls", "xlsx", "arw", "bmp", "cr2", "dds", "exr",
	"heic", "heif", "ico", "jfif", "jpg", "jpeg", "nef", "png", "psd", "raf", "svg", "tif", "tiff", "tga", "webp", "txt",
}

var DocumentOutputs = []string{
	"pdf", "epub", "md", "html", "txt",
}

var ArchiveInputs = []string{
	"zip", "tar.gz", "tar.xz", "tar", "gz", "xz",
}

var ArchiveOutputs = []string{
	"zip", "tar.gz", "tar.xz",
}

// GetCategory returns the category of a file extension
func GetCategory(ext string) Category {
	ext = strings.ToLower(strings.TrimPrefix(ext, "."))
	
	// Check Archive first since zip, tar.gz are distinct
	if contains(ArchiveInputs, ext) || strings.HasSuffix(ext, "tar.gz") || strings.HasSuffix(ext, "tar.xz") {
		return CategoryArchive
	}
	
	// Check Document next
	if contains(DocumentInputs, ext) {
		// Some extensions are in both Image and Document (like jpg, png, tiff). 
		// If the output targets a document format, it will resolve as a document conversion.
		// By default, let's look at standard document extensions first.
		docOnly := []string{"docx", "odt", "odp", "ods", "pptx", "xls", "xlsx"}
		if contains(docOnly, ext) {
			return CategoryDocument
		}
	}

	if contains(VideoInputs, ext) {
		return CategoryVideo
	}
	if contains(AudioInputs, ext) {
		return CategoryAudio
	}
	if contains(ImageInputs, ext) {
		return CategoryImage
	}
	if contains(DocumentInputs, ext) {
		return CategoryDocument
	}
	
	return CategoryUnknown
}

// GetSupportedOutputs returns list of supported target formats for a given source extension
func GetSupportedOutputs(srcExt string) []string {
	srcExt = strings.ToLower(strings.TrimPrefix(srcExt, "."))
	category := GetCategory(srcExt)

	switch category {
	case CategoryAudio:
		return AudioOutputs
	case CategoryVideo:
		return VideoOutputs
	case CategoryImage:
		return ImageOutputs
	case CategoryDocument:
		return DocumentOutputs
	case CategoryArchive:
		return ArchiveOutputs
	default:
		// Fallback check if it's in multiple lists
		if contains(ImageInputs, srcExt) {
			return ImageOutputs
		}
		if contains(DocumentInputs, srcExt) {
			return DocumentOutputs
		}
		return []string{}
	}
}

// Helper to check slice containment
func contains(slice []string, val string) bool {
	for _, item := range slice {
		if item == val {
			return true
		}
	}
	return false
}

// GetConverter returns the correct Converter implementation for the given conversion request
func GetConverter(srcExt, destExt string, ffmpeg, magick, pandoc, libreoffice, archive Converter) (Converter, error) {
	srcExt = strings.ToLower(strings.TrimPrefix(srcExt, "."))
	destExt = strings.ToLower(strings.TrimPrefix(destExt, "."))

	srcCategory := GetCategory(srcExt)

	// Route based on destination format category if ambiguous, otherwise source category
	if contains(ArchiveOutputs, destExt) {
		return archive, nil
	}

	// Document outputs always go through LibreOffice or Pandoc
	if contains(DocumentOutputs, destExt) {
		// If input is docx, odt, xlsx etc, use LibreOffice for PDF/HTML, or Pandoc for markdown/epub.
		if destExt == "pdf" || destExt == "html" {
			// For PDF and HTML from docx/xlsx, LibreOffice is best.
			// For images to PDF, ImageMagick or LibreOffice can be used. Let's default to LibreOffice or Pandoc depending on source.
			if contains([]string{"docx", "odt", "odp", "ods", "pptx", "xls", "xlsx"}, srcExt) {
				return libreoffice, nil
			}
			// Image to PDF can use ImageMagick
			if contains(ImageInputs, srcExt) && destExt == "pdf" {
				return magick, nil
			}
			return pandoc, nil
		}
		return pandoc, nil
	}

	// Specific routing for gif output
	if destExt == "gif" {
		if srcCategory == CategoryImage {
			return magick, nil
		}
		return ffmpeg, nil
	}

	// Audio output formats
	if contains(AudioOutputs, destExt) {
		return ffmpeg, nil
	}

	// Video output formats
	if contains(VideoOutputs, destExt) {
		return ffmpeg, nil
	}

	// Image output formats
	if contains(ImageOutputs, destExt) {
		return magick, nil
	}

	// Fallback check by category
	switch srcCategory {
	case CategoryAudio, CategoryVideo:
		return ffmpeg, nil
	case CategoryImage:
		return magick, nil
	case CategoryDocument:
		if destExt == "pdf" {
			return libreoffice, nil
		}
		return pandoc, nil
	case CategoryArchive:
		return archive, nil
	}

	return nil, fmt.Errorf("no converter found for %s to %s", srcExt, destExt)
}
