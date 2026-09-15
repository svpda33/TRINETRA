@echo off
title NexTrAI Local Launcher
echo ===================================================
echo           Starting NexTrAI Local Services
echo ===================================================
echo.

:: Start Backend in a new window
echo [1/2] Launching NexTrAI FastAPI Backend on port 8000...
start "NexTrAI Backend (FastAPI)" cmd /k "cd /d "%~dp0backend" && set PYTHONIOENCODING=utf-8 && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

:: Wait 2 seconds for backend
timeout /t 2 /nobreak >nul

:: Start Frontend in a new window
echo [2/2] Launching NexTrAI React Frontend on port 5173...
start "NexTrAI Frontend (Vite)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ===================================================
echo Both services are starting!
echo.
echo - Web Dashboard:      http://localhost:5173
echo - API Docs (Swagger): http://localhost:8000/docs
echo ===================================================
pause
