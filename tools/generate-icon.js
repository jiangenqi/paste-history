// ============================================================
// PasteHistory 图标生成器
// Electron 渲染 SVG → 截图 → 导出 PNG/ICO
// 运行: npm run icon
// ============================================================
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 256,
    height: 256,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  await win.loadFile(path.join(__dirname, 'generate-icon.html'));
  await new Promise(resolve => setTimeout(resolve, 600));

  const image = await win.webContents.capturePage();
  const size = image.getSize();

  // 高分屏缩放修正
  let pngData;
  if (size.width !== 256 || size.height !== 256) {
    pngData = image.resize({ width: 256, height: 256, quality: 'best' }).toPNG();
  } else {
    pngData = image.toPNG();
  }

  fs.writeFileSync(path.join(ASSETS_DIR, 'icon.png'), pngData);
  console.log('✅ icon.png (' + pngData.length + ' bytes)');

  // ICO 格式
  const h = Buffer.alloc(6);
  h.writeUInt16LE(0, 0); h.writeUInt16LE(1, 2); h.writeUInt16LE(1, 4);
  const e = Buffer.alloc(16);
  e.writeUInt8(0, 0); e.writeUInt8(0, 1); e.writeUInt8(0, 2); e.writeUInt8(0, 3);
  e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
  e.writeUInt32LE(pngData.length, 8); e.writeUInt32LE(6 + 16, 12);
  const ico = Buffer.concat([h, e, pngData]);

  fs.writeFileSync(path.join(ASSETS_DIR, 'icon.ico'), ico);
  console.log('✅ icon.ico (' + ico.length + ' bytes)');

  app.quit();
});
