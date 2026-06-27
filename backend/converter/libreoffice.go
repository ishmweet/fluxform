package converter

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type LibreOfficeConverter struct{}

func NewLibreOfficeConverter() *LibreOfficeConverter {
	return &LibreOfficeConverter{}
}

func (l *LibreOfficeConverter) Convert(ctx context.Context, srcPath string, destPath string, onProgress func(percent float64)) error {
	if onProgress != nil {
		onProgress(10.0)
	}

	destDir := filepath.Dir(destPath)
	destExt := strings.ToLower(strings.TrimPrefix(filepath.Ext(destPath), "."))

	// Ensure destination directory exists
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return fmt.Errorf("failed to create destination directory: %w", err)
	}

	if onProgress != nil {
		onProgress(30.0)
	}

	// libreoffice --headless --convert-to pdf --outdir /path/to/destDir /path/to/srcPath
	cmd := exec.CommandContext(ctx, "libreoffice", "--headless", "--convert-to", destExt, "--outdir", destDir, srcPath)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("libreoffice execution failed: %w", err)
	}

	if onProgress != nil {
		onProgress(70.0)
	}

	// LibreOffice names the output file by using the source file's base name and appending the new extension.
	// For example, /path/to/doc.docx -> /path/to/destDir/doc.pdf
	srcBase := filepath.Base(srcPath)
	srcExt := filepath.Ext(srcBase)
	expectedBase := strings.TrimSuffix(srcBase, srcExt) + "." + destExt
	expectedPath := filepath.Join(destDir, expectedBase)

	// If the expected file path is different from the desired destPath, we rename it
	if expectedPath != destPath {
		// Remove destination if it already exists
		if _, err := os.Stat(destPath); err == nil {
			_ = os.Remove(destPath)
		}

		if err := os.Rename(expectedPath, destPath); err != nil {
			return fmt.Errorf("failed to move libreoffice output to final destination: %w", err)
		}
	}

	if onProgress != nil {
		onProgress(100.0)
	}
	return nil
}
