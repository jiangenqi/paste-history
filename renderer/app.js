// ============================================
// PasteHistory - 渲染进程交互逻辑
// ============================================

// --- DOM 引用 ---
const mainPanel = document.getElementById('mainPanel');
const settingsPanel = document.getElementById('settingsPanel');
const searchInput = document.getElementById('searchInput');
const clearSearch = document.getElementById('clearSearch');
const clipList = document.getElementById('clipList');
const settingsBtn = document.getElementById('settingsBtn');
const desktopPinBtn = document.getElementById('desktopPinBtn');
const closeWindowBtn = document.getElementById('closeWindowBtn');
const favoritesBtn = document.getElementById('favoritesBtn');
const backToMainBtn = document.getElementById('backToMain');
const minimizeBtn = document.getElementById('minimizeBtn');
const orbBtn = document.getElementById('orbBtn');
const recordCount = document.getElementById('recordCount');
const backBtn = document.getElementById('backBtn');
const settingsOrbBtn = document.getElementById('settingsOrbBtn');
const settingsMinimizeBtn = document.getElementById('settingsMinimizeBtn');
const settingsCloseBtn = document.getElementById('settingsCloseBtn');
const imageOverlay = document.getElementById('imageOverlay');
const imagePreview = document.getElementById('imagePreview');
const closePreview = document.getElementById('closePreview');

// 设置相关 DOM
const retentionOptions = document.getElementById('retentionOptions');
const customRetentionBox = document.getElementById('customRetentionBox');
const customDays = document.getElementById('customDays');
const shortcutDisplay = document.getElementById('shortcutDisplay');
const shortcutInput = document.getElementById('shortcutInput');
const recordShortcut = document.getElementById('recordShortcut');
const shortcutHint = document.getElementById('shortcutHint');
const autoLaunchToggle = document.getElementById('autoLaunchToggle');
const languageOptions = document.getElementById('languageOptions');
const themeOptions = document.getElementById('themeOptions');
const eyeSizeOptions = document.getElementById('eyeSizeOptions');
const eyeIdleOptions = document.getElementById('eyeIdleOptions');
const customEyeIdleBox = document.getElementById('customEyeIdleBox');
const customEyeIdle = document.getElementById('customEyeIdle');
const clearAllBtn = document.getElementById('clearAllBtn');
const dataDirPath = document.getElementById('dataDirPath');
const copyDataDirBtn = document.getElementById('copyDataDirBtn');
const uninstallKeepBtn = document.getElementById('uninstallKeepBtn');
const maxClipsOptions = document.getElementById('maxClipsOptions');
const customMaxClipsBox = document.getElementById('customMaxClipsBox');
const customMaxClips = document.getElementById('customMaxClips');
const exportHistoryBtn = document.getElementById('exportHistoryBtn');

// 分类相关 DOM
const categoryBar = document.getElementById('categoryBar');
const categoryTabs = document.getElementById('categoryTabs');
const addCategoryBtn = document.getElementById('addCategoryBtn');
const deleteCategoryBtn = document.getElementById('deleteCategoryBtn');
const categoryContextMenu = document.getElementById('categoryContextMenu');

// 分类弹窗 DOM
const categoryModal = document.getElementById('categoryModal');
const modalCard = document.getElementById('modalCard');
const modalTitle = document.getElementById('modalTitle');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalBody = document.getElementById('modalBody');
const modalCreateBody = document.getElementById('modalCreateBody');
const modalDeleteBody = document.getElementById('modalDeleteBody');
const modalNameInput = document.getElementById('modalNameInput');
const modalNameError = document.getElementById('modalNameError');
const modalClipList = document.getElementById('modalClipList');
const modalDeleteList = document.getElementById('modalDeleteList');
const modalFooter = document.getElementById('modalFooter');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalConfirmBtn = document.getElementById('modalConfirmBtn');

// --- 状态 ---
let clips = [];
let searchMode = false;
let favMode = false;
let currentSettings = {};
let isRecordingShortcut = false;
let categories = [];
let activeCategoryId = null;
let editingCategoryId = null;   // 正在行内编辑的分类 id
let isNewCategory = false;      // 正在编辑的是否为刚创建的分类（Esc 时删除）
let creatingCategory = false;    // 防止快速点击 + 按钮重复创建
let confirmInProgress = false;   // 防止 confirmCategory 并发重入
let contextMenuJustOpened = false;  // 防止右键后立即关闭菜单
let modalCheckedIds = new Set();    // 弹窗中勾选的剪贴 ID

// ==================== 国际化 ====================
function t(key, params) {
  return window.i18n.t(currentSettings.language || 'zh', key, params);
}

// 应用深色模式（body.dark-mode 覆盖亮色 CSS 变量）
function applyTheme() {
  const theme = currentSettings.theme || 'light';
  document.body.classList.toggle('dark-mode', theme === 'dark');
}

// 应用当前语言到全部界面文案
function applyLanguage() {
  // 静态文案（data-i18n / data-i18n-ph / data-i18n-title）
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPh);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });

  // 带数值的选项按钮
  document.querySelectorAll('#retentionOptions .option-btn').forEach(btn => {
    const v = btn.dataset.value;
    btn.textContent = v === 'custom' ? t('settings.custom') : t('settings.retentionDay', { n: v });
  });
  document.querySelectorAll('#eyeIdleOptions .option-btn').forEach(btn => {
    const v = btn.dataset.value;
    if (v === 'custom') {
      btn.textContent = t('settings.custom');
    } else if (v === '60' || v === '120' || v === '300' || v === '600') {
      btn.textContent = t('settings.minutes', { n: v / 60 });
    } else {
      btn.textContent = t('settings.seconds', { n: v });
    }
  });
  document.querySelectorAll('#maxClipsOptions .option-btn').forEach(btn => {
    if (btn.dataset.value === 'custom') btn.textContent = t('settings.custom');
  });

  // 动态状态的按钮文案
  recordShortcut.textContent = isRecordingShortcut ? t('common.cancel') : t('settings.change');
  if (!isRecordingShortcut) shortcutInput.value = currentSettings.shortcut || 'Alt+V';
  desktopPinBtn.title = desktopPinBtn.classList.contains('active')
    ? t('common.unpinDesktop') : t('common.desktopPin');

  // 动态区域重渲染
  renderClips(false);
  renderCategoryTabs();
  loadSettingsUI();
  if (categoryModal.style.display === 'flex') {
    if (modalMode === 'create') {
      modalTitle.textContent = t('modal.newCategory');
      modalConfirmBtn.textContent = t('modal.create');
      buildModalClipList();
    } else {
      modalTitle.textContent = t('modal.deleteTitle');
      modalConfirmBtn.textContent = t('modal.deleteSelected');
    }
  }
}

// ==================== 初始化 ====================
async function init() {
  await loadSettings();
  applyTheme();
  await loadClips();
  await loadCategories();
  setupSearchListeners();
  setupSettingsListeners();
  setupImagePreview();
  setupNewClipListener();
  setupIPCListeners();
  setupSettingsButton();
  setupGlobalClickGuard();
  setupCategoryListeners();
  applyLanguage();
}

// 阻止头部和底部点击冒泡
function setupGlobalClickGuard() {
  document.querySelector('.header').addEventListener('click', e => e.stopPropagation());
  document.querySelector('.status-bar').addEventListener('click', e => e.stopPropagation());
}

// ==================== 面板切换 ====================
function showMainPanel() {
  settingsPanel.classList.remove('visible');
  mainPanel.classList.remove('hidden');
  // 恢复收藏筛选 UI 状态
  favoritesBtn.classList.toggle('active', favMode);
  backToMainBtn.classList.toggle('visible', favMode);
  categoryBar.style.display = favMode ? 'flex' : 'none';
}

function showSettingsPanel() {
  mainPanel.classList.add('hidden');
  settingsPanel.classList.add('visible');
  loadSettingsUI();
}

