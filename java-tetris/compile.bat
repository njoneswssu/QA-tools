@echo off

echo Compiling Tetris Game with javac...

REM Create target directory
if not exist "target\classes" mkdir target\classes

REM Compile Java files
javac -d target\classes src\main\java\com\tetris\*.java

if %ERRORLEVEL% EQU 0 (
    echo Compilation successful!
    
    REM Create JAR file
    cd target\classes
    jar cfe ..\tetris-game.jar com.tetris.TetrisGame com\tetris\*.class
    cd ..\..
    
    if %ERRORLEVEL% EQU 0 (
        echo JAR creation successful!
        echo You can now run the game with: java -jar target\tetris-game.jar
    ) else (
        echo JAR creation failed!
        exit /b 1
    )
) else (
    echo Compilation failed!
    exit /b 1
)
