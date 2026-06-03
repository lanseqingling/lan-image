const composerPage = document.getElementById('composer-page');
const composerBackBtn = document.getElementById('composer-back-btn');
const composerCanvas = document.getElementById('composer-canvas');
const composerStage = document.getElementById('composer-stage');
const composerMaterialList = document.getElementById('composer-material-list');
const composerProjectList = document.getElementById('composer-project-list');
const composerProjectTitle = document.getElementById('composer-project-title');
const composerZoomLabel = document.getElementById('composer-zoom-label');
const composerGridToggle = document.getElementById('composer-grid-toggle');
const composerSnapToggle = document.getElementById('composer-snap-toggle');
const composerMaterialToggle = document.getElementById('composer-material-toggle');
const composerProjectToggle = document.getElementById('composer-project-toggle');
const composerDrawerCancelBtn = document.getElementById('composer-drawer-cancel-btn');
const composerPanModeBtn = document.getElementById('composer-pan-mode-btn');
const composerCtx = composerCanvas.getContext('2d');

const COMPOSER_MODE_LABEL = '自由画布';
const COMPOSER_EMPTY_BOUNDS = { x: -700, y: -450, w: 1400, h: 900 };
const COMPOSER_GRID_STEPS = { low: 64, medium: 32, high: 16 };
const COMPOSER_EDGE_SNAP_SCREEN_DISTANCE = 8;

const composerState = {
  projects: [],
  activeId: null,
  materials: [],
  imageCache: new Map(),
  selectedId: null,
  selectedIds: [],
  panX: 0,
  panY: 0,
  scale: 0.7,
  grid: true,
  gridDensity: 'medium',
  snap: true,
  dragging: null,
  selectionRect: null,
  history: [],
  redo: [],
  saveTimer: null,
  expandedMaterialFolder: null,
  dragMaterial: null,
  drawerView: 'projects',
  savingProjectId: null,
  panMode: false,
  lastRightPanMoved: false
};

function composerId(prefix) {
  return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function composerActiveProject() {
  return composerState.projects.find(project => project.id === composerState.activeId) || null;
}

function composerSetSelection(ids) {
  composerState.selectedIds = [...new Set(ids.filter(Boolean))];
  composerState.selectedId = composerState.selectedIds[0] || null;
}

function composerIsSelected(id) {
  return composerState.selectedIds.includes(id);
}

function composerCloseMenus() {
  document.querySelectorAll('.titlebar-menu-item.open').forEach(menu => menu.classList.remove('open'));
}

async function openComposer() {
  composerCloseMenus();
  settingsPage.classList.add('hidden');
  composerPage.classList.remove('hidden');
  document.getElementById('app').style.display = 'none';
  document.querySelector('.composer-projects').classList.add('expanded');
  composerState.drawerView = 'projects';
  composerSyncDrawerView();
  await composerLoadProjects();
  await composerRefreshMaterials();
  if (composerState.projects.length === 0) {
    composerCreateProject();
  } else if (!composerActiveProject()) {
    composerState.activeId = composerState.projects[0].id;
  }
  composerResizeCanvas();
  composerRenderProjectList();
  composerSyncControls();
  composerFitView();
}

function closeComposer() {
  composerPage.classList.add('hidden');
  document.getElementById('app').style.display = '';
}

async function composerLoadProjects() {
  try {
    const projects = await window.api.getComposerProjects();
    composerState.projects = Array.isArray(projects) ? projects.map(composerNormalizeProject) : [];
    if (composerState.projects.length > 0) await window.api.saveComposerProjects(composerState.projects);
  } catch {
    composerState.projects = [];
  }
}

function composerNormalizeProject(project) {
  const now = Date.now();
  const normalized = {
    id: project && project.id ? project.id : composerId('canvas'),
    name: project && project.name ? project.name : '自由画布',
    mode: 'free',
    createdAt: project && project.createdAt ? project.createdAt : now,
    updatedAt: project && project.updatedAt ? project.updatedAt : now,
    aspect: { type: 'infinite', value: 'infinite', label: '自由' },
    background: { transparent: false, color: '#ffffff' },
    assets: Array.isArray(project && project.assets) ? project.assets.map(composerNormalizeAsset) : [],
    state: { items: [], gap: 0 },
    preview: project && project.preview ? project.preview : ''
  };
  if (project && project.mode && project.mode !== 'free' && !normalized.name.startsWith(COMPOSER_MODE_LABEL)) {
    normalized.name = COMPOSER_MODE_LABEL + ' ' + normalized.name.replace(/^\S+\s*/, '');
  }

  const oldItems = project && project.state && Array.isArray(project.state.items) ? project.state.items : [];
  normalized.state.items = oldItems
    .map((item, index) => composerNormalizeItem(item, normalized.assets, index))
    .filter(Boolean);

  const shouldBackfillAssets = !project || project.mode !== 'free' || !(project.state && Array.isArray(project.state.items));
  if (shouldBackfillAssets) {
    const usedAssets = new Set(normalized.state.items.map(item => item.assetId));
    normalized.assets.forEach((asset, index) => {
      if (!usedAssets.has(asset.id)) {
        normalized.state.items.push(composerCreateItemFromAsset(asset, index));
      }
    });
  }
  composerRemoveUnusedAssets(normalized);
  return normalized;
}

function composerNormalizeAsset(asset) {
  return {
    id: asset.id || composerId('asset'),
    name: asset.name || '图片',
    path: asset.path,
    width: Math.max(1, asset.width || 1),
    height: Math.max(1, asset.height || 1)
  };
}

function composerNormalizeItem(item, assets, index) {
  if (!item) return null;
  const asset = assets.find(entry => entry.id === item.assetId) || assets[index] || null;
  if (!asset) return null;
  const ratio = Math.max(0.05, asset.width / Math.max(1, asset.height));
  const width = Math.max(24, Number(item.w || item.width || 260));
  const height = Math.max(24, Number(item.h || item.height || width / ratio));
  return {
    id: item.id || composerId('item'),
    assetId: asset.id,
    x: Number.isFinite(item.x) ? item.x : (index % 4) * 42,
    y: Number.isFinite(item.y) ? item.y : Math.floor(index / 4) * 42,
    w: width,
    h: height,
    rotation: ((item.rotation || 0) % 360 + 360) % 360,
    locked: !!item.locked
  };
}

function composerCreateItemFromAsset(asset, index = 0, center) {
  const ratio = Math.max(0.05, asset.width / Math.max(1, asset.height));
  const width = Math.min(360, Math.max(120, asset.width || 260));
  const height = width / ratio;
  const base = center || { x: (index % 5) * 42, y: Math.floor(index / 5) * 42 };
  return {
    id: composerId('item'),
    assetId: asset.id,
    x: base.x - width / 2,
    y: base.y - height / 2,
    w: width,
    h: height,
    rotation: 0,
    locked: false
  };
}

function composerDefaultProjectName() {
  return COMPOSER_MODE_LABEL + ' ' + (composerState.projects.length + 1);
}

function composerCreateProject(name) {
  const now = Date.now();
  const project = {
    id: composerId('canvas'),
    name: name || composerDefaultProjectName(),
    mode: 'free',
    createdAt: now,
    updatedAt: now,
    aspect: { type: 'infinite', value: 'infinite', label: '自由' },
    background: { transparent: false, color: '#ffffff' },
    assets: [],
    state: { items: [], gap: 0 },
    preview: ''
  };
  composerState.projects.unshift(project);
  composerState.activeId = project.id;
  composerSetSelection([]);
  composerState.history = [];
  composerState.redo = [];
  composerState.drawerView = 'projects';
  composerFitView();
  composerRenderProjectList();
  composerSyncControls();
  composerRender();
  composerScheduleSave();
}

async function composerCreateProjectWithName() {
  const name = await composerAskProjectName(
    { name: composerDefaultProjectName() },
    { title: '新增画布', hint: '为新的自由画布命名' }
  );
  if (!name) return;
  composerCreateProject(name);
}

function composerScheduleSave() {
  clearTimeout(composerState.saveTimer);
  composerState.saveTimer = setTimeout(async () => {
    const project = composerActiveProject();
    if (project) {
      project.updatedAt = Date.now();
      project.preview = composerCreatePreview(project);
    }
    await window.api.saveComposerProjects(composerState.projects);
    composerRenderProjectList();
  }, 350);
}

function composerSnapshot() {
  const project = composerActiveProject();
  if (!project) return;
  composerState.history.push(JSON.stringify(project));
  if (composerState.history.length > 80) composerState.history.shift();
  composerState.redo = [];
  composerSyncControls();
}

function composerRestore(serialized) {
  const restored = composerNormalizeProject(JSON.parse(serialized));
  const index = composerState.projects.findIndex(project => project.id === restored.id);
  if (index >= 0) {
    composerState.projects[index] = restored;
    composerState.activeId = restored.id;
    composerSetSelection([]);
    composerSyncControls();
    composerRenderProjectList();
    composerRender();
    composerScheduleSave();
  }
}

function composerUndo() {
  const project = composerActiveProject();
  if (!project || composerState.history.length === 0) return;
  composerState.redo.push(JSON.stringify(project));
  composerRestore(composerState.history.pop());
}

function composerRedo() {
  const project = composerActiveProject();
  if (!project || composerState.redo.length === 0) return;
  composerState.history.push(JSON.stringify(project));
  composerRestore(composerState.redo.pop());
}

function composerDeleteProject(projectId) {
  const index = composerState.projects.findIndex(project => project.id === projectId);
  if (index < 0) return;
  composerState.projects.splice(index, 1);
  if (composerState.activeId === projectId) {
    composerState.activeId = composerState.projects[0] ? composerState.projects[0].id : null;
    composerSetSelection([]);
    composerState.history = [];
    composerState.redo = [];
  }
  if (composerState.projects.length === 0) composerCreateProject();
  composerRenderProjectList();
  composerSyncControls();
  composerRender();
  composerScheduleSave();
}

function composerAskProjectName(project, options = {}) {
  return new Promise(resolve => {
    const title = options.title || '重命名画布';
    const hint = options.hint || '输入新的画布名称';
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = '<div class="dialog-box"><div class="dialog-title">重命名画布</div><div class="dialog-hint">输入新的画布名称</div><input type="text" class="dialog-input" value=""><div class="dialog-actions"><button class="dialog-btn dialog-btn-cancel">取消</button><button class="dialog-btn dialog-btn-confirm">确定</button></div></div>';
    overlay.querySelector('.dialog-title').textContent = title;
    overlay.querySelector('.dialog-hint').textContent = hint;
    const input = overlay.querySelector('input');
    const cancel = overlay.querySelector('.dialog-btn-cancel');
    const confirm = overlay.querySelector('.dialog-btn-confirm');
    input.value = project.name;
    document.body.appendChild(overlay);
    setTimeout(() => {
      input.focus();
      input.select();
    }, 30);
    const cleanup = (value) => {
      overlay.remove();
      resolve(value);
    };
    cancel.addEventListener('click', () => cleanup(null));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup(null);
    });
    confirm.addEventListener('click', () => cleanup(input.value.trim()));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') cleanup(input.value.trim());
      if (e.key === 'Escape') cleanup(null);
    });
  });
}