// ==================== 加载数据 ====================
// 将 DB 返回的 category_ids (如 "1,2,3") 解析为数字数组
function parseCategoryIds(clip) {
  if (clip.category_ids != null && clip.category_ids !== '') {
    clip.categories = clip.category_ids.split(',').map(Number);
  } else {
    clip.categories = [];
  }
  return clip;
}

// 列表加载上限与设置的"最大记录数"联动
function getClipLimit() {
  return currentSettings.maxClips || 200;
}

async function loadClips() {
  try {
    clips = await window.clipboardAPI.getClips(getClipLimit(), 0);
    clips.forEach(parseCategoryIds);
    renderClips(true);
  } catch (e) {
    console.error('Failed to load clips:', e);
    showError(t('common.loadFailed'));
  }
}

async function loadSettings() {
  try {
    currentSettings = await window.clipboardAPI.getSettings();
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
}

function loadSettingsUI() {
  // 安装目录
  window.clipboardAPI.getInstallDir().then(dir => {
    if (dir) dataDirPath.textContent = dir;
  }).catch(() => {
    dataDirPath.textContent = t('common.loading');
  });

  // 界面语言
  const language = currentSettings.language || 'zh';
  document.querySelectorAll('#languageOptions .option-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === language);
  });

  // 深色模式
  const theme = currentSettings.theme || 'light';
  document.querySelectorAll('#themeOptions .option-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === theme);
  });

  // 保留期限
  const retention = currentSettings.retention;
  document.querySelectorAll('#retentionOptions .option-btn').forEach(btn => {
    const val = btn.dataset.value;
    btn.classList.toggle('active',
      val === String(retention) || (val === 'custom' && retention === 'custom')
    );
  });

  if (retention === 'custom') {
    customRetentionBox.style.display = 'flex';
    customDays.value = currentSettings.customRetention || 7;
  } else {
    customRetentionBox.style.display = 'none';
  }

  // 快捷键
  shortcutInput.value = currentSettings.shortcut || 'Alt+V';
  renderShortcutKeys(currentSettings.shortcut || 'Alt+V');

  // 开机自启
  autoLaunchToggle.checked = currentSettings.autoLaunch !== false;

  // 最大记录数
  const maxClips = currentSettings.maxClips || 200;
  const maxCustom = ![200, 500, 1000].includes(maxClips);
  const maxVal = maxCustom ? 'custom' : String(maxClips);
  document.querySelectorAll('#maxClipsOptions .option-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === maxVal);
  });
  if (maxCustom) {
    customMaxClipsBox.style.display = 'flex';
    customMaxClips.value = maxClips;
  } else {
    customMaxClipsBox.style.display = 'none';
  }

  // 眼睛大小
  document.querySelectorAll('#eyeSizeOptions .option-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === (currentSettings.eyeSize || 'medium'));
  });

  // 眼睛犯困时间
  const idleCustom = currentSettings.eyeIdleSeconds === 'custom' ||
    ![30, 60, 120, 300, 600].includes(currentSettings.eyeIdleSeconds);
  const idleVal = idleCustom ? 'custom' : String(currentSettings.eyeIdleSeconds || 120);
  document.querySelectorAll('#eyeIdleOptions .option-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === idleVal);
  });
  if (idleCustom) {
    customEyeIdleBox.style.display = 'flex';
    customEyeIdle.value = currentSettings.eyeIdleCustom || currentSettings.eyeIdleSeconds || 120;
  } else {
    customEyeIdleBox.style.display = 'none';
  }

}

// ==================== 设置监听 ====================

// 保存设置统一兜底，避免设置监听器中出现未处理的 Promise rejection
async function saveCurrentSettings() {
  try {
    await window.clipboardAPI.saveSettings(currentSettings);
  } catch (e) {
    console.error('Save settings failed:', e);
  }
}

function setupSettingsListeners() {
  // 界面语言
  languageOptions.addEventListener('click', async (e) => {
    const btn = e.target.closest('.option-btn');
    if (!btn) return;
    document.querySelectorAll('#languageOptions .option-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentSettings.language = btn.dataset.value;
    applyLanguage();
    await saveCurrentSettings();
  });

  // 深色模式
  themeOptions.addEventListener('click', async (e) => {
    const btn = e.target.closest('.option-btn');
    if (!btn) return;
    document.querySelectorAll('#themeOptions .option-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentSettings.theme = btn.dataset.value;
    applyTheme();
    await saveCurrentSettings();
  });

  // 保留期限选项
  retentionOptions.addEventListener('click', async (e) => {
    const btn = e.target.closest('.option-btn');
    if (!btn) return;

    const value = btn.dataset.value;
    document.querySelectorAll('#retentionOptions .option-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (value === 'custom') {
      customRetentionBox.style.display = 'flex';
      currentSettings.retention = 'custom';
      currentSettings.customRetention = parseInt(customDays.value) || 7;
    } else {
      customRetentionBox.style.display = 'none';
      currentSettings.retention = parseInt(value);
    }

    await saveCurrentSettings();
  });

  // 自定义天数
  customDays.addEventListener('change', async () => {
    const days = parseInt(customDays.value);
    if (days > 0 && days <= 365) {
      currentSettings.customRetention = days;
      await saveCurrentSettings();
    }
  });

  // 快捷键录制
  recordShortcut.addEventListener('click', () => {
    if (isRecordingShortcut) {
      stopRecording();
      return;
    }
    startRecording();
  });

  shortcutInput.addEventListener('focus', () => {
    startRecording();
  });

  // 开机自启
  autoLaunchToggle.addEventListener('change', async () => {
    currentSettings.autoLaunch = autoLaunchToggle.checked;
    await saveCurrentSettings();
  });

  // 最大记录数
  maxClipsOptions.addEventListener('click', async (e) => {
    const btn = e.target.closest('.option-btn');
    if (!btn) return;
    const value = btn.dataset.value;
    document.querySelectorAll('#maxClipsOptions .option-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (value === 'custom') {
      customMaxClipsBox.style.display = 'flex';
      currentSettings.maxClips = parseInt(customMaxClips.value) || 500;
    } else {
      customMaxClipsBox.style.display = 'none';
      currentSettings.maxClips = parseInt(value);
    }
    await saveCurrentSettings();
  });

  customMaxClips.addEventListener('change', async () => {
    const val = parseInt(customMaxClips.value);
    if (val >= 50 && val <= 10000) {
      currentSettings.maxClips = val;
      await saveCurrentSettings();
    }
  });

  // 导出历史
  exportHistoryBtn.addEventListener('click', async () => {
    try {
      const result = await window.clipboardAPI.exportHistory();
      if (result) {
        const label = exportHistoryBtn.querySelector('.setting-row-label');
        if (label) label.textContent = t('settings.exportOk');
        exportHistoryBtn.style.pointerEvents = 'none';
        setTimeout(() => {
          if (label) label.textContent = t('settings.export');
          exportHistoryBtn.style.pointerEvents = '';
        }, 2000);
      }
    } catch (e) {
      console.error('Export failed:', e);
      const label = exportHistoryBtn.querySelector('.setting-row-label');
      if (label) label.textContent = t('settings.exportFail');
      setTimeout(() => {
        if (label) label.textContent = t('settings.export');
      }, 2000);
    }
  });

  // 眼睛大小
  eyeSizeOptions.addEventListener('click', async (e) => {
    const btn = e.target.closest('.option-btn');
    if (!btn) return;
    const size = btn.dataset.value;
    document.querySelectorAll('#eyeSizeOptions .option-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentSettings.eyeSize = size;
    window.clipboardAPI.setEyeSize(size);
    await saveCurrentSettings();
  });

  // 眼睛犯困时间
  eyeIdleOptions.addEventListener('click', async (e) => {
    const btn = e.target.closest('.option-btn');
    if (!btn) return;
    const value = btn.dataset.value;
    document.querySelectorAll('#eyeIdleOptions .option-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (value === 'custom') {
      customEyeIdleBox.style.display = 'flex';
      currentSettings.eyeIdleSeconds = 'custom';
      currentSettings.eyeIdleCustom = parseInt(customEyeIdle.value) || 120;
    } else {
      customEyeIdleBox.style.display = 'none';
      currentSettings.eyeIdleSeconds = parseInt(value);
    }
    await saveCurrentSettings();
  });

  // 自定义犯困秒数
  customEyeIdle.addEventListener('change', async () => {
    const sec = parseInt(customEyeIdle.value);
    if (sec >= 5 && sec <= 3600) {
      currentSettings.eyeIdleCustom = sec;
      await saveCurrentSettings();
    }
  });

  // 清空历史
  clearAllBtn.addEventListener('click', async () => {
    if (confirm(t('settings.confirmClearAll'))) {
      try {
        await window.clipboardAPI.clearAll();
        clips = [];
        renderClips();
      } catch (e) {
        console.error('Clear failed:', e);
      }
    }
  });

  // 复制数据目录
  copyDataDirBtn.addEventListener('click', async () => {
    const dir = dataDirPath.textContent;
    if (dir && dir !== t('common.loading')) {
      try {
        await copyTextToClipboard(dir);
        // 按钮反馈
        copyDataDirBtn.textContent = t('common.copiedOk');
        copyDataDirBtn.classList.add('active');
        setTimeout(() => {
          copyDataDirBtn.textContent = t('common.copy');
          copyDataDirBtn.classList.remove('active');
        }, 1500);
      } catch (e) {
        console.error('Copy failed:', e);
      }
    }
  });

  // 删除软件（保留数据）
  uninstallKeepBtn.addEventListener('click', async () => {
    if (confirm(t('settings.confirmUninstall'))) {
      try {
        await window.clipboardAPI.uninstall(false);
      } catch (e) {
        console.error('Uninstall failed:', e);
      }
    }
  });

  // 返回按钮
  backBtn.addEventListener('click', showMainPanel);
}

function startRecording() {
  isRecordingShortcut = true;
  shortcutHint.style.display = 'block';
  recordShortcut.textContent = t('common.cancel');
  recordShortcut.classList.add('active');
  shortcutDisplay.classList.add('recording');
  shortcutInput.style.display = 'block';
  shortcutInput.value = t('settings.pressCombo');
  shortcutInput.focus();
}

function stopRecording() {
  isRecordingShortcut = false;
  shortcutHint.style.display = 'none';
  recordShortcut.textContent = t('settings.change');
  recordShortcut.classList.remove('active');
  shortcutDisplay.classList.remove('recording');
  shortcutInput.style.display = 'none';
  shortcutInput.value = currentSettings.shortcut || 'Alt+V';
  renderShortcutKeys(currentSettings.shortcut || 'Alt+V');
}

// 全局键盘监听（用于快捷键录制）
document.addEventListener('keydown', async (e) => {
  if (!isRecordingShortcut) return;

  e.preventDefault();
  e.stopPropagation();

  const parts = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Meta');

  // 忽略单独的修饰键 — 但实时渲染当前的修饰键状态
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
    if (parts.length > 0) {
      renderShortcutKeys(parts.join('+'));
    }
    return;
  }

  const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  parts.push(key);

  const shortcut = parts.join('+');
  shortcutInput.value = shortcut;
  currentSettings.shortcut = shortcut;
  renderShortcutKeys(shortcut);

  await saveCurrentSettings();

  stopRecording();
});

// ==================== 搜索监听 ====================
function setupSearchListeners() {
  let debounceTimer;

  // 阻止搜索框区域的点击冒泡到卡片
  searchInput.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  searchInput.addEventListener('input', () => {
    const value = searchInput.value.trim();
    clearSearch.classList.toggle('visible', value.length > 0);

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (value.length > 0) {
        searchClips(value);
      } else {
        searchMode = false;
        loadClips();
      }
    }, 150);
  });

  clearSearch.addEventListener('click', async (e) => {
    e.stopPropagation();
    searchInput.value = '';
    clearSearch.classList.remove('visible');
    searchMode = false;
    await loadClips();
    searchInput.focus();
  });

  document.addEventListener('keydown', async (e) => {
    if (e.key === 'Escape' && searchInput.value && !isRecordingShortcut) {
      searchInput.value = '';
      clearSearch.classList.remove('visible');
      searchMode = false;
      await loadClips();
    }
  });
}

