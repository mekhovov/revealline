import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRun, stepRun, FIXED_DT, CLASSES } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { BoardPainter, boardPaintSizeForLevel, boardPaintSizeForRun } from '../ui/render.mjs';
import { drawEncounterLane } from '../ui/encounter-view.mjs';
import { paintEditorMap, editorCellFromPointer } from '../playground/board-view.mjs';
import {
  editorScenario,
  entryScenario,
  paintLevel,
  prepareDocument,
  expansionFromScenario,
  withScenarioMastery,
  withScenarioEncounter,
  withoutScenarioEncounter,
  interactionPreset,
} from '../playground/model.mjs';
import { validateScenario } from '../content.mjs';
import { emptyPackLibrary, exportPackLibrary } from '../packs.mjs';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const themes = read('../content/themes.json').themes;
const presets = read('../../authoring/motion-lab/presets.json');
const sentinel = read('../content/packs/sentinel-relay.json').campaigns[0].levels[0];
function level(wide = true) {
  return {
    version: wide ? 'xonix-level.v3' : 'xonix-level.v1',
    id: wide ? 'wide-paint' : 'legacy-paint',
    name: 'Paint geometry',
    revision: '1',
    width: wide ? 72 : 48,
    height: 36,
    ...(wide ? { encounter: null } : {}),
    spawn: { x: wide ? 60.5 : 36.5, y: 0.5 },
    enemies: [{ id: 'seed', type: 'bouncer', x: 12.5, y: 18.5, vx: 0, vy: 0 }],
    walls: [],
    supplies: [],
    objectives: [],
    goal: { coverage: 0.1 },
  };
}
function scenario(source = level()) {
  return editorScenario({
    format: source.version === 'xonix-level.v3' ? 'xonix-playground.v4' : 'xonix-playground.v1',
    ...(source.version === 'xonix-level.v3' ? { masteryDefinition: null } : {}),
    level: source,
    theme: themes[0],
    settings: { classId: 'scout', seed: 1, turnPolicy: 'immediate' },
    classRecipes: CLASSES,
    visualOverrides: {},
  });
}
// Record actual Canvas2D commands and paint state. No raster/browser layout claim.
function canvas() {
  const calls = [],
    stack = [],
    values = { fillStyle: '', strokeStyle: '', globalAlpha: 1 };
  const result = { width: 0, height: 0, calls };
  const ctx = new Proxy(
    { canvas: result },
    {
      get(target, key) {
        if (key in target) return target[key];
        if (key in values) return values[key];
        return (...args) => {
          calls.push({ op: key, args, ...values });
          if (key === 'save') stack.push({ ...values });
          if (key === 'restore') Object.assign(values, stack.pop());
        };
      },
      set(_target, key, value) {
        values[key] = value;
        return true;
      },
    },
  );
  result.getContext = () => ctx;
  return result;
}
function painter() {
  const p = new BoardPainter(presets);
  p.theme = themes[0];
  p.body = presets.characters['neutral-marker'];
  p.recipe = presets.animationRecipes[p.body.animationRecipe];
  p.background = { width: 384, height: 288 };
  return p;
}

test('paint sizes are owned per edition; mismatched geometry cannot become a render scale', () => {
  const a = level(false),
    b = level();
  assert.deepEqual(boardPaintSizeForLevel(a), { width: 768, height: 576, cellSize: 16 });
  assert.deepEqual(boardPaintSizeForRun(createRun(b)), { width: 1152, height: 576, cellSize: 16 });
  const size = boardPaintSizeForLevel(b);
  size.width = 1;
  assert.equal(boardPaintSizeForLevel(b).width, 1152);
  assert.throws(() => boardPaintSizeForLevel({ ...b, width: 48 }), /dimensions/);
  assert.throws(() => boardPaintSizeForRun({ ...createRun(a), width: 72 }), /dimensions/);
});

