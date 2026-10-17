/**
 * Assembles the full character from its procedural parts.
 */
import * as THREE from 'three';
import { DIMS } from '../config.js';
import { buildHead } from './head.js';
import { buildHair } from './hair.js';
import { buildNeck, buildArms, buildLegs, buildSlippers } from './limbs.js';
import { buildOutfit } from './outfit.js';
import { buildHalo, buildHeadband, buildPillow } from './accessories.js';

export function buildCharacter() {
  const root = new THREE.Group();
  root.name = 'yuuka';

  const head = buildHead();
  head.position.set(0, DIMS.headC, 0);
  head.rotation.set(0.02, -0.06, 0.035);
  const hair = buildHair();
  head.add(hair);
  head.add(buildHeadband());
  root.add(head);

  root.add(buildNeck());
  root.add(buildArms());
  root.add(buildLegs());
  root.add(buildSlippers());
  root.add(buildOutfit());

  const halo = buildHalo();
  root.add(halo);

  root.add(buildPillow());

  root.userData.hair = hair;
  root.userData.halo = halo;
  root.userData.haloY = halo.position.y;
  root.userData.head = head;

  return root;
}
