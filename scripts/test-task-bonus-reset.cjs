const {browser,wait,assert}=require('./browser-test-helper.cjs');let b;
(async()=>{
  b=await browser(process.argv[2]||'http://127.0.0.1:4173/teacher.html',9294);const {run,send}=b;
  await send('Emulation.setDeviceMetricsOverride',{width:1300,height:1000,deviceScaleFactor:1,mobile:false});
  for(let i=0;i<60;i++){if(await run('!!(window.PetStore&&PetStore.get())'))break;await wait(100);}
  await run("document.getElementById('authGateInput').value='qa123456';document.getElementById('authGateBtn').click()");await wait(300);
  const T=await run("PetStore.get().dailyTasks[0].id");
  const students=await run("PetStore.get().students.map(s=>s.id)");const absent=students[0],present=students.slice(1);
  await run(`PetStore.commit(s=>{const t=s.dailyTasks.find(x=>x.id==='${T}');t.points=0;t.xp=0;t.coins=0;t.bonusClass=5;t.bonusPoints=1;t.bonusXp=2;t.bonusCoins=0;t.doneBy=[];t.rewardedBy=[];t.done=0;t.bonusDone=false;});PetStore.setAttendance('${absent}','sick')`);
  const snap=id=>run(`(()=>{const s=PetStore.student('${id}');return [s.points,s.xp]})()`);
  const before=await snap(present[0]),beforeAbsent=await snap(absent),stars0=await run("PetStore.get().classInfo.classStars||0");
  // 差最後一位：不觸發
  let r=await run(`PetStore.setDailyTaskStudents('${T}',${JSON.stringify(present.slice(0,-1))})`);assert.equal(r.bonus,null);
  assert.equal(await run("PetStore.get().classInfo.classStars||0"),stars0);
  // 最後一位完成：觸發一次（請假的同學不用勾）
  r=await run(`PetStore.setDailyTaskStudents('${T}',${JSON.stringify(present)})`);assert(r.bonus&&/班級分數 \+5/.test(r.bonus.text),JSON.stringify(r));
  assert.equal(await run("PetStore.get().classInfo.classStars||0"),stars0+5);
  const after=await snap(present[0]);assert.equal(after[0]-before[0],1);assert.equal(after[1]-before[1],2);
  assert.deepEqual(await snap(absent),beforeAbsent,'absent student gets no bonus');
  assert(/全班完成/.test(await run("PetStore.get().ledger[0].label")));
  assert.equal(await run(`PetStore.get().dailyTasks.find(x=>x.id==='${T}').bonusDone`),true);
  r=await run(`PetStore.setDailyTaskStudents('${T}',${JSON.stringify(present.concat([absent]))})`);assert.equal(r.bonus,null,'bonus only once a day');
  assert.equal(await run("PetStore.get().classInfo.classStars||0"),stars0+5);
  // 隔天自動重設
  await run("PetStore.commit(s=>{s.dailyTaskDate='2000-01-01';})");
  assert.equal(await run("PetStore.rollDailyTasks()"),true);
  const t=await run(`PetStore.get().dailyTasks.find(x=>x.id==='${T}')`);assert.equal(t.doneBy.length,0);assert.equal(t.rewardedBy.length,0);assert.equal(t.bonusDone,false);assert.equal(t.done,0);
  assert.equal(await run("PetStore.rollDailyTasks()"),false,'same day does nothing');
  // 關閉自動重設：隔天不清；第一次啟用（沒有日期）也不清
  await run(`PetStore.setDailyTaskStudents('${T}',['${present[0]}']);PetStore.commit(s=>{s.settings.dailyTaskAutoReset=false;s.dailyTaskDate='2000-01-01';})`);
  assert.equal(await run("PetStore.rollDailyTasks()"),false);assert.equal(await run(`PetStore.get().dailyTasks.find(x=>x.id==='${T}').doneBy.length`),1);
  await run("PetStore.commit(s=>{s.settings.dailyTaskAutoReset=true;delete s.dailyTaskDate;})");
  assert.equal(await run("PetStore.rollDailyTasks()"),false);assert.equal(await run(`PetStore.get().dailyTasks.find(x=>x.id==='${T}').doneBy.length`),1,'first run only stamps the date');
  // 規則設定頁：全班完成獎勵欄位、自動重設開關、立即重設
  await run("document.querySelector('[data-page=rules]').click()");await wait(300);
  assert(await run("!!document.querySelector('[data-task-auto-reset]')&&!!document.querySelector('[data-task-reset-now]')"));
  await run("document.querySelector('#sec-tasks .rule-btn').click()");await wait(300);
  const f=await run("(()=>{const m=document.querySelector('.modal');return ['bonus-class','bonus-points','bonus-xp','bonus-coins'].map(k=>!!m.querySelector('[data-'+k+']'))})()");assert.deepEqual(f,[true,true,true,true]);
  await run("(()=>{const m=document.querySelector('.modal');const s=(k,v)=>{const i=m.querySelector('[data-'+k+']');i.value=v;};s('bonus-class','8');s('bonus-points','2');[...m.querySelectorAll('button')].find(x=>x.textContent==='儲存').click();})()");await wait(300);
  const saved=await run(`PetStore.get().dailyTasks.find(x=>x.id==='${T}')`);assert.equal(saved.bonusClass,8);assert.equal(saved.bonusPoints,2);
  await run("document.querySelector('[data-task-reset-now]').click()");await wait(250);
  await run("[...document.querySelectorAll('.modal button')].find(x=>x.textContent==='重設').click()");await wait(250);
  assert.equal(await run(`PetStore.get().dailyTasks.find(x=>x.id==='${T}').doneBy.length`),0);
  assert.equal(b.errors.length,0,JSON.stringify(b.errors));
  console.log('PASS task all-class bonus triggers once on last present student; daily auto reset, opt-out, manual reset');
  b.close();
})().catch(e=>{console.error(e);b?.close();process.exitCode=1;});
