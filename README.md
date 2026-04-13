# 🌍 3D Voxel World - A real-time multiplayer voxel sandbox with prompt-based worlds

> Note: This is a personal project made with AI assistance. Features are limited and experimental.

## What It Does

- **Voxel world generation** - Deterministic worlds from prompt/seed (share prompt to join same world)
- **Real-time multiplayer** - See other players move in real-time
- **Player status** - See who's online/offline
- **Jump and fly** - Basic movement around the world
- **Surface walking** - Block colliders for standing on surfaces (blue = jump, red = fall)
- **Debug tools** - Toggle debug mode to see colliders and block rendering

## What's Not Working / Incomplete

- ❌ Everything

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

### Install & Run

```bash
npm start
```

This starts Docker (if not running), then launches both backend and frontend concurrently.

### Manual Start (if needed)

```bash
# Start database
docker-compose up -d

# Backend
cd backend && npm run start

# Frontend
cd frontend && npm run dev
```

Open http://localhost:5173 in your browser.
