const {browser,wait,assert}=require('./browser-test-helper.cjs');let b;
(async()=>{
  b=await browser(process.argv[2]||'http://127.0.0.1:4173/student.html',9288);const {run,send}=b;
  await send('Emulation.setDeviceMetricsOverride',{width:1200,height:1000,deviceScaleFactor:1,mobile:false});
  for(let i=0;i<60;i++){if(await run('!!(window.PetStore&&PetStore.get()&&PetStore.get().students&&PetStore.get().students.length)'))break;await wait(100);}
  const sid=await run("(()=>{const t=PetStore.get().dailyTasks[0];return PetStore.get().students.find(s=>!t.rewardedBy.includes(s.id)).id})()");
  const taskId=await run("PetStore.get().dailyTasks[0].id");
  await run(`localStorage.setItem('classpet.me','${sid}');PetStore.commit(s=>{const t=s.dailyTasks.find(x=>x.id==='${taskId}');t.points=2;t.xp=3;t.coins=1;});PetStore.setDailyTaskStudents('${taskId}',['${sid}']);PetStore.award(['${sid}'],{id:'qa_xp',label:'只有經驗',points:0,xp:4,coins:0},'','QA');location.reload()`);
  await wait(1500);
  await run("[...document.querySelectorAll('#nav [data-view]')].find(x=>/我的寵物/.test(x.textContent)).click()");await wait(500);
  const rows=await run("[...document.querySelectorAll('.timeline-row')].map(r=>({label:r.querySelector('.grow div').textContent,amounts:[...r.querySelectorAll('.timeline-row__pts')].map(x=>x.textContent)}))");
  const task=rows.find(r=>/今日任務/.test(r.label));assert(task,JSON.stringify(rows));assert.deepEqual(task.amounts,['+2 點','+3 XP','🪙 +1']);
  const xp=rows.find(r=>r.label==='只有經驗');assert(xp&&xp.amounts.length===1&&xp.amounts[0]==='+4 XP',JSON.stringify(rows));
  assert.equal(b.errors.length,0,JSON.stringify(b.errors));
  console.log('PASS student records show points, XP, coins and daily-task entries');
  b.close();
})().catch(e=>{console.error(e);b?.close();process.exitCode=1;});
