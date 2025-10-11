// preload.js - Electron Preload Script for CA Office Pro
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getAppVersion: () => ipcRenderer.invoke('app-version'),
  
  // File system operations
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (data) => ipcRenderer.invoke('dialog:saveFile', data),
  
  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  
  // System operations
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  showItemInFolder: (path) => ipcRenderer.invoke('shell:showItemInFolder', path),
  
  // Database operations
  backupDatabase: () => ipcRenderer.invoke('db:backup'),
  restoreDatabase: (filePath) => ipcRenderer.invoke('db:restore', filePath),
  
  // Notifications
  showNotification: (title, body) => ipcRenderer.invoke('notification:show', { title, body }),
  
  // Event listeners
  onWindowEvent: (callback) => ipcRenderer.on('window-event', callback),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

// Basic system info
contextBridge.exposeInMainWorld('systemInfo', {
  platform: process.platform,
  arch: process.arch,
  version: process.version
});

console.log('Preload script loaded successfully for CA Office Pro');