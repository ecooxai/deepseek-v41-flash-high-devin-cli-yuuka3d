/**
 * Material helpers: cel-shaded "toon" surfaces plus an inverted-hull outline
 * shell that expands along vertex normals (works on non-convex shapes too).
 */
import * as THREE from 'three';
import { toonGradient } from './textures.js';
import { PALETTE } from './config.js';

const GRADIENT = toonGradient(4, 0.08);
const GRADIENT_SOFT = toonGradient(6, 0.14);

export function toon({ color = 0xffffff, map = null, gradient = GRADIENT, side = THREE.FrontSide, ...rest } = {}) {
  const m = new THREE.MeshToonMaterial({ color, map, gradientMap: gradient, side });
  Object.assign(m, rest);
  return m;
}

export function toonSoft(opts = {}) {
  return toon({ ...opts, gradient: GRADIENT_SOFT });
}

/** Flat unlit colour (used for decals such as eyes, blush, mouth). */
export function decal(map, { transparent = true, opacity = 1, depthWrite = false, color = 0xffffff } = {}) {
  return new THREE.MeshBasicMaterial({
    map,
    color,
    transparent,
    opacity,
    depthWrite,
    toneMapped: false,
    side: THREE.FrontSide,
  });
}

/**
 * Outline shell. Renders back-faces of a slightly inflated copy of the mesh,
 * so silhouettes read like a hand-drawn anime line.
 */
/**
 * The reference is painted with soft, coloured line art rather than inked
 * contours, so every outline is scaled down from the authored thickness.
 */
const OUTLINE_SCALE = 0.58;

export function outlineMaterial(thickness = 0.006, color = PALETTE.outline, opacity = 1) {
  const t = thickness * OUTLINE_SCALE;
  const m = new THREE.MeshBasicMaterial({
    color,
    side: THREE.BackSide,
    transparent: opacity < 1,
    opacity,
    depthWrite: true,
    toneMapped: false,
  });
  m.userData.thickness = t;
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       transformed += normal * ${t.toFixed(5)};`
    );
  };
  return m;
}

/**
 * Attach an outline shell to a mesh.
 * @param {THREE.Mesh} mesh
 * @param {object} opts  { thickness, color, opacity, scale }
 */
export function addOutline(mesh, { thickness = 0.006, color = PALETTE.outline, opacity = 1 } = {}) {
  if (mesh.userData.noOutline) return null;
  const shell = new THREE.Mesh(mesh.geometry, outlineMaterial(thickness, color, opacity));
  shell.name = mesh.name + '__outline';
  shell.renderOrder = (mesh.renderOrder || 0) - 1;
  shell.castShadow = false;
  shell.receiveShadow = false;
  shell.userData.isOutline = true;
  shell.userData.thickness = thickness;
  mesh.add(shell);
  mesh.userData.outline = shell;
  return shell;
}
