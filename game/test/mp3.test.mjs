import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectMP3, ownSoundtrackBlob, prepareMP3Import, probeMP3Media } from '../mp3.mjs';
import { silenceBytes, metadata, structuralProbe } from './helpers/soundtrack-fixtures.mjs';

const original = new Blob([silenceBytes]);
test('pinned coded-silence original has complete MPEG1 Layer III frames and exact SHA-256', async () => {
  assert.deepEqual(await inspectMP3(original), {
    sha256: '54a1cbf7f98d7b263dae389576f50dc8507e3b3b40aec9c5793dc4480b14d913',
    bytes: 4170,
    mime: 'audio/mpeg',
    mpegVersion: '1',
    sampleRate: 44100,
    channels: 1,
    frames: 10,
    durationSeconds: 11520 / 44100,
  });
});
test('ID3v2 and trailing ID3v1 bytes are preserved and excluded from frame duration', async () => {
  const leading = new Uint8Array([73, 68, 51, 4, 0, 0, 0, 0, 0, 3, 1, 2, 3]),
    trailing = new Uint8Array(128);
  trailing.set([84, 65, 71]);
  const blob = new Blob([leading, original, trailing]),
    result = await prepareMP3Import(blob, metadata, { probeMedia: structuralProbe });
  assert.equal(result.track.asset.durationSeconds, 11520 / 44100);
  assert.equal(result.blob.size, 4311);
  assert.deepEqual(await result.blob.arrayBuffer(), await blob.arrayBuffer());
});
test('parser supports MPEG2/2.5 Layer III sample rates and variable bitrate frame lengths structurally', async () => {
  for (const [version, second, rate] of [
    ['2', 0xf3, 22050],
    ['2.5', 0xe3, 11025],
  ]) {
    const frames = [64, 80, 96].map((bitrate, i) => {
      const b = new Uint8Array(Math.floor((72000 * bitrate) / rate));
      b.set([255, second, (8 + i) << 4, 0xc0]);
      return b;
    });
    const asset = await inspectMP3(new Blob(frames));
    assert.equal(asset.mpegVersion, version);
    assert.equal(asset.sampleRate, rate);
    assert.equal(asset.frames, 3);
    assert.equal(asset.durationSeconds, 1728 / rate);
  }
});
test('every frame is validated; junk, reserved/free bitrate, format changes and truncation fail', async () => {
  const mutations = [
    (b) => {
      b[417] = 0;
    },
    (b) => {
      b[2] = 0;
    },
    (b) => {
      b[1] = 0xfd;
    },
    (b) => {
      b[419] = 0x9c;
    },
    (b) => {
      b[420] = 0;
    },
  ];
  for (const mutate of mutations) {
    const b = Uint8Array.from(silenceBytes);
    mutate(b);
    await assert.rejects(inspectMP3(new Blob([b])));
  }
  await assert.rejects(inspectMP3(original.slice(0, -1)), /Truncated/);
  await assert.rejects(inspectMP3(new Blob(['junk', original])));
  await assert.rejects(inspectMP3(new Blob([original, 'junk'])));
  await assert.rejects(inspectMP3(original.slice(0, 417)), /two/);
});
test('malformed or unsupported ID3 tag boundaries fail instead of searching for later sync bytes', async () => {
  for (const header of [
    [73, 68, 51, 4, 0, 16, 0, 0, 0, 0],
    [73, 68, 51, 4, 0, 0, 128, 0, 0, 0],
    [73, 68, 51, 4, 0, 0, 0, 127, 127, 127],
    [73, 68, 51, 5, 0, 0, 0, 0, 0, 0],
  ])
    await assert.rejects(inspectMP3(new Blob([new Uint8Array(header), original])), /ID3/);
});
test('12 minute frame cap and32 MiB file cap reject before an actual media probe', async () => {
  // 27,563 frames at44.1 kHz is just beyond720 seconds; still below32 MiB.
  const frame = original.slice(0, 417);
  await assert.rejects(inspectMP3(new Blob(Array(27563).fill(frame))), /12 minutes/);
  let reads = 0;
  const imitation = {
    get size() {
      reads++;
      return 1;
    },
    arrayBuffer() {
      reads++;
    },
  };
  assert.throws(() => ownSoundtrackBlob(imitation), /Blob/);
  assert.equal(reads, 0);
  assert.throws(
    () => ownSoundtrackBlob(new Blob(Array(805).fill(new Uint8Array(41700)))),
    /budget/,
  );
});
test('import cannot pass a probe with unrelated decoded duration or accessor result', async () => {
  await assert.rejects(
    prepareMP3Import(original, metadata, { probeMedia: async () => ({ durationSeconds: 300 }) }),
    /does not match/,
  );
  let reads = 0;
  await assert.rejects(
    prepareMP3Import(original, metadata, {
      probeMedia: async () => ({
        get durationSeconds() {
          reads++;
          return 1;
        },
      }),
    }),
    /accessors/,
  );
  assert.equal(reads, 0);
});
function mediaHarness() {
  const listeners = new Map();
  let cleanupLoads = 0;
  const state = { played: 0, paused: 0, revoked: [], created: [], loads: 0 };
  const media = {
    readyState: 0,
    duration: NaN,
    canPlayType: () => 'probably',
    addEventListener(type, fn) {
      const set = listeners.get(type) ?? new Set();
      set.add(fn);
      listeners.set(type, set);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    load() {
      state.loads++;
      if (!this.src) cleanupLoads++;
    },
    play() {
      state.played++;
    },
    pause() {
      state.paused++;
    },
    removeAttribute(key) {
      delete this[key];
    },
    emit(type) {
      for (const fn of listeners.get(type) ?? []) fn();
    },
  };
  return {
    media,
    state,
    options: {
      createMedia: () => media,
      URLImpl: {
        createObjectURL(blob) {
          state.created.push(blob);
          return 'blob:audio-test';
        },
        revokeObjectURL(url) {
          state.revoked.push(url);
        },
      },
    },
    listeners: () => [...listeners.values()].reduce((n, s) => n + s.size, 0),
    cleanupLoads: () => cleanupLoads,
  };
}
test('browser probe waits for first decoded data, never plays, and revokes its owned URL', async () => {
  const h = mediaHarness(),
    pending = probeMP3Media(original, h.options);
  let done = false;
  pending.then(() => (done = true));
  h.media.readyState = 1;
  h.media.duration = 11520 / 44100;
  h.media.emit('loadedmetadata');
  await Promise.resolve();
  assert.equal(done, false);
  h.media.readyState = 2;
  h.media.emit('loadeddata');
  assert.deepEqual(await pending, { durationSeconds: 11520 / 44100 });
  assert.equal(h.state.played, 0);
  assert.equal(h.state.paused, 1);
  assert.equal(h.cleanupLoads(), 1);
  assert.equal(h.listeners(), 0);
  assert.deepEqual(h.state.revoked, ['blob:audio-test']);
});
test('browser decode error and timeout clean up resources with no successful result', async () => {
  const h = mediaHarness(),
    pending = probeMP3Media(original, h.options);
  h.media.emit('error');
  await assert.rejects(pending, /decode/);
  assert.equal(h.listeners(), 0);
  assert.equal(h.state.revoked.length, 1);
  const timeout = mediaHarness();
  await assert.rejects(probeMP3Media(original, { ...timeout.options, timeoutMs: 1 }), /timed out/);
  assert.equal(timeout.state.revoked.length, 1);
});
test('cancelled browser probe ignores late media events and cleans up exactly once', async () => {
  const h = mediaHarness(),
    controller = new AbortController(),
    pending = probeMP3Media(original, { ...h.options, signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  h.media.readyState = 2;
  h.media.duration = 1;
  h.media.emit('loadeddata');
  assert.equal(h.state.revoked.length, 1);
  assert.equal(h.listeners(), 0);
});
test('unsupported codec never creates an object URL; invalid decoded duration never succeeds', async () => {
  const h = mediaHarness();
  h.media.canPlayType = () => '';
  assert.throws(() => probeMP3Media(original, h.options), /does not support/);
  assert.equal(h.state.created.length, 0);
  const invalid = mediaHarness(),
    pending = probeMP3Media(original, invalid.options);
  invalid.media.readyState = 2;
  invalid.media.duration = Infinity;
  invalid.media.emit('loadeddata');
  await assert.rejects(pending, /duration/);
});
