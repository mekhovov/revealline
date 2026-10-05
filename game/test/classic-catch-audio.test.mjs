import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createClassicAudio } from '../snake/classic-audio.mjs';
import { Soundscape } from '../ui/audio.mjs';
import { createAudioMaster } from '../ui/audio-master.mjs';
import { audioHarness, settleUntil } from './helpers/soundtrack-audio.mjs';
import {
  createClassicSnakeMatch,
  queueClassicSnakeMatchTurn,
  advanceClassicSnakeMatchTo,
} from '../snake/classic-match.mjs';
import { exportClassicSnakeReplay, restoreClassicSnakeReplay } from '../snake/classic-core.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { createPresentationHost } from '../presentation/host.mjs';
import { hashPresentationBytes } from '../presentation/bundle.mjs';
import { compilePresentation } from '../../scripts/compile-presentation.mjs';
import { editionClassicPresentationResources } from '../../scripts/edition-runtime.mjs';

// Native match inputs, Studio compilation and the shared mixer execute. Web
// Audio nodes are an observed boundary; these are not device/listening claims.
const level = () => ({
  version: 'classic-snake-level.v1',
  id: 'audio-catch',
  revision: '1',
  name: 'Audio catch',
  width: 24,
  height: 18,
  walls: [],
  spawns: [
    { x: 5, y: 2, direction: 'right' },
    { x: 18, y: 15, direction: 'left' },
  ],
  goal: 1,
  stepMs: 180,
  speedupEvery: 0,
  minStepMs: 120,
  wrap: false,
  targetMovement: 'still',
  fleeEvery: 3,
});
const cueBytes = new Uint8Array(
  await readFile(new URL('../audio/effects/pickup.wav', import.meta.url)),
);
const cueHash = await hashPresentationBytes(cueBytes);
let releasePromise;
function release() {
  releasePromise ??= (async () => {
    const bundle = structuredClone(createDefaultThemeBundle());
    const asset = bundle.assets.find((entry) => entry.id === 'audio.pickup.default');
    Object.assign(asset, {
      kind: 'audio',
      recipe: null,
      file: {
        sha256: cueHash,
        bytes: cueBytes.length,
        mime: 'audio/wav',
        width: null,
        height: null,
      },
    });
    return compilePresentation(bundle, new Map([[cueHash, new Blob([cueBytes])]]));
  })();
  return releasePromise;
}
async function audio(t, { custom = false, delayed = false } = {}) {
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 404 }));
  const h = audioHarness(),
    master = createAudioMaster({ muted: false, volume: 1 });
  const sound = new Soundscape({ audioMaster: master, contextFactory: () => h.context });
  const pans = [];
  h.context.createStereoPanner = () => ({
    pan: {
      setValueAtTime(value) {
        pans.push(value);
      },
      setTargetAtTime() {},
    },
    connect() {},
    disconnect() {},
  });
  const decoded = { duration: 0.2, length: 1600, numberOfChannels: 1, identity: 'studio-pickup' };
  let finishDecode,
    decodes = 0;
  h.context.decodeAudioData = async () => {
    decodes++;
    if (delayed)
      return new Promise((resolve) => {
        finishDecode = () => resolve(decoded);
      });
    return decoded;
  };
  let presentation, host;
  const requests = [];
  if (custom) {
    const compiled = await release();
    host = createPresentationHost({
      profile: 'board',
      document: {},
      baseURL: 'https://example.test/game/presentation/compiled/',
      fetch: async (url) => {
        const key = url.split('/compiled/')[1];
        requests.push(key);
        return new Response(compiled.files.get(key));
      },
    });
    await host.load();
    presentation = { readAudio: (slot, options) => host.readAudio(slot, options) };
  }
  const adapter = createClassicAudio(sound, { presentation });
  t.after(async () => {
    adapter.dispose();
    host?.close();
    await sound.dispose();
    master.dispose();
  });
  return {
    ...h,
    sound,
    master,
    adapter,
    decoded,
    requests,
    pans,
    host,
    decodes: () => decodes,
    finishDecode: () => finishDecode?.(),
  };
}
function advance(h, mode, { active = true } = {}) {
  const match = createClassicSnakeMatch(level(), { mode, seed: 17 });
  const observe = () =>
    match.runs.forEach((run, index) => {
      const replay = exportClassicSnakeReplay(run);
      h.adapter.update(run, {
        active,
        mode,
        board: `snake-${index}`,
        placement: mode === 'versus' ? { left: index * 0.5, width: 0.5 } : undefined,
      });
      assert.deepEqual(
        exportClassicSnakeReplay(run),
        replay,
        'Audio cannot modify native gameplay',
      );
    });
  observe();
  const seats = mode === 'versus' ? [0, 1] : [0];
  for (const seat of seats) assert.equal(queueClassicSnakeMatchTurn(match, seat, 'down'), true);
  for (let step = 1; step <= 11; step++) {
    if (step === 7)
      for (const seat of seats) assert.equal(queueClassicSnakeMatchTurn(match, seat, 'left'), true);
    h.context.currentTime = step * 0.18;
    advanceClassicSnakeMatchTo(match, step * 180);
    observe();
  }
  assert.equal(match.status, 'finished');
  for (const run of match.runs) {
    assert.equal(run.status, 'won');
    assert.equal(run.catches, 1);
    assert.deepEqual(restoreClassicSnakeReplay(exportClassicSnakeReplay(run)), run);
  }
  return { match, observe };
}

