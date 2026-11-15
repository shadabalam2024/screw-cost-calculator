const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  listDimensions: () => ipcRenderer.invoke('dims:list'),
  addDimension: (label, weight) => ipcRenderer.invoke('dims:add', label, weight),
  deleteDimension: label => ipcRenderer.invoke('dims:delete', label),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSetting: (k, v) => ipcRenderer.invoke('settings:set', k, v),
  clearSettings: () => ipcRenderer.invoke('settings:clear'),
  inventorySummary: () => ipcRenderer.invoke('inv:summary'),
  inventoryHistory: () => ipcRenderer.invoke('inv:history'),
  addStock: (label, pieces, cost) => ipcRenderer.invoke('inv:add', label, pieces, cost),
  removeStock: (label, pieces) => ipcRenderer.invoke('inv:remove', label, pieces),
  deleteMove: id => ipcRenderer.invoke('inv:deleteMove', id),
  createInvoice: payload => ipcRenderer.invoke('bill:create', payload),
  listInvoices: () => ipcRenderer.invoke('bill:list'),
  getInvoice: id => ipcRenderer.invoke('bill:get', id),
  deleteInvoice: id => ipcRenderer.invoke('bill:delete', id),
  version: () => ipcRenderer.invoke('app:version'),
});
