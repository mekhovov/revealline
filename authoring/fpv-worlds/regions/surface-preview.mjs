import * as THREE from '../../../optional-practice/civilian-fpv/vendor/three.module.js';
import { validateRegionManifest, REGION_LIMITS } from './region-manifest.mjs';
import { createVerifiedTerrainWindow } from './verified-terrain-window.mjs';
const $ = (id) => document.getElementById(id),
  canvas = document.querySelector('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb8d4e3);
scene.add(new THREE.HemisphereLight(0xd8efff, 0x6d5941, 1));
const sun = new THREE.DirectionalLight(0xffedce, 3);
sun.position.set(-60, 100, 20);
scene.add(sun);
const camera = new THREE.PerspectiveCamera(65, 1, 0.2, 1000);
const views = {
  gorge: { point: [280, 90, 360], eye: [305, 72, 425], look: [245, 28, 310] },
  basin: { point: [150, 70, 125], eye: [80, 30, 200], look: [215, 30, 170] },
  spires: { point: [550, 160, 400], eye: [650, 170, 530], look: [510, 100, 330] },
};
let live = null,
  pending = null,
  controller = null,
  generation = 0,
  closed = false,
  busy = false;
const status = (text) => {
  $('status').textContent = text;
};
function draw() {
  if (closed || busy) return;
  const rect = canvas.getBoundingClientRect();
  renderer.setPixelRatio(
    Math.min(devicePixelRatio, { performance: 1, balanced: 1.5, quality: 2 }[$('quality').value]),
  );
  renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
  camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height);
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
}
async function readManifest(url, signal) {
  const response = await fetch(url, { signal, credentials: 'omit', redirect: 'error' });
  if (!response.ok || !response.body) throw new Error('Manifest unavailable');
  const reader = response.body.getReader(),
    parts = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > REGION_LIMITS.jsonBytes) throw new Error('Manifest exceeds regional limit');
      parts.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  return validateRegionManifest(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
async function release() {
  generation++;
  controller?.abort();
  busy = false;
  const old = live,
    staged = pending;
  live = null;
  pending = null;
  await Promise.all([old?.dispose(), staged?.dispose()]);
  if (!closed) {
    status('Resources released. No live terrain.');
    draw();
  }
}
async function prepare(event) {
  event?.preventDefault();
  if (closed) return;
  const token = ++generation;
  controller?.abort();
  const previousPending = pending;
  pending = null;
  await previousPending?.dispose();
  if (token !== generation || closed) return;
  busy = true;
  status('Preparing verified terrain and shaders…');
  controller = new AbortController();
  const currentController = controller,
    timeout = setTimeout(() => currentController.abort(), 30000);
  let staged = null;
  try {
    const url = new URL($('manifest').value, location.href);
    const manifest = await readManifest(url, currentController.signal);
    if (token !== generation || closed) return;
    if (manifest.id !== 'canyon-badlands-study')
      throw new Error('This surface study needs Canyon Badlands terrain');
    const view = views[$('view').value];
    staged = createVerifiedTerrainWindow(manifest, {
      baseURL: new URL('.', url).href,
      surfaceStyle: $('surface').value,
      surfaceQuality: $('quality').value,
    });
    pending = staged;
    const ready = await staged.transition({
      x: view.point[0] * 1000,
      y: view.point[1] * 1000,
      z: view.point[2] * 1000,
    });
    if (token !== generation || closed) return;
    const origin = ready.provenance.originMm;
    const stagedCamera = camera.clone();
    stagedCamera.position.set(
      ...view.eye.map((value, i) => value - origin[['x', 'y', 'z'][i]] / 1000),
    );
    stagedCamera.lookAt(...view.look.map((value, i) => value - origin[['x', 'y', 'z'][i]] / 1000));
    scene.add(staged.group);
    await renderer.compileAsync(scene, stagedCamera);
    if (token !== generation || closed) return;
    const previous = live;
    live = staged;
    staged = null;
    pending = null;
    await previous?.dispose();
    camera.copy(stagedCamera);
    busy = false;
    draw();
    status(
      `${$('surface').selectedOptions[0].textContent} · ${$('quality').value} · ${ready.provenance.chunks.length} verified cells · ${ready.geometryBytes} geometry bytes · ${renderer.info.render.triangles} visible triangles · shaders prepared`,
    );
  } catch (error) {
    if (token === generation && !closed) {
      staged?.group?.removeFromParent();
      busy = false;
      status(`Preparation failed; retained view unchanged. ${error.message}`);
      draw();
    }
  } finally {
    clearTimeout(timeout);
    if (pending === staged) pending = null;
    await staged?.dispose();
  }
}
document.querySelector('form').addEventListener('submit', prepare);
$('release').addEventListener('click', release);
window.addEventListener('resize', draw);
window.addEventListener(
  'pagehide',
  () => {
    closed = true;
    void release().finally(() => renderer.dispose());
  },
  { once: true },
);
$('manifest').value = new URL(location.href).searchParams.get('manifest') ?? '';
draw();
if ($('manifest').value) void prepare();
