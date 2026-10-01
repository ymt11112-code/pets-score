/* contextIsolation 開著，renderer 不能直接用 Node/Electron API，
   只能透過這裡明確開放出去的幾個安全介面。主視窗跟選人小視窗共用同一份 preload。 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopWidget', {
  getDockSide: () => ipcRenderer.invoke('get-dock-side'),
  onDockChanged: (cb) => ipcRenderer.on('dock-changed', (evt, side) => cb(side)),
  resizeTo: (width, height) => ipcRenderer.invoke('resize-to', width, height),
  resizePicker: (width, height) => ipcRenderer.invoke('resize-picker', width, height),
  openPicker: () => ipcRenderer.invoke('open-picker'),
  closePicker: () => ipcRenderer.invoke('close-picker'),
  onPickerClosed: (cb) => ipcRenderer.on('picker-closed', () => cb()),

  getSelection: () => ipcRenderer.invoke('get-selection'),
  toggleStudent: (id) => ipcRenderer.invoke('toggle-student', id),
  selectMany: (ids, on) => ipcRenderer.invoke('select-many', ids, on),
  clearSelection: () => ipcRenderer.invoke('clear-selection'),
  invertSelection: (ids) => ipcRenderer.invoke('invert-selection', ids),
  onSelectionChanged: (cb) => ipcRenderer.on('selection-changed', (evt, ids) => cb(ids)),

  hideWindow: () => ipcRenderer.invoke('hide-window'),
  quitApp: () => ipcRenderer.invoke('quit-app'),
});
