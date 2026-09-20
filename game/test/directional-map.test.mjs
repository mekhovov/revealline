import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compileMapDesign,
  compileMapGeometry,
  compileRelayMapGeometry,
} from '../content-design/map.mjs';
import { DIRECTIONAL_FIELD_RULES, directionalSpeedFactor } from '../core/directional-fields.mjs';
import { CELL } from '../core/index.mjs';

function source() {
  return {
    format: 'MapDesignV3',
    id: 'crosswind-test',
    revision: 'candidate-1',
    name: 'Marked crossing',
    width: 72,
    height: 36,
    walls: [],
    foundations: [],
    terrain: [],
    gates: [],
    spawns: [{ id: 'start', x: 10.5, y: 0.5 }],
    speedZones: [{ id: 'east-lane', x: 8, y: 4, w: 20, h: 3, direction: 'right' }],
  };
}

test('explicit V3 maps retain earned geometry and compile owned immutable marked fields', () => {
  const map = source(),
    original = structuredClone(map),
    result = compileMapDesign(map);
  assert.equal(result.format, 'ResolvedMapV3');
  assert.equal(result.geometry.eligibleCount, 70 * 34);
  assert.equal(result.geometry.speedZones[0].cells.length, 60);
  assert(
    result.geometry.speedZones[0].cells.every((cell) => result.geometry.cells[cell] === CELL.FIELD),
  );
  assert.deepEqual(map, original);
  map.speedZones[0].direction = 'left';
  assert.equal(result.geometry.speedZones[0].direction, 'right');
  assert(Object.isFrozen(result.geometry.speedZones[0]));
  assert(Object.isFrozen(result.geometry.speedZones[0].cells));
  assert.notEqual(compileMapDesign(map).geometryIdentity, result.geometryIdentity);
  map.speedZones = [];
  assert.deepEqual(compileMapDesign(map).geometry.speedZones, []);
});

test('old map editions never silently acquire directional fields', () => {
  for (const format of ['MapDesignV1', 'MapDesignV2']) {
    const map = source();
    map.format = format;
    if (format === 'MapDesignV1') delete map.gates;
    assert.throws(() => compileMapDesign(map), /speedZones/);
    delete map.speedZones;
    assert.equal(Object.hasOwn(compileMapDesign(map).geometry, 'speedZones'), false);
  }
  const map = source();
  delete map.format;
  delete map.id;
  delete map.revision;
  delete map.name;
  assert.throws(() => compileRelayMapGeometry(map), /speedZones/);
  delete map.gates;
  assert.throws(() => compileMapGeometry(map), /speedZones/);
});

test('directional geometry rejects ambiguous overlays, invalid extents and per-level physics', () => {
  const cases = [
    (map) => map.speedZones.push({ ...map.speedZones[0], id: 'overlap' }),
    (map) => map.speedZones.push({ ...map.speedZones[0], x: 40 }),
    (map) => map.walls.push({ x: 10, y: 4, w: 1, h: 1 }),
    (map) => map.foundations.push({ x: 10, y: 4, w: 1, h: 1 }),
    (map) => map.gates.push({ id: 'gate', x: 10, y: 4, w: 1, h: 1 }),
    (map) => map.terrain.push({ id: 'slow', kind: 'slow', x: 10, y: 4, w: 1, h: 1 }),
    (map) => map.terrain.push({ id: 'lethal', kind: 'lethal', x: 10, y: 4, w: 1, h: 1 }),
    (map) => {
      map.speedZones[0].x = 0;
    },
    (map) => {
      map.speedZones[0].h = 0;
    },
    (map) => {
      map.speedZones[0].w = 100;
    },
    (map) => {
      map.speedZones[0].y = 4.5;
    },
    (map) => {
      map.speedZones[0].direction = 'diagonal';
    },
    (map) => {
      map.speedZones[0].direction = ['right'];
    },
    (map) => {
      map.speedZones[0].speed = 100;
    },
    (map) => {
      map.speedZones[0].force = 1;
    },
    (map) => {
      delete map.speedZones;
    },
    (map) => {
      map.speedZones = Array.from({ length: 33 }, (_, id) => ({
        ...map.speedZones[0],
        id: `zone-${id}`,
      }));
    },
  ];
  for (const change of cases) {
    const map = source();
    change(map);
    assert.throws(() => compileMapDesign(map));
  }
});

test('directional definitions reject accessors before reading them', () => {
  const map = source();
  let reads = 0;
  Object.defineProperty(map.speedZones[0], 'direction', {
    enumerable: true,
    get() {
      reads++;
      return 'right';
    },
  });
  assert.throws(() => compileMapDesign(map));
  assert.equal(reads, 0);
});

test('the single directional recipe affects only moving craft on unclaimed marked cells', () => {
  const map = source(),
    compiled = compileMapDesign(map),
    index = 4 * 72 + 8;
  const state = {
    width: 72,
    cells: [...compiled.geometry.cells],
    level: {
      directionalFields: { version: DIRECTIONAL_FIELD_RULES.version, zones: map.speedZones },
    },
  };
  assert.deepEqual(DIRECTIONAL_FIELD_RULES, {
    version: 'directional-fields.v1',
    withFlow: 1.25,
    againstFlow: 0.8,
    crossFlow: 1,
  });
  for (const [direction, expected] of [
    ['right', 1.25],
    ['left', 0.8],
    ['up', 1],
    ['down', 1],
    [null, 1],
  ])
    assert.equal(directionalSpeedFactor(state, index, direction), expected);
  assert.equal(directionalSpeedFactor(state, 4 * 72 + 7, 'right'), 1);
  for (const cell of [CELL.SAFE, CELL.WALL]) {
    state.cells[index] = cell;
    assert.equal(directionalSpeedFactor(state, index, 'right'), 1);
  }
  state.cells[index] = CELL.FIELD;
  assert.equal(directionalSpeedFactor(state, index, 'right'), 1.25);
  delete state.level.directionalFields;
  assert.equal(directionalSpeedFactor(state, index, 'right'), 1);
});
