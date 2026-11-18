const {browser,wait,assert}=require('./browser-test-helper.cjs');let b;
(async()=>{
  b=await browser(process.argv[2]||'http://127.0.0.1:4173/teacher.html',9284);const {run,send}=b;
  await send('Emulation.setDeviceMetricsOverride',{width:1300,height:1000,deviceScaleFactor:1,mobile:false});
  for(let i=0;i<60;i++){if(await run('!!(window.PetStore&&PetStore.get())'))break;await wait(100);}
  await run("document.getElementById('authGateInput').value='qa123456';document.getElementById('authGateBtn').click()");await wait(300);
  // 音樂圖示：每個都有向量圖，且圖示庫有專屬分類
  const music=await run("PetUtil.CLAY_ICONS.filter(x=>x.sheet==='svg').length");assert(music>=24,'music icons '+music);
  const rendered=await run("(()=>{const n=document.createElement('span');PetUtil.setIconText(n,'clay:m-treble');document.body.append(n);const i=n.querySelector('.clay-icon');const bg=getComputedStyle(i).backgroundImage;n.remove();return bg.startsWith('url(\"data:image/svg+xml')})()");assert(rendered,'svg background renders');
  // 今日任務編輯視窗：和編輯規則同樣版面，可設點數／XP／金幣
  await run("document.querySelector('[data-page=rules]').click()");await wait(300);
  await run("document.querySelector('#sec-tasks .rule-btn').click()");await wait(300);
  const dlg=await run("(()=>{const m=document.querySelector('.modal');return {title:m.querySelector('h2,h3,.modal__title')?.textContent,heading:!!m.querySelector('.rule-edit-heading'),score:m.querySelectorAll('.rule-score-fields input').length,fold:!!m.querySelector('details.rule-icon-fold'),music:[...m.querySelectorAll('.rule-icons__tab')].some(x=>/音樂/.test(x.textContent))}})()");
  assert(dlg.heading&&dlg.score===3&&dlg.fold&&dlg.music,JSON.stringify(dlg));
  const taskId=await run("PetStore.get().dailyTasks[0].id");
  await run("(()=>{const m=document.querySelector('.modal');const set=(s,v)=>{const i=m.querySelector(s);i.value=v;i.dispatchEvent(new Event('input',{bubbles:true}));};set('[data-task-points]','3');set('[data-task-xp]','4');set('[data-task-coins]','2');m.querySelector('details summary').click();[...m.querySelectorAll('.rule-icons__tab')].find(x=>/音樂/.test(x.textContent)).click();m.querySelector('[data-icon=\"clay:m-baton\"]').click();[...m.querySelectorAll('button')].find(x=>x.textContent==='儲存').click();})()");await wait(300);
  const t=await run(`PetStore.get().dailyTasks.find(x=>x.id==='${taskId}')`);assert.equal(t.points,3);assert.equal(t.xp,4);assert.equal(t.coins,2);assert.equal(t.icon,'clay:m-baton');
  // 勾選完成：依三項都加分，且只加一次
  const sid=await run("(()=>{const t=PetStore.get().dailyTasks[0];return PetStore.get().students.find(s=>!t.rewardedBy.includes(s.id)).id})()");const before=await run(`(()=>{const s=PetStore.student('${sid}');return {p:s.points,x:s.xp,c:s.coins}})()`);
  await run(`PetStore.setDailyTaskStudents('${taskId}',['${sid}'])`);
  const after=await run(`(()=>{const s=PetStore.student('${sid}');return {p:s.points,x:s.xp,c:s.coins,l:PetStore.get().ledger[0]}})()`);
  assert.equal(after.p-before.p,3);assert.equal(after.x-before.x,4);assert.equal(after.c-before.c,2);assert(/今日任務/.test(after.l.label));
  await run(`PetStore.setDailyTaskStudents('${taskId}',[]);PetStore.setDailyTaskStudents('${taskId}',['${sid}'])`);
  assert.equal(await run(`PetStore.student('${sid}').points`),after.p,'no double reward');
  // 兌換商店獎勵包
  const shop0=await run('PetStore.get().shop.length');
  await run("document.querySelector('[data-shop-packs]').click()");await wait(250);
  await run("document.querySelector('[data-shop-pack=welfare]').click()");await wait(200);
  await run("document.querySelector('[data-shop-pack=music]').click()");await wait(200);
  const shop1=await run('PetStore.get().shop.length');assert.equal(shop1-shop0,await run("PetModel.SHOP_PACKS.reduce((n,p)=>n+p.items.length,0)"));
  assert.equal(await run("document.querySelector('[data-shop-pack=music]').disabled"),true,'second add disabled');
  assert(await run("PetStore.get().shop.some(x=>x.name==='筆記減半卡')&&PetStore.get().shop.some(x=>x.icon.startsWith('clay:m-'))"));
  // 抽籤整輪排序的圖示跟規則設定一致
  await run("PetStore.commit(s=>{s.rules.push({id:'qa_excellent',label:'回答優秀',icon:'clay:m-music-trophy',points:5,xp:3,coins:3,kind:'add',category:'class'});})");
  assert.equal(await run("PetDrawEngine.performanceList(PetStore.get()).find(x=>x.key==='excellent').icon"),'clay:m-music-trophy');
  assert.equal(b.errors.length,0,JSON.stringify(b.errors));
  console.log('PASS task editor (points/xp/coins), music icons, shop packs, draw icons follow rules');
  b.close();
})().catch(e=>{console.error(e);b?.close();process.exitCode=1;});
