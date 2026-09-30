/* 桌面漂浮加點小工具：renderer 邏輯。跟網頁版共用同一份 core/（util.js／model.js／store.js），
   只要設定跟網頁版「資料與同步」頁一樣的 Google Sheets 網址，兩邊看到的就是同一份資料。

   介面是一條可以拖著移動的橫幅（貼到螢幕左右邊會變成直幅），平常只顯示「選人／分類規則／
   紀錄」幾個按鈕，點開才會展開對應的面板——盡量節省桌面空間，需要的時候再點開。 */
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
  let selected = new Set();
  let pickerOpen = false;
  let pickerTab = 'students'; // 'students' | 'groups'
  let ledgerOpen = false;
  let activeCategory = 'class';

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

  function categoryTabs() {
    return el('div', { class: 'dw-seg' }, M.RULE_CATEGORIES.map((c) =>
      el('button', {
        class: 'dw-seg__btn' + (activeCategory === c.id ? ' is-active' : ''), text: c.label,
        onclick: () => { activeCategory = c.id; paint(); },
      })
    ));
  }

  function ruleChips(s) {
    const rules = (s.rules || []).filter((r) => (r.category || 'class') === activeCategory);
    if (!rules.length) return el('div', { class: 'dw-rules-empty', text: '這個分類還沒有規則，可以到網頁版「規則設定」新增或調整分類。' });
    return el('div', { class: 'dw-rules' }, rules.map((r) => el('button', {
      class: 'dw-rule',
      onclick: () => {
        if (!selected.size) return U.toast('請先點「選人」挑學生', 'warn');
        const ups = S.award(Array.from(selected), r, '', s.classInfo.teacher);
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

  function pickerPanel(s) {
    if (!pickerOpen) return null;
    const searchInput = el('input', { class: 'input dw-picker__search', placeholder: '搜尋姓名或座號…' });
    const listEl = el('div', { class: 'dw-picker__list' });

    function paintList() {
      listEl.innerHTML = '';
      if (pickerTab === 'groups') {
        (s.groups || []).forEach((g) => {
          const ids = s.students.filter((x) => x.groupId === g.id && !S.isAbsent(x.id)).map((x) => x.id);
          const allOn = ids.length > 0 && ids.every((id) => selected.has(id));
          listEl.appendChild(el('button', {
            class: 'dw-chip' + (allOn ? ' is-on' : ''), text: g.emoji + ' ' + g.name + '（' + ids.length + '）',
            onclick: () => { ids.forEach((id) => (allOn ? selected.delete(id) : selected.add(id))); paint(); },
          }));
        });
        if (!s.groups || !s.groups.length) listEl.appendChild(el('div', { class: 'dw-rules-empty', text: '還沒有設定小組。' }));
      } else {
        const q = searchInput.value.trim();
        s.students.slice().sort((a, b) => a.no - b.no)
          .filter((st) => !q || (String(st.no).padStart(2, '0') + st.name).indexOf(q) >= 0)
          .forEach((st) => {
            const absent = S.isAbsent(st.id);
            const on = selected.has(st.id);
            listEl.appendChild(el('button', {
              class: 'dw-chip' + (on ? ' is-on' : '') + (absent ? ' is-off-disabled' : ''),
              text: String(st.no).padStart(2, '0') + ' ' + st.name + (absent ? '（請假）' : ''),
              onclick: () => { if (absent) return; on ? selected.delete(st.id) : selected.add(st.id); paint(); },
            }));
          });
      }
    }
    searchInput.addEventListener('input', paintList);
    paintList();

    const tabs = el('div', { class: 'dw-seg', style: { marginBottom: '6px' } }, [
      el('button', { class: 'dw-seg__btn' + (pickerTab === 'students' ? ' is-active' : ''), text: '學生', onclick: () => { pickerTab = 'students'; paint(); } }),
      el('button', { class: 'dw-seg__btn' + (pickerTab === 'groups' ? ' is-active' : ''), text: '小組', onclick: () => { pickerTab = 'groups'; paint(); } }),
    ]);
    return el('div', { class: 'dw-picker' }, [tabs, pickerTab === 'students' ? searchInput : null, listEl]);
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

  function mainBody(s) {
    const bar = el('div', { class: 'dw-bar' }, [
      gripEl(),
      el('span', { class: 'dw-pill', text: '已選 ' + selected.size + ' 位' }),
      el('button', { class: 'dw-btn' + (pickerOpen ? ' is-active' : ''), onclick: () => { pickerOpen = !pickerOpen; paint(); } }, [
        el('span', { text: '👥' }), el('span', { text: '選人' }),
      ]),
      categoryTabs(),
      el('button', { class: 'dw-btn is-icon-only' + (ledgerOpen ? ' is-active' : ''), title: '近 50 筆點數紀錄', onclick: () => { ledgerOpen = !ledgerOpen; paint(); } }, [el('span', { text: '📜' })]),
      el('button', { class: 'dw-btn is-icon-only', title: '隱藏到系統匣', onclick: () => window.desktopWidget && window.desktopWidget.hideWindow() }, [el('span', { text: '－' })]),
      el('button', { class: 'dw-btn is-icon-only', title: '結束程式', onclick: () => window.desktopWidget && window.desktopWidget.quitApp() }, [el('span', { text: '✕' })]),
    ]);

    const nodes = [
      el('div', { class: 'dw-syncline' }, [syncDot(), el('span', { text: S.getSync().message || '' })]),
      bar,
      ruleChips(s),
      pickerPanel(s),
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

  S.init().then(() => {
    S.subscribe(paint);
    initDock().then(paint);
  });
})();
