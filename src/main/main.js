const { app, BrowserWindow, ipcMain, dialog, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const configPath = path.join(app.getPath('userData'), 'config.json');

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {}
  return { workspaces: [] };
}

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

let mainWindow;

app.whenReady().then(() => {
  createWindow();
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, '../../assets/icons/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    },
    frame: false,
    backgroundColor: '#ffffff',
    autoHideMenuBar: true
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

const IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff', '.tif', '.avif'
]);

function getImageFiles(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const images = entries
      .filter(entry => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .map(entry => {
        const fullPath = path.join(dirPath, entry.name);
        let mtime = 0;
        try { mtime = fs.statSync(fullPath).mtimeMs; } catch (e) {}
        return {
          name: entry.name,
          path: fullPath,
          ext: path.extname(entry.name).toLowerCase(),
          mtime
        };
      });
    return images;
  } catch (err) {
    return [];
  }
}

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('select-directories', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'multiSelections']
  });
  if (result.canceled) return null;
  return result.filePaths;
});

ipcMain.handle('window-minimize', () => { mainWindow.minimize(); });
ipcMain.handle('window-maximize', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});
ipcMain.handle('window-close', () => { mainWindow.close(); });

ipcMain.handle('open-folder-in-explorer', (event, dirPath) => {
  shell.openPath(dirPath);
});

ipcMain.handle('show-item-in-folder', (event, filePath) => {
  shell.showItemInFolder(filePath);
});

ipcMain.handle('open-external', (event, url) => {
  shell.openExternal(url);
});

ipcMain.handle('get-workspaces', () => {
  const config = loadConfig();
  return config.workspaces || [];
});

ipcMain.handle('save-workspaces', (event, workspaces) => {
  const config = loadConfig();
  config.workspaces = workspaces;
  saveConfig(config);
  return true;
});

ipcMain.handle('get-images-in-directory', (event, dirPath) => {
  return getImageFiles(dirPath);
});

ipcMain.handle('get-file-info', (event, filePath) => {
  try {
    const stat = fs.statSync(filePath);
    return {
      size: stat.size,
      mtime: stat.mtimeMs,
      birthtime: stat.birthtimeMs,
      isFile: stat.isFile(),
      isDirectory: stat.isDirectory()
    };
  } catch (err) {
    return null;
  }
});

ipcMain.handle('get-image-dimensions', (event, filePath) => {
  try {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.svg') {
      return { width: 300, height: 200 };
    }

    const stat = fs.statSync(filePath);
    const readSize = Math.min(stat.size, 131072);
    const buf = Buffer.alloc(readSize);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buf, 0, readSize, 0);
    fs.closeSync(fd);

    if (ext === '.png' && buf.length > 24) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }

    if ((ext === '.jpg' || ext === '.jpeg') && buf.length > 4) {
      let offset = 2;
      while (offset < buf.length - 9) {
        if (buf[offset] !== 0xFF) break;
        const marker = buf[offset + 1];
        if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
          return { width: buf.readUInt16BE(offset + 7), height: buf.readUInt16BE(offset + 5) };
        }
        if (marker === 0xD9 || marker === 0xDA) break;
        if (marker === 0x00 || marker === 0xFF) { offset++; continue; }
        offset += 2 + buf.readUInt16BE(offset + 2);
      }
    }

    if (ext === '.gif' && buf.length > 10) {
      return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
    }

    if (ext === '.bmp' && buf.length > 26) {
      return { width: buf.readUInt32LE(18), height: Math.abs(buf.readInt32LE(22)) };
    }

    if (ext === '.webp' && buf.length > 20) {
      if (buf.toString('ascii', 8, 12) === 'VP8 ' && buf.length > 18) {
        return { width: buf.readUInt16LE(14) & 0x3FFF, height: buf.readUInt16LE(16) & 0x3FFF };
      }
      if (buf.toString('ascii', 8, 12) === 'VP8L' && buf.length > 20) {
        const bits = buf.readUInt32LE(16);
        return { width: (bits & 0x3FFF) + 1, height: ((bits >> 14) & 0x3FFF) + 1 };
      }
      if (buf.toString('ascii', 8, 12) === 'VP8X' && buf.length > 24) {
        const w = ((buf[17] << 16) | (buf[16] << 8) | buf[15]) + 1;
        const h = ((buf[20] << 16) | (buf[19] << 8) | buf[18]) + 1;
        if (w > 0 && h > 0) return { width: w, height: h };
      }
    }

    const data = fs.readFileSync(filePath);
    const mimeMap = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.gif': 'image/gif', '.bmp': 'image/bmp', '.webp': 'image/webp',
      '.avif': 'image/avif', '.tiff': 'image/tiff', '.tif': 'image/tiff'
    };
    const mime = mimeMap[ext] || 'image/png';
    const image = nativeImage.createFromDataURL(`data:${mime};base64,${data.toString('base64')}`);
    const size = image.getSize();
    if (size.width > 0 && size.height > 0) {
      return { width: size.width, height: size.height };
    }
    return { width: 300, height: 200 };
  } catch (err) {
    return { width: 300, height: 200 };
  }
});
