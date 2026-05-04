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
  appReady: () => ipcRenderer.invoke('app-ready')
});
