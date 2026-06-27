package converter

import (
	"context"
	"fmt"
	"os/exec"
)

type ImageMagickConverter struct{}

func NewImageMagickConverter() *ImageMagickConverter {
	return &ImageMagickConverter{}
}

func (i *ImageMagickConverter) Convert(ctx context.Context, srcPath string, destPath string, onProgress func(percent float64)) error {
	if onProgress != nil {
		onProgress(0.0)
	}

	// Use "magick" command as convert is deprecated in IMv7 (installed on Fedora)
	cmd := exec.CommandContext(ctx, "magick", srcPath, destPath)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("imagemagick execution failed: %w", err)
	}

	if onProgress != nil {
		onProgress(100.0)
	}
	return nil
}
