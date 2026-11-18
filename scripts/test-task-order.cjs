const {browser,wait,assert}=require('./browser-test-helper.cjs');let b;
(async()=>{
  b=await browser(process.argv[2]||'http://127.0.0.1:4173/teacher.html',9297);const {run,send}=b;
  await send('Emulation.setDeviceMetricsOverride',{width:1300,height:1000,deviceScaleFactor:1,mobile:false});
  for(let i=0;i<60;i++){if(await run('!!(window.PetStore&&PetStore.get())'))break;await wait(100);}
  await run("document.getElementById('authGateInput').value='qa123456';document.getElementById('authGateBtn').click()");await wait(300);
  const order=()=>run("PetStore.get().dailyTasks.map(t=>t.id)");
  const o0=await order();assert(o0.length>=3);
  await run("document.querySelector('[data-page=rules]').click()");await wait(300);
  // 拖曳：把第一張卡片放到第三張上
  await run(`(()=>{const cards=[...document.querySelectorAll('#sec-tasks [data-task-id]')],dt=new DataTransfer();cards[0].dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));cards[2].dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));cards[2].dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));cards[0].dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:dt}));})()`);await wait(300);
  const o1=await order();assert.deepEqual(o1,[o0[1],o0[0],o0[2]].concat(o0.slice(3)),'drag moves the card: '+JSON.stringify(o1));
  assert.deepEqual(await run("[...document.querySelectorAll('#sec-tasks [data-task-id]')].map(x=>x.dataset.taskId)"),o1,'cards re-render in the new order');
  // 編輯視窗：往後／往前
  await run("document.querySelector('#sec-tasks [data-task-id]').click()");await wait(300);
  await run("document.querySelector('[data-task-move=down]').click()");await wait(250);
  const o2=await order();assert.equal(o2[1],o1[0]);assert.equal(o2[0],o1[1]);
  await run("document.querySelector('[data-task-move=up]').click()");await wait(250);
  assert.deepEqual(await order(),o1);
  assert.equal(b.errors.length,0,JSON.stringify(b.errors));
  console.log('PASS daily tasks reorder by drag and by move buttons');
  b.close();
})().catch(e=>{console.error(e);b?.close();process.exitCode=1;});
