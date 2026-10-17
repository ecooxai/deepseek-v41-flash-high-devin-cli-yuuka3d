/**
 * Head: sculpted skull, ears, and flat-shaded face decals (eyes, blush, mouth)
 * placed directly on the sculpted surface so they hug the form exactly.
 */
import * as THREE from 'three';
import { DIMS } from '../config.js';
import { assets } from '../assets.js';
import { addOutline } from '../materials.js';
import { deformHead, headSurface, surfaceShell, TAU } from '../geometry.js';

const R = DIMS.headR;

/**
 * A rectangular patch that follows the deformed head surface.
 * u runs left→right (phi), v runs top→bottom (theta).
 */
function facePatch({ thetaC, phiC, dTheta, dPhi, offset = 0.0012, uSeg = 28, vSeg = 28 }) {
  const p = new THREE.Vector3();
  const pa = new THREE.Vector3();
  const pb = new THREE.Vector3();
  const n = new THREE.Vector3();
  const eps = 2e-3;
  const surf = (theta, phi, out) => {
    headSurface(theta, phi, R, out);
    headSurface(theta + eps, phi, R, pa);
    headSurface(theta, phi + eps, R, pb);
    n.copy(pa).sub(out).cross(pb.clone().sub(out)).normalize();
    if (n.dot(out) < 0) n.negate();
    return out.addScaledVector(n, offset);
  };
  return surfaceShell({
    uSeg,
    vSeg,
    closed: false,
    point: (u, v, out) => surf(thetaC - dTheta / 2 + v * dTheta, phiC - dPhi / 2 + u * dPhi, out),
    uv: (u, v) => [u, 1 - v],
  });
}

export function buildHead() {
  const A = assets();
  const g = new THREE.Group();
  g.name = 'head';

  /* ---------------------------------------------------------- skull ---- */
  const skullGeo = deformHead(new THREE.SphereGeometry(R, 96, 72), R);
  const skull = new THREE.Mesh(skullGeo, A.mat.skin);
  skull.name = 'skull';
  skull.castShadow = true;
  addOutline(skull, { thickness: 0.0035 });
  g.add(skull);

  /* ----------------------------------------------------------- ears ---- */
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(R * 0.3, 20, 16), A.mat.skin);
    ear.name = 'ear';
    ear.scale.set(0.38, 1.05, 0.8);
    headSurface(1.62, Math.PI / 2 + s * 1.34, R * 0.93, ear.position);
    ear.rotation.y = -s * 0.35;
    ear.rotation.z = s * 0.2;
    g.add(ear);
  }

  /* ----------------------------------------------------------- eyes ---- */
  const eyeTheta = 1.548;
  const eyePhiOff = 0.318;
  const eyeW = 0.70;
  const eyeH = 0.575;
  for (const s of [-1, 1]) {
    const phiC = Math.PI / 2 + s * eyePhiOff;
    const geo = facePatch({
      thetaC: eyeTheta,
      phiC,
      dTheta: eyeH,
      dPhi: eyeW,
      offset: 0.0014,
      uSeg: 32,
      vSeg: 32,
    });
    const m = new THREE.Mesh(geo, s < 0 ? A.mat.eyeL : A.mat.eyeR);
    m.name = 'eye' + (s < 0 ? 'L' : 'R');
    m.renderOrder = 3;
    m.userData.noOutline = true;
    g.add(m);
  }

  /* ---------------------------------------------------------- blush ---- */
  for (const s of [-1, 1]) {
    const geo = facePatch({
      thetaC: 1.80,
      phiC: Math.PI / 2 + s * 0.58,
      dTheta: 0.22,
      dPhi: 0.34,
      offset: 0.001,
      uSeg: 16,
      vSeg: 16,
    });
    const m = new THREE.Mesh(geo, A.mat.blush);
    m.name = 'blush';
    m.renderOrder = 2;
    m.userData.noOutline = true;
    g.add(m);
  }

  /* ---------------------------------------------------------- mouth ---- */
  const mouth = new THREE.Mesh(
    facePatch({ thetaC: 1.92, phiC: Math.PI / 2, dTheta: 0.125, dPhi: 0.19, offset: 0.0011, uSeg: 16, vSeg: 12 }),
    A.mat.mouth
  );
  mouth.name = 'mouth';
  mouth.renderOrder = 3;
  mouth.userData.noOutline = true;
  g.add(mouth);

  /* ----------------------------------------------------------- nose ---- */
  const nose = new THREE.Mesh(new THREE.SphereGeometry(R * 0.05, 12, 10), A.mat.skinSoft);
  nose.name = 'nose';
  headSurface(1.77, Math.PI / 2, R, nose.position);
  nose.scale.set(0.62, 0.5, 0.8);
  nose.userData.noOutline = true;
  g.add(nose);

  /* ------------------------------------------------ soft face shading -- */
  // gentle contact shading where the fringe falls over the brow
  const fringeShadow = new THREE.Mesh(
    facePatch({ thetaC: 1.30, phiC: Math.PI / 2, dTheta: 0.24, dPhi: 1.7, offset: 0.0009, uSeg: 28, vSeg: 10 }),
    new THREE.MeshBasicMaterial({
      color: 0x4a3f78,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      toneMapped: false,
    })
  );
  fringeShadow.name = 'fringeShadow';
  fringeShadow.renderOrder = 2;
  fringeShadow.userData.noOutline = true;
  g.add(fringeShadow);

  return g;
}
