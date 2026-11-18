const {browser,wait,assert}=require('./browser-test-helper.cjs');let b;
(async()=>{
  b=await browser(process.argv[2]||'http://127.0.0.1:4173/teacher.html',9286);const {run,send}=b;
  await send('Emulation.setDeviceMetricsOverride',{width:1400,height:1000,deviceScaleFactor:1,mobile:false});
  for(let i=0;i<60;i++){if(await run('!!(window.PetStore&&PetStore.get())'))break;await wait(100);}
  await run("document.getElementById('authGateInput').value='qa123456';document.getElementById('authGateBtn').click()");await wait(300);
  // 造 2026-03 三天的紀錄：3/2 全員出席；3/3 第一位病假、第二位遲到；3/4 第一位事假
  const ids=await run("PetStore.get().students.slice(0,2).map(s=>s.id)");const [a,c]=ids;
  await run(`PetStore.setAllAttendance(PetStore.get().students.map(s=>s.id),'','2026-03-02');PetStore.setAllAttendance(PetStore.get().students.map(s=>s.id),'','2026-03-03');PetStore.setAttendance('${a}','sick','2026-03-03');PetStore.setAttendance('${c}','late','2026-03-03');PetStore.setAllAttendance(PetStore.get().students.map(s=>s.id),'','2026-03-04');PetStore.setAttendance('${a}','personal','2026-03-04')`);
  await run("document.querySelector('[data-page=ledger]').click()");await wait(250);
  await run("[...document.querySelectorAll('button')].find(x=>x.textContent.includes('出席記錄')).click()");await wait(250);
  // 指定日期 → 週視圖跳到那一週
  const setDate=v=>run(`(()=>{const i=document.querySelector('[data-attendance-date]');i.value='${v}';i.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await setDate('2026-03-03');await wait(250);
  assert.equal(await run("document.querySelector('[data-attendance-label]').textContent"),'2026/03/02 – 2026/03/08');
  // 單日
  await run("document.querySelector('[data-attendance-mode=day]').click()");await wait(250);
  assert(/2026\/03\/03（週二）/.test(await run("document.querySelector('[data-attendance-label]').textContent")));
  const day=await run("({rows:document.querySelectorAll('[data-attendance-view=day] tbody tr').length,txt:document.querySelector('.card').textContent})");
  assert.equal(day.rows,await run('PetStore.get().students.length'));assert(/病假 1/.test(day.txt)&&/遲到 1/.test(day.txt),day.txt.slice(0,300));
  await run("document.querySelector('[data-attendance-next]').click()");await wait(200);
  assert(/03\/04/.test(await run("document.querySelector('[data-attendance-label]').textContent")));
  await setDate('2026-03-20');await wait(250);assert(/沒有出席紀錄/.test(await run("document.querySelector('.empty').textContent")));
  // 整月統計
  await setDate('2026-03-15');await run("document.querySelector('[data-attendance-mode=month]').click()");await wait(250);
  assert.equal(await run("document.querySelector('[data-attendance-label]').textContent"),'2026 年 3 月');
  const m=await run("(()=>{const rows=[...document.querySelectorAll('[data-attendance-view=month] tbody tr')].map(r=>[...r.children].map(x=>x.textContent.trim()));return {first:rows[0],second:rows[1],summary:document.querySelector('.card .pill').textContent,all:document.querySelector('.card').textContent}})()");
  assert(/3 \/ 31/.test(m.summary),m.summary);
  // 第一位：記錄 3 天、出席 1、病假 1、事假 1；到校率 33%（病假、事假都算缺）
  assert.equal(m.first[1],'3');assert.equal(m.first[2],'1');assert.equal(m.first[4],'1');assert.equal(m.first[5],'1');assert(/33%/.test(m.first[9]),JSON.stringify(m.first));assert(/3\/3 病假/.test(m.first[10])&&/3\/4 事假/.test(m.first[10]),m.first[10]);
  // 第二位：遲到仍算到校 → 100%
  assert.equal(m.second[3],'1');assert(/100%/.test(m.second[9]),JSON.stringify(m.second));
  // 上個月／下個月
  await run("document.querySelector('[data-attendance-next]').click()");await wait(200);assert.equal(await run("document.querySelector('[data-attendance-label]').textContent"),'2026 年 4 月');
  assert(/還沒有出席紀錄/.test(await run("document.querySelector('.empty').textContent")));
  assert.equal(b.errors.length,0,JSON.stringify(b.errors));
  console.log('PASS attendance history: day/week/month views, jump-to-date, monthly stats, late counts as present');
  b.close();
})().catch(e=>{console.error(e);b?.close();process.exitCode=1;});
