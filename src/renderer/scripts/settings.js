function openSettings() {
  const composerPageEl = document.getElementById('composer-page');
  if (composerPageEl) composerPageEl.classList.add('hidden');
  settingsPage.classList.remove('hidden');
  document.getElementById('app').style.display = 'none';
  syncSettingsUI();
  loadSettingsVersion();
}

function closeSettings() {
  settingsPage.classList.add('hidden');
  document.getElementById('app').style.display = '';
  if (currentImages.length > 0) {
    if (viewMode === 'waterfall') {
      renderWaterfall();
    } else if (viewMode === 'horizontal') {
      renderHorizontalView();
    } else if (viewMode === 'grid') {
      renderGridView();
    }
  }
}

function syncSettingsUI() {
  const cards = settingsViewModeCards.querySelectorAll('.settings-mode-card');
  cards.forEach(card => {
    const radio = card.querySelector('input[type="radio"]');
    card.classList.toggle('active', radio.value === viewMode);
    radio.checked = radio.value === viewMode;
  });

  const layoutOptions = settingsLayoutRow.querySelectorAll('.settings-layout-option');
  layoutOptions.forEach(opt => {
    const radio = opt.querySelector('input[type="radio"]');
    opt.classList.toggle('active', parseInt(radio.value, 10) === columnCount);
    radio.checked = parseInt(radio.value, 10) === columnCount;
  });

  const darkModeToggle = document.getElementById('settings-dark-mode-toggle');
  if (darkModeToggle) {
    darkModeToggle.checked = darkMode;
  }
}

async function loadSettingsVersion() {
  const updateHint = document.getElementById('settings-update-hint');
  try {
    const version = await window.api.getAppVersion();
    settingsVersionEl.textContent = 'v' + version;
  } catch (e) {
    settingsVersionEl.textContent = '-';
  }

  try {
    const result = await window.api.checkForUpdate();
    if (result.hasUpdate) {
      updateHint.classList.remove('hidden');
      updateHint.onclick = (e) => {
        e.preventDefault();
        window.api.openExternal('https://github.com/lanseqingling/lan-image/releases/latest');
      };
    } else {
      updateHint.classList.add('hidden');
    }
  } catch {
    updateHint.classList.add('hidden');
  }
}

settingsBackBtn.addEventListener('click', closeSettings);

settingsViewModeCards.addEventListener('click', (e) => {
  const card = e.target.closest('.settings-mode-card');
  if (!card) return;
  const radio = card.querySelector('input[type="radio"]');
  if (!radio) return;
  setViewMode(radio.value);
  syncSettingsUI();
});

settingsLayoutRow.addEventListener('click', (e) => {
  const opt = e.target.closest('.settings-layout-option');
  if (!opt) return;
  const radio = opt.querySelector('input[type="radio"]');
  if (!radio) return;
  const newColCount = parseInt(radio.value, 10);
  columnCount = newColCount;
  localStorage.setItem('lanimage-columns', String(newColCount));
  syncSettingsUI();
});

settingsGithubLink.addEventListener('click', () => {
  window.api.openExternal('https://github.com/lanseqingling/lan-image');
});

document.getElementById('settings-dark-mode-toggle').addEventListener('change', (e) => {
  applyDarkMode(e.target.checked);
});

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
  if (!settingsPage.classList.contains('hidden')) {
    syncSettingsUI();
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