async function searchClips(keyword) {
  try {
    clips = await window.clipboardAPI.searchClips(keyword);
    clips.forEach(parseCategoryIds);
    searchMode = true;
    renderClips(false);
  } catch (e) {
    console.error('Search failed:', e);
  }
}

// ==================== 按钮事件 ====================
function setupSettingsButton() {
  settingsBtn.addEventListener('click', () => {
    showSettingsPanel();
  });

  // 收藏筛选按钮
  favoritesBtn.addEventListener('click', () => {
    favMode = !favMode;
    favoritesBtn.classList.toggle('active', favMode);
    backToMainBtn.classList.toggle('visible', favMode);
    categoryBar.style.display = favMode ? 'flex' : 'none';
    editingCategoryId = null;
    isNewCategory = false;
    if (favMode) {
      activeCategoryId = null;
      renderCategoryTabs();
    }
    renderClips(false);
  });

  // 返回主视图
  backToMainBtn.addEventListener('click', () => {
    favMode = false;
    favoritesBtn.classList.remove('active');
    backToMainBtn.classList.remove('visible');
    categoryBar.style.display = 'none';
    activeCategoryId = null;
    editingCategoryId = null;
    isNewCategory = false;
    renderClips(false);
  });

  // 关闭窗口按钮
  closeWindowBtn.addEventListener('click', () => {
    window.clipboardAPI.hideWindow();
  });

  // 最小化按钮
  minimizeBtn.addEventListener('click', () => {
    window.clipboardAPI.minimizeWindow();
  });

  // 眼球模式按钮
  orbBtn.addEventListener('click', () => {
    window.clipboardAPI.showEyeMode();
  });

  // 设置页头部按钮
  settingsCloseBtn.addEventListener('click', () => {
    window.clipboardAPI.hideWindow();
  });
  settingsMinimizeBtn.addEventListener('click', () => {
    window.clipboardAPI.minimizeWindow();
  });
  settingsOrbBtn.addEventListener('click', () => {
    window.clipboardAPI.showEyeMode();
  });

  // 刷新按钮
  const refreshBtn = document.getElementById('refreshBtn');
  refreshBtn.addEventListener('click', async () => {
    refreshBtn.style.transform = 'rotate(360deg)';
    refreshBtn.style.transition = 'transform 0.5s ease';
    setTimeout(() => { refreshBtn.style.transform = ''; refreshBtn.style.transition = ''; }, 500);
    await loadClips();
    await loadCategories();
    if (favMode) renderCategoryTabs();
  });

  // 桌面固定按钮
  desktopPinBtn.addEventListener('click', async () => {
    try {
      const pinned = await window.clipboardAPI.toggleDesktopPin();
      desktopPinBtn.classList.toggle('active', pinned);
      desktopPinBtn.title = pinned ? t('common.unpinDesktop') : t('common.desktopPin');
    } catch (e) {
      console.error('Desktop pin toggle failed:', e);
    }
  });

  // 初始化固定按钮状态
  window.clipboardAPI.getDesktopPinned().then(pinned => {
    desktopPinBtn.classList.toggle('active', pinned);
    desktopPinBtn.title = pinned ? t('common.unpinDesktop') : t('common.desktopPin');
  }).catch(() => {});
}

// ==================== IPC 消息 ====================
function setupIPCListeners() {
  // 主进程通知：导航到设置
  window.clipboardAPI.onNavigate(() => {
    showSettingsPanel();
  });

  // 主进程通知：窗口已显示
  window.clipboardAPI.onWindowShown(async () => {
    await loadCategories();
    await loadClips();
    // 恢复收藏筛选 UI 状态
    favoritesBtn.classList.toggle('active', favMode);
    backToMainBtn.classList.toggle('visible', favMode);
    categoryBar.style.display = favMode ? 'flex' : 'none';
    if (favMode) renderCategoryTabs();
    if (settingsPanel.classList.contains('visible')) {
      loadSettings();
      loadSettingsUI();
    }
  });
}

