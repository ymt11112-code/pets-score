const {browser,wait,assert}=require('./browser-test-helper.cjs');let b;
(async()=>{
  b=await browser(process.argv[2]||'http://127.0.0.1:4173/teacher.html',9296);const {run,send}=b;
  await send('Emulation.setDeviceMetricsOverride',{width:1400,height:1000,deviceScaleFactor:1,mobile:false});
  for(let i=0;i<60;i++){if(await run('!!(window.PetStore&&PetStore.get())'))break;await wait(100);}
  await run("document.getElementById('authGateInput').value='qa123456';document.getElementById('authGateBtn').click()");await wait(300);
  // 全班目標不能超過全班人數
  const n=await run("PetStore.get().students.length");
  assert.equal(await run(`PetModel.taskTarget({target:40},${n})`),Math.min(40,n));assert.equal(await run(`PetModel.taskTarget({target:3},${n})`),3);assert.equal(await run(`PetModel.taskTarget({target:0},${n})`),n);
  await run("PetStore.commit(s=>{s.dailyTasks[0].target=40;})");
  await run("document.querySelector('[data-page=rules]').click()");await wait(300);
  await run("document.querySelector('#sec-tasks .rule-btn').click()");await wait(300);
  assert.equal(await run("document.querySelector('.modal input[type=number]').value"),String(n),'editor shows the capped target');
  await run("(()=>{const i=document.querySelector('.modal input[type=number]');i.value='99';[...document.querySelectorAll('.modal button')].find(x=>x.textContent==='儲存').click();})()");await wait(300);
  assert.equal(await run("PetStore.get().dailyTasks[0].target"),n,'saving clamps to class size');
  // 兌換：目前點數減少，各科原始紀錄不變
  const sid=await run("PetStore.get().students[0].id");
  await run(`PetStore.setCurrentSubject('國語');PetStore.award(['${sid}'],{id:'qr1',label:'兌換測試',points:50,xp:0,coins:0},'','QA')`);
  const cost=await run("PetStore.get().shop.find(i=>i.stock>0).cost"),item=await run("PetStore.get().shop.find(i=>i.stock>0).id");
  const before=await run(`PetStore.student('${sid}').points`);
  const r=await run(`PetStore.redeem('${sid}','${item}')`);assert(r.ok,JSON.stringify(r));
  assert.equal(await run(`PetStore.student('${sid}').points`),before-cost,'visible balance goes down');
  assert.deepEqual(await run(`PetStore.subjectTotals()['${sid}']['國語']`),[50,1],'subject totals keep the original earned points');
  await run("document.querySelector('[data-page=ledger]').click()");await wait(300);
  await run("document.querySelector('[data-ledger-tab=subjects]').click()");await wait(250);
  for(const mode of ['range','term']){
    await run(`document.querySelector('[data-subject-mode=${mode}]').click()`);await wait(250);
    const row=await run("[...document.querySelector('[data-subject-table] tbody tr').children].map(x=>x.querySelector('b')?x.querySelector('b').textContent:x.textContent.trim())");
    const head=await run("[...document.querySelectorAll('[data-subject-table] th')].map(x=>x.textContent)");
    assert(head.includes('目前點數')&&head.includes('兌換花費'),JSON.stringify(head));
    assert.equal(row[1].replace(/\s*\d+ 次$/,''),'50',mode+' '+JSON.stringify(row));
    assert.equal(row[row.length-2],String(before-cost));assert.equal(row[row.length-1],'−'+cost);
  }
  assert.equal(b.errors.length,0,JSON.stringify(b.errors));
  console.log('PASS task target capped to class size; redeem lowers balance but subject stats keep earned points');
  b.close();
})().catch(e=>{console.error(e);b?.close();process.exitCode=1;});
