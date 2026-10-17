/**
 * Hair.
 *
 * The mass is built the way a 2D anime haircut is drawn: as a set of broad
 * overlapping locks that leave the crown together and fall to a layered hem of
 * pointed tips, rather than as one continuous sheet. A sheet always reads as a
 * board because its outline is a straight line; overlapping locks give a
 * silhouette that swells and necks the way painted hair does.
 *
 * Layers:
 *   1. scalp cap — the skull covering, also the fringe's root,
 *   2. the back mass — `NLOCK` broad locks rooted just under the crown,
 *   3. front locks — the two or three that fall over each shoulder,
 *   4. the fringe — bangs radiating from the parting,
 *   5. the sheen band — the anime highlight ring.
 *
 * Every lock is painted from one shared height-keyed ramp so the whole mass
 * carries a single gloss gradient instead of a different one per lock.
 */
import * as THREE from 'three';
import { DIMS } from '../config.js';
import { assets } from '../assets.js';
import { addOutline } from '../materials.js';
import {
  headSurface, hairStrand, curveFromPoints, surfaceShell,
  paintAlongV, paintByHeight, shadeAcrossU, lerp, smoothstep, TAU,
} from '../geometry.js';

const R = DIMS.headR;
const HEAD_C = DIMS.headC;

/**
 * The mass is painted by world height so every lock shares one gradient:
 * dark at the crown, a bright gloss band where the light catches it, then a
 * slow fall into the tips.
 */
const MASS_RAMP = [
  [HEAD_C + 0.105, 0x827db0],
  [HEAD_C + 0.055, 0xa4a0cc],
  [HEAD_C + 0.020, 0xeae6f1],
  [HEAD_C - 0.010, 0xc6c3de],
  [HEAD_C - 0.090, 0xb6b2d2],
  [HEAD_C - 0.300, 0xaaa7c8],
  [HEAD_C - 0.520, 0x9f9cbe],
  [HEAD_C - 0.700, 0xa7a3c2],
  [HEAD_C - 0.900, 0xbebad8],
];

/**
 * The fringe only occupies the top 0.13 m of the head, which is exactly where
 * `MASS_RAMP` puts its gloss band — painted from that ramp the bangs come out
 * almost white and vanish against the skin. It gets its own gradient.
 */
const FRINGE_RAMP = [
  [HEAD_C + 0.170, 0x6b67b0],
  [HEAD_C + 0.130, 0x807dc6],
  [HEAD_C + 0.090, 0x9592d6],
  [HEAD_C + 0.045, 0xa6a3e2],
  [HEAD_C + 0.000, 0xb4b1ea],
];

