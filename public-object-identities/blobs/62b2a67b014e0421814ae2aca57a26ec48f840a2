import * as THREE from '../../../optional-practice/civilian-fpv/vendor/three.module.js';
import { createFlightViewFrame } from '../../../optional-practice/civilian-fpv/renderer.mjs';
import {
  buildDroneVisual,
  disposeSimVisualGroup,
} from '../../../optional-practice/civilian-fpv/world-visuals.mjs';
import { createRegionalFlightPrototype } from './flight-prototype.mjs';
import { createRegionalInputSession } from './shared-input-session.mjs';
import { keyboardFlightHelp } from '../../../optional-practice/civilian-fpv/input.mjs';
import { validateRegionManifest } from './region-manifest.mjs';
const $ = (id) => document.getElementById(id),
  canvas = document.querySelector('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb8d4e3);
scene.add(new THREE.HemisphereLight(0xd8efff, 0x6d5941, 2));
const light = new THREE.DirectionalLight(0xffefcf, 2.5);
light.position.set(50, 100, 40);
scene.add(light);
const camera = new THREE.PerspectiveCamera(82, 1, 0.035, 900),
  quad = new THREE.Group();
const material = (color, extras = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extras });
const mesh = (geometry, paint, parent = quad) => {
  const value = new THREE.Mesh(geometry, paint);
  parent.add(value);
  return value;
};
const box = (size, at, color, parent = quad) => {
  const value = mesh(new THREE.BoxGeometry(...size), material(color), parent);
  value.position.set(...at);
  return value;
};
const droneVisual = buildDroneVisual({
  parent: quad,
  mesh,
  material,
  box,
  kind: 'racer',
  quality: 'balanced',
  maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
});
const flightViewFrame = createFlightViewFrame({ camera, aircraft: quad });
flightViewFrame.rotors = droneVisual.rotors;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const localBounds = {
  min: { x: 0, y: 0, z: 0 },
  max: { x: 128000, y: 0, z: 128000 },
};
flightViewFrame.bounds = localBounds;
let chunks = new Map();
function updateViewBounds(state) {
  const loaded =
    state?.terrain.provenance?.chunks?.map((row) => chunks.get(row.chunkId)).filter(Boolean) ?? [];
  if (!loaded.length) return;
  localBounds.min.x = Math.min(...loaded.map((row) => row.x)) * 128000;
  localBounds.min.z = Math.min(...loaded.map((row) => row.z)) * 128000;
  localBounds.max.x = (Math.max(...loaded.map((row) => row.x)) + 1) * 128000;
  localBounds.max.z = (Math.max(...loaded.map((row) => row.z)) + 1) * 128000;
  flightViewFrame.bounds = localBounds;
}
let manifestController = null,
  flight = null,
  busy = false,
  hudAt = 0,
  loadingGeneration = 0,
  closed = false;
