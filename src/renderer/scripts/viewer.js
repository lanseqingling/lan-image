function openViewer(filePath) {
  viewerCurrentIndex = currentImages.findIndex(img => img.path === filePath);
  viewerScale = 1;
  viewerTranslateX = 0;
  viewerTranslateY = 0;
  viewerRotation = 0;
  viewerFitMode = 'fit';
  updateViewerTransform();
  updateViewerZoomLevel();
  updateViewerFitButton();
  updateViewerCounter();
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
  viewerRotation = 0;
  viewerCurrentIndex = -1;
  viewerFitMode = 'fit';
  updateViewerTransform();
  updateViewerZoomLevel();
  updateViewerFitButton();
  document.body.style.overflow = '';
}

function updateViewerTransform() {
  viewerImage.style.transform = `translate(${viewerTranslateX}px, ${viewerTranslateY}px) scale(${viewerScale}) rotate(${viewerRotation}deg)`;
}

function updateViewerZoomLevel() {
  const el = document.getElementById('v-zoom-level');
  if (el) el.textContent = Math.round(viewerScale * 100) + '%';
}

viewerClose.addEventListener('click', closeViewer);
viewerBackdrop.addEventListener('click', closeViewer);

document.getElementById('viewer-content').addEventListener('contextmenu', (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (viewerCurrentIndex < 0 || currentImages.length === 0) return;
  const ws = workspaces.find(w => w.path === activeWorkspacePath);
  const currentImg = currentImages[viewerCurrentIndex];
  if (currentImg) {
    showImageContextMenu(e.clientX, e.clientY, currentImg, ws);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!imageViewer.classList.contains('hidden')) {
      closeViewer();
    }
    const propDialog = document.getElementById('properties-dialog');
    if (propDialog && !propDialog.classList.contains('hidden')) {
      propDialog.classList.add('hidden');
    }
    const folderPropDialog = document.getElementById('folder-properties-dialog');
    if (folderPropDialog && !folderPropDialog.classList.contains('hidden')) {
      folderPropDialog.classList.add('hidden');
    }
  }
  if (!imageViewer.classList.contains('hidden')) {
    if (e.key === 'ArrowLeft') {
      viewerNavigate(-1);
    } else if (e.key === 'ArrowRight') {
      viewerNavigate(1);
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

  if (viewerScrollMode) {
    const direction = e.deltaY > 0 ? 1 : -1;
    viewerNavigate(direction);
    return;
  }

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
  updateViewerZoomLevel();
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

  if (hvScrollMode) {
    const direction = e.deltaY > 0 ? 1 : -1;
    hvNavigate(direction);
    return;
  }

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
  updateHvZoomLevel();
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
  updateHvZoomLevel();
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


function viewerNavigate(direction) {
  if (viewerCurrentIndex < 0 || currentImages.length === 0) return;
  let newIndex = viewerCurrentIndex + direction;
  if (newIndex < 0) newIndex = currentImages.length - 1;
  if (newIndex >= currentImages.length) newIndex = 0;
  viewerCurrentIndex = newIndex;
  viewerScale = 1;
  viewerTranslateX = 0;
  viewerTranslateY = 0;
  viewerRotation = 0;
  viewerFitMode = 'fit';
  updateViewerTransform();
  updateViewerZoomLevel();
  updateViewerFitButton();
  updateViewerCounter();
  viewerImage.src = toLocalImageUrl(currentImages[newIndex].path);
}

function updateViewerCounter() {
  const el = document.getElementById('v-counter');
  if (el && viewerCurrentIndex >= 0) {
    el.textContent = (viewerCurrentIndex + 1) + '/' + currentImages.length;
  }
}

function updateHvCounter() {
  const el = document.getElementById('hv-counter-bar');
  if (el) {
    el.textContent = (hvCurrentIndex + 1) + '/' + currentImages.length;
  }
}

function updateViewerFitButton() {
  const btn = document.getElementById('v-fit-toggle');
  if (!btn) return;
  if (viewerFitMode === 'fit') {
    btn.title = '原始大小';
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><text x="12" y="16" text-anchor="middle" font-size="9" fill="currentColor" stroke="none" font-weight="700" font-family="-apple-system, BlinkMacSystemFont, sans-serif">1:1</text></svg>';
  } else {
    btn.title = '适合窗口';
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
  }
}

function updateHvFitButton() {
  const btn = document.getElementById('hv-fit-toggle');
  if (!btn) return;
  if (hvFitMode === 'fit') {
    btn.title = '原始大小';
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><text x="12" y="16" text-anchor="middle" font-size="9" fill="currentColor" stroke="none" font-weight="700" font-family="-apple-system, BlinkMacSystemFont, sans-serif">1:1</text></svg>';
  } else {
    btn.title = '适合窗口';
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
  }
}

document.getElementById('v-prev').addEventListener('click', () => viewerNavigate(-1));
document.getElementById('v-next').addEventListener('click', () => viewerNavigate(1));

document.getElementById('v-zoom-in').addEventListener('click', () => {
  viewerScale = Math.min(10, viewerScale * 1.25);
  updateViewerTransform();
  updateViewerZoomLevel();
});

document.getElementById('v-zoom-out').addEventListener('click', () => {
  viewerScale = Math.max(0.25, viewerScale / 1.25);
  updateViewerTransform();
  updateViewerZoomLevel();
});

document.getElementById('v-fit-toggle').addEventListener('click', () => {
  if (viewerFitMode === 'fit') {
    viewerFitMode = 'actual';
    if (viewerImage.naturalWidth && viewerImage.clientWidth) {
      viewerScale = viewerImage.naturalWidth / viewerImage.clientWidth;
    } else {
      viewerScale = 1;
    }
    viewerTranslateX = 0;
    viewerTranslateY = 0;
  } else {
    viewerFitMode = 'fit';
    viewerScale = 1;
    viewerTranslateX = 0;
    viewerTranslateY = 0;
  }
  updateViewerTransform();
  updateViewerZoomLevel();
  updateViewerFitButton();
});

document.getElementById('v-scroll-mode').addEventListener('click', () => {
  viewerScrollMode = !viewerScrollMode;
  document.getElementById('v-scroll-mode').classList.toggle('active', viewerScrollMode);
});

document.getElementById('v-rotate').addEventListener('click', () => {
  viewerRotation = (viewerRotation + 90) % 360;
  updateViewerTransform();
});

document.getElementById('hv-toolbar-prev').addEventListener('click', () => hvNavigate(-1));
document.getElementById('hv-toolbar-next').addEventListener('click', () => hvNavigate(1));

document.getElementById('hv-zoom-in').addEventListener('click', () => {
  hvScale = Math.min(10, hvScale * 1.25);
  updateHvTransform();
  updateHvZoomLevel();
});

document.getElementById('hv-zoom-out').addEventListener('click', () => {
  hvScale = Math.max(0.25, hvScale / 1.25);
  updateHvTransform();
  updateHvZoomLevel();
});

document.getElementById('hv-fit-toggle').addEventListener('click', () => {
  if (hvFitMode === 'fit') {
    hvFitMode = 'actual';
    if (hvImage.naturalWidth && hvImage.clientWidth) {
      hvScale = hvImage.naturalWidth / hvImage.clientWidth;
    } else {
      hvScale = 1;
    }
    hvTranslateX = 0;
    hvTranslateY = 0;
  } else {
    hvFitMode = 'fit';
    hvScale = 1;
    hvTranslateX = 0;
    hvTranslateY = 0;
  }
  updateHvTransform();
  updateHvZoomLevel();
  updateHvFitButton();
});

document.getElementById('hv-scroll-mode').addEventListener('click', () => {
  hvScrollMode = !hvScrollMode;
  document.getElementById('hv-scroll-mode').classList.toggle('active', hvScrollMode);
});

document.getElementById('hv-rotate').addEventListener('click', () => {
  hvRotation = (hvRotation + 90) % 360;
  updateHvTransform();
});

document.getElementById('viewer-toolbar').addEventListener('mousedown', (e) => e.stopPropagation());
document.getElementById('viewer-toolbar').addEventListener('wheel', (e) => e.stopPropagation());
document.getElementById('hv-toolbar').addEventListener('mousedown', (e) => e.stopPropagation());
document.getElementById('hv-toolbar').addEventListener('wheel', (e) => e.stopPropagation());
