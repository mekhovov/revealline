import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  createMediabunnyTrimAdapter,
  MEDIABUNNY_TRIM_VERSION,
} from '../mediabunny-trim-adapter.mjs';

const original = new Blob(['owned silent avc mp4'], { type: 'video/mp4' });
const info = Object.freeze({ mime: 'video/mp4', width: 640, height: 360 });
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

function fakeLibrary({ audio = false, codec = 'avc', decodable = true, encodable = true } = {}) {
  const state = { canceled: 0, disposed: 0, executed: 0, options: null };
  const video = {
    type: 'video',
    getCodec: async () => codec,
    getDisplayWidth: async () => 640,
    getDisplayHeight: async () => 360,
    canDecode: async () => decodable,
  };
  class Input {
    constructor() {}
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
      MP4: {},
      BufferTarget,
      Output,
      Mp4OutputFormat: class {},
      Conversion,
      canEncodeVideo: async () => encodable,
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
  assert.match(supported.detail, /Mediabunny 1\.59\.1.*silent AVC MP4/);
  assert.equal(fake.state.canceled, 1, 'Capability probing cancels its unexecuted output.');
  assert.equal(fake.state.disposed, 1);
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

test('audio, non-AVC, undecodable and unencodable sources stay explicitly unsupported', async () => {
  for (const [options, message] of [
    [{ audio: true }, /contains audio.*independently verified/i],
    [{ codec: 'vp9' }, /AVC\/H\.264.*vp9/],
    [{ decodable: false }, /cannot decode/],
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
