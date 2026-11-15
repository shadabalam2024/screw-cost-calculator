const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const dbModule = require('./db');

let db;
let win;

function createWindow() {
  win = new BrowserWindow({
    width: 560, height: 900, minWidth: 380, minHeight: 600,
    title: 'Screw Cost Calculator',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

function setupIpc() {
  ipcMain.handle('dims:list', () => db.listDimensions());
  ipcMain.handle('dims:add', (_e, label, weight) => { db.addDimension(label, weight); });
  ipcMain.handle('dims:delete', (_e, label) => { db.deleteDimension(label); });
  ipcMain.handle('settings:get', () => db.getSettings());
  ipcMain.handle('settings:set', (_e, k, v) => { db.setSetting(k, v); });
  ipcMain.handle('settings:clear', () => { db.clearSettings(); });
  ipcMain.handle('app:version', () => app.getVersion());
}

function setupAutoUpdate() {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.on('update-downloaded', async info => {
    const { response } = await dialog.showMessageBox(win, {
      type: 'info', buttons: ['Restart now', 'Later'], defaultId: 0,
      title: 'Update ready',
      message: `Version ${info.version} has been downloaded.`,
      detail: 'Restart the app to install the update.',
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });
  autoUpdater.on('error', err => console.error('Update error:', err));
  autoUpdater.checkForUpdatesAndNotify().catch(() => {});
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    db = dbModule.open(app.getPath('userData'));
    setupIpc();
    createWindow();
    setupAutoUpdate();
  });
  app.on('window-all-closed', () => { if (db) db.close(); app.quit(); });
}
