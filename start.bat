@echo off
title Chordless
cd /d "%~dp0"

echo.
 echo   Chordless - every song, beautifully
 echo.

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo   [!] Node.js not found. Install it first from https://nodejs.org ^(LTS^)
  pause
  exit /b 1
)
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo   [!] Python not found. Install it from https://www.python.org ^(required for yt-dlp^)
  pause
  exit /b 1
)

if not exist node_modules (
  echo   Installing server dependencies...
  call npm install || goto :fail
)
if not exist web\node_modules (
  echo   Installing frontend dependencies...
  call npm --prefix web install || goto :fail
)

python -m yt_dlp --version >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo   Installing yt-dlp (stream extraction)...
  call python -m pip install -U yt-dlp || goto :fail
)

if not exist web\dist (
  echo   Building the frontend...
  call npm run build || goto :fail
)

echo   Starting Chordless at http://localhost:3001 ...
echo   Close this window to stop the server.
echo.
start "" "http://localhost:3001"
set NODE_ENV=production
node server\index.js
goto :eof

:fail
echo.
echo   [!] Setup failed. See the messages above.
pause
exit /b 1
