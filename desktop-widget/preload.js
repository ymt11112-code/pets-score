/* contextIsolation 開著，renderer 不能直接用 Node/Electron API，
   只能透過這裡明確開放出去的幾個安全介面。 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopWidget', {
  getDockSide: () => ipcRenderer.invoke('get-dock-side'),
  onDockChanged: (cb) => ipcRenderer.on('dock-changed', (evt, side) => cb(side)),
  resizeTo: (width, height) => ipcRenderer.invoke('resize-to', width, height),
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  quitApp: () => ipcRenderer.invoke('quit-app'),
});