/** The scalp sits higher and darker than the hanging mass. */
const CAP_RAMP = [
  [HEAD_C + 0.115, 0x7b77ac],
  [HEAD_C + 0.060, 0xa09cc8],
  [HEAD_C + 0.022, 0xece8f3],
  [HEAD_C - 0.020, 0xbfbcd8],
  [HEAD_C - 0.120, 0xa4a1c4],
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

/** radial swell of the scalp shell, shared with `accessories.js` */
function capSwell(front) {
  return 1.155 + 0.055 * Math.max(0, -front) + 0.026 * Math.max(0, front);
}

/**
 * Flat lock profile: broad through the body, closing to a true point at the
 * tip (an open tube shows its hollow interior).
 */
const tipTaper = (t) => 1 - Math.pow(Math.max(0, (t - 0.70) / 0.30), 0.78);
const lockW = (a, b, c) => (t) =>
  (a + b * Math.sin(Math.PI * Math.min(1, t * 1.02)) - c * t * t) * tipTaper(t);
const lockT = (a, b) => (t) => (a - b * t) * tipTaper(t);

/**
 * One hanging lock: it leaves the scalp at `thetaRoot`, drapes over the skull
 * to the hairline, then falls to a tip at `hemR`/`hemY` (head-relative metres).
 */
function lockPoints(a, { thetaRoot, thetaHair, hemR, hemY, bulge = 0.026, tuck = 0 }) {
  const front = Math.sin(a);
  const swell = capSwell(front);
  // `headSurface` puts x = -cos(phi)·sin(theta), so the outward direction has to
  // use the same sign or every lock crosses the face.
  const dir = new THREE.Vector3(-Math.cos(a), 0, Math.sin(a));

  const root = headSurface(thetaRoot, a, R * (swell + 0.010));
  const hair = headSurface(thetaHair, a, R * (swell + 0.030));
  const tip = new THREE.Vector3(dir.x * hemR, hemY, dir.z * hemR);
  // A slight tuck keeps the lock against the body on the way down, so the mass
  // necks at the waist instead of hanging as a straight-sided curtain.
  const tuckAt = (t) => dir.clone().multiplyScalar(tuck * Math.sin(Math.PI * Math.min(1, t * 0.92)));

  const p1 = hair.clone().lerp(tip, 0.26).addScaledVector(dir, bulge * 0.45);
  const p2 = hair.clone().lerp(tip, 0.58).addScaledVector(dir, bulge * 0.95);
  const p3 = hair.clone().lerp(tip, 0.85).addScaledVector(dir, bulge * 0.70);
  for (const [p, t] of [[p1, 0.26], [p2, 0.58], [p3, 0.85]]) p.sub(tuckAt(t));

  return [root, hair, p1, p2, p3, tip];
}

function addLock(group, pts, widthFn, thickFn, { segs = 42, radial = 14, outline = 0.0011, round = 0.34 } = {}) {
  const geo = hairStrand(curveFromPoints(pts.map((p) => [p.x, p.y, p.z]), 0.5), widthFn, thickFn, { segs, radial });
  paintByHeight(geo, MASS_RAMP, { smooth: 1 });
  if (round > 0) shadeAcrossU(geo, { base: 1 - round, gain: round });
  const mesh = new THREE.Mesh(geo, assets().mat.hair);
  mesh.name = 'lock';
  mesh.castShadow = true;
  mesh.userData.noOutline = true;
  group.add(mesh);
  if (outline > 0) addOutline(mesh, { thickness: outline, color: 0x3a3870 });
  return mesh;
}

export function buildHair() {
  const g = new THREE.Group();
  g.name = 'hair';
  const rnd = mulberry32(20261017);

  /* ------------------------------------------------------- scalp shell -- */
  // Covers the skull from the crown down past the hairline at the back and
  // sides; at the front it stops above the brow so the fringe can sit on it.
  const capGeo = surfaceShell({
    uSeg: 148,
    vSeg: 56,
    point: (u, v, out) => {
      const phi = u * TAU;
      const front = Math.sin(phi);
      const wave = 0.045 * Math.abs(Math.sin((phi - Math.PI / 2) * 6)) * Math.max(0, front);
      const thetaMax = 2.30 - 1.02 * front + wave;
      const theta = 0.004 + v * (thetaMax - 0.004);
      headSurface(theta, phi, R * capSwell(front), out);
      const yn = out.y / R;
      if (yn > 0) out.y *= 1 + 0.030 * yn;
    },
    uv: (u, v) => [u * 5, v * 3],
  });
  paintByHeight(capGeo, CAP_RAMP, { smooth: 1 });
  const cap = new THREE.Mesh(capGeo, assets().mat.hair);
  cap.name = 'hairCap';
  cap.castShadow = true;
  cap.userData.noOutline = true;
  g.add(cap);
  addOutline(cap, { thickness: 0.0026, color: 0x3a3870 });

  /* =============================================================== MASS = */
  // Broad locks from the crown, around the back, stopping short of the face.
  // The coverage is 224°: the front 136° is left to the fringe and the side
  // locks, because hair does not hang in front of the chest.
  const NLOCK = 16;
  const A0 = Math.PI / 2 + 1.24;
  const SPAN = TAU - 2.48;
  const HEM = -0.505; // head-relative; ≈ world 1.07, just below the waist

  for (let i = 0; i < NLOCK; i++) {
    const u = i / (NLOCK - 1);
    const j = rnd() - 0.5;
    const a = A0 + u * SPAN;
    const front = Math.sin(a);
    const side = Math.abs(Math.cos(a));

    const thetaRoot = 0.80 + 0.26 * Math.max(0, -front) + 0.20 * side + 0.05 * j;
    const thetaHair = 1.38 + 0.34 * Math.max(0, -front) + 0.06 * j;

    // Sides flare past the shoulders, the back hangs closer in; every tip is
    // a slightly different length so the hem reads as layered points.
    const hemR = 0.094 + 0.062 * Math.pow(side, 1.25) + 0.009 * j;
    const hemY = HEM + 0.075 * Math.pow(side, 1.6) + 0.030 * Math.sin(i * 1.15 + 0.7) + 0.022 * j;

    const pts = lockPoints(a, {
      thetaRoot,
      thetaHair,
      hemR,
      hemY,
      bulge: 0.020 + 0.012 * side,
      tuck: 0.034 + 0.018 * side,
    });

    const w = 0.058 + 0.022 * side + 0.008 * j;
    addLock(g, pts, lockW(w, 0.026, 0.030), lockT(0.026, 0.014), {
      segs: 44,
      radial: 14,
      outline: 0.0011,
      round: 0.36,
    });
  }

  /* ------------------------------------------------------ second layer -- */
  // A sparse inner layer sitting *inside* the outer locks: it fills the gaps
  // that the outer layer's pointed hem leaves, and darkens the mass.
  for (let i = 0; i < 9; i++) {
    const u = i / 8;
    const j = rnd() - 0.5;
    const a = A0 + 0.10 + u * (SPAN - 0.20);
    const front = Math.sin(a);
    const side = Math.abs(Math.cos(a));
    const pts = lockPoints(a, {
      thetaRoot: 0.94 + 0.24 * Math.max(0, -front) + 0.10 * j,
      thetaHair: 1.46 + 0.30 * Math.max(0, -front),
      hemR: 0.084 + 0.052 * Math.pow(side, 1.4) + 0.008 * j,
      hemY: HEM - 0.015 + 0.060 * Math.pow(side, 1.6) + 0.04 * j,
      bulge: 0.022,
      tuck: 0.030,
    });
    addLock(g, pts, lockW(0.070 + 0.014 * side, 0.020, 0.028), lockT(0.022, 0.012), {
      segs: 34,
      radial: 12,
      outline: 0.0007,
      round: 0.30,
    });
  }

  /* ======================================================= FRONT LOCKS = */
  // The locks that fall beside the face. They must leave the skull at the
  // temple, where `|x| = sin(theta)·0.72·R` is already wider than the cheek —
  // rooted higher up the head they sweep straight across the eye.
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const j = rnd() - 0.5;
      const a = Math.PI / 2 + s * (1.30 + 0.20 * k + 0.04 * j);
      const pts = lockPoints(a, {
        thetaRoot: 1.30 + 0.10 * k + 0.04 * j,
        thetaHair: 1.54 + 0.08 * k,
        hemR: 0.140 + 0.026 * k + 0.009 * j,
        hemY: -0.26 - 0.13 * k - 0.06 * j,
        bulge: 0.018,
        tuck: 0.014,
      });
      addLock(g, pts, lockW(0.050 + 0.010 * k, 0.022, 0.026), lockT(0.024, 0.013), {
        segs: 40,
        radial: 14,
        outline: 0.0012,
        round: 0.38,
      });
    }
  }

  /* ------------------------------------------------------- sheen band -- */
  // The classic anime highlight: a light zig-zag ring where the hair catches
  // the key light, broken up so it does not read as a painted stripe.
  {
    const sheenGeo = surfaceShell({
      uSeg: 170,
      vSeg: 5,
      point: (u, v, out) => {
        const phi = Math.PI / 2 + (u - 0.5) * 3.35;
        const front = Math.sin(phi);
        const zig = 0.048 * Math.sin(u * Math.PI * 7) * (0.5 + 0.5 * Math.cos((u - 0.5) * Math.PI * 1.1));
        const theta = 0.60 + zig + v * 0.115;
        headSurface(theta, phi, R * (capSwell(front) + 0.055), out);
      },
      uv: (u, v) => [u * 6, v],
    });
    paintAlongV(sheenGeo, [
      [0.0, 0x4f4b90],
      [0.5, 0x8f8cd8],
      [1.0, 0x4a4690],
    ], { invert: true });
    const sheen = new THREE.Mesh(sheenGeo, assets().mat.hair);
    sheen.name = 'hairSheen';
    sheen.userData.noOutline = true;
    sheen.renderOrder = 1;
    g.add(sheen);
  }

  /* ============================================================= FRINGE = */
  // The bangs are ONE sheet, not a set of strands: a painted fringe is a
  // smooth mass with a pointed lower edge and a parting that lifts it clear of
  // the brow. Loose locks here always read as loose strands over the face.
  {
    const PART = 0.42; // parting position in `su` units (+1 = viewer's right)
    const fringeGeo = surfaceShell({
      uSeg: 168,
      vSeg: 24,
      closed: false,
      point: (u, v, out) => {
        const su = -1.34 + u * 2.32;
        const phi = Math.PI / 2 + su * 1.02;
        const front = Math.sin(phi);
        // the parting lifts the sheet, leaving the triangle of bare forehead
        const dip = 0.250 * Math.exp(-Math.pow((su - PART) / 0.58, 2));
        const thetaTop = 0.580 + 0.030 * front;
        // pointed tips: a slow zig-zag along the hem
        const thetaBot = 1.300 - dip + 0.042 * Math.abs(Math.sin(u * Math.PI * 6.0));
        const theta = lerp(thetaTop, thetaBot, v);
        // fine strand grooves so the sheet is not one flat plate
        const groove = 0.004 * Math.sin(u * Math.PI * 11 + v * 1.5);
        const r = R * (capSwell(front) + 0.052 + 0.022 * Math.sin(Math.PI * v) + groove);
        headSurface(theta, phi, r, out);
      },
      uv: (u, v) => [u * 5, v * 2],
    });
    paintByHeight(fringeGeo, FRINGE_RAMP, { smooth: 1 });
    shadeAcrossU(fringeGeo, { base: 0.86, gain: 0.14, curve: 0.5 });
    const fringe = new THREE.Mesh(fringeGeo, assets().mat.hair);
    fringe.name = 'fringe';
    fringe.castShadow = true;
    fringe.userData.noOutline = true;
    g.add(fringe);
    addOutline(fringe, { thickness: 0.0012, color: 0x3a3870 });
  }

  /* ======================================================= SIDE LOCKS = */
  // The locks in front of the ears: they close the gap between the fringe and
  // the mass and give the face its frame. Rooted at the temple for the same
  // reason as the front locks.
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const j = rnd() - 0.5;
      const a = Math.PI / 2 + s * (1.42 + 0.13 * k + 0.03 * j);
      const pts = lockPoints(a, {
        thetaRoot: 1.26 + 0.10 * k + 0.04 * j,
        thetaHair: 1.48 + 0.08 * k,
        hemR: 0.116 + 0.022 * k + 0.008 * j,
        hemY: -0.30 - 0.09 * k - 0.04 * j,
        bulge: 0.014,
        tuck: 0.014,
      });
      addLock(g, pts, lockW(0.032 + 0.006 * k, 0.013, 0.018), lockT(0.017, 0.010), {
        segs: 36,
        radial: 14,
        outline: 0.0009,
        round: 0.36,
      });
    }
  }

  return g;
}
