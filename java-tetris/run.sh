#!/bin/bash

echo "Starting Tetris Game..."

# Check if JAR exists
if [ -f "target/tetris-game-1.0.0.jar" ]; then
    java -jar target/tetris-game-1.0.0.jar
else
    echo "JAR file not found. Please run ./build.sh first."
    echo "Attempting to build and run..."
    ./build.sh
    if [ $? -eq 0 ]; then
        java -jar target/tetris-game-1.0.0.jar
    fi
fi
