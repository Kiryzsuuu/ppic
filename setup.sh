#!/bin/bash

# PPIC One-Click Setup Script for macOS/Linux
# This script sets up the entire project and starts the dev server

echo ""
echo "╔════════════════════════════════════════════════╗"
echo "║       PPIC - One Click Setup & Run             ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

# Check if Node.js is installed
echo "[1/5] Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi
echo "✓ Node.js found: $(node --version)"
echo ""

# Check if npm is installed
echo "[2/5] Checking npm installation..."
if ! command -v npm &> /dev/null; then
    echo "ERROR: npm is not installed"
    exit 1
fi
echo "✓ npm found: $(npm --version)"
echo ""

# Install dependencies
echo "[3/5] Installing dependencies (this may take a few minutes)..."
npm install
if [ $? -ne 0 ]; then
    echo "ERROR: npm install failed"
    exit 1
fi
echo "✓ Dependencies installed"
echo ""

# Generate Prisma Client and sync database
echo "[4/5] Generating Prisma Client and syncing database..."
npx prisma generate || echo "WARNING: Prisma generate had issues, continuing..."
npx prisma db push || echo "WARNING: Prisma db push had issues, continuing..."
echo "✓ Database synced"
echo ""

# Start dev server
echo "[5/5] Starting development server..."
echo ""
echo "╔════════════════════════════════════════════════╗"
echo "║  Setup Complete! Dev server is starting...     ║"
echo "║  Open browser: http://localhost:3000           ║"
echo "║  Press Ctrl+C to stop the server               ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

npm run dev
