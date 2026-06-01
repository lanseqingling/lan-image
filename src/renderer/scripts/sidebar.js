function enterEditMode() {
  isEditing = true;
  editSelectedPaths.clear();
  sidebar.classList.add('editing');
  document.getElementById('sidebar-edit-bar').classList.remove('hidden');
  updateEditBar();
  renderWorkspaces();
}

function exitEditMode() {
  isEditing = false;
  editSelectedPaths.clear();
  sidebar.classList.remove('editing');
  document.getElementById('sidebar-edit-bar').classList.add('hidden');
  renderWorkspaces();
}

function updateEditBar() {
  const count = editSelectedPaths.size;
  document.getElementById('edit-selected-count').textContent = '已选 ' + count + ' 项';
  document.getElementById('edit-delete-btn').disabled = count === 0;
}

document.getElementById('sidebar-edit-btn').addEventListener('click', () => {
  if (isEditing) {
    exitEditMode();
  } else {
    enterEditMode();
  }
});

document.getElementById('edit-cancel-btn').addEventListener('click', exitEditMode);

document.getElementById('edit-select-all-btn').addEventListener('click', () => {
  const allPaths = workspaces.map(w => w.path);
  const allSelected = allPaths.every(p => editSelectedPaths.has(p));
  if (allSelected) {
    editSelectedPaths.clear();
  } else {
    allPaths.forEach(p => editSelectedPaths.add(p));
  }
  renderWorkspaces();
  updateEditBar();
});

document.getElementById('edit-delete-btn').addEventListener('click', async () => {
  if (editSelectedPaths.size === 0) return;
  const toRemove = [...editSelectedPaths];
  for (const path of toRemove) {
    const index = workspaces.findIndex(w => w.path === path);
    if (index >= 0) {
      workspaces.splice(index, 1);
      delete imageCache[path];
      if (activeWorkspacePath === path) {
        activeWorkspacePath = null;
        currentImages = [];
        allImages = [];
        emptyState.classList.remove('hidden');
        waterfallContainer.style.display = 'none';
        horizontalViewer.classList.add('hidden');
        gridContainer.classList.add('hidden');
      }
    }
  }
  await saveWorkspaces();
  exitEditMode();
  renderWorkspaces();
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
  const dirPaths = await window.api.selectDirectories();
  if (!dirPaths || dirPaths.length === 0) return;
  let lastAddedPath = null;
  for (const dirPath of dirPaths) {
    const exists = workspaces.some(w => w.path === dirPath);
    if (exists) continue;
    const name = dirPath.split(/[\\/]/).pop() || dirPath;
    workspaces.push({ path: dirPath, name, expanded: true });
    lastAddedPath = dirPath;
  }
  await saveWorkspaces();
  renderWorkspaces();
  if (lastAddedPath) {
    await loadImages(lastAddedPath);
  }
});

document.getElementById('menu-quit').addEventListener('click', () => window.api.windowClose());
document.getElementById('menu-settings').addEventListener('click', () => {
  document.querySelectorAll('.titlebar-menu-item.open').forEach(m => m.classList.remove('open'));
  openSettings();
});
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
