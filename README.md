# LanImage

基于 Electron 的现代轻量级 Windows 图片查看器，支持瀑布流、横向翻页、文件列表三种查看模式，提供流畅的高清图片浏览体验。访问 [Releases](https://github.com/lanseqingling/lan-image/releases) 下载最新版本。

<p align="center">
  <img src="assets/icons/icon.png" width="128" height="128" alt="LanImage">
</p>

## 截图

> 瀑布流

![](docs/img/img_1.png)

> 横向翻页

![](docs/img/img_2.png)

> 文件列表

![](docs/img/img_3.png)

> 深色模式

![](docs/img/img_4.png)

## 功能

- 多文件夹管理 — 添加、重命名（别名）、排序、上下移动
- 支持多种图片格式：PNG, JPG/JPEG, GIF, BMP, WebP, SVG, ICO, TIFF/TIF, AVIF
- 三种查看模式 — 查看菜单一键切换
  - 瀑布流 — 1/2/3 列，图片按原始比例展示
  - 横向翻页 — 单张浏览，箭头/键盘翻页，缩略图导航，内置缩放拖拽
  - 文件列表 — 等大小网格，正方形缩略图 + 文件名，右键打开文件位置
- 全屏查看器 — 滚轮缩放、放大后拖拽、背景虚化
- 高性能 — 图片尺寸从文件头读取，file:// 协议直接加载
