let workspaces = [];
let activeWorkspacePath = null;
let currentImages = [];
let allImages = [];
let imageCache = {};

let viewMode = localStorage.getItem('lanimage-viewmode') || 'waterfall';
let hvCurrentIndex = 0;
let hvScale = 1;
let hvTranslateX = 0;
let hvTranslateY = 0;
let hvIsDragging = false;
let hvStartX = 0;
let hvStartY = 0;

const workspaceList = document.getElementById('workspace-list');
const waterfallContainer = document.getElementById('waterfall-container');
const emptyState = document.getElementById('empty-state');
const addFolderBtn = document.getElementById('add-folder-btn');
const sidebarCollapseBtn = document.getElementById('sidebar-collapse-btn');
const imageViewer = document.getElementById('image-viewer');
const viewerBackdrop = document.getElementById('viewer-backdrop');
const viewerImage = document.getElementById('viewer-image');
const viewerClose = document.getElementById('viewer-close');
const sidebar = document.getElementById('sidebar');
const sidebarResizeHandle = document.getElementById('sidebar-resize-handle');
const horizontalViewer = document.getElementById('horizontal-viewer');
const hvImage = document.getElementById('hv-image');
const hvImageArea = document.getElementById('hv-image-area');
const hvPrev = document.getElementById('hv-prev');
const hvNext = document.getElementById('hv-next');
const hvThumbnailStrip = document.getElementById('hv-thumbnail-strip');
const hvCounter = document.getElementById('hv-counter');
const gridContainer = document.getElementById('grid-container');

let viewerScale = 1;
let viewerStartX = 0;
let viewerStartY = 0;
let viewerTranslateX = 0;
let viewerTranslateY = 0;
let isDragging = false;
let isResizing = false;
let isCollapsed = false;
let defaultSidebarWidth = 260;
let resizeStartX = 0;
let resizeStartWidth = 0;
let columnCount = parseInt(localStorage.getItem('lanimage-columns') || '3', 10);

function toLocalImageUrl(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  return 'file:///' + encodeURIComponent(normalized).replace(/%3A/g, ':').replace(/%2F/g, '/');
}

async function init() {
  workspaces = await window.api.getWorkspaces();
  renderWorkspaces();
  if (workspaces.length > 0) {
    const firstExpanded = workspaces.find(w => w.expanded);
    if (firstExpanded) {
      await loadImages(firstExpanded.path);
    }
  }
}

addFolderBtn.addEventListener('click', async () => {
  const dirPath = await window.api.selectDirectory();
  if (!dirPath) return;

  const exists = workspaces.some(w => w.path === dirPath);
  if (exists) return;

  const name = dirPath.split(/[\\/]/).pop() || dirPath;
  workspaces.push({ path: dirPath, name, expanded: true });
  await saveWorkspaces();
  renderWorkspaces();
  await loadImages(dirPath);
});

async function saveWorkspaces() {
  await window.api.saveWorkspaces(workspaces);
}

function closeAllMenus() {
  document.querySelectorAll('.workspace-menu').forEach(m => m.remove());
  document.querySelectorAll('.image-context-menu').forEach(m => m.remove());
}

function getDisplayName(ws) {
  return ws.alias || ws.name;
}

function isImageHidden(img, ws) {
  if (!ws || !ws.hiddenPaths) return false;
  return ws.hiddenPaths.includes(img.path);
}

async function toggleImageHidden(img, ws) {
  if (!ws) return;
  if (!ws.hiddenPaths) ws.hiddenPaths = [];
  const idx = ws.hiddenPaths.indexOf(img.path);
  if (idx >= 0) {
    ws.hiddenPaths.splice(idx, 1);
  } else {
    ws.hiddenPaths.push(img.path);
  }
  await saveWorkspaces();
  await refreshCurrentView();
}

async function refreshCurrentView() {
  if (activeWorkspacePath) {
    imageCache[activeWorkspacePath] = null;
    await loadImages(activeWorkspacePath);
  }
}

function showRenameDialog(ws) {
  const dialog = document.getElementById('rename-dialog');
  const input = document.getElementById('rename-input');
  const confirmBtn = document.getElementById('rename-confirm');
  const cancelBtn = document.getElementById('rename-cancel');

  input.value = ws.alias || ws.name;
  dialog.classList.remove('hidden');

  setTimeout(() => {
    input.focus();
    input.select();
  }, 50);

  const cleanup = () => {
    dialog.classList.add('hidden');
    confirmBtn.removeEventListener('click', onConfirm);
    cancelBtn.removeEventListener('click', onCancel);
    input.removeEventListener('keydown', onKeydown);
  };

  const onConfirm = async () => {
    const newName = input.value.trim();
    if (!newName || newName === ws.name) {
      delete ws.alias;
      await saveWorkspaces();
      renderWorkspaces();
    } else {
      ws.alias = newName;
      await saveWorkspaces();
      renderWorkspaces();
    }
    cleanup();
  };

  const onCancel = () => {
    cleanup();
  };

  const onKeydown = (e) => {
    if (e.key === 'Enter') onConfirm();
    if (e.key === 'Escape') onCancel();
  };

  confirmBtn.addEventListener('click', onConfirm);
  cancelBtn.addEventListener('click', onCancel);
  input.addEventListener('keydown', onKeydown);
}

