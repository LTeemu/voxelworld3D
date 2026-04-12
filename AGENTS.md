# AGENTS.md

## Quick Start

```bash
npm start         # Root: starts Docker, backend, frontend concurrently
# OR manually:
docker-compose up -d
cd backend && npm run start
cd frontend && npm run dev
```

## Project Structure

- **root/** - Entry point scripts (`start.js`, `start.bat`), docker-compose
- **frontend/** - React + Vite + React Three Fiber (3D world). ESM modules.
- **backend/** - Express + Socket.io + PostgreSQL. CommonJS.

## Key Commands

| Location | Command | Notes |
|----------|---------|-------|
| root | `npm start` | Auto-starts Docker if not running, then launches services |
| frontend | `npm run dev` | Vite dev server on localhost:5173 |
| frontend | `npm run build` | Production build |
| frontend | `npm run lint` | ESLint |
| backend | `npm run start` | Node server (prod) |
| backend | `npm run dev` | Nodemon (dev) |

## Dependencies

- **Backend**: Express, Socket.io, PostgreSQL (pg), JWT, bcrypt, dotenv, Jimp (image processing)
- **Frontend**: React 19, Three.js, React Three Fiber/Drei/Rapier, Zustand, Socket.io-client, Axios

## Database

PostgreSQL 15 via Docker. Connection config in `backend/.env`:
- User: `vw_user`, Password: `vw_password`, DB: `virtualworld`, Port: `5432`

## Environment

- `.env` file required in **backend/** directory (not in root)
- No typechecking or tests configured in either package

## Windows-Specific

`start.js` auto-launches Docker Desktop from `C:\Program Files\Docker\Docker\Docker Desktop.exe`. On other OS, start Docker manually.