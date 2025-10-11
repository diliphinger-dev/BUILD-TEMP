@echo off
title CA Office License Key Generator
color 0A

echo.
echo =============================================
echo    CA OFFICE LICENSE KEY GENERATOR
echo =============================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    color 0C
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Check if generate-license.js exists
if not exist "generate-license.js" (
    color 0C
    echo ERROR: generate-license.js not found!
    echo Please make sure you are in the correct directory.
    echo.
    pause
    exit /b 1
)

REM Run the license generator
node generate-license.js

echo.
pause