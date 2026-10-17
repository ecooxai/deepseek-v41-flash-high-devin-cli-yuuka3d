/**
 * Procedural geometry toolkit.
 *
 * The whole character is assembled from a handful of parametric primitives so
 * that every silhouette is authored numerically rather than imported.
 */
import * as THREE from 'three';

const _v = new THREE.Vector3();

/* ------------------------------------------------------------------ shell */

/**
 * Generic parametric surface.
 *
 * @param {object} o
 * @param {number} o.uSeg   segments around (u: 0..1)
 * @param {number} o.vSeg   segments along  (v: 0..1)
 * @param {(u:number,v:number,out:THREE.Vector3)=>void} o.point
 * @param {(u:number,v:number)=>[number,number]} [o.uv]
 * @param {(u:number,v:number)=>boolean} [o.skip]   drop quads (cut holes)
 * @param {boolean} [o.closed=true]  wrap u
 * @param {boolean} [o.flip=false]   invert winding
 */
export function surfaceShell({
  uSeg = 48,
  vSeg = 24,
  point,
  uv,
  skip,
  closed = true,
  flip = false,
}) {
  const cols = closed ? uSeg : uSeg + 1;
  const rows = vSeg + 1;
  const positions = [];
  const uvs = [];
  const indices = [];
  const grid = [];

  for (let j = 0; j < rows; j++) {
    const v = j / vSeg;
    const row = [];
    for (let i = 0; i < cols; i++) {
      const u = i / uSeg;
      point(u, v, _v);
      row.push(positions.length / 3);
      positions.push(_v.x, _v.y, _v.z);
      if (uv) {
        const t = uv(u, v);
        uvs.push(t[0], t[1]);
      } else {
        uvs.push(u, v);
      }
    }
    grid.push(row);
  }

  for (let j = 0; j < vSeg; j++) {
    for (let i = 0; i < uSeg; i++) {
      if (skip && skip((i + 0.5) / uSeg, (j + 0.5) / vSeg)) continue;
      const i0 = i;
      const i1 = closed ? (i + 1) % cols : i + 1;
      const a = grid[j][i0];
      const b = grid[j][i1];
      const c = grid[j + 1][i1];
      const d = grid[j + 1][i0];
      if (flip) indices.push(a, c, d, a, b, c);
      else indices.push(a, d, c, a, c, b);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/* ------------------------------------------------------------------ limbs */

/**
 * Sweep a circular (optionally elliptical) cross-section along a curve.
 * @param {THREE.Curve} curve
 * @param {(t:number)=>number} radiusFn
 */
export function tubeAlongCurve(curve, radiusFn, { segs = 48, radial = 18, squash = 1 } = {}) {
  const frames = curve.computeFrenetFrames(segs, false);
  const pts = [];
  const nrm = [];
  const bin = [];
  const rad = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    pts.push(curve.getPointAt(t, new THREE.Vector3()));
    nrm.push(frames.normals[i].clone());
    bin.push(frames.binormals[i].clone());
    rad.push(radiusFn(t));
  }
  const A = new THREE.Vector3();
  const B = new THREE.Vector3();
  const C = new THREE.Vector3();

  return surfaceShell({
    uSeg: radial,
    vSeg: segs,
    flip: true,
    point: (u, v, out) => {
      const f = v * segs;
      const i0 = Math.min(segs, Math.floor(f));
      const i1 = Math.min(segs, i0 + 1);
      const k = f - i0;
      A.lerpVectors(pts[i0], pts[i1], k);
      B.lerpVectors(nrm[i0], nrm[i1], k).normalize();
      C.lerpVectors(bin[i0], bin[i1], k).normalize();
      const r = rad[i0] * (1 - k) + rad[i1] * k;
      const a = u * Math.PI * 2;
      out.copy(A).addScaledVector(B, Math.cos(a) * r).addScaledVector(C, Math.sin(a) * r * squash);
    },
    uv: (u, v) => [u, v],
  });
}

/**
 * Flat anime hair strand: a swept tube whose cross-section is a wide, thin
 * ellipse. `frameFn(t, point, tangent)` returns [widthDir, thicknessDir] so
 * the flat face always points away from the skull (no Frenet twisting).
 */
export function hairStrand(curve, widthFn, thickFn, { segs = 44, radial = 10, frameFn = null } = {}) {
  const pts = [];
  const tan = [];
  const wid = [];
  const thk = [];
  const wDir = [];
  const tDir = [];
  const fallback = new THREE.Vector3(0, 0, 1);

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = curve.getPointAt(t, new THREE.Vector3());
    const tg = curve.getTangentAt(t, new THREE.Vector3()).normalize();
    pts.push(p);
    tan.push(tg);
    wid.push(Math.max(1e-5, widthFn(t)));
    thk.push(Math.max(1e-5, thickFn(t)));

    if (frameFn) {
      const f = frameFn(t, p, tg);
      wDir.push(f[0].clone().normalize());
      tDir.push(f[1].clone().normalize());
    } else {
      const radial = new THREE.Vector3(p.x, 0, p.z);
      if (radial.lengthSq() < 1e-8) radial.copy(fallback);
      radial.normalize();
      const w = new THREE.Vector3().crossVectors(radial, tg);
      if (w.lengthSq() < 1e-8) w.copy(fallback);
      w.normalize();
      const n = new THREE.Vector3().crossVectors(tg, w).normalize();
      wDir.push(w);
      tDir.push(n);
    }
  }

  const A = new THREE.Vector3();
  const B = new THREE.Vector3();
  const C = new THREE.Vector3();
  const D = new THREE.Vector3();

  return surfaceShell({
    uSeg: radial,
    vSeg: segs,
    flip: true,
    point: (u, v, out) => {
      const f = v * segs;
      const i0 = Math.min(segs, Math.floor(f));
      const i1 = Math.min(segs, i0 + 1);
      const k = f - i0;
      A.lerpVectors(pts[i0], pts[i1], k);
      B.lerpVectors(wDir[i0], wDir[i1], k).normalize();
      C.lerpVectors(tDir[i0], tDir[i1], k).normalize();
      const w = wid[i0] * (1 - k) + wid[i1] * k;
      const h = thk[i0] * (1 - k) + thk[i1] * k;
      const a = u * Math.PI * 2;
      D.copy(A).addScaledVector(B, Math.cos(a) * w).addScaledVector(C, Math.sin(a) * h);
      out.copy(D);
    },
    uv: (u, v) => [u, v],
  });
}

/* ------------------------------------------------------------------- head */

/** Sphere point using the same convention as THREE.SphereGeometry. */
export function spherePoint(theta, phi, r, out = new THREE.Vector3()) {
  return out.set(-r * Math.cos(phi) * Math.sin(theta), r * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta));
}

