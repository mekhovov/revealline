import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOverflightReviewAudioTap,
  createOverflightReviewRecorder,
} from '../overflight/review-recorder.mjs';

const track = () => ({
  stopped: 0,
  stop() {
    this.stopped++;
  },
  clone() {
    return track();
  },
});
function mix() {
  const original = track();
  const destination = { stream: { getTracks: () => [original], getAudioTracks: () => [original] } };
  const audible = {};
  const connections = new Set([audible]);
  const compressor = {
    connect: (n) => connections.add(n),
    disconnect: (n) => {
      assert.ok(n, 'capture must never disconnect all audible output');
      connections.delete(n);
    },
  };
  const sound = {
    context: { state: 'running', createMediaStreamDestination: () => destination },
    compressor,
    master: {
      connect() {
        assert.fail('prefer the post-master compressor');
      },
    },
  };
  return { sound, original, destination, connections, audible };
}
function harness({ constructThrows = false, startThrows = false, attachThrows = false } = {}) {
  const video = track();
  const tracks = [video],
    timers = new Map(),
    instances = [];
  const stream = {
    getTracks: () => tracks,
    addTrack: (t) => {
      if (attachThrows) throw Error('attach');
      tracks.push(t);
    },
  };
  class MediaRecorder {
    static isTypeSupported(type) {
      return type.startsWith('video/webm');
    }
    constructor(stream, options) {
      if (constructThrows) throw Error('constructor');
      this.stream = stream;
      this.mimeType = options.mimeType;
      this.state = 'inactive';
      instances.push(this);
    }
    start() {
      if (startThrows) throw Error('start');
      this.state = 'recording';
    }
    stop() {
      this.state = 'inactive';
      this.onstop?.();
    }
  }
  let nextTimer = 0;
  const window = {
    MediaRecorder,
    Blob,
    URL: { createObjectURL: () => 'blob:capture', revokeObjectURL() {} },
    setTimeout(fn, ms) {
      const id = ++nextTimer;
      timers.set(id, { fn, ms });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
  };
  return { window, video, tracks, timers, instances, canvas: { captureStream: () => stream } };
}

test('audio tap branches after shared master and only disconnects its owned destination', () => {
  const h = mix();
  const tap = createOverflightReviewAudioTap(h.sound);
  assert.deepEqual(tap.tracks, [h.original]);
  assert.equal(h.connections.size, 2);
  tap.dispose();
  tap.dispose();
  assert.deepEqual([...h.connections], [h.audible]);
  assert.equal(h.original.stopped, 1);
  const fallback = mix();
  fallback.sound.master = fallback.sound.compressor;
  delete fallback.sound.compressor;
  const fallbackTap = createOverflightReviewAudioTap(fallback.sound);
  assert.ok(fallbackTap);
  fallbackTap.dispose();
  assert.equal(createOverflightReviewAudioTap({}), null);
  assert.equal(createOverflightReviewAudioTap({ context: { state: 'closed' } }), null);
});

test('unavailable audio capture releases its destination without touching normal playback', () => {
  const h = mix();
  h.sound.compressor.connect = () => {
    throw Error('unsupported destination');
  };
  assert.equal(createOverflightReviewAudioTap(h.sound), null);
  assert.equal(h.original.stopped, 1);
  assert.deepEqual([...h.connections], [h.audible]);
});

test('review capture clones game audio, keeps its limit and releases clones and tap once on completion', () => {
  const h = harness(),
    audio = mix();
  const recorder = createOverflightReviewRecorder({
    window: h.window,
    getAudio: () => createOverflightReviewAudioTap(audio.sound),
  });
  assert.equal(recorder.record(h.canvas), true);
  assert.equal(recorder.snapshot().audio, true);
  assert.equal(h.tracks.length, 2);
  assert.notEqual(
    h.tracks[1],
    audio.original,
    'never put a shared source track directly in the recorder',
  );
  assert.match(h.instances[0].mimeType, /opus/);
  assert.equal([...h.timers.values()][0].ms, 20000);
  h.instances[0].ondataavailable({ data: new Blob(['picture+sound']) });
  [...h.timers.values()][0].fn();
  assert.equal(recorder.snapshot().phase, 'ready');
  assert.equal(recorder.snapshot().audio, true);
  assert.equal(h.video.stopped, 1);
  assert.equal(h.tracks[1].stopped, 1);
  assert.equal(audio.original.stopped, 1);
  assert.deepEqual([...audio.connections], [audio.audible]);
  recorder.dispose();
  assert.equal(audio.original.stopped, 1);
});

for (const failure of ['cancel', 'error', 'oversize', 'constructor', 'start', 'attach'])
  test(`review audio is owned and released after ${failure}`, () => {
    const h = harness({
      constructThrows: failure === 'constructor',
      startThrows: failure === 'start',
      attachThrows: failure === 'attach',
    });
    const audio = mix();
    let detachedClone;
    audio.original.clone = () => {
      detachedClone = track();
      return detachedClone;
    };
    const recorder = createOverflightReviewRecorder({
      window: h.window,
      getAudio: () => createOverflightReviewAudioTap(audio.sound),
    });
    const started = recorder.record(h.canvas);
    if (['constructor', 'start', 'attach'].includes(failure)) assert.equal(started, false);
    else {
      assert.equal(started, true);
      if (failure === 'cancel') recorder.cancel();
      if (failure === 'error') h.instances[0].onerror();
      if (failure === 'oversize')
        h.instances[0].ondataavailable({ data: new Blob([new Uint8Array(16 * 1024 * 1024 + 1)]) });
    }
    assert.equal(audio.original.stopped, 1);
    assert.equal(detachedClone.stopped, 1);
    assert.equal(h.video.stopped, 1);
    assert.equal(h.timers.size, 0);
    assert.deepEqual([...audio.connections], [audio.audible]);
  });
