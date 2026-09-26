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

  function migrate(s) {
    const base = M.seedState();
    const out = Object.assign({}, base, s);
    out.classInfo = Object.assign({}, base.classInfo, s.classInfo || {});
    out.settings = Object.assign({}, base.settings, s.settings || {});
    out.students = (s.students || base.students).map((st) =>
      Object.assign({ cosmetics: [], badges: [], ruleCount: {}, redeemCount: 0, totalPoints: st.points || 0 }, st)
    );
    ['groups', 'rules', 'shop', 'ledger', 'dailyTasks', 'redeems', 'groupTasks', 'toolbar', 'customPets', 'deletedPetIds'].forEach((k) => {
      if (!Array.isArray(out[k])) out[k] = base[k];
    });
    if (!out.classMission) out.classMission = base.classMission;
    if (!out.attendance || typeof out.attendance !== 'object') out.attendance = {};
    // 每隻寵物補上預設的 10 段進化階段（已經自訂過的寵物維持原樣，不會被蓋掉）
    out.petImages = Object.assign({}, base.petImages, s.petImages || {});
    out.petNames = Object.assign({}, base.petNames, s.petNames || {});
    return out;
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
    award, undoEntry, editEntry, feedPet, unlockCosmetic, equipCosmetic, choosePet, redeem,
    attendanceOf, isAbsent, setAttendance, setAllAttendance,
    getGithubConfig, saveGithubConfig, githubUploadImage,
    exportJson, importJson, resetAll,
    connectSheet, useLocal, pullRemote, pushRemote, sheetCall,
  };
})(window);
