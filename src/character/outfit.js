/**
 * Outfit: the pale-blue cat-print pyjama shirt with its notched collar,
 * button placket and chest pocket, plus the matching scalloped shorts and
 * short sleeves.
 */
import * as THREE from 'three';
import { assets } from '../assets.js';
import { addOutline } from '../materials.js';
import { surfaceShell, bilinearPatch, tubeAlongCurve, curveFromPoints, hairStrand, lerp, smoothstep, TAU } from '../geometry.js';
import { onTorso, frontDist, torsoRadius } from './profile.js';
import { POSE, ARM_RADIUS } from './limbs.js';

const SHIRT_TOP = 1.402;
const SHIRT_BOTTOM = 1.005;
const V_START = 1.268;

/** Gentle cloth ripple so the pyjamas read as soft fabric, not plastic. */
function folds(a, y, amp = 0.0035) {
  return (
    amp * Math.sin(a * 7.0 + y * 26.0) * 0.6 +
    amp * Math.sin(a * 3.0 - y * 41.0 + 1.3) * 0.4
  );
}

/**
 * The shirt's own outward offset at a given height. Every detail drawn on the
 * shirt — collar, placket, pocket, buttons — has to sit *proud of this*, or it
 * is swallowed by the garment shell.
 */
const shirtGrow = (y) => 0.0760 - 0.0450 * smoothstep(SHIRT_BOTTOM, SHIRT_TOP, y);

/** half-angle of the V-neck opening at a given height */
function vHalfAngle(y) {
  if (y <= V_START) return 0;
  const t = Math.min(1, (y - V_START) / (SHIRT_TOP - V_START));
  return 0.050 + 0.195 * Math.pow(t, 0.85);
}

