/**
 * Accessories: the dark halo, the white bow headband, and the big pillow
 * tucked under her arm.
 */
import * as THREE from 'three';
import { DIMS, PALETTE } from '../config.js';
import { assets } from '../assets.js';
import { addOutline } from '../materials.js';
import { surfaceShell, hairStrand, curveFromPoints, puffyBox, headSurface, weldVertices, lerp, smoothstep, TAU } from '../geometry.js';

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
  g.position.set(0, DIMS.headC + R * 1.87, -0.020);
  g.rotation.set(0.225, 0, 0.05);

  // A thin, wide band seen almost edge-on — the reference halo is a flat
  // hoop, not a fat donut, so the tube stays small against a large radius.
  const MAJOR = 0.186;
  const TUBE = 0.0062;

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
      const front = Math.max(0, Math.sin(phi));
      const away = 1 - front;
      // A white hood knotted at the crown: it stops above the brow at the
      // front (the forehead is bare in the reference) and drops past the ears
      // at the sides and back.
      const thetaTop = 0.095 + 0.045 * front + 0.004 * Math.sin(phi * 3);
      const thetaBot =
        0.700 + 1.180 * Math.abs(Math.cos(phi)) + 0.880 * Math.max(0, -Math.sin(phi)) +
        0.003 * Math.sin(phi * 3 + 1.1);
      const theta = lerp(thetaTop, thetaBot, v);
      // sits *inside* the fringe at the brow (so the bangs hide it) and
      // swells past the hair as it swings round to the sides and back
      // Hidden behind the hair at the brow, visible past it at the sides
      // and back — the hood is a mass *around* the head, not a cap on top.
      const rad = R * (1.150 + 0.330 * Math.pow(away, 1.05) + 0.014 * Math.sin(Math.PI * v));
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

  // Each loop is a solid ribbon blade sweeping up and out from the knot,
  // tapering to a point — the way a tied bow is actually drawn. Sweeping a
  // flat ribbon around a closed path instead leaves a hole and reads as a
  // pair of doughnuts.
  for (const s of [-1, 1]) {
    const blade = curveFromPoints(
      [
        [0, 0.004, 0.002],
        [s * 0.030, 0.020, -0.004],
        [s * 0.056, 0.038, -0.009],
        [s * 0.080, 0.054, -0.012],
      ],
      0.5
    );
    const loop = new THREE.Mesh(
      hairStrand(
        blade,
        (t) => 0.008 + 0.030 * Math.sin(Math.PI * Math.min(1, t * 1.06)) - 0.018 * t * t,
        (t) => 0.0054 - 0.0026 * t,
        { segs: 30, radial: 12 }
      ),
      bandMat
    );
    loop.name = 'bowLoop';
    loop.rotation.z = s * 0.10;
    loop.castShadow = true;
    loop.userData.noOutline = true;
    bow.add(loop);
    addOutline(loop, { thickness: 0.0024, color: 0x9a9abd });
  }

  const knot = new THREE.Mesh(puffyBox(0.024, 0.021, 0.018, { seg: 12, round: 0.5, bulge: 0.003 }), A.mat.trim);
  knot.position.set(0, 0.006, 0.006);
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
  const hw = w / 2;
  const hh = h / 2;
  const hd = d / 2;
  // A superellipsoid rather than a spherified cube: the cube's six patches
  // leave visible panel creases across the cushion's face.
  const sp = (a, e) => Math.sign(a) * Math.pow(Math.abs(a), e);
  const OUTLINE_E = 0.30; // in-plane exponent → rounded rectangle
  const POLE_E = 0.40; // axial exponent → flatter front and back

  // Weld the poles: `surfaceShell` leaves uSeg coincident vertices at each
  // pole, each with its own normal, which fans out into a visible pinwheel.
  return weldVertices(surfaceShell({
    uSeg: 96,
    vSeg: 56,
    flip: true, // this parametrisation winds inward
    point: (u, v, out) => {
      const a = u * TAU;
      const b = -Math.PI / 2 + v * Math.PI;
      const taper = Math.pow(Math.max(0, Math.cos(b)), 0.52);
      const x = hw * sp(Math.cos(a), OUTLINE_E) * taper;
      const y = hh * sp(Math.sin(a), OUTLINE_E) * taper;
      let z = hd * sp(Math.sin(b), POLE_E);
      const nx = x / hw;
      const ny = y / hh;
      const cr = (cx, cy) => Math.sin(Math.hypot(nx - cx, ny - cy) * 5.6);
      z += hd * 0.085 * (cr(0.95, 0.95) + cr(-0.95, 0.95) + cr(0.95, -0.95) + cr(-0.95, -0.95)) * Math.abs(taper);
      out.set(x, y, z);
    },
    uv: (u, v) => [u * 2, v * 2],
  }));
}

/** The stitched piping that runs around the cushion's edge. */
function pillowSeam(hw, hh, thick = 0.0058) {
  const sp = (a, e) => Math.sign(a) * Math.pow(Math.abs(a), e);
  const pts = [];
  const N = 84;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    pts.push(new THREE.Vector3(hw * sp(Math.cos(a), 0.40), hh * sp(Math.sin(a), 0.40), 0));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true);
  curve.curveType = 'catmullrom';
  curve.tension = 0.5;
  const Z = new THREE.Vector3(0, 0, 1);
  const wd = new THREE.Vector3();
  return hairStrand(curve, () => thick, () => thick * 0.7, {
    segs: 180,
    radial: 8,
    frameFn: (t, p, tg) => [wd.crossVectors(tg, Z).normalize().clone(), Z.clone()],
  });
}

export function buildPillow() {
  const A = assets();
  const g = new THREE.Group();
  g.name = 'pillow';
  g.position.set(0.208, 0.520, 0.020);
  g.rotation.set(-0.06, 0.52, -0.44);

  const W = 0.268;
  const H = 0.372;
  const D = 0.180;

  const pillowGeo = pillowGeometry(W, H, D);
  // Bake a vertical gradient: the cushion is brightest where the key light
  // catches its top and cools off toward the underside, like the reference.
  {
    const pos = pillowGeo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const top = new THREE.Color(0xffffff);
    const bot = new THREE.Color(0xcfdaf0);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getY(i) / (H / 2) + 1) * 0.5;
      c.copy(bot).lerp(top, Math.pow(Math.max(0, Math.min(1, t)), 0.65));
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    pillowGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }
  const mesh = new THREE.Mesh(pillowGeo, A.mat.pillow);
  mesh.name = 'pillowMesh';
  mesh.castShadow = true;
  addOutline(mesh, { thickness: 0.0026, color: 0x8e94bd });
  g.add(mesh);

  // Trace the silhouette `puffyBox` actually produces, so the piping sits on
  // the cushion's edge instead of floating outside its rounded corners.
  const seam = new THREE.Mesh(pillowSeam(W / 2 - 0.001, H / 2 - 0.001), A.mat.trimShade);
  seam.name = 'pillowSeam';
  seam.userData.noOutline = true;
  g.add(seam);

  return g;
}
