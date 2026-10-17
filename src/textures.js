/**
 * Procedural texture factory.
 * Every texture here is painted at runtime onto a 2D canvas — nothing is loaded
 * from disk or network, so the whole character is genuinely built from scratch.
 */
import * as THREE from 'three';
import { PALETTE, BG } from './config.js';

const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const rgba = (n, a) => {
  const c = new THREE.Color(n);
  return `rgba(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0},${a})`;
};

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { c, ctx };
}

function toTexture(c, { repeat = [1, 1], srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Draw `fn` tiled at 3x3 offsets so the result is seamless. */
function seamless(ctx, w, h, fn) {
  for (let oy = -1; oy <= 1; oy++)
    for (let ox = -1; ox <= 1; ox++) {
      ctx.save();
      ctx.translate(ox * w, oy * h);
      fn(ctx);
      ctx.restore();
    }
}

/* ------------------------------------------------------------------ toon */

/**
 * Cel-shading ramp.
 * @param steps  number of discrete bands
 * @param softness bias toward the bright end
 * @param floor  minimum value — keeps downward-facing surfaces from going black
 */
export function toonGradient(steps = 4, softness = 0.06, floor = 0) {
  const data = new Uint8Array(steps);
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const v = Math.min(1, (t + softness) / (1 + softness));
    data[i] = Math.round(255 * (floor + (1 - floor) * v));
  }
  const tex = new THREE.DataTexture(data, steps, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/* ------------------------------------------------------------ background */

/** Studio backdrop: soft vertical sky plus a gentle glow behind the subject. */
export function backgroundTexture(w = 512, h = 512) {
  const { c, ctx } = canvas(w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, hex(BG.top));
  g.addColorStop(0.46, hex(BG.mid));
  g.addColorStop(1, hex(BG.bottom));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, h * 0.62);
  glow.addColorStop(0, 'rgba(255,255,255,0.55)');
  glow.addColorStop(0.45, 'rgba(255,255,255,0.18)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Soft elliptical pool of light on the floor. */
export function floorTexture(size = 512) {
  const { c, ctx } = canvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Soft radial falloff used for the ground contact shadow. */
export function contactShadowTexture(size = 512) {
  const { c, ctx } = canvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.0, 'rgba(58,64,110,0.50)');
  g.addColorStop(0.35, 'rgba(58,64,110,0.30)');
  g.addColorStop(0.68, 'rgba(58,64,110,0.09)');
  g.addColorStop(1.0, 'rgba(58,64,110,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* --------------------------------------------------------------- pajamas */

function catDoodle(ctx, x, y, s, color, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.6;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // head: filled, so the motif still reads when the fabric is small on screen
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fill();
  ctx.stroke();

  // ears
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx * 8, -17);
    ctx.lineTo(sx * 19, -30);
    ctx.lineTo(sx * 21, -12);
    ctx.stroke();
  }

  // eyes
  ctx.fillStyle = 'rgba(96,120,160,0.85)';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sx * 8, -3, 2.6, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // nose + mouth
  ctx.beginPath();
  ctx.moveTo(-3, 5);
  ctx.lineTo(0, 7.5);
  ctx.lineTo(3, 5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 7.5);
  ctx.lineTo(0, 11);
  ctx.stroke();

  // whiskers
  ctx.lineWidth = 2.2;
  for (const sx of [-1, 1]) {
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(sx * 15, 2 + i * 4);
      ctx.lineTo(sx * 29, -1 + i * 7);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function heart(ctx, x, y, s, color, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 7);
  ctx.bezierCurveTo(-11, -3, -7, -14, 0, -7);
  ctx.bezierCurveTo(7, -14, 11, -3, 0, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Pale-blue pyjama cloth printed with white cat doodles and pink hearts. */
export function pajamaTexture(repeat = [3, 3]) {
  const S = 512;
  const { c, ctx } = canvas(S, S);

  ctx.fillStyle = hex(PALETTE.pajama);
  ctx.fillRect(0, 0, S, S);

  // A whisper of weave so the cloth is not perfectly flat — the reference has
  // no visible stripes, so this must stay far below the motif contrast.
  ctx.globalAlpha = 0.055;
  for (let x = 0; x < S; x += 6) {
    ctx.fillStyle = x % 12 === 0 ? '#ffffff' : hex(PALETTE.pajamaShade);
    ctx.fillRect(x, 0, 3, S);
  }
  ctx.globalAlpha = 1;

  // motifs (seamless)
  const spots = [
    [86, 92, 1.0, 'cat'],
    [300, 60, 0.78, 'heart'],
    [430, 168, 1.05, 'cat'],
    [186, 236, 0.72, 'heart'],
    [72, 330, 0.9, 'cat'],
    [286, 300, 1.0, 'heart'],
    [430, 402, 0.8, 'cat'],
    [176, 452, 0.95, 'heart'],
    [352, 470, 0.7, 'cat'],
    [18, 200, 0.62, 'heart'],
    [250, 168, 0.5, 'dot'],
    [396, 300, 0.45, 'dot'],
    [128, 158, 0.4, 'dot'],
    [232, 396, 0.5, 'dot'],
  ];

  seamless(ctx, S, S, (g) => {
    for (const [x, y, s, kind] of spots) {
      if (kind === 'cat') catDoodle(g, x, y, s * 1.62, 'rgba(255,255,255,0.96)', 0.95);
      else if (kind === 'heart') heart(g, x, y, s * 2.3, hex(PALETTE.heart), 0.92);
      else {
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.beginPath();
        g.arc(x, y, 4.5 * s * 2, 0, Math.PI * 2);
        g.fill();
      }
    }
  });

  return toTexture(c, { repeat });
}

/* ------------------------------------------------------------------ face */

/**
 * One anime eye, drawn RGBA on a transparent field.
 * Mapped onto a spherical patch so it hugs the head.
 */
export function eyeTexture(size = 512, { lashSide = 1 } = {}) {
  const W = size;
  const H = Math.round(size * 0.78);
  const { c, ctx } = canvas(W, H);

  const cx = W * 0.5;
  const cy = H * 0.52;
  const rx = W * 0.40;
  const ry = H * 0.40;

  // --- eye socket / sclera -------------------------------------------
  // Upper lid is a fairly flat arch (relaxed, slightly sleepy look).
  const lid = (t) => ({
    x: cx + (t * 2 - 1) * rx,
    y: cy - ry * (0.46 + 0.42 * Math.sin(Math.PI * t) ** 0.55),
  });
  const low = (t) => ({
    x: cx + (t * 2 - 1) * rx * 0.93,
    y: cy + ry * (0.72 - 0.36 * Math.sin(Math.PI * t) ** 0.7),
  });

  ctx.beginPath();
  const N = 48;
  for (let i = 0; i <= N; i++) {
    const p = lid(i / N);
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
  }
  for (let i = N; i >= 0; i--) {
    const p = low(i / N);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.save();
  ctx.clip();

  // sclera
  const sg = ctx.createLinearGradient(0, cy - ry, 0, cy + ry);
  sg.addColorStop(0, '#e9e6f6');
  sg.addColorStop(0.45, '#fdfdff');
  sg.addColorStop(1, '#f2eef9');
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, W, H);

  // --- iris ------------------------------------------------------------
  const ix = cx;
  const iy = cy - ry * 0.02;
  const irx = rx * 0.68;
  const iry = ry * 0.88;

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(ix, iy, irx, iry, 0, 0, Math.PI * 2);
  ctx.clip();

  const ig = ctx.createLinearGradient(0, iy - iry, 0, iy + iry);
  ig.addColorStop(0.0, '#3a3272');
  ig.addColorStop(0.30, '#5c53ae');
  ig.addColorStop(0.62, hex(PALETTE.eyeIris));
  ig.addColorStop(1.0, '#c3baf5');
  ctx.fillStyle = ig;
  ctx.fillRect(ix - irx, iy - iry, irx * 2, iry * 2);

  // radial spokes for that hand-drawn iris feel
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = '#1c1740';
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    ctx.lineWidth = 1.6 + (i % 3);
    ctx.beginPath();
    ctx.moveTo(ix + Math.cos(a) * irx * 0.30, iy + Math.sin(a) * iry * 0.30);
    ctx.lineTo(ix + Math.cos(a) * irx * 1.02, iy + Math.sin(a) * iry * 1.02);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // pupil
  ctx.fillStyle = 'rgba(22,16,46,0.92)';
  ctx.beginPath();
  ctx.ellipse(ix, iy + iry * 0.08, irx * 0.26, iry * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();

  // bottom bounce light
  const bg = ctx.createLinearGradient(0, iy + iry * 0.10, 0, iy + iry);
  bg.addColorStop(0, 'rgba(206,197,255,0)');
  bg.addColorStop(1, 'rgba(224,218,255,0.95)');
  ctx.fillStyle = bg;
  ctx.fillRect(ix - irx, iy, irx * 2, iry);

  // dark rim
  ctx.strokeStyle = 'rgba(30,23,64,0.85)';
  ctx.lineWidth = W * 0.020;
  ctx.beginPath();
  ctx.ellipse(ix, iy, irx, iry, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();

  // --- highlights ------------------------------------------------------
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(ix - irx * 0.42, iy - iry * 0.44, irx * 0.34, iry * 0.26, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.97)';
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.ellipse(ix + irx * 0.40, iy + iry * 0.42, irx * 0.16, iry * 0.13, -0.4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fill();

  // soft inner shadow under the lid
  const sh = ctx.createLinearGradient(0, cy - ry, 0, cy - ry * 0.15);
  sh.addColorStop(0, 'rgba(58,47,99,0.40)');
  sh.addColorStop(1, 'rgba(58,47,99,0)');
  ctx.fillStyle = sh;
  ctx.fillRect(0, 0, W, H);

  // soften both corners so the sclera never reads as a hard white wedge
  for (const sx of [-1, 1]) {
    const cg = ctx.createRadialGradient(cx + sx * rx * 0.92, cy + ry * 0.10, 0, cx + sx * rx * 0.92, cy + ry * 0.10, rx * 0.55);
    cg.addColorStop(0, 'rgba(96,80,140,0.55)');
    cg.addColorStop(0.6, 'rgba(120,105,165,0.24)');
    cg.addColorStop(1, 'rgba(120,105,165,0)');
    ctx.fillStyle = cg;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.restore(); // unclip

  // --- upper lash line (thick, sleepy) ---------------------------------
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = hex(PALETTE.lash);
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const p = lid(i / N);
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
  }
  ctx.lineWidth = W * 0.036;
  ctx.stroke();
  // crisp inner edge
  ctx.lineWidth = W * 0.016;
  ctx.strokeStyle = '#2b2354';
  ctx.stroke();
  ctx.restore();

  // outer-corner lashes
  ctx.save();
  ctx.strokeStyle = hex(PALETTE.lash);
  ctx.lineWidth = W * 0.012;
  ctx.lineCap = 'round';
  for (let i = 0; i < 2; i++) {
    const t = lashSide > 0 ? 0.9 + i * 0.038 : 0.1 - i * 0.038;
    const p = lid(Math.min(1, Math.max(0, t)));
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + lashSide * W * (0.024 + i * 0.010), p.y - H * (0.038 + i * 0.014));
    ctx.stroke();
  }
  ctx.restore();

  // --- lower lash line (thin) -----------------------------------------
  ctx.save();
  ctx.strokeStyle = 'rgba(74,60,120,0.72)';
  ctx.lineWidth = W * 0.016;
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const p = low(i / N);
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.restore();

  return toTexture(c, { repeat: [1, 1] });
}

/** Eyelid crease + brow, drawn as a separate decal above each eye. */
export function browTexture(size = 256, { flip = false } = {}) {
  const W = size;
  const H = size;
  const { c, ctx } = canvas(W, H);
  ctx.save();
  if (flip) {
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
  }
  ctx.strokeStyle = 'rgba(58,46,102,0.62)';
  ctx.lineCap = 'round';
  ctx.lineWidth = W * 0.038;
  ctx.beginPath();
  ctx.moveTo(W * 0.10, H * 0.66);
  ctx.quadraticCurveTo(W * 0.52, H * 0.20, W * 0.94, H * 0.44);
  ctx.stroke();
  ctx.restore();
  return toTexture(c);
}

export function mouthTexture(size = 256) {
  const W = size;
  const H = size;
  const { c, ctx } = canvas(W, H);
  ctx.strokeStyle = 'rgba(163,74,84,0.95)';
  ctx.lineCap = 'round';
  ctx.lineWidth = W * 0.070;
  ctx.beginPath();
  ctx.moveTo(W * 0.32, H * 0.42);
  ctx.quadraticCurveTo(W * 0.5, H * 0.62, W * 0.68, H * 0.42);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(176,96,102,0.45)';
  ctx.lineWidth = W * 0.03;
  ctx.beginPath();
  ctx.moveTo(W * 0.36, H * 0.40);
  ctx.quadraticCurveTo(W * 0.5, H * 0.54, W * 0.64, H * 0.40);
  ctx.stroke();
  return toTexture(c);
}

export function blushTexture(size = 256) {
  const W = size;
  const { c, ctx } = canvas(W, size);
  const g = ctx.createRadialGradient(W / 2, size / 2, 0, W / 2, size / 2, W / 2);
  g.addColorStop(0.0, rgba(PALETTE.blush, 0.72));
  g.addColorStop(0.45, rgba(PALETTE.blush, 0.40));
  g.addColorStop(1.0, rgba(PALETTE.blush, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* --------------------------------------------------------------- accents */

export function haloGlowTexture(size = 256) {
  const { c, ctx } = canvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.18, size / 2, size / 2, size / 2);
  g.addColorStop(0, rgba(PALETTE.haloGlow, 0.0));
  g.addColorStop(0.62, rgba(PALETTE.haloGlow, 0.30));
  g.addColorStop(0.82, rgba(PALETTE.haloGlow, 0.55));
  g.addColorStop(1, rgba(PALETTE.haloGlow, 0.0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Soft vertical sheen used on the pillow and slippers. */
export function clothTexture(base, shade, size = 256) {
  const { c, ctx } = canvas(size, size);
  ctx.fillStyle = hex(base);
  ctx.fillRect(0, 0, size, size);
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, rgba(shade, 0.35));
  g.addColorStop(0.5, rgba(0xffffff, 0.0));
  g.addColorStop(1, rgba(shade, 0.3));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // faint weave
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = hex(shade);
  ctx.lineWidth = 1;
  for (let i = 0; i < size; i += 6) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return toTexture(c, { repeat: [2, 2] });
}
