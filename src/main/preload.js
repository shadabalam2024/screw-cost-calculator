const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  listDimensions: () => ipcRenderer.invoke('dims:list'),
  addDimension: (label, weight) => ipcRenderer.invoke('dims:add', label, weight),
  deleteDimension: label => ipcRenderer.invoke('dims:delete', label),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSetting: (k, v) => ipcRenderer.invoke('settings:set', k, v),
  clearSettings: () => ipcRenderer.invoke('settings:clear'),
  version: () => ipcRenderer.invoke('app:version'),
});
