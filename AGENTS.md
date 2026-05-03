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
assets/icons/          → 应用图标
config.json            → 运行时配置（自动生成，不提交）
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
- Workspace 支持别名（alias）、排序（sortBy/sortOrder），持久化到 config.json
- 重命名使用自定义对话框（Electron 无边框窗口不支持 prompt）

## Code Conventions

- 不写注释（除非明确要求）
- `const`/`let`，不用 `var`
- `async/await` 处理 IPC
- SVG 图标内联
- CSS 变量定义在 `:root`
- 用户界面文字使用中文

## Build

- `npm start` — 开发运行
- `npm run build` — electron-builder 打包 Windows 安装包
- `npm run pack` — electron-packager 打包可执行文件

## Notes

- `webSecurity: false` 为本地应用设计，允许加载 file:// URL
- `config.json` 不提交，在 `.gitignore` 中
- 仅 Windows 平台
