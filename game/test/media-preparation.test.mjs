import { pcmWaveBlob } from './helpers/pcm-wave.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as tick } from 'node:timers/promises';
import { createMediaPreparation } from '../ui/media-preparation.mjs';
import { audioHarness } from './helpers/soundtrack-audio.mjs';
import { FeedbackDirector } from '../ui/feedback-director.mjs';
import { EFFECT_BANK } from '../audio/effects/bank.mjs';
import { createReactionVoiceCache } from '../journey/reaction-voice-cache.mjs';
import { createSoundtrackPlayer } from '../ui/soundtrack-player.mjs';
import { createPublishedCues } from '../ui/published-audio.mjs';
import { fixture } from './helpers/soundtrack-fixtures.mjs';
import { readFile } from 'node:fs/promises';

test('unchanged installed music and absent published music do not notify or disturb transport', async (t) => {
  const h = audioHarness();
  let changes = 0;
  const player = createSoundtrackPlayer({
    soundscape: h.soundscape,
    audioElement: h.media,
    URLImpl: h.URLImpl,
    readAsset: async () => null,
    onChange: () => changes++,
  });
  t.after(() => {
    player.dispose();
    return h.soundscape.dispose();
  });
  const original = player.snapshot();
  player.setLocalRecordingIds([]);
  player.setPublishedTrack(null);
  assert.equal(changes, 0);
  assert.deepEqual(player.snapshot(), original);
  player.setLocalRecordingIds(['builtin.catalog.installed']);
  assert.equal(changes, 1, 'An actual installed recording change still reaches the view.');
  player.setLocalRecordingIds(['builtin.catalog.installed']);
  assert.equal(changes, 1);
  assert.throws(() => player.setLocalRecordingIds(['invalid id']), /identities/);
});

test('published cue buffers stay bounded without stopping an already playing voice', async (t) => {
  const h = audioHarness();
  t.after(() => h.soundscape.dispose());
  h.context.sampleRate = 96000;
  await h.soundscape.enable();
  h.context.decodeAudioData = async () => ({
    duration: 15,
    length: 15 * h.context.sampleRate,
    numberOfChannels: 2,
  });
  const cues = createPublishedCues({
    sound: h.soundscape,
    readAudio: async () => ({ blob: pcmWaveBlob({ seconds: 15, sampleRate: 8000, channels: 2 }) }),
  });
  t.after(() => cues.close());
  await cues.prepare(['focus']);
  const bufferBytes = 15 * h.context.sampleRate * 2 * 4;
  assert.equal(cues.resourceSnapshot().decodedBytes, bufferBytes);
  assert.equal(cues.resourceSnapshot().decodedBytesLimit, 32 * 1024 * 1024);
  assert.equal(cues.play('focus', { ui: true }), true);
  const playing = h.sources.at(-1),
    firstBuffer = playing.buffer;
  let stopped = false;
  playing.stop = () => {
    stopped = true;
  };
  await cues.prepare(['confirm', 'cancel']);
  assert.equal(cues.has('focus'), false, 'Old cache entry is evicted at the total PCM budget.');
  assert.equal(cues.has('confirm'), true);
  assert.equal(cues.has('cancel'), true);
  assert.equal(cues.resourceSnapshot().decodedBytes, bufferBytes * 2);
  assert.equal(cues.resourceSnapshot().cacheEntries, 2);
  assert.equal(cues.resourceSnapshot().loading, 0);
  assert.equal(
    playing.buffer,
    firstBuffer,
    'Playback owns its reference independently of the cache.',
  );
  assert.equal(stopped, false);
  cues.close();
  assert.equal(cues.resourceSnapshot().decodedBytes, 0);
  assert.equal(cues.resourceSnapshot().cacheEntries, 0);
});

