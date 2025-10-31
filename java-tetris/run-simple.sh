#!/bin/bash

echo "Starting Tetris Game..."

# Check if JAR exists
if [ -f "target/tetris-game.jar" ]; then
    java -jar target/tetris-game.jar
else
    echo "JAR file not found. Please run ./compile.sh first."
    echo "Attempting to compile and run..."
    ./compile.sh
    if [ $? -eq 0 ]; then
        java -jar target/tetris-game.jar
    fi
fi
