#!/bin/bash

# Wildlink Proxy Monitor - Easy Setup Script
# This script will install dependencies and start the services

echo "🕵️  Wildlink Proxy Monitor - Easy Setup"
echo "========================================"
echo ""

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    echo "Please install Python 3 and try again."
    exit 1
fi

echo "✅ Python 3 found"

# Make scripts executable
echo "🔧 Making scripts executable..."
chmod +x *.sh

# Install dependencies
echo "📦 Installing dependencies..."
pip3 install -r requirements.txt

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    echo "Try running: pip3 install -r requirements.txt"
    exit 1
fi

echo ""
echo "🎉 Setup Complete!"
echo ""
echo "🚀 To start monitoring:"
echo "   ./start_all.sh"
echo ""
echo "🌐 Then open your browser to:"
echo "   http://localhost:5001"
echo ""
echo "📖 For detailed instructions, see README.md"
echo ""
echo "Happy monitoring! 🕵️‍♂️"
