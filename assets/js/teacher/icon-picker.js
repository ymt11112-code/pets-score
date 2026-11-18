/* 規則、小組與任務共用的教室 emoji 圖示庫；儲存仍使用標準 emoji。 */
(function () {
  'use strict';
  const el = window.PetUtil.el;
  const groups = [
    ['class', '課堂參與', [
      ['🙋','舉手回答','回答正確 發問 參與'],['👍','回答完整','回答 鼓勵 讚'],['🏔️','挑戰高峰','回答優秀 突破 挑戰'],['💡','勇敢發想','參與課堂 想法 創意'],['🎤','上台發表','報告 分享 說話'],['👀','專心聆聽','專心 專注 看老師'],['🧠','認真思考','思考 動腦'],['🎯','專注目標','專心 專注 達標'],['✅','答對了','回答正確 完成'],['💬','表達想法','討論 分享'],['❓','主動提問','問題 發問'],['🔍','仔細觀察','探究 觀察'],['🖐️','積極參與','舉手 回答 參與'],['✍️','認真筆記','筆記 書寫'],['📢','清楚表達','表達 報告']
    ]],
    ['kind', '合作友善', [
      ['🤝','合作互助','小組 合作 幫忙 配合'],['❤️','友善關懷','幫忙同學 幫忙老師 愛心'],['🫶','溫暖支持','感謝 友善 關懷'],['👥','團隊合作','小組 合作 全班'],['🧩','一起解題','合作 問題 解題'],['🙌','共同完成','全班 小組 完成'],['😊','有禮貌','禮貌 微笑 友善'],['💐','懂得感謝','感謝 老師 同學'],['🤗','鼓勵同學','鼓勵 支持'],['🕊️','和平相處','相處 和睦'],['🌈','尊重差異','尊重 包容'],['💛','分享善意','分享 愛心'],['🌻','傳遞暖光','暖光 幫忙'],['🎁','樂於分享','分享 禮物']
    ]],
    ['work', '作業考試', [
      ['📚','準時交作業','作業 繳交 閱讀'],['📝','作業完成','完成 書寫'],['📤','主動繳交','交作業 繳交'],['📖','閱讀認真','閱讀 書本'],['✏️','仔細書寫','書寫 訂正'],['💯','滿分表現','考試100 小考100 滿分'],['🎓','學習優秀','考試 成績 學習'],['🥇','表現第一','優秀 考試95 高分'],['📋','檢查完成','檢查 作業'],['🔧','訂正再試','訂正 修正 改錯'],['🔁','持續練習','練習 再試'],['🧮','數學高手','數學 計算'],['🔬','科學探索','科學 實驗'],['🗣️','語文表達','朗讀 英語 語文'],['🖊️','簽名完成','簽名 家長'],['📒','整理筆記','筆記 整理']
    ]],
    ['routine', '守時自律', [
      ['⏰','準時到校','準時 上學 上課'],['🗓️','按時完成','按時 日期 繳交'],['🎒','用品齊全','用品 帶齊 書包'],['🪑','座位整齊','座位 整齊'],['🧹','整理環境','整理 打掃 清潔'],['♻️','愛護環境','環保 回收'],['🤫','安靜有序','午休 安靜 排隊'],['😴','午休安穩','午休 休息'],['🚶','走廊慢行','安全 走路'],['🛡️','自律守規','守規 當天蓋掉 自律'],['📌','記得待辦','記得 準備 待辦'],['🌱','每天進步','進步 成長'],['🧼','保持清潔','衛生 洗手'],['💧','健康飲水','喝水 健康'],['🚦','遵守秩序','秩序 安全']
    ]],
    ['reward', '獎勵肯定', [
      ['⭐','表現不錯','全班不錯 小組不錯'],['🌟','表現優良','全班優良 小組優良'],['🏆','表現超棒','全班超棒 小組超棒 回答優秀'],['🏅','努力獎章','努力 優良'],['🎖️','榮譽徽章','榮譽 當天蓋掉'],['👏','值得掌聲','掌聲 鼓勵'],['🎉','一起慶祝','全班 慶祝'],['✨','閃亮進步','進步 亮點'],['🚀','主動爭取','主動 積極 突破'],['💪','積極努力','努力 堅持'],['👑','今日之星','最佳 全班'],['☀️','陽光表現','全班優良 晴朗'],['🥳','開心達標','達標 慶祝'],['🏁','完成挑戰','完成 挑戰'],['💎','珍貴表現','優秀 超棒']
    ]],
    ['reminder', '提醒改進', [
      ['🔔','溫馨提醒','提醒 不專心 注意'],['💭','回到課堂','不專心 分心 專注'],['👂','請先聆聽','不配合 聆聽 插話'],['✋','暫停一下','違規 停止 提醒'],['⏳','注意時間','遲到 慢 拖延'],['🐢','加快腳步','太慢 遲到 慢'],['🗒️','記得待辦','健忘 忘記 缺簽名'],['📂','補交作業','作業缺交 缺交 繳交'],['🔄','調整再來','訂正缺交 改進 不配合'],['⚠️','留意規範','一般違規 注意'],['🧭','回到正軌','課堂不配合 守規'],['🤔','再想一想','思考 訂正'],['🧺','收拾物品','座位亂 整理'],['🌙','午休提醒','午休 違規 安靜'],['🛑','安全停看聽','安全 違規'],['🪫','休息充電','精神 休息']
    ]],
    ['create', '探索創作', [
      ['🎨','美術創作','美術 藝術'],['🎵','音樂表現','音樂 唱歌'],['🎭','戲劇演出','戲劇 表演'],['🌍','探索世界','地理 世界'],['✈️','勇敢探索','探索 旅行'],['🪐','星際探險','星野 主線 宇宙'],['🌳','愛護自然','自然 環境'],['🧪','勇於實驗','實驗 科學'],['⚽','運動合作','運動 體育'],['🏀','團隊運動','體育 合作'],['💻','資訊學習','資訊 電腦'],['📷','發現美好','攝影 觀察'],['🎲','遊戲挑戰','遊戲 任務'],['🏕️','戶外任務','戶外 探險']
    ]],
    ['cute', '可愛夥伴', [
      ['🐶','小狗','狗 寵物'],['🐱','小貓','貓 寵物'],['🐹','倉鼠','倉鼠 寵物'],['🦊','狐狸','狐狸 寵物'],['🐸','青蛙','青蛙 寵物'],['🦉','貓頭鷹','鳥 寵物'],['🦄','獨角獸','夢想 寵物'],['🐧','企鵝','企鵝 寵物'],['🐝','勤勞小蜂','勤勞 努力'],['🦖','小恐龍','恐龍 寵物'],['🐾','可愛腳掌','腳掌 寵物'],['🍎','健康蘋果','健康 獎勵'],['🌸','小花','花 可愛'],['🌞','開心太陽','微笑 開心'],['😄','開心笑臉','開心 笑臉'],['🤩','驚喜表現','驚喜 優秀']
    ]]
  ];
  groups.unshift(['clay', '黏土圖示（新）', []]);
  groups.unshift(['music', '🎼 音樂圖示（自繪）', []]);
  const libraryItems = groups.flatMap(([group, , entries]) => entries.map(([icon, label, keywords]) => ({ group, icon, label, keywords })));
  libraryItems.unshift(...window.PetUtil.CLAY_ICONS.map(item=>Object.assign({group:item.sheet==='svg'?'music':'clay'},item)));
  const RECENT = 'classpet.recentRuleIcons.v1';
  function recentIcons() { try { return JSON.parse(localStorage.getItem(RECENT) || '[]').filter(v => typeof v === 'string' && v.length <= 32).slice(0,12); } catch { return []; } }
  function create(input, options) {
    const opts = options || {};
    const items = opts.nameInput ? libraryItems : libraryItems.filter(item=>item.group!=='clay');
    let category = opts.nameInput ? 'clay' : 'all', query = '';
    const preview = el('span', { class: 'rule-icons__preview', 'aria-hidden': 'true' });
    const chosen = el('strong');
    const status = el('span', { class: 'rule-icons__status', role: 'status' });
    const tabs = el('div', { class: 'rule-icons__tabs', role: 'group', 'aria-label': '圖示分類' });
    const grid = el('div', { class: 'rule-icons__grid', 'aria-label': '選擇規則圖示' });
    const search = el('input', { class: 'input rule-icons__search', type: 'search', placeholder: '搜尋用途，例如：回答、合作、缺交、午休', 'aria-label': '搜尋圖示用途', oninput: e => { query = e.target.value.trim(); paintGrid(); } });
    function updateSelection() {
      const value = input.value.trim();
      const item = items.find(x => x.icon === value);
      window.PetUtil.setIconText(preview, value || '⭐');
      chosen.textContent = value.startsWith('clay:') && !(item && item.group === 'music') ? '' : item ? item.label : '自訂 emoji';
      grid.querySelectorAll('button[data-icon]').forEach(button => {
        const selected = button.dataset.icon === value;
        button.classList.toggle('is-selected', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
    }
    function pick(item) {
      input.value = item.icon;
      try { localStorage.setItem(RECENT, JSON.stringify([item.icon, ...recentIcons().filter(x => x !== item.icon)].slice(0,12))); } catch { /* 不影響使用 */ }
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      updateSelection();
    }
    function suggested() {
      const negative = opts.pointsInput && Number(opts.pointsInput.value) < 0;
      const name = opts.nameInput ? opts.nameInput.value.trim() : '';
      const pool = items.filter(item => negative ? item.group === 'reminder' || ['routine','work','kind'].includes(item.group) || (item.group==='clay'&&item.tone==='reminder') : item.group !== 'reminder');
      const ranked = pool.map((item, index) => ({ item, index, score: item.keywords.split(' ').reduce((total,key) => total + (name && name.includes(key) ? key.length : 0),0) + (negative && item.group === 'reminder' ? 2 : 0) + (item.group==='clay' && (negative ? item.tone==='reminder' : item.tone==='positive') ? 3 : 0) }))
        .sort((a,b) => b.score-a.score || a.index-b.index).slice(0,18).map(x=>x.item);
      const current = items.find(item => item.icon === input.value.trim());
      return current ? [current, ...ranked.filter(item => item.icon !== current.icon)].slice(0,18) : ranked;
    }
    function paintGrid() {
      let list;
      if (query) list = items.filter(x => (x.label + x.keywords + groups.find(g=>g[0]===x.group)[1] + x.icon).includes(query));
      else if (category === 'suggested') list = suggested();
      else if (category === 'recent') list = recentIcons().map(icon => items.find(x=>x.icon===icon) || {icon,label:'自訂 emoji'});
      else list = category === 'all' ? items : items.filter(x=>x.group===category);
      grid.replaceChildren(...list.map(item => el('button', { class: 'rule-icons__item', type: 'button', 'data-icon': item.icon, title: item.label, 'aria-label': item.label, 'aria-pressed': 'false', onclick: () => pick(item) }, [el('span', { class: 'rule-icons__emoji', text: item.icon }), item.icon.startsWith('clay:') && item.group !== 'music' ? null : el('span', { class: 'rule-icons__label', text: item.label })])));
      if (!list.length) grid.append(el('p', { class: 'rule-icons__empty', text: category === 'recent' && !query ? '選過的圖示會出現在這裡。' : '找不到符合的圖示，試試其他關鍵字，或直接貼上 emoji。' }));
      status.textContent = query ? '找到 ' + list.length + ' 個圖示' : category === 'suggested' ? '依規則名稱與加扣分推薦' : list.length + ' 個圖示';
      grid.scrollTop = 0;
      tabs.querySelectorAll('button').forEach(b => { b.classList.toggle('is-active', b.dataset.category === category); b.setAttribute('aria-pressed',String(b.dataset.category===category)); });
      updateSelection();
    }
    const categories = (opts.nameInput ? [['clay','黏土圖示（新）'],['suggested','為這條規則推薦']] : []).concat([['all','全部'],['recent','最近使用']],groups.filter(g=>g[0]!=='clay').map(g=>[g[0],g[1]]));
    categories.forEach(([id,label]) => tabs.append(el('button', { class: 'rule-icons__tab', type:'button', 'data-category': id, text:label, onclick:()=>{category=id;query='';search.value='';paintGrid();} })));
    input.addEventListener('input', updateSelection);
    if(opts.nameInput) opts.nameInput.addEventListener('input',()=>{if(category==='suggested'&&!query)paintGrid();});
    if(opts.pointsInput) opts.pointsInput.addEventListener('input',()=>{if(category==='suggested'&&!query)paintGrid();});
    const manual=el('input',{class:'input',type:'text',placeholder:'例如：🦋 或其他 emoji','aria-label':'貼上其他 emoji',value:input.value.startsWith('clay:')?'':input.value,oninput:e=>{input.value=e.target.value;input.dispatchEvent(new Event('input',{bubbles:true}));}});
    input.addEventListener('input',()=>{manual.value=input.value.startsWith('clay:')?'':input.value;});
    const host=el('section', { class:'rule-icons', 'aria-label':'教室 emoji 圖示庫' }, [
      el('div',{class:'rule-icons__heading'},[preview,el('div',{},[el('span',{class:'muted',text:'目前圖示'}),chosen]),status]),
      search,tabs,grid,
      opts.nameInput ? el('details',{class:'rule-icons__manual'},[el('summary',{text:'也可以貼上其他 emoji'}),manual]) : null,
      el('p',{class:'rule-icons__hint',text:'先選黏土圖示，或切換原有 emoji；按「儲存」後才會更新規則。'})
    ]);
    paintGrid(); return host;
  }
  window.PetIconPicker = { create };
})();
