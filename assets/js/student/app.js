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

  /* 從目前等級進度（levelFromXp 的結果）換算「還要多少 XP 才能到某個等級」，
     累加中間每一級的升級門檻，讓「還要幾 XP 解鎖新造型」可以直接跟目前的 XP 進度對照。 */
  function xpUntilLevel(lv, targetLevel) {
    if (targetLevel <= lv.level) return 0;
    let xp = lv.need - lv.inLevel;
    for (let l = lv.level + 1; l < targetLevel; l++) xp += M.xpForNext(l);
    return xp;
  }

  /* 每週勇氣邀請卡：自己選一項做到就好，不用每個人做一樣的事；老師觀察到就會用對應的守護行動規則加點 */
  const COURAGE_CARD_ITEMS = [
    { icon: '🌞', title: '傳遞暖光', example: '主動向一位同學說出具體的感謝或鼓勵。' },
    { icon: '🚀', title: '主動爭取', example: '在小組活動中，提出「這部分我想試試看」。' },
    { icon: '💡', title: '勇敢試想', example: '說出一個還不確定的想法，加上一句「我是這樣想的……」。' },
    { icon: '🔧', title: '修正再試', example: '修正一次自己的想法，分享「我改變想法是因為……」。' },
  ];

  /* ---------- 小元件 ---------- */
  function petAvatar(st, size, showCos) {
    const pet = M.petById(st.petId);
    const level = M.levelFromXp(st.xp).level;
    const stage = M.stageOf(level);
    const cos = showCos && st.equipped ? M.COSMETICS.find((c) => c.id === st.equipped) : null;
    return el('span', { class: 'mate__avatar', style: { width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.55) + 'px' } }, [
      M.petFace(pet, Math.round(size * 0.62), S.avatarDisplayLevel(st), st.petPathId),
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
          el('div', { class: 'picker-btn__emoji' }, [M.petFace(M.petById(st.petId), 56, S.avatarDisplayLevel(st), st.petPathId)]),
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

  /* ---------- 星野主線 ---------- */
  const LS_CELEBRATED = 'classpet.storyline.celebrated';
  /* 先用記憶體裡的 Set 擋重複（保證同一次瀏覽一定不會重播），localStorage 只是「換分頁/重新整理後還記得」的加分項，
     失敗（無痕模式、file:// 開啟、儲存空間被限制…）也不該讓通關動畫在同一次瀏覽裡一直跳出來。 */
  let celebratedMemory = new Set();
  function getCelebratedSet() {
    const set = new Set(celebratedMemory);
    try { (JSON.parse(localStorage.getItem(LS_CELEBRATED) || '[]')).forEach((k) => set.add(k)); }
    catch (e) { /* 忽略，退回只在這次瀏覽記住 */ }
    return set;
  }
  function markCelebrated(key) {
    celebratedMemory.add(key);
    try {
      const stored = new Set(JSON.parse(localStorage.getItem(LS_CELEBRATED) || '[]'));
      stored.add(key);
      localStorage.setItem(LS_CELEBRATED, JSON.stringify(Array.from(stored)));
    } catch (e) { /* 忽略，這只是動畫要不要重播，不影響獎勵是否已發放 */ }
  }

  /* 通關動畫只播一次：領獎與過關判定都在資料層完成（冪等），這裡只是記錄「這台裝置這位同學看過了沒」 */
  function maybeCelebrateStoryline() {
    const st = me();
    if (!st) return;
    const story = S.get().storyline;
    if (!story || !story.active) return;
    const celebrated = getCelebratedSet();
    const c = story.chapters.find((ch) => ch.cleared && ch.rewardGranted && !celebrated.has(st.id + ':' + ch.id));
    if (!c) return;
    markCelebrated(st.id + ':' + c.id);
    U.modal({
      title: (c.rewardEmoji || '🏮') + ' ' + c.name + ' 通關了！',
      body: el('div', { class: 'stack' }, [
        el('div', { style: { textAlign: 'center' } }, [lighthouseImg(c, 'cleared', 130)]),
        el('p', { class: 'modal__text', text: c.clearStory }),
        el('p', { class: 'card__sub', style: { marginTop: '8px' }, text: (c.rewardEmoji || '🎁') + ' 獎勵：' + c.rewardTitle }),
      ]),
      actions: [{ label: '太棒了！', kind: 'primary' }],
      onClose: () => maybeCelebrateStoryline(),
    });
  }

  /* 燈塔圖示：有圖就用圖（未解鎖時用 CSS 變灰暗，不用另外準備「熄滅版」），沒有圖就退回 emoji */
  function lighthouseImg(c, state, size) {
    if (!c.lighthouseImg) return el('span', { text: state === 'locked' ? '🔒' : (c.rewardEmoji || '🗼') });
    return el('img', {
      src: c.lighthouseImg, alt: c.name,
      class: 'lighthouse__img' + (state === 'locked' ? ' is-dim' : ''),
      style: size ? { width: size + 'px', height: size + 'px' } : null,
    });
  }

  /* 守護行動的雙指標進度（行動次數／參與人數），兩個門檻都是選填，都是 0 就不顯示 */
  function chapterActionLine(c) {
    if (!(c.actionTarget > 0 || c.participantTarget > 0)) return null;
    const prog = S.storylineChapterActionProgress(S.get(), c.id);
    const parts = [];
    if (c.actionTarget > 0) parts.push('行動 ' + prog.count + ' ／ ' + c.actionTarget + ' 次');
    if (c.participantTarget > 0) parts.push('參與夥伴 ' + prog.participants + ' ／ ' + c.participantTarget + ' 人');
    const doneAction = c.actionTarget <= 0 || prog.count >= c.actionTarget;
    const doneParticipant = c.participantTarget <= 0 || prog.participants >= c.participantTarget;
    let hint;
    if (doneAction && doneParticipant) hint = '這部分條件都達成囉！';
    else if (c.participantTarget > 0 && !doneParticipant) hint = '再邀請 ' + (c.participantTarget - prog.participants) + ' 位夥伴一起加入！';
    else hint = '繼續累積行動次數！';
    return el('p', { class: 'card__sub', style: { marginTop: '6px' }, text: parts.join('　') + '　' + hint });
  }

  function openChapterDetail(c, state) {
    if (state === 'locked') {
      U.modal({
        title: '🔒 ' + c.name,
        body: el('div', {}, [
          el('div', { style: { textAlign: 'center', marginBottom: '12px' } }, [lighthouseImg(c, state, 96)]),
          el('p', { class: 'modal__text', text: '這座燈塔還沒解鎖，完成前面的關卡後就能揭開它的故事。' }),
          el('p', { class: 'card__sub', style: { marginTop: '8px' }, text: '獎勵預覽：' + (c.rewardEmoji ? c.rewardEmoji + ' ' : '') + c.rewardTitle }),
        ]),
        actions: [{ label: '關閉' }],
      });
      return;
    }
    const stars = S.storylineStars(S.get());
    U.modal({
      title: (state === 'cleared' ? '✅ ' : '🚀 ') + '第 ' + c.order + ' 關・' + c.name,
      body: el('div', {}, [
        el('div', { style: { textAlign: 'center', marginBottom: '12px' } }, [lighthouseImg(c, state, 110)]),
        el('p', { class: 'modal__text', text: state === 'cleared' ? c.clearStory : c.intro }),
        state === 'cleared'
          ? el('p', { class: 'card__sub', style: { marginTop: '10px' }, text: '通關時間：' + U.fmtDate(c.clearedAt) + '　·　獎勵：' + (c.rewardEmoji ? c.rewardEmoji + ' ' : '') + c.rewardTitle })
          : el('div', { style: { marginTop: '10px' } }, [
              progressBar(Math.round((stars / c.threshold) * 100), true),
              el('div', { class: 'row row--between', style: { marginTop: '6px', fontSize: '13px' } }, [
                el('span', { text: '共同任務：' + c.taskTitle }),
                el('b', { text: c.taskDone ? '已完成' : '未完成' }),
              ]),
              chapterActionLine(c),
            ]),
      ]),
      actions: [{ label: '關閉' }],
    });
  }

  function storylineSection(s) {
    const story = s.storyline;
    if (!story || !story.active) return null;
    const stars = S.storylineStars(s);
    const idx = S.storylineCurrentIndex(s);
    const allCleared = idx >= story.chapters.length;
    const cur = story.chapters[Math.min(idx, story.chapters.length - 1)];

    const lighthouses = el('div', { class: 'lighthouse-row' }, story.chapters.map((c, i) => {
      const state = c.cleared ? 'cleared' : (i === idx ? 'current' : 'locked');
      return el('button', { class: 'lighthouse lighthouse--' + state, onclick: () => openChapterDetail(c, state) }, [
        el('div', { class: 'lighthouse__icon' }, [lighthouseImg(c, state)]),
        el('div', { class: 'lighthouse__name', text: c.name }),
        el('div', { class: 'lighthouse__label', text: state === 'cleared' ? '已點亮' : (state === 'current' ? '進行中' : '未解鎖') }),
      ]);
    }));

    return el('section', { class: 'sect sect--soft' }, [
      el('div', { class: 'wrap wrap--wide' }, [
        sectionHead('星野主線', story.title, allCleared ? '五座燈塔全部點亮，故事完結！' : ('第 ' + cur.order + ' 關・' + cur.name + '（建議第 ' + cur.week + ' 週完成）')),
        lighthouses,
        allCleared ? null : chapterProgressCard(cur, stars),
      ]),
    ]);
  }

  function chapterProgressCard(c, stars) {
    const left = Math.max(0, c.threshold - stars);
    let statusText;
    if (stars >= c.threshold && !c.taskDone) statusText = '⭐ 星光已集滿，等待老師確認共同任務';
    else if (stars < c.threshold) statusText = '還差 ' + left + ' 顆星光';
    else statusText = '條件都符合，即將點亮燈塔！';
    return el('div', { class: 'card', style: { marginTop: '16px' } }, [
      el('p', { class: 'card__sub', text: c.intro }),
      el('div', { style: { marginTop: '10px' } }, [progressBar(Math.round((stars / c.threshold) * 100), true)]),
      el('div', { class: 'row row--between', style: { marginTop: '8px', fontSize: '13px' } }, [
        el('span', { text: '本篇章星光 ' + stars.toLocaleString() }),
        el('b', { text: stars.toLocaleString() + ' / ' + c.threshold.toLocaleString() }),
      ]),
      el('div', { class: 'row row--between', style: { marginTop: '10px', flexWrap: 'wrap', gap: '8px' } }, [
        el('span', { class: 'pill' + (c.taskDone ? '' : ' pill--gray'), text: (c.taskDone ? '✅ ' : '⏳ ') + c.taskTitle }),
        el('span', { class: 'muted', style: { fontSize: '12.5px' }, text: statusText }),
      ]),
      el('div', { class: 'muted', style: { fontSize: '12.5px', marginTop: '8px' }, text: '過關獎勵：' + (c.rewardEmoji ? c.rewardEmoji + ' ' : '') + c.rewardTitle }),
      chapterActionLine(c),
    ]);
  }

  /* ================= 視圖：探險地圖 ================= */
  function viewMap() {
    const s = S.get();
    const st = me();
    const lv = st ? M.levelFromXp(st.xp) : null;
    const pet = st ? M.petById(st.petId) : M.petById(M.PETS[5].id);
    const mission = s.classMission;
    const story = s.storyline;
    const storyActive = !!(story && story.active);
    const storyIdx = storyActive ? S.storylineCurrentIndex(s) : -1;
    const storyChapter = storyActive && storyIdx < story.chapters.length ? story.chapters[storyIdx] : null;
    const heroBgChapter = storyChapter || (storyActive ? story.chapters[story.chapters.length - 1] : null);
    const storyStars = storyActive ? S.storylineStars(s) : 0;
    const missionLeft = storyChapter ? Math.max(0, storyChapter.threshold - storyStars) : Math.max(0, mission.target - mission.progress);
    const day = Math.max(1, Math.round((Date.now() - s.classInfo.startedAt) / 86400000));

    const deco = el('div', { class: 'hero__deco' });
    [['🌲', 6, 18], ['🌳', 14, 52], ['🌲', 24, 12], ['🌸', 30, 70], ['🌲', 40, 30],
     ['🍄', 47, 74], ['🌳', 58, 16], ['⭐', 52, 42], ['🌲', 70, 26], ['🌷', 78, 64],
     ['🌲', 86, 20], ['🦋', 64, 58]].forEach(([e, left, top]) => {
      deco.appendChild(el('span', { text: e, style: { left: left + '%', top: top + '%' } }));
    });

    const usePhotoHero = !!(heroBgChapter && heroBgChapter.bg);
    return el('div', {}, [
      el('section', { class: 'hero' + (usePhotoHero ? ' hero--photo' : ''), style: usePhotoHero ? { backgroundImage: "url('" + heroBgChapter.bg + "')" } : null }, [
        usePhotoHero ? null : el('div', { class: 'hero__path' }),
        usePhotoHero ? null : deco,
        el('div', { class: 'wrap wrap--wide hero__inner' }, [
          el('div', { class: 'hero-card' }, [
            el('div', { class: 'hero-card__eyebrow', text: '第 ' + day + ' 天 · ' + s.classInfo.term }),
            el('h1', { class: 'hero-card__title', html: (st ? st.name : s.classInfo.className) + '的<br>星光冒險' }),
            el('p', { class: 'hero-card__desc', text: '每一次專注、合作與勇敢，都會讓班級的探險地圖再前進一步。' }),
            st
              ? (() => {
                  const pathName = st.petPathId ? M.petPathName(pet, st.petPathId) : '';
                  const nextStage = (s.petStageLevels || []).find((t) => (t.minLevel || 1) > lv.level);
                  return el('div', { class: 'hero-card__pet' }, [
                    el('span', { style: { fontSize: '30px' } }, [M.petFace(pet, 34, S.avatarDisplayLevel(st), st.petPathId)]),
                    el('div', { class: 'grow' }, [
                      el('div', { style: { fontWeight: 800 }, text: (st.petName || pet.name) + (pathName ? '・' + pathName : '') + ' Lv.' + lv.level }),
                      el('div', { class: 'muted', style: { fontSize: '13px' }, text: '再獲得 ' + (lv.need - lv.inLevel) + ' XP 升到 Lv.' + (lv.level + 1) }),
                      nextStage
                        ? el('div', { class: 'muted', style: { fontSize: '13px' }, text: '再 ' + xpUntilLevel(lv, nextStage.minLevel) + ' XP 解鎖新造型（Lv.' + nextStage.minLevel + '・' + nextStage.name + '）' })
                        : null,
                    ]),
                  ]);
                })()
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
          el('div', { class: 'hero-mission' }, storyChapter ? [
            el('div', { class: 'hero-mission__label', text: '🌟 星野主線・第 ' + storyChapter.order + ' 關 ' + storyChapter.name }),
            el('div', { class: 'hero-mission__title', text: storyChapter.taskTitle }),
            progressBar(Math.round((storyStars / storyChapter.threshold) * 100)),
            el('div', { class: 'row row--between', style: { marginTop: '8px', fontSize: '13px' } }, [
              el('span', { text: '本篇章星光 ' + storyStars }),
              el('b', { text: storyStars + ' / ' + storyChapter.threshold }),
            ]),
          ] : storyActive ? [
            el('div', { class: 'hero-mission__label', text: '🌟 星野主線' }),
            el('div', { class: 'hero-mission__title', text: '五座燈塔全部點亮了！' }),
          ] : [
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
          el('div', { class: 'hero-pet__bubble', text: storyChapter ? ('再 ' + missionLeft + ' 顆星光就能點亮下一座燈塔！') : ('再 ' + missionLeft + ' 點就能打開森林寶箱！') }),
          el('div', { class: 'hero-pet__face' }, [M.petFace(pet, 220, st ? S.avatarDisplayLevel(st) : 1, st ? st.petPathId : null)]),
        ]),
      ]),

      storylineSection(s),

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
        members.slice(0, 8).map((m) => el('span', { title: m.name }, [M.petFace(M.petById(m.petId), 28, S.avatarDisplayLevel(m), m.petPathId)]))),
    ]);
  }

  /* ================= 視圖：我的寵物 ================= */
  /* 造型收藏：把「已經達到過的造型階段」都列出來，已達到的可以直接點來穿上（純外觀選擇，
     不影響等級、XP 或畫面上顯示的階段名稱），還沒達到的用灰階＋鎖頭顯示，點了也沒作用。 */
  function stageGalleryCard(st, lv, pet) {
    const s = S.get();
    const levels = s.petStageLevels || [];
    let autoIdx = 0;
    levels.forEach((t, i) => { if ((t.minLevel || 1) <= lv.level) autoIdx = i; });
    const overrideOk = st.avatarStageIdx !== null && st.avatarStageIdx !== undefined
      && levels[st.avatarStageIdx] && (levels[st.avatarStageIdx].minLevel || 1) <= lv.level;
    const activeIdx = overrideOk ? st.avatarStageIdx : autoIdx;
    const unlockedCount = levels.filter((t) => (t.minLevel || 1) <= lv.level).length;
    return el('div', { class: 'card' }, [
      el('div', { class: 'card__head' }, [
        el('div', {}, [
          el('h3', { class: 'card__title', text: '造型收藏' }),
          el('p', { class: 'card__sub', text: '已經達到的造型都能隨時穿上，不會影響等級、XP 或目前的階段名稱。' }),
        ]),
        el('span', { class: 'pill', text: unlockedCount + ' / ' + levels.length }),
      ]),
      el('div', { class: 'cos-grid' }, levels.map((t, idx) => {
        const unlocked = (t.minLevel || 1) <= lv.level;
        const active = idx === activeIdx;
        return el('button', {
          class: 'cos' + (unlocked ? ' is-owned' : ' is-locked') + (active ? ' is-equipped' : ''),
          onclick: () => {
            if (!unlocked) return U.toast('升到 Lv.' + (t.minLevel || 1) + ' 才會解鎖', 'warn');
            S.setAvatarStage(st.id, idx);
            U.toast('換上「' + t.name + '」造型！');
          },
        }, [
          active ? el('span', { class: 'cos__tag', text: '穿著中' }) : null,
          el('div', {
            style: { marginBottom: '6px', filter: unlocked ? 'none' : 'grayscale(1)', opacity: unlocked ? 1 : .55 },
          }, [M.petFace(pet, 76, t.minLevel || 1, st.petPathId)]),
          unlocked ? null : el('span', { style: { position: 'absolute', top: '8px', right: '8px', fontSize: '16px' }, text: '🔒' }),
          el('div', { class: 'cos__name', text: t.name }),
          el('div', { class: 'cos__meta', text: unlocked ? 'Lv.' + (t.minLevel || 1) : '需 Lv.' + (t.minLevel || 1) }),
        ]);
      })),
    ]);
  }

  /* 身分路線卡：V4 之前顯示預告，V4 之後可以選擇／切換／解鎖新路線；已解鎖的路線隨時免費切換，
     不影響等級、XP、星光；還沒解鎖的路線要花金幣購買（金額看老師設定），或等老師贈送、或從星野主線關卡獎勵拿到。 */
  function petPathCard(st, lv, pet) {
    const s = S.get();
    const paths = s.petPaths || [];
    const cost = Math.max(0, (s.settings || {}).pathUnlockCost || 0);
    const branchLevel = M.DEFAULT_PET_STAGES[M.PATH_BRANCH_STAGE_INDEX].minLevel;
    const branchName = M.DEFAULT_PET_STAGES[M.PATH_BRANCH_STAGE_INDEX].name;
    if (lv.level < branchLevel) {
      return el('div', { class: 'card' }, [
        el('h3', { class: 'card__title', text: '🌟 身分路線' }),
        el('p', { class: 'card__sub', text: '升到 Lv.' + branchLevel + '（' + branchName + '）就能選擇一條專屬的成長路線，外型會從這裡開始分岔！' }),
        el('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap', marginTop: '10px' } }, paths.map((p) => el('span', { class: 'pill pill--gray', text: M.petPathName(pet, p.id) }))),
      ]);
    }
    return el('div', { class: 'card' }, [
      el('div', { class: 'card__head' }, [
        el('div', {}, [
          el('h3', { class: 'card__title', text: '🌟 身分路線' }),
          el('p', { class: 'card__sub', text: '已經解鎖過的路線可以隨時免費切換；還沒解鎖的要花 🪙' + cost + ' 金幣購買，或等老師贈送、完成星野主線任務。' }),
        ]),
      ]),
      el('div', { class: 'cos-grid' }, paths.map((p) => {
        const unlocked = (st.unlockedPaths || []).indexOf(p.id) >= 0;
        const active = st.petPathId === p.id;
        return el('button', {
          class: 'cos' + (unlocked ? ' is-owned' : '') + (active ? ' is-equipped' : ''),
          onclick: () => {
            const r = S.choosePetPath(st.id, p.id);
            if (!r.ok) return U.toast(r.msg, 'warn');
            U.toast(r.unlocked ? '🎉 花費 ' + cost + ' 金幣解鎖了「' + M.petPathName(pet, p.id) + '」路線！' : '已切換成「' + M.petPathName(pet, p.id) + '」');
          },
        }, [
          active ? el('span', { class: 'cos__tag', text: '使用中' }) : null,
          el('div', { style: { marginBottom: '6px' } }, [M.petFace(pet, 76, lv.level, p.id)]),
          el('div', { class: 'cos__name', text: M.petPathName(pet, p.id) }),
          el('div', { class: 'cos__meta', text: unlocked ? '已解鎖' : '🪙 ' + cost + ' 金幣解鎖' }),
        ]);
      })),
    ]);
  }

  /* 第一次升到 V4 時，跳出一次性的選擇路線視窗；用跟通關動畫同一套「這次瀏覽記過了沒」機制擋重複跳出 */
  function maybeShowPathChoice() {
    const st = me();
    if (!st) return;
    const lv = M.levelFromXp(st.xp);
    const branchLevel = M.DEFAULT_PET_STAGES[M.PATH_BRANCH_STAGE_INDEX].minLevel;
    if (lv.level < branchLevel) return;
    if ((st.unlockedPaths || []).length > 0) return;
    const key = 'pathprompt:' + st.id;
    if (getCelebratedSet().has(key)) return;
    markCelebrated(key);
    const pet = M.petById(st.petId);
    const paths = S.get().petPaths || [];
    const dlg = U.modal({
      title: '🌟 選擇專屬身分路線！',
      wide: true,
      body: el('div', { class: 'stack' }, [
        el('p', { class: 'modal__text', text: (st.petName || pet.name) + ' 長大到「' + M.DEFAULT_PET_STAGES[M.PATH_BRANCH_STAGE_INDEX].name + '」了！選一條路線，接下來的造型都會走這條路，之後也能在「我的寵物」隨時切換或解鎖其他路線。' }),
        el('div', { class: 'cos-grid' }, paths.map((p) => el('button', {
          class: 'cos',
          onclick: () => {
            const r = S.choosePetPath(st.id, p.id);
            if (!r.ok) return U.toast(r.msg, 'warn');
            U.toast('🎉 選擇了「' + M.petPathName(pet, p.id) + '」路線！');
            dlg.close();
          },
        }, [
          el('div', { style: { marginBottom: '6px' } }, [M.petFace(pet, 76, lv.level, p.id)]),
          el('div', { class: 'cos__name', text: M.petPathName(pet, p.id) }),
        ]))),
      ]),
      actions: [{ label: '稍後再選' }],
    });
  }

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
              M.petFace(pet, 230, S.avatarDisplayLevel(st), st.petPathId),
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

            petPathCard(st, lv, pet),

            stageGalleryCard(st, lv, pet),

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
            el('div', { class: 'card', style: { background: 'var(--green-soft)', border: '1.5px solid var(--green)' } }, [
              el('h3', { class: 'card__title', text: '🌟 今天為星野帶來哪一道光？' }),
              el('p', { class: 'card__sub', style: { marginBottom: '12px' }, text: '自己選一項做到就可以，不用每個人做一樣的事。' }),
              el('div', { class: 'stack', style: { gap: '10px' } }, COURAGE_CARD_ITEMS.map((it) =>
                el('div', { class: 'task-row' }, [
                  el('span', { class: 'task-row__icon', text: it.icon }),
                  el('div', { class: 'grow' }, [
                    el('div', { class: 'task-row__title', text: it.title }),
                    el('div', { class: 'task-row__meta', text: it.example }),
                  ]),
                ])
              )),
            ]),
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
    try { maybeCelebrateStoryline(); } catch (e) { /* 動畫失敗不該擋住正常畫面 */ }
    try { maybeShowPathChoice(); } catch (e) { /* 同上 */ }
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
