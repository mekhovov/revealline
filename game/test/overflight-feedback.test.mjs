import test from 'node:test';
import assert from 'node:assert/strict';
import { createOverflightAudio } from '../overflight/audio.mjs';
import {
  createOverflightRun,
  startOverflight,
  stepOverflight,
  spawnOverflightEnemy,
  damageOverflightArea,
  overflightSummary,
} from '../overflight/core.mjs';
import { rebuildOverflightGrid } from '../overflight/grid.mjs';
import { DEFAULT_OVERFLIGHT_PROJECT, compileOverflightProject } from '../overflight/project.mjs';
import { OVERFLIGHT_DEFEAT_CAPACITY } from '../overflight/defeat-feed.mjs';
import { encounterSoundRecipe } from '../ui/encounter-audio.mjs';
import { audioHarness } from './helpers/soundtrack-audio.mjs';

const compiled = compileOverflightProject(DEFAULT_OVERFLIGHT_PROJECT);
const playing = (options = {}) => {
  const source = structuredClone(compiled);
  source.encounters = [];
  source.goals = { eliteAt: 10000, finalAt: 20000, finalHp: 2400 };
  const run = createOverflightRun(source, options);
  startOverflight(run);
  return run;
};
const spawn = (run, options = {}) =>
  spawnOverflightEnemy(run, { warning: 0, speed: 0, wardrobe: 1, ...options });

test('bounded defeat facts capture exact identities before slot reuse and never cap death rewards', () => {
  const run = playing();
  const records = run.defeats.records.slice();
  assert.equal(records.length, OVERFLIGHT_DEFEAT_CAPACITY);
  const originals = [];
  for (let index = 0; index < 700; index++) {
    const enemy = spawn(run, { x: 700 + (index % 40), y: 400, hp: 1 });
    originals.push({ id: enemy.id, x: enemy.x, y: enemy.y, heading: enemy.heading });
  }
  rebuildOverflightGrid(run._grid, run.enemies);
  assert.equal(damageOverflightArea(run, 720, 400, 100, 2), 700);
  assert.equal(run.stats.kills, 700);
  assert.equal(run.stats.xpEarned, 700);
  assert.equal(run.stats.xpOnGround, 700);
  assert.equal(run.defeats.sequence, 700);
  assert.equal(damageOverflightArea(run, 720, 400, 100, 2), 0);
  assert.equal(run.defeats.sequence, 700, 'one fact per accepted death');
  const finalFacts = run.defeats.records.map((record) => ({ ...record }));
  const sequences = finalFacts.map((record) => record.sequence).sort((a, b) => a - b);
  assert.deepEqual(
    sequences,
    Array.from({ length: 512 }, (_, index) => index + 189),
  );
  for (const fact of finalFacts) {
    const expected = originals.find((enemy) => enemy.id === fact.id);
    assert.equal(fact.x, expected.x);
    assert.equal(fact.y, expected.y);
    assert.equal(fact.heading, expected.heading);
    assert.equal(fact.family, 'patroller');
    assert.equal(fact.wardrobe, 1);
    assert.equal(fact.heavy, false);
    assert.equal(fact.specialist, false);
    assert.equal(fact.time, run.time);
    assert.equal(fact.tick, run.tick);
  }
  for (let index = 0; index < 700; index++) spawn(run, { x: 2000, y: 900 });
  assert.deepEqual(run.defeats.records, finalFacts, 'new bodies never mutate retained facts');
  assert.ok(run.defeats.records.every((record, index) => record === records[index]));
  const cue = run.events.find((event) => event.type === 'defeat');
  assert.equal(cue.count, 700);
  assert.ok(Math.abs(cue.x - originals.reduce((sum, enemy) => sum + enemy.x, 0) / 700) < 1e-8);
  assert.equal(cue.y, 400);
});

