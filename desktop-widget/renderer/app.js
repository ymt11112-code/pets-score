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
  const TOAST_RESERVE = 70;

  let dockSide = 'none'; // 'none' | 'left' | 'right' | 'top' | 'bottom'
  let selected = new Set(); // 由 main process 統一保管，這裡只是鏡射（見 onSelectionChanged）
  let pickerOpen = false; // 選人是另一個視窗，這裡只記著「現在是不是開著」，用來讓按鈕顯示反白
  let ledgerOpen = false;
  let activeCategory = 'class';

  /* 加點通知泡泡：每次 paint（= 每次資料有變動，包含雲端同步拉回來的）都比對一次目前的
     點數紀錄，找出「上次沒看過」的紀錄，送去 main process 跳泡泡。seenLedgerIds 開機時
     先用「當下已經有的紀錄」整批塞滿，這樣一開機不會把過去幾百筆舊紀錄全部跳出來；
     suppressNextDiff 是在「這個視窗自己剛點規則加點」的當下設成 true，讓這次新增的那筆
     紀錄被直接標記成「看過了」、不用再跳一次泡泡（toast 已經在同一個視窗裡看得到了）。 */
  let seenLedgerIds = null;
  let suppressNextDiff = false;

  function checkForNewLedgerEntries(s) {
    if (!seenLedgerIds) return;
    const ledger = s.ledger || [];
    const unseen = ledger.filter((e) => !seenLedgerIds.has(e.id));
    if (!unseen.length) return;
    unseen.forEach((e) => seenLedgerIds.add(e.id));
    if (suppressNextDiff) return;
    if (!window.desktopWidget) return;
    const nameOf = (id) => { const st = s.students.find((x) => x.id === id); return st ? st.name : '？'; };
    unseen
      .filter((e) => !e.undone)
      .forEach((e) => {
        const rule = s.rules.find((r) => r.id === e.ruleId);
        window.desktopWidget.notifyAward({
          names: (e.studentIds || []).map(nameOf),
          label: e.label || '',
          points: e.points || 0,
          xp: e.xp || 0,
          coins: e.coins || 0,
          icon: rule ? rule.icon : '⭐',
        });
      });
  }

  function isVertical() { return dockSide === 'left' || dockSide === 'right'; }

  function reportSize(wrapEl) {
    if (!window.desktopWidget) return;
    const r = wrapEl.getBoundingClientRect();
    window.desktopWidget.resizeTo(Math.ceil(r.width), Math.ceil(r.height) + TOAST_RESERVE);
  }

  function gripEl() {
    return el('div', { class: 'dw-grip', title: '拖曳移動位置', text: '⋮⋮' });
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

  /* 小工具要顯示哪些規則、順序怎麼排，直接沿用網頁版「系統設定→底部工具列」的設定
     （state.toolbar），老師只要在網頁版那邊編輯過一次，桌面小工具就會跟著變；
     util: 開頭的是網頁版專屬工具（出席、計時器…），這裡用不到所以過濾掉。 */
  function toolbarRuleIds(s) {
    const order = (s.toolbar && s.toolbar.length ? s.toolbar : M.DEFAULT_TOOLBAR);
    return order.filter((id) => id.indexOf('util:') !== 0);
  }

  function ruleChips(s) {
    const byId = {};
    (s.rules || []).forEach((r) => { byId[r.id] = r; });
    const rules = toolbarRuleIds(s)
      .map((id) => byId[id])
      .filter((r) => r && (r.category || 'class') === activeCategory);
    if (!rules.length) return el('div', { class: 'dw-rules-empty', text: '這個分類目前沒有規則顯示在工具列，可以到網頁版「系統設定→底部工具列」加入規則，或到「規則設定」調整規則的分類。' });
    return el('div', { class: 'dw-rules' }, rules.map((r) => el('button', {
      class: 'dw-rule',
      onclick: () => {
        if (!selected.size) return U.toast('請先點「選人」挑學生', 'warn');
        /* 這裡是本機自己按的，馬上就看得到下面這行 toast 了，不用再跳一次右下角泡泡
           （泡泡是留給「人不在這台電腦前面」的情境，例如手機加點）。 */
        suppressNextDiff = true;
        const ups = S.award(Array.from(selected), r, '', s.classInfo.teacher);
        suppressNextDiff = false;
        const sign = r.points >= 0 ? '+' : '';
        U.toast(selected.size + ' 位 ' + r.label + ' ' + sign + r.points);
        if (ups.length) U.toast('🎉 ' + ups.map((u) => u.name + ' Lv.' + u.level).join('、') + ' 升級了！');
      },
    }, [
      el('span', { text: r.icon }),
      el('span', { text: r.label }),
      el('span', { class: 'dw-rule__pts' + (r.points < 0 ? ' is-minus' : ''), text: (r.points >= 0 ? '+' : '') + r.points }),
    ])));
  }

  function ledgerPanel(s) {
    if (!ledgerOpen) return null;
    const rows = (s.ledger || []).slice(0, 50);
    const nameOf = (id) => { const st = s.students.find((x) => x.id === id); return st ? st.name : '？'; };
    const body = rows.length
      ? rows.map((l) => el('div', { class: 'dw-ledger__row' + (l.undone ? ' is-undone' : '') }, [
          el('span', { class: 'dw-ledger__row-who', text: (l.studentIds || []).map(nameOf).join('、') + ' ' + (l.label || '') }),
          el('span', { class: 'dw-ledger__row-pts' + ((l.points || 0) < 0 ? ' is-minus' : ''), text: (l.points >= 0 ? '+' : '') + (l.points || 0) }),
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

  function mainBody(s) {
    const bar = el('div', { class: 'dw-bar' }, [
      gripEl(),
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
      /* 這三個純圖示的工具鈕故意包成一個橫排小群組（dw-btnrow），
         不管主橫幅是橫是直，它們都並排在一起，不會直幅時各自撐成一整條、浪費空間 */
      el('div', { class: 'dw-btnrow' }, [
        el('button', { class: 'dw-btn is-icon-only' + (ledgerOpen ? ' is-active' : ''), title: '近 50 筆點數紀錄', onclick: () => { ledgerOpen = !ledgerOpen; paint(); } }, [el('span', { text: '📜' })]),
        el('button', { class: 'dw-btn is-icon-only', title: '隱藏到系統匣', onclick: () => window.desktopWidget && window.desktopWidget.hideWindow() }, [el('span', { text: '－' })]),
        el('button', { class: 'dw-btn is-icon-only', title: '結束程式', onclick: () => window.desktopWidget && window.desktopWidget.quitApp() }, [el('span', { text: '✕' })]),
      ]),
    ]);

    const nodes = [
      el('div', { class: 'dw-syncline' }, [syncDot(), el('span', { class: 'dw-syncline__msg', text: S.getSync().message || '' })]),
      bar,
      ruleChips(s),
      ledgerPanel(s),
    ];
    return nodes.filter(Boolean);
  }

  function paint() {
    root.innerHTML = '';
    const vertical = isVertical();
    const wrap = el('div', { class: 'dw-root ' + (vertical ? 'is-vertical' : 'is-horizontal') });
    const cfg = S.getConfig();
    const connected = cfg.mode === 'sheet' && !!cfg.sheetUrl;
    if (connected) {
      checkForNewLedgerEntries(S.get());
      mainBody(S.get()).forEach((n) => wrap.appendChild(n));
    } else {
      const head = el('div', { class: 'dw-bar' }, [
        gripEl(),
        el('span', { style: { fontWeight: 800, fontSize: '12px' }, text: '⭐ 班級加點小工具' }),
        el('button', { class: 'dw-btn is-icon-only', title: '結束程式', onclick: () => window.desktopWidget && window.desktopWidget.quitApp() }, [el('span', { text: '✕' })]),
      ]);
      wrap.appendChild(head);
      wrap.appendChild(setupBody());
    }
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

  S.init().then(() => {
    // 開機當下已經存在的紀錄全部當作「看過了」，不然一開機就會把過去累積的紀錄全部跳出來
    seenLedgerIds = new Set((S.get().ledger || []).map((e) => e.id));
    S.subscribe(paint);
    Promise.all([initDock(), initSelection()]).then(paint);
  });
})();
