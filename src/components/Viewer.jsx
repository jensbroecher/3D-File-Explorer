import React, { useState, useRef, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky, Environment, Center, Bounds } from '@react-three/drei';
import { ErrorBoundary } from 'react-error-boundary';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { Info, Box, Triangle, Layers, Activity, Share2 } from 'lucide-react';
import { GLTFLoader } from 'three-stdlib';
import { FBXLoader } from 'three-stdlib';
import { OBJLoader } from 'three-stdlib';
import { STLLoader } from 'three-stdlib';
import { DRACOLoader } from 'three-stdlib';

const Model = ({ url, extension, onLoaded }) => {
  let loader;
  if (extension === 'glb' || extension === 'gltf') {
    loader = GLTFLoader;
  } else if (extension === 'fbx') {
    loader = FBXLoader;
  } else if (extension === 'obj') {
    loader = OBJLoader;
  } else if (extension === 'stl') {
    loader = STLLoader;
  } else {
    throw new Error(`Unsupported extension: ${extension}`);
  }

  const result = useLoader(loader, url, (loaderInst) => {
    if (extension === 'glb' || extension === 'gltf') {
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
      loaderInst.setDRACOLoader(dracoLoader);
    }
  });
  
  React.useEffect(() => {
    if (result) {
      let stats = {
        vertices: 0,
        faces: 0,
        textures: [],
        objects: 0,
        animations: 0,
        bones: 0,
      };

      const obj = extension === 'glb' || extension === 'gltf' ? result.scene : result;
      
      if (result.animations) stats.animations = result.animations.length;

      if (extension === 'stl') {
        // result is the geometry itself for STL
        if (result.attributes.position) {
          stats.vertices = result.attributes.position.count;
          stats.faces = stats.vertices / 3;
        }
      } else {
        obj.traverse((child) => {
          if (child.isBone) stats.bones++;
          
          if (child.isMesh) {
            stats.objects++;
            const geometry = child.geometry;
            if (geometry.attributes.position) {
              stats.vertices += geometry.attributes.position.count;
              if (geometry.index) {
                stats.faces += geometry.index.count / 3;
              } else {
                stats.faces += geometry.attributes.position.count / 3;
              }
            }

            // Fix for "black" materials often found in FBX or certain OBJ files
            if (child.material) {
              const materials = Array.isArray(child.material) ? child.material : [child.material];
              materials.forEach((mat) => {
                // If it's black and has no texture, maybe it's just a default material that needs light
                if (mat.color && mat.color.r === 0 && mat.color.g === 0 && mat.color.b === 0 && !mat.map) {
                  mat.color.setRGB(0.8, 0.8, 0.8);
                }
                
                // Ensure it responds to environment
                if (mat.envMapIntensity !== undefined) mat.envMapIntensity = 1.2;
                
                // Collect textures
                ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'specularMap', 'alphaMap', 'lightMap'].forEach(texType => {
                  if (mat[texType] && (mat[texType].name || mat[texType].image)) {
                    let texName = mat[texType].name;
                    if (!texName && mat[texType].image) {
                      texName = mat[texType].image.src ? mat[texType].image.src.split('/').pop().split('?')[0] : 'embedded texture';
                    }
                    if (texName && !stats.textures.includes(texName)) {
                      stats.textures.push(texName);
                    }
                  }
                });
              });
            }
          }
        });
      }
      
      onLoaded(stats);
    }
  }, [result, extension, onLoaded]);

  if (extension === 'stl') {
    return (
      <mesh geometry={result} dispose={null}>
        <meshStandardMaterial color="#888888" roughness={0.4} metalness={0.6} />
      </mesh>
    );
  }

  const obj = extension === 'glb' || extension === 'gltf' ? result.scene : result;
  
  return <primitive object={obj} dispose={null} />;
};

const FallbackComponent = ({ error, resetErrorBoundary }) => {
  return (
    <div className="error-message">
      <p>Error loading model:</p>
      <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem' }}>{error.message}</pre>
    </div>
  );
};

export default function Viewer({ file }) {
  const [stats, setStats] = useState(null);
  
  if (!file) return null;

  return (
    <div className="viewer-container">
      {stats && (
        <div className="model-details-panel glass">
          <div className="details-header">
            <Info size={14} />
            <span>Model Details</span>
          </div>
          <div className="details-row">
            <div className="detail-label-group">
              <Layers size={14} />
              <span>Vertices</span>
            </div>
            <span>{stats.vertices.toLocaleString()}</span>
          </div>
          <div className="details-row">
            <div className="detail-label-group">
              <Triangle size={14} />
              <span>Faces</span>
            </div>
            <span>{Math.round(stats.faces).toLocaleString()}</span>
          </div>
          <div className="details-row">
            <div className="detail-label-group">
              <Box size={14} />
              <span>Objects</span>
            </div>
            <span>{stats.objects}</span>
          </div>
          {stats.animations > 0 && (
            <div className="details-row">
              <div className="detail-label-group">
                <Activity size={14} />
                <span>Animations</span>
              </div>
              <span>{stats.animations}</span>
            </div>
          )}
          {stats.bones > 0 && (
            <div className="details-row">
              <div className="detail-label-group">
                <Share2 size={14} />
                <span>Bones</span>
              </div>
              <span>{stats.bones}</span>
            </div>
          )}
          {stats.textures.length > 0 && (
            <div className="details-section">
              <div className="details-label">Textures ({stats.textures.length})</div>
              <div className="textures-list">
                {stats.textures.slice(0, 5).map((tex, i) => (
                  <div key={i} className="texture-item" title={tex}>{tex}</div>
                ))}
                {stats.textures.length > 5 && <div className="texture-item opacity-50">+ {stats.textures.length - 5} more</div>}
              </div>
            </div>
          )}
        </div>
      )}
      
      <ErrorBoundary FallbackComponent={FallbackComponent} resetKeys={[file.url]}>
        <Suspense fallback={
          <div className="loading-overlay glass">
            <div className="spinner"></div>
            <div>Loading {file.name}...</div>
          </div>
        }>
          <Canvas shadows camera={{ position: [0, 0, -5], fov: 45 }}>
            <color attach="background" args={['transparent']} />
            <Sky sunPosition={[100, 20, 100]} turbidity={0.1} rayleigh={0.5} />
            <Environment preset="city" />
            <ambientLight intensity={0.7} />
            <directionalLight position={[10, 10, 10]} castShadow intensity={1.5} shadow-bias={-0.0001} />
            <directionalLight position={[-10, 5, -10]} intensity={0.5} />
            <Bounds fit clip observe margin={1.2}>
              <Center>
                <Model url={file.url} extension={file.extension} onLoaded={setStats} />
              </Center>
            </Bounds>
            <OrbitControls makeDefault autoRotate autoRotateSpeed={0.5} />
          </Canvas>
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
