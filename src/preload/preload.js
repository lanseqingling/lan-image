const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getWorkspaces: () => ipcRenderer.invoke('get-workspaces'),
  saveWorkspaces: (workspaces) => ipcRenderer.invoke('save-workspaces', workspaces),
  getImagesInDirectory: (dirPath) => ipcRenderer.invoke('get-images-in-directory', dirPath),
  getImageDimensions: (filePath) => ipcRenderer.invoke('get-image-dimensions', filePath),
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  openFolderInExplorer: (dirPath) => ipcRenderer.invoke('open-folder-in-explorer', dirPath),
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});
