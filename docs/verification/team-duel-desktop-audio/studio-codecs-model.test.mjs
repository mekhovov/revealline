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
  codecFixtures,
  codecsFromVerifiedBundle,
  inspectCueVoices,
  dispatchCodecEvent,
  truncatedCueReader,
  waitForFallbackEnd,
} from './studio-codecs-model.mjs';
import { holdNextDecode, observeBufferStarts } from './studio-probe-model.mjs';

// In-memory test construction only: no generated file is used for native UI evidence.
const base = createDefaultThemeBundle(),
  resolved = resolvePresentation(base);
const blobs = new Map(),
  assets = [],
  bindings = {};
for (const fixture of codecFixtures) {
  const bytes = new Uint8Array(
    await readFile(new URL(`../../../${fixture.path}`, import.meta.url)),
  );
  assert.equal(await hashPresentationBytes(bytes), fixture.sha256);
  assert.equal(bytes.length, fixture.bytes);
  const asset = {
    ...resolved.assets[`audio.${fixture.cue}`],
    id: `codec-probe.${fixture.cue}`,
    revision: 1,
    kind: 'audio',
    recipe: null,
    file: {
      sha256: fixture.sha256,
      bytes: bytes.length,
      mime: fixture.mime,
      width: null,
      height: null,
    },
  };
  assets.push(asset);
  bindings[`audio.${fixture.cue}`] = { id: asset.id, revision: 1 };
  blobs.set(fixture.sha256, new Blob([bytes], { type: fixture.mime }));
}
const document = reviseStudioTheme(base, { assets, bindings });
const verified = await importThemeBundle(await exportThemeBundle(document, blobs));
const selected = codecsFromVerifiedBundle(verified);

test('codec adapter selects only the three exact production-verified originals', async () => {
  assert.equal(selected.theme.revision, resolvePresentation(document).theme.revision);
  for (const fixture of codecFixtures) {
    const result = await selected.readAudio(`audio.${fixture.cue}`);
    assert.equal(result.asset.file.mime, fixture.mime);
    assert.equal(
      await hashPresentationBytes(new Uint8Array(await result.blob.arrayBuffer())),
      fixture.sha256,
    );
  }
  assert.equal(await selected.readAudio('audio.capture'), null);
  await assert.rejects(selected.readAudio('audio.failure', { signal: AbortSignal.abort() }), {
    name: 'AbortError',
  });
});

test('codec adapter refuses missing slots, missing originals and substituted content', () => {
  assert.throws(
    () => codecsFromVerifiedBundle({ document: base, assets: new Map() }),
    /uploaded failure/,
  );
  assert.throws(
    () => codecsFromVerifiedBundle({ document, assets: new Map() }),
    /uploaded failure/,
  );
  const mismatched = new Map(verified.assets);
  mismatched.set(codecFixtures[0].sha256, new Blob([new Uint8Array(2)]));
  assert.throws(
    () => codecsFromVerifiedBundle({ document, assets: mismatched }),
    /retained audio\/wav/,
  );
  const wrongAssets = [{ ...assets[0], file: { ...assets[1].file } }, ...assets.slice(1)];
  const wrong = reviseStudioTheme(base, { assets: wrongAssets, bindings });
  assert.throws(
    () => codecsFromVerifiedBundle({ document: wrong, assets: verified.assets }),
    /retained audio\/wav/,
  );
});

test('voice observer cannot count a procedural or wrong decoded buffer as custom output', () => {
  const expected = {},
    other = {};
  const sound = {
    voices: new Set([
      { name: 'victory', source: {} },
      { name: 'victory', source: { buffer: other } },
      { name: 'victory', board: 'duel-result', source: { buffer: expected } },
    ]),
  };
  assert.deepEqual(inspectCueVoices(sound, 'victory', expected), {
    exact: 1,
    owners: ['duel-result'],
    other: 2,
    total: 3,
  });
  assert.equal(inspectCueVoices(sound, 'victory', undefined).exact, 0);
});

