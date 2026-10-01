/* 桌面漂浮加點小工具：主行程（Electron main process）
   負責開一個無邊框、永遠在最上層（包含蓋在全螢幕 PowerPoint 上）的小視窗，
   資料邏輯（連線 Google Sheets、加點）完全交給 renderer 那邊的 store.js，
   跟網頁版共用同一份程式碼，不用維護兩套。

   視窗本身是「橫幅」造型，靠左上角的小把手（-webkit-app-region:drag）拖曳。
   拖到螢幕邊緣放開，會自動貼齊變成直的（靠左右）或橫的（靠上下），
   節省空間的邏輯（貼邊判斷＋依貼邊方向重新定位）都在這個檔案；
   實際要縮多大則是 renderer 量完自己的排版之後回報過來的（見 resize-to）。

   「選人」是另外開一個小視窗（並排貼在主視窗旁邊），不是塞進主視窗裡面往下長——
   貼邊變成窄直幅時，主視窗如果連學生清單一起往下長，很容易長到超出螢幕還被裁掉、
   點不到；獨立成一個視窗就不受主視窗大小限制，且主視窗完全不用跟著變形。
   兩個視窗是各自獨立的 renderer process，選取狀態（哪些學生被選起來了）在這裡
   （main process）統一保管，兩邊各自的畫面只是訂閱這份狀態、不會各自為政。 */
