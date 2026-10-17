// Dev helper: raycast through given pixels and report what is hit.
//   node tools/probe.mjs --view face --w 640 --h 640 --at 320,340 320,300
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_BIN || '/home/a/.local/archpkg/pacman/usr/bin/chromium';
const argv = process.argv.slice(2);
const flag = (n, d) => {
  const i = argv.indexOf('--' + n);
  return i >= 0 ? argv[i + 1] : d;
};
const width = Number(flag('w', 640));
const height = Number(flag('h', 640));
const view = flag('view', 'face');
const url = flag('url', 'http://127.0.0.1:8137/index.html');
const at = flag('at', `${width / 2},${height / 2}`)
  .split(' ')
  .map((s) => s.split(',').map(Number));

const DISPLAY = ':' + (80 + (process.pid % 8));
const xvfb = spawn('Xvfb', [DISPLAY, '-screen', '0', `${width + 100}x${height + 100}x24`, '-nolisten', 'tcp'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(600);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  env: { ...process.env, DISPLAY },
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu-sandbox', '--hide-scrollbars'],
  defaultViewport: { width, height },
});
try {
  const page = await browser.newPage();
  await page.goto(`${url}?view=${view}&shot=1&_=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__APP_READY__ === true', { timeout: 40000 });
  await sleep(400);
  const res = await page.evaluate((pts, w, h) => {
    const T = window.__THREE__;
    const v = window.__VIEWER__;
    const out = [];
    for (const [px, py] of pts) {
      const ndc = new T.Vector2((px / w) * 2 - 1, -(py / h) * 2 + 1);
      const rc = new T.Raycaster();
      rc.setFromCamera(ndc, v.camera);
      const hits = rc.intersectObjects(v.scene.children, true).filter((x) => x.object.visible);
      out.push({
        px,
        py,
        hits: hits.slice(0, 6).map((x) => ({
          name: x.object.name || x.object.type,
          parent: x.object.parent?.name || '',
          d: +x.distance.toFixed(3),
          mat: x.object.material?.type,
          color: x.object.material?.color ? '#' + x.object.material.color.getHexString() : '',
        })),
      });
    }
    return out;
  }, at, width, height);
  console.log(JSON.stringify(res, null, 1));
} finally {
  await browser.close().catch(() => {});
  xvfb.kill('SIGTERM');
}
