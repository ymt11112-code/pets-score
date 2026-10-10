/* 選人小視窗：跟主視窗（app.js）是各自獨立的 renderer process，但透過 main.js
   共用同一份「目前選取的學生」狀態（見 selectMany/toggleStudent/onSelectionChanged），
   也透過共用的 core/store.js 讀到跟主視窗一樣的班級資料（同一份 localStorage）。 */
(function () {
  'use strict';
  const U = window.PetUtil;
  const M = window.PetModel;
  const S = window.PetStore;
  const { el } = U;
  const root = document.getElementById('root');

  const TOAST_RESERVE = 36;
  let tab = 'students'; // 'students' | 'groups'
  let selected = new Set();

  function reportSize(wrapEl) {
    if (!window.desktopWidget) return;
    const r = wrapEl.getBoundingClientRect();
    window.desktopWidget.resizePicker(Math.ceil(r.width), Math.ceil(r.height) + TOAST_RESERVE);
  }

  function groupsTab(s) {
    const list = el('div', { class: 'dw-picker__list' });
    (s.groups || []).forEach((g) => {
      const ids = s.students.filter((x) => x.groupId === g.id && !S.isAbsent(x.id)).map((x) => x.id);
      const allOn = ids.length > 0 && ids.every((id) => selected.has(id));
      list.appendChild(el('button', {
        class: 'dw-chip' + (allOn ? ' is-on' : ''), text: g.emoji + ' ' + g.name + '（' + ids.length + '）',
        onclick: () => window.desktopWidget && window.desktopWidget.selectMany(ids, !allOn),
      }));
    });
    if (!s.groups || !s.groups.length) list.appendChild(el('div', { class: 'dw-rules-empty', text: '還沒有設定小組。' }));
    return [list];
  }

  function studentsTab(s) {
    const activeIds = s.students.filter((st) => !S.isAbsent(st.id)).map((st) => st.id);
    const allSelected = activeIds.length > 0 && activeIds.every((id) => selected.has(id));
    const allBtn = el('button', {
      class: 'dw-btn dw-btn--block' + (allSelected ? ' is-active' : ''),
      text: allSelected ? '☑️ 取消全班' : '☑️ 全班',
      onclick: () => window.desktopWidget && window.desktopWidget.selectMany(activeIds, !allSelected),
    });
    const invertBtn = el('button', {
      class: 'dw-btn dw-btn--block',
      title: '把現在有選的人變沒選、沒選的人變有選',
      text: '🔄 反選',
      onclick: () => window.desktopWidget && window.desktopWidget.invertSelection(activeIds),
    });
    const listEl = el('div', { class: 'dw-num-grid' });
    s.students.slice().sort((a, b) => a.no - b.no).forEach((st) => {
      const absent = S.isAbsent(st.id);
      const on = selected.has(st.id);
      listEl.appendChild(el('button', {
        class: 'dw-chip--num' + (on ? ' is-on' : '') + (absent ? ' is-off-disabled' : ''),
        title: st.name + (absent ? '（請假）' : ''),
        text: String(st.no).padStart(2, '0'),
        onclick: () => { if (absent) return; window.desktopWidget && window.desktopWidget.toggleStudent(st.id); },
      }));
    });
    return [allBtn, invertBtn, listEl];
  }

  function paint() {
    root.innerHTML = '';
    const s = S.get();
    const wrap = el('div', { class: 'dw-root dw-picker-win' });

    const head = el('div', { class: 'dw-bar' }, [
      el('span', { style: { fontWeight: '800', fontSize: '12px' }, text: '👥 選人' }),
      el('button', {
        class: 'dw-btn is-icon-only', title: '關閉',
        onclick: () => window.desktopWidget && window.desktopWidget.closePicker(),
      }, [el('span', { text: '✕' })]),
    ]);
    const tabs = el('div', { class: 'dw-seg' }, [
      el('button', { class: 'dw-seg__btn' + (tab === 'students' ? ' is-active' : ''), text: '學生', onclick: () => { tab = 'students'; paint(); } }),
      el('button', { class: 'dw-seg__btn' + (tab === 'groups' ? ' is-active' : ''), text: '小組', onclick: () => { tab = 'groups'; paint(); } }),
    ]);

    [head, tabs].concat(tab === 'groups' ? groupsTab(s) : studentsTab(s)).forEach((n) => n && wrap.appendChild(n));
    root.appendChild(wrap);
    reportSize(wrap);
  }

  if (window.desktopWidget) {
    window.desktopWidget.getSelection().then((ids) => { selected = new Set(ids || []); paint(); });
    window.desktopWidget.onSelectionChanged((ids) => { selected = new Set(ids || []); paint(); });
  }

  S.init().then(() => {
    S.subscribe(paint);
    paint();
  });
})();
