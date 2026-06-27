import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
import { EventsOn, EventsOff, OnFileDrop, OnFileDropOff } from '../wailsjs/runtime/runtime';

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

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'Audio':
      return (
        <svg className="job-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      );
    case 'Video':
      return (
        <svg className="job-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="2" ry="2" />
          <line x1="7" y1="2" x2="7" y2="22" />
          <line x1="17" y1="2" x2="17" y2="22" />
          <line x1="2" y1="12" x2="22" y2="12" />
        </svg>
      );
    case 'Image':
      return (
        <svg className="job-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      );
    case 'Document':
      return (
        <svg className="job-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
    default:
      return (
        <svg className="job-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 19 22 14 2 14 2 19" />
          <rect x="2" y="6" width="20" height="8" />
        </svg>
      );
  }
};

interface CustomSelectProps {
  value: string;
  options: string[];
  onChange: (val: string) => void;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ value, options, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const toggleDropdown = () => {
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX
      });
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    const handleClose = (event: Event) => {
      // If the user clicked the trigger button or inside the dropdown, do not close here (let their handlers handle it)
      if (
        triggerRef.current?.contains(event.target as Node) ||
        dropdownRef.current?.contains(event.target as Node)
      ) {
        return;
      }
      setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClose);
      window.addEventListener('scroll', handleClose, true); // true captures scroll events inside any overflow container
      window.addEventListener('resize', handleClose);
    }

    return () => {
      document.removeEventListener('mousedown', handleClose);
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
    };
  }, [isOpen]);

  return (
    <div className="custom-select-wrapper">
      <button 
        ref={triggerRef}
        type="button"
        className={`select-trigger ${isOpen ? 'active' : ''}`}
        onClick={toggleDropdown}
      >
        <span>{value.toUpperCase()}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="chevron-icon">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      
      {isOpen && createPortal(
        <div 
          ref={dropdownRef}
          className="select-dropdown" 
          style={{ 
            position: 'absolute',
            top: `${coords.top + 4}px`, 
            left: `${coords.left}px`
          }}
          onClick={(e) => e.stopPropagation()} // Prevent close on inside click
        >
          {options.map(opt => (
            <div 
              key={opt} 
              className={`select-dropdown-item ${opt === value ? 'selected' : ''}`}
              onClick={() => {
                onChange(opt);
                setIsOpen(false);
              }}
            >
              {opt.toUpperCase()}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

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

    // Native Drag and Drop file drops listener
    OnFileDrop((x, y, paths) => {
      if (paths && paths.length > 0) {
        handleAddFiles(paths);
      }
    }, false); // 'false' registers the listener window-wide

    // Prevent default browser behavior (navigating/displaying the file) when files are dropped
    const preventDefault = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', preventDefault, false);
    window.addEventListener('drop', preventDefault, false);

    // Disable right-click context menu globally
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    window.addEventListener('contextmenu', handleContextMenu, false);

    return () => {
      EventsOff('conversion-progress');
      EventsOff('conversion-completed');
      EventsOff('conversion-failed');
      OnFileDropOff();
      window.removeEventListener('dragover', preventDefault);
      window.removeEventListener('drop', preventDefault);
      window.removeEventListener('contextmenu', handleContextMenu);
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
      setFiles(prev => {
        // Filter out duplicate file paths
        const filtered = newFiles.filter(nf => !prev.some(f => f.path === nf.path));
        return [...prev, ...filtered];
      });
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

  const handleRemoveQueueItem = (id: string) => {
    setQueue(prev => prev.filter(job => job.id !== id));
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
                        <CustomSelect 
                          value={file.targetFormat}
                          options={file.supportedFormats}
                          onChange={(val) => handleFormatChange(idx, val)}
                        />
                        
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
              <div className="queue-section-header">
                <h2>Conversion History</h2>
                {queue.length > 0 && (
                  <button className="btn btn-small" onClick={clearQueue}>
                    Clear All
                  </button>
                )}
              </div>
              
              <div className="queue-list">
                {queue.length === 0 ? (
                  <div className="empty-state">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <h3>No conversion history</h3>
                    <p>Active conversion tasks and history will be listed here.</p>
                  </div>
                ) : (
                  queue.map(job => (
                    <div className="queue-row" key={job.id}>
                      <div className="queue-row-main">
                        {getCategoryIcon(job.category)}
                        <div className="queue-row-content">
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
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.1rem' }}>
                              <button className="btn btn-small" onClick={() => handleOpenFile(job.destPath)}>
                                Open File
                              </button>
                              <button className="btn btn-small" onClick={() => handleOpenFolder(job.destPath)}>
                                Open Location
                              </button>
                            </div>
                          )}
                        </div>

                        <button className="btn-close" onClick={() => handleRemoveQueueItem(job.id)} title="Remove from history">
                          ✕
                        </button>
                      </div>
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
      </footer>
    </div>
  );
}

export default App;
