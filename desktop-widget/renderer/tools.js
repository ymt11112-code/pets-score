/* 工具視窗只保留 UI 狀態；班級資料由主加點視窗統一處理。 */
(function () {
  'use strict';
  const U=window.PetUtil, el=U.el, bridge=window.desktopWidget;
  const content=document.getElementById('toolContent'), tabs=document.getElementById('toolTabs');
  const kinds=[['attendance','📋','出席'],['draw','🎲','抽籤'],['timer','⏱️','計時器'],['tasks','✅','今日任務']];
  let active=new URLSearchParams(location.search).get('tool') || 'attendance';
  if(!kinds.some(x=>x[0]===active))active='attendance';
  let state=null,busy=false,drawController=null;
  let editingTask=null, taskDraft=new Set();
  const lessonClock=window.PetLessonTimer.clock;
  const timer={total:300,left:300,running:false,mode:'down',done:false};
  let audio=null;
  const A=window.PetAttendance;
  const isAbsent=id=>state && A.isExcluded(state.attendance[id]||'');
  const students=()=>state ? state.students.slice().sort((a,b)=>a.no-b.no) : [];
  function button(text,click,primary) {return el('button',{class:'btn '+(primary?'btn--primary':'btn--ghost'),type:'button',text,onclick:click});}
  function note(text){return el('p',{class:'dt-note',text});}
  async function change(action) {
    if(busy)return;busy=true;render();
    try{const next=await action();if(next)state=next;}catch(error){U.toast(error.message,'error');}
    finally{busy=false;render();}
  }
  function studentButton(student,checked,click,absent) {
    return el('button',{class:'dt-student'+(checked?' is-selected':'')+(absent?' is-absent':''),type:'button','data-student':student.id,'aria-pressed':String(checked),disabled:busy,onclick:click},[
      el('b',{text:U.pad2(student.no)}),el('span',{text:student.name}),el('small',{text:absent?'請假':checked?'已選取':'到校'})
    ]);
  }
  function attendance() {
    const list=students(),record=state.attendance;
    const bulk=el('select',{class:'input','aria-label':'全班出席狀態'},A.statuses.map(s=>el('option',{value:s.id,text:s.label})));
    return el('section',{class:'dt-panel'},[
      el('div',{class:'dt-section-head'},[el('h2',{text:'今日出席'}),el('span',{text:state.day})]),
      note('點學生循環切換，或用選單直接指定。遲到仍可抽籤；各類請假與早退會排除。'),
      el('div',{class:'dt-attendance-counts'},A.statuses.concat(list.some(st=>record[st.id]==='absent')?[{id:'absent',label:'未分類請假'}]:[]).map(s=>el('span',{text:s.label+' '+list.filter(st=>(record[st.id]||'')===s.id).length}))),
      el('div',{class:'dt-actions'},[bulk,button('套用全班',()=>change(()=>bridge.setToolAllAttendance(bulk.value)))]),
      el('div',{class:'dt-students'},list.map(st=>{
        const status=record[st.id]||'';
        const select=el('select',{class:'input','aria-label':st.name+'出席狀態',disabled:busy,onchange:e=>change(()=>bridge.setToolAttendance(st.id,e.target.value))},[
          ...(status==='absent'?[el('option',{value:'absent',text:A.label('absent')})]:[]),...A.statuses.map(s=>el('option',{value:s.id,text:s.label}))
        ]);select.value=status;
        return el('div',{class:'dt-attendance-person'},[
          el('button',{class:'dt-student attendance-status-'+(status||'present'),'data-student':st.id,'aria-label':st.name+' '+A.label(status),disabled:busy,onclick:()=>change(()=>bridge.setToolAttendance(st.id,A.next(status)))},[el('b',{text:U.pad2(st.no)}),el('span',{text:st.name}),el('small',{text:A.label(status)})]),select
        ]);
      }))
    ]);
  }
  function drawSnapshot(){return {students:state.students,absentIds:state.students.filter(st=>isAbsent(st.id)).map(st=>st.id),draw:state.draw,className:state.className};}
  function draw(){
    if(!drawController)drawController=window.PetDrawCenter.create({
      getSnapshot:drawSnapshot,
      configure:async patch=>{state=await bridge.configureDraw(patch);return drawSnapshot();},
      draw:async request=>{state=await bridge.runDraw(request);drawController.update(drawSnapshot());return state.draw.last;},
      reset:async()=>{state=await bridge.resetDraw();return drawSnapshot();},
      select:async ids=>{if(!await bridge.selectDrawnStudents(ids))throw Error('請檢查學生出席狀態');},
      avatar:id=>{const st=state.students.find(st=>st.id===id);const template=document.createElement('template');template.innerHTML=st?.avatarHtml||'<span>🐾</span>';return template.content.firstElementChild;}
    });else drawController.update(drawSnapshot());
    return drawController.element;
  }
  function format(seconds){return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');}
  function paintClock() {
    document.querySelectorAll('.dt-timer-time').forEach(node=>node.textContent=format(timer.left));
    document.querySelectorAll('.dt-timer-progress').forEach(node=>node.style.width=(timer.mode==='up'?100:timer.left/timer.total*100)+'%');
    document.querySelector('[data-tool-clock]').textContent=timer.running?(timer.mode==='up'?'正向 ':'倒數 ')+format(timer.left):timer.done?'⏰ 時間到':'計時器待命';
  }
  function stopClock(){lessonClock.pause();}
  function setClock(seconds){lessonClock.configure({mode:'down',seconds});render();}
  function alarm(){
    try{if(!audio)return;[0,.25,.5].forEach(delay=>{const oscillator=audio.createOscillator(),gain=audio.createGain(),at=audio.currentTime+delay;oscillator.connect(gain);gain.connect(audio.destination);oscillator.frequency.value=880;gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.16,at+.02);gain.gain.exponentialRampToValueAtTime(.0001,at+.2);oscillator.start(at);oscillator.stop(at+.22);});}catch(e){}
  }
  function unlockAlarm(){try{if(!audio)audio=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{});}catch{}}
  function startClock(){unlockAlarm();lessonClock.start();render();}
  lessonClock.subscribe((state,event)=>{timer.total=state.total;timer.left=state.seconds;timer.running=state.running;timer.mode=state.mode;timer.done=state.done;paintClock();if(event==='start')unlockAlarm();if(event==='finish'){alarm();if(active==='timer')render();U.toast('⏰ 時間到！');bridge.toolTimerFinished();}});
  function timerPanel(){
    const custom=el('input',{class:'input',type:'number',min:'0.0167',max:'180',step:'any',value:timer.total/60,'aria-label':'自訂分鐘'});
    return el('section',{class:'dt-panel'},[
      el('h2',{text:timer.mode==='up'?'正向計時器':'課堂計時器'}),note('關閉此工具視窗後仍會繼續倒數，時間到會顯示提醒。'),
      el('div',{class:'dt-timer-stage'+(timer.done?' is-finished':'')},[
        el('div',{class:'dt-timer-time',role:'timer',text:format(timer.left)}),
        el('div',{class:'dt-timer-bar'},[el('div',{class:'dt-timer-progress',style:{width:timer.left/timer.total*100+'%'}})])
      ]),
      el('div',{class:'dt-actions'},[
        button(timer.running?'倒數中':'▶ 開始',startClock,true),button('⏸ 暫停',()=>{stopClock();render();}),button('↻ 重設',()=>setClock(timer.total))
      ]),
      el('div',{class:'dt-presets'},[30,60,180,300,600,900].map(sec=>button(sec<60?sec+' 秒':sec/60+' 分',()=>setClock(sec)))),
      el('div',{class:'dt-custom'},[custom,el('span',{text:'分鐘'}),button('設定',()=>{const minutes=Number(custom.value);if(!Number.isFinite(minutes)||minutes<=0||minutes>180)return U.toast('請輸入 0 到 180 之間的分鐘數','warn');setClock(Math.max(1,Math.round(minutes*60)));})])
    ]);
  }
  function tasksPanel(){
    const task=(state.tasks||[]).find(t=>t.id===editingTask);
    if(task){
      return el('section',{class:'dt-panel'},[
        el('h2',{text:(task.icon||'✅')+' '+task.title}),note('勾選完成的學生，再儲存名單。任務獎勵沿用網頁設定。'),
        el('div',{class:'dt-summary'},[el('strong',{text:'已選 '+taskDraft.size+' 位'}),el('span',{text:'目標 '+task.target+' 位 · +'+(task.xp||0)+' XP'})]),
        el('div',{class:'dt-actions'},[button('選取到校學生',()=>{students().filter(s=>!isAbsent(s.id)).forEach(s=>taskDraft.add(s.id));render();}),button('清空',()=>{taskDraft.clear();render();})]),
        el('div',{class:'dt-students'},students().map(s=>studentButton(s,taskDraft.has(s.id),()=>{taskDraft.has(s.id)?taskDraft.delete(s.id):taskDraft.add(s.id);render();},isAbsent(s.id)))),
        el('button',{class:'btn btn--primary dt-wide',text:busy?'儲存中…':'儲存完成名單',disabled:busy,onclick:()=>change(async()=>{const next=await bridge.setToolTaskStudents(task.id,[...taskDraft]);editingTask=null;return next;})}),
        button('取消返回',()=>{editingTask=null;render();})
      ]);
    }
    const tasks=state.tasks||[];
    return el('section',{class:'dt-panel'},[
      el('h2',{text:'今日任務'}),note('點選任務設定完成學生；任務名稱、目標與 XP 請在網頁「規則設定」管理。'),
      ...tasks.map(task=>el('button',{class:'dt-task',type:'button','data-task':task.id,onclick:()=>{editingTask=task.id;taskDraft=new Set(task.doneBy||[]);render();}},[
        el('span',{class:'dt-task-icon',text:task.icon||'✅'}),el('div',{},[el('strong',{text:task.title}),el('small',{text:'完成 '+(task.doneBy||[]).length+' / '+task.target+' 位 · +'+(task.xp||0)+' XP'}),el('progress',{value:Math.min((task.doneBy||[]).length,task.target||1),max:Math.max(1,task.target||1)})]),el('span',{text:'›'})
      ])),
      tasks.length?null:note('目前沒有任務，請先在網頁「規則設定」新增。')
    ]);
  }
  function render(){
    if(state)document.querySelector('.dt-header p').textContent=state.className||'班級寵物探險隊';
    tabs.replaceChildren(...kinds.map(([kind,image,label])=>el('button',{class:'dt-tab'+(active===kind?' is-active':''),type:'button','data-tool':kind,'aria-pressed':String(active===kind),onclick:()=>{active=kind;render();}},[el('span',{text:image}),el('span',{text:label})])));
    if(active==='timer')content.replaceChildren(timerPanel());
    else if(!state)content.replaceChildren(note('正在讀取班級資料…'),button('重新讀取',load));
    else if(active==='draw'&&drawController&&content.contains(drawController.element))drawController.update(drawSnapshot());
    else content.replaceChildren(active==='draw'?draw():active==='tasks'?tasksPanel():attendance());
    paintClock();
  }
  async function load(){try{state=await bridge.getToolState();render();}catch(error){content.replaceChildren(note(error.message),button('重新讀取',load));}}
  bridge.onOpenTool(kind=>{if(kinds.some(x=>x[0]===kind)){active=kind;render();load();}});
  bridge.onToolState(next=>{state=next;if(active==='timer')return;render();});
  render();load();
})();