test('PCM snapshots read owned counters without initializing audio or accessing sample data', async (t) => {
  const h = audioHarness();
  t.after(() => h.soundscape.dispose());
  h.soundscape.contextFactory = () => assert.fail('Diagnostics must not initialize audio.');
  h.soundscape.setPublishedAudio(() => assert.fail('Diagnostics must not fetch cues.'));
  const reactions = createReactionVoiceCache({
    sound: h.soundscape,
    library: { resolve: () => assert.fail('Diagnostics must not fetch speech.') },
  });
  t.after(() => reactions.dispose());
  const admission = h.soundscape.mediaPreparation.snapshot();
  const empty = h.soundscape.resourceSnapshot();
  assert.equal(empty.effects.decodedBytes, 0);
  assert.equal(empty.published.decodedBytes, 0);
  assert.equal(empty.proceduralNoise.decodedBytes, 0);
  assert.equal(reactions.snapshot().decodedBytes, 0);
  assert.equal(reactions.snapshot().decodedBytesLimit, 12 * 1024 * 1024);
  assert.equal(reactions.snapshot().perDecodeBytesLimit, 6 * 1024 * 1024);
  assert.equal(reactions.snapshot().buffersLimit, 24);
  h.soundscape.noise = {
    length: 2000,
    numberOfChannels: 1,
    getChannelData: () => assert.fail('Diagnostics must not read or copy sample data.'),
  };
  assert.equal(h.soundscape.resourceSnapshot().proceduralNoise.decodedBytes, 8000);
  assert.equal(h.soundscape.context, null);
  assert.deepEqual(h.soundscape.mediaPreparation.snapshot(), admission);
  await h.soundscape.dispose();
  assert.equal(h.soundscape.resourceSnapshot().proceduralNoise.decodedBytes, 0);
  assert.equal(h.soundscape.resourceSnapshot().published, null);
});

test('effect PCM counters follow decoded retention, eviction and disposal', async (t) => {
  const h = audioHarness();
  t.after(() => h.soundscape.dispose());
  await h.soundscape.enable();
  t.mock.method(globalThis, 'fetch', async (url) => {
    const entry = Object.values(EFFECT_BANK).find((value) => String(url).endsWith(value.file));
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(entry.bytes) };
  });
  const size = 12 * 1024 * 1024;
  h.context.decodeAudioData = async () => ({
    duration: 1,
    length: size / 8,
    numberOfChannels: 2,
  });
  const director = h.soundscape.feedbackDirector;
  await director.load('focus');
  assert.equal(h.soundscape.resourceSnapshot().effects.decodedBytes, size);
  await director.load('confirm');
  await director.load('cancel');
  assert.equal(director.buffers.has('focus'), false);
  assert.deepEqual(director.resourceSnapshot(), {
    decodedBytes: size * 2,
    decodedBytesLimit: 32 * 1024 * 1024,
    buffers: 2,
    loading: 0,
  });
  assert.equal(h.soundscape.mediaPreparation.snapshot().reservedDecodeBytes, 0);
  director.close();
  assert.equal(director.resourceSnapshot().decodedBytes, 0);
  assert.equal(director.resourceSnapshot().buffers, 0);
});

test('PCM reservations use actual sample rate without rejecting ordinary WAVs on high-rate devices', async (t) => {
  const original = await readFile(new URL('../audio/effects/bell.wav', import.meta.url));
  const h = audioHarness();
  t.after(() => h.soundscape.dispose());
  h.context.sampleRate = 192000;
  await h.soundscape.enable();
  t.mock.method(globalThis, 'fetch', async () => new Response(original));
  let finish;
  h.context.decodeAudioData = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const loading = h.soundscape.feedbackDirector.load('bell');
  await tick();
  const frames = Math.ceil(
    (((original.length - 44) / original.readUInt16LE(32)) * h.context.sampleRate) /
      original.readUInt32LE(24),
  );
  const channels = original.readUInt16LE(22);
  assert.equal(h.soundscape.mediaPreparation.snapshot().reservedDecodeBytes, frames * channels * 4);
  finish({ duration: frames / h.context.sampleRate, length: frames, numberOfChannels: channels });
  await loading;
  assert.equal(h.soundscape.feedbackDirector.buffers.has('bell'), true);
});

test('suspended pages start no queued work and foreground preparation resumes it', async () => {
  const queue = createMediaPreparation();
  queue.setPhase('suspended');
  let fetched = false;
  const demanded = queue.run('fetch', () => {
    fetched = true;
  });
  await assert.rejects(
    queue.run('fetch', () => assert.fail('Hidden warmup'), { priority: 'background' }),
    { name: 'AbortError' },
  );
  await tick();
  assert.equal(fetched, false);
  assert.equal(queue.snapshot().queued, 1);
  queue.setPhase('preparing');
  await demanded;
  assert.equal(fetched, true);
});

