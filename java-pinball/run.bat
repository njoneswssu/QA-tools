@echo off
echo Starting Java Pinball Game...

REM Check if the game is compiled
if not exist "target\pinball-game.jar" (
    echo Game not found. Building...
    call build.bat
)

REM Run the game
cd target
java -jar pinball-game.jar
pause