for (const mode of ['solo', 'versus', 'team'])
  test(`${mode}: native final catch uses the admitted Sound Studio pickup once with board ownership`, async (t) => {
    const h = await audio(t, { custom: true });
    await h.adapter.prepare();
    assert.equal(h.sound.context, null, 'Preparation never unlocks audio');
    assert.equal(h.requests.length, 1, 'Only the manifest loads before explicit activation');
    await h.sound.enable();
    await h.adapter.prepare();
    assert.equal(h.decodes(), 1);
    assert.equal(h.sources.length, 0, 'Decode completion does not play a stale cue');
    const { match, observe } = advance(h, mode);
    const catches = [...h.sound.voices].filter((voice) => voice.name === 'pickup');
    assert.equal(catches.length, mode === 'versus' ? 2 : 1);
    assert.deepEqual(
      catches.map((voice) => voice.board),
      mode === 'versus' ? ['snake-0', 'snake-1'] : ['snake-0'],
    );
    for (const voice of catches) {
      assert.equal(voice.source.buffer, h.decoded);
      assert.equal(voice.feedback, true);
      assert.equal(voice.bus, 'sfx');
      assert.equal(voice.priority, 3);
    }
    if (mode === 'versus') assert.ok(h.pans.includes(-0.6) && h.pans.includes(0));
    h.sound.gameplayPaused = true; // The real host finishes only after catch projection.
    const sourceCount = h.sources.length;
    observe();
    h.adapter.reset();
    for (const run of match.runs) h.adapter.update(run);
    assert.equal(h.sources.length, sourceCount, 'Result redraw and restored history remain silent');
    assert.equal(
      [...h.sound.voices].filter((voice) => voice.feedback).length,
      0,
      'Retry disposes both the recorded cue and material accent',
    );
  });

test('core pickup recipe remains audible without published audio and both Versus catches keep their own cue', async (t) => {
  const h = await audio(t);
  await h.sound.enable();
  advance(h, 'versus');
  const voices = [...h.sound.voices].filter((voice) => voice.name === 'pickup');
  assert.equal(
    voices.length,
    4,
    'The registered Sound Studio pickup recipe has two notes per board',
  );
  assert.deepEqual(
    voices.map((voice) => voice.board),
    ['snake-0', 'snake-0', 'snake-1', 'snake-1'],
  );
  assert.ok(voices.every((voice) => voice.feedback && voice.bus === 'sfx'));
});

for (const gate of ['locked', 'muted', 'volume', 'effects', 'paused', 'inactive'])
  test(`catch sound cannot bypass ${gate} and is not replayed when audio resumes`, async (t) => {
    const h = await audio(t, { custom: true });
    if (gate !== 'locked') {
      await h.sound.enable();
      await h.adapter.prepare();
    }
    if (gate === 'muted') h.master.setMuted(true);
    if (gate === 'volume') h.master.setVolume(0);
    if (gate === 'effects') h.sound.configure({ sfx: 0 });
    if (gate === 'paused') h.sound.pause();
    const { observe } = advance(h, 'solo', { active: gate !== 'inactive' });
    if (gate === 'volume') {
      assert.equal(h.sound.master.gain.value, 0);
      assert.equal([...h.sound.voices].filter((voice) => voice.feedback).length, 0);
    } else assert.equal(h.sources.length, 0);
    if (gate === 'locked') assert.equal(h.sound.context, null);
    h.master.setMuted(false);
    h.master.setVolume(1);
    h.sound.configure({ sfx: 0.7 });
    const sourceCount = h.sources.length;
    await h.sound.enable();
    observe();
    assert.equal(h.sources.length, sourceCount);
  });

test('late custom decoding uses the core pickup immediately and never replays its finished catch', async (t) => {
  const h = await audio(t, { custom: true, delayed: true });
  await h.sound.enable();
  const prepared = h.adapter.prepare();
  advance(h, 'solo');
  assert.equal([...h.sound.voices].filter((voice) => voice.name === 'pickup').length, 2);
  await settleUntil(() => h.decodes() === 1);
  const before = h.sources.length;
  h.finishDecode();
  await prepared;
  assert.equal(h.sources.length, before);
});

test('board audio authority and Company closure include the pickup recording only', async (t) => {
  const h = await audio(t, { custom: true });
  const compiled = await release();
  const resources = editionClassicPresentationResources(
    new TextDecoder().decode(compiled.files.get('runtime.json')),
  );
  assert.ok(resources.includes(`game/presentation/compiled/assets/${cueHash}.wav`));
  await assert.rejects(h.host.readAudio('audio.music'), /profile cannot read/);
  await assert.rejects(h.host.readAudio('audio.victory'), /profile cannot read/);
  const result = await h.host.readAudio('audio.pickup');
  assert.deepEqual(new Uint8Array(await result.blob.arrayBuffer()), cueBytes);
  h.host.close();
  await assert.rejects(h.host.readAudio('audio.pickup'), /No current audio release/);
});
