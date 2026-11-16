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

    if (/^remoteAgent(Register|Poll|List|Close)$/.test(req.action || '')) return json(ebookAgent(req));
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
    var initialAgent=desktopControlAgent(props,String(req.classKey||'default'),'auto');
    var session = {timerAgentId:initialAgent?initialAgent.id:'',classKey:String(req.classKey || 'default'),className:String((state.classInfo || {}).className || '我的班級'),hostSecret:String(req.hostSecret),expires:now+14400000,seq:0,ack:0,commands:[],seen:[],lastHost:now,lastPhone:0,timer:null};
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
    s.webAck = Math.max(s.webAck||0, Math.min(s.seq, Math.max(0, Number(req.ack) || 0)));
    s.ack=Math.max(s.ack,s.webAck);
    s.commands = s.commands.filter(function(c) { return c.seq > (s.webAck||0) && c.at >= now-30000; });
    var selectedAgent=desktopControlAgent(props,s.classKey,req.timerAgentId||'auto');s.timerAgentId=selectedAgent?selectedAgent.id:'';
    var t = selectedAgent&&selectedAgent.timer?selectedAgent.timer:{};
    s.shortcuts = (Array.isArray(req.shortcuts)?req.shortcuts:[]).slice(0,6).filter(function(x){return /^s[1-6]$/.test(x.id);}).map(function(x){return {id:x.id,title:String(x.title||'教材捷徑').slice(0,30),type:x.type==='program'?'program':x.type==='pdf'?'pdf':'url',agentId:x.type==='program'?String(x.agentId||''):'',agentSlotId:x.type==='program'?String(x.agentSlotId||''):'',ready:!!x.ready,configured:!!x.configured};});
    if(req.result&&Number(req.result.seq)<=s.ack)s.result={seq:Number(req.result.seq),ok:!!req.result.ok,message:String(req.result.message||'').slice(0,120)};
    s.timer = {mode:t.mode === 'up'?'up':'down',total:Math.max(1,Math.min(10800,Number(t.total)||60)),seconds:Math.max(0,Math.min(604800,Number(t.seconds)||0)),running:!!t.running,done:!!t.done,at:Number(t.at)||now};
    props.setProperty(key,JSON.stringify(s));
    return {ok:true,commands:s.commands,lastPhone:s.lastPhone,expires:s.expires,serverNow:now};
  }
  if (req.action === 'remoteJoin' || req.action === 'remoteStatus') {
    s.lastPhone=now;props.setProperty(key,JSON.stringify(s));
    var liveAgent=desktopControlAgent(props,s.classKey,s.timerAgentId||'none');
    return {ok:true,className:s.className,desktopReady:!!liveAgent,desktopName:liveAgent?liveAgent.name:'',lastHost:liveAgent?liveAgent.lastSeen:s.lastHost,timer:liveAgent&&liveAgent.timer?liveAgent.timer:s.timer,ack:s.ack,pendingSeqs:(s.pendingAgentSeqs||[]).concat(s.commands.map(function(c){return c.seq;})),shortcuts:(s.shortcuts||[]).map(function(x){var copy=Object.assign({},x);if(x.type==='program')copy.ready=!!ebookAgentReady(props,s.classKey,x.agentId,x.agentSlotId);return copy;}),result:s.result||null,expires:s.expires,serverNow:now};
  }
  if (req.action === 'remoteSend') {
    var c=req.command || {},allowed=['open','start','pause','resume','reset','shortcut','tool'];
    if (allowed.indexOf(c.kind)<0 || !/^[a-f0-9]{32}$/.test(String(c.id||''))) throw new Error('不支援的控制指令');
    if(c.kind==='tool'&&['points','timer','attendance','draw','tasks'].indexOf(c.tool)<0)throw new Error('不支援的桌面工具');
    if(c.kind==='shortcut'&&!/^s[1-6]$/.test(String(c.shortcutId||'')))throw new Error('無效的教材捷徑');
    s.commands=s.commands.filter(function(x){return x.seq>(s.webAck||0)&&x.at>=now-30000;});
    s.seen=s.seen||[];
    var old=s.seen.filter(function(x){return x.id===c.id;})[0];
    if(!old){
      if(s.commands.length>=12) throw new Error('電腦處理中，請稍候再操作');
      old={seq:++s.seq,id:String(c.id),kind:c.kind,tool:c.kind==='tool'?c.tool:'',shortcutId:c.kind==='shortcut'?String(c.shortcutId):'',mode:c.mode==='up'?'up':'down',seconds:Math.max(1,Math.min(10800,Math.round(Number(c.seconds)||60))),at:now};
      var shortcut=c.kind==='shortcut'?(s.shortcuts||[]).filter(function(x){return x.id===c.shortcutId;})[0]:null;
      if(c.kind!=='shortcut'||(shortcut&&shortcut.type==='program')){
        var agent=c.kind==='shortcut'?ebookAgentReady(props,s.classKey,shortcut.agentId,shortcut.agentSlotId):desktopControlAgent(props,s.classKey,s.timerAgentId||'none');if(!agent)throw new Error('桌面工具未連線，請開啟 1.12.0 以上桌面工具並啟用手機控制');if(agent.queue.length>=12)throw new Error('桌面工具處理中，請稍候');
        agent.queue.push({id:token+':'+old.seq,token:token,seq:old.seq,kind:c.kind,tool:old.tool,mode:old.mode,seconds:old.seconds,slotId:shortcut?shortcut.agentSlotId:'',at:now});props.setProperty(ebookAgentKey(agent.id),JSON.stringify(agent));s.pendingAgentSeqs=(s.pendingAgentSeqs||[]).concat([old.seq]);
      }else{if(now-s.lastHost>15000)throw new Error('電腦網頁目前沒有回應，請保持網頁開啟');s.commands.push(old);}
      s.seen.push({id:old.id,seq:old.seq});s.seen=s.seen.slice(-24);
    }
    s.lastPhone=now;props.setProperty(key,JSON.stringify(s));
    return {ok:true,seq:old.seq,serverNow:now};
  }
  throw new Error('不支援的手機控制操作');
}
/* 原生電子書代理：只交換已設定位置的編號，不接收程式路徑或參數。 */
function ebookAgentKey(id) { if(!/^[a-f0-9]{48}$/.test(String(id||'')))throw new Error('桌面工具代碼無效');return 'ebookAgent:'+id; }
function ebookAgentCards(slots) { return (Array.isArray(slots)?slots:[]).slice(0,6).filter(function(x){return /^s[1-6]$/.test(x.id);}).map(function(x){return {id:x.id,title:String(x.title||'電子書').slice(0,30),ready:!!x.ready};}); }
function ebookAgent(req) {
  var props=PropertiesService.getScriptProperties(),now=Date.now(),classKey=String(req.classKey||'default');
  if(req.action==='remoteAgentList'){
    var all=props.getProperties(),agents=[];
    Object.keys(all).filter(function(k){return k.indexOf('ebookAgent:')===0;}).forEach(function(k){try{var a=JSON.parse(all[k]);if(a.classKey===classKey&&now-a.lastSeen<15000)agents.push({id:a.id,name:a.name,slots:a.slots,capabilities:a.capabilities||{}});if(now-a.lastSeen>86400000)props.deleteProperty(k);}catch(_){} });
    return {ok:true,agents:agents};
  }
  var key=ebookAgentKey(req.agentId),secret=String(req.agentSecret||'');
  if(!/^[a-f0-9]{48}$/.test(secret))throw new Error('桌面工具驗證失敗');
  var raw=props.getProperty(key),a=raw?JSON.parse(raw):null;
  if(req.action==='remoteAgentRegister'){
    if(a&&a.secret!==secret)throw new Error('桌面工具驗證失敗');
    if(!readState(classKey))throw new Error('請先連接班級雲端');
    if(a&&a.classKey!==classKey)(a.queue||[]).forEach(function(c){finish(c,{ok:false,message:'桌面工具已切換班級，請重新設定'});});
    if(!a||a.classKey!==classKey)a={id:req.agentId,secret:secret,classKey:classKey,queue:[]};
    a.capabilities={timer:!!(req.capabilities&&req.capabilities.timer),tools:!!(req.capabilities&&req.capabilities.tools)};a.name=String(req.name||'教室電腦').slice(0,30);a.slots=ebookAgentCards(req.slots);a.lastSeen=now;
    props.setProperty(key,JSON.stringify(a));return {ok:true};
  }
  if(!a||a.secret!==secret||a.classKey!==classKey)throw new Error('桌面工具尚未連接此班級');
  function finish(command,result){var k='phoneRemote:'+command.token,p=props.getProperty(k);if(!p)return;var s=JSON.parse(p);s.pendingAgentSeqs=(s.pendingAgentSeqs||[]).filter(function(n){return n!==command.seq;});s.ack=Math.max(s.ack,command.seq);s.result={seq:command.seq,ok:!!result.ok,message:String(result.message||'電子書指令已處理').slice(0,120)};props.setProperty(k,JSON.stringify(s));}
  var completed=Array.isArray(req.results)?req.results:[];
  a.queue=(a.queue||[]).filter(function(c){var r=completed.filter(function(x){return x.id===c.id;})[0];if(r){finish(c,r);return false;}if(c.at<now-30000){finish(c,{ok:false,message:'電子書指令已過期，請重新點選'});return false;}return true;});
  if(req.action==='remoteAgentClose'){a.queue.forEach(function(c){finish(c,{ok:false,message:'桌面電子書連線已停止'});});props.deleteProperty(key);return {ok:true};}
  if(req.action!=='remoteAgentPoll')throw new Error('不支援的桌面工具操作');
  a.slots=ebookAgentCards(req.slots);a.lastSeen=now;a.capabilities={timer:!!(req.capabilities&&req.capabilities.timer),tools:!!(req.capabilities&&req.capabilities.tools)};
  var t=req.timer;if(t)a.timer={mode:t.mode==='up'?'up':'down',total:Math.max(1,Number(t.total)||300),seconds:Math.max(0,Number(t.seconds)||0),running:!!t.running,done:!!t.done,at:now};props.setProperty(key,JSON.stringify(a));
  return {ok:true,commands:a.queue.map(function(c){return {id:c.id,kind:c.kind,tool:c.tool,mode:c.mode,seconds:c.seconds,slotId:c.slotId,at:c.at};}),serverNow:now};
}
function ebookAgentReady(props,classKey,id,slotId){try{var raw=props.getProperty(ebookAgentKey(id));if(!raw)return null;var a=JSON.parse(raw);if(a.classKey!==classKey||Date.now()-a.lastSeen>15000)return null;return (a.slots||[]).some(function(s){return s.id===slotId&&s.ready;})?a:null;}catch(_){return null;}}

function desktopControlAgent(props,classKey,id){var all=props.getProperties(),keys=id&&id!=='auto'?['ebookAgent:'+id]:Object.keys(all).filter(function(k){return k.indexOf('ebookAgent:')===0;}).sort();for(var i=0;i<keys.length;i++){try{var a=JSON.parse(all[keys[i]]||'null');if(a&&a.classKey===classKey&&Date.now()-a.lastSeen<15000&&a.capabilities&&a.capabilities.timer&&a.capabilities.tools)return a;}catch(_){}}return null;}
