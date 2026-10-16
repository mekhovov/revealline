import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { captureOverlay } from '../content-design/capture-overlay.mjs';
import { paintContentMap } from '../content-design/map-view.mjs';
import { createRoverCandidates } from '../content-design/rover-candidates.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { readFile } from 'node:fs/promises';

test('Studio overlay projects exact occupied regions, hypothetical trail and affected objectives without changing the candidate', () => {
  const source = createOpeningCandidates();
  source.missions[0].objectives = [
    { id: 'left-objective', x: 12.5, y: 12.5, required: false, hidden: false },
  ];
  const original = structuredClone(source);
  const initial = prepareContentPreview(source, 'first-return');
  const x = Math.floor(initial.manifest.level.spawn.x);
  const trailCells = Array.from({ length: 34 }, (_, y) => (y + 1) * 72 + x);
  const preview = prepareContentPreview(source, 'first-return', { trailCells });
  const overlay = captureOverlay(preview);
  assert.deepEqual(
    overlay.cells.flatMap((state, cell) => (state === 'trail' ? [cell] : [])),
    trailCells,
  );
  assert.deepEqual(
    overlay.cells.flatMap((state, cell) => (state === 'would-fill' ? [cell] : [])),
    [...preview.capture.filledCells].sort((a, b) => a - b),
  );
  assert(overlay.actors.every((actor) => actor.anchor));
  assert.equal(overlay.objectives[0].affected, true);
  assert.match(overlay.summary, /1 retained regions, 1 would-fill regions/);
  assert.match(overlay.summary, /left-objective/);
  assert.match(overlay.summary, /Snapshot only.*moving enemies/);
  assert.deepEqual(source, original);
  assert.equal(initial.capture.securedTrail.length, 0);
});

test('enemies on both sides remain visible anchors and a line-only inspection fills neither region', () => {
  const source = createOpeningCandidates();
  const preview = prepareContentPreview(source, 'two-keepers', {
    trailCells: Array.from({ length: 34 }, (_, y) => (y + 1) * 72 + 35),
  });
  const overlay = captureOverlay(preview);
  assert.equal(preview.capture.lineOnly, true);
  assert.equal(overlay.actors.filter((actor) => actor.anchor).length, 2);
  assert.equal(overlay.cells.includes('would-fill'), false);
  assert.match(overlay.summary, /2 retained regions, 0 would-fill regions/);
});

test('remote unoccupied chambers appear as would-fill even without an entered hypothetical trail', () => {
  const source = createOpeningCandidates();
  source.maps[0].walls = [{ x: 36, y: 1, w: 1, h: 34 }];
  const preview = prepareContentPreview(source, 'first-return');
  const overlay = captureOverlay(preview);
  assert(preview.capture.filledCells.length > 0);
  assert.equal(overlay.cells[10 * 72 + 10], 'would-fill');
  assert.equal(overlay.cells[10 * 72 + 36], null, 'walls cannot become return or fill ground');
  assert.equal(overlay.cells.includes('trail'), false);
});

test('map rendering has patterned capture cues, uses finite engine positions and can hide overlays', () => {
  const preview = prepareContentPreview(createOpeningCandidates(), 'first-return', {
    trailCells: Array.from({ length: 34 }, (_, y) => (y + 1) * 72 + 24),
  });
  const calls = [];
  const ctx = new Proxy(
    {},
    {
      get:
        (_target, method) =>
        (...args) => {
          assert(args.every((value) => typeof value !== 'number' || Number.isFinite(value)));
          calls.push([method, ...args]);
        },
    },
  );
  const before = structuredClone(preview);
  assert.match(paintContentMap(ctx, preview), /Frozen snapshot/);
  assert(
    calls.some(([method]) => method === 'lineTo'),
    'would-fill has a hatch, not color alone',
  );
  assert(
    calls.some(([method]) => method === 'strokeRect'),
    'hypothetical trail has outlines',
  );
  calls.length = 0;
  paintContentMap(ctx, preview, { showCapture: false });
  assert.equal(
    calls.some(([method]) => method === 'lineTo'),
    false,
  );
  assert.equal(
    calls.some(([method]) => method === 'strokeRect'),
    false,
  );
  assert.deepEqual(preview, before);
});

test('patrol markers use engine-resolved geometry and never claim field retention', () => {
  const source = createStarterProject();
  source.missions[0].actors.push(
    { id: 'outer', role: 'perimeter-patrol', tier: 'measured', x: 10.5, y: 0.5, clockwise: true },
    {
      id: 'frontier',
      role: 'frontier-patrol',
      tier: 'measured',
      edge: { x: 29, y: 17, side: 'east' },
      clockwise: true,
    },
  );
  const preview = prepareContentPreview(source, 'nearby-shore');
  const overlay = captureOverlay(preview);
  for (const actor of overlay.actors) {
    assert(Number.isFinite(actor.x) && Number.isFinite(actor.y), actor.id);
    assert.equal(actor.anchor, actor.type === 'bouncer', actor.id);
  }
  const ctx = new Proxy(
    {},
    {
      get:
        () =>
        (...args) => {
          assert(args.every((n) => typeof n !== 'number' || Number.isFinite(n)));
        },
    },
  );
  paintContentMap(ctx, preview);
  assert.equal(
    preview.manifest.level.enemies.find((e) => e.id === 'frontier').x,
    undefined,
    'Authored contour edges remain distinct from resolved runtime marker positions',
  );
});

