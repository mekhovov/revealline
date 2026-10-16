/** Canonical meshes, precise collision routes, seam and lifecycle evidence. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import validator from 'gltf-validator';
import { boxes, arches } from './design.mjs';
import { compileTerrainCell, validateTerrainSeams } from '../terrain-cell.mjs';
import { compileRgbaSceneryCell } from '../rgba-scenery-cell.mjs';
import { validateRegionManifest } from '../region-manifest.mjs';
import { createVerifiedMixedWindow } from '../verified-mixed-window.mjs';
const root = resolve(process.argv[2] ?? '');
assert(process.argv[2], 'Provide exact prepared Canal directory');
for (const box of boxes.filter(
  (value) => value.id.startsWith('dock-pile-') || value.id.startsWith('basin-mooring-'),
)) {
  assert.equal(box.center[1] - box.size[1] / 2, -3, box.id + ': base must meet canal bed');
}
const authoredBox = (id) => {
  const box = boxes.find((b) => b.id === id);
  assert(box, id);
  return box;
};
const bottom = (box) => box.center[1] - box.size[1] / 2;
const top = (box) => box.center[1] + box.size[1] / 2;
for (const x of [48, 80]) {
  const wall = authoredBox(`lock-guide-${x}`),
    support = authoredBox(`lock-deck-support-${x}`);
  assert.equal(bottom(wall), -3, 'Lock wall must meet the canal bed');
  assert(Math.abs(bottom(support) - top(wall)) < 1e-9, 'Lock support must meet wall');
  assert(
    Math.abs(top(support) - bottom(authoredBox('lock-footbridge'))) < 1e-9,
    'Lock support must meet deck',
  );
}
for (const x of [104, 152]) {
  const bank = authoredBox(`arch-bank-${x}`);
  assert(Math.abs(bottom(bank) - 4) < 1e-9, 'Arch bank must meet quay');
  assert(Math.abs(top(bank) - bottom(authoredBox('arch-deck'))) < 1e-9, 'Arch bank must meet deck');
}
assert(
  Math.abs(
    arches[0].center[1] + arches[0].rise + arches[0].thickness - bottom(authoredBox('arch-deck')),
  ) < 1e-9,
);
const prep = JSON.parse(await readFile(resolve(root, 'preparation.json'))),
  hash = (x) => createHash('sha256').update(x).digest('hex');
const bodies = new Map(),
  manifests = {},
  sources = {},
  terrain = [];
let glbs = 0,
  warnings = 0;
for (const [layer, compiler] of [
  ['terrain', compileTerrainCell],
  ['scenery', compileRgbaSceneryCell],
]) {
  const bytes = await readFile(resolve(root, layer, 'region.json'));
  assert.equal(hash(bytes), prep[layer + 'ManifestSHA256']);
  const manifest = validateRegionManifest(bytes.toString());
  manifests[layer] = manifest;
  for (const item of manifest.assets) {
    const body = await readFile(resolve(root, layer, item.path));
    assert.equal(body.length, item.bytes);
    assert.equal(hash(body), item.sha256);
    bodies.set('/' + layer + '/' + item.path, body);
  }
  for (const chunk of manifest.chunks) {
    const source = JSON.parse(bodies.get('/' + layer + '/' + chunk.id + '.json'));
    if (layer === 'terrain') terrain.push(source);
    const glb = compiler(source).glb;
    assert.deepEqual(Buffer.from(glb), bodies.get('/' + layer + '/' + chunk.id + '.glb'));
    const result = await validator.validateBytes(new Uint8Array(glb));
    assert.equal(result.issues.numErrors, 0, JSON.stringify(result.issues));
    warnings += result.issues.numWarnings;
    glbs++;
  }
  sources[layer] = {
    baseURL: 'https://canal.invalid/' + layer + '/',
    fetchImpl: async (url) => {
      const body = bodies.get(new URL(url).pathname);
      assert(body);
      return new Response(body);
    },
  };
}
validateTerrainSeams(terrain);
assert.equal(warnings, 0);
assert.equal(glbs, 18);
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
  peakResources = 0,
  sweeps = 0;
async function prepare(p) {
  const next = Math.floor(p.x / 128000) + ',' + Math.floor(p.z / 128000);
  if (key === next) return;
  await owner.transition(p);
  key = next;
  transitions++;
  const s = owner.snapshot();
  peakResources = Math.max(peakResources, s.geometryBytes + s.textureBytes);
  assert(s.provenance.chunks.length <= 9);
  assert(peakResources * 2 < 8 * 1024 * 1024);
}
try {
  for (const route of prep.routes)
    for (let i = 1; i < route.points.length; i++) {
      const a = route.points[i - 1],
        b = route.points[i],
        length = Math.hypot(b[0] - a[0], b[2] - a[2]);
      for (const side of [-1, 0, 1])
        for (let d = 0; d < length; d += 1) {
          const point = (t) =>
            mm([
              a[0] +
                ((b[0] - a[0]) * t) / length -
                ((b[2] - a[2]) / length) * route.halfWidth * side,
              a[1] + ((b[1] - a[1]) * t) / length,
              a[2] +
                ((b[2] - a[2]) * t) / length +
                ((b[0] - a[0]) / length) * route.halfWidth * side,
            ]);
          const from = point(d),
            to = point(Math.min(length, d + 1));
          await prepare(from);
          const hit = owner.sweep(from, to, 250);
          assert.equal(
            hit.status,
            'terrain-clear',
            route.id + ' ' + JSON.stringify({ from, to, hit }),
          );
          sweeps++;
        }
    }
  for (const spawn of manifests.terrain.spawns) {
    await prepare(spawn.position);
    assert.equal(
      owner.sweep(spawn.position, { ...spawn.position, y: spawn.position.y + 500 }, 250).status,
      'terrain-clear',
    );
  }
  // Serialized source must contain the supports missing from the rejected draft.
  for (const [from, to] of [
    [
      [48, 6.5, 220],
      [48, 6.5, 232],
    ],
    [
      [80, 6.5, 220],
      [80, 6.5, 232],
    ],
    [
      [110, 11.5, 55],
      [110, 11.5, 64],
    ],
    [
      [146, 11.5, 55],
      [146, 11.5, 64],
    ],
  ]) {
    await prepare(mm(from));
    assert.equal(
      owner.sweep(mm(from), mm(to), 250).status,
      'terrain-hit',
      'Missing supported bridge mass',
    );
  }
  const apron = mm([202, 5, 80]);
  await prepare(apron);
  assert(
    Math.abs(owner.support(apron, 2000).heightMm - 4050) < 1,
    'Paved warehouse apron must match its visible solid within 1 mm query precision',
  );
  const waterFrom = mm([128, 1, 24]),
    waterTo = mm([128, -1, 24]);
  await prepare(waterFrom);
  assert.equal(
    owner.sweep(waterFrom, waterTo, 250).status,
    'terrain-clear',
    'Visual water must not create collision',
  );
  const bed = owner.support(waterFrom, 6000);
  assert.equal(bed.status, 'terrain-hit');
  assert.equal(bed.heightMm, -3000);
  assert.equal(bed.layer, 'terrain');
} finally {
  await owner.dispose();
}
assert.equal(owner.snapshot().geometryBytes, 0);
assert.equal(owner.snapshot().textureBytes, 0);
console.log(
  JSON.stringify(
    {
      passed: true,
      glbs,
      warnings,
      routeSweeps: sweeps,
      transitions,
      peakResources,
      actualSizeM: [384, 384],
      visualWaterOnly: true,
      playerReady: false,
    },
    null,
    2,
  ),
);