async function showPropertiesDialog(img) {
  const dialog = document.getElementById('properties-dialog');
  const closeBtn = document.getElementById('properties-close');

  document.getElementById('prop-name').textContent = img.name;
  document.getElementById('prop-type').textContent = (img.ext || img.name.split('.').pop()).toUpperCase();
  document.getElementById('prop-location').textContent = img.path;

  document.getElementById('prop-size').textContent = '计算中...';
  document.getElementById('prop-created').textContent = '计算中...';
  document.getElementById('prop-modified').textContent = '计算中...';
  document.getElementById('prop-dimensions').textContent = '计算中...';

  dialog.classList.remove('hidden');

  const onClose = () => {
    dialog.classList.add('hidden');
    closeBtn.removeEventListener('click', onClose);
    dialog.removeEventListener('click', onBackdropClick);
  };

  const onBackdropClick = (e) => {
    if (e.target === dialog) onClose();
  };

  closeBtn.addEventListener('click', onClose);
  dialog.addEventListener('click', onBackdropClick);

  const fileInfo = await window.api.getFileInfo(img.path);
  if (fileInfo && !dialog.classList.contains('hidden')) {
    document.getElementById('prop-size').textContent = formatFileSize(fileInfo.size);
    document.getElementById('prop-created').textContent = formatDate(fileInfo.birthtime);
    document.getElementById('prop-modified').textContent = formatDate(fileInfo.mtime);
  }

  const dims = await window.api.getImageDimensions(img.path).catch(() => null);
  if (dims && !dialog.classList.contains('hidden')) {
    document.getElementById('prop-dimensions').textContent = dims.width + ' × ' + dims.height;
  } else if (!dialog.classList.contains('hidden')) {
    document.getElementById('prop-dimensions').textContent = '未知';
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 2 : 0) + ' ' + units[i];
}

function formatDate(timestamp) {
  if (!timestamp) return '未知';
  const d = new Date(timestamp);
  const pad = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

function showImageContextMenu(x, y, img, ws) {
  closeAllMenus();
  const menu = document.createElement('div');
  menu.className = 'image-context-menu';

  const openItem = document.createElement('div');
  openItem.className = 'image-context-item';
  openItem.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><polyline points="12 11 12 17"/><polyline points="9 14 12 11 15 14"/></svg><span>打开文件位置</span>';
  openItem.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAllMenus();
    window.api.showItemInFolder(img.path);
  });

  const propItem = document.createElement('div');
  propItem.className = 'image-context-item';
  propItem.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg><span>属性</span>';
  propItem.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAllMenus();
    showPropertiesDialog(img);
  });

  const separator = document.createElement('div');
  separator.className = 'image-context-separator';

  const hidden = isImageHidden(img, ws);
  const hideItem = document.createElement('div');
  hideItem.className = 'image-context-item' + (hidden ? ' checked' : '');
  hideItem.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg><span>隐藏</span>' + (hidden ? '<svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : '');
  hideItem.addEventListener('click', async (e) => {
    e.stopPropagation();
    closeAllMenus();
    await toggleImageHidden(img, ws);
  });

  menu.appendChild(openItem);
  menu.appendChild(propItem);
  menu.appendChild(separator);
  menu.appendChild(hideItem);
  document.body.appendChild(menu);

  let top = y;
  let left = x;
  if (top + menu.offsetHeight > window.innerHeight) {
    top = window.innerHeight - menu.offsetHeight - 8;
  }
  if (left + menu.offsetWidth > window.innerWidth) {
    left = window.innerWidth - menu.offsetWidth - 8;
  }
  menu.style.top = top + 'px';
  menu.style.left = left + 'px';
}

