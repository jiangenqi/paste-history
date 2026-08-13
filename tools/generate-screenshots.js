// ============================================================
// PasteHistory README 展示图生成器
// 素材: assets/screenshots/raw/（本地截图，不进 git 仓库）
// 输出: assets/screenshots/hero.png + gallery.png
// 运行: npm run screenshots
// ============================================================
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'assets', 'screenshots');
const HTML_PATH = path.join(__dirname, 'screenshots.html');

async function capture(win, mode, width, height, outFile) {
  win.setSize(width, height);
  // loadFile 偶发 ERR_FAILED，失败后重试一次
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await win.loadFile(HTML_PATH, { query: { mode } });
      break;
    } catch (e) {
      if (attempt === 2) throw e;
      await new Promise(resolve => setTimeout(resolve, 400));
    }
  }
  await new Promise(resolve => setTimeout(resolve, 800)); // 等待图片加载完成

  let image = await win.webContents.capturePage();
  const size = image.getSize();

  // 高分屏缩放修正
  if (size.width !== width || size.height !== height) {
    image = image.resize({ width, height, quality: 'best' });
  }

  fs.writeFileSync(outFile, image.toPNG());
  console.log('✅', path.basename(outFile), `(${width}×${height}, ${fs.statSync(outFile).size} bytes)`);
}

app.whenReady().then(async () => {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const win = new BrowserWindow({
    width: 1200,
    height: 680,
    show: false,
    frame: false,
    webPreferences: { offscreen: true },
  });

  try {
    await capture(win, 'hero', 1200, 680, path.join(SCREENSHOTS_DIR, 'hero.png'));
    await capture(win, 'gallery', 1320, 640, path.join(SCREENSHOTS_DIR, 'gallery.png'));
  } finally {
    win.destroy();
  }
  app.quit();
});
