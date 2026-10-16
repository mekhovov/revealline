import test from 'node:test';
import assert from 'node:assert/strict';
import { audioHarness } from './helpers/soundtrack-audio.mjs';
import { createAudioMaster } from '../ui/audio-master.mjs';
import { Soundscape } from '../ui/audio.mjs';

async function setup(t, { partial = true } = {}) {
  const { context, sources } = audioHarness();
  const master = createAudioMaster({ muted: false, volume: 1 });
  const sound = new Soundscape({
    contextFactory: () => context,
    persistentMusic: true,
    audioMaster: master,
  });
  // A failed/partial recording bank is a legitimate offline state. Keep the real
  // event director, note construction, buses and authority; model only Web Audio.
  sound.feedbackDirector.prepare = () => {};
  sound.feedbackDirector.load = () => {};
  await sound.enable();
  if (partial) sound.feedbackDirector.buffers.set('focus', { duration: 0.1 });
  t.after(async () => {
    await sound.dispose();
    master.dispose();
  });
  return { sound, context, sources, master };
}
const run = () => ({
  width: 40,
  height: 30,
  status: 'running',
  tick: 1,
  time: 1 / 60,
  cells: new Uint8Array(1200),
  totalClaimable: 1200,
  players: [
    { id: 0, x: 6, y: 5 },
    { id: 1, x: 34, y: 5 },
  ],
  enemies: [],
});

for (const partial of [false, true])
  test(`${partial ? 'partial' : 'empty'} recording bank retains Team expedition cues`, async (t) => {
    const { sound, context, sources } = await setup(t, { partial });
    const events = [
      { type: 'emitter.warning', source: 'signal-1' },
      { type: 'player.downed', player: 1 },
      { type: 'support.pulse', player: 0 },
      { type: 'rescue.completed', player: 0, target: 1 },
      { type: 'objective.captured', stronghold: 'stage-1', kind: 'stage' },
      { type: 'shield.disabled', stronghold: 'relay-1' },
      { type: 'environment.eroded', source: 'erosion-1', cells: [41] },
      { type: 'run.completed', status: 'lost' },
    ];
    for (const event of events) {
      context.currentTime += 1;
      sound.stopVoices();
      const state = run();
      const before = sources.length;
      sound.events([{ ...event, tick: 1, time: 1 }], state, {}, { mode: 'team', board: 'team' });
      assert.ok(sources.length > before, `${event.type} must have immediate output`);
      assert.ok(
        [...sound.voices].every((voice) => voice.board === 'team'),
        event.type,
      );
      sound.events([{ ...event, tick: 1, time: 1 }], state, {}, { mode: 'team', board: 'team' });
      assert.equal(sources.length, before + sound.voices.size, 'render repetition is silent');
    }
  });

test('unavailable Duel effects retain both board owners and do not replay when decoding finishes', async (t) => {
  const { sound, context, sources } = await setup(t);
  const states = [run(), run()];
  const event = { type: 'cells.claimed', tick: 1, time: 1, indices: [41, 42] };
  for (let board = 0; board < 2; board++)
    sound.events(
      [event],
      states[board],
      {},
      {
        mode: 'versus',
        board,
        placement: { left: board / 2, width: 0.5 },
      },
    );
  assert.equal(sources.length, 6, 'each board receives its three-note capture');
  assert.deepEqual([...new Set([...sound.voices].map((voice) => voice.board))], [0, 1]);
  sound.feedbackDirector.buffers.set('reveal-small', { duration: 0.1 });
  context.currentTime += 1;
  for (let board = 0; board < 2; board++)
    sound.events([event], states[board], {}, { mode: 'versus', board });
  assert.equal(sources.length, 6, 'late decode cannot replay an accepted event');
});

test('urgent fallback interrupts dialogue and remains bounded for repeated simultaneous emitters', async (t) => {
  const { sound, sources } = await setup(t);
  let retired = 0,
    dialogueStopped = 0;
  sound.voices.add({
    feedback: true,
    movement: true,
    priority: 0,
    stop() {
      retired++;
      sound.voices.delete(this);
    },
  });
  sound.voices.add({
    dialogue: true,
    priority: 1,
    stop() {
      dialogueStopped++;
      sound.voices.delete(this);
    },
  });
  const state = run();
  sound.events(
    Array.from({ length: 100 }, (_, index) => ({
      type: 'emitter.warning',
      tick: 1,
      time: 1,
      source: `emitter-${index}`,
    })),
    state,
    {},
    { mode: 'team', board: 'team' },
  );
  assert.ok(sources.length > 0 && sources.length <= 2);
  assert.equal(retired, 1);
  assert.equal(dialogueStopped, 1);
  assert.ok([...sound.voices].every((voice) => voice.priority === 5));
});

