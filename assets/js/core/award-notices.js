/* 從正式點數紀錄偵測新事件，支援本機分頁與雲端下載，不重播歷史紀錄。 */
(function () {
  'use strict';
  const S = window.PetStore, U = window.PetUtil;
  window.PetAwardNotices = true;
  const startedAt = Date.now();
  let seen = new Set((S.get() && S.get().ledger || []).map(e => e.id));
  const queue = [];
  let busy = false;
  const host = U.el('div', { class: 'award-notices', 'aria-live': 'polite', 'aria-relevant': 'additions' });
  document.body.append(host);
  function next() {
    if (busy || !queue.length) return;
    busy = true;
    const e = queue.shift();
    const box = U.el('div', { class: 'award-notice' }, [
      U.el('span', { class: 'award-notice__icon', text: '✅' }),
      U.el('strong', { text: e.studentIds.length + ' 位學生 ' + e.label + ' +' + e.points + ' 點' }),
      U.el('button', { text: '×', 'aria-label': '關閉加分提示', onclick: dismiss })
    ]);
    let timer;
    function dismiss() { if (!busy || !box.isConnected) return; clearTimeout(timer); box.remove(); busy = false; next(); }
    host.append(box);
    timer = setTimeout(dismiss, 5000);
  }
  S.subscribe(s => {
    const entries = s.ledger || [];
    const fresh = entries.filter(e => !seen.has(e.id) && !e.undone && e.points > 0 && e.ts >= startedAt && Array.isArray(e.studentIds) && e.studentIds.length);
    // The ledger is capped at 2000; keep the de-duplication set bounded as well.
    seen = new Set(entries.map(e => e.id));
    if (s.settings && s.settings.notifyAward === false) return;
    fresh.sort((a,b)=>a.ts-b.ts).forEach(e => queue.push(e));
    next();
  });
})();
