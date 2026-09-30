/* 桌面漂浮加點小工具：主行程（Electron main process）
   負責開一個無邊框、永遠在最上層（包含蓋在全螢幕 PowerPoint 上）的小視窗，
   資料邏輯（連線 Google Sheets、加點）完全交給 renderer 那邊的 store.js，
   跟網頁版共用同一份程式碼，不用維護兩套。

   視窗本身是「橫幅」造型，靠左上角的小把手（-webkit-app-region:drag）拖曳。
   拖到螢幕邊緣放開，會自動貼齊變成直的（靠左右）或橫的（靠上下），
   節省空間的邏輯（貼邊判斷＋依貼邊方向重新定位）都在這個檔案；
   實際要縮多大則是 renderer 量完自己的排版之後回報過來的（見 resize-to）。 */
const { app, BrowserWindow, Tray, Menu, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const POS_FILE = path.join(app.getPath('userData'), 'window-pos.json');
const DEFAULT_SIZE = { width: 360, height: 50 };
const DOCK_THRESHOLD = 24; // 離螢幕邊緣多近算「貼邊」（px）

let win = null;
let tray = null;
let dockSide = 'none'; // 'none' | 'left' | 'right' | 'top' | 'bottom'

function loadSavedBounds() {
  try {
    const raw = fs.readFileSync(POS_FILE, 'utf8');
    const pos = JSON.parse(raw);
    if (typeof pos.x === 'number' && typeof pos.y === 'number') return pos;
  } catch (e) { /* 第一次執行還沒有存檔，用預設位置 */ }
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  return { x: width - DEFAULT_SIZE.width - 24, y: height - DEFAULT_SIZE.height - 24 };
}

function savePos(x, y) {
  try { fs.writeFileSync(POS_FILE, JSON.stringify({ x, y })); } catch (e) { /* 存不下去就算了，不影響使用 */ }
}

function computeDockSide(bounds) {
  const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
  const area = display.workArea;
  const distLeft = bounds.x - area.x;
  const distRight = (area.x + area.width) - (bounds.x + bounds.width);
  const distTop = bounds.y - area.y;
  const distBottom = (area.y + area.height) - (bounds.y + bounds.height);
  const min = Math.min(distLeft, distRight, distTop, distBottom);
  if (min > DOCK_THRESHOLD) return 'none';
  if (min === distRight) return 'right';
  if (min === distLeft) return 'left';
  if (min === distTop) return 'top';
  return 'bottom';
}

function createWindow() {
  const pos = loadSavedBounds();
  win = new BrowserWindow({
    x: pos.x, y: pos.y,
    width: DEFAULT_SIZE.width, height: DEFAULT_SIZE.height,
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

  dockSide = computeDockSide(win.getBounds());

  /* 拖曳中每個 'move' 事件都只做「存檔＋重新判斷貼邊」，不會在拖曳過程中順便改視窗大小/位置，
     避免跟系統原生的拖曳動作互相打架；等放開滑鼠、事件停下來 150ms 後才真的套用貼邊效果。 */
  let settleTimer = null;
  win.on('move', () => {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      if (!win) return;
      const b = win.getBounds();
      savePos(b.x, b.y);
      const next = computeDockSide(b);
      if (next !== dockSide) {
        dockSide = next;
        win.webContents.send('dock-changed', dockSide);
      }
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

ipcMain.handle('get-dock-side', () => dockSide);

/* renderer 每次排版變動（切分類、展開學生名單、展開點數紀錄……）都會量出自己實際需要的大小，
   呼叫這個把視窗實際尺寸調整過去；同時依照目前貼邊方向決定要固定住哪一邊
   （貼右邊就固定右邊界、視窗往左長大；貼下面就固定下邊界、往上長大……以此類推），
   這樣長大縮小的時候才不會整個從貼著的那條邊跑掉。 */
ipcMain.handle('resize-to', (evt, width, height) => {
  if (!win) return;
  width = Math.max(40, Math.round(width));
  height = Math.max(40, Math.round(height));
  const cur = win.getBounds();
  const display = screen.getDisplayNearestPoint({ x: cur.x, y: cur.y });
  const area = display.workArea;
  let x = cur.x;
  let y = cur.y;
  if (dockSide === 'right') x = cur.x + cur.width - width;
  else if (dockSide === 'bottom') y = cur.y + cur.height - height;
  // dockSide 'left' / 'top' / 'none' 維持原本的 x / y（左上角固定）
  x = Math.min(Math.max(x, area.x), area.x + area.width - width);
  y = Math.min(Math.max(y, area.y), area.y + area.height - height);
  if (x === cur.x && y === cur.y && width === cur.width && height === cur.height) return;
  win.setBounds({ x, y, width, height });
});

ipcMain.handle('hide-window', () => { if (win) win.hide(); });
ipcMain.handle('quit-app', () => app.quit());

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  // 這個工具的定位是「一直待命」，不要因為視窗關掉就整個結束（Windows 慣例是留在工作列圖示）
});
