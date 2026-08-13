<p align="center">
  <img src="assets/icon.png" alt="PasteHistory" width="96" />
</p>

<h1 align="center">PasteHistory</h1>
<p align="center">历史粘贴板 · Windows 剪贴板历史管理工具</p>

<p align="center">
  <a href="https://github.com/jiangenqi/paste-history/releases"><img alt="Release" src="https://img.shields.io/github/v/release/jiangenqi/paste-history?color=007AFF&label=Release"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/github/license/jiangenqi/paste-history?color=2FA84F"></a>
  <img alt="Platform" src="https://img.shields.io/badge/Platform-Windows%20x64-007AFF">
  <img alt="Electron" src="https://img.shields.io/badge/Electron-33-47848F">
  <a href="https://github.com/jiangenqi/paste-history/stargazers"><img alt="Stars" src="https://img.shields.io/github/stars/jiangenqi/paste-history?style=social"></a>
</p>

> **English**: PasteHistory is a lightweight Windows clipboard manager. It silently records
> text, images, and copied files in the background, and lets you recall them anytime with a
> global hotkey — with search, pin, favorites, categories, and configurable auto-cleanup.
> All data stays local. Windows-only, Chinese/English UI.

一款轻量的 Windows 剪贴板历史管理工具：后台自动记录复制的**文字、图片和文件**，
随时通过全局快捷键呼出找回。支持搜索、置顶、收藏、多分类和可配置的自动清理，
**所有数据仅保存在本地，不上传网络**。

---

## ✨ 功能亮点

| 功能 | 简介 |
|------|------|
| 📋 自动记录 | 后台监控剪贴板，自动保存文字、图片与复制过的文件 |
| ⌨️ 全局快捷键 | 默认 `Alt+V` 一键呼出，支持自定义录制 |
| 🔍 快速搜索 | 按内容、图片编号、文件路径实时筛选 |
| 📌 置顶收藏 | 置顶记录永不被清理；收藏夹一键找回 |
| 🗂 多分类管理 | 一条收藏可归入多个分类，标签栏快速过滤 |
| ⚙️ 自动清理 | 按保留期限与最大记录数清理过期内容，置顶除外 |
| 📤 导出历史 | 一键导出排版整齐的文本文件（含统计与分类） |
| 👁 眼睛模式 | 桌面小眼睛跟随鼠标，鼠标静止久了会"犯困入睡" 🐱 |
| 🌐 中英双语 | 界面语言随时切换，即时生效 |

## 🖼 界面预览

<div align="center">
  <img width="860" alt="PasteHistory 主界面" src="https://github.com/user-attachments/assets/8bff916b-e18f-4f28-968b-3054fb398b5f" />
</div>

<div align="center">
  <img width="860" alt="PasteHistory 功能一览" src="https://github.com/user-attachments/assets/69375813-3979-4f53-bb63-513c61321e67" />
</div>

> 展示图由 `npm run screenshots` 生成（素材放 `assets/screenshots/raw/`，不入仓库），
> 更换截图后重新生成并替换上方图片即可。

---

## 🚀 快速开始

### 方式一：下载安装（推荐）

