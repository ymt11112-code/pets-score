/* 桌面漂浮加點小工具：renderer 邏輯。跟網頁版共用同一份 core/（util.js／model.js／store.js），
   只要設定跟網頁版「資料與同步」頁一樣的 Google Sheets 網址，兩邊看到的就是同一份資料。 */
(function () {
  'use strict';
  const U = window.PetUtil;
  const M = window.PetModel;
  const S = window.PetStore;
  const { el } = U;
  const root = document.getElementById('root');

  let expanded = false;
  let selected = new Set();

  function setExpanded(v) {
    expanded = v;
    if (window.desktopWidget) window.desktopWidget.resizePanel(v);
    paint();
  }

  /* 圓鈕要同時支援「點一下展開」跟「拖著移動」：視窗跟著游標的螢幕座標移動，
     游標在視窗裡的相對位置全程不變，所以不會有拖曳中途游標「跑出視窗」的問題。
     移動超過 4px 才算拖曳，放開時沒拖曳就當作是點擊。 */
  function attachFabDrag(fabEl) {
    let dragging = false;
    let moved = false;
    let offsetX = 0, offsetY = 0;
    let startX = 0, startY = 0;

    fabEl.addEventListener('pointerdown', async (e) => {
      dragging = true;
      moved = false;
      startX = e.screenX;
      startY = e.screenY;
      try { fabEl.setPointerCapture(e.pointerId); } catch (err) {}
      if (window.desktopWidget) {
        const b = await window.desktopWidget.getWindowBounds();
        if (b) { offsetX = startX - b.x; offsetY = startY - b.y; }
      }
    });
    fabEl.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.screenX - startX;
      const dy = e.screenY - startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
      if (moved && window.desktopWidget) {
        window.desktopWidget.moveWindowTo(e.screenX - offsetX, e.screenY - offsetY);
      }
    });
    fabEl.addEventListener('pointerup', (e) => {
      if (!dragging) return;
      dragging = false;
      try { fabEl.releasePointerCapture(e.pointerId); } catch (err) {}
      if (!moved) setExpanded(true);
    });
  }

  function syncDot() {
    const s = S.getSync();
    return el('span', { class: 'w-dot is-' + (s.state === 'ok' ? 'ok' : s.state === 'error' ? 'error' : '') });
  }

  function setupBody() {
    const urlInput = el('input', { class: 'input', placeholder: '貼上跟網頁版一樣的 Google Sheets 網址' });
    const keyInput = el('input', { class: 'input', placeholder: '班級代碼（沒設定過就留空）' });
    const msg = el('p', { class: 'muted', style: { fontSize: '12px' } });
    return el('div', { class: 'w-setup' }, [
      el('p', { class: 'card__sub', text: '第一次使用要先連上跟網頁版「資料與同步」頁同一個 Google Sheets 網址，之後就會自動記住、自動連線。' }),
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

  function mainBody() {
    const s = S.get();
    const searchInput = el('input', { class: 'input', placeholder: '搜尋姓名或座號…' });
    const listEl = el('div', { class: 'w-list' });
    const dockEl = el('div', { class: 'w-dock' });
    const countEl = el('b', { text: '已選 ' + selected.size });

    function paintList() {
      listEl.innerHTML = '';
      const q = searchInput.value.trim();
      s.students.slice().sort((a, b) => a.no - b.no)
        .filter((st) => !q || (String(st.no).padStart(2, '0') + st.name).indexOf(q) >= 0)
        .forEach((st) => {
          const on = selected.has(st.id);
          listEl.appendChild(el('button', {
            class: 'w-chip' + (on ? ' is-on' : ''), text: String(st.no).padStart(2, '0') + ' ' + st.name,
            onclick: () => { on ? selected.delete(st.id) : selected.add(st.id); paintList(); countEl.textContent = '已選 ' + selected.size; },
          }));
        });
    }
    searchInput.addEventListener('input', paintList);
    paintList();

    (s.rules || []).filter((r) => r.id).forEach((r) => {
      dockEl.appendChild(el('button', {
        class: 'w-rulebtn',
        onclick: () => {
          if (!selected.size) return U.toast('請先點選學生', 'warn');
          const ups = S.award(Array.from(selected), r, '', s.classInfo.teacher);
          const sign = r.points >= 0 ? '+' : '';
          U.toast(selected.size + ' 位學生 ' + r.label + ' ' + sign + r.points + ' 點');
          if (ups.length) U.toast('🎉 ' + ups.map((u) => u.name + ' Lv.' + u.level).join('、') + ' 升級了！');
        },
      }, [el('span', { text: r.icon }), el('span', { text: r.label }), el('span', { text: (r.points >= 0 ? '+' : '') + r.points })]));
    });

    return el('div', {}, [
      el('div', { class: 'w-syncline' }, [syncDot(), el('span', { text: S.getSync().message || '' })]),
      el('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '6px' } }, [countEl]),
      searchInput,
      listEl,
      dockEl,
    ]);
  }

  function paint() {
    root.innerHTML = '';
    if (!expanded) {
      const fab = el('div', { class: 'w-fab', text: '⭐' });
      root.appendChild(fab);
      attachFabDrag(fab);
      return;
    }
    const cfg = S.getConfig();
    const connected = cfg.mode === 'sheet' && !!cfg.sheetUrl;
    const panel = el('div', { class: 'w-panel' }, [
      el('div', { class: 'w-panel__head' }, [
        el('span', { text: '⭐ 快速加點' }),
        el('button', { class: 'w-iconbtn', text: '－', title: '收合', onclick: () => setExpanded(false) }),
        el('button', { class: 'w-iconbtn', text: '✕', title: '結束程式', onclick: () => window.desktopWidget && window.desktopWidget.quitApp() }),
      ]),
      el('div', { class: 'w-panel__body' }, [connected ? mainBody() : setupBody()]),
    ]);
    root.appendChild(panel);
  }

  S.init().then(() => {
    S.subscribe(paint);
    paint();
  });
})();