test('fixtures never fabricate deaths and cosmetic consumption leaves gameplay and RNG identical', () => {
  const fixture = createOverflightRun(compiled, { fixture: 'reference' });
  startOverflight(fixture);
  const enemy = fixture.enemies.find((entry) => entry.active);
  enemy.warning = 0;
  rebuildOverflightGrid(fixture._grid, fixture.enemies);
  damageOverflightArea(fixture, enemy.x, enemy.y, 10, 100000);
  assert.ok(fixture.stats.fixtureDefeats > 0);
  assert.equal(fixture.defeats.sequence, 0);
  const a = playing(),
    b = playing();
  for (const run of [a, b]) {
    spawn(run, { x: run.player.x - 28, y: run.player.y, hp: 1 });
  }
  for (let tick = 0; tick < 100; tick++) {
    stepOverflight(a, { x: 1 });
    stepOverflight(b, { x: 1 });
    // A renderer can copy, replace, or omit every cosmetic record. It does not
    // feed simulation queries, pools, pickups, director decisions or RNG.
    for (const fact of b.defeats.records) {
      fact.x = 0;
      fact.family = '';
    }
  }
  assert.ok(a.stats.kills > 0);
  assert.deepEqual(overflightSummary(a), overflightSummary(b));
  assert.equal(a._randomState, b._randomState);
  assert.equal(a._draftRandomState, b._draftRandomState);
  assert.deepEqual(a.player, b.player);
  assert.deepEqual(a.enemies, b.enemies);
});

test('every added semantic audio cue resolves to a native recipe and bounded spatial mix', () => {
  const heard = [],
    menu = [];
  const sound = {
    encounter: (type, details) => heard.push({ type, details }),
    publishedCue: (cue) => menu.push(cue),
    event: (event) => {
      assert.equal(event.ui, true);
      menu.push(event.won ? 'victory' : 'failure');
    },
    feedbackDirector: { reset() {} },
  };
  const audio = createOverflightAudio(sound, { getDestruction: () => ({ brutal: true }) });
  const run = {
    tick: 1,
    phase: 'playing',
    player: { x: 100 },
    events: [
      { type: 'boost', x: 100 },
      { type: 'arrival', x: 2000 },
      { type: 'defeat', x: -1000 },
      { type: 'defeat', x: -900 },
      { type: 'salvage', x: 100 },
      { type: 'upgrade', x: 100 },
    ],
  };
  audio.update(run);
  audio.update(run);
  assert.deepEqual(
    heard.map((row) => row.type),
    ['burst', 'warning', 'catch', 'supply', 'objective'],
  );
  for (const row of heard) {
    assert.ok(encounterSoundRecipe(row.type, row.details));
    assert.equal(row.details.brutal, true);
    assert.ok(Math.abs(row.details.pan) <= 1);
  }
  assert.equal(heard.find((row) => row.type === 'catch').details.pan, -1);
  assert.equal(heard.find((row) => row.type === 'warning').details.pan, 1);
  assert.equal(
    encounterSoundRecipe('catch', { material: 'soft' }).priority,
    3,
    'ordinary deaths must not repeatedly interrupt dialogue like damage warnings',
  );
  run.events = [{ type: 'reroll' }, { type: 'reroll' }];
  run.phase = 'upgrade';
  audio.update(run);
  assert.deepEqual(menu, ['confirm']);
  run.progression = { rerolls: 1 };
  audio.update(run);
  assert.deepEqual(menu, ['confirm', 'confirm'], 'a second accepted same-tick reroll is audible');
  run.tick++;
  run.phase = 'won';
  run.events = [{ type: 'defeat' }, { type: 'final' }, { type: 'won' }, { type: 'won' }];
  audio.update(run);
  audio.update(run);
  assert.equal(heard.length, 6, 'the final destruction is heard before the terminal motif');
  assert.equal(heard.at(-1).type, 'catch');
  assert.deepEqual(menu, ['confirm', 'confirm', 'victory']);
  audio.reset();
  run.phase = 'lost';
  run.events = [{ type: 'lost' }];
  audio.update(run);
  assert.equal(menu.at(-1), 'failure');
});

