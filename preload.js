const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('clipboardAPI', {
  // 剪贴板历史
  getClips: (limit = 100, offset = 0) =>
    ipcRenderer.invoke('clips:getList', { limit, offset }),
  searchClips: (keyword) =>
    ipcRenderer.invoke('clips:search', { keyword }),
  togglePin: (id) =>
    ipcRenderer.invoke('clips:togglePin', { id }),
  toggleFavorite: (id) =>
    ipcRenderer.invoke('clips:toggleFavorite', { id }),
  deleteClip: (id) =>
    ipcRenderer.invoke('clips:delete', { id }),
  copyToClipboard: (id) =>
    ipcRenderer.invoke('clips:copyToClipboard', { id }),
  openDetail: (id) =>
    ipcRenderer.invoke('clips:openDetail', { id }),
  getImageData: (id) =>
    ipcRenderer.invoke('clips:getImageData', { id }),
  clearAll: () =>
    ipcRenderer.invoke('clips:clearAll'),

  // 设置
  getSettings: () =>
    ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) =>
    ipcRenderer.invoke('settings:set', settings),

  // 监听新记录
  onNewClip: (callback) => {
    const handler = (event, clip) => callback(clip);
    ipcRenderer.on('clipboard:newItem', handler);
    return () => ipcRenderer.removeListener('clipboard:newItem', handler);
  },

  // 监听导航
  onNavigate: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('navigate:settings', handler);
    return () => ipcRenderer.removeListener('navigate:settings', handler);
  },

  // 监听窗口显示
  onWindowShown: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('window:shown', handler);
    return () => ipcRenderer.removeListener('window:shown', handler);
  },

  // 桌面固定
  toggleDesktopPin: () => ipcRenderer.invoke('window:toggleDesktopPin'),
  getDesktopPinned: () => ipcRenderer.invoke('window:getDesktopPinned'),

  // 窗口操作
  hideWindow: () => ipcRenderer.send('window:hide'),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),

  // 分类管理
  getCategories: () =>
    ipcRenderer.invoke('categories:getAll'),
  createCategory: (name) =>
    ipcRenderer.invoke('categories:create', { name }),
  renameCategory: (id, name) =>
    ipcRenderer.invoke('categories:rename', { id, name }),
  deleteCategory: (id) =>
    ipcRenderer.invoke('categories:delete', { id }),
  setClipCategory: (clipId, categoryId) =>
    ipcRenderer.invoke('categories:setClipCategory', { clipId, categoryId }),
  removeClipCategory: (clipId, categoryId) =>
    ipcRenderer.invoke('categories:removeClipCategory', { clipId, categoryId }),
  batchSetClipCategory: (clipIds, categoryId) =>
    ipcRenderer.invoke('categories:batchSet', { clipIds, categoryId }),

  // 卸载（deleteData: true=删数据, false=保留数据）
  uninstall: (deleteData) => ipcRenderer.invoke('app:uninstall', { deleteData }),

  // 导出历史
  exportHistory: () => ipcRenderer.invoke('clips:exportHistory'),

  // 安装目录
  getInstallDir: () => ipcRenderer.invoke('app:getInstallDir'),

  // 文件图标懒加载
  getFileIcons: (paths) => ipcRenderer.invoke('app:getFileIcons', { paths }),

  // 打开文件
  openFile: (filePath) => ipcRenderer.invoke('app:openFile', { filePath }),
  showInFolder: (filePath) => ipcRenderer.invoke('app:showInFolder', { filePath }),

  // 眼睛模式
  showEyeMode: () => ipcRenderer.send('eye:show'),
  eyeClicked: () => ipcRenderer.send('eye:clicked'),
  getCursorPos: () => ipcRenderer.invoke('eye:getCursorPos'),
  moveEye: (dx, dy) => ipcRenderer.send('eye:move', { dx, dy }),
  setEyeSize: (size) => ipcRenderer.send('eye:setSize', { size }),

  // 眼睛状态变化（主进程推送）
  onEyeState: (callback) => {
    const handler = (event, state) => callback(state);
    ipcRenderer.on('eye:setState', handler);
    return () => ipcRenderer.removeListener('eye:setState', handler);
  },

  // 伴生窗口 — 重置
  onCompanionReset: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('companion:reset', handler);
    return () => ipcRenderer.removeListener('companion:reset', handler);
  }
});
