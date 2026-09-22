import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compileMapDesign,
  compileMapGeometry,
  compileRelayMapGeometry,
} from '../content-design/map.mjs';
import { CELL } from '../core/registry.mjs';

const geometry = () => ({
  width: 72,
  height: 36,
  walls: [],
  foundations: [],
  terrain: [],
  spawns: [{ id: 'home', x: 10.5, y: 0.5 }],
  gates: [{ id: 'east-link', x: 35, y: 16, w: 1, h: 4 }],
});

test('relay geometry reserves blocked non-scoring cells without changing V1', () => {
  const source = geometry(),
    result = compileRelayMapGeometry(source);
  assert.equal(result.eligibleCount, 2380 - 4);
  assert.deepEqual(result.gates, [{ id: 'east-link', cells: [1187, 1259, 1331, 1403] }]);
  for (const i of result.gates[0].cells) {
    assert.equal(result.cells[i], CELL.WALL);
    assert.equal(result.permanent[i], 0);
    assert.equal(result.eligible[i], 0);
  }
  assert(Object.isFrozen(result.gates[0].cells));
  assert.deepEqual(source, geometry());
  assert.throws(() => compileMapGeometry(source), /gates is not supported/);
});

test('MapDesignV2 pins gate identity and V1 rejects gate semantics', () => {
  const source = {
    format: 'MapDesignV2',
    id: 'relay-map',
    revision: '1',
    name: 'Relay map',
    ...geometry(),
  };
  const result = compileMapDesign(source);
  assert.equal(result.format, 'ResolvedMapV2');
  const renamed = structuredClone(source);
  renamed.gates[0].id = 'different-link';
  assert.notEqual(compileMapDesign(renamed).geometryIdentity, result.geometryIdentity);
  assert.throws(
    () => compileMapDesign({ ...source, format: 'MapDesignV1' }),
    /gates is not supported/,
  );
  const { gates: _gates, ...plain } = source;
  assert.throws(() => compileMapDesign(plain), /explicit gates/);
});

test('gate rectangles reject overlaps, unsafe shapes, duplicate IDs and unbounded lists', () => {
  for (const modify of [
    (s) => s.walls.push({ x: 35, y: 16, w: 2, h: 2 }),
    (s) => s.foundations.push({ x: 35, y: 16, w: 2, h: 2 }),
    (s) => s.terrain.push({ id: 'hot', kind: 'lethal', x: 35, y: 16, w: 2, h: 2 }),
    (s) => s.gates.push({ ...s.gates[0], id: 'other' }),
    (s) => s.gates.push({ ...s.gates[0], x: 40 }),
    (s) => {
      s.gates[0].x = 0;
    },
    (s) => {
      s.gates[0].w = 0;
    },
    (s) => {
      s.gates[0].id = '';
    },
    (s) => {
      s.gates[0].script = 'open()';
    },
    (s) => {
      s.gates = Array.from({ length: 33 }, (_, i) => ({ id: `g${i}`, x: i + 1, y: 1, w: 1, h: 1 }));
    },
  ]) {
    const source = geometry();
    modify(source);
    assert.throws(() => compileRelayMapGeometry(source));
  }
});
