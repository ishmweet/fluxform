package converter

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

type FFmpegConverter struct{}

// NewFFmpegConverter creates a new FFmpeg converter
func NewFFmpegConverter() *FFmpegConverter {
	return &FFmpegConverter{}
}

// Convert runs ffmpeg to convert audio/video files and parses stderr for progress
func (f *FFmpegConverter) Convert(ctx context.Context, srcPath string, destPath string, onProgress func(percent float64)) error {
	// -y overwrites output file without asking. -vn disables video stream mapping for audio containers to prevent errors from embedded cover art.
	var cmd *exec.Cmd
	if GetCategory(filepath.Ext(destPath)) == CategoryAudio {
		cmd = exec.CommandContext(ctx, "ffmpeg", "-y", "-vn", "-i", srcPath, destPath)
	} else {
		cmd = exec.CommandContext(ctx, "ffmpeg", "-y", "-i", srcPath, destPath)
	}
	
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("failed to get stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start ffmpeg: %w", err)
	}

	// Channel to signal completion of stderr parsing
	done := make(chan struct{})
	
	// Parse stderr in a separate goroutine
	go func() {
		defer close(done)
		reader := bufio.NewReader(stderr)
		
		durationRx := regexp.MustCompile(`Duration:\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})`)
		timeRx := regexp.MustCompile(`time=\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})`)
		
		var totalSeconds float64

		for {
			line, err := reader.ReadString('\r') // FFmpeg updates progress using carriage return
			if err != nil {
				if err != io.EOF && !strings.Contains(err.Error(), "file already closed") {
					// Silent ignore or log
				}
				break
			}
			
			// Try to find duration first
			if totalSeconds == 0 {
				matches := durationRx.FindStringSubmatch(line)
				if len(matches) == 5 {
					hours, _ := strconv.ParseFloat(matches[1], 64)
					mins, _ := strconv.ParseFloat(matches[2], 64)
					secs, _ := strconv.ParseFloat(matches[3], 64)
					ms, _ := strconv.ParseFloat(matches[4], 64)
					totalSeconds = hours*3600 + mins*60 + secs + ms/100
				}
			}

			// Parse current time and calculate progress
			if totalSeconds > 0 && onProgress != nil {
				matches := timeRx.FindStringSubmatch(line)
				if len(matches) == 5 {
					hours, _ := strconv.ParseFloat(matches[1], 64)
					mins, _ := strconv.ParseFloat(matches[2], 64)
					secs, _ := strconv.ParseFloat(matches[3], 64)
					ms, _ := strconv.ParseFloat(matches[4], 64)
					currentSeconds := hours*3600 + mins*60 + secs + ms/100
					
					percent := (currentSeconds / totalSeconds) * 100
					if percent > 100 {
						percent = 100
					}
					onProgress(percent)
				}
			}
		}
	}()

	// Wait for ffmpeg command to exit
	err = cmd.Wait()
	<-done // Wait for stderr reader to finish

	if err != nil {
		return fmt.Errorf("ffmpeg process exited with error: %w", err)
	}

	if onProgress != nil {
		onProgress(100.0)
	}
	return nil
}
