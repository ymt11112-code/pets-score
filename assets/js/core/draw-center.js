/* 共用課堂抽籤中心：動畫只呈現引擎已抽出的結果，不另改中籤人。 */
(function(root){
  'use strict';
  const E=root.PetDrawEngine,U=root.PetUtil,el=U.el;
  const THEMES=[['wheel','🎡','幸運轉盤'],['race','🏁','賽跑大賽'],['bomb','💣','炸彈傳遞'],['slot','🎰','拉霸機'],['gacha','🟣','盲盒扭蛋'],['cards','🃏','塔羅翻牌'],['scratch','🎟️','刮刮樂']];
  const svg=(tag,attrs,text)=>{const node=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs||{}).forEach(([key,value])=>node.setAttribute(key,value));if(text!=null)node.textContent=text;return node;};
  function sounds(){
    let ctx=null,handles=[];
    function tone(frequency,time,length,volume,type){if(!ctx)return;const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=type||'sine';osc.frequency.value=frequency;gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),time+.008);gain.gain.exponentialRampToValueAtTime(.0001,time+length);osc.connect(gain);gain.connect(ctx.destination);osc.start(time);osc.stop(time+length+.02);}
    function noise(time,length,volume){if(!ctx)return;const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*length),ctx.sampleRate),samples=buffer.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*Math.exp(-i/samples.length*5);const source=ctx.createBufferSource(),gain=ctx.createGain(),filter=ctx.createBiquadFilter();filter.type='highpass';filter.frequency.value=800;source.buffer=buffer;gain.gain.value=volume;source.connect(filter);filter.connect(gain);gain.connect(ctx.destination);source.start(time);}
    return{unlock(config){if(!config.sound||!config.volume)return;try{ctx=ctx||new(root.AudioContext||root.webkitAudioContext)();if(ctx.state==='suspended')ctx.resume().catch(()=>{});}catch(e){}},start(config,style,duration){this.stop();if(!ctx||!config.sound)return;const vol=config.volume/100*.13;if(style==='slot')tone(1400,ctx.currentTime,.15,vol);const count=Math.min(45,Math.ceil(duration/110));for(let i=0;i<count;i++){const delay=i*(duration/count);handles.push(setTimeout(()=>{if(!ctx)return;const now=ctx.currentTime;if(i%2===0)tone(style==='bomb'?450:150,now,.055,vol*.55,'triangle');noise(now,.045,vol*.22);},delay));}},finish(config){this.stop();if(!ctx||!config.sound)return;const vol=config.volume/100*.14;[523,659,784,1046].forEach((f,i)=>tone(f,ctx.currentTime+i*.08,.38,vol));noise(ctx.currentTime+.14,.7,vol*.2);},stop(){handles.forEach(clearTimeout);handles=[];}};
  }
  function makeWheel(entries,weights,label){
    const holder=el('div',{class:'dc-wheel-wrap','aria-label':label}),art=svg('svg',{viewBox:'0 0 400 400',class:'dc-wheel'});let cursor=0;
    const total=entries.reduce((sum,item)=>sum+Math.max(1,Number(weights&&weights[item.id])||1),0)||1;
    const colors=['#15584c','#e8bb4d','#cde8db','#507d8a','#f4dca0','#8f73b3'];const sectors=[];
    entries.forEach((item,index)=>{
      const size=Math.max(1,Number(weights&&weights[item.id])||1)/total*360,start=cursor,end=cursor+size,center=(start+end)/2;sectors.push(center);cursor=end;
      const point=degrees=>[200+190*Math.cos((degrees-90)*Math.PI/180),200+190*Math.sin((degrees-90)*Math.PI/180)];
      if(entries.length===1)art.append(svg('circle',{cx:200,cy:200,r:190,fill:colors[0]}));else{const a=point(start),b=point(end);art.append(svg('path',{d:'M200 200 L'+a.join(' ')+' A190 190 0 '+(size>180?1:0)+' 1 '+b.join(' ')+' Z',fill:colors[index%colors.length],stroke:'#fff','stroke-width':1}));}
      const color=index%colors.length===0||index%colors.length===3||index%colors.length===5?'#fff':'#143e35';
      const text=svg('text',{x:385,y:205,transform:'rotate('+(center-90)+' 200 200)','text-anchor':'end',fill:color,'font-size':entries.length>32?10:entries.length>18?12:16,'font-weight':700},String(item.label||item.name||'').slice(0,11));art.append(text);
    });
    art.append(svg('circle',{cx:200,cy:200,r:35,fill:'#fff'}),svg('text',{x:200,y:207,'text-anchor':'middle','font-size':20,'font-weight':900,fill:'#15584c'},'GO'));
    holder.append(el('span',{class:'dc-pointer','aria-hidden':'true'}),art,el('small',{text:label}));
    return{node:holder,art,sectors,spin(index,duration){art.style.transition='none';art.style.transform='rotate(0deg)';requestAnimationFrame(()=>requestAnimationFrame(()=>{art.style.transition='transform '+duration+'ms cubic-bezier(.12,.65,.1,1)';art.style.transform='rotate('+(1800-(sectors[Math.max(0,index)]||0))+'deg)';}));}};
  }
  function create(adapter){
    let snapshot=adapter.getSnapshot(),data=E.normalize(snapshot.draw),running=false,projected=false,disposed=false,frame=null,presentation=0,revealNow=null;
    const audio=sounds();const rootEl=el('section',{class:'draw-center'});let refs={},notice='',weightSearch='',settingsOpen=false;
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
      if(refs.notice)refs.notice.textContent=notice;
    }
    async function configure(patch){
      if(patch.config)Object.assign(data.config,patch.config);if(patch.weights)Object.assign(data.weights,patch.weights);if(patch.resetWeights)data.weights={};refresh();
      try{const next=await adapter.configure(patch);if(next)update(next);}catch(error){setNotice(error.message);}
    }
    function control(config,key,type,extra){return el('input',Object.assign({type:type||'number',value:config[key], 'data-lock':'','data-config':key,onchange:event=>configure({config:{[key]:type==='checkbox'?event.target.checked:event.target.value}})},type==='checkbox'?{checked:config[key]?'checked':null}:{},extra||{}));}
    function settings(){
      const cfg=data.config;
      const count=el('select',{'aria-label':'一次抽幾位','data-lock':'','data-config':'count',onchange:e=>configure({config:{count:Number(e.target.value)}})},[1,2,3,4,5].map(n=>el('option',{value:n,text:n+' 位',selected:cfg.count===n?'selected':null})));
      const mode=el('select',{'aria-label':'綁定抽籤任務','data-lock':'','data-config':'taskMode',onchange:e=>{configure({config:{taskMode:e.target.value}});render();}},[['none','只抽學生'],['questions','學生＋題號'],['reward','學生＋獎勵／懲罰'],['chores','學生＋掃除工作'],['custom','學生＋自訂任務']].map(([value,text])=>el('option',{value,text,selected:cfg.taskMode===value?'selected':null})));
      const duration=el('select',{'aria-label':'動畫長度','data-lock':'','data-config':'duration',onchange:e=>configure({config:{duration:Number(e.target.value)}})},[2,4,6,8].map(n=>el('option',{value:n,text:n+' 秒',selected:cfg.duration===n?'selected':null})));
      const group=el('select',{'aria-label':'排序分組數','data-lock':'','data-config':'groupCount',onchange:e=>configure({config:{groupCount:Number(e.target.value)}})},[0,2,3,4,5,6,8,10].map(n=>el('option',{value:n,text:n?n+' 組，依序輪流分組':'只排名，不分組',selected:cfg.groupCount===n?'selected':null})));
      const extras=[];
      if(cfg.taskMode==='questions')extras.push(el('div',{class:'dc-settings-row'},[field('題號從',control(cfg,'questionFrom','number',{min:1,max:999})),field('到',control(cfg,'questionTo','number',{min:1,max:999}))]));
      if(['reward','chores','custom'].includes(cfg.taskMode)){const key=cfg.taskMode==='reward'?'taskText':cfg.taskMode==='chores'?'choreText':'customText';extras.push(field('每行一項，抽出後與學生配對',el('textarea',{'data-lock':'','data-config':key,rows:4,text:cfg[key],onchange:e=>configure({config:{[key]:e.target.value}})})));}
      if(cfg.taskMode!=='none')extras.push(el('p',{class:'dc-note',text:'任務以文字顯示，這次連抽盡量不重複任務；加扣分請在結果出來後確認。'}));
      return el('div',{class:'dc-settings'},[
        el('div',{class:'dc-settings-row'},[field('一次抽取',count),field('任務綁定',mode),field('動畫長度',duration)]),
        el('div',{class:'dc-settings-row'},[
          el('label',{class:'dc-check'},[control(cfg,'excludeDrawn','checkbox'),'已抽中的學生本輪排除']),
          el('label',{class:'dc-check'},[control(cfg,'sound','checkbox'),'鼓聲與歡呼音效']),
          field('音量',control(cfg,'volume','range',{min:0,max:100,'aria-label':'音效音量'}))
        ]),...extras,
        el('details',{},[el('summary',{text:'排名／分組與手動權重'}),field('抽完整輪時',group),weightPanel()])
      ]);
    }
    function weightPanel(){
      const search=el('input',{type:'search',placeholder:'搜尋座號或姓名','aria-label':'搜尋學生權重',value:weightSearch,oninput:e=>{weightSearch=e.target.value;paintWeightRows();}});
      refs.weights=el('div',{class:'dc-weight-list'});
      function paintWeightRows(){const pool=currentPool(),total=pool.reduce((sum,st)=>sum+(data.weights[st.id]||1),0);refs.weights.replaceChildren(...snapshot.students.filter(st=>!weightSearch||formatStudent(st).includes(weightSearch)).slice().sort((a,b)=>a.no-b.no).map(st=>el('label',{class:'dc-weight-row','data-weight-id':st.id},[
        el('span',{text:formatStudent(st)}),el('input',{type:'number',min:1,max:10,step:1,value:data.weights[st.id]||1,'aria-label':st.name+'中籤權重','data-lock':'',onchange:e=>{const value=Math.max(1,Math.min(10,Math.round(Number(e.target.value)||1)));e.target.value=value;configure({weights:{[st.id]:value}});}}),el('small',{text:pool.some(x=>x.id===st.id)&&total?'首抽 '+((data.weights[st.id]||1)/total*100).toFixed(1)+'%':'本輪不參加'})
      ])));}
      paintWeightRows();return el('div',{class:'dc-weights'},[el('p',{class:'dc-note',text:'權重 1～10：數字越大越容易抽到。首抽機率會依目前可抽名單重算，不代表多人連抽的總中籤率。'}),search,refs.weights,btn('所有權重恢復 1',()=>configure({resetWeights:true}),'',{'data-lock':''})]);
    }
    function avatar(result){if(adapter.avatar)return adapter.avatar(result.studentId||result.id);return el('span',{class:'dc-avatar',text:result.emoji||'🐾'});}
    function paintResults(result){
      refs.results.dataset.count=String(result?result.results.length:0);refs.results.replaceChildren();if(!result){refs.results.append(el('div',{class:'dc-result-placeholder'},[el('span',{text:running?'🎲':'🐾','aria-hidden':'true'}),el('h2',{text:running?'抽籤中…':'抽籤結果'}),el('p',{text:running?'結果將在這裡揭曉':'按「開始抽籤」，抽中的同學會顯示在這裡。'})]));return;}
      refs.results.append(el('h2',{text:result.order?'本次排序／分組結果':'本次抽中 '+result.results.length+' 位'}));
      if(result.results.length>5){const table=el('table',{class:'dc-order-table'},[el('thead',{},[el('tr',{},['名次','學生','任務','組別'].map(text=>el('th',{text})))]),el('tbody',{},result.results.map(item=>el('tr',{},[el('td',{text:item.rank}),el('td',{text:U.pad2(item.no)+' '+item.name}),el('td',{text:item.task||'—'}),el('td',{text:item.group?'第 '+item.group+' 組':'—'})])))]);refs.results.append(el('div',{class:'dc-order-scroll'},[table]));}
      else refs.results.append(el('div',{class:'dc-results-grid'},result.results.map(item=>el('article',{class:'dc-result-card'},[avatar(item),el('span',{class:'dc-result-seat',text:U.pad2(item.no)+' 號'}),el('strong',{class:'dc-result-name',text:item.name}),item.task?el('span',{class:'dc-result-task',text:item.task}):null,item.group?el('small',{text:'第 '+item.group+' 組'}):null]))));
      refs.results.append(btn('為抽中學生加點',async()=>{try{const ids=result.results.filter(item=>!(snapshot.absentIds||[]).includes(item.studentId)&&snapshot.students.some(st=>st.id===item.studentId)).map(item=>item.studentId);if(!ids.length)return setNotice('這些學生目前不在可加點名單，請檢查出席。');await adapter.select(ids);}catch(error){setNotice(error.message);}},'dc-primary'));
    }
    function history(){return el('details',{class:'dc-history'},[el('summary',{text:'本輪已抽與歷史紀錄（'+data.history.length+' 筆）'}),el('p',{class:'dc-note',text:'本輪已抽：'+(data.drawnIds.map(id=>snapshot.students.find(st=>st.id===id)).filter(Boolean).map(formatStudent).join('、')||'尚未抽取')}),...data.history.slice(0,20).map(batch=>el('div',{class:'dc-history-row'},[el('small',{text:'第 '+batch.round+' 輪 · '+new Date(batch.ts).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'})}),el('span',{text:batch.results.map(item=>U.pad2(item.no)+' '+item.name+(item.task?' → '+item.task:'')).join('、')})]))]);}
    function render(){
      if(disposed)return;
      rootEl.replaceChildren();rootEl.classList.toggle('is-projecting',projected);
      refs={};refs.stats=el('p',{class:'dc-stats'});refs.notice=el('p',{class:'dc-notice',role:'status',text:notice});
      const header=el('header',{class:'dc-header'},[el('div',{},[el('p',{class:'dc-eyebrow',text:snapshot.className||'CLASSROOM DRAW'}),el('h1',{text:'課堂抽籤中心'}),refs.stats]),el('div',{class:'dc-header-actions'},[
        btn(projected?'結束投影':'⛶ 大字投影',()=>toggleProject()),adapter.back?btn('返回',()=>{cancelPresentation();if(projected)toggleProject(false);adapter.back();}):null
      ])]);rootEl.append(header);
      rootEl.append(el('div',{class:'dc-style-list','aria-label':'抽籤樣式'},THEMES.map(([id,image,label])=>btn(image+' '+label,()=>{if(running)return;configure({config:{style:id}});render();},'',{'data-style':id,'data-lock':'','aria-pressed':String(data.config.style===id)}))));
      const workspace=el('div',{class:'dc-workspace'}),drawPane=el('div',{class:'dc-draw-pane'});rootEl.append(workspace);workspace.append(drawPane);
      refs.stage=el('div',{class:'dc-stage','aria-label':'抽籤動畫區'});drawPane.append(refs.stage);
      buildScene(null,currentPool(),false);
      refs.start=btn('開始抽籤',()=>start(false),'dc-primary',{'data-draw-start':''});refs.order=btn('抽出整輪排序',()=>start(true),'',{'data-lock':'','data-draw-order':''});refs.reveal=btn('直接揭曉全部結果',()=>{if(revealNow)revealNow();},'');refs.reveal.hidden=true;
      drawPane.append(el('div',{class:'dc-toolbar'},[refs.start,refs.order,btn('↻ 一鍵重置名單',async()=>{if(running)return;try{const next=await adapter.reset();if(next)update(next);notice='已開始新的一輪，原始學生名單完整保留。';render();}catch(error){setNotice(error.message);}},'',{'data-lock':'','data-reset-round':''}),refs.reveal]),refs.notice);
      refs.results=el('div',{class:'dc-results','aria-live':'polite','aria-label':'本次抽籤結果'});workspace.append(refs.results);paintResults(running?null:data.last);
      const configCard=el('details',{class:'dc-settings-card',open:settingsOpen?'open':null},[el('summary',{text:'⚙️ 抽籤設定（人數、任務、音效與權重）'}),settings()]);configCard.addEventListener('toggle',()=>{settingsOpen=configCard.open;});rootEl.append(configCard);
      rootEl.append(history());refresh();
    }
    function buildScene(result,pool,animate){
      const mode=data.config.style,first=result&&result.results[0],scene=el('div',{class:'dc-scene dc-scene--'+mode});refs.stage.replaceChildren(scene);
      const context={mode,scene,result,pool,first,tick:()=>{},finish:()=>{}};
      if(mode==='wheel'){
        const wheel=makeWheel(pool.map(st=>Object.assign({},st,{label:formatStudent(st)})),data.weights,'學生輪');scene.append(wheel.node);context.wheel=wheel;
      } else if(mode==='race'){
        const runners=pool.map((st,index)=>{const label=el('span',{class:'dc-runner-label',text:formatStudent(st)}),racer=el('span',{class:'dc-racer'},[avatar(st)]),effect=el('small',{class:'dc-race-effect'}),track=el('div',{class:'dc-track'},[racer,effect]);return{st,racer,effect,node:el('div',{class:'dc-lane'},[label,track]),seed:Math.random()*6};});scene.append(el('div',{class:'dc-race-tracks'},runners.map(r=>r.node)));
        context.tick=p=>runners.forEach(r=>{const rank=result?result.results.findIndex(x=>x.studentId===r.st.id):-1,finish=rank>=0?.6+.33*(rank+1)/result.results.length:1.5;let distance=rank>=0?Math.min(.97,p/finish):Math.min(.85,p*(.64+r.seed*.025));if(rank>=0&&p>=finish)distance=1;else distance=Math.max(0,distance+Math.sin(p*20+r.seed)*.025);r.racer.style.left='calc('+Math.min(100,distance*100)+'% - '+Math.min(26,distance*26)+'px)';r.effect.textContent=p>.15&&p<.9?(Math.sin(p*26+r.seed)>.85?'⚡ 加速':Math.sin(p*31+r.seed)<-.93?'💫 絆一下':''):'';r.node.classList.toggle('is-finished',distance===1);});
      } else if(mode==='bomb'){
        const bomb=el('div',{class:'dc-bomb',text:'💣'}),fuse=el('div',{class:'dc-fuse'}),name=el('strong',{class:'dc-jumping-name',text:'準備傳遞！'});scene.append(bomb,el('div',{class:'dc-fuse-track'},[fuse]),name,el('small',{text:'不定時引爆 · 由最後停留的同學回答'}));context.tick=p=>{fuse.style.width=(1-p)*100+'%';bomb.style.transform='rotate('+Math.sin(p*80)*5+'deg) scale('+(1+p*.2)+')';if(pool.length)name.textContent=formatStudent(pool[Math.floor(Math.random()*pool.length)]);};context.finish=()=>{bomb.textContent='💥';name.textContent=first?formatStudent({no:first.no,name:first.name}):'揭曉！';scene.classList.add('is-revealed');};
      } else if(mode==='slot'){
        const reels=Array.from({length:3},()=>el('div',{class:'dc-reel'},[el('span',{text:'?'})]));scene.append(el('div',{class:'dc-slot-title',text:'LUCKY CLASS'}),el('div',{class:'dc-reels'},reels));context.tick=p=>reels.forEach((reel,index)=>{reel.classList.add('is-spinning');if(pool.length)reel.firstChild.textContent=index===0?U.pad2(pool[Math.floor(Math.random()*pool.length)].no):index===2?'⭐':pool[Math.floor(Math.random()*pool.length)].name;reel.style.transform='translateY('+Math.sin(p*90+index)*3+'px)';});context.finish=()=>reels.forEach((reel,index)=>{reel.classList.remove('is-spinning');reel.style.transform='none';if(index===2&&first)reel.firstChild.replaceChildren(avatar(first));else reel.firstChild.textContent=first?(index===0?U.pad2(first.no):first.name):'?';});
      } else if(mode==='gacha'){
        const globe=el('div',{class:'dc-gacha-globe'},Array.from({length:10},(_,index)=>el('span',{class:'dc-capsule-ball',style:{'--ball-color':['#ffba53','#9c80d0','#69cfc1','#f38e8e'][index%4],left:(8+(index*27)%76)+'%',top:(10+(index*23)%62)+'%'}}))),body=el('div',{class:'dc-gacha-body'},[el('span',{class:'dc-gacha-handle',text:'✦'}),el('span',{class:'dc-gacha-mouth'})]),egg=el('div',{class:'dc-gacha-egg',text:'🟣'}),name=el('strong',{class:'dc-gacha-name',text:'轉出一位幸運同學'});scene.append(globe,body,egg,name);context.tick=p=>{globe.style.transform='translateX('+Math.sin(p*70)*3+'px)';body.querySelector('.dc-gacha-handle').style.transform='rotate('+p*1080+'deg)';egg.classList.toggle('is-dropped',p>.6);};context.finish=()=>{egg.replaceChildren(first?avatar(first):el('span',{text:'🐾'}));egg.classList.add('is-open');name.textContent=first?first.name:'揭曉！';};
      } else if(mode==='cards'){
        const chosen=[];if(result){const indices=pool.map((_,i)=>i);const click=Number.isInteger(contextCardIndex)?contextCardIndex%Math.max(1,pool.length):Math.floor(Math.random()*Math.max(1,pool.length));chosen.push(click);indices.splice(indices.indexOf(click),1);while(chosen.length<result.results.length&&indices.length)chosen.push(indices.splice(Math.floor(Math.random()*indices.length),1)[0]);}
        const cards=pool.map((st,index)=>{const position=chosen.indexOf(index),item=result&&position>=0?result.results[position]:null;return btn('',()=>{if(!running){contextCardIndex=index;start(false);}},'dc-flip-card',{'aria-label':'翻開第 '+(index+1)+' 張牌'});});cards.forEach((card,index)=>{const item=result&&chosen.includes(index)?result.results[chosen.indexOf(index)]:null;card.append(el('span',{class:'dc-card-back',text:'🐾'}),el('span',{class:'dc-card-front'},item?[avatar(item),el('span',{text:U.pad2(item.no)+' '+item.name})]:[el('span',{text:'?'})]));});scene.append(el('p',{class:'dc-note',text:animate?'翻開幸運卡牌…':'點一張牌，或按「隨機翻牌」；連抽會一起翻開多張。'}),el('div',{class:'dc-card-deck'},cards));context.tick=p=>cards.forEach((card,index)=>{if(chosen.includes(index))card.classList.toggle('is-flipped',p>(chosen.indexOf(index)+1)/(chosen.length+1)*.8);});
      } else if(mode==='scratch'){
        if(!result){scene.append(el('div',{class:'dc-scratch-placeholder'},[el('span',{text:'✦'}),el('strong',{text:'抽出一張幸運刮刮卡'}),el('small',{text:'用手指／滑鼠刮開，也可直接揭曉'})]));}
        else setupScratch(scene,result);
      }
      const taskEntries=E.tasks(data.config);
      if(taskEntries.length){const taskWheel=makeWheel(taskEntries.map((label,index)=>({id:String(index),label})),null,'任務輪');refs.stage.classList.add('has-task-wheel');refs.stage.append(taskWheel.node);context.taskWheel=taskWheel;}else refs.stage.classList.remove('has-task-wheel');
      return context;
    }
    let contextCardIndex=null;
    function setupScratch(scene,result){
      const cards=el('div',{class:'dc-scratch-grid'}),canvases=[],revealed=new Set();scene.append(cards);
      result.results.forEach((item,index)=>{
        const canvas=el('canvas',{'aria-label':'刮開第 '+(index+1)+' 位學生',tabindex:0}),card=el('div',{class:'dc-scratch-card'},[el('div',{'aria-hidden':'true'},[avatar(item),el('strong',{text:item.name}),el('small',{text:item.task||U.pad2(item.no)+' 號'})]),canvas]);cards.append(card);canvases.push(canvas);
        requestAnimationFrame(()=>{
          const rect=card.getBoundingClientRect(),ratio=Math.min(2,root.devicePixelRatio||1);canvas.width=Math.max(1,Math.round(rect.width*ratio));canvas.height=Math.max(1,Math.round(rect.height*ratio));const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);ctx.fillStyle='#aab8b8';ctx.fillRect(0,0,rect.width,rect.height);ctx.strokeStyle='#e4eded';ctx.lineWidth=8;for(let x=-rect.height;x<rect.width;x+=30){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+rect.height,rect.height);ctx.stroke();}ctx.fillStyle='#244f50';ctx.font='bold 22px sans-serif';ctx.textAlign='center';ctx.fillText('刮開揭曉',rect.width/2,rect.height/2+8);
          let drawing=false,last=null,lastCheck=0;
          function reveal(){if(revealed.has(index))return;revealed.add(index);ctx.clearRect(0,0,rect.width,rect.height);canvas.style.pointerEvents='none';if(revealed.size===result.results.length)finishResult(result);}
          canvas.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();reveal();}});
          function scratch(event){const r=canvas.getBoundingClientRect(),point={x:(event.clientX-r.left)/r.width*rect.width,y:(event.clientY-r.top)/r.height*rect.height};ctx.globalCompositeOperation='destination-out';ctx.lineWidth=48;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(last?last.x:point.x,last?last.y:point.y);ctx.lineTo(point.x,point.y);ctx.stroke();last=point;if(Date.now()-lastCheck>150){lastCheck=Date.now();const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;let empty=0,total=0;for(let n=3;n<pixels.length;n+=4*64){total++;if(pixels[n]<32)empty++;}if(empty/total>.45)reveal();}}
          canvas.addEventListener('pointerdown',event=>{drawing=true;last=null;canvas.setPointerCapture(event.pointerId);scratch(event);event.preventDefault();});canvas.addEventListener('pointermove',event=>{if(drawing)scratch(event);});canvas.addEventListener('pointerup',()=>{drawing=false;last=null;});canvas.addEventListener('pointercancel',()=>{drawing=false;last=null;});
        });
      });
      revealNow=()=>{canvases.forEach(canvas=>{canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);canvas.style.pointerEvents='none';});finishResult(result);};
    }
    function finishResult(result){
      if(!running||disposed)return;running=false;revealNow=null;audio.finish(data.config);paintResults(result);const oldHistory=rootEl.querySelector('.dc-history');if(oldHistory)oldHistory.replaceWith(history());refresh();
      if(result.results.length<result.requested)setNotice('本輪只剩 '+result.results.length+' 位，已全部抽出；按重置可開始新一輪。');else setNotice('已抽出 '+result.results.length+' 位，本輪紀錄已保存。');
    }
    async function start(order){
      if(running||disposed)return;const pool=currentPool();if(!pool.length)return;running=true;setNotice('正在抽取…');audio.unlock(data.config);refresh();const token=++presentation;
      try{
        const result=await adapter.draw({order:!!order});if(disposed||token!==presentation)return;
        const cfg=data.config,reduce=root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const duration=reduce?350:cfg.duration*1000*(cfg.style==='bomb'?.7+Math.random()*.7:1);
        const scene=buildScene(result,pool,true);paintResults(null);
        if(scene.wheel){const index=pool.findIndex(st=>st.id===result.results[0].studentId);scene.wheel.spin(index,duration);}
        if(scene.taskWheel){const choices=E.tasks(cfg),index=choices.indexOf(result.results[0].task);scene.taskWheel.spin(index,duration);}
        if(cfg.style==='scratch'){setNotice('用手指或滑鼠刮開卡片；也可以按「直接揭曉全部結果」。');refresh();return;}
        audio.start(cfg,cfg.style,duration);const began=performance.now();let previous=0;
        const animate=now=>{if(disposed||token!==presentation)return;const progress=Math.min(1,(now-began)/duration);if(now-previous>45){scene.tick(progress);previous=now;}if(progress<1)frame=requestAnimationFrame(animate);else{scene.tick(1);scene.finish();contextCardIndex=null;finishResult(result);}};frame=requestAnimationFrame(animate);
      }catch(error){running=false;revealNow=null;audio.stop();setNotice(error.message);refresh();}
    }
    function cancelPresentation(){presentation++;if(frame)cancelAnimationFrame(frame);frame=null;audio.stop();running=false;revealNow=null;}
    function toggleProject(force){projected=typeof force==='boolean'?force:!projected;rootEl.classList.toggle('is-projecting',projected);const button=rootEl.querySelector('.dc-header-actions button');if(button)button.textContent=projected?'結束投影':'⛶ 大字投影';if(projected&&rootEl.requestFullscreen){rootEl.requestFullscreen().catch(()=>{});}else if(!projected&&document.fullscreenElement===rootEl)document.exitFullscreen().catch(()=>{});}
    function update(next){if(!next||disposed)return;const old=data,last=data.last&&data.last.id;snapshot=next;data=E.normalize(next.draw);if(!running&&(last!==(data.last&&data.last.id)||old.round!==data.round||old.config.style!==data.config.style))render();else {refresh();if(!running&&data.last)paintResults(data.last);}}
    function escape(event){if(event.key==='Escape'&&projected)toggleProject(false);}
    document.addEventListener('keydown',escape);render();
    return{element:rootEl,update,get running(){return running;},destroy(){disposed=true;cancelPresentation();document.removeEventListener('keydown',escape);if(projected&&document.fullscreenElement===rootEl)document.exitFullscreen().catch(()=>{});rootEl.remove();}};
  }
  root.PetDrawCenter={create};
})(window);
