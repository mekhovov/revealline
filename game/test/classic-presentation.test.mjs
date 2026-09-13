import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRun, stepRun, FIXED_DT, CLASSES, CELL } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { BoardPainter } from '../ui/render.mjs';
import {
  classicView,
  drawClassicEnemy,
  drawClassicPickups,
  drawClassicStatus,
} from '../ui/classic-view.mjs';
import { encounterView, drawEncounterLane } from '../ui/encounter-view.mjs';
import {
  editorScenario,
  entryScenario,
  prepareDocument,
  expansionFromScenario,
  withScenarioMastery,
  withScenarioEncounter,
  withoutScenarioEncounter,
  interactionPreset,
} from '../playground/model.mjs';
import { preparePack, resolvePackCampaign, emptyPackLibrary } from '../packs.mjs';
import { validateScenario, CLASSIC_VISUAL_ROLES } from '../content.mjs';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const themes = read('../content/themes.json').themes;
const presets = read('../../authoring/motion-lab/presets.json');
function level() {
  return {
    version: 'xonix-level.v4',
    id: 'classic-presentation',
    revision: '1',
    name: 'Classic cues',
    width: 72,
    height: 36,
    encounter: null,
    spawn: { x: 60.5, y: 0.5 },
    goal: { coverage: 0.15 },
    enemies: [
      { id: 'seed', type: 'bouncer', x: 20.5, y: 18.5, vx: 0, vy: 0 },
      {
        id: 'contour',
        type: 'contour-patrol',
        edge: { x: 1, y: 1, side: 'north' },
        clockwise: true,
        speed: 0,
        radius: 0.2,
      },
      { id: 'rover', type: 'claimed-rover', x: 65.5, y: 12.5, vx: 0, vy: 0, radius: 0.2 },
      { id: 'eroder', type: 'eroder', x: 10.5, y: 12.5, vx: 0, vy: 0, radius: 0.2 },
    ],
    objectives: [{ id: 'east', x: 65.5, y: 15.5, required: true }],
    classic: {
      version: 'classic.v1',
      terrain: [
        { id: 'slow-ground', kind: 'slow', x: 59, y: 10, w: 3, h: 2 },
        { id: 'danger-ground', kind: 'lethal', x: 66, y: 20, w: 2, h: 2 },
      ],
      powerups: ['extra-life', 'player-speed', 'enemy-slow', 'enemy-freeze'].map((kind, i) => ({
        id: `power-${i}`,
        kind,
        x: 60.5,
        y: 1.5 + i,
      })),
    },
  };
}
function scenario(source = level()) {
  return editorScenario({
    format: 'xonix-playground.v5',
    masteryDefinition: null,
    level: source,
    theme: themes[0],
    classRecipes: CLASSES,
    settings: { classId: 'scout', seed: 1, turnPolicy: 'immediate' },
    visualOverrides: {},
  });
}
// Canvas commands are observed; these tests make no raster, layout or device claim.
function canvas() {
  const calls = [],
    stack = [],
    values = { fillStyle: '', strokeStyle: '', globalAlpha: 1 };
  const surface = { width: 1152, height: 576, calls };
  const ctx = new Proxy(
    { canvas: surface },
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
  return { calls, ctx };
}
function painter(theme = themes[0]) {
  const p = new BoardPainter(presets);
  p.theme = theme;
  p.body = presets.characters['neutral-marker'];
  p.recipe = presets.animationRecipes[p.body.animationRecipe];
  p.background = { width: 384, height: 288 };
  return p;
}
function until(run, predicate, input = {}) {
  for (let i = 0; !predicate(); i++) {
    assert.ok(i < 1500 && !['won', 'lost'].includes(run.status));
    stepRun(run, input, FIXED_DT);
  }
}

test('classic projection is bounded, owned and getter-free, and never invents cues on old or malformed runs', () => {
  const run = createRun(level()),
    before = authoritativeCheckpoint(run),
    view = classicView(run);
  assert.equal(view.powerups.length, 4);
  assert.equal(view.terrain.length, 10);
  assert.equal(view.enemies.find((e) => e.type === 'claimed-rover').mode, 'dormant');
  assert.ok(Object.isFrozen(view.powerups[0]));
  assert.throws(() => {
    view.powerups[0].x = 1;
  });
  assert.deepEqual(authoritativeCheckpoint(run), before);
  let reads = 0;
  const bad = structuredClone(run);
  Object.defineProperty(bad.classic.effects, 'enemy-freeze', {
    get() {
      reads++;
      return {};
    },
  });
  assert.equal(classicView(bad), null);
  const old = {
    ruleset: 'xonix-core.v4',
    get classic() {
      reads++;
      return run.classic;
    },
  };
  assert.equal(classicView(old), null);
  assert.equal(classicView({ ...run, width: 48 }), null);
  assert.equal(classicView({ ...run, enemies: new Array(25) }), null);
  assert.equal(
    classicView({ ...run, classic: { ...run.classic, terrain: new Uint8Array(1) } }),
    null,
  );
  assert.equal(classicView(null), null);
  assert.equal(reads, 0);
  // A shadowed typed-array length is never evaluated by the guard.
  Object.defineProperty(run.cells, 'length', {
    get() {
      reads++;
      return 1;
    },
  });
  assert.equal(classicView(run).powerups.length, 4);
  assert.equal(reads, 0);
});

for (const turnPolicy of ['immediate', 'grid-center'])
  test(`${turnPolicy}: actual contact pickups appear from FIELD, activate next tick, and expire on simulation clocks`, () => {
    const run = createRun(level(), { turnPolicy });
    assert.ok(
      classicView(run).powerups.every(
        (p) => run.cells[Math.floor(p.y) * 72 + Math.floor(p.x)] === CELL.FIELD,
      ),
    );
    const pending = [];
    until(run, () => run.classic.powerups.every((p) => p.collectedTick !== null), {
      direction: 'down',
    });
    assert.equal(run.lives, 4);
    const view = classicView(run);
    assert.equal(view.powerups.length, 0);
    assert.equal(view.effects.find((e) => e.kind === 'enemy-freeze').phase, 'pending');
    pending.push(view);
    stepRun(run, {}, FIXED_DT);
    const active = classicView(run);
    assert.equal(active.effects.find((e) => e.kind === 'enemy-freeze').phase, 'active');
    assert.ok(active.enemies.every((e) => e.frozen && !e.slowed));
    assert.equal(active.effects.find((e) => e.kind === 'enemy-freeze').seconds, 3);
    const frozenClock = active.actorTime;
    const checkpoint = authoritativeCheckpoint(run),
      surface = canvas(),
      p = painter();
    for (const reduced of [false, true]) p.draw(surface.ctx, run, 0.1, { paused: true, reduced });
    assert.deepEqual(classicView(run), active);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    stepRun(run, {}, FIXED_DT);
    assert.equal(classicView(run).actorTime, frozenClock);
    until(run, () => run.tick === run.classic.effects['enemy-freeze'].until);
    const after = classicView(run);
    assert.equal(
      after.effects.some((e) => e.kind === 'enemy-freeze'),
      false,
    );
    assert.ok(after.enemies.every((e) => !e.frozen && e.slowed));
    assert.equal(pending[0].effects.find((e) => e.kind === 'enemy-freeze').phase, 'pending');
  });

test('opaque art concealment precedes distinct terrain; reduced motion preserves four icons and new actor silhouettes', () => {
  const run = createRun(level()),
    before = authoritativeCheckpoint(run),
    view = classicView(run);
  for (const theme of themes) {
    const { ctx, calls } = canvas();
    painter(theme).draw(ctx, run, 0, { paused: true, reduced: true });
    const masks = calls
      .map((call, i) => ({ ...call, i }))
      .filter((c) => c.op === 'fillRect' && c.fillStyle === '#000000');
    assert.equal(masks.length, 34);
    assert.ok(masks.every((c) => c.globalAlpha === 1));
    const danger = calls.findIndex(
      (c) =>
        c.op === 'strokeRect' &&
        c.strokeStyle === theme.palette.danger &&
        c.args[0] === 1057.5 &&
        c.args[1] === 321.5,
    );
    assert.ok(danger > masks.at(-1).i);
    assert.ok(
      calls.some(
        (c) =>
          c.op === 'moveTo' &&
          c.strokeStyle === theme.palette.safe &&
          c.args[0] === 946 &&
          c.args[1] === 165,
      ),
    );
    assert.equal(
      calls.filter(
        (c) =>
          c.op === 'fillRect' &&
          c.fillStyle === theme.palette.ink &&
          c.args.join() === '-8,-8,16,16',
      ).length,
      4,
    );
    const signatures = view.enemies
      .filter((e) => ['contour-patrol', 'claimed-rover', 'eroder'].includes(e.type))
      .map((enemy) => {
        const surface = canvas();
        assert.equal(drawClassicEnemy(surface.ctx, enemy, theme.palette), true);
        return JSON.stringify(
          surface.calls.filter((c) => !['save', 'restore', 'translate'].includes(c.op)),
        );
      });
    assert.equal(new Set(signatures).size, 3);
    assert.equal(drawClassicEnemy(ctx, view.enemies[0], theme.palette), false);
  }
  assert.deepEqual(authoritativeCheckpoint(run), before);
});

test('legal enclosure removes active material only from captured cells; earned full picture hides all functional overlays', () => {
  const run = createRun(level());
  until(run, () => run.status === 'won', { direction: 'down' });
  const view = classicView(run);
  assert.deepEqual(
    view.terrain.map((c) => [c.x, c.y]),
    [
      [59, 10],
      [59, 11],
    ],
  );
  assert.equal(
    run.classic.terrain[20 * 72 + 66],
    2,
    'Material stays authoritative beneath earned SAFE',
  );
  assert.equal(view.effects.length, 0, 'Terminal presentation offers no live timer');
  const before = authoritativeCheckpoint(run),
    { ctx, calls } = canvas();
  painter().draw(ctx, run, 0, { paused: true, reduced: true, fullReveal: true });
  assert.deepEqual(
    calls.filter((c) => c.op === 'fillRect').map((c) => c.args),
    [[0, 0, 1152, 576]],
  );
  assert.equal(
    calls.some((c) => c.op === 'fillText'),
    false,
  );
  assert.deepEqual(authoritativeCheckpoint(run), before);
});

test('warning cells and status badges use owned cues, palette colors and finite actor-clock time', () => {
  const run = createRun(level());
  until(run, () => run.classic.powerups.every((p) => p.collectedTick !== null), {
    direction: 'down',
  });
  stepRun(run, {}, FIXED_DT);
  const view = classicView(run),
    { ctx, calls } = canvas(),
    before = authoritativeCheckpoint(run);
  drawClassicStatus(ctx, view, themes[0].palette);
  assert.equal(calls.filter((c) => c.op === 'fillText').length, 3);
  assert.ok(calls.some((c) => c.op === 'strokeRect' && c.args.join() === '-14,-14,28,28'));
  assert.deepEqual(authoritativeCheckpoint(run), before);
  // A detached projection tests warning painting only, not how erosion is earned.
  calls.length = 0;
  drawClassicPickups(
    ctx,
    { powerups: [], erosion: [{ id: 'eroder', x: 67, y: 24, seconds: 0.5 }] },
    themes[0].palette,
  );
  assert.deepEqual(calls.find((c) => c.op === 'strokeRect').args, [1073, 385, 14, 14]);
});

test('classic encounter countdown and lane suppression follow actual frozen actor clock, while world time advances', () => {
  const source = read('../content/packs/sentinel-relay.json').campaigns[0].levels[0];
  source.version = 'xonix-level.v4';
  source.width = 72;
  source.spawn = { x: 6.5, y: 0.5 };
  source.classic = {
    version: 'classic.v1',
    terrain: [],
    powerups: [{ id: 'freeze', kind: 'enemy-freeze', x: 7.5, y: 0.5 }],
  };
  const run = createRun(source);
  until(run, () => run.encounter.phase === 'warning');
  until(run, () => run.classic.powerups[0].collectedTick !== null, { direction: 'right' });
  stepRun(run, {}, FIXED_DT);
  const view = encounterView(run),
    tick = run.tick,
    actorTick = run.classic.actorTick;
  assert.equal(view.suppressed, true);
  assert.match(view.instruction, /freeze holds/);
  for (let n = 0; n < 12; n++) stepRun(run, {}, FIXED_DT);
  assert.equal(run.tick, tick + 12);
  assert.equal(run.classic.actorTick, actorTick);
  assert.equal(encounterView(run).seconds, view.seconds);
  const { ctx, calls } = canvas(),
    before = authoritativeCheckpoint(run);
  drawEncounterLane(ctx, run, themes[0].palette);
  assert.equal(calls.find((c) => c.op === 'fillRect').fillStyle, themes[0].palette.muted);
  assert.deepEqual(authoritativeCheckpoint(run), before);
});

test('classic editor imports, scenario edits and exported pack reimports retain exact v5 descriptors and owned input', async () => {
  const current = scenario(),
    before = structuredClone(current),
    library = emptyPackLibrary();
  const exported = expansionFromScenario(current, { id: 'classic-editor-test' });
  assert.equal(exported.format, 'xonix-pack.v5');
  assert.equal(exported.engine, 'xonix-core.v5');
  assert.deepEqual(exported.masteries, []);
  const imported = await prepareDocument(exported, { current, packLibrary: library });
  assert.equal(imported.kind, 'expansion');
  assert.equal(imported.scenario.format, 'xonix-playground.v5');
  assert.deepEqual(imported.scenario.level.classic, current.level.classic);
  assert.deepEqual(
    (await prepareDocument(current, { current, packLibrary: library })).scenario,
    current,
  );
  assert.deepEqual(
    (await prepareDocument(current.level, { current, packLibrary: library })).scenario.level,
    current.level,
  );
  assert.deepEqual(withScenarioMastery(current, null), current);
  assert.throws(() => withScenarioMastery(current, {}), /optional goals/);
  const pack = (await preparePack(exported)).pack,
    entry = resolvePackCampaign(pack, pack.campaigns[0].id);
  assert.deepEqual(entryScenario(entry).level.classic, current.level.classic);
  assert.equal(interactionPreset('fiber', current).level.version, 'xonix-level.v1');
  assert.equal(interactionPreset('fiber', current).format, 'xonix-playground.v2');
  assert.deepEqual(current, before);
});

test('classic encounter edits and explicit legacy imports keep separate version families', async () => {
  const source = read('../content/packs/sentinel-relay.json').campaigns[0].levels[0];
  source.version = 'xonix-level.v4';
  source.width = 72;
  source.classic = { version: 'classic.v1', terrain: [], powerups: [] };
  const current = scenario(source),
    edited = withScenarioEncounter(current, { ...source.encounter, initialDelayTicks: 300 });
  assert.equal(edited.level.version, 'xonix-level.v4');
  assert.equal(edited.format, 'xonix-playground.v5');
  assert.deepEqual(edited.level.classic, source.classic);
  const ordinary = withoutScenarioEncounter(edited);
  assert.equal(ordinary.level.encounter, null);
  assert.equal(ordinary.level.version, 'xonix-level.v4');
  assert.equal(validateScenario(ordinary).valid, true);
  for (const [packPath, format] of [
    ['../content/packs/night-shift.json', 'xonix-playground.v1'],
    ['../content/packs/sentinel-relay.json', 'xonix-playground.v3'],
    ['../content/packs/fpv-arcade.json', 'xonix-playground.v4'],
  ]) {
    // Geometry/model dispatch only: the in-memory fixture omits picture sidecars.
    // No header adapter is presented as an actual browser image decode.
    const raw = read(packPath);
    raw.visualOverrides = {};
    raw.levelVisuals = [];
    const pack = (await preparePack(raw)).pack;
    const entry = resolvePackCampaign(pack, pack.campaigns[0].id),
      old = entryScenario(entry);
    assert.equal(old.format, format);
    assert.equal(Object.hasOwn(old.level, 'classic'), false);
    const restored = await prepareDocument(old.level, { current, packLibrary: emptyPackLibrary() });
    assert.equal(restored.scenario.level.version, old.level.version);
    assert.equal(Object.hasOwn(restored.scenario.level, 'classic'), false);
    if (format === 'xonix-playground.v1') {
      const mastery = withScenarioMastery(old, null);
      assert.equal(mastery.format, 'xonix-playground.v2');
      assert.deepEqual(
        (await prepareDocument(mastery, { current, packLibrary: emptyPackLibrary() })).scenario,
        mastery,
      );
    }
  }
});

test('the actual Classic Lab imports all nine practice recipes and exports their exact descriptors', async () => {
  const raw = read('../content/packs/classic-lab.json'),
    before = structuredClone(raw);
  const imported = await prepareDocument(raw, {
    current: scenario(),
    packLibrary: emptyPackLibrary(),
  });
  assert.equal(imported.kind, 'expansion');
  const entry = imported.entries.find((item) => item.sourcePackId === raw.id);
  assert.equal(entry.campaign.levels.length, 9);
  for (const level of entry.campaign.levels) {
    const selected = entryScenario(entry, level.id);
    assert.equal(selected.format, 'xonix-playground.v5');
    assert.equal(
      createRun(selected.level, { classRecipes: selected.classRecipes, ...selected.settings })
        .ruleset,
      'xonix-core.v5',
    );
    for (const theme of raw.themes)
      assert.equal(validateScenario({ ...selected, theme }).valid, true);
    const exported = expansionFromScenario(selected);
    const returned = await prepareDocument(exported, {
      current: selected,
      packLibrary: emptyPackLibrary(),
    });
    assert.deepEqual(returned.scenario.level.classic, level.classic);
    assert.deepEqual(returned.scenario.level.enemies, level.enemies);
  }
  assert.deepEqual(raw, before);
});

test('Classic artwork roles dispatch independently without removing material, contact and status cues', () => {
  const run = createRun(level()),
    before = authoritativeCheckpoint(run),
    p = painter();
  p.images = Object.fromEntries(CLASSIC_VISUAL_ROLES.map((role) => [role, { role }]));
  const { ctx, calls } = canvas();
  p.draw(ctx, run, 0, { paused: true, reduced: true });
  const drawn = calls.filter((call) => call.op === 'drawImage' && call.args[0]?.role);
  assert.deepEqual(new Set(drawn.map((call) => call.args[0].role)), new Set(CLASSIC_VISUAL_ROLES));
  assert.equal(drawn.filter((call) => call.args[0].role === 'slowTerrain').length, 6);
  assert.equal(drawn.filter((call) => call.args[0].role === 'lethalTerrain').length, 4);
  for (const call of drawn) assert.ok(call.args.slice(1).every(Number.isFinite));
  const lethal = drawn.find((call) => call.args[0].role === 'lethalTerrain');
  assert.ok(
    calls
      .slice(calls.indexOf(lethal) + 1)
      .some((call) => call.op === 'strokeRect' && call.strokeStyle === themes[0].palette.danger),
  );
  assert.equal(calls.filter((call) => call.op === 'arc' && call.args[2] === 0.2 * 16).length, 3);
  assert.ok(
    calls.some((call) => call.op === 'strokeRect' && call.args.join() === '-12,-11,24,22'),
    'Dormant rover cue survives replacement',
  );
  // Detached projection tests warning presentation, not acquisition of a warning.
  const warning = canvas();
  drawClassicEnemy(
    warning.ctx,
    {
      ...classicView(run).enemies.find((enemy) => enemy.type === 'claimed-rover'),
      mode: 'warning',
    },
    themes[0].palette,
    p.images,
  );
  assert.ok(
    warning.calls.some((call) => call.op === 'strokeRect' && call.args.join() === '-13,-13,26,26'),
  );
  until(run, () => run.status === 'won', { direction: 'down' });
  calls.length = 0;
  p.draw(ctx, run, 0, { fullReveal: true, paused: true, reduced: true });
  assert.equal(
    calls.some((call) => call.op === 'drawImage' && call.args[0]?.role),
    false,
  );
  assert.notDeepEqual(authoritativeCheckpoint(run), before, 'Only the real simulation advanced');
});

test('explicit legacy replacements discard only Classic bindings while the original and shared artwork stay owned', async () => {
  const current = scenario();
  const dataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
  current.visualOverrides = Object.fromEntries(
    ['background', ...CLASSIC_VISUAL_ROLES].map((role) => [role, { dataUrl, name: role }]),
  );
  const before = structuredClone(current),
    preset = interactionPreset('fiber', current);
  assert.deepEqual(Object.keys(preset.visualOverrides), ['background']);
  for (const file of ['night-shift', 'sentinel-relay', 'fpv-arcade']) {
    const legacy = read(`../content/packs/${file}.json`).campaigns[0].levels[0];
    const restored = await prepareDocument(legacy, {
      current,
      packLibrary: emptyPackLibrary(),
      decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }),
    });
    assert.deepEqual(restored.scenario.visualOverrides, {
      background: before.visualOverrides.background,
    });
  }
  preset.visualOverrides.background.name = 'Detached edit';
  assert.deepEqual(current, before);
});
