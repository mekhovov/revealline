import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldHuntReactionSession } from '../../optional-practice/civilian-fpv/world-hunt-reactions.mjs';
import { createWorldAudio } from '../../optional-practice/civilian-fpv/world-audio.mjs';
import { dialogueChannel } from '../ui/dialogue-channel.mjs';

const course = {
  actors: [
    { id: 'moving', speed: 100 },
    { id: 'still', speed: 0 },
  ],
  steps: { 'self-level': [{ type: 'hunt-contact-v1', targets: ['moving', 'still'] }] },
};
function fixture() {
  const delivered = [],
    prepared = [];
  let suspended = false;
  const session = createWorldHuntReactionSession({
    reactions: {
      reset() {},
      suspend() {
        suspended = true;
      },
      resume() {
        suspended = false;
      },
      prepare(families) {
        prepared.push(families);
      },
      events(events, context) {
        if (!suspended) delivered.push({ events, context });
      },
    },
  });
  return { session, delivered, prepared };
}
const frame = (ticks, events = [], extra = {}) => ({
  ticks,
  events,
  health: 100,
  status: 'active',
  ...extra,
});

test('SIM catches use only admitted native families, including the final catch', () => {
  const { session, delivered, prepared } = fixture();
  session.reset(course, frame(0), { mode: 'self-level', attemptId: 'one' });
  session.resume();
  assert.deepEqual(prepared[0], ['patroller', 'lookout']);
  session.consume(frame(1, [{ type: 'catch', actor: 'moving' }]));
  session.consume(frame(2, [{ type: 'catch', actor: 'still' }], { status: 'complete' }));
  assert.equal(delivered[0].events[0].actorFamily, 'patroller');
  assert.equal(delivered[1].events[0].actorFamily, 'lookout');
  assert.equal(delivered[1].context.danger, false);
});

test('restored catches, repeated frames, pause and verified playback do not replay reactions', () => {
  const { session, delivered } = fixture();
  session.reset(course, frame(7, [], { hunt: { caught: ['moving'] } }), {
    mode: 'self-level',
    attemptId: 'restored',
  });
  session.resume();
  session.consume(
    frame(8, [
      { type: 'catch', actor: 'moving' },
      { type: 'catch', actor: 'still' },
    ]),
  );
  session.consume(frame(8, [{ type: 'catch', actor: 'still' }]));
  assert.equal(delivered.length, 1);
  assert.deepEqual(
    delivered[0].events.map((event) => event.id),
    ['still'],
  );
  session.suspend();
  session.consume(frame(9, [{ type: 'catch', actor: 'moving' }]));
  session.reset(course, frame(0), { mode: 'self-level', attemptId: 'playback', replay: true });
  session.resume();
  session.consume(frame(1, [{ type: 'catch', actor: 'moving' }]));
  assert.equal(delivered.length, 1);
});

test('native damage and hostile warnings outrank same-step catches', () => {
  const { session, delivered } = fixture();
  session.reset(course, frame(0), { mode: 'self-level', attemptId: 'danger' });
  session.resume();
  session.consume(
    frame(1, [
      { type: 'catch', actor: 'moving' },
      { type: 'fire', actor: 'sentry' },
    ]),
  );
  session.consume(frame(2, [{ type: 'catch', actor: 'still' }], { health: 90 }));
  assert.equal(delivered.length, 2);
  assert.ok(delivered.every((row) => row.context.danger));
});

class Parameter {
  value = 0;
  setTargetAtTime(value) {
    this.value = value;
  }
  setValueAtTime(value) {
    this.value = value;
  }
  cancelScheduledValues() {}
  exponentialRampToValueAtTime() {}
  linearRampToValueAtTime() {}
}
class AudioNode {
  gain = new Parameter();
  frequency = new Parameter();
  connect(next) {
    return next;
  }
  disconnect() {}
  start() {}
  stop() {
    this.onended?.();
  }
}
class AudioContext {
  state = 'suspended';
  currentTime = 0;
  sampleRate = 8000;
  destination = new AudioNode();
  createGain() {
    return new AudioNode();
  }
  createBiquadFilter() {
    return new AudioNode();
  }
  createOscillator() {
    return new AudioNode();
  }
  createBufferSource() {
    return new AudioNode();
  }
  createBuffer() {
    return { getChannelData: () => new Float32Array(16) };
  }
  async resume() {
    this.state = 'running';
  }
  async suspend() {
    this.state = 'suspended';
  }
  async close() {
    this.state = 'closed';
  }
}
test('native dialogue obeys one-line arbitration, master mute, pause, volume and warning priority', async () => {
  const sound = createWorldAudio({
    window: { AudioContext },
    storage: { getItem: () => null, setItem() {} },
  });
  const clip = { duration: 1 };
  sound.configureDialogue({ enabled: true, volume: 0.8 });
  assert.equal(sound.playDialogue(clip), null);
  await sound.setEnabled(true);
  let ended = 0;
  const first = sound.playDialogue(clip, { onended: () => ended++ });
  const second = sound.playDialogue(clip);
  assert.equal(first.ended, true);
  assert.equal(ended, 1);
  assert.equal(dialogueChannel.active, second);
  // The first snapshot establishes a baseline; retained warnings must not replay.
  sound.update(frame(0, [{ type: 'fire', actor: 'hostile' }]));
  assert.equal(second.ended, false);
  sound.update(frame(1, [{ type: 'fire', actor: 'hostile' }]));
  assert.equal(second.ended, true);
  const paused = sound.playDialogue(clip);
  sound.pause();
  assert.equal(paused.ended, true);
  assert.equal(sound.playDialogue(clip), null);
  await sound.resume();
  const quiet = sound.playDialogue(clip);
  sound.configureDialogue({ volume: 0 });
  assert.equal(quiet.ended, true);
  assert.equal(sound.playDialogue(clip), null);
  sound.configureDialogue({ volume: 1 });
  const muted = sound.playDialogue(clip);
  await sound.setEnabled(false);
  assert.equal(muted.ended, true);
  assert.equal(dialogueChannel.active, null);
  sound.dispose();
});
