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
    points: [V3(-0.114, 1.372, 0.004), V3(-0.214, 1.290, 0.016), V3(-0.262, 1.218, 0.028), V3(-0.220, 1.362, 0.052), V3(-0.170, 1.492, 0.060)],
    wrist: V3(-0.150, 1.572, 0.052),
    handDir: V3(0.34, 0.86, 0.38).normalize(),
    palmNormal: V3(0.30, -0.10, 0.95).normalize(),
  },
  armDown: {
    side: 1,
    points: [V3(0.116, 1.372, 0.004), V3(0.148, 1.254, 0.0), V3(0.164, 1.120, 0.004), V3(0.156, 0.972, 0.026), V3(0.146, 0.838, 0.046)],
    wrist: V3(0.145, 0.831, 0.048),
    handDir: V3(-0.14, -0.96, 0.24).normalize(),
    palmNormal: V3(-0.86, -0.2, 0.47).normalize(),
  },
};

export const ARM_RADIUS = profileFn([
  [0.0, 0.0455],
  [0.16, 0.0420],
  [0.5, 0.0348],
  [0.62, 0.0322],
  [0.88, 0.0264],
  [1.0, 0.0242],
]);

const LEG_RADIUS = profileFn([
  [0.0, 0.0700],
  [0.10, 0.0684],
  [0.26, 0.0616],
  [0.38, 0.0504],
  [0.46, 0.0436],
  [0.50, 0.0552],
  [0.56, 0.0640],
  [0.64, 0.0576],
  [0.74, 0.0452],
  [0.84, 0.0344],
  [0.93, 0.0300],
  [1.0, 0.0276],
]);

/* ---------------------------------------------------------------- neck -- */

