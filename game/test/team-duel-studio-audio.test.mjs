import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { reviseStudioTheme } from '../presentation/studio-session.mjs';
import { resolvePresentation } from '../presentation/model.mjs';
import {
  exportThemeBundle,
  importThemeBundle,
  hashPresentationBytes,
} from '../presentation/bundle.mjs';
import { createStudioStore } from '../presentation/studio-store.mjs';
import { exportRuntimeTheme, importRuntimeTheme } from '../presentation/runtime-transfer.mjs';
import { createPresentationHost } from '../presentation/host.mjs';
import { compilePresentation } from '../../scripts/compile-presentation.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { audioHarness } from './helpers/soundtrack-audio.mjs';
import { attachPublishedAudio } from '../ui/published-audio.mjs';
import { Soundscape } from '../ui/audio.mjs';
import { createAudioMaster } from '../ui/audio-master.mjs';

async function restoredAudio(t, { prepare = true, duration = 0.2 } = {}) {
  const base = createDefaultThemeBundle(),
    assets = [],
    bytes = new Map();
  const bindings = {};
  // Deliberately substitute different existing project originals. No generated
  // sound or listening approval is implied by this digital transfer fixture.
  for (const [slot, file] of [
    ['capture', 'confirm'],
    ['failure', 'loss'],
    ['pickup', 'pickup'],
    ['victory', 'win'],
  ]) {
    const original = await readFile(new URL(`../audio/effects/${file}.wav`, import.meta.url));
    const sha256 = await hashPresentationBytes(original);
    const asset = {
      ...structuredClone(resolvePresentation(base).assets[`audio.${slot}`]),
      id: `studio-check.${slot}`,
      revision: 1,
      kind: 'audio',
      recipe: null,
      description: `Transfer fixture for ${slot}`,
      file: { sha256, bytes: original.length, mime: 'audio/wav', width: null, height: null },
      quality: { stage: 'produced', evidence: [] },
    };
    assets.push(asset);
    bindings[`audio.${slot}`] = { id: asset.id, revision: 1 };
    bytes.set(sha256, new Blob([original], { type: 'audio/wav' }));
  }
  const document = reviseStudioTheme(base, { assets, bindings });
  const source = createStudioStore({ indexedDB: managedIndexedDB().indexedDB });
  const target = createStudioStore({ indexedDB: managedIndexedDB().indexedDB });
  t.after(() => {
    source.close();
    target.close();
  });
  await source.save(document, bytes);
  const stored = await source.load();
  const imported = await importThemeBundle(await exportThemeBundle(stored.document, stored.assets));
  await target.save(imported.document, imported.assets);
  const recovered = await target.load();
  assert.deepEqual(recovered.document, document);
  for (const [hash, blob] of bytes)
    assert.deepEqual(await recovered.assets.get(hash).arrayBuffer(), await blob.arrayBuffer());
  const runtime = await importRuntimeTheme(
    await exportRuntimeTheme(recovered.document, recovered.assets),
  );
  for (const [slot, ref] of Object.entries(bindings))
    assert.deepEqual(runtime.manifest.resolved.bindings[slot], ref);
  const compiled = await compilePresentation(recovered.document, recovered.assets);
  const root = 'https://studio.test/compiled/';
  const host = createPresentationHost({
    baseURL: root,
    fetch: async (url) =>
      compiled.files.has(url.slice(root.length))
        ? new Response(compiled.files.get(url.slice(root.length)))
        : new Response(null, { status: 404 }),
  });
  const snapshot = await host.load();
  t.after(() => host.close());
  const h = audioHarness();
  const master = createAudioMaster({ muted: false, volume: 1 });
  h.soundscape = new Soundscape({
    persistentMusic: true,
    contextFactory: () => h.context,
    audioMaster: master,
  });
  h.soundscape.feedbackDirector.prepare = () => {};
  h.soundscape.feedbackDirector.load = () => {};
  // Native decode is a separate browser check; here verify every byte reaching
  // its boundary and retain an unmistakable buffer identity for dispatch.
  const decoded = new Map();
  h.context.decodeAudioData = async (input) => {
    const sha256 = await hashPresentationBytes(new Uint8Array(input));
    assert.ok(bytes.has(sha256));
    assert.deepEqual(input, await bytes.get(sha256).arrayBuffer());
    const buffer = { duration, length: Math.round(duration * 48000), numberOfChannels: 1, sha256 };
    decoded.set(sha256, buffer);
    return buffer;
  };
  const owner = attachPublishedAudio({
    sound: h.soundscape,
    ready: Promise.resolve(snapshot),
    getHost: () => host,
    document: null,
  });
  await owner.ready;
  await h.soundscape.enable();
  if (prepare)
    await h.soundscape.publishedAudio.prepare(['capture', 'failure', 'pickup', 'victory']);
  t.after(async () => {
    owner.close();
    await h.soundscape.dispose();
    master.dispose();
  });
  return { ...h, decoded, snapshot, master };
}

