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
  g.rotation.set(0.11, 0, 0.05);

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
      // A folded cloth tied over the crown: its front edge sits at the
      // hairline so the bangs hang out from under it, and it drops to ear
      // level at the sides.
      const thetaTop = 0.140 + 0.060 * front + 0.020 * Math.sin(phi * 7);
      const thetaBot =
        0.840 + 0.520 * Math.abs(Math.cos(phi)) + 0.320 * Math.max(0, -Math.sin(phi)) +
        0.030 * Math.sin(phi * 5 + 1.1);
      const theta = lerp(thetaTop, thetaBot, v);
      // sits *inside* the fringe at the brow (so the bangs hide it) and
      // swells past the hair as it swings round to the sides and back
      const rad = R * (1.196 + 0.024 * Math.sin(Math.PI * v) + 0.010 * Math.sin(phi * 9));
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
      ribbonLoop(s, { cx: 0.050, cy: 0.026, rx: 0.030, ry: 0.044, w: 0.0225, thick: 0.0058 }),
      bandMat
    );
    loop.name = 'bowLoop';
    loop.rotation.z = s * 0.46;
    loop.castShadow = true;
    loop.userData.noOutline = true;
    bow.add(loop);
    addOutline(loop, { thickness: 0.0026, color: 0x9a9abd });
  }

  const knot = new THREE.Mesh(puffyBox(0.024, 0.024, 0.019, { seg: 12, round: 0.55, bulge: 0.003 }), A.mat.trim);
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
  const OUTLINE_E = 0.40; // in-plane exponent → rounded rectangle
  const POLE_E = 0.36; // axial exponent → flatter front and back

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
      const z = hd * sp(Math.sin(b), POLE_E);
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
  g.position.set(0.232, 0.470, 0.058);
  g.rotation.set(-0.05, 0.22, -0.56);

  const W = 0.300;
  const H = 0.438;
  const D = 0.204;

  const mesh = new THREE.Mesh(pillowGeometry(W, H, D), A.mat.pillow);
  mesh.name = 'pillowMesh';
  mesh.castShadow = true;
  addOutline(mesh, { thickness: 0.0020 });
  g.add(mesh);

  // Trace the silhouette `puffyBox` actually produces, so the piping sits on
  // the cushion's edge instead of floating outside its rounded corners.
  const seam = new THREE.Mesh(pillowSeam(W / 2 - 0.001, H / 2 - 0.001), A.mat.trimShade);
  seam.name = 'pillowSeam';
  seam.userData.noOutline = true;
  g.add(seam);

  return g;
}