function showWorkspaceMenu(anchor, ws, index) {
  const menu = document.createElement('div');
  menu.className = 'workspace-menu';

  const renameItem = document.createElement('div');
  renameItem.className = 'workspace-menu-item';
  renameItem.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg><span>重命名</span>';
  renameItem.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAllMenus();
    showRenameDialog(ws);
  });

  const openFolderItem = document.createElement('div');
  openFolderItem.className = 'workspace-menu-item';
  openFolderItem.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><polyline points="9 14 12 11 15 14"/></svg><span>打开文件夹</span>';
  openFolderItem.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAllMenus();
    window.api.openFolderInExplorer(ws.path);
  });

  const sortItem = document.createElement('div');
  sortItem.className = 'workspace-menu-item workspace-menu-item-parent';
  sortItem.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="14" y2="12"/><line x1="4" y1="18" x2="8" y2="18"/></svg><span>排序</span><svg class="menu-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';

  const sortSubMenu = document.createElement('div');
  sortSubMenu.className = 'workspace-submenu';

  const sortBy = ws.sortBy || 'date';
  const sortOrder = ws.sortOrder || 'desc';

  const sortNameItem = document.createElement('div');
  sortNameItem.className = 'workspace-menu-item' + (sortBy === 'name' ? ' active' : '');
  sortNameItem.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg><span>名称</span>' + (sortBy === 'name' ? '<svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : '');
  sortNameItem.addEventListener('click', async (e) => {
    e.stopPropagation();
    ws.sortBy = 'name';
    if (!ws.sortOrder) ws.sortOrder = 'desc';
    await saveWorkspaces();
    closeAllMenus();
    if (activeWorkspacePath === ws.path) {
      imageCache[ws.path] = null;
      await loadImages(ws.path);
    }
  });

  const sortDateItem = document.createElement('div');
  sortDateItem.className = 'workspace-menu-item' + (sortBy === 'date' ? ' active' : '');
  sortDateItem.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span>日期</span>' + (sortBy === 'date' ? '<svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : '');
  sortDateItem.addEventListener('click', async (e) => {
    e.stopPropagation();
    ws.sortBy = 'date';
    if (!ws.sortOrder) ws.sortOrder = 'desc';
    await saveWorkspaces();
    closeAllMenus();
    if (activeWorkspacePath === ws.path) {
      imageCache[ws.path] = null;
      await loadImages(ws.path);
    }
  });

  const sortTypeItem = document.createElement('div');
  sortTypeItem.className = 'workspace-menu-item' + (sortBy === 'type' ? ' active' : '');
  sortTypeItem.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>类型</span>' + (sortBy === 'type' ? '<svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : '');
  sortTypeItem.addEventListener('click', async (e) => {
    e.stopPropagation();
    ws.sortBy = 'type';
    if (!ws.sortOrder) ws.sortOrder = 'desc';
    await saveWorkspaces();
    closeAllMenus();
    if (activeWorkspacePath === ws.path) {
      imageCache[ws.path] = null;
      await loadImages(ws.path);
    }
  });

  const sortSeparator = document.createElement('div');
  sortSeparator.className = 'workspace-menu-separator';

  const sortAscItem = document.createElement('div');
  sortAscItem.className = 'workspace-menu-item' + (sortOrder === 'asc' ? ' active' : '');
  sortAscItem.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg><span>顺序</span>' + (sortOrder === 'asc' ? '<svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : '');
  sortAscItem.addEventListener('click', async (e) => {
    e.stopPropagation();
    ws.sortOrder = 'asc';
    if (!ws.sortBy) ws.sortBy = 'date';
    await saveWorkspaces();
    closeAllMenus();
    if (activeWorkspacePath === ws.path) {
      imageCache[ws.path] = null;
      await loadImages(ws.path);
    }
  });

  const sortDescItem = document.createElement('div');
  sortDescItem.className = 'workspace-menu-item' + (sortOrder === 'desc' ? ' active' : '');
  sortDescItem.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg><span>倒序</span>' + (sortOrder === 'desc' ? '<svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : '');
  sortDescItem.addEventListener('click', async (e) => {
    e.stopPropagation();
    ws.sortOrder = 'desc';
    if (!ws.sortBy) ws.sortBy = 'date';
    await saveWorkspaces();
    closeAllMenus();
    if (activeWorkspacePath === ws.path) {
      imageCache[ws.path] = null;
      await loadImages(ws.path);
    }
  });

  sortSubMenu.appendChild(sortDateItem);
  sortSubMenu.appendChild(sortNameItem);
  sortSubMenu.appendChild(sortTypeItem);
  sortSubMenu.appendChild(sortSeparator);
  sortSubMenu.appendChild(sortAscItem);
  sortSubMenu.appendChild(sortDescItem);
  sortItem.appendChild(sortSubMenu);

  sortItem.addEventListener('mouseenter', () => {
    sortSubMenu.classList.add('visible');
  });
  sortItem.addEventListener('mouseleave', () => {
    sortSubMenu.classList.remove('visible');
  });

  const pinItem = document.createElement('div');
  pinItem.className = 'workspace-menu-item';
  pinItem.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg><span>置顶</span>';
  pinItem.addEventListener('click', async (e) => {
    e.stopPropagation();
    closeAllMenus();
    if (index > 0) {
      workspaces.splice(index, 1);
      workspaces.unshift(ws);
      await saveWorkspaces();
      renderWorkspaces();
    }
  });

  const moveUpItem = document.createElement('div');
  moveUpItem.className = 'workspace-menu-item';
  moveUpItem.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg><span>上移</span>';
  moveUpItem.addEventListener('click', async (e) => {
    e.stopPropagation();
    closeAllMenus();
    if (index > 0) {
      workspaces.splice(index, 1);
      workspaces.splice(index - 1, 0, ws);
      await saveWorkspaces();
      renderWorkspaces();
    }
  });

  const moveDownItem = document.createElement('div');
  moveDownItem.className = 'workspace-menu-item';
  moveDownItem.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg><span>下移</span>';
  moveDownItem.addEventListener('click', async (e) => {
    e.stopPropagation();
    closeAllMenus();
    if (index < workspaces.length - 1) {
      workspaces.splice(index, 1);
      workspaces.splice(index + 1, 0, ws);
      await saveWorkspaces();
      renderWorkspaces();
    }
  });

  const removeItem = document.createElement('div');
  removeItem.className = 'workspace-menu-item danger';
  removeItem.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg><span>移除</span>';
  removeItem.addEventListener('click', async (e) => {
    e.stopPropagation();
    closeAllMenus();
    workspaces.splice(index, 1);
    delete imageCache[ws.path];
    if (activeWorkspacePath === ws.path) {
      activeWorkspacePath = null;
      currentImages = [];
      allImages = [];
      renderWaterfall();
      emptyState.classList.remove('hidden');
      waterfallContainer.style.display = 'none';
    }
    await saveWorkspaces();
    renderWorkspaces();
  });

  menu.appendChild(openFolderItem);
  menu.appendChild(renameItem);
  menu.appendChild(sortItem);
  menu.appendChild(pinItem);
  menu.appendChild(moveUpItem);
  menu.appendChild(moveDownItem);
  menu.appendChild(removeItem);
  document.body.appendChild(menu);

  const rect = anchor.getBoundingClientRect();
  let top = rect.bottom + 4;
  let left = rect.left;
  if (top + menu.offsetHeight > window.innerHeight) {
    top = rect.top - menu.offsetHeight - 4;
  }
  if (left + menu.offsetWidth > window.innerWidth) {
    left = window.innerWidth - menu.offsetWidth - 8;
  }
  menu.style.top = top + 'px';
  menu.style.left = left + 'px';
}

