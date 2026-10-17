/**
 * HUD wiring: credit line, view presets and the iteration/score readout.
 */
import { META } from './config.js';

export const VIEWS = {
  front: { azimuth: 0, elevation: 0.03, distance: 4.2, targetY: 0.99 },
  threeq: { azimuth: -0.72, elevation: 0.05, distance: 4.2, targetY: 0.99 },
  side: { azimuth: -Math.PI / 2, elevation: 0.04, distance: 4.2, targetY: 0.99 },
  back: { azimuth: Math.PI, elevation: 0.04, distance: 4.2, targetY: 0.99 },
  face: { azimuth: -0.16, elevation: 0.02, distance: 1.30, targetY: 1.585 },
};

export function initUI(viewer) {
  const $ = (s) => document.querySelector(s);

  $('#iterNum').textContent = META.iteration;
  $('#iterMax').textContent = META.maxIterations;
  $('#scoreVal').textContent = META.score;
  $('#scoreBar').style.width = `${META.score}%`;

  const buttons = [...document.querySelectorAll('#controls button')];
  const clear = (attr) => buttons.filter((b) => b.dataset[attr]).forEach((b) => b.classList.remove('on'));

  for (const b of buttons) {
    b.addEventListener('click', () => {
      if (b.dataset.view) {
        clear('view');
        b.classList.add('on');
        viewer.spin = false;
        viewer.userMoved = true;
        viewer.setView(VIEWS[b.dataset.view]);
      } else if (b.dataset.toggle === 'spin') {
        viewer.spin = !viewer.spin;
        b.classList.toggle('on', viewer.spin);
      } else if (b.dataset.toggle === 'fx') {
        viewer.usePost = !viewer.usePost;
        b.classList.toggle('on', viewer.usePost);
      }
    });
  }

  const setScore = (iteration, score) => {
    META.iteration = iteration;
    META.score = score;
    $('#iterNum').textContent = iteration;
    $('#scoreVal').textContent = score;
    $('#scoreBar').style.width = `${score}%`;
  };

  const setMessage = (msg) => {
    const el = $('#loadingMsg');
    if (el) el.textContent = msg;
  };

  const hideLoading = () => {
    const el = $('#loading');
    if (el) el.classList.add('hide');
  };

  return { setScore, setMessage, hideLoading };
}

/** Apply view/zoom overrides passed via the query string (used by the shot tool). */
export function applyQuery(viewer) {
  const q = new URLSearchParams(location.search);
  const v = q.get('view');
  if (v && VIEWS[v]) {
    const preset = { ...VIEWS[v] };
    const zoom = parseFloat(q.get('zoom') || '1');
    if (zoom && zoom !== 1) {
      preset.distance *= zoom;
      if (v === 'face') preset.distance = 1.28 * zoom;
    }
    viewer.spin = false;
    viewer.userMoved = true;
    viewer.setView(preset, true);
    document.querySelectorAll('#controls button[data-view]').forEach((b) => {
      b.classList.toggle('on', b.dataset.view === v);
    });
    const spinBtn = document.querySelector('#controls button[data-toggle="spin"]');
    if (spinBtn) spinBtn.classList.remove('on');
  }
  return q.get('view') || null;
}
