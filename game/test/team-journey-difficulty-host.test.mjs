import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { deferred, waitFor } from './helpers/coop-presentation-fixture.mjs';
import { JOURNEY_PREFERENCES_KEY, JOURNEY_PREFERENCES_VERSION } from '../journey/preferences.mjs';
import { createTeamJourneyCandidates } from '../content-design/team-journey-candidates.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';

function memory() {
  const values = new Map(),
    writes = [];
  return {
    values,
    writes,
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      values.set(key, value);
      writes.push([key, value]);
    },
  };
}
async function fixture(t, { preferences = memory(), beforeImport, ...options } = {}) {
  const f = await page(t, {
    href: 'http://localhost/game/couch/relay-rescue.html?journey=team-greybox',
    nativeFocus: true,
    nativeVisibility: true,
    retainInitialDifficulty: true,
    ...options,
    beforeImport(context) {
      context.install('localStorage', { value: preferences });
      beforeImport?.(context);
    },
  });
  return Object.assign(f, { preferences });
}
const ready = (f) =>
  waitFor(
    () => !f.$('coop-start').disabled && f.$('coop-picture-status').dataset.state === 'ready',
    () => f.$('coop-picture-status').textContent,
  );
async function skip(f) {
  f.$('coop-journey-skip').focus();
  f.tap('Enter');
  assert.equal(f.$('coop-journey-skip-confirm').textContent, 'Confirm skip');
  f.tap('Enter');
  await waitFor(() => f.$('coop-overlay').hidden);
}

for (const [difficulty, reserves] of [
  ['gentle', '4 reserves'],
  ['standard', '2 reserves'],
  ['expert', '1 reserve'],
])
  test(`owned Team setup selects compiled ${difficulty}, saves shared preference and retains it across Skip`, async (t) => {
    const f = await fixture(t);
    assert.equal(f.$('coop-difficulty').disabled, false);
    await f.choose('coop-difficulty', difficulty);
    await ready(f);
    assert.equal(f.$('coop-level').value, 'twin-landings');
    assert.equal(f.$('coop-difficulty').value, difficulty);
    assert.deepEqual(JSON.parse(f.preferences.getItem(JOURNEY_PREFERENCES_KEY)), {
      format: JOURNEY_PREFERENCES_VERSION,
      difficulty,
    });
    assert.deepEqual(
      f.preferences.writes.map(([key]) => key),
      [JOURNEY_PREFERENCES_KEY],
    );
    f.$('coop-start').click();
    assert.equal(f.$('coop-reserves').textContent, reserves);
    assert.equal(f.$('coop-difficulty').disabled, true);
    f.choose('coop-difficulty', difficulty === 'expert' ? 'gentle' : 'expert');
    assert.equal(
      f.$('coop-difficulty').value,
      difficulty,
      'Hidden setup cannot alter an admitted attempt.',
    );
    await skip(f);
    assert.equal(f.$('coop-level').value, 'stepping-exchange');
    assert.equal(f.$('coop-difficulty').value, difficulty);
    assert.equal(f.$('coop-reserves').textContent, reserves);
  });

test('an imported Team preset with matching Journey IDs stays immutable and never rewrites shared difficulty', async (t) => {
  const f = await fixture(t);
  await f.selectFile(
    JSON.stringify(createTeamTestPack(createTeamJourneyCandidates(), 'twin-landings', 'expert')),
  );
  assert.equal(f.$('coop-difficulty').disabled, true);
  f.choose('coop-difficulty', 'gentle');
  assert.equal(f.$('coop-difficulty').value, 'expert');
  assert.deepEqual(f.preferences.writes, []);
  f.$('coop-start').click();
  assert.equal(f.$('coop-reserves').textContent, '1 reserve');
  assert.equal(f.$('coop-journey-skip').hidden, true);
});

test('newer Team preset intent defeats a late old decoder and never starts the superseded edition', async (t) => {
  const gate = deferred();
  let holdNext = false,
    entered = false;
  t.after(() => gate.resolve());
  const f = await fixture(t, {
    presentation: {
      async decode() {
        if (holdNext) {
          holdNext = false;
          entered = true;
          await gate.promise;
        }
      },
    },
  });
  holdNext = true;
  const old = f.choose('coop-difficulty', 'expert');
  await waitFor(() => entered);
  assert.equal(f.$('coop-start').disabled, true);
  f.$('coop-start').click();
  assert.equal(f.$('coop-menu').hidden, false);
  await f.choose('coop-difficulty', 'gentle');
  await ready(f);
  gate.resolve();
  await old;
  assert.equal(f.$('coop-difficulty').value, 'gentle');
  f.$('coop-start').click();
  assert.equal(f.$('coop-reserves').textContent, '4 reserves');
  assert.equal(JSON.parse(f.preferences.getItem(JOURNEY_PREFERENCES_KEY)).difficulty, 'gentle');
});

