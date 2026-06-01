function showWorkspaceMenu(anchorOrX, ws, index, y) {
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
  sortNameItem.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg><span>名称</span>' + (sortBy === 'name' ? '<svg class="check-icon" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="12"/></svg>' : '');
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
  sortDateItem.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span>日期</span>' + (sortBy === 'date' ? '<svg class="check-icon" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="12"/></svg>' : '');
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
  sortTypeItem.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>类型</span>' + (sortBy === 'type' ? '<svg class="check-icon" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="12"/></svg>' : '');
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
  sortAscItem.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg><span>顺序</span>' + (sortOrder === 'asc' ? '<svg class="check-icon" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="12"/></svg>' : '');
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
  sortDescItem.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg><span>倒序</span>' + (sortOrder === 'desc' ? '<svg class="check-icon" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="12"/></svg>' : '');
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

  const propItem = document.createElement('div');
  propItem.className = 'workspace-menu-item';
  propItem.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg><span>属性</span>';
  propItem.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAllMenus();
    showFolderPropertiesDialog(ws);
  });

  const propSeparator = document.createElement('div');
  propSeparator.className = 'workspace-menu-separator';

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
      emptyState.classList.remove('hidden');
      waterfallContainer.style.display = 'none';
      horizontalViewer.classList.add('hidden');
      gridContainer.classList.add('hidden');
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
  menu.appendChild(propItem);
  menu.appendChild(propSeparator);
  menu.appendChild(removeItem);
  document.body.appendChild(menu);

  let top, left;
  if (typeof anchorOrX === 'number' && typeof y === 'number') {
    top = y;
    left = anchorOrX;
  } else {
    const rect = anchorOrX.getBoundingClientRect();
    top = rect.bottom + 4;
    left = rect.left;
  }
  if (top + menu.offsetHeight > window.innerHeight) {
    top = window.innerHeight - menu.offsetHeight - 8;
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

    const checkbox = document.createElement('div');
    checkbox.className = 'workspace-checkbox' + (editSelectedPaths.has(ws.path) ? ' checked' : '');
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
      if (editSelectedPaths.has(ws.path)) {
        editSelectedPaths.delete(ws.path);
        checkbox.classList.remove('checked');
      } else {
        editSelectedPaths.add(ws.path);
        checkbox.classList.add('checked');
      }
      updateEditBar();
    });

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

    header.appendChild(checkbox);
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
      if (isEditing) {
        checkbox.click();
        return;
      }
      ws.expanded = !ws.expanded;
      await saveWorkspaces();
      renderWorkspaces();
      if (ws.expanded) {
        await loadImages(ws.path);
      }
    });

    header.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeAllMenus();
      showWorkspaceMenu(e.clientX, ws, index, e.clientY);
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

    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.target.closest('.workspace-image-more')) return;
      closeAllMenus();
      showImageContextMenu(e.clientX, e.clientY, img, ws);
    });

    container.appendChild(item);
  });
}
