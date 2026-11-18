/* 共用課堂抽籤中心：動畫只呈現引擎已抽出的結果，不另改中籤人。 */
(function(root){
  'use strict';
  const E=root.PetDrawEngine,U=root.PetUtil,el=U.el;
  const THEMES=[['wheel','🎡','幸運轉盤'],['race','🏁','賽跑大賽'],['bomb','💣','炸彈傳遞'],['slot','🎰','拉霸機'],['gacha','🟣','盲盒扭蛋'],['cards','🃏','塔羅翻牌'],['scratch','🎟️','刮刮樂'],['devil','👹','魔鬼籤']];
  const svg=(tag,attrs,text)=>{const node=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs||{}).forEach(([key,value])=>node.setAttribute(key,value));if(text!=null)node.textContent=text;return node;};
  const PALETTES={forest:['#15584c','#e8bb4d','#cde8db','#507d8a','#f4dca0','#8f73b3'],ocean:['#084c61','#177eaa','#4cc9d9','#b7e8f0','#6b7fd7','#d7f4ff'],sunset:['#8f2d56','#d94c56','#f48c48','#ffcb69','#f7e5b7','#b75d69'],candy:['#e498bc','#a995d0','#8cd4cf','#fae29b','#f9b4a2','#9fc6eb'],neon:['#5224a0','#db237b','#00a89b','#ffce32','#1961d3','#91d435'],mono:['#173b42','#45666b','#729096','#9fb4b6','#cedcde','#f0f6f6']};
  function makeWheel(entries,weights,label,palette,onSpin){
    const holder=el('div',{class:'dc-wheel-wrap','aria-label':label}),art=svg('svg',{viewBox:'0 0 400 400',class:'dc-wheel'});let cursor=0;
    const total=entries.reduce((sum,item)=>sum+Math.max(1,Number(weights&&weights[item.id])||1),0)||1;
    const colors=PALETTES[palette]||PALETTES.forest;const sectors=[];
    entries.forEach((item,index)=>{
      const size=Math.max(1,Number(weights&&weights[item.id])||1)/total*360,start=cursor,end=cursor+size,center=(start+end)/2;sectors.push(center);cursor=end;
      const point=degrees=>[200+190*Math.cos((degrees-90)*Math.PI/180),200+190*Math.sin((degrees-90)*Math.PI/180)];
      if(entries.length===1)art.append(svg('circle',{cx:200,cy:200,r:190,fill:colors[0]}));else{const a=point(start),b=point(end);art.append(svg('path',{d:'M200 200 L'+a.join(' ')+' A190 190 0 '+(size>180?1:0)+' 1 '+b.join(' ')+' Z',fill:colors[index%colors.length],stroke:'#fff','stroke-width':1}));}
      const hex=colors[index%colors.length],luma=parseInt(hex.slice(1,3),16)*.299+parseInt(hex.slice(3,5),16)*.587+parseInt(hex.slice(5,7),16)*.114;const color=luma>155?'#102b33':'#fff';
      const text=svg('text',{x:385,y:205,transform:'rotate('+(center-90)+' 200 200)','text-anchor':'end',fill:color,'font-size':entries.length>32?10:entries.length>18?12:16,'font-weight':700},String(item.label||item.name||'').slice(0,11));art.append(text);
    });
    art.append(svg('circle',{cx:200,cy:200,r:35,fill:'#fff'}));if(!onSpin)art.append(svg('text',{x:200,y:207,'text-anchor':'middle','font-size':16,'font-weight':900,fill:'#15584c'},'任務'));
    holder.append(el('span',{class:'dc-pointer','aria-hidden':'true'}),art,el('small',{text:label}));if(onSpin)holder.append(el('button',{class:'dc-wheel-go',type:'button',text:'GO','aria-label':'按 GO 開始抽籤','data-draw-trigger':'',onclick:onSpin}));
    return{node:holder,art,sectors,spin(index,duration){art.style.transition='none';art.style.transform='rotate(0deg)';requestAnimationFrame(()=>requestAnimationFrame(()=>{art.style.transition='transform '+duration+'ms cubic-bezier(.12,.65,.1,1)';art.style.transform='rotate('+(1800-(sectors[Math.max(0,index)]||0))+'deg)';}));}};
  }
  function create(adapter){
    let snapshot=adapter.getSnapshot(),data=E.normalize(snapshot.draw),running=false,projected=false,disposed=false,frame=null,presentation=0,revealNow=null;
    const clock=adapter.clock||root.PetLessonTimer.clock;
    const audio=root.PetDrawSounds.create();const rootEl=el('section',{class:'draw-center'});let refs={},notice='',weightSearch='',settingsOpen=false,view='result',rosterQuery='';const performed=new Map();
    const currentPool=()=>E.candidates(snapshot,data);
    const formatStudent=st=>U.pad2(st.no)+' '+st.name;
    function btn(text,click,kind,attrs){return el('button',Object.assign({type:'button',class:'dc-button '+(kind||''),text,onclick:click},attrs||{}));}
    function field(label,node){return el('label',{class:'dc-field'},[el('span',{text:label}),node]);}
    function setNotice(text){notice=text;if(refs.notice)refs.notice.textContent=text;}
    function refresh(){
      if(disposed)return;const pool=currentPool(),present=snapshot.students.filter(st=>!(snapshot.absentIds||[]).includes(st.id));
      if(refs.stats)refs.stats.textContent='第 '+data.round+' 輪 · 可抽 '+pool.length+' / 到校 '+present.length+' 位 · 已抽 '+data.drawnIds.filter(id=>snapshot.students.some(st=>st.id===id)).length+' 位';
      if(refs.start){refs.start.disabled=running||!pool.length;refs.start.textContent=running?(revealNow?'刮開卡片揭曉':'抽籤中…'):!pool.length?'本輪已抽完，請重置':data.config.style==='cards'?'隨機翻牌':data.config.style==='scratch'?'抽出刮刮卡':'開始抽 '+Math.min(data.config.count,pool.length)+' 位';}
      if(refs.order)refs.order.disabled=running||!pool.length;
      rootEl.querySelectorAll('[data-lock]').forEach(node=>node.disabled=running);
      rootEl.querySelectorAll('[data-style]').forEach(node=>{node.classList.toggle('is-active',node.dataset.style===data.config.style);node.setAttribute('aria-pressed',String(node.dataset.style===data.config.style));});
      const total=pool.reduce((sum,st)=>sum+(data.weights[st.id]||1),0);
      rootEl.querySelectorAll('[data-weight-id]').forEach(row=>{const id=row.dataset.weightId,input=row.querySelector('input'),prob=row.querySelector('small');if(document.activeElement!==input)input.value=data.weights[id]||1;const eligible=pool.some(st=>st.id===id);prob.textContent=eligible&&total?'首抽 '+((data.weights[id]||1)/total*100).toFixed(1)+'%':(snapshot.absentIds||[]).includes(id)?'今日不參加':'本輪已抽';row.classList.toggle('is-excluded',!eligible);});
      rootEl.querySelectorAll('[data-config]').forEach(node=>{if(node===document.activeElement)return;const value=data.config[node.dataset.config];if(node.type==='checkbox')node.checked=!!value;else node.value=value;});
      if(refs.reveal)refs.reveal.hidden=!revealNow;
      const mode=rootEl.querySelector('[data-config=taskMode]');if(mode)mode.disabled=running||data.config.style==='devil';
      if(refs.notice)refs.notice.textContent=notice;
      rootEl.querySelectorAll('[data-draw-trigger]').forEach(node=>node.disabled=running||!pool.length);
    }
    async function configure(patch){
      if(patch.config&&(patch.config.timerMode!==undefined||patch.config.timerSeconds!==undefined||patch.config.autoTimer===true)&&!clock.get().running)clock.configure({mode:patch.config.timerMode||data.config.timerMode,seconds:patch.config.timerSeconds===undefined?data.config.timerSeconds:patch.config.timerSeconds});
      if(patch.config)Object.assign(data.config,patch.config);if(patch.weights)Object.assign(data.weights,patch.weights);if(patch.resetWeights)data.weights={};refresh();
      try{const next=await adapter.configure(patch);if(next)update(next);}catch(error){setNotice(error.message);}
    }
    function control(config,key,type,extra){return el('input',Object.assign({type:type||'number',value:config[key], 'data-lock':'','data-config':key,onchange:event=>configure({config:{[key]:type==='checkbox'?event.target.checked:event.target.value}})},type==='checkbox'?{checked:config[key]?'checked':null}:{},extra||{}));}
    function optionControl(key,label,options){return field(label,el('select',{'data-lock':'','data-config':key,'aria-label':label,onchange:e=>{configure({config:{[key]:key==='soundIntensity'?Number(e.target.value):e.target.value}});if(key==='wheelPalette')render();}},options.map(([value,text])=>el('option',{value,text,selected:data.config[key]===value?'selected':null}))));}
    function paintClock(){if(!refs.timer)return;const t=clock.get(),value=String(Math.floor(t.seconds/60)).padStart(2,'0')+':'+String(t.seconds%60).padStart(2,'0');refs.timer.querySelector('[data-draw-clock-value]').textContent=value;refs.timer.querySelector('[data-draw-clock-kind]').textContent=t.done?'時間到':t.mode==='up'?'正向':'倒數';refs.timer.classList.toggle('is-finished',t.done);const toggle=refs.timer.querySelector('[data-draw-clock-toggle]');toggle.textContent=t.running?'⏸':'▶';toggle.setAttribute('aria-label',t.running?'暫停計時':'開始計時');}
    const unsubscribeClock=clock.subscribe(()=>paintClock());
    function clockStrip(){refs.timer=el('div',{class:'dc-timer-strip','aria-label':'抽籤計時器'},[el('small',{'data-draw-clock-kind':''}),el('strong',{'data-draw-clock-value':''}),btn('▶',()=>{const t=clock.get();if(t.running)clock.pause();else clock.start();},'',{'data-draw-clock-toggle':'','aria-label':'開始計時'}),btn('↻',()=>{clock.configure({mode:data.config.timerMode,seconds:data.config.timerSeconds});},'',{'aria-label':'重設抽籤計時器'})]);return refs.timer;}
    function settings(){
      const cfg=data.config;
      const count=el('select',{'aria-label':'一次抽幾位','data-lock':'','data-config':'count',onchange:e=>configure({config:{count:Number(e.target.value)}})},[1,2,3,4,5].map(n=>el('option',{value:n,text:n+' 位',selected:cfg.count===n?'selected':null})));
      const mode=el('select',{'aria-label':'綁定抽籤任務','data-lock':'','data-config':'taskMode',onchange:e=>{configure({config:{taskMode:e.target.value}});render();}},[['none','只抽學生'],['questions','學生＋題號'],['reward','學生＋獎勵／懲罰'],['chores','學生＋掃除工作'],['custom','學生＋自訂任務'],['punishment','學生＋處罰項目']].map(([value,text])=>el('option',{value,text,selected:cfg.taskMode===value?'selected':null})));
      const duration=el('select',{'aria-label':'動畫長度','data-lock':'','data-config':'duration',onchange:e=>configure({config:{duration:Number(e.target.value)}})},[2,4,6,8].map(n=>el('option',{value:n,text:n+' 秒',selected:cfg.duration===n?'selected':null})));
      const group=el('select',{'aria-label':'排序分組數','data-lock':'','data-config':'groupCount',onchange:e=>configure({config:{groupCount:Number(e.target.value)}})},[0,2,3,4,5,6,8,10].map(n=>el('option',{value:n,text:n?n+' 組，依序輪流分組':'只排名，不分組',selected:cfg.groupCount===n?'selected':null})));
      const extras=[];
      if(cfg.taskMode==='questions')extras.push(el('div',{class:'dc-settings-row'},[field('題號從',control(cfg,'questionFrom','number',{min:1,max:999})),field('到',control(cfg,'questionTo','number',{min:1,max:999}))]));
      if(['reward','chores','custom','punishment'].includes(cfg.taskMode)){const key=cfg.taskMode==='reward'?'taskText':cfg.taskMode==='chores'?'choreText':cfg.taskMode==='punishment'?'punishmentText':'customText';extras.push(field(cfg.taskMode==='punishment'?'處罰項目（每行一項）':'每行一項，抽出後與學生配對',el('textarea',{'data-lock':'','data-config':key,rows:4,text:cfg[key],onchange:e=>configure({config:{[key]:e.target.value}})})));}
      if(cfg.taskMode!=='none')extras.push(el('p',{class:'dc-note',text:'任務以文字顯示，這次連抽盡量不重複任務；加扣分請在結果出來後確認。'}));
      return el('div',{class:'dc-settings'},[
        el('div',{class:'dc-settings-row'},[field('一次抽取',count),field('任務綁定',mode),field('動畫長度',duration)]),
        el('div',{class:'dc-settings-row'},[
          el('label',{class:'dc-check'},[control(cfg,'excludeDrawn','checkbox'),'已抽中的學生本輪排除']),
          el('label',{class:'dc-check'},[control(cfg,'sound','checkbox'),'開啟抽籤音效']),
          field('音量',control(cfg,'volume','range',{min:0,max:100,'aria-label':'音效音量'}))
        ]),
        el('div',{class:'dc-settings-row'},[
          optionControl('wheelPalette','轉盤色系',[['forest','森林金綠'],['ocean','海洋藍'],['sunset','夕陽暖橘'],['candy','糖果粉彩'],['neon','繽紛霓虹'],['mono','沉穩灰藍']]),
          el('div',{class:'dc-palette-preview','aria-label':'目前轉盤配色'},(PALETTES[cfg.wheelPalette]||PALETTES.forest).map(color=>el('span',{style:{background:color}})))
        ]),
        el('div',{class:'dc-settings-row'},[
          optionControl('soundTrack','抽籤音效',[['drums','加速戰鼓'],['heartbeat','緊張心跳'],['arcade','電玩衝刺'],['suspense','懸疑倒數'],['bells','輕快鈴聲'],['marimba','木琴跳跳'],['piano','柔和鋼琴'],['ukulele','烏克麗麗'],['cosmic','星際漫遊'],['orchestra','冒險弦樂'],['carnival','歡樂嘉年華'],['mystery','神祕森林'],['none','靜音']]),
          optionControl('revealSound','揭曉音效',[['fanfare','勝利號角'],['applause','熱烈掌聲'],['fireworks','慶祝煙火'],['chime','清脆提示'],['harp','豎琴流星'],['jazz','爵士慶祝'],['retro_win','復古過關'],['soft','溫柔和弦'],['magic','魔法閃光'],['drum_finish','戰鼓終章'],['none','靜音']]),
          optionControl('soundIntensity','緊張程度',[[1,'穩定'],[2,'刺激'],[3,'極限加速']]),
          btn('▶ 試聽音效',()=>{if(!data.config.sound)return setNotice('請先勾選音效。');audio.preview(data.config);},'',{'data-lock':'','data-preview-sound':''})
        ]),
        el('div',{class:'dc-settings-row'},[
          el('label',{class:'dc-check'},[control(cfg,'autoTimer','checkbox'),'抽中後自動啟動計時器']),
          optionControl('timerMode','計時方式',[['down','倒數計時'],['up','從0秒正向計時']]),
          field('預設倒數秒數',control(cfg,'timerSeconds','number',{min:1,max:10800,'aria-label':'預設倒數秒數'}))
        ]),...extras,
        el('details',{},[el('summary',{text:'整輪排序分組'}),field('抽完整輪時',group),el('p',{class:'dc-note',text:'每位同學的中籤權重，請按抽籤區右上方的「全員名單・權重」設定。'})])
      ]);
    }
    function avatar(result){if(adapter.avatar)return adapter.avatar(result.studentId||result.id);return el('span',{class:'dc-avatar',text:result.emoji||'🐾'});}
    function petMeta(item){
      const info=adapter.info&&adapter.info(item.studentId||item.id);if(!info)return null;
      return el('div',{class:'dc-pet-meta','data-pet-meta':''},[
        el('span',{class:'dc-pet-level',text:'Lv.'+info.level+(info.petName?' · '+info.petName:'')}),
        el('span',{class:'dc-pet-bar','aria-hidden':'true'},[el('i',{style:{width:Math.max(0,Math.min(100,info.percent||0))+'%'}})]),
        el('small',{class:'dc-pet-xp',text:'XP '+info.inLevel+' / '+info.need+'・累積 '+info.xp})
      ]);
    }
    function markNarrow(){const list=refs.results&&refs.results.querySelector('.dc-order-list');if(list)list.classList.toggle('is-narrow',list.clientWidth<440);}
    function attachSplitter(ws){
      const KEY='classpet.drawSplit.v1',handle=el('div',{class:'dc-splitter',role:'separator','aria-orientation':'vertical','aria-label':'拖曳調整左右寬度，雙擊恢復','tabindex':'0',title:'拖曳調整左右寬度，雙擊恢復'},[el('span',{'aria-hidden':'true'})]);
      let ratio=null;try{const v=parseFloat(localStorage.getItem(KEY));if(v>=.2&&v<=.8)ratio=v;}catch{}
      const place=()=>{if(!handle.isConnected||!refs.stage||!refs.side)return;const w=ws.getBoundingClientRect(),a=refs.stage.getBoundingClientRect(),b=refs.side.getBoundingClientRect();if(!w.width||!a.width||!b.width){handle.style.display='none';return;}handle.style.display='';handle.style.left=((a.right+b.left)/2-w.left)+'px';markNarrow();};
      const apply=()=>{ws.style.gridTemplateColumns=ratio?'minmax(0,'+ratio.toFixed(4)+'fr) minmax(0,'+(1-ratio).toFixed(4)+'fr)':'';place();};
      const save=()=>{try{if(ratio)localStorage.setItem(KEY,String(ratio));else localStorage.removeItem(KEY);}catch{}};
      const nudge=delta=>{ratio=Math.min(.8,Math.max(.2,(ratio||.5)+delta));apply();save();};
      handle.addEventListener('pointerdown',e=>{e.preventDefault();try{handle.setPointerCapture(e.pointerId);}catch{}handle.classList.add('is-dragging');});
      handle.addEventListener('pointermove',e=>{if(!handle.classList.contains('is-dragging'))return;const w=ws.getBoundingClientRect();ratio=Math.min(.8,Math.max(.2,(e.clientX-w.left)/w.width));apply();});
      const end=()=>{if(handle.classList.contains('is-dragging')){handle.classList.remove('is-dragging');save();}};
      handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);
      handle.addEventListener('dblclick',()=>{ratio=null;apply();save();});
      handle.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();nudge(-.03);}else if(e.key==='ArrowRight'){e.preventDefault();nudge(.03);}else if(e.key==='Home'||e.key==='Enter'){e.preventDefault();ratio=null;apply();save();}});
      ws.append(handle);apply();
      if(splitObserver)splitObserver.disconnect();splitObserver=null;
      if(window.ResizeObserver){splitObserver=new window.ResizeObserver(place);splitObserver.observe(ws);}
    }
    function focusSide(){if(projected||!refs.side||!refs.side.scrollIntoView)return;requestAnimationFrame(()=>{try{refs.side.scrollIntoView({block:'start',behavior:'smooth'});}catch{}});}
    let flashTimer=null,splitObserver=null,winnerTimer=null,soloRun=false;
    /* 轉盤、拉霸、扭蛋一次只抽一位：不需要左右分割，抽完直接顯示中籤同學。 */
    const SOLO_STYLES=['wheel','slot','gacha'];
    const soloStyle=()=>SOLO_STYLES.includes(data.config.style)&&(Number(data.config.count)||1)<=1;
    function flash(text){if(!projected)return;rootEl.querySelectorAll('.dc-award-flash').forEach(node=>node.remove());const box=el('div',{class:'dc-award-flash',role:'status'},[el('span',{text:'✅','aria-hidden':'true'}),el('strong',{text})]);rootEl.append(box);clearTimeout(flashTimer);flashTimer=setTimeout(()=>box.remove(),4200);}
    function performBar(item){
      const list=adapter.performance&&adapter.perform?adapter.performance():null;if(!list||!list.length)return null;
      const id=item.studentId||item.id;
      return el('span',{class:'dc-perform',role:'group','aria-label':item.name+' 課堂表現','data-perform-for':id},list.map(p=>{
        const mark=performed.get(id),button=el('button',{type:'button',class:'dc-perform-btn'+(mark&&mark.has(p.key)?' is-done':''),title:p.label+' +'+p.points+(mark&&mark.has(p.key)?'（再點一次可取消）':''),'aria-label':item.name+' '+p.label+' 加 '+p.points+' 點，已加分時再點一次可取消','aria-pressed':String(!!(mark&&mark.has(p.key))),'data-perform':p.key,text:p.icon});
        button.addEventListener('click',async()=>{const got=performed.get(id)||new Set();if(got.has(p.key)){if(!adapter.unperform){setNotice(item.name+' 已經加過「'+p.label+'」。');return;}button.disabled=true;try{await adapter.unperform(id,p.key);got.delete(p.key);rootEl.querySelectorAll('[data-perform-for="'+id+'"] [data-perform="'+p.key+'"]').forEach(x=>{x.classList.remove('is-done');x.setAttribute('aria-pressed','false');x.title=p.label+' +'+p.points+'（再點一次可取消）';});setNotice('已取消 '+item.name+' 的「'+p.label+'」加分。');flash('已取消 '+item.name+' '+p.label);}catch(error){setNotice(error.message||'取消失敗，請到點數紀錄撤銷。');}finally{button.disabled=false;}return;}button.disabled=true;got.add(p.key);performed.set(id,got);button.classList.add('is-done');button.setAttribute('aria-pressed','true');button.title=p.label+' +'+p.points+'（再點一次可取消）';try{await adapter.perform(id,p.key);setNotice(item.name+' '+p.label+' +'+p.points+' 點');flash(item.name+' '+p.label+' +'+p.points+' 點');}catch(error){got.delete(p.key);button.classList.remove('is-done');button.setAttribute('aria-pressed','false');setNotice(error.message||'加分失敗，請稍後再試。');}finally{button.disabled=false;}});
        return button;}));
    }
    function weightStepper(st){
      const input=el('input',{type:'number',min:1,max:10,step:1,value:data.weights[st.id]||1,'aria-label':st.name+'中籤權重','data-lock':'',onchange:e=>set(e.target.value)});
      function set(raw){const value=Math.max(1,Math.min(10,Math.round(Number(raw)||1)));input.value=value;configure({weights:{[st.id]:value}});}
      return el('span',{class:'dc-weight'},[el('button',{type:'button',class:'dc-weight-step','aria-label':st.name+'權重減 1','data-lock':'',text:'−',onclick:()=>set(Number(input.value)-1)}),input,el('button',{type:'button',class:'dc-weight-step','aria-label':st.name+'權重加 1','data-lock':'',text:'+',onclick:()=>set(Number(input.value)+1)})]);
    }
    function paintRest(result){
      if(!refs.rest)return;
      const absent=snapshot.absentIds||[],drawn=data.drawnIds.map(id=>snapshot.students.find(st=>st.id===id)).filter(Boolean),latest=new Set(result&&!result.order?result.results.map(item=>item.studentId):[]);
      const award=btn('為抽中學生加點',async()=>{try{const ids=result.results.filter(item=>!absent.includes(item.studentId)&&snapshot.students.some(st=>st.id===item.studentId)).map(item=>item.studentId);if(!ids.length)return setNotice('這些學生目前不在可加點名單，請檢查出席。');await adapter.select(ids);}catch(error){setNotice(error.message);}},'dc-primary',{'data-award-drawn':''});award.disabled=!result||running;
      refs.rest.replaceChildren(el('div',{class:'dc-rest-head'},[el('strong',{text:'本輪已抽 '+drawn.length+' 位'}),award]),el('div',{class:'dc-rest-chips'},drawn.length?drawn.slice().reverse().map(st=>el('span',{class:'dc-chip'+(latest.has(st.id)?' is-latest':''),text:formatStudent(st)})):[el('small',{class:'dc-note',text:'尚未抽取，抽出的同學會依序列在這裡。'})]));
    }
    function paintResults(result){
      refs.results.dataset.count=String(result?result.results.length:0);refs.results.replaceChildren();
      if(refs.workspace)refs.workspace.classList.toggle('is-solo',soloStyle()&&view!=='roster'&&!(result&&result.order));
      const mode=view==='roster'?'roster':result&&result.order?'order':'result';
      refs.side.dataset.view=mode;refs.rosterBtn.textContent=mode==='roster'?'↩ 返回抽籤結果':'👥 全員名單・權重';refs.rosterBtn.classList.toggle('dc-primary',mode==='roster');refs.rosterBtn.setAttribute('aria-pressed',String(mode==='roster'));
      paintRest(result);
      if(mode==='roster'){
        const pool=currentPool(),list=el('div',{class:'dc-roster-list'});
        function paintRoster(){const total=pool.reduce((sum,st)=>sum+(data.weights[st.id]||1),0);list.replaceChildren(...snapshot.students.slice().sort((a,b)=>a.no-b.no).filter(st=>!rosterQuery||formatStudent(st).includes(rosterQuery)).map(st=>{const eligible=pool.some(x=>x.id===st.id);return el('article',{class:'dc-roster-person'+(eligible?'':' is-excluded'),'data-roster-id':st.id,'data-weight-id':st.id},[el('strong',{text:formatStudent(st)}),el('small',{text:eligible&&total?'首抽 '+((data.weights[st.id]||1)/total*100).toFixed(1)+'%':(snapshot.absentIds||[]).includes(st.id)?'今日不參加':'本輪已抽'}),weightStepper(st)]);}));}
        const search=el('input',{class:'dc-input',type:'search',value:rosterQuery,placeholder:'搜尋座號或姓名','aria-label':'搜尋全員名單',oninput:e=>{rosterQuery=e.target.value;paintRoster();}});
        refs.results.append(el('div',{class:'dc-roster-head'},[el('h2',{text:'全員名單 '+snapshot.students.length+' 位・中籤權重'}),search,btn('權重全部恢復 1',()=>configure({resetWeights:true}),'',{'data-lock':'','data-weights-reset':''})]),el('p',{class:'dc-note',text:'權重 1～10，數字越大越容易抽到；灰色為今日不參加或本輪已抽。首抽機率依目前可抽名單重算。'}),list);paintRoster();return;
      }
      if(!result){refs.results.append(el('div',{class:'dc-result-placeholder'},[el('span',{text:running?'🎲':'🐾','aria-hidden':'true'}),el('h2',{text:running?'抽籤中…':'抽籤結果'}),el('p',{text:running?'結果將在這裡揭曉':'按「開始抽籤」，抽中的同學會顯示在這裡。'})]));return;}
      if(mode==='order'){
        const n=result.results.length,rows=Math.max(1,Math.ceil(n/2));
        refs.results.append(el('h2',{text:'本輪完整排序・共 '+n+' 位'}),adapter.performance&&adapter.perform?el('p',{class:'dc-perform-legend',text:'點圖示即加分：'+adapter.performance().map(p=>p.icon+' '+p.label.replace('回答','')+' +'+p.points).join('　')}):null,el('ol',{class:'dc-order-list','data-order-count':String(n),style:{'--rows':String(rows),'--order-size':(n<=12?20:n<=20?17:n<=28?15:13)+'px'}},result.results.map(item=>el('li',{class:'dc-order-item'+(item.group?' has-group':'')},[el('b',{text:item.rank}),el('span',{class:'dc-order-name',text:U.pad2(item.no)+' '+item.name}),item.group||item.task?el('small',{class:'dc-order-info',text:[item.group?'第 '+item.group+' 組':'',item.task||''].filter(Boolean).join('・')}):null,performBar(item)]))));requestAnimationFrame(markNarrow);
        return;
      }
      refs.results.append(el('h2',{text:'本次抽中 '+result.results.length+' 位'}));
      refs.results.append(el('div',{class:'dc-results-grid'},result.results.map(item=>el('article',{class:'dc-result-card'},[avatar(item),petMeta(item),el('span',{class:'dc-result-seat',text:U.pad2(item.no)+' 號'}),el('strong',{class:'dc-result-name',text:item.name}),item.task?el('span',{class:'dc-result-task',text:item.task}):null,item.group?el('small',{text:'第 '+item.group+' 組'}):null]))));
    }
    function history(){return el('details',{class:'dc-history'},[el('summary',{text:'本輪已抽與歷史紀錄（'+data.history.length+' 筆）'}),el('p',{class:'dc-note',text:'本輪已抽：'+(data.drawnIds.map(id=>snapshot.students.find(st=>st.id===id)).filter(Boolean).map(formatStudent).join('、')||'尚未抽取')}),...data.history.slice(0,20).map(batch=>el('div',{class:'dc-history-row'},[el('small',{text:'第 '+batch.round+' 輪 · '+new Date(batch.ts).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'})}),el('span',{text:batch.results.map(item=>U.pad2(item.no)+' '+item.name+(item.task?' → '+item.task:'')).join('、')})]))]);}
    function render(){
      if(disposed)return;
      rootEl.replaceChildren();rootEl.classList.toggle('is-projecting',projected);
      refs={};refs.stats=el('p',{class:'dc-stats'});refs.notice=el('p',{class:'dc-notice',role:'status',text:notice});
      const header=el('header',{class:'dc-header'},[el('div',{},[el('p',{class:'dc-eyebrow',text:snapshot.className||'CLASSROOM DRAW'}),el('h1',{text:'課堂抽籤中心'}),refs.stats]),el('div',{class:'dc-header-actions'},[
        btn(projected?'結束投影':'⛶ 大字投影',()=>toggleProject()),adapter.back?btn('返回',()=>{cancelPresentation();if(projected)toggleProject(false);adapter.back();}):null,clockStrip()
      ])]);rootEl.append(header);
      rootEl.append(el('div',{class:'dc-style-list','aria-label':'抽籤樣式'},THEMES.map(([id,image,label])=>btn(image+' '+label,()=>{if(running)return;configure({config:id==='devil'?{style:id,taskMode:'punishment'}:{style:id,taskMode:data.config.style==='devil'?'none':data.config.taskMode}});render();},'',{'data-style':id,'data-lock':'','aria-pressed':String(data.config.style===id)}))));
      const workspace=el('div',{class:'dc-workspace'}),drawPane=el('div',{class:'dc-draw-pane'});refs.workspace=workspace;rootEl.append(workspace);workspace.append(drawPane);
      refs.stage=el('div',{class:'dc-stage','aria-label':'抽籤動畫區'});drawPane.append(refs.stage);
      buildScene(null,currentPool(),false);
      refs.start=btn('開始抽籤',()=>start(false),'dc-primary',{'data-draw-start':''});refs.order=btn('🔢 抽出整輪排序',()=>start(true),'',{'data-lock':'','data-draw-order':''});refs.rosterBtn=btn('👥 全員名單・權重',()=>{if(running)return;view=view==='roster'?'result':'roster';paintResults(data.last);if(view==='roster')focusSide();},'',{'data-lock':'','data-roster-toggle':''});refs.reveal=btn('直接揭曉全部結果',()=>{if(revealNow)revealNow();},'');refs.reveal.hidden=true;
      const resetButton=btn('↻ 一鍵重置名單',async()=>{if(running)return;view='result';performed.clear();try{const next=await adapter.reset();if(next)update(next);notice='已開始新的一輪，原始學生名單完整保留。';render();}catch(error){setNotice(error.message);}},'',{'data-lock':'','data-reset-round':''});drawPane.append(el('div',{class:'dc-toolbar'},[refs.start,refs.reveal]),refs.notice);
      refs.results=el('div',{class:'dc-results','aria-live':'polite','aria-label':'本次抽籤結果'});refs.rest=el('div',{class:'dc-side-rest','aria-label':'本輪已抽進度'});refs.side=el('div',{class:'dc-side'},[el('div',{class:'dc-side-actions'},[refs.rosterBtn,refs.order,resetButton]),refs.results,refs.rest]);workspace.append(refs.side);attachSplitter(workspace);paintResults(running?null:data.last);
      const configCard=el('details',{class:'dc-settings-card',open:settingsOpen?'open':null},[el('summary',{text:'⚙️ 抽籤設定（人數、任務、音效與權重）'}),settings()]);configCard.addEventListener('toggle',()=>{settingsOpen=configCard.open;});rootEl.append(configCard);
      rootEl.append(history(),btn('退出全螢幕',()=>toggleProject(false),'dc-exit-projection'));refresh();paintClock();
    }
    function buildScene(result,pool,animate){
      const mode=data.config.style,first=result&&result.results[0],scene=el('div',{class:'dc-scene dc-scene--'+mode});refs.stage.replaceChildren(scene);
      const context={mode,scene,result,pool,first,tick:()=>{},finish:()=>{}};
      if(mode==='wheel'){
        const wheel=makeWheel(pool.map(st=>Object.assign({},st,{label:formatStudent(st)})),data.weights,'學生輪',data.config.wheelPalette,()=>start(false));scene.append(wheel.node);context.wheel=wheel;
      } else if(mode==='race'){
        const runners=pool.map((st,index)=>{const label=el('span',{class:'dc-runner-label',text:formatStudent(st)}),racer=el('span',{class:'dc-racer'},[avatar(st)]),effect=el('small',{class:'dc-race-effect'}),track=el('div',{class:'dc-track'},[racer,effect]);return{st,racer,effect,node:el('div',{class:'dc-lane'},[label,track]),seed:Math.random()*6};});scene.append(el('div',{class:'dc-race-tracks'},runners.map(r=>r.node)));
        context.tick=p=>runners.forEach(r=>{const rank=result?result.results.findIndex(x=>x.studentId===r.st.id):-1,finish=rank>=0?.6+.33*(rank+1)/result.results.length:1.5;let distance=rank>=0?Math.min(.97,p/finish):Math.min(.85,p*(.64+r.seed*.025));if(rank>=0&&p>=finish)distance=1;else distance=Math.max(0,distance+Math.sin(p*20+r.seed)*.025);r.racer.style.left='calc('+Math.min(100,distance*100)+'% - '+Math.min(26,distance*26)+'px)';r.effect.textContent=p>.15&&p<.9?(Math.sin(p*26+r.seed)>.85?'⚡ 加速':Math.sin(p*31+r.seed)<-.93?'💫 絆一下':''):'';r.node.classList.toggle('is-finished',distance===1);});
      } else if(mode==='bomb'){
        const art=svg('svg',{viewBox:'0 0 300 260',class:'dc-bomb-svg','aria-label':'燃燒引線炸彈'}),gradientId=U.uid('bomb');
        const defs=svg('defs'),gradient=svg('radialGradient',{id:gradientId,cx:'.3',cy:'.25',r:'.8'});gradient.append(svg('stop',{offset:'0%','stop-color':'#637782'}),svg('stop',{offset:'100%','stop-color':'#111d27'}));defs.append(gradient);
        const rope=svg('path',{d:'M150 88 C220 78 202 4 265 43',fill:'none',stroke:'#d9b178','stroke-width':10,'stroke-linecap':'round',class:'dc-bomb-rope'}),ember=svg('g',{class:'dc-bomb-ember'});ember.append(svg('circle',{r:10,fill:'#ff7a20'}),svg('circle',{r:5,fill:'#fff6ab'}),...Array.from({length:6},(_,i)=>svg('line',{x1:14*Math.cos(i*Math.PI/3),y1:14*Math.sin(i*Math.PI/3),x2:25*Math.cos(i*Math.PI/3),y2:25*Math.sin(i*Math.PI/3),stroke:i%2?'#ff7c20':'#ffdf55','stroke-width':3})));
        art.append(defs,rope,svg('rect',{x:130,y:78,width:40,height:22,rx:5,fill:'#5a6670'}),svg('circle',{cx:150,cy:170,r:76,fill:'url(#'+gradientId+')'}),svg('ellipse',{cx:124,cy:137,rx:23,ry:12,fill:'#c9d9df',opacity:'.28',transform:'rotate(-30 124 137)'}),ember);
        const shell=el('button',{class:'dc-bomb-prop dc-scene-trigger',type:'button','aria-label':'點炸彈開始抽籤','data-draw-trigger':'',onclick:()=>start(false)},[art,el('span',{class:'dc-bomb-burst',text:'💥','aria-hidden':'true'})]),name=el('strong',{class:'dc-jumping-name',text:'準備傳遞！'});scene.append(shell,name,el('small',{class:'dc-bomb-note',text:'引線燒完，揭曉回答同學'}));const length=rope.getTotalLength();rope.style.strokeDasharray=String(length);function burn(p){rope.style.strokeDashoffset=String(length*p);const point=rope.getPointAtLength(length*(1-p));ember.setAttribute('transform','translate('+point.x+' '+point.y+') rotate('+p*720+')');}burn(0);
        context.tick=p=>{burn(p);art.style.transform='rotate('+Math.sin(p*70)*3+'deg)';if(pool.length)name.textContent=formatStudent(pool[Math.floor(Math.random()*pool.length)]);scene.dataset.phase=p<.8?'burning':'last-spark';};context.finish=()=>{burn(1);name.textContent=first?formatStudent(first):'揭曉！';scene.classList.add('is-revealed');scene.dataset.phase='exploded';};
      } else if(mode==='slot'){
        const reels=Array.from({length:3},(_,i)=>el('button',{class:'dc-reel dc-scene-trigger',type:'button','aria-label':'點問號開始抽籤','data-draw-trigger':'',onclick:()=>start(false)},[el('span',{class:'dc-reel-value',text:'?'}),el('small',{class:'dc-reel-label',text:['座號','姓名','目前寵物'][i]})]));scene.append(el('div',{class:'dc-slot-title',text:'LUCKY CLASS'}),el('div',{class:'dc-reels'},reels));context.tick=p=>reels.forEach((reel,index)=>{reel.classList.add('is-spinning');if(pool.length)reel.firstChild.textContent=index===0?U.pad2(pool[Math.floor(Math.random()*pool.length)].no):index===2?'🐾':pool[Math.floor(Math.random()*pool.length)].name;reel.style.transform='translateY('+Math.sin(p*90+index)*3+'px)';});context.finish=()=>reels.forEach((reel,index)=>{reel.classList.remove('is-spinning');reel.style.transform='none';if(index===2&&first)reel.firstChild.replaceChildren(avatar(first));else reel.firstChild.textContent=first?(index===0?U.pad2(first.no)+' 號':first.name):'?';});
      } else if(mode==='gacha'){
        const balls=Array.from({length:14},(_,index)=>el('span',{class:'dc-capsule-ball',style:{'--ball-color':['#ffba53','#9c80d0','#69cfc1','#f38e8e','#73a7e5'][index%5],left:(8+(index*23)%74)+'%',top:(15+(index*31)%65)+'%'}}));
        const globe=el('div',{class:'dc-gacha-glass'},balls),handle=el('span',{class:'dc-gacha-crank'},[el('span',{class:'dc-gacha-grip'})]),chute=el('div',{class:'dc-gacha-chute'}),capsule=el('div',{class:'dc-gacha-capsule'},[el('span',{class:'dc-capsule-top'}),el('span',{class:'dc-capsule-bottom'}),el('span',{class:'dc-capsule-prize'},first?[avatar(first)]:[])]),machine=el('div',{class:'dc-gacha-machine'},[globe,el('div',{class:'dc-gacha-pedestal'},[el('span',{class:'dc-gacha-badge',text:'★'}),handle,chute]),el('div',{class:'dc-gacha-tray'}),capsule]);
        const caption=el('div',{class:'dc-gacha-caption'},[el('strong',{text:'轉動把手，抽出幸運扭蛋'}),el('small',{text:'攪拌 → 掉球 → 開球揭曉'})]);scene.append(machine,caption);scene.dataset.phase='ready';
        context.tick=p=>{const mixing=Math.min(1,p/.5),fall=Math.max(0,Math.min(1,(p-.45)/.25)),opening=Math.max(0,Math.min(1,(p-.76)/.2));handle.style.transform='rotate('+mixing*1080+'deg)';machine.style.transform=p<.5?'translateX('+Math.sin(p*100)*2+'px)':'none';balls.forEach((ball,i)=>{const angle=i*2.4+p*38,move=p<.5?1:Math.max(0,1-(p-.5)*5);ball.style.transform='translate('+Math.sin(angle)*24*move+'px,'+Math.cos(angle*.8)*18*move+'px) rotate('+p*1000+'deg)';});capsule.style.opacity=fall>0?'1':'0';capsule.style.setProperty('--drop',String(fall));capsule.style.setProperty('--open',String(opening));capsule.style.transform='translate(-50%,'+(fall*50)+'%) rotate('+(fall*720*(1-opening))+'deg)';capsule.classList.toggle('is-open',opening>0);scene.dataset.phase=p<.45?'mixing':p<.7?'dropping':p<.76?'bounce':p<.96?'opening':'revealed';};
        context.finish=()=>{capsule.classList.add('is-open');capsule.style.opacity='1';capsule.style.setProperty('--drop','1');capsule.style.setProperty('--open','1');capsule.style.transform='translate(-50%,50%)';machine.classList.add('is-revealed');caption.replaceChildren(el('strong',{text:first?U.pad2(first.no)+' 號 '+first.name:'揭曉！'}),el('small',{text:first&&first.task?first.task:'幸運扭蛋已開啟'}));scene.dataset.phase='revealed';};
      } else if(mode==='cards'){
        const chosen=[];if(result){const indices=pool.map((_,i)=>i);const click=Number.isInteger(contextCardIndex)?contextCardIndex%Math.max(1,pool.length):Math.floor(Math.random()*Math.max(1,pool.length));chosen.push(click);indices.splice(indices.indexOf(click),1);while(chosen.length<result.results.length&&indices.length)chosen.push(indices.splice(Math.floor(Math.random()*indices.length),1)[0]);}
        const cards=pool.map((st,index)=>{const position=chosen.indexOf(index),item=result&&position>=0?result.results[position]:null;return btn('',()=>{if(!running){contextCardIndex=index;start(false);}},'dc-flip-card',{'aria-label':'翻開第 '+(index+1)+' 張牌'});});cards.forEach((card,index)=>{const item=result&&chosen.includes(index)?result.results[chosen.indexOf(index)]:null;card.append(el('span',{class:'dc-card-back',text:'🐾'}),el('span',{class:'dc-card-front'},item?[avatar(item),el('span',{text:U.pad2(item.no)+' '+item.name})]:[el('span',{text:'?'})]));});scene.append(el('p',{class:'dc-note',text:animate?'翻開幸運卡牌…':'點一張牌，或按「隨機翻牌」；連抽會一起翻開多張。'}),el('div',{class:'dc-card-deck'},cards));context.tick=p=>cards.forEach((card,index)=>{if(chosen.includes(index))card.classList.toggle('is-flipped',p>(chosen.indexOf(index)+1)/(chosen.length+1)*.8);});
      } else if(mode==='devil'){
        const sticks=el('div',{class:'dc-devil-sticks'},Array.from({length:9},(_,i)=>el('i',{style:{'--stick-angle':(i-4)*8+'deg','--stick-order':i}}))),tube=el('button',{class:'dc-devil-tube dc-scene-trigger',type:'button','data-draw-trigger':'','aria-label':'抽魔鬼籤',onclick:()=>start(false)},[sticks,el('span',{class:'dc-devil-face',text:'👹'}),el('strong',{text:'魔鬼籤'})]),ticket=el('div',{class:'dc-devil-ticket'},[el('small',{text:'魔鬼籤揭曉'}),el('strong',{class:'dc-devil-who',text:first?U.pad2(first.no)+' 號 '+first.name:'?'}),el('span',{class:'dc-devil-task',text:first?first.task:'搖一搖，抽出處罰項目'})]);scene.append(tube,ticket,el('p',{class:'dc-devil-hint',text:'抽中同學，同時配對一項處罰'}));scene.dataset.phase='ready';context.tick=p=>{tube.style.transform=p<.6?'rotate('+Math.sin(p*85)*6+'deg)':'none';ticket.style.setProperty('--reveal',String(Math.max(0,(p-.6)/.4)));scene.dataset.phase=p<.6?'shaking':'drawing';};context.finish=()=>{ticket.style.setProperty('--reveal','1');scene.classList.add('is-revealed');scene.dataset.phase='revealed';};
      } else if(mode==='scratch'){
        if(!result){scene.append(el('button',{class:'dc-scratch-placeholder dc-scene-trigger',type:'button','data-draw-trigger':'','aria-label':'抽出刮刮卡',onclick:()=>start(false)},[scratchWatermarks(0),el('div',{class:'dc-scratch-intro'},[el('strong',{text:'寵物幸運刮刮卡'}),el('small',{text:'點一下抽卡，再刮開揭曉'})])]));}
        else setupScratch(scene,result);
      }
      const taskEntries=E.tasks(data.config);
      if(taskEntries.length&&mode!=='devil'){const taskWheel=makeWheel(taskEntries.map((label,index)=>({id:String(index),label})),null,'任務輪',data.config.wheelPalette);refs.stage.classList.add('has-task-wheel');refs.stage.append(taskWheel.node);context.taskWheel=taskWheel;}else refs.stage.classList.remove('has-task-wheel');
      return context;
    }
    let contextCardIndex=null;
    function scratchWatermarks(offset){const list=snapshot.students.slice(0,12);return el('div',{class:'dc-scratch-watermarks','aria-hidden':'true'},list.slice(0,8).map((st,i)=>avatar({studentId:list[(i+(offset||0))%list.length].id})));}
    function setupScratch(scene,result){
      const cards=el('div',{class:'dc-scratch-grid'}),canvases=[],revealed=new Set();scene.append(cards);
      result.results.forEach((item,index)=>{
        const canvas=el('canvas',{'aria-label':'刮開第 '+(index+1)+' 位學生',tabindex:0}),card=el('div',{class:'dc-scratch-card'},[el('div',{class:'dc-scratch-answer','aria-hidden':'true'},[avatar(item),el('span',{class:'dc-scratch-seat',text:U.pad2(item.no)+' 號'}),el('strong',{class:'dc-scratch-name',text:item.name}),el('small',{text:item.task||'幸運同學'})]),canvas,scratchWatermarks(index)]);cards.append(card);canvases.push(canvas);
        requestAnimationFrame(()=>{
          const rect=card.getBoundingClientRect(),ratio=Math.min(2,root.devicePixelRatio||1);canvas.width=Math.max(1,Math.round(rect.width*ratio));canvas.height=Math.max(1,Math.round(rect.height*ratio));const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);ctx.fillStyle='#aab8b8';ctx.fillRect(0,0,rect.width,rect.height);ctx.strokeStyle='#e4eded';ctx.lineWidth=8;for(let x=-rect.height;x<rect.width;x+=30){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+rect.height,rect.height);ctx.stroke();}ctx.fillStyle='#244f50';ctx.font='bold 22px sans-serif';ctx.textAlign='center';ctx.fillText('刮開揭曉',rect.width/2,rect.height/2+8);
          let drawing=false,last=null,lastCheck=0;
          function reveal(){if(revealed.has(index))return;revealed.add(index);card.classList.add('is-revealed');card.querySelector('.dc-scratch-answer').setAttribute('aria-hidden','false');ctx.clearRect(0,0,rect.width,rect.height);canvas.style.pointerEvents='none';if(revealed.size===result.results.length)finishResult(result);}
          canvas.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();reveal();}});
          function scratch(event){const r=canvas.getBoundingClientRect(),point={x:(event.clientX-r.left)/r.width*rect.width,y:(event.clientY-r.top)/r.height*rect.height};ctx.globalCompositeOperation='destination-out';ctx.lineWidth=48;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(last?last.x:point.x,last?last.y:point.y);ctx.lineTo(point.x,point.y);ctx.stroke();last=point;if(Date.now()-lastCheck>150){lastCheck=Date.now();const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;let empty=0,total=0;for(let n=3;n<pixels.length;n+=4*64){total++;if(pixels[n]<32)empty++;}if(empty/total>.45)reveal();}}
          canvas.addEventListener('pointerdown',event=>{drawing=true;last=null;canvas.setPointerCapture(event.pointerId);scratch(event);event.preventDefault();});canvas.addEventListener('pointermove',event=>{if(drawing)scratch(event);});canvas.addEventListener('pointerup',()=>{drawing=false;last=null;});canvas.addEventListener('pointercancel',()=>{drawing=false;last=null;});
        });
      });
      revealNow=()=>{canvases.forEach(canvas=>{canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);canvas.style.pointerEvents='none';canvas.closest('.dc-scratch-card').classList.add('is-revealed');canvas.closest('.dc-scratch-card').querySelector('.dc-scratch-answer').setAttribute('aria-hidden','false');});finishResult(result);};
    }
    function finishResult(result){
      if(!running||disposed)return;running=false;revealNow=null;if(data.config.autoTimer){clock.configure({mode:data.config.timerMode,seconds:data.config.timerSeconds});clock.start();}audio.finish(data.config);paintResults(result);const oldHistory=rootEl.querySelector('.dc-history');if(oldHistory)oldHistory.replaceWith(history());refresh();
      if(result.order)setNotice('已排出整輪 '+result.results.length+' 位同學的順序；按「一鍵重置名單」可開始新的一輪。');else if(result.results.length<result.requested)setNotice('本輪只剩 '+result.results.length+' 位，已全部抽出；按重置可開始新一輪。');else setNotice('已抽出 '+result.results.length+' 位，本輪紀錄已保存。');
      if(soloRun&&!result.order&&result.results.length===1){soloRun=false;celebrate(result.results[0]);}else soloRun=false;
    }
    function removeWinner(){clearTimeout(winnerTimer);winnerTimer=null;rootEl.querySelectorAll('.dc-winner').forEach(node=>node.remove());}
    /* 抽中後先大大顯示中籤同學，接著（網頁版）自動跳出學生個人畫面。全螢幕時彈窗會被擋住，所以先退出全螢幕。 */
    function celebrate(item){
      removeWinner();const auto=!!(adapter.select&&adapter.autoSelect);
      const open=async()=>{removeWinner();if(projected){toggleProject(false);await new Promise(done=>setTimeout(done,260));}if(disposed||!adapter.select)return;try{await adapter.select([item.studentId]);}catch(error){setNotice(error.message);}};
      const box=el('div',{class:'dc-winner',role:'dialog','aria-label':'抽中學生','data-winner':item.studentId},[el('div',{class:'dc-winner-card'},[el('p',{class:'dc-winner-kicker',text:'🎉 抽中了！'}),avatar(item),el('span',{class:'dc-winner-seat',text:U.pad2(item.no)+' 號'}),el('strong',{class:'dc-winner-name',text:item.name}),item.task?el('span',{class:'dc-winner-task',text:item.task}):null,auto?el('small',{class:'dc-winner-hint',text:'即將開啟學生個人畫面…'}):null,el('div',{class:'dc-winner-actions'},[adapter.select?btn(auto?'立即開啟學生畫面':'為他加分',open,'dc-primary',{'data-winner-open':''}):null,btn('關閉',removeWinner,'',{'data-winner-close':''})])])]);
      rootEl.append(box);if(auto)winnerTimer=setTimeout(open,2200);
    }

    async function start(order){
      if(running||disposed)return;const pool=currentPool();if(!pool.length)return;running=true;view='result';removeWinner();soloRun=!order&&soloStyle();if(soloRun&&!projected)toggleProject(true);if(order)performed.clear();if(data.config.autoTimer)clock.pause();setNotice('正在抽取…');audio.unlock(data.config);refresh();const token=++presentation;
      try{
        const result=await adapter.draw({order:!!order});if(disposed||token!==presentation)return;
        if(order){buildScene(null,pool,false);finishResult(result);focusSide();return;}
        const cfg=data.config,reduce=root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const duration=reduce?350:cfg.duration*1000*(cfg.style==='bomb'?.7+Math.random()*.7:1);
        const scene=buildScene(result,pool,true);paintResults(null);refresh();
        if(scene.wheel){const index=pool.findIndex(st=>st.id===result.results[0].studentId);scene.wheel.spin(index,duration);}
        if(scene.taskWheel){const choices=E.tasks(cfg),index=choices.indexOf(result.results[0].task);scene.taskWheel.spin(index,duration);}
        if(cfg.style==='scratch'){setNotice('用手指或滑鼠刮開卡片；也可以按「直接揭曉全部結果」。');refresh();return;}
        audio.start(cfg,cfg.style,duration);const began=performance.now();let previous=0;
        const animate=now=>{if(disposed||token!==presentation)return;const progress=Math.min(1,(now-began)/duration);if(now-previous>45){scene.tick(progress);previous=now;}if(progress<1)frame=requestAnimationFrame(animate);else{scene.tick(1);scene.finish();contextCardIndex=null;finishResult(result);}};frame=requestAnimationFrame(animate);
      }catch(error){running=false;revealNow=null;audio.stop();setNotice(error.message);refresh();}
    }
    function cancelPresentation(){removeWinner();soloRun=false;presentation++;if(frame)cancelAnimationFrame(frame);frame=null;audio.stop();running=false;revealNow=null;}
    function toggleProject(force){projected=typeof force==='boolean'?force:!projected;rootEl.classList.toggle('is-projecting',projected);const button=rootEl.querySelector('.dc-header-actions button');if(button)button.textContent=projected?'結束投影':'⛶ 大字投影';if(projected&&rootEl.requestFullscreen){rootEl.requestFullscreen().catch(()=>{});}else if(!projected&&document.fullscreenElement===rootEl)document.exitFullscreen().catch(()=>{});}
    function update(next){if(!next||disposed)return;const rosterChanged=JSON.stringify([snapshot.students.map(st=>[st.id,st.no,st.name]),snapshot.absentIds])!==JSON.stringify([next.students.map(st=>[st.id,st.no,st.name]),next.absentIds]);const old=data,last=data.last&&data.last.id;snapshot=next;data=E.normalize(next.draw);if(!running&&(rosterChanged||last!==(data.last&&data.last.id)||old.round!==data.round||old.config.style!==data.config.style))render();else {refresh();if(!running&&data.last&&view!=='roster')paintResults(data.last);}}
    function escape(event){if(event.key==='Escape'&&projected){toggleProject(false);return;}if(event.key==='Escape'&&view==='roster'){view='result';paintResults(data.last);}}
    document.addEventListener('keydown',escape);render();
    return{element:rootEl,update,get running(){return running;},destroy(){disposed=true;clearTimeout(winnerTimer);if(splitObserver)splitObserver.disconnect();clearTimeout(flashTimer);unsubscribeClock();cancelPresentation();document.removeEventListener('keydown',escape);if(projected&&document.fullscreenElement===rootEl)document.exitFullscreen().catch(()=>{});rootEl.remove();}};
  }
  root.PetDrawCenter={create};
})(window);
