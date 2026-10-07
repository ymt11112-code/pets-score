/* 共用小工具（classic script，掛在 window.PetUtil） */
(function (global) {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
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
      node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
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
    $, $$, el, uid, pad2, fmtClock, fmtDate, fmtDateTime, todayKey, isToday, daysAgo,
    startOfDay, startOfWeek, startOfMonth, addDays,
    clamp, shuffle, deepClone, debounce, toast, modal, confirmDialog, download,
  };
})(window);
