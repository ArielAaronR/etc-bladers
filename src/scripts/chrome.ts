// The whole page's 3D layer: chrome props in the corners, sparkles, and the ETC logo
// with a chrome orbit ring that passes in front of it and behind it.
import * as THREE from 'three';
import { gsap } from 'gsap';
import { asset } from '../lib/asset';

const LOGO_ASPECT = 521 / 1598; // height / width of public/logo.png (made by `npm run logo`)
const DEPTH = 14;
const ORBIT_RADIUS = 0.64; // the ring, in logo widths
const STAR_SIZE = 0.16; // the star riding it
const TAU = Math.PI * 2;

export function startChrome(
  canvas: HTMLCanvasElement,
  anchor: HTMLElement,
  button: HTMLButtonElement,
  readout: HTMLElement,
  // The "Coming up" list, when there is one: scrolling to it sends the logo back into the
  // distance, crawl-style, instead of letting it scroll away.
  crawl: HTMLElement | null = null,
) {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
  } catch {
    return; // No WebGL: the flat logo and the CSS background stay.
  }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.z = 10;

  scene.environment = studio(renderer);
  // Fades the background props toward the night sky; the logo at z=0 sits in front of it.
  scene.fog = new THREE.Fog(0x03141d, 11, 20);

  const chrome = new THREE.MeshPhysicalMaterial({
    color: 0xf2fffd,
    metalness: 1,
    roughness: 0.05,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    iridescence: 0.15,
    iridescenceIOR: 1.5,
    envMapIntensity: 1.3,
  });

  // Props, placed in viewport units (nx, ny in -1..1) so they hold the corners at any width.
  type Prop = {
    mesh: THREE.Object3D;
    nx: number;
    ny: number;
    z: number;
    size: number;
    spin: THREE.Vector3;
    bob: number;
    nyNarrow?: number;
  };
  const props: Prop[] = [];
  const add = (
    mesh: THREE.Object3D,
    nx: number,
    ny: number,
    z: number,
    size: number,
    spin: [number, number, number],
    nyNarrow?: number,
  ) => {
    mesh.rotation.set(
      Math.random() * 0.6,
      Math.random() * 0.6,
      Math.random() * TAU,
    );
    scene.add(mesh);
    props.push({
      mesh,
      nx,
      ny,
      z,
      size,
      spin: new THREE.Vector3(...spin),
      bob: Math.random() * TAU,
      nyNarrow,
    });
  };

  // Four-point star: long tips, a fat middle.
  const star = inflate(
    (a) => 0.42 + 0.58 * Math.pow(Math.abs(Math.cos(2 * a)), 3.5),
    0.6,
  );
  // Five-lobed blob.
  const blob = inflate((a) => 0.72 + 0.28 * Math.cos(5 * a), 0.5);
  // Background props: deeper in the scene, smaller, dimmer and slower than the logo, so
  // they set the mood without competing with it. Sizes scale with depth, so z only
  // changes parallax and fog, not apparent size.
  const distant = chrome.clone();
  distant.color.set(0x5f828b);
  distant.envMapIntensity = 0.65;
  add(new THREE.Mesh(star, distant), -0.9, 0.32, -5, 0.22, [0.03, 0.06, 0.02], 0.66);
  add(new THREE.Mesh(new THREE.TorusGeometry(1, 0.42, 64, 160), distant), 0.97, 0.4, -6, 0.14, [0.06, 0.1, 0.01], 0.6);
  add(new THREE.Mesh(blob, distant), 0.86, -0.74, -4.5, 0.2, [0.03, 0.06, -0.03]);
  add(planet(distant), -0.86, -0.7, -4, 0.1, [0.01, 0.1, 0]);
  add(new THREE.Mesh(spikeGeometry(), distant), 0.66, 0.06, -7, 0.13, [0, 0.25, 0], 3);
  for (const [nx, ny, z, s] of [
    [-0.66, 0.12, -3, 0.03],
    [0.78, -0.3, -3, 0.035],
    [0.36, 0.8, -5, 0.03],
    [-0.72, -0.34, -5, 0.03],
  ])
    add(new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), distant), nx, ny, z, s, [0, 0, 0]);

  // Sparkles and a field of small stars.
  const sparkleTex = sparkleTexture();
  const sparkles = [
    [-0.55, 0.78, 0.22],
    [0.74, 0.32, 0.16],
    [-0.9, -0.22, 0.14],
    [0.62, -0.92, 0.2],
    [0.16, 0.82, 0.1],
    [-0.2, -0.6, 0.09],
  ].map(([nx, ny, s], i) => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sparkleTex,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
    );
    scene.add(sprite);
    return { sprite, nx, ny, size: s, phase: i * 1.7 };
  });
  const stars = starField();
  scene.add(stars);

  // The hero: logo planes stacked into a fake extrusion, plus the orbit ring.
  const hero = new THREE.Group();
  const spin = new THREE.Group();
  hero.add(spin);
  scene.add(hero);

  const logoTex = new THREE.TextureLoader().load(asset('logo.png'), () => {
    document.documentElement.classList.add('chrome-ready');
    render();
  });
  logoTex.colorSpace = THREE.SRGBColorSpace;
  logoTex.anisotropy = 8;
  const plane = new THREE.PlaneGeometry(1, LOGO_ASPECT);
  for (let i = DEPTH; i >= 1; i--) {
    // The sides: the logo's own deep cyan, darker the further back.
    const shade = 0.6 - i * 0.028;
    const layer = new THREE.Mesh(
      plane,
      new THREE.MeshBasicMaterial({
        map: logoTex,
        color: new THREE.Color(shade * 0.25, shade * 0.75, shade),
        transparent: true,
        alphaTest: 0.5,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    layer.position.z = -i * 0.0045;
    layer.renderOrder = DEPTH - i;
    spin.add(layer);
  }
  const face = new THREE.Mesh(
    plane,
    new THREE.MeshBasicMaterial({
      map: logoTex,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  face.renderOrder = DEPTH + 1;
  spin.add(face);

  const glint = new THREE.ShaderMaterial({
    uniforms: { map: { value: logoTex }, t: { value: -1 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader:
      'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader:
      // Two light bands sweep the letters, weighted by how bright the metal already is,
      // so the shine sits on the chrome faces and not on the soft outer glow.
      'uniform sampler2D map; uniform float t; varying vec2 vUv; void main(){ vec4 c = texture2D(map, vUv); float lum = dot(c.rgb, vec3(0.3, 0.55, 0.15)); float d = vUv.x + vUv.y * 0.5 - t; float band = smoothstep(0.06, 0., abs(d)) + 0.6 * smoothstep(0.02, 0., abs(d - 0.11)); float a = c.a * smoothstep(0.3, 0.85, lum); gl_FragColor = vec4(vec3(0.92, 1., 0.98), band * a); }',
  });
  const glintMesh = new THREE.Mesh(plane, glint);
  glintMesh.position.z = 0.001;
  glintMesh.renderOrder = DEPTH + 2;
  spin.add(glintMesh);

  const orbit = new THREE.Group();
  orbit.rotation.set(1.22, 0, -0.2);
  orbit.position.y = -0.03;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(ORBIT_RADIUS, 0.02, 32, 200),
    chrome,
  );
  const rider = new THREE.Mesh(spikyStar(), chrome);
  rider.scale.setScalar(STAR_SIZE);
  orbit.add(ring, rider);
  // The ring is tipped over; undo that so the star rides it standing upright, turning on its own axis.
  const upright = new THREE.Quaternion();
  const turn = new THREE.Quaternion();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const standRider = (angle: number) => {
    upright.copy(orbit.quaternion).invert();
    rider.quaternion.copy(upright).multiply(turn.setFromAxisAngle(yAxis, angle));
  };
  hero.add(orbit);

  // Motion state.
  const float = { y: 0 };
  const tilt = { x: 0, y: 0 };
  const charge = { power: 0, boost: 0 };
  let charging: gsap.core.Tween | null = null;
  let busy = false;

  // Layout.
  const worldAt = (nx: number, ny: number, z: number) => {
    const h =
      Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) *
      (camera.position.z - z);
    return { x: nx * h * camera.aspect, y: ny * h, h, w: h * camera.aspect };
  };
  const layout = () => {
    const w = innerWidth;
    const h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const narrow = camera.aspect < 0.8;
    // On a phone the ring hugs the letters a little closer so the logo can stay big.
    orbit.scale.setScalar(narrow ? 0.88 : 1);
    for (const p of props) {
      const at = worldAt(
        p.nx * (narrow ? 1.05 : 1),
        narrow ? (p.nyNarrow ?? p.ny) : p.ny,
        p.z,
      );
      p.mesh.position.set(at.x, at.y, p.z);
      p.mesh.scale.setScalar(
        p.size * Math.min(at.w, at.h) * (narrow ? 1.1 : 1),
      );
    }
    for (const s of sparkles) {
      const at = worldAt(s.nx, s.ny, 0.5);
      s.sprite.position.set(at.x, at.y, 0.5);
      s.sprite.userData.size =
        s.size * Math.min(at.w, at.h) * (narrow ? 1.4 : 1);
    }
    placeHero();
  };
  const placeHero = () => {
    const r = anchor.getBoundingClientRect();
    const nx = ((r.left + r.width / 2) / innerWidth) * 2 - 1;
    const base = worldAt(0, 0, 0);
    // The ring and its star reach past the letters; keep all of it inside the screen
    // with a 16px margin each side.
    const reach = (ORBIT_RADIUS + STAR_SIZE) * 2 * orbit.scale.x;
    const size = (Math.min(r.width, (innerWidth - 32) / reach) / innerWidth) * base.w * 2;
    if (!crawl || reduce) {
      const at = worldAt(nx, -(((r.top + r.height / 2) / innerHeight) * 2 - 1), 0);
      hero.position.set(at.x, at.y + float.y * at.h * 0.02, 0);
      hero.scale.setScalar(size);
      return;
    }
    // Recede: hold the logo where it started on screen, then over the first screen of
    // scrolling sink it toward the glowing horizon, back into the fog, and shrink it,
    // moving the opposite way to the text scrolling up past it.
    const p = Math.min(Math.max(scrollY / (innerHeight * 0.9), 0), 1);
    const e = p * p * (3 - 2 * p);
    const startY = r.top + scrollY + r.height / 2;
    const y = startY + (innerHeight * 0.84 - startY) * e;
    const z = -8 * e;
    const at = worldAt(nx, -((y / innerHeight) * 2 - 1), z);
    hero.position.set(at.x, at.y + float.y * at.h * 0.02 * (1 - e), z);
    hero.scale.setScalar(size * (1 - 0.5 * e));
  };

  const render = () => {
    placeHero();
    renderer.render(scene, camera);
  };

  const tick = (time: number, deltaMs: number) => {
    const dt = Math.min(deltaMs / 1000, 0.05); // seconds, so speed is the same at 60Hz and 120Hz
    const t = time;
    for (const p of props) {
      p.mesh.rotation.x += p.spin.x * 0.4 * dt;
      p.mesh.rotation.y += p.spin.y * 0.4 * dt;
      p.mesh.rotation.z += p.spin.z * 0.4 * dt;
      p.mesh.position.y += Math.sin(t * 0.6 + p.bob) * 0.054 * dt;
    }
    for (const s of sparkles) {
      const k = 0.65 + 0.35 * Math.sin(t * 1.6 + s.phase);
      s.sprite.scale.setScalar(s.sprite.userData.size * k);
      s.sprite.material.rotation = Math.sin(t * 0.3 + s.phase) * 0.3;
    }
    stars.rotation.z = t * 0.005;
    camera.position.x += (tilt.y * 0.4 - camera.position.x) * 0.05;
    camera.position.y += (-tilt.x * 0.3 - camera.position.y) * 0.05;
    camera.lookAt(0, 0, 0);

    hero.rotation.y = tilt.y * 0.45 + Math.sin(t * 0.7) * 0.12;
    hero.rotation.x = tilt.x * 0.35;
    if (charging)
      spin.position.x = (Math.random() - 0.5) * 0.006 * charge.power;
    orbit.rotation.z = -0.2 + Math.sin(t * 0.4) * 0.06;
    const speed = 0.9 + charge.power * 4 + charge.boost * 9;
    rider.userData.a = (rider.userData.a ?? 0) + speed * dt;
    rider.position.set(
      Math.cos(rider.userData.a) * 0.64,
      Math.sin(rider.userData.a) * 0.64,
      0,
    );
    ring.rotation.z = rider.userData.a * 0.2;
    rider.userData.r = (rider.userData.r ?? 0) + (0.8 + charge.power * 6 + charge.boost * 20) * dt;
    standRider(rider.userData.r);
    const sweep = (t % 3.2) / 1.1; // a 1.1s pass every 3.2s
    glint.uniforms.t.value = sweep < 1 ? -0.3 + sweep * 2.1 : 5;

    render();
  };

  layout();
  addEventListener('resize', () => {
    layout();
    if (reduce) render();
  });
  if (reduce) addEventListener('scroll', render, { passive: true });

  if (reduce) {
    rider.position.set(0.64, 0, 0);
    standRider(0.4);
    render();
  } else {
    gsap.from(spin.rotation, {
      y: -Math.PI * 1.2,
      duration: 1.2,
      ease: 'expo.out',
    });
    gsap.from(hero.scale, {
      x: 0.001,
      y: 0.001,
      z: 0.001,
      duration: 1.2,
      ease: 'expo.out',
      immediateRender: false,
    });
    gsap.to(float, {
      y: 1,
      duration: 2.6,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    });
    gsap.ticker.add(tick);

    const tx = gsap.quickTo(tilt, 'x', { duration: 0.8, ease: 'power3.out' });
    const ty = gsap.quickTo(tilt, 'y', { duration: 0.8, ease: 'power3.out' });
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      ty(e.clientX / innerWidth - 0.5);
      tx(e.clientY / innerHeight - 0.5);
    });
    document.documentElement.addEventListener('pointerleave', () => {
      tx(0);
      ty(0);
    });
  }

  // The live thing: wind it up, let it rip. The orbit ball speeds up with the power.
  const hint = 'Press and hold the logo, then let go to launch it';
  readout.textContent = hint;

  const start = () => {
    if (busy || charging) return;
    charge.power = 0;
    charging = gsap.to(charge, {
      power: 1,
      duration: 1.4,
      ease: 'power1.in',
      onUpdate: () => {
        readout.textContent = `Winding up: ${Math.round(charge.power * 100)}% power`;
        if (!reduce) {
          spin.position.z = -0.12 * charge.power;
          spin.rotation.z = -0.1 * charge.power;
        }
      },
    });
  };

  const release = () => {
    if (!charging) return;
    charging.kill();
    charging = null;
    spin.position.x = 0;
    const power = Math.max(charge.power, 0.15);
    const turns = Math.round(2 + power * 10);
    busy = true;
    readout.textContent = `Let it rip: ${Math.round(power * 100)}% power, ${turns} turns`;
    const done = () => {
      busy = false;
      spin.rotation.y %= TAU;
    };
    if (reduce) {
      charge.power = 0;
      return done();
    }
    gsap.to(charge, { power: 0, duration: 0.3, ease: 'power2.out' });
    gsap.fromTo(
      charge,
      { boost: power },
      { boost: 0, duration: 1.2 + power * 2.6, ease: 'power3.out' },
    );
    gsap.to(spin.position, { z: 0, duration: 0.5, ease: 'power3.out' });
    gsap.to(spin.rotation, { z: 0, duration: 0.5, ease: 'power3.out' });
    gsap.to(spin.rotation, {
      y: `+=${turns * TAU}`,
      duration: 1.2 + power * 2.6,
      ease: 'power4.out',
      onComplete: done,
    });
  };

  button.addEventListener('pointerdown', (e) => {
    button.setPointerCapture(e.pointerId);
    start();
  });
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('contextmenu', (e) => e.preventDefault());
  button.addEventListener('selectstart', (e) => e.preventDefault());
  button.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault();
      start();
    }
  });
  button.addEventListener('keyup', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      release();
    }
  });
}

