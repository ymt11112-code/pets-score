/* ===== 學生前台 ===== */
(function () {
  'use strict';

  const U = window.PetUtil;
  const M = window.PetModel;
  const S = window.PetStore;
  const { $, $$, el } = U;

  const LS_ME = 'classpet.me';
  let view = 'map';
  let meId = null;

  /* ---------- 小元件 ---------- */
  function petAvatar(st, size, showCos) {
    const pet = M.petById(st.petId);
    const level = M.levelFromXp(st.xp).level;
    const stage = M.stageOf(level);
    const cos = showCos && st.equipped ? M.COSMETICS.find((c) => c.id === st.equipped) : null;
    return el('span', { class: 'mate__avatar', style: { width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.55) + 'px' } }, [
      M.petFace(pet, Math.round(size * 0.62), level),
      cos ? el('span', { class: 'mate__cos', text: cos.emoji }) : null,
      el('span', { class: 'pet-avatar__badge', text: stage.badge, style: { right: '-4px', bottom: '-4px' } }),
    ]);
  }

  function progressBar(percent, green) {
    return el('div', { class: 'bar' + (green ? ' bar--green' : '') }, [
      el('div', { class: 'bar__fill', style: { width: U.clamp(percent, 0, 100) + '%' } }),
    ]);
  }

  function sectionHead(eyebrow, title, sub, right) {
    return el('div', { class: 'sect__head' }, [
      el('div', {}, [
        el('div', { class: 'section-eyebrow', text: eyebrow }),
        el('h2', { class: 'section-title', text: title }),
        sub ? el('p', { class: 'section-sub', text: sub }) : null,
      ]),
      right || null,
    ]);
  }

  function me() {
    const s = S.get();
    return s.students.find((x) => x.id === meId) || null;
  }

  /* ---------- 身分選擇 ---------- */
  function openIdentityPicker() {
    const s = S.get();
    const body = el('div', {}, [
      el('p', { class: 'modal__text', text: '點選你的名字，就能看到自己的寵物與紀錄。' }),
      el('input', {
        class: 'input', placeholder: '搜尋姓名或座號…', style: { margin: '12px 0' },
        oninput: (e) => {
          const q = e.target.value.trim();
          $$('.picker-btn', body).forEach((b) => {
            b.classList.toggle('hide', !!q && b.dataset.k.indexOf(q) < 0);
          });
        },
      }),
      el('div', { class: 'picker-grid' }, s.students.map((st) =>
        el('button', {
          class: 'picker-btn', 'data-k': U.pad2(st.no) + st.name,
          onclick: () => { setMe(st.id); dlg.close(); },
        }, [
          el('div', { class: 'picker-btn__emoji' }, [M.petFace(M.petById(st.petId), 32, M.levelFromXp(st.xp).level)]),
          el('div', { class: 'picker-btn__name', text: st.name }),
          el('div', { class: 'picker-btn__no', text: U.pad2(st.no) + ' 號' }),
        ])
      )),
    ]);
    const dlg = U.modal({ title: '我是誰？', body, wide: true });
  }

  function setMe(id) {
    meId = id;
    try { localStorage.setItem(LS_ME, id); } catch (e) { /* 無痕模式略過 */ }
    render();
    const st = me();
    if (st) U.toast('哈囉，' + st.name + '！');
  }

  /* ---------- 升級慶祝 ---------- */
  function celebrate(st, level) {
    const pet = M.petById(st.petId);
    const stage = M.stageOf(level);
    U.modal({
      title: '🎉 升級了！',
      body: el('div', { class: 'levelup' }, [
        el('div', { class: 'levelup__face', text: pet.emoji }),
        el('div', { class: 'levelup__lv', text: (st.petName || pet.name) + ' Lv.' + level }),
        el('div', { class: 'levelup__note', text: '目前階段：' + stage.badge + ' ' + stage.name }),
      ]),
      actions: [{ label: '太棒了', kind: 'primary' }],
    });
  }

  /* ================= 視圖：探險地圖 ================= */
  function viewMap() {
    const s = S.get();
    const st = me();
    const lv = st ? M.levelFromXp(st.xp) : null;
    const pet = st ? M.petById(st.petId) : M.petById(M.PETS[5].id);
    const mission = s.classMission;
    const missionLeft = Math.max(0, mission.target - mission.progress);
    const day = Math.max(1, Math.round((Date.now() - s.classInfo.startedAt) / 86400000));

    const deco = el('div', { class: 'hero__deco' });
    [['🌲', 6, 18], ['🌳', 14, 52], ['🌲', 24, 12], ['🌸', 30, 70], ['🌲', 40, 30],
     ['🍄', 47, 74], ['🌳', 58, 16], ['⭐', 52, 42], ['🌲', 70, 26], ['🌷', 78, 64],
     ['🌲', 86, 20], ['🦋', 64, 58]].forEach(([e, left, top]) => {
      deco.appendChild(el('span', { text: e, style: { left: left + '%', top: top + '%' } }));
    });

    return el('div', {}, [
      el('section', { class: 'hero' }, [
        el('div', { class: 'hero__path' }),
        deco,
        el('div', { class: 'wrap wrap--wide hero__inner' }, [
          el('div', { class: 'hero-card' }, [
            el('div', { class: 'hero-card__eyebrow', text: '第 ' + day + ' 天 · ' + s.classInfo.term }),
            el('h1', { class: 'hero-card__title', html: (st ? st.name : s.classInfo.className) + '的<br>星光冒險' }),
            el('p', { class: 'hero-card__desc', text: '每一次專注、合作與勇敢，都會讓班級的探險地圖再前進一步。' }),
            st
              ? el('div', { class: 'hero-card__pet' }, [
                  el('span', { style: { fontSize: '30px' } }, [M.petFace(pet, 34, lv.level)]),
                  el('div', { class: 'grow' }, [
                    el('div', { style: { fontWeight: 800 }, text: (st.petName || pet.name) + ' Lv.' + lv.level }),
                    el('div', { class: 'muted', style: { fontSize: '13px' }, text: '再獲得 ' + (lv.need - lv.inLevel) + ' XP 升到 Lv.' + (lv.level + 1) }),
                  ]),
                ])
              : el('button', { class: 'btn btn--green', style: { marginTop: '16px' }, text: '選擇我是誰 →', onclick: openIdentityPicker }),
          ]),
          el('div', { class: 'hero-stats' }, [
            statChip('🌟', '班級星星', s.classInfo.classStars.toLocaleString()),
            statChip('🔥', '連續探險', s.classInfo.classStreak + ' 天'),
            statChip('🏆', '已解鎖徽章', s.classInfo.badgeCount + ' 枚'),
            st ? statChip('🪙', '我的金幣', st.coins) : null,
          ]),
        ]),
        el('div', { class: 'hero__bottom' }, [
          el('div', { class: 'wrap wrap--wide' }, [
          el('div', { class: 'hero-mission' }, [
            el('div', { class: 'hero-mission__label', text: mission.icon + ' 本週共同任務' }),
            el('div', { class: 'hero-mission__title', text: mission.title }),
            progressBar(Math.round((mission.progress / mission.target) * 100)),
            el('div', { class: 'row row--between', style: { marginTop: '8px', fontSize: '13px' } }, [
              el('span', { text: '全班累積 ' + mission.progress + ' 點' }),
              el('b', { text: mission.progress + ' / ' + mission.target }),
            ]),
          ]),
          ]),
        ]),
        el('div', { class: 'hero-pet' }, [
          el('div', { class: 'hero-pet__bubble', text: '再 ' + missionLeft + ' 點就能打開森林寶箱！' }),
          el('div', { class: 'hero-pet__face' }, [M.petFace(pet, 130, st ? lv.level : 1)]),
        ]),
      ]),

      el('section', { class: 'sect' }, [
        el('div', { class: 'wrap wrap--wide' }, [
          sectionHead('今天也有進步', '今日任務與榮譽榜', '除了名次，也看見堅持、合作與每一次小小進步。',
            el('span', { class: 'pill pill--gold', text: '⭐ 今日 ' + S.todayPoints() + ' 次好行為' })),
          el('div', { class: 'grid-2' }, [
            el('div', { class: 'card' }, [
              el('h3', { class: 'card__title', text: '今日任務' }),
              el('div', { style: { marginTop: '14px' } }, s.dailyTasks.map(taskRow)),
            ]),
            el('div', { class: 'card' }, [
              el('h3', { class: 'card__title', text: '本週進步亮點' }),
              el('div', { style: { marginTop: '14px' } }, weeklyTop(5).map(rankRow)),
            ]),
          ]),
        ]),
      ]),

      el('section', { class: 'sect sect--soft' }, [
        el('div', { class: 'wrap wrap--wide' }, [
          sectionHead('小隊一起走', '冒險小隊進度', '小隊的點數會一起累積，解鎖共同獎勵。'),
          el('div', { class: 'grid-3' }, s.groups.map(groupCard)),
        ]),
      ]),
    ]);
  }

  function statChip(icon, label, value) {
    return el('div', { class: 'stat-chip' }, [
      el('span', { class: 'stat-chip__icon', text: icon }),
      el('span', { class: 'stat-chip__label', text: label }),
      el('span', { class: 'stat-chip__value', text: String(value) }),
    ]);
  }

  function taskRow(t) {
    const done = t.done >= t.target;
    return el('div', { class: 'task-row' + (done ? ' is-done' : '') }, [
      el('span', { class: 'task-row__icon', text: t.icon }),
      el('div', { class: 'grow' }, [
        el('div', { class: 'task-row__title', text: t.title }),
        el('div', { class: 'task-row__meta', text: (done ? '✅ 全班完成！' : '已完成 ' + t.done + ' / ' + t.target) }),
      ]),
      el('span', { class: 'task-row__xp', text: '+' + t.xp + ' XP' }),
    ]);
  }

  function weeklyTop(n) {
    const s = S.get();
    return s.students
      .map((st) => ({ st, gain: S.weeklyGain(st.id) }))
      .sort((a, b) => b.gain - a.gain)
      .slice(0, n);
  }

  function rankRow(item, i) {
    const st = item.st;
    const g = S.group(st.groupId);
    const lv = M.levelFromXp(st.xp).level;
    return el('div', { class: 'rank-row' + (i < 3 ? ' rank-row--top' : '') }, [
      el('span', { class: 'rank-row__no', text: String(i + 1) }),
      petAvatar(st, 40, true),
      el('div', { class: 'grow' }, [
        el('div', { class: 'rank-row__name', text: st.name }),
        el('div', { class: 'rank-row__meta', text: (g ? g.name : '') + ' · 寵物 Lv.' + lv }),
      ]),
      el('span', { class: 'rank-row__gain', text: '+' + item.gain + ' 進步' }),
    ]);
  }

  function groupCard(g) {
    const s = S.get();
    const members = s.students.filter((x) => x.groupId === g.id);
    const pts = S.groupPoints(g.id);
    const target = Math.max(100, Math.ceil(pts / 100) * 100);
    return el('div', { class: 'card card--flat' }, [
      el('div', { class: 'row', style: { gap: '10px' } }, [
        el('span', { style: { fontSize: '26px' }, text: g.emoji }),
        el('div', { class: 'grow' }, [
          el('div', { style: { fontWeight: 800, fontSize: '17px' }, text: g.name }),
          el('div', { class: 'muted', style: { fontSize: '13px' }, text: members.length + ' 位隊員' }),
        ]),
        el('span', { class: 'pill pill--gold', text: pts + ' 點' }),
      ]),
      el('div', { style: { marginTop: '14px' } }, [progressBar(Math.round((pts / target) * 100), true)]),
      el('div', { class: 'muted', style: { fontSize: '12.5px', marginTop: '6px' }, text: '距離下一個小隊寶箱還差 ' + Math.max(0, target - pts) + ' 點' }),
      el('div', { class: 'row', style: { marginTop: '12px', flexWrap: 'wrap', gap: '6px' } },
        members.slice(0, 8).map((m) => el('span', { title: m.name }, [M.petFace(M.petById(m.petId), 28, M.levelFromXp(m.xp).level)]))),
    ]);
  }

  /* ================= 視圖：我的寵物 ================= */
  function viewPet() {
    const st = me();
    if (!st) return needIdentity('選擇身分後，就能照顧你的寵物。');

    const lv = M.levelFromXp(st.xp);
    const pet = M.petById(st.petId);
    const stage = M.stageOf(lv.level);
    const cos = st.equipped ? M.COSMETICS.find((c) => c.id === st.equipped) : null;

    return el('div', { class: 'sect' }, [
      el('div', { class: 'wrap wrap--wide' }, [
        sectionHead('我的夥伴', (st.petName || pet.name), pet.desc,
          el('span', { class: 'coin-chip', text: '🪙 ' + st.coins + ' 金幣' })),

        el('div', { class: 'pet-hero' }, [
          el('div', { class: 'pet-stage' }, [
            el('div', { class: 'pet-stage__glow' }),
            el('div', { class: 'pet-stage__face' }, [
              M.petFace(pet, 140, lv.level),
              cos ? el('span', { class: 'pet-stage__cos', text: cos.emoji }) : null,
            ]),
            el('div', { class: 'pet-stage__name', text: (st.petName || pet.name) + ' Lv.' + lv.level }),
            el('div', { class: 'pet-stage__trait', text: stage.badge + ' ' + stage.name + ' · ' + pet.trait }),
            el('div', { style: { marginTop: '14px' } }, [progressBar(lv.percent, true)]),
            el('div', { class: 'muted', style: { fontSize: '13px', marginTop: '6px' }, text: lv.inLevel + ' / ' + lv.need + ' XP　還差 ' + (lv.need - lv.inLevel) + ' XP 升級' }),
            el('div', { class: 'row', style: { justifyContent: 'center', gap: '8px', marginTop: '14px' } }, [
              el('button', { class: 'btn btn--ghost btn--sm', text: '🔄 換一隻寵物', onclick: openPetPicker }),
              el('button', { class: 'btn btn--ghost btn--sm', text: '✏️ 取名字', onclick: openRename }),
            ]),
          ]),

          el('div', { class: 'stack' }, [
            el('div', { class: 'card' }, [
              el('div', { class: 'card__head' }, [
                el('div', {}, [
                  el('h3', { class: 'card__title', text: '餵食升級' }),
                  el('p', { class: 'card__sub', text: '用金幣換食物，讓寵物獲得成長值。' }),
                ]),
              ]),
              el('div', { class: 'food-grid' }, M.FOODS.map((f) => {
                const afford = st.coins >= f.cost;
                return el('button', {
                  class: 'food', disabled: !afford ? 'disabled' : null,
                  onclick: () => {
                    const r = S.feedPet(st.id, f.id);
                    if (!r.ok) return U.toast(r.msg, 'warn');
                    U.toast((st.petName || pet.name) + ' 吃了 ' + f.name + '，+' + f.xp + ' XP');
                    if (r.levelUp) celebrate(me(), r.level);
                  },
                }, [
                  el('div', { class: 'food__emoji', text: f.emoji }),
                  el('div', { class: 'food__name', text: f.name }),
                  el('div', { class: 'food__cost', text: '🪙 ' + f.cost + ' · +' + f.xp + ' XP' }),
                ]);
              })),
            ]),

            el('div', { class: 'card' }, [
              el('div', { class: 'card__head' }, [
                el('div', {}, [
                  el('h3', { class: 'card__title', text: '造型收藏' }),
                  el('p', { class: 'card__sub', text: '達到等級並花費金幣即可解鎖，點一下可穿脫。' }),
                ]),
                el('span', { class: 'pill', text: (st.cosmetics || []).length + ' / ' + M.COSMETICS.length }),
              ]),
              el('div', { class: 'cos-grid' }, M.COSMETICS.map((c) => {
                const owned = (st.cosmetics || []).indexOf(c.id) >= 0;
                const locked = lv.level < c.unlockLevel;
                return el('button', {
                  class: 'cos' + (owned ? ' is-owned' : '') + (locked && !owned ? ' is-locked' : '') + (st.equipped === c.id ? ' is-equipped' : ''),
                  onclick: () => {
                    if (owned) {
                      S.equipCosmetic(st.id, c.id);
                      U.toast(st.equipped === c.id ? '已脫下 ' + c.name : '換上 ' + c.name + '！');
                      return;
                    }
                    const r = S.unlockCosmetic(st.id, c.id);
                    if (!r.ok) return U.toast(r.msg, 'warn');
                    U.toast('🎉 解鎖了 ' + c.name + '！');
                  },
                }, [
                  st.equipped === c.id ? el('span', { class: 'cos__tag', text: '穿著中' }) : null,
                  el('div', { class: 'cos__emoji', text: owned ? c.emoji : locked ? '🔒' : c.emoji }),
                  el('div', { class: 'cos__name', text: c.name }),
                  el('div', { class: 'cos__meta', text: owned ? '已擁有' : locked ? '需 Lv.' + c.unlockLevel : '🪙 ' + c.cost }),
                ]);
              })),
            ]),

            el('div', { class: 'card' }, [
              el('h3', { class: 'card__title', text: '我的徽章' }),
              el('p', { class: 'card__sub', style: { marginBottom: '14px' }, text: '已獲得 ' + (st.badges || []).length + ' / ' + M.BADGES.length + ' 枚' }),
              el('div', { class: 'badge-grid' }, M.BADGES.map((b) => {
                const got = (st.badges || []).indexOf(b.id) >= 0;
                return el('div', { class: 'badge-item' + (got ? '' : ' is-locked'), title: b.desc }, [
                  el('div', { class: 'badge-item__emoji', text: b.emoji }),
                  el('div', { class: 'badge-item__name', text: b.name }),
                ]);
              })),
            ]),

            el('div', { class: 'card' }, [
              el('h3', { class: 'card__title', text: '我的紀錄' }),
              el('div', { style: { marginTop: '10px' } }, myTimeline(st.id, 12)),
            ]),
          ]),
        ]),
      ]),
    ]);
  }

  function myTimeline(id, n) {
    const rows = S.get().ledger.filter((e) => !e.undone && e.studentIds.indexOf(id) >= 0).slice(0, n);
    if (!rows.length) return [el('div', { class: 'empty' }, [el('div', { class: 'empty__icon', text: '🌱' }), el('div', { text: '還沒有紀錄，今天就開始吧！' })])];
    return rows.map((e) => {
      const rule = S.rule(e.ruleId);
      const minus = (e.points || 0) < 0 || (e.coins || 0) < 0;
      const amount = e.points ? (e.points > 0 ? '+' : '') + e.points + ' 點' : (e.xp ? '+' + e.xp + ' XP' : (e.coins || 0) + ' 🪙');
      return el('div', { class: 'timeline-row' }, [
        el('span', { class: 'timeline-row__icon', text: rule ? rule.icon : '⭐' }),
        el('div', { class: 'grow' }, [
          el('div', { style: { fontWeight: 700 }, text: e.label }),
          el('div', { class: 'timeline-row__time', text: U.fmtDateTime(e.ts) + (e.note ? ' · ' + e.note : '') }),
        ]),
        el('span', { class: 'timeline-row__pts' + (minus ? ' is-minus' : ''), text: amount }),
      ]);
    });
  }

  function openPetPicker() {
    const st = me();
    const body = el('div', { class: 'cos-grid' }, M.allPets().map((p) =>
      el('button', {
        class: 'cos' + (st.petId === p.id ? ' is-equipped' : ''),
        onclick: () => { S.choosePet(st.id, p.id); U.toast('換成 ' + p.name + ' 囉！'); dlg.close(); },
      }, [
        el('div', { class: 'cos__emoji', text: p.emoji }),
        el('div', { class: 'cos__name', text: p.name }),
        el('div', { class: 'cos__meta', text: p.trait }),
      ])
    ));
    const dlg = U.modal({ title: '選擇你的寵物', body, wide: true });
  }

  function openRename() {
    const st = me();
    const input = el('input', { class: 'input', value: st.petName || '', placeholder: '幫寵物取個名字（最多 10 字）', maxlength: '10' });
    U.modal({
      title: '幫寵物取名字',
      body: el('div', { class: 'stack' }, [input]),
      actions: [
        { label: '取消' },
        {
          label: '儲存', kind: 'primary',
          onClick: () => { S.choosePet(st.id, st.petId, input.value.trim()); U.toast('名字更新了！'); },
        },
      ],
    });
  }

  /* ================= 視圖：今日任務 ================= */
  function viewTask() {
    const s = S.get();
    const st = me();
    return el('div', { class: 'sect' }, [
      el('div', { class: 'wrap wrap--wide' }, [
        sectionHead('每天的小約定', '今日任務', '完成這些事情，就能幫全班推進共同任務。'),
        el('div', { class: 'grid-2' }, [
          el('div', { class: 'card' }, [
            el('h3', { class: 'card__title', text: '全班今日任務' }),
            el('div', { style: { marginTop: '14px' } }, s.dailyTasks.map(taskRow)),
            el('div', { class: 'card__sub', style: { marginTop: '10px' }, text: '＊任務完成度由老師在後台更新。' }),
          ]),
          el('div', { class: 'stack' }, [
            el('div', { class: 'card' }, [
              el('h3', { class: 'card__title', text: '可以加點的約定' }),
              el('p', { class: 'card__sub', style: { marginBottom: '12px' }, text: '做到下面任何一項，老師就會幫你加點。' }),
              el('div', {}, s.rules.filter((r) => r.points > 0).map((r) =>
                el('div', { class: 'task-row' }, [
                  el('span', { class: 'task-row__icon', text: r.icon }),
                  el('div', { class: 'grow' }, [
                    el('div', { class: 'task-row__title', text: r.label }),
                    el('div', { class: 'task-row__meta', text: '+' + r.points + ' 點 · +' + r.xp + ' XP · +' + r.coins + ' 金幣' }),
                  ]),
                  st ? el('span', { class: 'pill pill--gray', text: '已做 ' + ((st.ruleCount || {})[r.id] || 0) + ' 次' }) : null,
                ])
              )),
            ]),
            el('div', { class: 'card' }, [
              el('h3', { class: 'card__title', text: '本週共同任務' }),
              el('div', { class: 'row', style: { marginTop: '14px', gap: '12px' } }, [
                el('span', { style: { fontSize: '34px' }, text: s.classMission.icon }),
                el('div', { class: 'grow' }, [
                  el('div', { style: { fontWeight: 800, fontSize: '18px' }, text: s.classMission.title }),
                  el('div', { class: 'muted', style: { fontSize: '13px' }, text: '獎勵：' + s.classMission.reward }),
                ]),
              ]),
              el('div', { style: { marginTop: '14px' } }, [progressBar(Math.round((s.classMission.progress / s.classMission.target) * 100))]),
              el('div', { class: 'row row--between', style: { marginTop: '8px', fontSize: '13.5px' } }, [
                el('span', { class: 'muted', text: '全班累積' }),
                el('b', { text: s.classMission.progress + ' / ' + s.classMission.target }),
              ]),
            ]),
          ]),
        ]),
      ]),
    ]);
  }

  /* ================= 視圖：班級夥伴 ================= */
  function viewMates() {
    const s = S.get();
    const grid = el('div', { class: 'roster' });
    function paint(filterGroup, q) {
      grid.innerHTML = '';
      s.students
        .filter((st) => (!filterGroup || st.groupId === filterGroup))
        .filter((st) => (!q || (U.pad2(st.no) + st.name).indexOf(q) >= 0))
        .forEach((st) => grid.appendChild(mateCard(st)));
      if (!grid.children.length) grid.appendChild(el('div', { class: 'empty', text: '找不到符合的同學' }));
    }
    let curGroup = '';
    const search = el('input', { class: 'input', placeholder: '搜尋姓名或座號…', style: { maxWidth: '260px' }, oninput: U.debounce((e) => paint(curGroup, e.target.value.trim()), 150) });
    const tabs = el('div', { class: 'tag-toggle' }, [{ id: '', name: '全部' }].concat(s.groups).map((g, i) =>
      el('button', {
        class: i === 0 ? 'is-on' : '', text: (g.emoji ? g.emoji + ' ' : '') + g.name,
        onclick: (e) => {
          $$('button', tabs).forEach((b) => b.classList.remove('is-on'));
          e.currentTarget.classList.add('is-on');
          curGroup = g.id || '';
          paint(curGroup, search.value.trim());
        },
      })
    ));
    paint('', '');

    return el('div', { class: 'sect' }, [
      el('div', { class: 'wrap wrap--wide' }, [
        sectionHead('一起前進', s.classInfo.className + ' · ' + s.students.length + ' 位探險夥伴', '點選任一位同學，看看他的寵物等級與成長進度。',
          el('span', { class: 'pill', text: '👥 ' + s.groups.length + ' 個冒險小隊' })),
        el('div', { class: 'row', style: { gap: '12px', marginBottom: '18px', flexWrap: 'wrap' } }, [tabs, search]),
        grid,
      ]),
    ]);
  }

  function mateCard(st) {
    const lv = M.levelFromXp(st.xp);
    return el('button', { class: 'mate', onclick: () => openMate(st.id) }, [
      petAvatar(st, 62, true),
      el('div', { class: 'mate__name', text: U.pad2(st.no) + ' ' + st.name }),
      el('div', { class: 'mate__lv', text: '寵物 Lv.' + lv.level }),
      progressBar(lv.percent),
    ]);
  }

  function openMate(id) {
    const st = S.student(id);
    const lv = M.levelFromXp(st.xp);
    const pet = M.petById(st.petId);
    const g = S.group(st.groupId);
    const badges = (st.badges || []).map((b) => M.BADGES.find((x) => x.id === b)).filter(Boolean);
    U.modal({
      title: U.pad2(st.no) + ' ' + st.name,
      body: el('div', { class: 'stack' }, [
        el('div', { class: 'row', style: { gap: '14px' } }, [
          petAvatar(st, 70, true),
          el('div', { class: 'grow' }, [
            el('div', { style: { fontWeight: 900, fontSize: '18px' }, text: (st.petName || pet.name) + ' Lv.' + lv.level }),
            el('div', { class: 'muted', style: { fontSize: '13.5px' }, text: (g ? g.name : '') + ' · ' + M.stageOf(lv.level).name + ' · 連續 ' + (st.streak || 0) + ' 天' }),
          ]),
        ]),
        progressBar(lv.percent, true),
        el('div', { class: 'row', style: { gap: '10px', flexWrap: 'wrap' } }, [
          el('span', { class: 'pill pill--gold', text: '⭐ ' + st.points + ' 點' }),
          el('span', { class: 'pill', text: '🪙 ' + st.coins + ' 金幣' }),
          el('span', { class: 'pill pill--blue', text: '📈 本週 +' + S.weeklyGain(st.id) }),
        ]),
        badges.length
          ? el('div', { class: 'badge-grid' }, badges.map((b) => el('div', { class: 'badge-item', title: b.desc }, [
              el('div', { class: 'badge-item__emoji', text: b.emoji }),
              el('div', { class: 'badge-item__name', text: b.name }),
            ])))
          : el('p', { class: 'muted', text: '還沒有徽章，加油！' }),
      ]),
      actions: [{ label: '設為我的身分', onClick: () => setMe(st.id) }, { label: '關閉', kind: 'primary' }],
    });
  }

  /* ================= 視圖：兌換商店 ================= */
  function viewShop() {
    const s = S.get();
    const st = me();
    return el('div', { class: 'sect' }, [
      el('div', { class: 'wrap wrap--wide' }, [
        sectionHead('努力換來的', '兌換商店', '用課堂點數兌換獎勵，兌換後請找老師領取。',
          st ? el('span', { class: 'coin-chip', text: '⭐ ' + st.points + ' 點可用' }) : null),
        st ? null : needIdentityInline(),
        el('div', { class: 'shop-grid' }, s.shop.map((item) => {
          const afford = st && st.points >= item.cost && item.stock > 0;
          return el('div', { class: 'shop-item' }, [
            el('div', { class: 'row row--between' }, [
              el('span', { class: 'shop-item__icon', text: item.icon }),
              el('span', { class: 'pill ' + (item.stock > 0 ? 'pill--gray' : 'pill--red'), text: item.stock > 0 ? '剩 ' + item.stock + ' 份' : '已兌完' }),
            ]),
            el('div', { class: 'shop-item__name', text: item.name }),
            el('div', { class: 'shop-item__desc', text: item.desc || '' }),
            el('div', { class: 'row row--between', style: { marginTop: '8px' } }, [
              el('b', { style: { color: 'var(--gold-deep)' }, text: '⭐ ' + item.cost + ' 點' }),
              el('button', {
                class: 'btn btn--green btn--sm', disabled: afford ? null : 'disabled', text: '兌換',
                onclick: () => {
                  U.confirmDialog('確認兌換', '要用 ' + item.cost + ' 點兌換「' + item.name + '」嗎？').then((ok) => {
                    if (!ok) return;
                    const r = S.redeem(st.id, item.id);
                    U.toast(r.ok ? '🎁 兌換成功！請找老師領取。' : r.msg, r.ok ? 'ok' : 'warn');
                  });
                },
              }),
            ]),
          ]);
        })),
        st && S.get().redeems.filter((r) => r.studentId === st.id).length
          ? el('div', { class: 'card', style: { marginTop: '20px' } }, [
              el('h3', { class: 'card__title', text: '我的兌換紀錄' }),
              el('div', { style: { marginTop: '10px' } }, S.get().redeems.filter((r) => r.studentId === st.id).slice(0, 10).map((r) =>
                el('div', { class: 'timeline-row' }, [
                  el('span', { class: 'timeline-row__icon', text: '🎁' }),
                  el('div', { class: 'grow' }, [
                    el('div', { style: { fontWeight: 700 }, text: r.itemName }),
                    el('div', { class: 'timeline-row__time', text: U.fmtDateTime(r.ts) }),
                  ]),
                  el('span', { class: 'pill ' + (r.status === 'done' ? '' : 'pill--gold'), text: r.status === 'done' ? '已領取' : '等待領取' }),
                ])
              )),
            ])
          : null,
      ]),
    ]);
  }

  /* ---------- 未選身分 ---------- */
  function needIdentity(msg) {
    return el('div', { class: 'sect' }, [
      el('div', { class: 'wrap wrap--wide' }, [
        el('div', { class: 'card', style: { textAlign: 'center', padding: '44px' } }, [
          el('div', { style: { fontSize: '48px' }, text: '🙋' }),
          el('h2', { class: 'card__title', style: { marginTop: '10px' }, text: '先告訴我你是誰' }),
          el('p', { class: 'card__sub', text: msg }),
          el('button', { class: 'btn btn--green btn--lg', style: { marginTop: '18px' }, text: '選擇我是誰', onclick: openIdentityPicker }),
        ]),
      ]),
    ]);
  }

  function needIdentityInline() {
    return el('div', { class: 'card card--flat', style: { marginBottom: '16px' } }, [
      el('div', { class: 'row row--between', style: { flexWrap: 'wrap', gap: '10px' } }, [
        el('span', { text: '選擇身分後才能兌換喔。' }),
        el('button', { class: 'btn btn--green btn--sm', text: '選擇我是誰', onclick: openIdentityPicker }),
      ]),
    ]);
  }

  /* ---------- 渲染 ---------- */
  const VIEWS = { map: viewMap, pet: viewPet, task: viewTask, mates: viewMates, shop: viewShop };

  function renderWho() {
    const st = me();
    const pet = st ? M.petById(st.petId) : null;
    $('#whoAvatar').textContent = st ? pet.emoji : '？';
    $('#whoName').textContent = st ? st.name : '選擇我是誰';
    $('#whoMeta').textContent = st
      ? '⭐ ' + st.points + ' 點 · 🪙 ' + st.coins
      : '點一下切換身分';
  }

  function render() {
    const host = $('#view');
    host.innerHTML = '';
    host.appendChild((VIEWS[view] || viewMap)());
    renderWho();
    $$('#nav .nav__item').forEach((b) => b.classList.toggle('is-active', b.dataset.view === view));
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

  /* ---------- 啟動 ---------- */
  S.init().then(() => {
    try { meId = localStorage.getItem(LS_ME); } catch (e) { meId = null; }
    if (meId && !S.student(meId)) meId = null;

    // 支援 student.html?me=座號 或 ?me=學生ID（方便每人一組 QR code）
    const q = new URLSearchParams(location.search).get('me');
    if (q) {
      const hit = S.get().students.find((x) => x.id === q || String(x.no) === q || x.name === q);
      if (hit) {
        meId = hit.id;
        try { localStorage.setItem(LS_ME, meId); } catch (e) { /* 無痕模式略過 */ }
      }
    }

    const hash = location.hash.slice(1);
    if (VIEWS[hash]) view = hash;
    $$('#nav .nav__item').forEach((b) => b.addEventListener('click', () => {
      view = b.dataset.view;
      if (location.hash.slice(1) !== view) location.hash = view;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }));
    window.addEventListener('hashchange', () => {
      const h = location.hash.slice(1);
      if (VIEWS[h] && h !== view) { view = h; render(); }
    });
    $('#whoBtn').addEventListener('click', openIdentityPicker);
    S.subscribe(render);
    bindSync();
    render();
    if (!meId) setTimeout(openIdentityPicker, 500);
  });
})();
