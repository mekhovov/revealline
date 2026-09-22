import test from 'node:test';
import assert from 'node:assert/strict';
import { JOURNEY_REACTIONS, journeyResultReaction } from '../journey/reactions.mjs';
import {
  createReactionPreferences,
  validateReactionPreferences,
  JOURNEY_REACTION_PREFERENCES_KEY as key,
} from '../journey/reaction-preferences.mjs';
import { attachJourneyReactions } from '../ui/journey-reactions.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { memoryStorage } from './helpers/solo-dom.mjs';

const context = Object.freeze({
  owned: true,
  mode: 'solo',
  outcome: 'won',
  missionId: 'candidate/opening/first-return',
});
const encode = (enabled) => JSON.stringify({ format: 'JourneyReactionPreferencesV1', enabled });
test('four original speakers use bounded stable copy with no randomness or imported text', () => {
  assert.deepEqual(Object.keys(JOURNEY_REACTIONS), ['guide', 'engineer', 'rival', 'sentinel']);
  for (const entry of Object.values(JOURNEY_REACTIONS)) {
    assert(Object.isFrozen(entry) && Object.isFrozen(entry.lines));
    assert(entry.lines.every((line) => line.length <= 80));
  }
  for (const [options, speaker] of [
    [{}, 'guide'],
    [{ relays: true }, 'engineer'],
    [{ mode: 'team' }, 'engineer'],
    [{ mode: 'versus' }, 'rival'],
    [{ mode: 'versus', outcome: 'draw' }, 'rival'],
    [{ encounter: true }, 'sentinel'],
  ]) {
    const source = Object.freeze({ ...context, ...options });
    const a = journeyResultReaction(source);
    assert.equal(a.speaker, speaker);
    assert(Object.isFrozen(a));
    assert.deepEqual(journeyResultReaction(source), a);
  }
  assert.doesNotMatch(
    journeyResultReaction({ ...context, missionId: '<img onerror=bad>' }).text,
    /img|onerror/,
  );
});
test('unowned, live, failed, invalid and solo-draw contexts cannot produce reactions', () => {
  for (const options of [
    { owned: false },
    { owned: 'true' },
    { mode: 'unknown' },
    { outcome: 'running' },
    { outcome: 'respawning' },
    { outcome: 'paused' },
    { outcome: 'lost' },
    { outcome: 'draw' },
    { missionId: '' },
    { missionId: 'x'.repeat(513) },
  ])
    assert.equal(journeyResultReaction({ ...context, ...options }), null);
  assert.equal(journeyResultReaction(null), null);
});
test('reaction preference loading is read-only and shares one independent mode/release key', () => {
  const storage = memoryStorage({ 'revealline.library.dev.v1': 'unchanged' });
  const options = { getStorage: () => storage, window: new Events() };
  const first = createReactionPreferences(options);
  assert.deepEqual(first.snapshot(), { enabled: true, durable: true, error: '' });
  assert.equal(storage.getItem(key), null);
  first.choose(false);
  const second = createReactionPreferences(options);
  assert.equal(second.snapshot().enabled, false);
  assert.equal(storage.getItem('revealline.library.dev.v1'), 'unchanged');
  first.dispose();
  second.dispose();
});
test('strict records reject malformed, extra and future fields without invoking getters', () => {
  for (const raw of [
    null,
    [],
    {},
    { format: 'future', enabled: true },
    { format: 'JourneyReactionPreferencesV1', enabled: 1 },
    { format: 'JourneyReactionPreferencesV1', enabled: true, extra: false },
  ])
    assert.throws(() => validateReactionPreferences(raw));
  let calls = 0;
  assert.throws(() =>
    validateReactionPreferences({
      format: 'JourneyReactionPreferencesV1',
      get enabled() {
        calls++;
        return true;
      },
    }),
  );
  assert.equal(calls, 0);
});
test('future or damaged preference bytes are kept and do not prevent a session-only choice', () => {
  for (const raw of ['bad JSON', '{"format":"FutureV2","enabled":true}', 'x'.repeat(300)]) {
    const storage = memoryStorage({ [key]: raw });
    const prefs = createReactionPreferences({ getStorage: () => storage, window: new Events() });
    assert.equal(prefs.snapshot().enabled, false);
    assert.equal(prefs.snapshot().durable, false);
    assert.equal(prefs.choose(true).enabled, true);
    assert.equal(prefs.snapshot().durable, false);
    assert.equal(storage.getItem(key), raw);
    prefs.dispose();
  }
});
test('quota failure and readback mismatch are truthful and explicit Retry can persist pending intent', () => {
  const storage = memoryStorage(),
    window = new Events();
  const write = storage.setItem.bind(storage);
  let fail = true;
  storage.setItem = (name, value) => {
    if (fail) throw Error('quota');
    write(name, value);
  };
  const prefs = createReactionPreferences({ getStorage: () => storage, window });
  prefs.choose(false);
  assert.match(prefs.snapshot().error, /session-only/);
  write(key, encode(true));
  window.emit('storage', { key, newValue: encode(true), storageArea: storage });
  assert.equal(prefs.snapshot().enabled, false, 'pending local intent is retained');
  fail = false;
  assert.equal(prefs.retry().durable, true);
  assert.equal(storage.getItem(key), encode(false));
  storage.setItem = () => {};
  assert.equal(prefs.choose(true).durable, false, 'a silently refused write cannot claim success');
  prefs.dispose();
});
test('cross-tab changes require current bytes/storage and bfcache refresh; disposed observers retire', () => {
  const storage = memoryStorage(),
    window = new Events();
  const prefs = createReactionPreferences({ getStorage: () => storage, window });
  storage.setItem(key, encode(false));
  window.emit('storage', { key, newValue: encode(false), storageArea: {} });
  assert.equal(prefs.snapshot().enabled, true);
  window.emit('storage', { key, newValue: encode(true), storageArea: storage });
  assert.equal(prefs.snapshot().enabled, true);
  window.emit('storage', { key, newValue: encode(false), storageArea: storage });
  assert.equal(prefs.snapshot().enabled, false);
  storage.setItem(key, encode(true));
  window.emit('pageshow', { persisted: true });
  assert.equal(prefs.snapshot().enabled, true);
  prefs.dispose();
  storage.setItem(key, encode(false));
  window.emit('pageshow', { persisted: true });
  assert.equal(prefs.snapshot().enabled, true);
});
for (const prefix of ['', 'race-', 'coop-'])
  test(`${prefix || 'solo-'} presenter is silent, text-only, optional and retires on a non-result`, () => {
    const doc = new Document(),
      window = new Events(),
      storage = memoryStorage();
    for (const [suffix, tag] of [
      ['', 'p'],
      ['-enabled', 'input'],
      ['-status', 'p'],
      ['-retry', 'button'],
    ]) {
      const element = doc.createElement(tag);
      element.id = `${prefix}journey-reactions${suffix}`;
      doc.body.append(element);
    }
    const $ = (suffix) => doc.getElementById(`${prefix}journey-reactions${suffix}`);
    const originalFocus = doc.activeElement;
    const presenter = attachJourneyReactions({
      document: doc,
      window,
      prefix,
      getStorage: () => storage,
    });
    presenter.present(context);
    assert.equal($('').hidden, false);
    assert.match($('').textContent, /^Guide — /);
    assert.equal($('').getAttribute('aria-live'), null);
    assert.equal($('').children.length, 0);
    assert.equal(doc.activeElement, originalFocus);
    $('-enabled').checked = false;
    $('-enabled').emit('change');
    assert.equal($('').hidden, true);
    $('-enabled').checked = true;
    $('-enabled').emit('change');
    assert.equal($('').hidden, false);
    presenter.present({ ...context, outcome: 'running' });
    assert.equal($('').hidden, true);
    assert.equal($('').textContent, '');
    presenter.dispose();
    presenter.present(context);
    assert.equal($('').hidden, true);
  });
