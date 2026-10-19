import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as tick } from 'node:timers/promises';
import {
  createReactionVoiceCache,
  inspectReactionRecording,
} from '../journey/reaction-voice-cache.mjs';
import { createMediaPreparation } from '../ui/media-preparation.mjs';

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

function pcmWav() {
  const buffer = new ArrayBuffer(8044),
    bytes = new Uint8Array(buffer),
    view = new DataView(buffer);
  const text = (offset, value) => {
    for (let index = 0; index < value.length; index++)
      bytes[offset + index] = value.charCodeAt(index);
  };
  text(0, 'RIFF');
  view.setUint32(4, buffer.byteLength - 8, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  text(36, 'data');
  view.setUint32(40, 8000, true);
  return buffer;
}

function mediaOwner(t) {
  const state = { created: 0, urls: [], revoked: [], pauses: 0 };
  class Media extends EventTarget {
    duration = 1;
    src = '';
    load() {
      if (this.src) this.dispatchEvent(new Event('loadedmetadata'));
    }
    pause() {
      state.pauses++;
    }
    removeAttribute(name) {
      assert.equal(name, 'src');
      this.src = '';
    }
  }
  const document = {
    createElement(tag) {
      assert.equal(tag, 'audio');
      state.created++;
      return new Media();
    },
  };
  t.mock.method(URL, 'createObjectURL', () => {
    const url = `blob:reaction-cancellation-test/${state.urls.length}`;
    state.urls.push(url);
    return url;
  });
  t.mock.method(URL, 'revokeObjectURL', (url) => state.revoked.push(url));
  return { document, state };
}

test('recording cancellation before inspection does not read bytes or create media', async (t) => {
  const controller = new AbortController(),
    { document, state } = mediaOwner(t);
  controller.abort();
  await assert.rejects(
    inspectReactionRecording(
      { size: 16, arrayBuffer: () => assert.fail('Cancelled byte read') },
      { signal: controller.signal, document },
    ),
    { name: 'AbortError' },
  );
  assert.equal(state.created, 0);
  assert.deepEqual(state.urls, []);
});

test('cancellation during byte reading wins over a later malformed container', async (t) => {
  const gate = deferred(),
    controller = new AbortController(),
    { document, state } = mediaOwner(t);
  let reads = 0;
  const inspection = inspectReactionRecording(
    {
      size: 16,
      arrayBuffer() {
        reads++;
        return gate.promise;
      },
    },
    { signal: controller.signal, document },
  );
  const rejected = assert.rejects(inspection, { name: 'AbortError' });
  t.after(async () => {
    controller.abort();
    gate.resolve(new ArrayBuffer(16));
    await Promise.allSettled([inspection, rejected]);
  });
  assert.equal(reads, 1);
  controller.abort();
  // Parsing these bytes would fail container validation. Cancellation must be
  // observed before that work, rather than reported as an unsupported file.
  gate.resolve(new ArrayBuffer(16));
  await rejected;
  assert.equal(state.created, 0);
  assert.deepEqual(state.urls, []);
  assert.deepEqual(state.revoked, []);
});

test('an uncancelled malformed recording retains structural validation', async (t) => {
  const { document, state } = mediaOwner(t);
  await assert.rejects(
    inspectReactionRecording(
      { size: 16, arrayBuffer: async () => new ArrayBuffer(16) },
      { document },
    ),
    (error) => error.name === 'Error' && /mono\/stereo PCM WAV/.test(error.message),
  );
  assert.equal(state.created, 0);
  assert.deepEqual(state.urls, []);
});

test('an uncancelled recording keeps metadata inspection and owned URL cleanup', async (t) => {
  const { document, state } = mediaOwner(t);
  const result = await inspectReactionRecording(new Blob([pcmWav()]), { document });
  assert.deepEqual(result, {
    channels: 1,
    decodeChannels: 1,
    sampleRate: 8000,
    maxDecodedSeconds: 1,
    format: 'pcm-wav',
    duration: 1,
  });
  assert.equal(state.created, 1);
  assert.equal(state.pauses, 1);
  assert.deepEqual(state.revoked, state.urls);
  assert.equal(state.urls.length, 1);
});

test('cache cancellation owns a pending byte read until it settles and starts no media or decode', async (t) => {
  const gate = deferred(),
    { document, state } = mediaOwner(t),
    preparation = createMediaPreparation();
  let reads = 0,
    decodes = 0,
    inspectionError = null;
  const sound = {
    mediaPreparation: preparation,
    audioMaster: { muted: false, volume: 1 },
    context: {
      sampleRate: 8000,
      decodeAudioData() {
        decodes++;
        assert.fail('An abandoned recording must not be decoded.');
      },
    },
  };
  const cache = createReactionVoiceCache({
    sound,
    library: { resolve: async () => ({ bytes: new ArrayBuffer(16) }) },
    inspect: async (blob, options) => {
      try {
        return await inspectReactionRecording(
          {
            size: blob.size,
            arrayBuffer() {
              reads++;
              return gate.promise;
            },
          },
          { ...options, document },
        );
      } catch (error) {
        inspectionError = error;
        throw error;
      }
    },
  });
  const loading = cache.load('line', 'en');
  t.after(async () => {
    const cancellation = cache.cancel();
    gate.resolve(new ArrayBuffer(16));
    await Promise.allSettled([cancellation, loading]);
    cache.dispose();
    preparation.close();
  });
  await tick();
  assert.equal(reads, 1);
  assert.equal(cache.snapshot().loading, 1);
  const cancellation = cache.cancel();
  let settled = false;
  cancellation.then(() => (settled = true));
  await tick();
  assert.equal(settled, false, 'The non-cancelable byte read still belongs to the pending load.');
  assert.equal(cache.snapshot().loading, 1);
  gate.resolve(new ArrayBuffer(16));
  assert.equal(await loading, false);
  await cancellation;
  assert.equal(inspectionError?.name, 'AbortError');
  assert.equal(cache.snapshot().loading, 0);
  assert.equal(cache.snapshot().buffers, 0);
  assert.equal(cache.snapshot().decodedBytes, 0);
  assert.equal(preparation.snapshot().reservedDecodeBytes, 0);
  assert.equal(decodes, 0);
  assert.equal(state.created, 0);
  assert.deepEqual(state.urls, []);
});

test('uncancelled demanded speech still prepares while playing with one decode and no playback', async (t) => {
  const { document, state } = mediaOwner(t),
    preparation = createMediaPreparation();
  let reads = 0,
    decodes = 0;
  preparation.setPhase('playing');
  const buffer = { duration: 1, length: 8000, numberOfChannels: 1 };
  const sound = {
    mediaPreparation: preparation,
    audioMaster: { muted: false, volume: 1 },
    context: {
      sampleRate: 8000,
      async decodeAudioData(bytes) {
        decodes++;
        assert.equal(bytes.byteLength, 8044);
        return buffer;
      },
    },
    playDialogue: () => assert.fail('Loading cannot schedule speech.'),
  };
  const cache = createReactionVoiceCache({
    sound,
    library: {
      async resolve() {
        reads++;
        return { bytes: pcmWav(), mime: 'audio/wav' };
      },
    },
    inspect: (blob, options) => inspectReactionRecording(blob, { ...options, document }),
  });
  t.after(() => {
    cache.dispose();
    preparation.close();
  });
  assert.equal(await cache.load('line', 'en'), true);
  assert.equal(reads, 1);
  assert.equal(decodes, 1);
  assert.equal(cache.get('line', 'en'), buffer);
  assert.equal(cache.snapshot().loading, 0);
  assert.equal(cache.snapshot().decodedBytes, 32000);
  await tick();
  assert.equal(preparation.snapshot().reservedDecodeBytes, 0);
  assert.equal(preparation.snapshot().phase, 'playing');
  assert.equal(state.created, 1);
  assert.deepEqual(state.revoked, state.urls);
});
