/* 工具視窗透過主加點視窗讀寫班級資料，避免多個視窗各自覆寫雲端狀態。 */
const path = require('path');
module.exports = function installTools({ app, BrowserWindow, ipcMain, getMainWindow, getPickerWindow, selectForAward }) {
  const windows = new Map();
  let quitting = false, sequence = 0;
  const pending = new Map(), timerPending=new Map();
  let timerState={mode:"down",total:300,seconds:300,running:false,done:false};
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
  function owner(event) { return [...windows.values()].find(win=>!win.isDestroyed()&&win.webContents===event.sender); }
  function allowed(event) { return !!owner(event); }
  function open(kind, background=false, visible=true) {
    if (!kinds.includes(kind)) return;
    const key=kind==='draw'||kind==='timer'?kind:'general';
    let win=windows.get(key);
    if(win&&!win.isDestroyed()){
      win.webContents.send('open-tool',kind);
      if(visible){if(win.isMinimized())win.restore();if(background)win.showInactive();else{win.show();win.focus();}}
      return win;
    }
    const area=require('electron').screen.getPrimaryDisplay().workArea;
    const width=Math.min(area.width,kind==='draw'?1240:kind==='timer'?800:480);
    const height=Math.min(area.height,kind==='draw'?820:kind==='timer'?660:700);
    win=new BrowserWindow({width,height,minWidth:Math.min(420,area.width),minHeight:Math.min(480,area.height),
      show:false,title:kind==='draw'?'課堂抽籤':kind==='timer'?'課堂計時器':'課堂小工具',autoHideMenuBar:true,
      resizable:true,maximizable:true,fullscreenable:true,alwaysOnTop:true,skipTaskbar:false,backgroundColor:'#eaf6ee',
      webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,backgroundThrottling:false}});
    windows.set(key,win);
    win.setAlwaysOnTop(true,'screen-saver');
    win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
    win.loadFile(path.join(__dirname,'renderer','tools.html'),{query:{tool:kind,window:key}});
    win.once('ready-to-show',()=>{if(visible&&!win.isDestroyed()){if(background)win.showInactive();else win.show();}});
    win.on('close',event=>{if(!quitting){event.preventDefault();if(win.isFullScreen())win.setFullScreen(false);win.hide();}});
    win.on('closed',()=>windows.delete(key));
    return win;
  }
  ipcMain.handle('toggle-tool-maximize',event=>{const win=owner(event);if(!win)return;win.isMaximized()?win.unmaximize():win.maximize();return win.isMaximized();});
  ipcMain.handle('toggle-tool-fullscreen',event=>{const win=owner(event);if(!win)return;win.setFullScreen(!win.isFullScreen());});
  ipcMain.handle('control-tool-timer',(event,command)=>{if(!allowed(event))return;return controlTimer(command);});
  ipcMain.handle('get-desktop-timer-state',event=>allowed(event)?timerState:null);
  ipcMain.handle('open-tool', (event, kind) => {
    if (event.sender !== getMainWindow()?.webContents && !allowed(event)) return;
    open(kind);
  });
  ipcMain.handle('close-tool-window', event => { if (allowed(event)) owner(event).close(); });
  ipcMain.handle('get-tool-state', event => {
    if (!allowed(event)) return null;
    return askMain('snapshot');
  });
  ipcMain.handle('configure-draw', (event,patch)=>{if(!allowed(event)||!patch||typeof patch!=='object')return null;return askMain('draw-config',{config:patch.config||{},weights:patch.weights||{},resetWeights:patch.resetWeights===true});});
  ipcMain.handle('run-draw', (event,request)=>{if(!allowed(event))return null;return askMain('draw-run',{order:request?.order===true});});
  ipcMain.handle('reset-draw', event=>{if(!allowed(event))return null;return askMain('draw-reset');});
  ipcMain.handle('select-drawn-students',async(event,ids)=>{if(!allowed(event)||!Array.isArray(ids)||ids.some(id=>typeof id!=='string'))return false;const state=await askMain('snapshot');const selected=[...new Set(ids)].filter(id=>state.students.some(st=>st.id===id)&&!A.isExcluded(state.attendance[id]||''));if(!selected.length)return false;selectForAward(selected);owner(event).hide();return true;});
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
    [...windows.values(), getPickerWindow()].forEach(target => { if (target && !target.isDestroyed()) target.webContents.send('tool-state', state); });
  });
  ipcMain.handle('select-drawn-student', async (event, id) => {
    if (!allowed(event) || typeof id !== 'string') return false;
    const state = await askMain('snapshot');
    if (!state.students.some(student => student.id === id) || A.isExcluded(state.attendance[id] || '')) return false;
    selectForAward(id); owner(event).hide(); return true;
  });
  ipcMain.handle('tool-timer-finished', event => {
    if (event.sender !== windows.get('timer')?.webContents) return;
    open('timer',true);
  });
  ipcMain.on('desktop-timer-state',(event,state)=>{if(event.sender===windows.get('timer')?.webContents&&state){timerState=state;for(const win of windows.values())if(!win.isDestroyed()&&win.webContents!==event.sender)win.webContents.send('desktop-timer-sync',state);}});
  ipcMain.on('desktop-timer-result',(event,result)=>{if(event.sender!==windows.get('timer')?.webContents)return;const p=timerPending.get(result.id);if(!p)return;clearTimeout(p.timeout);timerPending.delete(result.id);if(result.error)p.reject(Error(result.error));else{timerState=result.state;p.resolve(timerState);}});
  async function controlTimer(command){
    if(!['open','start','pause','resume','reset','configure'].includes(command.kind))throw Error('不支援的桌面計時指令');
    const tools=open('timer',true,command.show!==false);
    if(tools.webContents.isLoadingMainFrame())await new Promise(resolve=>tools.webContents.once('did-finish-load',resolve));
    return new Promise((resolve,reject)=>{const id=++sequence,timeout=setTimeout(()=>{timerPending.delete(id);reject(Error('桌面計時器未回應，請重試'));},8000);timerPending.set(id,{resolve,reject,timeout});tools.webContents.send('desktop-timer-command',{id,kind:command.kind,mode:command.mode,seconds:command.seconds});});
  }
  return { open, openRemoteTool:kind=>{if(!kinds.includes(kind))throw Error('不支援的桌面工具');open(kind,true);}, controlTimer, getTimerState:()=>timerState };
};