// ==================== 图片预览 ====================
function setupImagePreview() {
  closePreview.addEventListener('click', hideImagePreview);
  imageOverlay.addEventListener('click', (e) => {
    if (e.target === imageOverlay || e.target.classList.contains('image-overlay-bg')) {
      hideImagePreview();
    }
  });
}

function showImagePreview(src) {
  imagePreview.src = src;
  imageOverlay.classList.add('visible');
}

function hideImagePreview() {
  imageOverlay.classList.remove('visible');
  imagePreview.src = '';
}

// ==================== 渲染卡片列表 ====================
function renderClips(animate = false) {
  const scrollTop = clipList.scrollTop;   // 记住滚动位置
  clipList.style.visibility = 'hidden';  // 隐藏列表，消除重建闪烁
  clipList.innerHTML = '';

  let displayClips = clips;
  if (favMode) {
    displayClips = displayClips.filter(c => c.favorite);
    if (activeCategoryId !== null && activeCategoryId !== undefined) {
      displayClips = displayClips.filter(c => c.categories && c.categories.includes(activeCategoryId));
    }
  }

  recordCount.textContent = favMode
    ? t('list.favCount', { n: displayClips.length })
    : t('list.total', { n: clips.length });

  if (displayClips.length === 0) {
    clipList.innerHTML = favMode
      ? (activeCategoryId !== null
          ? `<div class="empty-state"><div class="empty-icon">📂</div><div class="empty-text">${t('list.empty.category')}</div><div class="empty-hint">${t('list.empty.categoryHint')}</div></div>`
          : `<div class="empty-state"><div class="empty-icon">⭐</div><div class="empty-text">${t('list.empty.fav')}</div><div class="empty-hint">${t('list.empty.favHint')}</div></div>`)
      : searchMode
        ? `<div class="no-results"><div class="icon">🔍</div>${t('search.noResults')}</div>`
        : `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">${t('list.empty.all')}</div><div class="empty-hint">${t('list.empty.allHint')}</div></div>`;
    clipList.style.visibility = 'visible';
    return;
  }

  displayClips.forEach((clip, index) => {
    const card = createClipCard(clip, index, animate);
    clipList.appendChild(card);
  });

  clipList.scrollTop = scrollTop;   // 恢复滚动位置
  clipList.style.visibility = 'visible';  // 显示列表
}

function createClipCard(clip, index, animate = false) {
  const card = document.createElement('div');
  card.className = 'clip-card' + (clip.pinned ? ' pinned' : '') + (animate ? '' : ' no-animate');
  card.dataset.id = clip.id;
  if (animate) card.style.animationDelay = `${index * 0.02}s`;

  // 内容
  if (clip.type === 'image') {
    const imgContainer = document.createElement('div');
    imgContainer.className = 'card-image-container loading';

    const placeholder = document.createElement('div');
    placeholder.className = 'image-placeholder';
    placeholder.textContent = '🖼️';
    imgContainer.appendChild(placeholder);

    const img = document.createElement('img');
    img.className = 'card-image';
    img.alt = t('common.image');

    const loadImage = (src) => {
      if (!src) return;
      img.onerror = () => { placeholder.textContent = '⚠️'; };
      img.onload = () => {
        placeholder.style.display = 'none';
        imgContainer.classList.remove('loading');
      };
      img.src = src;
    };

    if (clip.image_data) {
      loadImage(clip.image_data);
    } else {
      window.clipboardAPI.getImageData(clip.id).then(data => {
        if (data) loadImage(data);
      }).catch(() => {});
    }

    imgContainer.appendChild(img);
    card.appendChild(imgContainer);
  } else if (clip.type === 'file') {
    // 从 content JSON 解析完整路径和文件名
    let filePaths = [];
    try {
      filePaths = JSON.parse(clip.content || '[]');
    } catch (e) {
      filePaths = [];
    }

    // 从 DB 加载时没有 fileNames/fileCount，从 content JSON 解析
    if (!clip.fileNames || clip.fileNames.length === 0) {
      clip.fileNames = filePaths.map(p => {
        const parts = p.replace(/\\/g, '/').split('/');
        return parts[parts.length - 1];
      });
      clip.fileCount = filePaths.length;
    }

    // 文件列表展示 — 每个文件一行：Windows 系统图标 + 文件名
    const fileContainer = document.createElement('div');
    fileContainer.className = 'card-file-list';

    const fileNames = clip.fileNames || [];
    const fileIcons = clip.fileIcons || [];
    const maxShow = Math.min(fileNames.length, 3);
    const needsIcons = (!fileIcons || fileIcons.length === 0) && filePaths.length > 0;

    for (let i = 0; i < maxShow; i++) {
      const row = document.createElement('div');
      row.className = 'card-file-row';
      row.dataset.fileIndex = i;

      // Windows 系统图标（或回退到 📄 emoji）
      if (fileIcons[i]) {
        const iconImg = document.createElement('img');
        iconImg.className = 'card-file-icon-img';
        iconImg.src = fileIcons[i];
        row.appendChild(iconImg);
      } else {
        const iconSpan = document.createElement('span');
        iconSpan.className = 'card-file-icon-emoji';
        iconSpan.textContent = '📁';
        row.appendChild(iconSpan);
      }

      const nameSpan = document.createElement('span');
      nameSpan.className = 'card-file-name';
      nameSpan.textContent = fileNames[i];
      row.appendChild(nameSpan);

      fileContainer.appendChild(row);
    }

    if (fileNames.length > maxShow) {
      const moreRow = document.createElement('div');
      moreRow.className = 'card-file-row card-file-more';
      moreRow.textContent = t('list.moreFiles', { n: fileNames.length });
      fileContainer.appendChild(moreRow);
    }

    // 懒加载图标：如果没有图标（DB 加载的旧记录），异步请求 OS 图标
    if (needsIcons) {
      const iconPaths = filePaths.slice(0, Math.min(filePaths.length, 5));
      window.clipboardAPI.getFileIcons(iconPaths).then(icons => {
        if (!icons || icons.length === 0) return;
        // 缓存到 clip 对象，下次 render 直接用
        clip.fileIcons = icons;
        // 更新当前 DOM 中的图标
        const rows = fileContainer.querySelectorAll('.card-file-row[data-file-index]');
        rows.forEach(row => {
          const idx = parseInt(row.dataset.fileIndex);
          if (icons[idx]) {
            const old = row.querySelector('.card-file-icon-img, .card-file-icon-emoji');
            if (old) old.remove();
            const img = document.createElement('img');
            img.className = 'card-file-icon-img';
            img.src = icons[idx];
            row.insertBefore(img, row.firstChild);
          }
        });
      }).catch(() => {});
    }

    card.appendChild(fileContainer);
  } else {
    const content = document.createElement('div');
    content.className = 'card-content';
    content.textContent = clip.content || '';
    card.appendChild(content);
  }

  // 底部：时间（文字卡片） + 操作
  const meta = document.createElement('div');
  meta.className = 'card-meta';
  const time = document.createElement('span');
  time.className = 'card-time';
  time.textContent = formatTime(clip.created_at);
  meta.appendChild(time);

  // 分类标签（仅收藏夹模式 — 支持多分类）
  if (favMode) {
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'card-category-tags';

    const clipCats = (clip.categories || []).map(cid => categories.find(c => c.id == cid)).filter(Boolean);
    clipCats.forEach(cat => {
      const catTag = document.createElement('span');
      catTag.className = 'card-category-tag';
      catTag.textContent = cat.name;
      catTag.title = t('list.manageCategory');
      catTag.addEventListener('click', (e) => {
        e.stopPropagation();
        showCategoryPicker(clip.id, catTag);
      });
      tagsContainer.appendChild(catTag);
    });

    // "添加分类" 按钮
    const addTag = document.createElement('span');
    addTag.className = 'card-category-tag add-tag';
    addTag.textContent = '+';
    addTag.title = t('list.addCategory');
    addTag.addEventListener('click', (e) => {
      e.stopPropagation();
      showCategoryPicker(clip.id, addTag);
    });
    tagsContainer.appendChild(addTag);

    meta.appendChild(tagsContainer);
  }

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const pinBtn = document.createElement('button');
  pinBtn.className = 'action-btn pin-btn' + (clip.pinned ? ' active' : '');
  pinBtn.innerHTML = '📌';
  pinBtn.title = clip.pinned ? t('list.unpin') : t('list.pin');
  pinBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePin(clip.id); });

  const favBtn = document.createElement('button');
  favBtn.className = 'action-btn fav-btn' + (clip.favorite ? ' active' : '');
  favBtn.innerHTML = '⭐';
  favBtn.title = clip.favorite ? t('list.unfav') : t('list.fav');
  favBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFavorite(clip.id); });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'action-btn delete-btn';
  deleteBtn.innerHTML = '🗑️';
  deleteBtn.title = favMode ? t('list.unfav') : t('common.delete');
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (favMode) {
      toggleFavorite(clip.id);
    } else {
      deleteClip(clip.id);
    }
  });

  actions.appendChild(pinBtn);
  actions.appendChild(favBtn);
  actions.appendChild(deleteBtn);
  meta.appendChild(actions);
  card.appendChild(meta);

  // 左键点击卡片：复制（先给反馈再复制，避免文件类型异步慢导致反馈延迟）
  card.addEventListener('click', async () => {
    card.style.background = 'rgba(0, 122, 255, 0.08)';
    setTimeout(() => { card.style.background = ''; }, 200);
    showCopyToast();
    try {
      await window.clipboardAPI.copyToClipboard(clip.id);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  });

  // 右键点击卡片：文件类型显示操作菜单，其他类型打开详情
  card.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (clip.type === 'file') {
      let filePaths = [];
      try { filePaths = JSON.parse(clip.content || '[]'); } catch (err) {}
      showFileContextMenu(e.clientX, e.clientY, filePaths, clip.id);
    } else {
      window.clipboardAPI.openDetail(clip.id).catch(err => {
        console.error('Open detail failed:', err);
      });
    }
  });

  return card;
}

