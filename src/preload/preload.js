const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  selectDirectories: () => ipcRenderer.invoke('select-directories'),
  getWorkspaces: () => ipcRenderer.invoke('get-workspaces'),
  saveWorkspaces: (workspaces) => ipcRenderer.invoke('save-workspaces', workspaces),
  getImagesInDirectory: (dirPath) => ipcRenderer.invoke('get-images-in-directory', dirPath),
  getImageDimensions: (filePath) => ipcRenderer.invoke('get-image-dimensions', filePath),
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  openFolderInExplorer: (dirPath) => ipcRenderer.invoke('open-folder-in-explorer', dirPath),
  showItemInFolder: (filePath) => ipcRenderer.invoke('show-item-in-folder', filePath),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  getFileInfo: (filePath) => ipcRenderer.invoke('get-file-info', filePath),
  getFolderInfo: (dirPath) => ipcRenderer.invoke('get-folder-info', dirPath),
  appReady: () => ipcRenderer.invoke('app-ready'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdate: () => ipcRenderer.invoke('check-for-update'),
  getDarkMode: () => ipcRenderer.invoke('get-dark-mode'),
  saveDarkMode: (enabled) => ipcRenderer.invoke('save-dark-mode', enabled),
  getStartupAnimationDisabled: () => ipcRenderer.invoke('get-startup-animation-disabled'),
  saveStartupAnimationDisabled: (disabled) => ipcRenderer.invoke('save-startup-animation-disabled', disabled),
  getComposerProjects: () => ipcRenderer.invoke('get-composer-projects'),
  saveComposerProjects: (projects) => ipcRenderer.invoke('save-composer-projects', projects),
  saveImageData: (options) => ipcRenderer.invoke('save-image-data', options),
  saveImageDataToFolder: (options) => ipcRenderer.invoke('save-image-data-to-folder', options)
});
