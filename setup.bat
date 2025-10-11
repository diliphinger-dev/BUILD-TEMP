@echo off
title CA Office Pro - Professional Practice Management System
color 0A

echo ========================================
echo   CA Office Pro v2.2
echo   Professional Practice Management
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    color 0C
    echo ERROR: Node.js is not installed!
    echo.
    echo Please install Node.js from https://nodejs.org/
    echo Download the LTS version and install it.
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js is installed
node --version
echo.

REM Navigate to backend directory
cd /d "%~dp0backend"

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies... This may take a few minutes.
    echo.
    call npm install
    if errorlevel 1 (
        color 0C
        echo.
        echo ERROR: Failed to install dependencies
        echo.
        pause
        exit /b 1
    )
)

echo.
echo ========================================
echo   Starting CA Office Pro Server...
echo ========================================
echo.
echo Application will be available at:
echo http://localhost:3000
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

REM Start the server
node server.js

REM If server exits, pause to show error
if errorlevel 1 (
    color 0C
    echo.
    echo ========================================
    echo   Server stopped with errors
    echo ========================================
    echo.
)

pause