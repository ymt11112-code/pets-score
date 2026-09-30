/* 桌面漂浮加點小工具：主行程（Electron main process）
   負責開一個無邊框、永遠在最上層（包含蓋在全螢幕 PowerPoint 上）的小視窗，
   視窗拖曳靠 CSS 的 -webkit-app-region: drag，不用自己寫拖曳邏輯。
   資料邏輯（連線 Google Sheets、加點）完全交給 renderer 那邊的 store.js，
   跟網頁版共用同一份程式碼，不用維護兩套。 */
const { app, BrowserWindow, Tray, Menu, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const POS_FILE = path.join(app.getPath('userData'), 'window-pos.json');
const COLLAPSED_SIZE = { width: 64, height: 64 };
const EXPANDED_SIZE = { width: 320, height: 460 };

let win = null;
let tray = null;

function loadSavedBounds() {
  try {
    const raw = fs.readFileSync(POS_FILE, 'utf8');
    const pos = JSON.parse(raw);
    if (typeof pos.x === 'number' && typeof pos.y === 'number') return pos;
  } catch (e) { /* 第一次執行還沒有存檔，用預設位置 */ }
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  return { x: width - COLLAPSED_SIZE.width - 24, y: height - COLLAPSED_SIZE.height - 24 };
}

function savePos(x, y) {
  try { fs.writeFileSync(POS_FILE, JSON.stringify({ x, y })); } catch (e) { /* 存不下去就算了，不影響使用 */ }
}

function createWindow() {
  const pos = loadSavedBounds();
  win = new BrowserWindow({
    x: pos.x, y: pos.y,
    width: COLLAPSED_SIZE.width, height: COLLAPSED_SIZE.height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });
  // 'screen-saver' 是 Windows 上少數能蓋過「全螢幕簡報模式」的層級，一般 App 疊不過去
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  let saveTimer = null;
  win.on('move', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (!win) return;
      const b = win.getBounds();
      savePos(b.x, b.y);
    }, 150);
  });

  win.on('closed', () => { win = null; });
}

function createTray() {
  // 用系統內建的空白圖示也能動作，只是工具列圖示會比較不明顯；先求「打得開、關得掉」堪用。
  tray = new Tray(path.join(__dirname, 'renderer', 'tray-icon.png'));
  tray.setToolTip('班級加點小工具');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '顯示小工具', click: () => { if (win) { win.show(); win.focus(); } } },
    { label: '結束', click: () => app.quit() },
  ]));
  tray.on('click', () => { if (win) { win.show(); win.focus(); } });
}

/* renderer 展開／收合面板時呼叫這個調整實際視窗大小；用 setBounds 而不是只改 CSS，
   是因為視窗本身是無邊框透明的，CSS 畫出來的面板超出視窗範圍會直接被裁掉看不到。 */
ipcMain.handle('resize-panel', (evt, expanded) => {
  if (!win) return;
  const cur = win.getBounds();
  const size = expanded ? EXPANDED_SIZE : COLLAPSED_SIZE;
  // 展開時視窗會變大，如果貼著螢幕邊緣展開會被切掉，所以順便把位置往內拉一點
  const display = screen.getDisplayNearestPoint({ x: cur.x, y: cur.y });
  const area = display.workArea;
  let x = cur.x, y = cur.y;
  if (expanded) {
    x = Math.min(x, area.x + area.width - size.width - 8);
    y = Math.min(y, area.y + area.height - size.height - 8);
  }
  win.setBounds({ x, y, width: size.width, height: size.height });
});

ipcMain.handle('quit-app', () => app.quit());

/* 收合圓鈕同時要能「點擊展開」又要能「拖曳移動」，但 CSS 的 -webkit-app-region:drag
   會讓 Chromium 直接把 mousedown 吃掉去做原生視窗拖曳，click 事件永遠不會發生
   （這是 Electron 的已知限制）。所以圓鈕改用 JS 自己算拖曳位移，
   讓視窗跟著游標移動，藉此讓同一顆按鈕同時支援點擊與拖曳。 */
ipcMain.handle('get-window-bounds', () => (win ? win.getBounds() : null));
ipcMain.on('move-window-to', (evt, x, y) => {
  if (!win) return;
  win.setPosition(Math.round(x), Math.round(y));
});

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  // 這個工具的定位是「一直待命」，不要因為視窗關掉就整個結束（Windows 慣例是留在工作列圖示）
});
