const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const { exec } = require('child_process');
const fs = require('fs');

// Enhanced environment setup for consistency
process.env.ELECTRON_APP = 'true';
process.env.JWT_SECRET = 'enhanced-ca-office-secret-key'; // Ensure consistency

let mainWindow;
let serverStarted = false;

// Global license status
global.licenseStatus = { valid: false, demo: true };

if (isDev) {
  try {
    require('electron-reload')(__dirname, {
      electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
      hardResetMethod: 'exit'
    });
  } catch (err) {
    console.log('Electron reload not available');
  }
}

const userDataPath = app.getPath('userData');
const logsPath = path.join(userDataPath, 'logs');
const uploadsPath = path.join(userDataPath, 'uploads');
const dataPath = path.join(userDataPath, 'data');
const backupsPath = path.join(userDataPath, 'backups');

function ensureDirectories() {
  try {
    [logsPath, uploadsPath, dataPath, backupsPath].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      }
    });
  } catch (error) {
    console.error('Error creating directories:', error);
    dialog.showErrorBox('Directory Error', `Failed to create required directories: ${error.message}`);
  }
}

function openInChrome(url) {
  const platform = process.platform;
  let chromeCommand;

  switch (platform) {
    case 'win32':
      chromeCommand = 'start chrome';
      break;
    case 'darwin':
      chromeCommand = 'open -a "Google Chrome"';
      break;
    case 'linux':
      chromeCommand = 'google-chrome';
      break;
    default:
      console.log('Unsupported platform. Please open manually:', url);
      return;
  }

  exec(`${chromeCommand} ${url}`, (error) => {
    if (error) {
      console.log('Could not open Chrome automatically. Please open manually:', url);
      shell.openExternal(url);
    }
  });
}

// License checking functionality
async function checkLicenseOnStartup() {
  try {
    // For development mode, skip license check
    if (isDev) {
      console.log('Development mode - skipping license check');
      return { valid: true, development: true };
    }

    // Update paths for direct require approach
    const databasePath = path.join(__dirname, 'config', 'database.js');
    const licenseUtilsPath = path.join(__dirname, 'utils', 'licenseGenerator.js');
    
    // Check if files exist before requiring them
    if (!fs.existsSync(databasePath) || !fs.existsSync(licenseUtilsPath)) {
      console.log('License checking modules not found - running in demo mode');
      return { valid: false, demo: true, reason: 'missing_modules' };
    }

    // Wait a bit for server to initialize database connection
    await new Promise(resolve => setTimeout(resolve, 3000));

    try {
      const { query } = require(databasePath);
      const { verifyLicenseKey } = require(licenseUtilsPath);

      const licenses = await query('SELECT * FROM licenses WHERE status = "active" ORDER BY id DESC LIMIT 1');
      
      if (licenses.length === 0) {
        console.log('No active license found - demo mode');
        return { valid: false, demo: true, reason: 'no_license' };
      }
      
      const verification = verifyLicenseKey(licenses[0].license_key);
      
      if (!verification.valid) {
        await query('UPDATE licenses SET status = "expired" WHERE id = ?', [licenses[0].id]);
        console.log('License verification failed - expired');
        return { valid: false, expired: true, data: licenses[0], reason: 'verification_failed' };
      }
      
      console.log('License verified successfully');
      return { valid: true, data: verification.data };
    } catch (dbError) {
      console.error('Database error during license check:', dbError);
      return { valid: false, demo: true, reason: 'database_error' };
    }
  } catch (err) {
    console.error('License check error:', err);
    return { valid: false, demo: true, reason: 'general_error' };
  }
}

