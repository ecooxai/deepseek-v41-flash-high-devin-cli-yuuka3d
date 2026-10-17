/**
 * Limbs: neck, arms, hands, legs, feet and fluffy slippers.
 * Poses are authored as explicit control points so both the standing leg and
 * the raised arm read naturally from every angle.
 */
import * as THREE from 'three';
import { DIMS } from '../config.js';
import { assets } from '../assets.js';
import { addOutline } from '../materials.js';
import { tubeAlongCurve, curveFromPoints, puffyBox, lerp, smoothstep } from '../geometry.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

function profileFn(points) {
  return (t) => {
    if (t <= points[0][0]) return points[0][1];
    const last = points[points.length - 1];
    if (t >= last[0]) return last[1];
    let i = 0;
    while (i < points.length - 2 && t > points[i + 1][0]) i++;
    const [t0, v0] = points[i];
    const [t1, v1] = points[i + 1];
    return lerp(v0, v1, smoothstep(t0, t1, t));
  };
}

/* --------------------------------------------------------------- poses -- */

export const POSE = {
  armRaised: {
    side: -1,
    points: [V3(-0.114, 1.372, 0.004), V3(-0.230, 1.272, 0.016), V3(-0.300, 1.192, 0.024), V3(-0.232, 1.312, 0.046), V3(-0.156, 1.392, 0.056)],
    wrist: V3(-0.172, 1.458, 0.058),
    handDir: V3(0.40, 0.88, 0.25).normalize(),
    palmNormal: V3(0.86, -0.14, 0.49).normalize(),
  },
  armDown: {
    side: 1,
    points: [V3(0.116, 1.372, 0.004), V3(0.148, 1.254, 0.0), V3(0.164, 1.120, 0.004), V3(0.156, 0.972, 0.026), V3(0.146, 0.838, 0.046)],
    wrist: V3(0.145, 0.831, 0.048),
    handDir: V3(-0.14, -0.96, 0.24).normalize(),
    palmNormal: V3(-0.86, -0.2, 0.47).normalize(),
  },
};

const ARM_RADIUS = profileFn([
  [0.0, 0.0425],
  [0.16, 0.0395],
  [0.5, 0.0330],
  [0.62, 0.0305],
  [0.88, 0.0250],
  [1.0, 0.0228],
]);

const LEG_RADIUS = profileFn([
  [0.0, 0.0700],
  [0.10, 0.0672],
  [0.28, 0.0565],
  [0.40, 0.0450],
  [0.46, 0.0418],
  [0.55, 0.0508],
  [0.66, 0.0450],
  [0.82, 0.0320],
  [0.92, 0.0282],
  [1.0, 0.0258],
]);

/* ---------------------------------------------------------------- neck -- */

export function buildNeck() {
  const A = assets();
  const g = new THREE.Group();
  g.name = 'neck';
  const curve = curveFromPoints(
    [V3(0, 1.382, -0.004), V3(0, 1.420, 0.002), V3(0, 1.458, 0.006), V3(0, 1.500, 0.006)],
    0.5
  );
  const geo = tubeAlongCurve(curve, profileFn([[0, 0.0415], [0.35, 0.034], [0.75, 0.0295], [1, 0.0295]]), {
    segs: 24,
    radial: 26,
  });
  const mesh = new THREE.Mesh(geo, A.mat.skin);
  mesh.name = 'neckMesh';
  mesh.castShadow = true;
  addOutline(mesh, { thickness: 0.0035 });
  g.add(mesh);
  return g;
}

/* ---------------------------------------------------------------- arms -- */

export function buildArms() {
  const A = assets();
  const g = new THREE.Group();
  g.name = 'arms';

  for (const pose of [POSE.armRaised, POSE.armDown]) {
    const curve = curveFromPoints(pose.points, 0.5);
    const geo = tubeAlongCurve(curve, ARM_RADIUS, { segs: 48, radial: 24 });
    const arm = new THREE.Mesh(geo, A.mat.skin);
    arm.name = 'arm' + (pose.side < 0 ? 'Raised' : 'Down');
    arm.castShadow = true;
    addOutline(arm, { thickness: 0.0034 });
    g.add(arm);

    // deltoid blend
    const delt = new THREE.Mesh(new THREE.SphereGeometry(0.043, 20, 16), A.mat.skin);
    delt.name = 'deltoid';
    delt.position.copy(pose.points[0]);
    delt.scale.set(1.0, 1.15, 0.92);
    delt.userData.noOutline = true;
    g.add(delt);

    const hand = makeHand({ side: pose.side, curl: pose.side < 0 ? 0.24 : 0.95 });
    placeHand(hand, pose.wrist, pose.handDir, pose.palmNormal);
    g.add(hand);
  }
  return g;
}

/* --------------------------------------------------------------- hands -- */

function finger(len, r, curl) {
  const pts = [];
  const n = 4;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const bend = curl * t * t * 1.5;
    pts.push(V3(0, len * t, -Math.sin(bend) * len * 0.55));
  }
  const curve = curveFromPoints(pts, 0.5);
  return tubeAlongCurve(curve, (t) => r * (1 - 0.28 * t), { segs: 16, radial: 10 });
}

