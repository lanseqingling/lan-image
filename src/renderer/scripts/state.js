let workspaces = [];
let activeWorkspacePath = null;
let currentImages = [];
let allImages = [];
let imageCache = {};

let viewMode = localStorage.getItem('lanimage-viewmode') || 'waterfall';
let darkMode = localStorage.getItem('lanimage-darkmode') === 'true';
let startupAnimationDisabled = localStorage.getItem('lanimage-disable-startup-animation') === 'true';

function applyDarkMode(enabled) {
  darkMode = enabled;
  localStorage.setItem('lanimage-darkmode', String(enabled));
  if (enabled) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  window.api.saveDarkMode(enabled);
}

async function applyStartupAnimationDisabled(disabled) {
  startupAnimationDisabled = disabled;
  localStorage.setItem('lanimage-disable-startup-animation', String(disabled));
  await window.api.saveStartupAnimationDisabled(disabled);
}

applyDarkMode(darkMode);
let hvCurrentIndex = 0;
let hvScale = 1;
let hvTranslateX = 0;
let hvTranslateY = 0;
let hvIsDragging = false;
let hvStartX = 0;
let hvStartY = 0;
let hvRotation = 0;
let hvFitMode = 'fit';
let hvScrollMode = false;

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
const settingsPage = document.getElementById('settings-page');
const settingsBackBtn = document.getElementById('settings-back-btn');
const settingsViewModeCards = document.getElementById('settings-view-mode');
const settingsLayoutRow = document.getElementById('settings-waterfall-cols');
const settingsGithubLink = document.getElementById('settings-github-link');
const settingsVersionEl = document.getElementById('settings-version');

let viewerScale = 1;
let viewerStartX = 0;
let viewerStartY = 0;
let viewerTranslateX = 0;
let viewerTranslateY = 0;
let viewerRotation = 0;
let viewerCurrentIndex = -1;
let viewerFitMode = 'fit';
let viewerScrollMode = false;
let isEditing = false;
let editSelectedPaths = new Set();
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
