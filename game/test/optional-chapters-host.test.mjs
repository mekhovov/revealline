import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage } from './helpers/solo-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
// Full multi-row chapter validation authenticates existing large embedded originals.
const settle = (predicate, message) => waitFor(predicate, { timeoutMs: 30000, message });
import { authoritativeCheckpoint } from '../replay.mjs';
const root = new URL('../../', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('game/content/optional-worlds.json', root)));
const first = catalog.packs[0];
function images(t) {
  const old = globalThis.Image;
  globalThis.Image = class {
    set src(url) {
      if (url.startsWith('data:image/png;base64,')) {
        const bytes = Buffer.from(url.split(',')[1], 'base64');
        this.width = this.naturalWidth = bytes.readUInt32BE(16);
        this.height = this.naturalHeight = bytes.readUInt32BE(20);
      } else {
        this.width = this.naturalWidth = 384;
        this.height = this.naturalHeight = 288;
      }
      queueMicrotask(() => this.onload?.());
    }
    async decode() {}
  };
  t.after(() => {
    if (old === undefined) delete globalThis.Image;
    else globalThis.Image = old;
  });
}
function downloads(t, intercept = () => null) {
  const old = globalThis.fetch,
    requests = [];
  globalThis.fetch = async (url, options) => {
    if (!String(url).startsWith('http')) return old(url, options);
    requests.push(String(url));
    const response = intercept(String(url), options);
    if (response) return response;
    const target = String(url).includes('optional-worlds.json')
      ? 'game/content/optional-worlds.json'
      : catalog.packs.find((item) => String(url).endsWith(item.path))?.path;
    assert.ok(target, `Unexpected optional chapter request: ${url}`);
    return new Response(await readFile(new URL(target, root)));
  };
  t.after(() => {
    globalThis.fetch = old;
  });
  return requests;
}
async function open(page) {
  page.$('shell-menu').click();
  page.$('shell-worlds').click();
  await settle(
    () =>
      !!page.$(`optional-worlds-install-${first.id}`) &&
      !page.$(`optional-worlds-install-${first.id}`).disabled,
  );
}
test('native More worlds discovers Tactical separately and keeps the default run until explicit Choose', async (t) => {
  images(t);
  const page = await soloPage(t, { titleScreen: true });
  page.$('shell-featured').click();
  await settle(
    () => !page.$('shell-featured').disabled && page.doc.body.dataset.pictureState === 'ready',
  );
  page.frame(0);
  const requests = downloads(t),
    chapter = catalog.packs.find((item) => item.id === 'fpv-route-choices'),
    originalRun = page.rendered.run,
    before = authoritativeCheckpoint(originalRun);
  assert.equal(page.$('pack-select').value, 'fpv-arcade-r5');
  await open(page);
  assert.match(page.$('optional-worlds-summary').textContent, /Arcade.*Tactical/);
  const stored = new Map(page.storage.map);
  page.$(`optional-worlds-install-${chapter.id}`).click();
  await settle(
    () =>
      !!page.$(`optional-worlds-choose-${chapter.id}`) &&
      !page.$(`optional-worlds-choose-${chapter.id}`).disabled,
  );
  page.frame(0);
  assert.equal(page.rendered.run, originalRun);
  assert.deepEqual(authoritativeCheckpoint(originalRun), before);
  assert.equal(page.$('pack-select').value, 'fpv-arcade-r5');
  for (const [key, value] of stored)
    if (!key.includes('packs')) assert.equal(page.storage.map.get(key), value, key);
  assert.equal(requests.length, 2);
  assert.ok(requests[1].endsWith(chapter.path));
  page.$(`optional-worlds-choose-${chapter.id}`).click();
  await settle(
    () => !page.$('optional-worlds-dialog').open && page.doc.body.dataset.pictureState === 'ready',
  );
  page.frame(0);
  assert.equal(page.$('pack-select').value, chapter.id);
  assert.deepEqual(
    [...page.$('level-select').options].map((option) => option.value),
    ['route-choices-foundry', 'route-choices-depot', 'route-choices-switchback'],
  );
  assert.equal(page.rendered.run.level.id, 'route-choices-foundry');
  assert.equal(page.rendered.run.level.classic.arcadeActions, undefined);
  assert.equal(page.$('action-button').hidden, false);
  assert.equal(page.$('boost-button').hidden, false);
  assert.equal(page.rendered.run.tick, 0);
  assert.equal(page.rendered.paused, true);
  assert.match(page.$('mission-brief-copy').textContent, /Tactical challenge/);
  assert.equal(page.doc.activeElement, page.$('start-button'));
  assert.deepEqual(page.errors, []);
});
test('native More worlds installs separately, preserves an unrelated paused pack run and chooses only on explicit action', async (t) => {
  images(t);
  const page = await soloPage(t);
  const requests = downloads(t);
  page.change('pack-select', 'fpv-arcade-r5');
  await settle(() => !page.$('pack-select').disabled);
  page.$('start-button').click();
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  for (let i = 0; i < 13; i++) page.frame();
  const run = page.rendered.run,
    before = authoritativeCheckpoint(run);
  assert.equal(run.player.cutting, true);
  await open(page);
  page.frame(0);
  const saved = new Map(page.storage.map);
  page.$(`optional-worlds-install-${first.id}`).click();
  await settle(() => !page.$(`optional-worlds-choose-${first.id}`).disabled);
  page.frame(0);
  assert.equal(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), before);
  assert.equal(page.rendered.paused, true);
  assert.equal(page.$('pack-select').value, 'fpv-arcade-r5');
  for (const [key, value] of saved)
    if (!key.includes('packs')) assert.equal(page.storage.map.get(key), value, `Unchanged ${key}`);
  assert.match(page.$('optional-worlds-status').textContent, /paused flight is kept/);
  assert.equal(requests.length, 2);
  page.$('optional-worlds-back').click();
  page.$('shell-worlds').click();
  assert.equal(page.$(`optional-worlds-install-${first.id}`).disabled, true);
  await settle(() => !page.$(`optional-worlds-choose-${first.id}`).disabled);
  assert.equal(
    requests.length,
    2,
    'Reopening an already-read catalog and stored chapter makes no download',
  );
  page.$(`optional-worlds-choose-${first.id}`).click();
  await settle(() => !page.$('optional-worlds-dialog').open);
  page.frame(0);
  assert.notEqual(page.rendered.run, run);
  assert.equal(page.rendered.run.tick, 0);
  assert.equal(page.$('pack-select').value, first.id);
  assert.equal(page.rendered.paused, true);
  assert.equal(page.$('start-button'), page.doc.activeElement);
  assert.deepEqual(page.errors, []);
});

