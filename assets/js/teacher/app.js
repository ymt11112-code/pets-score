/* ===== 老師後台 ===== */
(function () {
  'use strict';

  const U = window.PetUtil;
  const M = window.PetModel;
  const S = window.PetStore;
  const { $, $$, el } = U;

  let page = 'overview';
  let selected = new Set();
  let filterGroup = '';
  let keyword = '';
  let batchTab = 'students';
  let multiMode = false;
  let toolbarExpanded = false;
  let msgSelected = new Set();
  let msgTab = 'students';
  let msgRecipientMode = 'all';

  /* ---------- 共用元件 ---------- */
  function pageHead(title, sub, right) {
    return el('div', { class: 'page-head row row--between', style: { flexWrap: 'wrap', gap: '12px' } }, [
      el('div', {}, [
        el('h1', { class: 'page-title', text: title }),
        sub ? el('p', { class: 'page-sub', text: sub }) : null,
      ]),
      right || null,
    ]);
  }

  function card(title, sub, children, right) {
    return el('div', { class: 'card' }, [
      title
        ? el('div', { class: 'card__head' }, [
            el('div', {}, [
              el('h3', { class: 'card__title', text: title }),
              sub ? el('p', { class: 'card__sub', text: sub }) : null,
            ]),
            right || null,
          ])
        : null,
      el('div', {}, Array.isArray(children) ? children : [children]),
    ]);
  }

  /* 可收合的卡片：長頁面（規則設定／學生與小組／系統設定）用這個取代 card()，
     搭配 sectionJumpBar() 可以直接跳到某一段並自動展開，避免一直往下滾。 */
  let collapsedSections = {};
  function sectionCard(id, title, sub, children) {
    const isCollapsed = !!collapsedSections[id];
    return el('div', { class: 'card section-card' + (isCollapsed ? ' is-collapsed' : ''), id: 'sec-' + id }, [
      el('button', {
        class: 'section-card__head', type: 'button',
        onclick: () => { collapsedSections[id] = !collapsedSections[id]; render(); },
      }, [
        el('div', {}, [
          el('h3', { class: 'card__title', text: title }),
          sub ? el('p', { class: 'card__sub', text: sub }) : null,
        ]),
        el('span', { class: 'section-card__chevron', text: '▾' }),
      ]),
      isCollapsed ? null : el('div', { class: 'section-card__body' }, Array.isArray(children) ? children : [children]),
    ]);
  }

  function sectionJumpBar(sections) {
    return el('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' } }, sections.map((sec) =>
      el('button', {
        class: 'btn btn--ghost btn--sm', text: sec.label,
        onclick: () => {
          collapsedSections[sec.id] = false;
          render();
          const node = document.getElementById('sec-' + sec.id);
          if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },
      })
    ));
  }

  function bar(percent, green) {
    return el('div', { class: 'bar' + (green ? ' bar--green' : '') }, [
      el('div', { class: 'bar__fill', style: { width: U.clamp(percent, 0, 100) + '%' } }),
    ]);
  }

  function petCell(st, size) {
    const pet = M.petById(st.petId);
    return el('span', { class: 'pet-avatar', style: { width: (size || 46) + 'px', height: (size || 46) + 'px' } }, [
      M.petFace(pet, Math.round((size || 46) * 0.62), M.levelFromXp(st.xp).level, st.petPathId),
    ]);
  }

  function sortStudents(list, s) {
    const order = (s.settings && s.settings.studentOrder) || 'no';
    const arr = list.slice();
    if (order === 'name') arr.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
    else arr.sort((a, b) => a.no - b.no);
    return arr;
  }

  function filteredStudents() {
    const s = S.get();
    const list = s.students
      .filter((x) => !filterGroup || x.groupId === filterGroup)
      .filter((x) => !keyword || (U.pad2(x.no) + x.name).indexOf(keyword) >= 0);
    return sortStudents(list, s);
  }

  function applyRule(ids, ruleObj, note) {
    if (!ids.length) return U.toast('請先選擇學生', 'warn');
    const ups = S.award(ids, ruleObj, note || '', S.get().classInfo.teacher);
    const sign = ruleObj.points >= 0 ? '+' : '';
    const isPositive = ruleObj.points >= 0;
    const st = S.get().settings || {};
    const notifyOn = isPositive ? st.notifyAward !== false : st.notifyDeduct !== false;
    const soundOn = isPositive ? !!st.soundAward : !!st.soundDeduct;
    if (notifyOn) U.toast(ids.length + ' 位學生 ' + ruleObj.label + ' ' + sign + ruleObj.points + ' 點');
    if (soundOn) { try { playTone(isPositive ? 660 : 300); } catch (e) { /* 部分瀏覽器不允許自動播放 */ } }
    if (ups.length) {
      U.toast('🎉 ' + ups.map((u) => u.name + ' Lv.' + u.level).join('、') + ' 升級了！');
    }
    notifyStorylineActionProgress(ruleObj);
  }

  /* 如果剛才用的規則正好是目前關卡在追蹤的守護行動，順便提醒老師最新的行動次數／參與人數，
     不用特地切到星野主線頁才看得到（這兩個數字本來就是即時算的，這裡只是多跳一則提示）。 */
  function notifyStorylineActionProgress(ruleObj) {
    const s = S.get();
    const story = s.storyline;
    if (!story || !story.active) return;
    const idx = S.storylineCurrentIndex(s);
    const c = story.chapters[idx];
    if (!c || (c.actionRuleIds || []).indexOf(ruleObj.id) < 0) return;
    if (!(c.actionTarget > 0 || c.participantTarget > 0)) return;
    const prog = S.storylineChapterActionProgress(s, c.id);
    const parts = [];
    if (c.actionTarget > 0) parts.push('行動 ' + prog.count + '／' + c.actionTarget + ' 次');
    if (c.participantTarget > 0) parts.push('參與夥伴 ' + prog.participants + '／' + c.participantTarget + ' 人');
    U.toast('🌟 ' + c.name + '：' + parts.join('　'));
  }

  /* ================= 班級總覽 ================= */
  function pageOverview() {
    const s = S.get();
    const today = S.todayPoints();
    const yest = S.yesterdayPoints();
    const weekFrom = S.weekStartTs();
    const activeIds = new Set();
    S.activeLedger().forEach((e) => { if (e.ts >= weekFrom) e.studentIds.forEach((i) => activeIds.add(i)); });
    const nearLevel = s.students.filter((st) => {
      const lv = M.levelFromXp(st.xp);
      return lv.need - lv.inLevel <= 10;
    });
    const noFeedback = s.students.filter((st) => !S.activeLedger().some((e) => e.ts >= weekFrom && e.points > 0 && e.studentIds.indexOf(st.id) >= 0));
    const mission = s.classMission;

    return el('div', {}, [
      pageHead(s.classInfo.teacher + ' 的 ' + s.classInfo.className,
        s.classInfo.school + ' · ' + s.classInfo.className + ' · ' + s.students.length + ' 位學生 · ' + s.groups.length + ' 個小組'),

      el('div', { class: 'kpi-grid' }, [
        kpi('🌟', '今日加點', today, (today - yest >= 0 ? '比昨日多 ' : '比昨日少 ') + Math.abs(today - yest) + ' 點'),
        kpi('👥', '本週活躍學生', activeIds.size + ' / ' + s.students.length, Math.round((activeIds.size / s.students.length) * 100) + '% 已有紀錄'),
        kpi('📈', '即將升級寵物', nearLevel.length + ' 隻', nearLevel.length ? '差不到 10 XP' : '目前沒有'),
        kpi('🗺️', '班級共同任務', Math.round((mission.progress / mission.target) * 100) + '%', '還差 ' + (mission.target - mission.progress) + ' 點'),
      ]),

      el('div', { class: 'note-grid' }, [
        noteCard('❤️', noFeedback.length + ' 位', '學生本週尚未獲得正向回饋', () => {
          selected = new Set(noFeedback.map((x) => x.id));
          render();
          U.toast('已選取 ' + noFeedback.length + ' 位，可直接加點');
        }),
        noteCard('🔥', s.classInfo.classStreak + ' 天', '班級連續完成共同任務'),
        noteCard('🏆', (s.classInfo.badgeCount || 0) + ' 枚', '班級徽章已解鎖'),
      ]),

      storylineOverviewCard(),

      el('div', { class: 'cols' }, [
        card('學生與寵物成長', '課堂點數與寵物經驗分開顯示，方便追蹤真實進步。', [studentTable()],
          el('span', { class: 'pill', text: filteredStudents().length + ' 位學生' })),

        el('div', { class: 'stack' }, [
          card('常用加點規則', '先在左邊勾選學生，再點規則即可加點。', [rulePanel()]),
          card('最近加點紀錄', null, [recentLog(8)],
            el('button', { class: 'btn btn--ghost btn--sm', text: '全部紀錄', onclick: () => go('ledger') })),
        ]),
      ]),
    ]);
  }

  /* 班級總覽的星野主線摘要卡：沒啟用就顯示一個引導入口，啟用後顯示目前進度 */
  function storylineOverviewCard() {
    const s = S.get();
    const story = s.storyline;
    if (!story || !story.active) {
      return card('🌟 星野守護隊：動物夥伴的遠征', '把日常加分變成全班一起闖關的冒險故事，尚未啟用。', [
        el('button', { class: 'btn btn--green', text: '前往設定並啟用 →', onclick: () => go('storyline') }),
      ]);
    }
    const idx = S.storylineCurrentIndex(s);
    const stars = S.storylineStars(s);
    const weekly = S.storylineWeeklyGain(s);
    const allCleared = idx >= story.chapters.length;
    const c = story.chapters[idx] || story.chapters[story.chapters.length - 1];
    const left = Math.max(0, c.threshold - stars);
    let statusText;
    if (allCleared) statusText = '🎉 五座燈塔全部點亮，故事完結！';
    else if (stars >= c.threshold && !c.taskDone) statusText = '⭐ 星光已集滿，等待完成共同任務';
    else if (stars >= c.threshold) statusText = '✅ 條件都符合，正在確認通關';
    else statusText = '還差 ' + left + ' 顆星光';

    return card('🌟 ' + story.title,
      allCleared ? null : '目前關卡：第 ' + c.order + ' 關・' + c.name + '（建議第 ' + c.week + ' 週完成）',
      [
        el('div', { class: 'kpi-grid', style: { marginBottom: '4px' } }, [
          kpi('✨', '本篇章星光', stars.toLocaleString(), allCleared ? '五關全數完成' : '門檻 ' + c.threshold.toLocaleString()),
          kpi('📈', '本週新增星光', weekly, '平均每週約 ' + weekly + ' 顆'),
          kpi('🚩', '共同任務', allCleared ? '—' : (c.taskDone ? '已確認完成' : '尚未完成'), allCleared ? '' : c.taskTitle),
          kpi('🏁', '目前狀態', allCleared ? '已完結' : ('第 ' + (idx + 1) + ' / ' + story.chapters.length + ' 關'), statusText),
        ]),
      ],
      el('button', { class: 'btn btn--ghost btn--sm', text: '管理星野主線 →', onclick: () => go('storyline') }));
  }

  function kpi(icon, label, value, note) {
    return el('div', { class: 'kpi' }, [
      el('span', { class: 'kpi__icon', text: icon }),
      el('div', {}, [
        el('div', { class: 'kpi__label', text: label }),
        el('div', { class: 'kpi__value', text: String(value) }),
        note ? el('div', { class: 'kpi__note', text: note }) : null,
      ]),
    ]);
  }

  function noteCard(icon, strong, text, onclick) {
    return el('div', { class: 'note-card', style: onclick ? { cursor: 'pointer' } : null, onclick: onclick || null }, [
      el('span', { style: { fontSize: '22px' }, text: icon }),
      el('div', {}, [el('b', { text: strong }), el('span', { text: ' ' + text })]),
    ]);
  }

  function studentTable() {
    const s = S.get();
    const list = filteredStudents();

    const search = el('input', {
      class: 'input grow', placeholder: '搜尋姓名或座號', value: keyword,
      oninput: U.debounce((e) => { keyword = e.target.value.trim(); render(); }, 220),
    });
    const groupSel = el('select', { class: 'select', style: { maxWidth: '160px' }, onchange: (e) => { filterGroup = e.target.value; render(); } },
      [el('option', { value: '', text: '全部小組' })].concat(s.groups.map((g) =>
        el('option', { value: g.id, text: g.emoji + ' ' + g.name, selected: filterGroup === g.id ? 'selected' : null }))));

    const toolbar = el('div', { class: 'tbl-toolbar' }, [
      search, groupSel,
      el('button', {
        class: 'btn btn--ghost btn--sm',
        text: list.every((x) => selected.has(x.id)) && list.length ? '取消全選' : '全選',
        onclick: () => {
          const all = list.every((x) => selected.has(x.id)) && list.length;
          list.forEach((x) => (all ? selected.delete(x.id) : selected.add(x.id)));
          render();
        },
      }),
      el('button', { class: 'btn btn--primary btn--sm', text: '已選學生 ' + selected.size + ' 位', onclick: () => go('batch') }),
    ]);

    const rows = list.map((st) => {
      const lv = M.levelFromXp(st.xp);
      const g = S.group(st.groupId);
      const pet = M.petById(st.petId);
      return el('tr', { class: selected.has(st.id) ? 'is-sel' : '' }, [
        el('td', {}, [el('input', {
          class: 'checkbox', type: 'checkbox', checked: selected.has(st.id) ? 'checked' : null,
          onchange: (e) => { e.target.checked ? selected.add(st.id) : selected.delete(st.id); render(); },
        })]),
        el('td', {}, [el('div', { class: 'cell-student' }, [
          petCell(st, 42),
          el('div', {}, [
            el('div', { class: 'cell-student__name', text: U.pad2(st.no) + ' ' + st.name }),
            el('div', { class: 'cell-student__meta', text: '連續 ' + (st.streak || 0) + ' 天' }),
          ]),
        ])]),
        el('td', { class: 'col-hide-sm' }, [el('span', { class: 'grp-tag', text: g ? g.name : '—' })]),
        el('td', { class: 'col-hide-sm' }, [
          el('div', { style: { fontWeight: 700 }, text: st.petName || pet.name }),
          el('div', { class: 'cell-student__meta', text: pet.trait }),
        ]),
        el('td', {}, [
          el('div', { class: 'row', style: { gap: '8px' } }, [
            el('b', { class: 'nowrap', text: 'Lv.' + lv.level }),
            el('div', { class: 'grow', style: { minWidth: '60px' } }, [bar(lv.percent)]),
            el('span', { class: 'muted col-hide-sm', style: { fontSize: '12px' }, text: lv.percent + '%' }),
          ]),
        ]),
        el('td', {}, [el('b', { style: { fontSize: '16px' }, text: String(st.points) })]),
        el('td', { class: 'col-hide-sm' }, [el('span', { class: 'pill pill--gold', text: '🪙 ' + st.coins })]),
        el('td', {}, [el('div', { class: 'qty' }, [
          el('button', { class: 'qty__btn qty__btn--minus', text: '−', title: '扣 1 點', onclick: () => applyRule([st.id], { id: 'quick_minus', label: '調整', points: -1, xp: 0, coins: 0 }) }),
          el('button', { class: 'qty__btn qty__btn--plus', text: '＋', title: '加 1 點', onclick: () => applyRule([st.id], { id: 'quick_plus', label: '好表現', points: 1, xp: 2, coins: 1 }) }),
        ])]),
      ]);
    });

    return el('div', {}, [
      toolbar,
      el('div', { class: 'tbl-wrap' }, [
        el('table', { class: 'tbl' }, [
          el('thead', {}, [el('tr', {}, [
            el('th', {}, [el('input', {
              class: 'checkbox', type: 'checkbox',
              checked: list.length && list.every((x) => selected.has(x.id)) ? 'checked' : null,
              onchange: (e) => { list.forEach((x) => (e.target.checked ? selected.add(x.id) : selected.delete(x.id))); render(); },
            })]),
            el('th', { text: '學生' }),
            el('th', { class: 'col-hide-sm', text: '小組' }),
            el('th', { class: 'col-hide-sm', text: '寵物' }),
            el('th', { text: '寵物成長' }),
            el('th', { text: '課堂點數' }),
            el('th', { class: 'col-hide-sm', text: '金幣' }),
            el('th', { text: '快速操作' }),
          ])]),
          el('tbody', {}, rows.length ? rows : [el('tr', {}, [el('td', { colspan: '8' }, [el('div', { class: 'empty', text: '找不到符合的學生' })])])]),
        ]),
      ]),
    ]);
  }

  function rulePanel() {
    const s = S.get();
    return el('div', { class: 'rule-grid' }, s.rules.map((r) =>
      el('button', {
        class: 'rule-btn',
        onclick: () => applyRule(Array.from(selected), r),
      }, [
        el('div', { class: 'rule-btn__emoji', text: r.icon }),
        el('div', { class: 'rule-btn__pts' + (r.points < 0 ? ' is-minus' : ''), text: (r.points > 0 ? '+' : '') + r.points }),
        el('div', { class: 'rule-btn__label', text: r.label }),
      ])
    ));
  }

  function recentLog(n) {
    const rows = S.get().ledger.slice(0, n);
    if (!rows.length) return el('div', { class: 'empty', text: '還沒有紀錄' });
    return el('div', {}, rows.map((e) => {
      const names = e.studentIds.map((id) => (S.student(id) || {}).name).filter(Boolean);
      const first = S.student(e.studentIds[0]);
      return el('div', { class: 'log-row' + (e.undone ? ' is-undone' : '') }, [
        el('span', { class: 'log-row__no', text: first ? U.pad2(first.no) : '—' }),
        el('div', { class: 'grow' }, [
          el('div', { class: 'log-row__name truncate', text: names.length > 1 ? names[0] + ' 等 ' + names.length + ' 人' : (names[0] || '—') }),
          el('div', { class: 'log-row__meta', text: e.label + ' · ' + U.fmtClock(e.ts) }),
        ]),
        el('span', { class: 'log-row__pts' + (e.points < 0 ? ' is-minus' : ''), text: (e.points > 0 ? '+' : '') + e.points }),
        !e.undone
          ? el('button', { class: 'btn btn--ghost btn--sm', text: '撤銷', onclick: () => undo(e) })
          : el('span', { class: 'pill pill--gray', text: '已撤銷' }),
      ]);
    }));
  }

  function undo(e) {
    U.confirmDialog('撤銷這筆紀錄？', '「' + e.label + '」的點數、經驗與金幣都會回沖。', '撤銷').then((ok) => {
      if (!ok) return;
      S.undoEntry(e.id);
      U.toast('已撤銷', 'warn');
    });
  }

  function openEditEntry(e) {
    const names = e.studentIds.map((id) => (S.student(id) || {}).name).filter(Boolean).join('、');
    const label = el('input', { class: 'input', value: e.label });
    const note = el('input', { class: 'input', value: e.note || '', placeholder: '備註（選填）' });
    const pts = el('input', { class: 'input', type: 'number', value: e.points });
    const xp = el('input', { class: 'input', type: 'number', value: e.xp || 0 });
    const coins = el('input', { class: 'input', type: 'number', value: e.coins || 0 });
    U.modal({
      title: '編輯紀錄',
      body: el('div', { class: 'stack' }, [
        el('p', { class: 'card__sub', text: '學生：' + (names || '—') }),
        el('div', { class: 'field' }, [el('label', { class: 'field__label', text: '事由' }), label]),
        el('div', { class: 'field' }, [el('label', { class: 'field__label', text: '備註' }), note]),
        el('div', { class: 'row', style: { gap: '10px' } }, [
          el('div', { class: 'field grow' }, [el('label', { class: 'field__label', text: '課堂點數' }), pts]),
          el('div', { class: 'field grow' }, [el('label', { class: 'field__label', text: '寵物 XP' }), xp]),
          el('div', { class: 'field grow' }, [el('label', { class: 'field__label', text: '金幣' }), coins]),
        ]),
        el('p', { class: 'card__sub', text: '修改後會自動用差額補上或收回每位學生目前的點數／經驗／金幣。' }),
      ]),
      actions: [
        { label: '取消' },
        {
          label: '儲存', kind: 'primary',
          onClick: () => {
            const nm = label.value.trim();
            if (!nm) { U.toast('請輸入事由', 'warn'); return true; }
            S.editEntry(e.id, {
              label: nm, note: note.value.trim(),
              points: Number(pts.value) || 0, xp: Number(xp.value) || 0, coins: Number(coins.value) || 0,
            });
            U.toast('已更新紀錄');
          },
        },
      ],
    });
  }

  /* ================= 批次加點 ================= */
  function avatarCard(face, label, badge, on, absent, onclick, extra) {
    return el('button', { class: 'avatar-card' + (on ? ' is-on' : '') + (absent ? ' is-absent' : ''), onclick }, [
      el('div', { class: 'avatar-card__face' }, [
        face,
        on
          ? el('span', { class: 'avatar-card__check', text: '✓' })
          : (badge != null ? el('span', { class: 'avatar-card__badge' + (absent ? ' avatar-card__badge--absent' : ''), text: String(badge) }) : null),
      ]),
      el('div', { class: 'avatar-card__label', text: label }),
      extra ? el('div', { class: 'avatar-card__extra', text: extra }) : null,
    ]);
  }

  const AVATAR_SIZES = { xs: 40, sm: 48, md: 64, lg: 84, xl: 110, xxl: 140 };
  const AVATAR_SIZE_LABELS = { xs: '極小', sm: '小', md: '中', lg: '大', xl: '特大', xxl: '超大' };

  function pageBatch() {
    const s = S.get();

    const seg = el('div', { class: 'seg-toggle' }, [
      el('button', { class: 'seg-toggle__btn' + (batchTab === 'students' ? ' is-active' : ''), text: '👥 學生', onclick: () => { batchTab = 'students'; render(); } }),
      el('button', { class: 'seg-toggle__btn' + (batchTab === 'groups' ? ' is-active' : ''), text: '🚩 小組', onclick: () => { batchTab = 'groups'; render(); } }),
    ]);

    const presentStudents = s.students.filter((x) => !S.isAbsent(x.id));
    const quickChips = el('div', { class: 'tag-toggle' }, [
      el('button', { text: '☑ 全選 ' + presentStudents.length + ' 位', onclick: () => { selected = new Set(presentStudents.map((x) => x.id)); render(); } }),
      el('button', { text: '清除選取', onclick: () => { selected = new Set(); render(); } }),
    ]);

    const cardSize = AVATAR_SIZES[(s.settings && s.settings.avatarCardSize) || 'md'];
    const frameOn = !s.settings || s.settings.avatarFrame !== false;
    const faceSize = Math.round(cardSize * (frameOn ? 0.69 : 0.92));
    const gridStyle = { '--avatar-size': cardSize + 'px', gridTemplateColumns: 'repeat(auto-fill, minmax(' + (cardSize + 30) + 'px,1fr))' };
    const showNo = !s.settings || s.settings.showStudentNo !== false;
    const badgeStats = (s.settings && Array.isArray(s.settings.avatarBadgeStats) && s.settings.avatarBadgeStats.length)
      ? s.settings.avatarBadgeStats
      : [(s.settings && s.settings.avatarBadgeStat) || 'points'];
    const statValue = (key, st) => {
      if (key === 'coins') return st.coins;
      if (key === 'level') return 'Lv.' + M.levelFromXp(st.xp).level;
      if (key === 'points') return st.points;
      return null;
    };
    const statIcon = { points: '⭐', coins: '🪙', level: '🧪' };
    const statFor = (st) => statValue(badgeStats[0], st);
    const extraStatFor = (st) => badgeStats.slice(1)
      .map((key) => statValue(key, st) != null ? statIcon[key] + statValue(key, st) : null)
      .filter(Boolean).join(' · ') || null;

    const grid = batchTab === 'groups'
      ? el('div', { class: 'avatar-grid', style: gridStyle }, s.groups.map((g) => {
          const ids = s.students.filter((x) => x.groupId === g.id && !S.isAbsent(x.id)).map((x) => x.id);
          const allOn = ids.length > 0 && ids.every((id) => selected.has(id));
          return avatarCard(
            el('span', { class: 'avatar-card__emoji', text: g.emoji }),
            g.name, ids.length + ' 人', allOn, false,
            () => { ids.forEach((id) => (allOn ? selected.delete(id) : selected.add(id))); render(); }
          );
        }))
      : el('div', { class: 'avatar-grid', style: gridStyle }, sortStudents(s.students, s).map((st) => {
          const absent = S.isAbsent(st.id);
          const on = selected.has(st.id);
          return avatarCard(
            M.petFace(M.petById(st.petId), faceSize, M.levelFromXp(st.xp).level, st.petPathId),
            (showNo ? U.pad2(st.no) + ' ' : '') + st.name, absent ? '請假' : statFor(st), on, absent,
            () => {
              if (absent) return U.toast('這位同學今天請假中，如需調整請到「出席」', 'warn');
              if (multiMode) { on ? selected.delete(st.id) : selected.add(st.id); render(); }
              else openStudentProfile(st.id);
            },
            absent ? null : extraStatFor(st)
          );
        }));

    return el('div', { class: 'page-batch' }, [
      pageHead('批次加點', multiMode ? '多選模式：點頭像切換選取，切到「小組」可以整組一起選取，再用下方工具列套用規則。' : '點一下學生頭像即可直接給他加點／扣點；切到「小組」或開啟下方「多選」可以一次處理多人。',
        el('div', { class: 'row', style: { gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' } }, [
          seg, quickChips,
          el('span', { class: 'pill pill--gold', text: '已選 ' + selected.size + ' 位' }),
        ])),
      card(null, null, [grid]),
      dockBar(),
    ]);
  }

  function dockItem(id, s) {
    const tool = M.TOOLBAR_TOOLS.find((t) => t.id === id);
    if (tool) {
      if (id === 'util:attendance') return { icon: tool.icon, label: tool.label, onclick: openAttendance };
      if (id === 'util:multi') return { icon: tool.icon, label: multiMode ? '多選中' : tool.label, active: multiMode, onclick: () => { multiMode = !multiMode; selected = new Set(); render(); } };
      if (id === 'util:random') return { icon: tool.icon, label: tool.label, onclick: openRandomDraw };
      if (id === 'util:timer') return { icon: tool.icon, label: tool.label, onclick: openTimerModal };
      if (id === 'util:custom') return { icon: tool.icon, label: tool.label, onclick: () => openCustomAward(Array.from(selected)) };
      if (id === 'util:tasks') return { icon: tool.icon, label: tool.label, onclick: openDailyTasksQuick };
    }
    const r = s.rules.find((x) => x.id === id);
    if (!r) return null;
    return {
      icon: r.icon, label: r.label, sub: (r.points > 0 ? '+' : '') + r.points,
      onclick: () => applyRule(Array.from(selected), r),
    };
  }

  function dockBar() {
    const s = S.get();
    const order = (s.toolbar && s.toolbar.length ? s.toolbar : M.DEFAULT_TOOLBAR);
    const items = order.map((id) => dockItem(id, s)).filter(Boolean);
    const row1 = items.slice(0, 6);
    const row2 = items.slice(6);

    function toolBtn(item) {
      return el('button', { class: 'dock-btn' + (item.active ? ' is-active' : ''), onclick: item.onclick }, [
        el('span', { class: 'dock-btn__icon', text: item.icon }),
        el('span', { text: item.label + (item.sub ? ' ' + item.sub : '') }),
      ]);
    }

    const moreBtn = row2.length
      ? el('button', { class: 'dock-btn', text: toolbarExpanded ? '▴ 收起' : '▾ 更多', onclick: () => { toolbarExpanded = !toolbarExpanded; render(); } })
      : null;

    const editBtn = el('button', { class: 'dock-btn', text: '✏️ 編輯', title: '編輯底部工具列項目、顯示設定等', onclick: () => go('settings') });

    const countEl = (multiMode && selected.size > 0)
      ? el('button', {
          class: 'dock-btn is-active', text: '⭐ 加扣點（' + selected.size + '）',
          title: '對已選的學生一次加分或扣分', onclick: () => openFeedbackModal(Array.from(selected)),
        })
      : el('span', { class: 'dock__count', text: '已選 ' + selected.size + ' 位' });

    const bar = [countEl]
      .concat(row1.map(toolBtn))
      .concat([moreBtn, editBtn]);

    return el('div', { class: 'dock' }, [
      el('div', { class: 'dock__bar' }, bar),
      row2.length ? el('div', { class: 'dock__row--extra' + (toolbarExpanded ? ' is-open' : '') }, row2.map(toolBtn)) : null,
    ]);
  }

  /* 加分／扣分分頁＋規則格線，openFeedbackModal（多人）跟 openStudentProfile（單人檔案）共用 */
  function pointTabsWidget(ids, onApplied) {
    const s = S.get();
    let tab = 'pos';
    const listWrap = el('div', {});

    function paintList() {
      listWrap.innerHTML = '';
      const rules = s.rules.filter((r) => (tab === 'pos' ? r.points >= 0 : r.points < 0));
      listWrap.appendChild(el('div', { class: 'rule-grid rule-grid--dense' }, rules.length ? rules.map((r) =>
        el('button', { class: 'rule-btn', onclick: () => { applyRule(ids, r); onApplied(); } }, [
          el('div', { class: 'rule-btn__emoji', text: r.icon }),
          el('div', { class: 'rule-btn__pts' + (r.points < 0 ? ' is-minus' : ''), text: (r.points > 0 ? '+' : '') + r.points }),
          el('div', { class: 'rule-btn__label', text: r.label }),
        ])
      ) : [el('div', { class: 'empty', text: '目前沒有這類規則' })]));
    }

    const tabs = el('div', { class: 'seg-toggle' }, [
      el('button', { class: 'seg-toggle__btn is-active', text: '加分', onclick: (e) => { tab = 'pos'; $$('.seg-toggle__btn', tabs).forEach((b) => b.classList.remove('is-active')); e.target.classList.add('is-active'); paintList(); } }),
      el('button', { class: 'seg-toggle__btn', text: '扣分', onclick: (e) => { tab = 'neg'; $$('.seg-toggle__btn', tabs).forEach((b) => b.classList.remove('is-active')); e.target.classList.add('is-active'); paintList(); } }),
    ]);

    paintList();
    return el('div', {}, [tabs, el('div', { style: { height: '12px' } }), listWrap]);
  }

  function openFeedbackModal(ids) {
    if (!ids.length) return;
    const first = ids.length === 1 ? S.student(ids[0]) : null;

    const head = first
      ? el('div', { class: 'row', style: { gap: '12px', marginBottom: '16px' } }, [
          petCell(first, 48),
          el('div', {}, [
            el('div', { style: { fontWeight: 800, fontSize: '16px' }, text: U.pad2(first.no) + ' ' + first.name }),
            el('div', { class: 'muted', style: { fontSize: '13px' }, text: '目前 ' + first.points + ' 點' }),
          ]),
        ])
      : el('p', { class: 'card__sub', style: { marginBottom: '12px' }, text: '將同時套用到這 ' + ids.length + ' 位學生。' });

    const handle = U.modal({
      title: first ? '給 ' + first.name + ' 加分／扣分' : '給 ' + ids.length + ' 位學生加分／扣分',
      body: el('div', {}, [
        head,
        pointTabsWidget(ids, () => handle.close()),
        el('button', {
          class: 'btn btn--ghost', style: { width: '100%', marginTop: '14px' }, text: '➕ 自訂點數…',
          onclick: () => { handle.close(); openCustomAward(ids); },
        }),
      ]),
    });
  }

  /* ================= 個人學生檔案（點單一學生頭像跳出） ================= */
  function openStudentProfile(studentId) {
    let tab = 'points';
    const headEl = el('div', {});
    const navEl = el('div', { class: 'profile-nav' });
    const contentEl = el('div', { class: 'profile-content' });

    const TABS = [
      { id: 'points', icon: '⭐', label: '加扣點' },
      { id: 'redeem', icon: '🎁', label: '兌換點數' },
      { id: 'ledger', icon: '📜', label: '點數紀錄' },
      { id: 'badges', icon: '🏅', label: '徽章紀錄' },
      { id: 'edit', icon: '✏️', label: '個人化管理' },
    ];

    function paintHead() {
      const st = S.student(studentId);
      headEl.innerHTML = '';
      if (!st) return;
      const lv = M.levelFromXp(st.xp);
      const pet = M.petById(st.petId);
      headEl.appendChild(el('div', { class: 'profile-head' }, [
        M.petFace(pet, 84, lv.level, st.petPathId),
        el('div', { class: 'grow' }, [
          el('div', { class: 'profile-head__name', text: U.pad2(st.no) + ' ' + st.name }),
          el('div', { class: 'muted', style: { fontSize: '13px' }, text: (st.petName || pet.name) + ' · Lv.' + lv.level }),
          el('div', { class: 'profile-head__stats' }, [
            el('span', { class: 'pill pill--gold', text: '⭐ ' + st.points + ' 點' }),
            el('span', { class: 'pill', text: '🪙 ' + st.coins + ' 金幣' }),
            el('span', { class: 'pill pill--blue', text: '🧪 ' + st.xp + ' XP' }),
          ]),
          el('div', { class: 'profile-head__bar' }, [bar(lv.percent, true)]),
          el('div', { class: 'profile-head__next', text: '再獲得 ' + (lv.need - lv.inLevel) + ' XP 升到 Lv.' + (lv.level + 1) }),
        ]),
      ]));
    }

    function paintNav() {
      navEl.innerHTML = '';
      TABS.forEach((t) => {
        navEl.appendChild(el('button', {
          class: 'profile-nav__item' + (tab === t.id ? ' is-active' : ''),
          onclick: () => { tab = t.id; paintNav(); paintContent(); },
        }, [el('span', { text: t.icon }), el('span', { text: t.label })]));
      });
    }

    function refresh() { paintHead(); paintContent(); }

    function paintContent() {
      contentEl.innerHTML = '';
      const st = S.student(studentId);
      if (!st) { contentEl.appendChild(el('div', { class: 'empty', text: '找不到這位學生' })); return; }

      if (tab === 'points') {
        contentEl.appendChild(pointTabsWidget([studentId], refresh));
        contentEl.appendChild(el('button', {
          class: 'btn btn--ghost', style: { width: '100%', marginTop: '14px' }, text: '➕ 自訂點數…',
          onclick: () => openCustomAward([studentId]),
        }));
      } else if (tab === 'redeem') {
        const shop = S.get().shop;
        contentEl.appendChild(shop.length ? el('div', {}, shop.map((item) => {
          const afford = st.points >= item.cost && item.stock > 0;
          return el('div', { class: 'log-row' }, [
            el('span', { style: { fontSize: '20px' }, text: item.icon }),
            el('div', { class: 'grow' }, [
              el('div', { style: { fontWeight: 700 }, text: item.name }),
              el('div', { class: 'log-row__meta', text: '⭐ ' + item.cost + ' 點・剩 ' + item.stock + ' 份' }),
            ]),
            el('button', {
              class: 'btn btn--green btn--sm', disabled: afford ? null : 'disabled', text: '兌換',
              onclick: () => {
                const r = S.redeem(studentId, item.id);
                U.toast(r.ok ? '已幫 ' + st.name + ' 兌換「' + item.name + '」，請到「兌換管理」標記已領取' : r.msg, r.ok ? 'ok' : 'warn');
                refresh();
              },
            }),
          ]);
        })) : el('div', { class: 'empty', text: '商店還沒有任何獎勵' }));
      } else if (tab === 'ledger') {
        const rows = S.get().ledger.filter((e) => e.studentIds.indexOf(studentId) >= 0).slice(0, 30);
        contentEl.appendChild(rows.length ? el('div', {}, rows.map((e) => el('div', { class: 'log-row' + (e.undone ? ' is-undone' : '') }, [
          el('div', { class: 'grow' }, [
            el('div', { class: 'log-row__name', text: e.label }),
            el('div', { class: 'log-row__meta', text: U.fmtDateTime(e.ts) + (e.note ? ' · ' + e.note : '') }),
          ]),
          el('span', { class: 'log-row__pts' + (e.points < 0 ? ' is-minus' : ''), text: (e.points > 0 ? '+' : '') + e.points }),
          e.undone
            ? el('span', { class: 'pill pill--gray', text: '已撤銷' })
            : el('div', { class: 'row', style: { gap: '4px' } }, [
                el('button', { class: 'btn btn--ghost btn--sm', text: '編輯', onclick: () => openEditEntry(e) }),
                el('button', { class: 'btn btn--danger btn--sm', text: '撤銷', onclick: () => { undo(e); refresh(); } }),
              ]),
        ]))) : el('div', { class: 'empty', text: '還沒有紀錄' }));
      } else if (tab === 'badges') {
        const earned = st.badges || [];
        contentEl.appendChild(el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: '10px' } },
          (S.get().badgeDefs || []).map((b) => {
            const got = earned.indexOf(b.id) >= 0;
            return el('div', { class: 'rule-edit', style: { opacity: got ? 1 : .45 } }, [
              M.badgeFace(b, 22),
              el('div', { class: 'grow' }, [
                el('div', { style: { fontWeight: 700, fontSize: '13px' }, text: b.name }),
                el('div', { class: 'log-row__meta', text: got ? '已解鎖' : b.desc }),
              ]),
            ]);
          })));
      } else if (tab === 'edit') {
        const s = S.get();
        const update = (patch) => { S.commit((d) => { Object.assign(d.students.find((x) => x.id === studentId), patch); }); paintHead(); };
        contentEl.appendChild(el('div', { class: 'stack' }, [
          el('p', { class: 'card__sub', text: '改完立即生效，不需要另外儲存。' }),
          el('div', { class: 'row', style: { gap: '10px' } }, [
            el('div', { class: 'field', style: { width: '90px' } }, [
              el('label', { class: 'field__label', text: '座號' }),
              el('input', { class: 'input', type: 'number', value: st.no, onchange: (e) => update({ no: Number(e.target.value) || st.no }) }),
            ]),
            el('div', { class: 'field grow' }, [
              el('label', { class: 'field__label', text: '姓名' }),
              el('input', { class: 'input', value: st.name, onchange: (e) => { const nm = e.target.value.trim(); if (nm) update({ name: nm }); } }),
            ]),
          ]),
          el('div', { class: 'row', style: { gap: '10px' } }, [
            el('div', { class: 'field grow' }, [
              el('label', { class: 'field__label', text: '小組' }),
              el('select', { class: 'select', onchange: (e) => update({ groupId: e.target.value }) },
                s.groups.map((g) => el('option', { value: g.id, text: g.name, selected: g.id === st.groupId ? 'selected' : null }))),
            ]),
            el('div', { class: 'field grow' }, [
              el('label', { class: 'field__label', text: '寵物' }),
              el('select', { class: 'select', onchange: (e) => update({ petId: e.target.value }) },
                M.allPets().map((p) => el('option', { value: p.id, text: p.emoji + ' ' + p.name, selected: p.id === st.petId ? 'selected' : null }))),
            ]),
          ]),
          el('div', { class: 'field' }, [
            el('label', { class: 'field__label', text: '寵物暱稱（選填）' }),
            el('input', { class: 'input', value: st.petName || '', placeholder: '例如：小柴', onchange: (e) => update({ petName: e.target.value.trim().slice(0, 10) }) }),
          ]),
          el('div', { class: 'field' }, [
            el('label', { class: 'field__label', text: '身分路線（學生平常要花金幣解鎖，這裡可以直接免費贈送）' }),
            el('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } },
              (s.petPaths || []).map((p) => {
                const unlocked = (st.unlockedPaths || []).indexOf(p.id) >= 0;
                const pet = M.petById(st.petId);
                return unlocked
                  ? el('span', { class: 'pill', text: '✅ ' + M.petPathName(pet, p.id) })
                  : el('button', {
                      class: 'btn btn--ghost btn--sm', text: '🎁 贈送「' + M.petPathName(pet, p.id) + '」',
                      onclick: () => { S.giftPetPath(studentId, p.id); U.toast('已贈送「' + M.petPathName(pet, p.id) + '」路線給 ' + st.name); paintContent(); },
                    });
              })),
          ]),
        ]));
      }
    }

    paintHead();
    paintNav();
    paintContent();

    U.modal({
      title: '學生檔案',
      wide: true,
      body: el('div', {}, [headEl, el('div', { class: 'profile-layout' }, [navEl, contentEl])]),
      actions: [{ label: '關閉' }],
    });
  }

  function openRandomDraw() {
    const s = S.get();
    const pool = s.students.filter((x) => !S.isAbsent(x.id));
    if (!pool.length) return U.toast('目前沒有可以抽籤的學生', 'warn');
    const stage = el('div', { class: 'picker-stage' }, [
      el('div', { class: 'picker-stage__emoji', text: '🎲' }),
      el('div', { class: 'picker-stage__name', text: '抽籤中…' }),
      el('div', { class: 'picker-stage__meta', text: '' }),
    ]);
    const handle = U.modal({ title: '隨機抽籤', body: stage });
    stage.classList.add('is-rolling');
    let n = 0;
    const iv = setInterval(() => {
      const r = pool[Math.floor(Math.random() * pool.length)];
      stage.children[0].textContent = M.petById(r.petId).emoji;
      stage.children[1].textContent = r.name;
      stage.children[2].textContent = (S.group(r.groupId) || {}).name || '';
      if (++n > 16) {
        clearInterval(iv);
        stage.classList.remove('is-rolling');
        setTimeout(() => { handle.close(); openStudentProfile(r.id); }, 450);
      }
    }, 70);
  }

  function openTimerModal() {
    U.modal({ title: '課堂計時器', body: timerWidget() });
  }

  function openAttendance() {
    const s = S.get();
    const day = U.todayKey();
    const grid = el('div', { class: 'avatar-grid' });

    function paint() {
      grid.innerHTML = '';
      s.students.forEach((st) => {
        const absent = S.isAbsent(st.id, day);
        grid.appendChild(el('button', { class: 'avatar-card' + (absent ? ' is-absent' : ' is-on'), onclick: () => { S.setAttendance(st.id, absent ? '' : 'absent', day); paint(); } }, [
          el('div', { class: 'avatar-card__face' }, [
            M.petFace(M.petById(st.petId), 40, M.levelFromXp(st.xp).level, st.petPathId),
            el('span', { class: absent ? 'avatar-card__badge avatar-card__badge--absent' : 'avatar-card__check', text: absent ? '假' : '✓' }),
          ]),
          el('div', { class: 'avatar-card__label', text: U.pad2(st.no) + ' ' + st.name }),
        ]));
      });
    }
    paint();

    U.modal({
      title: '出席狀況・' + U.fmtDate(Date.now()),
      wide: true,
      body: el('div', { class: 'stack' }, [
        el('p', { class: 'card__sub', text: '點一下頭像切換「到校／請假」。請假的學生今天不會出現在批次加點的選取名單中。' }),
        el('div', { class: 'row', style: { gap: '8px' } }, [
          el('button', { class: 'btn btn--ghost btn--sm', text: '全部到校', onclick: () => { S.setAllAttendance(s.students.map((x) => x.id), '', day); paint(); } }),
          el('button', { class: 'btn btn--ghost btn--sm', text: '全部請假', onclick: () => { S.setAllAttendance(s.students.map((x) => x.id), 'absent', day); paint(); } }),
        ]),
        grid,
      ]),
      actions: [{ label: '完成', kind: 'primary' }],
    });
  }

  function openDailyTasksQuick() {
    const listEl = el('div', { class: 'stack' });

    function paint() {
      listEl.innerHTML = '';
      const tasks = S.get().dailyTasks;
      if (!tasks.length) {
        listEl.appendChild(el('div', { class: 'empty', text: '目前沒有設定今日任務，請到「規則設定」新增。' }));
        return;
      }
      tasks.forEach((t) => {
        const done = Math.min(t.target, Math.max(0, t.done || 0));
        listEl.appendChild(el('div', { class: 'log-row' }, [
          el('span', { style: { fontSize: '20px' }, text: t.icon }),
          el('div', { class: 'grow' }, [
            el('div', { style: { fontWeight: 700 }, text: t.title }),
            el('div', { class: 'log-row__meta', text: '已完成 ' + done + ' / ' + t.target + '・+' + t.xp + ' XP' }),
          ]),
          el('div', { class: 'qty' }, [
            el('button', {
              class: 'qty__btn qty__btn--minus', text: '−', title: '減 1',
              onclick: () => { S.commit((d) => { const dt = d.dailyTasks.find((x) => x.id === t.id); dt.done = Math.max(0, (dt.done || 0) - 1); }); paint(); },
            }),
            el('button', {
              class: 'qty__btn qty__btn--plus', text: '＋', title: '加 1',
              onclick: () => { S.commit((d) => { const dt = d.dailyTasks.find((x) => x.id === t.id); dt.done = Math.min(dt.target, (dt.done || 0) + 1); }); paint(); },
            }),
          ]),
        ]));
      });
    }
    paint();

    U.modal({
      title: '今日任務進度',
      wide: true,
      body: el('div', { class: 'stack' }, [
        el('p', { class: 'card__sub', text: '快速調整全班今日任務的完成人次，改完立即生效；學生前台的進度也會一起更新。' }),
        listEl,
      ]),
      actions: [{ label: '完成', kind: 'primary' }],
    });
  }

  function openCustomAward(ids) {
    if (!ids.length) return U.toast('請先選擇學生', 'warn');
    const label = el('input', { class: 'input', placeholder: '事由，例如：科展練習', value: '自訂加點' });
    const note = el('input', { class: 'input', placeholder: '備註（選填）' });
    const pts = el('input', { class: 'input', type: 'number', value: '2' });
    const xp = el('input', { class: 'input', type: 'number', value: '3' });
    const coins = el('input', { class: 'input', type: 'number', value: '2' });
    U.modal({
      title: '自訂點數（' + ids.length + ' 位學生）',
      body: el('div', { class: 'stack' }, [
        el('div', { class: 'field' }, [el('label', { class: 'field__label', text: '事由' }), label]),
        el('div', { class: 'field' }, [el('label', { class: 'field__label', text: '備註' }), note]),
        el('div', { class: 'row', style: { gap: '10px' } }, [
          el('div', { class: 'field grow' }, [el('label', { class: 'field__label', text: '課堂點數' }), pts]),
          el('div', { class: 'field grow' }, [el('label', { class: 'field__label', text: '寵物 XP' }), xp]),
          el('div', { class: 'field grow' }, [el('label', { class: 'field__label', text: '金幣' }), coins]),
        ]),
        el('p', { class: 'card__sub', text: '填負數即為扣點。' }),
      ]),
      actions: [
        { label: '取消' },
        {
          label: '送出', kind: 'primary',
          onClick: () => applyRule(ids, {
            id: 'custom', label: label.value.trim() || '自訂加點',
            points: Number(pts.value) || 0, xp: Number(xp.value) || 0, coins: Number(coins.value) || 0,
          }, note.value.trim()),
        },
      ],
    });
  }

  /* ================= 學生與小組 ================= */
  function pageRoster() {
    const s = S.get();
    return el('div', {}, [
      pageHead('學生與小組', '管理班級名單與分組，可批次匯入姓名。',
        el('div', { class: 'stack', style: { gap: '10px', alignItems: 'flex-end' } }, [
          el('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' } }, [
            el('button', { class: 'btn btn--ghost', text: '📋 批次匯入名單', onclick: openImportRoster }),
            el('button', { class: 'btn btn--green', text: '＋ 新增學生', onclick: () => openStudentEdit(null) }),
          ]),
          sectionJumpBar([{ id: 'roster', label: '👥 班級名單' }, { id: 'groups', label: '🚩 冒險小隊' }]),
        ])),
      el('div', { class: 'stack', style: { gap: '18px' } }, [
        sectionCard('roster', '班級名單', s.students.length + ' 位學生', [
          el('div', { class: 'tbl-wrap' }, [
            el('table', { class: 'tbl' }, [
              el('thead', {}, [el('tr', {}, [
                el('th', { text: '座號' }), el('th', { text: '姓名' }),
                el('th', { text: '小組' }), el('th', { class: 'col-hide-sm', text: '寵物' }),
                el('th', { text: '點數' }), el('th', { text: 'XP' }), el('th', { text: '金幣' }),
                el('th', { text: '寵物等級' }), el('th', { text: '操作' }),
              ])]),
              el('tbody', {}, s.students.map((st) => el('tr', {}, [
                el('td', { text: U.pad2(st.no) }),
                el('td', {}, [el('b', { text: st.name })]),
                el('td', {}, [el('select', {
                  class: 'select', style: { padding: '6px 8px' },
                  onchange: (e) => S.commit((d) => { d.students.find((x) => x.id === st.id).groupId = e.target.value; }),
                }, s.groups.map((g) => el('option', { value: g.id, text: g.name, selected: g.id === st.groupId ? 'selected' : null })))]),
                el('td', { class: 'col-hide-sm' }, [el('div', { class: 'row', style: { gap: '8px' } }, [
                  M.petFace(M.petById(st.petId), 24, M.levelFromXp(st.xp).level, st.petPathId),
                  el('span', { text: st.petName || M.petById(st.petId).name }),
                ])]),
                el('td', { text: String(st.points) }),
                el('td', { text: String(st.xp) }),
                el('td', { text: String(st.coins) }),
                el('td', { text: 'Lv.' + M.levelFromXp(st.xp).level }),
                el('td', {}, [el('div', { class: 'row', style: { gap: '6px' } }, [
                  el('button', { class: 'btn btn--ghost btn--sm', text: '編輯', onclick: () => openStudentEdit(st) }),
                  el('button', {
                    class: 'btn btn--danger btn--sm', text: '刪除',
                    onclick: () => U.confirmDialog('刪除學生', '確定要刪除「' + st.name + '」嗎？該生的紀錄會保留在點數紀錄中。', '刪除').then((ok) => {
                      if (!ok) return;
                      S.commit((d) => { d.students = d.students.filter((x) => x.id !== st.id); });
                      selected.delete(st.id);
                      U.toast('已刪除', 'warn');
                    }),
                  }),
                ])]),
              ]))),
            ]),
          ]),
        ]),
        sectionCard('groups', '冒險小隊', '小隊點數會即時累積。', [
          el('div', { class: 'stack' }, s.groups.map((g) => {
            const members = s.students.filter((x) => x.groupId === g.id);
            return el('div', { class: 'rule-edit' }, [
              el('span', { class: 'rule-edit__icon', text: g.emoji }),
              el('input', {
                class: 'input grow', value: g.name,
                onchange: (e) => S.commit((d) => { d.groups.find((x) => x.id === g.id).name = e.target.value; }),
              }),
              el('span', { class: 'pill pill--gold nowrap', text: S.groupPoints(g.id) + ' 點' }),
              el('span', { class: 'muted nowrap', style: { fontSize: '12.5px' }, text: members.length + ' 人' }),
              el('button', {
                class: 'btn btn--danger btn--sm', text: '✕',
                onclick: () => U.confirmDialog('刪除小組', '「' + g.name + '」的成員會變成未分組。', '刪除').then((ok) => {
                  if (!ok) return;
                  S.commit((d) => {
                    d.groups = d.groups.filter((x) => x.id !== g.id);
                    d.students.forEach((x) => { if (x.groupId === g.id) x.groupId = (d.groups[0] || {}).id || ''; });
                  });
                }),
              }),
            ]);
          }).concat([
            el('button', {
              class: 'btn btn--ghost', style: { width: '100%' }, text: '＋ 新增小組',
              onclick: () => {
                S.commit((d) => {
                  d.groups.push({ id: U.uid('g'), name: '新小隊 ' + (d.groups.length + 1), emoji: '🚩', color: '#4aa3d8' });
                });
              },
            }),
          ])),
        ]),
      ]),
    ]);
  }

  function openStudentEdit(st, onSaved) {
    const s = S.get();
    const name = el('input', { class: 'input', value: st ? st.name : '', placeholder: '學生姓名' });
    const no = el('input', { class: 'input', type: 'number', value: st ? st.no : s.students.length + 1 });
    const grp = el('select', { class: 'select' }, s.groups.map((g) =>
      el('option', { value: g.id, text: g.name, selected: st && st.groupId === g.id ? 'selected' : null })));
    const pet = el('select', { class: 'select' }, M.allPets().map((p) =>
      el('option', { value: p.id, text: p.emoji + ' ' + p.name, selected: st && st.petId === p.id ? 'selected' : null })));

    U.modal({
      title: st ? '編輯學生' : '新增學生',
      body: el('div', { class: 'stack' }, [
        el('div', { class: 'row', style: { gap: '10px' } }, [
          el('div', { class: 'field', style: { width: '90px' } }, [el('label', { class: 'field__label', text: '座號' }), no]),
          el('div', { class: 'field grow' }, [el('label', { class: 'field__label', text: '姓名' }), name]),
        ]),
        el('div', { class: 'row', style: { gap: '10px' } }, [
          el('div', { class: 'field grow' }, [el('label', { class: 'field__label', text: '小組' }), grp]),
          el('div', { class: 'field grow' }, [el('label', { class: 'field__label', text: '寵物' }), pet]),
        ]),
      ]),
      actions: [
        { label: '取消' },
        {
          label: '儲存', kind: 'primary',
          onClick: () => {
            const nm = name.value.trim();
            if (!nm) { U.toast('請輸入姓名', 'warn'); return true; }
            S.commit((d) => {
              if (st) {
                const t = d.students.find((x) => x.id === st.id);
                Object.assign(t, { name: nm, no: Number(no.value) || t.no, groupId: grp.value, petId: pet.value });
              } else {
                d.students.push({
                  id: U.uid('s'), no: Number(no.value) || d.students.length + 1, name: nm,
                  groupId: grp.value, petId: pet.value, petName: '', xp: 0, points: 0, coins: 0,
                  streak: 0, cosmetics: [], equipped: '', badges: [], redeemCount: 0, ruleCount: {},
                  totalPoints: 0, lastActiveAt: 0, active: true,
                });
              }
              d.students.sort((a, b) => a.no - b.no);
            });
            U.toast('已儲存');
            if (onSaved) onSaved();
          },
        },
      ],
    });
  }

  function openImportRoster() {
    const ta = el('textarea', { class: 'textarea', style: { minHeight: '220px' }, placeholder: '每行一位學生，可用「座號,姓名,小組」或只寫姓名：\n1,陳語晴,星光小隊\n2,王柏宇,森林小隊\n或\n陳語晴\n王柏宇' });
    const replace = el('input', { class: 'checkbox', type: 'checkbox' });
    U.modal({
      title: '批次匯入名單',
      wide: true,
      body: el('div', { class: 'stack' }, [
        ta,
        el('label', { class: 'row', style: { gap: '8px', cursor: 'pointer' } }, [replace, el('span', { text: '取代現有名單（原有點數會清空）' })]),
      ]),
      actions: [
        { label: '取消' },
        {
          label: '匯入', kind: 'primary',
          onClick: () => {
            const lines = ta.value.split('\n').map((l) => l.trim()).filter(Boolean);
            if (!lines.length) { U.toast('請貼上名單', 'warn'); return true; }
            S.commit((d) => {
              if (replace.checked) d.students = [];
              lines.forEach((line, i) => {
                const parts = line.split(/[,，\t]/).map((p) => p.trim());
                let no, nm, gname;
                if (parts.length >= 2 && /^\d+$/.test(parts[0])) { no = Number(parts[0]); nm = parts[1]; gname = parts[2]; }
                else { nm = parts[0]; gname = parts[1]; no = d.students.length + 1; }
                if (!nm) return;
                let g = d.groups.find((x) => x.name === gname);
                if (gname && !g) { g = { id: U.uid('g'), name: gname, emoji: '🚩', color: '#4aa3d8' }; d.groups.push(g); }
                d.students.push({
                  id: U.uid('s'), no, name: nm, groupId: (g || d.groups[i % d.groups.length] || {}).id || '',
                  petId: M.allPets()[d.students.length % M.allPets().length].id, petName: '', xp: 0, points: 0, coins: 0,
                  streak: 0, cosmetics: [], equipped: '', badges: [], redeemCount: 0, ruleCount: {},
                  totalPoints: 0, lastActiveAt: 0, active: true,
                });
              });
              d.students.sort((a, b) => a.no - b.no);
            });
            U.toast('已匯入 ' + lines.length + ' 位學生');
          },
        },
      ],
    });
  }

  /* ================= 課堂小工具 ================= */
  let timerState = { total: 300, left: 300, running: false, handle: null };

  function pageTools() {
    const s = S.get();

    /* 隨機抽點 */
    const stage = el('div', { class: 'picker-stage' }, [
      el('div', { class: 'picker-stage__emoji', text: '🎲' }),
      el('div', { class: 'picker-stage__name', text: '準備抽籤' }),
      el('div', { class: 'picker-stage__meta', text: '點下方按鈕開始' }),
    ]);
    let excludePicked = true;
    let pickedIds = [];
    let lastPicked = null;

    function roll() {
      let pool = s.students.filter((x) => !excludePicked || pickedIds.indexOf(x.id) < 0);
      if (!pool.length) { pickedIds = []; pool = s.students.slice(); U.toast('所有人都抽過了，重新開始一輪', 'warn'); }
      stage.classList.add('is-rolling');
      let n = 0;
      const iv = setInterval(() => {
        const r = pool[Math.floor(Math.random() * pool.length)];
        stage.children[0].textContent = M.petById(r.petId).emoji;
        stage.children[1].textContent = r.name;
        stage.children[2].textContent = (S.group(r.groupId) || {}).name || '';
        if (++n > 16) {
          clearInterval(iv);
          stage.classList.remove('is-rolling');
          lastPicked = r;
          pickedIds.push(r.id);
          stage.children[2].textContent = (S.group(r.groupId) || {}).name + ' · 已抽 ' + pickedIds.length + ' / ' + s.students.length;
        }
      }, 70);
    }

    return el('div', {}, [
      pageHead('課堂小工具', '隨機抽點與計時器，投影在教室螢幕上也清楚。'),
      el('div', { class: 'tool-grid' }, [
        card('隨機抽點', '抽到的同學可以直接加點。', [
          stage,
          el('div', { class: 'row', style: { gap: '10px', marginTop: '14px', flexWrap: 'wrap' } }, [
            el('button', { class: 'btn btn--primary btn--lg', text: '🎲 開始抽籤', onclick: roll }),
            el('button', { class: 'btn btn--green', text: '⭐ 給抽到的人加點', onclick: () => {
              if (!lastPicked) return U.toast('請先抽籤', 'warn');
              applyRule([lastPicked.id], s.rules[0]);
            } }),
            el('button', { class: 'btn btn--ghost', text: '↻ 重設抽過名單', onclick: () => { pickedIds = []; U.toast('已重設'); } }),
          ]),
          el('label', { class: 'row', style: { gap: '8px', marginTop: '12px', cursor: 'pointer' } }, [
            el('input', { class: 'checkbox', type: 'checkbox', checked: 'checked', onchange: (e) => { excludePicked = e.target.checked; } }),
            el('span', { class: 'muted', style: { fontSize: '13.5px' }, text: '抽過的人本輪不重複' }),
          ]),
        ]),
        card('課堂計時器', null, [timerWidget()]),
      ]),
    ]);
  }

  /* 計時器元件（課堂小工具頁與批次加點的浮動計時器共用） */
  function timerWidget() {
    const timeEl = el('div', { class: 'timer-stage__time', text: fmtTimer(timerState.left) });
    const fillEl = el('div', { class: 'timer-stage__fill', style: { width: (timerState.left / timerState.total * 100) + '%' } });
    const stageEl = el('div', { class: 'timer-stage' }, [
      timeEl,
      el('div', { class: 'timer-stage__bar' }, [fillEl]),
      el('div', { class: 'row', style: { gap: '10px', justifyContent: 'center' } }, [
        el('button', { class: 'btn btn--primary', text: '▶ 開始', onclick: () => startTimer() }),
        el('button', { class: 'btn btn--ghost', text: '⏸ 暫停', onclick: () => stopTimer() }),
        el('button', { class: 'btn btn--ghost', text: '↻ 重設', onclick: () => setTimer(timerState.total) }),
      ]),
    ]);

    function paintTimer() {
      timeEl.textContent = fmtTimer(timerState.left);
      timeEl.classList.toggle('is-warn', timerState.left <= 30);
      fillEl.style.width = (timerState.left / timerState.total * 100) + '%';
    }
    function startTimer() {
      if (timerState.running) return;
      stageEl.classList.remove('is-flash');
      timerState.running = true;
      timerState.handle = setInterval(() => {
        timerState.left = Math.max(0, timerState.left - 1);
        paintTimer();
        if (timerState.left === 0) {
          stopTimer();
          stageEl.classList.add('is-flash');
          U.toast('⏰ 時間到！');
          try { playAlarm(); } catch (e) { /* 部分瀏覽器不允許自動播放 */ }
        }
      }, 1000);
    }
    function stopTimer() {
      timerState.running = false;
      clearInterval(timerState.handle);
    }
    function setTimer(sec) {
      stopTimer();
      stageEl.classList.remove('is-flash');
      timerState.total = sec;
      timerState.left = sec;
      paintTimer();
    }

    return el('div', {}, [
      stageEl,
      el('div', { class: 'timer-presets', style: { marginTop: '14px' } },
        [1, 3, 5, 10, 15, 20].map((m) => el('button', { class: 'btn btn--ghost btn--sm', text: m + ' 分', onclick: () => setTimer(m * 60) }))),
    ]);
  }

  function fmtTimer(sec) {
    return U.pad2(Math.floor(sec / 60)) + ':' + U.pad2(sec % 60);
  }

  function playTone(freq) {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = freq || 880; gain.gain.value = 0.15;
    osc.start(); osc.stop(ctx.currentTime + 0.35);
  }

  function beep() { playTone(880); }

  function playAlarm() {
    [0, 260, 520].forEach((delay) => setTimeout(() => { try { playTone(1046); } catch (e) { /* 忽略 */ } }, delay));
  }

  /* ================= 寵物總覽 ================= */
  function pagePets() {
    const s = S.get();
    const byPet = {};
    s.students.forEach((st) => { byPet[st.petId] = (byPet[st.petId] || 0) + 1; });

    return el('div', {}, [
      pageHead('寵物總覽', '看看全班的寵物分布與成長狀況；改寵物種類、造型或收藏設定請到「紀錄與設定」的「寵物設定」。'),
      el('div', { class: 'kpi-grid' }, [
        kpi('🐾', '寵物種類', Object.keys(byPet).length + ' / ' + M.allPets().length),
        kpi('👑', '完全體以上', s.students.filter((x) => M.levelFromXp(x.xp).level >= 10).length + ' 隻'),
        kpi('🎀', '已解鎖造型', s.students.reduce((a, b) => a + (b.cosmetics || []).length, 0) + ' 件'),
      ]),
      el('div', { class: 'cols' }, [
        el('div', { class: 'stack' }, [
          card('每位學生的寵物', null, [
            el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' } },
              s.students.map((st) => {
                const lv = M.levelFromXp(st.xp);
                const pet = M.petById(st.petId);
                return el('div', { class: 'rule-edit', style: { margin: 0 } }, [
                  M.petFace(pet, 28, lv.level),
                  el('div', { class: 'grow' }, [
                    el('div', { style: { fontWeight: 800, fontSize: '13.5px' }, text: st.name }),
                    el('div', { class: 'muted', style: { fontSize: '12px' }, text: (st.petName || pet.name) + ' Lv.' + lv.level }),
                    el('div', { style: { marginTop: '4px' } }, [bar(lv.percent)]),
                  ]),
                ]);
              })),
          ]),
        ]),
        el('div', { class: 'stack' }, [
          card('寵物分布', null, [
            el('div', {}, M.allPets().map((p) => {
              const n = byPet[p.id] || 0;
              return el('div', { class: 'log-row' }, [
                M.petFace(p, 24, 1),
                el('div', { class: 'grow' }, [
                  el('div', { style: { fontWeight: 700, fontSize: '13.5px' }, text: p.name }),
                  el('div', { style: { marginTop: '4px' } }, [bar(s.students.length ? (n / s.students.length) * 100 * 3 : 0, true)]),
                ]),
                el('b', { text: n + ' 人' }),
              ]);
            })),
          ]),
        ]),
      ]),
    ]);
  }

  /* ================= 寵物設定 ================= */
  function pagePetSettings() {
    const s = S.get();

    return el('div', {}, [
      pageHead('寵物設定', '寵物種類、造型圖片、等級門檻、身分路線與收藏設定都在這裡，改完立即套用到老師後台與學生前台。'),
      el('div', { class: 'cols' }, [
        el('div', { class: 'stack' }, [
          card('🖼️ 寵物名稱與造型圖片', '名稱可以直接改；也能新增／刪除寵物種類，或設定各階段要換上的圖片，改完立即套用到老師後台與學生前台，不用寫程式。', [
            el('div', { class: 'stack' }, M.allPets().map((p) => {
              const images = (s.petImages || {})[p.id] || [];
              const withImg = images.filter(Boolean).length;
              const totalStages = (s.petStageLevels || []).length;
              const isBuiltin = M.PETS.some((bp) => bp.id === p.id);
              /* 列表前面的小圖示固定顯示 V3（分岔前的最後一階）的造型，不受路線影響、也不會因為
                 學生等級高低而跳來跳去，方便老師快速辨認每種寵物。 */
              const v3Level = ((s.petStageLevels || [])[2] || {}).minLevel || 1;
              const rarityId = p.rarity || 'common';
              return el('div', { class: 'rule-edit' }, [
                M.petFace(p, 32, v3Level),
                el('input', {
                  class: 'input grow', value: p.name, placeholder: '寵物名稱',
                  onchange: (e) => {
                    const nm = e.target.value.trim();
                    if (!nm) return;
                    if (isBuiltin) {
                      S.commit((d) => { d.petNames = d.petNames || {}; d.petNames[p.id] = nm; });
                    } else {
                      S.commit((d) => { const cp = (d.customPets || []).find((x) => x.id === p.id); if (cp) cp.name = nm; });
                    }
                  },
                }),
                el('select', {
                  class: 'select', style: { width: '92px' }, title: '稀有度（影響抽獎機率與領養金幣）',
                  onchange: (e) => S.commit((d) => {
                    if (isBuiltin) {
                      d.petRarityOverrides = d.petRarityOverrides || {};
                      d.petRarityOverrides[p.id] = e.target.value;
                    } else {
                      const cp = (d.customPets || []).find((x) => x.id === p.id);
                      if (cp) cp.rarity = e.target.value;
                    }
                  }, { silent: true }),
                },
                  (s.petRarities || []).map((r) => el('option', { value: r.id, text: r.name, selected: r.id === rarityId ? 'selected' : null }))),
                el('span', {
                  class: 'pill' + (withImg ? '' : ' pill--gray'),
                  text: totalStages + ' 個階段・' + (withImg ? withImg + ' 張圖片' : '尚無圖片，顯示 emoji'),
                }),
                el('button', { class: 'btn btn--ghost btn--sm', text: '管理圖片', onclick: () => openPetImageManager(p) }),
                el('button', { class: 'btn btn--danger btn--sm', text: '🗑️', title: '刪除這種寵物', onclick: () => openDeletePet(p) }),
              ]);
            })),
            el('button', { class: 'btn btn--green', style: { width: '100%', marginTop: '4px' }, text: '＋ 新增寵物', onclick: openAddPet }),
          ]),
        ]),
        el('div', { class: 'stack' }, [
          card('🎚️ 寵物等級門檻（全部寵物共用）', '統一設定「第幾階段、達到等級幾、階段叫什麼名字」，所有寵物都套用同一組門檻，不用每隻寵物分別輸入一次。', [
            el('div', { class: 'stack' }, (s.petStageLevels || []).map((t, idx) =>
              el('div', { class: 'rule-edit' }, [
                el('div', { class: 'field', style: { width: '80px' } }, [
                  el('label', { class: 'field__label', text: '等級' }),
                  el('input', {
                    class: 'input', type: 'number', min: '1', value: t.minLevel,
                    onchange: (e) => S.commit((d) => { d.petStageLevels[idx].minLevel = Number(e.target.value) || 1; }),
                  }),
                ]),
                el('div', { class: 'field grow' }, [
                  el('label', { class: 'field__label', text: '階段名稱' }),
                  el('input', {
                    class: 'input', value: t.name || '', placeholder: '例如：成熟體',
                    onchange: (e) => S.commit((d) => { d.petStageLevels[idx].name = e.target.value; }),
                  }),
                ]),
                el('button', {
                  class: 'btn btn--danger btn--sm', text: '✕', title: '刪除這個階段',
                  onclick: () => U.confirmDialog('刪除這個階段', '所有寵物在這個階段設定的圖片也會一起被移除。', '刪除').then((ok) => {
                    if (!ok) return;
                    S.commit((d) => {
                      d.petStageLevels.splice(idx, 1);
                      Object.keys(d.petImages || {}).forEach((id) => { if (d.petImages[id]) d.petImages[id].splice(idx, 1); });
                    });
                  }),
                }),
              ])
            )),
            el('button', {
              class: 'btn btn--ghost', style: { width: '100%' }, text: '＋ 新增階段',
              onclick: () => S.commit((d) => {
                d.petStageLevels = d.petStageLevels || [];
                const lv = d.petStageLevels.length ? Math.max.apply(null, d.petStageLevels.map((x) => x.minLevel || 1)) + 5 : 1;
                d.petStageLevels.push({ minLevel: lv, name: '' });
                Object.keys(d.petImages || {}).forEach((id) => { d.petImages[id] = (d.petImages[id] || []).concat(['']); });
              }),
            }),
          ]),
          card('🌟 身分路線名稱（班級預設）', '升到 V' + (M.PATH_BRANCH_STAGE_INDEX + 1) + '（' + ((s.petStageLevels || [])[M.PATH_BRANCH_STAGE_INDEX] || {}).name + '）後，學生會從這 ' + (s.petPaths || []).length + ' 條路線中選一條。這裡改的是全班預設名稱；如果某隻寵物的發展想取不一樣的名字，可以到該寵物「管理圖片」裡單獨設定專屬名稱。', [
            el('div', { class: 'stack' }, (s.petPaths || []).map((p, idx) =>
              el('div', { class: 'rule-edit' }, [
                el('input', {
                  class: 'input grow', value: p.name, placeholder: '路線名稱',
                  onchange: (e) => { const nm = e.target.value.trim(); if (nm) S.commit((d) => { d.petPaths[idx].name = nm; }); },
                }),
              ])
            )),
            el('div', { class: 'field', style: { maxWidth: '260px', marginTop: '14px' } }, [
              el('label', { class: 'field__label', text: '解鎖第 2、3 條路線要花多少金幣（升到 V' + (M.PATH_BRANCH_STAGE_INDEX + 1) + ' 第一次選路線一律免費）' }),
              el('input', {
                class: 'input', type: 'number', min: '0', value: String((s.settings || {}).pathUnlockCost != null ? s.settings.pathUnlockCost : 50),
                onchange: (e) => {
                  const n = Math.max(0, Math.round(Number(e.target.value) || 0));
                  S.commit((d) => { d.settings = d.settings || {}; d.settings.pathUnlockCost = n; }, { silent: true });
                },
              }),
            ]),
          ]),
          card('🎒 寵物收藏設定', '學生的主寵物升到指定等級後，就能開始花金幣「領養」指定寵物，或花金幣「抽獎」隨機獲得；每隻寵物的抽獎機率與領養價格看牠的稀有度分級。', [
            el('div', { class: 'row', style: { gap: '10px', flexWrap: 'wrap' } }, [
              el('div', { class: 'field', style: { width: '200px' } }, [
                el('label', { class: 'field__label', text: '主寵物達到幾級才能收藏' }),
                el('input', {
                  class: 'input', type: 'number', min: '1', value: String((s.settings || {}).petCollectUnlockLevel != null ? s.settings.petCollectUnlockLevel : 10),
                  onchange: (e) => {
                    const n = Math.max(1, Math.round(Number(e.target.value) || 1));
                    S.commit((d) => { d.settings = d.settings || {}; d.settings.petCollectUnlockLevel = n; }, { silent: true });
                  },
                }),
              ]),
              el('div', { class: 'field', style: { width: '160px' } }, [
                el('label', { class: 'field__label', text: '每次抽獎金幣' }),
                el('input', {
                  class: 'input', type: 'number', min: '0', value: String((s.settings || {}).gachaCost != null ? s.settings.gachaCost : 50),
                  onchange: (e) => {
                    const n = Math.max(0, Math.round(Number(e.target.value) || 0));
                    S.commit((d) => { d.settings = d.settings || {}; d.settings.gachaCost = n; }, { silent: true });
                  },
                }),
              ]),
            ]),
            el('p', { class: 'field__label', style: { marginTop: '14px' }, text: '稀有度分級（名稱／抽獎機率權重／領養金幣）' }),
            el('div', { class: 'stack' }, (s.petRarities || []).map((r, idx) =>
              el('div', { class: 'rule-edit' }, [
                el('input', {
                  class: 'input grow', value: r.name, placeholder: '分級名稱',
                  onchange: (e) => { const nm = e.target.value.trim(); if (nm) S.commit((d) => { d.petRarities[idx].name = nm; }, { silent: true }); },
                }),
                el('div', { class: 'field', style: { width: '110px' } }, [
                  el('label', { class: 'field__label', text: '抽獎權重' }),
                  el('input', {
                    class: 'input', type: 'number', min: '1', value: r.weight,
                    onchange: (e) => S.commit((d) => { d.petRarities[idx].weight = Math.max(1, Math.round(Number(e.target.value) || 1)); }, { silent: true }),
                  }),
                ]),
                el('div', { class: 'field', style: { width: '150px' } }, [
                  el('label', { class: 'field__label', text: '直接領養金幣（不透過抽獎）' }),
                  el('input', {
                    class: 'input', type: 'number', min: '0', value: r.adoptCost,
                    onchange: (e) => S.commit((d) => { d.petRarities[idx].adoptCost = Math.max(0, Math.round(Number(e.target.value) || 0)); }, { silent: true }),
                  }),
                ]),
              ])
            )),
            el('p', { class: 'card__sub', style: { marginTop: '10px' }, text: '「抽獎」跟「領養」是兩種獨立的取得方式：抽獎只要付上面的抽獎金幣、抽到誰算誰；領養則是不用抽，直接付這裡的領養金幣指定要哪一隻，兩者不會疊加收費。' }),
          ]),
        ]),
      ]),
    ]);
  }

  /* ================= 徽章管理 ================= */
  function pageBadges() {
    const s = S.get();
    const badgeCount = {};
    s.students.forEach((st) => (st.badges || []).forEach((b) => { badgeCount[b] = (badgeCount[b] || 0) + 1; }));

    return el('div', {}, [
      pageHead('🏅 徽章管理', '設定徽章的名稱、圖片與解鎖條件；符合條件的學生下次有點數異動時會自動解鎖。'),
      el('div', { class: 'kpi-grid' }, [
        kpi('🏅', '徽章總數', (s.badgeDefs || []).length + ' 枚'),
        kpi('🎉', '累計解鎖次數', Object.values(badgeCount).reduce((a, b) => a + b, 0) + ' 次'),
      ]),
      card('徽章清單', '改完立即生效，不用另外儲存。', [
        el('div', { class: 'stack' }, (s.badgeDefs || []).map((b, idx) => badgeRow(b, idx, badgeCount[b.id] || 0))),
        el('button', { class: 'btn btn--green', style: { width: '100%', marginTop: '4px' }, text: '＋ 新增徽章', onclick: openAddBadge }),
      ]),
    ]);
  }

  function badgeRow(b, idx, count) {
    const update = (patch) => S.commit((d) => { Object.assign(d.badgeDefs[idx], patch); }, { silent: true });
    const ruleOptions = S.get().rules || [];
    return el('div', { class: 'card card--flat', style: { marginBottom: '10px' } }, [
      el('div', { class: 'row', style: { gap: '14px', alignItems: 'flex-start', flexWrap: 'wrap' } }, [
        el('div', { class: 'stack', style: { gap: '6px', alignItems: 'center', width: '76px' } }, [
          M.badgeFace(b, 40),
          el('input', {
            class: 'input', style: { width: '76px', textAlign: 'center', padding: '6px' }, value: b.emoji, placeholder: 'emoji',
            onchange: (e) => update({ emoji: e.target.value.trim() }),
          }),
        ]),
        el('div', { class: 'grow stack', style: { gap: '8px', minWidth: '260px' } }, [
          el('div', { class: 'row', style: { gap: '8px' } }, [
            el('input', {
              class: 'input grow', value: b.name, placeholder: '徽章名稱',
              onchange: (e) => { const nm = e.target.value.trim(); if (nm) update({ name: nm }); },
            }),
            badgeImageUploadButton(b, (url) => update({ img: url })),
            b.img ? el('button', { class: 'btn btn--ghost btn--sm', text: '移除圖片', onclick: () => update({ img: '' }) }) : null,
          ]),
          el('input', { class: 'input', value: b.desc, placeholder: '徽章說明', onchange: (e) => update({ desc: e.target.value }) }),
          el('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', alignItems: 'center' } }, [
            el('select', {
              class: 'select', style: { width: '190px' },
              onchange: (e) => update({ statKey: e.target.value }),
            }, M.BADGE_STAT_DEFS.map((sd) => el('option', { value: sd.key, text: sd.label, selected: sd.key === b.statKey ? 'selected' : null }))),
            b.statKey === 'ruleCount'
              ? el('select', {
                  class: 'select', style: { width: '150px' },
                  onchange: (e) => update({ ruleId: e.target.value }),
                }, ruleOptions.map((r) => el('option', { value: r.id, text: r.icon + ' ' + r.label, selected: r.id === b.ruleId ? 'selected' : null })))
              : null,
            el('input', {
              class: 'input', type: 'number', min: '0', style: { width: '90px' }, value: b.value,
              onchange: (e) => update({ value: Math.max(0, Number(e.target.value) || 0) }),
            }),
            el('span', { class: 'pill', text: count + ' 人已解鎖' }),
          ]),
        ]),
        el('button', { class: 'btn btn--danger btn--sm', text: '🗑️', title: '刪除這枚徽章', onclick: () => openDeleteBadge(b) }),
      ]),
    ]);
  }

  function badgeImageUploadButton(b, onUploaded) {
    const fileInput = el('input', {
      type: 'file', accept: 'image/*', class: 'hide',
      onchange: (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        const cfg = S.getGithubConfig();
        if (!cfg.owner || !cfg.repo || !cfg.token) {
          U.toast('請先設定 GitHub 帳號、Repo 與 Token', 'warn');
          openGithubSettings();
          return;
        }
        const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
        const safeName = b.id.replace(/[^a-z0-9-]/gi, '');
        const targetPath = 'assets/img/badges/' + safeName + '.' + ext;
        U.toast('上傳中…');
        S.githubUploadImage(file, targetPath)
          .then((url) => { onUploaded(url); U.toast('已上傳並填入圖片！'); })
          .catch((err) => U.toast('上傳失敗：' + err.message, 'error'));
      },
    });
    return el('span', {}, [
      fileInput,
      el('button', { class: 'btn btn--ghost btn--sm', text: '📤 上傳圖片', title: '上傳專屬圖片到 GitHub', onclick: () => fileInput.click() }),
    ]);
  }

  function openAddBadge() {
    const name = el('input', { class: 'input', placeholder: '徽章名稱' });
    const emoji = el('input', { class: 'input', value: '🏅', placeholder: '一個 emoji，例如 🏅' });
    const desc = el('input', { class: 'input', placeholder: '徽章說明（選填）' });
    U.modal({
      title: '新增徽章',
      body: el('div', { class: 'stack' }, [
        el('div', { class: 'field' }, [el('label', { class: 'field__label', text: '名稱' }), name]),
        el('div', { class: 'field' }, [el('label', { class: 'field__label', text: '圖示 Emoji' }), emoji]),
        el('div', { class: 'field' }, [el('label', { class: 'field__label', text: '說明' }), desc]),
        el('p', { class: 'card__sub', text: '新增後可以在清單裡設定解鎖條件，或上傳專屬圖片。' }),
      ]),
      actions: [
        { label: '取消' },
        {
          label: '新增', kind: 'primary',
          onClick: () => {
            const nm = name.value.trim();
            if (!nm) { U.toast('請輸入徽章名稱', 'warn'); return true; }
            const id = U.uid('badge');
            S.commit((d) => {
              d.badgeDefs = d.badgeDefs || [];
              d.badgeDefs.push({ id, name: nm, emoji: emoji.value.trim() || '🏅', img: '', desc: desc.value.trim(), statKey: 'totalPoints', ruleId: '', value: 1 });
            });
          },
        },
      ],
    });
  }

  function openDeleteBadge(b) {
    U.confirmDialog('刪除「' + b.name + '」徽章', '已經解鎖過這枚徽章的學生，紀錄會一併移除。此動作無法復原（可以到「資料與同步」用備份檔還原）。', '刪除').then((ok) => {
      if (!ok) return;
      S.commit((d) => {
        d.badgeDefs = (d.badgeDefs || []).filter((x) => x.id !== b.id);
        d.students.forEach((st) => { st.badges = (st.badges || []).filter((x) => x !== b.id); });
      });
      U.toast('已刪除「' + b.name + '」', 'warn');
    });
  }

  /* ================= 訊息管理 ================= */
  function pageMessages() {
    const s = S.get();
    const messages = s.messages || [];

    const titleInput = el('input', { class: 'input', placeholder: '標題，例如：表現優異獎勵' });
    const bodyInput = el('textarea', { class: 'textarea', placeholder: '訊息內容' });
    const iconInput = el('input', { class: 'input', value: '📣', style: { width: '80px', textAlign: 'center' }, placeholder: 'emoji' });
    const coinsInput = el('input', { class: 'input', type: 'number', min: '0', value: '0' });
    const pointsInput = el('input', { class: 'input', type: 'number', min: '0', value: '0' });

    const modeToggle = el('div', { class: 'seg-toggle' }, [
      el('button', { class: 'seg-toggle__btn' + (msgRecipientMode === 'all' ? ' is-active' : ''), text: '📢 全班', onclick: () => { msgRecipientMode = 'all'; render(); } }),
      el('button', { class: 'seg-toggle__btn' + (msgRecipientMode === 'specific' ? ' is-active' : ''), text: '🎯 指定對象', onclick: () => { msgRecipientMode = 'specific'; render(); } }),
    ]);

    let recipientPicker = null;
    if (msgRecipientMode === 'specific') {
      const seg = el('div', { class: 'seg-toggle' }, [
        el('button', { class: 'seg-toggle__btn' + (msgTab === 'students' ? ' is-active' : ''), text: '👥 學生', onclick: () => { msgTab = 'students'; render(); } }),
        el('button', { class: 'seg-toggle__btn' + (msgTab === 'groups' ? ' is-active' : ''), text: '🚩 小組', onclick: () => { msgTab = 'groups'; render(); } }),
      ]);
      const grid = msgTab === 'groups'
        ? el('div', { class: 'avatar-grid' }, s.groups.map((g) => {
            const ids = s.students.filter((x) => x.groupId === g.id).map((x) => x.id);
            const allOn = ids.length > 0 && ids.every((id) => msgSelected.has(id));
            return avatarCard(
              el('span', { class: 'avatar-card__emoji', text: g.emoji }),
              g.name, ids.length + ' 人', allOn, false,
              () => { ids.forEach((id) => (allOn ? msgSelected.delete(id) : msgSelected.add(id))); render(); }
            );
          }))
        : el('div', { class: 'avatar-grid' }, sortStudents(s.students, s).map((st) => {
            const on = msgSelected.has(st.id);
            return avatarCard(
              M.petFace(M.petById(st.petId), 34, M.levelFromXp(st.xp).level, st.petPathId),
              U.pad2(st.no) + ' ' + st.name, null, on, false,
              () => { on ? msgSelected.delete(st.id) : msgSelected.add(st.id); render(); }
            );
          }));
      recipientPicker = el('div', { class: 'stack', style: { marginTop: '10px' } }, [
        el('div', { class: 'row', style: { justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' } }, [
          seg,
          el('span', { class: 'pill pill--gold', text: '已選 ' + msgSelected.size + ' 位' }),
        ]),
        grid,
      ]);
    }

    return el('div', {}, [
      pageHead('💬 訊息管理', '發送公告或獎勵訊息給全班、小組或指定學生；附加的金幣、星光要學生自己在訊息中心按「領取」才會真的入帳。'),
      card('發送新訊息', null, [
        el('div', { class: 'field' }, [el('label', { class: 'field__label', text: '標題' }), titleInput]),
        el('div', { class: 'field' }, [el('label', { class: 'field__label', text: '內容' }), bodyInput]),
        el('div', { class: 'row', style: { gap: '10px', flexWrap: 'wrap' } }, [
          el('div', { class: 'field', style: { width: '90px' } }, [el('label', { class: 'field__label', text: '圖示' }), iconInput]),
          el('div', { class: 'field', style: { width: '150px' } }, [el('label', { class: 'field__label', text: '附加金幣（選填）' }), coinsInput]),
          el('div', { class: 'field', style: { width: '150px' } }, [el('label', { class: 'field__label', text: '附加星光／點數（選填）' }), pointsInput]),
        ]),
        el('div', { class: 'field', style: { marginTop: '4px' } }, [el('label', { class: 'field__label', text: '發送對象' }), modeToggle]),
        recipientPicker,
        el('button', {
          class: 'btn btn--primary', style: { width: '100%', marginTop: '14px' }, text: '📨 發送',
          onclick: () => {
            const title = titleInput.value.trim();
            const body = bodyInput.value.trim();
            if (!title && !body) return U.toast('請輸入標題或內容', 'warn');
            const ids = msgRecipientMode === 'all' ? [] : Array.from(msgSelected);
            if (msgRecipientMode === 'specific' && !ids.length) return U.toast('請選擇至少一位發送對象', 'warn');
            S.sendMessage(ids, title, body, iconInput.value.trim() || '📣', {
              coins: Number(coinsInput.value) || 0, points: Number(pointsInput.value) || 0,
            });
            U.toast('已發送！');
            msgSelected = new Set();
            render();
          },
        }),
      ]),
      card('已發送訊息', null, messages.length
        ? [el('div', { class: 'stack' }, messages.slice(0, 30).map(messageHistoryRow))]
        : [el('div', { class: 'empty', text: '還沒有發送過任何訊息。' })]),
    ]);
  }

  function messageHistoryRow(m) {
    const target = !m.studentIds.length ? '全班' : m.studentIds.length + ' 位指定對象';
    const readCount = (m.readBy || []).length;
    const hasReward = (m.rewardCoins || 0) > 0 || (m.rewardPoints || 0) > 0;
    const claimCount = (m.claimedBy || []).length;
    return el('div', { class: 'log-row' }, [
      el('span', { style: { fontSize: '20px' }, text: m.icon || '📣' }),
      el('div', { class: 'grow' }, [
        el('div', { style: { fontWeight: 700 }, text: m.title || '(無標題)' }),
        el('div', { class: 'log-row__meta', text: U.fmtDateTime(m.ts) + ' · ' + target + ' · 已讀 ' + readCount + (m.studentIds.length ? '/' + m.studentIds.length : '') }),
        hasReward
          ? el('div', {
              class: 'log-row__meta',
              text: '🎁 ' + [m.rewardCoins ? '🪙' + m.rewardCoins : '', m.rewardPoints ? '⭐' + m.rewardPoints : ''].filter(Boolean).join(' ') + '　已領取 ' + claimCount,
            })
          : null,
      ]),
      el('button', { class: 'btn btn--danger btn--sm', text: '🗑️', title: '刪除這則訊息', onclick: () => openDeleteMessage(m) }),
    ]);
  }

  function openDeleteMessage(m) {
    U.confirmDialog('刪除這則訊息', '刪除後學生就看不到這則訊息了（已經領過的獎勵不會收回）。', '刪除').then((ok) => {
      if (!ok) return;
      S.commit((d) => { d.messages = (d.messages || []).filter((x) => x.id !== m.id); });
      U.toast('已刪除', 'warn');
    });
  }

  function openAddPet() {
    const name = el('input', { class: 'input', placeholder: '寵物名稱，例如：柴語錄' });
    const emoji = el('input', { class: 'input', value: '🐾', placeholder: '一個 emoji，例如 🐕' });
    const trait = el('input', { class: 'input', placeholder: '特質（選填），例如：勇氣系' });
    const desc = el('input', { class: 'input', placeholder: '簡介（選填）' });
    U.modal({
      title: '新增寵物',
      body: el('div', { class: 'stack' }, [
        el('div', { class: 'field' }, [el('label', { class: 'field__label', text: '名稱' }), name]),
        el('div', { class: 'field' }, [el('label', { class: 'field__label', text: '圖示 Emoji' }), emoji]),
        el('div', { class: 'field' }, [el('label', { class: 'field__label', text: '特質' }), trait]),
        el('div', { class: 'field' }, [el('label', { class: 'field__label', text: '簡介' }), desc]),
        el('p', { class: 'card__sub', text: '新增後可以到「管理圖片」設定 10 個等級的專屬造型圖，或先用 emoji 佔位。' }),
      ]),
      actions: [
        { label: '取消' },
        {
          label: '新增', kind: 'primary',
          onClick: () => {
            const nm = name.value.trim();
            if (!nm) { U.toast('請輸入寵物名稱', 'warn'); return true; }
            const id = U.uid('pet');
            S.commit((d) => {
              d.customPets = d.customPets || [];
              d.customPets.push({ id, name: nm, emoji: emoji.value.trim() || '🐾', img: '', trait: trait.value.trim(), desc: desc.value.trim() });
              d.petImages = d.petImages || {};
              d.petImages[id] = new Array((d.petStageLevels || []).length).fill('');
            });
            U.toast('已新增「' + nm + '」');
          },
        },
      ],
    });
  }

  function openDeletePet(pet) {
    if (M.allPets().length <= 1) return U.toast('至少要保留一種寵物', 'warn');
    const isBuiltin = M.PETS.some((bp) => bp.id === pet.id);
    const affected = S.get().students.filter((x) => x.petId === pet.id).length;
    const msg = (affected ? '目前有 ' + affected + ' 位學生選了這隻寵物，刪除後會自動換成另一隻寵物。' : '')
      + '此動作無法復原（可以到「資料與同步」用備份檔還原）。';
    U.confirmDialog('刪除「' + pet.name + '」', msg, '刪除').then((ok) => {
      if (!ok) return;
      S.commit((d) => {
        if (isBuiltin) {
          d.deletedPetIds = d.deletedPetIds || [];
          if (d.deletedPetIds.indexOf(pet.id) < 0) d.deletedPetIds.push(pet.id);
        } else {
          d.customPets = (d.customPets || []).filter((x) => x.id !== pet.id);
        }
        const fallback = (M.allPets().find((p) => p.id !== pet.id) || {}).id;
        d.students.forEach((x) => {
          if (fallback && x.petId === pet.id) x.petId = fallback;
          if (x.pets && x.pets.length) x.pets = x.pets.filter((p) => p.petId !== pet.id);
          if (x.displayPetKey && x.displayPetKey !== 'main' && !(x.pets || []).some((p) => p.id === x.displayPetKey)) x.displayPetKey = 'main';
        });
      });
      U.toast('已刪除「' + pet.name + '」', 'warn');
    });
  }

  function petImageRow(pet, t, idx, images, save, paint) {
    const img = images[idx] || '';
    const preview = img
      ? el('img', { src: img, style: { width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', background: 'var(--bg-soft)', flex: '0 0 auto' } })
      : el('span', { style: { fontSize: '26px', width: '48px', textAlign: 'center', flex: '0 0 auto' }, text: pet.emoji });
    return el('div', { class: 'rule-edit', style: { alignItems: 'flex-start' } }, [
      preview,
      el('div', { class: 'grow stack', style: { gap: '6px' } }, [
        el('div', { style: { fontWeight: 800, fontSize: '13.5px' }, text: 'Lv.' + t.minLevel + (t.name ? '・' + t.name : '') }),
        el('div', { class: 'row', style: { gap: '6px' } }, [
          el('input', {
            class: 'input grow', value: img, placeholder: 'https://… 或 assets/img/pets/xxx.png',
            onchange: (e) => { images[idx] = e.target.value.trim(); save(); paint(); },
          }),
          uploadButton(pet, t, idx, images, save, paint),
          pickButton(idx, images, save, paint),
        ]),
      ]),
    ]);
  }

  function openPetImageManager(pet) {
    const levels = S.get().petStageLevels || [];
    const branchIdx = M.PATH_BRANCH_STAGE_INDEX; // V4 開始分路線
    let images = ((S.get().petImages || {})[pet.id] || []).slice();
    while (images.length < levels.length) images.push('');

    function saveShared() {
      S.commit((d) => { d.petImages = d.petImages || {}; d.petImages[pet.id] = images.slice(); });
    }

    const paths = S.get().petPaths || [];
    let activePathId = (paths[0] || {}).id;
    const pathImagesMap = {};
    paths.forEach((p) => {
      const arr = (((S.get().petPathImages || {})[pet.id] || {})[p.id] || []).slice();
      while (arr.length < levels.length) arr.push('');
      pathImagesMap[p.id] = arr;
    });

    const sharedListEl = el('div', { class: 'stack' });
    const pathTabsEl = el('div', { class: 'tag-toggle' });
    const pathNameEl = el('div', {});
    const pathListEl = el('div', { class: 'stack' });

    function paintPathNameField() {
      pathNameEl.innerHTML = '';
      const pathId = activePathId;
      const globalName = (paths.find((p) => p.id === pathId) || {}).name || pathId;
      const customNow = ((S.get().petPathNames || {})[pet.id] || {})[pathId] || '';
      const cap = (((S.get().pathCapacity || {})[pet.id] || {})[pathId]) || 0;
      const claimed = S.petPathClaimedCount(pet.id, pathId);
      pathNameEl.appendChild(el('div', { class: 'row', style: { gap: '14px', flexWrap: 'wrap', marginTop: '10px' } }, [
        el('div', { class: 'field', style: { maxWidth: '320px' } }, [
          el('label', { class: 'field__label', text: '「' + pet.name + '」在這條路線的專屬名稱（留空就沿用班級預設）' }),
          el('input', {
            class: 'input', value: customNow, placeholder: '預設：' + globalName,
            onchange: (e) => {
              S.renamePetPath(pet.id, pathId, e.target.value.trim());
              paintPathTabs();
              paintPathNameField();
            },
          }),
        ]),
        el('div', { class: 'field', style: { width: '200px' } }, [
          el('label', { class: 'field__label', text: '班級限定名額（0＝不限，目前 ' + claimed + ' 人持有）' }),
          el('input', {
            class: 'input', type: 'number', min: '0', value: String(cap),
            onchange: (e) => {
              const n = Math.max(0, Math.round(Number(e.target.value) || 0));
              S.commit((d) => {
                d.pathCapacity = d.pathCapacity || {};
                d.pathCapacity[pet.id] = d.pathCapacity[pet.id] || {};
                d.pathCapacity[pet.id][pathId] = n;
              }, { silent: true });
              paintPathNameField();
            },
          }),
        ]),
      ]));
    }

    function paintShared() {
      sharedListEl.innerHTML = '';
      if (!levels.length) {
        sharedListEl.appendChild(el('div', { class: 'empty', style: { padding: '10px 0' }, text: '還沒有設定任何等級門檻，請先到上面「寵物等級門檻」新增。' }));
        return;
      }
      levels.forEach((t, idx) => {
        if (idx >= branchIdx) return;
        sharedListEl.appendChild(petImageRow(pet, t, idx, images, saveShared, paintShared));
      });
    }

    function paintPathTabs() {
      pathTabsEl.innerHTML = '';
      paths.forEach((p) => {
        pathTabsEl.appendChild(el('button', {
          class: p.id === activePathId ? 'is-on' : '',
          text: M.petPathName(pet, p.id),
          onclick: () => { activePathId = p.id; paintPathTabs(); paintPathNameField(); paintPathRows(); },
        }));
      });
    }

    function paintPathRows() {
      pathListEl.innerHTML = '';
      if (levels.length <= branchIdx) {
        pathListEl.appendChild(el('div', { class: 'empty', style: { padding: '10px 0' }, text: '目前的等級門檻還沒有 V4 以上的階段，請先到上面「寵物等級門檻」新增。' }));
        return;
      }
      const pathId = activePathId; // 鎖定這次畫面對應的路線，避免上傳圖片途中切分頁造成寫錯路線
      const arr = pathImagesMap[pathId];
      function savePath() {
        S.commit((d) => {
          d.petPathImages = d.petPathImages || {};
          d.petPathImages[pet.id] = d.petPathImages[pet.id] || {};
          d.petPathImages[pet.id][pathId] = arr.slice();
        });
      }
      levels.forEach((t, idx) => {
        if (idx < branchIdx) return;
        pathListEl.appendChild(petImageRow(pet, t, idx, arr, savePath, paintPathRows));
      });
    }

    paintShared();
    paintPathTabs();
    paintPathNameField();
    paintPathRows();

    U.modal({
      title: '管理「' + pet.name + '」的造型圖片',
      wide: true,
      body: el('div', { class: 'stack' }, [
        el('div', { class: 'row', style: { justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' } }, [
          el('p', { class: 'card__sub', style: { margin: 0, flex: '1 1 260px' }, text: '等級門檻是全部寵物共用的，要調整請到上面「寵物等級門檻」；這裡只設定這隻寵物在各階段要換上的圖片。' }),
          el('button', { class: 'btn btn--ghost btn--sm', text: '⚙️ GitHub 上傳設定', onclick: () => openGithubSettings() }),
        ]),
        el('p', { class: 'field__label', text: 'V1–V' + branchIdx + '（共用，不分路線）' }),
        sharedListEl,
        el('p', { class: 'field__label', style: { marginTop: '6px' }, text: 'V' + (branchIdx + 1) + '–V' + levels.length + '（依身分路線分開設定，先選路線再設定圖片）' }),
        pathTabsEl,
        pathNameEl,
        pathListEl,
      ]),
      actions: [{ label: '完成', kind: 'primary' }],
    });
  }

  function uploadButton(pet, stageLevel, idx, images, save, paint) {
    const fileInput = el('input', {
      type: 'file', accept: 'image/*', class: 'hide',
      onchange: (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        const cfg = S.getGithubConfig();
        if (!cfg.owner || !cfg.repo || !cfg.token) {
          U.toast('請先設定 GitHub 帳號、Repo 與 Token', 'warn');
          openGithubSettings();
          return;
        }
        const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
        const safeName = (pet.id + '-lv' + (stageLevel.minLevel || 1)).replace(/[^a-z0-9-]/gi, '');
        const targetPath = (cfg.path || 'assets/img/pets').replace(/\/$/, '') + '/' + pet.id + '/' + safeName + '.' + ext;
        U.toast('上傳中…');
        S.githubUploadImage(file, targetPath)
          .then((url) => { images[idx] = url; save(); paint(); U.toast('已上傳並填入網址！'); })
          .catch((err) => U.toast('上傳失敗：' + err.message, 'error'));
      },
    });
    return el('span', {}, [
      fileInput,
      el('button', { class: 'btn btn--ghost btn--sm', text: '📤 上傳', title: '上傳新圖片到 GitHub', onclick: () => fileInput.click() }),
    ]);
  }

  function pickButton(idx, images, save, paint) {
    return el('button', {
      class: 'btn btn--ghost btn--sm', text: '📂 選擇', title: '從 GitHub Repo 裡選一張已經有的圖片',
      onclick: () => openGithubPicker((url) => { images[idx] = url; save(); paint(); }),
    });
  }

  function openGithubPicker(onSelect) {
    const cfg = S.getGithubConfig();
    if (!cfg.owner || !cfg.repo || !cfg.token) {
      U.toast('請先設定 GitHub 帳號、Repo 與 Token', 'warn');
      return openGithubSettings();
    }
    let currentPath = (cfg.path || '').replace(/^\/+|\/+$/g, '');
    let triedRootFallback = false;
    const pathLabel = el('b', { text: '/' + currentPath });
    const gridEl = el('div', {});

    function load() {
      gridEl.innerHTML = '';
      gridEl.appendChild(el('div', { class: 'empty', style: { padding: '14px' }, text: '載入中…' }));
      S.githubListFiles(currentPath).then((items) => {
        pathLabel.textContent = '/' + currentPath;
        const dirs = items.filter((i) => i.type === 'dir');
        const files = items.filter((i) => i.type === 'file' && /\.(png|jpe?g|gif|webp|svg)$/i.test(i.name));
        gridEl.innerHTML = '';
        if (!dirs.length && !files.length) {
          gridEl.appendChild(el('div', { class: 'empty', style: { padding: '14px' }, text: '這個資料夾是空的，或沒有圖片檔案。' }));
        }
        gridEl.appendChild(el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(96px,1fr))', gap: '10px' } },
          dirs.map((d) => el('button', { class: 'rule-btn', onclick: () => { currentPath = d.path; load(); } }, [
            el('div', { style: { fontSize: '30px' }, text: '📁' }),
            el('div', { class: 'rule-btn__label truncate', title: d.name, text: d.name }),
          ])).concat(files.map((f) => el('button', {
            class: 'rule-btn', title: f.name,
            onclick: () => { onSelect(f.download_url); handle.close(); },
          }, [
            el('img', { src: f.download_url, style: { width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '10px' } }),
            el('div', { class: 'rule-btn__label truncate', style: { fontSize: '11px' }, text: f.name }),
          ])))
        ));
      }).catch((err) => {
        // 設定的路徑如果還沒建立（例如尚未上傳任何圖片到那個資料夾），第一次自動退回 Repo 最上層，而不是直接卡在錯誤畫面
        if (!triedRootFallback && currentPath) {
          triedRootFallback = true;
          currentPath = '';
          U.toast('找不到「' + (cfg.path || '') + '」，改從 Repo 最上層瀏覽', 'warn');
          load();
          return;
        }
        gridEl.innerHTML = '';
        gridEl.appendChild(el('div', { class: 'empty', style: { padding: '14px' }, text: '讀取失敗：' + err.message }));
      });
    }

    const handle = U.modal({
      title: '從 GitHub 選擇圖片',
      wide: true,
      body: el('div', { class: 'stack' }, [
        el('div', { class: 'row', style: { gap: '10px' } }, [
          el('button', {
            class: 'btn btn--ghost btn--sm', text: '⬆ 上一層',
            onclick: () => { if (!currentPath) return; currentPath = currentPath.split('/').slice(0, -1).join('/'); load(); },
          }),
          pathLabel,
        ]),
        gridEl,
      ]),
    });
    load();
  }

  function openGithubSettings() {
    const cfg = S.getGithubConfig();
    const owner = el('input', { class: 'input', value: cfg.owner || '', placeholder: '你的 GitHub 帳號（例如：asin0410）' });
    const repo = el('input', { class: 'input', value: cfg.repo || 'pets-score', placeholder: 'Repo 名稱' });
    const branch = el('input', { class: 'input', value: cfg.branch || 'main', placeholder: '分支，預設 main' });
    const path = el('input', { class: 'input', value: cfg.path || 'assets/img/pets', placeholder: '圖片要放的資料夾' });
    const token = el('input', { class: 'input', type: 'password', value: cfg.token || '', placeholder: 'GitHub Personal Access Token' });
    U.modal({
      title: 'GitHub 上傳設定',
      wide: true,
      body: el('div', { class: 'stack' }, [
        el('div', { class: 'row', style: { gap: '10px' } }, [
          el('div', { class: 'field grow' }, [el('label', { class: 'field__label', text: 'GitHub 帳號' }), owner]),
          el('div', { class: 'field grow' }, [el('label', { class: 'field__label', text: 'Repo 名稱' }), repo]),
        ]),
        el('div', { class: 'row', style: { gap: '10px' } }, [
          el('div', { class: 'field grow' }, [el('label', { class: 'field__label', text: '分支' }), branch]),
          el('div', { class: 'field grow' }, [el('label', { class: 'field__label', text: '圖片資料夾路徑' }), path]),
        ]),
        el('div', { class: 'field' }, [el('label', { class: 'field__label', text: 'Personal Access Token' }), token]),
        el('div', { class: 'card card--flat', style: { background: 'var(--bg-soft)' } }, [
          el('b', { text: '怎麼拿 Token？' }),
          el('ol', { class: 'muted', style: { fontSize: '13.5px', lineHeight: '1.9', paddingLeft: '20px', margin: '8px 0 0' } }, [
            el('li', { text: 'GitHub 右上角頭像 → Settings → Developer settings → Fine-grained tokens → Generate new token。' }),
            el('li', { text: 'Repository access 選「Only select repositories」，勾選這個 Repo（例如 pets-score）。' }),
            el('li', { text: 'Permissions 裡把「Contents」設成「Read and write」。' }),
            el('li', { text: '產生後複製那串 Token（只會顯示這一次），貼到上面欄位。' }),
          ]),
          el('p', { class: 'card__sub', style: { marginTop: '6px' }, text: 'Token 只會存在這台電腦的瀏覽器裡，不會出現在班級資料、雲端同步或匯出的備份檔中；換電腦要重新輸入一次。' }),
        ]),
      ]),
      actions: [
        { label: '取消' },
        {
          label: '儲存', kind: 'primary',
          onClick: () => {
            S.saveGithubConfig({
              owner: owner.value.trim(), repo: repo.value.trim(),
              branch: branch.value.trim() || 'main', path: path.value.trim() || 'assets/img/pets',
              token: token.value.trim(),
            });
            U.toast('已儲存 GitHub 設定（僅存在這台電腦）');
          },
        },
      ],
    });
  }

  /* ================= 星野主線 ================= */
  function pageStoryline() {
    const s = S.get();
    const story = s.storyline;
    const stars = S.storylineStars(s);
    const idx = S.storylineCurrentIndex(s);

    const activateDate = el('input', { class: 'input', type: 'date', value: U.todayKey() });
    const overviewCard = sectionCard('overview', '總覽', story.active ? '故事已啟用，正依目前的加分紀錄計算本篇章星光。' : '啟用後，篇章星光會從你選擇的日期開始重新計算，不影響班級既有的總星星。', [
      story.active
        ? el('div', {}, [
            el('div', { class: 'kpi-grid' }, [
              kpi('📅', '啟用日', U.fmtDate(story.activatedAt)),
              kpi('✨', '本篇章星光', stars.toLocaleString()),
              kpi('📈', '本週新增星光', S.storylineWeeklyGain(s)),
              kpi('🏁', '目前關卡', idx >= story.chapters.length ? '已全部完結' : ('第 ' + (idx + 1) + ' 關')),
            ]),
            el('button', {
              class: 'btn btn--ghost btn--sm', text: '📅 重新設定啟用日', style: { marginTop: '12px' },
              onclick: () => openResetActivationDate(story),
            }),
          ])
        : el('div', { class: 'row', style: { gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' } }, [
            el('div', { class: 'field', style: { width: '200px' } }, [
              el('label', { class: 'field__label', text: '啟用日（篇章星光從這天開始算）' }),
              activateDate,
            ]),
            el('button', {
              class: 'btn btn--green', text: '🌟 啟用星野主線', onclick: () => {
                const ts = activateDate.value ? new Date(activateDate.value + 'T00:00:00').getTime() : Date.now();
                U.confirmDialog('啟用星野主線', '啟用後，「' + U.fmtDate(ts) + '」之後產生的正數加分才會計入本篇章星光；班級既有的總星星不會被改動。', '啟用').then((ok) => {
                  if (!ok) return;
                  S.activateStoryline(ts);
                  U.toast('已啟用星野主線！');
                  render();
                });
              },
            }),
          ]),
    ]);

    const chaptersCard = sectionCard('chapters', '五關設定與任務確認', '門檻採本篇章累積星光，過關後不歸零；修改門檻或文字不會清除既有進度。', [
      el('div', { class: 'stack', style: { gap: '14px' } }, story.chapters.map((c, i) => chapterEditor(c, i, s))),
    ]);

    const clearedChapters = story.chapters.filter((c) => c.cleared);
    const historyCard = sectionCard('history', '通關與獎勵紀錄', null, [
      clearedChapters.length
        ? el('div', {}, clearedChapters.map((c) => el('div', { class: 'log-row' }, [
            c.lighthouseImg
              ? el('img', { src: c.lighthouseImg, alt: c.name, style: { width: '28px', height: '28px', objectFit: 'contain' } })
              : el('span', { style: { fontSize: '20px' }, text: c.rewardEmoji || '🏆' }),
            el('div', { class: 'grow' }, [
              el('div', { style: { fontWeight: 700 }, text: '第 ' + c.order + ' 關・' + c.name },),
              el('div', { class: 'log-row__meta', text: '通關時間：' + U.fmtDate(c.clearedAt) + '　·　獎勵：' + c.rewardTitle + (c.rewardGranted ? '（已發放）' : '') }),
            ]),
            el('button', {
              class: 'btn btn--danger btn--sm', text: '撤銷通關',
              onclick: () => U.confirmDialog(
                '撤銷「' + c.name + '」的通關',
                '這會收回這一關的通關與獎勵標記，共同任務也會恢復成「尚未完成」，學生前台會立刻恢復未過關的畫面。請確認這是你要的結果。',
                '撤銷通關'
              ).then((ok) => { if (!ok) return; S.revertChapterClear(c.id); U.toast('已撤銷「' + c.name + '」的通關', 'warn'); render(); }),
            }),
          ])))
        : el('div', { class: 'empty', text: '目前還沒有任何關卡通關。' }),
    ]);

    return el('div', {}, [
      pageHead('星野主線', '《星野守護隊：動物夥伴的遠征》——把日常加分變成全班一起闖關的冒險故事。',
        sectionJumpBar([
          { id: 'overview', label: '📊 總覽' },
          { id: 'chapters', label: '🗺️ 五關設定' },
          { id: 'history', label: '🏆 通關紀錄' },
        ])),
      el('div', { class: 'stack', style: { gap: '18px' } }, [overviewCard, chaptersCard, historyCard]),
    ]);
  }

  /* 重新設定啟用日：改的是「本篇章星光」重新計算的起算點，不是重新啟用一次全新的故事──
     已經通關的關卡不會被撤銷，但還沒通關的關卡，星光會立刻依新日期重新算一次，可能因此暴增或減少。 */
  function openResetActivationDate(story) {
    const dateInput = el('input', { class: 'input', type: 'date', value: U.todayKey(story.activatedAt) });
    U.modal({
      title: '重新設定啟用日',
      body: el('div', { class: 'stack' }, [
        el('p', { class: 'modal__text', text: '目前啟用日是 ' + U.fmtDate(story.activatedAt) + '。改成新日期後，本篇章星光會立刻依「新日期之後的加分紀錄」重新計算，可能會變多或變少。' }),
        el('p', { class: 'card__sub', text: '已經通關的關卡不會被撤銷；還沒通關的關卡，星光達標與否會馬上套用新的計算結果。' }),
        el('div', { class: 'field' }, [
          el('label', { class: 'field__label', text: '新的啟用日' }),
          dateInput,
        ]),
      ]),
      actions: [
        { label: '取消' },
        {
          label: '更新啟用日', kind: 'primary',
          onClick: () => {
            if (!dateInput.value) { U.toast('請選擇日期', 'warn'); return true; }
            const ts = new Date(dateInput.value + 'T00:00:00').getTime();
            S.activateStoryline(ts);
            U.toast('已更新啟用日為 ' + U.fmtDate(ts));
            render();
          },
        },
      ],
    });
  }

  function chapterStatus(c, idx, curIdx) {
    if (c.cleared || idx < curIdx) return { text: '✅ 已通關', cls: '' };
    if (idx > curIdx) return { text: '🔒 尚未解鎖', cls: 'pill--gray' };
    return { text: '🚀 進行中', cls: 'pill--gold' };
  }

  function chapterEditor(c, idx, s) {
    const curIdx = S.storylineCurrentIndex(s);
    const stars = S.storylineStars(s);
    const actionProgress = S.storylineChapterActionProgress(s, c.id);
    const status = chapterStatus(c, idx, curIdx);
    const upd = (patch) => S.updateChapterConfig(c.id, patch);
    const isCurrent = idx === curIdx && !c.cleared;

    const noteInput = el('input', {
      class: 'input grow', value: c.taskNote || '', placeholder: '備註（選填，例如完成方式或日期細節）',
      onchange: (e) => S.setChapterTaskDone(c.id, c.taskDone, e.target.value.trim()),
    });

    return el('div', { class: 'card card--flat chapter-block' + (c.cleared ? ' is-cleared' : '') }, [
      el('div', { class: 'row row--between', style: { flexWrap: 'wrap', gap: '10px', marginBottom: '12px' } }, [
        el('div', { class: 'row', style: { gap: '10px', alignItems: 'center' } }, [
          c.lighthouseImg
            ? el('img', { src: c.lighthouseImg, alt: c.name, style: { width: '30px', height: '30px', objectFit: 'contain' } })
            : el('span', { style: { fontSize: '22px' }, text: c.cleared ? (c.rewardEmoji || '🗼') : '🗼' }),
          el('b', { style: { fontSize: '16px' }, text: '第 ' + c.order + ' 關・' + c.name }),
        ]),
        el('span', { class: 'pill ' + status.cls, text: status.text }),
      ]),
      el('div', { class: 'row', style: { gap: '10px', flexWrap: 'wrap' } }, [
        el('div', { class: 'field', style: { width: '160px' } }, [
          el('label', { class: 'field__label', text: '關卡名稱' }),
          el('input', { class: 'input', value: c.name, onchange: (e) => upd({ name: e.target.value }) }),
        ]),
        el('div', { class: 'field', style: { width: '110px' } }, [
          el('label', { class: 'field__label', text: '建議週次' }),
          el('input', { class: 'input', type: 'number', value: c.week, onchange: (e) => upd({ week: e.target.value }) }),
        ]),
        el('div', { class: 'field', style: { width: '140px' } }, [
          el('label', { class: 'field__label', text: '累積星光門檻' }),
          el('input', { class: 'input', type: 'number', value: c.threshold, onchange: (e) => upd({ threshold: e.target.value }) }),
        ]),
        el('div', { class: 'field', style: { width: '64px' } }, [
          el('label', { class: 'field__label', text: '獎勵圖示' }),
          el('input', { class: 'input rule-edit__icon', value: c.rewardEmoji || '', onchange: (e) => upd({ rewardEmoji: e.target.value }) }),
        ]),
        el('div', { class: 'field grow', style: { minWidth: '200px' } }, [
          el('label', { class: 'field__label', text: '通關獎勵說明' }),
          el('input', { class: 'input', value: c.rewardTitle, onchange: (e) => upd({ rewardTitle: e.target.value }) }),
        ]),
      ]),
      el('div', { class: 'field', style: { marginTop: '10px' } }, [
        el('label', { class: 'field__label', text: '額外共同任務' }),
        el('input', { class: 'input', value: c.taskTitle, onchange: (e) => upd({ taskTitle: e.target.value }) }),
      ]),
      el('div', { class: 'field', style: { marginTop: '10px' } }, [
        el('label', { class: 'field__label', text: '對應的守護行動規則（用來統計行動次數與參與人數，可複選）' }),
        el('div', { class: 'tag-toggle' }, ['warmth', 'initiative', 'courage', 'revise'].map((rid) => {
          const r = s.rules.find((x) => x.id === rid);
          const active = (c.actionRuleIds || []).indexOf(rid) >= 0;
          return el('button', {
            class: active ? 'is-on' : '',
            text: r ? r.icon + ' ' + r.label : rid,
            onclick: () => {
              const cur = c.actionRuleIds || [];
              upd({ actionRuleIds: active ? cur.filter((x) => x !== rid) : cur.concat([rid]) });
            },
          });
        })),
      ]),
      el('div', { class: 'row', style: { gap: '10px', flexWrap: 'wrap', marginTop: '10px' } }, [
        el('div', { class: 'field', style: { width: '160px' } }, [
          el('label', { class: 'field__label', text: '行動次數目標（0＝不追蹤）' }),
          el('input', { class: 'input', type: 'number', value: c.actionTarget || 0, onchange: (e) => upd({ actionTarget: e.target.value }) }),
        ]),
        el('div', { class: 'field', style: { width: '160px' } }, [
          el('label', { class: 'field__label', text: '參與人數目標（0＝不追蹤）' }),
          el('input', { class: 'input', type: 'number', value: c.participantTarget || 0, onchange: (e) => upd({ participantTarget: e.target.value }) }),
        ]),
      ]),
      el('div', { class: 'row', style: { gap: '10px', flexWrap: 'wrap', marginTop: '10px' } }, [
        el('div', { class: 'field grow', style: { minWidth: '220px' } }, [
          el('label', { class: 'field__label', text: '開場劇情' }),
          el('textarea', { class: 'textarea', style: { minHeight: '56px' }, onchange: (e) => upd({ intro: e.target.value }) }, [c.intro]),
        ]),
        el('div', { class: 'field grow', style: { minWidth: '220px' } }, [
          el('label', { class: 'field__label', text: '過關劇情' }),
          el('textarea', { class: 'textarea', style: { minHeight: '56px' }, onchange: (e) => upd({ clearStory: e.target.value }) }, [c.clearStory]),
        ]),
      ]),
      el('div', { class: 'row row--between', style: { flexWrap: 'wrap', gap: '10px', marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed var(--line)' } }, [
        el('div', {}, [
          el('div', { style: { fontSize: '13px', color: 'var(--ink-mute)' }, text: '星光進度：' + stars.toLocaleString() + ' / ' + Number(c.threshold).toLocaleString() + (stars >= c.threshold ? '（已達標）' : '') }),
          (c.actionTarget > 0 || c.participantTarget > 0) ? el('div', { style: { fontSize: '13px', color: 'var(--ink-mute)', marginTop: '3px' }, text:
            [
              c.actionTarget > 0 ? '行動次數 ' + actionProgress.count + ' / ' + c.actionTarget + (actionProgress.count >= c.actionTarget ? '（已達標）' : '') : '',
              c.participantTarget > 0 ? '參與人數 ' + actionProgress.participants + ' / ' + c.participantTarget + (actionProgress.participants >= c.participantTarget ? '（已達標）' : '') : '',
            ].filter(Boolean).join('　') }) : null,
          (c.actionRuleIds || []).length && idx <= curIdx
            ? el('button', { class: 'btn btn--ghost btn--sm', style: { marginTop: '6px' }, text: '👥 全班參與狀況', onclick: () => openChapterParticipants(c) })
            : null,
        ]),
        c.cleared
          ? el('div', { class: 'stack', style: { gap: '6px', alignItems: 'flex-end' } }, [
              c.pathGifted
                ? el('span', { class: 'pill', text: '🌟 已發放身分路線獎勵' })
                : el('button', {
                    class: 'btn btn--primary btn--sm', text: '🌟 發放身分路線獎勵',
                    onclick: () => {
                      const r = S.grantChapterPathReward(c.id);
                      if (!r.ok) return U.toast(r.msg, 'warn');
                      U.toast(r.grantedCount ? '已發放給 ' + r.grantedCount + ' 位同學！' : '這一關參與的同學都已經解鎖過所有路線了', 'ok');
                      render();
                    },
                  }),
              el('button', {
                class: 'btn btn--danger btn--sm', text: '撤銷通關',
                onclick: () => U.confirmDialog('撤銷「' + c.name + '」的通關', '這會收回通關與獎勵標記，共同任務也會恢復成「尚未完成」。' + (c.pathGifted ? '（已經發放過的身分路線獎勵不會收回）' : ''), '撤銷通關')
                  .then((ok) => { if (!ok) return; S.revertChapterClear(c.id); U.toast('已撤銷通關', 'warn'); render(); }),
              }),
            ])
          : el('label', { class: 'row', style: { gap: '8px', cursor: 'pointer' } }, [
              el('input', {
                class: 'checkbox', type: 'checkbox', checked: c.taskDone ? 'checked' : null,
                onchange: (e) => { S.setChapterTaskDone(c.id, e.target.checked, noteInput.value.trim()); render(); },
              }),
              el('span', { style: { fontSize: '13.5px' }, text: '共同任務已完成' + (c.taskDone && c.taskDoneAt ? '（' + U.fmtDate(c.taskDoneAt) + '）' : '') }),
              noteInput,
            ]),
      ]),
      !c.cleared && isCurrent && stars >= c.threshold && !c.taskDone
        ? el('p', { class: 'card__sub', style: { marginTop: '8px', color: 'var(--gold)' }, text: '⭐ 星光已集滿，只差確認共同任務就能通關！' })
        : null,
    ]);
  }

  /* 全班參與狀況：座號頭像打勾表示這一關已經有對應的守護行動紀錄；點頭像直接用目前選的規則幫他加分 */
  function openChapterParticipants(c) {
    const s = S.get();
    const ruleIds = c.actionRuleIds || [];
    if (!ruleIds.length) return U.toast('這一關還沒設定對應的守護行動規則', 'warn');
    let activeRuleId = ruleIds[0];
    const grid = el('div', { class: 'avatar-grid' });
    const ruleTabs = el('div', { class: 'tag-toggle' });
    const activeLabel = el('p', { class: 'card__sub' });

    function paintRuleTabs() {
      ruleTabs.innerHTML = '';
      ruleIds.forEach((rid) => {
        const r = S.rule(rid);
        ruleTabs.appendChild(el('button', {
          class: rid === activeRuleId ? 'is-on' : '',
          text: r ? r.icon + ' ' + r.label : rid,
          onclick: () => { activeRuleId = rid; paintRuleTabs(); },
        }));
      });
      const active = S.rule(activeRuleId);
      activeLabel.textContent = '目前用來加分的規則：' + (active ? active.icon + ' ' + active.label + '（+' + active.points + ' 點）' : activeRuleId);
    }

    function paint() {
      const stats = S.storylineChapterParticipantStats(S.get(), c.id);
      grid.innerHTML = '';
      sortStudents(s.students, s).forEach((st) => {
        const stat = stats[st.id];
        const has = !!stat;
        grid.appendChild(el('button', {
          class: 'avatar-card' + (has ? ' is-on' : ''),
          title: has ? '這一關已累積 ' + stat.count + ' 次、+' + stat.points + ' 點；點一下可以再加一次' : '點一下用「' + (S.rule(activeRuleId) || {}).label + '」幫他加分',
          onclick: () => {
            const rule = S.rule(activeRuleId);
            if (!rule) return;
            applyRule([st.id], rule);
            paint();
          },
        }, [
          el('div', { class: 'avatar-card__face' }, [
            M.petFace(M.petById(st.petId), 40, M.levelFromXp(st.xp).level, st.petPathId),
            has ? el('span', { class: 'avatar-card__check', text: '✓' }) : null,
          ]),
          el('div', { class: 'avatar-card__label', text: U.pad2(st.no) + ' ' + st.name }),
          has ? el('div', { class: 'avatar-card__extra', text: '×' + stat.count + '　+' + stat.points + ' 點' }) : null,
        ]));
      });
    }

    paintRuleTabs();
    paint();
    U.modal({
      title: c.name + '・全班參與狀況',
      wide: true,
      body: el('div', { class: 'stack' }, [
        el('p', { class: 'card__sub', text: '打勾＋累積次數代表這位同學在這一關已經有對應的加分紀錄。點頭像會直接用下面選的規則幫他加分（可以重複點）。' }),
        el('div', { class: 'stack', style: { gap: '6px' } }, [
          ruleIds.length > 1 ? el('p', { class: 'field__label', text: '要用哪個規則加分：' }) : null,
          ruleIds.length > 1 ? ruleTabs : null,
          activeLabel,
        ]),
        grid,
      ]),
      actions: [{ label: '完成', kind: 'primary' }],
    });
  }

  /* ================= 點數紀錄 ================= */
  let ledgerTab = 'points';
  let ledgerFilter = { studentId: '', ruleId: '', range: 'week', showUndone: true, customFrom: '', customTo: '' };
  let attendanceWeekOffset = 0;

  const RANGE_OPTIONS = [
    { v: 'today', t: '今天' }, { v: 'yesterday', t: '昨天' },
    { v: 'week', t: '本週' }, { v: 'lastWeek', t: '上週' },
    { v: 'month', t: '本月' }, { v: 'lastMonth', t: '上個月' },
    { v: 'all', t: '全部' }, { v: 'custom', t: '自訂區間…' },
  ];

  function ledgerRange(filter) {
    const now = Date.now();
    const todayStart = U.startOfDay(now);
    switch (filter.range) {
      case 'today': return { from: todayStart, to: now + 1 };
      case 'yesterday': return { from: U.addDays(todayStart, -1), to: todayStart };
      case 'week': return { from: U.startOfWeek(now), to: now + 1 };
      case 'lastWeek': { const ws = U.startOfWeek(now); return { from: U.addDays(ws, -7), to: ws }; }
      case 'month': return { from: U.startOfMonth(now), to: now + 1 };
      case 'lastMonth': {
        const ms = U.startOfMonth(now);
        const d = new Date(ms);
        return { from: new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(), to: ms };
      }
      case 'custom': {
        const from = filter.customFrom ? U.startOfDay(new Date(filter.customFrom + 'T00:00:00').getTime()) : 0;
        const to = filter.customTo ? U.addDays(U.startOfDay(new Date(filter.customTo + 'T00:00:00').getTime()), 1) : now + 1;
        return { from, to };
      }
      default: return { from: 0, to: now + 1 };
    }
  }

  function pageLedger() {
    return el('div', {}, [
      pageHead('點數紀錄', '每一筆加扣點都留下紀錄，可依時段查詢；也能查詢每日出席狀況。'),
      el('div', { class: 'seg-toggle', style: { marginBottom: '16px' } }, [
        el('button', { class: 'seg-toggle__btn' + (ledgerTab === 'points' ? ' is-active' : ''), text: '⏱️ 點數紀錄', onclick: () => { ledgerTab = 'points'; render(); } }),
        el('button', { class: 'seg-toggle__btn' + (ledgerTab === 'attendance' ? ' is-active' : ''), text: '📋 出席記錄', onclick: () => { ledgerTab = 'attendance'; render(); } }),
      ]),
      ledgerTab === 'points' ? pageLedgerPoints() : pageLedgerAttendance(),
    ]);
  }

  function pageLedgerPoints() {
    const s = S.get();
    const { from, to } = ledgerRange(ledgerFilter);

    const rows = s.ledger
      .filter((e) => e.ts >= from && e.ts < to)
      .filter((e) => !ledgerFilter.studentId || e.studentIds.indexOf(ledgerFilter.studentId) >= 0)
      .filter((e) => !ledgerFilter.ruleId || e.ruleId === ledgerFilter.ruleId)
      .filter((e) => ledgerFilter.showUndone || !e.undone);

    const sel = (val, opts, onchange, style) =>
      el('select', { class: 'select', style: style || { maxWidth: '170px' }, onchange }, opts.map((o) =>
        el('option', { value: o.v, text: o.t, selected: o.v === val ? 'selected' : null })));

    return card(null, null, [
      el('div', { class: 'row', style: { justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '2px' } }, [
        el('p', { class: 'card__sub', text: '目前範圍共 ' + rows.length + ' 筆紀錄。' }),
      ]),
      el('div', { class: 'tbl-toolbar' }, [
        sel(ledgerFilter.range, RANGE_OPTIONS, (e) => { ledgerFilter.range = e.target.value; render(); }, { maxWidth: '130px' }),
        ledgerFilter.range === 'custom'
          ? el('div', { class: 'row', style: { gap: '6px' } }, [
              el('input', { class: 'input', type: 'date', style: { padding: '9px 10px', maxWidth: '150px' }, value: ledgerFilter.customFrom,
                onchange: (e) => { ledgerFilter.customFrom = e.target.value; render(); } }),
              el('span', { class: 'muted', text: '～' }),
              el('input', { class: 'input', type: 'date', style: { padding: '9px 10px', maxWidth: '150px' }, value: ledgerFilter.customTo,
                onchange: (e) => { ledgerFilter.customTo = e.target.value; render(); } }),
            ])
          : null,
        sel(ledgerFilter.studentId, [{ v: '', t: '全部學生' }].concat(s.students.map((x) => ({ v: x.id, t: U.pad2(x.no) + ' ' + x.name }))),
          (e) => { ledgerFilter.studentId = e.target.value; render(); }),
        sel(ledgerFilter.ruleId, [{ v: '', t: '全部規則' }].concat(s.rules.map((r) => ({ v: r.id, t: r.label }))),
          (e) => { ledgerFilter.ruleId = e.target.value; render(); }),
        el('label', { class: 'row', style: { gap: '6px', cursor: 'pointer' } }, [
          el('input', { class: 'checkbox', type: 'checkbox', checked: ledgerFilter.showUndone ? 'checked' : null,
            onchange: (e) => { ledgerFilter.showUndone = e.target.checked; render(); } }),
          el('span', { class: 'muted', style: { fontSize: '13.5px' }, text: '顯示已撤銷' }),
        ]),
        el('button', { class: 'btn btn--ghost btn--sm', style: { marginLeft: 'auto' }, text: '⬇ 匯出 CSV', onclick: () => exportCsv(rows) }),
      ]),
      el('div', { class: 'tbl-wrap' }, [
        el('table', { class: 'tbl' }, [
          el('thead', {}, [el('tr', {}, [
            el('th', { text: '時間' }), el('th', { text: '學生' }), el('th', { text: '事由' }),
            el('th', { class: 'col-hide-sm', text: '點數' }), el('th', { class: 'col-hide-sm', text: 'XP／金幣' }),
            el('th', { class: 'col-hide-sm', text: '操作者' }), el('th', { text: '' }),
          ])]),
          el('tbody', {}, rows.length ? rows.map((e) => {
            const names = e.studentIds.map((id) => (S.student(id) || {}).name).filter(Boolean);
            return el('tr', { class: e.undone ? 'is-undone' : '' }, [
              el('td', { class: 'nowrap', text: U.fmtDateTime(e.ts) }),
              el('td', { text: names.length > 2 ? names[0] + ' 等 ' + names.length + ' 人' : names.join('、') || '—' }),
              el('td', {}, [
                el('b', { text: e.label }),
                e.note ? el('div', { class: 'cell-student__meta', text: e.note }) : null,
                e.editedAt ? el('div', { class: 'cell-student__meta', text: '✏️ 已編輯' }) : null,
              ]),
              el('td', { class: 'col-hide-sm' }, [el('b', { style: { color: e.points < 0 ? 'var(--red)' : 'var(--green)' }, text: (e.points > 0 ? '+' : '') + e.points })]),
              el('td', { class: 'col-hide-sm muted', text: (e.xp ? '+' + e.xp + ' XP' : '—') + ' / ' + (e.coins ? (e.coins > 0 ? '+' : '') + e.coins : '—') }),
              el('td', { class: 'col-hide-sm muted', text: e.by || '—' }),
              el('td', {}, [e.undone
                ? el('span', { class: 'pill pill--gray', text: '已撤銷' })
                : el('div', { class: 'row', style: { gap: '6px', flexWrap: 'nowrap' } }, [
                    el('button', { class: 'btn btn--ghost btn--sm', text: '編輯', onclick: () => openEditEntry(e) }),
                    el('button', { class: 'btn btn--danger btn--sm', text: '撤銷', onclick: () => undo(e) }),
                  ])]),
            ]);
          }) : [el('tr', {}, [el('td', { colspan: '7' }, [el('div', { class: 'empty', text: '這個範圍內沒有紀錄' })])])]),
        ]),
      ]),
    ]);
  }

  function pageLedgerAttendance() {
    const s = S.get();
    const weekStart = U.addDays(U.startOfWeek(Date.now()), attendanceWeekOffset * 7);
    const days = [0, 1, 2, 3, 4, 5, 6].map((i) => U.addDays(weekStart, i));
    const dayNames = ['一', '二', '三', '四', '五', '六', '日'];
    const hasAnyRecord = days.some((d) => !!s.attendance[U.todayKey(d)]);

    const rows = s.students.map((st) => {
      let presentCount = 0;
      let recordedCount = 0;
      const cells = days.map((d) => {
        const dayRecord = s.attendance[U.todayKey(d)];
        if (!dayRecord) return el('td', { style: { textAlign: 'center' } }, [el('span', { class: 'muted', text: '—' })]);
        recordedCount += 1;
        const absent = dayRecord[st.id] === 'absent';
        if (!absent) presentCount += 1;
        return el('td', { style: { textAlign: 'center' } }, [
          el('span', { class: 'pill' + (absent ? ' pill--red' : ''), text: absent ? '請假' : '到校' }),
        ]);
      });
      const pct = recordedCount ? Math.round((presentCount / recordedCount) * 100) : null;
      return el('tr', {}, [el('td', {}, [
        el('div', { class: 'cell-student' }, [
          petCell(st, 34),
          el('div', { class: 'cell-student__name', text: U.pad2(st.no) + ' ' + st.name }),
        ]),
      ])].concat(cells).concat([
        el('td', { class: 'nowrap' }, [pct == null ? el('span', { class: 'muted', text: '—' }) : el('b', { text: pct + '%' })]),
      ]));
    });

    return card('出席記錄', '依週查詢每位學生的到校狀況；到「批次加點」頁的「出席」按鈕即可記錄。', [
      el('div', { class: 'row', style: { justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' } }, [
        el('div', { class: 'row', style: { gap: '10px' } }, [
          el('button', { class: 'btn btn--ghost btn--sm', text: '◀ 上一週', onclick: () => { attendanceWeekOffset -= 1; render(); } }),
          el('b', { text: U.fmtDate(days[0]) + ' – ' + U.fmtDate(days[6]) }),
          el('button', { class: 'btn btn--ghost btn--sm', text: '下一週 ▶', onclick: () => { attendanceWeekOffset += 1; render(); } }),
        ]),
        attendanceWeekOffset !== 0
          ? el('button', { class: 'btn btn--ghost btn--sm', text: '回到本週', onclick: () => { attendanceWeekOffset = 0; render(); } })
          : null,
      ]),
      !hasAnyRecord ? el('div', { class: 'empty', style: { padding: '18px' }, text: '這一週還沒有出席紀錄。' }) : null,
      el('div', { class: 'tbl-wrap' }, [
        el('table', { class: 'tbl' }, [
          el('thead', {}, [el('tr', {}, [el('th', { text: '學生' })]
            .concat(dayNames.map((n, i) => el('th', { style: { textAlign: 'center' }, text: n + ' ' + U.fmtDate(days[i]).slice(5) })))
            .concat([el('th', { text: '到校率' })]))]),
          el('tbody', {}, rows),
        ]),
      ]),
    ]);
  }

  function exportCsv(rows) {
    const head = ['時間', '學生', '事由', '點數', 'XP', '金幣', '操作者', '備註', '狀態'];
    const lines = [head.join(',')].concat(rows.map((e) => {
      const names = e.studentIds.map((id) => (S.student(id) || {}).name).filter(Boolean).join('、');
      return [U.fmtDateTime(e.ts), names, e.label, e.points, e.xp || 0, e.coins || 0, e.by || '', e.note || '', e.undone ? '已撤銷' : '有效']
        .map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(',');
    }));
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: '點數紀錄_' + U.todayKey() + '.csv' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    U.toast('已匯出 CSV');
  }

  /* ================= 兌換管理 ================= */
  function pageRedeem() {
    const s = S.get();
    return el('div', {}, [
      pageHead('兌換管理', '學生在前台兌換後會出現在這裡，發放完成請標記已領取。',
        el('span', { class: 'pill pill--gold', text: s.redeems.filter((r) => r.status === 'pending').length + ' 筆待處理' })),
      el('div', { class: 'cols' }, [
        card('兌換申請', null, [
          s.redeems.length
            ? el('div', {}, s.redeems.map((r) => {
                const st = S.student(r.studentId);
                return el('div', { class: 'log-row' }, [
                  el('span', { style: { fontSize: '20px' }, text: '🎁' }),
                  el('div', { class: 'grow' }, [
                    el('div', { class: 'log-row__name', text: (st ? st.name : '—') + ' · ' + r.itemName }),
                    el('div', { class: 'log-row__meta', text: U.fmtDateTime(r.ts) + ' · ⭐ ' + r.cost + ' 點' }),
                  ]),
                  r.status === 'pending'
                    ? el('div', { class: 'row', style: { gap: '6px' } }, [
                        el('button', { class: 'btn btn--green btn--sm', text: '已領取', onclick: () => {
                          S.commit((d) => { d.redeems.find((x) => x.id === r.id).status = 'done'; });
                          U.toast('已標記領取');
                        } }),
                        el('button', { class: 'btn btn--danger btn--sm', text: '退回', onclick: () => {
                          U.confirmDialog('退回兌換', '退回後會把 ' + r.cost + ' 點還給學生。', '退回').then((ok) => {
                            if (!ok) return;
                            S.commit((d) => {
                              const t = d.students.find((x) => x.id === r.studentId);
                              if (t) t.points += r.cost;
                              const item = d.shop.find((i) => i.id === r.itemId);
                              if (item) item.stock += 1;
                              d.redeems = d.redeems.filter((x) => x.id !== r.id);
                            });
                            U.toast('已退回並回沖點數', 'warn');
                          });
                        } }),
                      ])
                    : el('span', { class: 'pill', text: '已領取' }),
                ]);
              }))
            : el('div', { class: 'empty' }, [el('div', { class: 'empty__icon', text: '🎁' }), el('div', { text: '目前沒有兌換申請' })]),
        ]),
        card('商店存量', null, [
          el('div', {}, s.shop.map((i) => el('div', { class: 'log-row' }, [
            el('span', { style: { fontSize: '20px' }, text: i.icon }),
            el('div', { class: 'grow' }, [
              el('div', { style: { fontWeight: 700 }, text: i.name }),
              el('div', { class: 'log-row__meta', text: '⭐ ' + i.cost + ' 點' }),
            ]),
            el('input', {
              class: 'input', type: 'number', style: { width: '80px' }, value: i.stock,
              onchange: (e) => S.commit((d) => { d.shop.find((x) => x.id === i.id).stock = Number(e.target.value) || 0; }),
            }),
          ]))),
        ]),
      ]),
    ]);
  }

  /* ================= 排行榜 ================= */
  function pageBoard() {
    const s = S.get();
    const medal = (i) => ['🥇', '🥈', '🥉'][i] || String(i + 1);

    function list(items, valueFn, metaFn) {
      return el('div', {}, items.map((x, i) => el('div', { class: 'lead-row' + (i < 3 ? ' lead-row--' + (i + 1) : '') }, [
        el('span', { class: 'lead-row__medal', text: medal(i) }),
        x.emoji ? el('span', { style: { fontSize: '22px' }, text: x.emoji }) : M.petFace(M.petById(x.petId), 22, M.levelFromXp(x.xp).level, x.petPathId),
        el('div', { class: 'grow' }, [
          el('div', { style: { fontWeight: 800 }, text: x.name }),
          el('div', { class: 'log-row__meta', text: metaFn ? metaFn(x) : '' }),
        ]),
        el('span', { class: 'lead-row__val', text: valueFn(x) }),
      ])));
    }

    const byPoints = s.students.slice().sort((a, b) => b.points - a.points).slice(0, 10);
    const byWeek = s.students.map((x) => Object.assign({}, x, { gain: S.weeklyGain(x.id) })).sort((a, b) => b.gain - a.gain).slice(0, 10);
    const byLevel = s.students.slice().sort((a, b) => b.xp - a.xp).slice(0, 10);
    const byGroup = s.groups.map((g) => Object.assign({}, g, { pts: S.groupPoints(g.id) })).sort((a, b) => b.pts - a.pts);

    return el('div', {}, [
      pageHead('排行榜', '建議搭配「本週進步」一起看，讓起步慢的孩子也有被看見的機會。',
        el('label', { class: 'row', style: { gap: '8px', cursor: 'pointer' } }, [
          el('input', { class: 'checkbox', type: 'checkbox', checked: s.settings.showRank ? 'checked' : null,
            onchange: (e) => S.commit((d) => { d.settings.showRank = e.target.checked; }) }),
          el('span', { class: 'muted', style: { fontSize: '13.5px' }, text: '在學生前台顯示名次' }),
        ])),
      el('div', { class: 'lead-grid' }, [
        card('課堂點數 Top 10', null, [list(byPoints, (x) => x.points + ' 點', (x) => (S.group(x.groupId) || {}).name)]),
        card('本週進步 Top 10', '只看這一週的成長，鼓勵每個人的起點不同。', [list(byWeek, (x) => '+' + x.gain, (x) => (S.group(x.groupId) || {}).name)]),
        card('寵物等級 Top 10', null, [list(byLevel, (x) => 'Lv.' + M.levelFromXp(x.xp).level, (x) => x.petName || M.petById(x.petId).name)]),
        card('小隊總點數', null, [list(byGroup, (x) => x.pts + ' 點', (x) => s.students.filter((y) => y.groupId === x.id).length + ' 人')]),
      ]),
    ]);
  }

  /* ================= 規則設定 ================= */
  function pageRules() {
    const s = S.get();

    function ruleRow(r) {
      const upd = (patch) => S.commit((d) => Object.assign(d.rules.find((x) => x.id === r.id), patch), { silent: true });
      return el('div', { class: 'rule-edit' }, [
        el('input', { class: 'input rule-edit__icon', value: r.icon, onchange: (e) => upd({ icon: e.target.value }) }),
        el('input', { class: 'input grow', value: r.label, onchange: (e) => upd({ label: e.target.value }) }),
        el('input', { class: 'input rule-edit__num', type: 'number', value: r.points, title: '課堂點數', onchange: (e) => upd({ points: Number(e.target.value) || 0 }) }),
        el('input', { class: 'input rule-edit__num', type: 'number', value: r.xp, title: '寵物 XP', onchange: (e) => upd({ xp: Number(e.target.value) || 0 }) }),
        el('input', { class: 'input rule-edit__num', type: 'number', value: r.coins, title: '金幣', onchange: (e) => upd({ coins: Number(e.target.value) || 0 }) }),
        el('select', {
          class: 'input rule-edit__cat', title: '分類（桌面小工具會依這個分類分區顯示）',
          onchange: (e) => upd({ category: e.target.value }),
        }, M.RULE_CATEGORIES.map((c) => el('option', { value: c.id, text: c.label, selected: (r.category || 'class') === c.id }))),
        el('button', { class: 'btn btn--danger btn--sm', text: '✕', onclick: () => {
          S.commit((d) => { d.rules = d.rules.filter((x) => x.id !== r.id); });
        } }),
      ]);
    }

    function shopRow(i) {
      const upd = (patch) => S.commit((d) => Object.assign(d.shop.find((x) => x.id === i.id), patch), { silent: true });
      return el('div', { class: 'rule-edit' }, [
        el('input', { class: 'input rule-edit__icon', value: i.icon, onchange: (e) => upd({ icon: e.target.value }) }),
        el('div', { class: 'grow stack', style: { gap: '6px' } }, [
          el('input', { class: 'input', value: i.name, onchange: (e) => upd({ name: e.target.value }) }),
          el('input', { class: 'input', value: i.desc || '', placeholder: '說明', onchange: (e) => upd({ desc: e.target.value }) }),
        ]),
        el('input', { class: 'input rule-edit__num', type: 'number', value: i.cost, title: '需要點數', onchange: (e) => upd({ cost: Number(e.target.value) || 0 }) }),
        el('input', { class: 'input rule-edit__num', type: 'number', value: i.stock, title: '數量', onchange: (e) => upd({ stock: Number(e.target.value) || 0 }) }),
        el('button', { class: 'btn btn--danger btn--sm', text: '✕', onclick: () => S.commit((d) => { d.shop = d.shop.filter((x) => x.id !== i.id); }) }),
      ]);
    }

    function taskRow(t) {
      const upd = (patch) => S.commit((d) => Object.assign(d.dailyTasks.find((x) => x.id === t.id), patch), { silent: true });
      return el('div', { class: 'rule-edit' }, [
        el('input', { class: 'input rule-edit__icon', value: t.icon, onchange: (e) => upd({ icon: e.target.value }) }),
        el('input', { class: 'input grow', value: t.title, onchange: (e) => upd({ title: e.target.value }) }),
        el('input', { class: 'input rule-edit__num', type: 'number', value: t.done, title: '已完成', onchange: (e) => upd({ done: Number(e.target.value) || 0 }) }),
        el('input', { class: 'input rule-edit__num', type: 'number', value: t.target, title: '全班目標', onchange: (e) => upd({ target: Number(e.target.value) || 0 }) }),
        el('input', { class: 'input rule-edit__num', type: 'number', value: t.xp, title: '達成後的 XP（目前僅顯示於學生前台，尚未自動發放）', onchange: (e) => upd({ xp: Number(e.target.value) || 0 }) }),
        el('button', { class: 'btn btn--danger btn--sm', text: '✕', onclick: () => S.commit((d) => { d.dailyTasks = d.dailyTasks.filter((x) => x.id !== t.id); }) }),
      ]);
    }

    return el('div', {}, [
      pageHead('規則設定', '自訂加分規則、兌換商店與每日任務，改完立即生效。',
        sectionJumpBar([
          { id: 'tasks', label: '📗 今日任務' },
          { id: 'rules', label: '⭐ 加分規則' },
          { id: 'shop', label: '🎁 兌換商店' },
        ])),
      el('div', { class: 'stack', style: { gap: '18px' } }, [
        sectionCard('tasks', '今日任務', '欄位依序為：圖示、名稱、已完成、全班目標、達成後的 XP（目前僅顯示於學生前台，尚未自動加總發放）。', [
          el('div', {}, s.dailyTasks.map(taskRow)),
          el('button', { class: 'btn btn--ghost', style: { width: '100%' }, text: '＋ 新增任務', onclick: () => {
            S.commit((d) => d.dailyTasks.push({ id: U.uid('dt'), title: '新任務', icon: '📌', xp: 2, target: d.students.length, done: 0 }));
          } }),
        ]),
        sectionCard('rules', '加分規則', '欄位依序為：圖示、名稱、點數、XP、金幣。', [
          el('div', {}, s.rules.map(ruleRow)),
          el('button', { class: 'btn btn--ghost', style: { width: '100%' }, text: '＋ 新增規則', onclick: () => {
            S.commit((d) => d.rules.push({ id: U.uid('r'), label: '新規則', icon: '⭐', points: 1, xp: 2, coins: 1, kind: 'add', category: 'class' }));
          } }),
        ]),
        sectionCard('shop', '兌換商店', '學生用課堂點數兌換。', [
          el('div', {}, s.shop.map(shopRow)),
          el('button', { class: 'btn btn--ghost', style: { width: '100%' }, text: '＋ 新增商品', onclick: () => {
            S.commit((d) => d.shop.push({ id: U.uid('sh'), name: '新獎勵', icon: '🎁', cost: 30, stock: 5, desc: '' }));
          } }),
        ]),
      ]),
    ]);
  }

  /* ================= 班級設定 ================= */
  function pageSettings() {
    const s = S.get();

    /* ---- 班級資訊與共同任務 ---- */
    const ci = s.classInfo;
    const info = (key, label, type) => el('div', { class: 'field' }, [
      el('label', { class: 'field__label', text: label }),
      el('input', {
        class: 'input', type: type || 'text', value: ci[key] || '',
        oninput: (e) => {
          S.commit((d) => { d.classInfo[key] = e.target.value; }, { silent: true });
          renderTopbar();
          const t = $('.page-title');
          if (t) t.textContent = S.get().classInfo.teacher + ' 的 ' + S.get().classInfo.className;
        },
      }),
    ]);
    const mission = s.classMission;
    const mUpd = (patch) => S.commit((d) => Object.assign(d.classMission, patch), { silent: true });

    const classInfoCard = card('🏫 班級資訊與共同任務', null, [
      el('div', { class: 'stack' }, [
        info('school', '學校'), info('className', '班級'), info('teacher', '老師'), info('term', '篇章名稱'),
        el('div', { class: 'field' }, [
          el('label', { class: 'field__label', text: '共同任務名稱' }),
          el('input', { class: 'input', value: mission.title, onchange: (e) => mUpd({ title: e.target.value }) }),
        ]),
        el('div', { class: 'row', style: { gap: '10px' } }, [
          el('div', { class: 'field grow' }, [
            el('label', { class: 'field__label', text: '目前進度' }),
            el('input', { class: 'input', type: 'number', value: mission.progress, onchange: (e) => mUpd({ progress: Number(e.target.value) || 0 }) }),
          ]),
          el('div', { class: 'field grow' }, [
            el('label', { class: 'field__label', text: '目標點數' }),
            el('input', { class: 'input', type: 'number', value: mission.target, onchange: (e) => mUpd({ target: Number(e.target.value) || 1 }) }),
          ]),
        ]),
        el('div', { class: 'field' }, [
          el('label', { class: 'field__label', text: '完成獎勵' }),
          el('input', { class: 'input', value: mission.reward || '', onchange: (e) => mUpd({ reward: e.target.value }) }),
        ]),
        el('p', { class: 'card__sub', text: '以上欄位邊打邊存，不需另外按儲存。' }),
      ]),
    ]);

    /* ---- 重設點數／重新開始 ---- */
    const resetCard = card('🔄 重設點數 / 重新開始', '新學期可以清空點數，保留學生名單。', [
      el('div', { class: 'row', style: { gap: '10px', flexWrap: 'wrap' } }, [
        el('button', { class: 'btn btn--danger', text: '清空點數（保留名單）', onclick: () => {
          const storyWarn = S.get().storyline && S.get().storyline.active
            ? '「星野主線」的啟用狀態與五關進度也會一起被清空，之後要重新啟用才能繼續累積篇章星光。'
            : '';
          U.confirmDialog('清空點數', '所有點數、金幣、經驗與紀錄都會歸零，學生名單與分組保留。' + storyWarn, '清空').then((ok) => {
            if (!ok) return;
            S.resetAll(true); U.toast('已重設', 'warn'); render();
          });
        } }),
        el('button', { class: 'btn btn--danger', text: '完全重設（回到示範資料）', onclick: () => {
          U.confirmDialog('完全重設', '會回到內建的示範班級資料，此動作無法復原。', '重設').then((ok) => {
            if (!ok) return;
            S.resetAll(false); U.toast('已重設為示範資料', 'warn'); render();
          });
        } }),
      ]),
    ]);

    return el('div', {}, [
      pageHead('班級設定', '班級資訊與共同任務的故事線，還有重設選項都放在這裡。'),
      el('div', { class: 'set-grid' }, [classInfoCard, resetCard]),
    ]);
  }

  /* ================= 系統設定 ================= */
  function pageSystemSettings() {
    const s = S.get();

    /* ---- 顯示設定 ---- */
    const setUpd = (key, val) => S.commit((d) => { d.settings = d.settings || {}; d.settings[key] = val; });

    function radioRow(key, options, fallback) {
      const current = (s.settings && s.settings[key]) || fallback;
      return el('div', { class: 'tag-toggle' }, options.map((o) =>
        el('button', { class: current === o.id ? 'is-on' : '', text: o.label, onclick: () => setUpd(key, o.id) })
      ));
    }

    function checkRow(key, label, defaultVal) {
      const current = s.settings && key in s.settings ? s.settings[key] : defaultVal;
      return el('label', { class: 'row', style: { gap: '8px', cursor: 'pointer', marginTop: '6px' } }, [
        el('input', { class: 'checkbox', type: 'checkbox', checked: current ? 'checked' : null, onchange: (e) => setUpd(key, e.target.checked) }),
        el('span', { style: { fontSize: '13.5px' }, text: label }),
      ]);
    }

    /* 多選標籤：可以同時勾選好幾個選項；選「不顯示」會清空其他選項，反之亦然 */
    function multiCheckRow(key, options, defaultArr) {
      const current = (s.settings && Array.isArray(s.settings[key]) && s.settings[key].length) ? s.settings[key] : defaultArr;
      return el('div', { class: 'tag-toggle' }, options.map((o) => {
        const active = current.indexOf(o.id) >= 0;
        return el('button', {
          class: active ? 'is-on' : '',
          text: o.label,
          onclick: () => {
            let next;
            if (o.id === 'none') {
              next = active ? [] : ['none'];
            } else {
              next = active ? current.filter((x) => x !== o.id) : current.filter((x) => x !== 'none').concat([o.id]);
            }
            setUpd(key, next);
          },
        });
      }));
    }

    const sizeRow = el('div', { class: 'tag-toggle' }, Object.keys(AVATAR_SIZES).map((id) => {
      const active = ((s.settings && s.settings.avatarCardSize) || 'md') === id;
      return el('button', {
        class: active ? 'is-on' : '',
        text: AVATAR_SIZE_LABELS[id] + '（' + AVATAR_SIZES[id] + 'px）',
        onclick: () => setUpd('avatarCardSize', id),
      });
    }));

    const displayCard = sectionCard('display', '🎨 顯示設定', '調整批次加點頁的顯示方式，改完立即生效（參考 ClassDojo 的 Display 設定整理）。', [
      el('div', { class: 'stack' }, [
        el('div', { class: 'field' }, [el('label', { class: 'field__label', text: '學生頭像大小' }), sizeRow]),
        el('div', { class: 'field' }, [
          el('label', { class: 'field__label', text: '頭像外框' }),
          checkRow('avatarFrame', '顯示圓形外框（關閉後只放大圖片本身，外框不會跟著變大）', true),
        ]),
        el('div', { class: 'field' }, [
          el('label', { class: 'field__label', text: '學生排序方式' }),
          radioRow('studentOrder', [{ id: 'no', label: '依座號' }, { id: 'name', label: '依姓名' }], 'no'),
        ]),
        el('div', { class: 'field' }, [
          el('label', { class: 'field__label', text: '頭像徽章顯示內容（可複選，第一個會顯示在圓形徽章上，其餘顯示在名字下方）' }),
          multiCheckRow('avatarBadgeStats', [
            { id: 'points', label: '課堂點數' }, { id: 'coins', label: '金幣' },
            { id: 'level', label: '寵物等級' }, { id: 'none', label: '不顯示' },
          ], ['points']),
        ]),
        el('div', { class: 'field' }, [
          el('label', { class: 'field__label', text: '學生名稱顯示' }),
          checkRow('showStudentNo', '在姓名前顯示座號（例如：01 陳語晴）', true),
        ]),
        el('div', { class: 'field' }, [
          el('label', { class: 'field__label', text: '加點提示訊息' }),
          checkRow('notifyAward', '加點時顯示提示訊息', true),
          checkRow('notifyDeduct', '扣點時顯示提示訊息', true),
        ]),
        el('div', { class: 'field' }, [
          el('label', { class: 'field__label', text: '加點音效' }),
          checkRow('soundAward', '加點時播放音效', false),
          checkRow('soundDeduct', '扣點時播放音效', false),
        ]),
        el('div', { class: 'field' }, [
          el('label', { class: 'field__label', text: '浮動加點選單' }),
          checkRow('showBatchBar', '在批次加點頁選了學生後，切到其他頁面時，畫面下方顯示浮動的快速加點選單', true),
        ]),
      ]),
    ]);

    /* ---- 批次加點底部工具列的項目 ---- */
    const allTools = M.TOOLBAR_TOOLS.map((t) => ({ id: t.id, icon: t.icon, label: t.label }))
      .concat(s.rules.map((r) => ({ id: r.id, icon: r.icon, label: r.label })));
    const order = (s.toolbar && s.toolbar.length ? s.toolbar : M.DEFAULT_TOOLBAR).filter((id) => allTools.some((t) => t.id === id));
    const hidden = allTools.filter((t) => order.indexOf(t.id) < 0).map((t) => t.id);

    function moveToolbar(idx, dir) {
      S.commit((d) => {
        const arr = (d.toolbar && d.toolbar.length ? d.toolbar : M.DEFAULT_TOOLBAR.slice()).slice();
        const j = idx + dir;
        if (j < 0 || j >= arr.length) return;
        const tmp = arr[idx]; arr[idx] = arr[j]; arr[j] = tmp;
        d.toolbar = arr;
      });
    }
    function hideToolbarItem(idx) {
      S.commit((d) => {
        const arr = (d.toolbar && d.toolbar.length ? d.toolbar : M.DEFAULT_TOOLBAR.slice()).slice();
        arr.splice(idx, 1);
        d.toolbar = arr;
      });
    }
    function showToolbarItem(id) {
      S.commit((d) => {
        const arr = (d.toolbar && d.toolbar.length ? d.toolbar : M.DEFAULT_TOOLBAR.slice()).slice();
        arr.push(id);
        d.toolbar = arr;
      });
    }

    const toolbarCard = sectionCard('toolbar', '⭐ 批次加點的底部工具列', '前 6 個項目會排在第一排，其餘收在「更多」裡；可以隱藏、加入或調整順序。', [
      el('div', { class: 'stack' }, order.map((id, idx) => {
        const tool = allTools.find((t) => t.id === id);
        if (!tool) return null;
        return el('div', { class: 'rule-edit' }, [
          el('span', { class: 'rule-edit__icon', text: tool.icon }),
          el('span', { class: 'grow', text: tool.label + (idx < 6 ? '' : '（第二排）') }),
          el('button', { class: 'btn btn--ghost btn--sm', text: '▲', title: '上移', onclick: () => moveToolbar(idx, -1) }),
          el('button', { class: 'btn btn--ghost btn--sm', text: '▼', title: '下移', onclick: () => moveToolbar(idx, 1) }),
          el('button', { class: 'btn btn--danger btn--sm', text: '隱藏', onclick: () => hideToolbarItem(idx) }),
        ]);
      })),
      hidden.length ? el('p', { class: 'card__sub', style: { marginTop: '14px' }, text: '未顯示的項目：' }) : null,
      hidden.length ? el('div', { class: 'stack' }, hidden.map((id) => {
        const tool = allTools.find((t) => t.id === id);
        if (!tool) return null;
        return el('div', { class: 'rule-edit' }, [
          el('span', { class: 'rule-edit__icon', text: tool.icon }),
          el('span', { class: 'grow', text: tool.label }),
          el('button', { class: 'btn btn--green btn--sm', text: '＋ 加入面板', onclick: () => showToolbarItem(id) }),
        ]);
      })) : null,
    ]);

    return el('div', {}, [
      pageHead('系統設定', '顯示樣式與批次加點的底部工具列都放在這裡，參考 ClassDojo 的「Options」選單整理，改完立即生效。',
        sectionJumpBar([{ id: 'display', label: '🎨 顯示設定' }, { id: 'toolbar', label: '⭐ 底部工具列' }])),
      el('div', { class: 'stack', style: { gap: '18px' } }, [displayCard, toolbarCard]),
    ]);
  }

  /* ================= 資料與同步 ================= */
  function pageSync() {
    const cfg = S.getConfig();
    const urlInput = el('input', { class: 'input', value: cfg.sheetUrl || '', placeholder: 'https://script.google.com/macros/s/..../exec' });
    const keyInput = el('input', { class: 'input', value: cfg.classKey || 'default', placeholder: '班級代號，例如 501' });
    const status = el('div', { class: 'pill ' + (cfg.mode === 'sheet' ? '' : 'pill--gray'), text: cfg.mode === 'sheet' ? '☁️ 雲端模式' : '💻 本機模式' });

    const fileInput = el('input', { type: 'file', accept: '.json', class: 'hide', onchange: (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try { S.importJson(reader.result); U.toast('已匯入備份'); }
        catch (err) { U.toast('匯入失敗：' + err.message, 'error'); }
      };
      reader.readAsText(f);
    } });

    return el('div', {}, [
      pageHead('資料與同步', '選擇資料要存在這台裝置，或同步到你的 Google 試算表。', status),
      el('div', { class: 'set-grid' }, [
        card('Google Sheets 同步', '電腦、手機、平板都連到同一份試算表，資料即時同步。', [
          el('div', { class: 'stack' }, [
            el('div', { class: 'field' }, [el('label', { class: 'field__label', text: 'Apps Script 網頁應用程式網址' }), urlInput]),
            el('div', { class: 'field' }, [el('label', { class: 'field__label', text: '班級代號（同一份試算表可放多個班級）' }), keyInput]),
            el('div', { class: 'row', style: { gap: '10px', flexWrap: 'wrap' } }, [
              el('button', { class: 'btn btn--green', text: '🔗 連線並同步', onclick: () => {
                const url = urlInput.value.trim();
                if (!/^https:\/\/script\.google\.com\//.test(url)) return U.toast('請貼上 Apps Script 的 /exec 網址', 'warn');
                U.toast('連線中…');
                S.connectSheet(url, keyInput.value.trim())
                  .then(() => { U.toast('已連線 Google Sheets'); render(); })
                  .catch((err) => U.toast(err.message, 'error'));
              } }),
              el('button', { class: 'btn btn--ghost', text: '⬆ 立即上傳', onclick: () => S.pushRemote().then(() => U.toast('已上傳')).catch((e) => U.toast(e.message, 'error')) }),
              el('button', { class: 'btn btn--ghost', text: '⬇ 立即下載', onclick: () => S.pullRemote().then(() => { U.toast('已下載'); render(); }).catch((e) => U.toast(e.message, 'error')) }),
              el('button', { class: 'btn btn--ghost', text: '💻 改回本機模式', onclick: () => { S.useLocal(); U.toast('已切換為本機模式'); render(); } }),
            ]),
            el('div', { class: 'card card--flat', style: { background: 'var(--bg-soft)' } }, [
              el('b', { text: '設定步驟' }),
              el('ol', { class: 'muted', style: { fontSize: '13.5px', lineHeight: '1.9', paddingLeft: '20px', margin: '8px 0 0' } }, [
                el('li', { text: '建立一份新的 Google 試算表。' }),
                el('li', { text: '點「擴充功能 → Apps Script」，把專案資料夾裡 apps-script/Code.gs 的內容整份貼上。' }),
                el('li', { text: '點「部署 → 新增部署作業 → 類型選「網頁應用程式」。' }),
                el('li', { text: '執行身分選「我」，存取權限選「任何人」，然後部署並複製 /exec 網址。' }),
                el('li', { text: '把網址貼到上面欄位，按「連線並同步」。' }),
              ]),
            ]),
          ]),
        ]),
        card('備份與還原', '匯出的 JSON 可以存到雲端硬碟，換電腦時再匯入；清空點數或完全重設請到「班級設定」頁。', [
          el('div', { class: 'row', style: { gap: '10px', flexWrap: 'wrap' } }, [
            el('button', { class: 'btn btn--primary', text: '⬇ 匯出 JSON 備份', onclick: () => {
              U.download('班級寵物_' + U.todayKey() + '.json', S.exportJson());
              U.toast('已匯出備份');
            } }),
            el('button', { class: 'btn btn--ghost', text: '⬆ 匯入備份', onclick: () => fileInput.click() }),
            fileInput,
          ]),
        ]),
      ]),
    ]);
  }

  /* ================= 使用說明 ================= */
  function guidePageCard(icon, title, desc) {
    return el('div', { class: 'guide-page-card' }, [
      el('span', { class: 'guide-page-card__icon', text: icon }),
      el('div', {}, [
        el('div', { class: 'guide-page-card__title', text: title }),
        el('div', { class: 'guide-page-card__desc', text: desc }),
      ]),
    ]);
  }

  function guideCoinCard(icon, title, desc, points) {
    return el('div', { class: 'guide-coin-card' }, [
      el('div', { class: 'guide-coin-card__icon', text: icon }),
      el('div', { class: 'guide-coin-card__title', text: title }),
      el('div', { class: 'guide-coin-card__desc', text: desc }),
      points && points.length
        ? el('ul', { class: 'guide-coin-card__list' }, points.map((p) => el('li', { text: p })))
        : null,
    ]);
  }

  function qaItem(q, a) {
    return el('div', { class: 'qa-item' }, [
      el('div', { class: 'qa-item__q', text: '❓ ' + q }),
      el('div', { class: 'qa-item__a', text: a }),
    ]);
  }

  function pageGuide() {
    const s = S.get();

    const pageList = [
      ['🗺️', '班級總覽', '看今日加點、班級動態，直接勾選學生用常用規則加點。'],
      ['⭐', '批次加點', '一次選整班或整組學生，套用同一個規則或自訂點數。'],
      ['👥', '學生與小組', '管理學生名單、分組，或用文字批次匯入整班名單。'],
      ['🐾', '寵物總覽', '查看全班寵物的種類分布與成長狀況。'],
      ['💬', '訊息管理', '發公告或獎勵訊息給全班、小組或指定學生，附加的金幣星光要學生自己按領取。'],
      ['🏆', '排行榜', '課堂點數、本週進步、寵物等級與小隊總點數排行。'],
      ['🎲', '課堂小工具', '隨機抽點與課堂計時器，適合投影在教室螢幕上。'],
      ['⚙️', '班級設定', '顯示樣式、班級資訊、批次加點工具列、重設點數都在這裡。'],
      ['🌟', '星野主線', '設定合作闖關的故事關卡，發放身分路線獎勵。'],
      ['⏱️', '點數紀錄', '每一筆加扣點都有紀錄，加錯了可以撤銷或直接編輯。'],
      ['🎁', '兌換管理', '學生在前台用點數兌換獎勵後，在這裡確認發放。'],
      ['🛡️', '規則設定', '自訂加分規則、兌換商店與每日任務，改完立即生效。'],
      ['🐾', '寵物設定', '寵物種類、造型圖片、等級門檻、身分路線與收藏設定都在這裡。'],
      ['🏅', '徽章管理', '設定徽章的名稱、圖片與解鎖條件，查看全班解鎖情況。'],
      ['🛠️', '系統設定', '顯示樣式與批次加點的底部工具列都在這裡。'],
      ['☁️', '資料與同步', '選擇資料存在本機或同步到 Google 試算表，並可備份。'],
    ];

    const stageTrack = el('div', { class: 'stage-track' }, M.STAGES.map((st) =>
      el('div', { class: 'stage-step' }, [
        el('div', { class: 'stage-step__badge', text: st.badge }),
        el('div', { class: 'stage-step__name', text: st.name }),
        el('div', { class: 'stage-step__lv', text: 'Lv.' + st.minLevel + ' 起' }),
      ])
    ));

    const cosmeticGrid = el('div', { class: 'guide-mini-grid' }, M.COSMETICS.map((c) =>
      el('div', { class: 'guide-mini-item' }, [
        el('span', { style: { fontSize: '20px' }, text: c.emoji }),
        el('div', { class: 'grow' }, [
          el('div', { style: { fontWeight: 700, fontSize: '13.5px' }, text: c.name }),
          el('div', { class: 'muted', style: { fontSize: '12px' }, text: 'Lv.' + c.unlockLevel + ' 解鎖・🪙 ' + c.cost }),
        ]),
      ])
    ));

    const badgeGrid = el('div', { class: 'guide-mini-grid' }, (s.badgeDefs || []).map((b) =>
      el('div', { class: 'guide-mini-item' }, [
        M.badgeFace(b, 20),
        el('div', { class: 'grow' }, [
          el('div', { style: { fontWeight: 700, fontSize: '13.5px' }, text: b.name }),
          el('div', { class: 'muted', style: { fontSize: '12px' }, text: b.desc }),
        ]),
      ])
    ));

    const ruleGrid = el('div', { class: 'guide-mini-grid' }, s.rules.map((r) =>
      el('div', { class: 'guide-mini-item' }, [
        el('span', { style: { fontSize: '20px' }, text: r.icon }),
        el('div', { class: 'grow' }, [
          el('div', { style: { fontWeight: 700, fontSize: '13.5px' }, text: r.label }),
          el('div', { class: 'muted', style: { fontSize: '12px' }, text: (r.points > 0 ? '+' : '') + r.points + ' 點・' + (r.xp || 0) + ' XP・' + (r.coins || 0) + ' 金幣' }),
        ]),
      ])
    ));

    return el('div', {}, [
      pageHead('使用說明', '第一次使用嗎？這裡整理了系統的運作方式與各項功能，幫助你快速上手。'),

      card('📚 各頁面功能導覽', '左側選單每個項目在做什麼，一次看懂。', [
        el('div', { class: 'guide-page-grid' }, pageList.map((p) => guidePageCard(p[0], p[1], p[2]))),
      ]),

      card('🌟 三種點數的意義', '課堂點數、寵物 XP、金幣互不相同，各有各的用途。', [
        el('div', { class: 'guide-coin-grid' }, [
          guideCoinCard('⭐', '課堂點數 Points', '代表學生課堂表現的累積成績，會顯示在排行榜，也是兌換商店獎勵的貨幣。', [
            '透過「加點規則」或自訂點數取得',
            '可在「兌換管理」的商店中使用',
            '加錯了到「點數紀錄」撤銷或編輯即可回沖',
          ]),
          guideCoinCard('🧪', '寵物 XP', '專門用來養成學生的寵物，累積到門檻會讓寵物升級、進入下一個成長階段。', [
            '加點時通常會同時獲得（規則可自訂）',
            '學生也能用金幣「餵食」寵物換取額外 XP',
            '升級可解鎖新造型與相關徽章',
          ]),
          guideCoinCard('🪙', '金幣 Coins', '額外的獎勵貨幣，主要在學生前台用來裝扮寵物，不影響排行榜名次。', [
            '透過加點規則附贈取得',
            '可用來餵食寵物或解鎖造型',
            '和課堂點數、XP 各自累積、互不相減',
          ]),
        ]),
      ]),

      card('🐣 寵物如何升級', '每個學生的寵物都用累積 XP 換算等級：升到下一級所需 XP＝20＋（目前等級－1）×10，等級越高需要越多 XP。', [
        stageTrack,
      ]),

      card('🎀 造型解鎖條件', '造型需要「等級」與「金幣」同時達到才能解鎖，解鎖後可在學生前台裝備。', [cosmeticGrid]),

      card('🏅 徽章圖鑑', '徽章會依照學生的表現自動解鎖，達成條件時系統會自動加上，不需要手動設定。', [badgeGrid]),

      card('⚡ 目前班級的加點規則', '以下是目前設定的規則內容，可以到「規則設定」調整。', [
        ruleGrid,
        el('div', { style: { marginTop: '12px' } }, [
          el('button', { class: 'btn btn--ghost btn--sm', text: '前往規則設定', onclick: () => go('rules') }),
        ]),
      ]),

      card('💡 常見問題', null, [
        qaItem('加錯點數怎麼辦？', '到「點數紀錄」找到那一筆，按「撤銷」會把點數、XP、金幣全部回沖；如果只是事由或數字打錯，按「編輯」直接修改即可，系統會自動補上或收回差額。'),
        qaItem('課堂點數、XP、金幣會互相影響嗎？', '不會，三者各自累積。只有兌換商店（扣點數）、餵食寵物（扣金幣、加 XP）、撤銷或編輯紀錄、清空點數，才會讓數字變動。'),
        qaItem('學生的「連續天數」是怎麼算的？', '只要當天有一筆「加點（點數為正）」的紀錄，連續天數就會＋1；如果中間斷了一天沒有紀錄，就會重新從 1 開始算，用來解鎖「七日堅持」之類的徽章。'),
        qaItem('想要重新開始新學期怎麼辦？', '到「班級設定」使用「清空點數（保留名單）」可以把點數、金幣、經驗歸零但保留學生與分組；「完全重設」則會回到內建示範資料。'),
        qaItem('學生要去哪裡看自己的寵物？', '請學生開啟「學生前台」頁面（右上角有連結），選擇自己的座號即可看到自己的點數、寵物與徽章。'),
      ]),
    ]);
  }

  /* ---------- 浮動批次列 ---------- */
  function renderBatchBar() {
    const host = $('#batchbar');
    host.innerHTML = '';
    const showSetting = S.get().settings ? S.get().settings.showBatchBar !== false : true;
    if (!selected.size || page === 'batch' || !showSetting) {
      host.classList.remove('is-in');
      return;
    }
    host.classList.add('is-in');
    const ids = Array.from(selected);
    host.appendChild(el('button', {
      class: 'batchbar__btn batchbar__btn--main',
      onclick: () => openFeedbackModal(ids),
    }, [el('span', { text: '⭐' }), el('span', { text: '加扣點（' + selected.size + '）' })]));
    host.appendChild(el('button', { class: 'batchbar__btn', onclick: openDailyTasksQuick }, [el('span', { text: '📗' }), el('span', { text: '今日任務' })]));
    host.appendChild(el('button', { class: 'batchbar__btn', onclick: () => openCustomAward(ids) }, [el('span', { text: '➕' }), el('span', { text: '自訂' })]));
    host.appendChild(el('button', { class: 'batchbar__btn', onclick: () => go('batch') }, [el('span', { text: '✏️' }), el('span', { text: '編輯' })]));
    host.appendChild(el('button', { class: 'batchbar__btn', onclick: () => { selected = new Set(); render(); } }, [el('span', { text: '清除' })]));
  }

  /* ---------- 路由 ---------- */
  const PAGES = {
    guide: pageGuide, overview: pageOverview, batch: pageBatch, roster: pageRoster, tools: pageTools,
    pets: pagePets, 'pet-settings': pagePetSettings, badges: pageBadges, messages: pageMessages, ledger: pageLedger, redeem: pageRedeem, board: pageBoard,
    rules: pageRules, settings: pageSettings, system: pageSystemSettings, sync: pageSync,
    storyline: pageStoryline,
  };

  function go(p) {
    page = p;
    if (location.hash.slice(1) !== p) location.hash = p;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderTopbar() {
    const ci = S.get().classInfo;
    $('#teacherName').textContent = ci.teacher || '老師';
    $('#teacherAvatar').textContent = (ci.teacher || '師').slice(0, 1);
    $('#teacherMeta').textContent = '已登入 · ' + ci.className;
  }

  function render() {
    const host = $('#page');
    host.innerHTML = '';
    host.appendChild((PAGES[page] || pageOverview)());
    $$('.side__item').forEach((b) => b.classList.toggle('is-active', b.dataset.page === page));
    const st = S.get().settings || {};
    document.body.classList.toggle('no-avatar-frame', st.avatarFrame === false);
    renderTopbar();
    renderBatchBar();
  }

  function bindSync() {
    const chip = $('#syncChip');
    const text = $('#syncText');
    function paint(s) {
      chip.className = 'sync-chip is-' + s.state;
      text.textContent = s.state === 'ok' ? '雲端同步中' : s.state === 'error' ? '同步失敗' : s.state === 'syncing' ? '同步中…' : '本機模式';
      chip.title = s.message || '';
    }
    paint(S.getSync());
    document.addEventListener('petsync', (e) => paint(e.detail));
  }

  /* ---------- 漂浮快速加點小工具 ----------
     網頁沒辦法真的飄在瀏覽器之外、疊在其他 App 上面（瀏覽器安全限制），這裡做兩層：
     1) 頁內漂浮的小圓鈕，點開是「選學生＋規則按鈕」的精簡面板，拖曳可以換位置、翻頁也不會消失。
     2) 有支援 Document Picture-in-Picture 的瀏覽器（目前是 Chrome／Edge）可以再彈成一個真正
        獨立、會一直浮在最上層（包含蓋在其他 App 上面）的小視窗，效果最接近 HiTeach 那種工具列。 */
  let floatOpen = false;
  let floatSelected = new Set();
  let floatPipWin = null;

  function loadFloatPos() {
    try {
      const raw = localStorage.getItem('classpet.floatPos');
      const p = raw ? JSON.parse(raw) : null;
      if (p && typeof p.x === 'number' && typeof p.y === 'number') return p;
    } catch (e) { /* 忽略壞掉的存檔 */ }
    return { x: window.innerWidth - 80, y: window.innerHeight - 100 };
  }
  function saveFloatPos(pos) {
    try { localStorage.setItem('classpet.floatPos', JSON.stringify(pos)); } catch (e) { /* 無痕模式略過 */ }
  }

  /* 幫一個元素加上「按住拖曳」的能力；用 pointer event 一套處理滑鼠與觸控。
     拖曳距離很小就當作是「點擊」，避免手抖一下就誤判成拖曳而吃掉點擊事件。 */
  function makeDraggable(handleEl, moveEl, onDrop, onClick) {
    let dragging = false;
    let startX = 0, startY = 0, baseX = 0, baseY = 0, moved = false;
    handleEl.addEventListener('pointerdown', (e) => {
      dragging = true;
      moved = false;
      startX = e.clientX; startY = e.clientY;
      const rect = moveEl.getBoundingClientRect();
      baseX = rect.left; baseY = rect.top;
      try { handleEl.setPointerCapture(e.pointerId); } catch (err) { /* 部分瀏覽器／測試環境沒有這個 API */ }
    });
    handleEl.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
      if (!moved) return;
      const w = moveEl.offsetWidth, h = moveEl.offsetHeight;
      const x = Math.min(Math.max(0, baseX + dx), window.innerWidth - w);
      const y = Math.min(Math.max(0, baseY + dy), window.innerHeight - h);
      moveEl.style.left = x + 'px';
      moveEl.style.top = y + 'px';
      moveEl.style.right = 'auto';
    });
    handleEl.addEventListener('pointerup', (e) => {
      if (!dragging) return;
      dragging = false;
      try { handleEl.releasePointerCapture(e.pointerId); } catch (err) { /* 同上 */ }
      if (moved) {
        const rect = moveEl.getBoundingClientRect();
        onDrop({ x: rect.left, y: rect.top });
      } else if (onClick) {
        onClick();
      }
    });
  }

  function documentPipSupported() {
    return typeof window !== 'undefined' && 'documentPictureInPicture' in window;
  }

  function floatPanelBody() {
    const s = S.get();
    const searchInput = el('input', { class: 'input', placeholder: '搜尋姓名或座號…' });
    const listEl = el('div', { class: 'float-list' });
    const dockEl = el('div', { class: 'float-dock' });
    const countEl = el('b', { text: '已選 ' + floatSelected.size });

    function paintList() {
      listEl.innerHTML = '';
      const q = searchInput.value.trim();
      sortStudents(s.students, s)
        .filter((st) => !q || (U.pad2(st.no) + st.name).indexOf(q) >= 0)
        .forEach((st) => {
          const on = floatSelected.has(st.id);
          listEl.appendChild(el('button', {
            class: 'float-chip' + (on ? ' is-on' : ''), text: U.pad2(st.no) + ' ' + st.name,
            onclick: () => { on ? floatSelected.delete(st.id) : floatSelected.add(st.id); paintList(); countEl.textContent = '已選 ' + floatSelected.size; },
          }));
        });
    }
    searchInput.addEventListener('input', paintList);
    paintList();

    (s.rules || []).filter((r) => r.id).forEach((r) => {
      dockEl.appendChild(el('button', {
        class: 'float-rulebtn',
        onclick: () => {
          if (!floatSelected.size) return U.toast('請先點選學生', 'warn');
          applyRule(Array.from(floatSelected), r);
        },
      }, [el('span', { text: r.icon }), el('span', { text: r.label }), el('span', { text: (r.points >= 0 ? '+' : '') + r.points })]));
    });

    const pipRow = floatPipWin
      ? null
      : documentPipSupported()
        ? el('button', { class: 'btn btn--ghost btn--sm', style: { width: '100%', marginTop: '10px' }, text: '🪟 彈出獨立小視窗', onclick: openFloatPip })
        : el('p', { class: 'muted', style: { fontSize: '12px', marginTop: '10px', textAlign: 'center' }, text: '這個瀏覽器不支援「彈出獨立小視窗」，請改用 Chrome 或 Edge。' });

    return el('div', { class: 'float-panel__body' }, [
      el('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '6px' } }, [countEl]),
      pipRow,
      searchInput,
      listEl,
      dockEl,
    ]);
  }

  function renderFloatWidget() {
    if (floatPipWin) {
      // 彈出視窗那邊也要能即時反映規則、名單異動，所以每次資料變動都重畫一次內容
      floatPipWin.document.body.innerHTML = '';
      const panel = el('div', {
        class: 'float-panel',
        style: { position: 'static', width: '100%', maxHeight: 'none', boxShadow: 'none', borderRadius: 0 },
      }, [floatPanelBody()]);
      floatPipWin.document.body.appendChild(panel);
      return;
    }
    const host = $('#floatWidget');
    if (!host) return;
    host.innerHTML = '';
    const pos = loadFloatPos();
    if (!floatOpen) {
      const fab = el('span', { class: 'float-fab', text: '⭐', style: { left: pos.x + 'px', top: pos.y + 'px' } });
      makeDraggable(fab, fab, saveFloatPos, () => { floatOpen = true; renderFloatWidget(); });
      host.appendChild(fab);
      return;
    }
    const panelHead = el('div', { class: 'float-panel__head' }, [
      el('span', { text: '⭐ 快速加點' }),
      el('button', { class: 'float-panel__close', text: '✕', onclick: () => { floatOpen = false; renderFloatWidget(); } }),
    ]);
    const panel = el('div', { class: 'float-panel', style: { left: pos.x + 'px', top: pos.y + 'px' } }, [panelHead, floatPanelBody()]);
    makeDraggable(panelHead, panel, saveFloatPos, null);
    host.appendChild(panel);
  }

  /* 彈出成真正的獨立小視窗（Document Picture-in-Picture），會一直浮在所有視窗最上層，
     包含蓋在其他 App 上面——效果最接近 HiTeach 的浮動工具列。只有 Chrome／Edge 系列支援；
     視窗內容跟主頁面共用同一個 JavaScript，所以按鈕點了一樣會即時加點、即時看到結果。 */
  async function openFloatPip() {
    if (!documentPipSupported()) return U.toast('這個瀏覽器不支援彈出小視窗，請用 Chrome 或 Edge', 'warn');
    try {
      floatPipWin = await window.documentPictureInPicture.requestWindow({ width: 300, height: 420 });
      Array.from(document.styleSheets).forEach((sheet) => {
        try {
          if (sheet.href) {
            const link = floatPipWin.document.createElement('link');
            link.rel = 'stylesheet'; link.href = sheet.href;
            floatPipWin.document.head.appendChild(link);
          }
        } catch (e) { /* 跨網域樣式表讀不到就略過 */ }
      });
      floatPipWin.document.body.style.margin = '0';
      floatOpen = false;
      $('#floatWidget').innerHTML = '';
      floatPipWin.addEventListener('pagehide', () => { floatPipWin = null; renderFloatWidget(); });
      renderFloatWidget();
    } catch (e) {
      U.toast('彈出小視窗失敗：' + e.message, 'error');
    }
  }

  /* ---------- 側邊欄收合 ---------- */
  function bindSideToggle() {
    const btn = $('#sideToggle');
    const shell = $('.shell');
    if (!btn || !shell) return;
    let collapsed = false;
    try { collapsed = localStorage.getItem('classpet.sideCollapsed') === '1'; } catch (e) { /* 忽略 */ }
    shell.classList.toggle('is-side-collapsed', collapsed);
    btn.addEventListener('click', () => {
      collapsed = !collapsed;
      shell.classList.toggle('is-side-collapsed', collapsed);
      try { localStorage.setItem('classpet.sideCollapsed', collapsed ? '1' : '0'); } catch (e) { /* 忽略 */ }
    });
  }

  /* ---------- 啟動 ---------- */
  S.init().then(() => {
    const hash = location.hash.slice(1);
    if (PAGES[hash]) page = hash;
    $$('.side__item').forEach((b) => b.addEventListener('click', () => go(b.dataset.page)));
    bindSideToggle();
    window.addEventListener('hashchange', () => {
      const h = location.hash.slice(1);
      if (PAGES[h] && h !== page) { page = h; render(); }
    });
    S.subscribe(render);
    S.subscribe(renderFloatWidget);
    bindSync();
    render();
    renderFloatWidget();
  });
})();
