@echo off
REM PPIC One-Click Setup Script for Windows
REM This script sets up the entire project and starts the dev server

setlocal enabledelayedexpansion

echo.
echo ╔════════════════════════════════════════════════╗
echo ║       PPIC - One Click Setup & Run             ║
echo ╚════════════════════════════════════════════════╝
echo.

REM Check if Node.js is installed
echo [1/5] Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)
echo ✓ Node.js found
echo.

REM Check if npm is installed
echo [2/5] Checking npm installation...
npm --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm is not installed
    pause
    exit /b 1
)
echo ✓ npm found
echo.

REM Install dependencies
echo [3/5] Installing dependencies (this may take a few minutes)...
call npm install
if errorlevel 1 (
    echo ERROR: npm install failed
    pause
    exit /b 1
)
echo ✓ Dependencies installed
echo.

REM Generate Prisma Client
echo [4/5] Generating Prisma Client and syncing database...
call npx prisma generate
if errorlevel 1 (
    echo WARNING: Prisma generate had issues, continuing...
)
call npx prisma db push
if errorlevel 1 (
    echo WARNING: Prisma db push had issues, continuing...
)
echo ✓ Database synced
echo.

REM Start dev server
echo [5/5] Starting development server...
echo.
echo ╔════════════════════════════════════════════════╗
echo ║  Setup Complete! Dev server is starting...     ║
echo ║  Open browser: http://localhost:3000           ║
echo ║  Press Ctrl+C to stop the server               ║
echo ╚════════════════════════════════════════════════╝
echo.

call npm run dev

pause
