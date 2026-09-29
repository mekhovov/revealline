import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { FeedbackDirector } from '../ui/feedback-director.mjs';
import {
  distanceGain,
  screenPan,
  captureRecipe,
  materialProfile,
  MATERIAL_PROFILES,
} from '../ui/feedback-cues.mjs';
import { readMenuAudio } from '../ui/menu-audio.mjs';
import { EFFECT_BANK } from '../audio/effects/bank.mjs';
class Param {
  setValueAtTime(value) {
    this.value = value;
  }
  setTargetAtTime(value, time, constant) {
    this.value = value;
    this.constant = constant;
  }
}
class Node {
  constructor() {
    this.gain = new Param();
    this.pan = new Param();
    this.playbackRate = new Param();
  }
  connect(to) {
    this.to = to;
  }
  disconnect() {}
  start(time, offset) {
    this.offset = offset;
  }
  stop() {}
}
function harness() {
  const context = {
    currentTime: 1.25,
    state: 'running',
    createBufferSource: () => new Node(),
    createGain: () => new Node(),
    createStereoPanner: () => new Node(),
  };
  const sound = {
    context,
    enabled: true,
    paused: false,
    gameplayPaused: false,
    audioMaster: { muted: false },
    menuSettings: { enabled: true, volume: 0.35 },
    voices: new Set(),
    menuBus: {},
    sfxBus: {},
  };
  const director = new FeedbackDirector(sound);
  for (const name of Object.keys(EFFECT_BANK)) director.buffers.set(name, { duration: 1 });
  return { sound, director };
}
const run = () => ({
  width: 100,
  height: 100,
  tick: 0,
  time: 0,
  status: 'running',
  totalClaimable: 10000,
  cells: new Uint8Array(10000),
  player: { x: 10, y: 10, direction: 'right', speed: 1 },
  enemies: [{ id: 'enemy', type: 'bouncer', x: 20, y: 10 }],
  events: [],
});
test('attenuation matches design anchors, is monotonic, bounded and resolution independent', () => {
  assert.equal(distanceGain(8, 100), 1);
  assert.equal(distanceGain(25, 100), 10 ** (-6 / 20));
  assert.equal(distanceGain(60, 100), 0.1);
  assert.equal(distanceGain(80, 100), 0);
  let last = 1;
  for (let i = 0; i < 150; i++) {
    const g = distanceGain(i, 100);
    assert.ok(g <= last && g >= 0);
    assert.equal(g, distanceGain(i * 4, 400));
    last = g;
  }
  assert.equal(screenPan(100, 100), 0.6);
  assert.equal(screenPan(0, 100), -0.6);
  assert.equal(screenPan(50, 100, { left: 0.5, width: 0.5 }), 0.3);
});
test('capture tiers use unique new cells over claimable area', () => {
  const state = { cells: new Uint8Array(1000), totalClaimable: 500 };
  assert.equal(captureRecipe({ indices: [1, 1, -1, 2000] }, state).tier, 'small');
  assert.equal(
    captureRecipe({ indices: Array.from({ length: 10 }, (_, i) => i) }, state).tier,
    'medium',
  );
  assert.equal(
    captureRecipe({ indices: Array.from({ length: 40 }, (_, i) => i) }, state).duration,
    0.65,
  );
  for (const key of Object.keys(MATERIAL_PROFILES))
    assert.deepEqual(materialProfile({ id: key + '-actors-v1' }), MATERIAL_PROFILES[key]);
});
test('same events deduplicate within a run but not across boards; victory supersedes capture', () => {
  const { director, sound } = harness(),
    a = run(),
    b = run();
  const events = [{ type: 'cells.claimed', tick: 1, time: 1, indices: [1, 2] }];
  director.events(events, a, {});
  const count = sound.voices.size;
  director.events(events, a, {});
  assert.equal(sound.voices.size, count);
  director.events(events, b, {}, { board: 1 });
  assert.equal(sound.voices.size, count * 2);
  director.reset();
  director.events(
    [...events, { type: 'cut.closed', tick: 1 }, { type: 'run.completed', tick: 1, status: 'won' }],
    a,
    {},
  );
  assert.equal(sound.voices.size, 1);
});
test('enemy movement survives repeated render frames and stops on freeze and pause', () => {
  const { director, sound } = harness(),
    state = run();
  director.update(true, {}, state);
  state.tick++;
  state.enemies[0].x++;
  director.update(true, {}, state);
  const loop = director.boards.get('solo').loops.get('enemy:enemy');
  assert.ok(loop);
  director.update(true, {}, state);
  assert.equal(director.boards.get('solo').loops.get('enemy:enemy'), loop);
  assert.equal(loop.volume.gain.constant, 0.027);
  assert.equal(loop.source.offset, 0.25);
  state.tick++;
  state.enemies[0].stunnedUntil = 3;
  director.update(true, {}, state);
  assert.ok(loop.ended);
  director.update(false, {}, state);
  assert.equal(director.boards.get('solo').loops.size, 0);
  sound.gameplayPaused = true;
  assert.equal(director.play('warning'), null);
  assert.ok(director.play('focus', { ui: true }));
  sound.audioMaster.muted = true;
  assert.equal(director.play('focus', { ui: true }), null);
});
test('Versus voice budget is fair and urgent cues remain foreground at any distance', () => {
  const { director, sound } = harness();
  const boards = [run(), run()];
  for (let i = 0; i < 2; i++) {
    const r = boards[i];
    r.enemies = Array.from({ length: 8 }, (_, j) => ({ id: j, x: 12 + j, y: 10 }));
    director.update(true, {}, r, { board: i, mode: 'versus' });
    r.tick++;
    r.enemies.forEach((e) => e.x++);
    director.update(true, {}, r, { board: i, mode: 'versus' });
  }
  assert.equal(director.boards.get(0).loops.size, 2);
  assert.equal(director.boards.get(1).loops.size, 2);
  director.events([{ type: 'lineImpact.seeded', tick: 1, x: 99, y: 99 }], boards[0], {});
  const warning = [...sound.voices].at(-1);
  assert.equal(warning.priority, 5);
  assert.equal(warning.panner.pan.value, 0);
  assert.equal(warning.volume.gain.value, 0.55);
});
test('storage failures and malformed menu settings retain safe defaults', () => {
  assert.deepEqual(
    readMenuAudio({
      getItem() {
        throw new Error('denied');
      },
    }),
    { enabled: true, volume: 0.35 },
  );
  assert.deepEqual(readMenuAudio({ getItem: () => '{"enabled":false,"volume":0.2}' }), {
    enabled: false,
    volume: 0.2,
  });
  assert.deepEqual(readMenuAudio({ getItem: () => '{"enabled":true,"volume":100}' }), {
    enabled: true,
    volume: 0.35,
  });
});
test('bank assets match provenance and stay below transfer and decoded budgets', async () => {
  let bytes = 0,
    decoded = 0;
  for (const entry of Object.values(EFFECT_BANK)) {
    const data = await readFile(new URL(`../audio/effects/${entry.file}`, import.meta.url));
    assert.equal(data.length, entry.bytes);
    assert.equal(createHash('sha256').update(data).digest('hex'), entry.sha256);
    assert.equal(data.toString('ascii', 0, 4), 'RIFF');
    bytes += data.length;
    decoded += data.length * 2;
  }
  assert.ok(bytes <= 8 * 1024 * 1024);
  assert.ok(decoded <= 32 * 1024 * 1024);
});

