const {browser,wait,assert}=require('./browser-test-helper.cjs');let b;
(async()=>{
  b=await browser(process.argv[2]||'http://127.0.0.1:4173/teacher.html',9299);const {run,send}=b;
  await send('Emulation.setDeviceMetricsOverride',{width:1400,height:900,deviceScaleFactor:1,mobile:false});
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  for(let i=0;i<60;i++){if(await run('!!(window.PetStore&&PetStore.get())'))break;await wait(100);}
  await run("document.getElementById('authGateInput').value='qa123456';document.getElementById('authGateBtn').click()");await wait(300);
  for(const style of ['wheel','slot','gacha']){
    await run(`PetStore.commit(s=>PetDrawEngine.settings(s,{config:{count:1,style:'${style}',sound:false,groupCount:0,taskMode:'none'}}));document.querySelector('[data-page=tools]').click()`);await wait(300);
    await run("document.querySelector('[data-reset-round]')&&document.querySelector('[data-reset-round]').click()");await wait(200);
    const lay=await run("(()=>{const w=document.querySelector('.dc-workspace'),s=document.querySelector('.dc-stage').getBoundingClientRect(),ws=w.getBoundingClientRect();return {solo:w.classList.contains('is-solo'),stageWide:s.width/ws.width,results:getComputedStyle(document.querySelector('.dc-results')).display}})()");
    assert(lay.solo&&lay.stageWide>.95&&lay.results==='none',style+' single column '+JSON.stringify(lay));
    // 按下抽籤 → 直接進入全螢幕投影
    await run("document.querySelector('[data-draw-start]').click()");await wait(150);
    assert.equal(await run("document.querySelector('.draw-center').classList.contains('is-projecting')"),true,style+' goes fullscreen on start');
    await wait(900);
    // 動畫結束 → 大大顯示中籤同學
    const sid=await run("document.querySelector('.dc-winner')&&document.querySelector('.dc-winner').dataset.winner");
    assert(sid,style+' winner card shown');
    assert.equal(await run("PetStore.get().drawCenter.last.results[0].studentId"),sid);
    // 接著自動跳出學生個人畫面（並退出全螢幕）
    for(let i=0;i<40;i++){if(await run("!!document.querySelector('.profile-content')"))break;await wait(150);}
    assert.equal(await run("(document.querySelector('.modal__title, .modal h2, [class*=modal] h2')||{}).textContent"),'學生檔案',style+' profile opens');
    assert.equal(await run("document.querySelector('.draw-center').classList.contains('is-projecting')"),false,style+' left fullscreen');
    assert(await run("document.querySelector('.profile-content')&&document.body.textContent.includes(PetStore.student(PetStore.get().drawCenter.last.results[0].studentId).name)"));
    await run("document.querySelector('.modal__close, [data-modal-close], .modal [aria-label=關閉], .modal .btn')&&0");
    await run("PetStore.get();[...document.querySelectorAll('button')].filter(x=>x.textContent.trim()==='關閉').forEach(x=>x.click())");await wait(250);
  }
  // 多人抽籤維持左右畫面
  await run("PetStore.commit(s=>PetDrawEngine.settings(s,{config:{count:3,style:'wheel'}}));document.querySelector('[data-page=tools]').click()");await wait(300);
  await run("document.querySelector('[data-reset-round]').click()");await wait(200);
  assert.equal(await run("document.querySelector('.dc-workspace').classList.contains('is-solo')"),false,'multi-draw keeps split layout');
  assert.equal(b.errors.length,0,JSON.stringify(b.errors));
  console.log('PASS solo draw: single column, fullscreen on start, winner card, profile popup');
  b.close();
})().catch(e=>{console.error(e);b?.close();process.exitCode=1;});
