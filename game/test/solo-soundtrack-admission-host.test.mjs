import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { PNGImage } from './helpers/png-image.mjs';
import { SOUNDTRACK_CATALOGUE } from '../content/soundtrack-catalogue.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { FIXED_DT, stepRun } from '../core/index.mjs';
import { ONLINE_SOUNDTRACK_CATALOGUE_URL } from '../online-soundtrack-catalogue.mjs';
import { publicCatalogueResponse } from './helpers/soundtrack-public-catalogue.mjs';
// Keep the complete actual-player saved-style demand controls in this focused host entry.
import './soundtrack-saved-styles.test.mjs';

const microtasks = () => new Promise((resolve) => setImmediate(resolve));

for (const background of ['hidden', 'unfocused'])
  test(`terminal Solo keeps queued music preparation suspended while ${background}`, async (t) => {
    const hashes = new Set(SOUNDTRACK_CATALOGUE.tracks.map((track) => track.asset.sha256));
    const observed = new Set();
    let releaseLookup;
    const page = await soloPage(t, {
      search: '?journey=opening&performance=1',
      audio: {},
      pictures: { Image: PNGImage },
      journeyIndexedDB: managedIndexedDB().indexedDB,
      fetchResponse: async (path) =>
        String(path).includes('/content-design/assets/')
          ? new Response(await readFile(path))
          : undefined,
      browserSetup({ globals }) {
        globals.innerWidth = 1280;
        globals.innerHeight = 720;
        const cache = {
          async match(url) {
            const hash = String(url).split('/').at(-1);
            if (!hashes.has(hash)) return undefined;
            observed.add(hash);
            if (!releaseLookup)
              await new Promise((resolve) => {
                releaseLookup = resolve;
              });
            return undefined;
          },
          keys: async () => [],
        };
        globals.caches = {
          open: async () => cache,
          keys: async () => [],
          match: async () => undefined,
        };
      },
    });
    await settle(() => typeof releaseLookup === 'function');
    page.$('start-button').click();
    await settle(() => page.doc.body.dataset.flightState === 'running', undefined, {
      timeoutMs: 20000,
    });
    page.frame(0);
    const reference = structuredClone(page.rendered.run);
    const { rows } = JSON.parse(
      await readFile(new URL('./fixtures/candidate-solo-tuned-host-routes.json', import.meta.url)),
    );
    const route = rows.find(([id]) => id === 'first-return');
    assert.equal(page.rendered.run.levelId, route[0]);
    for (const [direction, ticks] of route[4]) {
      const key = `Arrow${direction[0].toUpperCase()}${direction.slice(1)}`;
      page.key(key);
      page.key(key, false);
      for (let offset = 0; offset < ticks; offset += 6) {
        const count = Math.min(6, ticks - offset);
        for (let tick = 0; tick < count; tick++) stepRun(reference, { direction }, FIXED_DT);
        page.frame(count * FIXED_DT * 1000);
      }
    }
    assert.equal(page.rendered.run.status, 'won', 'Public input earns the terminal state');
    const checkpoint = authoritativeCheckpoint(page.rendered.run);
    assert.deepEqual(checkpoint, authoritativeCheckpoint(reference));
    if (background === 'hidden') {
      page.doc.hidden = true;
      page.doc.emit('visibilitychange');
    } else {
      page.doc.focused = false;
      page.win.emit('blur');
    }
    releaseLookup();
    await settle(() => observed.size === hashes.size);
    for (let frame = 0; frame < 3; frame++) {
      page.frame(1000 / 60);
      await microtasks();
    }
    assert.equal(
      page.win.RevealLineSoloPerformance.export().resources.media.phase,
      'suspended',
      'Terminal frames cannot reopen media admission after a lifecycle interruption',
    );
    assert.equal(page.$('soundtrack-dialog'), null, 'Queued main work remains suspended');
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    page.doc.hidden = false;
    page.doc.focused = false;
    page.doc.emit('visibilitychange');
    await microtasks();
    assert.equal(
      page.win.RevealLineSoloPerformance.export().resources.media.phase,
      'suspended',
      'Visible does not imply focused: visibility restoration cannot admit pending work',
    );
    assert.equal(page.$('soundtrack-dialog'), null);
    page.doc.focused = true;
    page.win.emit('focus');
    await settle(() => !!page.$('soundtrack-dialog') && !page.$('soundtrack-open').disabled);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    assert.deepEqual(page.errors, []);
  });

