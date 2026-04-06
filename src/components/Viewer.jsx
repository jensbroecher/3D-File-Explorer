import React, { useState, useRef, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky, Environment, Center, Bounds } from '@react-three/drei';
import { ErrorBoundary } from 'react-error-boundary';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import { FBXLoader } from 'three-stdlib';
import { OBJLoader } from 'three-stdlib';
import { STLLoader } from 'three-stdlib';
import { DRACOLoader } from 'three-stdlib';

const Model = ({ url, extension }) => {
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
  if (!file) return null;

  return (
    <div className="viewer-container">
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
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 10]} castShadow intensity={1} shadow-bias={-0.0001} />
            <Bounds fit clip observe margin={1.2}>
              <Center>
                <Model url={file.url} extension={file.extension} />
              </Center>
            </Bounds>
            <OrbitControls makeDefault autoRotate autoRotateSpeed={0.5} />
          </Canvas>
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
