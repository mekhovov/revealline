// Actual Solo host, controller router, summary collector and settings view.
// Browser APIs and DOM are modeled; no physical device or native layout claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soloPage, memoryStorage } from './helpers/solo-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const campaign = {
  version: 'xonix-campaign.v1',
  id: 'support-summary-host',
  revision: '1',
  title: 'Support summary boundary',
  classRecipes: JSON.parse(readFileSync(new URL('../content/classes.json', import.meta.url))),
  levels: [retryFixture('self-contact').level],
};
const read = (page) => JSON.parse(page.$('support-summary-json').textContent);
async function prepare(page) {
  page.$('support-summary-prepare').click();
  await waitFor(() => !page.$('support-summary-download').disabled);
  return read(page);
}

test('actual paused Settings summary reuses the controller sample without changing input, flight or saved data', async (t) => {
  const storage = memoryStorage(),
    device = {
      index: 0,
      id: 'private-controller-serial',
      mapping: 'standard',
      connected: true,
      timestamp: 1,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    };
  let connected = false;
  const page = await soloPage(t, {
    campaign,
    storage,
    automaticPreparationFrames: false,
    readPads: () => (connected ? [device] : []),
  });
  page.$('start-button').click();
  await page.waitUntilRunning();
  page.$('settings-button').click();
  page.$('settings-tab-data').click();
  connected = true;
  device.buttons[0] = { pressed: true, value: 1 };
  page.frame(0);
  const checkpoint = authoritativeCheckpoint(page.rendered.run),
    writes = [...storage.writes];
  page.$('support-summary-prepare').focus();
  page.$('support-summary-prepare').click();
  // The existing native activation guard may observe the controller during
  // any click. The support operation itself must add no subsequent polling.
  const beforeReads = page.padReads;
  await waitFor(() => !page.$('support-summary-download').disabled);
  const report = read(page);
  assert.equal(report.game.state, 'paused');
  assert.equal(report.controller.status, 'waiting-neutral');
  assert.equal(report.controller.freshness, 'recent');
  assert.equal(page.padReads, beforeReads, 'Preparing support must not poll or consume an input.');
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.deepEqual(storage.writes, writes);
  assert.equal(page.doc.activeElement, page.$('support-summary-prepare'));
  assert.doesNotMatch(JSON.stringify(report), /private-controller-serial/);
  device.buttons[0] = { pressed: false, value: 0 };
  page.frame(0);
  page.frame(0);
  const ready = await prepare(page);
  assert.equal(ready.controller.status, 'connected');
  assert.equal(ready.controller.neutral, true);
  connected = false;
  page.frame(0);
  assert.equal((await prepare(page)).controller.status, 'disconnected');
  page.$('settings-dialog').close();
  assert.equal(page.$('support-summary-download').disabled, true);
  assert.equal(page.$('support-summary-json').textContent, '');
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
});

test('actual Settings exposes unavailable storage honestly and refreshes EN/UK copy without transmitting a report', async (t) => {
  const locale = getLocale();
  t.after(() => setLocale(locale, { persist: false }));
  setLocale('en', { persist: false });
  const page = await soloPage(t, { campaign });
  page.$('settings-button').click();
  page.$('settings-tab-data').click();
  page.frame(0);
  const report = await prepare(page);
  assert.equal(report.storage.retention, 'unavailable');
  assert.equal(report.storage.estimate.status, 'unavailable');
  assert.equal(report.offline.files, 'not-verified-here');
  assert.equal(report.scope, 'primary-game-shell');
  assert.match(page.$('support-summary-status').textContent, /Review it before downloading/);
  setLocale('uk', { persist: false });
  assert.match(page.$('support-summary-title').textContent, /Локальний звіт/);
  assert.match(page.$('support-summary-status').textContent, /Перегляньте/);
  assert.doesNotMatch(
    page.$('support-summary-root').textContent,
    /interface:|supportSummary\.|\{\{/,
  );
});
