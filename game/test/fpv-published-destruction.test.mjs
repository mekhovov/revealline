import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createWorldAudio } from '../../optional-practice/civilian-fpv/world-audio.mjs';
import { createWorldAudio as createPackagedWorldAudio } from '../../optional-practice/civilian-fpv/world-reaction-runtime.mjs';
import { createSimFlightAudio } from '../../optional-practice/civilian-fpv/sim-presentation.mjs';
import { createAudioMaster } from '../ui/audio-master.mjs';
import { createPublishedCues } from '../ui/published-cues.mjs';
import { readPortableDestructionAudio } from '../presentation/portable-destruction-audio.mjs';
import { PORTABLE_DESTRUCTION_AUDIO } from '../audio/portable-destruction.mjs';
import {
  buildPortableDestructionAudio,
  PORTABLE_DESTRUCTION_MAX_BYTES,
} from '../../scripts/refresh-portable-destruction-audio.mjs';
import { compilePresentation } from '../../scripts/compile-presentation.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { EFFECT_BANK } from '../audio/effects/bank.mjs';
import { settleUntil } from './helpers/soundtrack-audio.mjs';

const hash = (bytes) => createHash('sha256').update(new Uint8Array(bytes)).digest('hex');
const drained = () => new Promise((resolve) => setImmediate(resolve));
function decoded(tag, length = 4800) {
  return {
    tag,
    length,
    duration: length / 48000,
    numberOfChannels: 1,
    sampleRate: 48000,
    getChannelData: () => new Float32Array(length).fill(0.01),
  };
}
function fixture(t, options = {}) {
  const sources = [],
    decodes = [],
    reads = [];
  let contexts = 0;
  const parameter = () => ({
    value: 0,
    cancelScheduledValues() {},
    setValueAtTime(v) {
      this.value = v;
    },
    setTargetAtTime(v) {
      this.value = v;
    },
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
  });
  const node = () => ({
    gain: parameter(),
    frequency: parameter(),
    Q: parameter(),
    threshold: parameter(),
    knee: parameter(),
    ratio: parameter(),
    playbackRate: parameter(),
    connect(target) {
      this.target = target;
      return target;
    },
    disconnect() {},
    start() {
      this.started = true;
    },
    stop(at) {
      if (at === undefined) this.cancelled = true;
    },
  });
  const source = () => {
    const value = node();
    sources.push(value);
    return value;
  };
  const context = {
    state: 'suspended',
    currentTime: 0,
    sampleRate: 48000,
    destination: {},
    createGain: node,
    createBiquadFilter: node,
    createDynamicsCompressor: node,
    createOscillator: source,
    createBufferSource: source,
    createBuffer: (_, size) => ({ getChannelData: () => new Float32Array(size) }),
    async decodeAudioData(bytes) {
      decodes.push(hash(bytes));
      return decoded(hash(bytes));
    },
    async resume() {
      this.state = 'running';
    },
    async suspend() {
      this.state = 'suspended';
    },
    async close() {
      this.state = 'closed';
    },
  };
  const master = createAudioMaster({ muted: false, volume: 0.4 });
  const sound = (options.factory ?? createWorldAudio)({
    window: {
      AudioContext: function () {
        contexts++;
        return context;
      },
    },
    storage: { getItem: () => null, setItem() {} },
    audioMaster: master,
    getDestruction: () => ({ vocals: false }),
    ...options,
    readAudio: async (slot, settings) => {
      reads.push({ slot, ...settings });
      return (options.readAudio ?? readPortableDestructionAudio)(slot, settings);
    },
  });
  t.after(() => {
    sound.dispose();
    master.dispose();
  });
  return {
    sound,
    context,
    sources,
    master,
    reads,
    decodes,
    contexts: () => contexts,
    samples: () => sources.filter((s) => s.started && s.buffer?.tag),
  };
}
const frame = (ticks, events = [], status = 'active') => ({
  ticks,
  step: 0,
  status,
  events,
  actors: [],
  position: { x: 0, y: 0, z: 0 },
  velocity: {},
  contacts: 0,
});

