import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  createMediabunnyTrimAdapter,
  inspectMediabunnyAudioTracks,
  MEDIABUNNY_TRIM_VERSION,
} from '../mediabunny-trim-adapter.mjs';

const original = new Blob(['owned silent avc mp4'], { type: 'video/mp4' });
const webm = new Blob(['owned silent vp9 webm'], { type: 'video/webm' });
const info = Object.freeze({ mime: 'video/mp4', width: 640, height: 360 });
const webmInfo = Object.freeze({ mime: 'video/webm', width: 640, height: 360 });
const range = Object.freeze({ startSeconds: 1, endSeconds: 4 });

test('vendored browser module matches the exact pinned dependency and provenance hash', async () => {
  const [packageJson, provenance, bundle] = await Promise.all([
    readFile(new URL('../../package.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../vendor/mediabunny-1.59.1.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../vendor/mediabunny-1.59.1.min.mjs', import.meta.url)),
  ]);
  assert.equal(packageJson.dependencies.mediabunny, '1.59.1');
  assert.equal(provenance.version, MEDIABUNNY_TRIM_VERSION);
  assert.equal(createHash('sha256').update(bundle).digest('hex'), provenance.artifactSha256);
});

function fakeLibrary({
  audio = false,
  codec = 'avc',
  decodable = true,
  encodable = true,
  width = 640,
  height = 360,
} = {}) {
  const MP4 = Object.freeze({ name: 'mp4' });
  const WEBM = Object.freeze({ name: 'webm' });
  const state = {
    canceled: 0,
    disposed: 0,
    executed: 0,
    options: null,
    inputFormats: [],
    encodeProbes: [],
  };
  const video = {
    type: 'video',
    getCodec: async () => codec,
    getDisplayWidth: async () => width,
    getDisplayHeight: async () => height,
    canDecode: async () => decodable,
  };
  class Input {
    constructor({ formats }) {
      state.inputFormats.push(formats);
    }
    async getTracks() {
      return audio ? [video, { type: 'audio', getCodec: async () => 'aac' }] : [video];
    }
    async getPrimaryVideoTrack() {
      return video;
    }
    dispose() {
      state.disposed++;
    }
  }
  class BufferTarget {
    buffer = null;
  }
  class Output {
    constructor({ target }) {
      this.target = target;
    }
  }
  class Conversion {
    static async init(options) {
      state.options = options;
      return new Conversion(options.output.target);
    }
    constructor(target) {
      this.target = target;
      this.state = 'idle';
      this.isValid = true;
      this.discardedTracks = [];
    }
    async execute() {
      state.executed++;
      this.target.buffer = Uint8Array.from([0, 0, 0, 20, 102, 116, 121, 112]).buffer;
      this.state = 'done';
    }
    async cancel() {
      state.canceled++;
      this.state = 'canceled';
    }
  }
  return {
    state,
    library: {
      Input,
      BlobSource: class {},
      MP4,
      WEBM,
      BufferTarget,
      Output,
      Mp4OutputFormat: class {},
      Conversion,
      canEncodeVideo: async (_codec, options) => {
        state.encodeProbes.push(options);
        return encodable;
      },
    },
  };
}

test('Mediabunny adapter remains lazy until physical trim capability is requested', async () => {
  const fake = fakeLibrary();
  let loads = 0;
  const adapter = createMediabunnyTrimAdapter({
    loadLibrary: async () => {
      loads++;
      return fake.library;
    },
  });
  assert.equal(MEDIABUNNY_TRIM_VERSION, '1.59.1');
  assert.equal(loads, 0);
  const supported = await adapter.support(original, info, range);
  assert.equal(loads, 1);
  assert.deepEqual(supported.formats, ['video/mp4']);
  assert.match(supported.detail, /Mediabunny 1\.59\.1.*silent AVC\/H\.264 MP4/);
  assert.equal(fake.state.canceled, 1, 'Capability probing cancels its unexecuted output.');
  assert.equal(fake.state.disposed, 1);
});