// ==================== 卡片操作 ====================
async function toggleFavorite(id) {
  try {
    const isFav = await window.clipboardAPI.toggleFavorite(id);
    const clip = clips.find(c => c.id == id);
    if (clip) {
      clip.favorite = isFav ? 1 : 0;
      if (!isFav) {
        clip.category_id = null;
        clip.categories = [];
      }
    }
    renderClips(false);
  } catch (e) {
    console.error('Toggle favorite failed:', e);
  }
}

async function togglePin(id) {
  try {
    const isPinned = await window.clipboardAPI.togglePin(id);
    const clip = clips.find(c => c.id == id);
    if (clip) clip.pinned = isPinned ? 1 : 0;
    sortClips();
    renderClips(false);
  } catch (e) {
    console.error('Toggle pin failed:', e);
  }
}

async function deleteClip(id) {
  try {
    await window.clipboardAPI.deleteClip(id);
    clips = clips.filter(c => c.id != id);
    renderClips(false);
  } catch (e) {
    console.error('Delete failed:', e);
  }
}

// ==================== 分类管理 ====================

async function loadCategories() {
  try {
    categories = await window.clipboardAPI.getCategories();
  } catch (e) {
    console.error('Failed to load categories:', e);
  }
}

function renderCategoryTabs() {
  categoryTabs.innerHTML = '';

  // 防御：如果 activeCategoryId 指向的分类已不存在，回退到"全部"
  if (activeCategoryId !== null && activeCategoryId !== undefined &&
      !categories.some(c => c.id == activeCategoryId)) {
    activeCategoryId = null;
  }

  // "全部" tab
  const allTab = document.createElement('button');
  allTab.className = 'category-tab' + (activeCategoryId === null && editingCategoryId === null ? ' active' : '');
  allTab.dataset.categoryId = '';
  allTab.textContent = t('cat.all');
  categoryTabs.appendChild(allTab);

  // 用户分类 tab
  categories.forEach(cat => {
    if (editingCategoryId == cat.id) {
      // 行内编辑模式
      const input = document.createElement('input');
      input.className = 'category-tab-edit';
      input.value = cat.name;
      input.dataset.categoryId = cat.id;
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') finishEditCategory(input);
        if (e.key === 'Escape') cancelEditCategory(input);
      });
      input.addEventListener('blur', () => finishEditCategory(input));
      categoryTabs.appendChild(input);
      // 下一帧自动聚焦并全选
      requestAnimationFrame(() => {
        input.focus();
        input.select();
      });
    } else {
      const tab = document.createElement('button');
      tab.className = 'category-tab' + (activeCategoryId == cat.id ? ' active' : '');
      tab.dataset.categoryId = cat.id;
      tab.textContent = cat.name;
      categoryTabs.appendChild(tab);
    }
  });
}

function startEditCategory(catId, isNew) {
  editingCategoryId = catId;
  isNewCategory = !!isNew;
  renderCategoryTabs();
}

async function finishEditCategory(inputEl) {
  // 防止 Enter 键和 blur 事件重复触发
  if (editingCategoryId === null) return;

  const catId = parseInt(inputEl.dataset.categoryId);
  const newName = inputEl.value.trim();
  const wasNew = isNewCategory;
  editingCategoryId = null;
  isNewCategory = false;
  if (wasNew) creatingCategory = false;  // 初始化完成，允许新建下一个

  if (!newName) {
    // 空名称 → 如果是新建的就删除，否则恢复原名
    if (wasNew) {
      deleteCategory(catId);
      return;
    }
    renderCategoryTabs();
    return;
  }

  // 检查重名
  const dup = categories.find(c => c.id != catId && c.name === newName);
  if (dup) {
    if (wasNew) {
      // 新建的分类重名，直接删除
      deleteCategory(catId);
    } else {
      // 重命名时重名：闪烁提示后恢复原名
      inputEl.style.borderColor = 'var(--danger)';
      inputEl.style.boxShadow = '0 0 0 3px rgba(229, 62, 48, 0.15)';
      setTimeout(() => renderCategoryTabs(), 600);
    }
    return;
  }

  const cat = categories.find(c => c.id == catId);
  if (!cat) { renderCategoryTabs(); return; }

  if (cat.name !== newName) {
    // 等待 rename 完成，确保 DB 和 UI 同步
    await renameCategory(catId, newName);
  } else {
    renderCategoryTabs();
  }

  // 新建分类保存后自动选中
  if (wasNew) {
    activeCategoryId = catId;
    renderCategoryTabs();
    renderClips(false);
  }
}

function cancelEditCategory(inputEl) {
  const catId = parseInt(inputEl.dataset.categoryId);
  editingCategoryId = null;

  if (isNewCategory) {
    isNewCategory = false;
    creatingCategory = false;  // 取消也允许新建下一个
    deleteCategory(catId);
    return;
  }

  isNewCategory = false;
  renderCategoryTabs();
}

function showCategoryContextMenu(x, y, catId) {
  categoryContextMenu.style.display = 'block';
  categoryContextMenu.style.left = x + 'px';
  categoryContextMenu.style.top = y + 'px';
  categoryContextMenu.dataset.categoryId = catId;
}

function hideCategoryContextMenu() {
  categoryContextMenu.style.display = 'none';
}

// ==================== 文件右键菜单 ====================

