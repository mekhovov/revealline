import { createWorldAudio } from '../../optional-practice/civilian-fpv/world-audio.mjs';
import { createAudioMaster } from '../ui/audio-master.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createHumanReactionPolicy } from '../ui/human-reaction-policy.mjs';
import { HUMAN_REACTION_CUES, isHumanoidDestruction } from '../ui/destruction-audio.mjs';
import { createDestructionPreferences } from '../hunt/preferences.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { EFFECT_BANK } from '../audio/effects/bank.mjs';
import { audioHarness } from './helpers/soundtrack-audio.mjs';
import { createOverflightAudio } from '../overflight/audio.mjs';

const human = { brutal: true, family: 'runner' };
test('gore, optional reactions, actor identity and crowd admission are independent', () => {
  const p = createHumanReactionPolicy({ random: () => 0.42 });
  for (const details of [
    {},
    { ...human, brutal: false },
    { ...human, vocals: false },
    { ...human, machine: true },
    { ...human, humanoid: false },
  ])
    assert.equal(p.request(0, details), null);
  assert.equal(isHumanoidDestruction({ family: 'relay-warden' }), true);
  assert.equal(isHumanoidDestruction({ family: 'radar-truck', machine: true }), false);
  assert(p.request(0, human));
  assert.equal(p.request(0.1, human), null);
  assert(p.request(0.25, human));
  assert.equal(p.request(0.5, human), null, 'sustained token limit, not only simultaneous cap');
  assert.equal(p.request(1, human, 2), null);
  assert(p.request(1, human));
  p.interrupt(2);
  assert.equal(p.request(2.1, human), null);
  assert(p.request(2.5, human));
});
test('shuffle plays distinct performances and never repeats across bag boundaries or retries', () => {
  const p = createHumanReactionPolicy({ random: () => 0.42 });
  const names = Array.from({ length: 24 }, (_, i) => p.request(i, human));
  for (let i = 0; i < 24; i += 8) assert.equal(new Set(names.slice(i, i + 8)).size, 8);
  for (let i = 1; i < names.length; i++) assert.notEqual(names[i], names[i - 1]);
  p.reset();
  assert.notEqual(p.request(0, human), names.at(-1));
});
test('old destruction settings keep gore choice and gain an independent persistent vocal toggle', () => {
  const values = new Map([
    [
      'revealline.destruction.v1',
      JSON.stringify({ format: 'DestructionPreferencesV1', brutal: true, blood: false }),
    ],
  ]);
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const prefs = createDestructionPreferences({ window: {}, getStorage: () => storage });
  assert.equal(prefs.snapshot().vocals, true);
  assert.equal(prefs.snapshot().blood, false);
  prefs.set({ vocals: false });
  const again = createDestructionPreferences({ window: {}, getStorage: () => storage });
  assert.equal(again.snapshot().brutal, true);
  assert.equal(again.snapshot().vocals, false);
  prefs.dispose();
  again.dispose();
});
test('native vocal layers obey SFX/gore, warning priority, two-voice budget and Pause ownership', async (t) => {
  const h = audioHarness();
  t.after(() => h.soundscape.dispose());
  await h.soundscape.enable();
  for (const name of Object.keys(EFFECT_BANK))
    h.soundscape.feedbackDirector.buffers.set(name, { duration: 0.5 });
  h.soundscape.encounter('catch', human);
  assert.equal([...h.soundscape.voices].filter((v) => v.humanReaction).length, 1);
  h.context.currentTime += 0.3;
  h.soundscape.encounter('catch', { ...human, family: 'guard' });
  assert.equal([...h.soundscape.voices].filter((v) => v.humanReaction).length, 2);
  h.context.currentTime += 1;
  assert.equal(h.soundscape.humanReaction(human), false);
  h.soundscape.stopVoices();
  h.soundscape.encounter('warning');
  assert.equal(h.soundscape.humanReaction(human), false);
  h.soundscape.stopVoices();
  h.context.currentTime += 1;
  h.soundscape.configure({ sfx: 0 });
  assert.equal(h.soundscape.humanReaction(human), false);
  h.soundscape.configure({ sfx: 0.7 });
  assert.equal(h.soundscape.humanReaction({ ...human, vocals: false }), false);
  assert(h.soundscape.humanReaction(human));
  h.soundscape.pause();
  assert.equal(h.soundscape.voices.size, 0);
  assert.equal(h.soundscape.humanReaction(human), false);
});
test('native launch and retry use the shared ESC bank once; rotor ownership is singular and released', async (t) => {
  const h = audioHarness();
  t.after(() => h.soundscape.dispose());
  await h.soundscape.enable();
  for (const name of Object.keys(EFFECT_BANK))
    h.soundscape.feedbackDirector.buffers.set(name, { duration: 0.5 });
  const audio = createOverflightAudio(h.soundscape),
    run = { phase: 'playing', compiled: { id: 'same' }, player: {} };
  audio.start(run, { bodyId: 'scout' });
  assert([...h.soundscape.voices].some((v) => v.name === 'esc-start'));
  const count = h.soundscape.voices.size;
  audio.start(run);
  assert.equal(h.soundscape.voices.size, count);
  audio.flight(run, { active: true });
  audio.flight(run, { active: true });
  assert.equal([...h.soundscape.voices].filter((v) => v.source.loop).length, 1);
  audio.flight(run, { active: false });
  assert.equal([...h.soundscape.voices].filter((v) => v.source.loop).length, 0);
  audio.reset();
  h.context.currentTime += 1;
  audio.start({ ...run });
  assert([...h.soundscape.voices].some((v) => v.name === 'esc-retry'));
  audio.dispose();
  h.soundscape.pause();
  assert.equal(h.soundscape.voices.size, 0);
});
test('first-activation ESC fallback follows master gates and does not replay after decoding', async (t) => {
  const h = audioHarness();
  t.after(() => h.soundscape.dispose());
  await h.soundscape.enable();
  const audio = createOverflightAudio(h.soundscape);
  const first = { phase: 'playing', compiled: { id: 'first' }, player: {} };
  audio.start(first);
  assert.equal([...h.soundscape.voices].filter((v) => v.name === 'esc-start').length, 4);
  h.soundscape.stopVoices();
  h.soundscape.feedbackDirector.buffers.set('esc-start', { duration: 0.5 });
  audio.start(first);
  assert.equal(h.soundscape.voices.size, 0, 'decoded intro cannot replay an observed launch');
  h.soundscape.feedbackDirector.buffers.clear();
  const original = h.soundscape.audioMaster;
  try {
    h.soundscape.audioMaster = { ...original, volume: 0 };
    audio.start({ ...first, compiled: { id: 'muted' } });
    assert.equal(h.soundscape.voices.size, 0, 'zero master admits no fallback voices');
  } finally {
    h.soundscape.audioMaster = original;
  }
});
test('all eight Studio slots are optional, exact recordings are bounded and sources carry CC0 provenance', async () => {
  const bundle = createDefaultThemeBundle();
  const ledger = JSON.parse(
    await readFile(
      new URL('../../authoring/audio/human-reactions-v1/sources.json', import.meta.url),
    ),
  );
  assert.equal(ledger.license, 'CC0-1.0');
  const sourceRoot = new URL('../../authoring/audio/human-reactions-v1/', import.meta.url);
  const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
  const production = JSON.parse(await readFile(new URL('production.json', sourceRoot)));
  assert.equal(
    digest(await readFile(new URL('../../scripts/produce-human-reactions.py', import.meta.url))),
    production.production.scriptSha256,
  );
  for (const [name, metadata] of Object.entries(ledger.files))
    assert.equal(digest(await readFile(new URL(name, sourceRoot))), metadata.sha256);
  assert.equal(digest(await readFile(new URL('CC0-1.0.txt', sourceRoot))), ledger.licenseSha256);
  assert.equal(
    digest(await readFile(new URL('source-page.html', sourceRoot))),
    ledger.sourcePageSha256,
  );
  const hashes = new Set();
  for (const cue of HUMAN_REACTION_CUES) {
    const slot = bundle.slots.find((row) => row.id === `audio.${cue}`);
    assert.equal(slot.required, false);
    const entry = EFFECT_BANK[cue],
      wav = await readFile(new URL(`../audio/effects/${entry.file}`, import.meta.url));
    assert.equal(wav.length, entry.bytes);
    assert.equal(createHash('sha256').update(wav).digest('hex'), entry.sha256);
    hashes.add(entry.sha256);
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.readUInt16LE(22), 1);
    assert.equal(wav.readUInt32LE(24), 48000);
    assert((wav.length - 44) / 96000 <= 0.7);
    let peak = 0;
    for (let i = 44; i < wav.length; i += 2)
      peak = Math.max(peak, Math.abs(wav.readInt16LE(i)) / 32768);
    assert(peak > 0.001 && peak <= 0.101);
    let energy = 0,
      maximum = 0;
    const values = Array.from(
      { length: (wav.length - 44) / 2 },
      (_, i) => wav.readInt16LE(44 + i * 2) / 32768,
    );
    for (let i = 0; i < values.length; i++) {
      energy += values[i] ** 2;
      if (i >= 2400) energy -= values[i - 2400] ** 2;
      maximum = Math.max(maximum, energy);
    }
    assert(
      20 * Math.log10(Math.sqrt(maximum / Math.min(2400, values.length))) <= -29.99,
      `${cue} exceeds the 50ms RMS limit`,
    );
    assert.equal(production[cue].sha256, entry.sha256);
  }
  assert.equal(hashes.size, 8);
});

