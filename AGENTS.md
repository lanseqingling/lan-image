# AGENTS.md - AI Development Guide

## Project Overview

LanImage — Windows 本地图片查看器，Electron 构建。侧边栏管理文件夹，三种查看模式浏览图片，全屏查看器支持缩放拖拽。

## Tech Stack

- Electron 33+ / JavaScript (CommonJS)
- Vanilla HTML/CSS/JS，无框架无打包器
- electron-builder 打包

## Architecture

```
src/main/main.js       → 主进程（IPC、文件系统、窗口管理）
src/preload/preload.js → 上下文桥接（暴露安全 API）
src/renderer/
  index.html           → 主页面
  renderer.js          → UI 逻辑
  styles.css           → 样式
src/build/afterPack.js → electron-builder 打包后用 rcedit 设置 exe 图标
assets/icons/          → 应用图标（icon.ico + icon.png）
```

## IPC API

| API | 用途 |
|---|---|
| `selectDirectory` | 打开文件夹选择器 |
| `getWorkspaces` / `saveWorkspaces` | 读写 workspace 配置 |
| `getImagesInDirectory` | 扫描目录图片（含 mtime） |
| `getImageDimensions` | 从文件头读取图片尺寸 |
| `windowMinimize` / `windowMaximize` / `windowClose` | 窗口控制 |
| `openFolderInExplorer` | 在资源管理器中打开文件夹 |
| `showItemInFolder` | 在资源管理器中定位文件 |
| `openExternal` | 打开外部链接 |
| `getDarkMode` | 从 config.json 读取深色模式设置 |
| `saveDarkMode` | 保存深色模式设置到 config.json |

新增 IPC：main.js 添加 handler → preload.js 暴露方法 → renderer.js 调用

## Key Design

- `frame: false` 无边框窗口，自定义标题栏（文件/查看/窗口菜单 + 窗口控制按钮）
- 侧边栏可拖拽调整宽度，可收起/展开
- 三种查看模式（查看菜单切换，存 localStorage）：
  - 瀑布流：列数可配置（1/2/3 列），图片按原始比例展示
  - 横向翻页：单张展示，左右箭头/键盘翻页，循环翻页，底部缩略图条，内置缩放拖拽
  - 文件列表：等大小网格卡片，正方形缩略图 + 文件名，右键打开文件位置，响应式列数
- 图片通过 `file:///` 加载（`webSecurity: false`）
- 图片尺寸从文件头解析，不加载完整文件
- Workspace 支持别名（alias）、排序（sortBy/sortOrder），持久化到 userData 目录下的 config.json
- 重命名使用自定义对话框（Electron 无边框窗口不支持 prompt）

## Code Conventions

- 不写注释（除非明确要求）
- `const`/`let`，不用 `var`
- `async/await` 处理 IPC
- SVG 图标内联
- CSS 变量定义在 `:root`
- 用户界面文字使用中文
- **深色模式必须适配**：
  - 所有颜色使用 `--` 开头的 CSS 变量，避免硬编码
  - 图标 SVG 使用 `stroke="currentColor"` 或 `fill="currentColor"` 继承文字色
  - 新增 UI 组件需在 `[data-theme="dark"]` 中添加覆盖样式
  - 启动页（splash.html）需添加内联脚本读取 `localStorage.getItem('lanimage-darkmode')`
  - 主进程创建窗口时需通过 `isDarkMode()` 设置 `backgroundColor`

## Build

- `npm start` — 开发运行
- `npm run build` — electron-builder 打包 Windows 安装包（NSIS）
- `npm run pack` — electron-packager 打包可执行文件

### electron-builder 注意事项

- `signAndEditExecutable: false`：因 winCodeSign 解压时 Windows 符号链接权限不足，跳过内置的签名和图标设置
- `afterPack` 钩子（`src/build/afterPack.js`）：打包后手动调用 rcedit 将 icon.ico 嵌入 exe，弥补上述跳过导致的图标缺失
- `files` 数组需同时包含 `icon.ico`（exe 图标）和 `icon.png`（BrowserWindow 图标 + 标题栏图标）

## Notes

- `webSecurity: false` 为本地应用设计，允许加载 file:// URL
- config.json 存储在 `app.getPath('userData')` 目录（非项目根目录），确保 asar 打包后可读写
- 仅 Windows 平台
