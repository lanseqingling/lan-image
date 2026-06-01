async function loadImages(dirPath) {
  activeWorkspacePath = dirPath;
  renderWorkspaces();

  emptyState.classList.add('hidden');
  emptyState.innerHTML = '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><p>点击左侧 <strong>+</strong> 按钮添加图片文件夹</p>';

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
    emptyState.innerHTML = '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><p>该文件夹下没有图片文件</p>';
    return;
  }

  if (currentImages.length === 0 && allImages.length > 0) {
    waterfallContainer.style.display = 'none';
    horizontalViewer.classList.add('hidden');
    gridContainer.classList.add('hidden');
    emptyState.classList.remove('hidden');
    emptyState.innerHTML = '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg><p>所有图片已隐藏</p>';
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
  imgEl.style.background = 'var(--img-placeholder-bg)';
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
  if (!settingsPage.classList.contains('hidden')) {
    syncSettingsUI();
  }
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
  hvRotation = 0;
  hvFitMode = 'fit';
  updateHvTransform();
  updateHvZoomLevel();
  updateHvFitButton();
  updateHvCounter();

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
  hvImage.style.transform = `translate(${hvTranslateX}px, ${hvTranslateY}px) scale(${hvScale}) rotate(${hvRotation}deg)`;
  hvImage.style.cursor = hvScale > 1 ? (hvIsDragging ? 'grabbing' : 'grab') : '';
}

function updateHvZoomLevel() {
  const el = document.getElementById('hv-zoom-level');
  if (el) el.textContent = Math.round(hvScale * 100) + '%';
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