export function buildOutfit() {
  const A = assets();
  const g = new THREE.Group();
  g.name = 'outfit';

  /* ------------------------------------------------------- torso skin -- */
  const skinGeo = surfaceShell({
    uSeg: 96,
    vSeg: 56,
    point: (u, v, out) => {
      const a = u * TAU;
      const y = lerp(0.80, 1.470, v);
      onTorso(a, y, 0, out);
    },
    uv: (u, v) => [u * 3, v * 3],
  });
  const skin = new THREE.Mesh(skinGeo, A.mat.skin);
  skin.name = 'torsoSkin';
  skin.castShadow = true;
  skin.userData.noOutline = true;
  g.add(skin);

  /* ------------------------------------------------------ pyjama shirt -- */
  const shirtGeo = surfaceShell({
    uSeg: 120,
    vSeg: 54,
    point: (u, v, out) => {
      const a = u * TAU;
      const y = lerp(SHIRT_BOTTOM, SHIRT_TOP, v);
      // A-line: the shirt flares out over the shorts and stops at the
      // waist, so its hem casts a shadow across the top of the bloomers.
      const grow = shirtGrow(y);
      onTorso(a, y, grow + folds(a, y, 0.0034), out);
    },
    uv: (u, v) => [u * 2.2, v * 2.2],
    skip: (u, v) => {
      const a = u * TAU;
      const y = lerp(SHIRT_BOTTOM, SHIRT_TOP, v);
      return Math.abs(frontDist(a)) < vHalfAngle(y);
    },
  });
  const shirt = new THREE.Mesh(shirtGeo, A.mat.pajama);
  shirt.name = 'shirt';
  shirt.castShadow = true;
  addOutline(shirt, { thickness: 0.0034 });
  g.add(shirt);

  // The shirt is a tube, so its top edge would leave a ring of daylight
  // between the collar and the neck. A sloped yoke closes it and gives the
  // garment actual shoulders.
  {
    const [rx, rz] = torsoRadius(SHIRT_TOP);
    const ease = shirtGrow(SHIRT_TOP);
    const geo = surfaceShell({
      uSeg: 96,
      vSeg: 12,
      flip: true,
      point: (u, v, out) => {
        const a = u * TAU;
        const k = 1 - Math.pow(1 - v, 2.0);
        out.set(
          lerp(rx + ease, 0.036, k) * Math.cos(a),
          lerp(SHIRT_TOP - 0.004, 1.452, k),
          lerp(rz + ease, 0.034, k) * Math.sin(a)
        );
      },
      uv: (u, v) => [u * 3, v],
    });
    const yoke = new THREE.Mesh(geo, A.mat.pajama);
    yoke.name = 'shirtYoke';
    yoke.castShadow = true;
    yoke.userData.noOutline = true;
    g.add(yoke);
  }

  /* --------------------------------------------------------- collar ----- */
  // Notched lapels: a strip that follows the V edge, the way a real pyjama
  // collar folds back, rather than a slab of white across the chest.
  for (const sgn of [1, -1]) {
    for (const [extra, mat, name, pad] of [
      [0.0025, A.mat.trimShade, 'collarRim', 0.0],
      [0.0050, A.mat.trim, 'collar', 0.014],
    ]) {
      const geo = surfaceShell({
        uSeg: 10,
        vSeg: 26,
        closed: false,
        flip: sgn > 0,
        point: (u, v, out) => {
          const y = lerp(1.412, 1.268, v);
          const inner = vHalfAngle(y) + 0.012 + pad;
          const outer = inner + 0.150 + 0.075 * (1 - v) - pad;
          const a = Math.PI / 2 + sgn * lerp(inner, outer, u);
          onTorso(a, y, shirtGrow(y) + extra + 0.006 * Math.sin(Math.PI * u), out);
        },
        uv: (u, v) => [u, v * 3],
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = name;
      mesh.castShadow = name === 'collar';
      mesh.userData.noOutline = true;
      g.add(mesh);
    }
  }

  // the collar band that runs around the back of the neck
  {
    const neckBand = surfaceShell({
      uSeg: 72,
      vSeg: 6,
      closed: false,
      point: (u, v, out) => {
        const a = Math.PI / 2 + 0.28 + u * (TAU - 0.56);
        const y = lerp(1.334, 1.396, v);
        onTorso(a, y, shirtGrow(y) + 0.0050, out);
      },
      uv: (u, v) => [u * 3, v],
    });
    const neckBandMesh = new THREE.Mesh(neckBand, A.mat.trim);
    neckBandMesh.name = 'collarBack';
    neckBandMesh.userData.noOutline = true;
    g.add(neckBandMesh);
  }

  /* --------------------------------------------------------- placket ---- */
  const placketGeo = surfaceShell({
    uSeg: 10,
    vSeg: 26,
    closed: false,
    point: (u, v, out) => {
      const a = Math.PI / 2 + (u - 0.5) * 0.052;
      const y = lerp(1.028, 1.212, v);
      onTorso(a, y, shirtGrow(y) + 0.0040, out);
    },
    uv: (u, v) => [u, v * 3],
  });
  const placket = new THREE.Mesh(placketGeo, A.mat.trimShade);
  placket.name = 'placket';
  placket.userData.noOutline = true;
  g.add(placket);

  for (let i = 0; i < 3; i++) {
    const y = 1.170 - i * 0.062;
    const btn = new THREE.Mesh(new THREE.SphereGeometry(0.0088, 14, 12), A.mat.button);
    btn.name = 'button';
    onTorso(Math.PI / 2, y, shirtGrow(y) + 0.0105, btn.position);
    btn.scale.set(1, 1, 0.55);
    btn.lookAt(btn.position.clone().multiplyScalar(2).setY(btn.position.y));
    btn.userData.noOutline = true;
    g.add(btn);
  }

  /* ---------------------------------------------------------- pocket ---- */
  const pocketRim = bilinearPatch(
    onTorso(Math.PI / 2 - 0.66, 1.246, shirtGrow(1.246) + 0.004),
    onTorso(Math.PI / 2 - 0.30, 1.242, shirtGrow(1.242) + 0.004),
    onTorso(Math.PI / 2 - 0.30, 1.130, shirtGrow(1.130) + 0.004),
    onTorso(Math.PI / 2 - 0.66, 1.134, shirtGrow(1.134) + 0.004),
    { uSeg: 12, vSeg: 12, bulge: 0.004, normal: new THREE.Vector3(-0.45, 0, 1) }
  );
  const pocketRimMesh = new THREE.Mesh(pocketRim, A.mat.trimShade);
  pocketRimMesh.name = 'pocketRim';
  pocketRimMesh.userData.noOutline = true;
  g.add(pocketRimMesh);

  const pocket = bilinearPatch(
    onTorso(Math.PI / 2 - 0.645, 1.239, shirtGrow(1.239) + 0.0055),
    onTorso(Math.PI / 2 - 0.315, 1.235, shirtGrow(1.235) + 0.0055),
    onTorso(Math.PI / 2 - 0.315, 1.141, shirtGrow(1.141) + 0.0055),
    onTorso(Math.PI / 2 - 0.645, 1.145, shirtGrow(1.145) + 0.0055),
    { uSeg: 12, vSeg: 12, bulge: 0.005, normal: new THREE.Vector3(-0.45, 0, 1) }
  );
  const pocketMesh = new THREE.Mesh(pocket, A.mat.trim);
  pocketMesh.name = 'pocket';
  pocketMesh.userData.noOutline = true;
  g.add(pocketMesh);

  /* --------------------------------------------------------- shorts ----- */
  // Bloomers, not a nightgown skirt: the shorts have to be *wider* than the
  // shirt hem all the way down, or the two garments merge into one silhouette.
  // The puff grows toward the hem and a ruffle flounce flares past it.
  const shortsGeo = surfaceShell({
    uSeg: 104,
    vSeg: 40,
    point: (u, v, out) => {
      const a = u * TAU;
      const y = lerp(0.718, 1.040, v);
      // widest just above the hem, then a slight tuck: bloomers balloon in
      // the middle and gather in again at the ruffle
      const grow = 0.028 + 0.062 * Math.pow(1 - v, 0.50);
      onTorso(a, y, grow + folds(a, y, 0.0030), out);
    },
    uv: (u, v) => [u * 2.2, v * 2.2],
  });
  const shorts = new THREE.Mesh(shortsGeo, A.mat.pajama);
  shorts.name = 'shorts';
  shorts.castShadow = true;
  addOutline(shorts, { thickness: 0.0042 });
  g.add(shorts);

  // The top of the bloomers sits in the shirt's shadow — without this the two
  // garments are the same fabric and read as one long nightdress.
  {
    const geo = surfaceShell({
      uSeg: 104,
      vSeg: 10,
      point: (u, v, out) => {
        const a = u * TAU;
        const y = lerp(1.006, 0.936, v);
        const gv = (y - 0.718) / 0.322;
        onTorso(a, y, 0.028 + 0.062 * Math.pow(1 - gv, 0.50) + 0.0042 + folds(a, y, 0.0030), out);
      },
      uv: (u, v) => [u * 2.2, v],
    });
    const mesh = new THREE.Mesh(geo, A.mat.pajamaDeep);
    mesh.name = 'shortsShadow';
    mesh.userData.noOutline = true;
    g.add(mesh);
  }

  // waistband
  const bandGeo = surfaceShell({
    uSeg: 104,
    vSeg: 6,
    point: (u, v, out) => {
      const a = u * TAU;
      const y = lerp(0.988, 1.028, v);
      onTorso(a, y, 0.030 - 0.004 * v, out);
    },
    uv: (u, v) => [u * 3, v],
  });
  const band = new THREE.Mesh(bandGeo, A.mat.trimShade);
  band.name = 'waistband';
  band.userData.noOutline = true;
  g.add(band);

  // The flounce: a separate ring that flares out below the shorts and ends in
  // a row of round scallops — the reference's bloomers have a gathered ruffle,
  // not a straight cut hem.
  {
    const NS = 9;
    const geo = surfaceShell({
      uSeg: 132,
      vSeg: 22,
      flip: true, // v runs downward
      point: (u, v, out) => {
        const a = u * TAU;
        const scallop = 0.019 * Math.pow(Math.abs(Math.sin((a * NS) / 2)), 0.7);
        const y = lerp(0.800, 0.726 - scallop, v);
        const grow = 0.090 + 0.008 * Math.pow(v, 0.65) + folds(a, y, 0.0022);
        onTorso(a, y, grow, out);
      },
      uv: (u, v) => [u * 2.2, v * 1.4],
    });
    const mesh = new THREE.Mesh(geo, A.mat.pajama);
    mesh.name = 'shortsRuffle';
    mesh.castShadow = true;
    addOutline(mesh, { thickness: 0.0036 });
    g.add(mesh);
  }

  // the drawstring bow on the left hip
  {
    const bow = new THREE.Group();
    bow.name = 'hipBow';
    const P = onTorso(Math.PI / 2 + 1.02, 1.000, 0.058);
    bow.position.copy(P);
    bow.rotation.set(0.10, -0.72, 0.55);
    for (const s of [-1, 1]) {
      const loop = new THREE.Mesh(new THREE.SphereGeometry(0.0135, 14, 12), A.mat.trim);
      loop.name = 'hipBowLoop';
      loop.position.set(s * 0.014, 0.004, 0.001);
      loop.scale.set(1.0, 0.66, 0.60);
      loop.rotation.z = s * 0.32;
      bow.add(loop);
    }
    for (const s of [-1, 1]) {
      const tail = new THREE.Mesh(
        hairStrand(
          curveFromPoints([[0, -0.002, 0], [s * 0.011, -0.030, -0.003], [s * 0.019, -0.058, -0.006]], 0.5),
          (t) => 0.0075 - 0.0035 * t,
          (t) => 0.0032 - 0.0014 * t,
          { segs: 12, radial: 8 }
        ),
        A.mat.trim
      );
      tail.name = 'hipBowTail';
      bow.add(tail);
    }
    bow.traverse((o) => {
      if (o.isMesh) o.userData.noOutline = true;
    });
    g.add(bow);
  }

  /* --------------------------------------------------------- sleeves ---- */
  for (const pose of [POSE.armRaised, POSE.armDown]) {
    const curve = curveFromPoints(pose.points, 0.5);
    const segs = 26;
    const frames = curve.computeFrenetFrames(segs, false);
    const geo = surfaceShell({
      uSeg: 40,
      vSeg: segs,
      flip: true,
      point: (u, v, out) => {
        const a = u * TAU;
        const scallop = 0.055 * Math.abs(Math.sin(3.2 * a));
        const tEnd = 0.365 + scallop * 0.66;
        const t = lerp(0.0, tEnd, v);
        const f = t * segs;
        const i0 = Math.min(segs, Math.floor(f));
        const i1 = Math.min(segs, i0 + 1);
        const k = f - i0;
        const P = curve.getPointAt(t, new THREE.Vector3());
        const N = frames.normals[i0].clone().lerp(frames.normals[i1], k).normalize();
        const B = frames.binormals[i0].clone().lerp(frames.binormals[i1], k).normalize();
        // the cuff sits snug against the arm at the shoulder so the sleeve's
        // open end never shows its hollow interior
        const rPuffed =
          lerp(0.0432, 0.0355, t) +
          0.0125 * smoothstep(0.0, 0.26, t) +
          0.0095 * v +
          0.046 * Math.pow(v, 3);
        // Close the cuff down onto the arm at the very end: an open ring shows
        // the outline shell's interior as a dark flat wedge.
        const r = lerp(rPuffed, ARM_RADIUS(t) + 0.0015, smoothstep(0.88, 1.0, v));
        out.copy(P).addScaledVector(N, Math.cos(a) * r).addScaledVector(B, Math.sin(a) * r);
      },
      uv: (u, v) => [u * 1.4, v * 1.4],
    });
    const mesh = new THREE.Mesh(geo, A.mat.pajama);
    mesh.name = 'sleeve';
    mesh.castShadow = true;
    addOutline(mesh, { thickness: 0.0032 });
    g.add(mesh);
  }

  return g;
}
