const {browser,wait,assert}=require('./browser-test-helper.cjs');let b;
(async()=>{
  b=await browser(process.argv[2]||'http://127.0.0.1:4173/teacher.html',9304);const {run,send}=b;
  await send('Emulation.setDeviceMetricsOverride',{width:1300,height:1000,deviceScaleFactor:1,mobile:false});
  for(let i=0;i<60;i++){if(await run('!!(window.PetStore&&PetStore.get())'))break;await wait(100);}
  await run("document.getElementById('authGateInput').value='qa123456';document.getElementById('authGateBtn').click()");await wait(300);
  await run("(()=>{const st=PetStore.get().students[0];window.__id=st.id;PetStore.award([st.id],{id:'qa-x',label:'XP金幣測試',points:0,xp:7,coins:3},'','t');PetStore.award([st.id],{id:'qa-y',label:'扣分測試',points:-2,xp:0,coins:0},'','t');})()");
  await run("document.querySelector('[data-page=roster]')&&document.querySelector('[data-page=roster]').click()");await wait(300);
  await run("document.querySelector('.roster-card').click()");await wait(400);
  await run("[...document.querySelectorAll('.profile-nav button')].find(x=>x.textContent.includes('點數紀錄')).click()");await wait(300);
  const rows=await run("[...document.querySelectorAll('.profile-content .log-row')].map(r=>({n:r.querySelector('.log-row__name').textContent,a:[...r.querySelectorAll('.log-row__pts')].map(x=>x.textContent)}))");
  console.log(JSON.stringify(rows.slice(0,3)));
  const x=rows.find(r=>r.n==='XP金幣測試'),y=rows.find(r=>r.n==='扣分測試');
  assert.deepEqual(x.a,['+7 XP','🪙 +3']);assert.deepEqual(y.a,['-2 點']);
  assert.equal(b.errors.length,0,JSON.stringify(b.errors));
  console.log('PASS profile ledger lists points, XP and coins');b.close();
})().catch(e=>{console.error(e);b?.close();process.exitCode=1;});
