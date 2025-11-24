
---

# GLTF Viewer with Three.js

A lightweight GLTF model viewer built with Three.js.

## 🌐 Code Repository

* **GitHub**: [https://github.com/ViewSuSu/Su.ThreeJS.Demo](https://github.com/ViewSuSu/Su.ThreeJS.Demo)
* **Gitee**: [https://gitee.com/SususuChang/su.-three-js.-demo](https://gitee.com/SususuChang/su.-three-js.-demo)

## 🎬 Demo Preview

![Demo Preview](Three.jsHD.gif)

## ✨ Features

* 🎯 **Model Loading** – Supports loading and displaying 3D models in GLTF/GLB formats
* 🔄 **Interactive Control** – Allows model rotation and inspection
* 🎯 **Selection & Positioning** – Click to select and automatically focus on model parts
* 💡 **Highlighting** – Highlights the selected model component
* ℹ️ **Information Panel** – Dockable information display panel
* 🌳 **Structure Tree** – Tree view of model hierarchy
* 📦 **Lightweight Dependencies** – Minimal dependencies, focused on core functionalities
* 🗂️ **Integrated Data & Model** – Stores data directly inside the 3D model

## 🚀 Quick Start

### Run the Project

Simply open the `index.html` file:

```bash
# Open directly in your browser
Double-click the index.html file
```

## 💡 Technical Highlights

### Integrated Data–Model Storage

Unlike most solutions on the market that export data separately in JSON files, this project takes advantage of the GLTF file format by embedding model-related data directly inside the `.glb` file using custom data nodes. This eliminates the need for external data files and achieves unified management of data and model information.

## 📁 Project Structure

```
Project Root/
├── .git/               # Git version control directory
├── models/             # Model files
│   └── basic_sample_project.glb  # Sample GLB model
├── index.html          # Main HTML file
├── README.md           # Project documentation
├── script.js           # Main JavaScript logic
└── style.css           # Stylesheet
```

## 🛠 Tech Stack

* [Three.js](https://threejs.org/) – 3D graphics library
* GLTF/GLB format support
* Pure front-end implementation, no backend required

## 🎮 Controls

* **Left Mouse Drag**: Rotate camera
* **Mouse Wheel**: Zoom view
* **Click Model**: Select and highlight
* **Click Structure Tree**: Browse model components

## 📄 License

MIT License

## 🤝 Contribution

Issues and Pull Requests are welcome!

---

If you want, I can also:
✅ polish the English wording
✅ generate a bilingual version
✅ generate a README badge pack
✅ optimize for GitHub SEO

Just tell me!
