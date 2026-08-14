// ============================================
// PasteHistory - 中英文文案词典
// 主进程 (require) 与渲染进程 (<script>) 共用
// ============================================
const STRINGS = {
  zh: {
    // 通用
    'common.settings': '设置',
    'common.loading': '加载中…',
    'common.loadFailed': '加载失败',
    'common.copy': '复制',
    'common.copiedOk': '已复制 ✓',
    'common.cancel': '取消',
    'common.delete': '删除',
    'common.back': '返回',
    'common.backToAll': '返回全部',
    'common.backToAllText': '← 返回',
    'common.refresh': '刷新',
    'common.minimize': '最小化',
    'common.close': '关闭窗口',
    'common.desktopPin': '钉在桌面',
    'common.unpinDesktop': '取消固定',
    'common.favorites': '收藏夹',
    'common.preview': '预览',
    'common.image': '图片',
    'common.opFailed': '操作失败：{msg}',

    // 搜索
    'search.placeholder': '搜索历史...',
    'search.clear': '清除搜索',
    'search.noResults': '没有找到匹配的记录',

    // 列表
    'list.total': '共 {n} 条记录',
    'list.favCount': '⭐ {n} 条收藏',
    'list.pin': '置顶到列表顶部',
    'list.unpin': '取消置顶',
    'list.fav': '收藏',
    'list.unfav': '取消收藏',
    'list.moreFiles': '…等 {n} 个文件',
    'list.manageCategory': '点击管理分类',
    'list.addCategory': '点击添加分类',
    'list.empty.all': '还没有复制记录',
    'list.empty.allHint': '试试复制一段文字或图片',
    'list.empty.fav': '还没有收藏记录',
    'list.empty.favHint': '点击卡片上的 ⭐ 收藏',
    'list.empty.category': '此分类下还没有收藏',
    'list.empty.categoryHint': '将收藏归类到此分类',
    'list.time.justNow': '刚刚',
    'list.time.minutesAgo': '{n} 分钟前',
    'list.time.hoursAgo': '{n} 小时前',
    'list.time.today': '今天 {hm}',
    'list.time.yesterday': '昨天 {hm}',
    'list.time.daysAgo': '{n} 天前',

    // 分类
    'cat.all': '全部',
    'cat.add': '新建分类',
    'cat.deleteSelected': '删除选中分类',
    'cat.none': '无分类',
    'cat.rename': '✏️ 重命名',
    'cat.delete': '🗑️ 删除',
    'cat.confirmDelete': '确定删除分类 "{name}" 吗？\n收藏不会被删除，只是取消分类归属。',

    // 文件菜单
    'file.showInFolder': '📁 在文件夹中显示',
    'file.file': '📁 文件',
    'file.image': '🖼️ 图片',

    // 眼睛模式
    'eye.title': '眼球模式',

    // 设置面板
    'settings.groupGeneral': '通用',
    'settings.groupShortcut': '快捷操作',
    'settings.groupEye': '眼睛模式',
    'settings.groupData': '数据',
    'settings.groupDanger': '危险操作',
    'settings.language': '界面语言',
    'settings.theme': '深色模式',
    'settings.light': '浅色',
    'settings.dark': '深色',
    'settings.retention': '保留期限',
    'settings.retentionDay': '{n} 天',
    'settings.custom': '自定义',
    'settings.daysPh': '天数',
    'settings.daysUnit': '天',
    'settings.maxClips': '最大记录数',
    'settings.countPh': '数量',
    'settings.countUnit': '条',
    'settings.shortcut': '全局快捷键',
    'settings.shortcutPh': '点击修改',
    'settings.change': '修改',
    'settings.shortcutHint': '请按下组合键...（如 Ctrl+Shift+V）',
    'settings.pressCombo': '按下组合键...',
    'settings.autoLaunch': '开机自动启动',
    'settings.eyeSize': '眼睛大小',
    'settings.small': '小',
    'settings.medium': '中',
    'settings.large': '大',
    'settings.eyeIdle': '犯困时间',
    'settings.seconds': '{n} 秒',
    'settings.minutes': '{n} 分钟',
    'settings.secondsPh': '秒数',
    'settings.secondsUnit': '秒',
    'settings.eyeIdleHint': '鼠标静止超过此时长后，眼睛逐渐犯困并入睡',
    'settings.installDir': '安装目录',
    'settings.export': '导出历史记录',
    'settings.exportOk': '导出成功 ✓',
    'settings.exportFail': '导出失败',
    'settings.clearAll': '清空所有历史',
    'settings.uninstall': '删除 PasteHistory 程序',
    'settings.uninstallHint': '记录和设置将保留',
    'settings.confirmClearAll': '确定要清空所有历史记录吗？此操作不可恢复。',
    'settings.confirmUninstall': '确定要删除 PasteHistory 程序吗？\n\n剪贴板记录和设置将保留在电脑上。\n程序将在重启后自动删除。',

    // 分类弹窗
    'modal.newCategory': '新建分类',
    'modal.namePh': '输入分类名称…',
    'modal.nameExists': '该分类名称已存在',
    'modal.selectClips': '选择要加入的收藏',
    'modal.selectCats': '选择要删除的分类',
    'modal.deleteTitle': '删除分类',
    'modal.create': '创建分类',
    'modal.deleteSelected': '删除选中',
    'modal.noFav': '还没有收藏内容，请先在主页收藏',
    'modal.noCats': '没有可删除的分类',
    'modal.categoryCreated': '分类「{name}」已创建，{n} 条收藏已归入',
    'modal.categoryCreatedEmpty': '分类「{name}」已创建',

    // toast
    'toast.copied': '已复制 ✓',

    // 托盘
    'tray.open': '打开 PasteHistory',
    'tray.settings': '设置',
    'tray.quit': '退出',

    // 导出
    'export.title': '导出历史记录',
    'export.filter': '文本文件',
    'export.header': '📋  PasteHistory  历史记录导出',
    'export.time': '导出时间：{time}',
    'export.total': '记录总数：{n} 条',
    'export.stats': '文字 {t} 条 · 图片 {i} 条 · 文件 {f} 条',
    'export.favPin': '⭐ 收藏 {f} 条 · 📌 置顶 {p} 条',
    'export.tagPin': '📌 置顶',
    'export.tagFav': '⭐ 收藏',
    'export.empty': '(空)',
    'export.unknownSize': '未知尺寸',
    'export.files': '{n} 个文件',
    'export.footer': '— 共 {n} 条记录 · PasteHistory v{ver} —',

    // 详情窗口
    'detail.title': '查看详情',
    'detail.imageMissing': '（图片文件缺失或路径无效）'
  },

  en: {
    // Common
    'common.settings': 'Settings',
    'common.loading': 'Loading…',
    'common.loadFailed': 'Failed to load',
    'common.copy': 'Copy',
    'common.copiedOk': 'Copied ✓',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.back': 'Back',
    'common.backToAll': 'Back to all',
    'common.backToAllText': '← Back',
    'common.refresh': 'Refresh',
    'common.minimize': 'Minimize',
    'common.close': 'Close window',
    'common.desktopPin': 'Pin to desktop',
    'common.unpinDesktop': 'Unpin from desktop',
    'common.favorites': 'Favorites',
    'common.preview': 'Preview',
    'common.image': 'Image',
    'common.opFailed': 'Operation failed: {msg}',

    // Search
    'search.placeholder': 'Search history...',
    'search.clear': 'Clear search',
    'search.noResults': 'No matching records',

    // List
    'list.total': '{n} records',
    'list.favCount': '⭐ {n} favorites',
    'list.pin': 'Pin to top',
    'list.unpin': 'Unpin',
    'list.fav': 'Favorite',
    'list.unfav': 'Unfavorite',
    'list.moreFiles': '…and {n} more files',
    'list.manageCategory': 'Click to manage categories',
    'list.addCategory': 'Click to add category',
    'list.empty.all': 'No copied records yet',
    'list.empty.allHint': 'Try copying some text or an image',
    'list.empty.fav': 'No favorites yet',
    'list.empty.favHint': 'Click ⭐ on a card to favorite it',
    'list.empty.category': 'No favorites in this category',
    'list.empty.categoryHint': 'Assign favorites to this category',
    'list.time.justNow': 'just now',
    'list.time.minutesAgo': '{n} min ago',
    'list.time.hoursAgo': '{n} h ago',
    'list.time.today': 'today {hm}',
    'list.time.yesterday': 'yesterday {hm}',
    'list.time.daysAgo': '{n} d ago',

    // Categories
    'cat.all': 'All',
    'cat.add': 'New category',
    'cat.deleteSelected': 'Delete categories',
    'cat.none': 'No category',
    'cat.rename': '✏️ Rename',
    'cat.delete': '🗑️ Delete',
    'cat.confirmDelete': 'Delete category "{name}"?\nFavorites will not be deleted, only unassigned.',

    // File menu
    'file.showInFolder': '📁 Show in folder',
    'file.file': '📁 Files',
    'file.image': '🖼️ Image',

    // Eye mode
    'eye.title': 'Eye mode',

    // Settings panel
    'settings.groupGeneral': 'General',
    'settings.groupShortcut': 'Shortcuts',
    'settings.groupEye': 'Eye Mode',
    'settings.groupData': 'Data',
    'settings.groupDanger': 'Danger Zone',
    'settings.language': 'Language',
    'settings.theme': 'Dark mode',
    'settings.light': 'Light',
    'settings.dark': 'Dark',
    'settings.retention': 'Retention',
    'settings.retentionDay': '{n} days',
    'settings.custom': 'Custom',
    'settings.daysPh': 'Days',
    'settings.daysUnit': 'days',
    'settings.maxClips': 'Max records',
    'settings.countPh': 'Count',
    'settings.countUnit': 'items',
    'settings.shortcut': 'Global shortcut',
    'settings.shortcutPh': 'Click to change',
    'settings.change': 'Change',
    'settings.shortcutHint': 'Press a key combo... (e.g. Ctrl+Shift+V)',
    'settings.pressCombo': 'Press a combo...',
    'settings.autoLaunch': 'Launch at startup',
    'settings.eyeSize': 'Eye size',
    'settings.small': 'Small',
    'settings.medium': 'Medium',
    'settings.large': 'Large',
    'settings.eyeIdle': 'Drowsy after',
    'settings.seconds': '{n} s',
    'settings.minutes': '{n} min',
    'settings.secondsPh': 'Seconds',
    'settings.secondsUnit': 's',
    'settings.eyeIdleHint': 'The eye gets drowsy and falls asleep after the mouse stays still for this long',
    'settings.installDir': 'Install folder',
    'settings.export': 'Export history',
    'settings.exportOk': 'Exported ✓',
    'settings.exportFail': 'Export failed',
    'settings.clearAll': 'Clear all history',
    'settings.uninstall': 'Uninstall PasteHistory',
    'settings.uninstallHint': 'History and settings will be kept',
    'settings.confirmClearAll': 'Clear all history? This cannot be undone.',
    'settings.confirmUninstall': 'Uninstall PasteHistory?\n\nYour clipboard history and settings will be kept on this computer.\nThe program will be removed after restart.',

    // Category modal
    'modal.newCategory': 'New category',
    'modal.namePh': 'Category name…',
    'modal.nameExists': 'This name already exists',
    'modal.selectClips': 'Select favorites to add',
    'modal.selectCats': 'Select categories to delete',
    'modal.deleteTitle': 'Delete categories',
    'modal.create': 'Create',
    'modal.deleteSelected': 'Delete selected',
    'modal.noFav': 'No favorites yet. Star some clips first.',
    'modal.noCats': 'No categories to delete',
    'modal.categoryCreated': 'Category "{name}" created with {n} favorites',
    'modal.categoryCreatedEmpty': 'Category "{name}" created',

    // Toast
    'toast.copied': 'Copied ✓',

    // Tray
    'tray.open': 'Open PasteHistory',
    'tray.settings': 'Settings',
    'tray.quit': 'Quit',

    // Export
    'export.title': 'Export history',
    'export.filter': 'Text files',
    'export.header': '📋  PasteHistory  History Export',
    'export.time': 'Exported at: {time}',
    'export.total': 'Total records: {n}',
    'export.stats': 'Text {t} · Images {i} · Files {f}',
    'export.favPin': '⭐ Favorites {f} · 📌 Pinned {p}',
    'export.tagPin': '📌 Pinned',
    'export.tagFav': '⭐ Favorite',
    'export.empty': '(empty)',
    'export.unknownSize': 'unknown size',
    'export.files': '{n} files',
    'export.footer': '— {n} records · PasteHistory v{ver} —',

    // Detail window
    'detail.title': 'View details',
    'detail.imageMissing': '(Image file missing or invalid path)'
  }
};

function t(lang, key, params) {
  let str = (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.zh[key] || key;
  if (params) {
    Object.keys(params).forEach(k => {
      str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), params[k]);
    });
  }
  return str;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { STRINGS, t };
}
if (typeof window !== 'undefined') {
  window.i18n = { STRINGS, t };
}
