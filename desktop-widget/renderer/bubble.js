/* 加點通知泡泡：純粹的顯示端，不連 core/store.js、不讀班級資料，只負責把 main process
   透過 show-award 傳來的內容畫出來、淡入、停留幾秒、淡出，淡出動畫結束後呼叫 bubble-done
   讓 main process 接著播佇列裡的下一則（見 main.js 的 processBubbleQueue）。 */
(function () {
  'use strict';
  const U = window.PetUtil;
  const { el } = U;
  const root = document.getElementById('root');

  const HOLD_MS = 3800; // 淡入完成後停留多久才開始淡出
  const FADE_MS = 280; // 要跟 bubble.css 的 transition 時間一致

  function amountText(payload) {
    const parts = [];
    if (payload.points) parts.push((payload.points > 0 ? '+' : '') + payload.points + ' 點');
    if (payload.xp) parts.push('+' + payload.xp + ' XP');
    if (payload.coins) parts.push((payload.coins > 0 ? '+' : '') + payload.coins + ' 🪙');
    return parts.join('・');
  }

  let hideTimer = null;

  function show(payload) {
    clearTimeout(hideTimer);
    root.innerHTML = '';
    const minus = (payload.points || 0) < 0 || (payload.coins || 0) < 0;
    const names = (payload.names && payload.names.length) ? payload.names.join('、') : '？';
    const card = el('div', { class: 'aw-bubble' + (minus ? ' is-minus' : '') }, [
      el('span', { class: 'aw-bubble__icon', text: payload.icon || '⭐' }),
      el('div', { class: 'grow' }, [
        el('div', { class: 'aw-bubble__title', text: names }),
        el('div', { class: 'aw-bubble__meta', text: payload.label || '' }),
      ]),
      el('span', { class: 'aw-bubble__amount' + (minus ? ' is-minus' : ''), text: amountText(payload) }),
    ]);
    root.appendChild(card);
    // 兩層 rAF：確保瀏覽器先畫出「淡入前」的初始狀態，下一偵再加上 is-in 才會真的跑過渡動畫
    requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('is-in')));

    hideTimer = setTimeout(() => {
      card.classList.remove('is-in');
      setTimeout(() => { if (window.desktopWidget) window.desktopWidget.bubbleDone(); }, FADE_MS);
    }, HOLD_MS);
  }

  if (window.desktopWidget) window.desktopWidget.onShowAward(show);
})();