test('audio inventory authenticates exact bytes and reports container tracks without sync claims', async () => {
  const silent = fakeLibrary();
  const silentResult = await inspectMediabunnyAudioTracks(original, {
    loadLibrary: async () => silent.library,
  });
  assert.equal(silentResult.format, 'revealline-media-track-inspection.v1');
  assert.equal(silentResult.bytes, original.size);
  assert.equal(
    silentResult.sha256,
    createHash('sha256')
      .update(Buffer.from(await original.arrayBuffer()))
      .digest('hex'),
  );
  assert.equal(silentResult.audioTrackCount, 0);
  assert.deepEqual(silentResult.codecs, []);
  assert.equal(silentResult.videoTrackCount, 1);
  assert.deepEqual(silentResult.videoCodecs, ['avc']);
  assert.equal(silent.state.disposed, 1);

  const withAudio = fakeLibrary({ audio: true });
  const audioResult = await inspectMediabunnyAudioTracks(original, {
    loadLibrary: async () => withAudio.library,
  });
  assert.equal(audioResult.audioTrackCount, 1);
  assert.deepEqual(audioResult.codecs, ['aac']);
  assert.deepEqual(audioResult.videoCodecs, ['avc']);
  assert.equal(withAudio.state.disposed, 1);
  assert.equal('synchronization' in audioResult, false);

  const silentWebm = fakeLibrary({ codec: 'vp9' });
  const webmResult = await inspectMediabunnyAudioTracks(webm, {
    loadLibrary: async () => silentWebm.library,
  });
  assert.equal(webmResult.audioTrackCount, 0);
  assert.equal(webmResult.videoTrackCount, 1);
  assert.deepEqual(webmResult.videoCodecs, ['vp9']);
  assert.equal(
    webmResult.sha256,
    createHash('sha256').update('owned silent vp9 webm').digest('hex'),
  );
  assert.equal(silentWebm.state.inputFormats[0][0], silentWebm.library.WEBM);
});

test('Mediabunny adapter physically re-encodes only the selected range and reports absent audio', async () => {
  const fake = fakeLibrary();
  const adapter = createMediabunnyTrimAdapter({ loadLibrary: async () => fake.library });
  const result = await adapter.trim(original, range);
  assert.equal(result.blob.type, 'video/mp4');
  assert.equal(result.blob.size, 8);
  assert.equal(result.audioSync.status, 'not-present');
  assert.equal(fake.state.executed, 1);
  assert.equal(fake.state.options.trim.start, 1);
  assert.equal(fake.state.options.trim.end, 4);
  assert.equal(fake.state.options.video.codec, 'avc');
  assert.equal(fake.state.options.video.forceTranscode, true);
  assert.deepEqual(fake.state.options.tags, {});
  assert.equal(fake.state.disposed, 2, 'The dimension probe and conversion input are released.');
});

test('silent browser-decodable WebM is converted to AVC MP4 with the same bounded checks', async () => {
  const fake = fakeLibrary({ codec: 'vp9' });
  const adapter = createMediabunnyTrimAdapter({ loadLibrary: async () => fake.library });
  const supported = await adapter.support(webm, webmInfo, range);
  assert.equal(supported.supported, true);
  assert.deepEqual(supported.formats, ['video/mp4']);
  assert.match(supported.detail, /silent VP9 WebM.*AVC MP4/);
  assert.equal(fake.state.inputFormats[0][0], fake.library.WEBM);

  const result = await adapter.trim(webm, range);
  assert.equal(result.blob.type, 'video/mp4');
  assert.equal(fake.state.options.video.codec, 'avc');
  assert.equal(fake.state.options.video.forceTranscode, true);
  assert.equal(fake.state.inputFormats.at(-1)[0], fake.library.WEBM);
});

