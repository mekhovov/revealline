/** Observer-only production navigation: no player storage, new assets or browser simulation. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Q } from '../../../optional-practice/civilian-fpv/math.mjs';
import {
  loadRegionalReview,
  regionalLibraryEntry,
  regionalLocationIdentity,
  regionalNavigationTarget,
  regionalNavigationFeedback,
  createRegionalSession,
} from '../../../optional-practice/civilian-fpv/regional-session.mjs';
const root = path.resolve(
  process.argv[2] ?? '/Volumes/alex/CodexMigrationStaging/fpv-large-worlds-20261014/urban-mixed-r2',
);
const configuration = await loadRegionalReview({
  manifestURL: '/terrain/region.json',
  sceneryURL: '/scenery/region.json',
  pageURL: 'https://navigation.invalid/sim',
  fetchImpl: async (url, { signal } = {}) => {
    signal?.throwIfAborted();
    const file = path.resolve(root, '.' + new URL(url).pathname);
    assert(file.startsWith(root + path.sep));
    return new Response(await readFile(file));
  },
});
const entry = regionalLibraryEntry(configuration, { sha256: 'a'.repeat(64) });
const saved = {
  id: 'saved-court',
  identity: regionalLocationIdentity(entry),
  label: 'Court <b>name</b>',
  pose: { position: { x: 64000, y: 16000, z: 64000 }, heading: 0 },
  createdAt: 10,
};
const target = regionalNavigationTarget(entry, { location: saved });
assert(Object.isFrozen(target) && Object.isFrozen(target.position));
assert.equal(target.label, saved.label);
assert.throws(() => regionalNavigationTarget(entry, { spawnId: 'missing' }), /Unknown/);
assert.throws(
  () =>
    regionalNavigationTarget(entry, {
      location: saved,
      spawnId: configuration.manifest.spawns[0].id,
    }),
  /Choose one/,
);
assert.throws(
  () =>
    regionalNavigationTarget(regionalLibraryEntry(configuration, { sha256: 'b'.repeat(64) }), {
      location: saved,
    }),
  /revision/,
);
const state = {
  position: { x: 64000, y: 16000, z: 64000 },
  orientation: [0, 0, 0, Q],
  originMm: { x: 0, y: 0, z: 0 },
};
const original = JSON.stringify(state);
const cases = [];
for (const [sector, dx, dz] of [
  [0, 0, -1],
  [1, 1, -1],
  [2, 1, 0],
  [3, 1, 1],
  [4, 0, 1],
  [5, -1, 1],
  [6, -1, 0],
  [7, -1, -1],
]) {
  const t = {
    ...target,
    position: { x: state.position.x + dx * 10000, y: 16000, z: state.position.z + dz * 10000 },
  };
  const value = regionalNavigationFeedback(entry, t, state);
  assert.equal(value.sector, sector);
  for (const originMm of [
    { x: 128000, y: 0, z: 128000 },
    { x: -128000, y: 0, z: -128000 },
    { x: 256000, y: 0, z: 0 },
  ])
    assert.deepEqual(
      regionalNavigationFeedback(entry, t, {
        ...state,
        originMm,
        localPositionMm: { x: -1, y: -1, z: -1 },
      }),
      value,
    );
  cases.push({ sector, horizontalMm: value.horizontalMm, recentreInvariant: true });
}
const quat = (degrees) => [
  0,
  Math.round(-Math.sin((degrees * Math.PI) / 360) * Q),
  0,
  Math.round(Math.cos((degrees * Math.PI) / 360) * Q),
];
const north = { ...target, position: { ...target.position, z: 54000 } };
for (const heading of [359, -359, 1, -1])
  assert.equal(
    regionalNavigationFeedback(entry, north, { ...state, orientation: quat(heading) }).sector,
    0,
  );
assert.equal(
  regionalNavigationFeedback(entry, north, { ...state, orientation: quat(180) }).sector,
  4,
);
assert.equal(
  regionalNavigationFeedback(entry, north, { ...state, orientation: [0, 0, Q, 0] }).sector,
  0,
  'Inverted nose retains compass bearing',
);
const vertical = regionalNavigationFeedback(entry, north, {
  ...state,
  orientation: [707107, 0, 0, 707107],
});
assert.equal(vertical.headingValid, false);
assert.equal(vertical.sector, null);
for (const [height, y] of [
  ['above', 20000],
  ['below', 12000],
  ['level', 17000],
])
  assert.equal(
    regionalNavigationFeedback(entry, { ...target, position: { ...target.position, y } }, state)
      .height,
    height,
  );
const overhead = regionalNavigationFeedback(
  entry,
  { ...target, position: { ...target.position, y: 30000 } },
  state,
);
assert.equal(overhead.sector, null);
assert.equal(overhead.height, 'above');
assert.equal(overhead.horizontalMm, 0);
assert.equal(regionalNavigationFeedback(entry, null, state), null);
assert.equal(
  regionalNavigationFeedback({ ...entry, packIdentity: 'other-revision' }, target, state),
  null,
);
assert.equal(
  regionalNavigationFeedback(entry, target, { ...state, position: { x: NaN, y: 0, z: 0 } }),
  null,
);
assert.equal(
  regionalNavigationFeedback(entry, target, { ...state, orientation: [0, 0, 0, 0] }),
  null,
);
assert.equal(JSON.stringify(state), original);
const flights = [];
for (const mode of ['self-level', 'acro']) {
  const a = createRegionalSession({ ...configuration, mode }),
    b = createRegionalSession({ ...configuration, mode });
  try {
    await a.prepare();
    await b.prepare();
    const authored = regionalNavigationTarget(entry, {
      spawnId: configuration.manifest.spawns.at(-1).id,
    });
    const before = a.snapshot();
    regionalNavigationFeedback(entry, authored, before);
    assert.equal(a.snapshot().status, 'paused');
    assert.equal(a.snapshot().ticks, 0);
    assert.deepEqual(a.snapshot().lastInput, { roll: 0, pitch: 0, yaw: 0, throttle: 0 });
    assert.equal(a.arm(), true);
    assert.equal(b.arm(), true);
    for (let tick = 0; tick < 500; tick++) {
      const input = {
        roll: 0,
        pitch: tick > 100 && tick < 200 ? 0.02 : 0,
        yaw: tick > 300 ? 0.015 : 0,
        throttle: tick < 100 ? 0.56 : 0.49,
      };
      const actual = a.step(input);
      b.step(input);
      regionalNavigationFeedback(entry, authored, actual);
    }
    for (const key of [
      'position',
      'velocity',
      'orientation',
      'ticks',
      'status',
      'contacts',
      'lastInput',
    ])
      assert.deepEqual(a.snapshot()[key], b.snapshot()[key], key);
    a.pause();
    b.pause();
    flights.push({ mode, ticks: a.snapshot().ticks, observerMatchesBaseline: true, paused: true });
  } finally {
    await a.dispose();
    await b.dispose();
  }
  for (const session of [a, b])
    for (const field of [
      'resourceBytes',
      'sourceBytes',
      'reservedGeometryBytes',
      'reservedSourceBytes',
    ])
      assert.equal(session.snapshot().terrain[field], 0, field);
}
console.log(
  JSON.stringify(
    {
      scope:
        'Observer navigation only: eight bearings, vertical/inverted/unknown, exact revision, global recentre invariance and 500-command production parity in both modes',
      cases,
      flights,
      completionOrRouteClaim: false,
      storageMutated: false,
    },
    null,
    2,
  ),
);