// A studio to reflect: deep violet sky, a white horizon band, a few soft lights.
function studio(renderer: THREE.WebGLRenderer) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const g = c.getContext('2d')!;
  const sky = g.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, '#04141c');
  sky.addColorStop(0.2, '#6fa9b4');
  sky.addColorStop(0.36, '#e4fbf6');
  sky.addColorStop(0.47, '#ffffff');
  sky.addColorStop(0.5, '#062a3a');
  sky.addColorStop(0.58, '#0ea0e0');
  sky.addColorStop(0.7, '#2fe0c8');
  sky.addColorStop(0.85, '#03161f');
  sky.addColorStop(1, '#000000');
  g.fillStyle = sky;
  g.fillRect(0, 0, 1024, 512);
  g.filter = 'blur(10px)';
  const light = (x: number, y: number, w: number, h: number, color: string) => {
    g.fillStyle = color;
    g.fillRect(x, y, w, h);
  };
  light(120, 60, 180, 100, '#ffffff');
  light(560, 30, 240, 80, '#ffffff');
  light(850, 110, 110, 150, '#0ea0e0');
  light(330, 140, 90, 70, '#021018');
  light(700, 150, 60, 90, '#021018');
  light(40, 300, 280, 50, '#ffffff');
  light(640, 330, 200, 60, '#5ff0d6');
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(tex).texture;
  tex.dispose();
  pmrem.dispose();
  return env;
}