const { app, BrowserWindow, Tray, Menu, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const POS_FILE = path.join(app.getPath('userData'), 'window-pos.json');
const DEFAULT_SIZE = { width: 320, height: 50 };
const PICKER_SIZE = { width: 190, height: 380 };
const DOCK_THRESHOLD = 24; // 離螢幕邊緣多近算「貼邊」（px）
const PICKER_GAP = 8; // 選人小視窗跟主視窗之間留的間距

let win = null;
let pickerWin = null;
let tray = null;
let dockSide = 'none'; // 'none' | 'left' | 'right' | 'top' | 'bottom'
let ignoreNextMove = false; // resize-to 自己造成的 setBounds 移動，不要被當成使用者拖曳
let selectedIds = []; // 目前選取的學生 id，主視窗／選人視窗共用同一份

function loadSavedBounds() {
  try {
    const raw = fs.readFileSync(POS_FILE, 'utf8');
    const pos = JSON.parse(raw);
    if (typeof pos.x === 'number' && typeof pos.y === 'number') return pos;
  } catch (e) { /* 第一次執行還沒有存檔，用預設位置 */ }
  // 邊界留寬一點（超過 DOCK_THRESHOLD），避免第一次開啟就卡在「算不算貼邊」的模糊地帶
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const margin = DOCK_THRESHOLD + 20;
  return { x: width - DEFAULT_SIZE.width - margin, y: height - DEFAULT_SIZE.height - margin };
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

/* 選人小視窗永遠緊貼主視窗：優先放右邊，右邊空間不夠就放左邊，
   上下位置盡量對齊主視窗頂端，超出螢幕範圍就夾回可用範圍內。 */
function positionPickerWindow() {
  if (!win || !pickerWin) return;
  const mb = win.getBounds();
  const pb = pickerWin.getBounds();
  const display = screen.getDisplayNearestPoint({ x: mb.x, y: mb.y });
  const area = display.workArea;
  let x = mb.x + mb.width + PICKER_GAP;
  if (x + pb.width > area.x + area.width) x = mb.x - pb.width - PICKER_GAP;
  x = Math.min(Math.max(x, area.x), area.x + area.width - pb.width);
  let y = Math.min(Math.max(mb.y, area.y), area.y + area.height - pb.height);
  pickerWin.setPosition(Math.round(x), Math.round(y));
}

function openPickerWindow() {
  if (pickerWin) { pickerWin.show(); positionPickerWindow(); return; }
  pickerWin = new BrowserWindow({
    x: 0, y: 0, width: PICKER_SIZE.width, height: PICKER_SIZE.height,
    frame: false, transparent: true, resizable: false, movable: false,
    minimizable: false, maximizable: false, skipTaskbar: true, alwaysOnTop: true, hasShadow: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  });
  pickerWin.setAlwaysOnTop(true, 'screen-saver');
  pickerWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  pickerWin.loadFile(path.join(__dirname, 'renderer', 'picker.html'));
  pickerWin.on('closed', () => {
    pickerWin = null;
    if (win) win.webContents.send('picker-closed');
  });
  positionPickerWindow();
}

function closePickerWindow() {
  if (pickerWin) pickerWin.close(); // 觸發上面的 'closed'，會自動通知主視窗
}

function broadcastSelection() {
  if (win) win.webContents.send('selection-changed', selectedIds);
  if (pickerWin) pickerWin.webContents.send('selection-changed', selectedIds);
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
     避免跟系統原生的拖曳動作互相打架；等放開滑鼠、事件停下來 150ms 後才真的套用貼邊效果。

     這裡的 ignoreNextMove 很重要：resize-to 為了「貼右邊時固定右邊界」會連位置一起
     setBounds，這本身也會觸發 'move' 事件——如果不擋掉，就會變成「resize 觸發 move
     → 150ms 後重新判斷貼邊 → 送 dock-changed → renderer 重新排版 → 又呼叫 resize-to
     → 又觸發 move → ……」的無窮迴圈，畫面就會一直抖動、按鈕點不到。只有「使用者自己
     拖曳把手」造成的 move 才需要重新判斷貼邊。 */
  let settleTimer = null;
  win.on('move', () => {
    if (pickerWin) positionPickerWindow(); // 選人視窗要立刻跟著移動，不用等 150ms settle
    if (ignoreNextMove) { ignoreNextMove = false; return; }
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

/* renderer 每次排版變動（切分類、展開/收起點數紀錄……）都會量出自己實際需要的大小，
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
  // 內容如果一次全部展開，量出來的高度可能超過整個螢幕，這裡先把整個視窗夾在螢幕可用範圍內，
  // 超出的部分交給面板自己的 max-height/overflow 去捲動
  width = Math.min(width, area.width);
  height = Math.min(height, area.height);
  let x = cur.x;
  let y = cur.y;
  if (dockSide === 'right') x = cur.x + cur.width - width;
  else if (dockSide === 'bottom') y = cur.y + cur.height - height;
  // dockSide 'left' / 'top' / 'none' 維持原本的 x / y（左上角固定）
  x = Math.min(Math.max(x, area.x), area.x + area.width - width);
  y = Math.min(Math.max(y, area.y), area.y + area.height - height);
  if (x === cur.x && y === cur.y && width === cur.width && height === cur.height) return;
  ignoreNextMove = true;
  win.setBounds({ x, y, width, height });
  // 保險：如果這次位置其實沒變（只有大小變），Windows 可能根本不會發出 'move' 事件，
  // 那 ignoreNextMove 就永遠不會被消掉，會誤擋到使用者下一次真正的拖曳，所以設一個逾時保底重置
  setTimeout(() => { ignoreNextMove = false; }, 60);
});

/* 選人小視窗量完自己的內容高度後回報過來，主視窗位置不變，只調整選人視窗的大小＋重新貼齊 */
ipcMain.handle('resize-picker', (evt, width, height) => {
  if (!pickerWin) return;
  width = Math.max(80, Math.round(width));
  height = Math.max(80, Math.round(height));
  const cur = pickerWin.getBounds();
  if (width === cur.width && height === cur.height) return;
  pickerWin.setBounds({ x: cur.x, y: cur.y, width, height });
  positionPickerWindow();
});

ipcMain.handle('open-picker', () => openPickerWindow());
ipcMain.handle('close-picker', () => closePickerWindow());

ipcMain.handle('get-selection', () => selectedIds);
ipcMain.handle('toggle-student', (evt, id) => {
  const i = selectedIds.indexOf(id);
  if (i >= 0) selectedIds.splice(i, 1); else selectedIds.push(id);
  broadcastSelection();
});
/* 一次選取／取消多個 id（全班、整組用）：on=true 是「加進選取」，on=false 是「移出選取」 */
ipcMain.handle('select-many', (evt, ids, on) => {
  (ids || []).forEach((id) => {
    const i = selectedIds.indexOf(id);
    if (on && i < 0) selectedIds.push(id);
    if (!on && i >= 0) selectedIds.splice(i, 1);
  });
  broadcastSelection();
});
ipcMain.handle('clear-selection', () => { selectedIds = []; broadcastSelection(); });
/* 反選：給定的名單裡，原本有選的變沒選、原本沒選的變有選，一次做完廣播一次，避免中間閃一下 */
ipcMain.handle('invert-selection', (evt, ids) => {
  (ids || []).forEach((id) => {
    const i = selectedIds.indexOf(id);
    if (i >= 0) selectedIds.splice(i, 1); else selectedIds.push(id);
  });
  broadcastSelection();
});

ipcMain.handle('hide-window', () => { if (win) win.hide(); if (pickerWin) pickerWin.hide(); });
ipcMain.handle('quit-app', () => app.quit());

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  // 這個工具的定位是「一直待命」，不要因為視窗關掉就整個結束（Windows 慣例是留在工作列圖示）
});
