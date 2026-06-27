import React, { useState, useEffect } from 'react';
import {
  SelectFiles,
  SelectDirectory,
  GetSupportedOutputs,
  GetCategory,
  StartConversion,
  OpenFolder,
  OpenFile,
  GetToolStatus
} from '../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../wailsjs/runtime/runtime';

interface FileToConvert {
  path: string;
  name: string;
  size: number;
  ext: string;
  category: string;
  targetFormat: string;
  supportedFormats: string[];
}

interface ConversionJob {
  id: string;
  name: string;
  srcPath: string;
  destPath: string;
  targetFormat: string;
  status: 'pending' | 'converting' | 'completed' | 'failed';
  progress: number;
  error?: string;
  timestamp: Date;
  category: string;
}

function App() {
  const [currentView, setCurrentView] = useState<'convert' | 'queue'>('convert');
  const [files, setFiles] = useState<FileToConvert[]>([]);
  const [outputDir, setOutputDir] = useState<string>('');
  const [queue, setQueue] = useState<ConversionJob[]>([]);
  const [tools, setTools] = useState<Record<string, boolean>>({
    ffmpeg: false,
    magick: false,
    pandoc: false,
    libreoffice: false
  });

  // Initialize and check tools status
  useEffect(() => {
    checkTools();
    
    // Register Wails Event Listeners for real-time progress
    EventsOn('conversion-progress', (data: { jobId: string; percent: number }) => {
      setQueue(prev => prev.map(job => 
        job.id === data.jobId 
          ? { ...job, status: 'converting', progress: Math.round(data.percent) } 
          : job
      ));
    });

    EventsOn('conversion-completed', (data: { jobId: string; destPath: string }) => {
      setQueue(prev => prev.map(job => 
        job.id === data.jobId 
          ? { ...job, status: 'completed', progress: 100, destPath: data.destPath } 
          : job
      ));
    });

    EventsOn('conversion-failed', (data: { jobId: string; error: string }) => {
      setQueue(prev => prev.map(job => 
        job.id === data.jobId 
          ? { ...job, status: 'failed', error: data.error } 
          : job
      ));
    });

    return () => {
      EventsOff('conversion-progress');
      EventsOff('conversion-completed');
      EventsOff('conversion-failed');
    };
  }, []);

  const checkTools = async () => {
    try {
      const status = await GetToolStatus();
      setTools(status || {});
    } catch (e) {
      console.error("Failed to check tools:", e);
    }
  };

  const handleAddFiles = async (filePaths: string[]) => {
    const newFiles: FileToConvert[] = [];
    for (const path of filePaths) {
      if (files.some(f => f.path === path)) continue;

      const name = path.split('/').pop() || path;
      const ext = name.split('.').pop() || '';
      
      try {
        const category = await GetCategory(ext);
        const supported = await GetSupportedOutputs(ext);
        const defaultFormat = supported.length > 0 ? supported[0] : '';
        
        newFiles.push({
          path,
          name,
          size: 0,
          ext,
          category,
          targetFormat: defaultFormat,
          supportedFormats: supported
        });
      } catch (e) {
        console.error("Error fetching file info for " + name, e);
      }
    }

    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleSelectFilesClick = async () => {
    try {
      const selected = await SelectFiles();
      if (selected && selected.length > 0) {
        handleAddFiles(selected);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectOutputDirClick = async () => {
    try {
      const selected = await SelectDirectory();
      if (selected) {
        setOutputDir(selected);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleFormatChange = (index: number, format: string) => {
    setFiles(prev => prev.map((f, i) => i === index ? { ...f, targetFormat: format } : f));
  };

  const triggerConversions = async () => {
    const newJobs: ConversionJob[] = [];
    
    for (const file of files) {
      const id = 'job-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      
      const job: ConversionJob = {
        id,
        name: file.name,
        srcPath: file.path,
        destPath: '',
        targetFormat: file.targetFormat,
        status: 'pending',
        progress: 0,
        timestamp: new Date(),
        category: file.category
      };
      
      newJobs.push(job);
      
      try {
        await StartConversion(id, file.path, file.targetFormat, outputDir);
      } catch (e: any) {
        job.status = 'failed';
        job.error = e.message || String(e);
      }
    }

    setQueue(prev => [...newJobs, ...prev]);
    setFiles([]); // Clear list
    setCurrentView('queue'); // Auto navigate to progress queue
  };

  const handleOpenFolder = async (path: string) => {
    try {
      await OpenFolder(path);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenFile = async (path: string) => {
    try {
      await OpenFile(path);
    } catch (e) {
      console.error(e);
    }
  };

  const clearQueue = () => {
    setQueue([]);
  };

  // State checks for indicators
  const activeJobsCount = queue.filter(j => j.status === 'pending' || j.status === 'converting').length;

  return (
    <div className="app-container">
      {/* HEADER SECTION (COMMON) */}
      <header className="app-header">
        <div className="app-title-group">
          <h1>FluxForm</h1>
          <p>Offline File Converter</p>
        </div>

        {/* View Switcher Pills */}
        <div className="segmented-control">
          <button 
            className={`segmented-btn ${currentView === 'convert' ? 'active' : ''}`}
            onClick={() => setCurrentView('convert')}
          >
            Converter
          </button>
          <button 
            className={`segmented-btn ${currentView === 'queue' ? 'active' : ''}`}
            onClick={() => setCurrentView('queue')}
          >
            Queue & History
            {activeJobsCount > 0 && <span className="badge-dot"></span>}
          </button>
        </div>
      </header>

      {/* MAIN VIEW AREA (MUTUALLY EXCLUSIVE VIEWS) */}
      <main className="view-area">
        <div className="main-panel">
          
          {/* VIEW: CONVERTER */}
          {currentView === 'convert' && (
            files.length === 0 ? (
              <div className="dropzone" onClick={handleSelectFilesClick}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <div>
                  <h3>Select files to convert</h3>
                  <p>Supports media files, images, documents, and archives</p>
                </div>
              </div>
            ) : (
              <div className="selection-container">
                <h2>Selected Files</h2>
                <div className="file-list">
                  {files.map((file, idx) => (
                    <div className="file-row" key={file.path}>
                      <div className="file-details">
                        <div className="file-name" title={file.path}>{file.name}</div>
                        <div className="file-meta">{file.category} • {file.path}</div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <select 
                          className="select-input"
                          value={file.targetFormat} 
                          onChange={(e) => handleFormatChange(idx, e.target.value)}
                        >
                          {file.supportedFormats.map(fmt => (
                            <option key={fmt} value={fmt}>{fmt.toUpperCase()}</option>
                          ))}
                        </select>
                        
                        <button className="btn-close" onClick={() => handleRemoveFile(idx)}>
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="path-section">
                  <span className="path-label">Destination Folder</span>
                  <div className="path-input-group">
                    <input 
                      type="text" 
                      className="text-input" 
                      value={outputDir} 
                      onChange={(e) => setOutputDir(e.target.value)}
                      placeholder="Same directory as source file"
                    />
                    <button className="btn" onClick={handleSelectOutputDirClick}>
                      Browse...
                    </button>
                  </div>
                </div>

                <div className="action-row">
                  <button className="btn" onClick={handleSelectFilesClick}>
                    Add More Files
                  </button>
                  <button 
                    className="btn btn-primary" 
                    onClick={triggerConversions}
                  >
                    Start Conversion
                  </button>
                </div>
              </div>
            )
          )}

          {/* VIEW: QUEUE */}
          {currentView === 'queue' && (
            <div className="queue-container">
              <h2>
                Conversion History
                {queue.length > 0 && (
                  <button className="btn btn-small" onClick={clearQueue}>
                    Clear All
                  </button>
                )}
              </h2>
              
              <div className="queue-list">
                {queue.length === 0 ? (
                  <div className="empty-state">
                    No active conversions or history.
                  </div>
                ) : (
                  queue.map(job => (
                    <div className="queue-row" key={job.id}>
                      <div className="queue-header">
                        <span className="queue-name" title={job.srcPath}>{job.name}</span>
                        <span className={`queue-badge badge-${job.status}`}>
                          {job.status === 'converting' ? `Converting (${job.progress}%)` : job.status}
                        </span>
                      </div>

                      <div className="progress-container">
                        <div 
                          className={`progress-bar ${job.status === 'completed' ? 'success' : ''} ${job.status === 'failed' ? 'failed' : ''}`}
                          style={{ width: `${job.progress}%` }}
                        ></div>
                      </div>

                      {job.status === 'failed' && (
                        <div className="error-text">
                          Error: {job.error}
                        </div>
                      )}

                      {job.status === 'completed' && (
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                          <button className="btn btn-small" onClick={() => handleOpenFile(job.destPath)}>
                            Open File
                          </button>
                          <button className="btn btn-small" onClick={() => handleOpenFolder(job.destPath)}>
                            Open Location
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* FOOTER SECTION (COMMON) */}
      <footer className="status-footer">
        <span>GNU/Linux Offline Utility</span>
        <div className="engine-status">
          <div className="engine-item">
            <span className={`dot ${tools.ffmpeg ? 'ok' : 'missing'}`}></span>
            FFmpeg
          </div>
          <div className="engine-item">
            <span className={`dot ${tools.magick ? 'ok' : 'missing'}`}></span>
            ImageMagick
          </div>
          <div className="engine-item">
            <span className={`dot ${tools.pandoc ? 'ok' : 'missing'}`}></span>
            Pandoc
          </div>
          <div className="engine-item">
            <span className={`dot ${tools.libreoffice ? 'ok' : 'missing'}`}></span>
            LibreOffice
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
