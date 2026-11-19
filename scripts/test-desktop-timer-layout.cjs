const fs=require('fs');const {browser,wait,assert}=require('./browser-test-helper.cjs');let b;
(async()=>{
  b=await browser('about:blank',9306);const {run,send}=b;
  await send('Emulation.setDeviceMetricsOverride',{width:1600,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{let cb=null;const noop=()=>Promise.resolve(null);window.__fs=v=>cb&&cb(v);window.desktopWidget=new Proxy({onToolFullscreen:f=>{cb=f;},getToolFullscreen:()=>Promise.resolve(false),onDesktopTimerSync:()=>{},getDesktopTimerState:noop},{get:(t,k)=>k in t?t[k]:(()=>Promise.resolve(null))});})()`});
  await send('Page.navigate',{url:require('url').pathToFileURL(require('path').join(__dirname,'..','desktop-widget','renderer','tools.html')).href+'?tool=timer&window=timer'});
  for(let i=0;i<60;i++){try{if(await run("!!document.querySelector('.dt-timer-time')"))break;}catch{}await wait(150);}
  const shot=async n=>fs.writeFileSync(n,Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  const m=()=>run("(()=>{const q=s=>document.querySelector(s),r=s=>{const n=q(s);if(!n)return null;const b=n.getBoundingClientRect();return {w:Math.round(b.width),h:Math.round(b.height),top:Math.round(b.top),bottom:Math.round(b.bottom),vis:getComputedStyle(n).display!=='none'}};return {time:r('.dt-timer-time'),font:parseFloat(getComputedStyle(q('.dt-timer-time')).fontSize),settings:r('.dt-timer-settings'),open:q('.dt-timer-settings').open,presets:r('.dt-preset-section'),actions:r('.dt-actions'),scroll:document.documentElement.scrollHeight>innerHeight+2||q('.dt-content').scrollHeight>q('.dt-content').clientHeight+2}})()");
  const normal=await m();console.log('normal',JSON.stringify(normal));
  assert.equal(normal.open,false,'settings collapsed by default');
  assert(normal.font>=200,'time is large: '+normal.font);
  await run("document.querySelector('.dt-timer-settings summary').click()");await wait(200);
  assert.equal(await run("document.querySelector('.dt-timer-settings').open"),true);
  assert(await run("!!document.querySelector('.dt-timer-settings .dt-custom')&&!!document.querySelector('.dt-timer-settings .timer-alarm-panel')"),'custom minutes + alarm panel live inside the card');
  await run("document.querySelector('.dt-timer-settings summary').click()");await wait(100);
  await shot('.desktop-timer-normal-qa.png');
  await run("window.__fs(true)");await wait(300);
  const full=await m();console.log('full',JSON.stringify(full));
  assert(full.font>=normal.font,'fullscreen time at least as large');
  assert.equal(full.presets.vis,false);assert.equal(full.settings.vis,false);
  assert(!full.scroll,'fullscreen does not scroll');
  assert(full.actions.bottom<=900&&full.time.w>1000,'time fills the screen '+JSON.stringify(full));
  await shot('.desktop-timer-full-qa.png');
  assert.equal(b.errors.length,0,JSON.stringify(b.errors));
  console.log('PASS desktop timer: collapsible settings, bigger time, minimal fullscreen');b.close();
})().catch(e=>{console.error(e);b?.close();process.exitCode=1;});
