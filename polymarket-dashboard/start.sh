#!/bin/bash

# Polymarket Dashboard Startup Script (TypeScript Version)

echo "🚀 Starting Polymarket Dashboard (TypeScript + Real-Time)..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if poly.env exists
if [ ! -f "poly.env" ]; then
    echo "⚠️  No poly.env file found. Using defaults..."
fi

# Build TypeScript code
echo "🔨 Building TypeScript..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ TypeScript build failed!"
    exit 1
fi

# Create database directory if it doesn't exist
mkdir -p database

# Start the server
echo "🎯 Starting server with WebSocket support..."
echo ""
npm start

