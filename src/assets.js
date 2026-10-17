/**
 * Shared, lazily-created texture + material registry.
 * Built once at startup; every part pulls from here.
 */
import * as THREE from 'three';
import * as TX from './textures.js';
import { toon, toonSoft, decal } from './materials.js';
import { PALETTE } from './config.js';

let _a = null;

export function assets() {
  if (_a) return _a;

  const tex = {
    grad: TX.toonGradient(4, 0.08),
    gradSoft: TX.toonGradient(6, 0.16),
    // skin keeps a high floor so the jaw / neck never read as dirty grey
    gradSkin: TX.toonGradient(9, 0.34, 0.70),
    gradCloth: TX.toonGradient(9, 0.30, 0.62),
    gradPillow: TX.toonGradient(48, 1.7, 0.52),
    gradHair: TX.toonGradient(20, 0.95, 0.76),
    pajama: TX.pajamaTexture([1 / 2.2, 1 / 2.2]),
    pajamaFine: TX.pajamaTexture([5, 5]),
    eyeL: TX.eyeTexture(512, { lashSide: -1 }),
    eyeR: TX.eyeTexture(512, { lashSide: 1 }),
    brow: TX.browTexture(),
    browL: TX.browTexture(256, { flip: true }),
    mouth: TX.mouthTexture(),
    blush: TX.blushTexture(),
    hairStrand: TX.hairStrandTexture(),
    haloGlow: TX.haloGlowTexture(),
    pillow: TX.clothTexture(PALETTE.pillow, PALETTE.pillowShade),
    slipper: TX.clothTexture(PALETTE.slipper, PALETTE.slipperSole),
  };

  const mat = {
    skin: toon({ color: PALETTE.skin, gradient: tex.gradSkin }),
    skinSoft: toon({ color: PALETTE.skin, gradient: tex.gradSkin }),
    hair: toon({ color: 0xffffff, vertexColors: true, gradient: tex.gradHair }),
    hairShell: toon({ color: 0xffffff, vertexColors: true, map: tex.hairStrand, gradient: tex.gradHair }),
    hairFlat: toon({ color: PALETTE.hair, gradient: tex.grad }),
    hairLight: toon({ color: PALETTE.hairLight, gradient: tex.grad }),
    pajama: toon({ color: 0xffffff, map: tex.pajama, gradient: tex.gradCloth }),
    pajamaFine: toon({ color: 0xffffff, map: tex.pajamaFine, gradient: tex.gradCloth }),
    trim: toon({ color: PALETTE.trim, gradient: tex.gradCloth }),
    trimShade: toon({ color: PALETTE.trimShade, gradient: tex.gradCloth }),
    button: toon({ color: PALETTE.button, gradient: tex.gradCloth }),
    slipper: toon({ color: 0xffffff, map: tex.slipper, gradient: tex.gradCloth }),
    sole: toon({ color: PALETTE.slipperSole, gradient: tex.gradCloth }),
    bowPink: toon({ color: PALETTE.bowPink, gradient: tex.gradCloth }),
    halo: new THREE.MeshStandardMaterial({
      color: PALETTE.halo,
      metalness: 0.55,
      roughness: 0.34,
      emissive: new THREE.Color(0x101425),
      emissiveIntensity: 1,
    }),
    // the lit inner edge of the halo — unlit so it always reads as a bright rim
    haloRim: new THREE.MeshBasicMaterial({
      color: 0x74e4fb,
      transparent: true,
      opacity: 0.55,
      toneMapped: false,
    }),
    pillow: toon({ color: 0xe9eefc, gradient: tex.gradPillow }),
    eyeL: decal(tex.eyeL),
    eyeR: decal(tex.eyeR),
    brow: decal(tex.brow),
    browL: decal(tex.browL),
    mouth: decal(tex.mouth),
    blush: new THREE.MeshBasicMaterial({
      map: tex.blush,
      transparent: true,
      depthWrite: false,
      opacity: 0.48,
      toneMapped: false,
      blending: THREE.NormalBlending,
    }),
  };

  _a = { tex, mat };
  return _a;
}