function showFileContextMenu(x, y, filePaths, clipId) {
  // 移除已有菜单
  hideFileContextMenu();

  const menu = document.createElement('div');
  menu.id = 'fileContextMenu';
  menu.className = 'category-context-menu';
  menu.style.display = 'block';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';

  // 每个文件有独立的"打开"选项 + 一个公用的"在文件夹中显示"
  const maxShow = Math.min(filePaths.length, 5);
  for (let i = 0; i < maxShow; i++) {
    const fp = filePaths[i];
    const name = fp.replace(/\\/g, '/').split('/').pop();

    // 打开文件 — 不同图标区分
    const openItem = document.createElement('div');
    openItem.className = 'context-menu-item';
    openItem.innerHTML = `🔗 ${escapeHTML(name)}`;
    openItem.addEventListener('click', () => {
      hideFileContextMenu();
      window.clipboardAPI.openFile(fp).catch(err => console.error('Open file failed:', err));
    });
    menu.appendChild(openItem);
  }

  if (filePaths.length > maxShow) {
    const moreItem = document.createElement('div');
    moreItem.className = 'context-menu-item';
    moreItem.textContent = t('list.moreFiles', { n: filePaths.length });
    moreItem.style.color = 'var(--text-secondary)';
    moreItem.style.cursor = 'default';
    moreItem.addEventListener('click', (e) => e.stopPropagation());
    menu.appendChild(moreItem);
  }

  // 在文件夹中显示（始终只对第一个文件）
  const sep = document.createElement('div');
  sep.style.cssText = 'height:1px;background:rgba(0,0,0,0.06);margin:4px 0;';
  menu.appendChild(sep);

  const folderItem = document.createElement('div');
  folderItem.className = 'context-menu-item';
  folderItem.innerHTML = escapeHTML(t('file.showInFolder'));
  folderItem.addEventListener('click', () => {
    hideFileContextMenu();
    window.clipboardAPI.showInFolder(filePaths[0]).catch(err => console.error('Show in folder failed:', err));
  });
  menu.appendChild(folderItem);

  document.body.appendChild(menu);

  // ── 任何菜单外操作都关闭菜单 ──
  const closeOnOutside = (e) => {
    if (!menu.contains(e.target)) hideFileContextMenu();
  };
  const closeOnKey = (e) => {
    if (e.key === 'Escape') hideFileContextMenu();
  };
  const closeOnBlur = () => hideFileContextMenu();

  document.addEventListener('mousedown', closeOnOutside);   // 左/右键按下（含滚动条点击）
  document.addEventListener('wheel', closeOnOutside);       // 滚轮滚动
  document.addEventListener('touchstart', closeOnOutside);  // 触屏
  document.addEventListener('keydown', closeOnKey);         // Esc
  window.addEventListener('blur', closeOnBlur);             // 窗口失焦
  document.addEventListener('scroll', closeOnOutside, true);// 任何容器滚动（捕获阶段）

  // 清理函数挂在 menu 上，hideFileContextMenu 时统一移除
  menu._cleanup = () => {
    document.removeEventListener('mousedown', closeOnOutside);
    document.removeEventListener('wheel', closeOnOutside);
    document.removeEventListener('touchstart', closeOnOutside);
    document.removeEventListener('keydown', closeOnKey);
    window.removeEventListener('blur', closeOnBlur);
    document.removeEventListener('scroll', closeOnOutside, true);
  };
}

function hideFileContextMenu() {
  const existing = document.getElementById('fileContextMenu');
  if (existing) {
    if (existing._cleanup) existing._cleanup();
    existing.remove();
  }
}

function escapeHTML(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 复制文本到剪贴板（优先现代 API，失败时降级到 execCommand）
async function copyTextToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch (e) { /* 降级到旧方案 */ }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(ta);
  }
}

async function createCategory(name) {
  try {
    const cat = await window.clipboardAPI.createCategory(name);
    // 去重：如果已存在同 ID 分类则替换，避免重复条目
    const existingIdx = categories.findIndex(c => c.id == cat.id);
    if (existingIdx >= 0) {
      categories[existingIdx] = cat;
    } else {
      categories.push(cat);
    }
    renderCategoryTabs();
  } catch (e) {
    console.error('Create category failed:', e);
  }
}

async function renameCategory(id, newName) {
  try {
    await window.clipboardAPI.renameCategory(id, newName);
    const cat = categories.find(c => c.id == id);
    if (cat) cat.name = newName;
    renderCategoryTabs();
  } catch (e) {
    console.error('Rename category failed:', e);
  }
}

async function deleteCategory(id) {
  try {
    await window.clipboardAPI.deleteCategory(id);
    categories = categories.filter(c => c.id != id);
    // 清除本地 clips 中该分类的关联
    clips.forEach(c => {
      if (c.categories) {
        c.categories = c.categories.filter(cid => cid != id);
      }
      if (c.category_id == id) c.category_id = null;
    });
    if (activeCategoryId == id) activeCategoryId = null;
    renderCategoryTabs();
    renderClips(false);
  } catch (e) {
    console.error('Delete category failed:', e);
  }
}

async function setClipCategory(clipId, categoryId) {
  try {
    await window.clipboardAPI.setClipCategory(clipId, categoryId);
    const clip = clips.find(c => c.id == clipId);
    if (clip) {
      clip.category_id = categoryId;
      // 多分类：添加到 categories 数组（不重复）
      if (!clip.categories) clip.categories = [];
      if (categoryId !== null && !clip.categories.includes(categoryId)) {
        clip.categories.push(categoryId);
      }
    }
    renderClips(false);
  } catch (e) {
    console.error('Set clip category failed:', e);
  }
}

// ==================== 分类编辑弹窗 ====================

let modalMode = 'create';  // 'create' | 'delete'
let deleteCheckedIds = new Set();

function showCategoryModal() {
  loadCategories();
  // 刷新剪贴数据 — 加载完成后重建列表，确保显示最新收藏
  window.clipboardAPI.getClips(getClipLimit(), 0).then(fresh => {
    clips = fresh;
    clips.forEach(parseCategoryIds);
    sortClips();
    buildModalClipList(); // 用最新数据重建列表
  }).catch(e => console.error('Modal load clips:', e));

  modalMode = 'create';
  modalTitle.textContent = t('modal.newCategory');
  modalCreateBody.style.display = 'block';
  modalDeleteBody.style.display = 'none';
  modalConfirmBtn.textContent = t('modal.create');
  modalConfirmBtn.className = 'modal-confirm-btn';
  modalCheckedIds.clear();
  modalNameInput.value = '';
  modalNameError.style.display = 'none';
  modalConfirmBtn.disabled = true;

  // 先用当前数据渲染（可能稍后会被异步刷新覆盖）
  buildModalClipList();

  // 名称输入实时启用/禁用确认按钮
  modalNameInput.oninput = () => {
    modalConfirmBtn.disabled = !modalNameInput.value.trim();
    modalNameError.style.display = 'none';
    modalNameInput.style.borderColor = '';
  };

  categoryModal.style.display = 'flex';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { modalNameInput.focus(); modalNameInput.select(); });
  });
}

function buildModalClipList() {
  const favClips = clips.filter(c => c.favorite);
  modalClipList.innerHTML = '';

  if (favClips.length === 0) {
    modalClipList.innerHTML = `<div class="modal-empty-hint">${t('modal.noFav')}</div>`;
    return;
  }

  favClips.forEach(clip => {
    const item = document.createElement('div');
    item.className = 'modal-clip-item';

    const check = document.createElement('div');
    check.className = 'modal-clip-check';
    check.dataset.clipId = clip.id;
    // 恢复已勾选状态（重新打开弹窗时不丢失）
    if (modalCheckedIds.has(clip.id)) check.classList.add('checked');

    const content = document.createElement('div');
    content.className = 'modal-clip-content';
    if (clip.type === 'image') {
      content.classList.add('image');
      content.textContent = t('file.image') + ' ' + (clip.dimensions || '');
    } else if (clip.type === 'file') {
      content.classList.add('file');
      buildModalFileContent(content, clip);
    } else {
      content.textContent = clip.content || '';
    }

    item.appendChild(check);
    item.appendChild(content);

    item.addEventListener('click', () => {
      if (modalCheckedIds.has(clip.id)) {
        modalCheckedIds.delete(clip.id);
        check.classList.remove('checked');
      } else {
        modalCheckedIds.add(clip.id);
        check.classList.add('checked');
      }
    });

    modalClipList.appendChild(item);
  });
}

