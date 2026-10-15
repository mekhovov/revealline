/** Exact prior source identity and bounded geometry change; never edits either directory. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const [before, after] = process.argv.slice(2).map((p) => resolve(p));
assert(before && after, 'Provide prior settlement and new harbour directories');
const read = (root, file) => readFile(resolve(root, file));
const json = async (root, file) => JSON.parse(await read(root, file));
const prior = await json(before, 'preparation.json');
const next = await json(after, 'preparation.json');
assert.equal(prior.revision, 'districts-r2');
assert.equal(next.revision, 'harbour-r3');
assert.deepEqual(
  next.placements,
  prior.placements,
  'Licensed placements and village must not change',
);
assert.deepEqual(next.inputs, prior.inputs, 'Derived licensed asset identities must not change');
assert.deepEqual(next.routes.slice(0, -1), prior.routes);
assert.equal(next.resources.textureBytes, prior.resources.textureBytes);
assert.equal(next.resources.textures, prior.resources.textures);
assert.equal(next.resources.terrainGeometryBytes, prior.resources.terrainGeometryBytes);
const geometryDelta = next.resources.geometryBytes - prior.resources.geometryBytes;
assert(geometryDelta > 0 && geometryDelta <= 60 * 1024);
assert(next.resources.retainedAndCandidateBytes <= 8 * 1024 * 1024);
let identicalFiles = 0;
for (const layer of ['terrain', 'scenery']) {
  for (let z = 0; z < 3; z++)
    for (let x = 0; x < 3; x++) {
      for (const ext of ['glb', 'json']) {
        const file = `${layer}/coast-${x}-${z}.${ext}`;
        if (layer === 'scenery' && x === 0 && z === 0) continue;
        assert.deepEqual(await read(before, file), await read(after, file), file);
        identicalFiles++;
      }
    }
}
const oldCell = await json(before, 'scenery/coast-0-0.json');
const newCell = await json(after, 'scenery/coast-0-0.json');
assert.deepEqual(newCell.textures, oldCell.textures);
assert.deepEqual(
  newCell.cell.surfaces.filter((s) => s.id !== 'harbour-connected-arrival'),
  oldCell.cell.surfaces,
);
assert.deepEqual(
  newCell.bindings.filter((b) => b.surfaceId !== 'harbour-connected-arrival'),
  oldCell.bindings,
);
assert.equal(
  newCell.bindings.find((b) => b.surfaceId === 'harbour-connected-arrival').collision,
  'solid',
);
console.log(
  JSON.stringify(
    {
      scope: 'Source preservation and geometry budget, not native appearance or player admission',
      previousRevision: prior.revision,
      revision: next.revision,
      identicalFiles,
      geometryDelta,
      textureDelta: 0,
      retainedAndCandidateBytes: next.resources.retainedAndCandidateBytes,
      terrainManifestSHA256: next.terrainManifestSHA256,
      sceneryManifestSHA256: next.sceneryManifestSHA256,
      previousPreparationSHA256: createHash('sha256')
        .update(await read(before, 'preparation.json'))
        .digest('hex'),
    },
    null,
    2,
  ),
);
