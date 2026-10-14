import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLASSIC_STRUCTURE_FAMILIES,
  drawClassicStructureModule,
} from '../snake/classic-structure-art.mjs';

function render(family, scene, treatment, width = 3, height = 3) {
  const calls = [];
  const ctx = new Proxy(
    {},
    { get: (object, key) => object[key] ?? ((...args) => calls.push([key, ...args])) },
  );
  const occupied = new Set();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) occupied.add(`${x},${y}`);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      calls.push(['cell', x, y]);
      drawClassicStructureModule(ctx, { x, y }, scene, {
        treatment,
        occupied,
        structure: { x: 0, y: 0, width, height },
        composition: { assembly: { family, footprint: null } },
      });
    }
  return calls;
}

test('all construction families have different drawn geometry within each world and look', () => {
  for (const treatment of ['living-circuit', 'toybox', 'atmospheric-ruins', 'night-arcade']) {
    for (const [scene, families] of Object.entries(CLASSIC_STRUCTURE_FAMILIES)) {
      const signatures = new Set(
        families.map((family) => JSON.stringify(render(family, scene, treatment))),
      );
      assert.equal(
        signatures.size,
        3,
        `${scene}/${treatment}: colour alone cannot distinguish a structure family`,
      );
    }
  }
});

test('construction accents stay inside exact square cells for thin and dense components', () => {
  for (const [scene, families] of Object.entries(CLASSIC_STRUCTURE_FAMILIES))
    for (const family of families) {
      for (const [width, height] of [
        [1, 1],
        [1, 5],
        [5, 1],
        [3, 3],
      ]) {
        for (const treatment of ['living-circuit', 'toybox', 'atmospheric-ruins', 'night-arcade']) {
          for (const [op, x, y, w, h] of render(family, scene, treatment, width, height)) {
            if (op !== 'fillRect') continue;
            assert(
              x >= 0 && y >= 0 && w >= 0 && h >= 0 && x + w <= 28 && y + h <= 28,
              `${scene}/${family}/${treatment}: accent cannot imply occupied floor outside its cell`,
            );
          }
        }
      }
    }
});

test('a native receiver bank is singular and does not stamp a cabin window on every tile', () => {
  const calls = render('receiver', 'relay', 'living-circuit', 5, 4);
  const banks = calls.filter(
    ([op, x, y, w, h]) => op === 'fillRect' && x === 4 && y === 5 && w === 20 && h === 17,
  );
  assert.equal(banks.length, 1);
  assert(
    !calls.some(
      ([op, x, y, w, h]) => op === 'fillRect' && x === 7 && y === 6 && w === 14 && h === 8,
    ),
  );
});
