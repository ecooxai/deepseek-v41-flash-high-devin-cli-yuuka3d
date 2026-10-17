// Headless-friendly screenshot tool.
// Renders the app at a given view / size and writes a PNG.
//
//   node tools/shot.mjs <out.png> [--view front] [--w 900] [--h 1200] [--url http://...]
//
// Runs Chromium under Xvfb (auto) so WebGL is backed by the Mesa GPU/llvmpipe.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME =
  process.env.CHROME_BIN || '/home/a/.local/archpkg/pacman/usr/bin/chromium';

const argv = process.argv.slice(2);
const out = argv[0] || 'shot.png';
const flag = (name, def) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? argv[i + 1] : def;
};

const width = Number(flag('w', 900));
const height = Number(flag('h', 1200));
const view = flag('view', 'front');
const zoom = flag('zoom', '1');
const base = flag('url', 'http://127.0.0.1:8137/index.html');

const DISPLAY = ':' + (90 + (process.pid % 8));
const xvfb = spawn('Xvfb', [DISPLAY, '-screen', '0', `${width + 200}x${height + 200}x24`, '-nolisten', 'tcp'], {
  stdio: 'ignore',
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(700);

let browser;
try {
  browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: false,
    env: { ...process.env, DISPLAY, LIBGL_ALWAYS_SOFTWARE: '0' },
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu-sandbox',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      `--window-size=${width},${height}`,
    ],
    defaultViewport: { width, height },
    protocolTimeout: 120000,
  });

  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console: ' + m.text());
  });

  const url = `${base}${base.includes('?') ? '&' : '?'}view=${view}&zoom=${zoom}&shot=1&_=${Date.now()}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // wait for the app to signal it has rendered its first frames
  await page
    .waitForFunction('window.__APP_READY__ === true', { timeout: 45000 })
    .catch(() => console.error('[shot] warning: app never set __APP_READY__'));
  await sleep(500);

  await page.screenshot({ path: out, type: 'png' });

  const stats = await page.evaluate(() => window.__APP_STATS__ || null).catch(() => null);
  if (stats) console.log('[shot] stats:', JSON.stringify(stats));
  if (errors.length) console.error('[shot] errors:\n' + errors.slice(0, 20).join('\n'));
  console.log(`[shot] wrote ${out} (${width}x${height}, view=${view})`);
} catch (e) {
  console.error('[shot] FAILED:', e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  xvfb.kill('SIGTERM');
}
