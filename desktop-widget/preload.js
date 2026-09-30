/* contextIsolation 開著，renderer 不能直接用 Node/Electron API，
   只能透過這裡明確開放出去的幾個安全介面。 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopWidget', {
  resizePanel: (expanded) => ipcRenderer.invoke('resize-panel', expanded),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  getWindowBounds: () => ipcRenderer.invoke('get-window-bounds'),
  moveWindowTo: (x, y) => ipcRenderer.send('move-window-to', x, y),
});
