import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import {
  createEncounterPreferences,
  ENCOUNTER_PREFERENCES_KEY,
  mountEncounterControls,
} from '../../optional-practice/civilian-fpv/encounter-controls.mjs';

test('encounter defaults follow the selected level and explicit historical launches', () => {
  const prefs = createEncounterPreferences();
  assert.equal(prefs.select({ learning: true }).activity, 'original');
  assert.equal(prefs.select({ learning: false }).activity, 'continuous');
  assert.equal(
    prefs.select({ original: true, override: { activity: 'hunting' } }).activity,
    'original',
  );
});
test('learning and other choices persist independently; invalid choices are ignored', () => {
  const records = new Map(),
    storage = {
      getItem: (key) => records.get(key),
      setItem: (key, value) => records.set(key, value),
    };
  const prefs = createEncounterPreferences(storage);
  prefs.update({ activity: 'hunting', difficulty: 'hard', population: 20 }, false);
  assert.equal(prefs.select({ learning: true }).activity, 'original');
  const next = createEncounterPreferences(storage);
  assert.deepEqual(next.select(), {
    version: 2,
    survivalMode: 'timed',
    loadout: ['autocannon', 'scatter'],
    payload: 'bomb',
    ammoPreset: 'balanced',
    playerDamage: 'normal',
    enemyDamage: 'normal',
    activity: 'hunting',
    difficulty: 'hard',
    population: 20,
    seed: 1,
  });
  next.update({ activity: 'wrong', difficulty: null, population: 200 });
  assert.equal(next.select().population, 20);
  assert.equal(records.size, 1);
  assert.ok(records.has(ENCOUNTER_PREFERENCES_KEY));
});
test('retry overrides retain activity, difficulty, population and seed', () => {
  const prefs = createEncounterPreferences({
    getItem() {
      throw Error('denied');
    },
  });
  const override = { activity: 'elimination', difficulty: 'easy', population: 6, seed: 998 };
  assert.deepEqual(prefs.select({ learning: true, override }), { ...prefs.select(), ...override });
  assert.equal(prefs.select({ override: { seed: -1 } }).seed, 1);
});

test('v1 preferences migrate without changing learning choices or radio storage', () => {
  const records = new Map([
    [
      ENCOUNTER_PREFERENCES_KEY,
      JSON.stringify({
        format: 'FPVEncounterPreferences.v1',
        learning: 'original',
        other: 'elimination',
        difficulty: 'easy',
        population: 6,
      }),
    ],
    ['radio-profile', 'unchanged'],
  ]);
  const prefs = createEncounterPreferences({
    getItem: (k) => records.get(k),
    setItem: (k, v) => records.set(k, v),
  });
  assert.equal(prefs.select().activity, 'elimination');
  prefs.update({
    activity: 'survival',
    population: 128,
    loadout: ['precision', 'rocket'],
    ammoPreset: 'tactical',
  });
  assert.equal(prefs.select().population, 128);
  assert.equal(prefs.select({ learning: true }).activity, 'original');
  prefs.update({ activity: 'hunting' });
  assert.equal(prefs.select().population, 6);
  assert.deepEqual(prefs.select().loadout, ['precision', 'rocket']);
  assert.equal(records.get('radio-profile'), 'unchanged');
});
test('historical definitions retain original version and retry bytes', () => {
  const historical = {
    format: 'FPVEncounterDefinition.v1',
    activity: 'hunting',
    population: 6,
    seed: 17,
  };
  assert.deepEqual(createEncounterPreferences().select({ override: historical }), historical);
});

test('activity controls show the admitted authored minimum without changing the requested preset', () => {
  const document = new Document(),
    container = document.createElement('div');
  let locale = 'en';
  const controls = mountEncounterControls({ document, container, locale: () => locale }),
    selection = createEncounterPreferences().select({ override: { population: 6 } }),
    before = structuredClone(selection);
  controls.update({
    selection,
    encounter: { population: 12, admittedCount: 9, actors: Array(9).fill({}) },
  });
  const status = container.querySelector('[role="status"]');
  assert.equal(status.textContent, 'Targets: 9 / 12 · Authored roster minimum');
  assert.equal(container.querySelector('[data-encounter-choice="population"]').value, '6');
  locale = 'uk';
  controls.refresh();
  assert.equal(status.textContent, 'Цілі: 9 / 12 · Мінімум заданого складу');
  controls.update({ selection, encounter: { actors: Array(4).fill({}) } });
  assert.equal(
    status.textContent,
    'Цілі: 4 / 6',
    'historical snapshots retain the selected fallback',
  );
  assert.deepEqual(selection, before);
  controls.dispose();
});
