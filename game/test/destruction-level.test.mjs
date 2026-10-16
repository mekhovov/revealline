import test from 'node:test';
import assert from 'node:assert/strict';
import { destructionBufferGain } from '../ui/destruction-level.mjs';
import { audioHarness, settleUntil } from './helpers/soundtrack-audio.mjs';
import { inspectDestructionFallbackLevels } from '../../authoring/audio/revealline-v1/fallback-level-check.mjs';

test('modeled fallback tones and noise stay within 3 dB of the admitted recordings', async () => {
  const result = await inspectDestructionFallbackLevels();
  for (const row of result.rows)
    assert.ok(
      row.differenceDb <= 3,
      `${row.category} fallback is ${row.differenceDb.toFixed(2)} dB louder`,
    );
});

function buffer(amplitude, channels = 1, seconds = 0.2) {
  const sampleRate = 48000;
  const length = Math.round(sampleRate * seconds);
  const data = Array.from({ length: channels }, (_, channel) =>
    Float32Array.from({ length }, () => amplitude * (channel % 2 ? -1 : 1)),
  );
  return {
    sampleRate,
    length,
    duration: seconds,
    numberOfChannels: channels,
    getChannelData: (channel) => data[channel],
  };
}

test('hot destruction recordings are attenuated by loudest 50 ms RMS and impulse peak without rewriting bytes', () => {
  const hot = buffer(0.9);
  const original = hot.getChannelData(0).slice();
  for (const [name, target] of [
    ['soft', -30],
    ['armored', -30],
    ['light', -29],
    ['heavy', -28],
    ['electronic', -31],
  ]) {
    const gain = destructionBufferGain(`destroy-${name}`, hot);
    assert.ok(gain > 0 && gain < 1);
    assert.ok(Math.abs(20 * Math.log10(gain * hot.getChannelData(0)[0]) - target) < 0.001);
  }
  assert.deepEqual(hot.getChannelData(0), original);
  const transient = buffer(0);
  transient.getChannelData(0)[4700] = 0.9;
  assert.ok(
    Math.abs(
      destructionBufferGain('destroy-heavy', transient) * transient.getChannelData(0)[4700] - 0.1,
    ) < 1e-7,
  );
});

test('quiet and silent recordings are never amplified; opposed stereo cannot evade the downmix bound', () => {
  assert.equal(destructionBufferGain('destroy-soft', buffer(0.001)), 1);
  assert.equal(destructionBufferGain('destroy-soft', buffer(0)), 1);
  const mono = destructionBufferGain('destroy-soft', buffer(0.9));
  const stereo = destructionBufferGain('destroy-soft', buffer(0.9, 2));
  assert.ok(Math.abs(stereo * 2 - mono) < 1e-10);
  assert.equal(
    destructionBufferGain('confirm', null),
    1,
    'existing UI cues retain their gain policy',
  );
});

test('invalid decoded destruction content is rejected before caching', () => {
  for (const sample of [NaN, Infinity, -Infinity]) {
    const source = buffer(0.1);
    source.getChannelData(0)[4] = sample;
    assert.throws(() => destructionBufferGain('destroy-soft', source), /Nonfinite/);
  }
  assert.throws(() => destructionBufferGain('destroy-soft', buffer(0.1, 1, 1.1)), /Invalid/);
  assert.throws(
    () => destructionBufferGain('destroy-soft', { ...buffer(0.1), length: 5 * 1024 * 1024 }),
    /Invalid/,
  );
});

test('published preparation joins a pending decode, exposes readiness, and applies calibrated gain', async (t) => {
  const h = audioHarness();
  t.after(() => h.soundscape.dispose());
  let finish;
  h.context.decodeAudioData = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  h.soundscape.setPublishedAudio(async () => ({ blob: new Blob([new Uint8Array(8)]) }));
  await h.soundscape.enable();
  const published = h.soundscape.publishedAudio;
  assert.equal(published.has('destroy-soft'), false);
  assert.equal(published.play('destroy-soft', { feedback: true }), false);
  await settleUntil(() => !!finish);
  let ready = false;
  const preparation = published.prepare(['destroy-soft']).then(() => {
    ready = true;
  });
  await Promise.resolve();
  assert.equal(ready, false);
  const decoded = buffer(0.9);
  finish(decoded);
  await preparation;
  assert.equal(published.has('destroy-soft'), true);
  assert.equal(h.sources.length, 0, 'finishing a decode never replays the original death');
  const gains = [],
    createGain = h.context.createGain;
  h.context.createGain = () => {
    const node = createGain();
    gains.push(node);
    return node;
  };
  assert.equal(published.play('destroy-soft', { feedback: true, gain: 0.52 }), true);
  assert.ok(
    Math.abs(gains.at(-1).gain.value - 0.52 * destructionBufferGain('destroy-soft', decoded)) <
      1e-10,
  );
  const voice = [...h.soundscape.voices][0];
  voice.retire();
  assert.equal(h.soundscape.voices.size, 0);
});

test('failed published scheduling retires owned nodes and invalid cues never report ready', async (t) => {
  for (const failure of ['start', 'stop']) {
    const h = audioHarness();
    t.after(() => h.soundscape.dispose());
    h.context.decodeAudioData = async () => buffer(0.1);
    h.soundscape.setPublishedAudio(async () => ({ blob: new Blob([new Uint8Array(8)]) }));
    await h.soundscape.enable();
    await h.soundscape.publishedAudio.prepare(['destroy-heavy']);
    let disconnected = 0;
    const createSource = h.context.createBufferSource.bind(h.context);
    h.context.createBufferSource = () => {
      const source = createSource();
      source[failure] = () => {
        throw new Error('Scheduling rejected');
      };
      source.disconnect = () => {
        disconnected++;
      };
      return source;
    };
    assert.equal(h.soundscape.publishedAudio.play('destroy-heavy', { feedback: true }), false);
    assert.equal(h.soundscape.voices.size, 0);
    assert.equal(disconnected, 1);
  }
  const h = audioHarness();
  t.after(() => h.soundscape.dispose());
  h.context.decodeAudioData = async () => buffer(NaN);
  h.soundscape.setPublishedAudio(async () => ({ blob: new Blob([new Uint8Array(8)]) }));
  await h.soundscape.enable();
  await h.soundscape.publishedAudio.prepare(['destroy-soft']);
  assert.equal(h.soundscape.publishedAudio.has('destroy-soft'), false);
  assert.equal(h.soundscape.publishedAudio.play('destroy-soft'), false);
});
