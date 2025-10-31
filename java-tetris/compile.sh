#!/bin/bash

echo "Compiling Tetris Game with javac..."

# Create target directory
mkdir -p target/classes

# Compile Java files
javac -d target/classes src/main/java/com/tetris/*.java

if [ $? -eq 0 ]; then
    echo "Compilation successful!"
    
    # Create JAR file
    cd target/classes
    jar cfe ../tetris-game.jar com.tetris.TetrisGame com/tetris/*.class
    cd ../..
    
    if [ $? -eq 0 ]; then
        echo "JAR creation successful!"
        echo "You can now run the game with: java -jar target/tetris-game.jar"
    else
        echo "JAR creation failed!"
        exit 1
    fi
else
    echo "Compilation failed!"
    exit 1
fi
