# Clipboard History - AI 助手指引

## 项目简介
历史粘贴板（PasteHistory）是一款 Windows 桌面应用，后台自动记录剪贴板文字、图片和文件，
支持全局快捷键呼出、搜索、置顶、收藏、多分类、删除，以及可配置的自动清理策略。

## 技术栈
- **桌面框架**: Electron
- **前端**: 原生 HTML/CSS/JS
- **数据存储**: SQLite（sql.js，WASM 版，免编译）
- **构建打包**: electron-builder

---

## 标准文档索引

| 文档 | 路径 | 说明 |
|------|------|------|
| 需求文档 | [docs/requirements.md](docs/requirements.md) | 用户场景、功能清单、非功能需求 |
| 技术规格 | [docs/technical-spec.md](docs/technical-spec.md) | 技术栈详解、数据库设计、IPC 接口 |
| 设计规范 | [docs/design-spec.md](docs/design-spec.md) | 色彩、字体、圆角阴影、窗口尺寸 |
| 执行计划 | [docs/execution-plan.md](docs/execution-plan.md) | 分阶段任务清单和里程碑 |

---

## 开发日志

开发日志位于 [dev-logs/](dev-logs/) 目录，按日期命名（如 `2026-08-11.md`）。

**每次开始工作前**：
1. 查看 `dev-logs/` 中最新的日志文件，了解当前进度
2. 查看是否有未完成的待办事项
3. 确认当前应该处于哪个开发阶段

**每次完成工作后**：
1. 在当天的日志文件中记录完成的事项
2. 更新待办事项状态
3. 如当天日志不存在则创建

---

## 代码规范

### 命名约定
- JavaScript 文件和函数使用 camelCase: `database.js`, `getClips()`
- CSS 类名使用 kebab-case: `.clip-card`, `.search-bar`
- 常量使用 UPPER_SNAKE_CASE: `MAX_CLIPS`, `DEFAULT_RETENTION`
- 文件名小写: `main.js`, `preload.js`

### 文件结构
- Electron 主进程代码: 项目根目录 (`main.js`, `preload.js`, `database.js`)
- 渲染进程代码: `renderer/` 目录
- 静态资源: `assets/` 目录
- 开发辅助脚本: `tools/` 目录
- 不使用 TypeScript，纯 JavaScript

### 开源维护
- README.md 是项目门面，功能变更时同步更新
- CHANGELOG.md 按版本记录变更（dev-logs/ 仅本地保留，不进 git 仓库）

### CSS 规范
- 使用 CSS 变量定义颜色和间距
- 设计规范中的所有数值（颜色、圆角、阴影）从 `docs/design-spec.md` 获取
- 优先使用 flexbox 布局

---

## 安全注意事项
- preload.js 使用 `contextBridge` 暴露 API，不直接暴露 Node.js 能力
- 渲染进程通过 IPC 与主进程通信，不直接访问 fs/sqlite
- 图片存储路径读取/删除前经 `database.isImagePathSafe()` 校验，防止路径遍历
- 高权限 IPC（openFile / showInFolder / uninstall 等）校验调用者（`isTrustedSender`）
- 所有页面设置 CSP，新窗口/导航被拦截（`hardenWindow`）
- 渲染剪贴板内容必须走 textContent 或转义，禁止直接 innerHTML 拼接用户数据

---

## 关键路径
- 用户数据目录: `%APPDATA%/ClipHistory/`
- 数据库文件: `%APPDATA%/ClipHistory/data.db`
- 图片存储: `%APPDATA%/ClipHistory/images/`
- 设置文件: `%APPDATA%/ClipHistory/settings.json`
