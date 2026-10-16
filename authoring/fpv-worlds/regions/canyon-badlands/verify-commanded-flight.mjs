/** Exact accepted Canyon pair, flown through the production regional session. */
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
import { routes as clearanceRoutes } from './landmarks.mjs';
import { routes as districtRoutes } from './districts.mjs';

const root = resolve(process.argv[2] ?? '');
assert(process.argv[2], 'Provide the accepted rounded Canyon paired directory');
const districtProfile = process.argv[3] === 'districts';
assert(process.argv[3] === undefined || districtProfile, 'Unknown commanded-flight profile');
const sourcePins = districtProfile
  ? {
      terrain: '219b438a19fdd7decd022cd48d145b1a45505198e86e9270cf818696894210a4',
      scenery: '3b704a760c06c7ed066e11050cadcb1af27d5ad18ed87e63e2a66137507fcff6',
    }
  : {
      terrain: '9fad494a6dc1e974695e9fa218b99e74f1676d2589303c7ececea8728b106239',
      scenery: 'a72ba600c11eba60486b645ca40967802498deb28e46dece02b10b3f04e0c30f',
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
  pageURL: 'https://canyon.invalid/sim',
  fetchImpl,
});
assert.equal(configuration.manifest.grid.width, districtProfile ? 6 : 3);
assert.equal(configuration.manifest.grid.depth, districtProfile ? 6 : 3);
assert.equal(configuration.manifest.grid.cellSizeMm, 128000);
assert.equal(configuration.manifest.chunks.length, districtProfile ? 36 : 9);
assert.deepEqual(configuration.manifest.grid, configuration.scenery.manifest.grid);
const routes = [
  ...(districtProfile ? districtRoutes : clearanceRoutes),
  {
    id: 'ridge-crown-opening',
    halfWidth: 1,
    points: [
      [345, 85, 40],
      [345, 85, 90],
    ],
  },
  {
    id: 'ridge-skyline-approach',
    halfWidth: 3,
    points: [
      [300, 110, 65],
      [370, 110, 65],
    ],
  },
  {
    id: 'needle-east-passage',
    halfWidth: 3,
    points: [
      [210, 34, 270],
      [210, 34, 330],
    ],
  },
  {
    id: 'arrival-landmark-approach',
    halfWidth: 2,
    points: [
      [85, 16, 85],
      [85, 16, 125],
    ],
  },
];
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
function measure(state, from, to) {
  const dx = to[0] - from[0],
    dz = to[2] - from[2],
    length = Math.hypot(dx, dz);
  const ux = dx / length,
    uz = dz / length;
  const x = state.position.x / 1000 - from[0],
    z = state.position.z / 1000 - from[2];
  const along = x * ux + z * uz,
    cross = -x * uz + z * ux;
  const height = from[1] + (to[1] - from[1]) * clamp(along / length, 0, 1);
  return { length, ux, uz, along, cross, height };
}
function command(state, from, to, mode) {
  const m = measure(state, from, to);
  const forward = clamp((m.length - m.along) * 1.1, -2, 5);
  const lateral = clamp(-m.cross * 1.2, -2, 2);
  const climb = m.along < m.length ? ((to[1] - from[1]) / m.length) * forward : 0;
  const desired = {
    roll: clamp((m.ux * forward - m.uz * lateral - state.velocity.x / 1000) * 350, -1200, 1200),
    pitch: clamp(-(m.uz * forward + m.ux * lateral - state.velocity.z / 1000) * 350, -1200, 1200),
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
  return {
    ...zero,
    ...axes,
    throttle: clamp(
      0.49 + (m.height - state.position.y / 1000) * 0.12 - (state.velocity.y / 1000 - climb) * 0.18,
      0,
      1,
    ),
  };
}
const frame = () => new Promise((resolve) => setImmediate(resolve));
function sessionAt(point, mode) {
  const spawn = {
    id: 'controlled-route-start',
    position: { x: point[0] * 1000, y: point[1] * 1000, z: point[2] * 1000 },
  };
  return createRegionalSession({
    ...configuration,
    mode,
    initialHeading: 0,
    manifest: { ...configuration.manifest, spawns: [spawn] },
    scenery: {
      ...configuration.scenery,
      manifest: { ...configuration.scenery.manifest, spawns: [spawn] },
    },
  });
}
const records = [],
  contacts = [];
let authoredStarts = 0;
for (const mode of ['self-level', 'acro']) {
  for (const spawn of configuration.manifest.spawns) {
    const session = createRegionalSession({ ...configuration, mode, spawnId: spawn.id });
    try {
      assert.equal(session.arm(), false);
      await session.prepare();
      const state = session.snapshot();
      assert.equal(state.status, 'paused');
      assert.equal(state.ticks, 0);
      assert.equal(state.contacts, 0);
      assert.deepEqual(state.position, spawn.position);
      authoredStarts++;
    } finally {
      await session.dispose();
    }
  }
  for (const route of routes) {
    const session = sessionAt(route.points[0], mode);
    try {
      assert.equal(session.arm(), false);
      await session.prepare();
      assert.equal(session.snapshot().status, 'paused');
      const initialRecentres = session.snapshot().recentres;
      assert(session.arm());
      let state = session.snapshot(),
        maxCrossTrackM = 0,
        maxHeightErrorM = 0;
      const segments = [];
      for (let i = 1; i < route.points.length; i++) {
        const from = route.points[i - 1],
          to = route.points[i],
          startTick = state.ticks;
        let settled = false;
        for (let tick = 0; tick < 5000; tick++) {
          state = session.step(command(state, from, to, mode));
          assert.equal(state.status, 'active', `${mode}/${route.id}/${i}: ${state.reason}`);
          assert.equal(
            state.contacts,
            0,
            `${route.id}: collision at ${JSON.stringify(state.position)}`,
          );
          const m = measure(state, from, to);
          maxCrossTrackM = Math.max(maxCrossTrackM, Math.abs(m.cross));
          maxHeightErrorM = Math.max(maxHeightErrorM, Math.abs(m.height - state.position.y / 1000));
          assert(maxCrossTrackM < route.halfWidth - 0.25, `${route.id}: left clear corridor`);
          assert(maxHeightErrorM < 0.75, `${route.id}: vertical corridor margin exceeded`);
          await frame();
          if (
            Math.hypot(state.position.x / 1000 - to[0], state.position.z / 1000 - to[2]) < 0.4 &&
            Math.hypot(state.velocity.x, state.velocity.z) < 400 &&
            Math.abs(state.position.y / 1000 - to[1]) < 0.4
          ) {
            settled = true;
            break;
          }
        }
        assert(settled, `${mode}/${route.id}/${i}: endpoint not settled`);
        segments.push({ ticks: state.ticks - startTick, position: state.position });
      }
      session.pause();
      const held = session.snapshot();
      assert.deepEqual(session.step({ ...zero, roll: 1, throttle: 1 }), held);
      records.push({
        mode,
        route: route.id,
        segments,
        ticks: state.ticks,
        contacts: state.contacts,
        recentres: state.recentres,
        inFlightRecentres: state.recentres - initialRecentres,
        maxCrossTrackM,
        maxHeightErrorM,
      });
      await session.dispose();
      assert.equal(session.root.children.length, 0);
      assert.equal(session.snapshot().terrain.geometryBytes, 0);
      assert.equal(session.snapshot().terrain.textureBytes, 0);
    } finally {
      await session.dispose();
    }
  }
  for (const target of [
    { id: 'twin-west-rock', from: [137, 18, 104], to: [147, 18, 104], axis: 'x', maximum: 146750 },
    {
      id: 'ridge-arch-solid-crown',
      from: [345, 89, 40],
      to: [345, 89, 90],
      axis: 'z',
      maximum: 89000,
    },
  ]) {
    const session = sessionAt(target.from, mode);
    try {
      await session.prepare();
      assert(session.arm());
      let state = session.snapshot();
      for (let i = 0; i < 1600 && state.contacts === 0; i++) {
        state = session.step(command(state, target.from, target.to, mode));
        assert.equal(state.status, 'active');
        await frame();
      }
      assert(state.contacts > 0, `${target.id}: visible solid must stop actual flight`);
      assert(state.position[target.axis] < target.maximum, `${target.id}: crossed through solid`);
      contacts.push({
        mode,
        target: target.id,
        ticks: state.ticks,
        contacts: state.contacts,
        position: state.position,
      });
    } finally {
      await session.dispose();
    }
  }
}
console.log(
  JSON.stringify(
    {
      passed: true,
      actualExtentM: districtProfile ? [768, 768] : [384, 384],
      sourcePins,
      authoredStarts,
      actualCommandedRoutes: records.length,
      records,
      solidContacts: contacts,
      playerReady: false,
      claim: districtProfile
        ? 'Production controlled-command evidence for the 768 m authored district pair; not native FPS, final art or public admission.'
        : 'Production controlled-command evidence for the accepted 384 m paired subset; not the separate 768 m terrain, native FPS or public admission.',
    },
    null,
    2,
  ),
);
