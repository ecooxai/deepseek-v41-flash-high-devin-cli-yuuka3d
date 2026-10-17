/**
 * Accessories: the dark halo, the white bow headband, and the big pillow
 * tucked under her arm.
 */
import * as THREE from 'three';
import { DIMS, PALETTE } from '../config.js';
import { assets } from '../assets.js';
import { addOutline } from '../materials.js';
import { surfaceShell, hairStrand, curveFromPoints, puffyBox, headSurface, lerp, smoothstep, TAU } from '../geometry.js';

const R = DIMS.headR;

/** radial swell of the scalp shell, shared with `hair.js` */
function capSwell(front) {
  return 1.095 + 0.055 * Math.max(0, -front) + 0.030 * Math.max(0, front);
}

/* --------------------------------------------------------------- halo --- */

export function buildHalo() {
  const A = assets();
  const g = new THREE.Group();
  g.name = 'halo';
  g.position.set(0, DIMS.headC + R * 1.60, -0.020);
  g.rotation.set(0.225, 0, 0.05);

  // A thin, wide band seen almost edge-on — the reference halo is a flat
  // hoop, not a fat donut, so the tube stays small against a large radius.
  const MAJOR = 0.152;
  const TUBE = 0.0038;

  const ring = new THREE.Mesh(new THREE.TorusGeometry(MAJOR, TUBE, 12, 132), A.mat.halo);
  ring.name = 'haloRing';
  ring.rotation.x = Math.PI / 2;
  ring.userData.noOutline = true;
  g.add(ring);

  // The lit inner edge: a hair-thin bright arc just inside the dark band.
  const rim = new THREE.Mesh(new THREE.TorusGeometry(MAJOR - TUBE * 1.75, TUBE * 0.34, 8, 116), A.mat.haloRim);
  rim.name = 'haloRim';
  rim.rotation.x = Math.PI / 2;
  rim.position.y = -TUBE * 0.35;
  rim.userData.noOutline = true;
  g.add(rim);

  return g;
}

/* ---------------------------------------------------------- headband --- */

export function buildHeadband() {
  const A = assets();
  const g = new THREE.Group();
  g.name = 'headband';

  /* -------------------------------------------------------- headband --- */
  // The reference wears a wide white band over the crown — a folded cloth
  // band, not a bonnet: it shows above the fringe and behind the ears.
  const bandGeo = surfaceShell({
    uSeg: 120,
    vSeg: 14,
    point: (u, v, out) => {
      const phi = u * TAU;
      const front = Math.sin(phi);
      const thetaTop = 0.335 + 0.055 * Math.max(0, front) + 0.020 * Math.sin(phi * 7);
      const thetaBot = 0.960 + 0.070 * Math.max(0, -front) + 0.030 * Math.sin(phi * 5 + 1.1);
      const theta = lerp(thetaTop, thetaBot, v);
      const rad = R * (1.176 + 0.030 * Math.sin(Math.PI * v) + 0.012 * Math.sin(phi * 9));
      headSurface(theta, phi, rad, out);
      return out;
    },
    uv: (u, v) => [u * 3, v * 2],
  });
  const bandMat = new THREE.MeshToonMaterial({
    color: PALETTE.trim,
    gradientMap: A.tex.gradSoft,
    side: THREE.DoubleSide,
  });
  const band = new THREE.Mesh(bandGeo, bandMat);
  band.name = 'headbandBand';
  band.castShadow = true;
  band.userData.noOutline = true;
  g.add(band);
  addOutline(band, { thickness: 0.0032, color: 0x9a9abd });

  /* ------------------------------------------------------------- bow --- */
  // A tied ribbon: each loop is a flat band swept around a closed teardrop
  // path, so it has a hole and a pointed tip like real folded cloth.
  const bow = new THREE.Group();
  bow.name = 'bow';
  bow.position.set(-0.012, R * 1.055, 0.036);
  bow.rotation.set(-0.66, 0.10, 0.12);

  for (const s of [-1, 1]) {
    const loop = new THREE.Mesh(
      ribbonLoop(s, { cx: 0.040, cy: 0.024, rx: 0.026, ry: 0.036, w: 0.0190, thick: 0.0088 }),
      bandMat
    );
    loop.name = 'bowLoop';
    loop.rotation.z = s * 0.30;
    loop.castShadow = true;
    loop.userData.noOutline = true;
    bow.add(loop);
    addOutline(loop, { thickness: 0.0026, color: 0x9a9abd });
  }

  const knot = new THREE.Mesh(puffyBox(0.026, 0.026, 0.021, { seg: 12, round: 0.55, bulge: 0.003 }), A.mat.trim);
  knot.name = 'bowKnot';
  knot.castShadow = true;
  knot.userData.noOutline = true;
  bow.add(knot);
  addOutline(knot, { thickness: 0.0022, color: 0x9a9abd });

  // two short ribbon tails hanging behind the knot
  for (const s of [-1, 1]) {
    const tail = new THREE.Mesh(
      hairStrand(
        curveFromPoints(
          [
            [s * 0.006, -0.004, -0.004],
            [s * 0.017, -0.020, -0.010],
            [s * 0.024, -0.040, -0.014],
          ].map((q) => new THREE.Vector3(q[0], q[1], q[2])),
          0.5
        ),
        (t) => 0.009 - 0.005 * t,
        (t) => 0.0040 - 0.0018 * t,
        { segs: 14, radial: 8 }
      ),
      bandMat
    );
    tail.name = 'bowTail';
    tail.userData.noOutline = true;
    bow.add(tail);
    addOutline(tail, { thickness: 0.0018, color: 0x9a9abd });
  }

  g.add(bow);
  return g;
}

