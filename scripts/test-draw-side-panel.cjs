const {browser,wait,assert}=require('./browser-test-helper.cjs');let b;
(async()=>{
  b=await browser(process.argv[2]||'http://127.0.0.1:4173/teacher.html',9282);const {run,send}=b;
  await send('Emulation.setDeviceMetricsOverride',{width:1400,height:900,deviceScaleFactor:1,mobile:false});
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  for(let i=0;i<60;i++){if(await run('!!(window.PetStore&&PetStore.get())'))break;await wait(100);}
  await run("document.getElementById('authGateInput').value='qa123456';document.getElementById('authGateBtn').click();PetStore.commit(s=>PetDrawEngine.settings(s,{config:{count:1,style:'wheel',sound:false,groupCount:0}}));document.querySelector('[data-page=tools]').click()");await wait(300);
  const geometry=()=>run("(()=>{const q=s=>document.querySelector(s),side=q('.dc-side').getBoundingClientRect(),work=q('.dc-workspace').getBoundingClientRect(),stage=q('.dc-stage').getBoundingClientRect(),actions=q('.dc-side-actions').getBoundingClientRect(),res=q('.dc-results').getBoundingClientRect(),rest=q('.dc-side-rest')?.getBoundingClientRect();return {halfWidth:side.width/(work.width),left:side.left>=stage.right,actionsTop:actions.top<=side.top+1,results:res.height,rest:rest?rest.height:0,labels:[...document.querySelectorAll('.dc-side-actions button')].map(x=>x.textContent)}})()");
  const g=await geometry();
  assert(g.halfWidth>.45&&g.halfWidth<.55&&g.left,JSON.stringify(g));
  assert(g.actionsTop);assert.deepEqual(g.labels.map(x=>x.replace(/^\S+\s/,'')),['全員名單・權重','抽出整輪排序','一鍵重置名單']);
  assert(await run("[...document.querySelectorAll('.dc-toolbar button')].every(x=>!x.matches('[data-draw-order],[data-reset-round]'))"),'order/reset moved out of the bottom toolbar');
  // 單人結果：頭像下方出現等級與 XP，結果佔右欄上方約三分之二
  await run("document.querySelector('[data-draw-start]').click()");await wait(600);
  const g1=await geometry();assert(g1.results/(g1.results+g1.rest)>.6&&g1.results/(g1.results+g1.rest)<.72,JSON.stringify(g1));
  const meta=await run("(()=>{const card=document.querySelector('.dc-result-card'),av=card.querySelector('.draw-pet-avatar').getBoundingClientRect(),m=card.querySelector('.dc-pet-meta').getBoundingClientRect();return {below:m.top>=av.bottom-1,text:card.querySelector('.dc-pet-meta').textContent,fits:card.scrollHeight<=card.clientHeight+1}})()");
  assert(meta.below&&/Lv\.\d+/.test(meta.text)&&/XP \d+ \/ \d+/.test(meta.text)&&meta.fits,JSON.stringify(meta));
  for(const n of [2,3,4,5]){
    await run(`document.querySelector('[data-reset-round]').click();PetStore.commit(s=>PetDrawEngine.settings(s,{config:{count:${n}}}));document.querySelector('[data-draw-start]').click()`);await wait(600);
    const fit=await run("(()=>{const grid=document.querySelector('.dc-results-grid');return {cards:grid.children.length,metas:grid.querySelectorAll('.dc-pet-meta').length,overflow:grid.scrollHeight-grid.clientHeight,clipped:[...grid.children].some(card=>card.scrollHeight>card.clientHeight+1)}})()");
    assert.equal(fit.cards,n);assert.equal(fit.metas,n);assert(fit.overflow<=1&&!fit.clipped,n+' '+JSON.stringify(fit));
  }
  // 全員名單：在右欄直接設定權重
  await run("document.querySelector('[data-roster-toggle]').click()");await wait(150);
  assert.equal(await run("document.querySelector('.dc-side').dataset.view"),'roster');
  assert.equal(await run("document.querySelectorAll('.dc-roster-person .dc-weight-step').length"),2*(await run('PetStore.get().students.length')),'weight +/- buttons for every student');
  const total=await run("PetStore.get().students.length");assert.equal(await run("document.querySelectorAll('.dc-roster-person').length"),total);
  const id=await run("document.querySelector('.dc-roster-person').dataset.rosterId");
  await run("(()=>{const input=document.querySelector('.dc-roster-person input');input.value='7';input.dispatchEvent(new Event('change'))})()");await wait(250);
  assert.equal(await run(`PetStore.get().drawCenter.weights['${id}']`),7);
  assert.equal(await run("document.querySelector('.dc-roster-person input').value"),'7');
  await run("document.querySelector('.dc-roster-person .dc-weight-step:last-child').click()");await wait(250);
  assert.equal(await run(`PetStore.get().drawCenter.weights['${id}']`),8,'+ button raises weight');
  await run("document.querySelector('[data-weights-reset]').click()");await wait(250);
  assert.equal(await run(`PetStore.get().drawCenter.weights['${id}']||1`),1);
  await run("document.querySelector('[data-roster-toggle]').click()");assert.notEqual(await run("document.querySelector('.dc-side').dataset.view"),'roster');
  // 整輪排序：兩排並列、不需捲動
  await run("document.querySelector('[data-reset-round]').click();document.querySelector('[data-draw-order]').click()");await wait(500);
  const order=await run("(()=>{const list=document.querySelector('.dc-order-list'),items=[...list.children],xs=new Set(items.map(x=>Math.round(x.getBoundingClientRect().left)));const box=list.getBoundingClientRect();return {view:document.querySelector('.dc-side').dataset.view,count:items.length,columns:xs.size,scroll:list.scrollHeight-list.clientHeight,inside:items.every(x=>x.getBoundingClientRect().bottom<=box.bottom+1),noRest:getComputedStyle(document.querySelector('.dc-side-rest')).display}})()");
  assert.equal(order.view,'order');assert.equal(order.count,total);assert.equal(order.columns,2);assert(order.scroll<=1&&order.inside,JSON.stringify(order));assert.equal(order.noRest,'none');
  // 整輪排序：每位同學都有優秀／完整／正確圖示，點了立刻加分並出現右下角提示
  const perform=await run("(()=>{const item=document.querySelector('.dc-order-item'),btns=[...item.querySelectorAll('[data-perform]')];const r=btns.map(x=>x.getBoundingClientRect());return {keys:btns.map(x=>x.dataset.perform),sizes:r.map(x=>Math.round(x.width)),icons:btns.map(x=>x.textContent)}})()");
  assert.deepEqual(perform.keys,['excellent','complete','correct']);assert(perform.sizes.every(x=>x>=22),JSON.stringify(perform));
  const beforeLedger=await run('PetStore.get().ledger.length'),beforePoints=await run("PetStore.get().students.find(s=>s.id===document.querySelector('.dc-order-item [data-perform-for]').dataset.performFor).points");
  const target=await run("document.querySelector('.dc-order-item [data-perform-for]').dataset.performFor");
  await run("document.querySelector('.dc-order-item [data-perform=excellent]').click()");await wait(400);
  const entry=await run('PetStore.get().ledger[0]');assert.equal(await run('PetStore.get().ledger.length'),beforeLedger+1);assert.equal(entry.label,'回答優秀');assert(entry.points>0&&entry.studentIds.length===1&&entry.studentIds[0]===target,JSON.stringify(entry));
  assert(await run("/回答優秀/.test(document.querySelector('.award-notice')?.textContent||'')"),'bottom-right award notice appears');
  assert.equal(await run("document.querySelector('.dc-order-item [data-perform=excellent]').classList.contains('is-done')"),true);
  await run("document.querySelector('.dc-order-item [data-perform=excellent]').click()");await wait(200);assert.equal(await run('PetStore.get().ledger.length'),beforeLedger+1,'the same icon does not award twice');
  // 重置後回到結果版面
  await run("document.querySelector('[data-reset-round]').click()");await wait(250);
  assert.notEqual(await run("document.querySelector('.dc-side').dataset.view"),'order');
  assert.equal(b.errors.length,0,JSON.stringify(b.errors));
  console.log('PASS draw side panel: top-right actions, 2/3 result with pet level+XP, roster weights, two-column full order, reset');
  b.close();
})().catch(e=>{console.error(e);b?.close();process.exitCode=1;});