async function setup(t, fixture) {
  const h = audioHarness(),
    sound = h.soundscape;
  sound.feedbackDirector.prepare = () => {};
  sound.feedbackDirector.load = () => {};
  const expected = {
    duration: (fixture.duration[0] + fixture.duration[1]) / 2,
    length: 4000,
    numberOfChannels: fixture.channels,
    sampleRate: 48000,
  };
  h.context.decodeAudioData = async (input) => {
    assert.equal(input.byteLength, fixture.bytes);
    return expected;
  };
  await sound.enable();
  for (const name of ['impact', 'loss', 'pickup', 'pickup-1', 'pickup-2'])
    sound.feedbackDirector.buffers.set(name, { duration: 0.1 });
  sound.setPublishedAudio(selected.readAudio);
  const observer = observeBufferStarts(h.context);
  t.after(async () => {
    observer.restore();
    await sound.dispose();
  });
  let tick = 0;
  const dispatch = (type, board = 'team', lost = false) =>
    dispatchCodecEvent(sound, { type, board, lost, tick: ++tick });
  return { ...h, sound, expected, observer, dispatch };
}

for (const fixture of codecFixtures) {
  test(`${fixture.cue}: actual audio owners select exact replacement and isolate Duel results`, async (t) => {
    const h = await setup(t, fixture);
    await h.sound.publishedAudio.prepare([fixture.cue]);
    const cases =
      fixture.cue === 'pickup'
        ? [
            [fixture.event, ['team']],
            [fixture.event, [0, 1]],
            ['powerup.collected', ['team']],
            ['powerup.collected', [0, 1]],
          ]
        : [
            [fixture.event, ['team']],
            ...(fixture.cue === 'failure' ? [[fixture.event, [0, 1]]] : []),
            ['run.completed', ['duel-result']],
            ...(fixture.cue === 'failure' ? [['run.completed', ['team']]] : []),
          ];
    for (const [type, boards] of cases) {
      h.sound.reset();
      const before = h.observer.count;
      for (const board of boards)
        h.dispatch(type, board, type === 'run.completed' && fixture.cue === 'failure');
      assert.deepEqual(inspectCueVoices(h.sound, fixture.cue, h.expected), {
        exact: boards.length,
        owners: boards,
        other: 0,
        total: boards.length,
      });
      assert.equal(h.observer.count - before, boards.length);
    }
    h.sound.reset();
    const before = h.observer.count;
    h.dispatch('run.completed', 0, fixture.cue === 'failure');
    h.dispatch('run.completed', 1, fixture.cue === 'failure');
    assert.equal(h.sound.voices.size, 0);
    assert.equal(h.observer.count, before);
  });
  for (const action of ['late-completion', 'cancel-pending', 'close-owner'])
    test(`${fixture.cue}: ${action} holds actual decoder delivery without scheduling`, async (t) => {
      const h = await setup(t, fixture),
        published = h.sound.publishedAudio;
      const gate = holdNextDecode(h.context);
      t.after(() => gate.restore());
      if (action === 'late-completion') {
        h.dispatch(fixture.event);
        const voices = inspectCueVoices(h.sound, fixture.cue, h.expected);
        assert.equal(voices.exact, 0);
        assert.ok(voices.other > 0);
      }
      const preparing = published.prepare([fixture.cue]);
      assert.equal(await gate.entered, h.expected);
      assert.equal(published.has(fixture.cue), false);
      if (action === 'cancel-pending') published.cancelPending();
      if (action === 'close-owner') h.sound.setPublishedAudio(null);
      const before = h.observer.count;
      if (action === 'late-completion') {
        const generation = h.sound.feedbackDirector.generation;
        const priorEvents = [...h.sound.recentEvents];
        let elapsed = 0,
          waited = false;
        await waitForFallbackEnd(h.sound, {
          now: () => elapsed,
          wait: async (ms) => {
            waited = true;
            elapsed += ms;
            h.context.currentTime += 3;
            // Model the finite audio clock delivering natural end callbacks.
            // Neither the helper nor this scenario calls reset/stop/retire.
            for (const voice of [...h.sound.voices]) voice.source.onended();
          },
        });
        assert.equal(waited, true, 'the cold fallback must exist before its natural completion');
        assert.equal(h.sound.feedbackDirector.generation, generation);
        assert.deepEqual([...h.sound.recentEvents], priorEvents);
        assert.equal(h.sound.publishedAudio, published);
        assert.equal(h.observer.count, before);
      } else h.sound.reset();
      gate.restore();
      await preparing;
      assert.equal(h.observer.count, before);
      assert.equal(h.sound.voices.size, 0);
      assert.equal(published.has(fixture.cue), action === 'late-completion');
      if (action === 'late-completion') {
        h.dispatch(fixture.event);
        assert.deepEqual(inspectCueVoices(h.sound, fixture.cue, h.expected), {
          exact: 1,
          owners: ['team'],
          other: 0,
          total: 1,
        });
      }
    });
  test(`${fixture.cue}: truncated read faults preserve verified originals and runtime fallback`, async (t) => {
    const h = await setup(t, fixture),
      reader = truncatedCueReader(selected, fixture.cue);
    const truncated = await reader(`audio.${fixture.cue}`);
    assert.equal(truncated.blob.size, 9);
    assert.equal((await selected.readAudio(`audio.${fixture.cue}`)).blob.size, fixture.bytes);
    assert.equal(await reader('audio.capture'), null);
    await assert.rejects(reader(`audio.${fixture.cue}`, { signal: AbortSignal.abort() }), {
      name: 'AbortError',
    });
    let attempts = 0;
    h.context.decodeAudioData = async (input) => {
      attempts++;
      assert.equal(input.byteLength, 9);
      throw new DOMException(
        'Modeled decoder rejection; not native codec evidence',
        'EncodingError',
      );
    };
    h.sound.setPublishedAudio(reader);
    await h.sound.publishedAudio.prepare([fixture.cue]);
    assert.equal(attempts, 1);
    assert.equal(h.sound.publishedAudio.has(fixture.cue), false);
    assert.equal(h.observer.count, 0);
    h.dispatch(fixture.event);
    assert.ok(inspectCueVoices(h.sound, fixture.cue, h.expected).other > 0);
    assert.equal(inspectCueVoices(h.sound, fixture.cue, h.expected).exact, 0);
  });
}

