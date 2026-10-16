/** Real fixed-step commands through the production regional session; no body teleporting. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, sep } from 'node:path';
import {
  loadRegionalReview,
  createRegionalSession,
} from '../../../../optional-practice/civilian-fpv/regional-session.mjs';
import {
  responseCurve,
  DEFAULT_RESPONSE,
} from '../../../../optional-practice/civilian-fpv/radio-profile.mjs';

const root = resolve(process.argv[2] ?? '');
assert(process.argv[2], 'Provide the exact Canal City paired directory');
const prep = JSON.parse(
  await readFile(process.argv[3] ? resolve(process.argv[3]) : resolve(root, 'preparation.json')),
);
const sourcePins = {
  terrain: prep.terrainManifestSHA256,
  scenery: prep.sceneryManifestSHA256,
};
for (const [layer, expected] of Object.entries(sourcePins)) {
  const bytes = await readFile(resolve(root, layer, 'region.json'));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expected);
}
const fetchImpl = async (url, { signal } = {}) => {
  signal?.throwIfAborted();
  const file = resolve(root, '.' + new URL(url).pathname);
  assert(file.startsWith(root + sep));
  return new Response(await readFile(file));
};
const configuration = await loadRegionalReview({
  manifestURL: '/terrain/region.json',
  sceneryURL: '/scenery/region.json',
  pageURL: 'https://canal.invalid/sim',
  fetchImpl,
});
const zero = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function inverseResponse(value) {
  const wanted = Math.round(clamp(value, -1, 1) * 1000);
  let low = -1000,
    high = 1000;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (responseCurve(middle, DEFAULT_RESPONSE.expo) < wanted) low = middle;
    else high = middle;
  }
  return high / 1000;
}
function command(state, from, to, mode) {
  const dx = to[0] - from[0],
    dz = to[2] - from[2],
    length = Math.hypot(dx, dz);
  const ux = length ? dx / length : 0,
    uz = length ? dz / length : 0;
  const x = state.position.x / 1000,
    z = state.position.z / 1000,
    y = state.position.y / 1000;
  const along = (x - from[0]) * ux + (z - from[2]) * uz;
  const cross = -(x - from[0]) * uz + (z - from[2]) * ux;
  const forward = clamp((length - along) * 1.1, -2, 3),
    lateral = clamp(-cross * 1.2, -2, 2);
  const wantedX = length ? ux * forward - uz * lateral : clamp((to[0] - x) * 1.2, -2, 2);
  const wantedZ = length ? uz * forward + ux * lateral : clamp((to[2] - z) * 1.2, -2, 2);
  const desired = {
    roll: clamp((wantedX - state.velocity.x / 1000) * 350, -1200, 1200),
    pitch: clamp(-(wantedZ - state.velocity.z / 1000) * 350, -1200, 1200),
  };
  const axes = Object.fromEntries(
    ['roll', 'pitch'].map((axis) => [
      axis,
      inverseResponse(
        mode === 'self-level'
          ? desired[axis] / (DEFAULT_RESPONSE.maxTilt * 100)
          : ((desired[axis] - state.attitude[axis]) * 4) / (DEFAULT_RESPONSE.maxRate * 100),
      ),
    ]),
  );
  const height = length ? from[1] + (to[1] - from[1]) * clamp(along / length, 0, 1) : to[1];
  const wantedVy = length ? ((to[1] - from[1]) / length) * forward : 0;
  return {
    ...zero,
    ...axes,
    throttle: clamp(0.49 + (height - y) * 0.12 + (wantedVy - state.velocity.y / 1000) * 0.18, 0, 1),
  };
}
const frame = () => new Promise((resolve) => setImmediate(resolve));
const records = [],
  authoredStarts = [],
  contacts = [];
const routes = prep.routes;
// Only scenario initialization overrides the starting position. Geometry and asset pins
// remain exact; every subsequent body movement comes from production session.step.
function controlled(mode, position) {
  const spawn = {
    id: 'controlled-route-start',
    position: {
      x: position[0] * 1000,
      y: position[1] * 1000,
      z: position[2] * 1000,
    },
  };
  return createRegionalSession({
    ...configuration,
    manifest: { ...configuration.manifest, spawns: [spawn] },
    scenery: {
      ...configuration.scenery,
      manifest: { ...configuration.scenery.manifest, spawns: [spawn] },
    },
    initialHeading: 0,
    mode,
  });
}
async function release(session) {
  await session.dispose();
  assert.equal(session.root.children.length, 0);
  assert.equal(session.snapshot().terrain.geometryBytes, 0);
  assert.equal(session.snapshot().terrain.textureBytes, 0);
}
for (const mode of ['self-level', 'acro']) {
  for (const spawn of configuration.manifest.spawns) {
    const session = createRegionalSession({
      ...configuration,
      mode,
      spawnId: spawn.id,
    });
    try {
      assert.equal(session.arm(), false);
      await session.prepare();
      const state = session.snapshot();
      assert.equal(state.status, 'paused');
      assert.equal(state.ticks, 0);
      assert.equal(state.contacts, 0);
      assert.deepEqual(state.position, spawn.position);
      authoredStarts.push({ mode, id: spawn.id, position: state.position });
    } finally {
      await release(session);
    }
  }
  for (const route of routes) {
    const commandHash = createHash('sha256');
    const session = controlled(mode, route.points[0]);
    try {
      assert.equal(session.arm(), false);
      await session.prepare();
      assert.equal(session.snapshot().status, 'paused');
      assert(session.arm());
      let state = session.snapshot();
      const segments = [];
      for (let segment = 1; segment < route.points.length; segment++) {
        const from = route.points[segment - 1],
          to = route.points[segment];
        const dx = to[0] - from[0],
          dz = to[2] - from[2],
          length = Math.hypot(dx, dz);
        let maxCrossTrackM = 0,
          maxHeightErrorM = 0,
          reached = false;
        const initialTicks = state.ticks;
        for (let tick = 0; tick < 6000; tick++) {
          const input = command(state, from, to, mode);
          commandHash.update(JSON.stringify(input) + '\n');
          state = session.step(input);
          assert.equal(state.status, 'active', `${mode}/${route.id}/${segment}: ${state.reason}`);
          assert.equal(
            state.contacts,
            0,
            `${mode}/${route.id}/${segment}: collision ${JSON.stringify(state.position)}`,
          );
          const x = state.position.x / 1000 - from[0],
            z = state.position.z / 1000 - from[2];
          const cross = length ? Math.abs(-x * dz + z * dx) / length : Math.hypot(x, z);
          maxCrossTrackM = Math.max(maxCrossTrackM, cross);
          assert(maxCrossTrackM < route.halfWidth - 0.25, `${route.id}: left clear corridor`);
          if (length) {
            const along = (x * dx + z * dz) / (length * length),
              wanted = from[1] + (to[1] - from[1]) * clamp(along, 0, 1);
            maxHeightErrorM = Math.max(maxHeightErrorM, Math.abs(state.position.y / 1000 - wanted));
            assert(maxHeightErrorM < 0.75, `${route.id}: altitude error ${maxHeightErrorM}`);
          }
          await frame();
          const distance = Math.hypot(
            state.position.x / 1000 - to[0],
            state.position.y / 1000 - to[1],
            state.position.z / 1000 - to[2],
          );
          if (
            distance < 0.7 &&
            Math.hypot(state.velocity.x, state.velocity.y, state.velocity.z) < 800
          ) {
            reached = true;
            break;
          }
        }
        assert(reached, `${mode}/${route.id}/${segment}: endpoint not settled`);
        segments.push({
          from,
          to,
          ticks: state.ticks - initialTicks,
          position: state.position,
          maxCrossTrackM,
          maxHeightErrorM,
        });
      }
      if (route.id === 'shoreline-crossings') assert(state.recentres >= 2);
      session.pause();
      const held = session.snapshot();
      assert.deepEqual(session.step({ ...zero, throttle: 1, roll: 1 }), held);
      records.push({
        mode,
        route: route.id,
        ticks: state.ticks,
        contacts: state.contacts,
        recentres: state.recentres,
        commandSha256: commandHash.digest('hex'),
        segments,
      });
      console.error('PASS', mode, route.id, state.ticks);
    } finally {
      await release(session);
    }
  }

  for (const probe of [
    { id: 'quay-bank', from: [128, 2, 100], to: [106, 2, 100], minX: 112 },
    { id: 'bridge-deck', from: [128, 17, 64], falling: true, minY: 13 },
    { id: 'canal-bed', from: [128, 1, 24], falling: true, minY: -3.1 },
  ]) {
    const session = controlled(mode, probe.from);
    try {
      await session.prepare();
      assert(session.arm());
      let state = session.snapshot();
      for (let i = 0; i < (probe.falling ? 300 : 1000); i++) {
        state = session.step(probe.falling ? zero : command(state, probe.from, probe.to, mode));
        assert.equal(state.status, 'active');
        await frame();
        if (!probe.falling && state.contacts > 0) break;
      }
      assert(state.contacts > 0, probe.id + ': no actual body contact');
      if (probe.minX)
        assert(state.position.x > probe.minX * 1000, probe.id + ': passed through bank');
      if (probe.maxX)
        assert(state.position.x < probe.maxX * 1000, probe.id + ': passed through solid');
      if (probe.minY)
        assert(state.position.y > probe.minY * 1000, probe.id + ': fell through roof');
      contacts.push({
        mode,
        scenario: probe.id,
        ticks: state.ticks,
        position: state.position,
        contacts: state.contacts,
      });
      console.error('PASS', mode, probe.id, state.ticks);
    } finally {
      await release(session);
    }
  }
}
console.log(
  JSON.stringify(
    {
      passed: true,
      sourcePins,
      records,
      authoredStarts,
      contacts,
      playerReady: false,
      claim:
        'Production regional-session controlled command evidence; no native player/device FPS or default admission claim.',
    },
    null,
    2,
  ),
);
