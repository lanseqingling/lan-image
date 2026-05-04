const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.default = async function (context) {
  if (context.electronPlatformName !== 'win32') return;

  const exePath = path.join(context.appOutDir, 'LanImage.exe');
  const projectRoot = path.resolve(__dirname, '..', '..');
  const iconPath = path.join(projectRoot, 'assets', 'icons', 'icon.ico');

  const cacheDir = path.join(
    process.env.LOCALAPPDATA || '',
    'electron-builder',
    'Cache',
    'winCodeSign'
  );
  let rceditPath = null;

  if (fs.existsSync(cacheDir)) {
    const entries = fs.readdirSync(cacheDir);
    for (const entry of entries) {
      const candidate = path.join(cacheDir, entry, 'rcedit-x64.exe');
      if (fs.existsSync(candidate)) {
        rceditPath = candidate;
        break;
      }
    }
  }

  if (!rceditPath) {
    console.warn('rcedit-x64.exe not found in winCodeSign cache, skipping icon setting');
    return;
  }

  console.log(`Setting icon on ${exePath}`);
  execSync(`"${rceditPath}" "${exePath}" --set-icon "${iconPath}"`, {
    stdio: 'inherit',
  });
};
