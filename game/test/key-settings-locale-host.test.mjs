import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soloPage, settle, memoryStorage } from './helpers/solo-dom.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { emptyLibrary, saveLibrary, loadLibrary, updatePreferences } from '../library.mjs';
import { setLocale, getLocale, t as translate } from '../i18n/index.mjs';
import { bindingLabels, KEY_ACTION_LABELS } from '../key-bindings.mjs';

const campaign = {
  version: 'xonix-campaign.v1',
  id: 'key-locale-host',
  revision: '1',
  title: 'Keyboard settings',
  classRecipes: JSON.parse(readFileSync(new URL('../content/classes.json', import.meta.url))),
  levels: [
    {
      ...retryFixture('self-contact').level,
      goal: { coverage: 1 },
      rules: { lives: 3, respawnSeconds: 0.1 },
    },
  ],
};
const ticks = (page, n) => {
  for (let i = 0; i < n; i++) page.frame();
};
const tap = (page, key) => {
  page.key(key);
  page.key(key, false);
};

test('mounted Settings keeps live key capture and the paused grid turn through language changes', async (context) => {
  const originalLocale = getLocale();
  setLocale('en', { persist: false });
  context.after(() => setLocale(originalLocale, { persist: false }));
  const storage = memoryStorage();
  saveLibrary(
    storage,
    'revealline.library.dev.v1',
    updatePreferences(emptyLibrary(), { turnPolicy: 'grid-center' }),
  );
  const page = await soloPage(context, { campaign, storage });
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  tap(page, 'ArrowDown');
  ticks(page, 8);
  tap(page, 'ArrowRight');
  ticks(page, 1);
  assert.equal(page.rendered.run.player.queuedDirection, 'right');
  page.$('pause-button').click();
  const checkpoint = authoritativeCheckpoint(page.rendered.run);
  page.$('settings-button').click();
  assert.equal(page.$('settings-dialog').open, true);
  page.$('keyboard-settings').querySelector('summary').click();
  const boost = page
    .$('key-binding-list')
    .children.map((row) => row.children[1])
    .find((button) => button.dataset.keyAction === 'boost');
  boost.focus();
  const profile = storage.getItem('revealline.library.dev.v1'),
    suspended = storage.getItem('revealline.suspended.dev.v1');
  for (const language of ['uk', 'en']) {
    setLocale(language, { persist: false });
    assert.ok(boost.textContent.includes(bindingLabels().boost));
    assert.ok(boost.getAttribute('aria-label').includes(bindingLabels().boost));
    assert.equal(page.doc.activeElement, boost);
    assert.equal(storage.getItem('revealline.library.dev.v1'), profile);
    assert.equal(storage.getItem('revealline.suspended.dev.v1'), suspended);
    ticks(page, 3);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  }
  boost.click();
  for (const language of ['uk', 'en']) {
    setLocale(language, { persist: false });
    assert.equal(boost.getAttribute('aria-pressed'), 'true');
    assert.equal(boost.textContent, translate('interface:pressAKey'));
    assert.equal(
      page.$('key-capture-status').textContent,
      translate('gameplay:chooseOnePhysicalKeyForEscapeOrTabCancelsExisting', {
        value1: KEY_ACTION_LABELS.boost,
      }),
    );
    assert.equal(page.doc.activeElement, boost);
    assert.equal(storage.getItem('revealline.library.dev.v1'), profile);
    assert.equal(storage.getItem('revealline.suspended.dev.v1'), suspended);
  }
  boost.emit('keydown', { code: 'KeyZ', key: 'z' });
  boost.emit('keyup', { code: 'KeyZ', key: 'z' });
  assert.deepEqual(
    loadLibrary(storage, 'revealline.library.dev.v1').library.preferences.keyboardBindings.bindings
      .boost,
    ['KeyZ'],
  );
  assert.equal(boost.getAttribute('aria-pressed'), 'false');
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  page.doc.querySelector('[data-close="settings-dialog"]').click();
  assert.equal(page.$('settings-dialog').open, false);
  ticks(page, 8);
  assert.equal(page.doc.body.dataset.flightState, 'paused');
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  ticks(page, 8);
  assert.notDeepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.deepEqual(page.errors, []);
});