function startBackendServer() {
  return new Promise((resolve, reject) => {
    if (isDev) {
      console.log('Development mode - backend should already be running on port 5000');
      resolve();
      return;
    }

    if (serverStarted) {
      console.log('Server already started');
      resolve();
      return;
    }

    try {
      // Set environment variables
      process.env.PORT = '5000';
      process.env.NODE_ENV = 'production';
      process.env.ELECTRON_APP = 'true';
      process.env.LOG_PATH = logsPath;
      process.env.UPLOAD_PATH = uploadsPath;
      process.env.BACKUP_PATH = backupsPath;
      process.env.DB_PATH = path.join(dataPath, 'ca_office.db');
      process.env.USER_DATA_PATH = userDataPath;
      process.env.JWT_SECRET = 'enhanced-ca-office-secret-key';
      process.env.DB_TYPE = 'mysql';
      process.env.DB_HOST = 'localhost';
      process.env.DB_USER = 'ca_admin';
      process.env.DB_PASSWORD = 'Dilip@cd010';
      process.env.DB_NAME = 'enhanced_ca_office';
      process.env.DB_PORT = '3306';
      process.env.ENABLE_MULTI_FIRM = 'true';

      console.log('Starting server within Electron process...');
      
      // Check if server file exists
      const serverPath = path.join(__dirname, 'server.js');
      console.log('Loading server from:', serverPath);
      console.log('Server exists:', fs.existsSync(serverPath));
      
      if (!fs.existsSync(serverPath)) {
        throw new Error(`Server file not found: ${serverPath}`);
      }

      // Create log file stream for server logs
      const logFile = path.join(logsPath, 'server.log');
      const logStream = fs.createWriteStream(logFile, { flags: 'a' });
      
      // Redirect console.log and console.error to our log file
      const originalLog = console.log;
      const originalError = console.error;
      
      console.log = function(...args) {
        const message = args.join(' ');
        logStream.write(`[STDOUT] ${new Date().toISOString()}: ${message}\n`);
        originalLog.apply(console, args);
      };
      
      console.error = function(...args) {
        const message = args.join(' ');
        logStream.write(`[STDERR] ${new Date().toISOString()}: ${message}\n`);
        originalError.apply(console, args);
      };

      // Require the server directly instead of spawning
      require(serverPath);
      
      serverStarted = true;
      
      // Give server time to start
      setTimeout(() => {
        console.log('Backend should be ready at http://localhost:5000');
        resolve();
      }, 5000); // Increased timeout for server startup
      
    } catch (error) {
      console.error('Failed to start server:', error);
      reject(error);
    }
  });
}

