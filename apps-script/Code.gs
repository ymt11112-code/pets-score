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

    if (/^remote(Create|Join|Status|Send|Poll|Close)$/.test(req.action || '')) return json(phoneRemote(req));

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
/* 手機遙控通道：只寫 Script Properties，不修改學生 state／可讀工作表。 */
function phoneRemote(req) {
  var props = PropertiesService.getScriptProperties();
  var token = String(req.token || '');
  if (!/^[a-f0-9]{48}$/.test(token)) throw new Error('配對碼無效，請重新掃碼');
  var key = 'phoneRemote:' + token;
  var now = Date.now();
  if (req.action === 'remoteCreate') {
    if (!/^[a-f0-9]{48}$/.test(String(req.hostSecret || ''))) throw new Error('電腦配對碼無效');
    if (props.getProperty(key)) throw new Error('配對已存在，請重新產生');
    var state = readState(String(req.classKey || 'default'));
    if (!state || !Array.isArray(state.students)) throw new Error('請先完成班級雲端同步，再連接手機');
    var all = props.getProperties();
    Object.keys(all).filter(function(k) { return k.indexOf('phoneRemote:') === 0; }).forEach(function(k) {
      try { if (JSON.parse(all[k]).expires < now) props.deleteProperty(k); } catch (_) { props.deleteProperty(k); }
    });
    var session = {classKey:String(req.classKey || 'default'),className:String((state.classInfo || {}).className || '我的班級'),hostSecret:String(req.hostSecret),expires:now+14400000,seq:0,ack:0,commands:[],seen:[],lastHost:now,lastPhone:0,timer:null};
    props.setProperty(key, JSON.stringify(session));
    return {ok:true,expires:session.expires,className:session.className,serverNow:now};
  }
  var raw = props.getProperty(key);
  if (!raw) throw new Error('配對已結束，請重新掃描電腦的 QR code');
  var s = JSON.parse(raw);
  if (s.expires < now) { props.deleteProperty(key); throw new Error('配對已過期，請重新掃碼'); }
  if (s.classKey !== String(req.classKey || 'default')) throw new Error('配對班級不符');
  var host = String(req.hostSecret || '') === s.hostSecret;
  if (req.action === 'remoteClose') {
    if (!host) throw new Error('只有電腦可結束配對');
    props.deleteProperty(key); return {ok:true};
  }
  if (req.action === 'remotePoll') {
    if (!host) throw new Error('電腦驗證失敗');
    s.lastHost = now;
    s.ack = Math.max(s.ack, Math.min(s.seq, Math.max(0, Number(req.ack) || 0)));
    s.commands = s.commands.filter(function(c) { return c.seq > s.ack && c.at >= now-30000; });
    var t = req.timer || {};
    s.shortcuts = (Array.isArray(req.shortcuts)?req.shortcuts:[]).slice(0,6).filter(function(x){return /^s[1-6]$/.test(x.id);}).map(function(x){return {id:x.id,title:String(x.title||'教材捷徑').slice(0,30),type:x.type==='pdf'?'pdf':'url',ready:!!x.ready,configured:!!x.configured};});
    if(req.result&&Number(req.result.seq)<=s.ack)s.result={seq:Number(req.result.seq),ok:!!req.result.ok,message:String(req.result.message||'').slice(0,120)};
    s.timer = {mode:t.mode === 'up'?'up':'down',total:Math.max(1,Math.min(10800,Number(t.total)||60)),seconds:Math.max(0,Math.min(604800,Number(t.seconds)||0)),running:!!t.running,done:!!t.done,at:now};
    props.setProperty(key,JSON.stringify(s));
    return {ok:true,commands:s.commands,lastPhone:s.lastPhone,expires:s.expires,serverNow:now};
  }
  if (req.action === 'remoteJoin' || req.action === 'remoteStatus') {
    s.lastPhone=now;props.setProperty(key,JSON.stringify(s));
    return {ok:true,className:s.className,lastHost:s.lastHost,timer:s.timer,ack:s.ack,shortcuts:s.shortcuts||[],result:s.result||null,expires:s.expires,serverNow:now};
  }
  if (req.action === 'remoteSend') {
    if (now-s.lastHost>15000) throw new Error('電腦目前沒有回應，請保持電腦網頁開啟');
    var c=req.command || {},allowed=['open','start','pause','resume','reset','shortcut'];
    if (allowed.indexOf(c.kind)<0 || !/^[a-f0-9]{32}$/.test(String(c.id||''))) throw new Error('不支援的控制指令');
    if(c.kind==='shortcut'&&!/^s[1-6]$/.test(String(c.shortcutId||'')))throw new Error('無效的教材捷徑');
    s.commands=s.commands.filter(function(x){return x.seq>s.ack&&x.at>=now-30000;});
    s.seen=s.seen||[];
    var old=s.seen.filter(function(x){return x.id===c.id;})[0];
    if(!old){
      if(s.commands.length>=12) throw new Error('電腦處理中，請稍候再操作');
      old={seq:++s.seq,id:String(c.id),kind:c.kind,shortcutId:c.kind==='shortcut'?String(c.shortcutId):'',mode:c.mode==='up'?'up':'down',seconds:Math.max(1,Math.min(10800,Math.round(Number(c.seconds)||60))),at:now};
      s.commands.push(old);
      s.seen.push({id:old.id,seq:old.seq});s.seen=s.seen.slice(-24);
    }
    s.lastPhone=now;props.setProperty(key,JSON.stringify(s));
    return {ok:true,seq:old.seq,serverNow:now};
  }
  throw new Error('不支援的手機控制操作');
}
