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
import { headSurface, hairStrand, curveFromPoints, surfaceShell, paintAlongV, lerp, TAU } from '../geometry.js';

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
const tipTaper = (t) => 1 - Math.pow(Math.max(0, (t - 0.935) / 0.065), 1.0);
const sheetW = (a, b, c) => (t) => (a + b * Math.sin(Math.PI * Math.min(1, t * 1.06)) - c * t * t) * tipTaper(t);
const sheetT = (a, b) => (t) => (a - b * t) * tipTaper(t);

/** radial swell of the scalp shell, shared with the sheen band */
function capSwell(front) {
  return 1.095 + 0.055 * Math.max(0, -front) + 0.030 * Math.max(0, front);
}

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
      const swell = capSwell(front);
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
  // One continuous curtain carries the mass and the outer silhouette — that is
  // what makes drawn hair read as a smooth sheet instead of a bundle of ropes.
  {
    const curtainGeo = surfaceShell({
      uSeg: 104,
      vSeg: 44,
      closed: false,
      flip: true,
      point: (u, v, out) => {
        const su = u * 2 - 1;
        const phi = Math.PI * 1.5 + su * 1.34;
        const thetaTop = 1.44 - 0.24 * Math.abs(su);
        const root = headSurface(thetaTop, phi, R * 1.06);
        const dir = new THREE.Vector3(-Math.cos(phi), 0, Math.sin(phi));
        const tipY = -1.245 + 0.048 * Math.abs(su) + 0.040 * Math.sin(su * 6.2 + 0.4);
        const tipX = su * (0.222 + 0.045 * Math.abs(su));
        const tipZ = -0.118 - 0.05 * Math.abs(su);
        const bulge = (0.052 + 0.026 * Math.abs(su)) * Math.sin(Math.PI * Math.pow(v, 0.85));
        const sway = 0.016 * Math.sin(su * 3.1 + 1.2) * Math.sin(Math.PI * v);
        out.set(
          lerp(root.x, tipX, v) + dir.x * bulge + sway,
          lerp(root.y, tipY, v),
          lerp(root.z, tipZ, v) + dir.z * bulge
        );
      },
      uv: (u, v) => [u * 3, v * 3],
    });
    paintAlongV(curtainGeo, HAIR_STOPS_SHEET);
    const curtain = new THREE.Mesh(curtainGeo, assets().mat.hair);
    curtain.name = 'hairCurtain';
    curtain.castShadow = true;
    curtain.userData.noOutline = true;
    g.add(curtain);
    addOutline(curtain, { thickness: 0.0034 });
  }

  // Broad sheets layered over the curtain for the outer contour.
  const NS = 9;
  for (let i = 0; i < NS; i++) {
    const s = (i / (NS - 1)) * 2 - 1;
    const as = Math.abs(s);
    const phi0 = Math.PI * 1.5 + s * 1.42;
    const theta0 = 1.46 - 0.26 * as;
    const root = headSurface(theta0, phi0, R * 1.075);
    const dir = new THREE.Vector3(-Math.cos(phi0), 0, Math.sin(phi0));
    const hemWave = 0.030 * Math.sin(s * 2.1 + 0.7);
    const tip = new THREE.Vector3(
      s * (0.218 + 0.050 * as),
      -1.215 + 0.050 * as + hemWave,
      -0.112 - 0.048 * as
    );
    const p1 = root.clone().lerp(tip, 0.24).addScaledVector(dir, 0.046 + 0.018 * as);
    p1.x += 0.012 * Math.sin(s * 3.1 + 0.4);
    const p2 = root.clone().lerp(tip, 0.58).addScaledVector(dir, 0.044 + 0.032 * as);
    p2.x += 0.020 * Math.sin(s * 3.1 + 2.2);
    const p3 = root.clone().lerp(tip, 0.86).addScaledVector(dir, 0.026 + 0.028 * as);
    p3.x += 0.016 * Math.sin(s * 3.1 + 3.6);
    addStrand(
      g,
      [V(root.x, root.y, root.z), V(p1.x, p1.y, p1.z), V(p2.x, p2.y, p2.z), V(p3.x, p3.y, p3.z), V(tip.x, tip.y, tip.z)],
      sheetW(0.078 + 0.020 * as, 0.030, 0.036),
      sheetT(0.020, 0.012),
      { segs: 44, radial: 14, stops: HAIR_STOPS_SHEET, outline: 0.0030 }
    );
  }

  // 2) thin accent strands layered over the sheets
  const NA = 9;
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
      -1.075 + 0.060 * as + 0.030 * j,
      -0.132 - 0.045 * as
    );
    const p1 = root.clone().lerp(tip, 0.28).addScaledVector(dir, 0.050 + 0.020 * as);
    const p2 = root.clone().lerp(tip, 0.62).addScaledVector(dir, 0.046 + 0.032 * as);
    const p3 = root.clone().lerp(tip, 0.86).addScaledVector(dir, 0.012 + 0.018 * as);
    p3.x += 0.022 * Math.sin(s * 6.0);
    addStrand(
      g,
      [V(root.x, root.y, root.z), V(p1.x, p1.y, p1.z), V(p2.x, p2.y, p2.z), V(p3.x, p3.y, p3.z), V(tip.x, tip.y, tip.z)],
      sheetW(0.042 + 0.012 * as, 0.020, 0.022),
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

  /* ------------------------------------------------------- sheen band -- */
  // The classic anime hair highlight: a light zig-zag ring where the hair
  // catches the key light.
  {
    const sheenGeo = surfaceShell({
      uSeg: 150,
      vSeg: 6,
      point: (u, v, out) => {
        const phi = Math.PI / 2 + (u - 0.5) * 3.05;
        const front = Math.sin(phi);
        const zig = 0.115 * Math.sin(u * Math.PI * 11) * (0.55 + 0.45 * Math.cos((u - 0.5) * Math.PI));
        const theta = 0.66 + zig + v * 0.19;
        headSurface(theta, phi, R * (capSwell(front) + 0.055), out);
      },
      uv: (u, v) => [u * 6, v],
    });
    paintAlongV(sheenGeo, [
      [0.0, 0x5f529f],
      [0.45, 0xa296dd],
      [1.0, 0x51458f],
    ], { invert: true });
    const sheen = new THREE.Mesh(sheenGeo, assets().mat.hair);
    sheen.name = 'hairSheen';
    sheen.userData.noOutline = true;
    sheen.renderOrder = 1;
    g.add(sheen);
  }

  /* ============================================================= FRINGE = */
  // Like the back, the fringe is one continuous sheet with a pointed lower
  // edge; loose strands are layered on top only for surface detail.
  {
    const fringeGeo = surfaceShell({
      uSeg: 110,
      vSeg: 24,
      closed: false,
      flip: true,
      point: (u, v, out) => {
        const su = u * 2 - 1;
        const phi = Math.PI / 2 + su * 1.34;
        const front = Math.sin(phi);
        const r = R * (capSwell(front) + 0.028);
        const thetaTop = 0.26 + 0.30 * Math.pow(Math.abs(su), 1.1);
        const root = headSurface(thetaTop, phi, r);
        const tipTheta =
          1.19 + 0.16 * Math.pow(Math.abs(su), 1.3) + 0.085 * Math.sin(su * 11.5 + 0.3);
        const tip = headSurface(tipTheta, phi, r + R * 0.012);
        const dir = new THREE.Vector3(-Math.cos(phi), 0, Math.sin(phi));
        out.lerpVectors(root, tip, v);
        out.addScaledVector(dir, 0.022 * Math.sin(Math.PI * v));
      },
      uv: (u, v) => [u * 4, v * 2],
    });
    paintAlongV(fringeGeo, [
      [0.0, 0x352c5e],
      [0.35, 0x4c4084],
      [0.72, 0x6557a8],
      [1.0, 0x7b6cc2],
    ]);
    const fringe = new THREE.Mesh(fringeGeo, assets().mat.hair);
    fringe.name = 'hairFringe';
    fringe.castShadow = true;
    fringe.userData.noOutline = true;
    g.add(fringe);
    addOutline(fringe, { thickness: 0.0030 });
  }

  // loose locks layered over the fringe sheet
  const NB = 11;
  for (let i = 0; i < NB; i++) {
    const t = (i / (NB - 1)) * 2 - 1;
    const at = Math.abs(t);
    const j = rnd() - 0.5;
    const phi0 = Math.PI / 2 + t * 1.30 + 0.02 * j;
    const theta0 = 0.14 + 0.50 * Math.pow(at, 1.05);
    const rootR = R * (capSwell(Math.sin(phi0)) + 0.030);
    const root = headSurface(theta0, phi0, rootR);
    const dir = new THREE.Vector3(-Math.cos(phi0), 0, Math.sin(phi0));
    const browLine = 0.041 - 0.009 * at + 0.016 * (rnd() - 0.5);
    const drop = Math.max(0.03, root.y - browLine);
    const tip = root
      .clone()
      .addScaledVector(dir, 0.026 + 0.016 * at)
      .add(new THREE.Vector3(t * 0.020 + 0.006 * j, -drop, 0));
    const p1 = root.clone().lerp(tip, 0.36).addScaledVector(dir, 0.018);
    const p2 = root.clone().lerp(tip, 0.72).addScaledVector(dir, 0.022);
    addStrand(
      g,
      [V(root.x, root.y, root.z), V(p1.x, p1.y, p1.z), V(p2.x, p2.y, p2.z), V(tip.x, tip.y, tip.z)],
      sheetW(0.030, 0.012, 0.018),
      sheetT(0.010, 0.006),
      { segs: 28, radial: 12, stops: i % 3 === 0 ? HAIR_STOPS_DEEP : HAIR_STOPS, outline: 0.0022 }
    );
  }

  /* ========================================================= SIDE LOCKS = */
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const phi0 = Math.PI / 2 + s * (1.34 + k * 0.16 + 0.02 * rnd());
      const theta0 = 0.70 + k * 0.17 + 0.04 * rnd();
      const root = headSurface(theta0, phi0, R * 1.055);
      const dir = new THREE.Vector3(-Math.cos(phi0), 0, Math.sin(phi0));
      const tipY = -0.56 - 0.22 * k - 0.05 * rnd();
      const tipX = s * (0.096 + 0.044 * k + 0.010 * rnd());
      const tipZ = -0.030 - 0.032 * k;
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
    const tip = new THREE.Vector3(s * 0.132, -0.90, -0.022);
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
