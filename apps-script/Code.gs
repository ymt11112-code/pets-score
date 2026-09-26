/**
 * 班級寵物探險隊 · Google Sheets 後端
 * ------------------------------------------------------------------
 * 使用方式：
 *  1. 建立一份新的 Google 試算表
 *  2. 擴充功能 → Apps Script，把這份檔案整份貼上（取代原本的 myFunction）
 *  3. 部署 → 新增部署作業 → 類型「網頁應用程式」
 *     · 執行身分：我
 *     · 具有存取權的使用者：任何人
 *  4. 複製 /exec 結尾的網址，貼到系統「資料與同步」頁面
 *
 * 資料存放：
 *  · _state 工作表：系統實際讀寫的 JSON（會自動分段，請勿手動編輯）
 *  · 學生總覽 / 點數紀錄 工作表：每次儲存時自動產生，方便你在試算表直接看
 */

var CHUNK_SIZE = 40000;   // 單一儲存格上限 50000 字元，保留安全值
var STATE_SHEET = '_state';

function doGet(e) {
  return json({ ok: true, message: '班級寵物探險隊後端運作中', time: new Date().toISOString() });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json({ ok: false, error: '系統忙碌中，請稍後再試' });
  }

  try {
    var req = {};
    if (e && e.postData && e.postData.contents) req = JSON.parse(e.postData.contents);
    var classKey = String(req.classKey || 'default');

    switch (req.action) {
      case 'load':
        return json({ ok: true, state: readState(classKey) });

      case 'save':
        if (!req.state) return json({ ok: false, error: '缺少 state 資料' });
        writeState(classKey, req.state);
        writeReadableSheets(classKey, req.state);
        return json({ ok: true, updatedAt: req.state.updatedAt || Date.now() });

      case 'ping':
        return json({ ok: true, pong: true });

      default:
        return json({ ok: false, error: '未知的操作：' + req.action });
    }
  } catch (err) {
    return json({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    lock.releaseLock();
  }
}

/* ---------------- 讀寫 JSON ---------------- */

function readState(classKey) {
  var sh = getStateSheet();
  var values = sh.getDataRange().getValues();
  var parts = [];
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === classKey) parts.push({ idx: Number(values[i][1]) || 0, text: String(values[i][2] || '') });
  }
  if (!parts.length) return null;
  parts.sort(function (a, b) { return a.idx - b.idx; });
  var raw = parts.map(function (p) { return p.text; }).join('');
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function writeState(classKey, state) {
  var sh = getStateSheet();
  var raw = JSON.stringify(state);

  // 先刪掉這個班級的舊資料（由下往上刪，避免列號位移）
  var values = sh.getDataRange().getValues();
  for (var i = values.length - 1; i >= 1; i--) {
    if (String(values[i][0]) === classKey) sh.deleteRow(i + 1);
  }

  var rows = [];
  for (var start = 0, idx = 0; start < raw.length; start += CHUNK_SIZE, idx++) {
    rows.push([classKey, idx, raw.substr(start, CHUNK_SIZE), new Date()]);
  }
  if (!rows.length) rows.push([classKey, 0, '{}', new Date()]);
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, 4).setValues(rows);
}

function getStateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(STATE_SHEET);
  if (!sh) {
    sh = ss.insertSheet(STATE_SHEET);
    sh.appendRow(['classKey', 'chunkIndex', 'data', 'updatedAt']);
    sh.hideSheet();
  }
  return sh;
}

/* ---------------- 產生可讀的工作表 ---------------- */

function writeReadableSheets(classKey, state) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var groupName = {};
  (state.groups || []).forEach(function (g) { groupName[g.id] = g.name; });
  var studentName = {};
  (state.students || []).forEach(function (s) { studentName[s.id] = s.name; });

  /* 學生總覽 */
  var sh1 = resetSheet(ss, '學生總覽_' + classKey);
  var header1 = ['座號', '姓名', '小組', '寵物', '寵物等級', '累積 XP', '課堂點數', '金幣', '連續天數', '徽章數', '造型數'];
  var rows1 = (state.students || []).map(function (s) {
    return [
      s.no, s.name, groupName[s.groupId] || '', s.petName || s.petId,
      levelFromXp(s.xp).level, s.xp || 0, s.points || 0, s.coins || 0,
      s.streak || 0, (s.badges || []).length, (s.cosmetics || []).length,
    ];
  });
  writeTable(sh1, header1, rows1);

  /* 點數紀錄（最近 1000 筆） */
  var sh2 = resetSheet(ss, '點數紀錄_' + classKey);
  var header2 = ['時間', '學生', '事由', '點數', 'XP', '金幣', '操作者', '備註', '狀態'];
  var rows2 = (state.ledger || []).slice(0, 1000).map(function (e) {
    var names = (e.studentIds || []).map(function (id) { return studentName[id] || id; }).join('、');
    return [
      new Date(e.ts), names, e.label, e.points || 0, e.xp || 0, e.coins || 0,
      e.by || '', e.note || '', e.undone ? '已撤銷' : '有效',
    ];
  });
  writeTable(sh2, header2, rows2);
  if (rows2.length) sh2.getRange(2, 1, rows2.length, 1).setNumberFormat('yyyy/MM/dd HH:mm');
}

function resetSheet(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  sh.clear();
  return sh;
}

function writeTable(sh, header, rows) {
  sh.getRange(1, 1, 1, header.length).setValues([header])
    .setFontWeight('bold').setBackground('#e8f5ec');
  if (rows.length) sh.getRange(2, 1, rows.length, header.length).setValues(rows);
  sh.setFrozenRows(1);
}

/* 與前端相同的升級公式：升到下一級所需 XP = 20 + (level-1) * 10 */
function levelFromXp(totalXp) {
  var level = 1;
  var rest = Math.max(0, Math.floor(totalXp || 0));
  while (rest >= (20 + (level - 1) * 10) && level < 99) {
    rest -= (20 + (level - 1) * 10);
    level += 1;
  }
  return { level: level, inLevel: rest };
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
