#!/bin/bash

echo "Starting Java Pinball Game..."

# Check if the game is compiled
if [ ! -f "target/pinball-game.jar" ]; then
    echo "Game not found. Building..."
    ./compile.sh
fi

# Run the game
cd target
java -jar pinball-game.jar
