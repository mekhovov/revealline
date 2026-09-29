import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getLocale, setLocale, t as translate } from '../i18n/index.mjs';

function keyboard(page, code) {
  const target = page.doc.activeElement;
  const down = target.emit('keydown', { code, key: code, repeat: false });
  // Native button activation belongs to the modeled browser boundary.
  if (code === 'Enter' && !down.defaultPrevented) target.click();
  target.emit('keyup', { code, key: code, repeat: false });
  return down;
}
function ticks(page, count) {
  for (let i = 0; i < count; i++) page.frame();
}
function assertSelection(page, selected) {
  assert.equal(page.doc.activeElement, page.$(`settings-tab-${selected}`));
  for (const name of [
    'gameplay',
    'controls',
    'audio',
    'display',
    'accessibility',
    'data',
    'content',
    'extras',
  ]) {
    const tab = page.$(`settings-tab-${name}`),
      panel = page.$(`settings-panel-${name}`),
      active = name === selected;
    assert.equal(tab.getAttribute('aria-selected'), String(active), `${name} selection`);
    assert.equal(tab.tabIndex, active ? 0 : -1, `${name} tab stop`);
    assert.equal(panel.hidden, !active, `${name} visibility`);
    assert.equal(panel.inert, !active, `${name} input ownership`);
  }
}

test('cold Ukrainian Solo: Settings Home/End preserve the paused cut across language changes', async (context) => {
  const originalLocale = getLocale();
  setLocale('uk', { persist: false });
  context.after(() => setLocale(originalLocale, { persist: false }));
  // Load the real Solo host only after choosing Ukrainian, so module-level
  // keyboard identities cannot accidentally be initialized by an English host.
  const [
    { soloPage, settle, memoryStorage },
    { retryFixture },
    { authoritativeCheckpoint },
    library,
  ] = await Promise.all([
    import('./helpers/solo-dom.mjs'),
    import('./fixtures/retry-scenarios.mjs'),
    import('../replay.mjs'),
    import('../library.mjs'),
  ]);
  assert.notEqual(translate('common:navigation.home'), 'Home');
  assert.notEqual(translate('interface:end'), 'End');
  const campaign = {
    version: 'xonix-campaign.v1',
    id: 'settings-native-key-host',
    revision: '1',
    title: 'Settings native keyboard navigation',
    classRecipes: JSON.parse(readFileSync(new URL('../content/classes.json', import.meta.url))),
    levels: [
      {
        ...retryFixture('self-contact').level,
        goal: { coverage: 1 },
        rules: { lives: 3, respawnSeconds: 0.1 },
      },
    ],
  };
  const storage = memoryStorage();
  library.saveLibrary(
    storage,
    'revealline.library.dev.v1',
    library.updatePreferences(library.emptyLibrary(), { turnPolicy: 'grid-center' }),
  );
  const requests = [];
  const page = await soloPage(context, {
    campaign,
    storage,
    fetchResponse: (path) => {
      requests.push(String(path));
    },
  });
  assert.equal(getLocale(), 'uk');
  page.$('start-button').click();
  try {
    await settle(() => page.doc.body.dataset.flightState === 'running');
  } catch (error) {
    error.message += `\n${JSON.stringify({
      flightState: page.doc.body.dataset.flightState,
      start: page.$('start-button').textContent,
      overlay: page.$('overlay-copy').textContent,
      message: page.$('run-message').textContent,
      requests,
      errors: page.errors.map((value) => String(value?.stack ?? value)),
    })}`;
    throw error;
  }
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  ticks(page, 8);
  page.key('ArrowRight');
  page.key('ArrowRight', false);
  ticks(page, 1);
  assert.equal(page.rendered.run.player.cutting, true);
  assert.equal(page.rendered.run.player.queuedDirection, 'right');
  page.$('pause-button').click();
  const checkpoint = authoritativeCheckpoint(page.rendered.run);
  page.$('settings-button').click();
  assert.equal(page.$('settings-dialog').open, true);
  const profile = storage.getItem('revealline.library.dev.v1'),
    suspended = storage.getItem('revealline.suspended.dev.v1');
  assert.ok(suspended, 'The unfinished flight has a real suspended save.');
  function assertPaused() {
    ticks(page, 3);
    assert.equal(page.doc.body.dataset.flightState, 'paused');
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    assert.equal(storage.getItem('revealline.library.dev.v1'), profile);
    assert.equal(storage.getItem('revealline.suspended.dev.v1'), suspended);
  }
  page.$('settings-tab-audio').focus();
  keyboard(page, 'Enter');
  assertSelection(page, 'audio');
  let selected = 'audio';
  for (const language of ['uk', 'en', 'uk']) {
    setLocale(language, { persist: false });
    assertSelection(page, selected);
    assertPaused();
    page.$('settings-tab-audio').focus();
    keyboard(page, 'Enter');
    assertSelection(page, 'audio');
    for (const [key, destination] of [
      ['Home', 'gameplay'],
      ['End', 'extras'],
    ]) {
      assert.equal(keyboard(page, key).defaultPrevented, true);
      assertSelection(page, destination);
      assertPaused();
      selected = destination;
    }
  }
  page.doc.querySelector('[data-close="settings-dialog"]').focus();
  keyboard(page, 'Enter');
  assert.equal(page.$('settings-dialog').open, false);
  assertPaused();
  page.$('start-button').focus();
  keyboard(page, 'Enter');
  await settle(() => page.doc.body.dataset.flightState === 'running');
  ticks(page, 8);
  assert.notDeepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.deepEqual(page.errors, []);
});
