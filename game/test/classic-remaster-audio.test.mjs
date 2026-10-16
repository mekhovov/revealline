import test from 'node:test';
import assert from 'node:assert/strict';
import { createClassicAudio } from '../snake/classic-audio.mjs';
import { EFFECT_BANK } from '../audio/effects/bank.mjs';
import { audioHarness } from './helpers/soundtrack-audio.mjs';

const board = () => ({
  tick: 0,
  elapsedMs: 0,
  status: 'running',
  catches: 0,
  bonusCatches: 0,
  level: {
    id: 'sound-test',
    width: 24,
    height: 18,
    stepMs: 200,
    targets: { required: [{ signalProfile: 'broadcast-burst-v1' }] },
  },
  snakes: [{ id: 'p1', alive: true, body: [{ x: 2, y: 2 }] }],
  targets: [
    { id: 'jammer', kind: 'jammer', x: 10, y: 10, policyIndex: 0, phase: 'jamming', phaseTicks: 4 },
  ],
  pulseTicks: 0,
  events: [],
});
test('interference suppresses enemy audio positions but keeps warning and cargo cues', () => {
  let projection;
  const cues = [];
  const audio = createClassicAudio({
    feedback(_active, _family, state) {
      projection = state;
    },
    encounter(cue, options) {
      cues.push({ cue, ...options });
    },
  });
  const run = board();
  audio.update(run);
  assert.equal(projection.enemies.length, 0);
  run.tick++;
  run.events = [
    { type: 'target.warning', tick: 1, target: { kind: 'guard', x: 8, y: 5 } },
    { type: 'target.warning', tick: 1, target: { kind: 'runner', x: 23, y: 5 } },
    { type: 'target.opened', tick: 1, target: { kind: 'relay', x: 0, y: 5 } },
    { type: 'cargo.collected', tick: 1 },
    { type: 'cargo.delivered', tick: 1 },
  ];
  audio.events(run);
  audio.events(run);
  assert.deepEqual(
    cues.map((c) => c.cue),
    ['warning', 'warning', 'objective', 'supply', 'objective'],
  );
  assert.ok(cues.slice(0, 3).every((cue) => cue.pan === 0));
  run.targets[0].phase = 'recovery';
  audio.update(run);
  assert.equal(projection.enemies.length, 1);
  run.targets[0].phase = 'jamming';
  run.pulseTicks = 3;
  audio.update(run);
  assert.equal(projection.enemies.length, 1);
});

test('a catch during interference has no directional or vocal position cue', () => {
  const cues = [];
  const audio = createClassicAudio({
    feedback() {},
    encounter(cue, options) {
      cues.push({ cue, ...options });
    },
    event(options) {
      cues.push(options);
    },
  });
  const run = board();
  audio.update(run);
  run.tick = 1;
  run.catches = 1;
  run.recentCatches = [{ kind: 'runner', x: 23, y: 0, tick: 1 }];
  audio.update(run);
  assert.equal(cues.find((c) => c.cue === 'catch').pan, 0);
  assert.equal(cues.find((c) => c.cue === 'catch').vocals, false);
  assert.equal(cues.find((c) => c.type === 'pickup.collected').pan, 0);
});

test('the native mixer honors jammer suppression and the persistent vocal preference independently', async (t) => {
  const h = audioHarness();
  t.after(() => h.soundscape.dispose());
  await h.soundscape.enable();
  for (const name of Object.keys(EFFECT_BANK))
    h.soundscape.feedbackDirector.buffers.set(name, { duration: 0.5 });
  let vocals = true;
  h.soundscape.setDestructionPreferences(() => ({ vocals }));
  const audio = createClassicAudio(h.soundscape, {
    // A stale host snapshot cannot override a newer persistent opt-out.
    getDestruction: () => ({ vocals: true }),
  });
  const run = board();
  audio.update(run);
  function catchRunner() {
    h.soundscape.stopVoices();
    h.context.currentTime += 1;
    run.tick++;
    run.catches++;
    run.recentCatches = [{ kind: 'runner', x: 23, y: 0, tick: run.tick }];
    audio.update(run);
    return [...h.soundscape.voices].filter((voice) => voice.humanReaction);
  }
  assert.equal(catchRunner().length, 0, 'Jamming vetoes enabled global vocals');
  h.soundscape.stopVoices();
  run.targets[0].phase = 'recovery';
  audio.update(run);
  assert.equal(
    [...h.soundscape.voices].filter((voice) => voice.humanReaction).length,
    0,
    'Restored reception never replays the concealed catch',
  );
  assert.equal(catchRunner().length, 1, 'A new clear-reception catch remains audible');
  vocals = false;
  assert.equal(catchRunner().length, 0, 'Persistent opt-out vetoes host vocals:true');
});
