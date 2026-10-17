/**
 * Outfit: the pale-blue cat-print pyjama shirt with its notched collar,
 * button placket and chest pocket, plus the matching scalloped shorts and
 * short sleeves.
 */
import * as THREE from 'three';
import { assets } from '../assets.js';
import { addOutline } from '../materials.js';
import { surfaceShell, bilinearPatch, tubeAlongCurve, curveFromPoints, lerp, smoothstep, TAU } from '../geometry.js';
import { onTorso, frontDist } from './profile.js';
import { POSE } from './limbs.js';

const SHIRT_TOP = 1.402;
const SHIRT_BOTTOM = 0.985;
const V_START = 1.255;

/** Gentle cloth ripple so the pyjamas read as soft fabric, not plastic. */
function folds(a, y, amp = 0.0035) {
  return (
    amp * Math.sin(a * 7.0 + y * 26.0) * 0.6 +
    amp * Math.sin(a * 3.0 - y * 41.0 + 1.3) * 0.4
  );
}

/** half-angle of the V-neck opening at a given height */
function vHalfAngle(y) {
  if (y <= V_START) return 0;
  const t = Math.min(1, (y - V_START) / (SHIRT_TOP - V_START));
  return 0.055 + 0.235 * Math.pow(t, 0.90);
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
      const grow = 0.0085 + 0.0165 * smoothstep(0.0, 1.0, v);
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
  addOutline(shirt, { thickness: 0.0042 });
  g.add(shirt);

  /* --------------------------------------------------------- collar ----- */
  // Notched lapels: a strip that follows the V edge, the way a real pyjama
  // collar folds back, rather than a slab of white across the chest.
  for (const sgn of [1, -1]) {
    for (const [grow, mat, name, pad] of [
      [0.0355, A.mat.trimShade, 'collarRim', 0.0],
      [0.0385, A.mat.trim, 'collar', 0.012],
    ]) {
      const geo = surfaceShell({
        uSeg: 10,
        vSeg: 26,
        closed: false,
        flip: sgn > 0,
        point: (u, v, out) => {
          const y = lerp(1.410, 1.196, v);
          const inner = vHalfAngle(y) + 0.012 + pad;
          const outer = inner + 0.125 + 0.085 * (1 - v) - pad;
          const a = Math.PI / 2 + sgn * lerp(inner, outer, u);
          onTorso(a, y, grow + 0.006 * Math.sin(Math.PI * u), out);
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

  /* --------------------------------------------------------- placket ---- */
  const placketGeo = surfaceShell({
    uSeg: 10,
    vSeg: 26,
    closed: false,
    point: (u, v, out) => {
      const a = Math.PI / 2 + (u - 0.5) * 0.115;
      const y = lerp(0.992, 1.238, v);
      onTorso(a, y, 0.0325, out);
    },
    uv: (u, v) => [u, v * 3],
  });
  const placket = new THREE.Mesh(placketGeo, A.mat.trim);
  placket.name = 'placket';
  placket.userData.noOutline = true;
  g.add(placket);

  for (let i = 0; i < 5; i++) {
    const y = 1.185 - i * 0.048;
    const btn = new THREE.Mesh(new THREE.SphereGeometry(0.0068, 14, 12), A.mat.button);
    btn.name = 'button';
    onTorso(Math.PI / 2, y, 0.0385, btn.position);
    btn.scale.set(1, 1, 0.55);
    btn.lookAt(btn.position.clone().multiplyScalar(2).setY(btn.position.y));
    btn.userData.noOutline = true;
    g.add(btn);
  }

  /* ---------------------------------------------------------- pocket ---- */
  const pocketRim = bilinearPatch(
    onTorso(Math.PI / 2 - 0.66, 1.250, 0.036),
    onTorso(Math.PI / 2 - 0.30, 1.246, 0.036),
    onTorso(Math.PI / 2 - 0.30, 1.153, 0.036),
    onTorso(Math.PI / 2 - 0.66, 1.157, 0.036),
    { uSeg: 12, vSeg: 12, bulge: 0.004, normal: new THREE.Vector3(-0.45, 0, 1) }
  );
  const pocketRimMesh = new THREE.Mesh(pocketRim, A.mat.trimShade);
  pocketRimMesh.name = 'pocketRim';
  pocketRimMesh.userData.noOutline = true;
  g.add(pocketRimMesh);

  const pocket = bilinearPatch(
    onTorso(Math.PI / 2 - 0.645, 1.243, 0.0375),
    onTorso(Math.PI / 2 - 0.315, 1.239, 0.0375),
    onTorso(Math.PI / 2 - 0.315, 1.164, 0.0375),
    onTorso(Math.PI / 2 - 0.645, 1.168, 0.0375),
    { uSeg: 12, vSeg: 12, bulge: 0.005, normal: new THREE.Vector3(-0.45, 0, 1) }
  );
  const pocketMesh = new THREE.Mesh(pocket, A.mat.trim);
  pocketMesh.name = 'pocket';
  pocketMesh.userData.noOutline = true;
  g.add(pocketMesh);

  /* --------------------------------------------------------- shorts ----- */
  const shortsGeo = surfaceShell({
    uSeg: 104,
    vSeg: 40,
    point: (u, v, out) => {
      const a = u * TAU;
      const y = lerp(0.81, 1.068, v);
      const grow = 0.0115 + 0.008 * smoothstep(1.0, 0.0, v);
      onTorso(a, y, grow + folds(a, y, 0.0030), out);
    },
    uv: (u, v) => [u * 2.2, v * 2.2],
  });
  const shorts = new THREE.Mesh(shortsGeo, A.mat.pajama);
  shorts.name = 'shorts';
  shorts.castShadow = true;
  addOutline(shorts, { thickness: 0.0042 });
  g.add(shorts);

  // waistband
  const bandGeo = surfaceShell({
    uSeg: 104,
    vSeg: 6,
    point: (u, v, out) => {
      const a = u * TAU;
      const y = lerp(1.022, 1.074, v);
      onTorso(a, y, 0.026 - 0.004 * v, out);
    },
    uv: (u, v) => [u * 3, v],
  });
  const band = new THREE.Mesh(bandGeo, A.mat.trimShade);
  band.name = 'waistband';
  band.userData.noOutline = true;
  g.add(band);

  // short legs with scalloped hems
  for (const s of [-1, 1]) {
    const cx = s * 0.070;
    const geo = surfaceShell({
      uSeg: 64,
      vSeg: 26,
      flip: true, // v runs downward here, so the winding must be inverted
      point: (u, v, out) => {
        const a = u * TAU;
        const scallop = 0.017 * Math.abs(Math.sin(4 * a));
        const hemY = 0.760 - scallop;
        const y = lerp(0.900, hemY, v);
        const r = lerp(0.090, 0.088, v);
        const rr = r * (1 + 0.05 * smoothstep(0.7, 1.0, v));
        out.set(cx + rr * Math.cos(a), y, rr * Math.sin(a) * 0.94 + 0.004);
      },
      uv: (u, v) => [u * 1.6, v * 1.6],
    });
    const mesh = new THREE.Mesh(geo, A.mat.pajama);
    mesh.name = 'shortsLeg';
    mesh.castShadow = true;
    addOutline(mesh, { thickness: 0.004 });
    g.add(mesh);
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
        const tEnd = 0.315 + scallop * 0.55;
        const t = lerp(0.0, tEnd, v);
        const f = t * segs;
        const i0 = Math.min(segs, Math.floor(f));
        const i1 = Math.min(segs, i0 + 1);
        const k = f - i0;
        const P = curve.getPointAt(t, new THREE.Vector3());
        const N = frames.normals[i0].clone().lerp(frames.normals[i1], k).normalize();
        const B = frames.binormals[i0].clone().lerp(frames.binormals[i1], k).normalize();
        const base = lerp(0.0455, 0.0345, t);
        const r = base + 0.0090 + 0.0055 * v + 0.010 * Math.pow(v, 3);
        out.copy(P).addScaledVector(N, Math.cos(a) * r).addScaledVector(B, Math.sin(a) * r);
      },
      uv: (u, v) => [u * 1.4, v * 1.4],
    });
    const mesh = new THREE.Mesh(geo, A.mat.pajama);
    mesh.name = 'sleeve';
    mesh.castShadow = true;
    addOutline(mesh, { thickness: 0.004 });
    g.add(mesh);
  }

  return g;
}
