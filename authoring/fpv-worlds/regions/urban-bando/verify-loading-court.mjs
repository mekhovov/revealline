import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createVerifiedTerrainWindow } from '../verified-terrain-window.mjs';
import { createVerifiedMixedWindow } from '../verified-mixed-window.mjs';
import { courtContainers } from './loading-court.mjs';

const [parent, output] = process.argv.slice(2);
assert(parent && output, 'Provide mixed-r1 parent and loading-court output');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const bodies = new Map(),
  manifests = {};
const courtCells = [];
let unchangedSurfaces = 0,
  addedSurfaces = 0;
for (const profile of ['terrain', 'scenery']) {
  manifests[profile] = JSON.parse(await readFile(resolve(output, profile, 'region.json'), 'utf8'));
  for (const asset of manifests[profile].assets) {
    const bytes = await readFile(resolve(output, profile, asset.path));
    assert.equal(sha(bytes), asset.sha256);
    assert.equal(bytes.length, asset.bytes);
    bodies.set(`/${profile}/${asset.path}`, bytes);
    const previous = await readFile(resolve(parent, profile, asset.path));
    if (profile === 'terrain')
      assert.deepEqual(bytes, previous, 'All original terrain bytes must remain unchanged');
    else if (asset.kind === 'collision') {
      const before = JSON.parse(previous),
        after = JSON.parse(bytes);
      for (const surface of before.surfaces) {
        assert.deepEqual(
          after.surfaces.find((s) => s.id === surface.id),
          surface,
          surface.id,
        );
        unchangedSurfaces++;
      }
      courtCells.push(after);
      const added = after.surfaces.filter((s) => !before.surfaces.some((v) => v.id === s.id));
      assert(added.every((s) => courtContainers.some((v) => `court-${v.id}` === s.id)));
      addedSurfaces += added.length;
    }
  }
}
assert.equal(addedSurfaces, courtContainers.length);
const server = createServer((request, response) => {
  const bytes = bodies.get(request.url);
  response.writeHead(bytes ? 200 : 404);
  response.end(bytes);
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}/`;
const owner = createVerifiedMixedWindow(manifests.terrain, {
  source: { baseURL: base + 'terrain/' },
  scenery: {
    manifest: manifests.scenery,
    source: { baseURL: base + 'scenery/', surfaceStyle: 'urban' },
  },
});
const ground = createVerifiedTerrainWindow(manifests.terrain, { baseURL: base + 'terrain/' });
let geometryBytes = 0,
  groundedContainers = 0;
try {
  for (const item of courtContainers) {
    const authored = courtCells.flatMap((cell) =>
      cell.surfaces
        .filter((surface) => surface.id === `court-${item.id}`)
        .map((surface) => ({ cell, surface })),
    )[0];
    const minimumY = Math.min(...authored.surface.positionsMm.filter((v, i) => i % 3 === 1));
    assert.equal(minimumY, Math.round(item.centre[1] * 1000));
    const position = { x: item.centre[0] * 1000, y: 10000, z: item.centre[2] * 1000 };
    await owner.transition(position);
    await ground.transition(position);
    const groundHit = ground.support(position, 20000);
    assert.equal(groundHit.heightMm, 0, item.id + ' actual terrain support');
    if (item.centre[1] === 0) {
      assert.equal(minimumY, groundHit.heightMm);
      groundedContainers++;
    }
    geometryBytes = Math.max(geometryBytes, owner.snapshot().geometryBytes);
    const hit = owner.sweep(
      { ...position, x: position.x - 10000, y: item.centre[1] * 1000 + 1000 },
      { ...position, x: position.x + 10000, y: item.centre[1] * 1000 + 1000 },
      250,
    );
    assert.equal(hit.status, 'terrain-hit', item.id + ' solid side');
    assert.equal(hit.layer, 'scenery');
    const top = owner.support(position, 20000);
    let expected = -Infinity;
    for (const cell of courtCells)
      for (const surface of cell.surfaces.filter((s) => s.id.startsWith('court-'))) {
        const px = position.x - cell.x * 128000,
          pz = position.z - cell.z * 128000;
        for (let i = 0; i < surface.indices.length; i += 3) {
          const [a, b, c] = surface.indices
            .slice(i, i + 3)
            .map((index) => surface.positionsMm.slice(index * 3, index * 3 + 3));
          const den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
          if (Math.abs(den) < 1e-8) continue;
          const u = ((b[2] - c[2]) * (px - c[0]) + (c[0] - b[0]) * (pz - c[2])) / den;
          const v = ((c[2] - a[2]) * (px - c[0]) + (a[0] - c[0]) * (pz - c[2])) / den;
          if (u >= -1e-8 && v >= -1e-8 && u + v <= 1 + 1e-8)
            expected = Math.max(expected, u * a[1] + v * b[1] + (1 - u - v) * c[1]);
        }
      }
    assert(Number.isFinite(expected), 'Authored centre must have an actual roof triangle');
    assert.equal(top.status, 'terrain-hit');
    assert.equal(top.layer, 'scenery');
    assert(
      Math.abs(top.heightMm - expected) <= 2,
      item.id + ' roof support ' + JSON.stringify({ actual: top.heightMm, expected }),
    );
  }
  await owner.dispose();
  assert.equal(owner.snapshot().geometryBytes, 0);
  console.log(
    JSON.stringify(
      {
        passed: true,
        unchangedParentSurfaces: unchangedSurfaces,
        byteIdenticalTerrainAssets: 18,
        addedSurfaces,
        groundedContainers,
        stackedContainers: courtContainers.length - groundedContainers,
        solidAndRoofQueries: courtContainers.length * 2,
        geometryBytes,
        disposed: true,
        flightReady: false,
      },
      null,
      2,
    ),
  );
} finally {
  await owner.dispose();
  await ground.dispose();
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
}
