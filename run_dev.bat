@echo off
echo ===================================================
echo   Macro Regime Detection Platform - Local Launcher
echo ===================================================
echo.
echo Launching Backend (FastAPI on Port 8000)...
start "Macro API Backend" cmd /k "python -m uvicorn backend.api.index:app --port 8000 --reload"

echo Launching Frontend (Vite/React on Port 3000)...
start "Macro Frontend Dashboard" cmd /k "cd frontend && npm run dev"

echo.
echo Both services are starting in independent terminal windows.
echo - Close the respective windows to stop a service.
echo - Reload either window by pressing Ctrl+C.
echo ===================================================
pause
