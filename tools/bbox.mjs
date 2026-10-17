// Dev helper: report the world-space bounding box of each named part.
//   node tools/bbox.mjs --view front
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_BIN || '/home/a/.local/archpkg/pacman/usr/bin/chromium';
const argv = process.argv.slice(2);
const flag = (n, d) => {
  const i = argv.indexOf('--' + n);
  return i >= 0 ? argv[i + 1] : d;
};
const view = flag('view', 'front');
const url = flag('url', 'http://127.0.0.1:8137/index.html');
const filter = flag('name', '');

const DISPLAY = ':' + (80 + (process.pid % 8));
const xvfb = spawn('Xvfb', [DISPLAY, '-screen', '0', '900x1200x24', '-nolisten', 'tcp'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(600);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  env: { ...process.env, DISPLAY },
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu-sandbox', '--hide-scrollbars'],
  defaultViewport: { width: 800, height: 1000 },
});
try {
  const page = await browser.newPage();
  await page.goto(`${url}?view=${view}&shot=1&_=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__APP_READY__ === true', { timeout: 40000 });
  await sleep(300);
  const res = await page.evaluate((filter) => {
    const T = window.__THREE__;
    const root = window.__VIEWER__.character;
    const out = [];
    root.traverse((o) => {
      if (!o.isMesh || o.userData.isOutline) return;
      if (filter && !(o.name || '').includes(filter) && !(o.parent?.name || '').includes(filter)) return;
      const b = new T.Box3().setFromObject(o);
      out.push({
        name: o.name || o.type,
        parent: o.parent?.name || '',
        min: [+b.min.x.toFixed(3), +b.min.y.toFixed(3), +b.min.z.toFixed(3)],
        max: [+b.max.x.toFixed(3), +b.max.y.toFixed(3), +b.max.z.toFixed(3)],
      });
    });
    return out;
  }, filter);
  for (const r of res) console.log(`${r.parent}/${r.name}`.padEnd(28), `x[${r.min[0]}, ${r.max[0]}]`.padEnd(18), `y[${r.min[1]}, ${r.max[1]}]`.padEnd(18), `z[${r.min[2]}, ${r.max[2]}]`);
} finally {
  await browser.close().catch(() => {});
  xvfb.kill('SIGTERM');
}
