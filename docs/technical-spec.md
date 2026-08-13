# 技术规格 - PasteHistory（历史粘贴板）

> 本文档描述 v3.0.0 的实际实现。若与代码冲突，以代码为准。

## 技术栈

| 层面 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 桌面框架 | Electron | 33.x | 窗口管理、系统托盘、全局快捷键、剪贴板 API |
| 数据库 | sql.js | 1.14.x | WASM 版 SQLite，纯 JS 免编译，`db.export()` 全量落盘 |
| 前端 | HTML/CSS/JS | - | 无框架，原生实现 |
| 打包 | electron-builder | 26.x | 生成 Windows NSIS 安装包 |
| 运行时 | Node.js | ≥18 | Electron 内置 |

> 注：早期方案 better-sqlite3 因原生模块兼容性问题弃用，改用 sql.js（WASM），
> 无需编译、无需 electron-rebuild。

## 项目依赖

```json
{
  "dependencies": {
    "sql.js": "^1.14.1"
  },
  "devDependencies": {
    "electron": "^33.0.0",
    "electron-builder": "^26.15.3"
  }
}
```

---

## 数据库设计

### 数据库位置
`%APPDATA%/ClipHistory/data.db`

### 表结构

```sql
CREATE TABLE categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    sort_order  INTEGER DEFAULT 0,
    created_at  TEXT    NOT NULL
);

CREATE TABLE clips (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    type        TEXT    NOT NULL,          -- 'text' | 'image' | 'file'
    content     TEXT,                      -- 文字内容 / 文件路径 JSON 数组
    image_path  TEXT,                      -- 图片文件路径（type='image'）
    image_hash  TEXT,                      -- 图片 MD5 / 文件路径哈希（去重用）
    dimensions  TEXT,                      -- 图片尺寸，如 "1920×1080"
    image_seq   INTEGER,                   -- 图片自动编号
    created_at  TEXT    NOT NULL,          -- ISO 8601 时间戳
    pinned      INTEGER DEFAULT 0,         -- 0=未置顶, 1=已置顶
    favorite    INTEGER DEFAULT 0,         -- 0=未收藏, 1=已收藏
    category_id INTEGER,                   -- 主分类（冗余列，向后兼容）
    deleted     INTEGER DEFAULT 0          -- 0=正常, 1=已删除（软删除）
);

CREATE TABLE clip_categories (
    clip_id     INTEGER NOT NULL,          -- 多分类关联表
    category_id INTEGER NOT NULL,
    PRIMARY KEY (clip_id, category_id)
);
```

### 持久化与迁移

- sql.js 数据库常驻内存，每次写操作后 `db.export()` 全量写入 data.db
- 启动时自动执行：建表（IF NOT EXISTS）→ 列迁移（ALTER TABLE，重复列忽略）→
  旧 `category_id` 数据迁移到 `clip_categories` → 清理脏数据（关联到不存在分类的行）

### 关键实现注意

- `run()` 在 `saveToDisk()` **之前**读取 `last_insert_rowid()`：
  sql.js 的 `db.export()` 会关闭并重开底层连接，重开后 `last_insert_rowid()` 归零，
  后读会拿到错误 id（历史 bug 根因）
- 所有 SQL 均参数化绑定，无字符串拼接；搜索 LIKE 通配符（`%`/`_`）已转义

---

## IPC 通信接口

主进程 (main) 与渲染进程 (renderer) 通过 Electron IPC 通信。
preload.js 通过 `contextBridge` 暴露安全的 API（`window.clipboardAPI`），
渲染进程无 Node.js 权限。

### 渲染进程 → 主进程 (invoke)

| 通道 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `clips:getList` | `{ limit, offset }` | `Clip[]` | 获取历史列表 |
| `clips:search` | `{ keyword }` | `Clip[]` | 搜索历史（上限与 maxClips 联动） |
| `clips:togglePin` | `{ id }` | `boolean` | 切换置顶状态 |
| `clips:toggleFavorite` | `{ id }` | `boolean` | 切换收藏状态 |
| `clips:delete` | `{ id }` | `boolean` | 删除记录（图片同步删文件） |
| `clips:copyToClipboard` | `{ id }` | `boolean` | 将记录内容写回剪贴板 |
| `clips:openDetail` | `{ id }` | `boolean` | 打开详情窗口 |
| `clips:getImageData` | `{ id }` | `dataURL \| null` | 图片 base64（懒加载） |
| `clips:clearAll` | - | `boolean` | 清空全部记录（含图片文件） |
| `clips:exportHistory` | - | `boolean` | 导出历史为 txt |
| `settings:get` / `settings:set` | `Settings` | `Settings` / `boolean` | 读写设置 |
| `categories:getAll` | - | `Category[]` | 分类列表 |
| `categories:create` | `{ name }` | `Category` | 新建分类 |
| `categories:rename` | `{ id, name }` | `boolean` | 重命名分类 |
| `categories:delete` | `{ id }` | `boolean` | 删除分类（保留收藏） |
| `categories:setClipCategory` | `{ clipId, categoryId }` | `boolean` | 添加到分类 |
| `categories:removeClipCategory` | `{ clipId, categoryId }` | `boolean` | 移出分类 |
| `categories:batchSet` | `{ clipIds, categoryId }` | `boolean` | 批量归入分类 |
| `window:toggleDesktopPin` | - | `boolean` | 桌面固定开关 |
| `window:getDesktopPinned` | - | `boolean` | 查询固定状态 |
| `app:getInstallDir` | - | `string` | 软件安装目录绝对路径 |
| `app:getFileIcons` | `{ paths }` | `dataURL[]` | 文件系统图标懒加载（最多 20 个） |
| `app:openFile` | `{ filePath }` | `boolean` | 用默认程序打开文件 |
| `app:showInFolder` | `{ filePath }` | `boolean` | 资源管理器定位文件 |
| `app:uninstall` | `{ deleteData }` | `boolean` | 卸载程序（可选删数据） |
| `eye:getCursorPos` | - | `{cursorX,...} \| null` | 鼠标与眼窗位置 |

