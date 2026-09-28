/* 資料層：本機模式（localStorage）／雲端模式（Google Sheets Apps Script）
   對外統一介面 window.PetStore */
(function (global) {
  'use strict';

  const U = global.PetUtil;
  const M = global.PetModel;

  const LS_STATE = 'classpet.state.v1';
  const LS_CONF = 'classpet.config.v1';

  let state = null;
  let config = {
    mode: 'local', sheetUrl: '', classKey: 'default', pollSeconds: 20,
    github: { owner: '', repo: '', branch: 'main', path: 'assets/img/pets', token: '' },
  };
  const listeners = [];
  let pollTimer = null;
  let saveTimer = null;
  let syncStatus = { state: 'idle', message: '本機模式', at: 0 };

  /* ---------- 安全的 localStorage ---------- */
  function lsGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, val); return true; } catch (e) { return false; }
  }

  function loadConfig() {
    const raw = lsGet(LS_CONF);
    if (raw) {
      try { config = Object.assign(config, JSON.parse(raw)); } catch (e) { /* 忽略壞掉的設定 */ }
    }
    return config;
  }

  function saveConfig(patch) {
    config = Object.assign(config, patch || {});
    lsSet(LS_CONF, JSON.stringify(config));
    return config;
  }

  /* ---------- GitHub 圖片上傳（設定只存在這台電腦，不會跟班級資料一起同步/匯出） ---------- */
  function getGithubConfig() {
    return Object.assign({ owner: '', repo: '', branch: 'main', path: 'assets/img/pets', token: '' }, config.github || {});
  }

  function saveGithubConfig(patch) {
    config.github = Object.assign(getGithubConfig(), patch || {});
    lsSet(LS_CONF, JSON.stringify(config));
    return config.github;
  }

  function githubUploadImage(file, targetPath) {
    const gh = getGithubConfig();
    if (!gh.owner || !gh.repo || !gh.token) return Promise.reject(new Error('請先在「GitHub 上傳設定」填好帳號、Repo 名稱與 Token'));
    const branch = gh.branch || 'main';
    const url = 'https://api.github.com/repos/' + gh.owner + '/' + gh.repo + '/contents/' + targetPath;
    const headers = { Authorization: 'Bearer ' + gh.token, Accept: 'application/vnd.github+json' };

    function readAsBase64() {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('讀取圖片檔案失敗'));
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.readAsDataURL(file);
      });
    }
    function getExistingSha() {
      return fetch(url + '?ref=' + encodeURIComponent(branch), { headers })
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => (json && json.sha) || null)
        .catch(() => null);
    }

    return Promise.all([readAsBase64(), getExistingSha()]).then(([base64, sha]) => {
      const body = { message: '上傳寵物造型圖片：' + targetPath, content: base64, branch };
      if (sha) body.sha = sha;
      return fetch(url, {
        method: 'PUT',
        headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
        body: JSON.stringify(body),
      })
        .then((res) => res.json().then((json) => ({ ok: res.ok, status: res.status, json })).catch(() => ({ ok: res.ok, status: res.status, json: null })))
        .then(({ ok, status, json }) => {
          if (!ok) throw new Error((json && json.message) || ('GitHub 回應錯誤（狀態碼 ' + status + '）'));
          const downloadUrl = json && json.content && json.content.download_url;
          if (!downloadUrl) throw new Error('上傳成功，但沒有拿到圖片網址，請到 GitHub 上手動複製 Raw 連結。');
          return downloadUrl;
        });
    });
  }

  /* 列出 GitHub Repo 某個資料夾底下的檔案／子資料夾，給「從 GitHub 選擇圖片」的介面用 */
  function githubListFiles(path) {
    const gh = getGithubConfig();
    if (!gh.owner || !gh.repo || !gh.token) return Promise.reject(new Error('請先在「GitHub 上傳設定」填好帳號、Repo 名稱與 Token'));
    const branch = gh.branch || 'main';
    const cleanPath = String(path || '').replace(/^\/+|\/+$/g, '');
    const url = 'https://api.github.com/repos/' + gh.owner + '/' + gh.repo + '/contents' + (cleanPath ? '/' + cleanPath : '') + '?ref=' + encodeURIComponent(branch);
    const headers = { Authorization: 'Bearer ' + gh.token, Accept: 'application/vnd.github+json' };
    return fetch(url, { headers })
      .then((res) => res.json().then((json) => ({ ok: res.ok, status: res.status, json })).catch(() => ({ ok: res.ok, status: res.status, json: null })))
      .then(({ ok, status, json }) => {
        if (!ok) {
          let msg = (json && json.message) || ('GitHub 回應錯誤（狀態碼 ' + status + '）');
          if (status === 404) msg += '（請確認這個路徑真的存在、Repo 名稱有沒有打錯，以及 Token 是否已勾選這個 Repo 並開啟 Contents 權限）';
          throw new Error(msg);
        }
        if (!Array.isArray(json)) throw new Error('這不是一個資料夾');
        return json.map((item) => ({ name: item.name, path: item.path, type: item.type, download_url: item.download_url || '' }));
      });
  }

  /* ---------- 事件 ---------- */
  function subscribe(fn) {
    listeners.push(fn);
    return () => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  function emit() {
    listeners.forEach((fn) => {
      try { fn(state); } catch (e) { console.error(e); }
    });
  }

  function setSync(s, message) {
    syncStatus = { state: s, message, at: Date.now() };
    document.dispatchEvent(new CustomEvent('petsync', { detail: syncStatus }));
  }

  /* ---------- Google Sheets 介接 ---------- */
  function sheetCall(action, payload) {
    if (!config.sheetUrl) return Promise.reject(new Error('尚未設定 Google Sheets 網址'));
    const body = JSON.stringify(Object.assign({ action, classKey: config.classKey || 'default' }, payload || {}));
    // text/plain 可避開 Apps Script 的 CORS preflight
    return fetch(config.sheetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
      redirect: 'follow',
    })
      .then((res) => res.text())
      .then((txt) => {
        let json;
        try { json = JSON.parse(txt); } catch (e) { throw new Error('回應格式不正確，請確認 Apps Script 已部署為「網頁應用程式」'); }
        if (!json.ok) throw new Error(json.error || '雲端操作失敗');
        return json;
      });
  }

  function pullRemote(silent) {
    if (config.mode !== 'sheet') return Promise.resolve(state);
    if (!silent) setSync('syncing', '正在從 Google Sheets 讀取…');
    return sheetCall('load')
      .then((res) => {
        if (res.state && res.state.students) {
          const incoming = res.state;
          if (!state || (incoming.updatedAt || 0) >= (state.updatedAt || 0)) {
            state = migrate(incoming);
            persistLocal();
            emit();
          }
        } else if (state) {
          // 雲端還沒資料，把本機資料推上去
          return pushRemote(true);
        }
        setSync('ok', '已與 Google Sheets 同步 · ' + U.fmtClock(Date.now()));
        return state;
      })
      .catch((err) => {
        setSync('error', err.message);
        throw err;
      });
  }

  function pushRemote(silent) {
    if (config.mode !== 'sheet') return Promise.resolve(state);
    if (!silent) setSync('syncing', '正在儲存到 Google Sheets…');
    return sheetCall('save', { state })
      .then(() => {
        setSync('ok', '已儲存至 Google Sheets · ' + U.fmtClock(Date.now()));
        return state;
      })
      .catch((err) => {
        setSync('error', err.message + '（資料已暫存在這台裝置）');
        throw err;
      });
  }

  function startPolling() {
    stopPolling();
    if (config.mode !== 'sheet') return;
    const sec = Math.max(8, Number(config.pollSeconds) || 20);
    pollTimer = setInterval(() => {
      if (document.hidden) return;
      pullRemote(true).catch(() => {});
    }, sec * 1000);
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  /* ---------- 儲存 ---------- */
  function persistLocal() {
    lsSet(LS_STATE, JSON.stringify(state));
  }

  function scheduleRemoteSave() {
    if (config.mode !== 'sheet') return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => pushRemote(true).catch(() => {}), 900);
  }

  /* 內建寵物的識別碼後來從英文品種名（corgi／cat）統一改成跟老師的編號對齊（01dog／02cat），
     這裡把舊存檔裡用舊代號存的圖片、名稱、學生已選的寵物都搬到新代號底下，畫面顯示的名稱、
     圖片、等級、金幣都完全不受影響，老師不會感覺到任何東西被重置。 */
  const PET_ID_RENAMES = { corgi: '01dog', cat: '02cat' };
  function migratePetIdRenames(s) {
    if (!s || typeof s !== 'object') return;
    Object.keys(PET_ID_RENAMES).forEach((oldId) => {
      const newId = PET_ID_RENAMES[oldId];
      ['petImages', 'petPathImages', 'petPathNames'].forEach((key) => {
        const dict = s[key];
        if (dict && typeof dict === 'object' && Object.prototype.hasOwnProperty.call(dict, oldId)) {
          if (!Object.prototype.hasOwnProperty.call(dict, newId)) dict[newId] = dict[oldId];
          delete dict[oldId];
        }
      });
      if (Array.isArray(s.students)) {
        s.students.forEach((st) => { if (st && st.petId === oldId) st.petId = newId; });
      }
    });
  }

  function migrate(s) {
    migratePetIdRenames(s);
    const base = M.seedState();
    const out = Object.assign({}, base, s);
    out.classInfo = Object.assign({}, base.classInfo, s.classInfo || {});
    out.settings = Object.assign({}, base.settings, s.settings || {});
    out.students = (s.students || base.students).map((st) =>
      Object.assign({ cosmetics: [], badges: [], ruleCount: {}, redeemCount: 0, totalPoints: st.points || 0, petPathId: '', unlockedPaths: [], avatarStageIdx: null }, st)
    );
    ['groups', 'rules', 'shop', 'ledger', 'dailyTasks', 'redeems', 'groupTasks', 'toolbar', 'customPets', 'deletedPetIds'].forEach((k) => {
      if (!Array.isArray(out[k])) out[k] = base[k];
    });
    /* 舊的自訂工具列存檔可能是在「自訂點數」「今日任務」這兩個按鈕出現前存的，這裡補進去避免消失 */
    if (out.toolbar.length) {
      ['util:custom', 'util:tasks'].forEach((id) => {
        if (out.toolbar.indexOf(id) < 0) out.toolbar.push(id);
      });
    }
    /* 舊存檔可能是在「守護行動」四個快捷規則出現前存的，這裡補進去避免星野主線的關卡設定找不到對應規則 */
    ['warmth', 'initiative', 'courage', 'revise'].forEach((id) => {
      if (!out.rules.some((r) => r.id === id)) {
        const def = base.rules.find((r) => r.id === id);
        if (def) out.rules.push(Object.assign({}, def));
      }
    });
    if (!out.classMission) out.classMission = base.classMission;
    if (!out.attendance || typeof out.attendance !== 'object') out.attendance = {};
    migratePetStages(out, s, base);
    migratePetPaths(out, s, base);
    migratePetImageAssets(out);
    migratePetImageCrossRefs(out);
    out.petNames = Object.assign({}, base.petNames, s.petNames || {});
    migrateStoryline(out, s, base);
    return out;
  }

  /* 身分路線：舊存檔沒有 petPaths/petPathImages 就用預設補上；已經存在的路線名稱、已經上傳的圖片都保留，
     只補上「新增的寵物」或「新增的路線」還沒建立過的空陣列，避免程式讀到 undefined。 */
  const OLD_DEFAULT_PATH_NAMES = ['路線一', '路線二', '路線三']; // 這功能剛推出時用過的佔位名稱，之後統一升級成正式名稱一次
  /* 職業名稱表定案前的存檔（updatedAt 早於這個時間點）都強制套用最新表一次；這個時間點固定寫死在程式碼裡，
     不會隨每次載入變動，所以只會在「第一次讀到這個新版程式碼」時生效一次，之後老師自己改的名稱就穩定了。 */
  const PET_PATH_NAMES_FORCE_UPGRADE_BEFORE = new Date('2026-09-28T00:00:00+08:00').getTime();
  function migratePetPaths(out, s, base) {
    out.petPaths = Array.isArray(s.petPaths) && s.petPaths.length ? s.petPaths : base.petPaths;
    /* 還停在最早期佔位名稱、老師還沒自己改過的路線，順便升級成新的正式名稱（只比對還沒被改過的） */
    out.petPaths = out.petPaths.map((p) => {
      if (OLD_DEFAULT_PATH_NAMES.indexOf(p.name) < 0) return p;
      const upgraded = base.petPaths.find((bp) => bp.id === p.id);
      return upgraded ? Object.assign({}, p, { name: upgraded.name }) : p;
    });
    const raw = (s && s.petPathImages) || {};
    const pathIds = out.petPaths.map((p) => p.id);
    const stageLen = (out.petStageLevels || base.petStageLevels).length;
    const result = {};
    const petIds = Object.keys(Object.assign({}, base.petImages, out.petImages || {}));
    petIds.forEach((petId) => {
      const rawForPet = raw[petId] || {};
      result[petId] = {};
      pathIds.forEach((pid) => {
        const existing = rawForPet[pid];
        result[petId][pid] = Array.isArray(existing) && existing.length === stageLen ? existing : new Array(stageLen).fill('');
      });
    });
    out.petPathImages = result;
    out.petPathNames = (s && s.petPathNames && typeof s.petPathNames === 'object') ? s.petPathNames : {};
    /* 內建寵物如果還沒設定過專屬職業名稱，補上預先想好的版本；老師已經自己改過的（不管改哪一條）完全不動 */
    Object.keys(M.DEFAULT_PET_PATH_NAMES || {}).forEach((petId) => {
      if (!out.petPathNames[petId]) out.petPathNames[petId] = Object.assign({}, M.DEFAULT_PET_PATH_NAMES[petId]);
    });
    /* 職業名稱表這幾天改版好幾次，版本號沒跟上的帳號（多半是我自己剛才自動補上、老師還來不及看到就被我改版的）
       強制升級成最新版一次；升級後把版本號寫回去，之後老師自己改過的名稱就不會再被蓋掉了。 */
    if ((s.updatedAt || 0) < PET_PATH_NAMES_FORCE_UPGRADE_BEFORE) {
      Object.keys(M.DEFAULT_PET_PATH_NAMES || {}).forEach((petId) => {
        out.petPathNames[petId] = Object.assign({}, M.DEFAULT_PET_PATH_NAMES[petId]);
      });
    }
  }

  /* 老師已經整理好的寵物真實照片（目前只有柯基）：舊存檔裡對應的欄位如果還是空字串（老師還沒自己
     上傳過圖片），自動補上；老師已經透過「管理圖片」自己上傳過的欄位完全不動，不會被蓋掉。 */
  function migratePetImageAssets(out) {
    const assets = (M && M.DEFAULT_PET_IMAGE_ASSETS) || {};
    Object.keys(assets).forEach((petId) => {
      const preset = assets[petId];
      if (Array.isArray(out.petImages[petId]) && Array.isArray(preset.shared)) {
        out.petImages[petId] = out.petImages[petId].map((v, i) => v || preset.shared[i] || '');
      }
      if (out.petPathImages[petId]) {
        Object.keys(out.petPathImages[petId]).forEach((pid) => {
          const defArr = preset[pid];
          if (Array.isArray(defArr) && Array.isArray(out.petPathImages[petId][pid])) {
            out.petPathImages[petId][pid] = out.petPathImages[petId][pid].map((v, i) => v || defArr[i] || '');
          }
        });
      }
    });
  }

  /* 「管理圖片」的「選擇」是共用的 GitHub 檔案總管，01dog／02cat 兩個資料夾在裡面緊鄰在一起，
     老師偶爾會點錯資料夾，把別隻寵物的圖片網址填到這隻寵物的欄位。這裡偵測「網址明顯指到別隻
     內建寵物的資料夾」這種不可能是故意的狀況，自動換回這隻寵物自己的預設圖；老師之後仍可以用
     「選擇」或「上傳」重新換成想要的圖片。 */
  function migratePetImageCrossRefs(out) {
    const assets = (M && M.DEFAULT_PET_IMAGE_ASSETS) || {};
    const ids = Object.keys(assets);
    ids.forEach((petId) => {
      const preset = assets[petId];
      const otherIds = ids.filter((id) => id !== petId);
      const isWrong = (url) => !!url && otherIds.some((oid) => url.indexOf('/' + oid + '/') >= 0);
      if (Array.isArray(out.petImages[petId]) && Array.isArray(preset.shared)) {
        out.petImages[petId] = out.petImages[petId].map((v, i) => (isWrong(v) ? (preset.shared[i] || '') : v));
      }
      if (out.petPathImages[petId]) {
        Object.keys(out.petPathImages[petId]).forEach((pid) => {
          const defArr = preset[pid];
          if (Array.isArray(out.petPathImages[petId][pid])) {
            out.petPathImages[petId][pid] = out.petPathImages[petId][pid]
              .map((v, i) => (isWrong(v) ? ((defArr && defArr[i]) || '') : v));
          }
        });
      }
    });
  }

  /* 星野主線：定義值（名稱／門檻／任務文字…）先套用預設，再用舊資料裡「已經存在」的欄位覆蓋回去，
     這樣舊帳號第一次載入會自動補上這個功能，之後教師編輯過的文字或已經達成的進度也不會被蓋掉。 */
  function migrateStoryline(out, s, base) {
    const raw = (s && s.storyline) || {};
    const rawChapters = Array.isArray(raw.chapters) ? raw.chapters : [];
    out.storyline = {
      active: !!raw.active,
      activatedAt: raw.activatedAt || 0,
      title: raw.title || base.storyline.title,
      chapters: base.storyline.chapters.map((defCh) => {
        const existing = rawChapters.find((c) => c && c.id === defCh.id);
        return existing ? Object.assign({}, defCh, existing) : Object.assign({}, defCh);
      }),
    };
  }

  /* 本篇章星光＝啟用後（ts >= activatedAt）、尚未撤銷、點數為正的加點紀錄總和。
     這是每次即時從點數紀錄重新算出來的，不是另外存一個累加數字：
     補登、編輯、撤銷、重新整理或重新同步都會自動算對，不會重複計算或算錯。 */
  function storylineStars(s) {
    const st = s.storyline;
    if (!st || !st.active) return 0;
    return s.ledger.reduce((sum, e) => {
      if (e.undone || (e.points || 0) <= 0) return sum;
      if (e.ts < st.activatedAt) return sum;
      return sum + e.points * e.studentIds.length;
    }, 0);
  }

  function storylineWeeklyGain(s) {
    const st = s.storyline;
    if (!st || !st.active) return 0;
    const from = Math.max(st.activatedAt, weekStartTs());
    return s.ledger.reduce((sum, e) => {
      if (e.undone || (e.points || 0) <= 0) return sum;
      if (e.ts < from) return sum;
      return sum + e.points * e.studentIds.length;
    }, 0);
  }

  /* 每一關「守護行動」的計算起點：第一關從啟用日算起，之後每一關從「前一關通關的時間」算起，
     這樣同一個規則被好幾關重複用到時，不會把前一關已經算過的次數/人數也算進這一關。 */
  function storylineChapterWindowStart(s, chapterId) {
    const st = s.storyline;
    const chapters = (st && st.chapters) || [];
    const idx = chapters.findIndex((c) => c.id === chapterId);
    if (!st || idx <= 0) return st ? st.activatedAt : 0;
    const prev = chapters[idx - 1];
    return (prev && prev.cleared && prev.clearedAt) ? Math.max(st.activatedAt, prev.clearedAt) : st.activatedAt;
  }

  function storylineChapterActionEntries(s, chapterId) {
    const st = s.storyline;
    const chapters = (st && st.chapters) || [];
    const idx = chapters.findIndex((x) => x.id === chapterId);
    const c = chapters[idx];
    if (!st || !st.active || !c || !(c.actionRuleIds || []).length) return [];
    if (idx > storylineCurrentIndex(s)) return []; // 還沒輪到的關卡，不該顯示任何進度（不然會誤把前面關卡期間的紀錄當成這關已經完成）
    const ids = c.actionRuleIds;
    const from = storylineChapterWindowStart(s, chapterId);
    const to = (c.cleared && c.clearedAt) ? c.clearedAt : Infinity; // 已通關的關卡，進度會停在通關那一刻，不會被後面關卡的同一個規則繼續加進來
    return s.ledger.filter((e) => !e.undone && e.ts >= from && e.ts <= to && ids.indexOf(e.ruleId) >= 0);
  }

  /* 某一關「守護行動」的即時進度：符合 actionRuleIds 的加點次數，以及有出現過的不同學生數。
     跟 storylineStars 一樣是每次即時算，不是另外存累加數字，補登/撤銷都會自動對。 */
  function storylineChapterActionProgress(s, chapterId) {
    const seen = new Set();
    let count = 0;
    storylineChapterActionEntries(s, chapterId).forEach((e) => {
      count += e.studentIds.length;
      e.studentIds.forEach((id) => seen.add(id));
    });
    return { count, participants: seen.size };
  }

  /* 這一關「已經參與過」的學生 id 集合，給教師端的全班參與狀況畫面用 */
  function storylineChapterParticipantIds(s, chapterId) {
    const seen = new Set();
    storylineChapterActionEntries(s, chapterId).forEach((e) => e.studentIds.forEach((id) => seen.add(id)));
    return seen;
  }

  /* 每個學生在這一關被記錄了幾次守護行動、總共拿到多少點數，給全班參與狀況畫面顯示用 */
  function storylineChapterParticipantStats(s, chapterId) {
    const stats = {};
    storylineChapterActionEntries(s, chapterId).forEach((e) => {
      e.studentIds.forEach((id) => {
        const cur = stats[id] || { count: 0, points: 0 };
        cur.count += 1;
        cur.points += (e.points || 0);
        stats[id] = cur;
      });
    });
    return stats;
  }

  /* 目前正在進行的關卡索引；全部過關則回傳 chapters.length */
  function storylineCurrentIndex(s) {
    const chapters = (s.storyline && s.storyline.chapters) || [];
    for (let i = 0; i < chapters.length; i++) {
      if (!chapters[i].cleared) return i;
    }
    return chapters.length;
  }

  /* 每次 commit 都會呼叫一次：檢查目前這關是不是「星光達標」且「共同任務已確認」，
     兩個條件同時成立才算過關並發獎（只會由 false 變 true，不會自動復原，
     避免事後修正點數紀錄時被誤判為「退關」）。 */
  function checkStorylineProgress(s) {
    const st = s.storyline;
    if (!st || !st.active) return;
    const idx = storylineCurrentIndex(s);
    const c = st.chapters[idx];
    if (!c || c.cleared) return;
    const stars = storylineStars(s);
    if (stars >= c.threshold && c.taskDone) {
      c.cleared = true;
      c.clearedAt = Date.now();
      c.rewardGranted = true;
      c.rewardGrantedAt = Date.now();
      // 過關禮物：這一關有參與守護行動的學生，每人免費送一條還沒解鎖過的身分路線
      // （已經三條都解鎖過的人就沒有可以送的，跳過即可）
      const paths = s.petPaths || [];
      storylineChapterParticipantIds(s, c.id).forEach((sid) => {
        const t = s.students.find((x) => x.id === sid);
        if (!t) return;
        t.unlockedPaths = t.unlockedPaths || [];
        const nextPath = paths.find((p) => t.unlockedPaths.indexOf(p.id) < 0);
        if (nextPath) {
          t.unlockedPaths.push(nextPath.id);
          if (!t.petPathId) t.petPathId = nextPath.id;
        }
      });
    }
  }

  /* ---------- 星野主線：教師管理動作 ---------- */
  function activateStoryline(activatedAt) {
    commit((s) => {
      s.storyline = s.storyline || M.seedStoryline();
      s.storyline.active = true;
      s.storyline.activatedAt = activatedAt || Date.now();
    });
  }

  function updateChapterConfig(chapterId, patch) {
    commit((s) => {
      const c = (s.storyline.chapters || []).find((x) => x.id === chapterId);
      if (!c) return;
      const p = patch || {};
      ['name', 'week', 'threshold', 'taskTitle', 'rewardTitle', 'rewardEmoji', 'intro', 'clearStory', 'bg', 'lighthouseImg', 'actionRuleIds', 'actionTarget', 'participantTarget'].forEach((k) => {
        if (p[k] == null) return;
        c[k] = (k === 'week' || k === 'threshold' || k === 'actionTarget' || k === 'participantTarget') ? (Number(p[k]) || 0) : p[k];
      });
    }, { silent: true });
  }

  function setChapterTaskDone(chapterId, done, note) {
    commit((s) => {
      const c = (s.storyline.chapters || []).find((x) => x.id === chapterId);
      if (!c || c.cleared) return; // 已通關的關卡要用 revertChapterClear 明確撤回，不能直接改任務狀態
      c.taskDone = !!done;
      c.taskDoneAt = done ? Date.now() : 0;
      if (note != null) c.taskNote = note;
    });
  }

  /* 明確撤回「已通關」：同時收回獎勵標記與任務完成狀態，避免留下「已發獎但任務未完成」這種不一致狀態 */
  function revertChapterClear(chapterId) {
    commit((s) => {
      const c = (s.storyline.chapters || []).find((x) => x.id === chapterId);
      if (!c || !c.cleared) return;
      c.cleared = false;
      c.clearedAt = 0;
      c.rewardGranted = false;
      c.rewardGrantedAt = 0;
      c.taskDone = false;
      c.taskDoneAt = 0;
    });
  }

  /* 寵物造型圖片以前是「每隻寵物各自存一份等級門檻＋圖片」，現在改成「全班共用一份等級門檻，
     每隻寵物只存自己在各階段的圖片（用陣列位置對應）」。這裡把舊格式的資料原地轉換過來，
     盡量不要遺失老師已經設定好的圖片。 */
  function migratePetStages(out, s, base) {
    const raw = s.petImages || {};
    const isOldFormat = Object.keys(raw).some((id) => {
      const v = raw[id];
      return Array.isArray(v) && v.length > 0 && v[0] && typeof v[0] === 'object';
    });

    if (!isOldFormat) {
      out.petStageLevels = (s.petStageLevels && s.petStageLevels.length ? s.petStageLevels : base.petStageLevels)
        .map((t) => ({ minLevel: t.minLevel, name: t.name || '' }));
      out.petImages = Object.assign({}, base.petImages, raw);
      const len = out.petStageLevels.length;
      Object.keys(out.petImages).forEach((id) => {
        const arr = (out.petImages[id] || []).slice();
        while (arr.length < len) arr.push('');
        out.petImages[id] = arr;
      });
      return;
    }

    // 舊格式：先把所有寵物用過的等級門檻合併成一份共用清單
    const levelNames = {};
    base.petStageLevels.forEach((t) => { levelNames[t.minLevel] = t.name; });
    Object.keys(raw).forEach((id) => {
      (raw[id] || []).forEach((stg) => {
        const lv = (stg && stg.minLevel) || 1;
        if (!levelNames[lv] && stg && stg.name) levelNames[lv] = stg.name;
        else if (!(lv in levelNames)) levelNames[lv] = (stg && stg.name) || '';
      });
    });
    const levels = Object.keys(levelNames).map(Number).sort((a, b) => a - b);
    out.petStageLevels = levels.map((lv) => ({ minLevel: lv, name: levelNames[lv] || '' }));

    const newImages = {};
    Object.keys(raw).forEach((id) => {
      const arr = new Array(levels.length).fill('');
      (raw[id] || []).forEach((stg) => {
        const idx = levels.indexOf((stg && stg.minLevel) || 1);
        if (idx >= 0 && stg && stg.img) arr[idx] = stg.img;
      });
      newImages[id] = arr;
    });
    out.petImages = Object.assign({}, base.petImages, newImages);
  }

  /* ---------- 初始化 ---------- */
  function init() {
    loadConfig();
    const raw = lsGet(LS_STATE);
    if (raw) {
      try { state = migrate(JSON.parse(raw)); } catch (e) { state = M.seedState(); }
    } else {
      state = M.seedState();
      persistLocal();
    }
    if (config.mode === 'sheet' && config.sheetUrl) {
      startPolling();
      return pullRemote(true).catch(() => state).then(() => state);
    }
    setSync('idle', '本機模式（資料存在這台裝置）');
    return Promise.resolve(state);
  }

  /* 所有修改都走這裡：改記憶體 → 存本機 → 排程上傳 → 通知畫面 */
  function commit(mutator, opts) {
    const o = opts || {};
    mutator(state);
    if (state.storyline) checkStorylineProgress(state);
    state.updatedAt = Date.now();
    persistLocal();
    if (o.sync !== false) scheduleRemoteSave();
    if (o.silent !== true) emit();
    return state;
  }

  /* ---------- 查詢 ---------- */
  const get = () => state;
  const getConfig = () => config;
  const getSync = () => syncStatus;
  const student = (id) => state.students.find((s) => s.id === id);
  const group = (id) => state.groups.find((g) => g.id === id);
  const rule = (id) => state.rules.find((r) => r.id === id);

  function activeLedger() {
    return state.ledger.filter((e) => !e.undone);
  }

  function todayPoints() {
    return activeLedger()
      .filter((e) => U.isToday(e.ts))
      .reduce((sum, e) => sum + (e.points > 0 ? e.points * e.studentIds.length : 0), 0);
  }

  function yesterdayPoints() {
    const y = U.todayKey(U.daysAgo(1));
    return activeLedger()
      .filter((e) => U.todayKey(e.ts) === y)
      .reduce((sum, e) => sum + (e.points > 0 ? e.points * e.studentIds.length : 0), 0);
  }

  function weekStartTs() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const wd = (d.getDay() + 6) % 7; // 週一為起點
    return d.getTime() - wd * 86400000;
  }

  function weeklyGain(studentId) {
    const from = weekStartTs();
    return activeLedger()
      .filter((e) => e.ts >= from && e.studentIds.indexOf(studentId) >= 0)
      .reduce((sum, e) => sum + e.points, 0);
  }

  function groupPoints(groupId) {
    return state.students
      .filter((s) => s.groupId === groupId)
      .reduce((sum, s) => sum + s.points, 0);
  }

  /* ---------- 動作：加/扣點 ---------- */
  function applyDelta(st, d) {
    st.points = Math.max(0, (st.points || 0) + (d.points || 0));
    if ((d.points || 0) > 0) st.totalPoints = (st.totalPoints || 0) + d.points;
    st.coins = Math.max(0, (st.coins || 0) + (d.coins || 0));
    st.xp = Math.max(0, (st.xp || 0) + (d.xp || 0));
  }

  function bumpStreak(st, ts) {
    const last = st.lastActiveAt || 0;
    const lastKey = U.todayKey(last);
    const nowKey = U.todayKey(ts);
    if (lastKey === nowKey) return;
    const yKey = U.todayKey(ts - 86400000);
    st.streak = lastKey === yKey ? (st.streak || 0) + 1 : 1;
    st.lastActiveAt = ts;
  }

  function refreshBadges(st) {
    st.badges = st.badges || [];
    M.BADGES.forEach((b) => {
      try {
        if (b.test(st) && st.badges.indexOf(b.id) < 0) st.badges.push(b.id);
      } catch (e) { /* 條件不成立就略過 */ }
    });
  }

  /* 回傳因為這次加點而升級的學生清單 */
  function award(studentIds, ruleObj, note, by) {
    const ids = Array.isArray(studentIds) ? studentIds.slice() : [studentIds];
    const ts = Date.now();
    const levelUps = [];
    commit((s) => {
      ids.forEach((id) => {
        const st = s.students.find((x) => x.id === id);
        if (!st) return;
        const before = M.levelFromXp(st.xp).level;
        applyDelta(st, ruleObj);
        if (ruleObj.points > 0) {
          bumpStreak(st, ts);
          st.ruleCount = st.ruleCount || {};
          if (ruleObj.id) st.ruleCount[ruleObj.id] = (st.ruleCount[ruleObj.id] || 0) + 1;
        }
        st.petLevel = M.levelFromXp(st.xp).level;
        refreshBadges(st);
        if (st.petLevel > before) levelUps.push({ id: st.id, name: st.name, level: st.petLevel });
      });

      if (ruleObj.points > 0) {
        s.classInfo.classStars = (s.classInfo.classStars || 0) + ruleObj.points * ids.length;
        if (s.classMission) {
          s.classMission.progress = Math.min(
            s.classMission.target,
            (s.classMission.progress || 0) + ruleObj.points * ids.length
          );
        }
      }

      s.ledger.unshift({
        id: U.uid('lg'),
        ts,
        studentIds: ids,
        ruleId: ruleObj.id || '',
        label: ruleObj.label || (ruleObj.points >= 0 ? '加點' : '扣點'),
        points: ruleObj.points || 0,
        xp: ruleObj.xp || 0,
        coins: ruleObj.coins || 0,
        note: note || '',
        by: by || s.classInfo.teacher,
        undone: false,
      });
      if (s.ledger.length > 2000) s.ledger.length = 2000;
    });
    return levelUps;
  }

  /* 撤銷一筆紀錄（把點數、XP、金幣回沖） */
  function undoEntry(entryId) {
    commit((s) => {
      const e = s.ledger.find((x) => x.id === entryId);
      if (!e || e.undone) return;
      e.undone = true;
      e.undoneAt = Date.now();
      e.studentIds.forEach((id) => {
        const st = s.students.find((x) => x.id === id);
        if (!st) return;
        applyDelta(st, { points: -(e.points || 0), coins: -(e.coins || 0), xp: -(e.xp || 0) });
        if ((e.points || 0) > 0) {
          st.totalPoints = Math.max(0, (st.totalPoints || 0) - e.points);
          if (e.ruleId && st.ruleCount && st.ruleCount[e.ruleId]) st.ruleCount[e.ruleId] -= 1;
        }
        st.petLevel = M.levelFromXp(st.xp).level;
      });
      if ((e.points || 0) > 0) {
        s.classInfo.classStars = Math.max(0, (s.classInfo.classStars || 0) - e.points * e.studentIds.length);
        if (s.classMission) {
          s.classMission.progress = Math.max(0, (s.classMission.progress || 0) - e.points * e.studentIds.length);
        }
      }
    });
  }

  /* 編輯一筆既有紀錄（自動用差額補上或收回點數／XP／金幣） */
  function editEntry(entryId, patch) {
    commit((s) => {
      const e = s.ledger.find((x) => x.id === entryId);
      if (!e || e.undone) return;
      const p = patch || {};
      const oldPoints = e.points || 0;
      const newPoints = p.points != null ? Number(p.points) || 0 : oldPoints;
      const dPoints = newPoints - oldPoints;
      const dXp = (p.xp != null ? Number(p.xp) || 0 : (e.xp || 0)) - (e.xp || 0);
      const dCoins = (p.coins != null ? Number(p.coins) || 0 : (e.coins || 0)) - (e.coins || 0);

      e.studentIds.forEach((id) => {
        const st = s.students.find((x) => x.id === id);
        if (!st) return;
        applyDelta(st, { points: dPoints, xp: dXp, coins: dCoins });
        if (oldPoints > 0 && newPoints <= 0) {
          st.totalPoints = Math.max(0, (st.totalPoints || 0) - oldPoints);
          if (e.ruleId && st.ruleCount && st.ruleCount[e.ruleId]) st.ruleCount[e.ruleId] -= 1;
        } else if (oldPoints <= 0 && newPoints > 0) {
          st.totalPoints = (st.totalPoints || 0) + newPoints;
          if (e.ruleId) { st.ruleCount = st.ruleCount || {}; st.ruleCount[e.ruleId] = (st.ruleCount[e.ruleId] || 0) + 1; }
        } else if (oldPoints > 0 && newPoints > 0 && dPoints !== 0) {
          st.totalPoints = Math.max(0, (st.totalPoints || 0) + dPoints);
        }
        st.petLevel = M.levelFromXp(st.xp).level;
        refreshBadges(st);
      });

      const oldClass = oldPoints > 0 ? oldPoints * e.studentIds.length : 0;
      const newClass = newPoints > 0 ? newPoints * e.studentIds.length : 0;
      const dClass = newClass - oldClass;
      if (dClass !== 0) {
        s.classInfo.classStars = Math.max(0, (s.classInfo.classStars || 0) + dClass);
        if (s.classMission) {
          s.classMission.progress = U.clamp((s.classMission.progress || 0) + dClass, 0, s.classMission.target);
        }
      }

      if (p.label != null) e.label = p.label;
      if (p.note != null) e.note = p.note;
      e.points = newPoints;
      e.xp = p.xp != null ? Number(p.xp) || 0 : (e.xp || 0);
      e.coins = p.coins != null ? Number(p.coins) || 0 : (e.coins || 0);
      e.editedAt = Date.now();
    });
  }

  /* ---------- 出席 ---------- */
  function attendanceOf(dateKey) {
    return (state.attendance || {})[dateKey || U.todayKey()] || {};
  }

  function isAbsent(studentId, dateKey) {
    return attendanceOf(dateKey)[studentId] === 'absent';
  }

  function setAttendance(studentId, status, dateKey) {
    const day = dateKey || U.todayKey();
    commit((s) => {
      s.attendance = s.attendance || {};
      s.attendance[day] = s.attendance[day] || {};
      if (status) s.attendance[day][studentId] = status;
      else delete s.attendance[day][studentId];
    });
  }

  function setAllAttendance(studentIds, status, dateKey) {
    const day = dateKey || U.todayKey();
    commit((s) => {
      s.attendance = s.attendance || {};
      s.attendance[day] = s.attendance[day] || {};
      studentIds.forEach((id) => {
        if (status) s.attendance[day][id] = status;
        else delete s.attendance[day][id];
      });
    });
  }

  /* ---------- 學生端動作 ---------- */
  function feedPet(studentId, foodId) {
    const food = M.FOODS.find((f) => f.id === foodId);
    const st = student(studentId);
    if (!food || !st) return { ok: false, msg: '找不到食物' };
    if ((st.coins || 0) < food.cost) return { ok: false, msg: '金幣不夠，再完成幾個約定吧！' };
    const before = M.levelFromXp(st.xp).level;
    commit((s) => {
      const t = s.students.find((x) => x.id === studentId);
      t.coins -= food.cost;
      t.xp += food.xp;
      t.petLevel = M.levelFromXp(t.xp).level;
      refreshBadges(t);
      s.ledger.unshift({
        id: U.uid('lg'), ts: Date.now(), studentIds: [studentId], ruleId: 'feed',
        label: '餵食 ' + food.name, points: 0, xp: food.xp, coins: -food.cost,
        note: '', by: t.name, undone: false,
      });
    });
    const after = M.levelFromXp(student(studentId).xp).level;
    return { ok: true, levelUp: after > before, level: after, food };
  }

  function unlockCosmetic(studentId, cosId) {
    const cos = M.COSMETICS.find((c) => c.id === cosId);
    const st = student(studentId);
    if (!cos || !st) return { ok: false, msg: '找不到造型' };
    if ((st.cosmetics || []).indexOf(cosId) >= 0) return { ok: false, msg: '已經擁有了' };
    const lv = M.levelFromXp(st.xp).level;
    if (lv < cos.unlockLevel) return { ok: false, msg: '寵物要 Lv.' + cos.unlockLevel + ' 才能解鎖' };
    if ((st.coins || 0) < cos.cost) return { ok: false, msg: '還差 ' + (cos.cost - st.coins) + ' 金幣' };
    commit((s) => {
      const t = s.students.find((x) => x.id === studentId);
      t.coins -= cos.cost;
      t.cosmetics = t.cosmetics || [];
      t.cosmetics.push(cosId);
      t.equipped = cosId;
      refreshBadges(t);
      s.ledger.unshift({
        id: U.uid('lg'), ts: Date.now(), studentIds: [studentId], ruleId: 'cosmetic',
        label: '解鎖造型 ' + cos.name, points: 0, xp: 0, coins: -cos.cost,
        note: '', by: t.name, undone: false,
      });
    });
    return { ok: true, cos };
  }

  function equipCosmetic(studentId, cosId) {
    commit((s) => {
      const t = s.students.find((x) => x.id === studentId);
      if (!t) return;
      t.equipped = t.equipped === cosId ? '' : cosId;
    });
  }

  function choosePet(studentId, petId, petName) {
    commit((s) => {
      const t = s.students.find((x) => x.id === studentId);
      if (!t) return;
      t.petId = petId;
      if (typeof petName === 'string') t.petName = petName.slice(0, 10);
    });
  }

  /* 選擇／切換身分路線：已經解鎖過的路線可以隨時免費切換過去，完全不動等級、XP、星光。
     還沒解鎖過的路線第一次要花金幣解鎖（金額看 settings.pathUnlockCost，老師可調整），
     金幣不夠就解鎖失敗；老師也可以用 giftPetPath 直接免費贈送，或透過星野主線關卡獎勵取得。 */
  function choosePetPath(studentId, pathId) {
    const t = student(studentId);
    if (!t) return { ok: false, msg: '找不到學生' };
    if (!(state.petPaths || []).some((p) => p.id === pathId)) return { ok: false, msg: '找不到這條路線' };
    const already = (t.unlockedPaths || []).indexOf(pathId) >= 0;
    if (already) {
      commit((s) => {
        const x = s.students.find((y) => y.id === studentId);
        if (x) x.petPathId = pathId;
      });
      return { ok: true, unlocked: false };
    }
    const isFirstEver = (t.unlockedPaths || []).length === 0; // V4 第一次選路線是免費的起點，不用花錢
    const cost = isFirstEver ? 0 : Math.max(0, (state.settings || {}).pathUnlockCost || 0);
    if ((t.coins || 0) < cost) return { ok: false, msg: '還差 ' + (cost - (t.coins || 0)) + ' 金幣', needCoins: cost - (t.coins || 0) };
    commit((s) => {
      const x = s.students.find((y) => y.id === studentId);
      if (!x) return;
      x.coins -= cost;
      x.petPathId = pathId;
      x.unlockedPaths = x.unlockedPaths || [];
      if (x.unlockedPaths.indexOf(pathId) < 0) x.unlockedPaths.push(pathId);
      if (cost > 0) {
        s.ledger.unshift({
          id: U.uid('lg'), ts: Date.now(), studentIds: [studentId], ruleId: 'pathUnlock',
          label: '解鎖身分路線 ' + M.petPathName(M.petById(x.petId), pathId), points: 0, xp: 0, coins: -cost,
          note: '', by: x.name, undone: false,
        });
      }
    });
    return { ok: true, unlocked: true };
  }

  /* 老師直接免費贈送一條路線給某個學生（例如口頭鼓勵、活動獎勵），不扣金幣，
     只加進 unlockedPaths，不強制切換成目前顯示的路線，讓學生自己決定要不要換上。 */
  function giftPetPath(studentId, pathId) {
    commit((s) => {
      const t = s.students.find((x) => x.id === studentId);
      if (!t) return;
      if (!(s.petPaths || []).some((p) => p.id === pathId)) return;
      t.unlockedPaths = t.unlockedPaths || [];
      if (t.unlockedPaths.indexOf(pathId) < 0) t.unlockedPaths.push(pathId);
      if (!t.petPathId) t.petPathId = pathId;
    });
  }

  /* 「造型收藏」讓學生自由穿回任何一個已經達到過的造型階段，純粹是外觀選擇，
     不會動到等級、XP、星光或畫面上顯示的階段名稱——那些一律照真實等級計算。
     avatarStageIdx 存的是 petStageLevels 的陣列索引；空著（null）就是照目前等級自動顯示。 */
  function avatarDisplayLevel(st) {
    const real = M.levelFromXp((st && st.xp) || 0).level;
    if (!st || st.avatarStageIdx === null || st.avatarStageIdx === undefined) return real;
    const stage = (state.petStageLevels || [])[st.avatarStageIdx];
    if (!stage || (stage.minLevel || 1) > real) return real; // 還沒達到那一階就不生效，安全退回目前等級
    return stage.minLevel || 1;
  }

  function setAvatarStage(studentId, idx) {
    commit((s) => {
      const t = s.students.find((x) => x.id === studentId);
      if (!t) return;
      if (idx === null) { t.avatarStageIdx = null; return; }
      const real = M.levelFromXp(t.xp || 0).level;
      const stage = (s.petStageLevels || [])[idx];
      if (stage && (stage.minLevel || 1) <= real) t.avatarStageIdx = idx;
    }, { silent: true });
  }

  /* 幫「某一隻寵物」的某條路線取專屬名稱（因為每隻寵物的發展不盡相同，不一定要跟全班共用的預設名稱一樣）；
     名稱留空就是清掉這隻寵物的自訂名稱，改回顯示全班共用的預設名稱。 */
  function renamePetPath(petId, pathId, name) {
    commit((s) => {
      s.petPathNames = s.petPathNames || {};
      const nm = (name || '').trim();
      if (nm) {
        s.petPathNames[petId] = s.petPathNames[petId] || {};
        s.petPathNames[petId][pathId] = nm;
      } else if (s.petPathNames[petId]) {
        delete s.petPathNames[petId][pathId];
      }
    }, { silent: true });
  }

  function redeem(studentId, itemId) {
    const item = state.shop.find((i) => i.id === itemId);
    const st = student(studentId);
    if (!item || !st) return { ok: false, msg: '找不到商品' };
    if (item.stock <= 0) return { ok: false, msg: '這項已經兌換完了' };
    if ((st.points || 0) < item.cost) return { ok: false, msg: '還差 ' + (item.cost - st.points) + ' 點' };
    commit((s) => {
      const t = s.students.find((x) => x.id === studentId);
      const it = s.shop.find((i) => i.id === itemId);
      t.points -= it.cost;
      t.redeemCount = (t.redeemCount || 0) + 1;
      it.stock -= 1;
      refreshBadges(t);
      s.redeems.unshift({
        id: U.uid('rd'), ts: Date.now(), studentId, itemId, itemName: it.name,
        cost: it.cost, status: 'pending',
      });
      s.ledger.unshift({
        id: U.uid('lg'), ts: Date.now(), studentIds: [studentId], ruleId: 'redeem',
        label: '兌換 ' + it.name, points: -it.cost, xp: 0, coins: 0, note: '', by: t.name, undone: false,
      });
    });
    return { ok: true, item };
  }

  /* ---------- 匯出／匯入／重設 ---------- */
  function exportJson() {
    return JSON.stringify(state, null, 2);
  }

  function importJson(text) {
    const obj = JSON.parse(text);
    if (!obj || !Array.isArray(obj.students)) throw new Error('檔案格式不正確');
    commit((s) => {
      Object.keys(s).forEach((k) => delete s[k]);
      Object.assign(s, migrate(obj));
    });
    return state;
  }

  function resetAll(keepRoster) {
    const roster = keepRoster
      ? state.students.map((s) => ({ id: s.id, no: s.no, name: s.name, groupId: s.groupId, petId: s.petId }))
      : null;
    commit((s) => {
      const fresh = M.seedState();
      Object.keys(s).forEach((k) => delete s[k]);
      Object.assign(s, fresh);
      if (roster) {
        s.students = roster.map((r, i) =>
          Object.assign(fresh.students[i] || {}, r, {
            xp: 0, points: 0, coins: 0, streak: 0, totalPoints: 0,
            cosmetics: [], equipped: '', badges: [], ruleCount: {}, redeemCount: 0,
          })
        );
        s.ledger = [];
        s.classInfo.classStars = 0;
        s.classInfo.classStreak = 0;
        s.classMission.progress = 0;
      }
    });
  }

  /* ---------- 雲端模式切換 ---------- */
  function connectSheet(url, classKey) {
    saveConfig({ mode: 'sheet', sheetUrl: url.trim(), classKey: (classKey || 'default').trim() });
    return sheetCall('load')
      .then((res) => {
        if (res.state && res.state.students) {
          state = migrate(res.state);
          persistLocal();
          emit();
        } else {
          return pushRemote(true);
        }
      })
      .then(() => {
        startPolling();
        setSync('ok', '已連線 Google Sheets');
        return true;
      })
      .catch((err) => {
        saveConfig({ mode: 'local' });
        stopPolling();
        setSync('error', err.message);
        throw err;
      });
  }

  function useLocal() {
    saveConfig({ mode: 'local' });
    stopPolling();
    setSync('idle', '本機模式（資料存在這台裝置）');
    emit();
  }

  global.PetStore = {
    init, subscribe, commit, get, getConfig, saveConfig, getSync,
    student, group, rule, activeLedger, todayPoints, yesterdayPoints, weeklyGain, groupPoints, weekStartTs,
    award, undoEntry, editEntry, feedPet, unlockCosmetic, equipCosmetic, choosePet, choosePetPath, giftPetPath, renamePetPath, redeem,
    avatarDisplayLevel, setAvatarStage,
    attendanceOf, isAbsent, setAttendance, setAllAttendance,
    getGithubConfig, saveGithubConfig, githubUploadImage, githubListFiles,
    exportJson, importJson, resetAll,
    connectSheet, useLocal, pullRemote, pushRemote, sheetCall,
    storylineStars, storylineWeeklyGain, storylineCurrentIndex, storylineChapterActionProgress,
    storylineChapterParticipantIds, storylineChapterParticipantStats,
    activateStoryline, updateChapterConfig, setChapterTaskDone, revertChapterClear,
  };
})(window);
