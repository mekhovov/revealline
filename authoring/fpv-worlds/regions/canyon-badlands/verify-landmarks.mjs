/** Real paired admission, exact source/terrain parity, reachable gaps and licensed-rock collision. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import validator from 'gltf-validator';
import { compileSceneryCell } from '../scenery-cell.mjs';
import { compileTerrainCell, validateTerrainSeams } from '../terrain-cell.mjs';
import { createVerifiedMixedWindow } from '../verified-mixed-window.mjs';
import { createRegionalFlightPrototype } from '../flight-prototype.mjs';
import { surfaceMm as originalSurfaceMm } from './design.mjs';
import { reliefSurfaceMm } from './relief-design.mjs';
import { routes } from './landmarks.mjs';

const [parent, output, variant] = process.argv.slice(2);
assert(parent && output, 'Provide original Canyon terrain and generated landmark directories');
assert(variant === undefined || variant === 'relief', 'Unknown verification profile');
const relief = variant === 'relief';
const surfaceMm = relief ? reliefSurfaceMm : originalSurfaceMm;
const sha = (b) => createHash('sha256').update(b).digest('hex');
const receipt = JSON.parse(await readFile(resolve(output, 'preparation.json')));
const manifests = {},
  sources = {},
  cells = {},
  before = [];
let canonicalGLBs = 0;
for (const profile of ['terrain', 'scenery']) {
  const manifestBytes = await readFile(resolve(output, profile, 'region.json'));
  if (relief)
    assert.equal(
      sha(await readFile(resolve(parent, profile, 'region.json'))),
      receipt[`parent${profile === 'terrain' ? 'Terrain' : 'Scenery'}ManifestSHA256`],
    );
  assert.equal(sha(manifestBytes), receipt[`${profile}ManifestSHA256`]);
  manifests[profile] = JSON.parse(manifestBytes);
  const bodies = new Map();
  cells[profile] = new Map();
  for (const asset of manifests[profile].assets) {
    const path = resolve(output, profile, asset.path),
      bytes = await readFile(path);
    before.push([path, bytes]);
    assert.equal(sha(bytes), asset.sha256);
    assert.equal(bytes.length, asset.bytes);
    bodies.set('/' + asset.path, bytes);
    if (profile === 'terrain' && !relief)
      assert.deepEqual(
        bytes,
        await readFile(resolve(parent, asset.path)),
        'Terrain remains byte-identical',
      );
    if (asset.kind === 'collision' && relief) {
      const previous = JSON.parse(await readFile(resolve(parent, profile, asset.path)));
      const current = JSON.parse(bytes);
      for (const field of ['format', 'chunkId', 'x', 'z', 'cellSizeMm'])
        assert.deepEqual(current[field], previous[field]);
      if (profile === 'terrain') {
        assert.equal(current.samples, previous.samples);
        current.heightsMm.forEach((height, i) =>
          assert.equal(
            height,
            reliefSurfaceMm(
              current.x * 128 + (i % 33) * 4,
              current.z * 128 + Math.floor(i / 33) * 4,
            ),
          ),
        );
      } else {
        assert.equal(current.surfaces.length, previous.surfaces.length);
        for (const surface of current.surfaces) {
          const old = previous.surfaces.find((s) => s.id === surface.id);
          assert(old);
          assert.deepEqual(surface.indices, old.indices);
          assert.deepEqual(surface.color, old.color);
          const object = receipt.objects.find((o) => surface.id.startsWith(o.id + '-band-'));
          assert(object);
          assert.equal(surface.positionsMm.length, old.positionsMm.length);
          surface.positionsMm.forEach((v, i) =>
            assert.equal(
              v,
              old.positionsMm[i] +
                (i % 3 === 1
                  ? object.baseMm - object.priorBaseMm
                  : (object.center[i % 3 === 0 ? 0 : 1] - object.priorCenter[i % 3 === 0 ? 0 : 1]) *
                    1000),
            ),
          );
        }
      }
    }
    if (asset.kind === 'collision')
      cells[profile].set(asset.id.replace(/-collision$/, ''), JSON.parse(bytes));
  }
  for (const chunk of manifests[profile].chunks) {
    const cell = cells[profile].get(chunk.id);
    const scene = manifests[profile].assets.find((a) => a.id === `${chunk.id}-scene`);
    const canonical = profile === 'terrain' ? compileTerrainCell(cell) : compileSceneryCell(cell);
    assert.deepEqual(Buffer.from(canonical.glb), bodies.get('/' + scene.path));
    const validation = await validator.validateBytes(new Uint8Array(canonical.glb));
    assert.equal(validation.issues.numErrors, 0);
    assert.equal(validation.issues.numWarnings, 0);
    canonicalGLBs++;
  }
  sources[profile] = {
    baseURL: `https://${profile}.invalid/`,
    fetchImpl: async (url) =>
      new Response(bodies.get(new URL(url).pathname), {
        status: bodies.has(new URL(url).pathname) ? 200 : 404,
      }),
  };
}
validateTerrainSeams([...cells.terrain.values()]);
for (const field of ['id', 'revision', 'grid', 'spawns', 'chunks'])
  assert.deepEqual(manifests.terrain[field], manifests.scenery[field]);
const owner = createVerifiedMixedWindow(manifests.terrain, {
  source: sources.terrain,
  scenery: { manifest: manifests.scenery, source: sources.scenery },
});
const mm = (p) => ({
  x: Math.round(p[0] * 1000),
  y: Math.round(p[1] * 1000),
  z: Math.round(p[2] * 1000),
});
let routeSweeps = 0,
  rockHits = 0,
  grounded = 0;
try {
  await owner.transition({ x: 192000, y: 34000, z: 192000 });
  const geometryBytes = owner.snapshot().geometryBytes;
  for (const route of routes) {
    for (let i = 1; i < route.points.length; i++) {
      const a = route.points[i - 1],
        b = route.points[i];
      const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
      const normal = [-(b[2] - a[2]) / length, (b[0] - a[0]) / length];
      for (const side of [-1, 0, 1]) {
        for (let distance = 0; distance < length; distance += 1) {
          const point = (d) => [
            a[0] + ((b[0] - a[0]) * d) / length + normal[0] * route.halfWidth * side,
            a[1] + ((b[1] - a[1]) * d) / length,
            a[2] + ((b[2] - a[2]) * d) / length + normal[1] * route.halfWidth * side,
          ];
          const from = mm(point(distance)),
            to = mm(point(Math.min(length, distance + 1)));
          const result = owner.sweep(from, to, 250);
          assert.equal(
            result.status,
            'terrain-clear',
            `${route.id}: ${JSON.stringify({ from, to, result })}`,
          );
          routeSweeps++;
        }
      }
    }
  }
  // Each formation must expose a real above-ground triangle and collide at that exact location.
  for (const object of receipt.objects) {
    const cell = cells.scenery.get(
      `canyon-${Math.floor(object.center[0] / 128)}-${Math.floor(object.center[1] / 128)}`,
    );
    const triangles = [];
    for (const surface of cell.surfaces.filter((s) => s.id.startsWith(object.id + '-band-'))) {
      for (let i = 0; i < surface.indices.length; i += 3) {
        const p = [0, 0, 0];
        for (const index of surface.indices.slice(i, i + 3))
          for (let axis = 0; axis < 3; axis++) p[axis] += surface.positionsMm[index * 3 + axis] / 3;
        p[0] += cell.x * 128000;
        p[2] += cell.z * 128000;
        if (p[1] > surfaceMm(p[0] / 1000, p[2] / 1000) + 400) triangles.push(p);
      }
    }
    assert(triangles.length, `${object.id}: visible grounded surface required`);
    triangles.sort((a, b) => b[1] - a[1]);
    const p = triangles[0];
    const support = owner.support(
      { x: Math.round(p[0]), y: object.topMm + 2000, z: Math.round(p[2]) },
      object.requestedHeightM * 1000 + 4000,
    );
    assert.equal(support.status, 'terrain-hit', object.id);
    assert.equal(support.layer, 'scenery', object.id);
    assert(support.heightMm >= p[1] - 20, `${object.id}: real top support`);
    rockHits++;
    // Entire base plane is under the exact triangle surface throughout the footprint.
    for (let x = object.boundsMm[0][0]; x <= object.boundsMm[0][1]; x += 1000)
      for (let z = object.boundsMm[1][0]; z <= object.boundsMm[1][1]; z += 1000)
        assert(object.baseMm < surfaceMm(x / 1000, z / 1000), `${object.id}: floating base`);
    grounded++;
  }
  const spawn = manifests.terrain.spawns[0].position;
  assert.equal(owner.sweep(spawn, { ...spawn, y: spawn.y + 4000 }, 250).status, 'terrain-clear');
  const support = owner.support(spawn, 10000);
  assert.equal(support.layer, 'terrain');
  assert.equal(support.heightMm, 6000);
  await owner.dispose();
  assert.equal(owner.snapshot().geometryBytes, 0);
  const flight = createRegionalFlightPrototype({
    manifest: manifests.terrain,
    source: sources.terrain,
    geometryProfile: 'terrain-scenery-v1',
    scenery: { manifest: manifests.scenery, source: sources.scenery },
  });
  try {
    await flight.prepare();
    assert.equal(flight.snapshot().ticks, 0);
    assert.equal(flight.snapshot().status, 'paused');
    assert.equal(flight.snapshot().playerReady, false);
    assert(flight.arm());
    for (let tick = 0; tick < 100; tick++)
      assert.equal(flight.step({ throttle: 0.49, roll: 0, pitch: 0, yaw: 0 }).status, 'active');
    assert.equal(flight.snapshot().ticks, 100);
    flight.pause();
    assert.equal(flight.snapshot().status, 'paused');
  } finally {
    await flight.dispose();
  }
  for (const [path, bytes] of before) assert.deepEqual(await readFile(path), bytes);
  console.log(
    JSON.stringify(
      {
        passed: true,
        canonicalGLBs,
        byteIdenticalTerrainAssets: relief ? 0 : 18,
        requalifiedRelief: relief,
        routeSweeps,
        rockHits,
        grounded,
        spawnClear: true,
        sharedFlightTicks: 100,
        geometryBytes,
        disposed: true,
        sourceUnchanged: true,
        flightReady: false,
      },
      null,
      2,
    ),
  );
} finally {
  await owner.dispose();
}