async function composerRenameProject(project) {
  const nextName = await composerAskProjectName(project);
  if (!nextName || nextName === project.name) return;
  project.name = nextName;
  composerRenderProjectList();
  composerSyncControls();
  composerScheduleSave();
}

function composerEnterSaveMode(project) {
  if (!project) return;
  composerState.savingProjectId = project.id;
  composerState.drawerView = 'save';
  document.querySelector('.composer-projects').classList.add('expanded');
  composerRenderSaveFolders();
  composerSyncDrawerView();
}

function composerSaveTargetProject() {
  return composerState.projects.find(project => project.id === composerState.savingProjectId) || composerActiveProject();
}

function composerRenderSaveFolders() {
  composerMaterialList.innerHTML = '';
  const folders = Array.isArray(workspaces) ? workspaces : [];
  if (folders.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'composer-empty-materials';
    empty.textContent = '暂无文件夹';
    composerMaterialList.appendChild(empty);
    return;
  }

  folders.forEach(workspace => {
    const folderPath = workspace.path || workspace;
    const folderName = workspace.alias || workspace.name || folderPath.split(/[\\/]/).pop() || folderPath;
    const folderItem = document.createElement('button');
    folderItem.className = 'composer-folder-item';
    folderItem.innerHTML = '<span>' + folderName + '</span>';
    folderItem.addEventListener('click', () => composerShowSaveDialog(workspace));
    composerMaterialList.appendChild(folderItem);
  });
}