function renderWorkspaces() {
  workspaceList.innerHTML = '';

  workspaces.forEach((ws, index) => {
    const item = document.createElement('div');
    item.className = 'workspace-item';

    const header = document.createElement('div');
    header.className = 'workspace-header' + (activeWorkspacePath === ws.path ? ' active' : '');

    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    arrow.setAttribute('width', '16');
    arrow.setAttribute('height', '16');
    arrow.setAttribute('viewBox', '0 0 24 24');
    arrow.setAttribute('fill', 'none');
    arrow.setAttribute('stroke', 'currentColor');
    arrow.setAttribute('stroke-width', '2');
    arrow.setAttribute('stroke-linecap', 'round');
    arrow.setAttribute('stroke-linejoin', 'round');
    arrow.classList.add('workspace-arrow');
    if (ws.expanded) arrow.classList.add('expanded');
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    poly.setAttribute('points', '9 18 15 12 9 6');
    arrow.appendChild(poly);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'workspace-name';
    nameSpan.textContent = getDisplayName(ws);
    nameSpan.title = ws.path;

    const countSpan = document.createElement('span');
    countSpan.className = 'workspace-count';
    const cachedImages = imageCache[ws.path];
    if (cachedImages) {
      countSpan.textContent = cachedImages.length;
    } else {
      countSpan.textContent = '...';
      window.api.getImagesInDirectory(ws.path).then(images => {
        imageCache[ws.path] = images;
        countSpan.textContent = images.length;
      });
    }

    const moreBtn = document.createElement('button');
    moreBtn.className = 'workspace-more';
    moreBtn.title = '更多';
    moreBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';

    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllMenus();
      showWorkspaceMenu(moreBtn, ws, index);
    });

    header.appendChild(arrow);
    header.appendChild(nameSpan);
    header.appendChild(countSpan);
    header.appendChild(moreBtn);

    const imagesDiv = document.createElement('div');
    imagesDiv.className = 'workspace-images' + (ws.expanded ? ' expanded' : '');

    if (ws.expanded && imageCache[ws.path]) {
      renderImageList(imagesDiv, imageCache[ws.path], ws);
    } else if (ws.expanded) {
      window.api.getImagesInDirectory(ws.path).then(images => {
        imageCache[ws.path] = images;
        renderImageList(imagesDiv, images, ws);
        countSpan.textContent = images.length;
      });
    }

    header.addEventListener('click', async () => {
      ws.expanded = !ws.expanded;
      await saveWorkspaces();
      renderWorkspaces();
      if (ws.expanded) {
        await loadImages(ws.path);
      }
    });

    item.appendChild(header);
    item.appendChild(imagesDiv);
    workspaceList.appendChild(item);
  });
}

function sortImages(images, ws) {
  const sortBy = ws ? (ws.sortBy || 'date') : 'date';
  const sortOrder = ws ? (ws.sortOrder || 'desc') : 'desc';
  return [...images].sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'name') {
      cmp = a.name.localeCompare(b.name, 'zh-CN');
    } else if (sortBy === 'date') {
      cmp = (a.mtime || 0) - (b.mtime || 0);
    } else if (sortBy === 'type') {
      const extA = a.name.split('.').pop().toLowerCase();
      const extB = b.name.split('.').pop().toLowerCase();
      cmp = extA.localeCompare(extB);
    }
    return sortOrder === 'desc' ? -cmp : cmp;
  });
}

