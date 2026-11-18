const {browser,wait,assert}=require('./browser-test-helper.cjs');let b;
(async()=>{
  b=await browser(process.argv[2]||'http://127.0.0.1:4173/teacher.html',9283);
  await b.send('Emulation.setDeviceMetricsOverride',{width:1400,height:900,deviceScaleFactor:1,mobile:false});
  for(let i=0;i<60;i++){if(await b.run('!!(window.PetStore&&PetStore.get()&&window.PetTimerAlarm)'))break;await wait(100);}
  await b.run("document.getElementById('authGateInput').value='qa123456';document.getElementById('authGateBtn').click();document.querySelector('[data-page=tools]').click();[...document.querySelectorAll('button')].find(x=>x.textContent==='⏱️ 計時器').click()");
  await wait(300);
  assert(await b.run("!!document.querySelector('[data-timer-alarm-panel]')"),'alarm settings panel is shown in the timer');
  const sounds=await b.run("[...document.querySelectorAll('[data-timer-alarm-panel] select')[0].options].map(o=>o.value)");
  assert(sounds.length>=7&&sounds.includes('school')&&sounds.includes('none'),JSON.stringify(sounds));
  await b.run("(()=>{const s=document.querySelector('[data-timer-alarm-panel] select');s.value='bell';s.dispatchEvent(new Event('change'))})()");
  assert.equal(await b.run("PetTimerAlarm.get().sound"),'bell');
  assert.equal(await b.run("JSON.parse(localStorage.getItem('classpet.timerAlarm.v1')).sound"),'bell','setting is remembered on this device');
  // 試聽：每一種鈴聲都能排程，不丟例外
  for(const id of sounds){const length=await b.run(`PetTimerAlarm.preview({sound:'${id}',repeat:1,volume:30})`);assert(id==='none'?length===0:length>1,id+' '+length);}
  await b.run("PetTimerAlarm.stop()");
  // 時間到：出現動畫並可關閉
  await b.run("PetLessonTimer.clock.configure({mode:'down',seconds:1});PetLessonTimer.clock.start()");await wait(1900);
  const shown=await b.run("(()=>{const o=document.querySelector('.timer-alarm-overlay');return o?{text:o.textContent,role:o.getAttribute('role'),full:o.getBoundingClientRect().width>=document.documentElement.clientWidth-1}:null})()");
  assert(shown&&/時間到/.test(shown.text)&&shown.full,JSON.stringify(shown));
  await b.run("document.querySelector('.timer-alarm-overlay').click()");await wait(200);
  assert.equal(await b.run("!!document.querySelector('.timer-alarm-overlay')"),false,'click dismisses the alarm');
  // 關閉動畫後只出聲音，不蓋住畫面
  await b.run("PetTimerAlarm.set({animation:false});PetLessonTimer.clock.configure({mode:'down',seconds:1});PetLessonTimer.clock.start()");await wait(1900);
  assert.equal(await b.run("!!document.querySelector('.timer-alarm-overlay')"),false,'animation can be turned off');
  assert.equal(b.errors.length,0,JSON.stringify(b.errors));
  console.log('PASS timer alarm: sound choices, remembered settings, full-screen animation, dismiss, animation off');
  b.close();
})().catch(e=>{console.error(e);b?.close();process.exitCode=1;});