function composerShowSaveDialog(workspace) {
  const project = composerSaveTargetProject();
  if (!project || !workspace) return;
  const folderPath = workspace.path || workspace;
  const folderName = workspace.alias || workspace.name || folderPath.split(/[\\/]/).pop() || folderPath;
  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  overlay.innerHTML = '<div class="dialog-box composer-save-dialog"><div class="dialog-title">保存图片</div><div class="dialog-hint">保存图片到 ' + folderName + '</div><div class="composer-save-row"><input type="text" class="dialog-input composer-save-name" value=""><div class="composer-save-format"><button class="active" data-format="png">PNG</button><button data-format="jpeg">JPEG</button></div></div><div class="dialog-actions"><button class="dialog-btn dialog-btn-cancel">取消</button><button class="dialog-btn dialog-btn-confirm">确定</button></div></div>';
  const input = overlay.querySelector('.composer-save-name');
  const formatGroup = overlay.querySelector('.composer-save-format');
  const cancel = overlay.querySelector('.dialog-btn-cancel');
  const confirm = overlay.querySelector('.dialog-btn-confirm');
  input.value = project.name;
  document.body.appendChild(overlay);
  setTimeout(() => {
    input.focus();
    input.select();
  }, 30);

  const close = () => overlay.remove();
  const save = async () => {
    const fileName = input.value.trim();
    if (!fileName) {
      input.focus();
      return;
    }
    confirm.disabled = true;
    const activeFormat = formatGroup.querySelector('button.active');
    const format = activeFormat && activeFormat.dataset.format === 'jpeg' ? 'jpeg' : 'png';
    const exportCanvas = await composerRenderToCanvas(project);
    const dataUrl = exportCanvas.toDataURL(format === 'jpeg' ? 'image/jpeg' : 'image/png', 0.92);
    const result = await window.api.saveImageDataToFolder({
      dataUrl,
      format,
      fileName,
      dirPath: folderPath
    });
    confirm.disabled = false;
    if (result && result.success) {
      close();
      composerState.drawerView = 'projects';
      composerState.savingProjectId = null;
      composerSyncDrawerView();
      if (activeWorkspacePath === folderPath) {
        imageCache[folderPath] = null;
        await loadImages(folderPath);
      }
    }
  };

  cancel.addEventListener('click', close);
  confirm.addEventListener('click', save);
  formatGroup.addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;
    formatGroup.querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button));
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') close();
  });
}

function composerRemoveFloatingMenus() {
  document.querySelectorAll('.composer-context-menu').forEach(menu => menu.remove());
}

function composerPlaceMenu(menu, x, y) {
  let left = x;
  let top = y;
  if (left + menu.offsetWidth > window.innerWidth) left = window.innerWidth - menu.offsetWidth - 8;
  if (top + menu.offsetHeight > window.innerHeight) top = window.innerHeight - menu.offsetHeight - 8;
  menu.style.left = Math.max(8, left) + 'px';
  menu.style.top = Math.max(40, top) + 'px';
  composerPlaceSubmenus(menu);
}

function composerPlaceSubmenus(menu) {
  const menuRect = menu.getBoundingClientRect();
  menu.querySelectorAll('.composer-context-submenu').forEach(submenu => {
    const submenuWidth = submenu.offsetWidth || 128;
    const shouldOpenLeft = menuRect.right + submenuWidth > window.innerWidth - 8;
    submenu.classList.toggle('left', shouldOpenLeft);
  });
}

function composerCreateMenuButton(label, onClick, disabled) {
  const button = document.createElement('button');
  button.textContent = label;
  button.disabled = !!disabled;
  button.addEventListener('click', () => {
    if (button.disabled) return;
    composerRemoveFloatingMenus();
    onClick();
  });
  return button;
}

function composerCreateSubmenu(label, options, onClick) {
  const wrap = document.createElement('div');
  wrap.className = 'composer-context-submenu-wrap';
  const trigger = document.createElement('button');
  trigger.className = 'composer-context-submenu-trigger';
  if (onClick) {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      composerRemoveFloatingMenus();
      onClick();
    });
  }
  trigger.innerHTML = '<span>' + label + '</span><span class="composer-context-chevron">›</span>';
  const submenu = document.createElement('div');
  submenu.className = 'composer-context-submenu';
  options.forEach(option => submenu.appendChild(composerCreateMenuButton(option.label, option.onClick, option.disabled)));
  wrap.appendChild(trigger);
  wrap.appendChild(submenu);
  return wrap;
}

function composerShowProjectMenu(x, y, project) {
  composerRemoveFloatingMenus();
  const menu = document.createElement('div');
  menu.className = 'composer-context-menu';
  menu.appendChild(composerCreateMenuButton('置顶', () => composerPinProject(project.id), composerState.projects[0] && composerState.projects[0].id === project.id));
  menu.appendChild(composerCreateMenuButton('重命名', () => composerRenameProject(project)));
  menu.appendChild(composerCreateMenuButton('保存到文件夹', () => composerEnterSaveMode(project)));
  menu.appendChild(composerCreateSubmenu('导出', [
    { label: 'PNG', onClick: () => composerExportProject(project, 'png') },
    { label: 'JPEG', onClick: () => composerExportProject(project, 'jpeg') }
  ], () => composerExportProject(project, 'png')));
  const separator = document.createElement('div');
  separator.className = 'composer-context-separator';
  menu.appendChild(separator);
  menu.appendChild(composerCreateMenuButton('删除', () => composerDeleteProject(project.id)));
  document.body.appendChild(menu);
  composerPlaceMenu(menu, x, y);
}

function composerShowImageMenu(x, y, item) {
  const project = composerActiveProject();
  if (!project || !item) return;
  composerRemoveFloatingMenus();
  composerSetSelection([item.id]);
  composerRender();

  const menu = document.createElement('div');
  menu.className = 'composer-context-menu';
  menu.appendChild(composerCreateMenuButton('原始大小', () => composerRestoreOriginalSize(item)));
  menu.appendChild(composerCreateMenuButton(item.locked ? '解除锁定' : '锁定位置', () => composerToggleLock(item)));
  menu.appendChild(composerCreateMenuButton('旋转', () => composerRotateItem(item), !!item.locked));
  menu.appendChild(composerCreateMenuButton('复制', composerDuplicateSelected));
  const layerSeparator = document.createElement('div');
  layerSeparator.className = 'composer-context-separator';
  menu.appendChild(layerSeparator);
  menu.appendChild(composerCreateSubmenu('层级', [
    { label: '上移一层', onClick: () => composerMoveLayer(1) },
    { label: '下移一层', onClick: () => composerMoveLayer(-1) },
    { label: '置于顶层', onClick: () => composerMoveLayerTo('top') },
    { label: '置于底层', onClick: () => composerMoveLayerTo('bottom') }
  ]));
  const separator = document.createElement('div');
  separator.className = 'composer-context-separator';
  menu.appendChild(separator);
  menu.appendChild(composerCreateMenuButton('删除', composerDeleteSelected));
  document.body.appendChild(menu);
  composerPlaceMenu(menu, x, y);
}

function composerPinProject(projectId) {
  const index = composerState.projects.findIndex(project => project.id === projectId);
  if (index <= 0) return;
  const [project] = composerState.projects.splice(index, 1);
  composerState.projects.unshift(project);
  composerRenderProjectList();
  composerScheduleSave();
}

function composerRenderProjectList() {
  composerProjectList.innerHTML = '';
  composerState.projects.forEach(project => {
    const item = document.createElement('div');
    item.className = 'composer-project-item' + (project.id === composerState.activeId ? ' active' : '');
    item.addEventListener('click', () => {
      composerState.activeId = project.id;
      composerSetSelection([]);
      composerState.history = [];
      composerState.redo = [];
      composerFitView();
      composerRenderProjectList();
      composerSyncControls();
      composerRender();
    });

    const meta = document.createElement('div');
    meta.className = 'composer-project-meta';
    const name = document.createElement('div');
    name.className = 'composer-project-name';
    name.textContent = project.name;
    meta.appendChild(name);

    const actions = document.createElement('div');
    actions.className = 'composer-project-actions';
    const more = document.createElement('button');
    more.className = 'composer-project-more';
    more.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';
    more.addEventListener('click', (e) => {
      e.stopPropagation();
      composerShowProjectMenu(e.clientX, e.clientY, project);
    });
    actions.appendChild(more);

    item.appendChild(meta);
    item.appendChild(actions);
    composerProjectList.appendChild(item);
  });
}