function message(value) {
  $('message').textContent = value;
}
const session = createRegionalInputSession({
  window,
  document,
  createFlight: createRegionalFlightPrototype,
  onFlight(value) {
    flight = value;
    if (value) {
      value.root.add(quad);
      flightViewFrame.reset();
      scene.add(value.root);
    }
  },
  onState(state) {
    if (!state || closed) return;
    updateViewBounds(state);
    if (state.status === 'active') {
      message('Authoring flight active');
      canvas.focus();
    } else
      message(
        session.status().busy
          ? 'Preparing verified region…'
          : state.reason === 'prepared'
            ? 'Region ready. Arm deliberately to fly.'
            : state.reason === 'preparing-terrain'
              ? 'Preparing verified region…'
              : `Paused: ${state.reason}`,
      );
  },
  onCamera() {
    const modes = ['fpv', 'chase', 'overview'];
    $('view').value = modes[(modes.indexOf($('view').value) + 1) % modes.length];
  },
  onError(error) {
    message(`Paused: ${error.message}`);
  },
});
async function prepare() {
  if (!busy) await session.prepare();
}
async function reset() {
  if (!busy && !closed) await session.replace();
}
async function readManifest(url, signal) {
  const response = await fetch(url, {
    signal,
    credentials: 'omit',
    redirect: 'error',
  });
  if (!response.ok || !response.body) throw new Error('Manifest download failed');
  const reader = response.body.getReader(),
    parts = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 8 * 1024 * 1024) throw new Error('Manifest is too large');
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
    offset += part.length;
  }
  return validateRegionManifest(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
document.querySelector('form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy || session.status().busy) return;
  const token = ++loadingGeneration;
  busy = true;
  session.block(true);
  message('Loading bounded region manifest…');
  let timeout;
  try {
    manifestController?.abort();
    manifestController = new AbortController();
    timeout = setTimeout(() => manifestController.abort(), 30000);
    const url = new URL($('manifest').value, location.href);
    const manifest = await readManifest(url, manifestController.signal);
    let scenery = null;
    if ($('geometry-profile').value === 'terrain-scenery-v1') {
      const companionURL = new URL($('scenery-manifest').value, location.href);
      scenery = {
        manifest: await readManifest(companionURL, manifestController.signal),
        source: { baseURL: new URL('.', companionURL).href },
      };
    }
    if (token !== loadingGeneration || closed) return;
    clearTimeout(timeout);
    chunks = new Map(manifest.chunks.map((chunk) => [chunk.id, chunk]));
    const selectedSpawn = $('spawn').value;
    $('spawn').replaceChildren(
      ...manifest.spawns.map((spawn) => {
        const option = document.createElement('option');
        option.value = spawn.id;
        option.textContent = spawn.id.replaceAll('-', ' ');
        return option;
      }),
    );
    if (manifest.spawns.some((spawn) => spawn.id === selectedSpawn))
      $('spawn').value = selectedSpawn;
    $('spawn').disabled = false;
    const heading = $('heading').value,
      surface = $('surface').value;
    const surfaceStyle =
      surface === 'auto' ? (manifest.id === 'canyon-badlands-study' ? 'canyon' : 'plain') : surface;
    const prepared = await session.replace({
      manifest,
      spawnId: $('spawn').value,
      initialHeading: heading === 'region-centre' ? heading : Number(heading),
      geometryProfile: $('geometry-profile').value,
      scenery,
      mode: $('mode').value,
      source: {
        baseURL: new URL('.', url).href,
        surfaceStyle,
        surfaceQuality: $('surface-quality').value,
      },
    });
    if (token !== loadingGeneration || closed) {
      session.pause();
      return;
    }
    document.querySelector('details').open = !prepared;
  } catch (error) {
    document.querySelector('details').open = true;
    message(`Paused: ${error.message}`);
  } finally {
    clearTimeout(timeout);
    busy = false;
    session.block(false);
    if (token !== loadingGeneration && !closed) {
      document.querySelector('details').open = true;
      message('Loading cancelled. Prepare or load again to continue; flight stays paused.');
    }
  }
});
$('cancel-load').onclick = () => {
  loadingGeneration++;
  manifestController?.abort();
  session.pause();
  document.querySelector('details').open = true;
  message('Loading cancelled. Prepare or load again to continue; flight stays paused.');
};
$('prepare').onclick = prepare;
$('reset').onclick = reset;
$('arm').onclick = () => {
  if (busy || closed) return;
  if (!session.arm())
    message(
      'Prepare the region, centre the controls and release controller buttons before arming.',
    );
};
$('pause').onclick = () => session.pause();
$('source').onchange = () => {
  session.select($('source').value);
  document.body.dataset.input = $('source').value;
  $('touch-controls').hidden = $('source').value !== 'touch';
  canvas.focus();
};
$('mode').onchange = () => session.setMode($('mode').value);
canvas.focus();
$('view').onchange = () => canvas.focus();
session.bindStick($('left-stick'), 'left');
session.bindStick($('right-stick'), 'right');
document.querySelector('header').addEventListener('focusin', () => session.pause());
$('keyboard-help').textContent = keyboardFlightHelp('two-stick');
function resize() {
  const width = canvas.clientWidth,
    height = canvas.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();
const requested = new URL(location.href).searchParams.get('manifest');
if (requested) $('manifest').value = requested;
const companion = new URL(location.href).searchParams.get('scenery');
if (companion) $('scenery-manifest').value = companion;
const profile = new URL(location.href).searchParams.get('profile');
if (['terrain-v1', 'scenery-v1', 'terrain-scenery-v1'].includes(profile))
  $('geometry-profile').value = profile;
function updateSurfaceControls() {
  const selected = $('geometry-profile').value;
  const mixed = selected === 'terrain-scenery-v1';
  $('scenery-manifest').hidden = !mixed;
  $('scenery-manifest').required = mixed;
  const disabled = selected === 'scenery-v1';
  $('surface').disabled = disabled;
  $('surface-quality').disabled = disabled;
}
$('geometry-profile').addEventListener('change', updateSurfaceControls);
updateSurfaceControls();
function render() {
  if (closed) return;
  session.advance(performance.now());
  if ($('source').value === 'touch') {
    const controls = session.status().controls;
    $('left-stick').querySelector('i').style.transform =
      `translate(${controls.yaw * 40}px, ${(0.5 - controls.throttle) * 80}px)`;
    $('right-stick').querySelector('i').style.transform =
      `translate(${controls.roll * 40}px, ${-controls.pitch * 40}px)`;
  }
  if (flight) {
    const state = flight.snapshot();
    flightViewFrame.view = $('view').value;
    flightViewFrame.originMm = state.originMm;
    flightViewFrame.throttlePermille = Math.round(session.status().controls.throttle * 1000);
    flightViewFrame.reducedMotion = reducedMotion.matches;
    flightViewFrame.draw(state);
    if (performance.now() - hudAt > 125) {
      hudAt = performance.now();
      const state = flight.snapshot();
      $('telemetry').textContent =
        `${state.ticks} ticks · throttle ${Math.round(session.status().controls.throttle * 100)}% · ${state.recentres} local frames · ${state.terrain.geometryBytes} geometry bytes`;
    }
  } else {
    camera.position.set(0, 12, 25);
    camera.lookAt(0, 0, 0);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
addEventListener('pagehide', () => {
  closed = true;
  manifestController?.abort();
  loadingGeneration++;
  void session.dispose();
  disposeSimVisualGroup(quad);
  renderer.dispose();
});
