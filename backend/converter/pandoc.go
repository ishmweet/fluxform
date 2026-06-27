package converter

import (
	"context"
	"fmt"
	"os/exec"
)

type PandocConverter struct{}

func NewPandocConverter() *PandocConverter {
	return &PandocConverter{}
}

func (p *PandocConverter) Convert(ctx context.Context, srcPath string, destPath string, onProgress func(percent float64)) error {
	if onProgress != nil {
		onProgress(0.0)
	}

	cmd := exec.CommandContext(ctx, "pandoc", srcPath, "-o", destPath)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("pandoc execution failed: %w", err)
	}

	if onProgress != nil {
		onProgress(100.0)
	}
	return nil
}
