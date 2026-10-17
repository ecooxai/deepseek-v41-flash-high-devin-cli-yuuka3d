/**
 * Body silhouette: a single elliptical profile drives the torso skin, the
 * pyjama shirt, the shorts and the collar so everything stays concentric.
 *
 * Convention: angle a = u * TAU with x = rx·cos(a), z = rz·sin(a).
 * The FRONT of the character is therefore at a = π/2 (u = 0.25).
 */
import * as THREE from 'three';
import { DIMS } from '../config.js';
import { smoothstep, lerp } from '../geometry.js';

export const FRONT_U = 0.25;

/** [y, radiusX, radiusZ] */
const TORSO_PTS = [
  [0.780, 0.0704, 0.0648],
  [0.835, 0.0818, 0.0738],
  [0.885, 0.0889, 0.0846],
  [0.950, 0.0810, 0.0702],
  [1.030, 0.0739, 0.0648],
  [1.110, 0.0810, 0.0711],
  [1.190, 0.0915, 0.0855],
  [1.250, 0.0986, 0.0882],
  [1.300, 0.1065, 0.0891],
  [1.335, 0.1144, 0.0855],
  [1.378, 0.0880, 0.0666],
  [1.415, 0.0458, 0.0450],
];

export function torsoRadius(y) {
  if (y <= TORSO_PTS[0][0]) return [TORSO_PTS[0][1], TORSO_PTS[0][2]];
  const last = TORSO_PTS[TORSO_PTS.length - 1];
  if (y >= last[0]) return [last[1], last[2]];
  let i = 0;
  while (i < TORSO_PTS.length - 2 && y > TORSO_PTS[i + 1][0]) i++;
  const [y0, x0, z0] = TORSO_PTS[i];
  const [y1, x1, z1] = TORSO_PTS[i + 1];
  const t = smoothstep(y0, y1, y);
  return [lerp(x0, x1, t), lerp(z0, z1, t)];
}

/** Bust volume added to the front of the chest. */
function bust(a, y) {
  const z = Math.sin(a);
  if (z <= 0) return 0;
  const shape = Math.exp(-Math.pow((y - 1.155) / 0.062, 2));
  return 0.019 * shape * Math.pow(z, 1.6);
}

/**
 * A point on the torso surface.
 * @param {number} a  angle (radians), π/2 = front
 * @param {number} y  height
 * @param {number} grow  outward scale (0 = skin, 0.01 = shirt ease)
 */
export function onTorso(a, y, grow = 0, out = new THREE.Vector3()) {
  const [rx, rz] = torsoRadius(y);
  const g = grow;
  return out.set(
    (rx + g) * Math.cos(a),
    y,
    (rz + g) * Math.sin(a) + bust(a, y)
  );
}

/** Shortest angular distance from the front centre-line, in radians. */
export function frontDist(a) {
  let d = a - Math.PI / 2;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export const Y = {
  hip: DIMS.hipY,
  waist: DIMS.waistY,
  chest: DIMS.chestY,
  shoulder: DIMS.shoulderY,
};