/**
 * One bow loop: a flat ribbon swept around a closed, slightly teardrop path
 * (pinched where it meets the knot, full where it folds out).
 */
function ribbonLoop(s, { cx, cy, rx, ry, w, thick, segs = 84 }) {
  const Z = new THREE.Vector3(0, 0, 1);
  const pts = [];
  const N = 18;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    const k = 0.62 + 0.38 * (0.5 + 0.5 * Math.sin(a));
    pts.push(new THREE.Vector3(s * (cx + Math.cos(a) * rx * k), cy + Math.sin(a) * ry * k, 0));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true);
  curve.curveType = 'catmullrom';
  curve.tension = 0.5;

  const wd = new THREE.Vector3();
  return hairStrand(
    curve,
    (t) => w * (1 - 0.28 * Math.max(0, Math.sin(t * TAU))),
    () => thick,
    {
      segs,
      radial: 10,
      frameFn: (t, p, tg) => [wd.crossVectors(tg, Z).normalize().clone(), Z.clone()],
    }
  );
}

/* ------------------------------------------------------------- pillow --- */

export function pillowGeometry(w, h, d) {
  const geo = puffyBox(w, h, d, { seg: 46, round: 0.60 });
  const pos = geo.attributes.position;
  const hw = w / 2;
  const hh = h / 2;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const nx = Math.max(-1, Math.min(1, v.x / hw));
    const ny = Math.max(-1, Math.min(1, v.y / hh));
    // A real cushion is fat in the middle and pinches to a seam at the edge,
    // rather than being a uniform slab.
    const s = Math.pow(1 - nx * nx, 0.55) * Math.pow(1 - ny * ny, 0.55);
    v.z *= 0.22 + 0.78 * s;
    // soft stuffing ripples
    v.z += 0.011 * s * Math.sin(v.x * 21 + 0.7) * Math.sin(v.y * 13 + 1.9);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/** The stitched piping that runs around the cushion's edge. */
function pillowSeam(hw, hh, r, thick = 0.0060) {
  const pts = [];
  const N = 7;
  const corners = [
    [hw - r, hh - r, 0],
    [-(hw - r), hh - r, Math.PI / 2],
    [-(hw - r), -(hh - r), Math.PI],
    [hw - r, -(hh - r), Math.PI * 1.5],
  ];
  for (const [x, y, a0] of corners) {
    for (let i = 0; i <= N; i++) {
      const a = a0 + (i / N) * (Math.PI / 2);
      pts.push(new THREE.Vector3(x + Math.cos(a) * r, y + Math.sin(a) * r, 0));
    }
  }
  const curve = new THREE.CatmullRomCurve3(pts, true);
  curve.curveType = 'catmullrom';
  curve.tension = 0.5;
  const Z = new THREE.Vector3(0, 0, 1);
  const wd = new THREE.Vector3();
  return hairStrand(curve, () => thick, () => thick * 0.75, {
    segs: 160,
    radial: 8,
    frameFn: (t, p, tg) => [wd.crossVectors(tg, Z).normalize().clone(), Z.clone()],
  });
}

export function buildPillow() {
  const A = assets();
  const g = new THREE.Group();
  g.name = 'pillow';
  g.position.set(0.196, 0.640, 0.048);
  g.rotation.set(-0.04, 0.22, -0.16);

  const W = 0.290;
  const H = 0.520;
  const D = 0.200;

  const mesh = new THREE.Mesh(pillowGeometry(W, H, D), A.mat.pillow);
  mesh.name = 'pillowMesh';
  mesh.castShadow = true;
  addOutline(mesh, { thickness: 0.0026 });
  g.add(mesh);

  // Trace the silhouette `puffyBox` actually produces, so the piping sits on
  // the cushion's edge instead of floating outside its rounded corners.
  const ROUND = 0.60;
  const k = 1 - ROUND;
  const rr = Math.min(W, H, D) / 2;
  const seam = new THREE.Mesh(
    pillowSeam((W / 2) * k + rr * ROUND - 0.002, (H / 2) * k + rr * ROUND - 0.002, rr * ROUND * 0.85),
    A.mat.trimShade
  );
  seam.name = 'pillowSeam';
  seam.userData.noOutline = true;
  g.add(seam);

  return g;
}
