@echo off
REM Stock Pattern Monitor Startup Script for Windows

echo ===================================
echo Stock Pattern Monitor
echo ===================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed
    pause
    exit /b 1
)

REM Check if dependencies are installed
python -c "import yfinance" >nul 2>&1
if errorlevel 1 (
    echo Installing dependencies...
    pip install -r requirements_stock.txt
    echo.
)

REM Check if config exists
if not exist "stock_monitor_config.json" (
    echo Error: stock_monitor_config.json not found
    echo Please create the config file with your Discord webhook
    pause
    exit /b 1
)

echo Starting Stock Pattern Monitor...
echo.
echo Press Ctrl+C to stop
echo.

REM Run the monitor
python stock_pattern_monitor.py

echo.
echo Monitor stopped
pause

