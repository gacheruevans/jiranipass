const { app, BrowserWindow, ipcMain, Notification, Menu } = require('electron');
const path = require('path');
require('dotenv').config({ path: [path.join(__dirname, '../../.env'), path.join(__dirname, '../../../.env')] });

let mainWindow = null;

function createWindow() {
  const isKiosk = process.argv.includes('--kiosk');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'JiraniPass Guard — Gate Security Station',
    kiosk: isKiosk,
    backgroundColor: '#0F172A',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  mainWindow.loadURL(appUrl).catch((err) => {
    console.warn(`Could not reach ${appUrl}, loading offline standby view:`, err.message);
    mainWindow.loadFile(path.join(__dirname, 'offline.html'));
  });

  // Native notification on Linux / Windows / macOS
  ipcMain.on('show-notification', (_event, { title, body }) => {
    if (Notification.isSupported()) {
      new Notification({ title, body, icon: path.join(__dirname, '../assets/icon.png') }).show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