function renderImageList(container, images, ws) {
  container.innerHTML = '';
  const sorted = sortImages(images, ws);
  sorted.forEach((img) => {
    const item = document.createElement('div');
    item.className = 'workspace-image-item';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'workspace-image-name';
    nameSpan.textContent = img.name;

    const hidden = isImageHidden(img, ws);
    if (hidden) {
      const eyeIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      eyeIcon.setAttribute('width', '12');
      eyeIcon.setAttribute('height', '12');
      eyeIcon.setAttribute('viewBox', '0 0 24 24');
      eyeIcon.setAttribute('fill', 'none');
      eyeIcon.setAttribute('stroke', 'currentColor');
      eyeIcon.setAttribute('stroke-width', '2');
      eyeIcon.setAttribute('stroke-linecap', 'round');
      eyeIcon.setAttribute('stroke-linejoin', 'round');
      eyeIcon.classList.add('hidden-eye-icon');
      const eyePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      eyePath.setAttribute('d', 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24');
      eyeIcon.appendChild(eyePath);
      const eyeLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      eyeLine.setAttribute('x1', '1');
      eyeLine.setAttribute('y1', '1');
      eyeLine.setAttribute('x2', '23');
      eyeLine.setAttribute('y2', '23');
      eyeIcon.appendChild(eyeLine);
      item.appendChild(eyeIcon);
    }

    const moreBtn = document.createElement('button');
    moreBtn.className = 'workspace-image-more';
    moreBtn.title = '更多';
    moreBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';
    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const rect = moreBtn.getBoundingClientRect();
      showImageContextMenu(rect.left, rect.bottom + 2, img, ws);
    });

    item.appendChild(nameSpan);
    item.appendChild(moreBtn);
    item.title = img.path;

    item.addEventListener('click', (e) => {
      if (e.target.closest('.workspace-image-more')) return;
      e.stopPropagation();
      if (viewMode === 'horizontal') {
        const idx = currentImages.findIndex(ci => ci.path === img.path);
        if (idx >= 0) hvShowImage(idx);
      } else if (viewMode === 'grid') {
        openViewer(img.path);
      } else {
        openViewer(img.path);
      }
    });

    container.appendChild(item);
  });
}

async function loadImages(dirPath) {
  activeWorkspacePath = dirPath;
  renderWorkspaces();

  emptyState.classList.add('hidden');
  emptyState.innerHTML = '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><p>点击左侧 <strong>+</strong> 按钮添加图片文件夹</p>';

  if (viewMode === 'waterfall') {
    waterfallContainer.style.display = 'flex';
    waterfallContainer.innerHTML = '<div class="loading-indicator"><div class="loading-spinner"></div>加载中...</div>';
  } else if (viewMode === 'horizontal') {
    waterfallContainer.style.display = 'none';
    gridContainer.classList.add('hidden');
    horizontalViewer.classList.remove('hidden');
    hvImage.src = '';
    hvCounter.textContent = '';
    hvThumbnailStrip.innerHTML = '<div class="loading-indicator"><div class="loading-spinner"></div>加载中...</div>';
  } else if (viewMode === 'grid') {
    waterfallContainer.style.display = 'none';
    horizontalViewer.classList.add('hidden');
    gridContainer.classList.remove('hidden');
    gridContainer.innerHTML = '<div class="loading-indicator"><div class="loading-spinner"></div>加载中...</div>';
  }

  let images = imageCache[dirPath];
  if (!images) {
    images = await window.api.getImagesInDirectory(dirPath);
    imageCache[dirPath] = images;
  }

  const ws = workspaces.find(w => w.path === dirPath);
  allImages = sortImages(images, ws);
  currentImages = allImages.filter(img => !isImageHidden(img, ws));

  if (allImages.length === 0) {
    waterfallContainer.style.display = 'none';
    horizontalViewer.classList.add('hidden');
    gridContainer.classList.add('hidden');
    emptyState.classList.remove('hidden');
    emptyState.innerHTML = '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><p>该文件夹下没有图片文件</p>';
    return;
  }

  if (currentImages.length === 0 && allImages.length > 0) {
    waterfallContainer.style.display = 'none';
    horizontalViewer.classList.add('hidden');
    gridContainer.classList.add('hidden');
    emptyState.classList.remove('hidden');
    emptyState.innerHTML = '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg><p>所有图片已隐藏</p>';
    return;
  }

  if (viewMode === 'horizontal') {
    waterfallContainer.style.display = 'none';
    gridContainer.classList.add('hidden');
    horizontalViewer.classList.remove('hidden');
    hvCurrentIndex = 0;
    renderHorizontalView();
  } else if (viewMode === 'grid') {
    waterfallContainer.style.display = 'none';
    horizontalViewer.classList.add('hidden');
    gridContainer.classList.remove('hidden');
    renderGridView();
  } else {
    await renderWaterfall();
  }
}

async function renderWaterfall() {
  waterfallContainer.innerHTML = '';

  if (currentImages.length === 0) return;

  const cols = columnCount;
  const columns = new Array(cols).fill(null);
  const columnHeights = new Array(cols).fill(0);

  for (let i = 0; i < cols; i++) {
    const col = document.createElement('div');
    col.className = 'waterfall-column';
    columns[i] = col;
    waterfallContainer.appendChild(col);
  }

  const containerWidth = waterfallContainer.clientWidth - 32;
  const columnWidth = (containerWidth - (cols - 1) * 5) / cols;

  const dimensionPromises = currentImages.map(img =>
    window.api.getImageDimensions(img.path).catch(() => ({ width: 300, height: 200 }))
  );
  const dimensions = await Promise.all(dimensionPromises);

  const ws = workspaces.find(w => w.path === activeWorkspacePath);

  for (let i = 0; i < currentImages.length; i++) {
    const img = currentImages[i];
    const dims = dimensions[i];
    const w = dims.width || 300;
    const h = dims.height || 200;
    const aspectRatio = h / w;
    const displayHeight = columnWidth * aspectRatio;

    if (!isFinite(displayHeight) || displayHeight <= 0) continue;

    const shortestIndex = columnHeights.indexOf(Math.min(...columnHeights));
    columnHeights[shortestIndex] += displayHeight + 5;

    const card = createImageCard(img, columnWidth, displayHeight, ws);
    columns[shortestIndex].appendChild(card);
  }
}

