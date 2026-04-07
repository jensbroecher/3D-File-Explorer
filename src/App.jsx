import React, { useState, useEffect } from 'react';
import './App.css';
import { FolderOpen, Box, FileBox, LayoutGrid, List, Grid } from 'lucide-react';
import Viewer from './components/Viewer';
import ThumbnailGenerator from './components/ThumbnailGenerator';
import SplashOverlay from './components/SplashOverlay';
import localforage from 'localforage';
import { ErrorBoundary } from 'react-error-boundary';

function App() {
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [showSplash, setShowSplash] = useState(() => {
    return localStorage.getItem('hasSeenSplash') !== 'true';
  });
  
  const [thumbnails, setThumbnails] = useState({});
  const [thumbnailQueue, setThumbnailQueue] = useState([]);

  // Helper to scan directory recursively
  const scanDirectory = async (dirHandle, path = '') => {
    let foundFiles = [];
    const supportedExtensions = ['glb', 'gltf', 'fbx', 'obj', 'stl'];
    
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file') {
        const ext = entry.name.split('.').pop().toLowerCase();
        if (supportedExtensions.includes(ext)) {
          foundFiles.push({
            name: entry.name,
            path: path + entry.name,
            handle: entry,
            extension: ext
          });
        }
      } else if (entry.kind === 'directory') {
        const subFiles = await scanDirectory(entry, path + entry.name + '/');
        foundFiles.push(...subFiles);
      }
    }
    return foundFiles;
  };

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
      
      const foundFiles = await scanDirectory(dirHandle);
      foundFiles.sort((a, b) => a.name.localeCompare(b.name));
      
      setFiles(foundFiles);
      
      // Load cached thumbnails or start generator queue
      const cached = {};
      const queue = [];
      for (const f of foundFiles) {
        const data = await localforage.getItem(`thumb_${f.path}`);
        if (data) {
          cached[f.path] = data;
        } else {
          queue.push(f);
        }
      }
      setThumbnails(cached);
      setThumbnailQueue(queue);
      setIsScanning(false);
    } catch (err) {
      setIsScanning(false);
      if (err.name !== 'AbortError') {
        console.error(err);
        alert("Error opening directory: " + err.message);
      }
    }
  };

  const handleFileClick = async (fileInfo) => {
    try {
      if (activeFile && activeFile.url) {
        URL.revokeObjectURL(activeFile.url);
      }

      const file = await fileInfo.handle.getFile();
      const url = URL.createObjectURL(file);
      
      setActiveFile({
        ...fileInfo,
        url,
        size: (file.size / 1024 / 1024).toFixed(2) + ' MB'
      });
    } catch (err) {
      console.error(err);
      alert("Error reading file: " + err.message);
    }
  };

  const currentThumbnailFile = thumbnailQueue[0];
  const handleThumbnailComplete = async (path, dataUrl) => {
    if (dataUrl) {
      await localforage.setItem(`thumb_${path}`, dataUrl);
      setThumbnails(prev => ({ ...prev, [path]: dataUrl }));
    }
    setThumbnailQueue(prev => prev.slice(1));
  };

  return (
    <div className="app-container">
      {showSplash && (
        <SplashOverlay onDismiss={() => {
          setShowSplash(false);
          localStorage.setItem('hasSeenSplash', 'true');
        }} />
      )}
      {/* Background worker that strictly processes one thumbnail at a time */}
      {currentThumbnailFile && (
        <ErrorBoundary fallback={null} onError={() => handleThumbnailComplete(currentThumbnailFile.path, null)}>
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
            <button 
              className="btn" 
              onClick={handleOpenDirectory}
              disabled={isScanning}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              <FolderOpen size={18} />
              {isScanning ? 'Scan...' : 'Open'}
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

        <div className={`file-list ${viewMode === 'grid' ? 'grid-view' : ''}`}>
          {files.length === 0 && !isScanning ? (
            <div className="empty-state" style={viewMode === 'grid' ? { gridColumn: '1 / -1' } : {}}>
              <FileBox size={48} strokeWidth={1} />
              <p>No 3D models selected.<br/>Open a folder to start.</p>
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
                    <span className="file-name" title={file.name}>{file.name}</span>
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
                  <h2 className="file-title" title={activeFile.name}>{activeFile.name}</h2>
                  <span className="file-size">{activeFile.size} • {activeFile.extension.toUpperCase()} Format</span>
                </div>
              </div>
            </div>
            <Viewer file={activeFile} />
          </>
        ) : (
          <div className="empty-state" style={{ height: '100%', width: '100%' }}>
            <h2>Select a 3D model to view</h2>
            <p>Supported formats: GLB, GLTF, FBX, OBJ, STL</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