test('a prepared MP3 starts media playback directly before awaiting context activation', async (t) => {
  const h = audioHarness(),
    original = await fixture('gesture-bounded-queue');
  const player = createSoundtrackPlayer({
    soundscape: h.soundscape,
    audioElement: h.media,
    URLImpl: h.URLImpl,
    readAsset: async () => original.blob,
    fadeMs: 0,
  });
  t.after(() => {
    player.dispose();
    return h.soundscape.dispose();
  });
  player.setLibrary({
    ...original.library,
    playlists: [{ ...original.library.playlists[0], trackIds: [original.track.id] }],
    selection: { playlistId: original.library.playlists[0].id },
  });
  await player.prepare();
  assert.equal(h.created.length, 1);
  let activated;
  h.soundscape.enable = () =>
    new Promise((resolve) => {
      activated = resolve;
    });
  const playing = player.play();
  assert.equal(h.media.plays, 1);
  activated(true);
  assert.equal(await playing, true);
});

test('fetch admission is bounded and demand runs before queued prewarming', async () => {
  const queue = createMediaPreparation(),
    started = [],
    finish = [];
  const job = (name, priority = 'background') =>
    queue.run(
      'fetch',
      () => {
        started.push(name);
        return new Promise((resolve) => finish.push(resolve));
      },
      { priority },
    );
  const jobs = [job('one'), job('two'), job('later'), job('current-music', 'required')];
  await tick();
  assert.deepEqual(started, ['one', 'two']);
  finish.shift()();
  await tick();
  assert.deepEqual(started, ['one', 'two', 'current-music']);
  queue.setPhase('playing');
  const cancelled = assert.rejects(jobs[2], { name: 'AbortError' });
  finish.splice(0).forEach((done) => done());
  await Promise.all([jobs[0], jobs[1], jobs[3], cancelled]);
  await tick();
  assert.equal(queue.snapshot().queued, 0);
});

test('abandoned native decode retains its slot and bytes until native completion', async () => {
  const queue = createMediaPreparation(),
    controller = new AbortController();
  let complete,
    nextStarted = false;
  const first = queue.run(
    'decode',
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
    { signal: controller.signal, bytes: 4096 },
  );
  const rejected = assert.rejects(first, { name: 'AbortError' });
  await tick();
  controller.abort();
  const next = queue.run(
    'decode',
    () => {
      nextStarted = true;
      return 2;
    },
    { bytes: 8192 },
  );
  await tick();
  assert.equal(nextStarted, false);
  assert.equal(queue.snapshot().reservedDecodeBytes, 4096);
  complete(1);
  await rejected;
  assert.equal(await next, 2);
  await tick();
  assert.equal(queue.snapshot().reservedDecodeBytes, 0);
});

test('main-thread fallback waits through active play and cancels without running', async () => {
  const queue = createMediaPreparation(),
    controller = new AbortController();
  queue.setPhase('playing');
  let scans = 0;
  const waiting = queue.run('main', () => ++scans);
  const cancelled = queue.run('main', () => ++scans, { signal: controller.signal });
  const rejected = assert.rejects(cancelled, { name: 'AbortError' });
  await tick();
  controller.abort();
  await rejected;
  assert.equal(scans, 0);
  queue.setPhase('paused');
  assert.equal(await waiting, 1);
});

test('main-thread work admitted just before play stays pending until a safe phase', async () => {
  const queue = createMediaPreparation(),
    controller = new AbortController(),
    scans = [];
  queue.setPhase('preparing');
  const waiting = queue.run('main', () => scans.push('required'), { priority: 'required' });
  const cancelled = queue.run('main', () => scans.push('cancelled'), {
    signal: controller.signal,
  });
  const rejected = assert.rejects(cancelled, { name: 'AbortError' });
  let settled = false;
  waiting.then(() => (settled = true));
  // Admission happened synchronously; the actual work has not entered its
  // microtask yet when the prepared board releases gameplay.
  queue.setPhase('playing');
  await tick();
  assert.deepEqual(scans, []);
  assert.equal(settled, false, 'The original playback request remains pending.');
  assert.equal(queue.snapshot().active.main, 0);
  assert.equal(queue.snapshot().queued, 2);
  controller.abort();
  await rejected;
  queue.setPhase('paused');
  assert.equal(await waiting, 1);
  await tick();
  assert.deepEqual(scans, ['required']);
  assert.equal(queue.snapshot().queued, 0);
  assert.equal(queue.snapshot().active.main, 0);
  queue.close();
});