const state = () => ({
  width: 40,
  height: 30,
  cells: new Uint8Array(1200),
  totalClaimable: 1200,
  status: 'running',
  players: [
    { id: 0, x: 6, y: 5 },
    { id: 1, x: 34, y: 5 },
  ],
  enemies: [],
});

for (const mode of ['team', 'versus'])
  for (const readyBank of [true, false])
    test(`${mode}, native bank ${readyBank ? 'ready' : 'missing'}: restored Sound Studio cues retain exact bytes and board ownership`, async (t) => {
      const h = await restoredAudio(t),
        sound = h.soundscape;
      if (readyBank)
        for (const name of ['reveal-small', 'impact', 'loss', 'pickup', 'pickup-1', 'pickup-2'])
          sound.feedbackDirector.buffers.set(name, { duration: 0.1, native: name });
      const boards = mode === 'team' ? ['team'] : [0, 1];
      const runs = boards.map(state);
      for (const [index, [type, cue]] of [
        ['cells.claimed', 'capture'],
        ['player.failed', 'failure'],
        ['pickup.collected', 'pickup'],
        ['powerup.collected', 'pickup'],
      ].entries()) {
        h.context.currentTime = index + 1;
        sound.stopVoices();
        const before = h.sources.length;
        for (const [i, board] of boards.entries()) {
          const event = { type, tick: index + 1, time: index + 1, player: 0, indices: [41, 42] };
          sound.events([event], runs[i], {}, { mode, board });
          sound.events([event], runs[i], {}, { mode, board });
          sound.events([{ ...event, tick: event.tick + 100 }], runs[i], {}, { mode, board });
        }
        const hash = h.snapshot.resolved.assets[`audio.${cue}`].file.sha256;
        assert.equal(
          h.sources.length,
          before + boards.length,
          `${type} schedules exactly the restored cue per board`,
        );
        assert.ok(
          h.sources.slice(before).every((source) => source.buffer === h.decoded.get(hash)),
          `${type} must use the recovered original`,
        );
        assert.deepEqual(
          [...sound.voices].map((voice) => voice.board),
          boards,
        );
      }
      if (mode === 'team') {
        for (const [won, cue] of [
          [false, 'failure'],
          [true, 'victory'],
        ]) {
          h.context.currentTime += 1;
          sound.stopVoices();
          const before = h.sources.length;
          sound.events(
            [{ type: 'run.completed', won, tick: 1000, time: 1000 }],
            state(),
            {},
            { mode, board: 'team' },
          );
          assert.equal(h.sources.length, before + 1);
          assert.equal(
            h.sources.at(-1).buffer,
            h.decoded.get(h.snapshot.resolved.assets[`audio.${cue}`].file.sha256),
          );
        }
      }
      h.context.currentTime = 10;
      sound.stopVoices();
      h.master.setVolume(0);
      const before = h.sources.length;
      sound.events(
        [{ type: 'cells.claimed', tick: 20, time: 20, indices: [41] }],
        runs[0],
        {},
        { mode, board: boards[0] },
      );
      h.master.setVolume(1);
      assert.equal(
        h.sources.length,
        before,
        'Restoring volume never replays an expired substitution',
      );
    });

