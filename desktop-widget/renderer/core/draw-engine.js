/* 共用抽籤引擎：以最新名單抽取，權重抽樣不放回，與動畫分離。 */
(function(root){
  'use strict';
  const STYLES=['wheel','race','bomb','slot','gacha','cards','scratch','devil'];
  const DEFAULTS={style:'wheel',count:1,excludeDrawn:true,sound:true,volume:70,soundTrack:'drums',revealSound:'fanfare',soundIntensity:2,wheelPalette:'forest',duration:4,taskMode:'none',questionFrom:1,questionTo:20,taskText:'獲得掌聲\n分享解題方法\n帶領大家伸展',choreText:'擦黑板\n掃地\n拖地\n整理書櫃\n倒回收\n擦窗臺',customText:'第一個任務\n第二個任務',punishmentText:'重新說明答案一次\n整理自己的桌面\n補完成一題訂正',groupCount:0,autoTimer:false,timerMode:'down',timerSeconds:60};
  const integer=(value,min,max,fallback)=>Number.isFinite(Number(value))?Math.max(min,Math.min(max,Math.round(Number(value)))):fallback;
  const random=()=>{if(root.crypto&&root.crypto.getRandomValues){const n=new Uint32Array(1);root.crypto.getRandomValues(n);return n[0]/4294967296;}return Math.random();};
  function normalize(raw){
    const source=raw&&typeof raw==='object'?raw:{};const cfg=Object.assign({},DEFAULTS,source.config||{});
    cfg.style=STYLES.includes(cfg.style)?cfg.style:'wheel';cfg.count=integer(cfg.count,1,5,1);cfg.duration=integer(cfg.duration,1,8,4);cfg.volume=integer(cfg.volume,0,100,45);cfg.groupCount=integer(cfg.groupCount,0,10,0);
    cfg.soundTrack=['drums','heartbeat','arcade','suspense','bells','marimba','piano','ukulele','cosmic','orchestra','carnival','mystery','none'].includes(cfg.soundTrack)?cfg.soundTrack:'drums';
    cfg.revealSound=['fanfare','applause','fireworks','chime','harp','jazz','retro_win','soft','magic','drum_finish','none'].includes(cfg.revealSound)?cfg.revealSound:'fanfare';
    cfg.soundIntensity=integer(cfg.soundIntensity,1,3,2);
    cfg.wheelPalette=['forest','ocean','sunset','candy','neon','mono'].includes(cfg.wheelPalette)?cfg.wheelPalette:'forest';
    cfg.autoTimer=cfg.autoTimer===true;cfg.timerMode=cfg.timerMode==='up'?'up':'down';cfg.timerSeconds=integer(cfg.timerSeconds,1,10800,60);
    cfg.excludeDrawn=cfg.excludeDrawn!==false;cfg.sound=cfg.sound!==false;cfg.taskMode=['none','questions','reward','chores','custom','punishment'].includes(cfg.taskMode)?cfg.taskMode:'none';
    if(cfg.style==='devil')cfg.taskMode='punishment';
    cfg.questionFrom=integer(cfg.questionFrom,1,999,1);cfg.questionTo=integer(cfg.questionTo,cfg.questionFrom,Math.min(999,cfg.questionFrom+499),Math.max(cfg.questionFrom,20));
    ['taskText','choreText','customText','punishmentText'].forEach(key=>cfg[key]=String(cfg[key]||'').slice(0,6000));
    const weights={};Object.entries(source.weights||{}).forEach(([id,value])=>{if(typeof id==='string')weights[id]=integer(value,1,10,1);});
    return {version:1,round:integer(source.round,1,1000000,1),drawnIds:Array.from(new Set(Array.isArray(source.drawnIds)?source.drawnIds.filter(x=>typeof x==='string'):[])),weights,config:cfg,history:Array.isArray(source.history)?source.history.slice(0,60):[],last:source.last&&Array.isArray(source.last.results)?source.last:null};
  }
  function settings(state,patch){
    const draw=normalize(state.drawCenter);if(patch.config)Object.assign(draw.config,patch.config);
    if(patch.weights){const allowed=new Set((state.students||[]).map(st=>st.id));Object.entries(patch.weights).forEach(([id,value])=>{if(allowed.has(id))draw.weights[id]=integer(value,1,10,1);});}
    if(patch.resetWeights)draw.weights={};state.drawCenter=normalize(draw);return state.drawCenter;
  }
  function candidates(snapshot,draw){
    const absent=new Set(snapshot.absentIds||[]);const picked=new Set(draw.drawnIds);
    return (snapshot.students||[]).filter(st=>!absent.has(st.id)&&(!draw.config.excludeDrawn||!picked.has(st.id)));
  }
  function weightedPick(pool,weights,rng){
    if(!pool.length)return null;const total=pool.reduce((sum,st)=>sum+integer(weights[st.id],1,10,1),0);let ticket=(rng||random)()*total;
    for(const st of pool){ticket-=integer(weights[st.id],1,10,1);if(ticket<0)return st;}return pool[pool.length-1];
  }
  function tasks(config){
    if(config.taskMode==='none')return[];
    if(config.taskMode==='questions')return Array.from({length:config.questionTo-config.questionFrom+1},(_,i)=>'第 '+(config.questionFrom+i)+' 題');
    const key=config.taskMode==='reward'?'taskText':config.taskMode==='chores'?'choreText':config.taskMode==='punishment'?'punishmentText':'customText';
    return Array.from(new Set(String(config[key]||'').split(/\r?\n/).map(x=>x.trim().slice(0,80)).filter(Boolean))).slice(0,100);
  }
  function snapshot(state,absentIds){return{students:state.students||[],absentIds:absentIds||[],draw:normalize(state.drawCenter)};}
  function run(state,absentIds,request,rng){
    const draw=normalize(state.drawCenter),pool=candidates(snapshot(state,absentIds),draw);if(!pool.length)throw new Error('本輪沒有可抽學生，請重置名單或檢查出席狀況。');
    const order=!!(request&&request.order),requested=order?pool.length:draw.config.count,count=Math.min(requested,pool.length),remaining=pool.slice(),choices=tasks(draw.config),taskPool=choices.slice(),results=[];
    if(draw.config.taskMode!=='none'&&!choices.length)throw new Error('請先輸入至少一項抽籤任務。');
    for(let index=0;index<count;index++){
      const selected=weightedPick(remaining,draw.weights,rng);remaining.splice(remaining.findIndex(st=>st.id===selected.id),1);
      if(choices.length&&!taskPool.length)taskPool.push(...choices);
      const taskIndex=taskPool.length?Math.floor((rng||random)()*taskPool.length):-1;
      results.push({studentId:selected.id,no:selected.no,name:selected.name,emoji:selected.emoji||'🐾',task:taskIndex>=0?taskPool.splice(taskIndex,1)[0]:'',rank:index+1,group:order&&draw.config.groupCount>0?index%draw.config.groupCount+1:0});
    }
    const result={id:'draw_'+Date.now()+'_'+Math.floor((rng||random)()*1e9),ts:Date.now(),round:draw.round,style:draw.config.style,order,requested,available:pool.length,results};
    draw.drawnIds=Array.from(new Set(draw.drawnIds.concat(results.map(x=>x.studentId))));draw.last=result;draw.history.unshift(result);draw.history=draw.history.slice(0,60);state.drawCenter=draw;return result;
  }
  /* 整輪排序的課堂表現：優先沿用老師已有的「回答優秀／回答完整／回答正確」規則，沒有就用內建點數。 */
  const PERFORMANCE=[{key:'excellent',icon:'🏔️',label:'回答優秀',points:2,xp:3,coins:2},{key:'complete',icon:'👍',label:'回答完整',points:1,xp:2,coins:1},{key:'correct',icon:'✅',label:'回答正確',points:1,xp:2,coins:1}];
  function performanceRule(state,key){const item=PERFORMANCE.find(x=>x.key===key);if(!item)throw new Error('不支援的課堂表現');const word=item.label.slice(2),rules=Array.isArray(state&&state.rules)?state.rules:[];const found=rules.find(r=>r&&r.points>0&&(r.label===item.label||String(r.label||'').includes('回答'+word)));return found||{id:'perf_'+item.key,label:item.label,icon:item.icon,points:item.points,xp:item.xp,coins:item.coins,kind:'add',category:'class'};}
  function performanceList(state){return PERFORMANCE.map(item=>{const rule=performanceRule(state,item.key);return {key:item.key,icon:item.icon,label:rule.label||item.label,points:rule.points};});}
  function reset(state){const draw=normalize(state.drawCenter);draw.round++;draw.drawnIds=[];draw.last=null;state.drawCenter=draw;return draw;}
  const api={STYLES,DEFAULTS,normalize,settings,candidates,weightedPick,tasks,snapshot,run,reset,random,PERFORMANCE,performanceRule,performanceList};root.PetDrawEngine=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