test('bounded resize/compression plan is passed to the encoder and capability probe', async () => {
  const fake = fakeLibrary({ width: 1280, height: 720 });
  const adapter = createMediabunnyTrimAdapter({ loadLibrary: async () => fake.library });
  const largeInfo = { ...info, width: 1280, height: 720 };
  const transform = {
    profile: 'compact',
    width: 640,
    height: 360,
    targetVideoBitrate: 900_000,
  };
  const supported = await adapter.support(original, largeInfo, range, { transform });
  assert.equal(supported.supported, true);
  assert.match(supported.detail, /640 × 360.*0\.9 Mbit\/s target/);
  assert.deepEqual(fake.state.encodeProbes[0], {
    width: 640,
    height: 360,
    bitrate: 900_000,
  });

  await adapter.trim(original, range, { transform });
  assert.equal(fake.state.options.video.width, 640);
  assert.equal(fake.state.options.video.height, 360);
  assert.equal(fake.state.options.video.fit, 'contain');
  assert.equal(fake.state.options.video.bitrate, 900_000);
  assert.equal(fake.state.options.video.allowTransformationMetadata, false);
});

test('rotated source display dimensions drive an exact portrait transform plan', async () => {
  const fake = fakeLibrary({ width: 360, height: 640 });
  const adapter = createMediabunnyTrimAdapter({ loadLibrary: async () => fake.library });
  const mismatched = await adapter.support(original, info, range);
  assert.equal(mismatched.supported, false);
  assert.match(mismatched.reason, /display dimensions differ/);
  const portraitInfo = { ...info, width: 360, height: 640 };
  const transform = {
    profile: 'compact',
    width: 202,
    height: 358,
    targetVideoBitrate: 900_000,
  };
  const supported = await adapter.support(original, portraitInfo, range, { transform });
  assert.equal(supported.supported, true);
  assert.match(supported.detail, /202 × 358.*0\.9 Mbit\/s target/);
  assert.deepEqual(fake.state.encodeProbes[0], {
    width: 202,
    height: 358,
    bitrate: 900_000,
  });

  await adapter.trim(original, range, { transform });
  assert.equal(fake.state.options.video.width, 202);
  assert.equal(fake.state.options.video.height, 358);
  assert.equal(fake.state.options.video.fit, 'contain');
  assert.equal(fake.state.options.video.allowTransformationMetadata, false);
});

test('resize/compression plans cannot upscale, change orientation/aspect, or escape bitrate bounds', async () => {
  for (const transform of [
    { profile: 'compact', width: 1280, height: 720, targetVideoBitrate: 900_000 },
    { profile: 'compact', width: 320, height: 320, targetVideoBitrate: 900_000 },
    { profile: 'compact', width: 180, height: 320, targetVideoBitrate: 900_000 },
    { profile: 'compact', width: 320, height: 180, targetVideoBitrate: 100_000 },
  ]) {
    const fake = fakeLibrary();
    const adapter = createMediabunnyTrimAdapter({ loadLibrary: async () => fake.library });
    await assert.rejects(adapter.support(original, info, range, { transform }), /bounded/);
    assert.equal(fake.state.executed, 0);
  }
});

test('audio, undecodable and unencodable sources stay explicitly unsupported', async () => {
  for (const [options, message] of [
    [{ audio: true }, /contains audio.*independently verified/i],
    [{ codec: 'vp9', decodable: false }, /cannot decode.*vp9/i],
    [{ encodable: false }, /cannot encode/],
  ]) {
    const fake = fakeLibrary(options);
    const adapter = createMediabunnyTrimAdapter({ loadLibrary: async () => fake.library });
    const capability = await adapter.support(original, info, range);
    assert.equal(capability.supported, false);
    assert.match(capability.reason, message);
    assert.equal(fake.state.executed, 0);
  }
});

test('trim cancellation cancels conversion and releases input', async () => {
  const fake = fakeLibrary();
  let release;
  fake.library.Conversion.prototype.execute = async function () {
    fake.state.executed++;
    await new Promise((resolve) => {
      release = resolve;
    });
    if (this.state === 'canceled') throw new Error('conversion canceled');
  };
  fake.library.Conversion.prototype.cancel = async function () {
    fake.state.canceled++;
    this.state = 'canceled';
    release?.();
  };
  const adapter = createMediabunnyTrimAdapter({ loadLibrary: async () => fake.library });
  const controller = new AbortController();
  const pending = adapter.trim(original, range, { signal: controller.signal });
  while (!release) await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(fake.state.canceled, 1);
  assert.equal(fake.state.disposed, 2);
});
