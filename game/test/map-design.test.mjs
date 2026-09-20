import test from 'node:test';
import assert from 'node:assert/strict';
import { compileMapDesign, compileMapGeometry } from '../content-design/map.mjs';

const design = (changes = {}) => ({
  format: 'MapDesignV1',
  id: 'nearby-shore',
  revision: '1',
  name: 'Nearby shore',
  width: 72,
  height: 36,
  walls: [],
  foundations: [{ x: 30, y: 15, w: 5, h: 5 }],
  terrain: [],
  spawns: [{ id: 'solo', x: 32.5, y: 17.5 }],
  ...changes,
});

test('shared map compilation unions foundations and starts with zero earned territory', () => {
  const source = design({
    foundations: [
      { x: 30, y: 15, w: 5, h: 5 },
      { x: 32, y: 17, w: 4, h: 4 },
    ],
  });
  const before = structuredClone(source);
  const map = compileMapDesign(source);
  assert.deepEqual(source, before);
  assert.equal(map.geometry.foundationCount, 32);
  assert.equal(map.geometry.eligibleCount, 70 * 34 - 32);
  assert.equal(map.geometry.cells[17 * 72 + 32], 1);
  assert.equal(map.geometry.eligible[17 * 72 + 32], 0);
  assert.equal(map.geometry.permanent[17 * 72 + 32], 1);
  assert.equal(map.geometry.permanent[0], 1);
  assert.equal(map.geometry.safeComponents.length, 2);
  assert(map.geometry.diagnostics.some((d) => d.code === 'disconnected-foundations'));
  assert(Object.isFrozen(map.geometry.cells));
  assert.throws(() => {
    map.geometry.cells[0] = 0;
  }, TypeError);
  source.foundations[0].w = 1;
  assert.equal(map.geometry.foundationCount, 32);
});

test('map identity ignores display labels but includes geometry and spawn changes', () => {
  const original = compileMapDesign(design());
  const renamed = compileMapDesign(design({ name: 'A different title', revision: '2' }));
  assert.equal(original.geometryIdentity, renamed.geometryIdentity);
  const moved = compileMapDesign(design({ spawns: [{ id: 'solo', x: 31.5, y: 17.5 }] }));
  assert.notEqual(original.geometryIdentity, moved.geometryIdentity);
});

test('compiler rejects overlap, invalid spawns, no field, sealed departures and unsupported data', () => {
  const cases = [
    design({ walls: [{ x: 30, y: 15, w: 1, h: 1 }] }),
    design({ spawns: [{ id: 'solo', x: 10.5, y: 10.5 }] }),
    design({ spawns: [{ id: 'solo', x: 32.4, y: 17.5 }] }),
    design({ foundations: [{ x: 1, y: 1, w: 70, h: 34 }] }),
    design({ foundations: [{ x: 70, y: 10, w: 2, h: 2 }] }),
    design({ script: 'run()' }),
    design({
      spawns: [
        { id: 'solo', x: 32.5, y: 17.5 },
        { id: 'solo', x: 33.5, y: 17.5 },
      ],
    }),
    design({
      walls: [
        { x: 29, y: 14, w: 7, h: 1 },
        { x: 29, y: 20, w: 7, h: 1 },
        { x: 29, y: 15, w: 1, h: 5 },
        { x: 35, y: 15, w: 1, h: 5 },
      ],
    }),
  ];
  for (const candidate of cases) assert.throws(() => compileMapDesign(candidate), TypeError);
});

test('underlying hazards remain authored data, never a substitute for return ground', () => {
  const map = compileMapDesign(
    design({ terrain: [{ id: 'mud', kind: 'slow', x: 28, y: 15, w: 7, h: 5 }] }),
  );
  assert.equal(map.geometry.terrain[15 * 72 + 28], 1);
  assert.equal(map.geometry.cells[15 * 72 + 28], 0);
  assert.equal(map.geometry.terrain[15 * 72 + 30], 1);
  assert.equal(map.geometry.cells[15 * 72 + 30], 1);
  assert.throws(
    () =>
      compileMapDesign(
        design({
          terrain: [
            { id: 'mud', kind: 'slow', x: 10, y: 10, w: 3, h: 3 },
            { id: 'fire', kind: 'lethal', x: 11, y: 11, w: 2, h: 2 },
          ],
        }),
      ),
    /overlap/,
  );
});

test('plain JSON boundary refuses accessors without invoking them and geometry is deterministic', () => {
  let calls = 0;
  const hostile = design();
  Object.defineProperty(hostile, 'foundations', {
    enumerable: true,
    get() {
      calls++;
      return [];
    },
  });
  assert.throws(() => compileMapDesign(hostile));
  assert.equal(calls, 0);
  const { format, id, revision, name, ...geometry } = design();
  assert.deepEqual(compileMapGeometry(geometry), compileMapDesign(design()).geometry);
  assert.equal(format, 'MapDesignV1');
  assert(id && revision && name);
});
