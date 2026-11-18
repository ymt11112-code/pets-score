const {browser,wait,assert}=require('./browser-test-helper.cjs');let b;
(async()=>{
  b=await browser(process.argv[2]||'http://127.0.0.1:4173/teacher.html',9292);const {run,send}=b;
  await send('Emulation.setDeviceMetricsOverride',{width:1400,height:1000,deviceScaleFactor:1,mobile:false});
  for(let i=0;i<60;i++){if(await run('!!(window.PetStore&&PetStore.get())'))break;await wait(100);}
  await run("document.getElementById('authGateInput').value='qa123456';document.getElementById('authGateBtn').click()");await wait(300);
  const ids=await run("PetStore.get().students.slice(0,3).map(s=>s.id)");
  const pick=v=>run(`(()=>{const s=document.querySelector('[data-current-subject]');s.value='${v}';s.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  const tot=(id,k)=>run(`(PetStore.subjectTotals()['${id}']||{})['${k}']||[0,0]`);
  // 頂端科目選單：預設清單、切換會存起來
  assert.deepEqual(await run("[...document.querySelectorAll('[data-current-subject] option')].map(o=>o.value).filter(Boolean).slice(0,3)"),['國語','數學','社會']);
  await pick('國語');await wait(200);assert.equal(await run("PetStore.get().settings.currentSubject"),'國語');
  const rule={id:'qs1',label:'科目測試',points:2,xp:1,coins:0};
  await run(`PetStore.award(${JSON.stringify(ids)},${JSON.stringify(rule)},'','QA')`);
  const e1=await run("PetStore.get().ledger[0]");assert.equal(e1.subject,'國語');assert.deepEqual(await tot(ids[0],'國語'),[2,1]);
  await pick('數學');await wait(200);
  await run(`PetStore.award(['${ids[0]}'],{id:'qs2',label:'數學測試',points:3,xp:0,coins:0},'','QA')`);
  const e2=await run("PetStore.get().ledger[0]");assert.equal(e2.subject,'數學');assert.deepEqual(await tot(ids[0],'數學'),[3,1]);
  await run(`PetStore.undoEntry('${e2.id}')`);assert.deepEqual(await tot(ids[0],'數學'),[0,0],'undo reverses the subject tally');
  // 編輯：改科目與點數，累計跟著搬家
  await run(`PetStore.editEntry('${e1.id}',{points:4,subject:'社會'})`);
  assert.deepEqual(await tot(ids[1],'國語'),[0,0]);assert.deepEqual(await tot(ids[1],'社會'),[4,1]);
  await run(`PetStore.editEntry('${e1.id}',{points:2,subject:'國語'})`);
  // 今日任務、兌換不算課堂表現
  const t=await run("PetStore.get().dailyTasks[0].id");
  await run(`PetStore.commit(s=>{const k=s.dailyTasks.find(x=>x.id==='${t}');k.points=5;k.xp=0;k.coins=0;k.doneBy=[];k.rewardedBy=[];});PetStore.setDailyTaskStudents('${t}',['${ids[2]}'])`);
  assert.equal(await run("PetStore.get().ledger[0].subject"),'','daily task entries carry no subject');
  assert.deepEqual(await tot(ids[2],''),[0,0]);
  // 點數紀錄頁：科目欄與篩選
  await run("document.querySelector('[data-page=ledger]').click()");await wait(300);
  assert(await run("[...document.querySelectorAll('.tbl th')].some(x=>x.textContent==='科目')"));
  await run("(()=>{const s=[...document.querySelectorAll('.tbl-toolbar select')].find(x=>[...x.options].some(o=>o.text==='全部科目'));s.value='國語';s.dispatchEvent(new Event('change',{bubbles:true}))})()");await wait(250);
  const filtered=await run("[...document.querySelectorAll('.tbl tbody tr')].map(r=>r.textContent)");assert(filtered.length===1&&/科目測試/.test(filtered[0])&&/國語/.test(filtered[0]),JSON.stringify(filtered));
  // 科目統計（學期累計與時間範圍）
  await run("document.querySelector('[data-ledger-tab=subjects]').click()");await wait(300);
  await run("document.querySelector('[data-subject-mode=term]').click()");await wait(250);
  const term=await run("(()=>{const rows=[...document.querySelectorAll('[data-subject-table] tbody tr')].map(r=>[...r.children].map(x=>x.textContent.trim()));return {head:[...document.querySelectorAll('[data-subject-table] th')].map(x=>x.textContent),first:rows[0],last:rows[rows.length-1]}})()");
  assert(term.head.includes('國語')&&term.head.includes('合計'),JSON.stringify(term.head));assert(/2/.test(term.first[1]),JSON.stringify(term.first));
  await run("document.querySelector('[data-subject-mode=range]').click()");await wait(250);
  assert(await run("!!document.querySelector('[data-subject-table]')"));
  // 管理科目
  await run("document.querySelector('#subjectPick .btn').click()");await wait(250);
  await run("(()=>{const i=document.querySelector('[data-subject-input]');i.value='閩南語';i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));[...document.querySelectorAll('.modal button')].find(x=>x.textContent==='儲存').click();})()");await wait(250);
  assert(await run("PetStore.subjects().includes('閩南語')"));
  // 抽籤整輪排序：再點一次取消加分
  await run("document.querySelector('[data-page=tools]').click()");await wait(400);
  await run("document.querySelector('[data-draw-order]').click()");await wait(500);
  const sid=await run("document.querySelector('.dc-order-item [data-perform-for]').dataset.performFor");
  const p0=await run(`PetStore.student('${sid}').points`),n0=await run("PetStore.get().ledger.filter(e=>!e.undone).length");
  await run("document.querySelector('.dc-order-item [data-perform=complete]').click()");await wait(400);
  assert(await run(`PetStore.student('${sid}').points`)>p0);assert.equal(await run("document.querySelector('.dc-order-item [data-perform=complete]').classList.contains('is-done')"),true);
  await run("document.querySelector('.dc-order-item [data-perform=complete]').click()");await wait(400);
  assert.equal(await run(`PetStore.student('${sid}').points`),p0,'second click cancels the award');
  assert.equal(await run("PetStore.get().ledger.filter(e=>!e.undone).length"),n0);
  assert.equal(await run("document.querySelector('.dc-order-item [data-perform=complete]').classList.contains('is-done')"),false);
  await run("document.querySelector('.dc-order-item [data-perform=complete]').click()");await wait(400);
  assert(await run(`PetStore.student('${sid}').points`)>p0,'can award again after cancel');
  assert.equal(b.errors.length,0,JSON.stringify(b.errors));
  console.log('PASS subjects stamped/tallied/edited/undone, subject filter + stats + manager, draw perform toggles off');
  b.close();
})().catch(e=>{console.error(e);b?.close();process.exitCode=1;});
