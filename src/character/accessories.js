/**
 * Accessories: the dark halo, the white bow headband, and the big pillow
 * tucked under her arm.
 */
import * as THREE from 'three';
import { DIMS, PALETTE } from '../config.js';
import { assets } from '../assets.js';
import { addOutline } from '../materials.js';
import { surfaceShell, hairStrand, curveFromPoints, puffyBox, paintAlongV, lerp, smoothstep, TAU } from '../geometry.js';

const R = DIMS.headR;

/* --------------------------------------------------------------- halo --- */

export function buildHalo() {
  const A = assets();
  const g = new THREE.Group();
  g.name = 'halo';
  g.position.set(0, DIMS.headC + R * 1.68, -0.014);
  g.rotation.set(0.195, 0, 0.045);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.0072, 16, 96), A.mat.halo);
  ring.name = 'haloRing';
  ring.rotation.x = Math.PI / 2;
  ring.userData.noOutline = true;
  g.add(ring);

  const glowMat = new THREE.MeshBasicMaterial({
    color: PALETTE.haloGlow,
    transparent: true,
    opacity: 0.055,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const glow = new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.013, 12, 72), glowMat);
  glow.name = 'haloGlow';
  glow.rotation.x = Math.PI / 2;
  glow.userData.noOutline = true;
  g.add(glow);

  return g;
}

/* ---------------------------------------------------------- headband --- */

export function buildHeadband() {
  const A = assets();
  const g = new THREE.Group();
  g.name = 'headband';

  const top = new THREE.Vector3(0, 1, 0);
  const vdir = new THREE.Vector3(0.973, 0, 0.230).normalize();
  const nrm = new THREE.Vector3(0.230, 0, -0.973).normalize();

  const bandGeo = surfaceShell({
    uSeg: 6,
    vSeg: 64,
    closed: false,
    point: (u, v, out) => {
      const b = lerp(-1.66, 1.66, v);
      const w = (u - 0.5) * 0.46;
      out.copy(top).multiplyScalar(Math.cos(b)).addScaledVector(vdir, Math.sin(b)).addScaledVector(nrm, w);
      out.normalize().multiplyScalar(R * (1.125 + 0.012 * Math.cos(b * 1.6)));
      return out;
    },
    uv: (u, v) => [u, v * 6],
  });
  const bandMat = new THREE.MeshToonMaterial({
    color: PALETTE.trim,
    gradientMap: A.tex.gradSoft,
    side: THREE.DoubleSide,
  });
  const band = new THREE.Mesh(bandGeo, bandMat);
  band.name = 'headbandBand';
  band.userData.noOutline = true;
  g.add(band);

  /* ------------------------------------------------------------- bow --- */
  // A plump ribbon bow: two rounded lobes splayed up-and-out plus a knot.
  const bow = new THREE.Group();
  bow.name = 'bow';
  bow.position.set(0, R * 1.14, -0.026);
  bow.rotation.set(-0.34, 0, 0.02);

  const lobeGeo = new THREE.SphereGeometry(1, 26, 20);
  for (const s of [-1, 1]) {
    const lobe = new THREE.Mesh(lobeGeo, A.mat.trim);
    lobe.name = 'bowLobe';
    lobe.scale.set(0.086, 0.050, 0.028);
    lobe.position.set(s * 0.070, 0.026, -0.002);
    lobe.rotation.set(0, -s * 0.24, s * 0.52);
    lobe.castShadow = true;
    lobe.userData.noOutline = true;
    bow.add(lobe);
    addOutline(lobe, { thickness: 0.0028, color: 0x9a9abd });
  }

  const knot = new THREE.Mesh(puffyBox(0.042, 0.044, 0.040, { seg: 12, round: 0.55, bulge: 0.006 }), A.mat.trim);
  knot.name = 'bowKnot';
  knot.position.set(0, 0.000, 0.020);
  knot.castShadow = true;
  knot.userData.noOutline = true;
  bow.add(knot);
  addOutline(knot, { thickness: 0.0028, color: 0x9a9abd });

  // two short ribbon tails hanging behind the knot
  for (const s of [-1, 1]) {
    const tail = new THREE.Mesh(
      hairStrand(
        curveFromPoints(
          [
            [s * 0.010, 0.000, -0.004],
            [s * 0.026, -0.022, -0.010],
            [s * 0.034, -0.046, -0.014],
          ].map((q) => new THREE.Vector3(q[0], q[1], q[2])),
          0.5
        ),
        (t) => 0.014 - 0.008 * t,
        (t) => 0.006 - 0.003 * t,
        { segs: 14, radial: 8 }
      ),
      A.mat.trim
    );
    tail.name = 'bowTail';
    tail.userData.noOutline = true;
    bow.add(tail);
    addOutline(tail, { thickness: 0.0022, color: 0x9a9abd });
  }

  g.add(bow);
  return g;
}

/* ------------------------------------------------------------- pillow --- */

export function pillowGeometry(w, h, d) {
  const geo = puffyBox(w, h, d, { seg: 24, round: 0.46, bulge: 0.012 });
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const yn = v.y / (h / 2);
    const taper = 1 - 0.11 * smoothstep(0.15, 1.0, yn);
    v.x *= taper;
    v.z *= taper;
    n.copy(v).normalize();
    const wob =
      0.0034 * Math.sin(v.x * 26 + 1.2) * Math.sin(v.y * 15) * Math.sin(v.z * 21) +
      0.0020 * Math.sin(v.y * 33 + 0.4);
    v.addScaledVector(n, wob);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

export function buildPillow() {
  const A = assets();
  const g = new THREE.Group();
  g.name = 'pillow';
  g.position.set(0.182, 0.545, 0.096);
  g.rotation.set(-0.05, 0.26, -0.26);

  const geo = pillowGeometry(0.246, 0.530, 0.222);
  const mesh = new THREE.Mesh(geo, A.mat.pillow);
  mesh.name = 'pillowMesh';
  mesh.castShadow = true;
  addOutline(mesh, { thickness: 0.0045 });
  g.add(mesh);

  return g;
}
