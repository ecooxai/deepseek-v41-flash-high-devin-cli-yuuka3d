/**
 * Entry point: build the character, wire the HUD and start the render loop.
 */
import * as THREE from 'three';
import { Viewer } from './scene.js';
import { buildCharacter } from './character/index.js';
import { initUI, applyQuery } from './ui.js';
import { META } from './config.js';

const container = document.getElementById('app');

function boot() {
  const t0 = performance.now();
  const viewer = new Viewer(container);
  window.__VIEWER__ = viewer;
  window.__THREE__ = THREE;
  const ui = initUI(viewer);

  ui.setMessage('sculpting the character…');
  const character = buildCharacter();
  viewer.character = character;
  viewer.scene.add(character);

  // frame the character for the current viewport
  viewer.resize();

  ui.setMessage('warming up shaders…');

  applyDebugFlags(character);

  // Render one frame, then report ready on the next tick.
  requestAnimationFrame(() => {
    viewer.update(0.016);
    viewer.start();
    viewer.resize();
    applyQuery(viewer);
    viewer.update(0.016);

    ui.hideLoading();

    let meshes = 0;
    let tris = 0;
    character.traverse((o) => {
      if (o.isMesh) {
        meshes++;
        const idx = o.geometry.index;
        tris += idx ? idx.count / 3 : o.geometry.attributes.position.count / 3;
      }
    });

    window.__APP_STATS__ = {
      meshes,
      triangles: Math.round(tris),
      buildMs: Math.round(performance.now() - t0),
      model: META.model,
      iteration: META.iteration,
      score: META.score,
    };
    window.__APP_READY__ = true;
  });

  window.addEventListener('resize', () => viewer.resize());
  window.addEventListener('orientationchange', () => setTimeout(() => viewer.resize(), 220));

}

/**
 * Development-only flags driven by the query string:
 *   ?solo=name       show only the sub-tree containing that object name
 *   ?hide=name,name  hide objects by name
 *   ?nooutline=1     hide every outline shell
 *   ?flat=1          replace every material with a matte grey (shape check)
 */
function applyDebugFlags(character) {
  const q = new URLSearchParams(location.search);

  if (q.get('nooutline')) {
    const kill = [];
    character.traverse((o) => {
      if (o.userData && o.userData.isOutline) kill.push(o);
    });
    kill.forEach((o) => o.parent && o.parent.remove(o));
  }

  const hide = (q.get('hide') || '').split(',').filter(Boolean);
  for (const name of hide) {
    character.traverse((o) => {
      if (o.name === name) o.visible = false;
    });
  }

  const solo = q.get('solo');
  if (solo) {
    const targets = [];
    character.traverse((o) => {
      if (o.name === solo) targets.push(o);
    });
    const keep = new Set();
    for (const t of targets) {
      t.traverse((o) => keep.add(o));
      let p = t;
      while (p) {
        keep.add(p);
        p = p.parent;
      }
    }
    character.traverse((o) => {
      if (o.isMesh && !keep.has(o)) o.visible = false;
    });
  }

  if (q.get('flat')) {
    const grey = new THREE.MeshNormalMaterial();
    character.traverse((o) => {
      if (o.isMesh && !o.userData.isOutline) o.material = grey;
    });
  }

  // ?bg=magenta -> solid chroma-key backdrop with everything except the
  // character hidden, so the silhouette can be measured exactly.
  if (q.get('bg') === 'magenta') {
    const v = window.__VIEWER__;
    v.scene.background = new THREE.Color(0xff00ff);
    const hide = [];
    v.scene.traverse((o) => {
      if (!o.isMesh) return;
      let p = o;
      while (p && p !== character) p = p.parent;
      if (!p) hide.push(o);
    });
    hide.forEach((o) => (o.visible = false));
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
