import test from 'node:test';
import assert from 'node:assert/strict';
import { collectionResultLabels } from '../collection-results.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

const item = Object.freeze({
  campaignKey: 'chapter/1/exact-standard',
  levelId: 'split-ring',
  score: 14410,
  medal: 'silver',
  time: 55.77,
});

test('a lower-score Gold completion is visible beside the retained Silver score run', () => {
  const library = {
    campaigns: { [item.campaignKey]: { clears: { [item.levelId]: { medals: 3 } } } },
  };
  const before = structuredClone(library);
  const labels = collectionResultLabels(item, library);
  assert.match(labels.card, /Level best GOLD/);
  assert.match(labels.detail, /SILVER · 55\.77s · Level best medal: GOLD/);
  assert.ok(labels.detail.includes(item.score.toLocaleString()));
  assert.deepEqual(library, before);
  assert.equal(item.medal, 'silver');
});

test('a different difficulty or level cannot supply a better medal', () => {
  const library = {
    campaigns: {
      'chapter/1/exact-gentle': { clears: { [item.levelId]: { medals: 3 } } },
      [item.campaignKey]: { clears: { 'another-map': { medals: 3 } } },
    },
  };
  const labels = collectionResultLabels(item, library);
  assert.doesNotMatch(labels.card, /GOLD|Level best/);
  assert.match(labels.card, /Score run SILVER/);
  assert.doesNotMatch(labels.detail, /Level best/);
});

test('unavailable or malformed progress does not invent level mastery', () => {
  for (const medals of [undefined, 0, 4, 'gold', '3']) {
    const library = {
      campaigns: { [item.campaignKey]: { clears: { [item.levelId]: { medals } } } },
    };
    const labels = collectionResultLabels(item, library);
    assert.match(labels.card, /Score run SILVER/);
    assert.doesNotMatch(labels.detail, /Level best/);
  }
});

test('collection result projection follows the active locale', (context) => {
  const locale = getLocale();
  context.after(() => setLocale(locale, { persist: false }));
  const library = {
    campaigns: { [item.campaignKey]: { clears: { [item.levelId]: { medals: 3 } } } },
  };
  setLocale('uk', { persist: false });
  const labels = collectionResultLabels(item, library);
  assert.match(labels.card, /Найкращий результат картини.*ЗОЛОТО/);
  assert.match(labels.detail, /СРІБЛО · 55,77 с.*ЗОЛОТО/);
  assert.doesNotMatch(labels.card + labels.detail, /Picture|Level|SILVER|GOLD/);
});
