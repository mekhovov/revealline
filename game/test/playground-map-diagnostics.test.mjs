import test from 'node:test';
import assert from 'node:assert/strict';
import { getLocale, setLocale } from '../i18n/index.mjs';
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
    [
      'Зона сигналу orchard: x 2, y 4; 8 × 6 клітинок; швидкість 40%; прискорення дозволено; здібність дозволено.',
      'Зона сигналу relay: x 9, y 3; 0,5 × 2 клітинок; швидкість 100%; прискорення заблоковано; здібність заблоковано.',
      'Ангар yard: x 10,5, y 20,5; радіус 2 клітинок.',
      'Ангар gate: x 18,5, y 4,5; радіус 0,25 клітинок.',
    ],
    'Ukrainian keeps each authored ID, mechanic and exact coordinate.',
  );
});

test('diagnostic renderer creates text-only rows in the existing host list', (context) => {
  const locale = getLocale();
  context.after(() => setLocale(locale, { persist: false }));
  setLocale('en', { persist: false });
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

test('map diagnostic language changes preserve row identity and the unsaved working level', (context) => {
  const locale = getLocale();
  context.after(() => setLocale(locale, { persist: false }));
  setLocale('en', { persist: false });
  const source = level({ hangars: [{ id: 'my-yard', x: 10.5, y: 20.5 }] });
  const before = JSON.stringify(source);
  const list = {
    ownerDocument: { createElement: () => ({ textContent: '' }) },
    replaceChildren(...children) {
      this.children = children;
    },
  };
  renderMapDiagnostics(list, source);
  const rows = [...list.children];
  setLocale('uk', { persist: false });
  assert.equal(list.children[0].textContent, 'Немає зон сигналу.');
  assert.equal(list.children[1].textContent, 'Ангар my-yard: x 10,5, y 20,5; радіус 2 клітинок.');
  assert.deepEqual(list.children, rows);
  assert.equal(JSON.stringify(source), before);
  setLocale('en', { persist: false });
  assert.equal(list.children[0].textContent, 'No signal zones.');
});