export function buildNeck() {
  const A = assets();
  const g = new THREE.Group();
  g.name = 'neck';
  const curve = curveFromPoints(
    [V3(0, 1.376, -0.004), V3(0, 1.412, 0.002), V3(0, 1.452, 0.006), V3(0, 1.498, 0.006)],
    0.5
  );
  const geo = tubeAlongCurve(curve, profileFn([[0, 0.0415], [0.35, 0.0340], [0.75, 0.0292], [1, 0.0292]]), {
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
    // `tubeAlongCurve` leaves both ends open, and an open end shows the
    // outline shell's interior as a dark ellipse. Tapering the very ends to a
    // point closes the tube inside the deltoid and inside the hand.
    const armRadius = (t) =>
      ARM_RADIUS(t) * smoothstep(0, 0.035, t) * smoothstep(1, 0.965, t);
    const geo = tubeAlongCurve(curve, armRadius, { segs: 48, radial: 24 });
    const arm = new THREE.Mesh(geo, A.mat.skin);
    arm.name = 'arm' + (pose.side < 0 ? 'Raised' : 'Down');
    arm.castShadow = true;
    addOutline(arm, { thickness: 0.0034 });
    g.add(arm);

    // Deltoid blend. It must be at least as wide as the arm's own radius at
    // t = 0 (0.0455) in *every* direction: `tubeAlongCurve` leaves the tube's
    // ends open, and a deltoid narrower than the tube lets the camera see
    // straight down the hollow arm.
    const delt = new THREE.Mesh(new THREE.SphereGeometry(0.052, 20, 16), A.mat.skin);
    delt.name = 'deltoid';
    delt.position.copy(pose.points[0]);
    delt.scale.set(0.94, 1.06, 1.0);
    delt.userData.noOutline = true;
    g.add(delt);

    const hand = makeHand({ side: pose.side, curl: pose.side < 0 ? 0.85 : 0.95 });
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
  return tubeAlongCurve(curve, (t) => r * (1 - 0.10 * t), { segs: 16, radial: 10 });
}

export function makeHand({ side = 1, curl = 0.5 } = {}) {
  const A = assets();
  const g = new THREE.Group();
  g.name = 'hand';

  // Palm: a tapered slab — narrow at the wrist, wide across the knuckles.
  const palmGeo = puffyBox(0.060, 0.068, 0.025, { seg: 14, round: 0.62 });
  {
    const pos = palmGeo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const t = smoothstep(0, 1, (v.y + 0.034) / 0.068);
      v.x *= 0.70 + 0.36 * t;
      v.z *= 0.78 + 0.34 * Math.sin(Math.PI * Math.max(0.02, t));
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    palmGeo.computeVertexNormals();
  }
  const palm = new THREE.Mesh(palmGeo, A.mat.skin);
  palm.name = 'palm';
  palm.position.set(0, 0.032, 0);
  palm.castShadow = true;
  addOutline(palm, { thickness: 0.0011 });
  g.add(palm);

  // Four fingers of graduated length, fanned slightly and curling forward.
  // The fingers must overlap or the hand reads as a comb: spacing stays below
  // the finger diameter.
  const specs = [
    [-0.0178, 0.0298, 0.0078],
    [-0.0060, 0.0342, 0.0081],
    [0.0061, 0.0328, 0.0079],
    [0.0176, 0.0270, 0.0072],
  ];
  for (const [x, len, r] of specs) {
    const f = new THREE.Mesh(finger(len, r, curl), A.mat.skin);
    f.name = 'finger';
    f.position.set(x, 0.060, 0);
    f.rotation.z = -x * 1.1;
    f.castShadow = true;
    addOutline(f, { thickness: 0.0003 });
    g.add(f);
  }

  // thumb
  const thumbPts = [];
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    thumbPts.push(V3(side * (0.020 + 0.021 * t), 0.014 + 0.029 * t, 0.007 * t - curl * 0.014 * t * t));
  }
  const thumb = new THREE.Mesh(
    tubeAlongCurve(curveFromPoints(thumbPts, 0.5), (t) => 0.0098 * (1 - 0.14 * t), { segs: 16, radial: 10 }),
    A.mat.skin
  );
  thumb.name = 'thumb';
  thumb.castShadow = true;
  addOutline(thumb, { thickness: 0.0005 });
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
    { side: -1, hip: V3(-0.078, 0.918, -0.012), knee: V3(-0.077, 0.498, -0.030), ankle: V3(-0.073, 0.120, -0.044) },
    { side: 1, hip: V3(0.080, 0.906, 0.014), knee: V3(0.078, 0.494, 0.066), ankle: V3(0.066, 0.116, 0.050) },
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
    foot.position.set(s < 0 ? -0.072 : 0.066, 0, s < 0 ? -0.040 : 0.050);
    foot.rotation.y = -s * (s > 0 ? 0.34 : 0.16);
    foot.rotation.x = -0.03;

    // sole
    const sole = new THREE.Mesh(puffyBox(0.116, 0.038, 0.216, { seg: 14, round: 0.62, bulge: 0.004 }), A.mat.sole);
    sole.name = 'sole';
    sole.position.set(0, 0.014, 0.012);
    sole.castShadow = true;
    addOutline(sole, { thickness: 0.0028 });
    foot.add(sole);

    // fluffy upper (open-back mule)
    const upper = new THREE.Mesh(puffyBox(0.116, 0.098, 0.168, { seg: 16, round: 0.74, bulge: 0.006 }), A.mat.slipper);
    upper.name = 'upper';
    upper.position.set(0, 0.050, 0.034);
    upper.castShadow = true;
    addOutline(upper, { thickness: 0.003 });
    foot.add(upper);

    // heel cushion
    const heel = new THREE.Mesh(puffyBox(0.102, 0.080, 0.076, { seg: 12, round: 0.72, bulge: 0.005 }), A.mat.slipper);
    heel.name = 'heel';
    heel.position.set(0, 0.042, -0.048);
    heel.userData.noOutline = true;
    foot.add(heel);

    // pink bow
    const bow = new THREE.Group();
    bow.name = 'slipperBow';
    bow.position.set(0, 0.104, 0.080);
    for (const k of [-1, 1]) {
      const loop = new THREE.Mesh(new THREE.SphereGeometry(0.013, 14, 12), A.mat.bowPink);
      loop.scale.set(1.0, 0.62, 0.72);
      loop.position.set(k * 0.013, 0.002, 0);
      loop.rotation.z = k * 0.35;
      bow.add(loop);
    }
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.0070, 12, 10), A.mat.bowPink);
    knot.position.set(0, 0.004, 0.004);
    knot.scale.set(0.9, 0.9, 1.1);
    bow.add(knot);
    foot.add(bow);

    g.add(foot);
  }
  return g;
}
