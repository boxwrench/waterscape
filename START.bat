@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is required.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing local dependencies...
  call npm ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

start "" "http://localhost:5173"
call npm start
