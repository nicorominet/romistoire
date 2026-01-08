@echo off
TITLE Imagitales Launcher
CLS

t
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
:: Using timeout to ensure Vite has time to bind port. 
:: Standard Vite port is usually 5173 or 8080 depending on config.
:: The previous log showed http://localhost:8885/ but let's assume one.
:: We will try to open the one from console output usually, but hardcoding localhost based on assumption.
:: Let's assume standard Vite dynamic port or the one seen in logs previously (localhost:8885).
:: If dynamic, just opening 'http://localhost:5173' might fail if it picked another.
:: Best guess is to let the user click or try standard.
start http://localhost:8080

ECHO.
ECHO ===================================================
ECHO      ALL SYSTEMS GO!
ECHO      Keep this window open or close it, servers run in their own windows.
ECHO ===================================================
PAUSE
