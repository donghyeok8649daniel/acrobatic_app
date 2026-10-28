'use strict';
const { app, BrowserWindow, Menu, shell, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { APP_URL, isAppUrl } = require('./navigation.cjs');
const { consumeFirstLogin } = require('./first-login.cjs');
const fs = require('node:fs');
const offlineFile = path.join(__dirname, 'offline.html');
const offlineUrl = pathToFileURL(offlineFile).href;
const singleInstance = app.requestSingleInstanceLock();
let window;

if (!singleInstance) app.quit();
else {
  app.setName('아크로바틱');
  app.setAppUserModelId('kr.acrobatic.courtin');
  app.on('second-instance', () => {
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.show(); window.focus();
  });
  app.whenReady().then(async () => {
    const profile=app.getPath('userData');
    try {
      const result=await consumeFirstLogin(path.join(profile,'first-login.json'),session.defaultSession);
      if(result)fs.writeFileSync(path.join(profile,'first-login-result.json'),JSON.stringify(result));
    } catch { console.error('Personal entry could not be connected. Please use the team login screen.'); }
    // Remote team pages have no Node.js, preload bridge, or device permissions.
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    window = new BrowserWindow({
      title: '아크로바틱', width: 1440, height: 960,
      minWidth: 760, minHeight: 600, show: false,
      backgroundColor: '#f6f7f9', icon: path.join(__dirname, 'assets/icon.png'),
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, webviewTag: false }
    });
    window.once('ready-to-show', () => window.show());
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    const guardNavigation = (event, target) => {
      if (!isAppUrl(target) && target !== offlineUrl) event.preventDefault();
    };
    window.webContents.on('will-navigate', guardNavigation);
    window.webContents.on('will-redirect', guardNavigation);
    window.webContents.on('will-attach-webview', event => event.preventDefault());
    window.webContents.on('did-fail-load', (_event, code, _description, target, isMainFrame) => {
      if (isMainFrame && code !== -3 && isAppUrl(target)) window.loadFile(offlineFile).catch(() => {});
    });
    window.webContents.on('page-title-updated', event => {
      event.preventDefault(); window.setTitle('아크로바틱');
    });
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: '아크로바틱', submenu: [
        { label: '팀 화면 · 연결 다시 시도', accelerator: 'CmdOrCtrl+Home', click: () => window.loadURL(APP_URL).catch(() => {}) },
        { label: '브라우저에서 열기', click: () => shell.openExternal(APP_URL) },
        { type: 'separator' }, { label: '종료', role: 'quit' }
      ] },
      { label: '편집', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
      { label: '보기', submenu: [{ label: '새로고침', role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] }
    ]));
    window.loadURL(APP_URL).catch(() => {});
  });
  app.on('window-all-closed', () => app.quit());
}
