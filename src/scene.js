/**
 * Scene: renderer, studio lighting, soft sky background, shadow catcher,
 * and a compact damped orbit camera that works with mouse, touch and pen.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { BG } from './config.js';
import { backgroundTexture, contactShadowTexture, floorTexture } from './textures.js';

const _v = new THREE.Vector3();

export class Viewer {
  constructor(container) {
    this.container = container;
    this.clock = new THREE.Clock();
    this.time = 0;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = backgroundTexture();

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

    // ---- camera rig -------------------------------------------------
    this.target = new THREE.Vector3(0, 1.0, 0);
    this.goal = { azimuth: 0, elevation: 0.02, distance: 4.2, targetY: 1.0 };
    this.cur = { azimuth: 0, elevation: 0.02, distance: 4.2, targetY: 1.0 };
    this.spin = true;
    this.spinSpeed = 0.055;

    this._buildLights();
    this._buildGround();
    this._buildComposer();

    this._bindInput();
    this.resize();
  }

  /* ----------------------------------------------------------- post fx */
  _buildComposer() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    // only the halo is bright enough to bloom
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.22, 0.35, 0.995);
    this.composer.addPass(this.bloom);

    this.vignette = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        amount: { value: 0.26 },
        tint: { value: new THREE.Color(0xdfeaf7) },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform float amount; uniform vec3 tint;
        varying vec2 vUv;
        void main(){
          vec4 c = texture2D(tDiffuse, vUv);
          float d = distance(vUv, vec2(0.5));
          float v = smoothstep(0.28, 0.92, d);
          c.rgb = mix(c.rgb, tint * c.rgb, v * amount);
          gl_FragColor = c;
        }`,
    });
    this.composer.addPass(this.vignette);
    this.composer.addPass(new OutputPass());
    this.usePost = true;
  }

  /* ------------------------------------------------------------ lights */
  _buildLights() {
    const scene = this.scene;

    scene.add(new THREE.HemisphereLight(0xdcecff, 0xbcd4ec, 0.74));
    scene.add(new THREE.AmbientLight(0xffffff, 0.22));

    const key = new THREE.DirectionalLight(0xfff4ea, 1.28);
    key.position.set(-2.1, 3.4, 2.8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 12;
    key.shadow.camera.left = -1.5;
    key.shadow.camera.right = 1.5;
    key.shadow.camera.top = 2.6;
    key.shadow.camera.bottom = -0.4;
    key.shadow.bias = -0.0012;
    key.shadow.normalBias = 0.018;
    key.shadow.radius = 3;
    scene.add(key);
    this.key = key;

    const fill = new THREE.DirectionalLight(0xd6e6ff, 0.42);
    fill.position.set(3.2, 1.6, 2.0);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xbccfff, 0.62);
    rim.position.set(1.0, 2.6, -3.4);
    scene.add(rim);

    const rim2 = new THREE.DirectionalLight(0xffdcea, 0.22);
    rim2.position.set(-2.6, 1.2, -2.4);
    scene.add(rim2);
  }

  /* ------------------------------------------------------------ ground */
  _buildGround() {
    // soft pool of light on the floor
    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(4.4, 4.4),
      new THREE.MeshBasicMaterial({
        map: floorTexture(),
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        toneMapped: false,
      })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.0006;
    pool.scale.set(1, 0.66, 1);
    pool.userData.noOutline = true;
    this.scene.add(pool);

    const catcher = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.ShadowMaterial({ opacity: 0.24, color: 0x4a5480 })
    );
    catcher.rotation.x = -Math.PI / 2;
    catcher.position.y = 0.002;
    catcher.receiveShadow = true;
    this.scene.add(catcher);

    const soft = new THREE.Mesh(
      new THREE.PlaneGeometry(1.35, 1.35),
      new THREE.MeshBasicMaterial({
        map: contactShadowTexture(),
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        opacity: 0.8,
      })
    );
    soft.rotation.x = -Math.PI / 2;
    soft.position.set(0.03, 0.004, 0.02);
    soft.scale.set(1.0, 0.72, 1);
    soft.userData.noOutline = true;
    this.scene.add(soft);
    this.softShadow = soft;
  }

  /* ------------------------------------------------------------- input */
  _bindInput() {
    const el = this.renderer.domElement;
    const pointers = new Map();
    let pinchStart = 0;
    let pinchDist = 0;

    const onDown = (e) => {
      el.setPointerCapture?.(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.spin = false;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        pinchStart = this.goal.distance;
      }
    };

    const onMove = (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;

      if (pointers.size === 1) {
        this.goal.azimuth -= dx * 0.0055;
        this.goal.elevation = clamp(this.goal.elevation + dy * 0.0042, -0.42, 0.72);
        this.userMoved = true;
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDist > 0) {
          const ratio = pinchDist / Math.max(1, d);
          this.goal.distance = clamp(this.goal.distance * ratio, 1.4, 9);
          pinchDist = d;
        }
      }
    };

    const onUp = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchDist = 0;
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('pointerleave', onUp);
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.goal.distance = clamp(this.goal.distance * (1 + Math.sign(e.deltaY) * 0.08), 1.4, 9);
    }, { passive: false });
  }

  /* ------------------------------------------------------------ camera */
  setView({ azimuth, elevation, distance, targetY }, immediate = false) {
    this.goal.azimuth = azimuth;
    this.goal.elevation = elevation;
    this.goal.distance = distance;
    this.goal.targetY = targetY;
    if (immediate) {
      Object.assign(this.cur, this.goal);
      this._applyCamera();
    }
  }

  fitDistance() {
    const h = 2.24;
    const w = 1.36;
    const vFov = (this.camera.fov * Math.PI) / 180;
    const dV = h / 2 / Math.tan(vFov / 2);
    const dH = w / 2 / Math.tan(vFov / 2) / this.camera.aspect;
    return Math.max(dV, dH) * 1.06;
  }

  _applyCamera() {
    const { azimuth, elevation, distance, targetY } = this.cur;
    this.target.set(0, targetY, 0);
    const ce = Math.cos(elevation);
    this.camera.position.set(
      Math.sin(azimuth) * distance * ce,
      targetY + Math.sin(elevation) * distance + 0.06,
      Math.cos(azimuth) * distance * ce
    );
    this.camera.lookAt(this.target);
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setSize(w, h);
    }
    if (!this.userMoved) this.goal.distance = this.fitDistance();
  }

  /* -------------------------------------------------------------- loop */
  update(dt) {
    this.time += dt;

    if (this.spin) {
      this.goal.azimuth += this.spinSpeed * dt;
      this.cur.azimuth += wrapAngle(this.goal.azimuth - this.cur.azimuth) * Math.min(1, dt * 2.2);
    } else {
      this.cur.azimuth += (this.goal.azimuth - this.cur.azimuth) * Math.min(1, dt * 7);
    }
    this.cur.elevation += (this.goal.elevation - this.cur.elevation) * Math.min(1, dt * 7);
    this.cur.distance += (this.goal.distance - this.cur.distance) * Math.min(1, dt * 6);
    this.cur.targetY += (this.goal.targetY - this.cur.targetY) * Math.min(1, dt * 6);
    this._applyCamera();

    if (this.character) {
      const t = this.time;
      this.character.position.y = Math.sin(t * 1.15) * 0.0045;
      this.character.rotation.y = Math.sin(t * 0.55) * 0.012;
      const hair = this.character.userData.hair;
      if (hair) {
        hair.rotation.z = Math.sin(t * 0.9) * 0.012;
        hair.rotation.x = Math.sin(t * 0.7 + 1) * 0.008;
      }
      const halo = this.character.userData.halo;
      if (halo) {
        halo.rotation.z = Math.sin(t * 0.8) * 0.05;
        halo.position.y = this.character.userData.haloY + Math.sin(t * 1.5 + 0.6) * 0.012;
      }
    }

    if (this.usePost) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  start() {
    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, this.clock.getDelta());
      this.update(dt);
    };
    loop();
  }
}

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
