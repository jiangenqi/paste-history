const { app, BrowserWindow, clipboard, nativeImage, ipcMain, globalShortcut, Tray, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const database = require('./database');
const i18n = require('./renderer/i18n.js');

// 主进程文案查找（跟随当前设置的语言）
function tr(key, params) {
  return i18n.t((loadSettings().language) || 'zh', key, params);
}

// 单实例锁 — 点击桌面快捷方式时唤起已有窗口
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (eyeWindow && !eyeWindow.isDestroyed()) {
      eyeWindow.hide();
    }
    stopEyeIdleTracking();
    hideCompanion();
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

let mainWindow = null;
let eyeWindow = null;
let companionWindow = null;
let tray = null;
let clipboardTimer = null;
let lastText = '';
let lastImageHash = '';
let lastFileHash = '';
let currentShortcut = 'Alt+V';
let desktopPinned = false;

// ==================== 数据初始化 ====================
async function initData() {
  database.ensureDirectories();
  await database.initDB();
}

// ==================== 窗口管理 ====================

// 窗口安全加固：拒绝 window.open 与跳转到非本地内容
function hardenWindow(win) {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://') && !url.startsWith('data:')) {
      event.preventDefault();
    }
  });
}

// IPC 调用者校验：只接受应用自身窗口主 frame 的调用
function isTrustedSender(event) {
  const frame = event.senderFrame;
  return !!(frame && frame === event.sender.mainFrame);
}

function createWindow() {
  const savedBounds = loadWindowBounds();

  mainWindow = new BrowserWindow({
    width: savedBounds.width || 400,
    height: savedBounds.height || 560,
    x: savedBounds.x,
    y: savedBounds.y,
    frame: false,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    backgroundColor: '#F2F2F7',
    resizable: true,
    minWidth: 320,
    minHeight: 400,
    skipTaskbar: false,
    focusable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  hardenWindow(mainWindow);

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.setTitle('PasteHistory');

  // ── 窗口始终留在任务栏，点击外面不消失 ──
  // 只有 ✕ 关闭按钮会 hide()，其余情况用 minimize()

  mainWindow.on('show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus();
    }
  });

  // 用户从任务栏恢复主窗口时，退出眼睛模式，避免两者同时存在
  mainWindow.on('restore', () => {
    if (eyeWindow && !eyeWindow.isDestroyed() && eyeWindow.isVisible()) {
      stopEyeIdleTracking();
      hideCompanion();
      eyeWindow.hide();
    }
  });

  // 窗口移动/调整大小时保存位置
  mainWindow.on('moved', saveWindowBounds);
  mainWindow.on('resize', saveWindowBounds);
}

function toggleWindow() {
  if (eyeWindow && !eyeWindow.isDestroyed()) {
    // 热键打断眼睛模式：连同伴生窗口和空闲计时一起关闭
    eyeWindow.hide();
    stopEyeIdleTracking();
    hideCompanion();
  }
  if (mainWindow && mainWindow.isVisible() && !mainWindow.isMinimized()) {
    // 快捷键隐藏 → 最小化到任务栏
    mainWindow.minimize();
  } else {
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow();
    }
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    } else {
      // 居中显示（如果没有保存位置）
      if (!mainWindow.getPosition()[0] && !mainWindow.getPosition()[1]) {
        mainWindow.center();
      }
      mainWindow.show();
    }
    mainWindow.focus();
    mainWindow.webContents.send('window:shown');
  }
}

// ==================== 眼睛窗口 ====================
const EYE_SIZES = {
  small:  { w: 66, h: 72 },
  medium: { w: 84, h: 100 },
  large:  { w: 120, h: 126 }
};

function createEyeWindow(eyeSize = 'medium') {
  if (eyeWindow && !eyeWindow.isDestroyed()) return;

  // 眼睛尺寸白名单校验，防止任意值进入 executeJavaScript 模板
  const safeSize = EYE_SIZES[eyeSize] ? eyeSize : 'medium';

  const { screen } = require('electron');
  const primary = screen.getPrimaryDisplay();
  const { width, height } = primary.workAreaSize;
  const s = EYE_SIZES[safeSize];

  eyeWindow = new BrowserWindow({
    width: s.w,
    height: s.h,
    x: Math.round((width - s.w) / 2),
    y: Math.round((height - s.h) / 2),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    focusable: false,       // 桌面宠物模式：不抢焦点
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  hardenWindow(eyeWindow);

  eyeWindow.loadFile(path.join(__dirname, 'renderer', 'eye.html'));
  eyeWindow.setVisibleOnAllWorkspaces(true);

  eyeWindow.once('ready-to-show', () => {
    if (eyeWindow && !eyeWindow.isDestroyed()) {
      eyeWindow.webContents.executeJavaScript(`document.body.classList.add('size-${safeSize}')`);
    }
  });
}

function showEyeMode() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
  }
  setTimeout(() => {
    if (!eyeWindow || eyeWindow.isDestroyed()) {
      const settings = loadSettings();
      createEyeWindow(settings.eyeSize || 'medium');
    }
    if (eyeWindow && !eyeWindow.isDestroyed()) {
      eyeWindow.show();
      // 冷却重置改由 eye.js 的 visibilitychange 监听处理，这里不再依赖 executeJavaScript
      showCompanion();
      startEyeIdleTracking();
    }
  }, 250);
}

