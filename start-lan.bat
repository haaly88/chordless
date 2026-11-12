@echo off
title Chordless - LAN mode
cd /d "%~dp0"

echo.
 echo   Chordless - LAN mode
 echo.
 echo   Starts the server on all interfaces so phones on the same Wi-Fi
 echo   can use the full app (streaming + offline downloads).
 echo.

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo   [!] Node.js not found. Install it first from https://nodejs.org ^(LTS^)
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
if not exist web\dist (
  echo   Building the frontend...
  call npm run build || goto :fail
)

echo   Local URL  : http://localhost:3001
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
  for /f "tokens=* delims= " %%B in ("%%A") do set LANIP=%%B
)
if defined LANIP (
  echo   Phone URL  : http://!LANIP!:3001
  echo   ^(open this on a phone connected to the same Wi-Fi^)
)
echo.
set NODE_ENV=production
set HOST=0.0.0.0
node server\index.js
goto :eof

:fail
echo.
echo   [!] Setup failed. See the messages above.
pause
exit /b 1