function createImageCard(img, displayWidth, displayHeight, ws) {
  const card = document.createElement('div');
  card.className = 'waterfall-card';

  const imgEl = document.createElement('img');
  imgEl.alt = img.name;
  imgEl.style.minHeight = Math.min(displayHeight, 400) + 'px';
  imgEl.style.background = '#f0f0f0';
  imgEl.loading = 'lazy';
  imgEl.src = toLocalImageUrl(img.path);

  imgEl.addEventListener('click', () => {
    openViewer(img.path);
  });

  const nameEl = document.createElement('div');
  nameEl.className = 'card-name';
  nameEl.textContent = img.name;

  card.appendChild(imgEl);
  card.appendChild(nameEl);

  card.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showImageContextMenu(e.clientX, e.clientY, img, ws);
  });

  return card;
}

function setViewMode(mode) {
  viewMode = mode;
  localStorage.setItem('lanimage-viewmode', mode);
  updateViewModeCheck();

  if (mode === 'waterfall') {
    horizontalViewer.classList.add('hidden');
    gridContainer.classList.add('hidden');
    waterfallContainer.style.display = 'flex';
    if (currentImages.length > 0) {
      renderWaterfall();
    }
  } else if (mode === 'horizontal') {
    waterfallContainer.style.display = 'none';
    gridContainer.classList.add('hidden');
    horizontalViewer.classList.remove('hidden');
    if (currentImages.length > 0) {
      hvCurrentIndex = 0;
      renderHorizontalView();
    }
  } else if (mode === 'grid') {
    waterfallContainer.style.display = 'none';
    horizontalViewer.classList.add('hidden');
    gridContainer.classList.remove('hidden');
    if (currentImages.length > 0) {
      renderGridView();
    }
  }

  document.querySelectorAll('.titlebar-menu-item.open').forEach(m => m.classList.remove('open'));
}

function renderHorizontalView() {
  hvThumbnailStrip.innerHTML = '';

  if (currentImages.length === 0) return;

  currentImages.forEach((img, index) => {
    const thumb = document.createElement('img');
    thumb.className = 'hv-thumb' + (index === hvCurrentIndex ? ' active' : '');
    thumb.src = toLocalImageUrl(img.path);
    thumb.alt = img.name;
    thumb.title = img.name;
    thumb.addEventListener('click', () => {
      hvShowImage(index);
    });
    hvThumbnailStrip.appendChild(thumb);
  });

  hvShowImage(hvCurrentIndex);
}

hvImageArea.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (currentImages.length === 0) return;
  const ws = workspaces.find(w => w.path === activeWorkspacePath);
  const currentImg = currentImages[hvCurrentIndex];
  if (currentImg) {
    showImageContextMenu(e.clientX, e.clientY, currentImg, ws);
  }
});

function hvShowImage(index) {
  if (currentImages.length === 0) return;

  if (index < 0) {
    index = currentImages.length - 1;
  } else if (index >= currentImages.length) {
    index = 0;
  }

  hvCurrentIndex = index;
  hvScale = 1;
  hvTranslateX = 0;
  hvTranslateY = 0;
  updateHvTransform();

  hvImage.style.opacity = '0';
  hvImage.src = toLocalImageUrl(currentImages[index].path);
  hvImage.onload = () => {
    hvImage.style.opacity = '1';
  };

  hvCounter.textContent = (index + 1) + ' / ' + currentImages.length;

  const thumbs = hvThumbnailStrip.querySelectorAll('.hv-thumb');
  thumbs.forEach((t, i) => {
    t.classList.toggle('active', i === index);
  });

  const activeThumb = thumbs[index];
  if (activeThumb) {
    activeThumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
}

function hvNavigate(direction) {
  hvShowImage(hvCurrentIndex + direction);
}

function updateHvTransform() {
  hvImage.style.transform = `translate(${hvTranslateX}px, ${hvTranslateY}px) scale(${hvScale})`;
  hvImage.style.cursor = hvScale > 1 ? (hvIsDragging ? 'grabbing' : 'grab') : '';
}

function renderGridView() {
  gridContainer.innerHTML = '';

  if (currentImages.length === 0) return;

  const ws = workspaces.find(w => w.path === activeWorkspacePath);

  currentImages.forEach((img) => {
    const item = document.createElement('div');
    item.className = 'grid-item';

    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'grid-thumb-wrap';

    const thumb = document.createElement('img');
    thumb.className = 'grid-thumb';
    thumb.alt = img.name;
    thumb.loading = 'lazy';
    thumb.src = toLocalImageUrl(img.path);

    thumbWrap.appendChild(thumb);

    const nameEl = document.createElement('div');
    nameEl.className = 'grid-name';
    nameEl.textContent = img.name;

    item.appendChild(thumbWrap);
    item.appendChild(nameEl);

    item.addEventListener('click', () => {
      openViewer(img.path);
    });

    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showImageContextMenu(e.clientX, e.clientY, img, ws);
    });

    gridContainer.appendChild(item);
  });
}

