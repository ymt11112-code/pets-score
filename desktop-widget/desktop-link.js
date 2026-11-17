/* Windows 網頁入口只喚醒工具或開啟本機電子書設定，不接受網址傳入的班級、檔案路徑或啟動參數。 */
const fs = require('fs');
const path = require('path');
const SCHEME = 'classpet';
function isDesktopLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === SCHEME + ':' && ['open','ebooks','launcher','standby'].includes(url.hostname) &&
      (url.pathname === '' || url.pathname === '/') && !url.username && !url.password && !url.port && !url.search && !url.hash;
  } catch (e) { return false; }
}
function registerDesktopLink(app) {
  if (process.platform !== 'win32' || !app.isPackaged) return false;
  // portable 每次會解壓到不同暫存路徑，必須註冊原始可攜式 EXE 的位置。
  const executable = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
  if (!path.isAbsolute(executable) || !fs.existsSync(executable)) return false;
  return app.setAsDefaultProtocolClient(SCHEME, executable);
}
function isEbookLink(value){try{return isDesktopLink(value)&&new URL(value).hostname==='ebooks';}catch{return false;}}
function isLauncherLink(value){try{return isDesktopLink(value)&&new URL(value).hostname==='launcher';}catch{return false;}}
function isStandbyLink(value){try{return isDesktopLink(value)&&new URL(value).hostname==='standby';}catch{return false;}}
module.exports = { isStandbyLink, isLauncherLink, isEbookLink, SCHEME, isDesktopLink, registerDesktopLink };
