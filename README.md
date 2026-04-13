# 🌍 3D Voxel World - AI-Assisted Sandbox

A real-time multiplayer voxel sandbox with AI-assisted world generation. Originally designed for prompt-based generation, now focusing on core survival gameplay with physics-based building and mining.

> Note: This is a personal project made with AI assistance. Features are limited and experimental.

## What It Does

- **Multiplayer voxel world** - Join with friends, see each other move in real-time
- **Basic building & mining** - Break and place blocks with physics colliders
- **Instanced rendering** - Optimized rendering for voxel performance

## What's Not Working / Incomplete

- ❌ Prompt-to-world generation (placeholder only)
- ❌ Image-to-world upload (placeholder only)
- ❌ Full physics interactions (colliders limited)
- ❌ Mining/resource system (basic block breaking only)
- ❌ Inventory system

## 🛠️ Tech Stack

### Frontend
| Package | Purpose |
|---------|---------|
| React 19 | UI framework |
| Three.js | 3D rendering |
| @react-three/fiber | React renderer for Three.js |
| @react-three/drei | Helper components |
| @react-three/rapier | Physics engine |
| Socket.io Client | Real-time sync |
| Zustand | State management |
| Vite | Build tool |

### Backend
| Package | Purpose |
|---------|---------|
| Node.js + Express | Server |
| Socket.io | Multiplayer sync |
| PostgreSQL | World persistence |
| seedrandom | Deterministic seeds |

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Docker Desktop (for PostgreSQL)
