// scripts/prepare-electron.js
const fs = require('fs-extra');
const path = require('path');

async function prepareElectron() {
  console.log('🚀 Preparing Electron build...');
  
  try {
    // Create necessary directories
    await fs.ensureDir('backend/assets');
    await fs.ensureDir('backend/logs');
    await fs.ensureDir('backend/uploads');
    
    // Copy default environment file if it doesn't exist
    const envPath = path.join('backend', '.env');
    const envExamplePath = path.join('backend', '.env.example');
    
    if (!await fs.pathExists(envPath) && await fs.pathExists(envExamplePath)) {
      await fs.copy(envExamplePath, envPath);
      console.log('✅ Created .env file from example');
    }
    
    // Create default environment file if neither exists
    if (!await fs.pathExists(envPath)) {
      const defaultEnv = `# CA Office Automation System - Environment Configuration
NODE_ENV=production
PORT=5000
ELECTRON_APP=true

# Database Configuration (SQLite for standalone deployment)
DB_TYPE=sqlite
DB_PATH=./data/ca_office.db

# Security
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
BCRYPT_ROUNDS=12

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# Logging
LOG_LEVEL=info
LOG_PATH=./logs

# Application Settings
APP_NAME=CA Office Pro
APP_VERSION=2.2.0
COMPANY_NAME=Your CA Office
`;
      
      await fs.writeFile(envPath, defaultEnv);
      console.log('✅ Created default .env file');
    }
    
    // Create SQLite database directory structure
    await fs.ensureDir('backend/data');
    
    // Copy database schema for SQLite
    const sqliteSchemaSource = path.join('database', 'sqlite-schema.sql');
    const sqliteSchemaTarget = path.join('backend', 'database', 'sqlite-schema.sql');
    
    await fs.ensureDir(path.dirname(sqliteSchemaTarget));
    
    if (await fs.pathExists(sqliteSchemaSource)) {
      await fs.copy(sqliteSchemaSource, sqliteSchemaTarget);
      console.log('✅ Copied SQLite schema');
    } else {
      console.log('⚠️  SQLite schema not found, creating basic structure');
      // You would create a basic SQLite schema here
    }
    
    // Create application icons (placeholder)
    const iconDir = path.join('backend', 'assets');
    const iconFiles = ['icon.png', 'icon.ico', 'icon.icns'];
    
    for (const iconFile of iconFiles) {
      const iconPath = path.join(iconDir, iconFile);
      if (!await fs.pathExists(iconPath)) {
        console.log(`⚠️  ${iconFile} not found - you should add proper application icons`);
      }
    }
    
    // Create license file
    const licensePath = path.join('backend', 'license.txt');
    if (!await fs.pathExists(licensePath)) {
      const licenseText = `CA Office Pro - Professional Practice Management System

Copyright (c) ${new Date().getFullYear()} Your Company Name

This software is licensed for use by authorized users only.
Unauthorized copying, distribution, or modification is prohibited.

For licensing questions, contact: support@yourcompany.com
`;
      
      await fs.writeFile(licensePath, licenseText);
      console.log('✅ Created license file');
    }
    
    // Validate frontend build
    const frontendBuildPath = path.join('frontend', 'build');
    if (!await fs.pathExists(frontendBuildPath)) {
      throw new Error('Frontend build not found! Run "npm run build-frontend" first.');
    }
    
    console.log('✅ Frontend build validated');
    
    // Create startup script for Windows
    const startupScript = `@echo off
title CA Office Pro
echo Starting CA Office Pro...
echo.

REM Check if Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Start the application
echo Starting CA Office Pro Server...
node server.js

pause
`;
    
    await fs.writeFile(path.join('backend', 'start.bat'), startupScript);
    console.log('✅ Created Windows startup script');
    
    // Create startup script for Unix/Linux/macOS
    const unixStartupScript = `#!/bin/bash
echo "Starting CA Office Pro..."

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed or not in PATH"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Start the application
echo "Starting CA Office Pro Server..."
node server.js
`;
    
    await fs.writeFile(path.join('backend', 'start.sh'), unixStartupScript);
    await fs.chmod(path.join('backend', 'start.sh'), '755');
    console.log('✅ Created Unix startup script');
    
    console.log('');
    console.log('🎉 Electron preparation completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. cd backend');
    console.log('2. npm run dist (to create installer)');
    console.log('3. Check the dist/ folder for your installer');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error preparing Electron build:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  prepareElectron();
}

module.exports = prepareElectron;