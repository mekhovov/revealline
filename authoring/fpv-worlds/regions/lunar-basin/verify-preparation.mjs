/** Exact source/collision and bounded route audit, independent of native art acceptance. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import validator from 'gltf-validator';
import { compileTerrainCell, validateTerrainSeams } from '../terrain-cell.mjs';
import { compileSceneryCell } from '../../../../optional-practice/civilian-fpv/regional/scenery-cell.mjs';
import { validateRegionManifest } from '../region-manifest.mjs';
import { createVerifiedMixedWindow } from '../verified-mixed-window.mjs';
import { sampledHeight } from './relief.mjs';
assert(process.argv[2]);
const root = resolve(process.argv[2]);
const prep = JSON.parse(await readFile(resolve(root, 'preparation.json')));
const hash = (x) => createHash('sha256').update(x).digest('hex');
const manifests = {},
  sources = {},
  bodies = new Map(),
  terrains = [];
let glbs = 0,
  warnings = 0;
for (const [layer, compile] of [
  ['terrain', compileTerrainCell],
  ['scenery', compileSceneryCell],
]) {
  const bytes = await readFile(resolve(root, layer, 'region.json'));
  assert.equal(hash(bytes), prep[layer + 'ManifestSHA256']);
  const manifest = validateRegionManifest(bytes.toString());
  manifests[layer] = manifest;
  for (const asset of manifest.assets) {
    const b = await readFile(resolve(root, layer, asset.path));
    assert.equal(b.length, asset.bytes);
    assert.equal(hash(b), asset.sha256);
    bodies.set('/' + layer + '/' + asset.path, b);
  }
  for (const chunk of manifest.chunks.filter((c) => c.assets.length)) {
    const cell = JSON.parse(bodies.get('/' + layer + '/' + chunk.id + '.json'));
    if (layer === 'terrain') terrains.push(cell);
    const glb = compile(cell).glb;
    assert.deepEqual(Buffer.from(glb), bodies.get('/' + layer + '/' + chunk.id + '.glb'));
    const result = await validator.validateBytes(new Uint8Array(glb));
    assert.equal(result.issues.numErrors, 0, JSON.stringify(result.issues));
    warnings += result.issues.numWarnings;
    glbs++;
  }
  sources[layer] = {
    baseURL: 'https://lunar.invalid/' + layer + '/',
    fetchImpl: async (url) => {
      const b = bodies.get(new URL(url).pathname);
      assert(b);
      return new Response(b);
    },
  };
}
assert.equal(glbs, 36 + prep.sceneryCells);
assert.equal(warnings, 0);
for (const cell of terrains)
  validateTerrainSeams(
    terrains.filter((c) => Math.abs(c.x - cell.x) <= 1 && Math.abs(c.z - cell.z) <= 1),
  );
const owner = createVerifiedMixedWindow(manifests.terrain, {
  source: sources.terrain,
  scenery: { manifest: manifests.scenery, source: sources.scenery },
});
const mm = (p) => ({
  x: Math.round(p[0] * 1000),
  y: Math.round(p[1] * 1000),
  z: Math.round(p[2] * 1000),
});
let key,
  transitions = 0,
  sweeps = 0,
  peakResources = 0,
  terrainAgreement = 0;
const failures = [];
async function prepare(p) {
  const next = Math.floor(p.x / 128000) + ',' + Math.floor(p.z / 128000);
  if (key === next) return;
  await owner.transition(p);
  key = next;
  transitions++;
  const s = owner.snapshot();
  peakResources = Math.max(peakResources, s.geometryBytes + s.textureBytes);
  assert(peakResources * 2 < 8 * 1024 * 1024);
  assert(s.provenance.chunks.length <= 9);
}
try {
  for (const route of prep.routes) {
    let failed = false;
    for (let i = 1; i < route.points.length && !failed; i++) {
      const a = route.points[i - 1],
        b = route.points[i],
        length = Math.hypot(b[0] - a[0], b[2] - a[2]);
      for (const side of [-1, 0, 1]) {
        const p = (t) =>
          mm([
            a[0] + (b[0] - a[0]) * t - ((b[2] - a[2]) / length) * route.halfWidth * side,
            a[1] + (b[1] - a[1]) * t,
            a[2] + (b[2] - a[2]) * t + ((b[0] - a[0]) / length) * route.halfWidth * side,
          ]);
        const from = p(0),
          to = p(1);
        await prepare(from);
        const hit = owner.sweep(from, to, 250);
        sweeps++;
        if (hit.status !== 'terrain-clear') {
          failures.push({ route: route.id, from, to, hit });
          failed = true;
          break;
        }
      }
    }
  }
  for (const spawn of manifests.terrain.spawns) {
    await prepare(spawn.position);
    assert.equal(
      owner.sweep(spawn.position, { ...spawn.position, y: spawn.position.y + 500 }, 250).status,
      'terrain-clear',
      spawn.id,
    );
    const support = owner.support(spawn.position, 10000);
    assert.equal(support.status, 'terrain-hit');
    assert(Math.abs(support.heightMm - (spawn.position.y - 3000)) < 1, spawn.id + ' support');
  }
  for (const point of [
    [75.5, 95.2],
    [255.8, 256.1],
    [445.2, 335.7],
    [674.3, 375.9],
  ]) {
    const y = sampledHeight(...point),
      p = mm([point[0], y + 2, point[1]]);
    await prepare(p);
    const s = owner.support(p, 5000);
    assert.equal(s.status, 'terrain-hit');
    assert(Math.abs(s.heightMm - y * 1000) < 1, 'Triangle interpolation differs');
    terrainAgreement++;
  }
} finally {
  await owner.dispose();
}
assert.equal(owner.snapshot().geometryBytes, 0);
assert.equal(owner.snapshot().textureBytes, 0);
console.log(
  JSON.stringify(
    {
      passed: failures.length === 0,
      glbs,
      warnings,
      sweeps,
      transitions,
      peakResources,
      retainedAndStagedBytes: peakResources * 2,
      terrainAgreement,
      failures,
      playerReady: false,
    },
    null,
    2,
  ),
);
assert.equal(failures.length, 0, 'Authored routes require clearance correction');