async function composerRefreshMaterials() {
  const folders = Array.isArray(workspaces) ? workspaces : [];
  const results = [];
  for (const workspace of folders) {
    const folderPath = workspace.path || workspace;
    const folderName = workspace.alias || workspace.name || folderPath.split(/[\\/]/).pop() || folderPath;
    try {
      const images = await window.api.getImagesInDirectory(folderPath);
      results.push({ path: folderPath, name: folderName, images: Array.isArray(images) ? images : [] });
    } catch {
      results.push({ path: folderPath, name: folderName, images: [] });
    }
  }
  composerState.materials = results;
  if (!composerState.expandedMaterialFolder && results[0]) composerState.expandedMaterialFolder = results[0].path;
  composerRenderMaterials();
}

function composerRenderMaterials() {
  composerMaterialList.innerHTML = '';
  if (composerState.materials.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'composer-empty-materials';
    empty.textContent = '暂无素材';
    composerMaterialList.appendChild(empty);
    return;
  }
  composerState.materials.forEach(folder => {
    const folderItem = document.createElement('button');
    folderItem.className = 'composer-folder-item' + (composerState.expandedMaterialFolder === folder.path ? ' active' : '');
    folderItem.innerHTML = '<span>' + folder.name + '</span><small>' + folder.images.length + '</small>';
    folderItem.addEventListener('click', () => {
      composerState.expandedMaterialFolder = composerState.expandedMaterialFolder === folder.path ? null : folder.path;
      composerRenderMaterials();
    });
    composerMaterialList.appendChild(folderItem);

    if (composerState.expandedMaterialFolder !== folder.path) return;
    if (folder.images.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'composer-empty-materials';
      empty.textContent = '这个文件夹没有图片';
      composerMaterialList.appendChild(empty);
      return;
    }
    folder.images.forEach(image => {
      const imageItem = document.createElement('div');
      imageItem.className = 'composer-material-item';
      imageItem.draggable = true;
      imageItem.innerHTML = '<img alt=""><span></span>';
      imageItem.querySelector('img').src = toLocalImageUrl(image.path);
      imageItem.querySelector('span').textContent = image.name;
      imageItem.addEventListener('click', () => composerAddImage(image));
      imageItem.addEventListener('dragstart', (e) => {
        composerState.dragMaterial = image;
        e.dataTransfer.effectAllowed = 'copy';
      });
      imageItem.addEventListener('dragend', () => {
        composerState.dragMaterial = null;
      });
      composerMaterialList.appendChild(imageItem);
    });
  });
}

function composerSyncDrawerView() {
  const materialMode = composerState.drawerView === 'materials';
  const saveMode = composerState.drawerView === 'save';
  composerProjectList.classList.toggle('hidden', materialMode || saveMode);
  composerMaterialList.classList.toggle('hidden', !materialMode && !saveMode);
  composerDrawerCancelBtn.classList.toggle('hidden', !materialMode && !saveMode);
  composerMaterialToggle.classList.toggle('active', materialMode);
  composerMaterialToggle.classList.toggle('composer-drawer-text-btn', saveMode);
  if (saveMode) {
    composerMaterialToggle.innerHTML = '<span>选择文件夹</span>';
  } else {
    composerMaterialToggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
  }
}

async function composerAddImage(image, center) {
  let project = composerActiveProject();
  if (!project) {
    composerCreateProject();
    project = composerActiveProject();
  }
  const dimensions = await composerReadDimensions(image);
  const asset = {
    id: composerId('asset'),
    name: image.name || '图片',
    path: image.path,
    width: dimensions.width,
    height: dimensions.height
  };
  composerSnapshot();
  project.assets.push(asset);
  const worldCenter = center || { x: 0, y: 0 };
  const item = composerCreateItemFromAsset(asset, project.state.items.length, worldCenter);
  project.state.items.push(item);
  composerSetSelection([item.id]);
  composerRenderProjectList();
  composerSyncControls();
  composerRender();
  composerScheduleSave();
}

async function composerReadDimensions(image) {
  if (image.width && image.height) return { width: image.width, height: image.height };
  try {
    const dimensions = await window.api.getImageDimensions(image.path);
    if (dimensions && dimensions.width && dimensions.height) return dimensions;
  } catch {}
  return { width: 800, height: 600 };
}

function composerScreenToWorld(x, y) {
  return {
    x: (x - composerCanvas.clientWidth / 2 - composerState.panX) / composerState.scale,
    y: (y - composerCanvas.clientHeight / 2 - composerState.panY) / composerState.scale
  };
}

function composerWorldToScreen(x, y) {
  return {
    x: composerCanvas.clientWidth / 2 + composerState.panX + x * composerState.scale,
    y: composerCanvas.clientHeight / 2 + composerState.panY + y * composerState.scale
  };
}

