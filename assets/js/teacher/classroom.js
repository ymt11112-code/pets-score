/* 手機優先：先選學生，再按常用規則；保留選取供連續課堂操作。 */
(function () {
  'use strict';
  const S = window.PetStore, U = window.PetUtil, el = U.el;
  let selected = new Set(), query = '', group = '', currentRule = '';
  let keepSelection = false, feedback = '';
  function renderAward(applyRule, launcherOptions) {
    const s = S.get();
    const available = s.students.filter(st => !S.isAbsent(st.id));
    selected = new Set([...selected].filter(id => available.some(st => st.id === id)));
    const rules = (s.rules || []).filter(r => r.points > 0);
    if (!rules.some(r => r.id === currentRule)) currentRule = rules[0] ? rules[0].id : '';
    const root = el('section', { class: 'classroom' });
    const list = el('div', { class: 'classroom-students', 'aria-label': '選擇加分學生' });
    const count = el('strong');
    const ruleList = el('div', { class: 'classroom-rules' });
    const submit = el('button', { class: 'btn btn--primary classroom-submit', onclick: () => {
      const rule = rules.find(r => r.id === currentRule);
      if (!selected.size || !rule) return;
      const ids = [...selected];
      // Clear before award triggers synchronous store subscribers and redraws this page.
      if (!keepSelection) selected.clear();
      feedback = '✅ ' + ids.length + ' 位學生 · ' + rule.label + ' +' + rule.points + ' 點';
      applyRule(ids, rule);
    } });
    function paintSelection() {
      const visible = available.filter(st => (!group || st.groupId === group) && (!query || (String(st.no).padStart(2,'0') + st.name).includes(query))).sort((a,b)=>a.no-b.no);
      list.replaceChildren(...visible.map(st => el('button', {
        class: 'classroom-student' + (selected.has(st.id) ? ' is-selected' : ''),
        'aria-pressed': String(selected.has(st.id)), onclick: () => {
          selected.has(st.id) ? selected.delete(st.id) : selected.add(st.id); paintSelection();
        }
      }, [el('span', { class: 'classroom-number', text: String(st.no).padStart(2,'0') }), el('strong', { text: st.name }), el('span', { class: 'muted', text: st.points + ' 點' })])));
      if (!visible.length) list.append(el('p', { text: '沒有符合條件的學生；請調整搜尋或小組。' }));
      count.textContent = '已選 ' + selected.size + ' 位';
      const rule = rules.find(r => r.id === currentRule);
      submit.disabled = !selected.size || !rule;
      submit.textContent = rule ? '送出加分 · ' + selected.size + ' 人 × +' + rule.points : '請先到規則設定新增加分規則';
    }
    function paintRules() {
      ruleList.replaceChildren(...rules.map(r => el('button', {
        class: 'classroom-rule' + (r.id === currentRule ? ' is-selected' : ''),
        'aria-pressed': String(r.id === currentRule), onclick: () => { currentRule = r.id; paintRules(); paintSelection(); }
      }, [el('span', { text: r.icon || '⭐' }), el('span', { text: r.label }), el('b', { text: '+' + r.points })])));
    }
    const search = el('input', { class: 'input', type: 'search', value: query, placeholder: '搜尋座號或姓名', 'aria-label': '搜尋座號或姓名', oninput: e => { query = e.target.value.trim(); paintSelection(); } });
    const groups = el('select', { class: 'input', 'aria-label': '篩選小組', onchange: e => { group = e.target.value; paintSelection(); } }, [el('option', { value: '', text: '全部小組' }), ...(s.groups || []).map(g => el('option', { value: g.id, text: g.name }))]);
    groups.value = group;
    root.append(el('div', { class: 'classroom-heading' }, [
      el('div', {}, [el('h1', { text: '⚡ 課堂快加' }), el('p', { class: 'muted', text: '選學生 → 選原因 → 送出加分' })]),
      el('details', { class: 'classroom-launcher' }, [el('summary', { class: 'btn btn--ghost', text: '🐾 桌面／置頂工具' }), launcherOptions()])
    ]));
    root.append(el('details', { class: 'classroom-connection' }, [
      el('summary', { text: S.getConfig().mode === 'sheet' ? '☁️ 雲端模式 · 查看同步說明' : '💻 本機模式 · 跨裝置需連線' }),
      el('p', { text: '手機與投影電腦需在「資料與同步」連到同一個 Apps Script 網址與班級代碼。提示在同步完成後出現；本機模式只同步同瀏覽器分頁。' }),
      el('a', { href: '#sync', text: '開啟資料與同步 →' })
    ]));
    root.append(el('div', { class: 'classroom-filter' }, [search, groups]));
    root.append(el('div', { class: 'classroom-actions' }, [count,
      el('button', { class: 'btn btn--ghost', text: '選取畫面學生', onclick: () => { available.filter(st => (!group || st.groupId === group) && (!query || (String(st.no).padStart(2,'0') + st.name).includes(query))).forEach(st=>selected.add(st.id)); paintSelection(); } }),
      el('button', { class: 'btn btn--ghost', text: '清除', onclick: () => { selected.clear(); paintSelection(); } })
    ]));
    root.append(list);
    root.append(el('div', { class: 'classroom-award' }, [
      el('strong', { text: '選擇加分原因' }), ruleList,
      el('label', { class: 'classroom-keep' }, [el('input', { type: 'checkbox', ...(keepSelection ? { checked: '' } : {}), onchange: e => { keepSelection = e.target.checked; } }), '加分後保留選取']),
      submit,
      el('p', { class: 'classroom-feedback', role: 'status', text: feedback || '加分後會保留紀錄，投影端收到同步時會顯示提示。' })
    ]));
    paintRules(); paintSelection(); return root;
  }
  let mobileView = 'remote';
  const paths = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    timer: '<circle cx="12" cy="14" r="8"/><path d="M9 2h6M12 2v4M18 6l2-2M12 10v5l3 2"/>',
    dice: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M7 7h.01M17 7h.01M12 12h.01M7 17h.01M17 17h.01"/>',
    tasks: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M8 10l1 1 2-2M13 10h3M8 16l1 1 2-2M13 16h3"/>',
    trophy: '<path d="M8 3h8v6a4 4 0 0 1-8 0V3ZM8 5H4v3a4 4 0 0 0 4 4M16 5h4v3a4 4 0 0 1-4 4M12 13v5M8 21h8M10 18h4v3"/>',
    people: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v3"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-7L3 8M3 3v5h5M12 7v5l3 2"/>',
    book: '<path d="M12 5C9 3 5 3 3 4v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1ZM12 5v15"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    cloud: '<path d="M6 18a4 4 0 0 1-1-8 7 7 0 0 1 13-2 5 5 0 0 1 0 10M12 12v9M9 15l3-3 3 3"/>',
    home: '<path d="m3 11 9-8 9 8M5 10v11h5v-7h4v7h5V10"/>',
    back: '<path d="m14 5-7 7 7 7M7 12h14"/>',
  };
  function icon(name) {
    return el('span', { class: 'remote-icon', 'aria-hidden': 'true', html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (paths[name] || paths.grid) + '</svg>' });
  }
  function mobileNav(actions, setView) {
    return el('nav', { class: 'remote-nav', 'aria-label': '課堂常用功能' }, [
      ['home','遙控面板',()=>setView('remote'),'remote'],
      ['plus','快速加點',()=>setView('award'),'award'],
      ['timer','計時器',actions.timer,'timer'],
      ['dice','挑人',actions.pick,'pick'],
    ].map(([image,label,click,id])=>el('button',{type:'button',class:'remote-nav__item'+(mobileView===id?' is-active':''), 'aria-current':mobileView===id?'page':null,onclick:click},[icon(image),el('span',{text:label})])));
  }
  function renderRemote(actions, setView) {
    const s=S.get(), cfg=S.getConfig(), sync=S.getSync();
    const cloud=cfg.mode==='sheet';
    const connected=cloud && sync.state==='ok';
    const root=el('section',{class:'remote-home','aria-label':'課堂遙控面板'});
    root.append(el('header',{class:'remote-header'},[
      el('button',{class:'remote-header__back','aria-label':'返回班級總覽',onclick:()=>actions.go('overview')},[icon('back')]),
      el('div',{},[el('p',{class:'remote-eyebrow',text:'CLASSROOM COMPANION'}),el('h1',{text:'課堂遙控器'})]),
      el('span',{class:'remote-header__pet','aria-hidden':'true',text:'🐾'})
    ]));
    root.append(el('button',{class:'remote-connection'+(connected?' is-connected':''),onclick:()=>actions.go('sync')},[
      el('span',{class:'remote-connection__dot','aria-hidden':'true'}),
      el('span',{},[el('strong',{text:s.classInfo.className || '我的班級'}),el('small',{text:cloud?(sync.state==='error'?'同步異常 · 點此檢查':connected?'雲端已連線 · 加點同步到教室':'正在連線 · 點此查看'):'本機模式 · 跨裝置請先連線'})]),
      icon('cloud')
    ]));
    root.append(el('div',{class:'remote-section-title'},[el('h2',{text:'一手掌握課堂'}),el('span',{text:s.students.filter(st=>!S.isAbsent(st.id)).length+' 位到校'})]));
    const pad=el('div',{class:'remote-pad','aria-label':'主要課堂工具'});
    const controls=[
      ['timer','計時器',actions.timer,'top'],['tasks','今日任務',actions.tasks,'left'],
      ['plus','快速加點',()=>setView('award'),'center'],['dice','挑人',actions.pick,'right'],['trophy','排行榜',()=>actions.go('board'),'bottom']
    ];
    controls.forEach(([image,label,click,position])=>pad.append(el('button',{type:'button',class:'remote-pad__button remote-pad__button--'+position,onclick:click},[
      icon(image),el('strong',{text:label}),position==='top'?el('small',{'data-remote-timer':'',text:actions.timerLabel()}):null
    ])));
    root.append(pad);
    root.append(el('div',{class:'remote-section-title'},[el('h2',{text:'更多課堂工具'}),el('span',{text:'點一下就能開啟'})]));
    root.append(el('div',{class:'remote-tools'},[
      ['people','出席',actions.attendance],['history','點數紀錄',()=>actions.go('ledger')],['book','規則庫',()=>actions.go('rules')],
      ['grid','批次加點',()=>actions.go('batch')],['cloud','同步設定',()=>actions.go('sync')],['timer','更多工具',()=>actions.go('tools')]
    ].map(([image,label,click])=>el('button',{type:'button',class:'remote-tool',onclick:click},[el('span',{class:'remote-tool__circle'},[icon(image)]),el('span',{text:label})]))));
    root.append(el('p',{class:'remote-footnote',text:'手機加點後，教室網頁會在雲端同步到達時顯示提示。'}));
    return root;
  }
  function render(applyRule, launcherOptions, actions) {
    const mobile=window.matchMedia('(max-width: 860px)').matches;
    document.body.classList.toggle('is-remote-home',mobile && mobileView==='remote');
    if(!mobile) return renderAward(applyRule,launcherOptions);
    function setView(view) { mobileView=view; actions.refresh();window.scrollTo({top:0,behavior:'auto'}); }
    const root=el('div',{class:'classroom-mobile-shell'});
    if(mobileView==='remote') root.append(renderRemote(actions,setView));
    else {
      root.append(el('button',{class:'classroom-return',onclick:()=>setView('remote')},[icon('back'),'返回課堂遙控器']));
      root.append(renderAward(applyRule,launcherOptions));
    }
    root.append(mobileNav(actions,setView));
    return root;
  }
  window.PetClassroom = { render };
})();