前往 [Releases](https://github.com/jiangenqi/paste-history/releases) 页面下载
`PasteHistory v3.0.0.exe`，双击安装。安装后程序驻留系统托盘，按 `Alt+V` 即可呼出。

### 方式二：从源码运行

```bash
git clone https://github.com/jiangenqi/paste-history.git
cd paste-history
npm install
npm start        # 启动开发模式
```

> 国内网络下载 Electron 较慢时，可在本地 `.npmrc` 配置镜像（该文件已加入 .gitignore）：
> `electron_mirror=https://npmmirror.com/mirrors/electron/`

### 构建安装包

```bash
npm run build
```

产物输出到 `dist/`：`PasteHistory Setup <版本>.exe`（NSIS 安装包）。

---

## 📖 使用指南

### 基本操作

| 操作 | 说明 |
|------|------|
| 呼出 / 隐藏窗口 | `Alt+V`（默认，设置中可自定义） |
| 点击卡片 | 将内容重新复制回剪贴板，直接粘贴 |
| 窗口右上角 ✕ | 仅隐藏窗口，程序继续后台运行 |
| 刷新 / 桌面固定 | 底部工具栏 🔄 重载列表、📍 窗口置顶 |
| 托盘图标 | 双击呼出窗口；右键菜单：打开 / 设置 / 退出 |

### 卡片与右键菜单

| 类型 | 左键 | 右键 |
|------|------|------|
| 文字 | 复制文字 | 查看详情 |
| 图片 | 复制图片 | 查看大图详情 |
| 文件 | 复制文件（可粘贴到任意位置） | 打开文件 / 在文件夹中显示 / 查看详情 |

卡片右上角按钮：**📌 置顶**（排在最前、不被清理）、**⭐ 收藏**、**🗑 删除**。

### 收藏与分类

1. 点击卡片上的 ⭐ 收藏；底部 📁 按钮切换到收藏夹视图，只显示已收藏的记录
2. 收藏夹视图顶部是分类标签栏：`+` 新建分类（可勾选批量归入）、`−` 多选删除分类
3. 一条收藏**可以同时属于多个分类**；点击标签只看该分类，右键标签可重命名 / 删除
4. 删除分类不会删除收藏，只是解除归属

### 设置面板

| 分组 | 包含项 |
|------|--------|
| 通用 | 界面语言（中文 / English）、保留期限（1/3/5 天或自定义）、最大记录数 |
| 快捷操作 | 全局快捷键录制、开机自动启动 |
| 眼睛模式 | 眼睛大小（小/中/大）、犯困时间（鼠标静止多久入睡） |
| 数据 | 安装目录（一键复制路径）、导出历史记录 |
| 危险操作 | 清空所有历史、卸载程序（记录与设置默认保留） |

### 眼睛模式

点击窗口右上角 👁：桌面出现一只跟随鼠标的眼睛。鼠标静止超过设定时长后逐渐犯困入睡；
拖拽可移动位置，单击眼睛（不拖动）关闭。

---

## 🗄 数据与隐私

- 所有记录**仅保存在本地**，程序不包含任何网络上传逻辑
- 数据目录：`%APPDATA%/ClipHistory/`
  - `data.db` — SQLite 数据库（文字、图片、文件记录）
  - `images/` — 图片文件
  - `settings.json` — 用户设置
- 卸载程序本体不会删除数据；如需彻底清除，在设置中执行"清空所有历史"

---

## 📁 项目结构

```
├── main.js            # Electron 主进程：窗口管理、剪贴板监控、IPC、导出/卸载
├── preload.js         # contextBridge IPC 桥接（渲染进程无 Node 权限）
├── database.js        # sql.js 数据层：表结构、迁移、CRUD、清理策略
├── renderer/          # 渲染进程（原生 HTML/CSS/JS，无框架）
│   ├── index.html     # 主窗口：列表 + 搜索 + 设置面板
│   ├── app.js         # 渲染逻辑
│   ├── i18n.js        # 中英文文案词典（主/渲染进程共用）
│   ├── style.css      # 样式（CSS 变量 + flexbox）
│   ├── eye.html       # 眼睛模式窗口
│   └── companion.html # 伴生窗口（zZ 睡眠指示）
├── assets/            # 应用图标、README 展示图
├── build/             # NSIS 安装脚本片段
├── tools/             # 开发辅助脚本（图标 / 展示图生成）
└── docs/              # 需求 / 技术 / 设计文档
```

## 📚 文档

| 文档 | 说明 |
|------|------|
| [docs/requirements.md](docs/requirements.md) | 需求文档：功能清单、非功能需求 |
| [docs/technical-spec.md](docs/technical-spec.md) | 技术规格：架构、数据库设计、IPC 接口、安全设计 |
| [docs/design-spec.md](docs/design-spec.md) | 设计规范：色彩、字体、圆角阴影、组件 |

## ⚠️ 已知限制

- 仅支持 Windows x64（文件剪贴板读写依赖 .NET Clipboard API）
- 依赖 Electron 33；升级到受支持的新版本在计划中（见 [Issues](https://github.com/jiangenqi/paste-history/issues)）
- 部分杀毒软件可能误报未签名安装包，添加信任或改用源码运行即可

## 📝 变更记录

见 [CHANGELOG.md](CHANGELOG.md)。

## 📄 许可证

[MIT](LICENSE) © 2026 PasteHistory Contributors