export function makeHand({ side = 1, curl = 0.5 } = {}) {
  const A = assets();
  const g = new THREE.Group();
  g.name = 'hand';

  const palm = new THREE.Mesh(puffyBox(0.058, 0.064, 0.026, { seg: 12, round: 0.5 }), A.mat.skin);
  palm.name = 'palm';
  palm.position.set(0, 0.030, 0);
  palm.castShadow = true;
  addOutline(palm, { thickness: 0.0013 });
  g.add(palm);

  const specs = [
    [-0.0205, 0.034, 0.0089],
    [-0.0069, 0.039, 0.0095],
    [0.0069, 0.037, 0.0091],
    [0.0200, 0.030, 0.0083],
  ];
  for (const [x, len, r] of specs) {
    const f = new THREE.Mesh(finger(len, r, curl), A.mat.skin);
    f.name = 'finger';
    f.position.set(x, 0.060, 0);
    f.castShadow = true;
    addOutline(f, { thickness: 0.0010 });
    g.add(f);
  }

  // thumb
  const thumbPts = [];
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    thumbPts.push(V3(side * (0.024 + 0.019 * t), 0.019 + 0.026 * t, 0.005 * t - curl * 0.010 * t * t));
  }
  const thumb = new THREE.Mesh(
    tubeAlongCurve(curveFromPoints(thumbPts, 0.5), (t) => 0.0098 * (1 - 0.25 * t), { segs: 14, radial: 10 }),
    A.mat.skin
  );
  thumb.name = 'thumb';
  thumb.castShadow = true;
  addOutline(thumb, { thickness: 0.0010 });
  g.add(thumb);

  return g;
}

/** Orient a hand group so +Y runs wrist→fingertips and +Z is the palm normal. */
export function placeHand(hand, origin, dir, palmNormal) {
  const yA = dir.clone().normalize();
  const zA = palmNormal.clone();
  zA.addScaledVector(yA, -zA.dot(yA));
  if (zA.lengthSq() < 1e-6) zA.set(0, 0, 1);
  zA.normalize();
  const xA = new THREE.Vector3().crossVectors(yA, zA).normalize();
  const m = new THREE.Matrix4().makeBasis(xA, yA, zA);
  hand.quaternion.setFromRotationMatrix(m);
  hand.position.copy(origin);
  return hand;
}

/* ---------------------------------------------------------------- legs -- */

export function buildLegs() {
  const A = assets();
  const g = new THREE.Group();
  g.name = 'legs';

  // a relaxed contrapposto: the near leg carries the weight, the far leg
  // steps slightly forward — straight parallel tubes read as mannequin legs
  const legs = [
    { side: -1, hip: V3(-0.078, 0.918, -0.006), knee: V3(-0.074, 0.502, -0.022), ankle: V3(-0.070, 0.122, -0.034) },
    { side: 1, hip: V3(0.080, 0.910, 0.010), knee: V3(0.073, 0.496, 0.038), ankle: V3(0.068, 0.120, 0.028) },
  ];

  for (const leg of legs) {
    const mid = leg.hip.clone().lerp(leg.knee, 0.5);
    const mid2 = leg.knee.clone().lerp(leg.ankle, 0.45);
    const curve = curveFromPoints(
      [
        leg.hip,
        leg.hip.clone().lerp(leg.knee, 0.35),
        mid,
        leg.knee,
        mid2,
        leg.ankle,
      ],
      0.5
    );
    const geo = tubeAlongCurve(curve, LEG_RADIUS, { segs: 56, radial: 26 });
    const mesh = new THREE.Mesh(geo, A.mat.skin);
    mesh.name = 'leg';
    mesh.castShadow = true;
    addOutline(mesh, { thickness: 0.0034 });
    g.add(mesh);
  }
  return g;
}

/* --------------------------------------------------------------- feet --- */

export function buildSlippers() {
  const A = assets();
  const g = new THREE.Group();
  g.name = 'slippers';

  for (const s of [-1, 1]) {
    const foot = new THREE.Group();
    foot.name = 'slipper';
    foot.position.set(s * 0.069 + (s > 0 ? 0 : 0.0), 0, s > 0 ? 0.040 : -0.022);
    foot.rotation.y = -s * 0.18;
    foot.rotation.x = -0.03;

    // sole
    const sole = new THREE.Mesh(puffyBox(0.107, 0.032, 0.212, { seg: 10, round: 0.5, bulge: 0.005 }), A.mat.sole);
    sole.name = 'sole';
    sole.position.set(0, 0.016, 0.014);
    sole.castShadow = true;
    addOutline(sole, { thickness: 0.0028 });
    foot.add(sole);

    // fluffy upper (open-back mule)
    const upper = new THREE.Mesh(puffyBox(0.103, 0.078, 0.156, { seg: 12, round: 0.6, bulge: 0.007 }), A.mat.slipper);
    upper.name = 'upper';
    upper.position.set(0, 0.058, 0.042);
    upper.castShadow = true;
    addOutline(upper, { thickness: 0.003 });
    foot.add(upper);

    // heel cushion
    const heel = new THREE.Mesh(puffyBox(0.089, 0.062, 0.065, { seg: 8, round: 0.6, bulge: 0.005 }), A.mat.slipper);
    heel.name = 'heel';
    heel.position.set(0, 0.048, -0.058);
    heel.userData.noOutline = true;
    foot.add(heel);

    // pink bow
    const bow = new THREE.Group();
    bow.name = 'slipperBow';
    bow.position.set(0, 0.098, 0.070);
    for (const k of [-1, 1]) {
      const loop = new THREE.Mesh(new THREE.SphereGeometry(0.016, 14, 12), A.mat.bowPink);
      loop.scale.set(1.0, 0.62, 0.72);
      loop.position.set(k * 0.016, 0.002, 0);
      loop.rotation.z = k * 0.35;
      bow.add(loop);
    }
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 12, 10), A.mat.bowPink);
    knot.position.set(0, 0.004, 0.004);
    knot.scale.set(0.9, 0.9, 1.1);
    bow.add(knot);
    foot.add(bow);

    g.add(foot);
  }
  return g;
}
