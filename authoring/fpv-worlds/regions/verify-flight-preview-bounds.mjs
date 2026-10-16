/** Executes the preview's actual bounds callback with all three admitted cell sizes. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import * as THREE from '../../../optional-practice/civilian-fpv/vendor/three.module.js';

const source = await readFile(
  process.argv[2] ?? new URL('./flight-preview.mjs', import.meta.url),
  'utf8',
);
const callback = source.slice(
  source.indexOf('function updateViewBounds(state)'),
  source.indexOf('let manifestController'),
);
const rendererSource = await readFile(
  new URL('../../../optional-practice/civilian-fpv/renderer.mjs', import.meta.url),
  'utf8',
);
const frameSource = rendererSource
  .slice(
    rendererSource.indexOf('export function createFlightViewFrame'),
    rendererSource.indexOf('/** Presentation only. All world/actor'),
  )
  .replace('export function', 'function');
const createFlightViewFrame = runInNewContext(frameSource + '\ncreateFlightViewFrame', { THREE });
const records = [];
for (const cellSizeMm of [128000, 256000, 512000]) {
  const chunks = new Map();
  for (let z = 5; z <= 7; z++) for (let x = 5; x <= 7; x++) chunks.set(`${x}-${z}`, { x, z });
  const camera = new THREE.PerspectiveCamera(82, 1280 / 800, 0.035, 900);
  const frame = createFlightViewFrame({ camera, aircraft: new THREE.Group() });
  const context = {
    chunks,
    cellSizeMm,
    camera,
    flightViewFrame: frame,
    localBounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
  };
  const state = {
    terrain: { provenance: { chunks: [...chunks.keys()].map((chunkId) => ({ chunkId })) } },
    position: { x: 6 * cellSizeMm, y: 16000, z: 6 * cellSizeMm },
    orientation: [0, 0, 0, 1000000],
    ticks: 0,
  };
  runInNewContext(`${callback}\nupdateViewBounds(state)`, { ...context, state });
  assert.equal(frame.bounds.min.x, cellSizeMm * 5);
  assert.equal(frame.bounds.max.z, cellSizeMm * 8);
  assert.equal(camera.far, 900 * (cellSizeMm / 128000));
  frame.view = 'overview';
  frame.originMm = { x: cellSizeMm * 6, y: 0, z: cellSizeMm * 6 };
  frame.draw(state);
  camera.updateMatrixWorld();
  const centre = new THREE.Vector3(cellSizeMm / 2000, 0, cellSizeMm / 2000);
  const projected = centre.clone().project(camera);
  assert(
    Math.abs(projected.x) < 1e-8 && Math.abs(projected.y) < 1e-8,
    'Loaded area must centre the actual resident ground',
  );
  assert(
    projected.z > -1 && projected.z < 1,
    'Resident ground centre must survive camera clipping',
  );
  for (const x of [5, 8])
    for (const z of [5, 8]) {
      const corner = new THREE.Vector3(
        ((x - 6) * cellSizeMm) / 1000,
        0,
        ((z - 6) * cellSizeMm) / 1000,
      ).project(camera);
      assert(corner.z > -1 && corner.z < 1, 'Resident ground corners must survive far clipping');
    }
  records.push({ cellSizeMm, far: camera.far, centred: true, groundCornersWithinDepth: true });
}
console.log(JSON.stringify({ passed: true, records }, null, 2));