// A sphere pushed out to an outline r(angle) and flattened, so it reads as a balloon of
// liquid metal: thick in the middle, thinning toward the tips.
// A diamond sparkle in 3D: long spikes up and down, shorter ones to the sides, short
// ones front and back, with curved-in edges between them and a puffy middle.
function spikyStar() {
  const geo = new THREE.SphereGeometry(1, 192, 128);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  // The surface |x/X|^q + |y/Y|^q + |z/Z|^q = 1 with q < 1 is a star with concave sides
  // and sharp tips; blending it with a small sphere gives the swollen middle.
  const q = 0.6;
  const [X, Y, Z] = [0.6, 1, 0.32];
  const core = 0.26;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const sum =
      Math.pow(Math.abs(v.x / X), q) +
      Math.pow(Math.abs(v.y / Y), q) +
      Math.pow(Math.abs(v.z / Z), q);
    const star = Math.pow(sum, -1 / q);
    const r = Math.pow(Math.pow(star, 6) + Math.pow(core, 6), 1 / 6);
    p.setXYZ(i, v.x * r, v.y * r, v.z * r);
  }
  geo.computeVertexNormals();
  return geo;
}

function inflate(r: (angle: number) => number, flat: number) {
  const geo = new THREE.SphereGeometry(1, 320, 120);
  geo.rotateX(Math.PI / 2); // poles to front and back, so the outline lies in x/y
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = r(Math.atan2(v.y, v.x));
    p.setXYZ(i, v.x * k, v.y * k, v.z * flat * Math.sqrt(k));
  }
  geo.computeVertexNormals();
  return geo;
}