test('a failed Team preset picture remains an explicit retryable intent without falling back to another preset', async (t) => {
  let fail = false;
  const errors = [];
  t.mock.method(console, 'error', (error) => errors.push(error));
  const f = await fixture(t, {
    presentation: {
      async decode() {
        if (fail) {
          fail = false;
          throw new Error('Preset picture failure');
        }
      },
    },
  });
  fail = true;
  await f.choose('coop-difficulty', 'expert');
  assert.equal(f.$('coop-picture-status').dataset.state, 'error');
  assert.equal(f.$('coop-difficulty').value, 'expert');
  assert.equal(f.$('coop-start').disabled, true);
  assert.equal(f.$('coop-menu').hidden, false);
  f.$('coop-picture-retry').click();
  await ready(f);
  f.$('coop-start').click();
  assert.equal(f.$('coop-reserves').textContent, '1 reserve');
  assert.equal(errors.length, 1);
});

test('denied Team difficulty saving applies the chosen preset locally and Retry persists it without starting play', async (t) => {
  const saved = memory();
  let allowed = false;
  const preferences = {
    getItem(key) {
      if (!allowed) throw new Error('Test preference denial');
      return saved.getItem(key);
    },
    setItem: saved.setItem.bind(saved),
  };
  const f = await fixture(t, { preferences });
  assert.equal(f.$('coop-journey-preferences').hidden, false);
  await f.choose('coop-difficulty', 'expert');
  await ready(f);
  assert.match(f.$('coop-journey-preferences-message').textContent, /session-only/);
  assert.equal(f.$('coop-difficulty').value, 'expert');
  allowed = true;
  f.$('coop-journey-preferences-retry').focus();
  f.tap('Enter');
  await waitFor(() => f.$('coop-journey-preferences').hidden);
  assert.equal(f.$('coop-menu').hidden, false);
  assert.equal(f.doc.activeElement.id, 'coop-start');
  assert.equal(JSON.parse(saved.getItem(JOURNEY_PREFERENCES_KEY)).difficulty, 'expert');
  f.$('coop-start').click();
  assert.equal(f.$('coop-reserves').textContent, '1 reserve');
});

test('browser-restored form values and another tab preference cannot replace this visit’s prepared Team edition', async (t) => {
  const f = await fixture(t);
  await f.choose('coop-difficulty', 'expert');
  await ready(f);
  const external = JSON.stringify({ format: JOURNEY_PREFERENCES_VERSION, difficulty: 'gentle' });
  f.preferences.values.set(JOURNEY_PREFERENCES_KEY, external);
  f.win.emit('storage', {
    key: JOURNEY_PREFERENCES_KEY,
    storageArea: f.preferences,
    newValue: external,
  });
  f.$('coop-difficulty').value = 'gentle';
  f.win.emit('pageshow', { persisted: true });
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(f.$('coop-difficulty').value, 'expert');
  assert.equal(f.preferences.writes.length, 1);
  f.$('coop-start').click();
  assert.equal(f.$('coop-reserves').textContent, '1 reserve');
});

test('returning to setup re-enables owned preset selection and retires the old ready lease before new setup callbacks', async (t) => {
  const f = await fixture(t);
  f.$('coop-start').click();
  f.$('coop-pause').click();
  f.$('coop-lobby').click();
  f.$('coop-discard-confirm').click();
  assert.equal(f.$('coop-menu').hidden, false);
  assert.equal(f.$('coop-difficulty').disabled, false);
  const select = f.$('coop-level'),
    original = select.replaceChildren;
  let attempted = false;
  t.mock.method(select, 'replaceChildren', function (...children) {
    original.apply(this, children);
    attempted = true;
    f.$('coop-start').click();
    assert.equal(f.$('coop-menu').hidden, false, 'No new rules with the previous picture lease.');
  });
  await f.choose('coop-difficulty', 'expert');
  await ready(f);
  assert(attempted);
  f.$('coop-start').click();
  assert.equal(f.$('coop-reserves').textContent, '1 reserve');
});