function composerPointer(e) {
  const rect = composerCanvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function composerResizeCanvas() {
  const rect = composerStage.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  composerCanvas.width = Math.max(1, Math.floor(rect.width * dpr));
  composerCanvas.height = Math.max(1, Math.floor(rect.height * dpr));
  composerCanvas.style.width = rect.width + 'px';
  composerCanvas.style.height = rect.height + 'px';
  composerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  composerRender();
}

function composerContentBounds(project) {
  return composerProjectBounds(project, 40);
}

function composerExportBounds(project) {
  return composerProjectBounds(project, 0);
}

function composerProjectBounds(project, padding) {
  const items = project && project.state ? project.state.items : [];
  if (items.length === 0) return { ...COMPOSER_EMPTY_BOUNDS };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  items.forEach(item => {
    minX = Math.min(minX, item.x);
    minY = Math.min(minY, item.y);
    maxX = Math.max(maxX, item.x + item.w);
    maxY = Math.max(maxY, item.y + item.h);
  });
  return {
    x: minX - padding,
    y: minY - padding,
    w: Math.max(1, maxX - minX + padding * 2),
    h: Math.max(1, maxY - minY + padding * 2)
  };
}

function composerFitView() {
  const project = composerActiveProject();
  const bounds = project ? composerContentBounds(project) : COMPOSER_EMPTY_BOUNDS;
  const width = composerStage.clientWidth || 800;
  const height = composerStage.clientHeight || 600;
  composerState.scale = Math.max(0.08, Math.min(1.2, Math.min((width - 180) / bounds.w, (height - 160) / bounds.h)));
  composerState.panX = -(bounds.x + bounds.w / 2) * composerState.scale;
  composerState.panY = -(bounds.y + bounds.h / 2) * composerState.scale;
  composerSyncControls();
  composerRender();
}

function composerSyncControls() {
  const project = composerActiveProject();
  composerProjectTitle.textContent = project ? `${project.name} · ${COMPOSER_MODE_LABEL}` : '图片创作';
  composerZoomLabel.textContent = Math.round(composerState.scale * 100) + '%';
  composerPanModeBtn.classList.toggle('active', composerState.panMode);
  composerCanvas.classList.toggle('pan-mode', composerState.panMode);
  composerCanvas.classList.toggle('is-dragging', !!composerState.dragging && (composerState.dragging.type === 'pan' || composerState.dragging.type === 'right-pan'));
  composerSnapToggle.classList.toggle('active', composerState.snap);
  composerSyncGridButton();
  document.getElementById('composer-undo-btn').disabled = composerState.history.length === 0;
  document.getElementById('composer-redo-btn').disabled = composerState.redo.length === 0;
}

function composerSyncGridButton() {
  const icons = {
    off: '<svg viewBox="0 0 24 24"><path d="M6 4v16M18 4v16M4 6h16M4 18h16"/></svg>',
    low: '<svg viewBox="0 0 24 24"><path d="M6 4v16M18 4v16M4 6h16M4 18h16"/></svg>',
    medium: '<svg viewBox="0 0 24 24"><path d="M6 3v18M12 3v18M18 3v18M3 6h18M3 12h18M3 18h18"/></svg>',
    high: '<svg viewBox="0 0 24 24"><path d="M5 3v18M10 3v18M15 3v18M20 3v18M3 5h18M3 10h18M3 15h18M3 20h18"/></svg>'
  };
  const mode = composerState.grid ? composerState.gridDensity : 'off';
  const labels = { off: '网格：关闭', low: '网格：稀疏', medium: '网格：中等', high: '网格：密集' };
  composerGridToggle.innerHTML = icons[mode] || icons.off;
  composerGridToggle.title = labels[mode] || labels.off;
  composerGridToggle.classList.toggle('active', composerState.grid);
}

function composerDrawGrid(ctx, width, height) {
  if (!composerState.grid) return;
  const step = (COMPOSER_GRID_STEPS[composerState.gridDensity] || COMPOSER_GRID_STEPS.medium) * composerState.scale;
  if (step < 8) return;
  ctx.save();
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim() || '#ddd';
  ctx.globalAlpha = 0.52;
  ctx.lineWidth = 1;
  const offsetX = (composerCanvas.clientWidth / 2 + composerState.panX) % step;
  const offsetY = (composerCanvas.clientHeight / 2 + composerState.panY) % step;
  for (let x = offsetX; x < width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = offsetY; y < height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();
}

function composerRender() {
  const width = composerCanvas.clientWidth || composerStage.clientWidth;
  const height = composerCanvas.clientHeight || composerStage.clientHeight;
  composerCtx.clearRect(0, 0, width, height);
  composerCtx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--content-bg').trim() || '#fff';
  composerCtx.fillRect(0, 0, width, height);
  composerDrawGrid(composerCtx, width, height);

  const project = composerActiveProject();
  if (!project) return;
  project.state.items.forEach(item => composerDrawItem(composerCtx, project, item));
  composerDrawSelectionRect(composerCtx);
}

function composerDrawItem(ctx, project, item) {
  const asset = project.assets.find(entry => entry.id === item.assetId);
  if (!asset) return;
  const p = composerWorldToScreen(item.x, item.y);
  const w = item.w * composerState.scale;
  const h = item.h * composerState.scale;
  const image = composerGetCachedImage(asset);

  ctx.save();
  ctx.beginPath();
  ctx.rect(p.x, p.y, w, h);
  ctx.clip();
  if (image && image.complete) {
    if (item.rotation) {
      composerDrawRotatedCover(ctx, image, p.x, p.y, w, h, item.rotation);
    } else {
      composerDrawImageCover(ctx, image, p.x, p.y, w, h);
    }
  } else {
    ctx.fillStyle = '#f3f3f3';
    ctx.fillRect(p.x, p.y, w, h);
  }
  ctx.restore();

  if (composerIsSelected(item.id)) composerDrawItemSelection(ctx, item);
  if (item.locked) composerDrawLockMark(ctx, item);
}

function composerDrawImageCover(ctx, image, x, y, w, h) {
  const ratio = image.naturalWidth / Math.max(1, image.naturalHeight);
  const boxRatio = w / Math.max(1, h);
  let drawW = w;
  let drawH = h;
  if (ratio > boxRatio) {
    drawW = h * ratio;
  } else {
    drawH = w / ratio;
  }
  ctx.drawImage(image, x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH);
}

function composerDrawRotatedCover(ctx, image, x, y, w, h, rotation) {
  const normalized = ((rotation % 360) + 360) % 360;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(normalized * Math.PI / 180);
  const rotated = normalized % 180 !== 0;
  const boxW = rotated ? h : w;
  const boxH = rotated ? w : h;
  composerDrawImageCover(ctx, image, -boxW / 2, -boxH / 2, boxW, boxH);
  ctx.restore();
}

function composerDrawItemSelection(ctx, item) {
  const p = composerWorldToScreen(item.x, item.y);
  const w = item.w * composerState.scale;
  const h = item.h * composerState.scale;
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() || 'rgb(100, 200, 200)';
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(p.x - 1, p.y - 1, w + 2, h + 2);
  if (!item.locked && composerState.selectedIds.length === 1) {
    ctx.fillStyle = accent;
    ctx.fillRect(p.x + w - 6, p.y + h - 6, 12, 12);
  }
  ctx.restore();
}

function composerDrawLockMark(ctx, item) {
  const p = composerWorldToScreen(item.x, item.y);
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() || 'rgb(100, 200, 200)';
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeRect(p.x + 8, p.y + 14, 12, 8);
  ctx.beginPath();
  ctx.arc(p.x + 14, p.y + 14, 4, Math.PI, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(p.x + 14, p.y + 18);
  ctx.lineTo(p.x + 14, p.y + 19);
  ctx.stroke();
  ctx.restore();
}

function composerDrawSelectionRect(ctx) {
  if (!composerState.selectionRect) return;
  const rect = composerNormalizeRect(composerState.selectionRect);
  const a = composerWorldToScreen(rect.x, rect.y);
  const b = composerWorldToScreen(rect.x + rect.w, rect.y + rect.h);
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() || 'rgb(100, 200, 200)';
  ctx.save();
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.12;
  ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = accent;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
  ctx.restore();
}

function composerGetCachedImage(asset) {
  if (composerState.imageCache.has(asset.path)) return composerState.imageCache.get(asset.path);
  const image = new Image();
  image.onload = () => composerRender();
  image.onerror = () => composerState.imageCache.delete(asset.path);
  image.src = toLocalImageUrl(asset.path);
  composerState.imageCache.set(asset.path, image);
  return image;
}

function composerLoadImage(asset) {
  return new Promise(resolve => {
    const cached = composerGetCachedImage(asset);
    if (cached.complete && cached.naturalWidth) {
      resolve(cached);
      return;
    }
    cached.onload = () => {
      composerRender();
      resolve(cached);
    };
    cached.onerror = () => resolve(null);
  });
}

function composerHitTest(world) {
  const project = composerActiveProject();
  if (!project) return null;
  for (let i = project.state.items.length - 1; i >= 0; i--) {
    const item = project.state.items[i];
    if (world.x < item.x || world.x > item.x + item.w || world.y < item.y || world.y > item.y + item.h) continue;
    return item;
  }
  return null;
}

function composerHitResizeHandle(item, screen) {
  if (!item || item.locked || composerState.selectedIds.length !== 1) return false;
  const p = composerWorldToScreen(item.x + item.w, item.y + item.h);
  return Math.abs(screen.x - p.x) <= 12 && Math.abs(screen.y - p.y) <= 12;
}

function composerNormalizeRect(rect) {
  const x1 = Math.min(rect.x1, rect.x2);
  const y1 = Math.min(rect.y1, rect.y2);
  const x2 = Math.max(rect.x1, rect.x2);
  const y2 = Math.max(rect.y1, rect.y2);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

function composerRectIntersectsItem(rect, item) {
  return rect.x <= item.x + item.w && rect.x + rect.w >= item.x && rect.y <= item.y + item.h && rect.y + rect.h >= item.y;
}

function composerSnapValue(value) {
  if (!composerState.snap || !composerState.grid) return value;
  const step = COMPOSER_GRID_STEPS[composerState.gridDensity] || COMPOSER_GRID_STEPS.medium;
  return Math.round(value / step) * step;
}

function composerMovingBounds(starts, dx = 0, dy = 0) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  starts.forEach(item => {
    minX = Math.min(minX, item.x + dx);
    minY = Math.min(minY, item.y + dy);
    maxX = Math.max(maxX, item.x + item.w + dx);
    maxY = Math.max(maxY, item.y + item.h + dy);
  });
  if (!isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function composerSnapTargets(project, movingIds) {
  const moving = new Set(movingIds);
  const x = [];
  const y = [];
  project.state.items.forEach(item => {
    if (moving.has(item.id)) return;
    x.push(item.x, item.x + item.w);
    y.push(item.y, item.y + item.h);
  });
  return { x, y };
}

function composerNearestDelta(candidates) {
  if (candidates.length === 0) return 0;
  return candidates.reduce((best, current) => Math.abs(current) < Math.abs(best) ? current : best, candidates[0]);
}

function composerEdgeSnapDelta(bounds, targets) {
  if (!composerState.snap) return { dx: 0, dy: 0 };
  const tolerance = COMPOSER_EDGE_SNAP_SCREEN_DISTANCE / Math.max(0.1, composerState.scale);
  const xEdges = [bounds.x, bounds.x + bounds.w];
  const yEdges = [bounds.y, bounds.y + bounds.h];
  const xDeltas = [];
  const yDeltas = [];

  targets.x.forEach(target => {
    xEdges.forEach(edge => {
      const delta = target - edge;
      if (Math.abs(delta) <= tolerance) xDeltas.push(delta);
    });
  });

  targets.y.forEach(target => {
    yEdges.forEach(edge => {
      const delta = target - edge;
      if (Math.abs(delta) <= tolerance) yDeltas.push(delta);
    });
  });

  return {
    dx: composerNearestDelta(xDeltas),
    dy: composerNearestDelta(yDeltas)
  };
}

function composerSnapMoveDelta(project, drag, dx, dy) {
  if (!composerState.snap) return { dx, dy };
  const rawBounds = composerMovingBounds(drag.items, dx, dy);
  const xDeltas = [];
  const yDeltas = [];

  if (composerState.grid) {
    xDeltas.push(composerSnapValue(rawBounds.x) - rawBounds.x);
    yDeltas.push(composerSnapValue(rawBounds.y) - rawBounds.y);
  }

  const edgeDelta = composerEdgeSnapDelta(rawBounds, composerSnapTargets(project, drag.items.map(item => item.id)));
  if (edgeDelta.dx !== 0) xDeltas.push(edgeDelta.dx);
  if (edgeDelta.dy !== 0) yDeltas.push(edgeDelta.dy);

  return {
    dx: dx + composerNearestDelta(xDeltas),
    dy: dy + composerNearestDelta(yDeltas)
  };
}

function composerSnapResizeWidth(project, drag, width) {
  if (!composerState.snap) return width;
  const candidates = [];
  if (composerState.grid) {
    candidates.push(composerSnapValue(width));
  }

  const tolerance = COMPOSER_EDGE_SNAP_SCREEN_DISTANCE / Math.max(0.1, composerState.scale);
  const targets = composerSnapTargets(project, [drag.id]);
  const right = drag.x + width;
  const bottom = drag.y + width / Math.max(0.05, drag.ratio);
  targets.x.forEach(target => {
    const delta = target - right;
    if (Math.abs(delta) <= tolerance) candidates.push(width + delta);
  });
  targets.y.forEach(target => {
    const delta = target - bottom;
    if (Math.abs(delta) <= tolerance) candidates.push(width + delta * drag.ratio);
  });

  if (candidates.length === 0) return width;
  return candidates.reduce((best, current) => Math.abs(current - width) < Math.abs(best - width) ? current : best, candidates[0]);
}

function composerApplySelectionRect() {
  const project = composerActiveProject();
  if (!project || !composerState.selectionRect) return;
  const rect = composerNormalizeRect(composerState.selectionRect);
  composerSetSelection(project.state.items.filter(item => composerRectIntersectsItem(rect, item)).map(item => item.id));
}

function composerSelectedItems(project) {
  return project.state.items.filter(item => composerState.selectedIds.includes(item.id));
}

function composerStartPan(screen) {
  composerState.dragging = {
    type: 'pan',
    startX: screen.x,
    startY: screen.y,
    panX: composerState.panX,
    panY: composerState.panY
  };
  composerSyncControls();
}

function composerStartRightPan(screen) {
  composerState.dragging = {
    type: 'right-pan',
    startX: screen.x,
    startY: screen.y,
    panX: composerState.panX,
    panY: composerState.panY,
    moved: false
  };
  composerSyncControls();
}

function composerRemoveUnusedAssets(project) {
  if (!project || !Array.isArray(project.assets) || !project.state || !Array.isArray(project.state.items)) return;
  const usedAssetIds = new Set(project.state.items.map(item => item.assetId));
  project.assets = project.assets.filter(asset => usedAssetIds.has(asset.id));
}

function composerStartMove(item, world, append) {
  const project = composerActiveProject();
  if (!project || item.locked) return;
  if (append) {
    const next = composerIsSelected(item.id)
      ? composerState.selectedIds.filter(id => id !== item.id)
      : [...composerState.selectedIds, item.id];
    composerSetSelection(next.length ? next : [item.id]);
  } else if (!composerIsSelected(item.id)) {
    composerSetSelection([item.id]);
  }
  const moving = composerSelectedItems(project).filter(entry => !entry.locked);
  if (moving.length === 0) return;
  composerSnapshot();
  composerState.dragging = {
    type: 'move',
    startWorld: world,
    items: moving.map(entry => ({ id: entry.id, x: entry.x, y: entry.y, w: entry.w, h: entry.h }))
  };
}

function composerStartResize(item, world) {
  if (!item || item.locked) return;
  composerSnapshot();
  composerState.dragging = {
    type: 'resize',
    id: item.id,
    startWorld: world,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    ratio: item.w / Math.max(1, item.h)
  };
}

composerCanvas.addEventListener('mousedown', (e) => {
  if (e.button === 2) {
    e.preventDefault();
    composerRemoveFloatingMenus();
    composerStartRightPan(composerPointer(e));
    return;
  }
  if (e.button === 1) {
    e.preventDefault();
    composerRemoveFloatingMenus();
    composerStartPan(composerPointer(e));
    return;
  }
  if (e.button !== 0) return;
  composerRemoveFloatingMenus();
  const screen = composerPointer(e);
  const world = composerScreenToWorld(screen.x, screen.y);
  if (composerState.panMode || e.altKey || e.button === 1) {
    composerStartPan(screen);
    return;
  }

  const hit = composerHitTest(world);
  if (hit) {
    if (composerHitResizeHandle(hit, screen)) {
      composerStartResize(hit, world);
    } else {
      composerStartMove(hit, world, e.shiftKey);
    }
    composerSyncControls();
    composerRender();
    return;
  }

  composerSetSelection([]);
  composerState.selectionRect = { x1: world.x, y1: world.y, x2: world.x, y2: world.y };
  composerState.dragging = { type: 'select' };
  composerRender();
});

window.addEventListener('mousemove', (e) => {
  const drag = composerState.dragging;
  if (!drag) return;
  const screen = composerPointer(e);
  const world = composerScreenToWorld(screen.x, screen.y);
  const project = composerActiveProject();

  if (drag.type === 'pan' || drag.type === 'right-pan') {
    if (drag.type === 'right-pan' && Math.hypot(screen.x - drag.startX, screen.y - drag.startY) > 3) {
      drag.moved = true;
    }
    composerState.panX = drag.panX + screen.x - drag.startX;
    composerState.panY = drag.panY + screen.y - drag.startY;
  } else if (drag.type === 'move' && project) {
    const dx = world.x - drag.startWorld.x;
    const dy = world.y - drag.startWorld.y;
    const snapped = composerSnapMoveDelta(project, drag, dx, dy);
    drag.items.forEach(start => {
      const item = project.state.items.find(entry => entry.id === start.id);
      if (!item) return;
      item.x = start.x + snapped.dx;
      item.y = start.y + snapped.dy;
    });
  } else if (drag.type === 'resize' && project) {
    const item = project.state.items.find(entry => entry.id === drag.id);
    if (item) {
      const delta = Math.max(world.x - drag.startWorld.x, (world.y - drag.startWorld.y) * drag.ratio);
      const width = Math.max(24, composerSnapResizeWidth(project, drag, drag.w + delta));
      item.w = width;
      item.h = Math.max(24, item.w / Math.max(0.05, drag.ratio));
    }
  } else if (drag.type === 'select') {
    composerState.selectionRect.x2 = world.x;
    composerState.selectionRect.y2 = world.y;
    composerApplySelectionRect();
  }
  composerRender();
});

window.addEventListener('mouseup', () => {
  if (!composerState.dragging) return;
  if (composerState.dragging.type === 'right-pan') {
    composerState.lastRightPanMoved = composerState.dragging.moved;
  }
  const changed = composerState.dragging.type === 'move' || composerState.dragging.type === 'resize';
  composerState.dragging = null;
  composerState.selectionRect = null;
  composerSyncControls();
  composerRender();
  if (changed) composerScheduleSave();
});

composerCanvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if ((composerState.dragging && composerState.dragging.type === 'right-pan' && composerState.dragging.moved) || composerState.lastRightPanMoved) {
    composerState.lastRightPanMoved = false;
    return;
  }
  const screen = composerPointer(e);
  const world = composerScreenToWorld(screen.x, screen.y);
  const hit = composerHitTest(world);
  if (hit) composerShowImageMenu(e.clientX, e.clientY, hit);
});

composerCanvas.addEventListener('wheel', (e) => {
  if (composerState.selectionRect) {
    e.preventDefault();
    return;
  }
  e.preventDefault();
  const project = composerActiveProject();
  const selected = project && composerState.selectedIds.length === 1
    ? project.state.items.find(item => item.id === composerState.selectedId)
    : null;
  if (selected && !selected.locked && !composerState.panMode) {
    composerSnapshot();
    const factor = e.deltaY < 0 ? 1.06 : 0.94;
    const centerX = selected.x + selected.w / 2;
    const centerY = selected.y + selected.h / 2;
    selected.w = Math.max(24, selected.w * factor);
    selected.h = Math.max(24, selected.h * factor);
    selected.x = centerX - selected.w / 2;
    selected.y = centerY - selected.h / 2;
    composerRender();
    composerScheduleSave();
    return;
  }

  const screen = composerPointer(e);
  const before = composerScreenToWorld(screen.x, screen.y);
  const factor = e.deltaY < 0 ? 1.1 : 0.9;
  composerState.scale = Math.max(0.08, Math.min(4, composerState.scale * factor));
  const after = composerScreenToWorld(screen.x, screen.y);
  composerState.panX += (after.x - before.x) * composerState.scale;
  composerState.panY += (after.y - before.y) * composerState.scale;
  composerSyncControls();
  composerRender();
}, { passive: false });

composerCanvas.addEventListener('dragover', (e) => {
  if (!composerState.dragMaterial) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});

composerCanvas.addEventListener('drop', async (e) => {
  if (!composerState.dragMaterial) return;
  e.preventDefault();
  const screen = composerPointer(e);
  const center = composerScreenToWorld(screen.x, screen.y);
  const image = composerState.dragMaterial;
  composerState.dragMaterial = null;
  await composerAddImage(image, center);
});

function composerRestoreOriginalSize(item) {
  const project = composerActiveProject();
  if (!project || !item || item.locked) return;
  const asset = project.assets.find(entry => entry.id === item.assetId);
  if (!asset) return;
  composerSnapshot();
  const centerX = item.x + item.w / 2;
  const centerY = item.y + item.h / 2;
  const width = Math.min(480, Math.max(80, asset.width || item.w));
  const ratio = Math.max(0.05, asset.width / Math.max(1, asset.height));
  const rotated = item.rotation % 180 !== 0;
  item.w = rotated ? width / ratio : width;
  item.h = rotated ? width : width / ratio;
  item.x = centerX - item.w / 2;
  item.y = centerY - item.h / 2;
  composerRender();
  composerScheduleSave();
}

function composerToggleLock(item) {
  if (!item) return;
  composerSnapshot();
  item.locked = !item.locked;
  composerRender();
  composerScheduleSave();
}

function composerRotateItem(item) {
  if (!item || item.locked) return;
  composerSnapshot();
  const centerX = item.x + item.w / 2;
  const centerY = item.y + item.h / 2;
  const oldW = item.w;
  item.w = item.h;
  item.h = oldW;
  item.x = centerX - item.w / 2;
  item.y = centerY - item.h / 2;
  item.rotation = ((item.rotation || 0) + 90) % 360;
  composerRender();
  composerScheduleSave();
}

function composerDuplicateSelected() {
  const project = composerActiveProject();
  if (!project || composerState.selectedIds.length === 0) return;
  composerSnapshot();
  const copies = composerSelectedItems(project).map(item => ({
    ...item,
    id: composerId('item'),
    x: item.x + 24,
    y: item.y + 24,
    locked: false
  }));
  project.state.items.push(...copies);
  composerSetSelection(copies.map(item => item.id));
  composerRender();
  composerScheduleSave();
}

function composerDeleteSelected() {
  const project = composerActiveProject();
  if (!project || composerState.selectedIds.length === 0) return;
  composerSnapshot();
  const selected = new Set(composerState.selectedIds);
  project.state.items = project.state.items.filter(item => !selected.has(item.id) || item.locked);
  composerRemoveUnusedAssets(project);
  composerSetSelection([]);
  composerRender();
  composerScheduleSave();
}

function composerMoveLayer(delta) {
  const project = composerActiveProject();
  if (!project || !composerState.selectedId) return;
  const index = project.state.items.findIndex(item => item.id === composerState.selectedId);
  const next = index + delta;
  if (index < 0 || next < 0 || next >= project.state.items.length) return;
  composerSnapshot();
  const [item] = project.state.items.splice(index, 1);
  project.state.items.splice(next, 0, item);
  composerRender();
  composerScheduleSave();
}

function composerMoveLayerTo(edge) {
  const project = composerActiveProject();
  if (!project || !composerState.selectedId) return;
  const index = project.state.items.findIndex(item => item.id === composerState.selectedId);
  if (index < 0) return;
  composerSnapshot();
  const [item] = project.state.items.splice(index, 1);
  if (edge === 'top') project.state.items.push(item);
  else project.state.items.unshift(item);
  composerRender();
  composerScheduleSave();
}

function composerCreatePreview(project) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 150;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(100, 200, 200, 0.35)';
    ctx.fillRect(18, 22, 96, 68);
    ctx.fillRect(86, 58, 118, 70);
    ctx.fillStyle = '#777';
    ctx.font = '13px sans-serif';
    ctx.fillText(COMPOSER_MODE_LABEL, 18, 132);
    return canvas.toDataURL('image/png');
  } catch {
    return '';
  }
}

async function composerExportProject(project, format = 'png') {
  if (!project) return;
  const exportCanvas = await composerRenderToCanvas(project, format);
  const dataUrl = exportCanvas.toDataURL(format === 'jpeg' ? 'image/jpeg' : 'image/png', 0.92);
  await window.api.saveImageData({
    dataUrl,
    format,
    defaultName: project.name + (format === 'jpeg' ? '.jpg' : '.png')
  });
}

async function composerRenderToCanvas(project) {
  const bounds = composerExportBounds(project);
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = Math.max(1, Math.round(bounds.w));
  exportCanvas.height = Math.max(1, Math.round(bounds.h));
  const ctx = exportCanvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  for (const item of project.state.items) {
    const asset = project.assets.find(entry => entry.id === item.assetId);
    if (!asset) continue;
    const image = await composerLoadImage(asset);
    if (!image) continue;
    const x = item.x - bounds.x;
    const y = item.y - bounds.y;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, item.w, item.h);
    ctx.clip();
    if (item.rotation) {
      composerDrawRotatedCover(ctx, image, x, y, item.w, item.h, item.rotation);
    } else {
      composerDrawImageCover(ctx, image, x, y, item.w, item.h);
    }
    ctx.restore();
  }
  return exportCanvas;
}

