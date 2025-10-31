@echo off
echo Building Java Pinball Game...
echo.

REM Check if Maven is installed
mvn -version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Maven is not installed or not in PATH
    echo Please install Maven from https://maven.apache.org/
    pause
    exit /b 1
)

REM Check if Java is installed
java -version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Java is not installed or not in PATH
    echo Please install Java 11 or higher
    pause
    exit /b 1
)

echo Maven and Java found!
echo.

REM Clean and build the project
echo Cleaning previous build...
mvn clean

echo.
echo Building project...
mvn package

if errorlevel 1 (
    echo.
    echo BUILD FAILED!
    pause
    exit /b 1
)

echo.
echo BUILD SUCCESSFUL!
echo.
echo The game JAR file has been created at: target\pinball-game.jar
echo.
echo To run the game:
echo   java -jar target\pinball-game.jar
echo.
echo Or simply double-click the JAR file if Java is properly configured.
echo.
pause
