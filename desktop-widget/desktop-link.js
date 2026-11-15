/* Windows 網頁入口只負責喚醒工具，不接受網址傳入的班級設定或指令。 */
const fs = require('fs');
const path = require('path');
const SCHEME = 'classpet';
function isDesktopLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === SCHEME + ':' && url.hostname === 'open' &&
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
module.exports = { SCHEME, isDesktopLink, registerDesktopLink };
