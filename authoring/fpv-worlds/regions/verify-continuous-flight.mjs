/** Continuous regional movement uses real verified sources, pinned collision and shared flight. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compileTerrainCell, TERRAIN_FORMAT } from './terrain-cell.mjs';
import { compileSceneryCell, SCENERY_FORMAT } from './scenery-cell.mjs';
import { createVerifiedMixedWindow } from './verified-mixed-window.mjs';
import { createRegionalFlightPrototype } from './flight-prototype.mjs';
const point = (x) => ({ x: x * 128000 + 64000, y: 10000, z: 6000 });
function fixture(sceneryGround = false) {
  const layers = {};
  for (const kind of ['terrain', 'scenery']) {
    const assets = [],
      chunks = [],
      bodies = new Map();
    let requests = 0,
      intercept = null;
    for (let x = 0; x < 6; x++) {
      const base = { chunkId: `tile-${x}`, x, z: 0, cellSizeMm: 128000 };
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
          cellSizeMm: 128000,
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
const create = (f, options = {}) =>
  createVerifiedMixedWindow(f.terrain.manifest, {
    source: f.terrain.source,
    scenery: { manifest: f.scenery.manifest, source: f.scenery.source },
    ...options,
  });
const neutral = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
const body = (s) =>
  Object.fromEntries(
    ['position', 'velocity', 'orientation', 'angular', 'ticks', 'grounded', 'support'].map((k) => [
      k,
      s[k],
    ]),
  );
const turn = () => new Promise((resolve) => setImmediate(resolve));
const configuration = (f, continuous = true) => ({
  manifest: f.terrain.manifest,
  source: f.terrain.source,
  geometryProfile: 'terrain-scenery-v1',
  scenery: { manifest: f.scenery.manifest, source: f.scenery.source },
  continuous,
});
let checks = 0;
async function check(name, run) {
  await run();
  checks++;
  console.log(`PASS ${name}`);
}

await check(
  'continuous verified crossings preserve every accepted shared-flight body without re-arming',
  async () => {
    const f = fixture(),
      flight = createRegionalFlightPrototype(configuration(f)),
      baseline = createRegionalFlightPrototype(configuration(f, false));
    try {
      await flight.prepare();
      await baseline.prepare();
      assert(flight.arm());
      assert(baseline.arm());
      let crossings = 0;
      for (let i = 0; i < 2200; i++) {
        const command = { ...neutral, throttle: i < 100 ? 0.9 : 0.55, roll: i < 100 ? 0 : 0.65 };
        const actual = flight.step(command);
        let expected = baseline.step(command);
        if (expected.reason === 'terrain-required') {
          await baseline.prepare();
          assert(baseline.arm());
          expected = baseline.step(command);
          crossings++;
        }
        assert.equal(actual.status, 'active');
        assert.deepEqual(body(actual), body(expected));
        await turn();
        const after = flight.snapshot();
        assert.deepEqual(body(after), body(actual), 'async adoption never changes physical state');
        for (const key of ['x', 'y', 'z'])
          assert.equal(after.localPositionMm[key] + after.originMm[key], after.position[key]);
        assert(after.terrain.reservedGeometryBytes <= 10 * 1024 * 1024);
        assert(after.terrain.reservedSourceBytes <= 32 * 1024 * 1024);
      }
      assert(crossings >= 3);
      assert(flight.snapshot().recentres >= 4);
      console.log(
        JSON.stringify({
          ticks: flight.snapshot().ticks,
          crossings,
          recentres: flight.snapshot().recentres,
        }),
      );
    } finally {
      await flight.dispose();
      await baseline.dispose();
    }
  },
);

await check(
  'delayed source keeps current verified motion live then stops before unknown collision; retry stays disarmed',
  async () => {
    const f = fixture(),
      flight = createRegionalFlightPrototype(configuration(f));
    let release;
    const blocked = new Promise((resolve) => {
      release = resolve;
    });
    try {
      await flight.prepare();
      assert(flight.arm());
      f.scenery.setIntercept(async () => {
        await blocked;
      });
      let activeWhileLoading = 0,
        previous;
      for (let i = 0; i < 2000; i++) {
        previous = flight.snapshot();
        const state = flight.step({
          ...neutral,
          throttle: i < 100 ? 0.9 : 0.55,
          roll: i < 100 ? 0 : 0.65,
        });
        if (state.status !== 'active') {
          assert.equal(state.reason, 'terrain-required');
          assert.deepEqual(body(state), body(previous));
          break;
        }
        if (state.streaming.pending) activeWhileLoading++;
        await turn();
      }
      assert(activeWhileLoading > 100);
      assert.equal(flight.snapshot().status, 'paused');
      assert.equal(flight.arm(), false);
      const frozen = body(flight.snapshot());
      release();
      await turn();
      await turn();
      assert.deepEqual(body(flight.snapshot()), frozen);
      f.scenery.setIntercept(null);
      await flight.prepare();
      assert.equal(flight.snapshot().status, 'paused');
      assert.deepEqual(body(flight.snapshot()), frozen);
      assert(flight.arm());
    } finally {
      release();
      await flight.dispose();
    }
  },
);

await check('both standalone profiles prefetch and reframe while active', async () => {
  for (const profile of ['terrain-v1', 'scenery-v1']) {
    const f = fixture(true),
      layer = f[profile === 'terrain-v1' ? 'terrain' : 'scenery'],
      flight = createRegionalFlightPrototype({
        manifest: layer.manifest,
        source: layer.source,
        geometryProfile: profile,
        continuous: true,
      });
    try {
      await flight.prepare();
      assert(flight.arm());
      for (let i = 0; i < 1600; i++) {
        const state = flight.step({
          ...neutral,
          throttle: i < 100 ? 0.9 : 0.55,
          roll: i < 100 ? 0 : 0.65,
        });
        assert.equal(state.status, 'active');
        await turn();
      }
      assert(flight.snapshot().recentres >= 3);
    } finally {
      await flight.dispose();
    }
  }
});

await check(
  'corrupt prefetch cannot replace current geometry, and pause cancels delayed adoption without arming',
  async () => {
    const f = fixture(),
      flight = createRegionalFlightPrototype(configuration(f));
    let release;
    try {
      await flight.prepare();
      assert(flight.arm());
      f.scenery.setIntercept(() => new Uint8Array([1, 2, 3]));
      for (let i = 0; i < 1000 && !flight.snapshot().streaming.failure; i++) {
        assert.equal(
          flight.step({ ...neutral, throttle: i < 100 ? 0.9 : 0.55, roll: i < 100 ? 0 : 0.65 })
            .status,
          'active',
        );
        await turn();
      }
      assert(flight.snapshot().streaming.failure);
      assert.equal(flight.snapshot().terrain.provenance.originMm.x, 64000);
      assert.equal(flight.snapshot().status, 'active');
      const blocked = new Promise((resolve) => {
        release = resolve;
      });
      f.scenery.setIntercept(async () => {
        await blocked;
      });
      for (let i = 0; i < 150 && !flight.snapshot().streaming.pending; i++) {
        flight.step({ ...neutral, throttle: 0.55, roll: 0.65 });
        await turn();
      }
      assert(flight.snapshot().streaming.pending);
      flight.pause();
      const frozen = body(flight.snapshot()),
        origin = flight.snapshot().originMm;
      release();
      await turn();
      await turn();
      assert.equal(flight.snapshot().status, 'paused');
      assert.deepEqual(body(flight.snapshot()), frozen);
      assert.deepEqual(flight.snapshot().originMm, origin);
      assert.equal(flight.snapshot().terrain.terrainReady, true);
    } finally {
      release?.();
      await flight.dispose();
    }
  },
);

await check(
  'live adoption pose rejects a stale window while old queries stay valid; cancellation disposes staging',
  async () => {
    const f = fixture(),
      window = create(f, { retainCommitted: true });
    let release;
    try {
      await window.transition(point(0));
      const before = window.snapshot().provenance;
      let pose = point(0),
        attached = 0;
      const blocked = new Promise((resolve) => {
        release = resolve;
      });
      f.scenery.setIntercept(async () => {
        await blocked;
      });
      const transition = window.transition(point(1), null, {
        readPose: () => ({ positionMm: pose, radiusMm: 220 }),
        commit() {
          attached++;
        },
        rollback() {},
      });
      await turn();
      assert.equal(window.snapshot().terrainReady, true);
      assert.equal(window.flightSupport(point(0), 220, 5).status, 'flight-support');
      pose = point(5);
      release();
      await assert.rejects(transition, /support required body pose/);
      assert.equal(attached, 0);
      assert.deepEqual(window.snapshot().provenance, before);
      assert.equal(window.snapshot().terrainReady, true);
      f.scenery.setIntercept(null);
      const cancelled = window.transition(point(1));
      window.cancel();
      await assert.rejects(cancelled, /cancelled/);
      assert.deepEqual(window.snapshot().provenance, before);
    } finally {
      release?.();
      await window.dispose();
    }
    assert.equal(window.snapshot().geometryBytes, 0);
    assert.equal(window.snapshot().reservedGeometryBytes, 0);
  },
);
await check(
  'detached asynchronous preparation keeps old queries live and validates the final pose',
  async () => {
    const f = fixture(),
      window = create(f, { retainCommitted: true });
    let release,
      entered,
      candidate,
      committed = 0,
      pose = point(1);
    const started = new Promise((resolve) => {
      entered = resolve;
    });
    const delayed = new Promise((resolve) => {
      release = resolve;
    });
    try {
      await window.transition(point(0));
      const old = window.group,
        before = window.snapshot().provenance;
      const preparing = window.transition(point(1), null, {
        async prepare({ group }) {
          candidate = group;
          assert.equal(group.parent, null);
          assert.equal(group.children.length, 2);
          entered();
          await delayed;
        },
        readPose: () => ({ positionMm: pose, radiusMm: 220 }),
        commit() {
          committed++;
        },
        rollback() {},
      });
      await started;
      assert.equal(window.group, old);
      assert.equal(window.snapshot().terrainReady, true);
      assert.equal(window.support(point(0), 4000000).status, 'terrain-hit');
      pose = point(5);
      release();
      await assert.rejects(preparing, /support required body pose/);
      assert.equal(committed, 0);
      assert.deepEqual(window.snapshot().provenance, before);
      assert.equal(candidate.children.length, 0);
      assert.equal(window.snapshot().reservedGeometryBytes, window.snapshot().geometryBytes);
    } finally {
      release?.();
      await window.dispose();
    }
  },
);
await check('failed renderer preparation cannot publish a verified mixed candidate', async () => {
  const f = fixture(),
    window = create(f, { retainCommitted: true });
  try {
    await window.transition(point(0));
    const old = window.group;
    await assert.rejects(
      window.transition(point(1), null, {
        async prepare() {
          throw new Error('shader rejected');
        },
        commit() {
          assert.fail('failed candidate adopted');
        },
        rollback() {},
      }),
      /shader rejected/,
    );
    assert.equal(window.group, old);
    assert.equal(window.snapshot().terrainReady, true);
    assert.equal(window.snapshot().reservedGeometryBytes, window.snapshot().geometryBytes);
    await assert.rejects(
      window.transition(point(1), null, {
        async prepare() {
          return { replacement: true };
        },
        commit() {
          assert.fail('replacement adopted');
        },
        rollback() {},
      }),
      /must not replace/,
    );
  } finally {
    await window.dispose();
  }
});
await check(
  'pause aborts background graphics preparation without losing the active frame',
  async () => {
    const f = fixture();
    let hold = false,
      entered = false,
      aborted = false;
    const flight = createRegionalFlightPrototype({
      ...configuration(f),
      prepareFrame: async (group, { signal }) => {
        assert.equal(group.parent, null);
        if (!hold) return;
        entered = true;
        await new Promise((resolve, reject) =>
          signal.addEventListener(
            'abort',
            () => {
              aborted = true;
              reject(signal.reason);
            },
            { once: true },
          ),
        );
      },
    });
    try {
      await flight.prepare();
      hold = true;
      assert(flight.arm());
      for (let i = 0; i < 1000 && !entered; i++) {
        assert.equal(
          flight.step({ ...neutral, throttle: i < 100 ? 0.9 : 0.55, roll: i < 100 ? 0 : 0.65 })
            .status,
          'active',
        );
        await turn();
      }
      assert(entered);
      for (let i = 0; i < 20; i++) {
        assert.equal(flight.step({ ...neutral, throttle: 0.55, roll: 0.65 }).status, 'active');
        await turn();
      }
      const before = flight.snapshot(),
        root = [...flight.root.children];
      flight.pause();
      for (let i = 0; i < 10; i++) await turn();
      assert(aborted);
      assert.equal(flight.snapshot().status, 'paused');
      assert.deepEqual(body(flight.snapshot()), body(before));
      assert.deepEqual(flight.root.children, root);
      assert.equal(
        flight.snapshot().terrain.reservedGeometryBytes,
        flight.snapshot().terrain.geometryBytes,
      );
    } finally {
      await flight.dispose();
    }
  },
);
await check(
  'cancel and disposal abort initial preparation and release its staged resources',
  async () => {
    for (const action of ['cancelPreparation', 'dispose']) {
      const f = fixture();
      let entered, signal;
      const started = new Promise((resolve) => {
        entered = resolve;
      });
      const flight = createRegionalFlightPrototype({
        ...configuration(f),
        prepareFrame: async (group, options) => {
          signal = options.signal;
          entered();
          await new Promise((resolve, reject) =>
            signal.addEventListener('abort', () => reject(signal.reason), { once: true }),
          );
        },
      });
      const preparing = flight.prepare();
      const rejected = assert.rejects(preparing, { name: 'AbortError' });
      await started;
      await flight[action]();
      await rejected;
      assert(signal.aborted);
      if (action !== 'dispose') {
        assert.equal(flight.snapshot().ticks, 0);
        assert.equal(flight.snapshot().status, 'paused');
        assert.equal(flight.arm(), false);
        await flight.dispose();
      }
      assert.equal(flight.root.children.length, 0);
    }
  },
);
await check(
  'actual query-world ownership stays bounded through 40 swaps and rejected stages',
  async () => {
    const owner = create(fixture(), { retainCommitted: true });
    const empty = { worlds: 0, colliders: 0, rigidBodies: 0 };
    assert.deepEqual(owner.collisionSnapshot(), empty);
    let peak = 0;
    try {
      await owner.transition(point(0));
      for (let i = 0; i < 40; i++) {
        const target = i % 2 ? 0 : 3;
        const nextColliders = (target === 0 ? 2 : 3) * 3;
        const before = owner.collisionSnapshot();
        assert.equal(before.worlds, 2);
        assert.equal(before.rigidBodies, 0); // Static query worlds do not contain a drone rigid body.
        await assert.rejects(
          owner.transition(point(target), null, {
            commit() {},
            rollback() {},
            prepare() {
              const staged = owner.collisionSnapshot();
              assert.deepEqual(staged, {
                worlds: 4,
                colliders: before.colliders + nextColliders,
                rigidBodies: 0,
              });
              peak = Math.max(peak, staged.colliders);
              throw new Error('deliberate-frame-rejection');
            },
          }),
          /deliberate-frame-rejection/,
        );
        assert.deepEqual(owner.collisionSnapshot(), before);
        assert.equal(owner.snapshot().terrainReady, true);
        await owner.transition(point(target));
        assert.deepEqual(owner.collisionSnapshot(), {
          worlds: 2,
          colliders: nextColliders,
          rigidBodies: 0,
        });
        const copy = owner.collisionSnapshot();
        copy.colliders = -1;
        assert.equal(owner.collisionSnapshot().colliders, nextColliders);
      }
      assert.equal(peak, 15);
      let release, entered;
      const started = new Promise((resolve) => {
        entered = resolve;
      });
      const held = owner.transition(point(3), null, {
        commit() {},
        rollback() {},
        async prepare() {
          entered();
          await new Promise((resolve) => {
            release = resolve;
          });
        },
      });
      const rejected = assert.rejects(held, { name: 'AbortError' });
      await started;
      assert.equal(owner.collisionSnapshot().worlds, 4);
      const disposing = owner.dispose();
      release();
      await rejected;
      await disposing;
      assert.deepEqual(owner.collisionSnapshot(), empty);
      await owner.dispose();
      assert.deepEqual(owner.collisionSnapshot(), empty);
    } finally {
      await owner.dispose();
    }
  },
);

console.log(`PASS ${checks}/${checks} continuous regional checks`);
