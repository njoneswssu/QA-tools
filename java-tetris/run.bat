@echo off

echo Starting Tetris Game...

REM Check if JAR exists
if exist "target\tetris-game-1.0.0.jar" (
    java -jar target\tetris-game-1.0.0.jar
) else (
    echo JAR file not found. Please run build.bat first.
    echo Attempting to build and run...
    call build.bat
    if %ERRORLEVEL% EQU 0 (
        java -jar target\tetris-game-1.0.0.jar
    )
)
