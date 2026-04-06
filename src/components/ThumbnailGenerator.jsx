import React, { useEffect, useState, Suspense } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Sky, Environment, Center, Bounds } from '@react-three/drei';
import localforage from 'localforage';
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three-stdlib';
import { FBXLoader } from 'three-stdlib';
import { OBJLoader } from 'three-stdlib';
import { STLLoader } from 'three-stdlib';
import { DRACOLoader } from 'three-stdlib';

const ModelParams = ({ url, extension }) => {
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

const CaptureFrame = ({ onCapture }) => {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    // Wait a couple frames to ensure shaders compiled and bounds centered
    let handleId;
    let frames = 0;
    const capture = () => {
      if (frames < 3) {
        frames++;
        handleId = requestAnimationFrame(capture);
        return;
      }
      gl.render(scene, camera);
      const dataUrl = gl.domElement.toDataURL('image/webp', 0.5);
      onCapture(dataUrl);
    };
    handleId = requestAnimationFrame(capture);
    return () => cancelAnimationFrame(handleId);
  }, [gl, scene, camera, onCapture]);
  return null;
};

// Generates a snapshot silently.
export default function ThumbnailGenerator({ file, onComplete }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let active = true;
    const gen = async () => {
      try {
        const fileObj = await file.handle.getFile();
        const objUrl = URL.createObjectURL(fileObj);
        if (active) setUrl(objUrl);
      } catch (err) {
        onComplete(file.path, null);
      }
    };
    gen();
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);

  if (!url) return null;

  const handleCapture = (dataUrl) => {
    onComplete(file.path, dataUrl);
  };

  return (
    <div style={{ width: '256px', height: '256px', position: 'absolute', left: '-9999px', pointerEvents: 'none', zIndex: -999 }}>
      <Suspense fallback={null}>
        <Canvas gl={{ preserveDrawingBuffer: true, antialias: false }} shadows={false} camera={{ position: [0, 0, 5], fov: 45 }}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 10]} intensity={1} />
          <Bounds fit clip observe margin={1.2}>
            <Center>
              <ModelParams url={url} extension={file.extension} />
            </Center>
          </Bounds>
          <CaptureFrame onCapture={handleCapture} />
        </Canvas>
      </Suspense>
    </div>
  );
}
