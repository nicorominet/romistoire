@echo off
TITLE Imagitales Launcher
CLS

ECHO ===================================================
ECHO      IMAGITALES - AUTOMATED LAUNCHER
ECHO ===================================================
ECHO.

:: 1. Check/Start Ollama
ECHO [1/4] Checking Ollama (Local AI)...
tasklist /FI "IMAGENAME eq ollama_app.exe" 2>NUL | find /I /N "ollama_app.exe">NUL
IF "%ERRORLEVEL%"=="0" (
    ECHO      Ollama is already running.
) ELSE (
    ECHO      Starting Ollama...
    start /MIN "Ollama Service" ollama serve
)
timeout /t 2 /nobreak >NUL

:: 2. Start Backend Server
ECHO [2/4] Starting Backend Server (API)...
start "Imagitales BACKEND (Port 3001)" cmd /k "npm run dev:api"
timeout /t 5 /nobreak >NUL

:: 3. Start Frontend Server
ECHO [3/4] Starting Frontend Server (Vite)...
start "Imagitales FRONTEND" cmd /k "npm run dev:vite"
timeout /t 5 /nobreak >NUL

:: 4. Open Browser
ECHO [4/4] Opening Web Application...
:: Vite dev server port (vite.config.ts)
start http://localhost:8885

ECHO.
ECHO ===================================================
ECHO      ALL SYSTEMS GO!
ECHO      Keep this window open or close it, servers run in their own windows.
ECHO ===================================================
PAUSE