test('published vocal replacements use the same slot, attenuation and owned lifecycle', async (t) => {
  const h = audioHarness();
  t.after(() => h.soundscape.dispose());
  h.context.decodeAudioData = async () => ({
    duration: 0.4,
    length: 3200,
    sampleRate: 8000,
    numberOfChannels: 1,
    getChannelData: () => new Float32Array(3200).fill(0.5),
  });
  h.soundscape.setPublishedAudio(async () => ({ blob: new Blob([new Uint8Array(8)]) }));
  await h.soundscape.enable();
  await h.soundscape.publishedAudio.prepare(HUMAN_REACTION_CUES);
  assert(h.soundscape.humanReaction(human));
  const voice = [...h.soundscape.voices].find((v) => v.humanReaction);
  assert(HUMAN_REACTION_CUES.includes(voice.name));
  assert.equal(voice.bus, 'sfx');
  h.soundscape.pause();
  assert.equal(h.soundscape.voices.size, 0);
});
test('missing recordings keep the impact and never create a synthetic or deferred human voice', async (t) => {
  const h = audioHarness();
  t.after(() => h.soundscape.dispose());
  await h.soundscape.enable();
  assert(h.soundscape.encounter('catch', human));
  assert([...h.soundscape.voices].every((v) => !v.humanReaction));
  for (const name of HUMAN_REACTION_CUES)
    h.soundscape.feedbackDirector.buffers.set(name, { duration: 0.4 });
  assert([...h.soundscape.voices].every((v) => !v.humanReaction));
});