async function createWindow() {
  ensureDirectories();
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: !isDev,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false,
    titleBarStyle: 'default',
    autoHideMenuBar: false
  });

  mainWindow.maximize();

  try {
    await startBackendServer();
    
    // Check license after server starts
    console.log('Checking license...');
    const licenseStatus = await checkLicenseOnStartup();
    global.licenseStatus = licenseStatus;
    
    console.log('License Status:', licenseStatus);
    
  } catch (error) {
    dialog.showErrorBox('Server Error', 
      `Failed to start server: ${error.message}\n\nCheck logs at:\n${path.join(logsPath, 'server.log')}`
    );
    app.quit();
    return;
  }

  const startUrl = isDev 
    ? 'http://localhost:3001'
    : 'http://localhost:5000';
    
  console.log('Loading URL:', startUrl);
  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // REMOVED: Auto-show license dialog functionality
    // Users must manually access license activation through menu or UI
    
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
    setTimeout(() => {
      console.log('Retrying to load URL...');
      mainWindow.loadURL(isDev ? 'http://localhost:3001' : 'http://localhost:5000');
    }, 2000);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  createMenu();
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Client',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.executeJavaScript(`
              if (window.location.pathname !== '/clients') {
                window.location.href = '/clients';
              }
            `);
          }
        },
        {
          label: 'New Task',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            mainWindow.webContents.executeJavaScript(`
              if (window.location.pathname !== '/tasks') {
                window.location.href = '/tasks';
              }
            `);
          }
        },
        { type: 'separator' },
        {
          label: 'Manage Firms',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => {
            mainWindow.webContents.executeJavaScript(`
              if (window.location.pathname !== '/firms') {
                window.location.href = '/firms';
              }
            `);
          }
        },
        { type: 'separator' },
        {
          label: 'License Information',
          accelerator: 'CmdOrCtrl+L',
          click: () => {
            const status = global.licenseStatus;
            let message, detail;
            
            if (status.valid) {
              message = 'License Status: Active';
              detail = status.development 
                ? 'Running in development mode'
                : `Licensed to: ${status.data?.companyName || 'CA Office Pro'}\nValid until: ${status.data?.expiryDate || 'N/A'}`;
            } else {
              message = 'License Status: Demo/Expired';
              detail = `Reason: ${status.reason || 'Unknown'}\n\nDemo mode allows limited functionality. Please contact your administrator for a valid license.`;
            }
            
            dialog.showMessageBox(mainWindow, {
              type: status.valid ? 'info' : 'warning',
              title: 'License Information',
              message,
              detail,
              buttons: ['OK']
            });
          }
        },
        { type: 'separator' },
        {
          label: 'Activate License',
          accelerator: 'CmdOrCtrl+Shift+L',
          click: () => {
            // Navigate to license activation page or trigger manual activation
            mainWindow.webContents.executeJavaScript(`
              if (window.location.pathname !== '/license') {
                window.location.href = '/license';
              } else {
                // If already on license page, trigger the dialog
                if (window.showLicenseDialog) {
                  window.showLicenseDialog();
                }
              }
            `);
          }
        },
        { type: 'separator' },
        {
          label: 'Open Logs Folder',
          click: () => {
            shell.openPath(logsPath);
          }
        },
        {
          label: 'Open Data Folder',
          click: () => {
            shell.openPath(userDataPath);
          }
        },
        {
          label: 'Open Backups Folder',
          click: () => {
            shell.openPath(backupsPath);
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Navigate',
      submenu: [
        {
          label: 'Dashboard',
          accelerator: 'CmdOrCtrl+1',
          click: () => {
            mainWindow.webContents.executeJavaScript(`window.location.href = '/';`);
          }
        },
        {
          label: 'Firms',
          accelerator: 'CmdOrCtrl+2',
          click: () => {
            mainWindow.webContents.executeJavaScript(`window.location.href = '/firms';`);
          }
        },
        {
          label: 'Clients',
          accelerator: 'CmdOrCtrl+3',
          click: () => {
            mainWindow.webContents.executeJavaScript(`window.location.href = '/clients';`);
          }
        },
        {
          label: 'Staff',
          accelerator: 'CmdOrCtrl+4',
          click: () => {
            mainWindow.webContents.executeJavaScript(`window.location.href = '/staff';`);
          }
        },
        {
          label: 'Tasks',
          accelerator: 'CmdOrCtrl+5',
          click: () => {
            mainWindow.webContents.executeJavaScript(`window.location.href = '/tasks';`);
          }
        },
        {
          label: 'Billing',
          accelerator: 'CmdOrCtrl+6',
          click: () => {
            mainWindow.webContents.executeJavaScript(`window.location.href = '/billing';`);
          }
        },
        { type: 'separator' },
        {
          label: 'License Management',
          accelerator: 'CmdOrCtrl+7',
          click: () => {
            mainWindow.webContents.executeJavaScript(`window.location.href = '/license';`);
          }
        }
      ]
    },
    {
      label: 'License',
      submenu: [
        {
          label: 'Check License Status',
          click: () => {
            const status = global.licenseStatus;
            const licenseText = status.valid ? 'Active' : 'Demo/Expired';
            const detail = status.valid 
              ? `Company: ${status.data?.company || 'N/A'}\nExpires: ${status.data?.expiry || 'N/A'}\nUsers: ${status.data?.users || 'N/A'}`
              : 'No valid license found. Please contact support for activation.';
            
            dialog.showMessageBox(mainWindow, {
              type: status.valid ? 'info' : 'warning',
              title: 'License Status',
              message: `License Status: ${licenseText}`,
              detail: detail,
              buttons: ['OK', 'Activate License']
            }).then((result) => {
              if (result.response === 1) { // Activate License clicked
                mainWindow.webContents.executeJavaScript(`
                  if (window.location.pathname !== '/license') {
                    window.location.href = '/license';
                  }
                `);
              }
            });
          }
        },
        {
          label: 'Activate License',
          click: () => {
            mainWindow.webContents.executeJavaScript(`
              if (window.location.pathname !== '/license') {
                window.location.href = '/license';
              }
            `);
          }
        },
        { type: 'separator' },
        {
          label: 'Contact Support',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'License Support',
              message: 'CA Office Pro License Support',
              detail: 'For license activation or support:\n\nEmail: support@caoffice.com\nPhone: +91-XXXXXXXXXX\n\nPlease have your purchase details ready when contacting support.',
              buttons: ['OK']
            });
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About CA Office Pro',
          click: () => {
            const status = global.licenseStatus;
            const licenseInfo = status.valid 
              ? (status.development ? 'Development Mode' : 'Licensed')
              : 'Demo Mode';
              
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About CA Office Pro',
              message: 'CA Office Pro v3.0.0 - Multi-Firm Edition',
              detail: `Complete Professional Practice Management System with Multi-Firm Support

