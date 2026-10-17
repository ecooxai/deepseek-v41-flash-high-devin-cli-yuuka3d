/**
 * Showcase generator.
 *
 * Renders the character from every preset at presentation resolution, then
 * brands each frame with a black credit bar naming the model and the agent
 * tool that produced it. Output lands in ./showcase/.
 *
 *   node tools/showcase.mjs
 */
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_BIN || '/home/a/.local/archpkg/pacman/usr/bin/chromium';
const OUT = 'showcase';
const CREDIT = 'DeepSeek V4.1 Flash High';
const CREDIT_SUB = 'Devin CLI · three.js · procedural, no external assets';
const W = 1000;
const H = 1500;

fs.mkdirSync(OUT, { recursive: true });

const DISPLAY = ':71';
const xvfb = spawn('Xvfb', [DISPLAY, '-screen', '0', `${W + 200}x${H + 200}x24`, '-nolisten', 'tcp'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(700);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  env: { ...process.env, DISPLAY },
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu-sandbox', '--hide-scrollbars'],
  defaultViewport: { width: W, height: H },
  protocolTimeout: 180000,
});

const VIEWS = [
  ['front', 'front'],
  ['threequarter', 'threeq'],
  ['side', 'side'],
  ['back', 'back'],
  ['face', 'face'],
];

try {
  const page = await browser.newPage();
  for (const [name, view] of VIEWS) {
    const w = view === 'face' ? 1100 : W;
    const h = view === 'face' ? 1100 : H;
    await page.setViewport({ width: w, height: h });
    await page.goto(`http://127.0.0.1:8137/index.html?view=${view}&shot=1&_=${Date.now()}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction('window.__APP_READY__ === true', { timeout: 60000 });
    await sleep(600);
    const raw = path.join(OUT, `_raw_${name}.png`);
    await page.screenshot({ path: raw, type: 'png' });
    console.log(`[showcase] rendered ${name}`);
  }
} finally {
  await browser.close().catch(() => {});
  xvfb.kill('SIGTERM');
}

/* ------------------------------------------------------------ branding -- */

const FONT = 'DejaVu-Sans-Bold';

function brand(src, dst, { sub = CREDIT_SUB, bar = 150 } = {}) {
  const info = execFileSync('identify', ['-format', '%w %h', src]).toString().split(' ').map(Number);
  const [w, h] = info;
  const outH = h + bar;
  execFileSync('magick', [
    src,
    '-background', '#0b0b12',
    '-gravity', 'north',
    '-extent', `${w}x${outH}`,
    '-fill', '#ffffff',
    '-font', FONT,
    '-pointsize', Math.round(w * 0.052),
    '-annotate', `+0+${h + Math.round(bar * 0.20)}`, CREDIT,
    '-fill', '#b9b9c9',
    '-pointsize', Math.round(w * 0.020),
    '-annotate', `+0+${h + Math.round(bar * 0.62)}`, sub,
    dst,
  ]);
}

for (const [name] of VIEWS) {
  brand(path.join(OUT, `_raw_${name}.png`), path.join(OUT, `${name}.png`));
}

/* hero: 3/4 view, wider crop */
execFileSync('magick', [
  path.join(OUT, '_raw_threequarter.png'),
  '-resize', '1200x',
  path.join(OUT, '_hero_tmp.png'),
]);
brand(path.join(OUT, '_hero_tmp.png'), path.join(OUT, 'hero.png'), { bar: 170 });

/* contact sheet with the reference alongside */
execFileSync('magick', [
  'montage',
  path.join(OUT, 'front.png'),
  path.join(OUT, 'threequarter.png'),
  path.join(OUT, 'side.png'),
  path.join(OUT, 'back.png'),
  '-tile', '4x1',
  '-geometry', '+8+8',
  '-background', '#0b0b12',
  path.join(OUT, 'turnaround.png'),
]);

/* reference vs render */
execFileSync('magick', ['docs/reference/yuukapa.png', '-resize', `x${H}`, path.join(OUT, '_ref.png')]);
execFileSync('magick', [
  path.join(OUT, '_ref.png'),
  path.join(OUT, 'front.png'),
  '+append',
  '-background', '#0b0b12',
  path.join(OUT, 'reference-vs-render.png'),
]);

for (const f of fs.readdirSync(OUT)) if (f.startsWith('_')) fs.unlinkSync(path.join(OUT, f));

console.log('[showcase] done ->', OUT);
