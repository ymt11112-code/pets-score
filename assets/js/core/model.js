/* 資料模型、成長公式、預設種子資料（window.PetModel） */
(function (global) {
  'use strict';

  const U = global.PetUtil;

  /* ============ 寵物圖鑑 ============
     圖像先用 emoji 佔位；之後換成圖片只要把 img 欄位填上路徑，
     介面會自動改用 <img>（見 petFace()）。 */
  const PETS = [
    { id: 'cat',     name: '奶茶貓',   emoji: '🐱', img: '', trait: '陪伴系', desc: '安靜的時候最可靠，喜歡看同學專心上課。' },
    { id: 'corgi',   name: '活力柯基', emoji: '🐶', img: '', trait: '活力系', desc: '永遠停不下來，最愛小組合作任務。' },
    { id: 'bunny',   name: '雲朵兔',   emoji: '🐰', img: '', trait: '關懷系', desc: '耳朵很靈，聽得見每一句鼓勵的話。' },
    { id: 'fox',     name: '橘子狐',   emoji: '🦊', img: '', trait: '智慧系', desc: '喜歡解謎，作業準時交會特別開心。' },
    { id: 'panda',   name: '麻糬熊貓', emoji: '🐼', img: '', trait: '合作系', desc: '慢慢來但很穩，是小隊裡的和事佬。' },
    { id: 'otter',   name: '栗子水獺', emoji: '🦦', img: '', trait: '探索系', desc: '好奇心滿點，總是第一個舉手發問。' },
    { id: 'hamster', name: '花生鼠',   emoji: '🐹', img: '', trait: '整潔系', desc: '最在意桌面整不整齊的小傢伙。' },
    { id: 'penguin', name: '冰塊企鵝', emoji: '🐧', img: '', trait: '堅持系', desc: '一步一步走，連續紀錄的守護者。' },
    { id: 'dragon',  name: '抹茶小龍', emoji: '🐲', img: '', trait: '勇氣系', desc: '遇到難題不退縮，會噴出鼓勵的火花。' },
    { id: 'alpaca',  name: '棉花羊駝', emoji: '🦙', img: '', trait: '溫柔系', desc: '毛茸茸的擁抱，專治上台前的緊張。' },
    { id: 'capy',    name: '悠哉水豚', emoji: '🦫', img: '', trait: '穩定系', desc: '從不慌張，教大家好好呼吸。' },
    { id: 'bear',    name: '蜂蜜小熊', emoji: '🐻', img: '', trait: '力量系', desc: '搬桌椅、整理公共區域的第一名。' },
  ];

  /* 寵物成長階段 */
  const STAGES = [
    { key: 'egg',    name: '蛋',     minLevel: 1,  badge: '🥚' },
    { key: 'baby',   name: '幼生期', minLevel: 3,  badge: '🌱' },
    { key: 'teen',   name: '成長期', minLevel: 6,  badge: '✨' },
    { key: 'adult',  name: '完全體', minLevel: 10, badge: '👑' },
    { key: 'legend', name: '傳說級', minLevel: 15, badge: '🌟' },
  ];

  /* 每隻寵物預設的 10 段進化階段（老師可在「寵物與徽章」頁改名稱、等級與圖片） */
  const DEFAULT_PET_STAGES = [
    { minLevel: 1,  name: '寵物蛋' },
    { minLevel: 3,  name: '幼胚體' },
    { minLevel: 6,  name: '幼年體' },
    { minLevel: 10, name: '成長體' },
    { minLevel: 15, name: '成熟體' },
    { minLevel: 20, name: '覺醒體' },
    { minLevel: 26, name: '魔幻體' },
    { minLevel: 33, name: '聖獸體' },
    { minLevel: 41, name: '幻獸體' },
    { minLevel: 50, name: '神獸體' },
  ];


  /* 造型（金幣解鎖 / 等級解鎖） */
  const COSMETICS = [
    { id: 'hat_star',   name: '星星帽',     emoji: '⭐', cost: 30,  unlockLevel: 2 },
    { id: 'scarf',      name: '毛線圍巾',   emoji: '🧣', cost: 40,  unlockLevel: 3 },
    { id: 'glasses',    name: '閱讀眼鏡',   emoji: '👓', cost: 50,  unlockLevel: 4 },
    { id: 'crown',      name: '小皇冠',     emoji: '👑', cost: 80,  unlockLevel: 6 },
    { id: 'wings',      name: '透明翅膀',   emoji: '🦋', cost: 100, unlockLevel: 8 },
    { id: 'cape',       name: '探險披風',   emoji: '🧥', cost: 120, unlockLevel: 10 },
    { id: 'halo',       name: '光環',       emoji: '💫', cost: 160, unlockLevel: 12 },
    { id: 'flower',     name: '小花花圈',   emoji: '🌸', cost: 25,  unlockLevel: 1 },
  ];

  /* 餵食道具 */
  const FOODS = [
    { id: 'berry',  name: '莓果',   emoji: '🍓', cost: 3,  xp: 4 },
    { id: 'bread',  name: '小麵包', emoji: '🥐', cost: 6,  xp: 9 },
    { id: 'cake',   name: '蛋糕',   emoji: '🍰', cost: 12, xp: 20 },
    { id: 'star',   name: '星星糖', emoji: '🌟', cost: 25, xp: 45 },
  ];

  /* 徽章條件 */
  const BADGES = [
    { id: 'first_step',  name: '第一步',     emoji: '👣', desc: '獲得第一筆點數',           test: (s) => s.totalPoints >= 1 },
    { id: 'p50',         name: '五十里程',   emoji: '🎯', desc: '累積 50 點',               test: (s) => s.totalPoints >= 50 },
    { id: 'p100',        name: '百點探險家', emoji: '🏅', desc: '累積 100 點',              test: (s) => s.totalPoints >= 100 },
    { id: 'streak7',     name: '七日堅持',   emoji: '🔥', desc: '連續 7 天有好表現',        test: (s) => s.streak >= 7 },
    { id: 'streak14',    name: '雙週不間斷', emoji: '💪', desc: '連續 14 天有好表現',       test: (s) => s.streak >= 14 },
    { id: 'lv5',         name: '成長中',     emoji: '🌱', desc: '寵物達到 Lv.5',            test: (s) => s.petLevel >= 5 },
    { id: 'lv10',        name: '完全體',     emoji: '👑', desc: '寵物達到 Lv.10',           test: (s) => s.petLevel >= 10 },
    { id: 'helper',      name: '小幫手',     emoji: '❤️', desc: '主動幫忙 10 次',           test: (s) => (s.ruleCount && s.ruleCount.help) >= 10 },
    { id: 'tidy',        name: '整潔達人',   emoji: '🧹', desc: '環境整潔 10 次',           test: (s) => (s.ruleCount && s.ruleCount.tidy) >= 10 },
    { id: 'teamwork',    name: '合作高手',   emoji: '🤝', desc: '小組合作 8 次',            test: (s) => (s.ruleCount && s.ruleCount.team) >= 8 },
    { id: 'stylist',     name: '造型收藏家', emoji: '🎀', desc: '解鎖 3 種造型',            test: (s) => (s.cosmetics || []).length >= 3 },
    { id: 'shopper',     name: '第一次兌換', emoji: '🎁', desc: '在商店兌換一次',           test: (s) => (s.redeemCount || 0) >= 1 },
  ];

  /* 預設加分規則（老師可自訂） */
  const DEFAULT_RULES = [
    { id: 'homework', label: '準時交作業', icon: '📚', points: 2, xp: 3, coins: 2, kind: 'add' },
    { id: 'ontime',   label: '準時上課',   icon: '⏰', points: 1, xp: 2, coins: 1, kind: 'add' },
    { id: 'help',     label: '主動幫忙',   icon: '❤️', points: 2, xp: 3, coins: 2, kind: 'add' },
    { id: 'team',     label: '小組合作',   icon: '👥', points: 3, xp: 4, coins: 3, kind: 'add' },
    { id: 'tidy',     label: '整理座位',   icon: '🌱', points: 1, xp: 2, coins: 1, kind: 'add' },
    { id: 'focus',    label: '上課專注',   icon: '🔍', points: 1, xp: 2, coins: 1, kind: 'add' },
    { id: 'cheer',    label: '鼓勵同學',   icon: '🏆', points: 2, xp: 3, coins: 2, kind: 'add' },
    { id: 'mission',  label: '完成共同任務', icon: '🗺️', points: 3, xp: 5, coins: 3, kind: 'add' },
    { id: 'remind',   label: '溫馨提醒',   icon: '💭', points: -1, xp: 0, coins: 0, kind: 'deduct' },
  ];

  /* 預設兌換商店 */
  const DEFAULT_SHOP = [
    { id: 'sh_seat',   name: '座位選擇券',   icon: '🪑', cost: 60,  stock: 5,  desc: '下週可以自己挑一次座位' },
    { id: 'sh_music',  name: '點歌一首',     icon: '🎵', cost: 40,  stock: 10, desc: '午休時間播放你選的歌' },
    { id: 'sh_helper', name: '小老師體驗',   icon: '🧑‍🏫', cost: 80,  stock: 3,  desc: '當一節課的小老師' },
    { id: 'sh_nohw',   name: '作業免寫券',   icon: '📄', cost: 120, stock: 2,  desc: '可折抵一次小份量作業' },
    { id: 'sh_sticker',name: '貼紙一張',     icon: '✨', cost: 15,  stock: 50, desc: '班級限定貼紙' },
    { id: 'sh_game',   name: '班級遊戲時間', icon: '🎲', cost: 200, stock: 1,  desc: '全班一起玩 15 分鐘（團體兌換）' },
  ];

  /* 批次加點頁底部工具列：預設項目與順序（util: 開頭是內建工具，其餘是規則 id） */
  const DEFAULT_TOOLBAR = [
    'util:attendance', 'ontime', 'util:multi', 'util:random', 'util:timer', 'util:custom',
    'util:tasks', 'homework', 'help', 'team', 'tidy', 'focus', 'cheer', 'mission', 'remind',
  ];

  const TOOLBAR_TOOLS = [
    { id: 'util:attendance', icon: '📋', label: '出席' },
    { id: 'util:multi',      icon: '☑️', label: '多選' },
    { id: 'util:random',     icon: '🎲', label: '隨機抽籤' },
    { id: 'util:timer',      icon: '⏱️', label: '計時器' },
    { id: 'util:custom',     icon: '➕', label: '自訂點數' },
    { id: 'util:tasks',      icon: '📗', label: '今日任務' },
  ];

  /* ============ 星野守護隊：動物夥伴的遠征（主線故事） ============
     五關的「設定值」都集中在這裡，教師端可以改門檻／任務文字／獎勵說明，
     但不會動到 id（id 是老師勾選完成、判斷過關狀態的依據，不能改）。 */
  const STORYLINE_TITLE = '星野守護隊：動物夥伴的遠征';
  const STORYLINE_CHAPTERS = [
    {
      id: 'ch1', order: 1, name: '微光森林', week: 7, threshold: 180,
      taskTitle: '全班完成守護隊公約', rewardTitle: '森林背景、第一座燈塔點亮', rewardEmoji: '🌲',
      intro: '星野的第一座燈塔正在熄滅，微光森林霧氣瀰漫。守護隊員與動物夥伴踏進林道，只要蒐集星光、完成守護隊公約，就能讓森林重新亮起。',
      clearStory: '最後一道公約完成的瞬間，森林深處傳來低鳴——燈塔亮了！動物夥伴們的眼睛閃著光，守護隊踏出了遠征的第一步。',
    },
    {
      id: 'ch2', order: 2, name: '回聲溪谷', week: 10, threshold: 370,
      taskTitle: '完成 1 次分工合作挑戰', rewardTitle: '溪谷背景、共同裝飾', rewardEmoji: '🏞️',
      intro: '沿著微光森林往前，是回聲溪谷。溪水沖刷著岩壁，傳來奇異的回聲。傳說唯有真正分工合作的隊伍，才能讓溪谷聽懂他們的心聲。',
      clearStory: '當分工合作的挑戰完成，溪谷的回聲忽然變成清亮的歌聲。第二座燈塔緩緩亮起，照亮了前方更遠的路。',
    },
    {
      id: 'ch3', order: 3, name: '風語高地', week: 13, threshold: 560,
      taskTitle: '完成 2 種不同類型的合作挑戰', rewardTitle: '限定寵物配件、第三座燈塔', rewardEmoji: '🎐',
      intro: '風語高地終年強風呼嘯，據說風裡藏著古老的訊息。守護隊必須完成不同的合作挑戰，才能聽懂風想說的話，點亮第三座燈塔。',
      clearStory: '當兩種挑戰都完成，狂風忽然靜了下來，化作溫柔的低語。第三座燈塔亮起，限定的守護配件也悄悄出現在動物夥伴身上。',
    },
    {
      id: 'ch4', order: 4, name: '雲端星塔', week: 16, threshold: 750,
      taskTitle: '完成 1 次班級服務任務', rewardTitle: '星塔背景、班級隊伍稱號', rewardEmoji: '🌌',
      intro: '雲端星塔聳立在雲海之上，是離星空最近的地方。守護隊要完成一次班級服務任務，證明自己不只守護彼此，也守護整個星野。',
      clearStory: '服務任務完成的那天，雲海散開，星塔頂端亮起耀眼的光。守護隊獲得了屬於自己的隊伍稱號，向著最後一座燈塔前進。',
    },
    {
      id: 'ch5', order: 5, name: '星野再啟', week: 20, threshold: 1000,
      taskTitle: '完成班級成長圖鑑', rewardTitle: '終章紀念徽章與結局畫面', rewardEmoji: '🏅',
      intro: '旅程來到終章。只要完成班級成長圖鑑，記錄下這一路的蛻變，星野最後一座燈塔就會被重新點亮。',
      clearStory: '五座燈塔同時亮起，照亮了整片星野。守護隊員與動物夥伴並肩而立，這不是結束，而是下一段冒險的開始。',
    },
  ];

  function seedStoryline() {
    return {
      active: false,
      activatedAt: 0,
      title: STORYLINE_TITLE,
      chapters: STORYLINE_CHAPTERS.map((c) => Object.assign({}, c, {
        taskDone: false, taskDoneAt: 0, taskNote: '',
        cleared: false, clearedAt: 0, rewardGranted: false, rewardGrantedAt: 0,
      })),
    };
  }

  const GROUP_PRESET = [
    { id: 'g1', name: '星光小隊', emoji: '🌟', color: '#f6c453' },
    { id: 'g2', name: '森林小隊', emoji: '🌳', color: '#4caf7d' },
    { id: 'g3', name: '海洋小隊', emoji: '🌊', color: '#4aa3d8' },
    { id: 'g4', name: '雲朵小隊', emoji: '☁️', color: '#9c8ade' },
    { id: 'g5', name: '太陽小隊', emoji: '☀️', color: '#f08a5d' },
  ];

  const NAMES = [
    '陳語晴', '王柏宇', '林宥安', '張子晴', '李承翰', '黃昱翔', '吳品妍', '劉冠廷',
    '蔡沛恩', '楊詠晴', '許家豪', '鄭雨彤', '謝宇軒', '郭芷妍', '洪睿哲', '曾心妤',
    '邱柏諺', '賴妍希', '廖子恩', '徐若彤', '周奕辰', '葉采潔', '蘇品皓', '莊雅涵',
    '江秉謙', '何語芯', '羅宥丞', '高以安', '潘品蓁', '彭冠宇', '簡詠恩', '杜承睿',
    '方沛婕', '戴子齊', '宋欣妤', '馮子睿', '唐芯瑜', '石柏叡', '程語彤', '溫皓宇',
  ];

  /* ============ 成長公式 ============
     升到下一級所需 XP：20 + (level-1) * 10 */
  function xpForNext(level) {
    return 20 + (Math.max(1, level) - 1) * 10;
  }

  /* 把累積 XP 換算成等級與當級進度 */
  function levelFromXp(totalXp) {
    let level = 1;
    let rest = Math.max(0, Math.floor(totalXp || 0));
    while (rest >= xpForNext(level) && level < 99) {
      rest -= xpForNext(level);
      level += 1;
    }
    const need = xpForNext(level);
    return { level, inLevel: rest, need, percent: Math.round((rest / need) * 100) };
  }

  function stageOf(level) {
    let cur = STAGES[0];
    STAGES.forEach((s) => {
      if (level >= s.minLevel) cur = s;
    });
    return cur;
  }

  /* 讀取班級資料裡跟寵物圖鑑相關的自訂內容：改過的名稱、老師新增的寵物、老師刪掉的內建寵物 */
  function classPetData() {
    try {
      const S = global.PetStore;
      if (S && S.get) {
        const s = S.get() || {};
        return { names: s.petNames || {}, extra: s.customPets || [], deleted: s.deletedPetIds || [] };
      }
    } catch (e) { /* store 還沒準備好就當作沒有任何自訂 */ }
    return { names: {}, extra: [], deleted: [] };
  }

  function resolvePetName(p, names) {
    const custom = names[p.id];
    return custom ? Object.assign({}, p, { name: custom }) : p;
  }

  /* 取得全部「目前可用」的寵物圖鑑：內建寵物（扣掉被刪除的）＋ 老師自己新增的寵物，並套用自訂名稱。
     下拉選單、圖鑑列表、抽新寵物等都應該用這個，而不是直接用 PETS。 */
  function allPets() {
    const { names, extra, deleted } = classPetData();
    const builtin = PETS.filter((p) => deleted.indexOf(p.id) < 0);
    return builtin.concat(extra).map((p) => resolvePetName(p, names));
  }

  function petById(id) {
    const list = allPets();
    return list.find((p) => p.id === id) || list[0] || PETS[0];
  }

  /* 依等級挑選老師在後台設定的造型圖片。
     等級門檻是全班共用的一份清單（state.petStageLevels），每隻寵物只存自己在各階段的圖片
     （state.petImages[petId]，跟 petStageLevels 用陣列位置對應，不是各自存一份等級）。
     找不到就退回 pet.img（單張固定圖），再退回 emoji。 */
  function stageImageFor(pet, level) {
    let levels = null;
    let images = null;
    try {
      const S = global.PetStore;
      if (S && S.get) {
        const s = S.get() || {};
        levels = s.petStageLevels;
        images = (s.petImages || {})[pet.id];
      }
    } catch (e) { /* store 還沒準備好 */ }
    if (!levels || !levels.length || !images || !images.length) return pet.img || '';

    const lv = level == null ? -Infinity : level;
    let bestIdx = -1;
    levels.forEach((t, i) => {
      const min = t.minLevel || 1;
      if (min <= lv && (bestIdx < 0 || min > (levels[bestIdx].minLevel || 1))) bestIdx = i;
    });
    // 從符合等級的那一階開始往前找最近一個「有設定圖片」的階段
    for (let i = bestIdx; i >= 0; i--) { if (images[i]) return images[i]; }
    // 等級還沒到第一個門檻時，先用最早設定好的那張圖當起始造型
    for (let i = 0; i < images.length; i++) { if (images[i]) return images[i]; }
    return pet.img || '';
  }

  /* 寵物外觀：依目前等級選對應造型圖片，沒有設定就用 emoji。level 可省略（例如陳列用途）。 */
  function petFace(pet, size, level) {
    const p = typeof pet === 'string' ? petById(pet) : pet || PETS[0];
    const img = stageImageFor(p, level);
    if (img) {
      // 用 contain 而不是 cover：完整顯示老師上傳的圖片，不裁切；外層的圓形泡泡（.pet-avatar／
      // .avatar-card__face 等）本來就比這裡的 size 大一些並置中對齊，所以圖片不會貼到圓形邊緣。
      return U.el('img', {
        class: 'pet-face', src: img, alt: p.name,
        style: size ? { width: size + 'px', height: size + 'px', objectFit: 'contain' } : { objectFit: 'contain' },
      });
    }
    return U.el('span', {
      class: 'pet-face pet-face--emoji',
      text: p.emoji,
      style: size ? { fontSize: Math.round(size * 0.72) + 'px', width: size + 'px', height: size + 'px' } : null,
    });
  }

  /* ============ 種子資料 ============ */
  function seedState() {
    const now = Date.now();
    const students = NAMES.map((name, i) => {
      const petLevel = [2, 5, 8, 11, 3, 6, 9, 12][i % 8];
      let totalXp = 0;
      for (let lv = 1; lv < petLevel; lv++) totalXp += xpForNext(lv);
      totalXp += Math.floor(xpForNext(petLevel) * ((i * 13) % 90) / 100);
      return {
        id: 's' + U.pad2(i + 1),
        no: i + 1,
        name,
        groupId: GROUP_PRESET[i % GROUP_PRESET.length].id,
        petId: PETS[i % PETS.length].id,
        petName: '',
        xp: totalXp,
        points: 20 + ((i * 7) % 45),
        coins: 10 + ((i * 11) % 60),
        streak: 1 + ((i * 5) % 18),
        cosmetics: i % 4 === 0 ? ['flower'] : [],
        equipped: i % 4 === 0 ? 'flower' : '',
        badges: [],
        redeemCount: 0,
        ruleCount: {},
        totalPoints: 20 + ((i * 7) % 45),
        lastActiveAt: now - (i % 3) * 86400000,
        active: true,
      };
    });

    const ledger = [];
    const sampleRules = ['help', 'focus', 'homework', 'cheer', 'team', 'tidy'];
    for (let i = 0; i < 24; i++) {
      const st = students[(i * 5) % students.length];
      const rule = DEFAULT_RULES.find((r) => r.id === sampleRules[i % sampleRules.length]);
      ledger.push({
        id: U.uid('lg'),
        ts: now - i * 1000 * 60 * (7 + (i % 5)),
        studentIds: [st.id],
        ruleId: rule.id,
        label: rule.label,
        points: rule.points,
        xp: rule.xp,
        coins: rule.coins,
        note: '',
        by: '江信瑩老師',
        undone: false,
      });
    }

    return {
      version: 1,
      updatedAt: now,
      classInfo: {
        school: '高雄市陽明國小',
        className: '五年十四班',
        teacher: '江信瑩老師',
        term: '森林篇章',
        startedAt: now - 17 * 86400000,
        classStreak: 18,
        classStars: 1286,
        badgeCount: 27,
        studentPin: '', // 留空＝學生前台不需密碼
        teacherPin: '',
      },
      groups: U.deepClone(GROUP_PRESET),
      students,
      rules: U.deepClone(DEFAULT_RULES),
      shop: U.deepClone(DEFAULT_SHOP),
      toolbar: U.deepClone(DEFAULT_TOOLBAR),
      attendance: {},
      petStageLevels: DEFAULT_PET_STAGES.map((s) => ({ minLevel: s.minLevel, name: s.name })),
      petImages: PETS.reduce((acc, p) => {
        acc[p.id] = new Array(DEFAULT_PET_STAGES.length).fill('');
        return acc;
      }, {}),
      petNames: {},
      customPets: [],
      deletedPetIds: [],
      ledger,
      dailyTasks: [
        { id: 'dt1', title: '晨間閱讀 20 分鐘', icon: '📗', xp: 2, target: 40, done: 31 },
        { id: 'dt2', title: '小組合作不落單', icon: '👥', xp: 3, target: 5,  done: 4 },
        { id: 'dt3', title: '離開座位前整理桌面', icon: '🌱', xp: 1, target: 40, done: 35 },
        { id: 'dt4', title: '主動說一句鼓勵的話', icon: '❤️', xp: 2, target: 40, done: 26 },
      ],
      classMission: {
        title: '抵達閱讀森林',
        icon: '🗺️',
        target: 300,
        progress: 216,
        reward: '全班解鎖「森林寶箱」造型',
      },
      redeems: [],
      groupTasks: [
        { id: 'gt1', title: '本週小隊闖關：課間整潔', icon: '🧹', reward: 20, done: [], target: 5 },
      ],
      storyline: seedStoryline(),
      settings: {
        theme: 'forest',
        showRank: true,
        allowStudentRename: true,
        avatarCardSize: 'md',
        avatarFrame: true,
        studentOrder: 'no',
        showStudentNo: true,
        avatarBadgeStat: 'points',
        avatarBadgeStats: ['points'],
        notifyAward: true,
        notifyDeduct: true,
        soundAward: false,
        soundDeduct: false,
        showBatchBar: true,
      },
    };
  }

  global.PetModel = {
    PETS, STAGES, COSMETICS, FOODS, BADGES, DEFAULT_RULES, DEFAULT_SHOP, GROUP_PRESET,
    DEFAULT_TOOLBAR, TOOLBAR_TOOLS, DEFAULT_PET_STAGES,
    STORYLINE_TITLE, STORYLINE_CHAPTERS, seedStoryline,
    xpForNext, levelFromXp, stageOf, petById, allPets, petFace, stageImageFor, seedState,
  };
})(window);