License Status: ${licenseInfo}
Installation Directory: ${app.getAppPath()}
User Data Directory: ${userDataPath}
Logs Directory: ${logsPath}
Backups Directory: ${backupsPath}
Database: MySQL (${process.env.DB_NAME || 'enhanced_ca_office'})

Features:
- Multi-Firm Management
- Client Management
- Task Management with Dynamic Types
- Billing & Invoicing
- Staff Attendance & Leave Management
- Audit Logging
- Report Generation
- Data Import/Export
- License Management System

Note: Trial licenses are no longer available. Please contact support for commercial licensing.`,
              buttons: ['OK']
            });
          }
        },
        {
          label: 'System Status',
          click: () => {
            mainWindow.webContents.executeJavaScript(`
              fetch('/api/system/status')
                .then(res => res.json())
                .then(data => {
                  const licenseStatus = ${JSON.stringify(global.licenseStatus)};
                  const licenseText = licenseStatus.valid ? 'Active' : 'Demo/Expired';
                  alert('System Status: ' + data.status + '\\nDatabase: ' + data.stats.database + '\\nMulti-Firm: Enabled\\nLicense: ' + licenseText);
                })
                .catch(err => alert('Error checking system status: Server may not be running yet'));
            `);
          }
        },
        {
          label: 'Show Logs',
          click: () => {
            shell.openPath(path.join(logsPath, 'server.log'));
          }
        },
        {
          label: 'Open in Browser',
          click: () => {
            openInChrome('http://localhost:5000');
          }
        },
        { type: 'separator' },
        {
          label: 'Documentation',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Documentation',
              message: 'CA Office Pro Documentation',
              detail: 'For detailed documentation and support, please refer to the user manual or contact your system administrator.',
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC handlers for license operations
ipcMain.handle('get-license-status', () => {
  return global.licenseStatus;
});

ipcMain.handle('refresh-license-status', async () => {
  const newStatus = await checkLicenseOnStartup();
  global.licenseStatus = newStatus;
  return newStatus;
});

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (navigationEvent, navigationURL) => {
    event.preventDefault();
    shell.openExternal(navigationURL);
  });
  
  contents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    const allowedOrigins = ['http://localhost:5000', 'http://localhost:3001'];
    if (!allowedOrigins.includes(parsedUrl.origin)) {
      event.preventDefault();
    }
  });
});

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (isDev) {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});

app.on('before-quit', () => {
  // Server will be cleaned up automatically when process exits
  console.log('Application shutting down...');
});

module.exports = { mainWindow };