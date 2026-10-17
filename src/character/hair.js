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
import { headSurface, hairStrand, curveFromPoints, surfaceShell, paintAlongV, shadeAcrossU, lerp, smoothstep, TAU } from '../geometry.js';

const R = DIMS.headR;

const HAIR_STOPS = [
  [0.0, 0x7876be],
  [0.3, 0x8c8ad2],
  [0.62, 0xa09ee4],
  [0.86, 0xb6b4f0],
  [1.0, 0xc8c6f8],
];
const HAIR_STOPS_DEEP = [
  [0.0, 0x6967ae],
  [0.4, 0x7b79c2],
  [0.75, 0x8f8dd6],
  [1.0, 0xa5a3e8],
];
// The outer locks carry a bright band near the crown — the classic anime
// hair highlight — so the mass reads as gloss rather than flat colour.
const HAIR_STOPS_LOCK = [
  [0.0, 0x7674bc],
  [0.16, 0x8b89d2],
  [0.30, 0xc2c0f4],
  [0.40, 0x9c9ae2],
  [0.70, 0x8b89c8],
  [1.0, 0xa9a7e8],
];
const HAIR_STOPS_SHEET = [
  [0.0, 0x706eb6],
  [0.35, 0x8482c8],
  [0.7, 0x9997da],
  [1.0, 0xb3b1ee],
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

function addStrand(group, pts, widthFn, thickFn, { stops = HAIR_STOPS, segs = 40, radial = 12, outline = 0.0028, round = 0.22 } = {}) {
  const curve = curveFromPoints(pts, 0.5);
  const geo = hairStrand(curve, widthFn, thickFn, { segs, radial });
  paintAlongV(geo, stops);
  if (round > 0) shadeAcrossU(geo, { base: 1 - round, gain: round });
  const mesh = new THREE.Mesh(geo, assets().mat.hair);
  mesh.name = 'strand';
  mesh.castShadow = true;
  mesh.userData.noOutline = true;
  group.add(mesh);
  if (outline > 0) addOutline(mesh, { thickness: outline, color: 0x3a3870 });
  return mesh;
}

/**
 * Flat lock profile: broad through the body, closing to a true point at the
 * tip (so strands are capped, not open tubes).
 */
const tipTaper = (t) => 1 - Math.pow(Math.max(0, (t - 0.74) / 0.26), 0.85);
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
      const wave = 0.055 * Math.abs(Math.sin((phi - Math.PI / 2) * 7)) * Math.max(0, front);
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
    [0.0, 0x7b79c4],
    [0.16, 0x908ed8],
    [0.30, 0xb9b7f2],
    [0.48, 0x8d8bd4],
    [1.0, 0x7472b8],
  ]);
  const cap = new THREE.Mesh(capGeo, assets().mat.hair);
  cap.name = 'hairCap';
  cap.castShadow = true;
  cap.userData.noOutline = true;
  g.add(cap);
  addOutline(cap, { thickness: 0.0028, color: 0x3a3870 });

  /* ================================================================ BACK = */
  // Two layers. The inner curtain hugs the head and supplies the mass; the
  // outer locks sit proud of it and carry the silhouette, each ending at a
  // different height so the hem reads as layered points rather than a cut.
  //
  // Lengths are in metres from the head centre, so the hem lands just below
  // the hip (world y ≈ 1.05) the way the reference does.
  const HEM_Y = -0.980;

  {
    const curtainGeo = surfaceShell({
      uSeg: 96,
      vSeg: 40,
      closed: false,
      flip: true,
      point: (u, v, out) => {
        const su = u * 2 - 1;
        const as = Math.abs(su);
        const phi = Math.PI * 1.5 + su * 1.30;
        const root = headSurface(1.02 - 0.28 * su * su, phi, R * 1.06);
        const dir = new THREE.Vector3(-Math.cos(phi), 0, Math.sin(phi));
        const ev = Math.pow(v, 1.7);
        const tipX = dir.x * (0.188 - 0.056 * su * su);
        const tipZ = dir.z * 0.104 - 0.020;
        // The mass stands further off the back than it spreads sideways, so
        // the side profile has depth instead of reading as a flat board.
        const bulge = (0.024 + 0.016 * (1 - as)) * smoothstep(0.10, 0.62, v);
        return out.set(
          lerp(root.x, tipX, ev) + dir.x * bulge,
          lerp(root.y, HEM_Y - 0.030 - 0.030 * as, v),
          lerp(root.z, tipZ, ev) + dir.z * bulge * 1.85
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
    addOutline(curtain, { thickness: 0.0022, color: 0x3a3870 });
  }

  // Outer locks: these are what you actually see, so they vary in width and
  // length and sit slightly proud of the curtain.
  const NL = 9;
  for (let i = 0; i < NL; i++) {
    const s0 = (i / (NL - 1)) * 2 - 1;
    const as = Math.abs(s0);
    const j = rnd() - 0.5;
    const phi0 = Math.PI * 1.5 + s0 * 1.30 + 0.045 * j;
    const root = headSurface(1.12 - 0.24 * as + 0.05 * j, phi0, R * 1.185);
    const dir = new THREE.Vector3(-Math.cos(phi0), 0, Math.sin(phi0));
    // Outer locks end higher and closer in, so the mass tapers to a rounded
    // silhouette instead of a straight-sided slab.
    const hemY = HEM_Y + 0.026 * Math.sin(i * 1.6 + 0.6) + 0.185 * Math.pow(as, 1.7) + 0.012 * j;
    const hemR = 0.212 - 0.088 * Math.pow(as, 1.6) + 0.016 * Math.sin(i * 1.35 + 2.2);
    const tip = new THREE.Vector3(dir.x * hemR, hemY, dir.z * 0.116 - 0.024);
    const p1 = root.clone().lerp(tip, 0.24).addScaledVector(dir, 0.028 + 0.010 * as);
    p1.z += dir.z * 0.030;
    const p2 = root.clone().lerp(tip, 0.58).addScaledVector(dir, 0.040 + 0.020 * as);
    p2.z += dir.z * 0.045;
    const p3 = root.clone().lerp(tip, 0.86).addScaledVector(dir, 0.026 + 0.020 * as);
    p3.z += dir.z * 0.022;
    addStrand(
      g,
      [V(root.x, root.y, root.z), V(p1.x, p1.y, p1.z), V(p2.x, p2.y, p2.z), V(p3.x, p3.y, p3.z), V(tip.x, tip.y, tip.z)],
      sheetW(0.108 + 0.024 * as, 0.030, 0.046),
      sheetT(0.036, 0.022),
      { segs: 44, radial: 16, stops: HAIR_STOPS_LOCK, outline: 0.0000, round: 0.42 }
    );
  }

  // A few thin locks with the light ramp so the mass is not one flat sheet.
  for (let i = 0; i < 6; i++) {
    const s0 = (i / 5) * 2 - 1;
    const as = Math.abs(s0);
    const j = rnd() - 0.5;
    const phi0 = Math.PI * 1.5 + s0 * 1.18 + 0.08 * j;
    const root = headSurface(0.96 - 0.24 * as, phi0, R * 1.205);
    const dir = new THREE.Vector3(-Math.cos(phi0), 0, Math.sin(phi0));
    const tip = new THREE.Vector3(dir.x * 0.206, HEM_Y + 0.045 + 0.04 * as, dir.z * 0.120 - 0.024);
    const p1 = root.clone().lerp(tip, 0.30).addScaledVector(dir, 0.052);
    p1.z += dir.z * 0.052;
    const p2 = root.clone().lerp(tip, 0.66).addScaledVector(dir, 0.050);
    p2.z += dir.z * 0.062;
    const p3 = root.clone().lerp(tip, 0.88).addScaledVector(dir, 0.022);
    p3.z += dir.z * 0.030;
    addStrand(
      g,
      [V(root.x, root.y, root.z), V(p1.x, p1.y, p1.z), V(p2.x, p2.y, p2.z), V(p3.x, p3.y, p3.z), V(tip.x, tip.y, tip.z)],
      sheetW(0.040 + 0.014 * as, 0.016, 0.020),
      sheetT(0.013, 0.009),
      { segs: 36, radial: 12, stops: HAIR_STOPS, outline: 0.0006, round: 0.36 }
    );
  }

  // 3) short filler between the scalp shell and the long mass
  for (let i = 0; i < 9; i++) {
    const s = (i / 6) * 2 - 1;
    const phi0 = Math.PI * 1.5 + s * 1.3;
    const root = headSurface(1.34, phi0, R * 1.175);
    const dir = new THREE.Vector3(-Math.cos(phi0), 0, Math.sin(phi0));
    const tip = new THREE.Vector3(dir.x * 0.150, -0.28, dir.z * 0.080 - 0.02);
    const p1 = root.clone().lerp(tip, 0.5).addScaledVector(dir, 0.020);
    addStrand(
      g,
      [V(root.x, root.y, root.z), V(p1.x, p1.y, p1.z), V(tip.x, tip.y, tip.z)],
      sheetW(0.048, 0.020, 0.024),
      sheetT(0.017, 0.010),
      { segs: 20, radial: 12, stops: HAIR_STOPS_DEEP, outline: 0.0006, round: 0.40 }
    );
  }

  /* ------------------------------------------------------- sheen band -- */
  // The classic anime hair highlight: a light zig-zag ring where the hair
  // catches the key light.
  {
    const sheenGeo = surfaceShell({
      uSeg: 150,
      vSeg: 5,
      point: (u, v, out) => {
        const phi = Math.PI / 2 + (u - 0.5) * 3.05;
        const front = Math.sin(phi);
        const zig = 0.040 * Math.sin(u * Math.PI * 6) * (0.55 + 0.45 * Math.cos((u - 0.5) * Math.PI));
        const theta = 0.62 + zig + v * 0.105;
        headSurface(theta, phi, R * (capSwell(front) + 0.050), out);
      },
      uv: (u, v) => [u * 6, v],
    });
    paintAlongV(sheenGeo, [
      [0.0, 0x4a4890],
      [0.5, 0x6f6dbe],
      [1.0, 0x45438a],
    ], { invert: true });
    const sheen = new THREE.Mesh(sheenGeo, assets().mat.hair);
    sheen.name = 'hairSheen';
    sheen.userData.noOutline = true;
    sheen.renderOrder = 1;
    g.add(sheen);
  }

  /* ============================================================= FRINGE = */
  // The bangs are drawn as locks radiating from a parting right of centre,
  // not as one sheet: a single shell can only ever read as a helmet.
  {
    const PART = 0.40; // parting position, in `su` units (+1 = viewer's right)
    const NF = 6;
    for (let i = 0; i < NF; i++) {
      const u = i / (NF - 1);
      const suT = -1.04 + u * 1.62;
      const thetaT = 1.345 + 0.330 * Math.pow(1 - u, 1.30) + 0.045 * Math.sin(i * 2.3 + 0.4);
      const pts = [];
      const n = 8;
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const su = lerp(PART, suT, Math.pow(t, 1.15));
        // The locks pull tight at the parting, which is what leaves the
        // triangle of bare forehead the reference shows there.
        const thTop = 0.185 + 0.640 * Math.exp(-Math.pow((su - PART) / 0.46, 2));
        const th = lerp(thTop, thetaT, Math.pow(t, 0.85));
        const phi = Math.PI / 2 + su * 1.15;
        const r = R * (capSwell(Math.sin(phi)) + 0.030 + 0.012 * Math.sin(Math.PI * t));
        const pt = headSurface(th, phi, r);
        pts.push([pt.x, pt.y, pt.z]);
      }
      addStrand(g, pts, sheetW(0.034, 0.017, 0.023), sheetT(0.012, 0.007), {
        segs: 34,
        radial: 12,
        stops: i % 2 === 0 ? HAIR_STOPS_LOCK : HAIR_STOPS,
        outline: 0.0010,
        round: 0.26,
      });
    }
  }

  /* ========================================================= SIDE LOCKS = */
  for (const s of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const phi0 = Math.PI / 2 + s * (1.30 + k * 0.13 + 0.03 * rnd());
      const theta0 = 0.72 + k * 0.14 + 0.05 * rnd();
      const root = headSurface(theta0, phi0, R * 1.185);
      const dir = new THREE.Vector3(-Math.cos(phi0), 0, Math.sin(phi0));
      const tipY = -0.36 - 0.105 * k - 0.040 * rnd();
      const tipX = s * (0.088 + 0.030 * k + 0.012 * rnd());
      const tipZ = 0.004 - 0.030 * k;
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
        { segs: 34, radial: 14, stops: k === 0 ? HAIR_STOPS : HAIR_STOPS_DEEP, outline: 0.0006, round: 0.38 }
      );
    }

    // one extra-long lock falling in front of the shoulder
    const phi0 = Math.PI / 2 + s * 0.96;
    const root = headSurface(0.58, phi0, R * 1.195);
    const dir = new THREE.Vector3(-Math.cos(phi0), 0, Math.sin(phi0));
    const tip = new THREE.Vector3(s * 0.150, -0.78, -0.012);
    const p1 = root.clone().lerp(tip, 0.22).addScaledVector(dir, 0.026);
    const p2 = root.clone().lerp(tip, 0.52).addScaledVector(dir, 0.020);
    const p3 = root.clone().lerp(tip, 0.80).addScaledVector(dir, 0.008);
    addStrand(
      g,
      [V(root.x, root.y, root.z), V(p1.x, p1.y, p1.z), V(p2.x, p2.y, p2.z), V(p3.x, p3.y, p3.z), V(tip.x, tip.y, tip.z)],
      sheetW(0.040, 0.020, 0.024),
      sheetT(0.016, 0.011),
      { segs: 34, radial: 14, stops: HAIR_STOPS, outline: 0.0006, round: 0.38 }
    );
  }

  return g;
}