// A long four-point spike, like a lens flare turned to metal.
function spikeGeometry() {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    pts.push(
      new THREE.Vector2(0.28 * Math.pow(Math.sin(t * Math.PI), 3), t * 2 - 1),
    );
  }
  return new THREE.LatheGeometry(pts, 4);
}

// A ball with a thin orbit wire and a small moon on it.
function planet(mat: THREE.Material) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), mat));
  const wire = new THREE.Group();
  wire.rotation.set(1.3, 0.3, 0.4);
  wire.add(new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.02, 16, 200), mat));
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 24), mat);
  moon.position.set(1.9, 0, 0);
  wire.add(moon);
  g.add(wire);
  return g;
}

function sparkleTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.translate(128, 128);
  const core = g.createRadialGradient(0, 0, 0, 0, 0, 40);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(0.3, 'rgba(200,255,245,0.6)');
  core.addColorStop(1, 'rgba(20,170,230,0)');
  g.fillStyle = core;
  g.fillRect(-128, -128, 256, 256);
  g.fillStyle = '#ffffff';
  for (const [rx, ry] of [
    [126, 5],
    [5, 126],
  ]) {
    g.beginPath();
    g.ellipse(0, 0, rx, ry, 0, 0, TAU);
    g.fill();
  }
  return new THREE.CanvasTexture(c);
}

function starField() {
  const n = 500;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 30;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
    pos[i * 3 + 2] = -6 - Math.random() * 6;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: 0xcff8ff,
      size: 0.035,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      fog: false, // the star field is the sky itself; fog would erase it
    }),
  );
}