function openViewer(filePath) {
  viewerScale = 1;
  viewerTranslateX = 0;
  viewerTranslateY = 0;
  updateViewerTransform();
  viewerImage.src = toLocalImageUrl(filePath);
  imageViewer.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeViewer() {
  imageViewer.classList.add('hidden');
  viewerImage.src = '';
  viewerScale = 1;
  viewerTranslateX = 0;
  viewerTranslateY = 0;
  updateViewerTransform();
  document.body.style.overflow = '';
}

function updateViewerTransform() {
  viewerImage.style.transform = `translate(${viewerTranslateX}px, ${viewerTranslateY}px) scale(${viewerScale})`;
}

viewerClose.addEventListener('click', closeViewer);
viewerBackdrop.addEventListener('click', closeViewer);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!imageViewer.classList.contains('hidden')) {
      closeViewer();
    }
    const propDialog = document.getElementById('properties-dialog');
    if (propDialog && !propDialog.classList.contains('hidden')) {
      propDialog.classList.add('hidden');
    }
  }
  if (viewMode === 'horizontal' && !horizontalViewer.classList.contains('hidden')) {
    if (e.key === 'ArrowLeft') {
      hvNavigate(-1);
    } else if (e.key === 'ArrowRight') {
      hvNavigate(1);
    }
  }
});

imageViewer.addEventListener('wheel', (e) => {
  if (imageViewer.classList.contains('hidden')) return;
  e.preventDefault();

  const delta = e.deltaY > 0 ? -0.1 : 0.1;
  const newScale = Math.max(0.5, Math.min(10, viewerScale * (1 + delta)));

  const rect = viewerImage.getBoundingClientRect();
  const mouseX = e.clientX;
  const mouseY = e.clientY;
  const imgCenterX = rect.left + rect.width / 2;
  const imgCenterY = rect.top + rect.height / 2;

  const dx = (mouseX - imgCenterX - viewerTranslateX) * (1 - newScale / viewerScale);
  const dy = (mouseY - imgCenterY - viewerTranslateY) * (1 - newScale / viewerScale);

  viewerTranslateX += dx;
  viewerTranslateY += dy;
  viewerScale = newScale;
  updateViewerTransform();
}, { passive: false });

viewerImage.addEventListener('mousedown', (e) => {
  if (viewerScale <= 1) return;
  isDragging = true;
  viewerStartX = e.clientX - viewerTranslateX;
  viewerStartY = e.clientY - viewerTranslateY;
  viewerImage.style.cursor = 'grabbing';
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  viewerTranslateX = e.clientX - viewerStartX;
  viewerTranslateY = e.clientY - viewerStartY;
  updateViewerTransform();
});

document.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
    viewerImage.style.cursor = '';
  }
  if (hvIsDragging) {
    hvIsDragging = false;
    updateHvTransform();
  }
});

hvPrev.addEventListener('click', () => hvNavigate(-1));
hvNext.addEventListener('click', () => hvNavigate(1));

hvImageArea.addEventListener('wheel', (e) => {
  if (horizontalViewer.classList.contains('hidden')) return;
  e.preventDefault();

  const delta = e.deltaY > 0 ? -0.1 : 0.1;
  const newScale = Math.max(0.5, Math.min(10, hvScale * (1 + delta)));

  const rect = hvImage.getBoundingClientRect();
  const mouseX = e.clientX;
  const mouseY = e.clientY;
  const imgCenterX = rect.left + rect.width / 2;
  const imgCenterY = rect.top + rect.height / 2;

  const dx = (mouseX - imgCenterX - hvTranslateX) * (1 - newScale / hvScale);
  const dy = (mouseY - imgCenterY - hvTranslateY) * (1 - newScale / hvScale);

  hvTranslateX += dx;
  hvTranslateY += dy;
  hvScale = newScale;
  updateHvTransform();
}, { passive: false });

hvImage.addEventListener('mousedown', (e) => {
  if (hvScale <= 1) return;
  hvIsDragging = true;
  hvStartX = e.clientX - hvTranslateX;
  hvStartY = e.clientY - hvTranslateY;
  updateHvTransform();
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!hvIsDragging) return;
  hvTranslateX = e.clientX - hvStartX;
  hvTranslateY = e.clientY - hvStartY;
  updateHvTransform();
});

gridContainer.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

hvImage.addEventListener('dblclick', () => {
  if (hvScale > 1) {
    hvScale = 1;
    hvTranslateX = 0;
    hvTranslateY = 0;
  } else {
    hvScale = 2;
  }
  updateHvTransform();
});

let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (currentImages.length > 0) {
      if (viewMode === 'waterfall') {
        renderWaterfall();
      } else if (viewMode === 'grid') {
        renderGridView();
      }
    }
  }, 300);
});

init();

function updateColumnCheck() {
  document.querySelector('.view-check-1').style.display = columnCount === 1 ? 'block' : 'none';
  document.querySelector('.view-check-2').style.display = columnCount === 2 ? 'block' : 'none';
  document.querySelector('.view-check-3').style.display = columnCount === 3 ? 'block' : 'none';
}

