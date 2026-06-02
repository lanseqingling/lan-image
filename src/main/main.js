const { app, BrowserWindow, ipcMain, dialog, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');

const configPath = path.join(app.getPath('userData'), 'config.json');
const composerProjectsPath = path.join(app.getPath('userData'), 'composer-projects.json');

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {}
  return { workspaces: [] };
}

function isDarkMode() {
  try {
    const config = loadConfig();
    return config.darkMode === true;
  } catch {
    return false;
  }
}

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

function loadComposerProjects() {
  try {
    if (fs.existsSync(composerProjectsPath)) {
      const data = fs.readFileSync(composerProjectsPath, 'utf-8');
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (err) {}
  return [];
}

function saveComposerProjects(projects) {
  fs.writeFileSync(composerProjectsPath, JSON.stringify(projects, null, 2), 'utf-8');
}

let mainWindow;
let splashWindow;
let splashShowTime = 0;
const MIN_SPLASH_MS = 800;

app.whenReady().then(() => {
  createSplash();
  createWindow();
});

function createSplash() {
  const bgColor = isDarkMode() ? '#1e1e1e' : '#ffffff';
  splashWindow = new BrowserWindow({
    width: 1260,
    height: 810,
    frame: false,
    resizable: false,
    center: true,
    backgroundColor: bgColor,
    show: false
  });

  splashWindow.loadFile(path.join(__dirname, '../renderer/splash.html'));
  splashWindow.once('ready-to-show', () => {
    splashShowTime = Date.now();
    splashWindow.show();
  });
}

function createWindow() {
  const bgColor = isDarkMode() ? '#1e1e1e' : '#ffffff';
  mainWindow = new BrowserWindow({
    width: 1260,
    height: 810,
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
    backgroundColor: bgColor,
    autoHideMenuBar: true,
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

async function closeSplashAndShowMain() {
  const elapsed = Date.now() - splashShowTime;
  const remaining = MIN_SPLASH_MS - elapsed;
  if (remaining > 0) {
    await new Promise(r => setTimeout(r, remaining));
  }
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
  if (mainWindow) {
    mainWindow.show();
  }
}

ipcMain.handle('app-ready', () => {
  closeSplashAndShowMain();
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

ipcMain.handle('check-for-update', () => {
  return new Promise((resolve) => {
    const req = https.get({
      hostname: 'api.github.com',
      path: '/repos/lanseqingling/lan-image/releases/latest',
      headers: { 'User-Agent': 'lan-image-update-checker' },
      timeout: 8000
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const release = JSON.parse(data);
          if (release.tag_name) {
            const latest = release.tag_name.replace(/^v/, '');
            const current = app.getVersion();
            resolve({
              hasUpdate: compareVersions(latest, current) > 0,
              latestVersion: latest,
              currentVersion: current,
              releaseUrl: release.html_url
            });
          } else {
            resolve({ hasUpdate: false });
          }
        } catch {
          resolve({ hasUpdate: false });
        }
      });
    });
    req.on('error', () => resolve({ hasUpdate: false }));
    req.on('timeout', () => { req.destroy(); resolve({ hasUpdate: false }); });
  });
});

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

ipcMain.handle('get-dark-mode', () => {
  return isDarkMode();
});

ipcMain.handle('save-dark-mode', (event, enabled) => {
  const config = loadConfig();
  config.darkMode = enabled;
  saveConfig(config);
  return true;
});

ipcMain.handle('get-composer-projects', () => {
  return loadComposerProjects();
});

ipcMain.handle('save-composer-projects', (event, projects) => {
  saveComposerProjects(Array.isArray(projects) ? projects : []);
  return true;
});

ipcMain.handle('save-image-data', async (event, options) => {
  const format = options && options.format === 'jpeg' ? 'jpeg' : 'png';
  const defaultName = (options && options.defaultName) || `LanImage-${Date.now()}.${format === 'jpeg' ? 'jpg' : 'png'}`;
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: [
      format === 'jpeg'
        ? { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] }
        : { name: 'PNG Image', extensions: ['png'] }
    ]
  });
  if (result.canceled || !result.filePath) return { canceled: true };

  try {
    const dataUrl = options && options.dataUrl;
    const match = /^data:image\/(?:png|jpeg);base64,(.+)$/.exec(dataUrl || '');
    if (!match) return { canceled: false, success: false, error: 'Invalid image data' };
    fs.writeFileSync(result.filePath, Buffer.from(match[1], 'base64'));
    return { canceled: false, success: true, filePath: result.filePath };
  } catch (err) {
    return { canceled: false, success: false, error: err.message };
  }
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

ipcMain.handle('get-folder-info', (event, dirPath) => {
  try {
    const stat = fs.statSync(dirPath);
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const imageFiles = entries.filter(entry => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()));
    let totalSize = 0;
    for (const entry of imageFiles) {
      try {
        totalSize += fs.statSync(path.join(dirPath, entry.name)).size;
      } catch (e) {}
    }
    return {
      size: totalSize,
      imageCount: imageFiles.length,
      mtime: stat.mtimeMs,
      birthtime: stat.birthtimeMs
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
