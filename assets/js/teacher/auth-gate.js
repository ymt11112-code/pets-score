/* 老師後台密碼鎖：不用登入系統（整個 app 沒有伺服器、沒有帳號），純粹是「這台瀏覽器
   記不記得密碼」的陽春保護，擋掉學生隨手打開 teacher.html 就能進去的情況，不是真正的
   帳號安全機制——密碼雜湊值跟「已解鎖」狀態都存在這台裝置的 localStorage，換一台電腦
   或清掉瀏覽器資料就要重新設定；懂得直接用瀏覽器工具看原始碼的人還是繞得過去。

   這支檔案要在其他東西「之前」就跑完，所以 teacher.html 裡用一般 <script>（不要加
   defer），擺在遮罩的 HTML 後面、其他 defer 的 script 前面：這樣遮罩會立刻蓋住畫面，
   避免老師後台的內容在密碼驗證完成前被誰瞄到。真正的 app（app.js）還是會照常在背後
   初始化，只是被這層不透明的遮罩蓋住看不到，解鎖後直接把遮罩收掉就看得到了，不用
   另外處理 app.js 什麼時候才能開始跑的時機問題。

   一次解鎖後會「記住」這台瀏覽器，不用每次打開都重新輸入密碼；如果是教室共用電腦，
   想用完就鎖回去，系統設定頁有一顆「鎖定後台」按鈕可以手動清掉解鎖狀態（密碼本身
   不會被清掉，下次還是用同一組密碼解鎖）。 */
(function () {
  'use strict';
  var LS_HASH = 'classpet.teacherAuthHash';
  var LS_UNLOCK = 'classpet.teacherAuthUnlocked';

  function sha256(text) {
    var enc = new TextEncoder().encode(text);
    return crypto.subtle.digest('SHA-256', enc).then(function (buf) {
      return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
  }

  function getHash() { try { return localStorage.getItem(LS_HASH); } catch (e) { return null; } }
  function setHash(h) { try { localStorage.setItem(LS_HASH, h); } catch (e) { /* 無痕模式存不下去就算了 */ } }
  function clearHash() {
    try { localStorage.removeItem(LS_HASH); } catch (e) {}
    try { localStorage.removeItem(LS_UNLOCK); } catch (e) {}
  }
  function isUnlocked() { try { return localStorage.getItem(LS_UNLOCK) === '1'; } catch (e) { return false; } }
  function markUnlocked() { try { localStorage.setItem(LS_UNLOCK, '1'); } catch (e) {} }
  function lockNow() { try { localStorage.removeItem(LS_UNLOCK); } catch (e) {} location.reload(); }

  window.TeacherAuth = {
    hasPassword: function () { return !!getHash(); },
    isUnlocked: isUnlocked,
    setPassword: function (plain) { return sha256(plain).then(setHash); },
    checkPassword: function (plain) { return sha256(plain).then(function (h) { return h === getHash(); }); },
    clearPassword: clearHash,
    markUnlocked: markUnlocked,
    lockNow: lockNow,
  };

  /* 頂端「🔒 鎖定」按鈕：不管目前是鎖著還解鎖著都要綁，教室共用電腦用完可以手動鎖回去，
     下次要重新輸入密碼；密碼本身不會被清掉，只是把「這台瀏覽器記住的解鎖狀態」清掉。 */
  var lockBtn = document.getElementById('lockBtn');
  if (lockBtn) lockBtn.addEventListener('click', function () { window.TeacherAuth.lockNow(); });

  /* ---------- 畫面上的鎖定遮罩 ---------- */
  var gate = document.getElementById('authGate');
  if (!gate) return; // 這支檔案也可能被其他頁面誤載入，沒有遮罩元素就什麼都不做

  if (isUnlocked()) { gate.classList.add('is-hidden'); return; }

  var titleEl = document.getElementById('authGateTitle');
  var subEl = document.getElementById('authGateSub');
  var input = document.getElementById('authGateInput');
  var msg = document.getElementById('authGateMsg');
  var btn = document.getElementById('authGateBtn');
  var resetBtn = document.getElementById('authGateReset');

  var firstTime = !window.TeacherAuth.hasPassword();
  if (firstTime) {
    titleEl.textContent = '設定老師後台密碼';
    subEl.textContent = '第一次使用，請設定一組密碼。之後打開老師後台要輸入這組密碼；密碼存在這台裝置的瀏覽器裡，解鎖過一次之後這台瀏覽器會記住，不用每次重新輸入。';
    btn.textContent = '設定密碼並進入';
    resetBtn.style.display = 'none';
  } else {
    titleEl.textContent = '老師後台密碼';
    subEl.textContent = '請輸入密碼才能進入老師後台。';
    btn.textContent = '進入';
  }

  function submit() {
    var val = input.value;
    if (!val) { msg.textContent = '請輸入密碼'; return; }
    if (firstTime) {
      if (val.length < 4) { msg.textContent = '密碼至少要 4 個字'; return; }
      window.TeacherAuth.setPassword(val).then(function () {
        window.TeacherAuth.markUnlocked();
        gate.classList.add('is-hidden');
      });
    } else {
      window.TeacherAuth.checkPassword(val).then(function (ok) {
        if (ok) { window.TeacherAuth.markUnlocked(); gate.classList.add('is-hidden'); }
        else { msg.textContent = '密碼錯誤，請再試一次'; input.value = ''; input.focus(); }
      });
    }
  }
  btn.addEventListener('click', submit);
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
  resetBtn.addEventListener('click', function () {
    if (!confirm('忘記密碼的話，只能清除這台瀏覽器存的密碼、重新設定一組新的（不會動到班級資料，只是這台裝置要重新設密碼）。確定要清除嗎？')) return;
    window.TeacherAuth.clearPassword();
    location.reload();
  });
  input.focus();
})();
