/** Continuous regional movement uses real verified sources, pinned collision and shared flight. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileTerrainCell, TERRAIN_FORMAT } from './terrain-cell.mjs';
import { compileSceneryCell, SCENERY_FORMAT } from './scenery-cell.mjs';
import { createVerifiedMixedWindow } from './verified-mixed-window.mjs';
import { createRegionalFlightPrototype } from './flight-prototype.mjs';
const point = (x) => ({ x: x * 128000 + 64000, y: 10000, z: 6000 });
function fixture(sceneryGround = false, cellSizeMm = 128000) {
  const layers = {};
  for (const kind of ['terrain', 'scenery']) {
    const assets = [],
      chunks = [],
      bodies = new Map();
    let requests = 0,
      intercept = null;
    for (let x = 0; x < 6; x++) {
      const base = { chunkId: `tile-${x}`, x, z: 0, cellSizeMm };
      const cell =
        kind === 'terrain'
          ? {
              format: TERRAIN_FORMAT,
              ...base,
              samples: 33,
              heightsMm: Array(1089).fill(0),
            }
          : {
              format: SCENERY_FORMAT,
              ...base,
              surfaces: [
                ...(sceneryGround
                  ? [
                      {
                        id: 'floor',
                        positionsMm: [0, 0, 0, 128000, 0, 0, 0, 0, 128000, 128000, 0, 128000],
                        indices: [0, 2, 1, 1, 2, 3],
                        color: [0.4, 0.4, 0.4],
                      },
                    ]
                  : []),
                {
                  id: 'roof',
                  positionsMm: [
                    30000, 8000, 30000, 90000, 8000, 30000, 30000, 8000, 90000, 90000, 8000, 90000,
                  ],
                  indices: [0, 2, 1, 1, 2, 3],
                  color: [0.5, 0.4, 0.3],
                },
                {
                  id: 'wall',
                  positionsMm: [
                    100000, 0, 10000, 100000, 20000, 10000, 100000, 0, 100000, 100000, 20000,
                    100000,
                  ],
                  indices: [0, 1, 2, 1, 3, 2],
                  color: [0.5, 0.4, 0.3],
                },
              ],
            };
      const ids = [];
      for (const [type, bytes] of [
        ['scene', (kind === 'terrain' ? compileTerrainCell : compileSceneryCell)(cell).glb],
        ['collision', new TextEncoder().encode(JSON.stringify(cell))],
      ]) {
        const id = `tile-${x}-${type}`,
          path = `${id}.${type === 'scene' ? 'glb' : 'json'}`;
        assets.push({
          id,
          kind: type,
          path,
          bytes: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        });
        bodies.set(path, bytes);
        ids.push(id);
      }
      chunks.push({ id: base.chunkId, x, z: 0, assets: ids });
    }
    layers[kind] = {
      requests: () => requests,
      setIntercept(value) {
        intercept = value;
      },
      manifest: {
        format: 'FPVRegionManifest.v1',
        id: 'mixed-check',
        revision: 'r1',
        title: { en: 'Mixed', uk: 'Змішаний' },
        grid: {
          cellSizeMm,
          minX: 0,
          minZ: 0,
          width: 6,
          depth: 1,
          floorMm: -1000,
          ceilingMm: 1000000,
        },
        assets,
        chunks,
        spawns: [{ id: 'start', position: point(0) }],
      },
      source: {
        baseURL: `https://${kind}.example/`,
        fetchImpl: async (url, options) => {
          requests++;
          const key = new URL(url).pathname.slice(1);
          const replacement = await intercept?.(key, options);
          const bytes = replacement ?? bodies.get(key);
          return new Response(bytes, { status: bytes ? 200 : 404 });
        },
      },
    };
  }
  return layers;
}

import { validateRegionManifest, SPARSE_SCENERY_FORMAT } from '../../../optional-practice/civilian-fpv/regional/region-manifest.mjs';
import { createVerifiedSceneryWindow } from '../../../optional-practice/civilian-fpv/regional/verified-scenery-window.mjs';
import { createVerifiedTerrainWindow } from '../../../optional-practice/civilian-fpv/regional/verified-terrain-window.mjs';
import { prepareSceneryWindow } from '../../../optional-practice/civilian-fpv/regional/scenery-admission.mjs';
import { prepareRegionalDownload, validateRegionalDescriptor } from '../../../optional-practice/civilian-fpv/regional-delivery.mjs';
import { prepareRegionalDelivery } from './prepare-delivery.mjs';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const bytes = value => new TextEncoder().encode(JSON.stringify(value));
function sparseFixture(populated = false, cellSizeMm = 128000) {
  const f = fixture(false, cellSizeMm);
  const manifest = f.scenery.manifest;
  manifest.format = SPARSE_SCENERY_FORMAT;
  for (const chunk of manifest.chunks) if (!populated || chunk.x !== 3) chunk.assets = [];
  const used = new Set(manifest.chunks.flatMap(c => c.assets));
  manifest.assets = manifest.assets.filter(a => used.has(a.id));
  return f;
}
const create = (f, extra = {}) => createVerifiedMixedWindow(f.terrain.manifest, {
  source: f.terrain.source, scenery: f.scenery, retainCommitted: true, ...extra,
});
let checks = 0;
async function check(name, action) { await action(); console.log(`PASS ${++checks}: ${name}`); }

await check('strict v1, exact coverage and explicit sparse profile', async () => {
  const f = sparseFixture(true);
  validateRegionManifest(f.scenery.manifest);
  for (const mutate of [
    m => { m.format = 'FPVRegionManifest.v1'; },
    m => { m.chunks.pop(); },
    m => { m.chunks[1] = structuredClone(m.chunks[0]); },
    m => { m.chunks[0].x = 99; },
    m => { m.chunks[0].assets = ['unknown']; },
    m => { m.chunks[3].assets.pop(); },
    m => { m.chunks[0].empty = true; },
  ]) { const m = structuredClone(f.scenery.manifest); mutate(m); assert.throws(() => validateRegionManifest(m)); }
  assert.throws(() => createVerifiedTerrainWindow(f.scenery.manifest, f.scenery.source), /complete terrain/);
  const noCells = sparseFixture();
  const m = structuredClone(noCells.scenery.manifest); m.format = 'FPVRegionManifest.v1';
  assert.throws(() => validateRegionManifest(m));
  await assert.rejects(prepareSceneryWindow(noCells.scenery.manifest, [], { requiredChunkIds: ['unknown'], maxGeometryBytes: 0 }));
  await assert.rejects(prepareSceneryWindow(f.scenery.manifest, [], { requiredChunkIds: ['tile-3'], originMm: { x: 384000, y: 0, z: 0 } }), /missing/);
});

await check('empty coverage owns zero payload/meshes/colliders and never clears unknown cells', async () => {
  const f = sparseFixture(), owner = createVerifiedSceneryWindow(f.scenery.manifest, { ...f.scenery.source, maxSourceBytes: 0 });
  try {
    await owner.transition(point(0));
    assert.equal(f.scenery.requests(), 0);
    assert.equal(owner.snapshot().geometryBytes, 0);
    assert.equal(owner.snapshot().sourceBytes, 0);
    assert.equal(owner.group.children.length, 0);
    assert.equal(owner.collisionSnapshot().colliders, 0);
    assert.equal(owner.support(point(0)).status, 'no-support');
    assert.equal(owner.sweep(point(0), point(1), 220).status, 'scenery-clear');
    assert.equal(owner.sweep(point(0), point(4), 220).status, 'unknown-cell');
    await owner.prepareRestoreProof();
    assert.equal(owner.restoreClearance(point(0), 220).status, 'outside-solids');
    assert.equal(owner.restoreClearance(point(4), 220).status, 'ambiguous');
    assert(owner.snapshot().provenance.chunks.every(c => c.empty === true));
  } finally { await owner.dispose(); }
  assert.deepEqual(owner.collisionSnapshot(), { worlds: 0, colliders: 0, rigidBodies: 0 });
});

await check('mixed empty/populated transitions retain terrain support and real scenery collisions', async () => {
  const f = sparseFixture(true), owner = create(f);
  try {
    await owner.transition(point(0));
    assert.equal(f.scenery.requests(), 0);
    assert.equal(owner.support(point(0), 20000).heightMm, 0);
    await owner.transition(point(3));
    assert(f.scenery.requests() >= 2);
    const roof = { x: 3 * 128000 + 64000, y: 10000, z: 64000 };
    assert.equal(owner.support(roof, 20000).heightMm, 8000);
    const before = owner.snapshot().geometryBytes;
    f.scenery.setIntercept(() => new Uint8Array([1,2,3]));
    await assert.rejects(owner.transition(point(3)));
    assert.equal(owner.snapshot().geometryBytes, before);
    assert.equal(owner.support(roof, 20000).heightMm, 8000);
    f.scenery.setIntercept(null);
    await owner.transition(point(5));
    assert.equal(owner.support(point(5), 20000).heightMm, 0);
    assert.equal(owner.support(point(0), 20000).status, 'unknown-cell');
  } finally { await owner.dispose(); }
  assert.equal(owner.collisionSnapshot().worlds, 0);
});

await check('cancelled empty-frame staging cannot replace the retained pair', async () => {
  const f = sparseFixture(), owner = create(f);
  try {
    await owner.transition(point(0));
    const before = owner.snapshot().provenance;
    let release, entered;
    const stage = new Promise(resolve => { entered = resolve; });
    const wait = new Promise(resolve => { release = resolve; });
    const transition = owner.transition(point(3), null, { prepare: async () => { entered(); await wait; }, commit() {}, rollback() {} });
    await stage; owner.cancel(); release();
    await assert.rejects(transition, { name: 'AbortError' });
    assert.deepEqual(owner.snapshot().provenance, before);
    assert.equal(owner.support(point(0), 20000).status, 'terrain-hit');
    await owner.transition(point(3));
    assert.equal(owner.support(point(3), 20000).status, 'terrain-hit');
  } finally { await owner.dispose(); }
});

await check('real shared flight crosses empty cells with identical conservative reference states', async () => {
  const f = sparseFixture();
  const config = { manifest: f.terrain.manifest, source: f.terrain.source, scenery: f.scenery, geometryProfile: 'terrain-scenery-v1' };
  const flight = createRegionalFlightPrototype({ ...config, continuous: true }), baseline = createRegionalFlightPrototype(config);
  const body = s => Object.fromEntries(['position','velocity','orientation','angular','ticks','grounded','support'].map(k => [k,s[k]]));
  let crossings = 0;
  try {
    await flight.prepare(); await baseline.prepare(); assert(flight.arm()); assert(baseline.arm());
    for (let i = 0; i < 2200; i++) {
      const input = { yaw: 0, pitch: 0, throttle: i < 100 ? .9 : .55, roll: i < 100 ? 0 : .65 };
      const actual = flight.step(input); let expected = baseline.step(input);
      if (expected.reason === 'terrain-required') { await baseline.prepare(); assert(baseline.arm()); expected = baseline.step(input); crossings++; }
      assert.equal(actual.status, 'active'); assert.deepEqual(body(actual), body(expected));
      await new Promise(resolve => setImmediate(resolve));
    }
    assert(crossings >= 3); assert.equal(f.scenery.requests(), 0);
    console.log(JSON.stringify({ ticks: flight.snapshot().ticks, crossings, sceneryRequests: f.scenery.requests() }));
  } finally { await flight.dispose(); await baseline.dispose(); }
});

await check('256 m empty coverage and fractional saved restore use declared cell dimensions', async () => {
  const f = sparseFixture(false, 256000), owner = create(f);
  const position = { x: 640000.25, y: 10000.125, z: 6000.75 };
  const flight = createRegionalFlightPrototype({ manifest: f.terrain.manifest, source: f.terrain.source,
    scenery: f.scenery, geometryProfile: 'terrain-scenery-v1', savedStart: { position, heading: 12345 } });
  try {
    await owner.transition(position);
    assert.equal(owner.support({ x: 3 * 256000 + 220000, y: 10000, z: 6000 }, 20000).heightMm, 0);
    assert.equal(owner.support({ x: 5 * 256000, y: 10000, z: 6000 }, 20000).status, 'unknown-cell');
    await flight.prepare();
    assert.deepEqual(flight.snapshot().position, position);
    assert.equal(flight.snapshot().status, 'paused');
    assert.equal(flight.snapshot().reason, 'prepared');
    assert.equal(flight.snapshot().ticks, 0);
    assert.equal(f.scenery.requests(), 0);
  } finally { await owner.dispose(); await flight.dispose(); }
});

async function deliveryFixture(f, format = 'FPVRegionalDelivery.v2') {
  const bodies = new Map(), refs = {};
  for (const layer of ['terrain','scenery']) {
    const m = f[layer].manifest, manifestPath = `${layer}/region.json`;
    const body = bytes(m); bodies.set(manifestPath, body);
    refs[layer] = { path: manifestPath, bytes: body.length, sha256: hash(body) };
    for (const asset of m.assets) bodies.set(`${layer}/${asset.path}`, new Uint8Array(await (await f[layer].source.fetchImpl(new URL(asset.path, f[layer].source.baseURL))).arrayBuffer()));
  }
  const files = [...bodies].map(([path,body]) => ({ path, bytes: body.length, sha256: hash(body) }));
  const descriptor = { format, id: 'sparse-delivery', revision: 'r1', title: { en:'Sparse',uk:'Розріджений' }, ...refs, files, totalBytes: files.reduce((n,f)=>n+f.bytes,0) };
  const data = bytes(descriptor); bodies.set('delivery.json', data);
  return { descriptor, bodies, pin: { url:'https://delivery.example/delivery.json', bytes:data.length, sha256:hash(data) }, options: { pageURL:'https://game.example/', fetchImpl: async url => { const body=bodies.get(new URL(url).pathname.slice(1)); return new Response(body,{status:body?200:404}); } } };
}
await check('delivery v2 binds sparse coverage; v1 downgrade and missing declared payload reject', async () => {
  const f = sparseFixture(true), d = await deliveryFixture(f);
  validateRegionalDescriptor(d.descriptor);
  const prepared = await prepareRegionalDownload(d.pin,d.options);
  assert.equal(prepared.assets.size, d.descriptor.files.length + 1);
  const downgrade = await deliveryFixture(f,'FPVRegionalDelivery.v1');
  await assert.rejects(prepareRegionalDownload(downgrade.pin,downgrade.options),/profile/);
  const missing = d.descriptor.files.find(r=>r.path.endsWith('.glb') && r.path.startsWith('scenery/'));
  d.bodies.delete(missing.path); await assert.rejects(prepareRegionalDownload(d.pin,d.options), /download/);
  const empty = await deliveryFixture(sparseFixture()); await prepareRegionalDownload(empty.pin,empty.options);
  const strict = await deliveryFixture(fixture(),'FPVRegionalDelivery.v1'); await prepareRegionalDownload(strict.pin,strict.options);
  const root = await mkdtemp(path.join(tmpdir(),'fpv-sparse-delivery-'));
  try {
    const source=path.join(root,'source'); await mkdir(source);
    for(const [name,body] of empty.bodies) { if(name==='delivery.json')continue;const target=path.join(source,name);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,body); }
    const result=await prepareRegionalDelivery({source,output:path.join(root,'delivery'),id:'sparse-delivery',revision:'r1'});
    assert.equal(result.descriptor.format,'FPVRegionalDelivery.v2');
    assert.equal(result.descriptor.files.length,empty.descriptor.files.length);
    assert.equal(result.descriptor.totalBytes,empty.descriptor.totalBytes);
  } finally { await rm(root,{recursive:true,force:true}); }
});
console.log(`PASS ${checks} sparse scenery scenarios`);
