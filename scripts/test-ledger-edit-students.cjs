const {browser,wait,assert}=require('./browser-test-helper.cjs');let b;
(async()=>{
  b=await browser(process.argv[2]||'http://127.0.0.1:4173/teacher.html',9283);const {run,send}=b;
  await send('Emulation.setDeviceMetricsOverride',{width:1300,height:900,deviceScaleFactor:1,mobile:false});
  for(let i=0;i<60;i++){if(await run('!!(window.PetStore&&PetStore.get())'))break;await wait(100);}
  await run("document.getElementById('authGateInput').value='qa123456';document.getElementById('authGateBtn').click()");await wait(300);
  const ids=await run("PetStore.get().students.slice(0,6).map(s=>s.id)");
  const snap=id=>run(`(()=>{const s=PetStore.student('${id}');return {points:s.points,xp:s.xp,coins:s.coins,total:s.totalPoints||0}})()`);
  const rule={id:'qa_edit_rule',label:'編輯測試',points:2,xp:3,coins:1};
  const [a,c,d,e2,f]=[ids[0],ids[1],ids[2],ids[3],ids[4]];
  const before={};for(const id of ids)before[id]=await snap(id);
  const stars0=await run('PetStore.get().classInfo.classStars||0');
  await run(`PetStore.award(['${a}','${c}','${d}'],${JSON.stringify(rule)},'','QA')`);
  const entryId=await run('PetStore.get().ledger[0].id');
  // 打開編輯紀錄：座號方塊，綠色代表有加分
  await run("document.querySelector('[data-page=ledger]').click()");await wait(300);
  await run("[...document.querySelectorAll('button')].find(x=>x.textContent==='編輯').click()");await wait(250);
  const open=await run("(()=>{const tiles=[...document.querySelectorAll('.ledger-pick-tile')];return {n:tiles.length,on:tiles.filter(t=>t.classList.contains('is-on')).map(t=>t.dataset.pickStudent),total:PetStore.get().students.length,summary:document.querySelector('.ledger-pick-count').textContent}})()");
  assert.equal(open.n,open.total);assert.deepEqual(open.on.sort(),[a,c,d].sort(),'tiles show who was awarded');assert(/已選 3 位/.test(open.summary),open.summary);
  // 取消 d、新增 e2 與 f，再儲存
  await run(`for(const id of ['${d}','${e2}','${f}'])document.querySelector('[data-pick-student="'+id+'"]').click()`);
  assert(await run("/新增 2 位、移除 1 位/.test(document.querySelector('.ledger-pick-diff').textContent)"));
  await run("[...document.querySelectorAll('.modal button')].find(x=>x.textContent==='儲存').click()");await wait(300);
  const entry=await run('PetStore.get().ledger.find(x=>x.id===\''+entryId+'\')');assert.deepEqual([...entry.studentIds].sort(),[a,c,e2,f].sort());
  const after={};for(const id of ids)after[id]=await snap(id);
  assert.equal(after[a].points,before[a].points+2,'kept student unchanged');
  assert.equal(after[d].points,before[d].points,'removed student is fully reverted');assert.equal(after[d].xp,before[d].xp);assert.equal(after[d].coins,before[d].coins);assert.equal(after[d].total,before[d].total);
  assert.equal(after[e2].points,before[e2].points+2,'added student receives the full award');assert.equal(after[e2].xp,before[e2].xp+3);assert.equal(after[e2].coins,before[e2].coins+1);assert.equal(after[f].points,before[f].points+2);
  assert.equal(await run('PetStore.get().classInfo.classStars||0'),stars0+2*4,'class score follows the new head count');
  // 撤銷後全部歸零
  await run(`PetStore.undoEntry('${entryId}')`);
  for(const id of ids){const s=await snap(id);assert.equal(s.points,before[id].points,'undo reverts '+id);assert.equal(s.xp,before[id].xp);}
  assert.equal(await run('PetStore.get().classInfo.classStars||0'),stars0);
  // 清空時不允許儲存
  await run(`PetStore.award(['${a}'],${JSON.stringify(rule)},'','QA')`);await wait(100);
  assert.throws?0:0;
  const err=await run(`(()=>{try{PetStore.editEntry(PetStore.get().ledger[0].id,{studentIds:[]});return 'no error'}catch(e){return e.message}})()`);assert(/至少要選一位/.test(err),err);
  assert.equal(b.errors.length,0,JSON.stringify(b.errors));
  console.log('PASS ledger edit: student tiles, add/remove/keep adjustments, class score, undo, empty-selection guard');
  b.close();
})().catch(e=>{console.error(e);b?.close();process.exitCode=1;});
