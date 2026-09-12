import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  prepareDocument,
  entryScenario,
  interactionPreset,
  paintLevel,
  expansionFromScenario,
} from '../playground/model.mjs';
import {
  emptyPackLibrary,
  preparePack,
  installPack,
  exportPackLibrary,
  validatePack,
} from '../packs.mjs';
import { validateScenario } from '../content.mjs';
import { createRun, stepRun, FIXED_DT, CLASSES } from '../core/index.mjs';
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const baseCampaign = read('../content/campaign.json'),
  themes = read('../content/themes.json').themes;
const entry = {
  campaign: baseCampaign,
  themes,
  classRecipes: CLASSES,
  visualOverrides: {},
  levelVisuals: [],
  music: [],
};
const current = () => entryScenario(entry);
const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
const decoder = async () => ({ naturalWidth: 1, naturalHeight: 1 });
const pack = () => read('../content/packs/night-shift.json');
test('scenario, loose level, expansion and expansion-library imports share one prepared workflow', async () => {
  const original = current(),
    before = structuredClone(original),
    library = emptyPackLibrary();
  for (const value of [original, original.level]) {
    const prepared = await prepareDocument(value, { current: original, packLibrary: library });
    assert.equal(prepared.kind, 'scenario');
    assert.equal(validateScenario(prepared.scenario).valid, true);
  }
  const full = await prepareDocument(pack(), { current: original, packLibrary: library });
  assert.equal(full.kind, 'expansion');
  assert.equal(full.entries.length, 1);
  assert.equal(full.scenario.music.genre, 'metal');
  assert.equal(full.entries[0].campaign.levels.length, 3);
  const roundtrip = await prepareDocument(exportPackLibrary(full.packLibrary), {
    current: original,
    packLibrary: library,
  });
  assert.deepEqual(roundtrip.scenario, full.scenario);
  assert.equal(library.packs.length, 0);
  assert.deepEqual(original, before);
});
test('campaign selection retains per-map theme, recipe roster, music and image roles', async () => {
  const source = pack();
  source.visualOverrides.player = { dataUrl: png, name: 'body.png' };
  source.levelVisuals = [
    {
      levelId: source.campaigns[0].levels[1].id,
      visualOverrides: { background: { dataUrl: png, name: 'map-two.png' } },
    },
  ];
  source.campaigns[0].classIds = ['fiber', 'bomber'];
  const prepared = await prepareDocument(source, {
    current: current(),
    packLibrary: emptyPackLibrary(),
    decodeImage: decoder,
  });
  const second = entryScenario(prepared.entries[0], source.campaigns[0].levels[1].id, {
    classId: 'impact',
    turnPolicy: 'grid-center',
    seed: 45,
  });
  assert.equal(second.settings.classId, 'bomber'); // Registry order is stable; authored subset order is not an ability priority.
  assert.equal(second.settings.seed, 45);
  assert.equal(second.settings.turnPolicy, 'grid-center');
  assert.equal(second.visualOverrides.background.name, 'map-two.png');
  assert.equal(second.visualOverrides.player.name, 'body.png');
  assert.equal(second.music.tempo, 144);
});
test('failed decode and malformed library imports cannot replace current scenario or prepared catalog', async () => {
  const source = pack();
  source.visualOverrides.background = { dataUrl: png };
  const state = { current: current(), packLibrary: emptyPackLibrary() };
  let active = state;
  await assert.rejects(
    (async () => {
      const prepared = await prepareDocument(source, {
        ...state,
        decodeImage: async () => {
          throw new Error('Broken image');
        },
      });
      active = prepared;
    })(),
    /Broken/,
  );
  assert.equal(active, state);
  await assert.rejects(
    prepareDocument({ format: 'xonix-pack-library.v1', packs: [] }, state),
    /no campaigns/,
  );
  const malicious = JSON.parse('{"format":"xonix-pack.v1","__proto__":{}}');
  await assert.rejects(prepareDocument(malicious, state), /Forbidden/);
});
test('import snapshots candidate data before decoding and returns an entire previous-state-independent replacement', async () => {
  const source = pack();
  source.visualOverrides.player = { dataUrl: png };
  let resolve;
  const pending = prepareDocument(source, {
    current: current(),
    packLibrary: emptyPackLibrary(),
    decodeImage: () => new Promise((done) => (resolve = done)),
  });
  source.themes[0].name = 'Changed while decoding';
  source.campaigns[0].levels[0].name = 'Changed map';
  resolve({ naturalWidth: 1, naturalHeight: 1 });
  const prepared = await pending;
  assert.notEqual(prepared.scenario.level.name, 'Changed map');
  assert.notEqual(prepared.scenario.theme.name, 'Changed while decoding');
});
test('signal and hangar brushes preserve unrelated authored arrays and reject invalid painting atomically', () => {
  const base = current().level;
  base.editorNotes = ['preserve me'];
  const before = structuredClone(base);
  const signal = paintLevel(base, 'signal', 44, 32, {
    signalWidth: 8,
    signalHeight: 6,
    speedFactor: 0.4,
  });
  assert.deepEqual(signal.editorNotes, base.editorNotes);
  assert.deepEqual(signal.signalZones.at(-1), {
    id: 'signal-1',
    x: 44,
    y: 32,
    w: 3,
    h: 3,
    speedFactor: 0.4,
    disableBoost: true,
    lockAbility: true,
  });
  assert.deepEqual(base, before);
  const hanger = paintLevel(base, 'hangar', 1, 0);
  assert.ok(hanger.hangars.some((h) => h.x === 24.5));
  assert.ok(hanger.hangars.some((h) => h.x === 1.5));
  const erased = paintLevel(signal, 'erase', 45, 33);
  assert.equal(erased.signalZones.length, 0);
  const noHangars = paintLevel(base, 'erase', 24, 0);
  assert.deepEqual(noHangars.hangars, []);
  assert.throws(() => paintLevel(base, 'signal', 0, 0), /valid area/);
  assert.throws(() => paintLevel(base, 'signal', 2, 2, { speedFactor: 0 }), /speedFactor/);
  const wall = paintLevel(base, 'wall', 3, 3);
  assert.throws(() => paintLevel(wall, 'wall', 3, 3), /overlaps/);
  assert.equal(wall.walls.length, 1);
});
test('interaction presets validate under both steering policies and retain the current art and theme', () => {
  for (const kind of ['fiber', 'bomber', 'impact'])
    for (const turnPolicy of ['immediate', 'grid-center']) {
      const original = current();
      original.settings.turnPolicy = turnPolicy;
      original.visualOverrides.player = { dataUrl: png };
      const preset = interactionPreset(kind, original);
      assert.equal(validateScenario(preset).valid, true);
      assert.deepEqual(preset.theme, original.theme);
      assert.deepEqual(preset.visualOverrides, original.visualOverrides);
      assert.equal(preset.settings.classId, kind);
      assert.equal(preset.settings.turnPolicy, turnPolicy);
      assert.notEqual(original.level.id, preset.level.id);
    }
});
test('fiber preset demonstrates actual resistance while a scout suffers the same field', () => {
  const scenario = interactionPreset('fiber', current());
  const fiber = createRun(scenario.level, { classId: 'fiber' }),
    scout = createRun(scenario.level, { classId: 'scout' });
  for (let i = 0; i < 120; i++) {
    stepRun(fiber, { direction: 'down' }, FIXED_DT);
    stepRun(scout, { direction: 'down' }, FIXED_DT);
  }
  assert.equal(fiber.signal.resistant, true);
  assert.equal(fiber.signal.speedFactor, 1);
  assert.equal(scout.signal.speedFactor, 0.4);
  assert.ok(fiber.player.y > scout.player.y);
  assert.ok(fiber.trail.length > 0);
});
test('bomber and impact presets expose their real supply, stun and redeployment interactions', () => {
  const bomberScenario = interactionPreset('bomber', current()),
    bomber = createRun(bomberScenario.level, { classId: 'bomber' });
  stepRun(bomber, { pickup: true }, FIXED_DT);
  assert.equal(bomber.ability.ammo, 1);
  for (let i = 0; i < 20; i++) stepRun(bomber, { direction: 'down' }, FIXED_DT);
  stepRun(bomber, { action: true }, FIXED_DT);
  assert.equal(bomber.ability.ammo, 0);
  assert.ok(bomber.enemies[0].stunnedUntil > bomber.time);
  const impactScenario = interactionPreset('impact', current()),
    impact = createRun(impactScenario.level, { classId: 'impact' });
  for (let i = 0; i < 20; i++) stepRun(impact, { direction: 'down' }, FIXED_DT);
  assert.ok(impact.trail.length > 0);
  stepRun(impact, { action: true }, FIXED_DT);
  assert.equal(impact.status, 'respawning');
  assert.equal(impact.lives, 3);
  assert.equal(impact.trail.length, 0);
  assert.equal(impact.coverage, 0);
  assert.ok(impact.enemies[0].stunnedUntil > impact.time);
});
test('edited scenario exports as a complete installable expansion with its exact optional procedural track', async () => {
  const prepared = await prepareDocument(pack(), {
    current: current(),
    packLibrary: emptyPackLibrary(),
  });
  const edited = interactionPreset('fiber', prepared.scenario);
  const candidate = expansionFromScenario(edited);
  assert.equal(validatePack(candidate).valid, true);
  assert.equal(candidate.campaigns[0].levels.length, 1);
  assert.equal(candidate.music[0].tempo, 144);
  assert.equal(candidate.campaigns[0].levels[0].signalZones.length, 1);
  const ready = await preparePack(candidate);
  const installed = installPack(emptyPackLibrary(), ready.pack);
  assert.equal(installed.packs.length, 1);
  assert.equal(prepared.packLibrary.packs[0].campaigns[0].levels.length, 3);
});
