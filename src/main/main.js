const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const dbModule = require('./db');

let db;
let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 840, minWidth: 420, minHeight: 600,
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
  ipcMain.handle('inv:summary', () => db.inventorySummary());
  ipcMain.handle('inv:history', () => db.inventoryHistory());
  ipcMain.handle('inv:add', (_e, label, pieces, cost) => { db.addStock(label, pieces, cost); });
  ipcMain.handle('inv:remove', (_e, label, pieces) => { db.removeStock(label, pieces); });
  ipcMain.handle('inv:deleteMove', (_e, id) => { db.deleteMove(Number(id)); });
  ipcMain.handle('bill:create', (_e, payload) => db.createInvoice(payload));
  ipcMain.handle('bill:list', () => db.listInvoices());
  ipcMain.handle('bill:get', (_e, id) => db.getInvoice(Number(id)));
  ipcMain.handle('bill:delete', (_e, id) => { db.deleteInvoice(Number(id)); });
  ipcMain.handle('shop:add', (_e, name, location) => { db.addShop(name, location); });
  ipcMain.handle('shop:list', () => db.listShops());
  ipcMain.handle('shop:delete', (_e, id) => { db.deleteShop(Number(id)); });
  ipcMain.handle('ship:stock', () => db.shopStock());
  ipcMain.handle('ship:create', (_e, payload) => db.createTransfer(payload));
  ipcMain.handle('ship:list', () => db.listTransfers());
  ipcMain.handle('ship:get', (_e, id) => db.getTransfer(Number(id)));
  ipcMain.handle('ship:delete', (_e, id) => { db.deleteTransfer(Number(id)); });
  ipcMain.handle('settings:get', () => db.getSettings());
  ipcMain.handle('settings:set', (_e, k, v) => { db.setSetting(k, v); });
  ipcMain.handle('settings:clear', () => { db.clearSettings(); });
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('box:set', (_e, label, n) => { db.setBoxSize(label, n); });
  ipcMain.handle('box:list', () => db.getBoxSizes());
  ipcMain.handle('biz:get', () => db.getBusiness());
  ipcMain.handle('biz:set', (_e, obj) => { db.setBusiness(obj); });
  ipcMain.handle('shop:update', (_e, id, name, location) => { db.updateShop(Number(id), name, location); });
  ipcMain.handle('app:info', () => ({ version: app.getVersion(), dataPath: app.getPath('userData'), packaged: app.isPackaged }));
  ipcMain.handle('app:openData', () => shell.openPath(app.getPath('userData')));
  ipcMain.handle('app:backup', async () => {
    const stamp = new Date().toISOString().slice(0, 10);
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Back up database', defaultPath: `screw-backup-${stamp}.db`, filters: [{ name: 'SQLite database', extensions: ['db'] }],
    });
    if (canceled || !filePath) return null;
    await db.backup(filePath);
    return filePath;
  });
  ipcMain.handle('app:checkUpdate', async () => {
    if (!app.isPackaged) return { status: 'dev' };
    try { await autoUpdater.checkForUpdates(); return { status: 'started' }; }
    catch (e) { return { status: 'error', message: String(e.message || e) }; }
  });
  ipcMain.handle('app:installUpdate', () => { autoUpdater.quitAndInstall(); });
}

function sendUpdate(payload) {
  if (win && !win.isDestroyed()) win.webContents.send('update:status', payload);
}

function setupAutoUpdate() {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.on('checking-for-update', () => sendUpdate({ status: 'checking' }));
  autoUpdater.on('update-available', info => sendUpdate({ status: 'available', version: info.version }));
  autoUpdater.on('update-not-available', () => sendUpdate({ status: 'none' }));
  autoUpdater.on('download-progress', p => sendUpdate({ status: 'progress', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', async info => {
    sendUpdate({ status: 'downloaded', version: info.version });
    const { response } = await dialog.showMessageBox(win, {
      type: 'info', buttons: ['Restart now', 'Later'], defaultId: 0,
      title: 'Update ready',
      message: `Version ${info.version} has been downloaded.`,
      detail: 'Restart the app to install the update.',
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });
  autoUpdater.on('error', err => { console.error('Update error:', err); sendUpdate({ status: 'error', message: String(err.message || err) }); });
  autoUpdater.checkForUpdates().catch(() => {});
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
