import test from 'node:test';
import assert from 'node:assert/strict';
import { audioHarness } from './helpers/soundtrack-audio.mjs';
import {
  DESTRUCTION_CATEGORIES,
  DESTRUCTION_CUES,
  destructionCategory,
} from '../ui/destruction-audio.mjs';
import { encounterSoundRecipe } from '../ui/encounter-audio.mjs';
import { EFFECT_BANK } from '../audio/effects/bank.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';

test('the complete enemy vocabulary resolves material and size before variation', () => {
  for (const [family, machine, expected] of [
    ['runner', false, 'soft'],
    ['courier', false, 'soft'],
    ['shield-bearer', false, 'armored'],
    ['brace-trooper', false, 'armored'],
    ['utility-car', true, 'light'],
    ['armored-carrier', true, 'heavy'],
    ['tracked-tank', true, 'heavy'],
    ['relay-warden', false, 'electronic'],
    ['sentry', true, 'electronic'],
  ])
    assert.equal(destructionCategory({ family, machine }), expected, family);
  const recipes = DESTRUCTION_CATEGORIES.map((category) =>
    encounterSoundRecipe('catch', { category }),
  );
  assert.equal(new Set(recipes.map((recipe) => recipe.name)).size, 5);
  for (const recipe of recipes) {
    assert(recipe.maxDuration <= 0.85);
    assert(recipe.priority < encounterSoundRecipe('warning').priority);
    for (const suffix of ['', '-1', '-2']) assert(EFFECT_BANK[recipe.name + suffix]);
  }
  assert(encounterSoundRecipe('catch', { brutal: true }).gain > encounterSoundRecipe('catch').gain);
  assert.deepEqual(
    encounterSoundRecipe('catch', { machine: 'tracked', brutal: true }),
    encounterSoundRecipe('catch', { machine: 'tracked' }),
  );
});

test('mixed mass clears preserve categories while bounding samples and variant repetition', async (t) => {
  const h = audioHarness();
  t.after(() => h.soundscape.dispose());
  await h.soundscape.enable();
  for (const name of Object.keys(EFFECT_BANK))
    h.soundscape.feedbackDirector.buffers.set(name, { duration: 0.5 });
  for (let i = 0; i < 1000; i++)
    h.soundscape.encounter('catch', { category: DESTRUCTION_CATEGORIES[i % 5] });
  assert.equal(h.soundscape.voices.size, 5, 'one sound per category, not one per enemy');
  for (const cue of DESTRUCTION_CUES)
    assert([...h.soundscape.voices].some((voice) => voice.cueFamily === cue));
  const names = [];
  for (let i = 0; i < 4; i++) {
    h.soundscape.stopVoices();
    h.context.currentTime += 1;
    h.soundscape.encounter('catch', { family: 'runner' });
    names.push([...h.soundscape.voices][0].name);
  }
  for (let i = 1; i < names.length; i++) assert.notEqual(names[i], names[i - 1]);
  for (let frame = 0; frame < 40; frame++) {
    h.context.currentTime += 0.25;
    for (const category of DESTRUCTION_CATEGORIES) h.soundscape.encounter('catch', { category });
  }
  assert(h.soundscape.voices.size <= 16);
  h.context.currentTime += 1;
  assert(h.soundscape.encounter('warning'), 'warnings can steal less important effects');
  h.soundscape.pause();
  assert.equal(h.soundscape.voices.size, 0);
  assert.equal(h.soundscape.encounter('catch'), false);
});

test('offline destruction cannot overflow feedback voices or steal the music owner', async (t) => {
  const h = audioHarness();
  t.after(() => h.soundscape.dispose());
  await h.soundscape.enable();
  let stopped = false;
  const music = {
    bus: 'music',
    stop() {
      stopped = true;
    },
  };
  h.soundscape.voices.add(music);
  for (let i = 0; i < 200; i++) {
    h.context.currentTime += 0.25;
    h.soundscape.encounter('catch', { category: DESTRUCTION_CATEGORIES[i % 5] });
  }
  assert(h.soundscape.voices.size <= 17);
  assert.equal(stopped, false);
  h.soundscape.voices.delete(music);
});

test('terminal tails are bounded destruction only; ordinary pause and mute still clear them', async (t) => {
  const h = audioHarness();
  t.after(() => h.soundscape.dispose());
  await h.soundscape.enable();
  h.soundscape.encounter('catch', { family: 'tracked-tank' });
  h.soundscape.encounter('fire');
  h.soundscape.pause({ preserveDestruction: true });
  assert(h.soundscape.voices.size > 0);
  assert([...h.soundscape.voices].every((voice) => voice.name.startsWith('destroy-')));
  assert.equal(h.soundscape.encounter('catch'), false, 'no new events during results');
  h.soundscape.pause();
  assert.equal(h.soundscape.voices.size, 0);
});

test('Studio destruction slots are optional and share the existing portable audio contract', () => {
  const bundle = createDefaultThemeBundle();
  for (const cue of DESTRUCTION_CUES) {
    const slot = bundle.slots.find((row) => row.id === `audio.${cue}`);
    assert.equal(slot.required, false);
    assert.deepEqual(slot.kinds, ['audio', 'recipe']);
    assert.deepEqual(slot.recipes, ['audio.ui.v1']);
  }
});

test('published destruction uses its category slot, bounded gain/tail and shared feedback budget', async (t) => {
  const h = audioHarness(),
    reads = [];
  t.after(() => h.soundscape.dispose());
  h.context.decodeAudioData = async () => ({
    duration: 0.95,
    length: 45600,
    numberOfChannels: 1,
    sampleRate: 48000,
    getChannelData: () => new Float32Array(45600),
  });
  h.soundscape.setPublishedAudio(async (slot) => {
    reads.push(slot);
    return { blob: new Blob([new Uint8Array(8)]) };
  });
  await h.soundscape.enable();
  await h.soundscape.publishedAudio.prepare(DESTRUCTION_CUES);
  assert.deepEqual(
    reads,
    DESTRUCTION_CUES.map((cue) => `audio.${cue}`),
  );
  for (const category of DESTRUCTION_CATEGORIES)
    assert(h.soundscape.encounter('catch', { category }));
  assert.equal(h.soundscape.voices.size, 5);
  assert([...h.soundscape.voices].every((voice) => voice.feedback && voice.bus === 'sfx'));
  for (let i = 0; i < 50; i++) {
    h.context.currentTime += 0.3;
    h.soundscape.encounter('catch', { category: 'heavy' });
  }
  assert(h.soundscape.voices.size <= 16);
  h.soundscape.pause();
  assert.equal(h.soundscape.voices.size, 0);
});
