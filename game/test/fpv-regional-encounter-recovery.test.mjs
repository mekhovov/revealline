import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnduranceFixture } from '../../authoring/fpv-worlds/regions/endurance-fixture.mjs';
import { createRegionalFlightPrototype } from '../../optional-practice/civilian-fpv/regional/flight-prototype.mjs';
import { initAdvancedRuntime } from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';

await initAdvancedRuntime();
const neutral = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
const fixture = await createEnduranceFixture();
const options = () => ({
  manifest: fixture.terrain.manifest,
  source: fixture.terrain.source,
  continuous: true,
});

test('Regional encounter recovery validates every body field and environment without changing the live flight', async () => {
  const flight = createRegionalFlightPrototype(options());
  try {
    await flight.prepare();
    const initial = flight.encounterCheckpoint();
    assert.equal(initial.format, 'RegionalEncounterFlight.v2');
    flight.arm();
    for (let tick = 0; tick < 5; tick++) flight.step(neutral);
    flight.pause();
    const before = flight.snapshot(),
      children = [...flight.root.children];
    for (const corrupt of [
      (x) => (x.body.orientation[0] = 500000),
      (x) => (x.body.position.x += 0.1),
      (x) => (x.body.position.y = -5000),
      (x) => (x.body.velocity.y = 30001),
      (x) => (x.body.grounded = true),
      (x) => (x.body.extra = 1),
      (x) => (x.origin.x += 1),
      (x) => (x.contacts = -1),
      (x) => (x.recentres = -1),
      (x) => (x.identity = 'foreign'),
    ]) {
      const saved = structuredClone(initial);
      corrupt(saved);
      await assert.rejects(() => flight.restoreEncounterCheckpoint(saved));
      assert.deepEqual(flight.snapshot(), before);
      assert.deepEqual(flight.root.children, children);
    }
    const foreign = createRegionalFlightPrototype({ ...options(), initialHeading: 9000 });
    try {
      await foreign.prepare();
      await assert.rejects(
        () => flight.restoreEncounterCheckpoint(foreign.encounterCheckpoint()),
        /environment/,
      );
    } finally {
      await foreign.dispose();
    }
    await flight.restoreEncounterCheckpoint(initial);
    assert.equal(flight.snapshot().ticks, 0);
    assert.deepEqual(flight.encounterCheckpoint(), initial);
    assert.equal(flight.snapshot().status, 'paused');
    assert.equal(flight.arm(), true);
    assert.equal(flight.step(neutral).ticks, 1);
  } finally {
    await flight.dispose();
  }
});

test('failed terrain preparation and scene attachment leave Regional recovery atomic', async () => {
  let failure = null;
  const flight = createRegionalFlightPrototype({
    ...options(),
    prepareFrame(group) {
      if (failure === 'prepare') throw new Error('GPU preparation failed');
      if (failure === 'attach')
        group.addEventListener('added', () => {
          throw new Error('Scene attachment failed');
        });
    },
  });
  try {
    await flight.prepare();
    const saved = flight.encounterCheckpoint();
    flight.arm();
    flight.step(neutral);
    flight.pause();
    const before = flight.snapshot(),
      children = [...flight.root.children];
    for (const value of ['prepare', 'attach']) {
      failure = value;
      await assert.rejects(() => flight.restoreEncounterCheckpoint(saved), /failed/);
      assert.deepEqual(flight.snapshot(), before);
      assert.deepEqual(flight.root.children, children);
    }
    failure = null;
    fixture.terrain.setIntercept(() => {
      throw new Error('Download failed');
    });
    await assert.rejects(() => flight.restoreEncounterCheckpoint(saved));
    assert.deepEqual(flight.snapshot(), before);
    assert.deepEqual(flight.root.children, children);
    fixture.terrain.setIntercept(null);
    await flight.restoreEncounterCheckpoint(saved);
    assert.equal(flight.snapshot().ticks, 0);
  } finally {
    fixture.terrain.setIntercept(null);
    await flight.dispose();
  }
});

test('Regional moving impacts include actor velocity and restore binds the stable actor pool', async () => {
  const flight = createRegionalFlightPrototype(options());
  try {
    await flight.prepare();
    const pos = flight.snapshot().position;
    const actor = {
      id: 'target',
      slotId: 'encounter-slot-01',
      type: 'drone',
      position: { ...pos, x: pos.x + 2000, y: pos.y + 220 },
      radius: 300,
      height: 600,
    };
    const withoutPool = flight.encounterCheckpoint();
    flight.configureEncounterActors([actor]);
    await assert.rejects(() => flight.restoreEncounterCheckpoint(withoutPool), /environment/);
    const saved = flight.encounterCheckpoint();
    flight.stageEncounterActors({
      motions: [
        {
          id: actor.slotId,
          from: actor.position,
          to: { ...actor.position, x: pos.x - 2000 },
          enabled: true,
        },
      ],
    });
    flight.arm();
    flight.step(neutral);
    flight.pause();
    const impact = flight.encounterMotion().contacts[0];
    assert.equal(impact.actorId, actor.slotId);
    assert.ok(impact.relativeNormalSpeedMmS > 100000);
    const velocity = flight.encounterMotion().trace[0].velocity;
    const expected = -['x', 'y', 'z'].reduce(
      (sum, axis) =>
        sum + ((velocity[axis] - (axis === 'x' ? -200000 : 0)) * impact.normal[axis]) / 1000000,
      0,
    );
    assert.equal(impact.relativeNormalSpeedMmS, expected);
    await flight.restoreEncounterCheckpoint(saved);
    assert.equal(flight.encounterMotion(), null);
  } finally {
    await flight.dispose();
  }
});

test('Regional Standard admits all 128 v2 slots and rejects incomplete or changing collision geometry', async () => {
  const flight = createRegionalFlightPrototype(options());
  try {
    await flight.prepare();
    const p = flight.snapshot().position;
    const actors = Array.from({ length: 128 }, (_, i) => ({
      id: `life-${i}`,
      spawnId: `life-${i}`,
      slotId: `slot-${i}`,
      type: 'drone',
      position: {
        ...p,
        x: p.x + 5000 + (i % 16) * 1000,
        z: p.z + Math.floor(i / 16) * 1000,
        y: p.y + 2000,
      },
      radius: 300,
      height: 600,
      health: 100,
      maxHealth: 100,
      status: 'active',
      appearance: { archetype: 'military-uav' },
    }));
    flight.configureEncounterActors(actors);
    const proposal = {
      actors,
      motions: actors.map((a) => ({
        id: a.slotId,
        from: a.position,
        to: a.position,
        enabled: true,
      })),
    };
    assert.throws(
      () => flight.stageEncounterActors({ ...proposal, actors: actors.slice(0, 127) }),
      /proposal/,
    );
    const changed = structuredClone(proposal);
    changed.actors[127].radius = 500;
    assert.throws(() => flight.stageEncounterActors(changed), /admitted slot/);
    flight.stageEncounterActors(proposal);
    flight.arm();
    flight.step(neutral);
    flight.pause();
    const saved = flight.encounterCheckpoint();
    flight.arm();
    flight.step(neutral);
    flight.pause();
    await flight.restoreEncounterCheckpoint(saved);
    assert.equal(flight.snapshot().ticks, 1);
  } finally {
    await flight.dispose();
  }
});
