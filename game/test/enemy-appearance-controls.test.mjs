import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { memoryStorage } from './helpers/solo-dom.mjs';
import { createEnemyArtworkPreferences, runtimeActorArtRevision } from '../hunt/preferences.mjs';
import { mountEnemyAppearanceControls } from '../ui/enemy-appearance-controls.mjs';

const settle = () => new Promise((resolve) => setImmediate(resolve));
function fixture(t, actions = {}) {
  const document = new Document(),
    window = new Events(),
    storage = memoryStorage(),
    preferences = createEnemyArtworkPreferences({ window, getStorage: () => storage }),
    calls = [];
  let locale = 'en';
  const controls = mountEnemyAppearanceControls({
    document,
    container: document.body,
    preferences,
    locale: () => locale,
    applyMilitary: () => calls.push('military'),
    applyAuthored: () => calls.push('authored'),
    ...actions,
  });
  t.after(() => {
    controls.dispose();
    preferences.dispose();
  });
  const select = document.querySelector('[data-enemy-appearance]');
  return {
    document,
    storage,
    preferences,
    controls,
    calls,
    select,
    language(value) {
      locale = value;
      controls.refresh();
    },
    choose(value) {
      select.value = value;
      select.dispatchEvent({ type: 'change' });
    },
  };
}

test('opening settings shows both presets without changing artwork, population or preferences', (t) => {
  const f = fixture(t);
  assert.equal(f.select.value, 'authored');
  assert.deepEqual(
    [...f.select.options].map((option) => option.value),
    ['authored', 'military'],
  );
  assert.deepEqual(f.storage.writes, []);
  assert.deepEqual(f.calls, []);
  assert.match(f.document.body.textContent, /starting a new attempt/);
  assert.match(f.document.body.textContent, /Retry and Continue keep accepted artwork/);
  assert.match(f.document.body.textContent, /Snake targets stay humanoid/);
  assert.equal(f.document.querySelector('details').open, false);
});

test('explicit military selection calls the native complete preset and persists only the art choice', async (t) => {
  const f = fixture(t);
  f.choose('military');
  await settle();
  assert.equal(f.preferences.snapshot().style, 'military');
  assert.deepEqual(f.calls, ['military']);
  assert.equal(f.storage.writes.length, 1);
  f.choose('authored');
  await settle();
  assert.deepEqual(f.calls, ['military', 'authored']);
  assert.equal(f.preferences.snapshot().style, 'authored');
});

test('localized and remotely changed preferences reuse the focused native control without writing', (t) => {
  const f = fixture(t);
  f.select.focus();
  f.language('uk');
  assert.equal(f.document.activeElement, f.select);
  assert.match(f.document.body.textContent, /Військове поле/);
  assert.deepEqual(f.storage.writes, []);
  f.preferences.set({ style: 'military' });
  assert.equal(f.select.value, 'military');
  assert.deepEqual(f.calls, [], 'A remote view update cannot apply a preset again.');
});

test('a retired failed preparation cannot replace newer preset feedback', async (t) => {
  let reject;
  const f = fixture(t, {
    applyMilitary: () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  });
  f.choose('military');
  f.choose('authored');
  await settle();
  reject(new Error('retired'));
  await settle();
  assert.equal(f.select.value, 'authored');
  assert.doesNotMatch(f.document.body.textContent, /could not be prepared/);
});

test('current preparation failures are visible and disposed controls stop accepting changes', async (t) => {
  const f = fixture(t, {
    applyMilitary: async () => {
      throw new Error('unavailable');
    },
  });
  f.choose('military');
  await settle();
  assert.match(f.document.body.textContent, /could not be prepared/);
  const writes = f.storage.writes.length;
  f.controls.dispose();
  f.choose('authored');
  assert.equal(f.storage.writes.length, writes);
});

function reviewLocation(href) {
  const location = { href },
    replacements = [],
    state = { navigationOwner: 'native-snake', replayCursor: 7 },
    history = {
      state,
      replaceState(value, title, next) {
        replacements.push({ value, title, next });
        location.href = next;
      },
    };
  return { location, history, replacements, state };
}

