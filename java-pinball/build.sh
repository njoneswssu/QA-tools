#!/bin/bash

echo "Building Java Pinball Game..."
echo

# Check if Maven is installed
if ! command -v mvn &> /dev/null; then
    echo "ERROR: Maven is not installed or not in PATH"
    echo "Please install Maven from https://maven.apache.org/"
    exit 1
fi

# Check if Java is installed
if ! command -v java &> /dev/null; then
    echo "ERROR: Java is not installed or not in PATH"
    echo "Please install Java 11 or higher"
    exit 1
fi

echo "Maven and Java found!"
echo

# Clean and build the project
echo "Cleaning previous build..."
mvn clean

echo
echo "Building project..."
mvn package

if [ $? -ne 0 ]; then
    echo
    echo "BUILD FAILED!"
    exit 1
fi

echo
echo "BUILD SUCCESSFUL!"
echo
echo "The game JAR file has been created at: target/pinball-game.jar"
echo
echo "To run the game:"
echo "  java -jar target/pinball-game.jar"
echo
echo "Or simply double-click the JAR file if Java is properly configured."
echo
