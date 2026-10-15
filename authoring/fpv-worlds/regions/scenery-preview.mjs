import * as THREE from '../../../optional-practice/civilian-fpv/vendor/three.module.js';
import { createSceneryLighting } from './scenery-lighting.mjs';
import { createVerifiedMixedWindow } from './verified-mixed-window.mjs';
import { createVerifiedSceneryWindow } from './verified-scenery-window.mjs';
import { validateRegionManifest, REGION_LIMITS } from './region-manifest.mjs';
import { desertLandmarkViews } from './desert-expedition/landmark-views.mjs';
const canvas = document.querySelector('canvas'),
  status = document.querySelector('#status'),
  input = document.querySelector('#manifest');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
const scene = new THREE.Scene();
const lighting = createSceneryLighting(
  scene,
  renderer,
  new URLSearchParams(location.search).get('lighting') ?? 'plain',
);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1400);
const urbanViews = [
  ['Overview', [192, 4, 192], [460, 320, 480], [192, 0, 192]],
  ['Mill atrium', [64, 4, 64], [64, 34, 112], [64, 9, 64]],
  ['North loading court', [190, 4, 16], [190, 7, -18], [190, 4, 55]],
  ['South loading approach', [190, 4, 140], [190, 7, 182], [190, 3, 98]],
  ['Warehouse doors', [190, 4, 50], [190, 5, 5], [190, 5, 75]],
  ['Hall services', [190, 4, 50], [190, 5, 34], [190, 9, 90]],
  ['Hall roof frames', [190, 4, 50], [137, 25, 17], [190, 12, 64]],
  ['Parking decks', [64, 4, 260], [10, 8, 205], [64, 8, 260]],
  ['Parking ramp approach', [64, 4, 220], [34, 9, 157], [64, 9, 215]],
  ['Parking upper turn', [64, 4, 220], [111, 28, 173], [68, 12, 202]],
  ['Viaduct', [174, 5, 255], [174, 5, 220], [174, 5, 270]],
  ['Tower court', [320, 5, 250], [270, 28, 220], [320, 15, 260]],
];
const canyonViews = [
  ['Canyon overview', [192, 34, 192], [500, 350, 500], [192, 42, 192]],
  ['Arrival landmarks', [110, 16, 100], [108, 13, 150], [145, 20, 100]],
  ['Twin spire gap', [162, 18, 104], [162, 18, 60], [162, 18, 124]],
  ['Gorge entry', [215, 34, 230], [250, 35, 184], [194, 34, 240]],
  ['Needle bend', [210, 34, 300], [231, 34, 268], [184, 32, 302]],
  ['Ridge crown', [345, 90, 65], [375, 120, 123], [345, 85, 65]],
];
const railwayViews = [
  ['Railway overview', [192, 30, 192], [500, 280, 500], [192, 10, 192]],
  ['Trestle crossing', [192, 4, 160], [145, 7, 160], [205, 10, 176]],
  ['Bridge structure', [192, 22, 176], [176, 25, 130], [192, 22, 184]],
  ['Freight yard', [250, 19, 64], [250, 22, 24], [250, 18, 90]],
  ['Maintenance hall', [300, 20, 64], [300, 20, 26], [300, 20, 80]],
  ['Workshop frames', [300, 20, 64], [300, 19, 46], [292, 22, 85]],
  ['Station canopy', [166, 19, 64], [166, 19, 20], [166, 19, 88]],
  ['Cutting traverse', [192, 0, 180], [40, 2, 180], [240, 3, 180]],
];
const canyonDistrictViews = [
  ...canyonViews,
  ['Red Mesa terraces', [565, 115, 190], [680, 170, 280], [565, 100, 180]],
  ['Serpentine Gorge', [250, 34, 480], [250, 65, 430], [250, 25, 540]],
  ['Twin Buttes crossing', [560, 125, 375], [705, 210, 505], [560, 110, 375]],
  ['Split Ravine', [180, 34, 590], [235, 95, 550], [160, 24, 630]],
  ['Sunset Shelf', [570, 125, 620], [720, 200, 760], [570, 112, 620]],
];
const railwayExpanseViews = [
  ['Freight district', [640, 75, 640], [820, 170, 460], [640, 72, 640]],
  ['Freight hall approach', [588, 72, 574], [588, 69, 558], [588, 70, 650]],
  ['River viaduct', [2048, 40, 2048], [1920, 42, 1970], [2070, 46, 2080]],
  ['Quarry conveyor', [3456, 75, 600], [3456, 72, 548], [3456, 80, 670]],
  ['Station canopy', [640, 71, 3200], [640, 68, 3120], [640, 69, 3240]],
  ['Foundry yard', [2048, 76, 3200], [1960, 78, 3090], [2070, 80, 3240]],
  ['Timber sidings', [3456, 72, 3200], [3427, 69, 3110], [3427, 70, 3280]],
];
const coasterViews = [
  ['Arrival gardens', [384, 14, 384], [285, 50, 485], [384, 13, 384]],
  ['Loop meadow', [1280, 14, 384], [1330, 35, 485], [1408, 18, 448]],
  ['Ridge station', [1664, 14, 640], [1565, 55, 745], [1664, 18, 640]],
  ['Service courts', [1408, 14, 1408], [1300, 42, 1500], [1408, 15, 1408]],
  ['Woodland promenade', [640, 14, 1664], [545, 35, 1760], [640, 13, 1664]],
  ['River gardens', [384, 14, 1152], [285, 40, 1250], [384, 13, 1152]],
];
const alpineViews = [
  ['Glacial valley', [640, 120, 700], [750, 170, 840], [630, 114, 690]],
  ['Switchback pass', [1700, 272, 665], [1880, 345, 800], [1700, 272, 675]],
  ['Snow saddle', [3000, 434, 800], [3130, 495, 950], [3000, 441, 790]],
  ['Summit station', [3400, 575, 3100], [3550, 655, 3260], [3400, 576, 3120]],
  ['Viaduct gorge', [2400, 219, 3070], [2530, 285, 3220], [2400, 224, 3070]],
  ['Reservoir dam', [800, 184, 2800], [970, 250, 2970], [800, 184, 2790]],
];
const views =
  {
    'coaster-gardens': coasterViews,
    canyon: canyonViews,
    'canyon-districts': canyonDistrictViews,
    railway: railwayViews,
    'railway-expanse': railwayExpanseViews,
    alpine: alpineViews,
    'desert-landmarks': desertLandmarkViews,
  }[new URLSearchParams(location.search).get('views')] ?? urbanViews;
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
    lighting.focus(window.group, local(v[3]), v === views[0]);
    let meshCount = 0;
    window.group.traverse((object) => {
      if (object.isMesh) meshCount++;
    });
    status.textContent = `${v[0]} · ${result.provenance.chunks.length} verified cells · ${meshCount} matching meshes/colliders · ${result.geometryBytes} geometry bytes · no flight admission`;
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
async function loadManifest(url, signal) {
  const response = await fetch(url, { signal });
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
  return validateRegionManifest(new TextDecoder('utf-8', { fatal: true }).decode(data));
}
document.querySelector('form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy || closed) return;
  controls(true);
  controller = new AbortController();
  try {
    const url = new URL(input.value, location.href);
    const companion = new URLSearchParams(location.search).get('companion');
    const companionURL = companion ? new URL(companion, location.href) : null;
    const [manifest, terrain] = await Promise.all([
      loadManifest(url, controller.signal),
      companionURL ? loadManifest(companionURL, controller.signal) : null,
    ]);
    if (closed) return;
    await window?.dispose();
    const scenerySource = {
      baseURL: new URL('./', url).href,
      surfaceStyle: new URLSearchParams(location.search).get('surface') ?? 'plain',
    };
    window = terrain
      ? createVerifiedMixedWindow(terrain, {
          source: {
            baseURL: new URL('./', companionURL).href,
            surfaceStyle: new URLSearchParams(location.search).get('ground') ?? 'plain',
            surfaceQuality: new URLSearchParams(location.search).get('quality') ?? 'balanced',
          },
          scenery: { manifest, source: scenerySource },
        })
      : createVerifiedSceneryWindow(manifest, scenerySource);
    controls(false);
    const requestedView = new URLSearchParams(location.search).get('view');
    const selected = views.find(
      (row) => row[0].toLowerCase().replaceAll(' ', '-') === requestedView,
    );
    await view(selected ?? views[0]);
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
  lighting.release();
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
  lighting.dispose();
  renderer.dispose();
});
if (input.value) document.querySelector('form').requestSubmit();
