import * as THREE from '../../../optional-practice/civilian-fpv/vendor/three.module.js';
import { createVerifiedSceneryWindow } from './verified-scenery-window.mjs';
import { validateRegionManifest, REGION_LIMITS } from './region-manifest.mjs';
const canvas = document.querySelector('canvas'),
  status = document.querySelector('#status'),
  input = document.querySelector('#manifest');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
const scene = new THREE.Scene();
scene.background = new THREE.Color('#bfd0d4');
scene.add(new THREE.HemisphereLight(0xc7e7fa, 0x6c5845, 2));
const light = new THREE.DirectionalLight(0xffe9c3, 2);
light.position.set(100, 300, 80);
scene.add(light);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1400);
const views = [
  ['Overview', [192, 4, 192], [460, 320, 480], [192, 0, 192]],
  ['Mill atrium', [64, 4, 64], [64, 34, 112], [64, 9, 64]],
  ['Warehouse doors', [190, 4, 50], [190, 5, 5], [190, 5, 75]],
  ['Parking decks', [64, 4, 260], [10, 8, 205], [64, 8, 260]],
  ['Viaduct', [174, 5, 255], [174, 5, 220], [174, 5, 270]],
  ['Tower court', [320, 5, 250], [270, 28, 220], [320, 15, 260]],
];
let window = null,
  busy = false,
  closed = false,
  controller = null;
const mm = (p) => ({
  x: Math.round(p[0] * 1000),
  y: Math.round(p[1] * 1000),
  z: Math.round(p[2] * 1000),
});
function draw() {
  if (closed) return;
  const rect = canvas.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
}
function controls(value) {
  busy = value;
  for (const button of document.querySelectorAll('button')) button.disabled = value;
}
async function view(v) {
  if (!window || busy || closed) return;
  controls(true);
  status.textContent = 'Preparing exact scenery and collision…';
  try {
    const result = await window.transition(mm(v[1]));
    if (closed) return;
    scene.add(window.group);
    const origin = result.provenance.originMm;
    const local = (p) => [p[0] - origin.x / 1000, p[1] - origin.y / 1000, p[2] - origin.z / 1000];
    camera.position.fromArray(local(v[2]));
    camera.lookAt(...local(v[3]));
    status.textContent = `${v[0]} · ${result.provenance.chunks.length} verified cells · ${window.group.children.length} matching meshes/colliders · ${result.geometryBytes} geometry bytes · no flight admission`;
    draw();
  } catch (error) {
    if (!closed) status.textContent = `Preparation stopped: ${error.message}`;
  } finally {
    if (!closed) controls(false);
  }
}
for (const v of views) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = v[0];
  button.onclick = () => view(v);
  document.querySelector('#views').append(button);
}
document.querySelector('form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy || closed) return;
  controls(true);
  controller = new AbortController();
  try {
    const url = new URL(input.value, location.href);
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Manifest HTTP ${response.status}`);
    const reader = response.body.getReader();
    let total = 0;
    const parts = [];
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > REGION_LIMITS.jsonBytes) throw new Error('Manifest exceeds allowance');
        parts.push(value);
      }
    } finally {
      await reader.cancel();
    }
    const data = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
      data.set(part, offset);
      offset += part.length;
    }
    const manifest = validateRegionManifest(new TextDecoder('utf-8', { fatal: true }).decode(data));
    if (closed) return;
    await window?.dispose();
    window = createVerifiedSceneryWindow(manifest, {
      baseURL: new URL('./', url).href,
      surfaceStyle: new URLSearchParams(location.search).get('surface') ?? 'plain',
    });
    controls(false);
    await view(views[0]);
  } catch (error) {
    if (!closed) status.textContent = `Preparation stopped: ${error.message}`;
  } finally {
    controller = null;
    if (!closed) controls(false);
  }
});
document.querySelector('#release').onclick = async () => {
  if (busy) return;
  controls(true);
  await window?.dispose();
  window = null;
  status.textContent = 'Resources released; no live scenery or collision.';
  draw();
  controls(false);
};
input.value = new URLSearchParams(location.search).get('manifest') ?? '';
addEventListener('resize', draw);
addEventListener('pagehide', () => {
  closed = true;
  controller?.abort();
  window?.dispose();
  renderer.dispose();
});
if (input.value) document.querySelector('form').requestSubmit();