test('a review link shows its effective preset so choosing Original produces a real value change', async (t) => {
  const navigation = reviewLocation(
      'https://example.test/game/snake/play.html?artReview=industrial-overhead-v2&seed=17',
    ),
    f = fixture(t, navigation);
  assert.equal(f.preferences.snapshot().style, 'authored');
  assert.equal(f.select.value, 'military');
  assert.deepEqual(f.storage.writes, []);
  assert.match(f.document.body.textContent, /Preview artwork is active/);
  assert.equal(
    runtimeActorArtRevision(navigation.location, f.preferences.snapshot()),
    'industrial-overhead-v2',
    'Displaying a review does not promote its revision',
  );
  f.language('uk');
  assert.match(f.document.body.textContent, /Активний попередній перегляд/);
  f.choose('authored');
  await settle();
  assert.equal(f.select.value, 'authored');
  assert.equal(runtimeActorArtRevision(navigation.location, f.preferences.snapshot()), null);
  assert.equal(navigation.location.href, 'https://example.test/game/snake/play.html?seed=17');
  assert.deepEqual(f.calls, ['authored']);
});

test('an explicit preset replaces only a supported native cosmetic review pin without navigation', async (t) => {
  for (const base of [
    'https://example.test/releases/v1/game/snake/play.html',
    'http://127.0.0.1:8779/game/',
    'file:///Users/example/release/game/couch/relay-rescue.html',
    'capacitor://localhost/game/snake/play.html',
  ]) {
    for (const revision of [
      'industrial-pilot-v1',
      'industrial-overhead-v2',
      'industrial-roster-v3',
    ]) {
      for (const style of ['authored', 'military']) {
        const url = new URL(base);
        url.search = '?lang=uk&mode=team&seed=17&replay=kept&appearanceRevision=r2&note=a%20b';
        url.searchParams.set('artReview', revision);
        url.hash = '#mission-details';
        const expected = new URL(url);
        expected.searchParams.delete('artReview');
        const navigation = reviewLocation(url.href),
          f = fixture(t, navigation);
        assert.deepEqual(navigation.replacements, [], 'Opening controls preserves the review link');
        f.language('uk');
        f.preferences.set({ style: 'military' });
        assert.deepEqual(
          navigation.replacements,
          [],
          'Locale/remote preference changes preserve the pin',
        );
        f.choose(style);
        await settle();
        assert.equal(navigation.location.href, expected.href);
        assert.equal(navigation.replacements.length, 1);
        assert.equal(navigation.replacements[0].value, navigation.state);
        assert.equal(navigation.replacements[0].title, '');
        assert.equal(f.preferences.snapshot().style, style);
        assert.deepEqual(f.calls, [style]);
        f.choose(style === 'military' ? 'authored' : 'military');
        await settle();
        assert.equal(
          navigation.replacements.length,
          1,
          'Ordinary subsequent choices do not rewrite URLs',
        );
      }
    }
  }
});

test('unknown, duplicate and unsupported review URLs remain untouched by explicit presets', async (t) => {
  for (const href of [
    'https://example.test/game/snake/play.html?artReview=unknown#kept',
    'https://example.test/game/snake/play.html?artReview=industrial-roster-v3&artReview=industrial-roster-v3',
    'https://example.test/game/snake/play.html?artReview=unknown&artReview=industrial-roster-v3',
    'https://example.test/community/custom.html?artReview=industrial-roster-v3',
    'https://user:secret@example.test/game/?artReview=industrial-roster-v3',
    'ftp://example.test/game/?artReview=industrial-roster-v3',
    'https://example.test/game/?seed=17&replay=kept#details',
    'not a URL',
  ]) {
    const navigation = reviewLocation(href),
      f = fixture(t, navigation);
    f.choose('military');
    await settle();
    assert.equal(navigation.location.href, href);
    assert.deepEqual(navigation.replacements, []);
    assert.deepEqual(f.calls, ['military']);
  }
});

test('a denied history replacement reports failure without pretending the review pin was removed', async (t) => {
  const navigation = reviewLocation(
      'https://example.test/game/snake/play.html?artReview=industrial-roster-v3&seed=17',
    ),
    original = navigation.location.href,
    f = fixture(t, {
      ...navigation,
      history: {
        replaceState() {
          throw new Error('Denied');
        },
      },
    });
  f.choose('military');
  await settle();
  assert.equal(navigation.location.href, original);
  assert.deepEqual(f.calls, []);
  assert.deepEqual(f.storage.writes, []);
  assert.equal(f.select.value, 'military', 'The unchanged preview remains accurately represented');
  assert.match(f.document.body.textContent, /could not be prepared/);
});