for (const [host, factory] of [
  ['source', createWorldAudio],
  ['World package', createPackagedWorldAudio],
  ['Academy package', createSimFlightAudio],
])
  test(`${host} plays the five core material recordings exactly once through its existing mixer`, async (t) => {
    const f = fixture(t, { factory });
    assert.equal(f.contexts(), 0);
    assert.equal(f.reads.length, 0);
    await f.sound.resume();
    await settleUntil(() => f.decodes.length === 5);
    await drained();
    assert.equal(f.contexts(), 1);
    assert.equal(f.samples().length, 0, 'Preparation is silent.');
    f.sound.update(frame(0));
    const events = ['runner', 'guard', 'utility-car', 'tracked-tank', 'radar-truck'].map(
      (family) => ({ type: 'catch', family, actor: family }),
    );
    f.context.currentTime = 1;
    f.sound.update(frame(1, events));
    assert.deepEqual(
      new Set(f.samples().map((s) => s.buffer.tag)),
      new Set(
        ['soft', 'armored', 'light', 'heavy', 'electronic'].map(
          (name) => EFFECT_BANK[`destroy-${name}`].sha256,
        ),
      ),
    );
    assert.equal(
      f.sources.filter((s) => s.started && !s.buffer).length,
      5,
      'Only the five continuous motor/hum oscillators; no synthetic catch duplicates.',
    );
    f.sound.update(frame(1, events));
    assert.equal(f.samples().length, 5);
    f.sound.pause();
    assert.ok(f.samples().every((s) => s.cancelled));
    await f.sound.resume();
    f.context.currentTime = 2;
    f.sound.update(frame(2, [events[0]], 'complete'), { active: false });
    assert.equal(f.samples().length, 6, 'A fresh terminal catch sounds once.');
    f.sound.update(frame(2, [events[0]], 'complete'), { active: false });
    assert.equal(f.samples().length, 6);
    f.master.setMuted(true);
    assert.ok(f.samples().every((s) => s.cancelled));
    f.sound.update(frame(3, events));
    assert.equal(f.samples().length, 6);
  });

test('late native recording preparation never replays a catch and pause cancels pending ownership', async (t) => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const f = fixture(t, {
    readAudio: async (slot, options) => {
      await gate;
      return readPortableDestructionAudio(slot, options);
    },
  });
  await f.sound.resume();
  await settleUntil(() => f.reads.length === 5);
  f.sound.update(frame(0));
  f.context.currentTime = 1;
  f.sound.update(frame(1, [{ type: 'catch', family: 'runner' }]));
  assert.equal(f.samples().length, 0, 'A missing recording uses immediate procedural feedback.');
  const count = f.sources.length;
  f.sound.pause();
  assert.ok(f.reads.every((r) => r.signal.aborted));
  release();
  await drained();
  assert.equal(f.sources.length, count);
  await f.sound.resume();
  await settleUntil(() => f.decodes.length === 5);
  await drained();
  assert.equal(f.samples().length, 0);
  f.context.currentTime = 2;
  f.sound.update(frame(2, [{ type: 'catch', family: 'runner' }]));
  assert.equal(f.samples().length, 1);
  f.sound.setCourse({ actors: [] });
  assert.ok(f.samples()[0].cancelled, 'Retry/replacement retires previous one-shots.');
  f.sound.update(frame(0, [{ type: 'catch', family: 'runner' }]));
  assert.equal(f.samples().length, 1, 'Restored initial events remain silent.');
});