for (const retire of [false, true])
  test(`late official-music lookup cannot create the soundtrack panel during Solo gameplay${retire ? ' or after teardown' : ''}`, async (t) => {
    const hashes = new Set(SOUNDTRACK_CATALOGUE.tracks.map((track) => track.asset.sha256));
    const observed = new Set();
    let releaseLookup;
    const page = await soloPage(t, {
      search: '?journey=opening',
      audio: {},
      pictures: { Image: PNGImage },
      journeyIndexedDB: managedIndexedDB().indexedDB,
      fetchResponse: async (path) =>
        String(path).includes('/content-design/assets/')
          ? new Response(await readFile(path))
          : undefined,
      browserSetup({ globals }) {
        const cache = {
          async match(url) {
            const hash = String(url).split('/').at(-1);
            if (!hashes.has(hash)) return undefined;
            observed.add(hash);
            if (!releaseLookup)
              await new Promise((resolve) => {
                releaseLookup = resolve;
              });
            return undefined;
          },
          keys: async () => [],
        };
        globals.caches = {
          open: async () => cache,
          keys: async () => [],
          match: async () => undefined,
        };
      },
    });
    await settle(
      () => typeof releaseLookup === 'function',
      'The official music lookup must be waiting',
    );
    assert.equal(page.$('soundtrack-dialog'), null);
    page.$('start-button').click();
    await settle(
      () => page.doc.body.dataset.flightState === 'running',
      'Start cannot wait for optional music UI',
      { timeoutMs: 20000 },
    );
    page.frame(0);
    const before = authoritativeCheckpoint(page.rendered.run);
    releaseLookup();
    await settle(() => observed.size === hashes.size, 'All official music metadata lookups finish');
    await microtasks();
    assert.equal(
      page.$('soundtrack-dialog'),
      null,
      'Late media lookup cannot build the panel while playing',
    );
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), before);
    if (retire) {
      page.win.emit('pagehide', { persisted: false });
      await microtasks();
      assert.equal(page.$('soundtrack-dialog'), null);
      assert.deepEqual(page.errors, []);
      return;
    }
    page.$('pause-button').click();
    await settle(
      () => !!page.$('soundtrack-dialog') && !page.$('soundtrack-open').disabled,
      'Pause admits the queued player and panel creation',
      { timeoutMs: 20000 },
    );
    assert.equal(page.doc.body.dataset.flightState, 'paused');
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), before);
    assert.deepEqual(page.errors, []);
  });

test('muted Solo boot and Direct Start defer public music until the actual Audio tab is selected', async (t) => {
  const requests = [];
  const page = await soloPage(t, {
    search: '?performance=1',
    titleScreen: true,
    audio: {},
    pictures: { Image: PNGImage },
    journeyIndexedDB: managedIndexedDB().indexedDB,
    fetchResponse: async (path) => {
      if (String(path) === ONLINE_SOUNDTRACK_CATALOGUE_URL) {
        requests.push(String(path));
        return publicCatalogueResponse();
      }
      return String(path).includes('/content-design/assets/')
        ? new Response(await readFile(path))
        : undefined;
    },
    browserSetup({ globals }) {
      globals.innerWidth = 1280;
      globals.innerHeight = 720;
    },
  });
  await settle(
    () =>
      !page.$('soundtrack-open').disabled &&
      page.$('soundtrack-settings-play-styles')?.disabled === false,
    'The actual panel hydrates local saved choices without opening',
  );
  await microtasks();
  assert.equal(page.win.RevealLineSoloPerformance.export().audio.muted, true);
  assert.equal(page.$('soundtrack-dialog').open, false);
  assert.deepEqual(requests, []);
  assert.equal(page.$('shell-home').open, true);
  assert.equal(page.$('shell-featured').disabled, false);
  page.$('shell-featured').click();
  await settle(() => page.doc.body.dataset.flightState === 'running', undefined, {
    timeoutMs: 20000,
  });
  page.frame(0);
  const checkpoint = authoritativeCheckpoint(page.rendered.run);
  await microtasks();
  assert.deepEqual(requests, [], 'A muted public Start does not demand an external feed');
  page.$('settings-button').click();
  assert.equal(page.doc.body.dataset.flightState, 'paused');
  assert.equal(page.win.RevealLineSoloPerformance.export().audio.muted, true);
  page.$('settings-tab-audio').click();
  page.$('settings-tab-display').click();
  await microtasks();
  assert.deepEqual(requests, [], 'Leaving Audio before its queued admission cancels the browse');
  page.$('settings-tab-controls').click();
  page.$('settings-tab-controls').emit('keydown', { key: 'ArrowDown' });
  await settle(() => requests.length === 1, 'Keyboard selection of Audio requests the catalogue');
  await settle(() => page.$('soundtrack-online-results').children.length > 0);
  assert.deepEqual(requests, [ONLINE_SOUNDTRACK_CATALOGUE_URL]);
  assert.equal(page.$('settings-tab-audio').getAttribute('aria-selected'), 'true');
  assert.equal(page.$('settings-panel-audio').hidden, false);
  assert.equal(page.$('soundtrack-dialog').open, false);
  assert.equal(page.$('soundtrack-settings-style-synth').parentNode.hidden, false);
  assert.equal(page.doc.body.dataset.flightState, 'paused');
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.equal(page.win.RevealLineSoloPerformance.export().audio.muted, true);
  assert.deepEqual(page.errors, []);
});