test('Studio gives reclaimed roamers a tracked-square marker without a field-retention ring', () => {
  const preview = prepareContentPreview(createRoverCandidates(), 'wake-the-yard');
  const overlay = captureOverlay(preview);
  const roamer = overlay.actors.find((actor) => actor.type === 'claimed-rover');
  assert.equal(roamer.anchor, false);
  const calls = [];
  const ctx = new Proxy(
    {},
    {
      get:
        (_target, method) =>
        (...args) =>
          calls.push([method, ...args]),
    },
  );
  paintContentMap(ctx, preview, { showCapture: false });
  const radius = 14 * 0.45,
    x = roamer.x * 14,
    y = roamer.y * 14;
  assert.deepEqual(
    calls.filter(([method]) => method === 'rect'),
    [
      ['rect', x - radius * 0.7, y - radius * 0.65, radius * 1.4, radius * 1.3],
      ['rect', x - radius, y - radius, radius * 0.3, radius * 2],
      ['rect', x + radius * 0.7, y - radius, radius * 0.3, radius * 2],
    ],
  );
});

test('capture labels translate while cell ownership, canonical snapshots and canvas geometry stay identical', () => {
  const previous = getLocale();
  const source = createOpeningCandidates();
  const preview = prepareContentPreview(source, 'first-return', {
    trailCells: Array.from({ length: 34 }, (_, y) => (y + 1) * 72 + 24),
  });
  // Optional features expose the same inspected identifiers; labels never rename them.
  preview.capture.affectedGateIds = ['gate-one'];
  preview.capture.reservedGateCells = [40, 41];
  preview.capture.affectedCombatIds = ['optional-actor'];
  preview.markers.actors[0].inactive = true;
  const original = structuredClone(preview);
  const sourceBytes = JSON.stringify(source);
  const calls = [];
  const ctx = new Proxy(
    {},
    {
      get:
        (_target, method) =>
        (...args) =>
          calls.push([method, ...args]),
    },
  );
  try {
    setLocale('en', { persist: false });
    const english = captureOverlay(preview);
    paintContentMap(ctx, preview);
    const geometry = calls.filter(([method]) => method !== 'fillText');
    assert(calls.some(([method, text]) => method === 'fillText' && text === 'OFF'));
    for (const locale of ['uk', 'en', 'uk']) {
      calls.length = 0;
      setLocale(locale, { persist: false });
      const view = captureOverlay(preview);
      assert.deepEqual(view.cells, english.cells);
      assert.deepEqual(view.actors, english.actors);
      assert.deepEqual(view.objectives, english.objectives);
      assert.equal(paintContentMap(ctx, preview), view.summary);
      assert.deepEqual(
        calls.filter(([method]) => method !== 'fillText'),
        geometry,
      );
      if (locale === 'uk') {
        assert.match(view.summary, /^Зафіксований стан/);
        assert.match(view.summary, /Брами, які відкриються: gate-one\. 2 зарезервовані клітини/);
        assert.match(view.summary, /Необов’язкові об’єкти, які буде вилучено: optional-actor/);
        assert.match(view.summary, /рух ворогів може змінити результат/);
        assert.doesNotMatch(view.summary, /Frozen|Snapshot|none|Would/);
        assert(calls.some(([method, text]) => method === 'fillText' && text === 'ВИМК.'));
      } else assert.equal(view.summary, english.summary);
      assert.deepEqual(preview, original);
      assert.equal(JSON.stringify(source), sourceBytes);
    }
  } finally {
    setLocale(previous, { persist: false });
  }
});

test('the Studio locale hook repaints the accepted map without inspecting or rendering the draft', async () => {
  const host = await readFile(new URL('../studio/studio.mjs', import.meta.url), 'utf8');
  const callback = host.slice(host.indexOf('const stopMapLocale'), host.indexOf('function draw'));
  assert.match(callback, /if \(paintedPreview\) draw\(paintedPreview\)/);
  assert.doesNotMatch(callback, /inspectBoard|render\(|session|prepareContentPreview|queueSave/);
  assert.match(host, /if \(!mission\) \{\s*paintedPreview = null;/);
  const disposal = host.slice(host.indexOf("window.addEventListener('pagehide'"));
  assert.match(
    disposal,
    /if \(!event\.persisted\) \{[^}]*stopMapLocale\(\);[^}]*paintedPreview = null;/,
  );
  assert.match(
    disposal,
    /if \(!event\.persisted\) \{[^}]*stopGameplayTuning\(\);[^}]*gameplayTuning\.dispose\(\);/,
  );
});
