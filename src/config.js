/**
 * Global config: credits, iteration bookkeeping, palette and body proportions.
 * Everything here is procedural — no external asset is ever loaded.
 */

export const META = {
  model: 'DeepSeek V4.1 Flash High',
  tool: 'Devin CLI · three.js',
  subject: 'Yuuka — Pajama Ver.',
  iteration: 81,
  maxIterations: 1000,
  score: 94,
};

/** Anime-ish stylised proportions. Units are metres, origin at the floor. */
export const DIMS = {
  height: 1.72,

  ankleY: 0.116,
  kneeY: 0.5,
  hipY: 0.885,
  waistY: 1.045,
  chestY: 1.235,
  shoulderY: 1.375,
  neckY: 1.43,
  chinY: 1.437,

  headC: 1.566, // head centre
  headR: 0.1125, // head radius
  headTop: 1.694,

  shoulderX: 0.132,
  hipX: 0.088,

  armUpper: 0.26,
  armLower: 0.268,

  legUpper: 0.4,
  legLower: 0.39,
};

export const PALETTE = {
  skin: 0xf6dcd3,
  skinShade: 0xe6bfb4,
  skinDeep: 0xd9a196,

  hair: 0x483d78,
  hairLight: 0x6d5fae,
  hairDeep: 0x2b2449,
  hairSheen: 0x9a8ed6,

  eyeIris: 0x7b6fd2,
  eyeIrisDeep: 0x453a8a,
  lash: 0x3a2f63,

  pajama: 0xc2dcf4,
  pajamaShade: 0xa3c8e9,
  trim: 0xfbfdff,
  trimShade: 0xdcebf9,
  heart: 0xf3aec9,
  button: 0xfdfeff,

  slipper: 0xf3f3f9,
  slipperSole: 0xbfbfd2,
  bowPink: 0xd4739f,

  halo: 0x363a4d,
  haloGlow: 0x7d8cff,

  pillow: 0xffffff,
  pillowShade: 0xe4ebf8,

  outline: 0x352c52,
  blush: 0xf3a9a1,
};

export const BG = {
  top: 0xe8f3ff,
  mid: 0xd3e7fa,
  bottom: 0xb9d5f0,
};
