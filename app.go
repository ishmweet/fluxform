package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"fluxform/backend/converter"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx          context.Context
	ffmpeg       converter.Converter
	magick       converter.Converter
	pandoc       converter.Converter
	libreoffice  converter.Converter
	archive      converter.Converter
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{
		ffmpeg:      converter.NewFFmpegConverter(),
		magick:      converter.NewImageMagickConverter(),
		pandoc:      converter.NewPandocConverter(),
		libreoffice: converter.NewLibreOfficeConverter(),
		archive:     converter.NewArchiveConverter(),
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// SelectFiles opens a file dialog to select one or more files for conversion
func (a *App) SelectFiles() ([]string, error) {
	options := runtime.OpenDialogOptions{
		Title: "Select Files to Convert",
	}
	
	files, err := runtime.OpenMultipleFilesDialog(a.ctx, options)
	if err != nil {
		return nil, fmt.Errorf("failed to open files: %w", err)
	}
	return files, nil
}

// SelectDirectory opens a directory dialog to choose where to save output files
func (a *App) SelectDirectory() (string, error) {
	options := runtime.OpenDialogOptions{
		Title: "Select Output Directory",
	}
	
	dir, err := runtime.OpenDirectoryDialog(a.ctx, options)
	if err != nil {
		return "", fmt.Errorf("failed to open directory: %w", err)
	}
	return dir, nil
}

// GetSupportedOutputs returns valid conversion formats for a given extension
func (a *App) GetSupportedOutputs(srcExt string) []string {
	return converter.GetSupportedOutputs(srcExt)
}

// GetCategory returns the category of a file based on its extension
func (a *App) GetCategory(srcExt string) string {
	return string(converter.GetCategory(srcExt))
}

// OpenFolder opens the system file manager at the directory containing the file
func (a *App) OpenFolder(filePath string) error {
	dir := filepath.Dir(filePath)
	if _, err := os.Stat(dir); err != nil {
		return err
	}
	// xdg-open works on virtually all Linux desktop environments
	return exec.Command("xdg-open", dir).Start()
}

// OpenFile opens the converted file using the system default application
func (a *App) OpenFile(filePath string) error {
	if _, err := os.Stat(filePath); err != nil {
		return err
	}
	return exec.Command("xdg-open", filePath).Start()
}

// StartConversion launches a conversion in a separate goroutine and emits events to Wails
func (a *App) StartConversion(jobId string, srcPath string, targetFormat string, outputDir string) error {
	go func() {
		srcBase := filepath.Base(srcPath)
		srcExt := filepath.Ext(srcBase)
		
		targetFormat = strings.TrimPrefix(strings.ToLower(targetFormat), ".")
		
		destBase := strings.TrimSuffix(srcBase, srcExt) + "." + targetFormat
		
		// If outputDir is empty, default to the same folder as the source file
		var destPath string
		if outputDir == "" {
			destPath = filepath.Join(filepath.Dir(srcPath), destBase)
		} else {
			destPath = filepath.Join(outputDir, destBase)
		}

		// Find appropriate converter
		conv, err := converter.GetConverter(srcExt, targetFormat, a.ffmpeg, a.magick, a.pandoc, a.libreoffice, a.archive)
		if err != nil {
			runtime.EventsEmit(a.ctx, "conversion-failed", map[string]interface{}{
				"jobId": jobId,
				"error": fmt.Sprintf("failed to get converter: %v", err),
			})
			return
		}

		// Execute conversion with progress tracking callback
		err = conv.Convert(a.ctx, srcPath, destPath, func(percent float64) {
			runtime.EventsEmit(a.ctx, "conversion-progress", map[string]interface{}{
				"jobId":   jobId,
				"percent": percent,
			})
		})

		if err != nil {
			runtime.EventsEmit(a.ctx, "conversion-failed", map[string]interface{}{
				"jobId": jobId,
				"error": err.Error(),
			})
		} else {
			runtime.EventsEmit(a.ctx, "conversion-completed", map[string]interface{}{
				"jobId":    jobId,
				"destPath": destPath,
			})
		}
	}()
	
	return nil
}

// GetToolStatus checks if CLI converters (ffmpeg, magick, pandoc, libreoffice) are installed on the system
func (a *App) GetToolStatus() map[string]bool {
	status := make(map[string]bool)
	tools := []string{"ffmpeg", "magick", "pandoc", "libreoffice"}
	for _, tool := range tools {
		_, err := exec.LookPath(tool)
		status[tool] = (err == nil)
	}
	return status
}

