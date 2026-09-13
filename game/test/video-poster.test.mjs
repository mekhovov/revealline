import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { openVideoPosterSource, VIDEO_POSTER_LIMITS } from '../video-poster.mjs';
import { deferred, provenance } from './helpers/media-fixtures.mjs';

// Real bounded PNG bytes, but explicit modeled Canvas/media decoding boundaries.
function png(width = 1, height = 1, shade = 80) {
  const chunk = (type, body) => {
    const data = Buffer.concat([Buffer.from(type), body]);
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const result = Buffer.alloc(body.length + 12);
    result.writeUInt32BE(body.length, 0);
    data.copy(result, 4);
    result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
    return result;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const rows = Buffer.alloc((width * 3 + 1) * height, shade);
  for (let y = 0; y < height; y++) rows[y * (width * 3 + 1)] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const mp4 = () =>
  new Blob([Buffer.from('000000146674797069736f6d000000006d703432', 'hex')], {
    type: 'text/plain',
  });
const webm = () => new Blob([Buffer.from('1a45dfa3874282847765626d', 'hex')]);
const metadata = (id = 'video-poster') => ({ id, provenance: provenance() });
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const flush = () => new Promise((resolve) => setImmediate(resolve));
async function until(condition) {
  for (let i = 0; i < 100; i++) {
    if (condition()) return;
    await flush();
  }
  assert.fail('Expected modeled media boundary was not reached.');
}

function harness(options = {}) {
  const videos = [],
    canvases = [],
    liveURLs = new Map(),
    revoked = [],
    pendingTimers = new Map();
  let nextTimer = 1,
    nextURL = 1,
    inFrame = false,
    plays = 0;
  const facts = { width: 1, height: 1, durationSeconds: 8, ...options.facts };
  class Video extends EventTarget {
    constructor() {
      super();
      this.readyState = 0;
      this.duration = NaN;
      this.videoWidth = this.videoHeight = 0;
      this._time = 0;
      this.seeking = false;
      this.paused = true;
      this.callbacks = new Map();
      this.nextFrame = 1;
      this.cancelledFrames = [];
      this.listeners = new Map();
      this.seekable = { length: 0 };
      this.loads = 0;
      this.source = '';
      this.requested = [];
      if (options.fallback)
        this.requestVideoFrameCallback = this.cancelVideoFrameCallback = undefined;
    }
    addEventListener(name, fn, config) {
      super.addEventListener(name, fn, config);
      if (!this.listeners.has(name)) this.listeners.set(name, new Set());
      this.listeners.get(name).add(fn);
    }
    removeEventListener(name, fn) {
      super.removeEventListener(name, fn);
      this.listeners.get(name)?.delete(fn);
    }
    get src() {
      return this.source;
    }
    set src(value) {
      this.source = value;
      if (options.srcError) throw new Error('src refused');
    }
    get currentTime() {
      return this._time;
    }
    set currentTime(value) {
      if (options.seekError) throw new Error('seek refused');
      this.requested.push(value);
      this._time = value;
      this.seeking = true;
    }
    play() {
      plays++;
      throw new Error('Acquisition must never play video.');
    }
    pause() {
      this.paused = true;
    }
    load() {
      this.loads++;
    }
    removeAttribute(name) {
      if (name === 'src') this.source = '';
    }
    requestVideoFrameCallback(fn) {
      const id = this.nextFrame++;
      this.callbacks.set(id, fn);
      return id;
    }
    cancelVideoFrameCallback(id) {
      this.cancelledFrames.push(id);
      this.callbacks.delete(id);
    }
    ranges(values) {
      this.seekable = {
        length: values.length,
        start: (i) => values[i][0],
        end: (i) => values[i][1],
      };
    }
    metadata(values = facts, ranges = [[0, values.durationSeconds]]) {
      this.duration = values.durationSeconds;
      this.videoWidth = values.width;
      this.videoHeight = values.height;
      this.ranges(ranges);
      this.readyState = 1;
      this.dispatchEvent(new Event('loadedmetadata'));
    }
    data() {
      this.readyState = 2;
      this.dispatchEvent(new Event('loadeddata'));
    }
    finishSeek(time = this._time) {
      this._time = time;
      this.seeking = false;
      this.readyState = 2;
      this.dispatchEvent(new Event('seeked'));
    }
    frame(time = this._time, extra = {}) {
      const first = this.callbacks.entries().next().value;
      assert.ok(first, 'An actual frame callback must have been requested.');
      this.callbacks.delete(first[0]);
      inFrame = true;
      try {
        first[1](100, {
          mediaTime: time,
          width: this.videoWidth,
          height: this.videoHeight,
          ...extra,
        });
      } finally {
        inFrame = false;
      }
    }
  }
  const settings = {
    createVideo() {
      const v = new Video();
      videos.push(v);
      return v;
    },
    createCanvas() {
      const canvas = {
        width: 0,
        height: 0,
        calls: [],
        bytes: null,
        getContext() {
          if (options.noContext) return null;
          return {
            drawImage(video, ...args) {
              if (options.drawError) throw new Error('Canvas security failure');
              canvas.calls.push({ args, time: video.currentTime, inFrame, video });
            },
          };
        },
        toBlob(callback, type) {
          assert.equal(type, 'image/png');
          if (options.exportError) throw new Error('PNG encoder failed');
          if (options.hangExport) {
            canvas.callback = callback;
            return;
          }
          canvas.bytes =
            options.bytes ??
            png(canvas.width, canvas.height, Math.floor(canvas.calls[0].time * 10) + 50);
          callback(options.nullExport ? null : new Blob([canvas.bytes], { type: 'image/png' }));
        },
      };
      canvases.push(canvas);
      return canvas;
    },
    URLImpl: {
      createObjectURL(blob) {
        const url = `blob:test-${nextURL++}`;
        liveURLs.set(url, blob);
        return url;
      },
      revokeObjectURL(url) {
        assert.ok(liveURLs.has(url));
        liveURLs.delete(url);
        revoked.push(url);
      },
    },
    async decodeImage(blob, { signal }) {
      if (options.decodeImage) return options.decodeImage(blob, { signal });
      const bytes = Buffer.from(await blob.arrayBuffer());
      return { naturalWidth: bytes.readUInt32BE(16), naturalHeight: bytes.readUInt32BE(20) };
    },
    timers: {
      setTimeout(fn) {
        const id = nextTimer++;
        pendingTimers.set(id, fn);
        return id;
      },
      clearTimeout(id) {
        pendingTimers.delete(id);
      },
    },
  };
  return {
    settings,
    videos,
    canvases,
    liveURLs,
    revoked,
    pendingTimers,
    expire() {
      for (const fn of [...pendingTimers.values()]) fn();
    },
    async open(blob = mp4(), other = {}) {
      const count = videos.length,
        promise = openVideoPosterSource(blob, { ...settings, ...other });
      await until(() => videos.length === count + 1);
      videos.at(-1).metadata();
      return promise;
    },
    async capturing(source, time = 2, other = {}) {
      const count = videos.length,
        promise = source.capture(time, metadata(), other);
      await until(() => videos.length === count + 1);
      const video = videos.at(-1);
      video.metadata();
      await flush();
      return { promise, video };
    },
    clean() {
      assert.equal(plays, 0);
      assert.equal(liveURLs.size, 0);
      assert.equal(pendingTimers.size, 0);
      for (const v of videos) {
        assert.equal(v.source, '');
        assert.equal(v.paused, true);
        assert.equal(v.muted, true);
        assert.equal(v.defaultMuted, true);
        assert.equal(v.volume, 0);
        assert.equal(v.autoplay, false);
        assert.equal(v.callbacks.size, 0);
        assert.equal(
          [...v.listeners.values()].reduce((n, set) => n + set.size, 0),
          0,
        );
      }
    },
  };
}

test('inspection owns original MP4 bytes and hashes, ignores MIME/getters, never plays or stores', async () => {
  const h = harness(),
    blob = mp4(),
    bytes = Buffer.from(await blob.arrayBuffer());
  Object.defineProperties(blob, {
    size: {
      get() {
        assert.fail('caller size getter');
      },
    },
    arrayBuffer: {
      value() {
        assert.fail('caller byte reader');
      },
    },
    type: {
      get() {
        assert.fail('caller MIME getter');
      },
    },
  });
  const source = await h.open(blob);
  assert.equal(source.info.sha256, digest(bytes));
  assert.equal(source.info.mime, 'video/mp4');
  assert.equal(source.info.bytes, bytes.length);
  assert.ok(Object.isFrozen(source.info));
  assert.deepEqual(Buffer.from(await source.original.arrayBuffer()), bytes);
  source.dispose();
  h.clean();
});

test('bounded EBML DocType screening admits WebM only after browser metadata', async () => {
  const h = harness(),
    source = await h.open(webm());
  assert.equal(source.info.mime, 'video/webm');
  h.clean();
  source.dispose();
});

test('invalid container and oversized source fail before media allocation', async () => {
  const h = harness();
  for (const blob of [
    new Blob([]),
    new Blob(['not video']),
    new Blob([new Uint8Array(VIDEO_POSTER_LIMITS.sourceBytes + 1)]),
    new Blob([Buffer.from('1a45dfa3884282847765626d', 'hex')]),
    new Blob([Buffer.from('000000406674797069736f6d00000000', 'hex')]),
  ]) {
    await assert.rejects(openVideoPosterSource(blob, h.settings), /budget|container|header/);
  }
  assert.equal(h.videos.length, 0);
  h.clean();
});

for (const [label, change, error] of [
  ['unbounded duration', { durationSeconds: Infinity }, /finite duration/],
  ['long clip', { durationSeconds: 121 }, /120 seconds/],
  ['audio-only', { width: 0 }, /picture/],
  ['oversized picture', { width: 1921 }, /1920/],
])
  test(`inspection rejects ${label} without truncation`, async () => {
    const h = harness({ facts: change });
    await assert.rejects(h.open(), error);
    h.clean();
  });

test('browser codec error is explicit and removes owned source/listeners', async () => {
  const h = harness(),
    pending = openVideoPosterSource(mp4(), h.settings);
  const rejected = assert.rejects(pending, /codec/);
  await until(() => h.videos.length);
  h.videos[0].dispatchEvent(new Event('error'));
  await rejected;
  h.clean();
});

test('rVFC captures inside callback with observed time distinct from requested/currentTime', async () => {
  const h = harness(),
    source = await h.open(),
    { promise, video } = await h.capturing(source, 2.1);
  video.finishSeek(2.09);
  video.frame(2.067);
  const result = await promise;
  assert.equal(result.capture.requestedTime, 2.1);
  assert.equal(result.capture.observedMediaTime, 2.067);
  assert.equal(result.capture.playheadTime, 2.09);
  assert.equal(result.capture.timingEvidence, 'presented-frame');
  assert.equal(h.canvases[0].calls[0].inFrame, true);
  assert.deepEqual(Buffer.from(await result.blob.arrayBuffer()), h.canvases[0].bytes);
  assert.equal(result.capture.sha256, digest(h.canvases[0].bytes));
  assert.equal(result.asset.sha256, result.capture.sha256);
  assert.equal(result.capture.sourceSha256, source.info.sha256);
  assert.ok(Object.isFrozen(result.capture));
  h.clean();
  source.dispose();
});

test('initial frame at zero can arrive before metadata promise resumes without seeking or play', async () => {
  const h = harness(),
    source = await h.open(),
    promise = source.capture(0, metadata());
  await until(() => h.videos.length === 2);
  const video = h.videos[1];
  video.metadata();
  video.data();
  video.frame(0);
  const result = await promise;
  assert.equal(result.capture.observedMediaTime, 0);
  assert.deepEqual(video.requested, []);
  h.clean();
  source.dispose();
});

test('non-rVFC fallback saves exact PNG but records unavailable frame time and approximate playhead', async () => {
  const h = harness({ fallback: true }),
    source = await h.open(),
    { promise, video } = await h.capturing(source, 2);
  video.finishSeek(1.999);
  const result = await promise;
  assert.equal(result.capture.observedMediaTime, null);
  assert.equal(result.capture.decodedFrame, null);
  assert.equal(result.capture.timingEvidence, 'playhead-estimate');
  assert.equal(result.capture.playheadTime, 1.999);
  assert.equal(h.canvases[0].calls[0].inFrame, false);
  assert.deepEqual(Buffer.from(await result.blob.arrayBuffer()), h.canvases[0].bytes);
  h.clean();
  source.dispose();
});

test('video display aspect and complete pixels survive differing decoded sample dimensions', async () => {
  const h = harness({ facts: { width: 4, height: 2 } }),
    source = await h.open();
  const { promise, video } = await h.capturing(source);
  video.finishSeek();
  video.frame(2, { width: 3, height: 2 });
  const result = await promise;
  assert.deepEqual(h.canvases[0].calls[0].args, [0, 0, 4, 2]);
  assert.deepEqual(result.capture.decodedFrame, { width: 3, height: 2 });
  assert.equal(result.asset.width, 4);
  assert.equal(result.asset.height, 2);
  h.clean();
  source.dispose();
});

test('invalid requested times and metadata getters allocate no capture decoder', async () => {
  const h = harness(),
    source = await h.open();
  for (const time of [-1, NaN, Infinity, 8.001, '2'])
    await assert.rejects(source.capture(time, metadata()), /Poster time/);
  await assert.rejects(
    source.capture(2, {
      get id() {
        assert.fail('metadata getter');
      },
      provenance: provenance(),
    }),
  );
  assert.equal(h.videos.length, 1);
  h.clean();
  source.dispose();
});

test('seek gaps reject requested frame rather than clamp or publish a staged initial frame', async () => {
  const h = harness(),
    source = await h.open(),
    pending = source.capture(0, metadata());
  const rejected = assert.rejects(pending, /seek ranges/);
  await until(() => h.videos.length === 2);
  const v = h.videos[1];
  v.metadata(undefined, [[1, 8]]);
  v.data();
  v.frame(0);
  await rejected;
  assert.deepEqual(v.requested, []);
  h.clean();
  source.dispose();
});

test('late seek ranges can become ready; missing ranges time out without guessed seek', async () => {
  const h = harness(),
    source = await h.open(),
    first = source.capture(2, metadata());
  await until(() => h.videos.length === 2);
  const v = h.videos[1];
  v.metadata(undefined, []);
  await flush();
  assert.deepEqual(v.requested, []);
  v.ranges([[0, 8]]);
  v.dispatchEvent(new Event('progress'));
  await flush();
  assert.deepEqual(v.requested, [2]);
  v.finishSeek();
  v.frame();
  await first;
  const second = source.capture(2, metadata()),
    rejected = assert.rejects(second, { name: 'TimeoutError' });
  await until(() => h.videos.length === 3);
  h.videos[2].metadata(undefined, []);
  h.expire();
  await rejected;
  h.clean();
  source.dispose();
});

test('a rejected native seek remains explicit', async () => {
  const h = harness({ seekError: true }),
    source = await h.open();
  const pending = source.capture(2, metadata()),
    rejected = assert.rejects(pending, /seek refused/);
  await until(() => h.videos.length === 2);
  h.videos[1].metadata();
  await rejected;
  h.clean();
  source.dispose();
});

test('new capture cancels old metadata work; stale ready callbacks cannot adopt late pixels', async () => {
  const h = harness(),
    source = await h.open(),
    old = source.capture(1, metadata('old'));
  const rejected = assert.rejects(old, { name: 'AbortError' });
  await until(() => h.videos.length === 2);
  const stale = [...h.videos[1].listeners.get('loadedmetadata')];
  const next = await h.capturing(source, 3);
  await rejected;
  h.videos[1].metadata();
  stale.forEach((fn) => fn(new Event('loadedmetadata')));
  next.video.finishSeek();
  next.video.frame(3);
  const result = await next.promise;
  assert.equal(result.capture.requestedTime, 3);
  assert.equal(h.canvases.length, 1);
  h.clean();
  source.dispose();
});

test('cancelled seek/frame callbacks never affect the new independent decoder', async () => {
  const h = harness(),
    source = await h.open(),
    old = await h.capturing(source, 1);
  const rejected = assert.rejects(old.promise, { name: 'AbortError' });
  const staleFrame = [...old.video.callbacks.values()][0],
    staleSeek = [...old.video.listeners.get('seeked')];
  const next = await h.capturing(source, 4);
  await rejected;
  old.video.finishSeek();
  staleSeek.forEach((fn) => fn(new Event('seeked')));
  staleFrame(3, { mediaTime: 1, width: 1, height: 1 });
  assert.equal(h.canvases.length, 0);
  next.video.finishSeek();
  next.video.frame(4);
  const result = await next.promise;
  assert.equal(result.capture.observedMediaTime, 4);
  assert.notEqual(old.video, next.video);
  h.clean();
  source.dispose();
});

test('queued initial-frame callback is invalidated before nonzero seek even after seeked', async () => {
  const h = harness(),
    source = await h.open(),
    pending = source.capture(2, metadata());
  await until(() => h.videos.length === 2);
  const video = h.videos[1],
    old = [...video.callbacks.values()][0];
  video.metadata();
  await until(() => video.requested.length);
  video.finishSeek();
  old(0, { mediaTime: 0, width: 1, height: 1 });
  await flush();
  assert.equal(h.canvases.length, 0);
  assert.equal(video.callbacks.size, 1, 'Stale callback must not rearm another registration.');
  video.frame(1.967);
  const result = await pending;
  assert.equal(result.capture.observedMediaTime, 1.967);
  assert.equal(h.canvases.length, 1);
  h.clean();
  source.dispose();
});

test('dispose cancels pending PNG export and ignores a late encoder result', async () => {
  const h = harness({ hangExport: true }),
    source = await h.open(),
    capture = await h.capturing(source);
  const rejected = assert.rejects(capture.promise, { name: 'AbortError' });
  capture.video.finishSeek();
  capture.video.frame();
  await until(() => h.canvases[0]?.callback);
  source.dispose();
  await rejected;
  h.canvases[0].callback(new Blob([png()], { type: 'image/png' }));
  await flush();
  await assert.rejects(source.capture(1, metadata()), /disposed/);
  h.clean();
});

test('new capture aborts native still decode signal and late decoder completion cannot win', async () => {
  const pending = deferred();
  let signal,
    calls = 0;
  const h = harness({
    decodeImage: async (_blob, opts) => {
      calls++;
      if (calls === 1) {
        signal = opts.signal;
        return pending.promise;
      }
      return { naturalWidth: 1, naturalHeight: 1 };
    },
  });
  const source = await h.open(),
    old = await h.capturing(source, 1);
  const rejected = assert.rejects(old.promise, { name: 'AbortError' });
  old.video.finishSeek();
  old.video.frame();
  await until(() => signal);
  const next = await h.capturing(source, 2);
  await rejected;
  assert.equal(signal.aborted, true);
  pending.resolve({ naturalWidth: 1, naturalHeight: 1 });
  next.video.finishSeek();
  next.video.frame(2);
  assert.equal((await next.promise).capture.requestedTime, 2);
  h.clean();
  source.dispose();
});

test('external cancellation at metadata and seek boundaries releases owned decoders', async () => {
  const h = harness(),
    controller = new AbortController(),
    opening = openVideoPosterSource(mp4(), { ...h.settings, signal: controller.signal });
  const rejected = assert.rejects(opening, { name: 'AbortError' });
  await until(() => h.videos.length);
  controller.abort();
  await rejected;
  h.clean();
  const source = await h.open(),
    seeking = new AbortController(),
    capture = await h.capturing(source, 2, { signal: seeking.signal });
  const rejectedCapture = assert.rejects(capture.promise, { name: 'AbortError' });
  seeking.abort();
  await rejectedCapture;
  h.clean();
  source.dispose();
});

test('metadata and frame timeouts are explicit and remove callback/listener/URL ownership', async () => {
  const h = harness(),
    opening = openVideoPosterSource(mp4(), h.settings);
  const failed = assert.rejects(opening, { name: 'TimeoutError' });
  await until(() => h.videos.length);
  h.expire();
  await failed;
  h.clean();
  const source = await h.open(),
    { promise, video } = await h.capturing(source);
  const timed = assert.rejects(promise, { name: 'TimeoutError' });
  video.finishSeek();
  h.expire();
  await timed;
  h.clean();
  source.dispose();
});

for (const [label, options, message] of [
  ['PNG null result', { nullExport: true }, /export a PNG/],
  ['PNG encoder throw', { exportError: true }, /encoder failed/],
  ['canvas security error', { drawError: true }, /security failure/],
  ['missing 2D context', { noContext: true }, /2D capture/],
  ['corrupt exported bytes', { bytes: Buffer.from('not png') }, /PNG\/JPEG/],
  ['wrong exported dimensions', { bytes: png(2, 1) }, /complete captured/],
  [
    'still decoder failure',
    {
      decodeImage() {
        throw new Error('corrupt PNG decode');
      },
    },
    /corrupt PNG decode/,
  ],
])
  test(`${label} preserves an explicit failure and leaves no capture resources`, async () => {
    const h = harness(options),
      source = await h.open(),
      pending = await h.capturing(source);
    const rejected = assert.rejects(pending.promise, message);
    pending.video.finishSeek();
    pending.video.frame();
    await rejected;
    h.clean();
    source.dispose();
  });

test('PNG byte budget rejects before still decoder even when media frame was accepted', async () => {
  let decoded = false;
  const h = harness({
      bytes: new Uint8Array(4 * 1024 * 1024 + 1),
      decodeImage() {
        decoded = true;
      },
    }),
    source = await h.open();
  const pending = await h.capturing(source),
    rejected = assert.rejects(pending.promise, /4 MiB/);
  pending.video.finishSeek();
  pending.video.frame();
  await rejected;
  assert.equal(decoded, false);
  h.clean();
  source.dispose();
});

test('timeout during PNG encoding ignores a late callback and frees the source', async () => {
  const h = harness({ hangExport: true }),
    source = await h.open();
  const next = await h.capturing(source),
    rejected = assert.rejects(next.promise, { name: 'TimeoutError' });
  next.video.finishSeek();
  next.video.frame();
  await until(() => h.canvases[0]?.callback);
  h.expire();
  await rejected;
  h.canvases[0].callback(new Blob([png()], { type: 'image/png' }));
  await flush();
  h.clean();
  source.dispose();
});

test('timeout during still decode aborts its capability and never publishes a late asset', async () => {
  const late = deferred();
  let signal;
  const h = harness({
    decodeImage(_blob, options) {
      signal = options.signal;
      return late.promise;
    },
  });
  const source = await h.open(),
    next = await h.capturing(source);
  const rejected = assert.rejects(next.promise, { name: 'TimeoutError' });
  next.video.finishSeek();
  next.video.frame();
  await until(() => signal);
  h.expire();
  await rejected;
  assert.equal(signal.aborted, true);
  late.resolve({ naturalWidth: 1, naturalHeight: 1 });
  await flush();
  h.clean();
  source.dispose();
});

test('pre-aborted inspection and synchronous source failure leave no live URLs', async () => {
  const controller = new AbortController();
  controller.abort();
  const h = harness();
  await assert.rejects(openVideoPosterSource(mp4(), { ...h.settings, signal: controller.signal }), {
    name: 'AbortError',
  });
  assert.equal(h.videos.length, 0);
  h.clean();
  const broken = harness({ srcError: true });
  await assert.rejects(openVideoPosterSource(mp4(), broken.settings), /src refused/);
  broken.clean();
});

test('repeated selection of the same time captures independently and leaves prior PNG exact', async () => {
  const h = harness(),
    source = await h.open();
  const first = await h.capturing(source, 2);
  first.video.finishSeek();
  first.video.frame(1.98);
  const saved = await first.promise,
    bytes = Buffer.from(await saved.blob.arrayBuffer());
  const next = await h.capturing(source, 2);
  next.video.finishSeek();
  next.video.frame(1.98);
  const again = await next.promise;
  assert.notEqual(next.video, first.video);
  assert.deepEqual(Buffer.from(await saved.blob.arrayBuffer()), bytes);
  assert.deepEqual(Buffer.from(await again.blob.arrayBuffer()), bytes);
  assert.equal(again.capture.observedMediaTime, 1.98);
  h.clean();
  source.dispose();
});

test('changed decoded metadata and invalid callback timestamps fail instead of minting provenance', async () => {
  const h = harness(),
    source = await h.open(),
    pending = source.capture(2, metadata());
  const changed = assert.rejects(pending, /metadata changed/);
  await until(() => h.videos.length === 2);
  h.videos[1].metadata({ width: 2, height: 1, durationSeconds: 8 });
  await changed;
  const next = await h.capturing(source),
    bad = assert.rejects(next.promise, /timestamp/);
  next.video.finishSeek();
  next.video.frame(NaN);
  await bad;
  h.clean();
  source.dispose();
});

test('late browser metadata revisions reject before drawing a poster with mismatched source facts', async () => {
  const h = harness(),
    source = await h.open();
  for (const revision of [{ videoWidth: 2 }, { duration: 9 }]) {
    const next = await h.capturing(source),
      rejected = assert.rejects(next.promise, /metadata changed before/);
    next.video.finishSeek();
    Object.assign(next.video, revision);
    next.video.frame();
    await rejected;
  }
  assert.equal(h.canvases.length, 0);
  h.clean();
  source.dispose();
});
