// Each independent large-campaign journey runs in its own Node test process.
// The browser model imports a real top-level-await app module; Node retains
// evaluated modules and test hooks until process exit, unlike a closed page.
const scenarios = [];
const test = (name, run) => scenarios.push(Object.freeze({ name, run }));
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PNGImage } from './helpers/png-image.mjs';
import { soloPage } from './helpers/solo-dom.mjs';
import { openMissionLibrary } from './helpers/library-selection.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
// Full multi-row chapter validation authenticates existing large embedded originals.
const settle = (predicate, message) => waitFor(predicate, { timeoutMs: 30000, message });
import { authoritativeCheckpoint } from '../replay.mjs';
const root = new URL('../../', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('game/content/optional-worlds.json', root)));
const first = catalog.packs[0];
const fetchOutsidePages = globalThis.fetch;
function images(t) {
  const old = globalThis.Image;
  globalThis.Image = PNGImage;
  t.after(() => {
    if (old === undefined) delete globalThis.Image;
    else globalThis.Image = old;
  });
}
function downloads(t, intercept = () => null) {
  const old = globalThis.fetch,
    requests = [];
  const downloadFetch = async (url, options) => {
    if (
      !String(url).startsWith('http') ||
      String(url).startsWith('http://localhost/game/presentation/')
    )
      return old(url, options);
    requests.push(String(url));
    const response = intercept(String(url), options);
    if (response) return response;
    const target = String(url).includes('optional-worlds.json')
      ? 'game/content/optional-worlds.json'
      : catalog.packs.find((item) => String(url).endsWith(item.path))?.path;
    assert.ok(target, `Unexpected optional chapter request: ${url}`);
    return new Response(await readFile(new URL(target, root)));
  };
  globalThis.fetch = downloadFetch;
  t.after(() => {
    // soloPage owns the outer browser globals and may already have restored
    // them. Never reinstall a closed page's fetch from this later hook.
    if (globalThis.fetch === downloadFetch) globalThis.fetch = old;
  });
  return requests;
}
function retainedMissions(page) {
  if (page.$('journey-chooser')?.open) page.$('journey-back').click();
  page.$('shell-menu').click();
  // These scenarios qualify the retained More worlds installer and its host
  // transactions. Mount that native parent without opening a concurrent public
  // catalogue; current Download & play journeys have their own library suite.
  page.$('shell-home').close();
  page.$('shell-missions').showModal();
  assert.equal(page.$('shell-mode-choice').open, false);
}
async function open(page) {
  retainedMissions(page);
  page.$('shell-worlds').click();
  await settle(
    () =>
      !!page.$(`optional-worlds-install-${first.id}`) &&
      !page.$(`optional-worlds-install-${first.id}`).disabled,
  );
}
test('More worlds discovers Tactical and one Download & play retains the old run until preparation finishes', async (t) => {
  images(t);
  const page = await soloPage(t, { titleScreen: true });
  await openMissionLibrary(page, 'shell-play');
  assert.equal(page.$('journey-chooser').contains(page.$('mission-picker-setup')), true);
  page.$('mission-picker-setup').open = true;
  page.$('mission-picker-setup').emit('toggle');
  assert.equal(page.$('mission-picker-setup').open, true);
  page.change('pack-select', 'fpv-arcade-r5');
  await settle(
    () =>
      !page.$('pack-select').disabled &&
      page.$('pack-select').value === 'fpv-arcade-r5' &&
      page.doc.body.dataset.pictureState === 'ready',
  );
  page.frame(0);
  const chapter = catalog.packs.find((item) => item.id === 'fpv-route-choices');
  let release,
    entered = false;
  const requests = downloads(t, (url) =>
      url.endsWith(chapter.path)
        ? new Promise((resolve) => {
            release = resolve;
            entered = true;
          })
        : null,
    ),
    originalRun = page.rendered.run,
    before = authoritativeCheckpoint(originalRun);
  assert.equal(page.$('pack-select').value, 'fpv-arcade-r5');
  await open(page);
  assert.match(page.$('optional-worlds-summary').textContent, /Arcade.*Tactical/);
  const stored = new Map(page.storage.map);
  page.change('optional-worlds-mode', 'Tactical');
  assert.equal(page.$(`optional-worlds-install-${chapter.id}`).closest('[hidden]'), null);
  page.$(`optional-worlds-install-${chapter.id}`).click();
  await settle(() => entered);
  assert.equal(page.$(`optional-worlds-install-${chapter.id}`).disabled, true);
  page.frame(0);
  assert.equal(page.rendered.run, originalRun);
  assert.deepEqual(authoritativeCheckpoint(originalRun), before);
  assert.equal(page.$('pack-select').value, 'fpv-arcade-r5');
  for (const [key, value] of stored)
    if (!key.includes('packs')) assert.equal(page.storage.map.get(key), value, key);
  assert.equal(requests.length, 2);
  assert.ok(requests[1].endsWith(chapter.path));
  release(new Response(await readFile(new URL(chapter.path, root))));
  await settle(
    () => !page.$('optional-worlds-dialog').open && page.doc.body.dataset.flightState === 'running',
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
  assert.equal(page.rendered.paused, false);
  assert.equal(page.$('game-overlay').hidden, true);
  assert.deepEqual(authoritativeCheckpoint(originalRun), before);
  assert.match(page.$('mission-brief-copy').textContent, /Tactical challenge/);
  assert.equal(page.doc.activeElement, page.$('game-canvas'));
  assert.deepEqual(page.errors, []);
});
test('offline Play of the current chapter preserves its paused cut without replacement', async (t) => {
  images(t);
  const page = await soloPage(t);
  page.$('pack-select').focus();
  page.$('pack-select').value = 'fpv-arcade-r5';
  await page.$('pack-select').onchange();
  await settle(
    () => !page.$('pack-select').disabled && page.doc.body.dataset.pictureState === 'ready',
  );
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  for (let i = 0; i < 13; i++) page.frame();
  const run = page.rendered.run,
    checkpoint = authoritativeCheckpoint(run);
  assert.equal(run.player.cutting, true);
  const requests = downloads(t, () => Promise.reject(new Error('Offline fixture')));
  retainedMissions(page);
  page.$('shell-worlds').click();
  await settle(() => !page.$('optional-worlds-reload').disabled);
  assert.match(page.$('optional-worlds-status').textContent, /Online list unavailable/);
  const stored = new Map(page.storage.map);
  page.change('optional-worlds-theme', 'fpv');
  page.change('optional-worlds-mode', 'Arcade');
  const choose = page.$('optional-worlds-installed-choose-fpv-arcade-r5');
  assert.ok(choose);
  assert.equal(choose.disabled, false);
  assert.equal(choose.closest('[hidden]'), null);
  page.frame(0);
  assert.equal(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.equal(page.rendered.paused, true);
  assert.deepEqual(page.storage.map, stored);
  assert.equal(requests.length, 1);
  choose.focus();
  await choose.onclick();
  page.frame(0);
  assert.equal(page.$('pack-select').value, 'fpv-arcade-r5');
  assert.equal(page.rendered.run, run, 'Current chapter selection keeps the exact flight.');
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.equal(page.$('optional-worlds-dialog').open, true);
  assert.equal(page.$('mission-replace-dialog').open, false);
  assert.match(page.$('optional-worlds-status').textContent, /already active.*kept paused/);
  assert.equal(page.doc.activeElement, choose);
  assert.deepEqual(page.storage.map, stored, 'No checkpoint, timestamp or progress rewrite.');
  assert.equal(requests.length, 1, 'Offline current chapter makes no new request.');
  assert.equal(page.rendered.paused, true);
  assert.deepEqual(page.errors, []);
});
for (const saveFailure of ['none', 'quota', 'readback'])
  test(`More worlds ${saveFailure} save keeps a paused flight until explicit Replace & play`, async (t) => {
    images(t);
    const page = await soloPage(t);
    const requests = downloads(t);
    page.change('pack-select', 'fpv-arcade-r5');
    await settle(
      () => !page.$('pack-select').disabled && page.doc.body.dataset.pictureState === 'ready',
      'Selected pack and exact picture must be ready before the preserved cut starts.',
    );
    page.$('start-button').click();
    await settle(() => page.doc.body.dataset.flightState === 'running');
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
    await settle(
      () => page.$('mission-replace-dialog').open && !page.$('mission-replace-confirm').disabled,
    );
    page.frame(0);
    assert.equal(page.rendered.run, run);
    assert.deepEqual(authoritativeCheckpoint(run), before);
    assert.equal(page.rendered.paused, true);
    assert.equal(page.$('pack-select').value, 'fpv-arcade-r5');
    for (const [key, value] of saved)
      if (!key.includes('packs') && key !== 'revealline.suspended.dev.v1')
        assert.equal(page.storage.map.get(key), value, `Unchanged ${key}`);
    assert.deepEqual(
      JSON.parse(page.storage.getItem('revealline.suspended.dev.v1')).replay.checkpoint,
      before,
    );
    assert.match(page.$('mission-replace-status').textContent, /saved and verified/);
    assert.equal(requests.length, 2);
    page.$('mission-replace-stay').click();
    page.$('optional-worlds-back').click();
    retainedMissions(page);
    page.$('shell-mode-choice').open = true;
    page.$('shell-worlds').click();
    assert.equal(page.$(`optional-worlds-install-${first.id}`).disabled, true);
    await settle(() => !page.$(`optional-worlds-install-${first.id}`).disabled);
    assert.equal(page.$(`optional-worlds-install-${first.id}`).textContent, 'Play');
    assert.equal(
      requests.length,
      2,
      'Reopening an already-read catalog and stored chapter makes no download',
    );
    const choose = page.$(`optional-worlds-install-${first.id}`),
      slot = 'revealline.suspended.dev.v1',
      get = page.storage.getItem.bind(page.storage),
      set = page.storage.setItem.bind(page.storage),
      savedFlight = get(slot);
    let written = false;
    page.storage.setItem = (key, value) => {
      if (key === slot && saveFailure === 'quota') throw new Error('Fixture quota exceeded');
      set(key, value);
      if (key === slot) written = true;
    };
    page.storage.getItem = (key) =>
      key === slot && written && saveFailure === 'readback' ? '{}' : get(key);
    choose.focus();
    await choose.onclick();
    assert.equal(page.$('mission-replace-dialog').open, true);
    assert.equal(page.$('optional-worlds-dialog').open, true);
    assert.match(
      page.$('mission-replace-status').textContent,
      saveFailure === 'none' ? /saved and verified/ : /not verified.*may lose/,
    );
    if (saveFailure === 'quota') assert.equal(get(slot), savedFlight);
    if (saveFailure === 'readback') assert.equal(written, true);
    page.$('mission-replace-stay').click();
    page.frame(0);
    assert.equal(page.rendered.run, run);
    assert.deepEqual(authoritativeCheckpoint(run), before);
    assert.equal(page.doc.activeElement, choose);
    await choose.onclick();
    assert.equal(page.$('mission-replace-dialog').open, true);
    page.$('mission-replace-confirm').click();
    await settle(
      () =>
        !page.$('optional-worlds-dialog').open && page.doc.body.dataset.flightState === 'running',
    );
    page.frame(0);
    assert.notEqual(page.rendered.run, run);
    assert.deepEqual(authoritativeCheckpoint(run), before);
    assert.equal(page.rendered.run.tick, 0);
    assert.equal(page.$('pack-select').value, first.id);
    assert.equal(page.rendered.paused, false);
    assert.equal(page.$('game-overlay').hidden, true);
    assert.equal(page.$('game-canvas'), page.doc.activeElement);
    assert.deepEqual(page.errors, []);
  });

test('a failed asset transaction keeps the installed library and current run; Download & play retries', async (t) => {
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
  assert.match(
    page.$(`optional-worlds-install-${first.id}`).textContent,
    /^Download & play · \d+(?:\.\d+)? MiB$/,
  );
  assert.deepEqual(page.storage.map, stored);
  assert.equal(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assets.failAnyPutAt = null;
  page.$(`optional-worlds-install-${first.id}`).click();
  await settle(
    () => !page.$('optional-worlds-dialog').open && page.doc.body.dataset.flightState === 'running',
  );
  page.frame(0);
  assert.notEqual(page.rendered.run, run);
  assert.equal(page.rendered.run.tick, 0);
  assert.equal(page.rendered.paused, false);
  assert.equal(page.$('pack-select').value, first.id);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.deepEqual(page.errors, []);
});

test('retained More chapters supports keyboard and standard controller with Mode collapsed and returns without flying', async (t) => {
  const page = await soloPage(t, { titleScreen: true });
  downloads(t);
  const checkpoint = authoritativeCheckpoint(page.rendered.run);
  const key = (name) => {
    const target = page.doc.activeElement;
    const event = target.emit('keydown', { key: name, code: name, repeat: false });
    if (!event.defaultPrevented && name === 'Enter' && target.tagName === 'BUTTON') target.click();
    if (!event.defaultPrevented && name === 'Enter' && target.tagName === 'SUMMARY')
      target.parentElement.open = !target.parentElement.open;
    if (!event.defaultPrevented && name === 'Tab') {
      // Model only the browser's native Tab default inside the focused dialog.
      const descendants = (node) =>
        node.children.flatMap((child) => [child, ...descendants(child)]);
      const controls = descendants(target.closest('dialog[open]')).filter((node) => {
        if (
          node.tabIndex < 0 ||
          node.disabled ||
          node.closest('[hidden],[inert],[aria-hidden="true"]')
        )
          return false;
        for (let parent = node.parentElement; parent; parent = parent.parentElement)
          if (
            parent.tagName === 'DETAILS' &&
            !parent.open &&
            parent.querySelector('summary') !== node
          )
            return false;
        return true;
      });
      controls[(controls.indexOf(target) + 1) % controls.length].focus();
    }
    target.emit('keyup', { key: name, code: name });
  };
  // Mount the retained parent as a component boundary. Public Missions now
  // opens the unified catalogue, covered by the library/navigation host suites.
  retainedMissions(page);
  page.$('shell-missions-back').focus();
  assert.equal(page.$('shell-home').open, false);
  assert.equal(page.$('shell-missions').open, true);
  const modeChoice = page.$('shell-mode-choice');
  assert.equal(modeChoice.open, false);
  assert.equal(page.$('shell-worlds').closest('#shell-mode-choice'), null);
  assert.equal(
    page.$('shell-worlds').closest('.shell-dialog-heading'),
    page.$('shell-missions').querySelector('.shell-dialog-heading'),
  );
  for (let i = 0; i < 30 && page.doc.activeElement.id !== 'shell-worlds'; i++) key('Tab');
  assert.equal(page.doc.activeElement.id, 'shell-worlds');
  assert.equal(modeChoice.open, false, 'More chapters is reachable without opening Game mode.');
  key('Enter');
  await settle(
    () =>
      !!page.$(`optional-worlds-install-${first.id}`) && !page.$('optional-worlds-reload').disabled,
  );
  const visited = new Set();
  const seek = (id, step) => {
    for (let i = 0; i < 80 && page.doc.activeElement.id !== id; i++) step();
    assert.equal(page.doc.activeElement.id, id);
  };
  const traversePages = (step, confirm) => {
    for (let count = 0; count < 40; count++) {
      for (let i = 0; i < 80; i++) {
        visited.add(page.doc.activeElement.id);
        step();
      }
      if (page.$('optional-worlds-next').disabled) return;
      seek('optional-worlds-next', step);
      confirm();
    }
    assert.fail('Every bounded page must terminate at Next disabled.');
  };
  traversePages(
    () => key('Tab'),
    () => key('Enter'),
  );
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
  press(13);
  while (!page.$('optional-worlds-previous').disabled) {
    seek('optional-worlds-previous', () => press(13));
    press(0);
  }
  visited.clear();
  traversePages(
    () => press(13),
    () => press(0),
  );
  for (const item of catalog.packs) assert.ok(visited.has(`optional-worlds-install-${item.id}`));
  press(1);
  assert.equal(page.$('optional-worlds-dialog').open, false);
  assert.equal(page.$('shell-home').open, true);
  retainedMissions(page);
  page.$('shell-missions-back').focus();
  assert.equal(page.$('shell-home').open, false);
  assert.equal(page.$('shell-missions').open, true);
  assert.equal(modeChoice.open, false);
  seek('shell-worlds', () => press(13));
  assert.equal(modeChoice.open, false, 'Controller entry does not open Game mode.');
  press(0);
  await settle(
    () => page.$('optional-worlds-dialog').open && !page.$('optional-worlds-reload').disabled,
  );
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
  assert.match(
    page.$(`optional-worlds-install-${first.id}`).textContent,
    /^Download & play · \d+(?:\.\d+)? MiB$/,
  );
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
  assert.equal(
    page.$(`optional-worlds-choose-${first.id}`),
    null,
    'No alternate Choose can bypass the conflicting edition.',
  );
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
  const page = await soloPage(t);
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  for (let i = 0; i < 13; i++) page.frame();
  assert.equal(page.rendered.run.player.cutting, true);
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
  await settle(
    () => page.$('mission-replace-dialog').open && !page.$('mission-replace-confirm').disabled,
  );
  page.$('mission-replace-stay').click();
  const checkpoint = authoritativeCheckpoint(page.rendered.run),
    saved = new Map(page.storage.map),
    headingsBeforeRefresh = [...page.$('optional-worlds-cards').querySelectorAll('section')].map(
      (card) => card.children[0].textContent,
    );
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
    headingsBeforeRefresh,
    'Cancelled list does not publish its reduced card set',
  );
  assert.equal(page.$(`optional-worlds-install-${first.id}`).disabled, false);
  assert.equal(page.$(`optional-worlds-install-${first.id}`).textContent, 'Play');
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.deepEqual(page.storage.map, saved);
  assert.deepEqual(page.errors, []);
});

for (const afterStay of ['unchanged', 'moved focus', 'foreground loss', 'newer operation'])
  test(`More worlds early Stay restores its exact Play; late verification respects ${afterStay}`, async (t) => {
    images(t);
    const page = await soloPage(t);
    downloads(t);
    page.change('pack-select', 'fpv-arcade-r5');
    await settle(
      () => !page.$('pack-select').disabled && page.doc.body.dataset.pictureState === 'ready',
      'The exact initial chapter picture must be ready before the preserved cut starts.',
    );
    page.$('start-button').click();
    await settle(() => page.doc.body.dataset.flightState === 'running');
    page.key('ArrowDown');
    page.key('ArrowDown', false);
    for (let i = 0; i < 13; i++) page.frame();
    const run = page.rendered.run,
      checkpoint = authoritativeCheckpoint(run);
    assert.equal(run.player.cutting, true);
    await open(page);
    page.$(`optional-worlds-install-${first.id}`).click();
    await settle(
      () => page.$('mission-replace-dialog').open && !page.$('mission-replace-confirm').disabled,
    );
    page.$('mission-replace-stay').click();
    page.frame(0);
    assert.equal(page.rendered.run, run);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    const before = new Map(page.storage.map),
      choose = page.$(`optional-worlds-install-${first.id}`),
      request = navigator.locks.request.bind(navigator.locks);
    let grant,
      delayed = false;
    t.after(() => grant?.()); // Retire a withheld callback even after a baseline assertion fails.
    navigator.locks.request = async (name, options, work) => {
      if (!delayed && name.endsWith('.backup-lock')) {
        delayed = true;
        // Model an already queued lock callback whose promise does not settle
        // immediately on AbortSignal. The real retained-flight guards still run.
        await new Promise((resolve) => {
          grant = resolve;
        });
      }
      return request(name, options, work);
    };
    choose.focus();
    const pending = choose.onclick();
    await settle(() => !!grant, 'The replacement must reach its real checked-save lock.');
    assert.equal(page.$('mission-replace-dialog').open, true);
    assert.equal(page.$('mission-replace-confirm').disabled, true);
    assert.equal(choose.disabled, true, 'The outer preparation still owns the disabled Play.');
    assert.equal(page.doc.activeElement, page.$('mission-replace-stay'));
    page.$('mission-replace-stay').click();
    assert.equal(page.$('mission-replace-dialog').open, false);
    assert.equal(page.$('optional-worlds-dialog').open, true);
    assert.equal(
      choose.disabled,
      false,
      'Stay releases the outer operation before its late callback.',
    );
    assert.equal(page.doc.activeElement, choose, 'Stay restores the exact available Play.');
    page.frame(0);
    assert.equal(page.rendered.run, run);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    assert.equal(page.rendered.paused, true);
    assert.deepEqual(page.storage.map, before);
    let focusCalls = 0;
    const focus = choose.focus.bind(choose);
    choose.focus = (...args) => {
      focusCalls++;
      return focus(...args);
    };
    if (afterStay === 'newer operation') {
      const firstGrant = grant;
      t.after(firstGrant);
      delayed = false;
      grant = null;
      const newer = choose.onclick();
      await settle(() => !!grant, 'The second choice must own a new checked-save lock.');
      const secondGrant = grant,
        stay = page.$('mission-replace-stay');
      assert.equal(page.$('mission-replace-dialog').open, true);
      assert.equal(page.$('mission-replace-confirm').disabled, true);
      assert.equal(choose.disabled, true);
      assert.equal(page.$('optional-worlds-dialog').getAttribute('aria-busy'), 'true');
      assert.equal(page.doc.activeElement, stay);
      const checkingCopy = page.$('mission-replace-status').textContent;
      firstGrant();
      await pending;
      page.frame(0);
      assert.equal(
        page.$('mission-replace-dialog').open,
        true,
        'Old settlement keeps the newer decision.',
      );
      assert.equal(page.$('mission-replace-confirm').disabled, true);
      assert.equal(choose.disabled, true, 'Old finally cannot release the newer busy controls.');
      assert.equal(page.$('optional-worlds-dialog').getAttribute('aria-busy'), 'true');
      assert.equal(page.$('mission-replace-status').textContent, checkingCopy);
      assert.equal(page.doc.activeElement, stay);
      assert.equal(focusCalls, 0);
      assert.equal(page.rendered.run, run);
      assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
      assert.deepEqual(page.storage.map, before);
      stay.click();
      assert.equal(page.$('mission-replace-dialog').open, false);
      assert.equal(page.$('optional-worlds-dialog').open, true);
      assert.equal(choose.disabled, false);
      assert.equal(page.doc.activeElement, choose);
      assert.equal(focusCalls, 1, 'Only the second explicit Stay restores Play.');
      secondGrant();
      await newer;
      for (let i = 0; i < 8; i++) page.frame();
      assert.equal(page.rendered.run, run);
      assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
      assert.equal(page.rendered.paused, true);
      assert.deepEqual(page.storage.map, before);
      assert.equal(page.doc.activeElement, choose);
      assert.equal(focusCalls, 1, 'Neither late completion gains focus authority.');
      assert.deepEqual(page.errors, []);
      return;
    }
    if (afterStay === 'moved focus') page.$('optional-worlds-summary').focus();
    if (afterStay === 'foreground loss') {
      page.doc.focused = false;
      page.win.emit('blur');
    }
    const focusBeforeCompletion = page.doc.activeElement;
    grant();
    await pending;
    for (let i = 0; i < 8; i++) page.frame();
    assert.equal(page.rendered.run, run);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    assert.equal(page.rendered.paused, true);
    assert.deepEqual(page.storage.map, before, 'A cancelled save cannot write after lock release.');
    assert.equal(page.doc.activeElement, focusBeforeCompletion);
    assert.equal(focusCalls, 0, 'Old finally cannot refocus or steal the newer/background intent.');
    if (afterStay === 'foreground loss') {
      page.doc.focused = true;
      page.win.emit('focus');
      page.frame();
      assert.equal(page.rendered.paused, true);
      assert.equal(focusCalls, 0);
    }
    assert.deepEqual(page.errors, []);
  });

export const optionalChapterScenarios = Object.freeze(scenarios);
export function assertOptionalFetchRestored() {
  assert.equal(globalThis.fetch, fetchOutsidePages);
}
