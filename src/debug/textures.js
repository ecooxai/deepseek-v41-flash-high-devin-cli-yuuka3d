/** Dev-only page that dumps every procedural texture for visual inspection. */
import * as TX from '../textures.js';
import { PALETTE, BG } from '../config.js';

const items = [
  ['eyeL (left eye)', TX.eyeTexture(512, { lashSide: -1 })],
  ['eyeR (right eye)', TX.eyeTexture(512, { lashSide: 1 })],
  ['mouth', TX.mouthTexture()],
  ['blush', TX.blushTexture()],
  ['pajama pattern', TX.pajamaTexture([1, 1])],
  ['cloth (pillow)', TX.clothTexture(PALETTE.pillow, PALETTE.pillowShade)],
  ['cloth (slipper)', TX.clothTexture(PALETTE.slipper, PALETTE.slipperSole)],
  ['contact shadow', TX.contactShadowTexture()],
  ['halo glow', TX.haloGlowTexture()],
  ['background', TX.backgroundTexture()],
];

const root = document.getElementById('root');
root.style.cssText = 'font:12px system-ui;padding:16px;background:#eef5fd;min-height:100vh';
for (const [label, tex] of items) {
  const img = tex.image;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:inline-block;margin:10px;vertical-align:top';
  const h = document.createElement('div');
  h.textContent = label;
  h.style.cssText = 'font-weight:600;margin-bottom:6px';
  const holder = document.createElement('div');
  holder.style.cssText =
    'background:repeating-conic-gradient(#c9d4e2 0% 25%, #e9eff7 0% 50%) 50% / 16px 16px;border:1px solid #9fb0c6;display:inline-block';
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const scale = Math.min(1, 320 / Math.max(img.width, img.height));
  c.style.cssText = `width:${img.width * scale}px;height:${img.height * scale}px;display:block`;
  c.getContext('2d').drawImage(img, 0, 0);
  holder.appendChild(c);
  wrap.appendChild(h);
  wrap.appendChild(holder);
  root.appendChild(wrap);
}

document.title = 'texture dump';
window.__APP_READY__ = true;
