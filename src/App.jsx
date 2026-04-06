import React, { useState } from 'react';
import './App.css';
import { FolderOpen, Box, FileBox, LayoutGrid } from 'lucide-react';
import Viewer from './components/Viewer';

function App() {
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  // Helper to scan directory recursively
  const scanDirectory = async (dirHandle, path = '') => {
    let foundFiles = [];
    const supportedExtensions = ['glb', 'gltf', 'fbx', 'obj', 'stl'];
    
    // We use dirHandle.values() which is an async iterable
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
        // Recursively read subdirectories
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
      
      // Sort alphabetically
      foundFiles.sort((a, b) => a.name.localeCompare(b.name));
      
      setFiles(foundFiles);
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
      // Clean up previous URL to avoid memory leaks
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

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar glass-panel">
        <div className="sidebar-header">
          <div className="logo-area">
            <LayoutGrid size={24} color="#a855f7" />
            <span>3D Explorer</span>
          </div>
          <button 
            className="btn" 
            onClick={handleOpenDirectory}
            disabled={isScanning}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <FolderOpen size={18} />
            {isScanning ? 'Scanning...' : 'Open Folder'}
          </button>
        </div>

        <div className="file-list">
          {files.length === 0 && !isScanning ? (
            <div className="empty-state">
              <FileBox size={48} strokeWidth={1} />
              <p>No 3D models selected.<br/>Open a folder to start.</p>
            </div>
          ) : (
            files.map((file, idx) => (
              <div 
                key={idx}
                className={`file-item ${activeFile?.path === file.path ? 'active' : ''}`}
                onClick={() => handleFileClick(file)}
              >
                <Box size={18} className="file-icon" />
                <span className="file-name" title={file.path}>{file.name}</span>
              </div>
            ))
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
                  <h2 className="file-title">{activeFile.name}</h2>
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
