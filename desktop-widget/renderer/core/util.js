/* 共用小工具（classic script，掛在 window.PetUtil） */
(function (global) {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* 音樂班專用圖示：原創向量繪製（SVG），代碼 clay:m-xxx，不需要圖片檔，任何尺寸都清楚。 */
  const MUSIC_INK = '#3b2a70';
  const mL = (d, c, w) => '<path d="' + d + '" fill="none" stroke="' + MUSIC_INK + '" stroke-width="' + (w + 4.4) + '" stroke-linecap="round" stroke-linejoin="round"/><path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"/>';
  const mG = (inner) => '<g stroke="' + MUSIC_INK + '" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">' + inner + '</g>';
  const mHi = (x, y, rx, ry, rot) => '<ellipse cx="' + x + '" cy="' + y + '" rx="' + rx + '" ry="' + ry + '" fill="#fff" fill-opacity=".5" stroke="none"' + (rot ? ' transform="rotate(' + rot + ' ' + x + ' ' + y + ')"' : '') + '/>';
  const MUSIC_ICONS = [
    ['note-eighth', '八分音符', '🎵', '音樂 音符 唱歌 節奏 練習', mG('<ellipse cx="22" cy="48" rx="11" ry="8" transform="rotate(-20 22 48)" fill="#8b6cf0"/><rect x="29" y="9" width="5" height="38" rx="2" fill="#8b6cf0"/><path d="M34 9C36 20 50 20 48 36C44 28 40 27 34 27Z" fill="#8b6cf0"/>' + mHi(18, 45, 4, 2.5, -20))],
    ['note-beamed', '連結音符', '🎶', '音樂 音符 節奏 合奏 合唱', mG('<ellipse cx="16" cy="49" rx="10" ry="7" transform="rotate(-20 16 49)" fill="#ff8fb1"/><ellipse cx="42" cy="44" rx="10" ry="7" transform="rotate(-20 42 44)" fill="#ff8fb1"/><rect x="23" y="11" width="5" height="38" rx="2" fill="#ff8fb1"/><rect x="49" y="6" width="5" height="38" rx="2" fill="#ff8fb1"/><polygon points="23,11 54,5 54,17 23,23" fill="#ff8fb1"/>' + mHi(12, 46, 3.5, 2, -20) + mHi(38, 41, 3.5, 2, -20))],
    ['treble', '高音譜號', '🎼', '音樂 譜號 識譜 視唱 樂理', mL('M30 42C27 38 30 33 35 34C41 35 42 43 36 47C29 52 20 48 20 40C20 30 33 22 35 14C36 9 34 6 32 6C29 8 27 14 29 24L33 52C34 59 27 61 24 58', '#ffb43a', 4.6)],
    ['bass', '低音譜號', '🎼', '音樂 譜號 低音 識譜 樂理', mL('M20 20C34 12 50 22 42 38C38 46 28 52 16 56', '#4cc9b0', 5.5) + '<circle cx="19" cy="24" r="6.5" fill="#4cc9b0" stroke="' + MUSIC_INK + '" stroke-width="2.4"/><circle cx="53" cy="17" r="3.6" fill="#4cc9b0" stroke="' + MUSIC_INK + '" stroke-width="2"/><circle cx="53" cy="31" r="3.6" fill="#4cc9b0" stroke="' + MUSIC_INK + '" stroke-width="2"/>'],
    ['rest', '休止符', '🎼', '音樂 休止 安靜 聆聽 等待', mG('<path d="M8 38H56" fill="none" stroke-width="3"/><rect x="19" y="24" width="26" height="14" rx="2.5" fill="#8b6cf0"/>' + mHi(26, 28, 5, 2, 0))],
    ['sharp', '升記號', '♯', '音樂 升記號 樂理 變化', mG('<polygon points="10,22 54,14 54,26 10,34" fill="#ff9f43"/><polygon points="10,42 54,34 54,46 10,54" fill="#ff9f43"/><rect x="21" y="6" width="6" height="52" rx="3" fill="#ffd35c"/><rect x="37" y="4" width="6" height="52" rx="3" fill="#ffd35c"/>')],
    ['forte', '強音記號 f', '🎼', '音樂 強弱 大聲 力度 表情', mL('M44 10C32 4 25 12 26 24L21 54C19 60 11 60 9 56', '#ff6b6b', 6) + mL('M12 30H40', '#ff6b6b', 6)],
    ['piano', '鋼琴', '🎹', '音樂 鋼琴 琴鍵 彈奏 練琴', mG('<rect x="5" y="9" width="54" height="46" rx="7" fill="#5a4a7a"/><rect x="9" y="22" width="46" height="29" rx="2.5" fill="#fff"/><path d="M15.4 22V51M21.9 22V51M28.3 22V51M34.7 22V51M41.1 22V51M47.6 22V51" stroke-width="1.6" fill="none"/><rect x="13" y="22" width="5" height="16" rx="1.5" fill="' + MUSIC_INK + '" stroke-width="1.2"/><rect x="19.5" y="22" width="5" height="16" rx="1.5" fill="' + MUSIC_INK + '" stroke-width="1.2"/><rect x="32.5" y="22" width="5" height="16" rx="1.5" fill="' + MUSIC_INK + '" stroke-width="1.2"/><rect x="39" y="22" width="5" height="16" rx="1.5" fill="' + MUSIC_INK + '" stroke-width="1.2"/><rect x="45.5" y="22" width="5" height="16" rx="1.5" fill="' + MUSIC_INK + '" stroke-width="1.2"/><circle cx="14" cy="15" r="2" fill="#ffd35c" stroke="none"/>')],
    ['violin', '小提琴', '🎻', '音樂 小提琴 弦樂 拉琴 練習', mG('<rect x="29.5" y="8" width="5" height="22" rx="2" fill="#7a4a26"/><circle cx="32" cy="7" r="4.5" fill="#7a4a26"/><path d="M32 25C20 23 15 33 22 39C13 44 16 58 32 58C48 58 51 44 42 39C49 33 44 23 32 25Z" fill="#e08a3c"/><path d="M26 42Q24 47 26 52M38 42Q40 47 38 52" fill="none" stroke-width="1.8"/><rect x="26" y="49" width="12" height="2.5" rx="1" fill="#fff4dc" stroke-width="1.2"/><path d="M32 12V50" fill="none" stroke="#fff4dc" stroke-width="1.2"/>' + mHi(24, 34, 3, 5, 20) + '<path d="M6 52L57 24" fill="none" stroke="#b0703a" stroke-width="2.4"/>')],
    ['trumpet', '小喇叭', '🎺', '音樂 小喇叭 管樂 銅管 吹奏', mL('M14 32C14 14 42 14 42 32', '#ffc83d', 4) + mL('M7 34H44', '#ffc83d', 6) + mG('<polygon points="44,26 58,13 58,53 44,40" fill="#ffc83d"/><rect x="21" y="9" width="4" height="9" rx="1.5" fill="#ff6b6b"/><rect x="29" y="7" width="4" height="9" rx="1.5" fill="#ff6b6b"/><rect x="37" y="9" width="4" height="9" rx="1.5" fill="#ff6b6b"/>') + mHi(52, 28, 2, 8, 12)],
    ['recorder', '直笛', '🎵', '音樂 直笛 吹奏 管樂 笛子', '<g transform="rotate(-38 32 32)">' + mG('<rect x="12" y="25" width="46" height="14" rx="6" fill="#ffd9a0"/><path d="M2 26H16V38H2Z" fill="#ff8fb1"/><path d="M16 25V39M30 25V39" fill="none" stroke-width="1.6"/>') + '<circle cx="24" cy="32" r="2.4" fill="' + MUSIC_INK + '"/><circle cx="33" cy="32" r="2.4" fill="' + MUSIC_INK + '"/><circle cx="41" cy="32" r="2.4" fill="' + MUSIC_INK + '"/><circle cx="49" cy="32" r="2.4" fill="' + MUSIC_INK + '"/></g>'],
    ['drum', '小鼓', '🥁', '音樂 鼓 節奏 打擊 小鼓', mG('<path d="M9 24V46C9 55 55 55 55 46V24Z" fill="#ff6b6b"/><path d="M9 32L20 46L29 31L40 47L48 32L55 34" fill="none" stroke="#ffe9b8" stroke-width="2.2"/><ellipse cx="32" cy="24" rx="23" ry="9" fill="#fff4dc"/>') + mL('M13 7L35 21', '#e9b872', 3.6) + mL('M51 7L29 21', '#e9b872', 3.6)],
    ['guitar', '吉他', '🎸', '音樂 吉他 烏克麗麗 彈唱 弦樂', '<g transform="rotate(38 32 32)">' + mG('<rect x="29" y="1" width="6" height="32" rx="2" fill="#7a4a26"/><rect x="27" y="0" width="10" height="9" rx="3" fill="#5a3a22"/><circle cx="32" cy="49" r="13.5" fill="#e8a24f"/><circle cx="32" cy="34" r="9.5" fill="#e8a24f"/><circle cx="32" cy="45" r="4.6" fill="' + MUSIC_INK + '"/><rect x="26" y="55" width="12" height="3" rx="1.2" fill="#5a3a22" stroke-width="1.4"/>') + '<path d="M32 9V55" stroke="#fff4dc" stroke-width="1.2" fill="none"/></g>'],
    ['harp', '豎琴', '🎼', '音樂 豎琴 弦樂 優雅 彈奏', mL('M14 58V17C14 7 26 5 33 12L54 54', '#ffc83d', 5) + mL('M14 58H54', '#ffc83d', 5) + '<g stroke="' + MUSIC_INK + '" stroke-width="1.8" stroke-linecap="round"><path d="M21 15V56M28 12V56M35 21V56M42 31V56M48 43V56"/></g>'],
    ['xylophone', '木琴', '🎶', '音樂 木琴 打擊 敲奏 節奏', mG('<rect x="5" y="23" width="9" height="36" rx="3" fill="#ff6b6b"/><rect x="15" y="26" width="9" height="32" rx="3" fill="#ff9f43"/><rect x="25" y="29" width="9" height="28" rx="3" fill="#ffd35c"/><rect x="35" y="32" width="9" height="24" rx="3" fill="#4cc9b0"/><rect x="45" y="35" width="9" height="20" rx="3" fill="#5aa9ff"/><circle cx="19.5" cy="30" r="1.4" fill="#fff" stroke="none"/><circle cx="29.5" cy="33" r="1.4" fill="#fff" stroke="none"/>') + mL('M11 9L29 25', '#e9b872', 3) + mL('M53 9L35 25', '#e9b872', 3) + '<circle cx="10" cy="8" r="4" fill="#ff6b6b" stroke="' + MUSIC_INK + '" stroke-width="2"/><circle cx="54" cy="8" r="4" fill="#ff6b6b" stroke="' + MUSIC_INK + '" stroke-width="2"/>'],
    ['tambourine', '鈴鼓', '🎶', '音樂 鈴鼓 打擊 節奏 搖擺', mG('<circle cx="32" cy="32" r="27" fill="#ffc83d"/><circle cx="32" cy="32" r="16" fill="#fff4dc"/><circle cx="32" cy="9" r="4.2" fill="#d7dee9" stroke-width="1.8"/><circle cx="55" cy="32" r="4.2" fill="#d7dee9" stroke-width="1.8"/><circle cx="32" cy="55" r="4.2" fill="#d7dee9" stroke-width="1.8"/><circle cx="9" cy="32" r="4.2" fill="#d7dee9" stroke-width="1.8"/><circle cx="48.1" cy="15.9" r="4.2" fill="#d7dee9" stroke-width="1.8"/><circle cx="48.1" cy="48.1" r="4.2" fill="#d7dee9" stroke-width="1.8"/><circle cx="15.9" cy="48.1" r="4.2" fill="#d7dee9" stroke-width="1.8"/><circle cx="15.9" cy="15.9" r="4.2" fill="#d7dee9" stroke-width="1.8"/><polygon points="32,24 34.4,29.6 40.4,30.2 35.9,34.2 37.2,40.2 32,37 26.8,40.2 28.1,34.2 23.6,30.2 29.6,29.6" fill="#ff8fb1" stroke-width="1.6"/>')],
    ['metronome', '節拍器', '🎼', '音樂 節拍器 拍子 穩定 速度', mG('<polygon points="17,58 47,58 39,8 25,8" fill="#e08a3c"/><polygon points="24,50 40,50 36,18 28,18" fill="#fff4dc" stroke-width="1.6"/><rect x="12" y="55" width="40" height="6" rx="3" fill="#7a4a26"/>') + mL('M32 50L42 12', '#d7dee9', 3) + '<rect x="35" y="22" width="9" height="7" rx="2" fill="#ffd35c" stroke="' + MUSIC_INK + '" stroke-width="2" transform="rotate(11 39.5 25.5)"/>'],
    ['baton', '指揮棒', '🪄', '音樂 指揮 指揮棒 合奏 領導', mL('M14 52L50 14', '#fff4dc', 4.5) + '<circle cx="12" cy="54" r="7" fill="#7a4a26" stroke="' + MUSIC_INK + '" stroke-width="2.4"/><path d="M52 4L54.4 10L60 12L54.4 14L52 20L49.6 14L44 12L49.6 10Z" fill="#ffd35c" stroke="' + MUSIC_INK + '" stroke-width="1.8" stroke-linejoin="round"/><circle cx="20" cy="22" r="2.8" fill="#ff8fb1"/><circle cx="46" cy="46" r="2.8" fill="#8b6cf0"/>'],
    ['staff', '五線譜', '🎼', '音樂 五線譜 樂譜 識譜 視奏', mG('<rect x="5" y="9" width="54" height="46" rx="8" fill="#fffaf0"/>') + '<g stroke="' + MUSIC_INK + '" stroke-width="1.8" stroke-linecap="round"><path d="M12 22H52M12 28H52M12 34H52M12 40H52M12 46H52"/></g>' + mG('<ellipse cx="22" cy="43" rx="5" ry="3.7" transform="rotate(-20 22 43)" fill="' + MUSIC_INK + '"/><ellipse cx="42" cy="36" rx="5" ry="3.7" transform="rotate(-20 42 36)" fill="' + MUSIC_INK + '"/><path d="M26 42V20M46 35V13" fill="none" stroke-width="2"/><polygon points="26,20 46,13 46,19 26,26" fill="#8b6cf0" stroke-width="1.6"/>')],
    ['headphones', '耳機', '🎧', '音樂 耳機 聆聽 欣賞 專心', mL('M12 40V32C12 8 52 8 52 32V40', '#5a4a7a', 5) + mG('<rect x="6" y="35" width="13" height="21" rx="6" fill="#ff8fb1"/><rect x="45" y="35" width="13" height="21" rx="6" fill="#ff8fb1"/>') + mHi(11, 41, 2, 4, 0) + mHi(50, 41, 2, 4, 0)],
    ['tuning-fork', '音叉', '🎼', '音樂 音叉 音準 聽音 準確', mL('M23 6V27C23 38 41 38 41 27V6', '#d7dee9', 5) + mL('M32 35V54', '#d7dee9', 5) + '<circle cx="32" cy="57" r="4.2" fill="#d7dee9" stroke="' + MUSIC_INK + '" stroke-width="2.2"/><path d="M11 12C6 20 6 28 11 36M53 12C58 20 58 28 53 36" fill="none" stroke="#8b6cf0" stroke-width="3" stroke-linecap="round"/>'],
    ['singing', '開口唱歌', '🎤', '音樂 唱歌 歌唱 合唱 聲樂 朗讀', mG('<circle cx="29" cy="37" r="22" fill="#ffd35c"/><path d="M17 32Q21 27 25 32M33 32Q37 27 41 32" fill="none" stroke-width="2.4"/><ellipse cx="29" cy="46" rx="6" ry="7" fill="#c0392b"/><circle cx="14" cy="42" r="3.6" fill="#ff8fb1" stroke="none"/><circle cx="44" cy="42" r="3.6" fill="#ff8fb1" stroke="none"/><ellipse cx="53" cy="12" rx="4" ry="3" fill="#8b6cf0" stroke-width="2"/><path d="M56.5 12V5" fill="none" stroke-width="2.2"/><ellipse cx="46" cy="22" rx="3.4" ry="2.6" fill="#ff8fb1" stroke-width="1.8"/><path d="M49.2 22V14" fill="none" stroke-width="2"/>')],
    ['record', '唱片', '📀', '音樂 唱片 欣賞 音樂會 專輯', mG('<circle cx="32" cy="32" r="27" fill="#2f2745"/><circle cx="32" cy="32" r="21" fill="none" stroke="#6a5a8a" stroke-width="1.2"/><circle cx="32" cy="32" r="16" fill="none" stroke="#6a5a8a" stroke-width="1.2"/><circle cx="32" cy="32" r="9.5" fill="#ffc83d"/><circle cx="32" cy="32" r="2.2" fill="#fff" stroke="none"/><path d="M16 18A22 22 0 0 1 28 10" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="3"/>')],
    ['handbell', '手搖鈴', '🔔', '音樂 手搖鈴 鈴鐺 打擊 合奏', mG('<path d="M32 9C18 9 15 24 13 40L10 48H54L51 40C49 24 46 9 32 9Z" fill="#ffc83d"/><rect x="26" y="2" width="12" height="10" rx="5" fill="#7a4a26"/><circle cx="32" cy="53" r="4.6" fill="#e08a3c"/>') + mHi(22, 28, 3, 10, 12)],
    ['music-trophy', '音樂獎盃', '🏆', '音樂 獎盃 比賽 表演 優秀 榮譽', mG('<path d="M18 6H46V24C46 34 40 40 32 40C24 40 18 34 18 24Z" fill="#ffc83d"/><path d="M18 11H8C8 22 12 28 20 29M46 11H56C56 22 52 28 44 29" fill="none" stroke-width="3.4"/><rect x="28" y="40" width="8" height="10" fill="#e0a31d"/><rect x="18" y="50" width="28" height="9" rx="3" fill="#8b6cf0"/><ellipse cx="29" cy="27" rx="4.2" ry="3.1" transform="rotate(-20 29 27)" fill="' + MUSIC_INK + '" stroke="none"/><path d="M33 26V13L39 15" fill="none" stroke-width="2.4"/>')],
  ];
  const MUSIC_ICON_ITEMS = MUSIC_ICONS.map(([id, label, fallback, keywords, svg], index) => ({ id: 'm-' + id, icon: 'clay:m-' + id, label, fallback, keywords, tone: 'positive', index, sheet: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' + svg + '</svg>' }));

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
  ].map(([id,label,fallback,keywords,tone],index)=>({id,icon:'clay:'+id,label,fallback,keywords,tone,index,sheet:'v1',cols:4,rows:3})).concat([
    ["star","星星","⭐"],
    ["sparkles","閃亮星光","✨"],
    ["heart","愛心","❤️"],
    ["happy-heart","微笑愛心","💖"],
    ["clap","拍手","👏"],
    ["strong","力量","💪"],
    ["crown","皇冠","👑"],
    ["medal","獎牌","🏅"],
    ["sun","太陽","☀️"],
    ["rainbow","彩虹","🌈"],
    ["sprout","幼苗","🌱"],
    ["tree","大樹","🌳"],
    ["globe","地球","🌍"],
    ["planet","星球","🪐"],
    ["rocket","火箭","🚀"],
    ["butterfly","蝴蝶","🦋"],
    ["book","書本","📕"],
    ["open-book","打開的書","📖"],
    ["pencil","鉛筆","✏️"],
    ["palette","調色盤","🎨"],
    ["microscope","顯微鏡","🔬"],
    ["search","放大鏡","🔍"],
    ["microphone","麥克風","🎤"],
    ["music","音符","🎵"],
    ["calculator","計算機","🧮"],
    ["puzzle","拼圖","🧩"],
    ["soccer","足球","⚽"],
    ["basketball","籃球","🏀"],
    ["chess","西洋棋","♞"],
    ["dice","骰子","🎲"],
    ["gift","禮物","🎁"],
    ["party","慶祝","🎉"],
    ["bell","鈴鐺","🔔"],
    ["hourglass","沙漏","⏳"],
    ["stop","手掌","✋"],
    ["ear","耳朵","👂"],
    ["chat","對話","💬"],
    ["recycle","回收","♻️"],
    ["broom","掃把","🧹"],
    ["bubbles","泡泡","🫧"],
    ["water","水滴","💧"],
    ["apple","蘋果","🍎"],
    ["chair","椅子","🪑"],
    ["desk","書桌","🏫"],
    ["sleep","睡眠雲","😴"],
    ["think","思考","🤔"],
    ["turtle","烏龜","🐢"],
    ["compass","指南針","🧭"]
  ].map(([id,label,fallback],index)=>({id,icon:"clay:"+id,label,fallback,keywords:label,tone:index>=32?"reminder":"positive",index,sheet:"v2",cols:8,rows:6}))).concat(MUSIC_ICON_ITEMS);
  function appendIconText(node, value) {
    const text = String(value == null ? '' : value);
    const tokens = text.split(/(clay:[a-z][a-z0-9-]*)/g);
    tokens.forEach(token => {
      const info = CLAY_ICONS.find(item => item.icon === token);
      if (!info || ['OPTION','TEXTAREA','TITLE'].includes(node.tagName)) {
        node.appendChild(document.createTextNode(info ? info.fallback : token)); return;
      }
      const image = document.createElement('span');
      image.className = 'clay-icon'; image.dataset.clay = info.id; image.dataset.sheet=info.sheet;
      image.setAttribute('role','img'); image.setAttribute('aria-label',info.label);
      if (info.svg) { if (!info.uri) info.uri = 'url("data:image/svg+xml,' + encodeURIComponent(info.svg) + '")'; image.style.backgroundImage = info.uri; node.appendChild(image); return; }
      image.style.backgroundPosition = (info.index % info.cols / (info.cols-1) * 100) + '% ' + (Math.floor(info.index / info.cols) / (info.rows-1) * 100) + '%';
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

