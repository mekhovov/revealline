import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setImmediate as tick } from 'node:timers/promises';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { activateHostAction } from './helpers/host-action.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { campaignKey } from '../library.mjs';
import { acceptedClassicMission } from '../mission-library/accepted-played-mission.mjs';
import { playedLevelHref } from '../mission-library/played-level-link.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../content-design/default-entry.mjs';
import { PNGImage } from './helpers/png-image.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

const indexText = await readFile(
  new URL('../content/mission-library-index.json', import.meta.url),
  'utf8',
);
const index = JSON.parse(indexText);
const baseEntry = {
  campaign: {
    ...JSON.parse(await readFile(new URL('../content/campaign.json', import.meta.url))),
    classRecipes: JSON.parse(await readFile(new URL('../content/classes.json', import.meta.url))),
  },
};

async function heldIndexPage(t) {
  const requests = [];
  let parses = 0;
  const parse = JSON.parse;
  t.mock.method(JSON, 'parse', function (text, ...args) {
    if (text === indexText) parses++;
    return parse.call(this, text, ...args);
  });
  const page = await soloPage(t, {
    fetchResponse(path, options) {
      if (!String(path).endsWith('content/mission-library-index.json')) return;
      let release;
      const body = new Promise((resolve) => {
        release = resolve;
      });
      requests.push({ signal: options?.signal, release });
      t.after(() => release(indexText));
      return { ok: true, text: () => body, json: async () => JSON.parse(await body) };
    },
  });
  return { page, requests, parses: () => parses };
}

test('Classic Start and Resume never wait for optional sharing, and paused discovery keeps the exact public URL', async (t) => {
  const { page, requests, parses } = await heldIndexPage(t);
  await activateHostAction(page.$('start-button'));
  assert.equal(page.doc.body.dataset.flightState, 'running');
  assert.equal(page.$('copy-level-link').hidden, true);
  assert.equal(parses(), 0);
  const before = requests.length;
  page.$('pause-button').click();
  await settle(() => requests.length > before, 'Pause may begin optional link discovery');
  const pending = requests.at(-1);
  await activateHostAction(page.$('start-button'));
  assert.equal(pending.signal.aborted, true, 'Resume retires the optional request.');
  pending.release(indexText);
  await tick();
  assert.equal(parses(), 0, 'A late body is not parsed during active gameplay.');
  assert.equal(page.$('copy-level-link').hidden, true);
  const checkpoint = authoritativeCheckpoint(page.rendered.run);
  const retry = requests.length;
  page.$('pause-button').click();
  await settle(() => requests.length > retry, 'A fresh Pause retries cancelled discovery');
  requests.at(-1).release(indexText);
  await settle(
    () => !page.$('copy-level-link').hidden,
    'Paused discovery publishes the accepted identity',
  );
  const entry = { ...baseEntry, baseCampaignKey: campaignKey(baseEntry.campaign) };
  const accepted = await acceptedClassicMission({
    index,
    entry,
    level: entry.campaign.levels.find((level) => level.id === page.rendered.run.levelId),
    baseEntry,
    packs: { packs: [] },
  });
  assert.ok(accepted);
  assert.equal(
    page.$('played-level-link').value,
    playedLevelHref(accepted, { baseURL: 'http://localhost/game/?journey=legacy' }),
  );
  assert.equal(parses(), 1);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.deepEqual(page.errors, []);
});

test('retiring the page while optional sharing reads its body prevents stale parsing and publication', async (t) => {
  const { page, requests, parses } = await heldIndexPage(t);
  await activateHostAction(page.$('start-button'));
  const before = requests.length;
  page.$('pause-button').click();
  await settle(() => requests.length > before, 'Pause begins optional discovery');
  const pending = requests.at(-1),
    checkpoint = authoritativeCheckpoint(page.rendered.run);
  page.win.emit('pagehide', { persisted: false });
  assert.equal(pending.signal.aborted, true);
  pending.release(indexText);
  await tick();
  assert.equal(parses(), 0);
  assert.equal(page.$('copy-level-link').hidden, true);
  assert.equal(page.$('played-level-link').value, '');
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.deepEqual(page.errors, []);
});

test('opening paused settings before the first Start can publish the Classic link without advancing the run', async (t) => {
  const { page, requests, parses } = await heldIndexPage(t);
  const before = authoritativeCheckpoint(page.rendered.run);
  page.$('shell-settings').click();
  await settle(() => requests.length > 0, 'A deliberate paused menu may discover the link');
  requests.at(-1).release(indexText);
  await settle(
    () => !page.$('copy-level-link').hidden,
    'The unstarted accepted mission can be shared',
  );
  assert.equal(parses(), 1);
  assert.notEqual(page.doc.body.dataset.flightState, 'running');
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), before);
  assert.deepEqual(page.errors, []);
});

test('the accepted current Journey exposes its exact link immediately at Start without the Classic index', async (t) => {
  const requests = [];
  const page = await soloPage(t, {
    search: `?journey=${DEFAULT_JOURNEY_ROUTES.solo}`,
    journeyIndexedDB: managedIndexedDB().indexedDB,
    pictures: { Image: PNGImage },
    fetchResponse: async (path) =>
      String(path).includes('/content-design/assets/')
        ? new Response(await readFile(path))
        : undefined,
    fetchJSON: (path) => {
      requests.push(String(path));
    },
  });
  await activateHostAction(page.$('start-button'));
  assert.equal(page.doc.body.dataset.flightState, 'running');
  assert.equal(page.$('copy-level-link').hidden, false);
  const href = new URL(page.$('played-level-link').value);
  assert.equal(href.searchParams.get('journey'), DEFAULT_JOURNEY_ROUTES.solo);
  assert.ok(href.searchParams.get('library-mission'));
  assert.equal(
    requests.some((path) => path.includes('mission-library-index')),
    false,
  );
  assert.deepEqual(page.errors, []);
});
