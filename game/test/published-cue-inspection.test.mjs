import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as tick } from 'node:timers/promises';
import { readFile } from 'node:fs/promises';
import { inspectPublishedCue } from '../published-cue-inspection.mjs';
import { createPublishedCues } from '../ui/published-audio.mjs';
import { createMediaPreparation } from '../ui/media-preparation.mjs';
import { audioHarness, settleUntil } from './helpers/soundtrack-audio.mjs';
import { pcmWave, pcmWaveBlob } from './helpers/pcm-wave.mjs';

const inspect = (blob, options = {}) =>
  inspectPublishedCue(blob, {
    sampleRate: 48000,
    maxDuration: 15,
    scheduleScan: (work) => work(),
    ...options,
  });
const mp3 = new Blob(
  [await readFile(new URL('./fixtures/audio/silence-mpeg1-layer3.mp3', import.meta.url))],
  { type: 'audio/mpeg' },
);

test('PCM, float, and extensible WAVE reserve actual channels and resampled frame ceilings', async () => {
  for (const options of [
    { bits: 8, channels: 1 },
    { bits: 24, channels: 6, extensible: true },
    { bits: 32, channels: 2, encoding: 3 },
    { bits: 64, channels: 2, encoding: 3, extensible: true },
  ]) {
    const frames = 801,
      result = await inspect(pcmWaveBlob({ ...options, seconds: frames / 8000 }), {
        sampleRate: 44100,
      });
    const outputFrames = Math.ceil((frames * 44100) / 8000);
    assert.equal(result.channels, options.channels);
    assert.equal(result.outputFrames, outputFrames);
    assert.equal(result.reservedBytes, (frames + outputFrames) * options.channels * 4);
  }
  const unchanged = await inspect(pcmWaveBlob(), { sampleRate: 8000 });
  assert.equal(unchanged.reservedBytes, 800 * 4);
});

test('long low-rate originals and short multichannel expansions fail before native decode', async (t) => {
  const h = audioHarness();
  h.context.sampleRate = 48000;
  await h.soundscape.enable();
  let nativeCalls = 0;
  h.context.decodeAudioData = async () => {
    nativeCalls++;
    return { duration: 0.1, length: 4800, numberOfChannels: 1 };
  };
  const originals = [
    pcmWaveBlob({ seconds: 120, bits: 8 }),
    pcmWaveBlob({ seconds: 14, channels: 8, bits: 8 }),
    new Blob(['OggS', new Uint8Array(32)], { type: 'audio/ogg' }),
    pcmWaveBlob({ encoding: 6 }),
  ];
  t.after(() => h.soundscape.dispose());
  for (const blob of originals) {
    assert(blob.size < 4 * 1024 * 1024);
    let reads = 0;
    const cues = createPublishedCues({
      sound: h.soundscape,
      readAudio: async () => {
        reads++;
        return { blob };
      },
    });
    await cues.prepare(['focus']);
    assert.equal(nativeCalls, 0, 'No native allocation for unadmitted PCM.');
    assert.equal(cues.has('focus'), false);
    assert.equal(cues.resourceSnapshot().loading, 0);
    for (let i = 0; i < 20; i++) assert.equal(cues.play('focus', { ui: true }), false);
    assert.equal(reads, 1, 'The established fallback does not repeatedly read or decode.');
    assert.equal(h.soundscape.mediaPreparation.snapshot().reservedDecodeBytes, 0);
    cues.close();
  }
});

test('WAVE rejects inconsistent, duplicate, truncated, alternate and excessive chunk layouts', async () => {
  const mutations = [
    (b) => new DataView(b.buffer).setUint32(4, b.length - 9, true),
    (b) => new DataView(b.buffer).setUint16(22, 0, true),
    (b) => new DataView(b.buffer).setUint16(32, 1, true),
    (b) => new DataView(b.buffer).setUint32(28, 1, true),
    (b) => new DataView(b.buffer).setUint32(40, b.length, true),
    (b) => b.set(new TextEncoder().encode('LIST'), 36),
  ];
  for (const mutate of mutations) {
    const bytes = pcmWave();
    mutate(bytes);
    await assert.rejects(inspect(new Blob([bytes], { type: 'audio/wav' })));
  }
  const original = pcmWave(),
    extras = [original.slice(12, 36), original.slice(36), new Uint8Array(1025 * 8)];
  for (const [index, extra] of extras.entries()) {
    if (index === 2)
      for (let offset = 0; offset < extra.length; offset += 8)
        extra.set(new TextEncoder().encode('JUNK'), offset);
    const bytes = new Uint8Array(original.length + extra.length);
    bytes.set(original);
    bytes.set(extra, original.length);
    new DataView(bytes.buffer).setUint32(4, bytes.length - 8, true);
    await assert.rejects(inspect(new Blob([bytes], { type: 'audio/wav' })));
  }
  const extended = pcmWave({ extensible: true });
  extended[50] = 0;
  await assert.rejects(inspect(new Blob([extended], { type: 'audio/wav' })), /subformat/);
});

