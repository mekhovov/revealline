import { createFlightRenderer } from '../../../optional-practice/civilian-fpv/world-assets.mjs';
import { mountWorldEditor } from '../../../optional-practice/civilian-fpv/world-editor.mjs';
import { FLIGHT_COURSES } from '../../../optional-practice/civilian-fpv/catalogue.mjs';
import {
  inspectImport,
  encodeWorldGLB,
} from '../../../optional-practice/civilian-fpv/world-content.mjs';
import {
  Matrix4,
  Quaternion,
  Vector3,
} from '../../../optional-practice/civilian-fpv/vendor/three.module.js';

const $ = (id) => document.getElementById(id);
const sourceBefore = JSON.stringify(FLIGHT_COURSES[0]);
// A disposable presentation derivative; no simulation or persistence host exists.
const course = structuredClone(FLIGHT_COURSES[0]);
course.id = 'marking-texture-inspection';
course.bounds = { min: { x: -7000, y: 0, z: -6000 }, max: { x: 7000, y: 7000, z: 6000 } };
course.spawn = { x: 0, y: 300, z: 4000 };
course.steps = { 'self-level': [], acro: [] };
course.obstacles = [];
const renderer = createFlightRenderer({ canvas: $('flight'), reducedMotion: true });
const presentation = () => ({ collectionId: $('collection').value, revision: 'r1' });
const editor = mountWorldEditor({
  canvas: $('editor'),
  course,
  getPresentation: presentation,
  onError: (error) => {
    $('status').textContent = error.message;
  },
});
let model,
  original,
  manifest,
  disposed = false;
const sha = async (bytes) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('');
const views = {
  gate: { eye: [-2.6, 1.4, 5], aim: [-2.6, 1.4, 0] },
  pad: { eye: [2, 3, 3], aim: [2, 0, 0] },
  swatch: { eye: [-0.5, 0.2, 4], aim: [-0.5, 0.2, 1.5] },
};
function draw() {
  if (disposed || !model) return;
  const { eye, aim } = views[$('view').value];
  const rotation = new Quaternion().setFromRotationMatrix(
    new Matrix4().lookAt(new Vector3(...eye), new Vector3(...aim), new Vector3(0, 1, 0)),
  );
  renderer.draw(
    {
      position: {
        x: eye[0] * 1000,
        y: eye[1] * 1000 - (course.rules?.droneRadius ?? 220),
        z: eye[2] * 1000,
      },
      orientation: rotation.toArray().map((v) => v * 1000000),
      ticks: 0,
      step: -1,
      actors: [],
      projectiles: [],
    },
    { cameraMode: 'fpv', cameraFov: 55, cameraTilt: 0 },
  );
  editor.refresh();
}
function facts(outcome) {
  $('facts').textContent = JSON.stringify(
    {
      outcome,
      packageRevision: manifest?.revision ?? null,
      markingSource: 'industrial-gate-pad@r1',
      rawGLBSha256: original?.sha256 ?? null,
      collection: presentation(),
      courseOriginalUnchanged: JSON.stringify(FLIGHT_COURSES[0]) === sourceBefore,
      renderer: renderer.resources(),
      editor: editor.resources?.() ?? 'Actual mountWorldEditor; no resource observer export',
    },
    null,
    2,
  );
}
async function reload(reset = false) {
  if (reset) {
    renderer.setPresentation(presentation());
    renderer.setCourse(course);
    editor.setCourse(course);
  }
  await Promise.all([renderer.loadScene(model), editor.loadScene(model)]);
  draw();
  $('status').textContent =
    'Loaded exact embedded PNG in the packaged World renderer and spatial editor.';
  facts('loaded');
}
async function action(fn) {
  for (const id of ['reload', 'corrupt', 'cancel', 'collection']) $(id).disabled = true;
  try {
    await fn();
  } catch (error) {
    $('status').textContent = error.message;
    facts('unexpected-error');
  } finally {
    if (!disposed)
      for (const id of ['reload', 'corrupt', 'cancel', 'collection']) $(id).disabled = false;
  }
}
async function initialize() {
  const packageURL = new URL('../../../optional-package.json', import.meta.url);
  manifest = await (await fetch(packageURL)).json();
  const rendererPin = manifest.files.find(
    (row) => row.path === 'optional-practice/civilian-fpv/renderer.mjs',
  );
  const rendererBytes = await (
    await fetch(new URL('../../../' + rendererPin.path, import.meta.url))
  ).arrayBuffer();
  if (
    rendererBytes.byteLength !== rendererPin.bytes ||
    (await sha(rendererBytes)) !== rendererPin.sha256
  )
    throw Error('Renderer does not match the emitted optional package.');
  const proof = await (await fetch('./r1/manifest.json')).json();
  original = proof.files.find((row) => row.path === 'markings.glb');
  const bytes = await (await fetch('./r1/markings.glb')).arrayBuffer();
  if (bytes.byteLength !== original.bytes || (await sha(bytes)) !== original.sha256)
    throw Error('Marking source differs from its retained proof.');
  const imported = await inspectImport({ files: { 'markings.glb': bytes }, entry: 'markings.glb' });
  if (imported.metadata.colliders.length || imported.metadata.anchors.length)
    throw Error('Unexpected gameplay authority in the marking source.');
  model = imported.modelBlob;
  await editor.ready;
  await reload(true);
  $('reload').onclick = () => action(() => reload());
  $('collection').onchange = () => action(() => reload(true));
  $('view').onchange = draw;
  $('corrupt').onclick = () =>
    action(async () => {
      const bytes = new Uint8Array(await model.arrayBuffer()),
        view = new DataView(bytes.buffer),
        length = view.getUint32(12, true),
        json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + length))),
        bin = bytes.slice(28 + length);
      bin[json.bufferViews[json.images[0].bufferView].byteOffset ?? 0] = 0;
      const before = JSON.stringify(renderer.resources().registered);
      let rejected = false;
      try {
        await renderer.loadScene(encodeWorldGLB(json, bin));
      } catch (error) {
        if (!/image could not be decoded/.test(error.message)) throw error;
        rejected = true;
      }
      if (!rejected || JSON.stringify(renderer.resources().registered) !== before)
        throw Error('Corrupt image changed the accepted scene or escaped rejection.');
      draw();
      $('status').textContent =
        'Corrupt embedded image rejected; accepted scene and resource counts retained.';
      facts('corrupt-image-rejected');
    });
  $('cancel').onclick = () =>
    action(async () => {
      const controller = new AbortController(),
        before = JSON.stringify(renderer.resources().registered);
      const pending = renderer.loadScene({ data: model, signal: controller.signal });
      controller.abort();
      try {
        await pending;
        throw Error('Cancelled load was accepted.');
      } catch (error) {
        if (error.name !== 'AbortError') throw error;
      }
      if (JSON.stringify(renderer.resources().registered) !== before)
        throw Error('Cancelled load changed accepted resources.');
      draw();
      $('status').textContent = 'Cancelled load retained the accepted scene.';
      facts('cancelled-load-rejected');
    });
}
action(initialize);
window.addEventListener('resize', draw);
window.addEventListener(
  'pagehide',
  () => {
    disposed = true;
    renderer.dispose();
    editor.dispose();
  },
  { once: true },
);
