import test from 'node:test';
import assert from 'node:assert/strict';
import { createRegionalEncounterGeometry } from '../../optional-practice/civilian-fpv/encounter-geometry.mjs';

const p = (x = 0, y = 0, z = 0) => ({ x, y, z });
const options = {
  bounds: { min: p(-30000, 0, -30000), max: p(30000, 30000, 30000) },
  player: { position: p(-10000, 1000, -10000), radius: 220 },
};
const actor = (overrides = {}) => ({
  id: 'courier',
  type: 'patrol',
  position: p(0, 0, 5000),
  path: [],
  height: 1800,
  radius: 350,
  ...overrides,
});
const query = (blocks = () => false) => ({
  support: () => ({
    status: 'terrain-hit',
    heightMm: 0,
    normal: p(0, 1),
    chunkId: 'verified-floor',
  }),
  castMotion(from, delta, radius) {
    return blocks(from, delta, radius)
      ? { status: 'motion-hit', hit: { toi: 0.5, normal: p(-1), id: 'verified-obstacle' } }
      : { status: 'motion-clear' };
  },
});
const near = (from, delta, radius, point) => {
  const length = delta.x ** 2 + delta.z ** 2;
  const t = length
    ? Math.max(
        0,
        Math.min(1, ((point.x - from.x) * delta.x + (point.z - from.z) * delta.z) / length),
      )
    : 0;
  return Math.hypot(from.x + delta.x * t - point.x, from.z + delta.z * t - point.z) <= radius + 100;
};

test('regional admission checks the actual last-to-first waypoint closing leg', () => {
  const geometry = createRegionalEncounterGeometry(
    query((from, delta, radius) => near(from, delta, radius, p(5000, 0, 5000))),
    options,
  );
  const source = actor({ path: [p(5000), p(10000, 0, 5000), p(5000, 0, 10000)] });
  assert.equal(
    geometry.admitActor(source),
    null,
    'the perimeter is clear but the runtime closing leg crosses the verified obstacle',
  );
  const open = createRegionalEncounterGeometry(query(), options).admitActor(source);
  assert.ok(open, 'the same route remains admitted without an obstruction');
  assert.deepEqual(
    open.path.map(({ x, z }) => ({ x, z })),
    source.path.map(({ x, z }) => ({ x, z })),
  );
});

test('regional admission includes the top capsule endpoint in body clearance', () => {
  const ceiling = query(
    (from, delta, radius) =>
      Math.max(from.y, from.y + delta.y) + radius >= 1760 &&
      Math.min(from.y, from.y + delta.y) - radius <= 1770,
  );
  const geometry = createRegionalEncounterGeometry(ceiling, options);
  assert.equal(
    geometry.admitActor(actor()),
    null,
    'a thin overhead obstacle intersects the top of the accepted body',
  );
  assert.ok(createRegionalEncounterGeometry(query(), options).admitActor(actor()));
});

test('regional runtime motion and admission both reject an unavailable collision query', () => {
  const geometry = createRegionalEncounterGeometry(
    { ...query(), castMotion: () => ({ status: 'unavailable' }) },
    options,
  );
  assert.equal(geometry.admitActor(actor()), null);
  const source = actor();
  assert.deepEqual(geometry.moveActor(source, p(10)), { position: source.position, blocked: true });
});
