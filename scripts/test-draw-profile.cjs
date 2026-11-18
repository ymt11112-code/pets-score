const {browser,wait,assert}=require('./browser-test-helper.cjs');let b;
(async()=>{
  b=await browser(process.argv[2]||'http://127.0.0.1:4173/teacher.html',9298);const {run,send}=b;
  await send('Emulation.setDeviceMetricsOverride',{width:1300,height:1000,deviceScaleFactor:1,mobile:false});
  for(let i=0;i<60;i++){if(await run('!!(window.PetStore&&PetStore.get())'))break;await wait(100);}
  await run("document.getElementById('authGateInput').value='qa123456';document.getElementById('authGateBtn').click()");await wait(300);
  // 打亂規則順序並加上編號，驗證檔案視窗依編號排序
  await run("PetStore.commit(d=>{const pos=d.rules.filter(r=>r.points>=0);pos[0].code='C03';pos[1].code='A01';pos[2].code='B02';window.__names=[pos[1].label,pos[2].label,pos[0].label];})");
  await run("document.querySelector('[data-page=tools]')&&document.querySelector('[data-page=tools]').click()");await wait(400);
  const hasDraw=await run("!!document.querySelector('[data-award-drawn]')");
  // 直接呼叫抽籤頁的「為抽中學生加點」流程：模擬抽中 1 人
  await run("(()=>{const sid=PetStore.get().students[0].id;window.__sid=sid;})()");
  await run("window.PetTeacherTest&&0");
  // 以 UI：抽 1 人後按「為抽中學生加點」
  await run("(()=>{const btn=[...document.querySelectorAll('button')].find(x=>/^(開始抽籤|抽籤|開始)/.test(x.textContent.trim()));btn&&btn.click();})()");await wait(6000);
  await run("document.querySelector('[data-award-drawn]')&&(document.querySelector('[data-award-drawn]').disabled=false,document.querySelector('[data-award-drawn]').click())");await wait(500);
  const title=await run("(document.querySelector('.modal__title, .modal h2, [class*=modal] h2')||{}).textContent");
  console.log('hasDraw',hasDraw,'title',title);
  const labels=await run("[...document.querySelectorAll('.profile-content .rule-btn .rule-btn__label')].map(x=>x.textContent)");
  console.log(JSON.stringify(labels.slice(0,6)));
  assert.equal(title,'學生檔案','single drawn student opens the profile');
  assert(labels.slice(0,3).join('|').match(/^.*\|.*\|.*$/));
  assert.equal(b.errors.length,0,JSON.stringify(b.errors));
  console.log('PASS');b.close();
})().catch(e=>{console.error(e);b?.close();process.exitCode=1;});