test('optional native practice decodes compact reactions once and owns pause/warning cleanup', async (t) => {
  const h = audioHarness();
  const decoded = {
    duration: 0.3,
    length: 2400,
    sampleRate: 8000,
    numberOfChannels: 1,
    getChannelData: () => new Float32Array(2400).fill(0.05),
  };
  let decodes = 0,
    settings = { brutal: true, vocals: true };
  h.context.decodeAudioData = async () => {
    decodes++;
    return decoded;
  };
  for (const name of [
    'createGain',
    'createOscillator',
    'createBiquadFilter',
    'createDynamicsCompressor',
  ]) {
    const make = h.context[name].bind(h.context);
    h.context[name] = () => {
      const node = make();
      node.connect = (target) => target;
      return node;
    };
  }
  const original = h.context.createBufferSource.bind(h.context);
  h.context.createBufferSource = () => {
    const source = original();
    source.stop = () => {
      source.stopped = true;
    };
    return source;
  };
  const master = createAudioMaster({ muted: false, volume: 0.4 });
  const audio = createWorldAudio({
    audioMaster: master,
    storage: { getItem: () => null, setItem() {} },
    getDestruction: () => settings,
    window: {
      AudioContext: function () {
        return h.context;
      },
      addEventListener() {},
      removeEventListener() {},
    },
  });
  t.after(() => {
    audio.dispose();
    master.dispose();
    h.soundscape.dispose();
  });
  audio.setCourse({
    actors: [{ id: 'runner', type: 'patrol' }],
    pursuit: { actors: [{ id: 'runner', family: 'runner' }] },
  });
  await audio.setEnabled(true);
  await Promise.resolve();
  assert.equal(decodes, 8);
  const state = { ticks: 0, step: 0, status: 'active', events: [], velocity: {}, contacts: 0 };
  audio.update(state);
  h.context.currentTime = 1;
  state.ticks++;
  state.events = [{ type: 'defeat', actor: 'runner' }];
  audio.update(state);
  const recorded = h.sources.filter((source) => source.buffer === decoded);
  assert.equal(recorded.length, 1);
  state.ticks++;
  state.events = [{ type: 'warning', actor: 'runner' }];
  audio.update(state);
  assert.equal(recorded[0].stopped, true);
  settings = { brutal: true, vocals: false };
  h.context.currentTime += 1;
  state.ticks++;
  state.events = [{ type: 'defeat', actor: 'runner' }];
  audio.update(state);
  assert.equal(h.sources.filter((source) => source.buffer === decoded).length, 1);
  audio.pause();
  await audio.resume();
  assert.equal(decodes, 8, 'no perdeath or retry decoding');
});
