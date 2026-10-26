import test from 'node:test';
import assert from 'node:assert/strict';
import * as audioOutput from '../ui/audio-output.mjs';

// Connection/property evidence only. The browser fixture renders actual PCM;
// this model makes no acoustic or native down-mixing claim.
export function outputContext({ supported = true } = {}) {
  const nodes = [],
    connections = [];
  const context = {
    destination: { name: 'speakers' },
    createGain() {
      let count = 2;
      const node = {
        gain: { value: 1 },
        channelCountMode: 'max',
        channelInterpretation: 'speakers',
        get channelCount() {
          return count;
        },
        set channelCount(value) {
          if (!supported && value === 1) throw new Error('Unsupported channel configuration');
          count = value;
        },
        connect(destination) {
          connections.push([node, destination]);
        },
        disconnect() {
          node.disconnected = true;
        },
      };
      nodes.push(node);
      return node;
    },
  };
  return { context, nodes, connections };
}

test('all effects, menu and voice buses share one channel stage while music retains its own route', () => {
  const h = outputContext(),
    output = audioOutput.createGameAudioOutput(h.context);
  assert.ok(output.gameplayBus, 'A gameplay-only channel stage is required.');
  for (const key of ['sfxBus', 'menuBus', 'dialogueBus'])
    assert.ok(h.connections.some(([a, b]) => a === output[key] && b === output.gameplayBus));
  for (const key of ['movementBus', 'radioBus'])
    assert.ok(h.connections.some(([a, b]) => a === output[key] && b === output.sfxBus));
  assert.ok(h.connections.some(([a, b]) => a === output.musicBus && b === output.master));
  assert.ok(h.connections.some(([a, b]) => a === output.gameplayBus && b === output.master));
  assert.ok(
    Object.values(output)
      .filter(Boolean)
      .every((node) => typeof node.disconnect === 'function'),
  );
});

test('switching channels changes only the owned stage and never reconnects the live mix', () => {
  const h = outputContext(),
    output = audioOutput.createGameAudioOutput(h.context);
  assert.equal(typeof audioOutput.setGameEffectsMono, 'function');
  const before = [...h.connections];
  assert.equal(audioOutput.setGameEffectsMono(output, true), true);
  assert.equal(output.gameplayBus.channelCount, 1);
  assert.equal(output.gameplayBus.channelCountMode, 'explicit');
  assert.equal(output.gameplayBus.channelInterpretation, 'speakers');
  assert.equal(output.musicBus.channelCountMode, 'max');
  assert.equal(output.master.gain.value, 1);
  assert.deepEqual(h.connections, before);
  assert.equal(audioOutput.setGameEffectsMono(output, false), true);
  assert.equal(output.gameplayBus.channelCountMode, 'max');
  assert.equal(output.gameplayBus.channelCount, 2);
  assert.deepEqual(h.connections, before);
});

test('an unsupported mono configuration is reported and leaves the original channel path usable', () => {
  const h = outputContext({ supported: false }),
    output = audioOutput.createGameAudioOutput(h.context);
  assert.equal(typeof audioOutput.setGameEffectsMono, 'function');
  const before = [...h.connections];
  assert.equal(audioOutput.setGameEffectsMono(output, true), false);
  assert.equal(output.gameplayBus.channelCountMode, 'max');
  assert.equal(output.gameplayBus.channelCount, 2);
  assert.deepEqual(h.connections, before);
});
