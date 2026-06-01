async function init() {
  workspaces = await window.api.getWorkspaces();
  if (workspaces.length > 0) {
    const firstWs = workspaces[0];
    firstWs.expanded = true;
    await saveWorkspaces();
    await loadImages(firstWs.path);
  }
  renderWorkspaces();
  await window.api.appReady();
}

addFolderBtn.addEventListener('click', async () => {
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
