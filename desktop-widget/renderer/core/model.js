/* 資料模型、成長公式、預設種子資料（window.PetModel） */
(function (global) {
  'use strict';

  const U = global.PetUtil;

  /* ============ 寵物圖鑑 ============
     圖像先用 emoji 佔位；之後換成圖片只要把 img 欄位填上路徑，
     介面會自動改用 <img>（見 petFace()）。 */
  const PETS = [
    { id: '02cat',   name: '草莓歐蕾貓',   emoji: '🐱', img: '', trait: '奇幻系', desc: '身上帶著草莓歐蕾香氣，安靜卻總能在關鍵時刻出現。', rarity: 'common' },
    { id: '01dog',   name: '卡布奇諾柴',   emoji: '🐶', img: '', trait: '活力系', desc: '全身暖呼呼像杯剛沖好的卡布奇諾，最愛陪大家一起完成任務。', rarity: 'common' },
    { id: 'bunny',   name: '彩虹獨角兔',   emoji: '🐰', img: '', trait: '奇幻系', desc: '耳朵能聽見每個願望，蹦蹦跳跳把色彩帶給全班。', rarity: 'common' },
    { id: '03fox',   name: '雲朵狐',       emoji: '🦊', img: '', trait: '夢幻系', desc: '腳步輕得像踩在雲朵上，總能找到別人忽略的線索。', rarity: 'common' },
    { id: 'panda',   name: '功夫熊貓',     emoji: '🐼', img: '', trait: '堅毅系', desc: '動作慢但招招紮實，是隊伍裡最可靠的後盾。', rarity: 'common' },
    { id: 'otter',   name: '焦糖水獺',     emoji: '🦦', img: '', trait: '探索系', desc: '毛色像融化的焦糖，喜歡在溪流間尋找新鮮事。', rarity: 'common' },
    { id: 'hamster', name: '花生倉鼠',     emoji: '🐹', img: '', trait: '整潔系', desc: '小小的頰囊塞滿寶貝，最愛把教室角落都整理好。', rarity: 'common' },
    { id: 'penguin', name: '極光企鵝',     emoji: '🐧', img: '', trait: '堅持系', desc: '揹著小小提燈，一步一步在黑夜裡帶路前進。', rarity: 'common' },
    { id: 'dragon',  name: '抹茶小龍',     emoji: '🐲', img: '', trait: '勇氣系', desc: '遇到難題不退縮，會噴出鼓勵的火花。', rarity: 'common' },
    { id: 'alpaca',  name: '棉花羊駝',     emoji: '🦙', img: '', trait: '溫柔系', desc: '毛茸茸的擁抱，專治上台前的緊張。', rarity: 'common' },
    { id: 'capy',    name: '悠哉水豚',     emoji: '🦫', img: '', trait: '穩定系', desc: '從不慌張，教大家好好呼吸。', rarity: 'common' },
    { id: 'bear',    name: '蜂蜜小熊',     emoji: '🐻', img: '', trait: '力量系', desc: '搬桌椅、整理公共區域的第一名。', rarity: 'common' },
    { id: 'koala',   name: '薄荷無尾熊',   emoji: '🐨', img: '', trait: '療癒系', desc: '身上帶著淡淡薄荷香，總能在同學緊張時輕輕安撫。', rarity: 'common' },
    { id: 'owl',     name: '星眠貓頭鷹',   emoji: '🦉', img: '', trait: '沉靜系', desc: '喜歡在安靜的角落閱讀，最懂得傾聽每個小小心事。', rarity: 'common' },
  ];

  /* 寵物稀有度分級：決定抽獎機率權重（weight 越高越容易抽到）與直接領養的金幣價格，
     老師可以在後台改名稱／權重／價格，也能改每隻寵物歸在哪一級。 */
  const DEFAULT_PET_RARITIES = [
    { id: 'common',    name: '普通', weight: 60, adoptCost: 30 },
    { id: 'rare',      name: '稀有', weight: 30, adoptCost: 80 },
    { id: 'legendary', name: '傳說', weight: 10, adoptCost: 200 },
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

  /* 升到 V4（成長體）之後，學生要選一條「身分路線」，其實就是這隻寵物的「職業型態」：
     V4–V10 的造型各走各的，路線名稱是老師可以在後台隨時改的班級預設值。 */
  const DEFAULT_PET_PATHS = [
    { id: 'path1', name: '星輝路線' },
    { id: 'path2', name: '森語路線' },
    { id: 'path3', name: '月光路線' },
  ];

  /* 每隻寵物預設的「職業型態」三選一，對應 path1/path2/path3：
     path1 偏溫柔療癒、path2 偏勇氣冒險、path3 偏踏實探索，呼應各自的特質；老師可以在
     「管理圖片」裡隨時改成自己想要的職業名稱，這裡只是先幫忙想好的預設版本，不用從零開始想。 */
  /* 老師提供的正式版本：路線 A 偏溫暖／奇幻、路線 B 偏冒險／行動、路線 C 偏酷帥／專業。
     dragon/alpaca/capy/bear 目前沒有在班級名單裡用到，先保留原本想好的版本，之後有需要再換。 */
  const DEFAULT_PET_PATH_NAMES = {
    '01dog': { path1: '奶泡療癒師：照顧隊友',     path2: '山野搜救員：尋找迷路夥伴',   path3: '曙光騎士：守護隊伍' },
    '02cat': { path1: '莓露精靈：花朵與露珠魔法', path2: '莓光探險家：地圖與尋寶',     path3: '歐蕾競速員：接力與速度' },
    '03fox': { path1: '雲端信使：傳遞心願',       path2: '雪原追蹤員：辨認足跡',       path3: '極光幻術師：操縱雲霧' },
    bunny:   { path1: '願望彩繪師：描繪夢想',     path2: '彩虹跳躍者：闖關與移動',     path3: '光譜魔導士：運用色彩能量' },
    hamster: { path1: '花生收藏家：整理珍寶',     path2: '秘境探險家：望遠鏡與地圖',   path3: '遺跡解謎師：機關與線索' },
    koala:   { path1: '森林香草師：調配香草',     path2: '風暴觀測員：追蹤天氣',       path3: '皇家氣象官：指揮風雨' },
    penguin: { path1: '雪夜提燈員：照亮道路',     path2: '冰原滑行手：快速穿越冰地',   path3: '極光領航員：引導遠征' },
    otter:   { path1: '河畔照護員：照顧水岸生物', path2: '河流尋寶員：探索溪流',       path3: '潮汐守衛：操控水流護盾' },
    owl:     { path1: '睡前故事師：蒐集故事',     path2: '夜空觀星員：尋找星座',       path3: '星圖解謎師：破解古老地圖' },
    panda:   { path1: '竹林料理師：補充隊伍體力', path2: '功夫修行者：練習招式',       path3: '竹影守護者：保護燈塔' },
    dragon:  { path1: '烈焰勇者',   path2: '破浪騎士',     path3: '逆風先鋒' },
    alpaca:  { path1: '擁抱治療師', path2: '安撫使者',     path3: '雲朵牧羊人' },
    capy:    { path1: '呼吸教練',   path2: '溫泉守護者',   path3: '沉穩軍師' },
    bear:    { path1: '蜂蜜工匠',   path2: '森林守衛',     path3: '力量搬運工' },
  };

  /* 老師已經整理好、可直接內建的寵物真實照片（V1–V10，共用圖＋各路線專屬圖）。
     檔名 shared-vN／path{1,2,3}-vN 對應 petStageLevels 陣列索引 N-1。
     還沒整理照片的寵物不在這裡，畫面會照舊退回 emoji。 */
  function petImageAssetSet(dir, parts, sharedLen) {
    const list = parts || ['shared', 'path1', 'path2', 'path3'];
    const arr = (prefix, len) => Array.from({ length: len || 10 }, (_, i) => `assets/img/pets/${dir}/${prefix}-v${i + 1}.png`);
    const result = {};
    list.forEach((p) => { result[p] = arr(p, p === 'shared' ? sharedLen : 10); });
    return result;
  }
  const DEFAULT_PET_IMAGE_ASSETS = {
    '01dog': petImageAssetSet('01dog'),
    '02cat': petImageAssetSet('02cat'),
    /* 03fox 目前只有 V1–V3 共用造型的照片（三條路線 V4–V10 都各自齊全，那個範圍本來就不會用到
       共用圖），shared 陣列只給到第 3 張，避免指到還沒存在的 shared-v4~v10.png。 */
    '03fox': petImageAssetSet('03fox', undefined, 3),
  };


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

  /* 徽章條件：用「統計項目＋門檻」描述，不用寫死的函式，才能存進存檔、給老師在後台編輯。
     statKey 是哪個統計數字，ruleCount 這個 statKey 要另外指定 ruleId（看的是哪個規則累計了幾次）。 */
  const BADGE_STAT_DEFS = [
    { key: 'totalPoints', label: '累積點數達到' },
    { key: 'streak',      label: '連續天數達到' },
    { key: 'petLevel',    label: '寵物等級達到' },
    { key: 'ruleCount',   label: '某個規則累計次數達到' },
    { key: 'cosmetics',   label: '解鎖造型數量達到' },
    { key: 'redeemCount', label: '商店兌換次數達到' },
  ];
  const DEFAULT_BADGES = [
    { id: 'first_step',  name: '第一步',     emoji: '👣', img: '', desc: '獲得第一筆點數',       statKey: 'totalPoints', ruleId: '', value: 1 },
    { id: 'p50',         name: '五十里程',   emoji: '🎯', img: '', desc: '累積 50 點',           statKey: 'totalPoints', ruleId: '', value: 50 },
    { id: 'p100',        name: '百點探險家', emoji: '🏅', img: '', desc: '累積 100 點',          statKey: 'totalPoints', ruleId: '', value: 100 },
    { id: 'streak7',     name: '七日堅持',   emoji: '🔥', img: '', desc: '連續 7 天有好表現',    statKey: 'streak',      ruleId: '', value: 7 },
    { id: 'streak14',    name: '雙週不間斷', emoji: '💪', img: '', desc: '連續 14 天有好表現',   statKey: 'streak',      ruleId: '', value: 14 },
    { id: 'lv5',         name: '成長中',     emoji: '🌱', img: '', desc: '寵物達到 Lv.5',        statKey: 'petLevel',    ruleId: '', value: 5 },
    { id: 'lv10',        name: '完全體',     emoji: '👑', img: '', desc: '寵物達到 Lv.10',       statKey: 'petLevel',    ruleId: '', value: 10 },
    { id: 'helper',      name: '小幫手',     emoji: '❤️', img: '', desc: '主動幫忙 10 次',       statKey: 'ruleCount',   ruleId: 'help', value: 10 },
    { id: 'tidy',        name: '整潔達人',   emoji: '🧹', img: '', desc: '環境整潔 10 次',       statKey: 'ruleCount',   ruleId: 'tidy', value: 10 },
    { id: 'teamwork',    name: '合作高手',   emoji: '🤝', img: '', desc: '小組合作 8 次',        statKey: 'ruleCount',   ruleId: 'team', value: 8 },
    { id: 'stylist',     name: '造型收藏家', emoji: '🎀', img: '', desc: '解鎖 3 種造型',        statKey: 'cosmetics',   ruleId: '', value: 3 },
    { id: 'shopper',     name: '第一次兌換', emoji: '🎁', img: '', desc: '在商店兌換一次',       statKey: 'redeemCount', ruleId: '', value: 1 },
  ];

  /* 判斷某個學生的統計資料是否達到某枚徽章的門檻，refreshBadges（store.js）用這個決定要不要發徽章。 */
  function evalBadgeCondition(b, st) {
    const val = b.value || 0;
    switch (b.statKey) {
      case 'totalPoints': return (st.totalPoints || 0) >= val;
      case 'streak': return (st.streak || 0) >= val;
      case 'petLevel': return (st.petLevel || 0) >= val;
      case 'ruleCount': return ((st.ruleCount || {})[b.ruleId] || 0) >= val;
      case 'cosmetics': return (st.cosmetics || []).length >= val;
      case 'redeemCount': return (st.redeemCount || 0) >= val;
      default: return false;
    }
  }

  /* 徽章外觀：有自訂圖片就用圖片，沒有就用 emoji，跟寵物的 petFace 是同一套邏輯。 */
  function badgeFace(b, size) {
    if (b.img) {
      return U.el('img', {
        src: b.img, alt: b.name,
        style: { width: size + 'px', height: size + 'px', objectFit: 'contain' },
      });
    }
    return U.el('span', { text: b.emoji, style: { fontSize: Math.round(size * 0.82) + 'px' } });
  }

  /* 規則分類（桌面小工具用這個把規則按鈕分區塊顯示；老師可以在「規則設定」改每條規則的分類） */
  const RULE_CATEGORIES = [
    { id: 'class',     label: '上課用' },
    { id: 'homework',  label: '作業類' },
    { id: 'storyline', label: '星野主線' },
  ];

  /* 預設加分規則（老師可自訂） */
  const DEFAULT_RULES = [
    { id: 'homework', label: '準時交作業', icon: '📚', points: 2, xp: 3, coins: 2, kind: 'add', category: 'homework' },
    { id: 'ontime',   label: '準時上課',   icon: '⏰', points: 1, xp: 2, coins: 1, kind: 'add', category: 'class' },
    { id: 'help',     label: '主動幫忙',   icon: '❤️', points: 2, xp: 3, coins: 2, kind: 'add', category: 'class' },
    { id: 'team',     label: '小組合作',   icon: '👥', points: 3, xp: 4, coins: 3, kind: 'add', category: 'class' },
    { id: 'tidy',     label: '整理座位',   icon: '🌱', points: 1, xp: 2, coins: 1, kind: 'add', category: 'class' },
    { id: 'focus',    label: '上課專注',   icon: '🔍', points: 1, xp: 2, coins: 1, kind: 'add', category: 'class' },
    { id: 'cheer',    label: '鼓勵同學',   icon: '🏆', points: 2, xp: 3, coins: 2, kind: 'add', category: 'class' },
    { id: 'mission',  label: '完成共同任務', icon: '🗺️', points: 3, xp: 5, coins: 3, kind: 'add', category: 'class' },
    { id: 'remind',   label: '溫馨提醒',   icon: '💭', points: -1, xp: 0, coins: 0, kind: 'deduct', category: 'class' },
    /* 守護行動快捷規則：對應星野主線的行動進度統計，id 不要改（chapters 的 actionRuleIds 會用到） */
    { id: 'warmth',     label: '傳遞暖光', icon: '🌞', points: 2, xp: 3, coins: 2, kind: 'add', category: 'storyline' },
    { id: 'initiative', label: '主動爭取', icon: '🚀', points: 2, xp: 3, coins: 2, kind: 'add', category: 'storyline' },
    { id: 'courage',    label: '勇敢試想', icon: '💡', points: 2, xp: 3, coins: 2, kind: 'add', category: 'storyline' },
    { id: 'revise',     label: '修正再試', icon: '🔧', points: 2, xp: 3, coins: 2, kind: 'add', category: 'storyline' },
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
      taskTitle: '🌞 點亮第一道暖光（全班完成守護隊公約）', rewardTitle: '森林背景、第一座燈塔點亮', rewardEmoji: '🌲',
      actionRuleIds: ['warmth'], actionTarget: 15, participantTarget: 0,
      bg: 'assets/img/storyline/ch1-bg.jpg', lighthouseImg: 'assets/img/storyline/ch1-lighthouse.png',
      intro: '星野的第一座燈塔正在熄滅，微光森林霧氣瀰漫。守護隊員與動物夥伴踏進林道，只要蒐集星光、完成守護隊公約，就能讓森林重新亮起。',
      clearStory: '最後一道公約完成的瞬間，森林深處傳來低鳴——燈塔亮了！動物夥伴們的眼睛閃著光，守護隊踏出了遠征的第一步。',
    },
    {
      id: 'ch2', order: 2, name: '回聲溪谷', week: 10, threshold: 370,
      taskTitle: '🤝 讓回聲變成對話（各小組完成一次先聽、再接、再補充的討論）', rewardTitle: '溪谷背景、共同裝飾', rewardEmoji: '🏞️',
      actionRuleIds: ['warmth', 'initiative', 'courage', 'revise'], actionTarget: 0, participantTarget: 15,
      bg: 'assets/img/storyline/ch2-bg.jpg', lighthouseImg: 'assets/img/storyline/ch2-lighthouse.png',
      intro: '沿著微光森林往前，是回聲溪谷。溪水沖刷著岩壁，傳來奇異的回聲。傳說唯有真正分工合作的隊伍，才能讓溪谷聽懂他們的心聲。',
      clearStory: '當分工合作的挑戰完成，溪谷的回聲忽然變成清亮的歌聲。第二座燈塔緩緩亮起，照亮了前方更遠的路。',
    },
    {
      id: 'ch3', order: 3, name: '風語高地', week: 13, threshold: 560,
      taskTitle: '🚀 迎風踏出一步（全班累積主動嘗試紀錄）', rewardTitle: '限定寵物配件、第三座燈塔', rewardEmoji: '🎐',
      actionRuleIds: ['initiative'], actionTarget: 21, participantTarget: 15,
      bg: 'assets/img/storyline/ch3-bg.jpg', lighthouseImg: 'assets/img/storyline/ch3-lighthouse.png',
      intro: '風語高地終年強風呼嘯，據說風裡藏著古老的訊息。守護隊必須完成不同的合作挑戰，才能聽懂風想說的話，點亮第三座燈塔。',
      clearStory: '當兩種挑戰都完成，狂風忽然靜了下來，化作溫柔的低語。第三座燈塔亮起，限定的守護配件也悄悄出現在動物夥伴身上。',
    },
    {
      id: 'ch4', order: 4, name: '雲端星塔', week: 16, threshold: 750,
      taskTitle: '💡 讓錯誤變成線索（完成兩次先猜想—討論—修正活動）', rewardTitle: '星塔背景、班級隊伍稱號', rewardEmoji: '🌌',
      actionRuleIds: ['courage', 'revise'], actionTarget: 0, participantTarget: 15,
      bg: 'assets/img/storyline/ch4-bg.jpg', lighthouseImg: 'assets/img/storyline/ch4-lighthouse.png',
      intro: '雲端星塔聳立在雲海之上，是離星空最近的地方。守護隊要完成一次班級服務任務，證明自己不只守護彼此，也守護整個星野。',
      clearStory: '服務任務完成的那天，雲海散開，星塔頂端亮起耀眼的光。守護隊獲得了屬於自己的隊伍稱號，向著最後一座燈塔前進。',
    },
    {
      id: 'ch5', order: 5, name: '星野再啟', week: 20, threshold: 1000,
      taskTitle: '✨ 勇氣接力（每人留下一件更願意嘗試的事，完成班級成長圖鑑）', rewardTitle: '終章紀念徽章與結局畫面', rewardEmoji: '🏅',
      actionRuleIds: [], actionTarget: 0, participantTarget: 0,
      bg: 'assets/img/storyline/ch5-finale.jpg', lighthouseImg: 'assets/img/storyline/ch5-lighthouse.png',
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
        return {
          names: s.petNames || {}, extra: s.customPets || [], deleted: s.deletedPetIds || [],
          rarities: s.petRarityOverrides || {},
        };
      }
    } catch (e) { /* store 還沒準備好就當作沒有任何自訂 */ }
    return { names: {}, extra: [], deleted: [], rarities: {} };
  }

  function resolvePet(p, names, rarities) {
    const patch = {};
    if (names[p.id]) patch.name = names[p.id];
    if (rarities[p.id]) patch.rarity = rarities[p.id];
    return Object.keys(patch).length ? Object.assign({}, p, patch) : p;
  }

  /* 取得全部「目前可用」的寵物圖鑑：內建寵物（扣掉被刪除的）＋ 老師自己新增的寵物，並套用自訂名稱／稀有度。
     下拉選單、圖鑑列表、抽新寵物等都應該用這個，而不是直接用 PETS。 */
  function allPets() {
    const { names, extra, deleted, rarities } = classPetData();
    const builtin = PETS.filter((p) => deleted.indexOf(p.id) < 0);
    return builtin.concat(extra).map((p) => resolvePet(p, names, rarities));
  }

  /* 某隻寵物在「身分路線」上要顯示的名稱：每隻寵物可以各自取名（因為每隻寵物的發展不盡相同），
     沒特別取名的就顯示全班共用的預設路線名稱。 */
  function petPathName(pet, pathId) {
    try {
      const S = global.PetStore;
      if (S && S.get) {
        const s = S.get() || {};
        const custom = ((s.petPathNames || {})[pet.id] || {})[pathId];
        if (custom) return custom;
        const base = (s.petPaths || []).find((p) => p.id === pathId);
        if (base) return base.name;
      }
    } catch (e) { /* 忽略 */ }
    return pathId;
  }

  function petById(id) {
    const list = allPets();
    return list.find((p) => p.id === id) || list[0] || PETS[0];
  }

  /* 進化到第幾階（陣列索引，從 0 開始）之後開始分路線：索引 3 = V4「成長體」。
     V1–V3（索引 0–2）全班共用同一張圖，不分路線；V4–V10 每條路線各自一張圖。 */
  const PATH_BRANCH_STAGE_INDEX = 3;

  /* 依等級挑選老師在後台設定的造型圖片，可另外指定「身分路線」（V4 之後才有意義）。
     等級門檻是全班共用的一份清單（state.petStageLevels），每隻寵物的共用圖存在 state.petImages[petId]，
     V4 之後的路線專屬圖存在 state.petPathImages[petId][pathId]，兩者都跟 petStageLevels 用陣列位置對應。
     找不到路線圖就退回共用圖，再退回 pet.img（單張固定圖），再退回 emoji。 */
  function stageImageFor(pet, level, pathId) {
    let levels = null;
    let images = null;
    let pathImages = null;
    try {
      const S = global.PetStore;
      if (S && S.get) {
        const s = S.get() || {};
        levels = s.petStageLevels;
        images = (s.petImages || {})[pet.id];
        pathImages = pathId && s.petPathImages && s.petPathImages[pet.id] ? s.petPathImages[pet.id][pathId] : null;
      }
    } catch (e) { /* store 還沒準備好 */ }
    if (!levels || !levels.length) return pet.img || '';

    const lv = level == null ? -Infinity : level;
    let bestIdx = -1;
    levels.forEach((t, i) => {
      const min = t.minLevel || 1;
      if (min <= lv && (bestIdx < 0 || min > (levels[bestIdx].minLevel || 1))) bestIdx = i;
    });
    if (bestIdx < 0) bestIdx = 0;

    // V4 以上且有指定路線：優先在該路線內，從符合等級的那一階往回找最近一張圖
    if (pathImages && pathImages.length) {
      for (let i = Math.min(bestIdx, pathImages.length - 1); i >= PATH_BRANCH_STAGE_INDEX; i--) {
        if (pathImages[i]) return pathImages[i];
      }
    }
    if (images && images.length) {
      // 從符合等級的那一階開始往前找最近一個「有設定圖片」的共用階段
      for (let i = bestIdx; i >= 0; i--) { if (images[i]) return images[i]; }
      // 等級還沒到第一個門檻時，先用最早設定好的那張圖當起始造型
      for (let i = 0; i < images.length; i++) { if (images[i]) return images[i]; }
    }
    return pet.img || '';
  }

  /* 寵物外觀：依目前等級（與已選的身分路線）選對應造型圖片，沒有設定就用 emoji。
     level、pathId 都可省略（例如陳列用途，或 V4 之前還沒選路線時）。 */
  function petFace(pet, size, level, pathId) {
    const p = typeof pet === 'string' ? petById(pet) : pet || PETS[0];
    const img = stageImageFor(p, level, pathId);
    if (img) {
      // 用 contain 而不是 cover：完整顯示老師上傳的圖片，不裁切；外層的圓形泡泡（.pet-avatar／
      // .avatar-card__face 等）本來就比這裡的 size 大一些並置中對齊，所以圖片不會貼到圓形邊緣。
      return U.el('img', {
        class: 'pet-face', src: img, alt: p.name,
        style: size ? { width: size + 'px', height: size + 'px', maxWidth: '100%', objectFit: 'contain' } : { objectFit: 'contain' },
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
        petPathId: '',
        unlockedPaths: [],
        avatarStageIdx: null,
        pets: [],
        displayPetKey: 'main',
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
      messages: [],
      petStageLevels: DEFAULT_PET_STAGES.map((s) => ({ minLevel: s.minLevel, name: s.name })),
      petImages: PETS.reduce((acc, p) => {
        const preset = DEFAULT_PET_IMAGE_ASSETS[p.id];
        const arr = preset ? preset.shared.slice() : [];
        while (arr.length < DEFAULT_PET_STAGES.length) arr.push('');
        acc[p.id] = arr;
        return acc;
      }, {}),
      petPaths: U.deepClone(DEFAULT_PET_PATHS),
      petPathImages: PETS.reduce((acc, p) => {
        acc[p.id] = {};
        const preset = DEFAULT_PET_IMAGE_ASSETS[p.id];
        DEFAULT_PET_PATHS.forEach((path) => {
          acc[p.id][path.id] = (preset && preset[path.id]) ? preset[path.id].slice() : new Array(DEFAULT_PET_STAGES.length).fill('');
        });
        return acc;
      }, {}),
      petPathNames: U.deepClone(DEFAULT_PET_PATH_NAMES),
      petRarities: U.deepClone(DEFAULT_PET_RARITIES),
      petRarityOverrides: {},
      pathCapacity: {},
      badgeDefs: U.deepClone(DEFAULT_BADGES),
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
        pathUnlockCost: 50,
        petCollectUnlockLevel: 10,
        gachaCost: 50,
        /* 全班加分：班級分數（classStars）的增減量是老師另外指定的獨立數字，
           這三個開關決定「同一次全班加分」要不要也連動每個學生自己的點數/XP/金幣 */
        classScoreLinkPoints: false,
        classScoreLinkXp: false,
        classScoreLinkCoins: false,
      },
    };
  }

  global.PetModel = {
    PETS, STAGES, COSMETICS, FOODS, DEFAULT_BADGES, BADGE_STAT_DEFS, DEFAULT_RULES, RULE_CATEGORIES, DEFAULT_SHOP, GROUP_PRESET,
    DEFAULT_TOOLBAR, TOOLBAR_TOOLS, DEFAULT_PET_STAGES, DEFAULT_PET_PATHS, DEFAULT_PET_PATH_NAMES, PATH_BRANCH_STAGE_INDEX,
    DEFAULT_PET_IMAGE_ASSETS, DEFAULT_PET_RARITIES,
    STORYLINE_TITLE, STORYLINE_CHAPTERS, seedStoryline,
    xpForNext, levelFromXp, stageOf, petById, allPets, petFace, stageImageFor, petPathName, seedState,
    evalBadgeCondition, badgeFace,
  };
})(window);
