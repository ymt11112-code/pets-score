/* 工具視窗透過主加點視窗讀寫班級資料，避免多個視窗各自覆寫雲端狀態。 */
const path = require('path');
module.exports = function installTools({ app, BrowserWindow, ipcMain, getMainWindow, getPickerWindow, selectForAward }) {
  let tools = null, quitting = false, sequence = 0;
  const pending = new Map();
  const A = require('./renderer/core/attendance');
  const kinds = ['attendance', 'draw', 'timer', 'tasks'];
  app.on('before-quit', () => { quitting = true; });
  function askMain(type, payload) {
    const main = getMainWindow();
    if (!main || main.isDestroyed()) return Promise.reject(new Error('加點工具尚未就緒'));
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timeout = setTimeout(() => { pending.delete(id); reject(new Error('讀取班級資料逾時，請稍後再試')); }, 8000);
      pending.set(id, { resolve, reject, timeout });
      main.webContents.send('tool-command', { id, type, payload: payload || {} });
    });
  }
  function allowed(event) { return tools && !tools.isDestroyed() && event.sender === tools.webContents; }
  function open(kind) {
    if (!kinds.includes(kind)) return;
    if (tools && !tools.isDestroyed()) {
      tools.webContents.send('open-tool', kind);
      if(kind==='draw')tools.setSize(1000,760);
      tools.show(); tools.focus(); return;
    }
    tools = new BrowserWindow({
      width: kind==='draw'?1000:420, height: kind==='draw'?760:610, minWidth: 320, minHeight: 380,
      title: '課堂小工具', autoHideMenuBar: true, resizable: true,
      alwaysOnTop: true, skipTaskbar: true, backgroundColor: '#eaf6ee',
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, backgroundThrottling: false },
    });
    tools.setAlwaysOnTop(true, 'screen-saver');
    tools.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    tools.loadFile(path.join(__dirname, 'renderer', 'tools.html'), { query: { tool: kind } });
    // 關閉只隱藏，倒數仍繼續；結束整個程式時才銷毀。
    tools.on('close', event => { if (!quitting) { event.preventDefault(); tools.hide(); } });
    tools.on('closed', () => { tools = null; });
  }
  ipcMain.handle('open-tool', (event, kind) => {
    if (event.sender !== getMainWindow()?.webContents && !allowed(event)) return;
    open(kind);
  });
  ipcMain.handle('close-tool-window', event => { if (allowed(event)) tools.close(); });
  ipcMain.handle('get-tool-state', event => {
    if (!allowed(event)) return null;
    return askMain('snapshot');
  });
  ipcMain.handle('configure-draw', (event,patch)=>{if(!allowed(event)||!patch||typeof patch!=='object')return null;return askMain('draw-config',{config:patch.config||{},weights:patch.weights||{},resetWeights:patch.resetWeights===true});});
  ipcMain.handle('run-draw', (event,request)=>{if(!allowed(event))return null;return askMain('draw-run',{order:request?.order===true});});
  ipcMain.handle('reset-draw', event=>{if(!allowed(event))return null;return askMain('draw-reset');});
  ipcMain.handle('select-drawn-students',async(event,ids)=>{if(!allowed(event)||!Array.isArray(ids)||ids.some(id=>typeof id!=='string'))return false;const state=await askMain('snapshot');const selected=[...new Set(ids)].filter(id=>state.students.some(st=>st.id===id)&&!A.isExcluded(state.attendance[id]||''));if(!selected.length)return false;selectForAward(selected);tools.hide();return true;});
  ipcMain.handle('set-tool-attendance', (event, id, absent) => {
    if (!allowed(event) || typeof id !== 'string' || !(typeof absent === 'boolean' || A.valid(absent))) return null;
    return askMain('attendance', { id, absent });
  });
  ipcMain.handle('set-tool-all-attendance', (event, absent) => {
    if (!allowed(event) || !(typeof absent === 'boolean' || A.valid(absent))) return null;
    return askMain('all-attendance', { absent });
  });
  ipcMain.handle('set-tool-task-students', (event, taskId, ids) => {
    if (!allowed(event) || typeof taskId !== 'string' || !Array.isArray(ids) || ids.some(id => typeof id !== 'string')) return null;
    return askMain('task-students', { taskId, ids });
  });
  ipcMain.on('tool-result', (event, result) => {
    if (event.sender !== getMainWindow()?.webContents || !result) return;
    const request = pending.get(result.id);
    if (!request) return;
    clearTimeout(request.timeout); pending.delete(result.id);
    if (result.error) request.reject(new Error(result.error)); else request.resolve(result.state);
  });
  ipcMain.on('publish-tool-state', (event, state) => {
    if (event.sender !== getMainWindow()?.webContents || !state) return;
    [tools, getPickerWindow()].forEach(target => { if (target && !target.isDestroyed()) target.webContents.send('tool-state', state); });
  });
  ipcMain.handle('select-drawn-student', async (event, id) => {
    if (!allowed(event) || typeof id !== 'string') return false;
    const state = await askMain('snapshot');
    if (!state.students.some(student => student.id === id) || A.isExcluded(state.attendance[id] || '')) return false;
    selectForAward(id); tools.hide(); return true;
  });
  ipcMain.handle('tool-timer-finished', event => {
    if (!allowed(event)) return;
    if (!tools.isVisible()) { tools.webContents.send('open-tool', 'timer'); tools.showInactive(); }
  });
  return { open };
};