test('upgrade and result motifs survive gameplay pause but obey gesture unlock, menu and master preferences', async (t) => {
  const h = audioHarness();
  const sound = h.soundscape;
  const connections = [],
    gain = h.context.createGain;
  h.context.createGain = () => {
    const node = gain();
    node.connect = (target) => connections.push(target);
    return node;
  };
  t.after(() => sound.dispose());
  const audio = createOverflightAudio(sound);
  const run = { tick: 1, player: { x: 0 }, events: [{ type: 'upgrade-ready' }] };
  audio.prepare();
  audio.update(run);
  assert.equal(h.sources.length, 0);
  assert.equal(sound.context, null, 'presentation preparation never unlocks audio');
  await sound.enable();
  // Exercise the real effect-bank delivery once its native clip is decoded.
  for (const name of ['confirm', 'confirm-1', 'confirm-2'])
    sound.feedbackDirector.buffers.set(name, { duration: 0.1 });
  run.tick++;
  audio.update(run);
  sound.pause();
  assert.ok([...sound.voices].some((voice) => voice.bus === 'menu'));
  sound.stopVoices();
  connections.length = 0;
  run.tick++;
  run.events = [{ type: 'won' }];
  audio.update(run);
  assert.ok([...sound.voices].some((voice) => voice.bus === 'menu'));
  assert.ok(connections.includes(sound.menuBus));
  assert.ok(
    !connections.includes(sound.sfxBus),
    'procedural result notes really route through menu volume',
  );
  sound.stopVoices();
  sound.menuSettings = { enabled: false, volume: 1 };
  const before = h.sources.length;
  run.tick++;
  audio.update(run);
  assert.equal(h.sources.length, before);
  sound.menuSettings = { enabled: true, volume: 1 };
  sound.audioMaster = { muted: true, volume: 1 };
  run.tick++;
  audio.update(run);
  assert.equal(h.sources.length, before);
  sound.audioMaster = { muted: false, volume: 0 };
  run.tick++;
  audio.update(run);
  assert.equal(h.sources.length, before);
  sound.audioMaster = { muted: false, volume: 1 };
  sound.event({ type: 'cells.claimed', ui: true });
  assert.equal(h.sources.length, before, 'arbitrary gameplay events cannot bypass pause');
  sound.suspend();
  run.tick++;
  audio.update(run);
  assert.equal(h.sources.length, before, 'result UI cannot bypass full lifecycle suspension');
});

test('explicit result dialogue bypasses only gameplay pause, retaining gesture, full pause and preference gates', async (t) => {
  const { soundscape: sound, sources } = audioHarness();
  t.after(() => sound.dispose());
  sound.configureDialogue({ enabled: true, volume: 0.5 });
  const buffer = { duration: 1 };
  assert.equal(sound.playDialogue(buffer, { ui: true }), null);
  await sound.enable();
  sound.pause();
  assert.equal(sound.playDialogue(buffer), null);
  assert.equal(sound.playDialogue(buffer, { ui: 'true' }), null);
  const voice = sound.playDialogue(buffer, { ui: true });
  assert.ok(voice);
  sound.suspend();
  assert.equal(voice.ended, true);
  assert.equal(sound.playDialogue(buffer, { ui: true }), null);
  await sound.resume();
  sound.pause();
  sound.configureDialogue({ enabled: false });
  assert.equal(sound.playDialogue(buffer, { ui: true }), null);
  sound.configureDialogue({ enabled: true, volume: 0 });
  assert.equal(sound.playDialogue(buffer, { ui: true }), null);
  sound.configureDialogue({ volume: 1 });
  sound.audioMaster = { muted: true, volume: 1 };
  assert.equal(sound.playDialogue(buffer, { ui: true }), null);
  sound.audioMaster = { muted: false, volume: 0 };
  assert.equal(sound.playDialogue(buffer, { ui: true }), null);
  const before = sources.length;
  sound.disable();
  assert.equal(sound.playDialogue(buffer, { ui: true }), null);
  assert.equal(sources.length, before);
});
