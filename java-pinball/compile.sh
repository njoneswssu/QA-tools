#!/bin/bash

echo "Compiling Java Pinball Game..."
echo

# Create directories
mkdir -p build/classes
mkdir -p build/lib
mkdir -p target

# Download Gson dependency if not present
GSON_JAR="build/lib/gson-2.10.1.jar"
if [ ! -f "$GSON_JAR" ]; then
    echo "Downloading Gson library..."
    curl -L "https://repo1.maven.org/maven2/com/google/code/gson/gson/2.10.1/gson-2.10.1.jar" -o "$GSON_JAR"
fi

# Compile Java source files
echo "Compiling source files..."
find src/main/java -name "*.java" > sources.txt
javac -d build/classes -cp "$GSON_JAR" @sources.txt

if [ $? -ne 0 ]; then
    echo "Compilation failed!"
    rm -f sources.txt
    exit 1
fi

# Create manifest file
echo "Main-Class: com.pinball.PinballGame" > build/manifest.txt
echo "Class-Path: gson-2.10.1.jar" >> build/manifest.txt

# Create JAR file
echo "Creating JAR file..."
cd build/classes
jar cfm ../../target/pinball-game.jar ../manifest.txt com/
cd ../..

# Copy Gson to target directory
cp "$GSON_JAR" target/

# Clean up
rm -f sources.txt
rm -rf build

echo
echo "BUILD SUCCESSFUL!"
echo
echo "The game has been built successfully!"
echo "Files created:"
echo "  target/pinball-game.jar       (Main game file)"
echo "  target/gson-2.10.1.jar        (Required library)"
echo
echo "To run the game:"
echo "  cd target"
echo "  java -jar pinball-game.jar"
echo
echo "Or run from current directory:"
echo "  java -cp target/gson-2.10.1.jar:target/pinball-game.jar com.pinball.PinballGame"
echo
