// Actual Solo settings/locale handlers and run; finite DOM/storage boundaries.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soloPage, memoryStorage } from './helpers/solo-dom.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { REACTION_OPTIONS_KEY } from '../journey/reaction-options.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

test('actual paused Solo settings change caption duration and language without changing the accepted run or other saved owners', async (t) => {
  const previous = getLocale();
  setLocale('en', { persist: false });
  t.after(() => setLocale(previous, { persist: false }));
  const storage = memoryStorage(),
    campaign = {
      version: 'xonix-campaign.v1',
      id: 'caption-reading-time-host',
      revision: '1',
      title: 'Caption reading time',
      classRecipes: JSON.parse(readFileSync(new URL('../content/classes.json', import.meta.url))),
      levels: [retryFixture('self-contact').level],
    },
    h = await soloPage(t, { campaign, storage });
  h.$('start-button').click();
  await h.waitUntilRunning();
  h.key('ArrowDown');
  h.frame(100);
  h.key('ArrowDown', false);
  h.$('pause-button').click();
  h.frame(0);
  assert.equal(h.rendered.paused, true);
  h.$('settings-button').click();
  h.$('settings-tab-audio').click();
  const checkpoint = authoritativeCheckpoint(h.rendered.run),
    priorRecords = [...storage.map],
    writes = storage.writes.length,
    controls = h.$('settings-panel-audio'),
    control = controls.querySelector('[data-reaction-option="readingTime"]');
  assert.ok(control);
  control.focus();
  control.value = '2';
  control.emit('change');
  assert.equal(JSON.parse(storage.getItem(REACTION_OPTIONS_KEY)).readingTime, 2);
  assert.equal(h.doc.activeElement, control);
  for (const locale of ['uk', 'en']) {
    setLocale(locale, { persist: false });
    h.frame(0);
    assert.equal(control.value, '2');
    assert.equal(h.doc.activeElement, control);
    assert.equal(
      control.children[1].textContent,
      locale === 'uk' ? 'Подовжений (2×)' : 'Extended (2×)',
    );
    assert.match(
      controls.querySelector('[data-reaction-reading-help]').textContent,
      locale === 'uk' ? /Субтитри результату/ : /Result captions/,
    );
    assert.deepEqual(authoritativeCheckpoint(h.rendered.run), checkpoint);
    assert.equal(h.rendered.paused, true);
  }
  assert.deepEqual(
    [...storage.map].filter(([key]) => key !== REACTION_OPTIONS_KEY),
    priorRecords,
  );
  assert.deepEqual(
    storage.writes.slice(writes).map(([key]) => key),
    [REACTION_OPTIONS_KEY],
  );
  h.doc.querySelector('[data-close="settings-dialog"]').click();
  h.frame(0);
  assert.equal(h.$('settings-dialog').open, false);
  assert.equal(h.rendered.paused, true);
  assert.deepEqual(authoritativeCheckpoint(h.rendered.run), checkpoint);
  assert.deepEqual(h.errors, []);
});
