/**
 * Hair.
 *
 * Built as three overlapping layers, the way a 2D anime haircut is drawn:
 *   1. a sculpted scalp shell that also forms the fringe silhouette,
 *   2. broad flat "sheets" that give the mass and the outer contour,
 *   3. thin accent strands layered on top for detail and separation.
 *
 * Everything is coloured root→tip through baked vertex colours, and the scalp
 * carries a bright sheen band like a hair highlight.
 */
import * as THREE from 'three';
import { DIMS } from '../config.js';
import { assets } from '../assets.js';
import { addOutline } from '../materials.js';
import { headSurface, hairStrand, curveFromPoints, surfaceShell, paintAlongV, TAU } from '../geometry.js';

const R = DIMS.headR;

const HAIR_STOPS = [
  [0.0, 0x3d3468],
  [0.3, 0x554991],
  [0.62, 0x6f61b4],
  [0.86, 0x8a7bd0],
  [1.0, 0xa295e0],
];
const HAIR_STOPS_DEEP = [
  [0.0, 0x2f2753],
  [0.4, 0x433a70],
  [0.75, 0x5a4c96],
  [1.0, 0x7766b5],
];
const HAIR_STOPS_SHEET = [
  [0.0, 0x372e60],
  [0.35, 0x4c4084],
  [0.7, 0x6355a6],
  [1.0, 0x8071c6],
];

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const V = (x, y, z) => [x, y, z];

function addStrand(group, pts, widthFn, thickFn, { stops = HAIR_STOPS, segs = 40, radial = 12, outline = 0.0028 } = {}) {
  const curve = curveFromPoints(pts, 0.5);
  const geo = hairStrand(curve, widthFn, thickFn, { segs, radial });
  paintAlongV(geo, stops);
  const mesh = new THREE.Mesh(geo, assets().mat.hair);
  mesh.name = 'strand';
  mesh.castShadow = true;
  mesh.userData.noOutline = true;
  group.add(mesh);
  if (outline > 0) addOutline(mesh, { thickness: outline });
  return mesh;
}

/**
 * Flat lock profile: broad through the body, closing to a true point at the
 * tip (so strands are capped, not open tubes).
 */
const tipTaper = (t) => 1 - Math.pow(Math.max(0, (t - 0.90) / 0.10), 1.0);
const sheetW = (a, b, c) => (t) => (a + b * Math.sin(Math.PI * Math.min(1, t * 1.06)) - c * t * t) * tipTaper(t);
const sheetT = (a, b) => (t) => (a - b * t) * tipTaper(t);

