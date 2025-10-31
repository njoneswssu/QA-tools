@echo off

echo Building Tetris Game...

REM Clean and compile
call mvn clean compile

if %ERRORLEVEL% EQU 0 (
    echo Compilation successful!
    
    REM Package into JAR
    call mvn package
    
    if %ERRORLEVEL% EQU 0 (
        echo JAR packaging successful!
        echo You can now run the game with: run.bat
        echo Or run directly with: java -jar target/tetris-game-1.0.0.jar
    ) else (
        echo JAR packaging failed!
        exit /b 1
    )
) else (
    echo Compilation failed!
    exit /b 1
)
