import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoop } from '../coop/core.mjs';
import { FIRST_CONNECTION } from '../coop/first-connection.mjs';
import { coopObjectivesSnapshot, paintCoopObjectiveDiagram } from '../couch/coop-objectives.mjs';

function level() {
  const value = structuredClone(FIRST_CONNECTION);
  value.walls = [];
  value.strongholds = [
    {
      id: 'west',
      core: { x: 31.5, y: 16.5 },
      anchors: [
        { x: 30.5, y: 15.5 },
        { x: 32.5, y: 17.5 },
      ],
    },
    {
      id: 'east',
      core: { x: 61.5, y: 25.5 },
      anchors: [
        { x: 57.5, y: 22.5 },
        { x: 65.5, y: 28.5 },
      ],
    },
  ];
  value.goal = { cores: ['west', 'east'] };
  return value;
}
test('authored and live relay snapshots preserve identity, exact statuses and meaningful relationships without mutating source', () => {
  const authored = level(),
    run = createCoop(authored);
  run.strongholds[0].defeated = true;
  run.strongholds[0].anchors[0].captured = true;
  run.strongholds[1].shielded = false;
  const before = structuredClone(run);
  const selected = coopObjectivesSnapshot(run);
  assert.equal(selected.selected.id, 'east');
  assert.equal(selected.selected.state, 'exposed');
  assert.match(selected.description, /Relay 2 in the lower right/);
  assert.deepEqual(
    selected.selected.anchors.map((a) => [a.letter, a.relationship, a.captured]),
    [
      ['A', 'above and left', false],
      ['B', 'below and right', false],
    ],
  );
  const first = coopObjectivesSnapshot(run, 'west');
  assert.equal(first.selected.state, 'secured');
  assert.equal(first.selected.anchors[0].captured, true);
  assert.deepEqual(run, before);
  first.selected.core.x = 0;
  assert.equal(run.strongholds[0].core.x, 31.5, 'No borrowed geometry references');
  assert.equal(coopObjectivesSnapshot(authored).selected.state, 'shielded');
  assert.equal(coopObjectivesSnapshot(FIRST_CONNECTION).selected, null);
  assert.equal(coopObjectivesSnapshot(run, 'missing').selected.id, 'east');
});
test('magnified dense relay and whole-board locator retain positions and distinct bounded symbols', () => {
  const snapshot = coopObjectivesSnapshot(level()),
    before = structuredClone(snapshot),
    calls = [];
  const ctx = new Proxy(
    {},
    {
      get: (obj, key) => obj[key] || ((...args) => calls.push({ key, args })),
      set: (obj, key, value) => ((obj[key] = value), true),
    },
  );
  const canvas = { getContext: () => ctx };
  assert.equal(paintCoopObjectiveDiagram(canvas, snapshot), true);
  const symbols = calls
    .filter((c) => c.key === 'fillRect')
    .slice(1)
    .map((c) => c.args);
  assert.equal(symbols.length, 3);
  for (const [x, y, w, h] of symbols) assert.ok(x >= 0 && y >= 0 && x + w <= 600 && y + h <= 300);
  for (let i = 0; i < symbols.length; i++)
    for (let j = i + 1; j < symbols.length; j++) {
      const [x, y, w, h] = symbols[i],
        [a, b, c, d] = symbols[j];
      assert.ok(x + w <= a || a + c <= x || y + h <= b || b + d <= y);
    }
  assert.deepEqual(
    calls.filter((c) => c.key === 'fillText').map((c) => c.args[0]),
    ['A', 'B', '1'],
  );
  assert.equal(paintCoopObjectiveDiagram(canvas, snapshot, true), true);
  assert.equal(canvas.width, 360);
  assert.equal(canvas.height, 180);
  assert.deepEqual(snapshot, before);
  assert.equal(paintCoopObjectiveDiagram({ getContext: () => null }, snapshot), false);
});

test('required cores retain priority and optional strongholds do not become victory requirements', () => {
  const authored = level();
  authored.goal = { cores: ['east'] };
  const run = createCoop(authored),
    before = structuredClone(run);
  const goal = coopObjectivesSnapshot(run);
  assert.equal(goal.selected.id, 'east');
  assert.equal(goal.relays[0].required, false);
  assert.equal(goal.relays[1].required, true);
  assert.match(coopObjectivesSnapshot(run, 'west').description, /^Optional Relay 1/);
  assert.deepEqual(run, before);
  authored.goal = { coverage: 0.65 };
  const coverage = coopObjectivesSnapshot(createCoop(authored));
  assert.ok(coverage.relays.every((r) => !r.required));
  assert.match(coverage.summary, /^Optional Relay/);
});

test('all eight supported relays retain stable numbers and individual A/B states', () => {
  const authored = level();
  authored.strongholds = [10.5, 25.5]
    .flatMap((y) =>
      [10.5, 27.5, 44.5, 61.5].map((x) => ({
        core: { x, y },
        anchors: [
          { x: x - 4, y: y - 3 },
          { x: x + 4, y: y + 3 },
        ],
      })),
    )
    .map((s, index) => ({ ...s, id: `relay-${index + 1}` }));
  authored.goal = { cores: authored.strongholds.map((s) => s.id) };
  const run = createCoop(authored);
  run.strongholds[0].defeated = true;
  run.strongholds[0].anchors.forEach((a) => (a.captured = true));
  run.strongholds[1].shielded = false;
  run.strongholds[1].anchors.forEach((a) => (a.captured = true));
  run.strongholds[7].anchors[1].captured = true;
  const before = structuredClone(run),
    snapshot = coopObjectivesSnapshot(run);
  assert.deepEqual(
    snapshot.relays.map((r) => r.number),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
  assert.equal(snapshot.selected.id, 'relay-2');
  assert.equal(snapshot.selected.state, 'exposed');
  assert.deepEqual(
    snapshot.relays[7].anchors.map((a) => [a.letter, a.captured]),
    [
      ['A', false],
      ['B', true],
    ],
  );
  assert.match(snapshot.summary, /^1 \/ 8 secured/);
  assert.deepEqual(run, before);
});