function hideEyeMode() {
  stopEyeIdleTracking();
  hideCompanion();
  if (eyeWindow && !eyeWindow.isDestroyed()) {
    eyeWindow.hide();
  }
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

// ── 眼睛空闲检测（主进程轮询，不受眼窗 focus 影响）──
let eyeIdleTimer = null;
let eyeIdleLastX = -1;
let eyeIdleLastY = -1;
let eyeIdleSince = 0;
let eyeIdleState = 'awake';       // 'awake' | 'drowsy' | 'asleep'
let eyeIdleTimeoutMs = 120 * 1000; // 默认值，startEyeIdleTracking() 中会按设置覆盖

function startEyeIdleTracking() {
  const settings = loadSettings();
  let sec = settings.eyeIdleSeconds || 120;
  if (sec === 'custom' || isNaN(sec)) sec = settings.eyeIdleCustom || 120;
  eyeIdleTimeoutMs = sec * 1000;
  eyeIdleState = 'awake';
  eyeIdleSince = Date.now();
  eyeIdleLastX = -1;
  eyeIdleLastY = -1;

  if (eyeIdleTimer) clearInterval(eyeIdleTimer);
  eyeIdleTimer = setInterval(() => {
    if (!eyeWindow || eyeWindow.isDestroyed() || !eyeWindow.isVisible()) return;

    try {
      const { screen } = require('electron');
      const cursor = screen.getCursorScreenPoint();
      const now = Date.now();

      if (eyeIdleLastX === -1) {
        eyeIdleLastX = cursor.x;
        eyeIdleLastY = cursor.y;
        eyeIdleSince = now;
        return;
      }

      const moved = (cursor.x !== eyeIdleLastX || cursor.y !== eyeIdleLastY);
      eyeIdleLastX = cursor.x;
      eyeIdleLastY = cursor.y;

      if (moved) {
        const wasState = eyeIdleState;
        eyeIdleSince = now;
        if (wasState !== 'awake') {
          eyeIdleState = 'awake';
          eyeWindow.webContents.send('eye:setState', 'awake');
          if (companionWindow && !companionWindow.isDestroyed()) {
            companionWindow.webContents.send('eye:setState', 'awake');
          }
        }
        return;
      }

      const idleMs = now - eyeIdleSince;
      if (eyeIdleState === 'awake' && idleMs >= eyeIdleTimeoutMs) {
        eyeIdleState = 'drowsy';
        eyeWindow.webContents.send('eye:setState', 'drowsy');
      } else if (eyeIdleState === 'drowsy' && idleMs >= eyeIdleTimeoutMs + 15 * 1000) {
        eyeIdleState = 'asleep';
        eyeWindow.webContents.send('eye:setState', 'asleep');
        if (companionWindow && !companionWindow.isDestroyed()) {
          companionWindow.webContents.send('eye:setState', 'asleep');
        }
      }
    } catch (e) { /* ignore */ }
  }, 500);  // 每 500ms 检查一次即可
}

function stopEyeIdleTracking() {
  if (eyeIdleTimer) {
    clearInterval(eyeIdleTimer);
    eyeIdleTimer = null;
  }
  eyeIdleState = 'awake';
}

// ==================== 伴生窗口（zZ 独立透明窗口，位于眼窗右侧） ====================
const COMPANION_OFFSET_X = -40;
const COMPANION_OFFSET_Y = -20;
const COMPANION_W = 110;
const COMPANION_H = 70;

function createCompanionWindow() {
  if (companionWindow && !companionWindow.isDestroyed()) return;

  companionWindow = new BrowserWindow({
    width: COMPANION_W,
    height: COMPANION_H,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  hardenWindow(companionWindow);
  companionWindow.loadFile(path.join(__dirname, 'renderer', 'companion.html'));
  companionWindow.setVisibleOnAllWorkspaces(true);
  companionWindow.setIgnoreMouseEvents(true);
}

function syncCompanionPosition() {
  if (!companionWindow || companionWindow.isDestroyed()) return;
  if (!eyeWindow || eyeWindow.isDestroyed() || !eyeWindow.isVisible()) {
    if (companionWindow.isVisible()) companionWindow.hide();
    return;
  }
  const eb = eyeWindow.getBounds();
  companionWindow.setBounds({
    x: Math.round(eb.x + eb.width + COMPANION_OFFSET_X),
    y: Math.round(eb.y + (eb.height - COMPANION_H) / 2 + COMPANION_OFFSET_Y),
    width: COMPANION_W,
    height: COMPANION_H
  });
}

function showCompanion() {
  if (!companionWindow || companionWindow.isDestroyed()) createCompanionWindow();
  if (companionWindow && !companionWindow.isDestroyed()) {
    syncCompanionPosition();
    companionWindow.show();
  }
}

function hideCompanion() {
  if (companionWindow && !companionWindow.isDestroyed()) {
    companionWindow.webContents.send('companion:reset');
    companionWindow.hide();
  }
}

function setEyeWindowSize(size) {
  if (!eyeWindow || eyeWindow.isDestroyed()) return;
  const safeSize = EYE_SIZES[size] ? size : 'medium';
  const s = EYE_SIZES[safeSize];
  const bounds = eyeWindow.getBounds();
  eyeWindow.setBounds({
    x: Math.round(bounds.x + (bounds.width - s.w) / 2),
    y: Math.round(bounds.y + (bounds.height - s.h) / 2),
    width: s.w,
    height: s.h
  });
  eyeWindow.webContents.executeJavaScript(`document.body.className = 'size-${safeSize}'`);
  syncCompanionPosition();
}

// ==================== 窗口位置记忆 ====================
const BOUNDS_PATH = path.join(database.DATA_DIR, 'window-bounds.json');

function loadWindowBounds() {
  try {
    if (fs.existsSync(BOUNDS_PATH)) {
      return JSON.parse(fs.readFileSync(BOUNDS_PATH, 'utf-8'));
    }
  } catch (e) { /* ignore */ }
  return {};
}

function saveWindowBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const bounds = mainWindow.getBounds();
    fs.writeFileSync(BOUNDS_PATH, JSON.stringify({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    }));
  } catch (e) { /* ignore */ }
}

// ==================== 剪贴板监控 ====================

// 按设置的最大记录数裁剪历史（文字/图片/文件新增后调用）
function trimToLimit() {
  const settings = loadSettings();
  const maxClips = settings.maxClips || 200;
  database.trimExcessClips(maxClips);
}

function startClipboardWatcher() {
  clipboardTimer = setInterval(() => {
    checkClipboard();
  }, 500);
}

// ── 文件复制检测（通过 PowerShell 调用 .NET Windows.Forms.Clipboard）──
// Electron 的 clipboard.readBuffer() 对 Windows 原生格式（CF_HDROP）支持不稳定，
// 改用 PowerShell + .NET 直接读取 Windows 剪贴板的文件拖放列表。
let fileCheckRunning = false;

function checkClipboard() {
  try {
    // 1. 检查图片
    const image = clipboard.readImage();
    if (!image.isEmpty()) {
      const pngBuffer = image.toPNG();
      if (pngBuffer.length > 100) {
        const hash = crypto.createHash('md5').update(pngBuffer).digest('hex');
        if (hash !== lastImageHash) {
          lastImageHash = hash;
          saveImageClip(pngBuffer, hash);
          return;
        }
      }
    }

    // 2. 异步检查文件（PowerShell → .NET System.Windows.Forms）
    // -STA 确保 STA 线程模式（Windows.Forms.Clipboard 必须）
    // [Console]::OutputEncoding 确保中文路径不产生乱码
    if (!fileCheckRunning) {
      fileCheckRunning = true;
      const { execFile } = require('child_process');
      execFile('powershell.exe', [
        '-STA', '-NoProfile', '-Command',
        '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Add-Type -AssemblyName System.Windows.Forms; try{$f=[System.Windows.Forms.Clipboard]::GetFileDropList();if($f.Count -gt 0){$f -join "|"} }catch{}'
      ], { timeout: 3000, windowsHide: true, encoding: 'utf-8' }, (err, stdout) => {
        fileCheckRunning = false;
        if (err) return;
        const output = (stdout || '').trim();
        if (!output) return;
        const paths = output.split('|').filter(p => p && p.trim());
        if (paths.length === 0) return;
        const hash = crypto.createHash('md5').update(paths.sort().join('|')).digest('hex');
        if (hash !== lastFileHash) {
          lastFileHash = hash;
          saveFileClip(paths);
        }
      });
    }

    // 3. 检查文本
    const text = clipboard.readText();
    if (text && text.trim().length > 0 && text !== lastText) {
      lastText = text;
      const clip = database.addTextClip(text);
      if (clip && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('clipboard:newItem', clip);
        trimToLimit();
      }
    }
  } catch (e) {
    console.error('Clipboard check error:', e.message);
  }
}

// 将文件路径写入剪贴板（通过 PowerShell + .NET SetFileDropList）
// Electron 的 clipboard.writeBuffer 无法可靠写入 Windows 原生 CF_HDROP 格式，
// 改用与读取同一套 .NET API。
function writeFilePathsToClipboard(paths) {
  return new Promise((resolve) => {
    const psCmd = [
      '-STA', '-NoProfile', '-Command',
      `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Add-Type -AssemblyName System.Windows.Forms; $col = New-Object System.Collections.Specialized.StringCollection; ${paths.map(p => `$col.Add('${p.replace(/'/g, "''")}')`).join(';')}; [System.Windows.Forms.Clipboard]::SetFileDropList($col)`
    ];
    const { execFile } = require('child_process');
    execFile('powershell.exe', psCmd, { timeout: 5000, windowsHide: true, encoding: 'utf-8' }, (err) => {
      if (err) {
        console.error('writeFilePathsToClipboard failed:', err.message);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

async function saveFileClip(filePaths) {
  try {
    const clip = database.addFileClip(filePaths);
    if (clip && mainWindow && !mainWindow.isDestroyed()) {
      // 补全 UI 需要的字段
      clip.pinned = 0;
      clip.favorite = 0;
      clip.fileCount = filePaths.length;
      clip.fileNames = filePaths.map(p => require('path').basename(p));

      // 生成 Windows 系统文件图标（最多 5 个）
      // 异步生成但不要阻塞发送 — 先发送基本信息，图标通过 lazy-load IPC 补充
      clip.fileIcons = [];
      for (const fp of filePaths.slice(0, 5)) {
        try {
          const icon = await app.getFileIcon(fp, { size: 'normal' });
          const dataUrl = icon.isEmpty() ? null : icon.toDataURL();
          clip.fileIcons.push(dataUrl);
        } catch (e) {
          clip.fileIcons.push(null);
        }
      }

      mainWindow.webContents.send('clipboard:newItem', clip);
      // 限制最大记录数
      trimToLimit();
    }
  } catch (e) {
    console.error('saveFileClip error:', e.message || e);
  }
}

function saveImageClip(pngBuffer, hash) {
  const imagesDir = database.getImagesDir();
  const filename = `${Date.now()}_${hash.slice(0, 8)}.png`;
  const filePath = path.join(imagesDir, filename);

  // 从 PNG buffer 解析图片尺寸（PNG 头固定偏移）
  let dimensions = null;
  if (pngBuffer.length > 24) {
    const w = pngBuffer.readUInt32BE(16);
    const h = pngBuffer.readUInt32BE(20);
    dimensions = `${w}×${h}`;
  }

  try {
    fs.writeFileSync(filePath, pngBuffer);
    const clip = database.addImageClip(filePath, hash, dimensions);
    if (clip && mainWindow) {
      const base64 = pngBuffer.toString('base64');
      clip.image_data = `data:image/png;base64,${base64}`;
      mainWindow.webContents.send('clipboard:newItem', clip);
      // 限制最大记录数
      trimToLimit();
    }
  } catch (e) {
    console.error('Failed to save image clip:', e.message);
  }
}

// ==================== 全局快捷键 ====================
function registerShortcut(accelerator) {
  // 先注销旧的
  globalShortcut.unregisterAll();

  try {
    const ret = globalShortcut.register(accelerator, () => {
      toggleWindow();
    });
    if (!ret) {
      console.error('Failed to register shortcut:', accelerator);
    } else {
      currentShortcut = accelerator;
    }
    return ret;
  } catch (e) {
    console.error('Shortcut registration error:', e.message);
    return false;
  }
}

// ==================== 系统托盘 ====================
function buildTrayMenu() {
  return Menu.buildFromTemplate([
    {
      label: tr('tray.open'),
      click: () => toggleWindow()
    },
    {
      label: tr('tray.settings'),
      click: () => {
        if (!mainWindow || mainWindow.isDestroyed()) {
          createWindow();
        }
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('navigate:settings');
      }
    },
    { type: 'separator' },
    {
      label: tr('tray.quit'),
      click: () => {
        app.quit();
      }
    }
  ]);
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('PasteHistory');
  tray.setContextMenu(buildTrayMenu());

  tray.on('double-click', () => {
    toggleWindow();
  });
}

// ==================== 设置管理 ====================
const SETTINGS_PATH = path.join(database.DATA_DIR, 'settings.json');
const DEFAULT_SETTINGS = {
  retention: 3,
  customRetention: 7,
  shortcut: 'Alt+V',
  autoLaunch: true,
  maxClips: 200,
  eyeSize: 'medium',
  eyeIdleSeconds: 120,
  eyeIdleCustom: 120,
  language: 'zh'
};

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8')) };
    }
  } catch (e) {
    console.error('Failed to load settings:', e.message);
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings) {
  try {
    const dir = path.dirname(SETTINGS_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));

    // 快捷键变更时重新注册
    if (settings.shortcut && settings.shortcut !== currentShortcut) {
      registerShortcut(settings.shortcut);
    }

    return true;
  } catch (e) {
    console.error('Failed to save settings:', e.message);
    return false;
  }
}

// ==================== 定时清理 ====================
function startAutoCleanup() {
  const cleanup = () => {
    const s = loadSettings();
    const r = s.retention === 'custom' ? s.customRetention : s.retention;
    database.cleanExpired(r);
    // 物理清除软删除记录，避免 deleted=1 行无限累积
    database.purgeDeleted();
  };

  cleanup();
  setInterval(cleanup, 60 * 60 * 1000);
}

// ==================== 开机自启 ====================
function setAutoLaunch(enable) {
  app.setLoginItemSettings({
    openAtLogin: enable,
    path: process.execPath
  });
}

// ==================== IPC 通信 ====================
function setupIPC() {
  ipcMain.handle('clips:getList', (event, { limit, offset }) => {
    return database.getClips(limit, offset);
  });

  ipcMain.handle('clips:search', (event, { keyword }) => {
    // 搜索结果上限与列表一致，避免设置了大上限后搜索只返回前 100 条
    const maxClips = loadSettings().maxClips || 200;
    return database.searchClips(keyword, maxClips);
  });

  ipcMain.handle('clips:togglePin', (event, { id }) => {
    return database.togglePin(id);
  });

  ipcMain.handle('clips:toggleFavorite', (event, { id }) => {
    return database.toggleFavorite(id);
  });

  ipcMain.handle('clips:delete', (event, { id }) => {
    return database.deleteClip(id);
  });

  // 分类管理
  ipcMain.handle('categories:getAll', () => {
    return database.getCategories();
  });

  ipcMain.handle('categories:create', (event, { name }) => {
    return database.createCategory(name);
  });

  ipcMain.handle('categories:rename', (event, { id, name }) => {
    return database.renameCategory(id, name);
  });

  ipcMain.handle('categories:delete', (event, { id }) => {
    return database.deleteCategory(id);
  });

  ipcMain.handle('categories:setClipCategory', (event, { clipId, categoryId }) => {
    return database.setClipCategory(clipId, categoryId);
  });

  ipcMain.handle('categories:removeClipCategory', (event, { clipId, categoryId }) => {
    return database.removeClipCategory(clipId, categoryId);
  });

  ipcMain.handle('categories:batchSet', (event, { clipIds, categoryId }) => {
    return database.batchSetClipCategory(clipIds, categoryId);
  });

  ipcMain.handle('clips:copyToClipboard', async (event, { id }) => {
    const rawDB = database.getDB();
    const stmt = rawDB.prepare('SELECT type, content, image_path FROM clips WHERE id=? AND deleted=0');
    stmt.bind([id]);
    if (!stmt.step()) { stmt.free(); return false; }
    const row = stmt.getAsObject();
    stmt.free();

    if (row.type === 'text') {
      clipboard.writeText(row.content);
    } else if (row.type === 'image') {
      try {
        clipboard.writeImage(nativeImage.createFromPath(row.image_path));
      } catch (e) { return false; }
    } else if (row.type === 'file') {
      try {
        const paths = JSON.parse(row.content);
        const ok = await writeFilePathsToClipboard(paths);
        if (!ok) return false;
      } catch (e) { return false; }
    }
    return true;
  });

  // 导出历史为文本文件 — 美观格式（含分类归属与统计）
  ipcMain.handle('clips:exportHistory', async () => {
    const { dialog } = require('electron');
    const isEn = (loadSettings().language || 'zh') === 'en';
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const dateLabel = isEn ? formatDateEnglish(now) : formatDateChinese(now);
    const timeStr = `${dateLabel} ${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
    const result = await dialog.showSaveDialog(mainWindow, {
      title: tr('export.title'),
      defaultPath: `PasteHistory_${dateStr}.txt`,
      filters: [{ name: tr('export.filter'), extensions: ['txt'] }]
    });
    if (result.canceled || !result.filePath) return false;

    const rows = database.getClips(99999, 0);

    // 分类 id → 名称映射
    const catMap = {};
    database.getCategories().forEach(c => { catMap[c.id] = c.name; });

    // 统计
    const countByType = (t) => rows.filter(r => r.type === t).length;
    const textCount = countByType('text');
    const imageCount = countByType('image');
    const fileCount = countByType('file');
    const pinCount = rows.filter(r => r.pinned).length;
    const favCount = rows.filter(r => r.favorite).length;

    const lines = [];
    const EXPORT_LINE_WIDTH = 68; // 每行宽度（等宽字体显示列宽）

    // ── 头部 ──
    lines.push('╔' + '═'.repeat(EXPORT_LINE_WIDTH - 2) + '╗');
    lines.push('║' + centerText(tr('export.header'), EXPORT_LINE_WIDTH - 2) + '║');
    lines.push('╠' + '═'.repeat(EXPORT_LINE_WIDTH - 2) + '╣');
    lines.push('║' + centerText(tr('export.time', { time: timeStr }), EXPORT_LINE_WIDTH - 2) + '║');
    lines.push('║' + centerText(tr('export.total', { n: rows.length }), EXPORT_LINE_WIDTH - 2) + '║');
    lines.push('║' + centerText(tr('export.stats', { t: textCount, i: imageCount, f: fileCount }), EXPORT_LINE_WIDTH - 2) + '║');
    lines.push('║' + centerText(tr('export.favPin', { f: favCount, p: pinCount }), EXPORT_LINE_WIDTH - 2) + '║');
    lines.push('╚' + '═'.repeat(EXPORT_LINE_WIDTH - 2) + '╝');
    lines.push('');

    // ── 逐条记录 ──
    rows.forEach((r, i) => {
      const num = String(i + 1).padStart(2, '0');
      const date = new Date(r.created_at);
      const dateLabel = isEn ? formatDateEnglish(date) : formatDateChinese(date);
      const timeLabel = `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
      const tags = [];
      if (r.pinned) tags.push(tr('export.tagPin'));
      if (r.favorite) tags.push(tr('export.tagFav'));
      // 分类归属（排除历史脏数据中的无效 id）
      const catNames = String(r.category_ids || '')
        .split(',').map(Number)
        .filter(id => id > 0 && catMap[id])
        .map(id => catMap[id]);
      if (catNames.length > 0) tags.push('📂 ' + catNames.join('、'));
      const tagStr = tags.length > 0 ? '  ' + tags.join('  ') : '';

      // 分隔线 + 编号
      lines.push('─'.repeat(EXPORT_LINE_WIDTH));
      lines.push(`▎ ${num}  ·  ${dateLabel} ${timeLabel}${tagStr}`);

      if (r.type === 'text') {
        lines.push('');
        const text = r.content || tr('export.empty');
        // 自动换行（按显示宽度，中文占 2 列）
        for (const line of wrapText(text, EXPORT_LINE_WIDTH - 4)) {
          lines.push('  ' + line);
        }
      } else if (r.type === 'image') {
        const dims = r.dimensions || tr('export.unknownSize');
        const seq = r.image_seq != null ? `  #${r.image_seq}` : '';
        lines.push(`  🖼️  ${tr('file.image')}  ·  ${dims}${seq}`);
        lines.push(`  ${r.image_path || ''}`);
      } else if (r.type === 'file') {
        try {
          const paths = JSON.parse(r.content || '[]');
          lines.push(`  📁 ${tr('export.files', { n: paths.length })}`);
          paths.forEach(p => {
            const base = require('path').basename(p);
            const dir = require('path').dirname(p);
            lines.push(`     ${base}`);
            lines.push(`     └─ ${dir}`);
          });
        } catch (e) {
          lines.push(`  📁 ${tr('file.file')}  ·  ` + (r.content || ''));
        }
      }
      lines.push('');
    });

    // ── 尾部 ──
    lines.push('═'.repeat(EXPORT_LINE_WIDTH));
    lines.push(centerText(tr('export.footer', { n: rows.length, ver: app.getVersion() }), EXPORT_LINE_WIDTH));
    lines.push('');

    require('fs').writeFileSync(result.filePath, lines.join('\n'), 'utf-8');
    return true;
  });

  // 打开详情窗口（右键查看完整内容）
  ipcMain.handle('clips:openDetail', (event, { id }) => {
    const rawDB = database.getDB();
    const stmt = rawDB.prepare('SELECT type, content, image_path FROM clips WHERE id=? AND deleted=0');
    stmt.bind([id]);
    if (!stmt.step()) { stmt.free(); return false; }
    const row = stmt.getAsObject();
    stmt.free();

    const detailWin = new BrowserWindow({
      width: 500,
      height: 400,
      minWidth: 300,
      minHeight: 200,
      frame: true,
      autoHideMenuBar: true,
      icon: path.join(__dirname, 'assets', 'icon.png'),
      backgroundColor: '#F2F2F7',
      resizable: true,
      title: tr('detail.title'),
      parent: mainWindow || undefined,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    detailWin.setMenu(null);
    hardenWindow(detailWin);

    // 根据类型生成内容
    let bodyHtml = '';
    if (row.type === 'image') {
      if (database.isImagePathSafe(row.image_path)) {
        bodyHtml = '<div class="image-container"><img class="image-full" src="data:image/png;base64,' +
          require('fs').readFileSync(row.image_path).toString('base64') + '" alt="' + tr('common.image') + '" /></div>';
      } else {
        bodyHtml = '<div class="text-content">' + tr('detail.imageMissing') + '</div>';
      }
    } else if (row.type === 'file') {
      const paths = JSON.parse(row.content || '[]');
      const items = paths.map(p => {
        const name = require('path').basename(p);
        const dir = require('path').dirname(p);
        return `<div class="file-item">
          <span class="file-item-icon">📄</span>
          <div class="file-item-info">
            <span class="file-item-name">${name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span>
            <span class="file-item-path">${dir.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span>
          </div>
        </div>`;
      }).join('');
      bodyHtml = `<div class="file-list">${items}</div>`;
    } else {
      bodyHtml = '<div class="text-content">' +
        (row.content || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') +
        '</div>';
    }

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif;
    background: #F2F2F7;
    color: #1D1D1F;
    padding: 20px;
    height: 100vh;
    overflow: auto;
    user-select: text;
  }
  .text-content {
    font-size: 14px;
    line-height: 1.8;
    white-space: pre-wrap;
    word-break: break-all;
    background: #fff;
    border-radius: 10px;
    padding: 20px;
    border: 1px solid rgba(0,0,0,0.06);
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .image-container {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }
  .image-full {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  }
  .file-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .file-item {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #fff;
    border-radius: 8px;
    padding: 10px 14px;
    border: 1px solid rgba(0,0,0,0.06);
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .file-item-icon {
    font-size: 24px;
    flex-shrink: 0;
  }
  .file-item-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .file-item-name {
    font-size: 13px;
    font-weight: 500;
    color: #1D1D1F;
    word-break: break-all;
  }
  .file-item-path {
    font-size: 10px;
    color: #86868B;
    word-break: break-all;
  }
</style>
</head>
<body>${bodyHtml}</body>
</html>`;

    detailWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    return true;
  });

  ipcMain.handle('settings:get', () => {
    return loadSettings();
  });

  ipcMain.handle('settings:set', (event, settings) => {
    if (!isTrustedSender(event)) return false;
    // 白名单校验：眼睛尺寸会进入 executeJavaScript 模板，只接受固定取值
    if (settings && settings.eyeSize && !Object.keys(EYE_SIZES).includes(settings.eyeSize)) {
      settings.eyeSize = DEFAULT_SETTINGS.eyeSize;
    }
    // 语言白名单
    if (settings && settings.language && !['zh', 'en'].includes(settings.language)) {
      settings.language = DEFAULT_SETTINGS.language;
    }
    const prevLanguage = loadSettings().language || 'zh';
    const ok = saveSettings(settings);
    // 语言变更时重建托盘菜单
    if (ok && tray && (settings.language || prevLanguage) !== prevLanguage) {
      tray.setContextMenu(buildTrayMenu());
    }
    return ok;
  });

  ipcMain.handle('clips:clearAll', (event) => {
    if (!isTrustedSender(event)) return false;
    const rawDB = database.getDB();
    // 删除所有图片文件（仅限数据目录内的路径）
    const stmt = rawDB.prepare("SELECT image_path FROM clips WHERE type='image'");
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    for (const row of rows) {
      if (row.image_path && database.isImagePathSafe(row.image_path) && fs.existsSync(row.image_path)) {
        try { fs.unlinkSync(row.image_path); } catch (e) { /* 文件被占用时忽略 */ }
      }
    }
    rawDB.run('DELETE FROM clips');
    database.saveToDisk();
    return true;
  });

  ipcMain.handle('window:toggleDesktopPin', () => {
    desktopPinned = !desktopPinned;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(desktopPinned);
    }
    return desktopPinned;
  });

  ipcMain.handle('window:getDesktopPinned', () => {
    return desktopPinned;
  });

  ipcMain.handle('app:getInstallDir', () => {
    // 返回软件安装目录（打包后为安装位置，开发模式为 electron 所在目录）
    return path.dirname(process.execPath);
  });

  // 文件图标懒加载：renderer 按需请求（解决重启后图标丢失问题）
  ipcMain.handle('app:getFileIcons', async (event, { paths }) => {
    if (!isTrustedSender(event)) return [];
    if (!Array.isArray(paths)) return [];
    const icons = [];
    for (const fp of paths.slice(0, 20)) {
      try {
        if (!fp || typeof fp !== 'string') { icons.push(null); continue; }
        const icon = await app.getFileIcon(fp, { size: 'normal' });
        icons.push(icon.isEmpty() ? null : icon.toDataURL());
      } catch (e) {
        icons.push(null);
      }
    }
    return icons;
  });

  // 打开文件（右键文件卡片 → 在资源管理器中打开）
  ipcMain.handle('app:openFile', async (event, { filePath }) => {
    if (!isTrustedSender(event)) return false;
    if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) return false;
    try {
      const opened = await shell.openPath(filePath);
      return opened === ''; // shell.openPath 返回空字符串表示成功
    } catch (e) {
      console.error('openFile failed:', e.message);
      return false;
    }
  });

  // 在资源管理器中打开并选中文件
  ipcMain.handle('app:showInFolder', async (event, { filePath }) => {
    if (!isTrustedSender(event)) return false;
    if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) return false;
    try {
      shell.showItemInFolder(filePath);
      return true;
    } catch (e) {
      console.error('showInFolder failed:', e.message);
      return false;
    }
  });

  // 彻底卸载：删除桌面快捷方式 + 开始菜单快捷方式 + 安装目录 + 数据
  // deleteData: true = 删数据 + 删程序, false = 只删程序保留数据
  ipcMain.handle('app:uninstall', async (event, { deleteData }) => {
    if (!isTrustedSender(event)) return false;
    // 开发模式下不执行卸载（process.execPath 指向 electron 自身，删除会毁掉开发环境）
    if (!app.isPackaged) {
      console.error('Uninstall is only available in the packaged app.');
      return false;
    }
    try {
      // 1. 取消开机自启 + 注销快捷键
      app.setLoginItemSettings({ openAtLogin: false });
      globalShortcut.unregisterAll();

      // 2. 清理数据目录（仅 deleteData=true）
      if (deleteData) {
        const dataDir = database.DATA_DIR;
        if (fs.existsSync(dataDir)) {
          fs.rmSync(dataDir, { recursive: true, force: true });
        }
      }

      // 3. 构造 PowerShell 清理脚本（app 退出后静默执行）
      const exeDir = path.dirname(process.execPath);
      const psScript = `
$ErrorActionPreference = 'SilentlyContinue'
Start-Sleep -Seconds 3
# 删除桌面快捷方式（含公共桌面，兼容快捷方式位置差异）
$desktop = [Environment]::GetFolderPath('Desktop')
Remove-Item "$desktop\\PasteHistory.lnk" -Force
Remove-Item "$env:PUBLIC\\Desktop\\PasteHistory.lnk" -Force
# 删除开始菜单快捷方式
$startMenu = [Environment]::GetFolderPath('StartMenu')
Remove-Item "$startMenu\\Programs\\PasteHistory.lnk" -Force
Remove-Item "$startMenu\\Programs\\PasteHistory" -Recurse -Force
# 删除安装目录：重试直到文件锁释放（最多 15 秒）
for ($i = 0; $i -lt 15; $i++) {
  if (Test-Path '${exeDir.replace(/'/g, "''")}') {
    Remove-Item '${exeDir.replace(/'/g, "''")}' -Recurse -Force
  }
  if (-not (Test-Path '${exeDir.replace(/'/g, "''")}')) { break }
  Start-Sleep -Seconds 1
}
# 删除自身脚本
Remove-Item $MyInvocation.MyCommand.Path -Force
`.trim();

      const psPath = path.join(require('os').tmpdir(), 'ph_cleanup.ps1');
      fs.writeFileSync(psPath, psScript);

      // 使用 execFile + windowsHide 彻底隐藏窗口
      require('child_process').execFile('powershell.exe', [
        '-WindowStyle', 'Hidden',
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', psPath
      ], { windowsHide: true, detached: true, stdio: 'ignore' });

      // 4. 退出应用
      setImmediate(() => {
        app.quit();
      });

      return true;
    } catch (e) {
      console.error('Uninstall failed:', e.message);
      return false;
    }
  });

  ipcMain.on('window:hide', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide();
    }
  });

  ipcMain.on('window:minimize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.minimize();
    }
  });

  // 眼睛模式
  ipcMain.on('eye:show', () => {
    showEyeMode();
  });

  ipcMain.on('eye:clicked', () => {
    hideEyeMode();
  });

  ipcMain.handle('eye:getCursorPos', () => {
    const { screen } = require('electron');
    const cursor = screen.getCursorScreenPoint();
    if (eyeWindow && !eyeWindow.isDestroyed()) {
      const bounds = eyeWindow.getBounds();
      return {
        cursorX: cursor.x,
        cursorY: cursor.y,
        winX: bounds.x,
        winY: bounds.y,
        winW: bounds.width,
        winH: bounds.height
      };
    }
    return null;
  });

  ipcMain.on('eye:move', (event, { dx, dy }) => {
    if (eyeWindow && !eyeWindow.isDestroyed()) {
      const bounds = eyeWindow.getBounds();
      eyeWindow.setBounds({
        x: bounds.x + dx,
        y: bounds.y + dy,
        width: bounds.width,
        height: bounds.height
      });
      // 拖拽眼睛 = 用户活跃，重置空闲计时（下次轮询会自然唤醒）
      eyeIdleSince = Date.now();
      // 伴生窗口跟随
      syncCompanionPosition();
    }
  });

  ipcMain.on('eye:setSize', (event, { size }) => {
    setEyeWindowSize(size);
  });

  ipcMain.handle('clips:getImageData', (event, { id }) => {
    const rawDB = database.getDB();
    const stmt = rawDB.prepare('SELECT image_path FROM clips WHERE id=? AND type=?');
    stmt.bind([id, 'image']);
    if (!stmt.step()) { stmt.free(); return null; }
    const imagePath = stmt.getAsObject().image_path;
    stmt.free();
    if (!imagePath || !database.isImagePathSafe(imagePath)) return null;
    try {
      return 'data:image/png;base64,' + fs.readFileSync(imagePath).toString('base64');
    } catch (e) { return null; }
  });
}

// ==================== 导出辅助函数 ====================
// 判断字符在等宽字体下的显示宽度是否为 2 列（中文、全角、emoji 等）
function isWideChar(ch) {
  const code = ch.codePointAt(0);
  return (
    (code >= 0x1100 && code <= 0x115F) ||   // Hangul Jamo
    (code >= 0x2E80 && code <= 0x303E) ||   // CJK 部首/标点
    (code >= 0x3041 && code <= 0x33FF) ||   // 假名 / CJK 兼容
    (code >= 0x3400 && code <= 0x4DBF) ||   // CJK 扩展 A
    (code >= 0x4E00 && code <= 0x9FFF) ||   // CJK 基本区（汉字）
    (code >= 0xA000 && code <= 0xA4CF) ||
    (code >= 0xAC00 && code <= 0xD7AF) ||   // Hangul 音节
    (code >= 0xF900 && code <= 0xFAFF) ||
    (code >= 0xFE30 && code <= 0xFE4F) ||
    (code >= 0xFF00 && code <= 0xFF60) ||   // 全角符号/字母
    (code >= 0xFFE0 && code <= 0xFFE6) ||
    (code >= 0x1F300 && code <= 0x1FAFF) || // emoji / 图标
    (code >= 0x20000 && code <= 0x2FFFF)
  );
}

function displayWidth(str) {
  let w = 0;
  for (const ch of str) w += isWideChar(ch) ? 2 : 1;
  return w;
}

function centerText(text, width) {
  const dw = displayWidth(text);
  const left = Math.max(0, Math.floor((width - dw) / 2));
  const right = Math.max(0, width - dw - left);
  return ' '.repeat(left) + text + ' '.repeat(right);
}

function pad2(n) { return n < 10 ? '0' + n : '' + n; }

function formatDateChinese(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const w = weekDays[date.getDay()];
  return `${y}年${m}月${d}日 周${w}`;
}

function formatDateEnglish(date) {
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${weekDays[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

// 按显示宽度换行（中文占 2 列），避免中文文本提前折行
function wrapText(text, width) {
  const lines = [];
  let current = '';
  let curW = 0;
  for (const ch of text) {
    if (ch === '\n') {
      lines.push(current);
      current = '';
      curW = 0;
      continue;
    }
    const cw = isWideChar(ch) ? 2 : 1;
    if (curW + cw > width) {
      lines.push(current);
      current = ch;
      curW = cw;
    } else {
      current += ch;
      curW += cw;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

// ==================== 应用生命周期 ====================
app.whenReady().then(async () => {
  await initData();
  setupIPC();
  createWindow();
  createTray();

  const settings = loadSettings();
  registerShortcut(settings.shortcut);
  startClipboardWatcher();
  startAutoCleanup();
  setAutoLaunch(settings.autoLaunch);
  createEyeWindow(settings.eyeSize || 'medium');
  createCompanionWindow();

  // 非开机自启时直接弹出窗口
  const wasOpenedAtLogin = app.getLoginItemSettings().wasOpenedAtLogin;
  if (!wasOpenedAtLogin) {
    mainWindow.show();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  // 不退出，保持后台运行（由托盘控制退出）
});

// 防止窗口关闭时退出
app.on('before-quit', () => {
  if (clipboardTimer) {
    clearInterval(clipboardTimer);
  }
  globalShortcut.unregisterAll();
});