for (const wide of [false, true])
  for (const turnPolicy of ['immediate', 'grid-center'])
    test(`${wide ? 'wide' : 'legacy'} ${turnPolicy}: actual masks span every column, then a legal win fully reveals without resizing cells`, () => {
      const run = createRun(level(wide), { turnPolicy }),
        p = painter(),
        surface = canvas();
      const width = run.width * 16,
        checkpoint = authoritativeCheckpoint(run);
      p.draw(surface.getContext(), run, 0, { paused: true, showGrid: true });
      assert.deepEqual(surface.calls.find((c) => c.op === 'clearRect').args, [0, 0, width, 576]);
      const masks = surface.calls.filter((c) => c.op === 'fillRect' && c.fillStyle === '#000000');
      assert.equal(masks.length, 34);
      for (let y = 1; y <= 34; y++)
        assert.deepEqual(masks[y - 1].args, [16, y * 16, width - 32, 16]);
      assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
      const gridEnd = surface.calls
        .filter((c) => c.op === 'lineTo')
        .some((c) => c.args[0] === width && c.args[1] === 560);
      assert.equal(gridEnd, true);
      while (run.status === 'running') {
        assert.ok(run.tick < 600);
        stepRun(run, { direction: 'down' }, FIXED_DT);
      }
      assert.equal(run.status, 'won');
      const won = authoritativeCheckpoint(run);
      surface.calls.length = 0;
      p.draw(surface.getContext(), run, 0, { paused: true, reduced: true, fullReveal: true });
      assert.deepEqual(
        surface.calls.filter((c) => c.op === 'fillRect').map((c) => c.args),
        [[0, 0, width, 576]],
      );
      assert.deepEqual(authoritativeCheckpoint(run), won);
      // An interleaved old board retains its own width even after this painter drew a wide win.
      surface.calls.length = 0;
      p.draw(surface.getContext(), createRun(level(false)), 0, { paused: true });
      assert.deepEqual(surface.calls.find((c) => c.op === 'clearRect').args, [0, 0, 768, 576]);
    });

test('wide staged warning clips and hatches to the complete1120-pixel interior, without mutating the run', () => {
  const source = { ...structuredClone(sentinel), version: 'xonix-level.v3', width: 72 };
  const run = createRun(source),
    surface = canvas();
  for (let n = 0; n < 241; n++) stepRun(run, {}, FIXED_DT);
  assert.equal(run.encounter.phase, 'warning');
  const before = authoritativeCheckpoint(run);
  drawEncounterLane(surface.getContext(), run, themes[0].palette);
  assert.deepEqual(surface.calls.find((c) => c.op === 'rect').args, [16, 16, 1120, 544]);
  assert.equal(surface.calls.find((c) => c.op === 'fillRect').args[2], 1120);
  assert.ok(surface.calls.filter((c) => c.op === 'moveTo').some((c) => c.args[0] > 768));
  assert.deepEqual(authoritativeCheckpoint(run), before);
});

test('wide wall, actor, objective, signal and live-cut drawing retain16-pixel cells beyond the old edge', () => {
  const source = level();
  source.walls = [{ x: 68, y: 30, w: 1, h: 1 }];
  source.enemies.push({ id: 'east', type: 'bouncer', x: 66.5, y: 10.5, vx: 0, vy: 0 });
  source.objectives = [{ id: 'relay', x: 69.5, y: 29.5, required: true }];
  source.supplies = [{ id: 'pad', x: 70.5, y: 31.5 }];
  source.signalZones = [{ id: 'zone', x: 65, y: 7, w: 6, h: 2, speedFactor: 0.5 }];
  const run = createRun(source),
    surface = canvas(),
    p = painter();
  for (let i = 0; i < 12; i++) stepRun(run, { direction: 'down' }, FIXED_DT);
  assert.equal(run.player.cutting, true);
  const before = authoritativeCheckpoint(run);
  p.draw(surface.getContext(), run, 0, { paused: true, reduced: true });
  for (const [op, args] of [
    ['fillRect', [1088, 480, 16, 16]],
    ['translate', [1064, 168]],
    ['translate', [1112, 472]],
    ['fillRect', [1040, 112, 96, 32]],
    ['strokeRect', [1121, 497, 14, 14]],
    ['fillRect', [960, 16, 16, 16]],
  ])
    assert.ok(
      surface.calls.some(
        (call) => call.op === op && JSON.stringify(call.args) === JSON.stringify(args),
      ),
      `${op} ${args}`,
    );
  assert.deepEqual(authoritativeCheckpoint(run), before);
});

test('editor canvas and pointer use the same edition, including scaled borders and the last legal cell', () => {
  const surface = canvas();
  for (const wide of [true, false, true]) {
    const current = scenario(level(wide)),
      before = structuredClone(current);
    paintEditorMap(surface, current);
    assert.equal(surface.width, current.level.width * 16);
    assert.equal(surface.height, 576);
    assert.ok(
      surface.calls.some(
        (c) => c.op === 'fillRect' && c.args[0] === surface.width - 16 && c.args[2] === 16,
      ),
    );
    // 50% CSS scale, one CSS-pixel border before scaling, and nonzero page position.
    const rectCanvas = {
      offsetWidth: surface.width + 2,
      offsetHeight: 578,
      clientWidth: surface.width,
      clientHeight: 576,
      clientLeft: 1,
      clientTop: 1,
      getBoundingClientRect: () => ({
        left: 20,
        top: 30,
        width: (surface.width + 2) / 2,
        height: 289,
      }),
    };
    assert.deepEqual(editorCellFromPointer(current.level, rectCanvas, 24.5, 34.5), { x: 0, y: 0 });
    assert.deepEqual(
      editorCellFromPointer(
        current.level,
        rectCanvas,
        20.5 + (current.level.width - 0.5) * 8,
        30.5 + 35.5 * 8,
      ),
      { x: current.level.width - 1, y: 35 },
    );
    for (const [x, y] of [
      [20, 35],
      [20.5 + surface.width / 2, 35],
      [24.5, 318.5],
      [NaN, 35],
    ])
      assert.equal(editorCellFromPointer(current.level, rectCanvas, x, y), null);
    assert.deepEqual(current, before);
  }
});

