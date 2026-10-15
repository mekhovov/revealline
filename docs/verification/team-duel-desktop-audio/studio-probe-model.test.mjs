import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDefaultThemeBundle } from '../../../game/presentation/catalog.mjs';
import { reviseStudioTheme } from '../../../game/presentation/studio-session.mjs';
import { resolvePresentation } from '../../../game/presentation/model.mjs';
import {
  exportThemeBundle,
  importThemeBundle,
  hashPresentationBytes,
} from '../../../game/presentation/bundle.mjs';
import { audioHarness } from '../../../game/test/helpers/soundtrack-audio.mjs';
import {
  captureFromVerifiedBundle,
  captureVoices,
  holdNextDecode,
  observeBufferStarts,
} from './studio-probe-model.mjs';

const bytes = new Uint8Array(
  await readFile(new URL('../../../game/audio/effects/confirm.wav', import.meta.url)),
);
const sha256 = await hashPresentationBytes(bytes);
const base = createDefaultThemeBundle();
const asset = {
  ...resolvePresentation(base).assets['audio.capture'],
  id: 'studio-probe.capture',
  revision: 1,
  kind: 'audio',
  recipe: null,
  file: { sha256, bytes: bytes.length, mime: 'audio/wav', width: null, height: null },
};
const document = reviseStudioTheme(base, {
  assets: [asset],
  bindings: { 'audio.capture': { id: asset.id, revision: 1 } },
});
const exported = await exportThemeBundle(
  document,
  new Map([[sha256, new Blob([bytes], { type: 'audio/wav' })]]),
);
const verified = await importThemeBundle(exported);

test('probe reads the production-verified original and exact selected theme without storage writes', async () => {
  const capture = captureFromVerifiedBundle(verified);
  assert.equal(capture.theme.revision, resolvePresentation(document).theme.revision);
  assert.equal(capture.asset.file.sha256, sha256);
  assert.deepEqual(
    new Uint8Array(await (await capture.readAudio('audio.capture')).blob.arrayBuffer()),
    bytes,
  );
  assert.equal(await capture.readAudio('audio.victory'), null);
  await assert.rejects(capture.readAudio('audio.capture', { signal: AbortSignal.abort() }), {
    name: 'AbortError',
  });
  assert.throws(
    () => captureFromVerifiedBundle({ document: base, assets: new Map() }),
    /uploaded capture/,
  );
});

for (const action of ['complete', 'cancel', 'close'])
  test(`probe's controlled decode ${action} preserves actual cue cache and scheduling ownership`, async (t) => {
    const h = audioHarness(),
      sound = h.soundscape;
    sound.feedbackDirector.prepare = () => {};
    sound.feedbackDirector.load = () => {};
    const expected = { duration: 0.06, length: 2880, sampleRate: 48000, numberOfChannels: 1 };
    const decoder = async (input) => {
      assert.deepEqual(new Uint8Array(input), bytes);
      return expected;
    };
    h.context.decodeAudioData = decoder;
    await sound.enable();
    sound.feedbackDirector.buffers.set('reveal-small', { duration: 0.1 });
    sound.setPublishedAudio(captureFromVerifiedBundle(verified).readAudio);
    const published = sound.publishedAudio,
      gate = holdNextDecode(h.context);
    t.after(async () => {
      gate.restore();
      await sound.dispose();
    });
    const dispatch = (board) =>
      sound.events(
        [
          {
            type: 'cells.claimed',
            indices: [41, 42],
            tick: h.context.currentTime,
            time: h.context.currentTime,
          },
        ],
        {
          width: 40,
          height: 30,
          totalClaimable: 1200,
          cells: new Uint8Array(1200),
          status: 'running',
          players: [],
          enemies: [],
        },
        {},
        { mode: 'versus', board },
      );
    dispatch(0);
    const preparing = published.prepare(['capture']);
    assert.equal(await gate.entered, expected);
    assert.equal(published.has('capture'), false);
    assert.equal(captureVoices(sound, expected).nativeReveal, 1);
    const beforeRelease = h.sources.length;
    if (action === 'cancel') published.cancelPending();
    if (action === 'close') sound.setPublishedAudio(null);
    sound.reset();
    gate.restore();
    await preparing;
    assert.equal(h.context.decodeAudioData, decoder);
    assert.equal(published.has('capture'), action === 'complete');
    assert.equal(
      h.sources.length,
      beforeRelease,
      'decode completion cannot schedule an expired event',
    );
    assert.equal(sound.voices.size, 0);
    if (action === 'complete') {
      h.context.currentTime = 1;
      dispatch(0);
      dispatch(1);
      assert.deepEqual(captureVoices(sound, expected), {
        custom: 2,
        owners: [0, 1],
        exactDecodedBuffer: true,
        nativeReveal: 0,
      });
      assert.equal(
        captureVoices(sound, {}).exactDecodedBuffer,
        false,
        'wrong buffer identity cannot pass the probe',
      );
    }
  });

test('restoring the probe gate releases a held decoder and preserves a newer decoder owner', async () => {
  const buffer = { length: 4 },
    native = async () => buffer;
  const context = { decodeAudioData: native };
  const gate = holdNextDecode(context);
  const pending = context.decodeAudioData(new ArrayBuffer(1));
  assert.equal(await gate.entered, buffer);
  const newer = async () => ({ length: 8 });
  context.decodeAudioData = newer;
  gate.restore();
  assert.equal(await pending, buffer);
  assert.equal(context.decodeAudioData, newer);
});

test('native start observer detects a cue that already ended and ignores rejected starts', () => {
  const context = {
    createBufferSource() {
      return {
        ended: false,
        start() {
          this.ended = true;
          return 'native-result';
        },
      };
    },
  };
  const original = context.createBufferSource;
  const observer = observeBufferStarts(context);
  const short = context.createBufferSource();
  assert.equal(short.start(), 'native-result');
  assert.equal(short.ended, true);
  assert.equal(
    observer.count,
    1,
    'a completed short cue must still be visible to no-replay assertions',
  );
  observer.restore();
  assert.equal(context.createBufferSource, original);
  short.start();
  assert.equal(observer.count, 1);
  context.createBufferSource = () => ({
    start() {
      throw new Error('native start refused');
    },
  });
  const refused = observeBufferStarts(context);
  assert.throws(() => context.createBufferSource().start(), /native start refused/);
  assert.equal(refused.count, 0);
  refused.restore();
});
