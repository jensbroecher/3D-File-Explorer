import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { FolderOpen, Box, FileBox, LayoutGrid, List, Grid, File, Upload } from 'lucide-react';
import Viewer from './components/Viewer';
import ThumbnailGenerator from './components/ThumbnailGenerator';
import SplashOverlay from './components/SplashOverlay';
import localforage from 'localforage';
import { ErrorBoundary } from 'react-error-boundary';

const SUPPORTED_EXTENSIONS = ['glb', 'gltf', 'fbx', 'obj', 'stl'];
const CACHE_BATCH_SIZE = 20; // load cache in small chunks to avoid freezing

function App() {
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [showSplash, setShowSplash] = useState(() => {
    return localStorage.getItem('hasSeenSplash') !== 'true';
  });
  const [isDragging, setIsDragging] = useState(false);
  const [thumbnails, setThumbnails] = useState({});
  const [thumbnailQueue, setThumbnailQueue] = useState([]);
  const dragCounterRef = useRef(0);
  const appRef = useRef(null);

  // ---------------------------------------------------------------------------
  // Directory scanning
  // ---------------------------------------------------------------------------
  const scanDirectory = async (dirHandle, path = '') => {
    let foundFiles = [];
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file') {
        const ext = entry.name.split('.').pop().toLowerCase();
        if (SUPPORTED_EXTENSIONS.includes(ext)) {
          foundFiles.push({ name: entry.name, path: path + entry.name, handle: entry, extension: ext });
        }
      } else if (entry.kind === 'directory') {
        const subFiles = await scanDirectory(entry, path + entry.name + '/');
        foundFiles.push(...subFiles);
      }
    }
    return foundFiles;
  };

  // ---------------------------------------------------------------------------
  // Load cache in batches to avoid freezing the main thread
  // ---------------------------------------------------------------------------
  const loadThumbnailCache = async (foundFiles) => {
    const cached = {};
    const queue = [];

    for (let i = 0; i < foundFiles.length; i += CACHE_BATCH_SIZE) {
      const batch = foundFiles.slice(i, i + CACHE_BATCH_SIZE);
      await Promise.all(
        batch.map(async (f) => {
          try {
            const data = await localforage.getItem(`thumb_${f.path}`);
            if (data) cached[f.path] = data;
            else queue.push(f);
          } catch {
            queue.push(f);
          }
        })
      );
      // Yield to the browser between batches
      await new Promise((r) => setTimeout(r, 0));
    }

    setThumbnails(cached);
    setThumbnailQueue(queue);
  };

  // ---------------------------------------------------------------------------
  // Finalize a file list after scanning
  // ---------------------------------------------------------------------------
  const finalizeFiles = async (foundFiles) => {
    foundFiles.sort((a, b) => a.name.localeCompare(b.name));
    setFiles(foundFiles);
    setIsScanning(false);
    await loadThumbnailCache(foundFiles);
  };

  // ---------------------------------------------------------------------------
  // Open a FOLDER via picker
  // ---------------------------------------------------------------------------
  const handleOpenDirectory = async () => {
    try {
      if (!('showDirectoryPicker' in window)) {
        alert("Your browser doesn't support the File System Access API. Please use Chrome or Edge.");
        return;
      }
      const dirHandle = await window.showDirectoryPicker();
      setIsScanning(true);
      setFiles([]);
      setActiveFile(null);
      setThumbnails({});
      setThumbnailQueue([]);
      const foundFiles = await scanDirectory(dirHandle);
      await finalizeFiles(foundFiles);
    } catch (err) {
      setIsScanning(false);
      if (err.name !== 'AbortError') {
        console.error(err);
        alert('Error opening directory: ' + err.message);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Open a SINGLE FILE via picker
  // ---------------------------------------------------------------------------
  const handleOpenFile = async () => {
    try {
      if (!('showOpenFilePicker' in window)) {
        alert("Your browser doesn't support the File System Access API. Please use Chrome or Edge.");
        return;
      }
      const [fileHandle] = await window.showOpenFilePicker({
        types: [
          {
            description: '3D Model Files',
            accept: {
              'model/*': ['.glb', '.gltf', '.fbx', '.obj', '.stl'],
            },
          },
        ],
        multiple: false,
      });
      const ext = fileHandle.name.split('.').pop().toLowerCase();
      if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        alert('Unsupported file type. Supported: GLB, GLTF, FBX, OBJ, STL');
        return;
      }
      const fileObj = await fileHandle.getFile();
      const url = URL.createObjectURL(fileObj);
      const fileInfo = {
        name: fileHandle.name,
        path: fileHandle.name,
        handle: fileHandle,
        extension: ext,
        url,
        size: (fileObj.size / 1024 / 1024).toFixed(2) + ' MB',
      };
      // Add to list if not already there
      setFiles((prev) => {
        const exists = prev.find((f) => f.path === fileInfo.path);
        return exists ? prev : [fileInfo, ...prev];
      });
      setActiveFile(fileInfo);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error(err);
        alert('Error opening file: ' + err.message);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Drag & Drop
  // ---------------------------------------------------------------------------
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);

    const items = Array.from(e.dataTransfer.items);
    const foundFiles = [];

    const processEntry = async (entry, path = '') => {
      if (entry.isFile) {
        return new Promise((resolve) => {
          entry.file((file) => {
            const ext = file.name.split('.').pop().toLowerCase();
            if (SUPPORTED_EXTENSIONS.includes(ext)) {
              // Create a pseudo-handle that wraps the File object
              const pseudoHandle = {
                getFile: () => Promise.resolve(file),
                name: file.name,
              };
              foundFiles.push({
                name: file.name,
                path: path + file.name,
                handle: pseudoHandle,
                extension: ext,
              });
            }
            resolve();
          });
        });
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const readAll = () =>
          new Promise((resolve) => {
            const results = [];
            const readBatch = () => {
              reader.readEntries(async (entries) => {
                if (entries.length === 0) {
                  resolve(results);
                } else {
                  results.push(...entries);
                  readBatch();
                }
              });
            };
            readBatch();
          });
        const entries = await readAll();
        for (const child of entries) {
          await processEntry(child, path + entry.name + '/');
        }
      }
    };

    for (const item of items) {
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry?.();
        if (entry) await processEntry(entry);
      }
    }

    if (foundFiles.length === 0) {
      alert('No supported 3D files found. Supported: GLB, GLTF, FBX, OBJ, STL');
      return;
    }

    setIsScanning(true);
    setFiles([]);
    setActiveFile(null);
    setThumbnails({});
    setThumbnailQueue([]);
    await finalizeFiles(foundFiles);
  }, []);

  // Attach drag events to the whole app
  useEffect(() => {
    const el = appRef.current;
    if (!el) return;
    el.addEventListener('dragenter', handleDragEnter);
    el.addEventListener('dragleave', handleDragLeave);
    el.addEventListener('dragover', handleDragOver);
    el.addEventListener('drop', handleDrop);
    return () => {
      el.removeEventListener('dragenter', handleDragEnter);
      el.removeEventListener('dragleave', handleDragLeave);
      el.removeEventListener('dragover', handleDragOver);
      el.removeEventListener('drop', handleDrop);
    };
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  // ---------------------------------------------------------------------------
  // Click to open a file from the list
  // ---------------------------------------------------------------------------
  const handleFileClick = async (fileInfo) => {
    try {
      if (activeFile?.url) URL.revokeObjectURL(activeFile.url);
      const file = await fileInfo.handle.getFile();
      const url = URL.createObjectURL(file);
      setActiveFile({ ...fileInfo, url, size: (file.size / 1024 / 1024).toFixed(2) + ' MB' });
    } catch (err) {
      console.error(err);
      alert('Error reading file: ' + err.message);
    }
  };

  // ---------------------------------------------------------------------------
  // Thumbnail queue
  // ---------------------------------------------------------------------------
  const currentThumbnailFile = thumbnailQueue[0];
  const handleThumbnailComplete = async (path, dataUrl) => {
    if (dataUrl) {
      await localforage.setItem(`thumb_${path}`, dataUrl);
      setThumbnails((prev) => ({ ...prev, [path]: dataUrl }));
    }
    setThumbnailQueue((prev) => prev.slice(1));
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="app-container" ref={appRef}>
      {showSplash && (
        <SplashOverlay
          onDismiss={() => {
            setShowSplash(false);
            localStorage.setItem('hasSeenSplash', 'true');
          }}
        />
      )}

      {/* Drag-over overlay */}
      {isDragging && (
        <div className="drop-overlay">
          <div className="drop-overlay-inner">
            <Upload size={56} strokeWidth={1.5} />
            <h2>Drop 3D files or folders here</h2>
            <p>GLB · GLTF · FBX · OBJ · STL</p>
          </div>
        </div>
      )}

      {/* Background thumbnail worker */}
      {currentThumbnailFile && (
        <ErrorBoundary
          fallback={null}
          onError={() => handleThumbnailComplete(currentThumbnailFile.path, null)}
        >
          <ThumbnailGenerator
            key={currentThumbnailFile.path}
            file={currentThumbnailFile}
            onComplete={handleThumbnailComplete}
          />
        </ErrorBoundary>
      )}

      {/* Sidebar */}
      <aside className={`sidebar glass-panel ${!activeFile ? 'full-width' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-area" style={{ marginBottom: 0 }}>
            <LayoutGrid size={24} color="#a855f7" />
            <span>3D Explorer</span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {/* Open folder */}
            <button
              className="btn"
              onClick={handleOpenDirectory}
              disabled={isScanning}
              title="Open folder"
              style={{ flex: 1, justifyContent: 'center' }}
            >
              <FolderOpen size={18} />
              {isScanning ? 'Scanning…' : 'Folder'}
            </button>

            {/* Open single file */}
            <button
              className="btn btn-secondary"
              onClick={handleOpenFile}
              disabled={isScanning}
              title="Open single file"
            >
              <File size={18} />
              File
            </button>

            <div className="view-toggles">
              <button
                className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="List View"
              >
                <List size={18} />
              </button>
              <button
                className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid View"
              >
                <Grid size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* File count badge */}
        {files.length > 0 && !isScanning && (
          <div className="file-count-badge">
            {files.length} model{files.length !== 1 ? 's' : ''} •{' '}
            {thumbnailQueue.length > 0 ? `${thumbnailQueue.length} previews left` : 'all previews ready'}
          </div>
        )}

        <div className={`file-list ${viewMode === 'grid' ? 'grid-view' : ''}`}>
          {files.length === 0 && !isScanning ? (
            <div className="empty-state" style={viewMode === 'grid' ? { gridColumn: '1 / -1' } : {}}>
              <FileBox size={48} strokeWidth={1} />
              <p>
                No 3D models selected.
                <br />
                Open a folder, pick a file, or drag & drop.
              </p>
            </div>
          ) : (
            files.map((file, idx) => {
              const isActive = activeFile?.path === file.path;
              const hasThumb = thumbnails[file.path];

              if (viewMode === 'list') {
                return (
                  <div
                    key={idx}
                    className={`file-item ${isActive ? 'active' : ''}`}
                    onClick={() => handleFileClick(file)}
                  >
                    <Box size={18} className="file-icon" />
                    <span className="file-name" title={file.name}>
                      {file.name}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={idx}
                  className={`file-item grid-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleFileClick(file)}
                  title={file.name}
                >
                  <div className="thumbnail-container">
                    {hasThumb ? (
                      <img src={hasThumb} className="thumbnail-image" alt={file.name} loading="lazy" />
                    ) : (
                      <Box size={32} className="file-icon" style={{ opacity: 0.5 }} />
                    )}
                  </div>
                  <span className="file-name">{file.name}</span>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {activeFile ? (
          <>
            <div className="viewer-header glass">
              <div className="file-info">
                <div>
                  <h2 className="file-title" title={activeFile.name}>
                    {activeFile.name}
                  </h2>
                  <span className="file-size">
                    {activeFile.size} • {activeFile.extension.toUpperCase()} Format
                  </span>
                </div>
              </div>
            </div>
            <Viewer file={activeFile} />
          </>
        ) : (
          <div className="empty-state drop-hint" style={{ height: '100%', width: '100%' }}>
            <Upload size={48} strokeWidth={1} style={{ opacity: 0.4 }} />
            <h2>Select a 3D model to view</h2>
            <p>Open a folder, pick a single file, or drag & drop anywhere</p>
            <p style={{ marginTop: 4, opacity: 0.5, fontSize: '0.85rem' }}>
              Supported: GLB, GLTF, FBX, OBJ, STL
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
