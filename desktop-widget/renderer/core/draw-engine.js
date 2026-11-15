/* 共用抽籤引擎：以最新名單抽取，權重抽樣不放回，與動畫分離。 */
(function(root){
  'use strict';
  const STYLES=['wheel','race','bomb','slot','gacha','cards','scratch'];
  const DEFAULTS={style:'wheel',count:1,excludeDrawn:true,sound:true,volume:45,duration:4,taskMode:'none',questionFrom:1,questionTo:20,taskText:'獲得掌聲\n分享解題方法\n帶領大家伸展',choreText:'擦黑板\n掃地\n拖地\n整理書櫃\n倒回收\n擦窗臺',customText:'第一個任務\n第二個任務',groupCount:0};
  const integer=(value,min,max,fallback)=>Number.isFinite(Number(value))?Math.max(min,Math.min(max,Math.round(Number(value)))):fallback;
  const random=()=>{if(root.crypto&&root.crypto.getRandomValues){const n=new Uint32Array(1);root.crypto.getRandomValues(n);return n[0]/4294967296;}return Math.random();};
  function normalize(raw){
    const source=raw&&typeof raw==='object'?raw:{};const cfg=Object.assign({},DEFAULTS,source.config||{});
    cfg.style=STYLES.includes(cfg.style)?cfg.style:'wheel';cfg.count=integer(cfg.count,1,5,1);cfg.duration=integer(cfg.duration,1,8,4);cfg.volume=integer(cfg.volume,0,100,45);cfg.groupCount=integer(cfg.groupCount,0,10,0);
    cfg.excludeDrawn=cfg.excludeDrawn!==false;cfg.sound=cfg.sound!==false;cfg.taskMode=['none','questions','reward','chores','custom'].includes(cfg.taskMode)?cfg.taskMode:'none';
    cfg.questionFrom=integer(cfg.questionFrom,1,999,1);cfg.questionTo=integer(cfg.questionTo,cfg.questionFrom,Math.min(999,cfg.questionFrom+499),Math.max(cfg.questionFrom,20));
    ['taskText','choreText','customText'].forEach(key=>cfg[key]=String(cfg[key]||'').slice(0,6000));
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
    const key=config.taskMode==='reward'?'taskText':config.taskMode==='chores'?'choreText':'customText';
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
  function reset(state){const draw=normalize(state.drawCenter);draw.round++;draw.drawnIds=[];draw.last=null;state.drawCenter=draw;return draw;}
  const api={STYLES,DEFAULTS,normalize,settings,candidates,weightedPick,tasks,snapshot,run,reset,random};root.PetDrawEngine=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