test('wide editor imports, paints east-side objects and exports explicit v4 scenarios/packs without changing old inputs', async () => {
  const original = scenario(),
    old = scenario(level(false)),
    before = structuredClone(original);
  const library = emptyPackLibrary();
  let edited = { ...original, level: paintLevel(original.level, 'wall', 68, 30) };
  edited = { ...edited, level: paintLevel(edited.level, 'signal', 69, 32) };
  edited = { ...edited, level: paintLevel(edited.level, 'spawn', 71, 10) };
  assert.deepEqual(edited.level.signalZones[0], {
    id: 'signal-1',
    x: 69,
    y: 32,
    w: 2,
    h: 3,
    speedFactor: 0.5,
    disableBoost: true,
    lockAbility: true,
  });
  assert.throws(() => paintLevel(old.level, 'wall', 68, 30), /coordinates/);
  assert.throws(() => paintLevel(edited.level, 'wall', 72, 30), /coordinates/);
  const exported = expansionFromScenario(edited);
  assert.equal(exported.format, 'xonix-pack.v4');
  assert.equal(exported.engine, 'xonix-core.v4');
  assert.deepEqual(exported.masteries, []);
  const prepared = await prepareDocument(exported, { current: old, packLibrary: library });
  assert.equal(prepared.kind, 'expansion');
  assert.equal(prepared.scenario.format, 'xonix-playground.v4');
  assert.equal(prepared.scenario.masteryDefinition, null);
  assert.deepEqual(prepared.scenario.level, edited.level);
  const selected = entryScenario(prepared.entries[0], edited.level.id, {
    classId: 'fiber',
    turnPolicy: 'grid-center',
    seed: 17,
  });
  assert.equal(selected.settings.turnPolicy, 'grid-center');
  assert.equal(createRun(selected.level, selected.settings).width, 72);
  for (const raw of [edited, edited.level]) {
    const result = await prepareDocument(raw, { current: old, packLibrary: library });
    assert.equal(result.scenario.format, 'xonix-playground.v4');
    assert.equal(validateScenario(result.scenario).valid, true);
  }
  const roundtrip = await prepareDocument(exportPackLibrary(prepared.packLibrary), {
    current: old,
    packLibrary: library,
  });
  assert.deepEqual(roundtrip.scenario, prepared.scenario);
  assert.deepEqual(original, before);
  assert.equal(library.packs.length, 0);
  assert.throws(() => withScenarioMastery(edited, {}), /masteryDefinition:null/);
  assert.equal(withScenarioMastery(edited, null).format, 'xonix-playground.v4');
  const legacyAgain = await prepareDocument(old.level, { current: edited, packLibrary: library });
  assert.equal(legacyAgain.scenario.format, 'xonix-playground.v2');
  assert.equal(legacyAgain.scenario.level.width, 48);
  assert.equal(interactionPreset('fiber', edited).format, 'xonix-playground.v2');
});

test('editing or removing a wide staged recipe preserves its wide edition and validates references atomically', () => {
  const current = scenario({ ...structuredClone(sentinel), version: 'xonix-level.v3', width: 72 });
  const before = structuredClone(current);
  const changed = withScenarioEncounter(current, {
    ...current.level.encounter,
    initialDelayTicks: 300,
  });
  assert.equal(changed.format, 'xonix-playground.v4');
  assert.equal(changed.level.version, 'xonix-level.v3');
  assert.equal(changed.level.encounter.initialDelayTicks, 300);
  const ordinary = withoutScenarioEncounter(changed);
  assert.equal(ordinary.level.encounter, null);
  assert.equal(ordinary.level.width, 72);
  assert.equal(ordinary.format, 'xonix-playground.v4');
  assert.equal(
    ordinary.level.enemies.some((e) => e.type === 'relay-sentinel'),
    false,
  );
  assert.deepEqual(expansionFromScenario(ordinary).masteries, []);
  assert.throws(() =>
    withScenarioEncounter(current, { ...current.level.encounter, coreObjectiveId: 'missing' }),
  );
  assert.deepEqual(current, before);
});
