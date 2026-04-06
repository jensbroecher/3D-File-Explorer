# 🚀 3D File Explorer 

A sleek, intuitive web application designed to natively explore directories of 3D models right in your browser, without needing to upload files to any server. This app acts as a local gallery viewer for popular 3D file formats.

![3D File Explorer](/public/vite.svg) *(Icon placeholder)*

## 🌟 Features

- **Local Directory Browsing:** By leveraging the modern Web `File System Access API`, the app can securely read folders right off your local hard drive. No uploads, keeping your models completely private and instantaneously loadable.
- **Robust Multi-Format Support:** Easily handles `.glb`, `.gltf`, `.fbx`, `.obj`, and `.stl` models.
- **State-of-the-art Renderer:** Hardware-accelerated WebGL viewer powered by `Three.js` and `React Three Fiber`.
- **Intelligent Framing System:** Models automatically center and fit to the viewport using a safe automated-bounds algorithm, preventing random scaling drops or clipping.
- **Glassmorphism UI:** A sleek, modern user interface bringing a premium feel to 3D asset workflows.
- **Desktop Ready:** Built with web standards, the bundle is entirely ready to be natively packaged into an Electron or Tauri application.

## 🛠️ Technology Stack

- **Framework:** React 18 & Vite
- **3D Rendering:** Three.js, @react-three/fiber, @react-three/drei, three-stdlib
- **Icons:** Lucide React
- **Styling:** Vanilla CSS Variables & Modules

## ⚙️ Getting Started

### Prerequisites

Ensure you have Node.js installed. We recommend Node.js `v20.x` or later.

### Installation

1. Clone or download the repository.
2. Install the necessary dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open the displayed `localhost` link in any Chromium-based browser (Chrome, Edge, Brave, Arc). Safari and Firefox currently do not support the local `File System Access` API directory pickers.

## 📁 Usage

1. Launch the web app.
2. Click the **"Open Folder"** button in the top left sidebar.
3. Grant the browser permission to read the selected folder.
4. The system will recursively scan and list all valid 3D models within that directory.
5. Click on any model in the list to beautifully render and explore it interactively in the main viewport!

## 🚧 Roadmap & Electron

Because the core architecture exclusively implements Frontend Node standards (using Local Blob URLs and the local file system), migrating this Explorer to a standalone desktop application via `Electron` is as easy as wrapping the production `dist` map in a basic `BrowserWindow`. 

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.