document.getElementById('sidebar-composer-btn').addEventListener('click', openComposer);
document.getElementById('menu-composer').addEventListener('click', openComposer);
composerBackBtn.addEventListener('click', closeComposer);
composerMaterialToggle.addEventListener('click', () => {
  if (composerState.drawerView === 'save') return;
  composerState.drawerView = 'materials';
  document.querySelector('.composer-projects').classList.add('expanded');
  composerSyncDrawerView();
});
composerDrawerCancelBtn.addEventListener('click', () => {
  composerState.drawerView = 'projects';
  composerState.savingProjectId = null;
  composerSyncDrawerView();
});
composerProjectToggle.addEventListener('click', () => {
  document.querySelector('.composer-projects').classList.toggle('expanded');
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.composer-context-menu')) composerRemoveFloatingMenus();
});
document.getElementById('composer-new-project-btn').addEventListener('click', composerCreateProjectWithName);
document.getElementById('composer-undo-btn').addEventListener('click', composerUndo);
document.getElementById('composer-redo-btn').addEventListener('click', composerRedo);
document.getElementById('composer-fit-btn').addEventListener('click', composerFitView);
document.getElementById('composer-zoom-in-btn').addEventListener('click', () => {
  composerState.scale = Math.min(4, composerState.scale * 1.15);
  composerSyncControls();
  composerRender();
});
document.getElementById('composer-zoom-out-btn').addEventListener('click', () => {
  composerState.scale = Math.max(0.08, composerState.scale / 1.15);
  composerSyncControls();
  composerRender();
});
composerPanModeBtn.addEventListener('click', () => {
  composerState.panMode = !composerState.panMode;
  if (composerState.panMode) composerSetSelection([]);
  composerSyncControls();
  composerRender();
});
composerGridToggle.addEventListener('click', () => {
  if (!composerState.grid) {
    composerState.grid = true;
    composerState.gridDensity = 'low';
  } else if (composerState.gridDensity === 'low') {
    composerState.gridDensity = 'medium';
  } else if (composerState.gridDensity === 'medium') {
    composerState.gridDensity = 'high';
  } else {
    composerState.grid = false;
    composerState.gridDensity = 'medium';
  }
  composerSyncControls();
  composerRender();
});
composerSnapToggle.addEventListener('click', () => {
  composerState.snap = !composerState.snap;
  composerSyncControls();
});
window.addEventListener('resize', () => {
  if (!composerPage.classList.contains('hidden')) composerResizeCanvas();
});
document.addEventListener('keydown', (e) => {
  if (composerPage.classList.contains('hidden')) return;
  if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
  if (e.key === 'Backspace') {
    e.preventDefault();
    composerDeleteSelected();
  }
});
