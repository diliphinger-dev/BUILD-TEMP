@echo off
echo Building Electron App Safely - Source Will NOT Be Modified
echo ==========================================================

set BUILD_DIR=electron-build-%RANDOM%
echo Creating temporary build directory: %BUILD_DIR%

:: Create temp directory
mkdir "%BUILD_DIR%"

:: Copy all files except exclusions
echo Copying source files...
xcopy /E /I /Q /H /Y . "%BUILD_DIR%" 2>nul

:: Remove excluded folders from temp directory
if exist "%BUILD_DIR%\node_modules" rmdir /s /q "%BUILD_DIR%\node_modules" 2>nul
if exist "%BUILD_DIR%\.git" rmdir /s /q "%BUILD_DIR%\.git" 2>nul
if exist "%BUILD_DIR%\dist" rmdir /s /q "%BUILD_DIR%\dist" 2>nul
if exist "%BUILD_DIR%\dist-final" rmdir /s /q "%BUILD_DIR%\dist-final" 2>nul

:: Verify files copied
if exist "%BUILD_DIR%\package.json" (
    echo Files copied successfully
) else (
    echo ERROR: No files copied! Make sure script is in backend directory.
    pause
    exit /b 1
)

cd "%BUILD_DIR%"

:: Install dependencies
echo Installing dependencies...
call npm install --silent 2>nul

:: Build Electron app
echo Building Electron installer...
call npm run dist:dev 2>nul

:: Move installer back
cd ..
if exist "%BUILD_DIR%\dist-final" (
    if exist "electron-installer" rmdir /s /q "electron-installer"
    move "%BUILD_DIR%\dist-final" "electron-installer"
    echo ✅ Electron installer created in: electron-installer\
) else (
    echo ❌ Build failed - check if frontend is built
    if exist "%BUILD_DIR%\package.json" (
        echo Try running: npm run build:frontend first
    )
)

:: Cleanup
rmdir /s /q "%BUILD_DIR%" 2>nul

echo ✅ Done! Your source code remains unchanged.
pause