function updateViewModeCheck() {
  const waterfallCheck = document.querySelector('.mode-check-waterfall');
  const horizontalCheck = document.querySelector('.mode-check-horizontal');
  const gridCheck = document.querySelector('.mode-check-grid');
  if (waterfallCheck) waterfallCheck.style.display = viewMode === 'waterfall' ? 'block' : 'none';
  if (horizontalCheck) horizontalCheck.style.display = viewMode === 'horizontal' ? 'block' : 'none';
  if (gridCheck) gridCheck.style.display = viewMode === 'grid' ? 'block' : 'none';
  updateColumnCheck();
}

function setColumnCount(n) {
  columnCount = n;
  localStorage.setItem('lanimage-columns', String(n));
  updateColumnCheck();
  document.querySelectorAll('.titlebar-menu-item.open').forEach(m => m.classList.remove('open'));
  if (currentImages.length > 0 && viewMode === 'waterfall') {
    renderWaterfall();
  }
}

updateViewModeCheck();

document.getElementById('menu-refresh').addEventListener('click', async () => {
  document.querySelectorAll('.titlebar-menu-item.open').forEach(m => m.classList.remove('open'));
  await refreshCurrentView();
});

document.getElementById('menu-cols-1').addEventListener('click', () => setColumnCount(1));
document.getElementById('menu-cols-2').addEventListener('click', () => setColumnCount(2));
document.getElementById('menu-cols-3').addEventListener('click', () => setColumnCount(3));

document.getElementById('menu-mode-waterfall').addEventListener('click', () => setViewMode('waterfall'));
document.getElementById('menu-mode-horizontal').addEventListener('click', () => setViewMode('horizontal'));
document.getElementById('menu-mode-grid').addEventListener('click', () => setViewMode('grid'));

sidebarCollapseBtn.addEventListener('click', () => {
  if (isCollapsed) {
    isCollapsed = false;
    sidebar.classList.remove('collapsed');
    sidebar.style.width = defaultSidebarWidth + 'px';
  } else {
    defaultSidebarWidth = sidebar.offsetWidth;
    isCollapsed = true;
    sidebar.classList.add('collapsed');
    sidebar.style.width = '';
  }
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.workspace-menu') && !e.target.closest('.workspace-more')) {
    closeAllMenus();
  }
  if (!e.target.closest('.image-context-menu') && !e.target.closest('.workspace-image-more')) {
    document.querySelectorAll('.image-context-menu').forEach(m => m.remove());
  }
  if (!e.target.closest('.titlebar-menu-item')) {
    document.querySelectorAll('.titlebar-menu-item.open').forEach(m => m.classList.remove('open'));
  }
});

document.querySelectorAll('.titlebar-menu-item').forEach(item => {
  item.addEventListener('click', (e) => {
    const wasOpen = item.classList.contains('open');
    document.querySelectorAll('.titlebar-menu-item.open').forEach(m => m.classList.remove('open'));
    if (!wasOpen) {
      item.classList.add('open');
    }
    e.stopPropagation();
  });
});

document.getElementById('menu-add-folder').addEventListener('click', async () => {
  document.querySelectorAll('.titlebar-menu-item.open').forEach(m => m.classList.remove('open'));
  const dirPath = await window.api.selectDirectory();
  if (!dirPath) return;
  const exists = workspaces.some(w => w.path === dirPath);
  if (exists) return;
  const name = dirPath.split(/[\\/]/).pop() || dirPath;
  workspaces.push({ path: dirPath, name, expanded: true });
  await saveWorkspaces();
  renderWorkspaces();
  await loadImages(dirPath);
});

document.getElementById('menu-quit').addEventListener('click', () => window.api.windowClose());
document.getElementById('menu-minimize').addEventListener('click', () => window.api.windowMinimize());
document.getElementById('menu-maximize').addEventListener('click', () => window.api.windowMaximize());
document.getElementById('menu-close').addEventListener('click', () => window.api.windowClose());

document.getElementById('menu-github').addEventListener('click', () => {
  document.querySelectorAll('.titlebar-menu-item.open').forEach(m => m.classList.remove('open'));
  window.api.openExternal('https://github.com/lanseqingling/lan-image');
});

document.getElementById('btn-minimize').addEventListener('click', () => window.api.windowMinimize());
document.getElementById('btn-maximize').addEventListener('click', () => window.api.windowMaximize());
document.getElementById('btn-close').addEventListener('click', () => window.api.windowClose());

sidebarResizeHandle.addEventListener('mousedown', (e) => {
  if (isCollapsed) return;
  isResizing = true;
  resizeStartX = e.clientX;
  resizeStartWidth = sidebar.offsetWidth;
  sidebar.classList.add('resizing');
  document.body.style.cursor = 'col-resize';
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!isResizing) return;
  const delta = e.clientX - resizeStartX;
  const newWidth = Math.max(48, Math.min(466, resizeStartWidth + delta));
  sidebar.style.width = newWidth + 'px';
});

document.addEventListener('mouseup', () => {
  if (isResizing) {
    isResizing = false;
    sidebar.classList.remove('resizing');
    document.body.style.cursor = '';
    const currentWidth = sidebar.offsetWidth;
    if (currentWidth < 120) {
      defaultSidebarWidth = 260;
      isCollapsed = true;
      sidebar.classList.add('collapsed');
      sidebar.style.width = '';
    } else {
      defaultSidebarWidth = currentWidth;
    }
  }
});