// 弹窗中文件剪贴的内容渲染：Windows 系统图标 + 文件名（最多 3 个）
function buildModalFileContent(content, clip) {
  content.dataset.clipId = clip.id;

  let paths = [];
  try {
    paths = JSON.parse(clip.content || '[]');
  } catch (e) {
    paths = [];
  }
  if (paths.length === 0) {
    content.textContent = t('file.file');
    return;
  }

  const names = paths.map(p => p.replace(/\\/g, '/').split('/').pop());
  const maxShow = Math.min(paths.length, 3);

  for (let i = 0; i < maxShow; i++) {
    const row = document.createElement('div');
    row.className = 'modal-file-row';
    row.dataset.fileIndex = i;

    if (clip.fileIcons && clip.fileIcons[i]) {
      const iconImg = document.createElement('img');
      iconImg.className = 'modal-file-icon-img';
      iconImg.src = clip.fileIcons[i];
      row.appendChild(iconImg);
    } else {
      const iconSpan = document.createElement('span');
      iconSpan.className = 'modal-file-icon-emoji';
      iconSpan.textContent = '📁';
      row.appendChild(iconSpan);
    }

    const nameSpan = document.createElement('span');
    nameSpan.className = 'modal-file-name';
    nameSpan.textContent = names[i];
    row.appendChild(nameSpan);

    content.appendChild(row);
  }

  if (paths.length > maxShow) {
    const more = document.createElement('div');
    more.className = 'modal-file-more';
    more.textContent = t('list.moreFiles', { n: paths.length });
    content.appendChild(more);
  }

  // 懒加载系统图标（复用主列表缓存的 clip.fileIcons）
  if ((!clip.fileIcons || clip.fileIcons.length === 0) && paths.length > 0) {
    const iconPaths = paths.slice(0, Math.min(paths.length, 5));
    window.clipboardAPI.getFileIcons(iconPaths).then(icons => {
      if (!icons || icons.length === 0) return;
      clip.fileIcons = icons;
      // 弹窗列表可能已被异步刷新重建，优先更新仍挂在 DOM 上的行
      const scoped = content.isConnected
        ? content
        : modalClipList.querySelector(`.modal-clip-content.file[data-clip-id="${clip.id}"]`);
      if (!scoped) return;
      scoped.querySelectorAll('.modal-file-row[data-file-index]').forEach(row => {
        const idx = parseInt(row.dataset.fileIndex);
        if (icons[idx]) {
          const old = row.querySelector('.modal-file-icon-img, .modal-file-icon-emoji');
          if (old) old.remove();
          const img = document.createElement('img');
          img.className = 'modal-file-icon-img';
          img.src = icons[idx];
          row.insertBefore(img, row.firstChild);
        }
      });
    }).catch(() => {});
  }
}

function showDeleteModal() {
  loadCategories();
  modalMode = 'delete';
  modalTitle.textContent = t('modal.deleteTitle');
  modalCreateBody.style.display = 'none';
  modalDeleteBody.style.display = 'block';
  modalConfirmBtn.textContent = t('modal.deleteSelected');
  modalConfirmBtn.className = 'modal-confirm-btn danger';
  modalConfirmBtn.disabled = true;
  deleteCheckedIds.clear();

  modalDeleteList.innerHTML = '';
  if (categories.length === 0) {
    modalDeleteList.innerHTML = `<div class="modal-empty-hint">${t('modal.noCats')}</div>`;
  } else {
    categories.forEach(cat => {
      const item = document.createElement('div');
      item.className = 'modal-delete-item';
      const check = document.createElement('div');
      check.className = 'modal-delete-check';
      check.dataset.catId = cat.id;
      const name = document.createElement('span');
      name.className = 'modal-delete-name';
      name.textContent = cat.name;
      item.appendChild(check);
      item.appendChild(name);
      item.addEventListener('click', () => {
        if (deleteCheckedIds.has(cat.id)) {
          deleteCheckedIds.delete(cat.id);
          check.classList.remove('checked');
        } else {
          deleteCheckedIds.add(cat.id);
          check.classList.add('checked');
        }
        modalConfirmBtn.disabled = deleteCheckedIds.size === 0;
      });
      modalDeleteList.appendChild(item);
    });
  }
  categoryModal.style.display = 'flex';
}

function hideCategoryModal() {
  categoryModal.style.display = 'none';
  modalCheckedIds.clear();
  deleteCheckedIds.clear();
}

// ── 确认：创建分类 + 归入选中的剪贴 ──
async function confirmCategory() {
  if (confirmInProgress) return;
  confirmInProgress = true;
  modalConfirmBtn.disabled = true;

  try {
    if (modalMode === 'create') {
      const name = modalNameInput.value.trim();
      if (!name) { modalConfirmBtn.disabled = false; return; }

      // 重名检查
      if (categories.some(c => c.name === name)) {
        modalNameInput.style.borderColor = 'var(--danger)';
        modalNameError.style.display = 'flex';
        modalNameInput.focus();
        modalConfirmBtn.disabled = false;
        return;
      }

      // ① 创建分类
      const cat = await window.clipboardAPI.createCategory(name);
      if (!cat || !(cat.id > 0)) {
        throw new Error('分类创建返回异常：' + JSON.stringify(cat));
      }

      // ② 批量关联剪贴（先取快照，hideCategoryModal 会清空 modalCheckedIds）
      const checkedIds = [...modalCheckedIds];
      if (checkedIds.length > 0) {
        await window.clipboardAPI.batchSetClipCategory(checkedIds, cat.id);
      }

      // ③ 从 DB 完全刷新本地状态
      const fresh = await window.clipboardAPI.getClips(getClipLimit(), 0);
      clips = fresh;
      clips.forEach(parseCategoryIds);
      sortClips();
      await loadCategories();

      // ④ 关闭弹窗，导航到新分类
      hideCategoryModal();
      activeCategoryId = cat.id;
      renderCategoryTabs();
      renderClips(false);

      // ⑤ 成功反馈
      showCopyToast(checkedIds.length > 0
        ? t('modal.categoryCreated', { name: cat.name, n: checkedIds.length })
        : t('modal.categoryCreatedEmpty', { name: cat.name }));

    } else if (modalMode === 'delete') {
      if (deleteCheckedIds.size === 0) return;
      const ids = [...deleteCheckedIds];
      for (const id of ids) {
        await window.clipboardAPI.deleteCategory(id);
      }
      // 完全刷新
      const fresh = await window.clipboardAPI.getClips(getClipLimit(), 0);
      clips = fresh;
      clips.forEach(parseCategoryIds);
      sortClips();
      await loadCategories();
      if (ids.some(id => id == activeCategoryId)) activeCategoryId = null;
      hideCategoryModal();
      renderCategoryTabs();
      renderClips(false);
    }
  } catch (e) {
    console.error('confirmCategory error:', e);
    alert(t('common.opFailed', { msg: e.message || 'unknown' }));
  } finally {
    confirmInProgress = false;
    if (categoryModal.style.display === 'flex') {
      modalConfirmBtn.disabled = false;
    }
  }
}

// ==================== 分类选择下拉 ====================

async function removeClipCategory(clipId, categoryId) {
  try {
    await window.clipboardAPI.removeClipCategory(clipId, categoryId);
    const clip = clips.find(c => c.id == clipId);
    if (clip && clip.categories) {
      clip.categories = clip.categories.filter(cid => cid != categoryId);
    }
    renderClips(false);
  } catch (e) {
    console.error('Remove clip category failed:', e);
  }
}

