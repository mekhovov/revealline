import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOverflightRemains,
  overflightRemainsFrame,
  OVERFLIGHT_REMAINS_LIMITS,
} from '../overflight/remains.mjs';
import { overflightAtlasInventory, overflightHeroGeometry } from '../overflight/atlas.mjs';

const camera = { x: 100, y: 100, width: 960, height: 540 };
function fixture(capacity = 4) {
  const run = {
    defeats: { sequence: 0, capacity, records: Array.from({ length: capacity }, () => ({})) },
  };
  const record = (values = {}) => {
    const sequence = ++run.defeats.sequence;
    Object.assign(run.defeats.records[(sequence - 1) % capacity], {
      sequence,
      id: 1,
      family: 'runner',
      wardrobe: 2,
      x: 100,
      y: 100,
      heading: 0,
      tick: sequence * 60,
      time: sequence,
      ...values,
    });
  };
  return { run, record };
}

test('remains copy accepted facts once, survive mailbox slot reuse and time, and reset by run identity', () => {
  const history = createOverflightRemains(),
    { run, record } = fixture();
  record();
  const before = structuredClone(run);
  history.consume(run);
  history.consume(run);
  assert.deepEqual(run, before);
  assert.equal(history.snapshot().stored, 1);
  const marks = [];
  history.visitVisible(camera, (mark) => marks.push({ ...mark }));
  run.defeats.records[0].x = 9000;
  run.time = 10000;
  history.consume(run);
  const after = [];
  history.visitVisible(camera, (mark) => after.push({ ...mark }));
  assert.deepEqual(after, marks, 'Settled marks neither expire nor alias pooled core records.');
  history.consume({ defeats: { sequence: 0, capacity: 4, records: [] } });
  assert.equal(history.snapshot().stored, 0);
});

test('mailbox overflow, lifetime storage and visible submission have independent finite bounds', () => {
  const history = createOverflightRemains(),
    { run, record } = fixture();
  for (let index = 0; index < 10; index++) record();
  history.consume(run);
  assert.equal(history.snapshot().stored, 4);
  assert.equal(history.snapshot().missed, 6);
  for (let index = 0; index < OVERFLIGHT_REMAINS_LIMITS.capacity + 10; index++) {
    record();
    history.consume(run);
  }
  assert.equal(history.snapshot().stored, OVERFLIGHT_REMAINS_LIMITS.capacity);
  assert.equal(history.snapshot().evicted, 14);
  assert.equal(
    history.visitVisible(camera, () => {}),
    OVERFLIGHT_REMAINS_LIMITS.visible,
  );
  assert.equal(
    history.visitVisible({ ...camera, x: 9000 }, () => {}),
    0,
  );
  assert.equal(
    history.visitVisible(camera, () => {}),
    OVERFLIGHT_REMAINS_LIMITS.visible,
  );
  history.reset();
  assert.equal(history.snapshot().stored, 0);
  assert.equal(history.snapshot().missed, 0);
});

test('shared gore/cast choices select only pre-baked material-correct frames', () => {
  const frames = new Set(overflightAtlasInventory().frames.map((frame) => frame.id));
  const soldier = { family: 'runner', wardrobe: 2 };
  const machine = { family: 'tracked-tank' };
  assert.match(overflightRemainsFrame(soldier, { brutal: false, blood: true }), /:arcade:clean$/);
  assert.match(overflightRemainsFrame(soldier, { brutal: true, blood: false }), /:arcade:debris$/);
  assert.match(
    overflightRemainsFrame(soldier, { brutal: true, blood: true }, 'tactical'),
    /:tactical:blood$/,
  );
  for (const mark of [soldier, machine])
    for (const brutal of [false, true])
      for (const blood of [false, true]) {
        const frame = overflightRemainsFrame(mark, { brutal, blood });
        assert.ok(frames.has(frame));
        for (let pose = 0; pose < 4; pose++)
          assert.ok(frames.has(`${frame.replace('remains:', 'defeat:')}:${pose}`));
        if (mark === machine) assert.ok(!frame.includes('blood'));
      }
});

test('larger FPV props preserve native motor centers without intersecting adjacent sweeps or atlas edges', () => {
  const geometry = Object.freeze({
    frame: { width: 64, height: 64 },
    pivot: { x: 0.5, y: 0.5 },
    occupiedBounds: { x: 0.125, y: 0.125, width: 0.75, height: 0.75 },
    rotors: [-1, 1].flatMap((x) =>
      [-1, 1].map((y) => ({
        x: x / 4,
        y: y / 4,
        radiusScale: 0.75,
        direction: x * y,
        bladeCount: 3,
      })),
    ),
  });
  const before = structuredClone(geometry),
    visual = overflightHeroGeometry(geometry);
  assert.deepEqual(geometry, before);
  for (let index = 0; index < visual.rotors.length; index++) {
    const rotor = visual.rotors[index],
      source = geometry.rotors[index];
    assert.equal(rotor.x, source.x * visual.width);
    assert.equal(rotor.y, source.y * visual.height);
    assert.ok(rotor.radius > 0.16 * source.radiusScale * visual.width * 1.5);
    assert.ok(Math.abs(rotor.x) + rotor.radius < visual.frameSize / 2);
    assert.ok(Math.abs(rotor.y) + rotor.radius < visual.frameSize / 2);
    for (const other of visual.rotors)
      if (rotor !== other)
        assert.ok(rotor.radius + other.radius < Math.hypot(rotor.x - other.x, rotor.y - other.y));
  }
});
