/* 桌面漂浮加點小工具：renderer 邏輯。跟網頁版共用同一份 core/（util.js／model.js／store.js），
   只要設定跟網頁版「資料與同步」頁一樣的 Google Sheets 網址，兩邊看到的就是同一份資料。

   介面是一條可以拖著移動的橫幅（貼到螢幕左右邊會變成直幅），平常只顯示「選人／分類規則／
   紀錄」幾個按鈕，點開才會展開對應的面板——盡量節省桌面空間，需要的時候再點開。

   「選人」不是塞進這個視窗裡面展開，而是另外開一個並排的小視窗（見 picker.js）：
   貼邊變直幅時，如果連學生清單都塞進同一個視窗往下長，很容易長到超出螢幕、學生選不到，
   獨立成另一個視窗就不受這裡的大小限制。兩邊的「已選學生」狀態是 main process 統一保管的
   （見 preload.js 的 toggleStudent/selectMany/onSelectionChanged），這裡的 selected
   只是即時鏡射，不是本地自己管的狀態。 */
(function () {
  'use strict';
  const U = window.PetUtil;
  const M = window.PetModel;
  const S = window.PetStore;
  const { el } = U;
  const root = document.getElementById('root');

  /* Toast 是用 position:fixed 貼在視窗（=body）右下角，但這個視窗會依內容縮到剛好的大小，
     太小的時候 toast 會被裁到看不見，所以量完內容大小後，額外多留一段透明的高度給它顯示。 */
  const TOAST_RESERVE = 36;

  let dockSide = 'none'; // 'none' | 'left' | 'right' | 'top' | 'bottom'
  let selected = new Set(); // 由 main process 統一保管，這裡只是鏡射（見 onSelectionChanged）
  let pickerOpen = false; // 選人是另一個視窗，這裡只記著「現在是不是開著」，用來讓按鈕顯示反白
  let ledgerOpen = false;
  let activeCategory = 'class';
  let ruleKind = 'add';
  let widthOpen = false;
  let collapsed = false;
  let pawGesture = null;
  const WIDTH_KEY = 'classpet.widgetWidths.v1';
  let widths = { vertical: 180, horizontal: 420 };
  try { const saved = JSON.parse(localStorage.getItem(WIDTH_KEY) || '{}');
    for (const mode of ['vertical', 'horizontal']) if (Number.isFinite(saved[mode])) widths[mode] = Math.max(140, Math.min(900, saved[mode]));
  } catch (e) { /* 使用預設寬度 */ }
  function currentWidth() { return Math.min(widths[isVertical() ? 'vertical' : 'horizontal'], Math.max(140, screen.availWidth - 16)); }
  function setWidth(value, wrap) {
    widths[isVertical() ? 'vertical' : 'horizontal'] = Math.max(140, Math.min(900, Number(value) || 180));
    try { localStorage.setItem(WIDTH_KEY, JSON.stringify(widths)); } catch (e) { /* 忽略無法存檔 */ }
    wrap.style.setProperty('--widget-width', currentWidth() + 'px');
    const output = wrap.querySelector('.dw-width-value');
    if (output) output.textContent = currentWidth() + ' px';
    const slider = wrap.querySelector('.dw-width-range');
    if (slider) slider.value = currentWidth();
    reportSize(wrap);
  }
  function widthControls() {
    if (!widthOpen) return null;
    return el('label', { class: 'dw-width-controls' }, [
      el('span', { text: '寬度' }),
      el('input', { class: 'dw-width-range', type: 'range', min: '140', max: String(Math.min(900, Math.max(140, screen.availWidth - 16))), step: '10', value: currentWidth(), 'aria-label': '桌面工具寬度', oninput: e => setWidth(e.target.value, e.target.closest('.dw-main')) }),
      el('output', { class: 'dw-width-value', text: currentWidth() + ' px' })
    ]);
  }
  function resizeGrip(wrap) {
    const grip = el('div', { class: 'dw-resize-grip' + (dockSide === 'right' ? ' is-left' : ''), title: '左右拖曳調整寬度', 'aria-hidden': 'true', text: '↔' });
    let startX = 0, startWidth = 0, dragging = false;
    grip.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      startX = e.screenX; startWidth = currentWidth(); dragging = true;
      grip.setPointerCapture(e.pointerId); e.preventDefault();
    });
    grip.addEventListener('pointermove', e => {
      if (!dragging) return;
      setWidth(startWidth + (dockSide === 'right' ? startX - e.screenX : e.screenX - startX), wrap);
    });
    const end = () => { dragging = false; };
    grip.addEventListener('pointerup', end); grip.addEventListener('pointercancel', end);
    return grip;
  }

  /* 首次同步、換班與重開均建立基準；只有之後的新事件可排通知。 */
  const ledgerAlerts=window.PetLedgerAlerts.create();
  let suppressNextDiff=false;
  function checkForNewLedgerEntries(s) {
    const unseen=ledgerAlerts.observe(s,S.getConfig(),S.getSync(),suppressNextDiff);
    if(!window.desktopWidget)return;
    const nameOf=id=>{const st=s.students.find(x=>x.id===id);return st?st.name:'？';};
    unseen.forEach(e=>{const rule=s.rules.find(r=>r.id===e.ruleId);window.desktopWidget.notifyAward({names:e.studentIds.map(nameOf),label:e.label||'',points:e.points||0,xp:e.xp||0,coins:e.coins||0,icon:rule?rule.icon:'⭐',at:e.ts});});
  }

  function isVertical() { return dockSide === 'left' || dockSide === 'right'; }

  function reportSize(wrapEl) {
    if (!window.desktopWidget) return;
    const r = wrapEl.getBoundingClientRect();
    window.desktopWidget.resizeTo(Math.ceil(r.width), Math.ceil(r.height) + (collapsed ? 0 : TOAST_RESERVE));
  }

  function collapseWidget() {
    collapsed = true;
    pickerOpen = false;
    if (window.desktopWidget) window.desktopWidget.closePicker();
    paint();
  }

  function titlebar(connected) {
    return el('header', { class: 'dw-titlebar' }, [
      el('div', { class: 'dw-window-controls', 'aria-label': '視窗控制' }, [
        el('button', { class: 'dw-window-btn' + (widthOpen ? ' is-active' : ''), title: '調整寬度', 'aria-label': '調整寬度', onclick: () => { widthOpen = !widthOpen; paint(); } }, ['↔']),
        connected ? el('button', { class: 'dw-window-btn' + (ledgerOpen ? ' is-active' : ''), title: '近 50 筆點數紀錄', 'aria-label': '點數紀錄', onclick: () => { ledgerOpen = !ledgerOpen; paint(); } }, ['📜']) : null,
        el('button', { class: 'dw-window-btn', title: '隱藏到系統匣', 'aria-label': '隱藏到系統匣', onclick: () => window.desktopWidget && window.desktopWidget.hideWindow() }, ['－']),
        el('button', { class: 'dw-window-btn', title: '收合成小腳掌', 'aria-label': '收合成小腳掌', 'aria-expanded': 'true', onclick: collapseWidget }, ['▴']),
        el('button', { class: 'dw-window-btn dw-window-btn--close', title: '關閉小工具；啟用手機控制時保留背景接收', 'aria-label': '關閉小工具', onclick: () => window.desktopWidget && window.desktopWidget.quitApp() }, ['✕']),
      ]),
      el('div', { class: 'dw-titlebar__drag', title: '按住這一整條即可拖曳移動' }, ['🐾 班級加點 · 拖曳移動']),
    ]);
  }

  function pawTab() {
    const tab = el('button', { class: 'dw-paw-tab', title: '點一下展開；按住拖曳移動', 'aria-label': '展開班級加點工具', 'aria-expanded': 'false', text: '🐾' });
    tab.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      const gesture = { x: e.screenX, y: e.screenY, lastX: e.screenX, lastY: e.screenY, moved: false, bounds: null };
      pawGesture = gesture;
      tab.setPointerCapture(e.pointerId);
      if (window.desktopWidget) window.desktopWidget.getWindowBounds().then(bounds => {
        if (pawGesture !== gesture) return;
        gesture.bounds = bounds;
        if (gesture.moved && bounds) window.desktopWidget.moveWindow(bounds.x + gesture.lastX - gesture.x, bounds.y + gesture.lastY - gesture.y);
      }).catch(() => {});
      e.preventDefault();
    });
    tab.addEventListener('pointermove', e => {
      const g = pawGesture;
      if (!g) return;
      g.lastX = e.screenX; g.lastY = e.screenY;
      if (Math.hypot(e.screenX - g.x, e.screenY - g.y) > 5) g.moved = true;
      if (g.moved && g.bounds && window.desktopWidget) window.desktopWidget.moveWindow(g.bounds.x + e.screenX - g.x, g.bounds.y + e.screenY - g.y);
    });
    tab.addEventListener('pointerup', e => {
      const g = pawGesture;
      if (!g) return;
      pawGesture = null;
      if (tab.hasPointerCapture(e.pointerId)) tab.releasePointerCapture(e.pointerId);
      if (!g.moved) collapsed = false;
      paint();
    });
    tab.addEventListener('pointercancel', () => { pawGesture = null; paint(); });
    tab.addEventListener('click', e => { if (e.detail === 0) { collapsed = false; paint(); } });
    tab.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); collapsed = false; paint(); }
    });
    return tab;
  }

  function syncDot() {
    const s = S.getSync();
    return el('span', { class: 'dw-dot is-' + (s.state === 'ok' ? 'ok' : s.state === 'error' ? 'error' : '') });
  }

  function setupBody() {
    const urlInput = el('input', { class: 'input', placeholder: '貼上跟網頁版一樣的 Google Sheets 網址' });
    const keyInput = el('input', { class: 'input', placeholder: '班級代碼（沒設定過就留空）' });
    const msg = el('p', { class: 'muted', style: { fontSize: '12px', margin: 0 } });
    return el('div', { class: 'dw-setup' }, [
      el('p', { class: 'muted', style: { fontSize: '12px', margin: 0 }, text: '第一次使用要先連上跟網頁版「資料與同步」頁同一個 Google Sheets 網址，之後就會自動記住、自動連線。' }),
      urlInput, keyInput,
      el('button', {
        class: 'btn btn--primary', text: '連線',
        onclick: () => {
          const url = urlInput.value.trim();
          if (!url) return U.toast('請貼上 Google Sheets 網址', 'warn');
          msg.textContent = '連線中…';
          S.connectSheet(url, keyInput.value.trim() || 'default')
            .then(() => { U.toast('連線成功！'); paint(); })
            .catch((err) => { msg.textContent = ''; U.toast('連線失敗：' + err.message, 'error'); });
        },
      }),
      msg,
    ]);
  }

  function categoryTabs(s) {
    const cats = s.ruleCategories && s.ruleCategories.length ? s.ruleCategories : M.DEFAULT_RULE_CATEGORIES;
    // 老師可能在網頁版改名/刪除/重排過分類，如果目前選到的分類已經不存在了，退回第一個分類
    if (!cats.some((c) => c.id === activeCategory)) activeCategory = cats[0].id;
    return el('div', { class: 'dw-seg' }, cats.map((c) =>
      el('button', {
        class: 'dw-seg__btn' + (activeCategory === c.id ? ' is-active' : ''), text: c.label,
        onclick: () => { activeCategory = c.id; paint(); },
      })
    ));
  }

  // 與網頁規則設定使用相同的分類、加扣分篩選和陣列順序，不受底部工具列限制。
  function ruleKindTabs(s) {
    const categories = s.ruleCategories && s.ruleCategories.length ? s.ruleCategories : M.DEFAULT_RULE_CATEGORIES;
    const category = categories.some(c => c.id === activeCategory) ? activeCategory : categories[0].id;
    const inCategory = (s.rules || []).filter(r => (r.category || categories[0].id) === category);
    return el('div', { class: 'dw-kind', role: 'group', 'aria-label': '加扣分規則' }, ['add', 'deduct'].map(kind => {
      const count = inCategory.filter(r => kind === 'add' ? r.points >= 0 : r.points < 0).length;
      return el('button', { class: 'dw-kind__btn' + (ruleKind === kind ? ' is-active' : ''),
        text: (kind === 'add' ? '加分' : '扣分') + ' (' + count + ')', 'aria-pressed': String(ruleKind === kind),
        onclick: () => { ruleKind = kind; paint(); }
      });
    }));
  }

  function ruleChips(s) {
    const categories = s.ruleCategories && s.ruleCategories.length ? s.ruleCategories : M.DEFAULT_RULE_CATEGORIES;
    const rules = (s.rules || []).filter(r =>
      (r.category || categories[0].id) === activeCategory && (ruleKind === 'add' ? r.points >= 0 : r.points < 0));
    if (!rules.length) return el('div', { class: 'dw-rules-empty', text: '這個分類目前沒有' + (ruleKind === 'add' ? '加分' : '扣分') + '規則，請至網頁「規則設定」新增。' });
    return el('div', { class: 'dw-rules' }, rules.map((r) => el('button', {
      class: 'dw-rule', title: r.label + ' ' + (r.points >= 0 ? '+' : '') + r.points,
      onclick: () => {
        if (!selected.size) return U.toast('請先點「選人」挑學生', 'warn');
        /* 這裡是本機自己按的，馬上就看得到下面這行 toast 了，不用再跳一次右下角泡泡
           （泡泡是留給「人不在這台電腦前面」的情境，例如手機加點）。 */
        suppressNextDiff = true;
        const count = selected.size;
        const ups = S.award(Array.from(selected), r, '', s.classInfo.teacher);
        selected.clear();
        window.desktopWidget.clearSelection();
        paint();
        suppressNextDiff = false;
        const sign = r.points >= 0 ? '+' : '';
        U.toast(count + ' 位 ' + r.label + ' ' + sign + r.points);
        if (ups.length) U.toast('🎉 ' + ups.map((u) => u.name + ' Lv.' + u.level).join('、') + ' 升級了！');
      },
    }, [
      el('span', { text: r.icon }),
      el('span', { class: 'dw-rule__label', text: r.label }),
      el('span', { class: 'dw-rule__pts' + (r.points < 0 ? ' is-minus' : ''), text: (r.points >= 0 ? '+' : '') + r.points }),
    ])));
  }

  /* 人數多的紀錄不逐一列名字，簡略成「事由 共 N 人」（滑鼠停著可看完整名單）；3 人以內才列姓名。 */
  function ledgerWho(l, nameOf) {
    const ids = l.studentIds || [];
    const tag = l.subject ? '［' + l.subject + '］' : '';
    if (ids.length > 3) return tag + (l.label || '加點') + ' 共 ' + ids.length + ' 人';
    return tag + ids.map(nameOf).join('、') + ' ' + (l.label || '');
  }
  /* 金額欄：有點數顯示點數；只有 XP／金幣的紀錄（例如今日任務）改顯示 XP 或金幣，不再是「+0」。 */
  function ledgerAmount(l) {
    const sign = (n) => (n > 0 ? '+' : '') + n;
    if (l.points) return { text: sign(l.points), minus: l.points < 0 };
    if (l.xp) return { text: sign(l.xp) + ' XP', minus: l.xp < 0 };
    if (l.coins) return { text: '🪙' + sign(l.coins), minus: l.coins < 0 };
    return { text: '+0', minus: false };
  }

  /* 目前上課科目：之後每筆加扣分都會記下科目（網頁與小工具共用同一個設定）。 */
  function subjectRow(s) {
    const cur = (s.settings && s.settings.currentSubject) || '';
    const list = S.subjects();
    if (cur && list.indexOf(cur) < 0) list.push(cur);
    return el('label', { class: 'dw-subject' }, [
      el('span', { text: '📚 目前科目' }),
      el('select', { class: 'input dw-subject__select', 'aria-label': '目前上課科目', onchange: (e) => S.setCurrentSubject(e.target.value) },
        [el('option', { value: '', text: '未指定', selected: cur === '' ? 'selected' : null })].concat(list.map((n) => el('option', { value: n, text: n, selected: n === cur ? 'selected' : null })))),
    ]);
  }

  function ledgerPanel(s) {
    if (!ledgerOpen) return null;
    const rows = (s.ledger || []).slice(0, 50);
    const nameOf = (id) => { const st = s.students.find((x) => x.id === id); return st ? st.name : '？'; };
    const body = rows.length
      ? rows.map((l) => el('div', { class: 'dw-ledger__row' + (l.undone ? ' is-undone' : '') }, [
          el('span', { class: 'dw-ledger__row-who', title: (l.studentIds || []).map(nameOf).join('、'), text: ledgerWho(l, nameOf) }),
          el('span', { class: 'dw-ledger__row-pts' + (ledgerAmount(l).minus ? ' is-minus' : ''), text: ledgerAmount(l).text }),
        ]))
      : [el('div', { class: 'dw-ledger__empty', text: '還沒有紀錄' })];
    return el('div', { class: 'dw-ledger' }, [el('div', { class: 'dw-ledger__body' }, body)]);
  }

  function togglePicker() {
    pickerOpen = !pickerOpen;
    if (!window.desktopWidget) return;
    if (pickerOpen) window.desktopWidget.openPicker();
    else window.desktopWidget.closePicker();
    paint();
  }

  function classroomToolButtons() {
    return el('div', { class: 'dw-class-tools', 'aria-label': '課堂小工具' }, [
        ['attendance', '📋', '出席'], ['draw', '🎲', '抽籤'], ['timer', '⏱️', '計時器'], ['tasks', '✅', '今日任務']
      ].map(([kind, image, label]) => el('button', { class: 'dw-class-tool', title: label, 'aria-label': label, onclick: () => window.desktopWidget.openTool(kind) }, [el('span', { text: image }), el('span', { text: label })])));
  }

  function mainBody(s) {
    const bar = el('div', { class: 'dw-bar' }, [
      el('div', { class: 'dw-btnrow' }, [
        el('span', { class: 'dw-pill', text: '已選 ' + selected.size + ' 位' }),
        selected.size
          ? el('button', {
              class: 'dw-btn', title: '取消選取',
              onclick: () => window.desktopWidget && window.desktopWidget.clearSelection(),
            }, [el('span', { text: '取消選取' })])
          : null,
      ]),
      el('button', { class: 'dw-btn' + (pickerOpen ? ' is-active' : ''), onclick: togglePicker }, [
        el('span', { text: '👥' }), el('span', { text: '選人' }),
      ]),
      categoryTabs(s),
    ]);

    const nodes = [
      el('div', { class: 'dw-syncline' }, [syncDot(), el('span', { class: 'dw-syncline__msg', text: S.getSync().message || '' })]),
      classroomToolButtons(),
      subjectRow(s),
      bar,
      widthControls(),
      ruleKindTabs(s),
      ruleChips(s),
      ledgerPanel(s),
    ];
    return nodes.filter(Boolean);
  }

  function paint() {
    if (pawGesture) return;
    checkForNewLedgerEntries(S.get());
    // 同步與貼邊事件不重建腳掌，避免中斷焦點或連續操作。
    if (collapsed && root.querySelector('.dw-collapsed')) return;
    root.innerHTML = '';
    if (collapsed) {
      const mini = el('div', { class: 'dw-collapsed' }, [pawTab()]);
      root.appendChild(mini);
      reportSize(mini);
      return;
    }
    const vertical = isVertical();
    const wrap = el('div', { class: 'dw-root dw-main ' + (vertical ? 'is-vertical' : 'is-horizontal') });
    wrap.style.setProperty('--widget-width', currentWidth() + 'px');
    wrap.style.maxHeight = Math.max(120, screen.availHeight - TOAST_RESERVE - 24) + 'px';
    const cfg = S.getConfig();
    const connected = cfg.mode === 'sheet' && !!cfg.sheetUrl;
    wrap.appendChild(titlebar(connected));
    if (connected) {
      mainBody(S.get()).forEach((n) => wrap.appendChild(n));
    } else {
      wrap.appendChild(classroomToolButtons());
      if (widthOpen) wrap.appendChild(widthControls());
      wrap.appendChild(setupBody());
    }
    wrap.appendChild(resizeGrip(wrap));
    root.appendChild(wrap);
    reportSize(wrap);
  }

  async function initDock() {
    if (!window.desktopWidget) return;
    try { dockSide = (await window.desktopWidget.getDockSide()) || 'none'; } catch (e) { /* 拿不到就當作沒貼邊 */ }
    window.desktopWidget.onDockChanged((side) => { dockSide = side; paint(); });
  }

  async function initSelection() {
    if (!window.desktopWidget) return;
    try { selected = new Set((await window.desktopWidget.getSelection()) || []); } catch (e) { /* 拿不到就從空的開始 */ }
    window.desktopWidget.onSelectionChanged((ids) => { selected = new Set(ids || []); paint(); });
    window.desktopWidget.onPickerClosed(() => { pickerOpen = false; paint(); });
  }

  if (window.desktopWidget) window.desktopWidget.onExpandWidget(() => {
    collapsed = false;
    pawGesture = null;
    if (S.get()) paint();
  });

  function toolSnapshot() {
    const state = S.get();
    if (!state) throw new Error('班級資料尚未載入');
    return {
      day: U.todayKey(), className: state.classInfo.className,
      students: state.students.map(st => {const avatar=window.PetDrawAvatar(st,64);avatar.querySelectorAll('img').forEach(img=>{const src=img.getAttribute('src');if(src&&src.startsWith('assets/'))img.src='https://ymt11112-code.github.io/pets-score/'+src;});const level=window.PetModel.levelFromXp(st.xp||0),pet=st.petId?window.PetModel.petById(st.petId):null;return {id:st.id,no:st.no,name:st.name,groupId:st.groupId,avatarHtml:avatar.outerHTML,petInfo:{level:level.level,inLevel:level.inLevel,need:level.need,percent:level.percent,xp:Math.floor(st.xp||0),petName:pet?pet.name:''}};}),
      draw:window.PetDrawEngine.normalize(state.drawCenter),performance:window.PetDrawEngine.performanceList(state),
      attendance: Object.assign({}, S.attendanceOf()), sync: S.getSync(),
      tasks: state.dailyTasks.map(({ id, icon, title, target, xp, points, coins, doneBy }) => ({ id, icon, title, target, xp, points: points || 0, coins: coins || 0, doneBy: (doneBy || []).slice() })),
    };
  }
  if (window.desktopWidget) window.desktopWidget.onToolCommand(async request => {
    try {
      if (request.type === 'attendance') {
        const { id, absent } = request.payload;
        if (!S.student(id)) throw new Error('找不到這位學生');
        const status=typeof absent==='boolean'?(absent?'absent':''):absent;
        S.setAttendance(id,status);
        if (window.PetAttendance.isExcluded(status)) await window.desktopWidget.selectMany([id], false);
      } else if (request.type === 'all-attendance') {
        const ids = S.get().students.map(student => student.id);
        const status=typeof request.payload.absent==='boolean'?(request.payload.absent?'absent':''):request.payload.absent;
        S.setAllAttendance(ids,status);
        if (window.PetAttendance.isExcluded(status)) await window.desktopWidget.selectMany(ids, false);
      } else if(request.type==='draw-config') {
        S.commit(s=>window.PetDrawEngine.settings(s,request.payload));
      } else if(request.type==='draw-run') {
        S.commit(s=>window.PetDrawEngine.run(s,s.students.filter(st=>S.isAbsent(st.id)).map(st=>st.id),request.payload));
      } else if(request.type==='draw-perform') {
        const { id, key } = request.payload;
        if (!S.student(id)) throw new Error('找不到這位學生');
        if (S.isAbsent(id)) throw new Error('這位學生今天不在出席名單');
        const rule = window.PetDrawEngine.performanceRule(S.get(), key);
        suppressNextDiff = true;
        try { S.award([id], rule, '', S.get().classInfo.teacher); } finally { suppressNextDiff = false; }
      } else if(request.type==='draw-unperform') {
        const { id, key } = request.payload;
        const entry = window.PetDrawEngine.findPerformanceEntry(S.get(), id, key);
        if (entry) { suppressNextDiff = true; try { S.undoEntry(entry.id); } finally { suppressNextDiff = false; } }
      } else if(request.type==='draw-reset') {
        S.commit(s=>window.PetDrawEngine.reset(s));
      } else if (request.type === 'task-students') {
        const { taskId, ids } = request.payload;
        if (!S.get().dailyTasks.some(task => task.id === taskId)) throw new Error('找不到這項任務');
        const validIds = Array.from(new Set(ids)).filter(id => !!S.student(id));
        S.setDailyTaskStudents(taskId, validIds);
      } else if (request.type !== 'snapshot') throw new Error('不支援的工具操作');
      window.desktopWidget.toolResult({ id: request.id, state: toolSnapshot() });
    } catch (error) { window.desktopWidget.toolResult({ id: request.id, error: error.message }); }
  });

  S.init().then(() => {
    checkForNewLedgerEntries(S.get());
    const syncEbookCloud=()=>window.desktopWidget.configureEbookCloud(S.getConfig()).catch(()=>{});
    syncEbookCloud();document.addEventListener('petsync',syncEbookCloud);
    document.addEventListener('petsync',()=>{if(S.get())paint();});
    S.subscribe(paint);
    S.subscribe(() => window.desktopWidget && window.desktopWidget.publishToolState(toolSnapshot()));
    Promise.all([initDock(), initSelection()]).then(paint);
  });
})();