function showCategoryPicker(clipId, anchorEl) {
  // 移除已有下拉
  document.querySelectorAll('.category-picker').forEach(p => p.remove());

  const picker = document.createElement('div');
  picker.className = 'category-picker';
  picker.style.position = 'fixed';

  // 一次查找当前剪贴的所有分类
  const currentClip = clips.find(c => c.id == clipId);
  const currentCatIds = currentClip ? (currentClip.categories || []) : [];

  // 无分类选项
  const noneItem = document.createElement('div');
  noneItem.className = 'category-picker-item' + (currentCatIds.length === 0 ? ' active' : '');
  noneItem.innerHTML = `<span class="picker-check"></span>${escapeHTML(t('cat.none'))}`;
  noneItem.addEventListener('click', async (e) => {
    e.stopPropagation();
    // 清除所有分类
    for (const cid of currentCatIds) {
      await window.clipboardAPI.removeClipCategory(clipId, cid);
    }
    if (currentClip) {
      currentClip.categories = [];
      currentClip.category_id = null;
    }
    picker.remove();
    renderClips(false);
  });
  picker.appendChild(noneItem);

  // 已有分类 — 多选复选框
  categories.forEach(cat => {
    const isInCat = currentCatIds.includes(cat.id);
    const item = document.createElement('div');
    item.className = 'category-picker-item' + (isInCat ? ' active' : '');
    // 分类名来自用户输入，必须转义后再拼 HTML，防止存储型自注入
    item.innerHTML = `<span class="picker-check">${isInCat ? '✓' : ''}</span>${escapeHTML(cat.name)}`;
    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (isInCat) {
        // 已属于此分类 → 移除
        await removeClipCategory(clipId, cat.id);
      } else {
        // 不属于此分类 → 添加
        await setClipCategory(clipId, cat.id);
      }
      picker.remove();
      renderClips(false);
    });
    picker.appendChild(item);
  });

  // 放置到 anchor 旁边
  const rect = anchorEl.getBoundingClientRect();
  picker.style.left = rect.left + 'px';
  picker.style.top = (rect.bottom + 4) + 'px';
  document.body.appendChild(picker);

  // 点击外部关闭
  const closePicker = (e) => {
    if (!picker.contains(e.target) && e.target !== anchorEl) {
      picker.remove();
      document.removeEventListener('click', closePicker);
    }
  };
  setTimeout(() => document.addEventListener('click', closePicker), 0);
}

// ==================== 分类事件绑定 ====================

function setupCategoryListeners() {
  // ── 标签点击：切换分类 ──
  categoryTabs.addEventListener('click', (e) => {
    if (e.target.tagName === 'INPUT') return;
    const tab = e.target.closest('.category-tab');
    if (!tab) return;
    const catId = tab.dataset.categoryId;
    activeCategoryId = (catId === '' || catId === undefined) ? null : parseInt(catId);
    renderCategoryTabs();
    renderClips(false);
  });

  // ── 新建分类按钮 → 弹窗 ──
  addCategoryBtn.addEventListener('click', () => {
    if (creatingCategory) return;
    showCategoryModal();
  });

  // ── 删除分类按钮 → 弹窗多选删除 ──
  deleteCategoryBtn.addEventListener('click', () => {
    showDeleteModal();
  });

  // ── 右键菜单 ──
  categoryTabs.addEventListener('contextmenu', (e) => {
    const tab = e.target.closest('.category-tab');
    if (!tab) return;
    const catId = tab.dataset.categoryId;
    if (!catId) return;
    e.preventDefault();
    e.stopPropagation();
    showCategoryContextMenu(e.clientX, e.clientY, parseInt(catId));
    contextMenuJustOpened = true;
    setTimeout(() => { contextMenuJustOpened = false; }, 300);
  });

  // ── 右键菜单操作 ──
  categoryContextMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    const item = e.target.closest('.context-menu-item');
    if (!item) return;
    const action = item.dataset.action;
    const catId = parseInt(categoryContextMenu.dataset.categoryId);
    hideCategoryContextMenu();

    if (action === 'rename') {
      startEditCategory(catId, false);
    } else if (action === 'delete') {
      const cat = categories.find(c => c.id == catId);
      if (cat && confirm(t('cat.confirmDelete', { name: cat.name }))) {
        deleteCategory(catId);
      }
    }
  });

  // ── 点击任意处关闭右键菜单 ──
  document.addEventListener('click', (e) => {
    if (contextMenuJustOpened) return;
    if (!categoryContextMenu.contains(e.target)) {
      hideCategoryContextMenu();
    }
    const fileMenu = document.getElementById('fileContextMenu');
    if (fileMenu && !fileMenu.contains(e.target)) {
      hideFileContextMenu();
    }
  });

  // ── 弹窗事件 ──
  modalCloseBtn.addEventListener('click', hideCategoryModal);
  modalCancelBtn.addEventListener('click', hideCategoryModal);

  // 点击遮罩关闭
  categoryModal.addEventListener('click', (e) => {
    if (e.target === categoryModal) hideCategoryModal();
  });

  // 确认按钮
  modalConfirmBtn.addEventListener('click', () => {
    if (confirmInProgress || modalConfirmBtn.disabled) return;
    confirmCategory();
  });

  // 回车确认
  modalNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !modalConfirmBtn.disabled && !confirmInProgress) {
      confirmCategory();
    }
    if (e.key === 'Escape') hideCategoryModal();
  });

  // 弹窗打开时也响应 Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && categoryModal.style.display === 'flex') {
      hideCategoryModal();
    }
  });
}

// ==================== 实时新记录 ====================
function setupNewClipListener() {
  window.clipboardAPI.onNewClip((newClip) => {
    if (clips.some(c => c.id == newClip.id)) return;
    parseCategoryIds(newClip);
    clips.unshift(newClip);
    sortClips();
    renderClips(true);
  });
}

// ==================== 工具 ====================

// 渲染 Photoshop 风格的快捷键键帽
function renderShortcutKeys(shortcut) {
  if (!shortcutDisplay) return;

  const parts = shortcut.split('+').map(p => p.trim()).filter(Boolean);
  shortcutDisplay.innerHTML = '';

  parts.forEach((part, i) => {
    // 键帽
    const keyEl = document.createElement('span');
    keyEl.className = 'shortcut-key';
    keyEl.textContent = part;
    shortcutDisplay.appendChild(keyEl);

    // 分隔符 +
    if (i < parts.length - 1) {
      const sep = document.createElement('span');
      sep.className = 'shortcut-separator';
      sep.textContent = '+';
      shortcutDisplay.appendChild(sep);
    }
  });
}

function sortClips() {
  clips.sort((a, b) => {
    if (a.pinned !== b.pinned) return b.pinned - a.pinned;
    return new Date(b.created_at) - new Date(a.created_at);
  });
}

function formatTime(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);

  if (diffMin < 1) return t('list.time.justNow');
  if (diffMin < 60) return t('list.time.minutesAgo', { n: diffMin });
  if (diffHour < 24) return t('list.time.hoursAgo', { n: diffHour });

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today - 86400000);
  const clipDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (clipDay.getTime() === today.getTime()) return t('list.time.today', { hm: formatHM(date) });
  if (clipDay.getTime() === yesterday.getTime()) return t('list.time.yesterday', { hm: formatHM(date) });

  const diffDay = Math.floor((today - clipDay) / 86400000);
  if (diffDay < 7) return t('list.time.daysAgo', { n: diffDay });
  return `${date.getFullYear()}/${pad(date.getMonth()+1)}/${pad(date.getDate())}`;
}

function formatHM(date) { return pad(date.getHours()) + ':' + pad(date.getMinutes()); }
function pad(n) { return n < 10 ? '0' + n : '' + n; }
function showError(msg) {
  clipList.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">'+msg+'</div></div>';
}

// --- 复制成功提示 ---
let copyToastTimer = null;
function showCopyToast(msg) {
  const toast = document.getElementById('copyToast');
  if (!toast) return;
  if (copyToastTimer) clearTimeout(copyToastTimer);
  // 支持自定义消息（如"分类已创建"），默认"已复制 ✓"
  toast.textContent = msg || t('toast.copied');
  toast.classList.remove('hide');
  toast.classList.add('show');
  copyToastTimer = setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('hide');
  }, 1200);
}

init().catch(e => console.error('Init failed:', e));
