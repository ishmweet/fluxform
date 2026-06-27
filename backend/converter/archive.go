package converter

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type ArchiveConverter struct{}

func NewArchiveConverter() *ArchiveConverter {
	return &ArchiveConverter{}
}

func (a *ArchiveConverter) Convert(ctx context.Context, srcPath string, destPath string, onProgress func(percent float64)) error {
	if onProgress != nil {
		onProgress(10.0)
	}

	// 1. Create a temporary folder to extract files
	tempDir, err := os.MkdirTemp("", "fluxform-archive-*")
	if err != nil {
		return fmt.Errorf("failed to create temp directory for archive conversion: %w", err)
	}
	defer os.RemoveAll(tempDir)

	if onProgress != nil {
		onProgress(30.0)
	}

	// 2. Extract source archive to tempDir
	if err := a.extract(ctx, srcPath, tempDir); err != nil {
		return fmt.Errorf("failed to extract source archive: %w", err)
	}

	if onProgress != nil {
		onProgress(60.0)
	}

	// 3. Ensure destination directory exists
	destDir := filepath.Dir(destPath)
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return fmt.Errorf("failed to create destination directory: %w", err)
	}

	// Remove destination archive if it exists
	if _, err := os.Stat(destPath); err == nil {
		_ = os.Remove(destPath)
	}

	// 4. Compress tempDir contents to destination archive
	if err := a.compress(ctx, tempDir, destPath); err != nil {
		return fmt.Errorf("failed to compress archive: %w", err)
	}

	if onProgress != nil {
		onProgress(100.0)
	}
	return nil
}

func (a *ArchiveConverter) extract(ctx context.Context, src, destDir string) error {
	srcLower := strings.ToLower(src)

	if strings.HasSuffix(srcLower, ".zip") {
		// unzip -q -o <src> -d <destDir>
		cmd := exec.CommandContext(ctx, "unzip", "-q", "-o", src, "-d", destDir)
		return cmd.Run()
	}

	if strings.HasSuffix(srcLower, ".tar.gz") || strings.HasSuffix(srcLower, ".tgz") {
		// tar -xzf <src> -C <destDir>
		cmd := exec.CommandContext(ctx, "tar", "-xzf", src, "-C", destDir)
		return cmd.Run()
	}

	if strings.HasSuffix(srcLower, ".tar.xz") || strings.HasSuffix(srcLower, ".txz") {
		// tar -xJf <src> -C <destDir>
		cmd := exec.CommandContext(ctx, "tar", "-xJf", src, "-C", destDir)
		return cmd.Run()
	}

	if strings.HasSuffix(srcLower, ".tar") {
		// tar -xf <src> -C <destDir>
		cmd := exec.CommandContext(ctx, "tar", "-xf", src, "-C", destDir)
		return cmd.Run()
	}

	return fmt.Errorf("unsupported extraction format: %s", filepath.Base(src))
}

func (a *ArchiveConverter) compress(ctx context.Context, srcDir, destArchive string) error {
	destLower := strings.ToLower(destArchive)
	absDest, err := filepath.Abs(destArchive)
	if err != nil {
		return err
	}

	if strings.HasSuffix(destLower, ".zip") {
		// Run zip inside the source directory so paths are relative
		// zip -r -q <absDest> .
		cmd := exec.CommandContext(ctx, "zip", "-r", "-q", absDest, ".")
		cmd.Dir = srcDir
		return cmd.Run()
	}

	if strings.HasSuffix(destLower, ".tar.gz") || strings.HasSuffix(destLower, ".tgz") {
		// tar -czf <absDest> -C <srcDir> .
		cmd := exec.CommandContext(ctx, "tar", "-czf", absDest, "-C", srcDir, ".")
		return cmd.Run()
	}

	if strings.HasSuffix(destLower, ".tar.xz") || strings.HasSuffix(destLower, ".txz") {
		// tar -cJf <absDest> -C <srcDir> .
		cmd := exec.CommandContext(ctx, "tar", "-cJf", absDest, "-C", srcDir, ".")
		return cmd.Run()
	}

	return fmt.Errorf("unsupported compression format: %s", filepath.Base(destArchive))
}
