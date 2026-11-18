/* 課堂計時器「時間到」提示：可選鈴聲、音量與響幾輪，並顯示全螢幕動畫。
   音效以 Web Audio 即時合成，不需要額外音檔；設定只保存在這台裝置。 */
(function(root){
  'use strict';
  const KEY='classpet.timerAlarm.v1';
  const SOUNDS=[
    ['school','🔔','學校上課鐘（噹噹噹）'],
    ['bell','🛎️','清脆鈴鐺（叮叮叮）'],
    ['digital','⏰','電子鬧鐘（嗶嗶嗶）'],
    ['chime','🎐','風鈴旋律'],
    ['xylophone','🎶','木琴歡樂旋律'],
    ['fanfare','🎺','勝利號角'],
    ['gong','🥁','銅鑼長鳴'],
    ['none','🔇','靜音（只顯示動畫）']
  ];
  const DEFAULTS={sound:'school',volume:85,repeat:3,animation:true};
  let audio=null,current=null,overlay=null,overlayTimer=null,styled=false;

  function clamp(value,min,max,fallback){const n=Math.round(Number(value));return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
  function normalize(raw){
    const r=raw&&typeof raw==='object'?raw:{};
    return {sound:SOUNDS.some(x=>x[0]===r.sound)?r.sound:DEFAULTS.sound,volume:clamp(r.volume,0,100,DEFAULTS.volume),repeat:clamp(r.repeat,1,10,DEFAULTS.repeat),animation:r.animation!==false};
  }
  function load(){try{return normalize(JSON.parse(root.localStorage.getItem(KEY)||'null'));}catch{return normalize(null);}}
  function save(next){try{root.localStorage.setItem(KEY,JSON.stringify(next));}catch{/* 無法儲存時，本次仍可使用 */}}
  function get(){return load();}
  function set(patch){const next=normalize(Object.assign({},load(),patch));save(next);return next;}

  function context(){
    if(!audio){const Ctor=root.AudioContext||root.webkitAudioContext;if(!Ctor)return null;try{audio=new Ctor();}catch{return null;}}
    return audio;
  }
  function unlock(){const c=context();if(c&&c.state==='suspended')c.resume().catch(()=>{});return c;}
  if(root.document){['pointerdown','keydown','touchstart'].forEach(name=>root.document.addEventListener(name,unlock,{passive:true}));}

  /* 敲擊式音色：基音加幾個非整數倍的泛音，聽起來像金屬鈴／木琴。 */
  function strike(c,out,freq,at,len,gain,partials,type){
    partials.forEach((ratio,index)=>{
      const osc=c.createOscillator(),amp=c.createGain(),peak=gain/(1+index*1.3);
      osc.type=type||'sine';osc.frequency.value=freq*ratio;
      amp.gain.setValueAtTime(.0001,at);amp.gain.exponentialRampToValueAtTime(Math.max(.0002,peak),at+.006);amp.gain.exponentialRampToValueAtTime(.0001,at+len/(1+index*.45));
      osc.connect(amp);amp.connect(out);osc.start(at);osc.stop(at+len+.05);
    });
  }
  function beep(c,out,freq,at,len,gain){
    const osc=c.createOscillator(),amp=c.createGain();osc.type='square';osc.frequency.value=freq;
    amp.gain.setValueAtTime(.0001,at);amp.gain.exponentialRampToValueAtTime(gain,at+.008);amp.gain.setValueAtTime(gain,at+len-.02);amp.gain.exponentialRampToValueAtTime(.0001,at+len);
    osc.connect(amp);amp.connect(out);osc.start(at);osc.stop(at+len+.02);
  }
  function brass(c,out,freq,at,len,gain){
    const osc=c.createOscillator(),amp=c.createGain(),filter=c.createBiquadFilter(),lfo=c.createOscillator(),depth=c.createGain();
    osc.type='sawtooth';osc.frequency.value=freq;filter.type='lowpass';filter.frequency.setValueAtTime(900,at);filter.frequency.linearRampToValueAtTime(2600,at+.08);filter.frequency.linearRampToValueAtTime(1500,at+len);
    lfo.frequency.value=6;depth.gain.value=freq*.008;lfo.connect(depth);depth.connect(osc.frequency);
    amp.gain.setValueAtTime(.0001,at);amp.gain.linearRampToValueAtTime(gain,at+.04);amp.gain.setValueAtTime(gain,at+Math.max(.05,len-.08));amp.gain.exponentialRampToValueAtTime(.0001,at+len);
    osc.connect(filter);filter.connect(amp);amp.connect(out);lfo.start(at);osc.start(at);lfo.stop(at+len+.05);osc.stop(at+len+.05);
  }

  /* 每個樣式回傳這一輪的長度（秒）。 */
  const PATTERNS={
    school(c,out,t){const n=24;for(let i=0;i<n;i++)strike(c,out,i%2?1760:1660,t+i*.08,.2,.5,[1,2.4,4.1],'triangle');return n*.08+.3;},
    bell(c,out,t){for(let i=0;i<3;i++)strike(c,out,880,t+i*.6,1.5,.55,[1,2.76,5.4,8.93]);return 1.2+1.6;},
    digital(c,out,t){for(let group=0;group<4;group++)for(let i=0;i<3;i++)beep(c,out,1180,t+group*.95+i*.2,.11,.28);return 3.8;},
    chime(c,out,t){[1047,1319,1568,2093,1568,1319,1047,1568].forEach((f,i)=>strike(c,out,f,t+i*.17,1,.4,[1,2.76,5.4]));return 1.2+1.1;},
    xylophone(c,out,t){let at=t;[[523,.2],[659,.2],[784,.2],[1047,.4],[784,.2],[659,.2],[784,.2],[1047,.2],[1319,.6]].forEach(([f,d])=>{strike(c,out,f,at,.4,.5,[1,4,9.2]);at+=d;});return at-t+.3;},
    fanfare(c,out,t){let at=t;[[392,.17],[392,.17],[523,.17],[659,.17],[784,.9]].forEach(([f,d])=>{brass(c,out,f,at,d,.22);brass(c,out,f*2,at,d,.08);at+=d+.02;});return at-t+.3;},
    gong(c,out,t){for(let i=0;i<2;i++)strike(c,out,110,t+i*1.6,3.6,.7,[1,1.47,2.09,2.57,3.16,4.2]);return 1.6+3.6;}
  };

  function stopSound(){
    if(!current)return;const c=audio,active=current;current=null;clearTimeout(active.timer);
    try{active.master.gain.cancelScheduledValues(c.currentTime);active.master.gain.setTargetAtTime(0,c.currentTime,.03);}catch{/* 已停止 */}
    setTimeout(()=>{try{active.master.disconnect();}catch{/* 已停止 */}},250);
    if(active.done)active.done();
  }
  /* 回傳預計播放秒數；靜音或瀏覽器不支援時回傳 0。 */
  function playSound(config,done){
    stopSound();const pattern=PATTERNS[config.sound],c=unlock();
    if(!pattern||!c||config.volume<=0)return 0;
    const master=c.createGain();master.gain.value=config.volume/100*.9;master.connect(c.destination);
    let at=c.currentTime+.05;const begin=at;
    for(let i=0;i<config.repeat;i++)at+=pattern(c,master,at)+.55;
    const total=at-begin;current={master,done,timer:setTimeout(()=>{if(current&&current.master===master){current=null;try{master.disconnect();}catch{/* 已停止 */}if(done)done();}},total*1000+300)};
    return total;
  }

  function ensureStyle(){
    if(styled||!root.document)return;styled=true;
    const style=root.document.createElement('style');
    style.textContent=`
.timer-alarm-overlay{position:fixed;inset:0;z-index:99000;display:grid;place-items:center;overflow:hidden;cursor:pointer;background:radial-gradient(circle at 50% 45%,#ffb347,#ea6a2d 55%,#b8321f);animation:taBackdrop .9s ease-in-out infinite alternate;font-family:inherit}
.timer-alarm-overlay *{box-sizing:border-box}
.ta-rings{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none}
.ta-rings i{position:absolute;width:min(62vmin,640px);height:min(62vmin,640px);border:clamp(4px,.9vmin,12px) solid rgba(255,255,255,.7);border-radius:50%;animation:taRing 2.4s ease-out infinite}
.ta-rings i:nth-child(2){animation-delay:.8s}.ta-rings i:nth-child(3){animation-delay:1.6s}
.ta-card{position:relative;z-index:1;display:grid;justify-items:center;gap:clamp(8px,2vmin,26px);padding:clamp(18px,4vmin,64px);text-align:center;color:#fff;text-shadow:0 4px 18px rgba(80,20,0,.45)}
.ta-bell{font-size:clamp(96px,28vmin,380px);line-height:1;transform-origin:50% 8%;animation:taShake .5s ease-in-out infinite;filter:drop-shadow(0 12px 22px rgba(90,30,0,.45))}
.ta-title{margin:0;font-size:clamp(48px,15vmin,260px);font-weight:900;line-height:1.1;letter-spacing:.04em}
.ta-msg{margin:0;max-width:min(90vw,1400px);font-size:clamp(20px,4.4vmin,72px);font-weight:700;line-height:1.35}
.ta-dismiss{margin-top:clamp(6px,2vmin,28px);min-height:0;padding:clamp(10px,1.6vmin,22px) clamp(24px,4vmin,64px);border:0;border-radius:999px;background:#fff;color:#a5361d;font-size:clamp(18px,3vmin,44px);font-weight:900;cursor:pointer;box-shadow:0 8px 26px rgba(90,30,0,.35);text-shadow:none}
.ta-confetti{position:absolute;top:-12vh;font-size:clamp(28px,6vmin,80px);pointer-events:none;animation:taFall linear infinite}
@keyframes taBackdrop{from{filter:brightness(1)}to{filter:brightness(1.18) saturate(1.15)}}
@keyframes taRing{from{transform:scale(.25);opacity:.9}to{transform:scale(1.9);opacity:0}}
@keyframes taShake{0%,100%{transform:rotate(0)}15%{transform:rotate(18deg)}35%{transform:rotate(-16deg)}55%{transform:rotate(12deg)}75%{transform:rotate(-8deg)}}
@keyframes taFall{from{transform:translateY(0) rotate(0)}to{transform:translateY(125vh) rotate(540deg)}}
@media (prefers-reduced-motion:reduce){.timer-alarm-overlay,.ta-bell,.ta-rings i,.ta-confetti{animation:none}.ta-confetti{display:none}.ta-rings i{opacity:.35;transform:scale(.8)}}
.timer-alarm-panel{display:grid;gap:10px;padding:14px;border:1px solid #cadfd2;border-radius:16px;background:#f6fbf7;color:#173b34;text-align:left}
.timer-alarm-panel h3{margin:0;font-size:15px;font-weight:800}
.timer-alarm-panel .ta-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.timer-alarm-panel label{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700}
.timer-alarm-panel select,.timer-alarm-panel button{min-height:38px;padding:6px 10px;border:1px solid #b4d0c1;border-radius:10px;background:#fff;color:#173b34;font:inherit;font-size:14px}
.timer-alarm-panel select{flex:1 1 180px;min-width:0}
.timer-alarm-panel button{cursor:pointer;font-weight:800}
.timer-alarm-panel button.is-playing{background:#f4cd61;border-color:#d9a92a}
.timer-alarm-panel input[type=range]{flex:1 1 120px;min-width:90px}
`;
    root.document.head.append(style);
  }

  function dismiss(){
    clearTimeout(overlayTimer);overlayTimer=null;stopSound();
    if(overlay){overlay.remove();overlay=null;}
    if(root.document)root.document.removeEventListener('keydown',onKey,true);
  }
  function onKey(event){if(event.key==='Escape'||event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();dismiss();}}
  function showOverlay(options){
    ensureStyle();if(overlay)overlay.remove();const doc=root.document;
    const host=doc.fullscreenElement||doc.webkitFullscreenElement||doc.body,node=doc.createElement('div');
    node.className='timer-alarm-overlay';node.setAttribute('role','alertdialog');node.setAttribute('aria-live','assertive');node.setAttribute('aria-label',options.title||'時間到');
    const make=(tag,cls,text)=>{const x=doc.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x;};
    const rings=make('div','ta-rings');rings.append(make('i'),make('i'),make('i'));node.append(rings);
    ['⭐','🎉','✨','🎊','🔔','⭐','🎉','✨','🎊','⭐','🎉','✨'].forEach((emoji,index)=>{const piece=make('span','ta-confetti',emoji);piece.style.left=(4+index*8.2)+'%';piece.style.animationDuration=(3.2+(index%5)*.7)+'s';piece.style.animationDelay=(-index*.55)+'s';piece.setAttribute('aria-hidden','true');node.append(piece);});
    const card=make('div','ta-card'),dismissButton=make('button','ta-dismiss','知道了');dismissButton.type='button';
    card.append(make('div','ta-bell','🔔'),make('h2','ta-title',options.title||'時間到！'),make('p','ta-msg',options.message||'計時結束，請看老師指示。'),dismissButton);node.append(card);
    node.addEventListener('click',dismiss);host.append(node);overlay=node;doc.addEventListener('keydown',onKey,true);
    try{dismissButton.focus({preventScroll:true});}catch{/* 無法聚焦時仍可點擊關閉 */}
    return node;
  }

  /* 時間到：播放鈴聲並顯示動畫；options.title／message 可自訂文字。 */
  function ring(options){
    const o=options||{},config=Object.assign({},load(),o.override||{});
    const length=playSound(config);
    if(config.animation&&root.document){showOverlay(o);clearTimeout(overlayTimer);overlayTimer=setTimeout(dismiss,Math.max(15000,length*1000+4000));}
    return {stop:dismiss};
  }
  function preview(override){const config=Object.assign({},load(),override||{});stopSound();return playSound(config);}

  /* 設定面板：選鈴聲、試聽、音量、重複輪數與動畫開關，改了立即儲存。 */
  function panel(){
    ensureStyle();const U=root.PetUtil,el=U.el,config=load();let playing=false,listen;
    const sound=el('select',{'aria-label':'時間到提示音',onchange:e=>{set({sound:e.target.value});}},SOUNDS.map(([id,icon,label])=>el('option',{value:id,text:icon+' '+label,selected:config.sound===id?'selected':null})));
    const volume=el('input',{type:'range',min:0,max:100,step:5,value:config.volume,'aria-label':'提示音量',oninput:e=>{set({volume:e.target.value});}});
    const repeat=el('select',{'aria-label':'提示音響幾輪',onchange:e=>{set({repeat:e.target.value});}},[1,2,3,5,8,10].map(n=>el('option',{value:n,text:'響 '+n+' 輪',selected:config.repeat===n?'selected':null})));
    const animation=el('input',{type:'checkbox',checked:config.animation?'checked':null,onchange:e=>{set({animation:e.target.checked});}});
    function paintListen(){listen.textContent=playing?'■ 停止':'▶ 試聽';listen.classList.toggle('is-playing',playing);}
    listen=el('button',{type:'button',text:'▶ 試聽',onclick:()=>{if(playing){stopSound();playing=false;paintListen();return;}const length=preview();if(!length){U.toast&&U.toast('目前選擇靜音，或音量為 0。','warn');return;}playing=true;paintListen();setTimeout(()=>{playing=false;paintListen();},Math.min(length,4)*1000);}});
    return el('section',{class:'timer-alarm-panel','aria-label':'時間到提示設定','data-timer-alarm-panel':''},[
      el('h3',{text:'🔔 時間到提示'}),
      el('div',{class:'ta-row'},[sound,listen]),
      el('div',{class:'ta-row'},[el('label',{},['音量',volume]),repeat]),
      el('label',{},[animation,'時間到顯示全螢幕動畫'])
    ]);
  }

  const api={SOUNDS,DEFAULTS,get,set,normalize,unlock,ring,preview,stop:dismiss,panel};
  root.PetTimerAlarm=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
