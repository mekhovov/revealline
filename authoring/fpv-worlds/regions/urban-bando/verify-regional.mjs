import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { createServer } from 'node:http';
import validator from 'gltf-validator';
import { createVerifiedSceneryWindow } from '../verified-scenery-window.mjs';
import { probes } from './layout.mjs';

const output = process.argv[2];
assert(output, 'Provide generated regional Urban directory');
const manifest = JSON.parse(await readFile(resolve(output, 'region.json'), 'utf8'));
const bodies = new Map();
for (const asset of manifest.assets) {
  const bytes = await readFile(resolve(output, asset.path));
  bodies.set('/' + asset.path, bytes);
  if (asset.kind === 'scene') {
    const result = await validator.validateBytes(bytes);
    assert.equal(result.issues.numErrors, 0, asset.id);
    assert.equal(result.issues.numWarnings, 0, asset.id);
  }
}
const server = createServer((req, res) => {
  const body = bodies.get(req.url);
  res.writeHead(body ? 200 : 404);
  res.end(body);
});
const sockets = new Set();
server.on('connection', (s) => {
  sockets.add(s);
  s.on('close', () => sockets.delete(s));
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const window = createVerifiedSceneryWindow(manifest, {
  baseURL: `http://127.0.0.1:${server.address().port}/`,
});
const mm = (v) =>
  Object.fromEntries(['x', 'y', 'z'].map((axis, i) => [axis, Math.round(v[i] * 1000)]));
let maximumGeometryBytes = 0,
  maximumMeshes = 0,
  disposedGeometries = 0,
  disposedMaterials = 0;
try {
  for (const probe of probes) {
    await window.transition(mm(probe.from));
    const result = window.sweep(mm(probe.from), mm(probe.to), 250);
    assert.equal(result.status, probe.clear ? 'scenery-clear' : 'scenery-hit', probe.id);
  }
  for (const p of [
    [127.9, 4, 50],
    [128.1, 4, 50],
    [255.9, 4, 180],
    [256.1, 4, 180],
    [64, 4, 260],
    [320, 4, 64],
  ]) {
    const previous = window.group;
    for (const mesh of previous.children) {
      mesh.geometry.addEventListener('dispose', () => disposedGeometries++);
    }
    for (const material of new Set(previous.children.map((mesh) => mesh.material))) {
      material.addEventListener('dispose', () => disposedMaterials++);
    }
    const ready = await window.transition(mm(p));
    assert.equal(previous.children.length, 0);
    assert.equal(ready.sceneryReady, true);
    assert.equal(ready.flightReady, false);
    maximumGeometryBytes = Math.max(maximumGeometryBytes, ready.geometryBytes);
    maximumMeshes = Math.max(maximumMeshes, window.group.children.length);
    for (const mesh of window.group.children) {
      assert.equal(mesh.material.metalness, 0);
      assert.equal(mesh.material.roughness, 1);
    }
  }
  assert(disposedGeometries > 0 && disposedMaterials > 0);
  const support = window.support(mm([190, 20, 50]), 40000);
  assert.equal(support.status, 'scenery-hit');
  assert(Math.abs(support.heightMm) < 1, 'Skylight support reaches ground through opening');
  const elevated = window.support(mm([157, 20, 50]), 40000);
  assert.equal(elevated.status, 'scenery-hit');
  assert(Math.abs(elevated.heightMm - 12400) < 1, 'Roof support retains elevated surface');
  const retained = window.group;
  await assert.rejects(
    window.transition(mm([145.4, 4, 64]), {
      positionMm: mm([145.4, 4, 64]),
      radiusMm: 220,
    }),
    /intersects/,
  );
  assert.equal(window.group, retained);
  assert.equal(window.snapshot().sceneryReady, false);
  await window.transition(mm([157, 12.4, 50]), {
    positionMm: mm([157, 12.4, 50]),
    radiusMm: 220,
  });
  assert.equal(window.snapshot().sceneryReady, true);
  await window.dispose();
  assert.equal(window.snapshot().geometryBytes, 0);
  assert.equal(window.snapshot().sourceBytes, 0);
  console.log(
    JSON.stringify(
      {
        passed: true,
        fixture: basename(output),
        canonicalScenes: 9,
        openingSolidSweeps: probes.length,
        originTransitions: 6,
        maximumGeometryBytes,
        maximumMeshes,
        disposedGeometries,
        disposedMaterials,
        flightReady: false,
      },
      null,
      2,
    ),
  );
} finally {
  await window.dispose();
  for (const socket of sockets) socket.destroy();
  await new Promise((done) => server.close(done));
}