test('Team shared source uses the nearest active player exactly once', () => {
  const { director } = harness(),
    state = run();
  state.players = [
    { id: 0, x: 0, y: 10, status: 'active' },
    { id: 1, x: 90, y: 10, status: 'active' },
  ];
  state.enemies[0].x = 89;
  director.update(true, {}, state, { mode: 'team' });
  state.tick++;
  state.enemies[0].x++;
  director.update(true, {}, state, { mode: 'team' });
  assert.equal(director.boards.get('solo').loops.size, 1);
  assert.equal(director.boards.get('solo').loops.get('enemy:enemy').volume.gain.value, 0.18);
  state.tick++;
  state.players[1].status = 'downed';
  state.enemies[0].x++;
  director.update(true, {}, state, { mode: 'team' });
  assert.equal(director.boards.get('solo').loops.size, 0);
});

test('captured terrain stops its zone source and erosion restores it without duplicate tiles', () => {
  const { director } = harness(),
    state = run();
  state.level = { classic: { terrain: [{ id: 'slow', x: 10, y: 10, w: 2, h: 2, kind: 'slow' }] } };
  director.update(true, {}, state);
  assert.ok(director.boards.get('solo').loops.has('terrain:slow'));
  const indices = [1010, 1011, 1110, 1111];
  indices.forEach((i) => (state.cells[i] = 1));
  state.tick++;
  director.update(true, {}, state);
  assert.ok(!director.boards.get('solo').loops.has('terrain:slow'));
  state.cells[1010] = 0;
  state.tick++;
  director.update(true, {}, state);
  assert.equal(
    [...director.boards.get('solo').loops.keys()].filter((k) => k.startsWith('terrain:')).length,
    1,
  );
});

test('blocked held direction sounds once and can sound after release and a fresh contact', () => {
  const { director, sound } = harness(),
    state = run();
  state.player = { x: 10.5, y: 10.5, direction: 'right', speed: 0 };
  state.cells[1011] = 2;
  const options = { command: { direction: 'right' }, silentStart: true };
  director.update(true, {}, state, options);
  const count = sound.voices.size;
  assert.equal(count, 1);
  state.tick++;
  director.update(true, {}, state, options);
  assert.equal(sound.voices.size, count);
  director.update(true, {}, state, { command: { direction: null }, silentStart: true });
  sound.context.currentTime++;
  state.tick++;
  director.update(true, {}, state, options);
  assert.equal(sound.voices.size, count + 1);
});

test('a decoded buffer becomes available for future events only, never replays a missed cue', async (t) => {
  const { director, sound } = harness();
  director.buffers.clear();
  const original = globalThis.fetch;
  t.after(() => (globalThis.fetch = original));
  let finish;
  sound.context.decodeAudioData = () => new Promise((resolve) => (finish = resolve));
  globalThis.fetch = async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(EFFECT_BANK.warning.bytes),
  });
  assert.equal(director.play('warning'), null);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sound.voices.size, 0);
  finish({ duration: 0.42 });
  await director.pending.get('warning');
  assert.equal(sound.voices.size, 0);
  assert.ok(director.play('warning'));
  director.reset();
  assert.equal(sound.voices.size, 0);
});