test('natural fallback observer waits without taking lifecycle ownership', async () => {
  const voice = {},
    voices = new Set([voice]);
  let elapsed = 0,
    polls = 0,
    ownershipChecks = 0;
  const sound = {
    context: { state: 'running' },
    voices,
    reset() {
      throw new Error('Observer must not reset');
    },
  };
  const result = await waitForFallbackEnd(sound, {
    now: () => elapsed,
    assertOwned: () => ownershipChecks++,
    wait: async (ms) => {
      elapsed += ms;
      if (++polls === 2) voices.delete(voice);
    },
  });
  assert.deepEqual(result, { waitedMs: 24, remainingVoices: 0 });
  assert.equal(ownershipChecks, 3);
});

test('natural fallback observer bounds a stalled source and rejects interruption', async () => {
  let elapsed = 0;
  const sound = { context: { state: 'running' }, voices: new Set([{}]) };
  await assert.rejects(
    waitForFallbackEnd(sound, {
      now: () => elapsed,
      timeoutMs: 24,
      wait: async (ms) => {
        elapsed += ms;
      },
    }),
    /bounded wait/,
  );
  assert.equal(elapsed, 24);
  assert.equal(sound.voices.size, 1, 'timeout cannot retire the source itself');
  sound.context.state = 'suspended';
  await assert.rejects(waitForFallbackEnd(sound, { wait: async () => {} }), /Audio clock stopped/);
  sound.context.state = 'running';
  await assert.rejects(
    waitForFallbackEnd(sound, {
      wait: async () => {},
      assertOwned: () => {
        throw new Error('Cancelled owner');
      },
    }),
    /Cancelled owner/,
  );
  assert.equal(sound.voices.size, 1);
});