test('a cold Studio replacement uses ready native feedback once and only a later event adopts the decoded original', async (t) => {
  const h = await restoredAudio(t, { prepare: false });
  const sound = h.soundscape,
    native = { duration: 2, native: 'reveal-small' },
    run = state();
  sound.feedbackDirector.buffers.set('reveal-small', native);
  sound.events(
    [{ type: 'cells.claimed', tick: 1, time: 1, indices: [41] }],
    run,
    {},
    { mode: 'team', board: 'team' },
  );
  assert.equal(h.sources.length, 1);
  assert.equal(h.sources[0].buffer, native);
  const nativeVoice = [...sound.voices][0];
  await sound.publishedAudio.prepare(['capture']);
  assert.equal(h.sources.length, 1, 'Custom decode completion cannot replay the capture');
  assert.equal(nativeVoice.ended, false, 'Preparation alone cannot retire the native cue');
  h.context.currentTime = 1;
  sound.events(
    [{ type: 'cells.claimed', tick: 2, time: 2, indices: [42] }],
    run,
    {},
    { mode: 'team', board: 'team' },
  );
  assert.equal(h.sources.length, 2);
  assert.equal(
    h.sources[1].buffer,
    h.decoded.get(h.snapshot.resolved.assets['audio.capture'].file.sha256),
  );
  assert.equal(nativeVoice.ended, true, 'A later successful replacement retires its native tail');
});

test('long Studio routine cues replace only their own board and semantic family after cooldown', async (t) => {
  // The controlled decode duration exercises scheduling ownership, not a claim
  // about the length or acoustic quality of these original WAV recordings.
  const h = await restoredAudio(t, { duration: 15 }),
    sound = h.soundscape;
  for (const [type, cue, family] of [
    ['pickup.collected', 'pickup', 'pickup'],
    ['cells.claimed', 'capture', 'reveal-small'],
  ]) {
    sound.stopVoices();
    const runs = [state(), state()];
    for (let index = 0; index < 5; index++) {
      h.context.currentTime = (type === 'cells.claimed' ? 10 : 1) + index * 0.2;
      const otherBoard = [...sound.voices].find((voice) => voice.board === 1);
      for (const board of [0, 1]) {
        sound.events(
          [{ type, tick: index + 1, time: index * 0.2, player: 0, indices: [41] }],
          runs[board],
          {},
          { mode: 'versus', board },
        );
        if (board === 0 && otherBoard)
          assert.ok(sound.voices.has(otherBoard), 'Replacing board 0 must preserve board 1');
      }
      assert.equal(sound.voices.size, 2, 'Routine custom tails cannot accumulate after cooldown');
      assert.deepEqual(
        [...sound.voices].map((voice) => [voice.board, voice.name, voice.cueFamily]),
        [
          [0, cue, family],
          [1, cue, family],
        ],
      );
    }
  }
});

test('a budget-denied Studio routine cue preserves its predecessor and never schedules a fallback', async (t) => {
  const h = await restoredAudio(t, { duration: 15 }),
    sound = h.soundscape;
  const run = state();
  sound.events(
    [{ type: 'cells.claimed', tick: 1, time: 1, indices: [41] }],
    run,
    {},
    { mode: 'team', board: 'team' },
  );
  const predecessor = [...sound.voices][0];
  for (let index = 0; index < 15; index++) {
    const voice = {
      feedback: true,
      priority: 5,
      stop: () => sound.voices.delete(voice),
    };
    sound.voices.add(voice);
  }
  h.context.currentTime = 1;
  const before = h.sources.length;
  sound.events(
    [{ type: 'cells.claimed', tick: 2, time: 2, indices: [42] }],
    run,
    {},
    { mode: 'team', board: 'team' },
  );
  assert.equal(sound.voices.size, 16);
  assert.ok(sound.voices.has(predecessor));
  assert.equal(
    h.sources.length,
    before,
    'Denied custom playback cannot create a native/synth duplicate',
  );
});
