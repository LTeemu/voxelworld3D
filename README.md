# 🌍 3D Prompt-Generated Voxel Multiplayer

**Type a prompt. Generate a world. Play with friends.**

A real‑time multiplayer voxel sandbox where every world is generated from your prompt. "snow" creates frozen tundra. "volcano" erupts with magma. "fairy dream" paints pastel mushroom forests. Each prompt produces a unique, deterministic seed—share it and friends join the exact same world.

![Voxel Multiplayer Demo](https://via.placeholder.com/800x400/1a1a2e/ffffff?text=Prompt+→+3D+Voxel+Multiplayer)

## ✨ Features

- **🎨 Prompt‑Driven Generation** – Every word influences temperature, moisture, colors, terrain, caves, and ore richness.
- **👥 Real‑Time Multiplayer** – See other players move, build, and mine in the same persistent world via Socket.io.
- **🧱 Fully Destructible** – Break and place blocks anywhere with Rapier physics colliders.
- **🏃 Smooth Controls** – ecctrl character controller for responsive movement and jumping.
- **🌋 Dynamic Biomes** – Snow, desert, forest, volcanic, fairy, void, and alien terrains—no hardcoded themes.
- **💎 Mining & Resources** – Coal, iron, gold, diamond, and copper spawn procedurally in caves.
- **📸 Image‑to‑World** – Upload an image and its pixels become playable terrain.
- **⚡ Optimized** – Thousands of instanced meshes with frustum culling for smooth performance.

## 🛠️ Tech Stack

### Frontend
| Package | Purpose |
|---------|---------|
| React 19 | UI framework |
| Three.js 0.183 | 3D rendering |
| @react-three/fiber | React renderer for Three.js |
| @react-three/drei | Helper components (OrbitControls, etc.) |
| @react-three/rapier | Physics engine integration |
| ecctrl | Character controller for player movement |
| Socket.io Client | Real‑time multiplayer sync |
| Zustand | State management |
| Vite 8 | Build tool and dev server |
| simplex-noise | Procedural noise generation |

### Backend
| Package | Purpose |
|---------|---------|
| Node.js + Express 5 | REST API server |
| Socket.io | WebSocket multiplayer server |
| PostgreSQL + pg | World data persistence |
| seedrandom | Deterministic PRNG from seeds |
| simplex-noise | 3D noise for caves and ores |
| Jimp | Image‑to‑world processing |
| jsonwebtoken + bcryptjs | Authentication |
| Nodemon | Dev auto‑restart |

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Docker Desktop (for PostgreSQL)