test('published recordings retain immutable Studio bytes in the portable release and reject corruption', async () => {
  const compiled = await compilePresentation(createDefaultThemeBundle(), new Map());
  const manifest = JSON.parse(new TextDecoder().decode(compiled.files.get('runtime.json')));
  const bytes = new Uint8Array(
    await readFile(new URL('../audio/effects/destroy-heavy.wav', import.meta.url)),
  );
  const asset = structuredClone(manifest.resolved.assets['audio.confirm']);
  Object.assign(asset, {
    id: 'audio.test.native',
    kind: 'audio',
    recipe: null,
    file: {
      sha256: hash(bytes),
      bytes: bytes.length,
      mime: 'audio/wav',
      width: null,
      height: null,
    },
  });
  manifest.resolved.assets['audio.destroy-soft'] = asset;
  manifest.resolved.bindings['audio.destroy-soft'] = { id: asset.id, revision: asset.revision };
  manifest.urls[hash(bytes)] = `./assets/${hash(bytes)}.wav`;
  const options = {
    compiled: manifest,
    readAsset: async () => bytes,
    readDefault: (name) => readFile(new URL(`../audio/effects/${name}`, import.meta.url)),
  };
  const bank = await buildPortableDestructionAudio(options);
  assert.equal(bank.clips['audio.destroy-soft'].source.kind, 'published');
  assert.deepEqual(
    Buffer.from(bank.clips['audio.destroy-soft'].base64, 'base64'),
    Buffer.from(bytes),
  );
  assert.equal(bank.clips['audio.destroy-heavy'].source.kind, 'core');
  assert.ok(bank.bytes <= PORTABLE_DESTRUCTION_MAX_BYTES);
  await assert.rejects(
    buildPortableDestructionAudio({
      ...options,
      readAsset: async () => new Uint8Array(bytes.length),
    }),
    /differs from its release/,
  );
  const oversized = structuredClone(manifest);
  oversized.resolved.assets['audio.destroy-soft'].file.bytes = PORTABLE_DESTRUCTION_MAX_BYTES + 1;
  await assert.rejects(
    buildPortableDestructionAudio({ ...options, compiled: oversized }),
    /budget/,
  );
});

test('portable offline reader matches every admitted hash, respects cancellation and ignores unrelated slots', async () => {
  for (const [slot, clip] of Object.entries(PORTABLE_DESTRUCTION_AUDIO.clips)) {
    const result = await readPortableDestructionAudio(slot);
    assert.equal(hash(await result.blob.arrayBuffer()), clip.sha256);
    assert.equal(result.blob.size, clip.bytes);
  }
  assert.equal(await readPortableDestructionAudio('audio.music'), null);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    readPortableDestructionAudio('audio.destroy-soft', { signal: controller.signal }),
    { name: 'AbortError' },
  );
});

test('shared published cache bounds aggregate decoded samples and validates native voice limits', async () => {
  const sound = {
    enabled: true,
    paused: false,
    settings: { master: true, sfx: true },
    context: { state: 'running', decodeAudioData: async () => decoded('bounded', 60) },
  };
  const cues = createPublishedCues({
    sound,
    maxVoices: 12,
    maxFeedbackVoices: 10,
    maxDecodedSamples: 80,
    readAudio: async () => ({ blob: new Blob([new Uint8Array(1)]) }),
  });
  await cues.prepare(['destroy-soft']);
  await cues.prepare(['destroy-heavy']);
  assert.equal(cues.has('destroy-soft'), true);
  assert.equal(cues.has('destroy-heavy'), false);
  cues.close();
  assert.equal(cues.has('destroy-soft'), false);
  assert.throws(
    () => createPublishedCues({ sound, maxVoices: 12, maxFeedbackVoices: 13 }),
    /budget/,
  );
});

test('native published replacement plays through the same mixer and retains the warning reserve', async (t) => {
  const replacement = new Uint8Array([11, 22, 33, 44]);
  const f = fixture(t, {
    readAudio: async (slot, options) =>
      slot === 'audio.destroy-soft'
        ? { blob: new Blob([replacement]) }
        : readPortableDestructionAudio(slot, options),
  });
  await f.sound.resume();
  await settleUntil(() => f.decodes.length === 5);
  await drained();
  f.sound.update(frame(0));
  for (let tick = 1; tick <= 15; tick++) {
    f.context.currentTime = tick;
    f.sound.update(frame(tick, [{ type: 'catch', family: 'runner' }]));
  }
  assert.equal(
    f.samples().length,
    10,
    'Crowd catches leave two native voices available for warnings.',
  );
  assert.ok(
    f.samples().every((s) => s.buffer.tag === hash(replacement)),
    'Published bytes replace the core material cue.',
  );
  assert.equal(
    f.sources.filter((s) => s.started && !s.buffer).length,
    5,
    'Budget rejection does not synthesize another catch.',
  );
  f.sound.pause();
  assert.ok(f.samples().every((s) => s.cancelled));
});
