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

  function defaultPetStages() {
    return DEFAULT_PET_STAGES.map((s) => ({ minLevel: s.minLevel, name: s.name, img: '' }));
  }

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
    'util:attendance', 'ontime', 'util:multi', 'util:random', 'util:timer', 'homework',
    'help', 'team', 'tidy', 'focus', 'cheer', 'mission', 'remind',
  ];

  const TOOLBAR_TOOLS = [
    { id: 'util:attendance', icon: '📋', label: '出席' },
    { id: 'util:multi',      icon: '☑️', label: '多選' },
    { id: 'util:random',     icon: '🎲', label: '隨機抽籤' },
    { id: 'util:timer',      icon: '⏱️', label: '計時器' },
  ];

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

  /* 依等級挑選老師在後台設定的造型圖片（存在班級資料 state.petImages 裡，不是寫死在這份檔案）。
     找不到就退回 pet.img（單張固定圖），再退回 emoji。 */
  function stageImageFor(pet, level) {
    let all = null;
    try {
      const S = global.PetStore;
      if (S && S.get) all = (S.get() || {}).petImages;
    } catch (e) { all = null; }
    const custom = all && all[pet.id];
    const stages = (custom && custom.length ? custom : []).filter((st) => st.img);
    if (!stages.length) return pet.img || '';
    const lv = level == null ? -Infinity : level;
    const eligible = stages.filter((st) => (st.minLevel || 1) <= lv).sort((a, b) => b.minLevel - a.minLevel);
    if (eligible.length) return eligible[0].img;
    // 等級還沒到最低的階段門檻時，先用門檻最低的那張當作起始造型
    return stages.slice().sort((a, b) => (a.minLevel || 1) - (b.minLevel || 1))[0].img;
  }

  /* 寵物外觀：依目前等級選對應造型圖片，沒有設定就用 emoji。level 可省略（例如陳列用途）。 */
  function petFace(pet, size, level) {
    const p = typeof pet === 'string' ? petById(pet) : pet || PETS[0];
    const img = stageImageFor(p, level);
    if (img) {
      return U.el('img', {
        class: 'pet-face', src: img, alt: p.name,
        style: size ? { width: size + 'px', height: size + 'px', borderRadius: '50%', objectFit: 'cover' } : { borderRadius: '50%', objectFit: 'cover' },
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
      petImages: PETS.reduce((acc, p) => {
        acc[p.id] = defaultPetStages();
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
      settings: {
        theme: 'forest',
        showRank: true,
        allowStudentRename: true,
        avatarCardSize: 'md',
        studentOrder: 'no',
        showStudentNo: true,
        avatarBadgeStat: 'points',
        notifyAward: true,
        notifyDeduct: true,
        soundAward: false,
        soundDeduct: false,
      },
    };
  }

  global.PetModel = {
    PETS, STAGES, COSMETICS, FOODS, BADGES, DEFAULT_RULES, DEFAULT_SHOP, GROUP_PRESET,
    DEFAULT_TOOLBAR, TOOLBAR_TOOLS, DEFAULT_PET_STAGES,
    xpForNext, levelFromXp, stageOf, petById, allPets, petFace, stageImageFor, defaultPetStages, seedState,
  };
})(window);