test('safe-phase MP3 admission defers between materialization, scanning and hashing', async () => {
  const queue = createMediaPreparation();
  let calls = 0,
    settled = false;
  queue.setPhase('playing');
  const pending = inspect(mp3, {
    scheduleScan: (work) =>
      queue.run('main', async () => {
        calls++;
        const value = await work();
        queue.setPhase('playing');
        return value;
      }),
  }).then((value) => {
    settled = true;
    return value;
  });
  await tick();
  assert.equal(calls, 0);
  for (let stage = 1; stage <= 3; stage++) {
    queue.setPhase('paused');
    await settleUntil(() => calls === stage && queue.snapshot().active.main === 0);
    assert.equal(queue.snapshot().phase, 'playing');
    if (stage < 3) assert.equal(settled, false);
  }
  const result = await pending;
  assert.equal(result.channels, 1);
  assert.equal(result.outputFrames, Math.ceil((11520 * 48000) / 44100));
  assert.equal(result.reservedBytes, (11520 + result.outputFrames) * 4);
  queue.close();
});

test('cancelled inspection and obsolete contexts cannot enter native decoding', async (t) => {
  const h = audioHarness();
  await h.soundscape.enable();
  let nativeCalls = 0;
  h.context.decodeAudioData = async () => {
    nativeCalls++;
    return { duration: 0.1, length: 800, numberOfChannels: 1 };
  };
  t.after(() => h.soundscape.dispose());
  for (const invalidate of ['cancel', 'context']) {
    const queue = h.soundscape.mediaPreparation;
    queue.setPhase('playing');
    const cues = createPublishedCues({
      sound: h.soundscape,
      readAudio: async () => ({ blob: mp3 }),
    });
    cues.play('focus', { ui: true });
    await settleUntil(() => queue.snapshot().queued === 1 && queue.snapshot().active.fetch === 0);
    if (invalidate === 'cancel') cues.cancelPending();
    else h.soundscape.context = { ...h.context };
    queue.setPhase('paused');
    await settleUntil(() => cues.resourceSnapshot().loading === 0);
    assert.equal(cues.has('focus'), false);
    assert.equal(nativeCalls, 0, 'Stale inspected bytes never decode.');
    assert.equal(queue.snapshot().reservedDecodeBytes, 0);
    cues.close();
    h.soundscape.context = h.context;
  }
});

test('validated PCM owns its full reservation until a noncancelable decode settles', async (t) => {
  const h = audioHarness();
  h.context.sampleRate = 48000;
  await h.soundscape.enable();
  let finish;
  h.context.decodeAudioData = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const cues = createPublishedCues({
    sound: h.soundscape,
    readAudio: async () => ({ blob: pcmWaveBlob({ channels: 6 }) }),
  });
  t.after(async () => {
    cues.close();
    finish?.({ duration: 0.1, length: 4800, numberOfChannels: 6 });
    await h.soundscape.dispose();
  });
  const pending = cues.prepare(['focus']);
  await settleUntil(() => !!finish);
  const reserved = (800 + 4800) * 6 * 4;
  assert.equal(h.soundscape.mediaPreparation.snapshot().reservedDecodeBytes, reserved);
  cues.close();
  let admitted = false;
  const next = h.soundscape.mediaPreparation.run(
    'decode',
    () => {
      admitted = true;
    },
    { bytes: 4 },
  );
  await tick();
  assert.equal(admitted, false);
  assert.equal(h.soundscape.mediaPreparation.snapshot().reservedDecodeBytes, reserved);
  finish({ duration: 0.1, length: 4800, numberOfChannels: 6 });
  await Promise.all([pending, next]);
  await tick();
  assert.equal(cues.resourceSnapshot().decodedBytes, 0);
  assert.equal(h.soundscape.mediaPreparation.snapshot().reservedDecodeBytes, 0);
});

test('postdecode length and channel defenses reject output inconsistent with validated bytes', async (t) => {
  const h = audioHarness();
  await h.soundscape.enable();
  t.after(() => h.soundscape.dispose());
  for (const decoded of [
    { duration: 0.1, length: 801, numberOfChannels: 1 },
    { duration: 0.1, length: 800, numberOfChannels: 2 },
    { duration: 0.1, length: NaN, numberOfChannels: 1 },
  ]) {
    h.context.decodeAudioData = async () => decoded;
    const cues = createPublishedCues({
      sound: h.soundscape,
      readAudio: async () => ({ blob: pcmWaveBlob() }),
    });
    await cues.prepare(['focus']);
    assert.equal(cues.has('focus'), false);
    cues.close();
  }
});

test('cancellation during final byte materialization retains admission but prevents native decode', async (t) => {
  const h = audioHarness(),
    arrayBuffer = Blob.prototype.arrayBuffer;
  await h.soundscape.enable();
  let reads = 0,
    release,
    nativeCalls = 0;
  t.mock.method(Blob.prototype, 'arrayBuffer', async function () {
    const bytes = await arrayBuffer.call(this);
    if (++reads === 2)
      await new Promise((resolve) => {
        release = resolve;
      });
    return bytes;
  });
  h.context.decodeAudioData = async () => {
    nativeCalls++;
    return { duration: 0.1, length: 800, numberOfChannels: 1 };
  };
  const cues = createPublishedCues({
    sound: h.soundscape,
    readAudio: async () => ({ blob: pcmWaveBlob() }),
  });
  t.after(async () => {
    cues.close();
    release?.();
    await h.soundscape.dispose();
  });
  const pending = cues.prepare(['focus']);
  await settleUntil(() => !!release);
  cues.cancelPending();
  assert.equal(h.soundscape.mediaPreparation.snapshot().reservedDecodeBytes, 3200);
  assert.equal(nativeCalls, 0);
  release();
  await pending;
  await tick();
  assert.equal(nativeCalls, 0);
  assert.equal(h.soundscape.mediaPreparation.snapshot().reservedDecodeBytes, 0);
});
