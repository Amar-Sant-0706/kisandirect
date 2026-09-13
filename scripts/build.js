const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const frontendDir = path.join(rootDir, 'frontend');
const distDir = path.join(frontendDir, 'dist');
const publicDir = path.join(frontendDir, 'public');
const srcDir = path.join(frontendDir, 'src');

console.log('[BUILD] Starting frontend production build for KisanDirect AI...');

// Helper to recursively copy directories
function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 1. Clean dist directory
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// 2. Copy index.html from public to dist
if (fs.existsSync(path.join(publicDir, 'index.html'))) {
  fs.copyFileSync(path.join(publicDir, 'index.html'), path.join(distDir, 'index.html'));
  console.log('[BUILD] Copied index.html to dist/index.html');
}

// 3. Copy src (styles, views, components, router) to dist/src
if (fs.existsSync(srcDir)) {
  copyDirSync(srcDir, path.join(distDir, 'src'));
  console.log('[BUILD] Copied src/ modules to dist/src/');
}

// 4. Also copy src directly to dist for alternate path resolutions (e.g. /styles/portals.css or /router.js)
copyDirSync(srcDir, distDir);

console.log('[BUILD] Frontend static build successfully created at: ' + distDir);
