import test from 'node:test';
import assert from 'node:assert/strict';
import { mapDiagnosticDescriptions, renderMapDiagnostics } from '../playground/map-diagnostics.mjs';

const level = (overrides = {}) => ({
  spawn: { x: 24.5, y: 0.5 },
  ...overrides,
});

test('map inspection distinguishes an implicit start hangar from explicitly disabled switching', () => {
  assert.deepEqual(mapDiagnosticDescriptions(level()), [
    'No signal zones.',
    'Default start hangar: x 24.5, y 0.5; radius 2 cells.',
  ]);
  assert.deepEqual(mapDiagnosticDescriptions(level({ hangars: [] })), [
    'No signal zones.',
    'No hangars; class switching is disabled.',
  ]);
});

test('map inspection exposes every zone and authored hangar with their independent mechanics', () => {
  const source = level({
    signalZones: [
      { id: 'orchard', x: 2, y: 4, w: 8, h: 6, speedFactor: 0.4 },
      {
        id: 'relay',
        x: 9,
        y: 3,
        w: 0.5,
        h: 2,
        speedFactor: 1,
        disableBoost: true,
        lockAbility: true,
      },
    ],
    hangars: [
      { id: 'yard', x: 10.5, y: 20.5 },
      { id: 'gate', x: 18.5, y: 4.5, radius: 0.25 },
    ],
  });
  const before = structuredClone(source);
  assert.deepEqual(mapDiagnosticDescriptions(source), [
    'Signal zone orchard: x 2, y 4; 8 × 6 cells; speed 40%; boost allowed; ability allowed.',
    'Signal zone relay: x 9, y 3; 0.5 × 2 cells; speed 100%; boost blocked; ability locked.',
    'Hangar yard: x 10.5, y 20.5; radius 2 cells.',
    'Hangar gate: x 18.5, y 4.5; radius 0.25 cells.',
  ]);
  assert.deepEqual(source, before, 'Reading diagnostics cannot alter the working level.');
  assert.deepEqual(
    mapDiagnosticDescriptions(source, { locale: 'uk-UA' }),
    mapDiagnosticDescriptions(source),
    'Untranslated locales keep the same complete English information.',
  );
});

test('diagnostic renderer creates text-only rows in the existing host list', () => {
  const created = [];
  const doc = {
    createElement(tag) {
      assert.equal(tag, 'li');
      const row = { textContent: '' };
      created.push(row);
      return row;
    },
  };
  const list = {
    ownerDocument: doc,
    children: [],
    replaceChildren(...children) {
      this.children = children;
    },
  };
  renderMapDiagnostics(list, level({ hangars: [{ id: '<yard>', x: 1.5, y: 2.5 }] }));
  assert.equal(list.children.length, 2);
  assert.equal(list.children[1].textContent, 'Hangar <yard>: x 1.5, y 2.5; radius 2 cells.');
  assert.ok(list.children.every((row) => created.includes(row)));
  renderMapDiagnostics(list, level({ hangars: [] }));
  assert.deepEqual(
    list.children.map((row) => row.textContent),
    ['No signal zones.', 'No hangars; class switching is disabled.'],
  );
});
