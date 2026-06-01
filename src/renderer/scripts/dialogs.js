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

async function showFolderPropertiesDialog(ws) {
  const dialog = document.getElementById('folder-properties-dialog');
  const closeBtn = document.getElementById('folder-properties-close');

  const folderName = ws.alias || ws.path.split(/[\\/]/).pop() || ws.path;
  document.getElementById('folder-prop-name').textContent = folderName;
  document.getElementById('folder-prop-location').textContent = ws.path;
  document.getElementById('folder-prop-count').textContent = '计算中...';
  document.getElementById('folder-prop-size').textContent = '计算中...';
  document.getElementById('folder-prop-created').textContent = '计算中...';
  document.getElementById('folder-prop-modified').textContent = '计算中...';

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

  const folderInfo = await window.api.getFolderInfo(ws.path);
  if (folderInfo && !dialog.classList.contains('hidden')) {
    document.getElementById('folder-prop-count').textContent = folderInfo.imageCount + ' 张';
    document.getElementById('folder-prop-size').textContent = formatFileSize(folderInfo.size);
    document.getElementById('folder-prop-created').textContent = formatDate(folderInfo.birthtime);
    document.getElementById('folder-prop-modified').textContent = formatDate(folderInfo.mtime);
  }
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
  hideItem.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg><span>隐藏</span>' + (hidden ? '<svg class="check-icon" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="12"/></svg>' : '');
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

  if (!imageViewer.classList.contains('hidden')) {
    menu.style.zIndex = '1100';
  }

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
