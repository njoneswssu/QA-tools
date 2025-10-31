#!/bin/bash

echo "Building Tetris Game..."

# Clean and compile
mvn clean compile

if [ $? -eq 0 ]; then
    echo "Compilation successful!"
    
    # Package into JAR
    mvn package
    
    if [ $? -eq 0 ]; then
        echo "JAR packaging successful!"
        echo "You can now run the game with: ./run.sh"
        echo "Or run directly with: java -jar target/tetris-game-1.0.0.jar"
    else
        echo "JAR packaging failed!"
        exit 1
    fi
else
    echo "Compilation failed!"
    exit 1
fi
