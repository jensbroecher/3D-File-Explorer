import React from 'react';
import { Box, FolderOpen, MousePointer2, Zap, ArrowRight } from 'lucide-react';

const SplashOverlay = ({ onDismiss }) => {
  return (
    <div className="splash-overlay">
      <div className="splash-content glass-panel">
        <div className="splash-header">
          <div className="splash-logo">
            <Box size={40} color="#a855f7" strokeWidth={1.5} />
            <h1>3D File Explorer</h1>
          </div>
          <p className="splash-subtitle">A powerful and simple way to browse your 3D files locally</p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">
              <FolderOpen size={24} />
            </div>
            <h3>Local Folder Access</h3>
            <p>Securely browse your local 3D libraries with the File System Access API.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <Zap size={24} />
            </div>
            <h3>Fast Previews</h3>
            <p>Instant thumbnail generation and caching for widespread 3D file formats.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <MousePointer2 size={24} />
            </div>
            <h3>Interactive Inspection</h3>
            <p>Full orbit, pan, and zoom controls. Support for GLB, GLTF, FBX, OBJ, and STL.</p>
          </div>
        </div>

        <div className="splash-footer">
          <button className="btn-primary" onClick={onDismiss}>
            Get Started
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SplashOverlay;
