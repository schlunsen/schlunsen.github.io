/**
 * "Me, standing in the painting": the looping smile clip on a WebGL plane.
 *
 * The video packs colour (left half) and a person matte (right half, from a
 * segmentation model: scripts/matte.sh), so only I appear: the painted sky, sun
 * and hills show around me. The bottom feathers into the hills, a touch of film
 * grain, and the plane tilts gently towards the mouse.
 */
import {
  WebGLRenderer, Scene, PerspectiveCamera, PlaneGeometry, Mesh, ShaderMaterial,
  VideoTexture, LinearFilter, NoColorSpace, LinearSRGBColorSpace,
} from 'three';

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const frag = /* glsl */ `
  precision highp float;
  uniform sampler2D uTex;   // left half: colour, right half: person matte
  uniform float uTime;
  uniform float uFade;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    vec3 c = texture2D(uTex, vec2(vUv.x * 0.5, vUv.y)).rgb;
    float a = texture2D(uTex, vec2(0.5 + vUv.x * 0.5, vUv.y)).r;
    a = smoothstep(0.08, 0.92, a);                 // tighten the soft matte edge

    // fade the shoulders out into the hills, and never show the clip's side edges
    a *= smoothstep(0.02, 0.3, vUv.y);
    a *= smoothstep(0.0, 0.16, vUv.x) * smoothstep(0.0, 0.16, 1.0 - vUv.x);

    // a gentle, natural grade and a little grain
    c = (c - 0.5) * 1.04 + 0.5;
    c *= vec3(1.02, 1.0, 0.975);
    c += (hash(vUv * 900.0 + fract(uTime) * 37.0) - 0.5) * 0.03;

    a *= uFade;
    gl_FragColor = vec4(c * a, a);                 // premultiplied
  }
`;

export function mountMe(root: HTMLElement, src: string, onState?: (playing: boolean) => void) {
  const canvas = root.querySelector('canvas') as HTMLCanvasElement | null;
  if (!canvas) return null;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true });
  } catch {
    return null; // no WebGL: the keyed still stays
  }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = LinearSRGBColorSpace; // pass video colours straight through

  const video = document.createElement('video');
  video.src = src;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.setAttribute('aria-hidden', 'true');

  const tex = new VideoTexture(video);
  tex.colorSpace = NoColorSpace;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;

  const mat = new ShaderMaterial({
    uniforms: { uTex: { value: tex }, uTime: { value: 0 }, uFade: { value: 0 } },
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    premultipliedAlpha: true,
  });

  const scene = new Scene();
  const camera = new PerspectiveCamera(28, 4 / 5, 0.1, 50);
  const plane = new Mesh(new PlaneGeometry(4, 5), mat);
  scene.add(plane);

  const fit = () => {
    const w = root.clientWidth, h = root.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // distance so the 5-unit-tall plane fills the view, with a little room to tilt
    camera.position.z = (5 * 1.04) / (2 * Math.tan((camera.fov * Math.PI) / 360));
    camera.updateProjectionMatrix();
  };
  fit();
  new ResizeObserver(fit).observe(root);

  // tilt toward the pointer (eased), plus a slow idle sway
  let tx = 0, ty = 0, rx = 0, ry = 0;
  window.addEventListener('pointermove', (e) => {
    const r = root.getBoundingClientRect();
    tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2)));
    ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2)));
  }, { passive: true });

  let playing = false, wantPlay = !reduce.matches, visible = true, raf = 0;
  const t0 = performance.now();
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const t = (now - t0) / 1000;
    const k = reduce.matches ? 0 : 1;
    rx += ((-ty * 0.07 + Math.sin(t * 0.5) * 0.012) * k - rx) * 0.06;
    ry += ((tx * 0.12 + Math.sin(t * 0.37) * 0.02) * k - ry) * 0.06;
    plane.rotation.set(rx, ry, 0);
    mat.uniforms.uTime.value = t;
    mat.uniforms.uFade.value += ((video.readyState >= 2 ? 1 : 0) - mat.uniforms.uFade.value) * 0.08;
    renderer.render(scene, camera);
  };

  const sync = () => {
    const run = visible && !document.hidden;
    cancelAnimationFrame(raf);
    if (run) raf = requestAnimationFrame(frame);
    if (run && wantPlay) video.play().then(() => { playing = true; root.classList.add('is-playing'); onState?.(true); }).catch(() => {});
    else { video.pause(); playing = false; onState?.(false); }
  };
  video.addEventListener('loadeddata', () => { root.classList.add('ready'); renderer.render(scene, camera); });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }).observe(root);
  document.addEventListener('visibilitychange', sync);
  sync();

  return {
    toggle() { wantPlay = !playing; sync(); return wantPlay; },
    get playing() { return playing; },
  };
}