export function buildHair() {
  const g = new THREE.Group();
  g.name = 'hair';
  const rnd = mulberry32(20261017);

  /* ------------------------------------------------------- scalp shell -- */
  const capGeo = surfaceShell({
    uSeg: 132,
    vSeg: 52,
    point: (u, v, out) => {
      const phi = u * TAU;
      const front = Math.sin(phi);
      // pointed fringe edge: the shell itself is the fringe
      const wave = 0.135 * Math.abs(Math.sin((phi - Math.PI / 2) * 11)) * Math.max(0, front);
      const thetaMax = 2.22 - 0.99 * front + wave;
      const theta = 0.004 + v * (thetaMax - 0.004);
      const swell = 1.095 + 0.055 * Math.max(0, -front) + 0.030 * Math.max(0, front);
      headSurface(theta, phi, R * swell, out);
      const yn = out.y / R;
      if (yn > 0) out.y *= 1 + 0.035 * yn;
    },
    uv: (u, v) => [u * 5, v * 3],
  });
  paintAlongV(capGeo, [
    [0.0, 0x483d7d],
    [0.16, 0x6558ab],
    [0.30, 0x9184da],
    [0.48, 0x6052a0],
    [1.0, 0x453a78],
  ]);
  const cap = new THREE.Mesh(capGeo, assets().mat.hair);
  cap.name = 'hairCap';
  cap.castShadow = true;
  cap.userData.noOutline = true;
  g.add(cap);
  addOutline(cap, { thickness: 0.0042 });

  /* ================================================================ BACK = */
  // 1) broad sheets — these carry the outer silhouette
  const NS = 14;
  for (let i = 0; i < NS; i++) {
    const s = (i / (NS - 1)) * 2 - 1;
    const as = Math.abs(s);
    const phi0 = Math.PI * 1.5 + s * 1.5;
    const theta0 = 1.52 - 0.30 * as;
    const root = headSurface(theta0, phi0, R * 1.075);
    const dir = new THREE.Vector3(-Math.cos(phi0), 0, Math.sin(phi0));
    const hemWave = 0.030 * Math.sin(s * 4.4 + 0.7);
    const tip = new THREE.Vector3(
      s * (0.246 + 0.066 * as),
      -1.225 + 0.080 * as + hemWave,
      -0.100 - 0.045 * as
    );
    const p1 = root.clone().lerp(tip, 0.22).addScaledVector(dir, 0.046 + 0.018 * as);
    p1.x += 0.012 * Math.sin(s * 3.1 + 0.4);
    const p2 = root.clone().lerp(tip, 0.55).addScaledVector(dir, 0.046 + 0.034 * as);
    p2.x += 0.020 * Math.sin(s * 3.1 + 2.2);
    const p3 = root.clone().lerp(tip, 0.84).addScaledVector(dir, 0.028 + 0.030 * as);
    p3.x += 0.016 * Math.sin(s * 3.1 + 3.6);
    addStrand(
      g,
      [V(root.x, root.y, root.z), V(p1.x, p1.y, p1.z), V(p2.x, p2.y, p2.z), V(p3.x, p3.y, p3.z), V(tip.x, tip.y, tip.z)],
      sheetW(0.060 + 0.016 * as, 0.030, 0.026),
      sheetT(0.020, 0.012),
      { segs: 44, radial: 14, stops: HAIR_STOPS_SHEET, outline: 0.0030 }
    );
  }

  // 2) thin accent strands layered over the sheets
  const NA = 12;
  for (let i = 0; i < NA; i++) {
    const s = (i / (NA - 1)) * 2 - 1;
    const as = Math.abs(s);
    const j = rnd() - 0.5;
    const phi0 = Math.PI * 1.5 + s * 1.56 + 0.05 * j;
    const theta0 = 1.44 - 0.26 * as + 0.05 * j;
    const root = headSurface(theta0, phi0, R * 1.10);
    const dir = new THREE.Vector3(-Math.cos(phi0), 0, Math.sin(phi0));
    const tip = new THREE.Vector3(
      s * (0.256 + 0.070 * as) + 0.014 * j,
      -1.080 + 0.090 * as + 0.05 * j,
      -0.132 - 0.045 * as
    );
    const p1 = root.clone().lerp(tip, 0.28).addScaledVector(dir, 0.050 + 0.020 * as);
    const p2 = root.clone().lerp(tip, 0.62).addScaledVector(dir, 0.046 + 0.032 * as);
    const p3 = root.clone().lerp(tip, 0.86).addScaledVector(dir, 0.012 + 0.018 * as);
    p3.x += 0.022 * Math.sin(s * 6.0);
    addStrand(
      g,
      [V(root.x, root.y, root.z), V(p1.x, p1.y, p1.z), V(p2.x, p2.y, p2.z), V(p3.x, p3.y, p3.z), V(tip.x, tip.y, tip.z)],
      sheetW(0.030 + 0.010 * as, 0.018, 0.016),
      sheetT(0.015, 0.010),
      { segs: 38, radial: 12, stops: as > 0.6 ? HAIR_STOPS : HAIR_STOPS_DEEP, outline: 0.0026 }
    );
  }

  // 3) short filler curtain between the scalp shell and the long mass
  for (let i = 0; i < 9; i++) {
    const s = (i / 6) * 2 - 1;
    const phi0 = Math.PI * 1.5 + s * 1.3;
    const root = headSurface(1.34, phi0, R * 1.12);
    const dir = new THREE.Vector3(-Math.cos(phi0), 0, Math.sin(phi0));
    const tip = new THREE.Vector3(s * 0.15, -0.52, -0.062);
    const p1 = root.clone().lerp(tip, 0.5).addScaledVector(dir, 0.020);
    addStrand(
      g,
      [V(root.x, root.y, root.z), V(p1.x, p1.y, p1.z), V(tip.x, tip.y, tip.z)],
      sheetW(0.034, 0.016, 0.019),
      sheetT(0.014, 0.008),
      { segs: 20, radial: 12, stops: HAIR_STOPS_DEEP, outline: 0.0024 }
    );
  }

  /* ============================================================= FRINGE = */
  // Locks that lie over the scalp shell; each is solved so its tip lands on a
  // controlled "brow line" just above the eyes rather than at a fixed length.
  const NB = 17;
  for (let i = 0; i < NB; i++) {
    const t = (i / (NB - 1)) * 2 - 1;
    const at = Math.abs(t);
    const j = rnd() - 0.5;
    const phi0 = Math.PI / 2 + t * 1.20 + 0.025 * j;
    const theta0 = 0.10 + 0.54 * Math.pow(at, 1.05);
    const rootR = R * 1.075;
    const root = headSurface(theta0, phi0, rootR);
    const dir = new THREE.Vector3(-Math.cos(phi0), 0, Math.sin(phi0));
    const browLine = 0.047 - 0.009 * at + 0.018 * (rnd() - 0.5);
    const drop = Math.max(0.03, root.y - browLine);
    const tip = root
      .clone()
      .addScaledVector(dir, 0.024 + 0.016 * at)
      .add(new THREE.Vector3(t * 0.020 + 0.006 * j, -drop, 0));
    const p1 = root.clone().lerp(tip, 0.36).addScaledVector(dir, 0.020);
    const p2 = root.clone().lerp(tip, 0.72).addScaledVector(dir, 0.026);
    addStrand(
      g,
      [V(root.x, root.y, root.z), V(p1.x, p1.y, p1.z), V(p2.x, p2.y, p2.z), V(tip.x, tip.y, tip.z)],
      sheetW(0.042, 0.016, 0.028),
      sheetT(0.012, 0.008),
      { segs: 30, radial: 14, stops: i % 3 === 0 ? HAIR_STOPS_DEEP : HAIR_STOPS, outline: 0.0024 }
    );
  }

  // finer strands threaded through the fringe for separation
  for (let i = 0; i < 9; i++) {
    const t = (i / 9) * 2 - 1;
    const at = Math.abs(t);
    const j = rnd() - 0.5;
    const phi0 = Math.PI / 2 + t * 1.06 + 0.06 * j;
    const theta0 = 0.52 + 0.36 * at;
    const root = headSurface(theta0, phi0, R * 1.125);
    const dir = new THREE.Vector3(-Math.cos(phi0), 0, Math.sin(phi0));
    const drop = Math.max(0.026, root.y - (0.056 - 0.010 * at + 0.006 * j));
    const tip = root
      .clone()
      .addScaledVector(dir, 0.020)
      .add(new THREE.Vector3(t * 0.010, -drop, 0));
    const p1 = root.clone().lerp(tip, 0.5).addScaledVector(dir, 0.010);
    addStrand(
      g,
      [V(root.x, root.y, root.z), V(p1.x, p1.y, p1.z), V(tip.x, tip.y, tip.z)],
      sheetW(0.020, 0.012, 0.011),
      sheetT(0.010, 0.006),
      { segs: 16, radial: 10, stops: HAIR_STOPS, outline: 0.0022 }
    );
  }

  /* ========================================================= SIDE LOCKS = */
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const phi0 = Math.PI / 2 + s * (1.12 + k * 0.17 + 0.02 * rnd());
      const theta0 = 0.70 + k * 0.17 + 0.04 * rnd();
      const root = headSurface(theta0, phi0, R * 1.055);
      const dir = new THREE.Vector3(-Math.cos(phi0), 0, Math.sin(phi0));
      const tipY = -0.56 - 0.22 * k - 0.05 * rnd();
      const tipX = s * (0.104 + 0.046 * k + 0.010 * rnd());
      const tipZ = 0.022 - 0.030 * k;
      const tip = new THREE.Vector3(tipX, tipY, tipZ);
      const p1 = root.clone().lerp(tip, 0.30).addScaledVector(dir, 0.020);
      p1.z += 0.012;
      const p2 = root.clone().lerp(tip, 0.62).addScaledVector(dir, 0.012);
      const p3 = root.clone().lerp(tip, 0.86).addScaledVector(dir, 0.004);
      addStrand(
        g,
        [V(root.x, root.y, root.z), V(p1.x, p1.y, p1.z), V(p2.x, p2.y, p2.z), V(p3.x, p3.y, p3.z), V(tip.x, tip.y, tip.z)],
        sheetW(0.030, 0.016, 0.019),
        sheetT(0.015, 0.010),
        { segs: 34, radial: 14, stops: k === 0 ? HAIR_STOPS : HAIR_STOPS_DEEP, outline: 0.0028 }
      );
    }

    // one extra-long lock falling in front of the shoulder
    const phi0 = Math.PI / 2 + s * 0.96;
    const root = headSurface(0.58, phi0, R * 1.075);
    const dir = new THREE.Vector3(-Math.cos(phi0), 0, Math.sin(phi0));
    const tip = new THREE.Vector3(s * 0.128, -0.90, 0.040);
    const p1 = root.clone().lerp(tip, 0.22).addScaledVector(dir, 0.026);
    const p2 = root.clone().lerp(tip, 0.52).addScaledVector(dir, 0.020);
    const p3 = root.clone().lerp(tip, 0.80).addScaledVector(dir, 0.008);
    addStrand(
      g,
      [V(root.x, root.y, root.z), V(p1.x, p1.y, p1.z), V(p2.x, p2.y, p2.z), V(p3.x, p3.y, p3.z), V(tip.x, tip.y, tip.z)],
      sheetW(0.038, 0.020, 0.024),
      sheetT(0.016, 0.011),
      { segs: 34, radial: 14, stops: HAIR_STOPS, outline: 0.0028 }
    );
  }

  return g;
}
