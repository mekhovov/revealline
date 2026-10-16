/** Actual commanded flight against the exact bounded Urban scenery sources. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'node:http';
import { createRegionalFlightPrototype } from '../flight-prototype.mjs';
import { attitude, rotate, Q } from '../../../../optional-practice/civilian-fpv/math.mjs';

const output = process.argv[2];
assert(output, 'Provide generated regional Urban directory');
const manifest = JSON.parse(await readFile(resolve(output, 'region.json'), 'utf8'));
const bodies = new Map();
for (const asset of manifest.assets)
  bodies.set('/' + asset.path, await readFile(resolve(output, asset.path)));
let corrupt = false;
const server = createServer((req, res) => {
  const bytes = bodies.get(req.url);
  res.writeHead(bytes ? 200 : 404);
  res.end(corrupt && bytes ? Buffer.alloc(bytes.length) : bytes);
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const source = { baseURL: `http://127.0.0.1:${server.address().port}/` };
const zero = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
const body = (s) => ({
  position: s.position,
  velocity: s.velocity,
  orientation: s.orientation,
  angular: s.angular,
  ticks: s.ticks,
});
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const records = [];
let flight;
let crossings = 0;
async function start(position) {
  await flight?.dispose();
  const testManifest = structuredClone(manifest);
  // Controlled starts exercise authored openings; no asset, geometry or source hashes change.
  testManifest.spawns = [
    {
      id: 'controlled-start',
      position: { x: position[0] * 1000, y: position[1] * 1000, z: position[2] * 1000 },
    },
  ];
  flight = createRegionalFlightPrototype({
    manifest: testManifest,
    geometryProfile: 'scenery-v1',
    source,
  });
  await flight.prepare();
  assert.equal(flight.snapshot().geometryProfile, 'scenery-v1');
  assert.equal(flight.snapshot().terrain.terrainReady, true);
  assert.equal(flight.snapshot().playerReady, false);
  assert.equal(flight.arm({ ...zero, throttle: 0.8 }), false);
  assert(flight.arm());
}
async function advance(input) {
  const before = body(flight.snapshot());
  let state = flight.step(input);
  if (state.reason === 'terrain-required') {
    assert.deepEqual(body(state), before);
    await flight.prepare();
    assert.deepEqual(body(flight.snapshot()), before);
    assert.equal(flight.snapshot().status, 'paused');
    assert(flight.arm());
    crossings++;
    state = flight.step(input);
  }
  assert.equal(state.status, 'active');
  return state;
}
function altitude(state, height) {
  return clamp(
    0.49 + (height - state.position.y / 1000) * 0.12 - (state.velocity.y / 1000) * 0.18,
    0,
    1,
  );
}
try {
  for (const initialHeading of [-1, 36000, 0.5, NaN, 'south', null])
    assert.throws(
      () =>
        createRegionalFlightPrototype({
          manifest,
          source,
          geometryProfile: 'scenery-v1',
          initialHeading,
        }),
      /Invalid initial regional heading/,
    );
  for (const initialHeading of [0, 9000, 18000, 27000, 'region-centre']) {
    flight = createRegionalFlightPrototype({
      manifest,
      source,
      geometryProfile: 'scenery-v1',
      initialHeading,
    });
    const state = flight.snapshot(),
      angles = attitude(state.orientation);
    assert.equal(angles.pitch, 0);
    assert.equal(angles.roll, 0);
    assert.equal(state.status, 'paused');
    assert.equal(state.ticks, 0);
    assert.deepEqual(state.position, manifest.spawns[0].position);
    if (initialHeading === 'region-centre') {
      const forward = rotate(state.orientation, { x: 0, y: 0, z: -Q });
      assert(forward.x > 0 && forward.z > 0, 'Urban start must face into the region');
    } else assert.equal((angles.yaw + 36000) % 36000, initialHeading);
    await flight.dispose();
  }
  assert.throws(
    () => createRegionalFlightPrototype({ manifest, source, geometryProfile: 'mixed' }),
    /Unsupported regional geometry profile/,
  );
  assert.throws(
    () => createRegionalFlightPrototype({ manifest, source }),
    /Terrain source asset exceeds decode profile/,
    'Default terrain profile must not silently admit scenery',
  );
  for (const spawn of manifest.spawns) {
    flight = createRegionalFlightPrototype({
      manifest,
      source,
      spawnId: spawn.id,
      geometryProfile: 'scenery-v1',
    });
    await flight.prepare();
    assert.equal(flight.snapshot().status, 'paused');
    assert.deepEqual(flight.snapshot().position, spawn.position);
    assert.equal(flight.snapshot().ticks, 0);
    assert.equal(flight.snapshot().contacts, 0);
    await flight.dispose();
  }
  await start([190, 4, 108]);
  let state = flight.snapshot();
  for (let i = 0; i < 2200 && state.position.z > 20000; i++)
    state = await advance({ ...zero, pitch: 0.2, throttle: altitude(state, 4) });
  assert(state.position.z <= 20000, JSON.stringify(state.position));
  assert.equal(state.contacts, 0, 'Both visible loading doors must remain passable');
  records.push({
    scenario: 'warehouse-door-flight',
    ticks: state.ticks,
    position: state.position,
    contacts: state.contacts,
  });

  await start([130, 4, 64]);
  state = flight.snapshot();
  for (let i = 0; i < 700; i++)
    state = await advance({ ...zero, roll: 0.3, throttle: altitude(state, 4) });
  assert(state.contacts > 0, 'Solid warehouse side wall must stop actual commanded flight');
  assert(state.position.x < 145400, JSON.stringify(state.position));
  records.push({
    scenario: 'warehouse-wall-contact',
    ticks: state.ticks,
    position: state.position,
    contacts: state.contacts,
  });

  await start([157, 15, 50]);
  for (let i = 0; i < 300; i++) state = await advance(zero);
  assert(state.contacts > 0);
  assert(Math.abs(state.position.y - 12400) <= 10, JSON.stringify(state.position));
  records.push({
    scenario: 'elevated-roof-descent',
    ticks: state.ticks,
    position: state.position,
    contacts: state.contacts,
  });

  await start([64, 2, 260]);
  for (let i = 0; i < 200 && flight.snapshot().position.y < 25000; i++)
    state = await advance({ ...zero, throttle: 0.9 });
  assert(state.position.y >= 25000);
  assert.equal(state.contacts, 0, 'Open parking shaft must remain passable');
  records.push({
    scenario: 'parking-shaft-flight',
    ticks: state.ticks,
    position: state.position,
    contacts: state.contacts,
  });

  await start([120, 4, 180]);
  state = flight.snapshot();
  for (let i = 0; i < 2400 && state.position.x < 270000; i++)
    state = await advance({ ...zero, roll: 0.3, throttle: altitude(state, 4) });
  assert(state.position.x >= 270000);
  assert.equal(state.contacts, 0);
  assert(crossings >= 2, 'Actual flight must cross and prepare two local origins');
  records.push({
    scenario: 'cross-cell-road-flight',
    ticks: state.ticks,
    position: state.position,
    contacts: state.contacts,
    crossings,
  });

  const frozen = body(flight.snapshot());
  flight.pause();
  for (let i = 0; i < 20; i++)
    assert.deepEqual(body(flight.step({ ...zero, throttle: 1 })), frozen);
  await flight.dispose();
  assert.equal(flight.root.children.length, 0);
  assert.equal(flight.snapshot().terrain.geometryBytes, 0);
  corrupt = true;
  flight = createRegionalFlightPrototype({ manifest, geometryProfile: 'scenery-v1', source });
  const initial = body(flight.snapshot());
  await assert.rejects(flight.prepare(), /hash|digest/i);
  assert.equal(flight.arm(), false);
  assert.deepEqual(body(flight.step({ ...zero, throttle: 1 })), initial);
  console.log(
    JSON.stringify(
      {
        passed: true,
        geometryProfile: 'scenery-v1',
        controlledFlight: records,
        playerReady: false,
      },
      null,
      2,
    ),
  );
} finally {
  await flight?.dispose();
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
}