test('audio activation stays in the gesture and muted preparation starts no downloads', async (t) => {
  const h = audioHarness();
  t.after(() => h.soundscape.dispose());
  let requests = 0,
    resumes = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    requests++;
    return { ok: false };
  });
  h.context.resume = () => {
    resumes++;
    h.context.state = 'running';
    return Promise.resolve();
  };
  h.soundscape.audioMaster = { muted: true, volume: 1 };
  const enabled = h.soundscape.enable();
  assert.equal(resumes, 1);
  await enabled;
  await h.soundscape.prepareGameplayAudio();
  assert.equal(requests, 0);
  h.soundscape.audioMaster.muted = false;
  await h.soundscape.enable();
  await tick();
  assert.equal(requests, 0, 'Enabling audio does not warm the whole effect bank.');
  h.soundscape.settings.sfx = 0;
  await h.soundscape.prepareGameplayAudio(['warning']);
  assert.equal(requests, 0, 'A muted effects bus does not prepare optional effects.');
  h.soundscape.settings.sfx = 0.7;
  await h.soundscape.prepareGameplayAudio(['warning']);
  assert.equal(requests, 1);
});

test('an oversized streamed effect is cancelled before native decoding', async (t) => {
  const h = audioHarness();
  t.after(() => h.soundscape.dispose());
  await h.soundscape.enable();
  let cancelled = false,
    decoded = false;
  h.context.decodeAudioData = async () => {
    decoded = true;
  };
  t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(EFFECT_BANK.warning.bytes + 1));
          },
          cancel() {
            cancelled = true;
          },
        }),
      ),
  );
  await h.soundscape.feedbackDirector.load('warning');
  assert.equal(cancelled, true);
  assert.equal(decoded, false);
});

test('effects and reactions share one native decoder; active play rejects bulk warmup', async (t) => {
  const h = audioHarness(),
    decodes = [];
  t.after(() => h.soundscape.dispose());
  await h.soundscape.enable();
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(EFFECT_BANK.warning.bytes),
  }));
  h.context.decodeAudioData = () => new Promise((resolve) => decodes.push(resolve));
  const reactions = createReactionVoiceCache({
    sound: h.soundscape,
    library: { resolve: async () => ({ bytes: new ArrayBuffer(8) }) },
    inspect: async () => ({ channels: 1, maxDecodedSeconds: 1, decodeChannels: 1 }),
  });
  t.after(() => reactions.dispose());
  const effect = h.soundscape.feedbackDirector.load('warning');
  const reaction = reactions.load('pilot.line', 'en');
  await tick();
  assert.equal(decodes.length, 1);
  const buffer = { duration: 1, length: 8000, numberOfChannels: 1 };
  decodes.shift()(buffer);
  await tick();
  assert.equal(decodes.length, 1);
  decodes.shift()(buffer);
  await Promise.all([effect, reaction]);
  assert.equal(reactions.snapshot().decodedBytes, 32000);
  assert.equal(reactions.snapshot().buffers, 1);
  assert.equal(reactions.snapshot().loading, 0);
  assert.equal(h.soundscape.resourceSnapshot().effects.decodedBytes, 32000);
  assert.equal(h.soundscape.mediaPreparation.snapshot().reservedDecodeBytes, 0);
  await reactions.cancel({ clear: true });
  assert.equal(reactions.snapshot().decodedBytes, 0);
  assert.equal(reactions.snapshot().buffers, 0);
  h.soundscape.setPreparationPhase('playing');
  const director = new FeedbackDirector(h.soundscape);
  t.after(() => director.close());
  await director.prepare(['warning']);
  await reactions.load('warm.only', 'en', { priority: 'background' });
  assert.equal(decodes.length, 0);
  assert.equal(director.buffers.size, 0);
});