### 渲染进程 → 主进程 (send)

| 通道 | 数据 | 说明 |
|------|------|------|
| `window:hide` / `window:minimize` | - | 窗口操作 |
| `eye:show` / `eye:clicked` | - | 眼睛模式开关 |
| `eye:move` | `{ dx, dy }` | 拖拽移动眼睛 |
| `eye:setSize` | `{ size }` | 眼睛大小（白名单：small/medium/large） |

### 主进程 → 渲染进程 (send)

| 通道 | 数据 | 说明 |
|------|------|------|
| `clipboard:newItem` | `Clip` | 新剪贴记录实时推送 |
| `navigate:settings` | - | 托盘"设置"导航 |
| `window:shown` | - | 窗口显示通知 |
| `eye:setState` | `'awake'\|'drowsy'\|'asleep'` | 眼睛状态推送 |
| `companion:reset` | - | 伴生窗口重置 |

---

## 窗口配置

| 窗口 | 尺寸 | 关键配置 |
|------|------|---------|
| 主窗口 | 400×560（min 320×400，记忆位置） | 无边框、`skipTaskbar: false`（刻意留在任务栏）、`frame: false` |
| 眼睛窗口 | 66×72 / 84×100 / 120×126 | 透明、`alwaysOnTop`、`focusable: false`（桌面宠物，不抢焦点） |
| 伴生窗口 | 110×70 | 透明、`alwaysOnTop`、`setIgnoreMouseEvents`（zZ 动画） |
| 详情窗口 | 500×400（min 300×200） | 普通边框、`autoHideMenuBar`、加载 `data:` URL 本地 HTML |

所有窗口统一：`contextIsolation: true`、`nodeIntegration: false`、preload 固定路径、
`setWindowOpenHandler` 拒绝新窗口、`will-navigate` 拦截非本地跳转。

---

## 剪贴板监控机制

- 轮询间隔: **500ms**，单线程顺序检查
- 检测顺序: 图片 → 文件（异步）→ 文字
- **文字**: `clipboard.readText()`，与最近一条文字记录比较去重
- **图片**: `clipboard.readImage()` → PNG → MD5 去重 → 写入 `images/` 目录
  （文件名 `{timestamp}_{hash8}.png`），从 PNG 头解析尺寸
- **文件**: Electron 的 `readBuffer` 对 Windows 原生 CF_HDROP 支持不稳定，
  改用 `execFile('powershell.exe', '-STA', ...)` 调 .NET
  `[System.Windows.Forms.Clipboard]::GetFileDropList()`；
  `-STA` 保证线程模式，`[Console]::OutputEncoding = UTF8` 解决中文乱码；
  写回剪贴板用同一套 API 的 `SetFileDropList()`
- **去重**: 文字按内容；图片按 MD5；文件按路径列表哈希
- **清理**: 新记录写入后按 maxClips 裁剪；过期清理在启动时 + 每小时执行

---

## 文件存储路径

| 用途 | 路径 | 说明 |
|------|------|------|
| 数据库 | `%APPDATA%/ClipHistory/data.db` | SQLite（sql.js） |
| 图片 | `%APPDATA%/ClipHistory/images/` | 命名 `{timestamp}_{hash8}.png` |
| 设置 | `%APPDATA%/ClipHistory/settings.json` | JSON 配置文件 |
| 窗口位置 | `%APPDATA%/ClipHistory/window-bounds.json` | 窗口位置记忆 |

图片路径的读取/删除前均校验位于 `images/` 目录内（`isImagePathSafe`），
防止 data.db 被篡改后越界读写磁盘文件。

---

## 安全设计

- 渲染进程无 Node 权限：`contextIsolation: true` + `nodeIntegration: false`，
  仅通过 contextBridge 白名单 API 与主进程通信
- 所有页面设置 CSP meta；不加载任何远程内容
- `setWindowOpenHandler` 拒绝 `window.open`；`will-navigate` 拦截非 `file://`/`data:` 跳转
- 高权限 IPC（openFile / showInFolder / getFileIcons / uninstall / clearAll / settings:set）
  校验调用者为主 frame（`isTrustedSender`）
- `settings.eyeSize` 白名单校验（值会进入 executeJavaScript 模板）
- SQL 全部参数化；搜索 LIKE 通配符转义
- 剪贴板内容渲染全部走 `textContent` 或转义后拼接，无 XSS
