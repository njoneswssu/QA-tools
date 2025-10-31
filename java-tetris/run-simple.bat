@echo off

echo Starting Tetris Game...

REM Check if JAR exists
if exist "target\tetris-game.jar" (
    java -jar target\tetris-game.jar
) else (
    echo JAR file not found. Please run compile.bat first.
    echo Attempting to compile and run...
    call compile.bat
    if %ERRORLEVEL% EQU 0 (
        java -jar target\tetris-game.jar
    )
)
