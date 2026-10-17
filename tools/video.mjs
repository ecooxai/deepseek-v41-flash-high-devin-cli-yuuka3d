// Turntable / showcase video renderer.
//
//   node tools/video.mjs [--w 900] [--h 1200] [--fps 30]
//
// Drives the camera through a scripted set of shots (360° turntable, face
// close-up, hero push-in) and writes PNG frames into `video/frames/`. The
// caption bar and the encode are done afterwards by `tools/video.sh`.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME_BIN || '/home/a/.local/archpkg/pacman/usr/bin/chromium';
const argv = process.argv.slice(2);
const flag = (n, d) => {
  const i = argv.indexOf('--' + n);
  return i >= 0 ? argv[i + 1] : d;
};

const W = Number(flag('w', 900));
const H = Number(flag('h', 1200));
const base = flag('url', 'http://127.0.0.1:8137/index.html');
const outDir = flag('out', 'video/frames');

/* ------------------------------------------------------------------ shots */
const TAU = Math.PI * 2;

/** 360° turntable, slightly above eye level. */
function turntable({ frames = 96, distance = 3.65, elevation = 0.055, targetY = 0.94 } = {}) {
  return Array.from({ length: frames }, (_, i) => ({
    azimuth: (i / frames) * TAU,
    elevation,
    distance,
    targetY,
  }));
}

/** Face close-up with a slow lateral drift. */
function faceShot({ frames = 40 } = {}) {
  return Array.from({ length: frames }, (_, i) => {
    const t = i / (frames - 1);
    return {
      azimuth: -0.30 + 0.42 * t,
      elevation: 0.03 - 0.03 * t,
      distance: 1.02 + 0.10 * Math.sin(Math.PI * t),
      targetY: 1.60,
    };
  });
}

/** Hero: three-quarter, pushing in then settling. */
function heroShot({ frames = 40 } = {}) {
  return Array.from({ length: frames }, (_, i) => {
    const t = i / (frames - 1);
    return {
      azimuth: -0.78 + 0.10 * t,
      elevation: 0.05,
      distance: 4.15 - 0.55 * t,
      targetY: 0.94,
    };
  });
}

/** Back-three-quarter, to show the hair mass and the halo from behind. */
function backShot({ frames = 32 } = {}) {
  return Array.from({ length: frames }, (_, i) => {
    const t = i / (frames - 1);
    return {
      azimuth: Math.PI - 0.55 + 0.30 * t,
      elevation: 0.08,
      distance: 3.60 - 0.30 * t,
      targetY: 0.94,
    };
  });
}

const SHOTS = [
  ...turntable({ frames: 110 }),
  ...faceShot({ frames: 44 }),
  ...backShot({ frames: 34 }),
  ...heroShot({ frames: 44 }),
];

/* ------------------------------------------------------------------ run */
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const DISPLAY = ':' + (70 + (process.pid % 8));
const xvfb = spawn('Xvfb', [DISPLAY, '-screen', '0', `${W + 200}x${H + 200}x24`, '-nolisten', 'tcp'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(700);

let browser;
try {
  browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: false,
    env: { ...process.env, DISPLAY },
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu-sandbox',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--ignore-gpu-blocklist',
      `--window-size=${W},${H}`,
    ],
    defaultViewport: { width: W, height: H },
    protocolTimeout: 180000,
  });

  const page = await browser.newPage();
  await page.goto(`${base}?hud=0&_=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction('window.__APP_READY__ === true', { timeout: 60000 });
  await sleep(900);

  // freeze the idle animation so the only motion in the video is the camera
  await page.evaluate(() => {
    const v = window.__VIEWER__;
    v.spin = false;
    v.userMoved = true;
    v._videoTime = 0;
    const origUpdate = v.update.bind(v);
    v.update = (dt) => {
      origUpdate(0);          // advance nothing
      v._applyCamera();
      if (v.usePost) v.composer.render();
      else v.renderer.render(v.scene, v.camera);
    };
  });

  let n = 0;
  for (const shot of SHOTS) {
    await page.evaluate((s) => {
      window.__VIEWER__.setView(s, true);
    }, shot);
    await sleep(70);
    const file = path.join(outDir, String(n).padStart(5, '0') + '.png');
    await page.screenshot({ path: file, type: 'png' });
    n++;
    if (n % 25 === 0) console.log(`[video] ${n}/${SHOTS.length} frames`);
  }
  console.log(`[video] wrote ${n} frames to ${outDir}`);
} catch (e) {
  console.error('[video] FAILED:', e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  xvfb.kill('SIGTERM');
}
