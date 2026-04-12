@echo off
echo =========================================
echo Starting Virtual World 3D Local Environment
echo =========================================

echo.
echo [1/3] Starting Database...
docker-compose up -d

echo.
echo [2/3] Starting Backend Server...
start "VirtualWorld Backend" cmd /c "cd backend && npm run start"

echo.
echo [3/3] Starting Frontend Server...
start "VirtualWorld Frontend" cmd /c "cd frontend && npm run dev"

echo.
echo All services have been instructed to start!
echo If Docker was running, the UI will be available shortly at:
echo http://localhost:5173
echo.
pause
