# PasteHistory（历史粘贴板）

> English: **PasteHistory** is a lightweight Windows clipboard manager. It silently records
> text, images, and copied files in the background, and lets you recall them anytime with a
> global hotkey — with search, pin, favorites, categories, and configurable auto-cleanup.
> All data stays local. Windows-only, Chinese UI.

一款轻量的 Windows 剪贴板历史管理工具。后台自动记录复制的**文字、图片和文件**，
随时通过全局快捷键呼出窗口找回，支持搜索、置顶、收藏、多分类，以及可配置的自动清理策略。
所有数据仅保存在本地，不上传网络。

- 🪟 平台：Windows（x64）
- ⚡ 框架：Electron + 原生 HTML/CSS/JS + SQLite（[sql.js](https://github.com/sql-js/sql.js)）
- 🌐 界面语言：中文（英文）
- 📄 许可证：[MIT](LICENSE)

## 功能特性

| 功能 | 说明 |
|------|------|
| 自动记录 | 后台监控剪贴板，记录文字、图片、文件（资源管理器中复制的文件） |
| 全局快捷键 | 默认 `Alt+V` 呼出/隐藏窗口，可自定义 |
| 搜索 | 按内容、图片编号、文件维度快速筛选 |
| 置顶 / 收藏 | 置顶记录排在最前且不受自动清理影响；收藏可用独立视图浏览 |
| 多分类 | 一条收藏可同时属于多个分类，标签栏快速过滤 |
| 文件记录 | 显示系统图标与文件名，右键可打开文件 / 在文件夹中显示 |
| 详情窗口 | 文字 / 图片记录右键查看完整内容 |
| 导出历史 | 将全部记录导出为排版整齐的文本文件（含统计与分类归属） |
| 自动清理 | 按保留期限（1/3/5 天或自定义）和最大记录数自动清理，置顶记录除外 |
| 眼睛模式 | 桌面上出现一只跟随鼠标的小眼睛，鼠标静止久了会"犯困入睡" 🐱 |
| 开机自启 | 可在设置中开关，启动后驻留系统托盘 |

## 界面

<img width="1200" height="680" alt="hero" src="https://github.com/user-attachments/assets/8bff916b-e18f-4f28-968b-3054fb398b5f" />


<img width="1320" height="640" alt="gallery" src="https://github.com/user-attachments/assets/69375813-3979-4f53-bb63-513c61321e67" />


## 安装

### 方式一：下载安装包（推荐）

前往 [Releases](https://github.com/jiangenqi/paste-history/releases) 页面下载
`PasteHistory Setup x.x.x.exe`，双击安装即可。安装后程序驻留系统托盘，
`Alt+V` 呼出窗口。

### 方式二：从源码运行

```bash
git clone https://github.com/jiangenqi/paste-history.git
cd paste-history
npm install
npm start        # 启动开发模式
```

> 国内网络下 `npm install` 下载 Electron 二进制可能较慢，可在本地 `.npmrc` 中配置镜像
> （此文件已加入 .gitignore，不会影响其他协作者）：
> ```
> electron_mirror=https://npmmirror.com/mirrors/electron/
> ```

## 构建安装包

```bash
npm run build
```

产物输出到 `dist/`：NSIS 安装包（`PasteHistory Setup <版本>.exe`）。

## 使用说明

| 操作 | 说明 |
|------|------|
| 呼出窗口 | `Alt+V`（默认，可在设置中修改） |
| 点击卡片 | 将内容复制回剪贴板 |
| 右键卡片 | 文字/图片：查看详情；文件：打开文件 / 在文件夹中显示 |
| 窗口右上角 ✕ | 只关闭窗口，程序继续在后台运行 |
| 托盘图标 | 右键菜单：打开 / 设置 / 退出；双击呼出窗口 |

详细说明见 [docs/requirements.md](docs/requirements.md) 的功能清单。

## 数据存储与隐私

- 所有记录**仅保存在本地**，程序不包含任何网络上传逻辑
- 数据目录：`%APPDATA%/ClipHistory/`
  - `data.db` — SQLite 数据库（文字、图片、文件记录）
  - `images/` — 图片文件
  - `settings.json` — 用户设置
- 卸载程序本体不会删除数据；如需彻底清除，可在设置中执行"清空所有历史"

## 项目结构

```
├── main.js            # Electron 主进程：窗口管理、剪贴板监控、IPC、导出/卸载
├── preload.js         # contextBridge IPC 桥接（渲染进程无 Node 权限）
├── database.js        # sql.js 数据层：表结构、迁移、CRUD、清理策略
├── renderer/          # 渲染进程（原生 HTML/CSS/JS，无框架）
│   ├── index.html     # 主窗口：列表 + 搜索 + 设置面板
│   ├── app.js         # 渲染逻辑
│   ├── style.css      # 样式（CSS 变量 + flexbox）
│   ├── eye.html       # 眼睛模式窗口
│   └── companion.html # 伴生窗口
├── assets/            # 应用图标
├── build/             # NSIS 安装脚本片段
├── tools/             # 开发辅助脚本（图标生成等）
└── docs/              # 需求 / 技术 / 设计文档
```

架构与 IPC 接口详见 [docs/technical-spec.md](docs/technical-spec.md)，
界面设计规范见 [docs/design-spec.md](docs/design-spec.md)。

## 已知限制

- 仅支持 Windows（文件剪贴板读写依赖 .NET Clipboard API）
- 依赖 Electron 33；升级到受支持的新版本在计划中（见 [Issues](https://github.com/jiangenqi/paste-history/issues)）
- 部分杀毒软件可能误报未签名安装包，添加信任或改用源码运行即可

## 变更记录

见 [CHANGELOG.md](CHANGELOG.md)。

## 许可证

[MIT](LICENSE) © 2026 PasteHistory Contributors
