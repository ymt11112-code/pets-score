/* 共用小工具（classic script，掛在 window.PetUtil） */
(function (global) {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const CLAY_ICONS = [
    ['peak','回答優秀','🏔️','優秀 高峰 挑戰 突破','positive'],
    ['thumb','回答完整','👍','完整 回答 鼓勵 讚','positive'],
    ['hand','舉手參與','🙋','回答正確 參與 舉手','positive'],
    ['bulb','勇敢發想','💡','思考 發想 創意 專注','positive'],
    ['help','合作互助','🤝','合作 幫忙 友善 小組','positive'],
    ['work','作業完成','📚','作業 繳交 努力 完成','positive'],
    ['trophy','全班超棒','🏆','全班 小組 超棒 優良 優秀','positive'],
    ['shield','自律守規','🛡️','自律 守規 當天蓋掉','positive'],
    ['clock','守時提醒','⏰','遲到 太慢 準時 守時','reminder'],
    ['bag','記得用品','🎒','健忘 忘記 用品 缺交','reminder'],
    ['retry','訂正再試','✏️','訂正 缺交 修正 再試','reminder'],
    ['moon','午休安靜','🌙','午休 安靜 違規 休息','reminder'],
  ].map(([id,label,fallback,keywords,tone],index)=>({id,icon:'clay:'+id,label,fallback,keywords,tone,index}));
  function appendIconText(node, value) {
    const text = String(value == null ? '' : value);
    const tokens = text.split(/(clay:(?:peak|thumb|hand|bulb|help|work|trophy|shield|clock|bag|retry|moon)\b)/g);
    tokens.forEach(token => {
      const info = CLAY_ICONS.find(item => item.icon === token);
      if (!info || ['OPTION','TEXTAREA','TITLE'].includes(node.tagName)) {
        node.appendChild(document.createTextNode(info ? info.fallback : token)); return;
      }
      const image = document.createElement('span');
      image.className = 'clay-icon'; image.dataset.clay = info.id;
      image.setAttribute('role','img'); image.setAttribute('aria-label',info.label);
      image.style.backgroundPosition = (info.index % 4 / 3 * 100) + '% ' + (Math.floor(info.index / 4) / 2 * 100) + '%';
      node.appendChild(image);
    });
  }
  function setIconText(node, value) { node.textContent = ''; appendIconText(node, value); return node; }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') setIconText(node, v);
        else if (k === 'style' && typeof v === 'object') {
          Object.keys(v).forEach((sk) => {
            if (sk.indexOf('--') === 0) node.style.setProperty(sk, v[sk]);
            else node.style[sk] = v[sk];
          });
        }
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v);
      });
    }
    (Array.isArray(children) ? children : children ? [children] : []).forEach((c) => {
      if (c === null || c === undefined || c === false) return;
      if (typeof c === 'string' || typeof c === 'number') appendIconText(node, c); else node.appendChild(c);
    });
    return node;
  }

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  const pad2 = (n) => String(n).padStart(2, '0');

  function fmtClock(ts) {
    const d = new Date(ts);
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function fmtDate(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '/' + pad2(d.getMonth() + 1) + '/' + pad2(d.getDate());
  }

  function fmtDateTime(ts) {
    return fmtDate(ts) + ' ' + fmtClock(ts);
  }

  function todayKey(ts) {
    const d = ts ? new Date(ts) : new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function isToday(ts) {
    return todayKey(ts) === todayKey();
  }

  function daysAgo(n) {
    return Date.now() - n * 86400000;
  }

  function startOfDay(ts) {
    const d = new Date(ts == null ? Date.now() : ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function startOfWeek(ts) {
    const d = new Date(startOfDay(ts));
    const wd = (d.getDay() + 6) % 7; // 週一為起點
    return d.getTime() - wd * 86400000;
  }

  function startOfMonth(ts) {
    const d = new Date(ts == null ? Date.now() : ts);
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  }

  function addDays(ts, n) {
    return ts + n * 86400000;
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function debounce(fn, ms) {
    let t;
    return function () {
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms || 200);
    };
  }

  /* ---------- Toast ---------- */
  let toastHost = null;
  function toast(message, kind) {
    if (!toastHost) {
      toastHost = el('div', { class: 'toast-host' });
      document.body.appendChild(toastHost);
    }
    const node = el('div', { class: 'toast toast--' + (kind || 'ok') }, [
      el('span', { class: 'toast__icon', text: kind === 'warn' ? '⚠️' : kind === 'error' ? '⛔' : '✅' }),
      el('span', { class: 'toast__msg', text: message }),
    ]);
    toastHost.appendChild(node);
    setTimeout(() => node.classList.add('is-in'), 10);
    setTimeout(() => {
      node.classList.remove('is-in');
      setTimeout(() => node.remove(), 260);
    }, 2600);
  }

  /* ---------- Modal ---------- */
  function modal(opts) {
    const o = opts || {};
    const backdrop = el('div', { class: 'modal-backdrop' });
    const body = typeof o.body === 'string' ? el('div', { class: 'modal__text', html: o.body }) : o.body;
    const footer = el('div', { class: 'modal__footer' });
    const box = el('div', { class: 'modal' + (o.wide ? ' modal--wide' : '') }, [
      el('div', { class: 'modal__head' }, [
        el('h3', { class: 'modal__title grow', text: o.title || '' }),
        o.headerRight || null,
        el('button', { class: 'modal__close', text: '✕', 'aria-label': '關閉', onclick: close }),
      ]),
      el('div', { class: 'modal__body' }, body ? [body] : []),
      footer,
    ]);

    function close(result) {
      backdrop.classList.remove('is-in');
      setTimeout(() => backdrop.remove(), 180);
      if (typeof o.onClose === 'function') o.onClose(result);
    }

    (o.actions || []).forEach((a) => {
      footer.appendChild(
        el('button', {
          class: 'btn ' + (a.kind === 'primary' ? 'btn--primary' : a.kind === 'danger' ? 'btn--danger' : 'btn--ghost'),
          text: a.label,
          onclick: () => {
            const keep = a.onClick ? a.onClick(close) : false;
            if (!keep) close(a.value);
          },
        })
      );
    });
    if (!(o.actions || []).length) footer.remove();

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop && o.dismissable !== false) close();
    });
    backdrop.appendChild(box);
    document.body.appendChild(backdrop);
    setTimeout(() => backdrop.classList.add('is-in'), 10);
    return { close, box, footer };
  }

  function confirmDialog(title, message, confirmLabel) {
    return new Promise((resolve) => {
      modal({
        title,
        body: message,
        actions: [
          { label: '取消', value: false },
          { label: confirmLabel || '確定', kind: 'primary', value: true },
        ],
        onClose: (v) => resolve(!!v),
      });
    });
  }

  function download(filename, text) {
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  global.PetUtil = {
    $, $$, el, CLAY_ICONS, setIconText, uid, pad2, fmtClock, fmtDate, fmtDateTime, todayKey, isToday, daysAgo,
    startOfDay, startOfWeek, startOfMonth, addDays,
    clamp, shuffle, deepClone, debounce, toast, modal, confirmDialog, download,
  };
})(window);