export function sphereNormal(theta, phi, out = new THREE.Vector3()) {
  return out.set(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta)).normalize();
}

/** Position + orient `obj` on the surface of a sphere of radius r. */
export function placeOnSphere(obj, theta, phi, r, outward = 0) {
  const p = spherePoint(theta, phi, r);
  const n = sphereNormal(theta, phi);
  obj.position.copy(p).addScaledVector(n, outward);
  obj.lookAt(p.clone().addScaledVector(n, 1));
  return obj;
}

/**
 * Sculpt a UV sphere into a stylised anime head: tapered chin, forward jaw,
 * slightly flattened crown. Deformation lives in unit-sphere space so that
 * decals (eyes, blush, mouth) can be placed on exactly the same surface.
 */
export function headDeform(x, y, z, out = new THREE.Vector3()) {
  let X = x;
  let Z = z;
  let Yy = y;

  if (y < 0) {
    const u = Math.min(1, -y);
    // slim, smoothly tapering jaw — the anime chin
    const sx = 1 - 0.52 * Math.pow(u, 1.02);
    const sz = 1 - 0.28 * Math.pow(u, 1.45);
    X *= sx;
    Z *= sz;
    // the jaw juts forward, giving the chin its profile
    Z += 0.155 * Math.pow(u, 1.7);
    if (z < 0) Z *= 1 - 0.14 * u;
  }

  if (y > 0.45) {
    const t = (y - 0.45) / 0.55;
    X *= 1 - 0.10 * t;
    Z *= 1 - 0.06 * t;
  }

  if (Z < 0) Z *= 0.94;

  const cheek = Math.exp(-Math.pow((y + 0.30) / 0.28, 2)) * Math.exp(-Math.pow(Z / 0.9, 2));
  X *= 1 - 0.030 * cheek;

  // overall: an anime head is a narrow oval, not a ball
  X *= 0.75;

  return out.set(X, Yy, Z);
}

export function deformHead(geo, R) {
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const o = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    headDeform(v.x, v.y, v.z, o);
    pos.setXYZ(i, o.x * R, o.y * R, o.z * R);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Point on the (deformed) head surface for spherical coords, times radius R. */
export function headSurface(theta, phi, R, out = new THREE.Vector3()) {
  const x = -Math.cos(phi) * Math.sin(theta);
  const y = Math.cos(theta);
  const z = Math.sin(phi) * Math.sin(theta);
  headDeform(x, y, z, out);
  return out.multiplyScalar(R);
}

/* --------------------------------------------------------------- solids */

/**
 * Weld coincident vertices so `computeVertexNormals` produces smooth shading.
 * BoxGeometry keeps six independent faces, which otherwise leaves hard creases
 * all over a "rounded" box.
 */
export function weldVertices(geo, tol = 1e-5) {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const key = (x, y, z) =>
    `${Math.round(x / tol)}|${Math.round(y / tol)}|${Math.round(z / tol)}`;
  const map = new Map();
  const remap = new Int32Array(pos.count);
  const positions = [];
  const uvs = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const k = key(x, y, z);
    let idx = map.get(k);
    if (idx === undefined) {
      idx = positions.length / 3;
      map.set(k, idx);
      positions.push(x, y, z);
      if (uv) uvs.push(uv.getX(i), uv.getY(i));
    }
    remap[i] = idx;
  }
  const src = geo.index ? geo.index.array : null;
  const indices = src ? Array.from(src, (v) => remap[v]) : Array.from(remap);
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (uv) out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  out.setIndex(indices);
  out.computeVertexNormals();
  return out;
}