test('a failed asset transaction keeps the installed library and current run; explicit Install retries', async (t) => {
  images(t);
  const assets = managedIndexedDB();
  const page = await soloPage(t, { titleScreen: true, assetIndexedDB: assets.indexedDB });
  downloads(t);
  assets.failAnyPutAt = 1;
  const run = page.rendered.run,
    checkpoint = authoritativeCheckpoint(run);
  await open(page);
  const stored = new Map(page.storage.map);
  page.$(`optional-worlds-install-${first.id}`).click();
  await settle(() => !page.$(`optional-worlds-install-${first.id}`).disabled);
  assert.match(page.$('optional-worlds-status').textContent, /storage failed/);
  assert.equal(page.$(`optional-worlds-choose-${first.id}`).disabled, true);
  assert.deepEqual(page.storage.map, stored);
  assert.equal(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assets.failAnyPutAt = null;
  page.$(`optional-worlds-install-${first.id}`).click();
  await settle(() => !page.$(`optional-worlds-choose-${first.id}`).disabled);
  page.frame(0);
  assert.equal(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.deepEqual(page.errors, []);
});

test('keyboard and standard controller reach all world install actions and Back without flying', async (t) => {
  const page = await soloPage(t, { titleScreen: true });
  downloads(t);
  const checkpoint = authoritativeCheckpoint(page.rendered.run);
  const key = (name) => {
    const target = page.doc.activeElement;
    const event = target.emit('keydown', { key: name, code: name, repeat: false });
    if (!event.defaultPrevented && name === 'Enter' && target.tagName === 'BUTTON') target.click();
    target.emit('keyup', { key: name, code: name });
  };
  for (let i = 0; i < 30 && page.doc.activeElement.id !== 'shell-worlds'; i++) key('ArrowDown');
  assert.equal(page.doc.activeElement.id, 'shell-worlds');
  key('Enter');
  await settle(() => !!page.$(`optional-worlds-install-${first.id}`));
  const visited = new Set();
  for (let i = 0; i < 25; i++) {
    visited.add(page.doc.activeElement.id);
    key('ArrowDown');
  }
  for (const item of catalog.packs) assert.ok(visited.has(`optional-worlds-install-${item.id}`));
  let now = 1000;
  const oldNow = Object.getOwnPropertyDescriptor(performance, 'now');
  Object.defineProperty(performance, 'now', { configurable: true, value: () => now });
  t.after(() =>
    oldNow ? Object.defineProperty(performance, 'now', oldNow) : delete performance.now,
  );
  const pad = {
    index: 0,
    id: 'Modeled world-navigation pad',
    mapping: 'standard',
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  navigator.getGamepads = () => [pad];
  const frame = () => {
    now += 16;
    page.frame(16);
  };
  const press = (index) => {
    pad.buttons[index] = { pressed: true, value: 1 };
    frame();
    pad.buttons[index] = { pressed: false, value: 0 };
    frame();
  };
  frame();
  press(0);
  frame();
  visited.clear();
  for (let i = 0; i < 25; i++) {
    visited.add(page.doc.activeElement.id);
    press(13);
  }
  for (const item of catalog.packs) assert.ok(visited.has(`optional-worlds-install-${item.id}`));
  press(1);
  assert.equal(page.$('optional-worlds-dialog').open, false);
  assert.equal(page.$('shell-home').open, true);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.deepEqual(page.errors, []);
});
test('cancelled optional download cannot change the flight or install after Back and a late network response', async (t) => {
  images(t);
  const page = await soloPage(t, { titleScreen: true });
  let resolve,
    entered = false;
  downloads(t, (url) =>
    url.endsWith(first.path)
      ? new Promise((done) => {
          resolve = done;
          entered = true;
        })
      : null,
  );
  const run = page.rendered.run,
    before = authoritativeCheckpoint(run),
    saved = new Map(page.storage.map);
  await open(page);
  page.$(`optional-worlds-install-${first.id}`).click();
  await settle(() => entered);
  page.$('optional-worlds-back').click();
  assert.equal(page.$('shell-home').open, true);
  resolve(new Response(await readFile(new URL(first.path, root))));
  await new Promise((done) => setImmediate(done));
  page.frame(0);
  assert.equal(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), before);
  assert.deepEqual(page.storage.map, saved);
  assert.equal(page.$('optional-worlds-dialog').open, false);
  assert.deepEqual(page.errors, []);
});
test('failed published checksum leaves native retry and keyboard Back available without changing saved progress', async (t) => {
  const page = await soloPage(t, { titleScreen: true });
  downloads(t, (url) =>
    url.endsWith(first.path) ? Promise.resolve(new Response(new Uint8Array(first.bytes))) : null,
  );
  await open(page);
  const saved = new Map(page.storage.map);
  page.$(`optional-worlds-install-${first.id}`).click();
  await settle(() => !page.$(`optional-worlds-install-${first.id}`).disabled);
  assert.match(page.$('optional-worlds-status').textContent, /checksum/);
  assert.equal(page.$(`optional-worlds-choose-${first.id}`).disabled, true);
  assert.deepEqual(page.storage.map, saved);
  // The finite DOM does not implement native Escape→dialog cancel defaults.
  page.$('optional-worlds-dialog').dispatchEvent(new Event('cancel', { cancelable: true }));
  assert.equal(page.$('optional-worlds-dialog').open, false);
  assert.equal(page.$('shell-home').open, true);
  assert.deepEqual(page.errors, []);
});

test('a valid imported chapter with substituted artwork is a conflict, never an installed original', async (t) => {
  images(t);
  const page = await soloPage(t, { titleScreen: true });
  const requests = downloads(t);
  const candidate = JSON.parse(await readFile(new URL(first.path, root)));
  const campaign = JSON.stringify(candidate.campaigns);
  candidate.levelVisuals[0].visualOverrides.background.dataUrl =
    candidate.levelVisuals[1].visualOverrides.background.dataUrl;
  assert.equal(
    JSON.stringify(candidate.campaigns),
    campaign,
    'Gameplay and campaign identity are unchanged',
  );
  page.$('library-button').click();
  page.doc.querySelector('[data-library-panel="packs"]').click();
  page.$('pack-json').value = JSON.stringify(candidate);
  page.$('install-pack').click();
  await settle(() => !page.$('install-pack').disabled);
  assert.match(page.$('pack-status').textContent, /Validated and installed/);
  page.doc.querySelector('[data-close="library-dialog"]').click();
  page.frame(0);
  const run = page.rendered.run,
    checkpoint = authoritativeCheckpoint(run),
    saved = new Map(page.storage.map);
  page.$('shell-menu').click();
  page.$('shell-worlds').click();
  await settle(
    () =>
      page.$(`optional-worlds-install-${first.id}`)?.textContent === 'Different edition installed',
  );
  assert.equal(page.$(`optional-worlds-install-${first.id}`).disabled, true);
  assert.equal(page.$(`optional-worlds-choose-${first.id}`).disabled, true);
  assert.ok(
    page
      .$('optional-worlds-cards')
      .querySelectorAll('p')
      .some((item) => /different artwork\/content/.test(item.textContent)),
  );
  assert.equal(requests.length, 1, 'Only the catalog is fetched; no replacement download starts');
  assert.equal(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.deepEqual(page.storage.map, saved);
  page.$('optional-worlds-top-back').click();
  assert.equal(page.$('shell-home').open, true);
  assert.deepEqual(page.errors, []);
});

test('cancelling a refreshed catalog during installed-art inspection retains a coherent old menu', async (t) => {
  images(t);
  const page = await soloPage(t, { titleScreen: true });
  let revised = false;
  downloads(t, (url) =>
    revised && url.endsWith('optional-worlds.json')
      ? Promise.resolve(
          new Response(
            JSON.stringify({ ...catalog, packs: [{ ...first, normalizedSha256: '0'.repeat(64) }] }),
          ),
        )
      : null,
  );
  await open(page);
  page.$(`optional-worlds-install-${first.id}`).click();
  await settle(() => !page.$(`optional-worlds-choose-${first.id}`).disabled);
  const checkpoint = authoritativeCheckpoint(page.rendered.run),
    saved = new Map(page.storage.map);
  const digest = crypto.subtle.digest.bind(crypto.subtle);
  let release,
    entered = false,
    complete;
  const finished = new Promise((resolve) => {
    complete = resolve;
  });
  const held = new Promise((resolve) => {
    release = resolve;
  });
  t.mock.method(crypto.subtle, 'digest', async (...args) => {
    entered = true;
    await held;
    try {
      return await digest(...args);
    } finally {
      complete();
    }
  });
  t.after(() => release());
  revised = true;
  page.$('optional-worlds-reload').click();
  await settle(() => entered);
  assert.equal(page.$('optional-worlds-dialog').getAttribute('aria-busy'), 'true');
  assert.doesNotThrow(() => page.$('optional-worlds-top-back').click());
  assert.equal(page.$('shell-home').open, true);
  release();
  await finished;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(page.$('optional-worlds-dialog').open, false);
  page.$('shell-worlds').click();
  await settle(() => page.$('optional-worlds-dialog').getAttribute('aria-busy') === 'false');
  assert.deepEqual(
    [...page.$('optional-worlds-cards').querySelectorAll('section')].map((card) => {
      assert.equal(card.children[0].tagName, 'H3');
      return card.children[0].textContent;
    }),
    [...catalog.packs.map((item) => item.name), 'Pressure Pictures · source originals pilot'],
    'Cancelled list does not publish its reduced card set',
  );
  assert.equal(page.$(`optional-worlds-choose-${first.id}`).disabled, false);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.deepEqual(page.storage.map, saved);
  assert.deepEqual(page.errors, []);
});