test('muted, zero-volume and paused events expire without replay while music-only pause keeps warnings', async (t) => {
  const { sound, sources, master } = await setup(t);
  const state = run();
  let tick = 1;
  const dispatch = () =>
    sound.events(
      [{ type: 'emitter.warning', tick: tick++, time: tick }],
      state,
      {},
      { mode: 'team' },
    );
  master.setMuted(true);
  dispatch();
  master.setMuted(false);
  master.setVolume(0);
  dispatch();
  master.setVolume(1);
  sound.gameplayPaused = true;
  dispatch();
  assert.equal(sources.length, 0);
  sound.gameplayPaused = false;
  sound.pauseMusic();
  dispatch();
  assert.ok(sources.length > 0);
  assert.equal(sound.musicTransportPaused, true);
});

test('decoded Team cue cooldown cannot fall through to procedural duplication', async (t) => {
  const { sound, sources } = await setup(t);
  sound.feedbackDirector.buffers.set('warning', { duration: 0.1 });
  const state = run();
  sound.events([{ type: 'emitter.warning', tick: 1, time: 1 }], state, {}, { mode: 'team' });
  sound.events([{ type: 'emitter.warning', tick: 2, time: 2 }], state, {}, { mode: 'team' });
  assert.equal(sources.length, 1);
});

test('one Team rescue emits one recovery phrase despite both native completion events', async (t) => {
  const { sound, sources } = await setup(t);
  sound.events(
    [
      { type: 'player.revived', player: 1, tick: 1, time: 1 },
      { type: 'rescue.completed', player: 0, target: 1, tick: 1, time: 1 },
    ],
    run(),
    {},
    { mode: 'team', board: 'team' },
  );
  assert.equal(sources.length, 4, 'one rising recovery phrase');
});

test('partially decoded variations use a ready rendition without duplicate fallback', async (t) => {
  const { sound, sources, context } = await setup(t);
  sound.feedbackDirector.buffers.set('pickup-1', { duration: 0.1 });
  sound.events([{ type: 'objective.captured', tick: 1, time: 1 }], run(), {}, { mode: 'team' });
  assert.equal(sources.length, 1);
  assert.equal([...sound.voices][0].name, 'pickup-1');
  context.currentTime += 0.1;
  sound.events([{ type: 'objective.captured', tick: 2, time: 2 }], run(), {}, { mode: 'team' });
  assert.equal(sources.length, 1, 'a denied recorded cooldown never falls through');
});

test('decoded cues at zero master volume expire instead of resurfacing after volume restoration', async (t) => {
  const { sound, sources, master } = await setup(t);
  sound.feedbackDirector.buffers.set('warning', { duration: 0.4 });
  master.setVolume(0);
  const snapshot = run(),
    events = [{ type: 'emitter.warning', tick: 1, time: 1 }];
  sound.events(events, snapshot, {}, { mode: 'team' });
  assert.equal(sources.length, 0, 'silent master does not retain a new one-shot');
  master.setVolume(1);
  sound.events(events, snapshot, {}, { mode: 'team' });
  assert.equal(sources.length, 0, 'restoring volume cannot replay the expired warning');
});

const overlappingTeamEvents = () =>
  [
    'support.pulse',
    'rescue.completed',
    'shield.disabled',
    'objective.captured',
    'environment.eroded',
    'enemy.commit',
    'cells.claimed',
    'enemy.recovery',
  ].map((type) => ({ type, tick: 1, time: 1, player: 0, indices: [41, 42] }));

test('simultaneous Team fallback phrases reserve feedback headroom for warnings and preserve music', async (t) => {
  const { sound, sources } = await setup(t);
  sound.events(overlappingTeamEvents(), run(), {}, { mode: 'team', board: 'team' });
  assert.equal(
    sound.voices.size,
    16,
    'the eight-event transaction cannot exceed feedback headroom',
  );
  const beforeWarning = sources.length;
  sound.events(
    [{ type: 'emitter.warning', tick: 2, time: 2 }],
    run(),
    {},
    { mode: 'team', board: 'team' },
  );
  assert.equal(sound.voices.size, 16);
  assert.ok(sources.length > beforeWarning);
  assert.ok([...sound.voices].some((voice) => voice.name === 'warning' && voice.priority === 5));
  sound.stopVoices();
  let stolen = 0;
  const music = Array.from({ length: 64 }, () => ({
    bus: 'music',
    stop() {
      stolen++;
      sound.voices.delete(this);
    },
  }));
  for (const voice of music) sound.voices.add(voice);
  sound.recentEvents.clear();
  const before = sources.length;
  sound.events(overlappingTeamEvents(), run(), {}, { mode: 'team', board: 'team' });
  assert.equal(sources.length, before, 'a full music budget refuses optional feedback allocation');
  assert.equal(stolen, 0, 'fallback phrases never steal a music voice');
  assert.deepEqual([...sound.voices], music);
});