/**
 * Rounded box ("spherified" cube) — the workhorse for pillow, slippers, hands.
 * Corners are pulled toward a sphere of radius min(half-extent) so the result
 * reads as a soft cushion rather than a hard cube.
 */
export function puffyBox(w, h, d, { seg = 10, round = 0.42, bulge = 0 } = {}) {
  const geo = weldVertices(new THREE.BoxGeometry(w, h, d, seg, seg, seg));
  const pos = geo.attributes.position;
  const hw = w / 2;
  const hh = h / 2;
  const hd = d / 2;
  const rr = Math.min(hw, hh, hd);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const target = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    n.copy(p).normalize();
    const flat = 1 - Math.max(Math.abs(n.x), Math.abs(n.y), Math.abs(n.z));
    target.copy(n).multiplyScalar(rr);
    p.lerp(target, round);
    if (bulge) p.addScaledVector(n, bulge * flat * 2.2);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Squash a geometry along an axis (helper for shapes derived from spheres). */
export function scaleGeo(geo, x, y, z) {
  geo.scale(x, y, z);
  return geo;
}

/* -------------------------------------------------------------- utilities */

/** Curved quad from four corner points, optionally bulged along a normal. */
export function bilinearPatch(p00, p10, p11, p01, { uSeg = 10, vSeg = 10, bulge = 0, normal = null } = {}) {
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const n = normal ? normal.clone().normalize() : null;
  return surfaceShell({
    uSeg,
    vSeg,
    closed: false,
    point: (u, v, out) => {
      a.lerpVectors(p00, p10, u);
      b.lerpVectors(p01, p11, u);
      out.lerpVectors(a, b, v);
      if (n && bulge) out.addScaledVector(n, bulge * Math.sin(Math.PI * u) * Math.sin(Math.PI * v));
    },
    uv: (u, v) => [u, v],
  });
}

/**
 * Bake a vertical colour ramp into a geometry's vertex colours.
 * `stops` is a list of [t, hex] pairs, t = 0 at the root, 1 at the tip.
 */
export function paintAlongV(geo, stops, { gamma = 1, invert = false } = {}) {
  const uv = geo.attributes.uv;
  const n = geo.attributes.position.count;
  const colors = new Float32Array(n * 3);
  const c = new THREE.Color();
  const cols = stops.map(([t, h]) => [t, new THREE.Color(h)]);
  for (let i = 0; i < n; i++) {
    let t = uv.getY(i);
    if (invert) t = 1 - t;
    t = Math.pow(clamp01(t), gamma);
    let a = cols[0];
    let b = cols[cols.length - 1];
    for (let k = 0; k < cols.length - 1; k++) {
      if (t >= cols[k][0] && t <= cols[k + 1][0]) {
        a = cols[k];
        b = cols[k + 1];
        break;
      }
    }
    const span = Math.max(1e-6, b[0] - a[0]);
    c.copy(a[1]).lerp(b[1], clamp01((t - a[0]) / span));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}

/**
 * Multiply a baked vertex-colour ramp by a cross-section falloff.
 *
 * A flat lock is lit as one plane, which reads as a cardboard panel. Fading
 * the colour toward the ribbon's thin edges makes the same geometry read as a
 * rounded strand. `hairStrand` puts `u = 0` on the outward face and `u = 0.25
 * / 0.75` on the edges.
 */
export function shadeAcrossU(geo, { base = 0.66, gain = 0.34, phase = 0 } = {}) {
  const uv = geo.attributes.uv;
  const col = geo.attributes.color;
  if (!col || !uv) return geo;
  for (let i = 0; i < col.count; i++) {
    const u = uv.getX(i);
    const f = base + gain * Math.max(0, Math.cos((u + phase) * TAU));
    col.setXYZ(i, col.getX(i) * f, col.getY(i) * f, col.getZ(i) * f);
  }
  col.needsUpdate = true;
  return geo;
}

export function curveFromPoints(points, tension = 0.5) {
  const c = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  c.tension = tension;
  c.curveType = 'catmullrom';
  return c;
}

/** Merge a list of geometries into one (position/normal/uv only). */
export function mergeGeometries(geos) {
  const out = [];
  let count = 0;
  for (const g of geos) {
    const nonIndexed = g.index ? g.toNonIndexed() : g;
    out.push(nonIndexed);
    count += nonIndexed.attributes.position.count;
  }
  const position = new Float32Array(count * 3);
  const normal = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  let o = 0;
  for (const g of out) {
    const p = g.attributes.position.array;
    const n = g.attributes.normal ? g.attributes.normal.array : null;
    const t = g.attributes.uv ? g.attributes.uv.array : null;
    position.set(p, o * 3);
    if (n) normal.set(n, o * 3);
    if (t) uv.set(t, o * 2);
    o += g.attributes.position.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return geo;
}

export const TAU = Math.PI * 2;
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smoothstep = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
