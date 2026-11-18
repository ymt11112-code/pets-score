const {browser,wait,assert}=require('./browser-test-helper.cjs');let b;
(async()=>{
  b=await browser('http://127.0.0.1:4173/teacher.html',9281);
  await b.send('Emulation.setDeviceMetricsOverride',{width:1400,height:900,deviceScaleFactor:1,mobile:false});
  for(let i=0;i<60;i++){if(await b.run('!!window.PetExamBoard&&!!window.PetStore'))break;await wait(100);}
  await b.run("document.getElementById('authGateInput').value='qa123456';document.getElementById('authGateBtn').click();document.querySelector('[data-page=tools]').click();[...document.querySelectorAll('button')].find(b=>b.textContent==='⏱️ 計時器').click();document.querySelector('[data-timer-view=exam]').click()");
  await wait(300);
  const labels=await b.run("[...document.querySelectorAll('.exam-toolbar button')].map(x=>x.textContent)");
  assert.deepEqual(labels,['⚙️ 考試設定','⛶ 全螢幕看板'],'toolbar buttons must not repeat: '+labels.join('|'));
  assert.equal(await b.run("document.querySelectorAll('.exam-board summary').length"),0,'no second settings control under the board');
  assert.equal(await b.run("document.querySelector('.exam-settings').hidden"),true,'settings stay hidden until the toolbar button is used');
  await b.run("document.querySelector('.exam-toolbar button').click()");assert.equal(await b.run("document.querySelector('.exam-settings').hidden"),false);await b.run("document.querySelector('.exam-toolbar button').click()");assert.equal(await b.run("document.querySelector('.exam-settings').hidden"),true);
  await b.run("[...document.querySelectorAll('.exam-toolbar button')].find(x=>x.textContent.includes('全螢幕')).click()");
  await wait(500);
  const state=await b.run("(()=>{const board=document.querySelector('.exam-board'),r=board.getBoundingClientRect();return {real:document.fullscreenElement===board,projecting:board.classList.contains('is-projecting'),full:r.width===innerWidth&&r.height===innerHeight,top:board.parentNode===document.body}})()");
  assert(state.projecting&&state.real&&state.full&&state.top,JSON.stringify(state));
  await b.run("document.querySelector('.exam-exit-projection').click()");
  await wait(400);
  const after=await b.run("(()=>{const board=document.querySelector('.exam-board');return {real:!!document.fullscreenElement,projecting:board.classList.contains('is-projecting'),inModal:!!board.closest('.modal'),toolbar:getComputedStyle(board.querySelector('.exam-toolbar')).display}})()");
  assert(!after.real&&!after.projecting&&after.inModal&&after.toolbar!=='none',JSON.stringify(after));
  await b.run("[...document.querySelectorAll('.exam-toolbar button')].find(x=>x.textContent.includes('全螢幕')).click()");
  await wait(400);
  await b.run("document.exitFullscreen()");await wait(400);
  assert.equal(await b.run("document.querySelector('.exam-board').classList.contains('is-projecting')"),false,'leaving browser fullscreen also leaves projection');
  assert(await b.run("!!document.querySelector('.exam-board').closest('.modal')"));
  assert.equal(b.errors.length,0,JSON.stringify(b.errors));
  console.log('PASS exam toolbar has one settings and one fullscreen button; fullscreen enters, exits and returns to the modal');
  b.close();
})().catch(e=>{console.error(e);b?.close();process.exitCode=1;});
