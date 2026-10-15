import { Group } from '../../../optional-practice/civilian-fpv/vendor/three.module.js';
import { createFlightRenderer } from '../../../optional-practice/civilian-fpv/renderer.mjs';
import { createVerifiedMixedWindow } from './verified-mixed-window.mjs';
const $ = (id) => document.getElementById(id);
const parameters = new URLSearchParams(location.search);
for (const id of ['terrain', 'scenery', 'surface'])
  if (parameters.has(id)) $(id).value = parameters.get(id);
const renderer = createFlightRenderer({
  canvas: document.querySelector('canvas'),
  onContextLost: () => {
    controller?.abort();
    owner?.cancel();
    $('status').textContent = 'Graphics context lost; reload to recover.';
  },
});
const root = new Group();
let owner = null,
  controller = null,
  position = null,
  origin = { x: 0, y: 0, z: 0 },
  closed = false,
  busy = false,
  frames = 0,
  frameId = 0,
  next = true,
  receipt = null,
  changeDuringPreparation = false;
function surfaceNames() {
  const names = new Set();
  root.traverse((object) => {
    for (const material of Array.isArray(object.material) ? object.material : [object.material])
      if (material?.userData?.setRegionalSurfaceQuality) names.add(material.name);
  });
  return [...names];
}
function changeQuality() {
  renderer.setQuality($('quality').value);
  $('receipt').textContent = JSON.stringify(
    {
      ...receipt,
      quality: $('quality').value,
      surfaceNames: surfaceNames(),
      resources: renderer.resources(),
    },
    null,
    2,
  );
}
function buttons() {
  $('load').disabled = busy || Boolean(owner) || closed;
  $('stage').disabled = busy || !owner || closed;
  $('stage-quality').disabled = busy || !owner || closed;
  $('cancel').disabled = !busy;
  $('release').disabled = !owner || closed;
}
async function manifest(input, signal) {
  const url = new URL(input, location.href);
  if (url.origin !== location.origin) throw new Error('Use a same-origin verified study source');
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('Manifest unavailable');
  return { manifest: await response.json(), source: { baseURL: new URL('.', url).href } };
}
async function prepare(load) {
  if (closed || busy) return;
  busy = true;
  controller = new AbortController();
  buttons();
  $('status').textContent = 'Preparing detached verified geometry; current area remains visible.';
  const startFrames = frames,
    operationStarted = performance.now(),
    previousPreparation = renderer.regionalPreparation()?.sequence;
  try {
    if (load) {
      const [terrain, scenery] = await Promise.all([
        manifest($('terrain').value, controller.signal),
        manifest($('scenery').value, controller.signal),
      ]);
      controller.signal.throwIfAborted();
      owner = createVerifiedMixedWindow(terrain.manifest, {
        source: { ...terrain.source, surfaceStyle: $('surface').value },
        scenery,
        retainCommitted: true,
      });
      position = { ...terrain.manifest.spawns[0].position };
      renderer.setRegional({ root }, terrain.manifest);
    }
    const previousOrigin = origin;
    let attached = null;
    const target = load || !next ? position : { ...position, x: 192000, z: 64000 };
    await owner.transition(target, null, {
      async prepare({ group }) {
        const preparation = renderer.prepareRegionalFrame(group, { signal: controller.signal });
        if (changeDuringPreparation) {
          changeDuringPreparation = false;
          $('quality').value = $('quality').value === 'low' ? 'high' : 'low';
          changeQuality();
        }
        await preparation;
      },
      readPose: () => ({ positionMm: position, radiusMm: 220 }),
      commit({ group, provenance }) {
        attached = group;
        root.add(group);
        origin = { ...provenance.originMm };
      },
      rollback() {
        attached?.removeFromParent();
        origin = previousOrigin;
      },
    });
    if (!load) next = !next;
    $('status').textContent = 'Prepared and adopted. Current verified area remains usable.';
  } catch (error) {
    $('status').textContent =
      error.name === 'AbortError'
        ? 'Preparation cancelled; previous verified area retained if present.'
        : `Preparation failed: ${error.message}`;
  } finally {
    const preparation = renderer.regionalPreparation();
    receipt = {
      preparation: preparation?.sequence !== previousPreparation ? preparation : null,
      rendererStageStarted: preparation?.sequence !== previousPreparation,
      visibleFramesDuringPreparation: frames - startFrames,
      frameCounterScope: 'Whole source, geometry and renderer preparation operation',
      operationElapsedMs: performance.now() - operationStarted,
      geometryBytes: owner?.snapshot().geometryBytes ?? 0,
      reservedGeometryBytes: owner?.snapshot().reservedGeometryBytes ?? 0,
      resources: renderer.resources(),
      quality: $('quality').value,
      surfaceNames: surfaceNames(),
    };
    $('receipt').textContent = JSON.stringify(receipt, null, 2);
    busy = false;
    changeDuringPreparation = false;
    controller = null;
    buttons();
  }
}
function render() {
  if (closed) return;
  if (owner && position) {
    const terrain = owner.snapshot();
    if (
      terrain.provenance &&
      renderer.draw(
        {
          position,
          orientation: [0, 0, 0, 1000000],
          ticks: 0,
          lastInput: { throttle: 0, roll: 0, pitch: 0, yaw: 0 },
          originMm: origin,
          terrain,
        },
        { cameraMode: 'overview', cameraFov: 82, cameraTilt: 0 },
      )
    )
      frames++;
  }
  $('frames').textContent = `Visible frames: ${frames}`;
  frameId = requestAnimationFrame(render);
}
async function release() {
  if (closed) return;
  closed = true;
  controller?.abort();
  owner?.cancel();
  cancelAnimationFrame(frameId);
  await owner?.dispose();
  renderer.dispose();
  buttons();
  $('status').textContent = 'Resources released. Reload to start again.';
  $('receipt').textContent = JSON.stringify(
    {
      lastPreparation: receipt,
      geometryBytes: owner?.snapshot().geometryBytes ?? 0,
      reservedGeometryBytes: owner?.snapshot().reservedGeometryBytes ?? 0,
    },
    null,
    2,
  );
}
$('load').addEventListener('click', () => prepare(true));
$('stage').addEventListener('click', () => prepare(false));
$('stage-quality').addEventListener('click', () => {
  changeDuringPreparation = true;
  prepare(false);
});
$('quality').addEventListener('change', changeQuality);
$('cancel').addEventListener('click', () => {
  controller?.abort();
  owner?.cancel();
});
$('release').addEventListener('click', release);
addEventListener('pagehide', release, { once: true });
if (!renderer.available) {
  closed = true;
  $('status').textContent = 'WebGL unavailable';
}
buttons();
render();
