import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { PNGImage } from './helpers/png-image.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { ACTOR_STYLE_PREFERENCES_KEY } from '../actor-style-preferences.mjs';
import { preparePack, emptyPackLibrary, installPack, exportPackLibrary } from '../packs.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const journeyKey = 'revealline.suspended.journey-whole-spatial.v5';
const legacyKey = 'revealline.suspended.dev.v1';
const ticks = (page, count) => {
  for (let i = 0; i < count; i++) page.frame();
};
const checkpoint = (page) => {
  page.frame(0);
  return authoritativeCheckpoint(page.rendered.run);
};

async function committedAsset(path) {
  try {
    return await readFile(new URL(`../../${path}`, import.meta.url));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    // Read exact committed bytes in this sparse checkout; no synthetic asset,
    // copied release directory, source mutation or codec bypass is used.
    return execFileSync('git', ['show', `HEAD:${path}`], {
      cwd: root,
      maxBuffer: 12 * 1024 * 1024,
    });
  }
}
async function setup(
  t,
  {
    storage = memoryStorage(),
    search = '?journey=whole-spatial-v5',
    changeResponse,
    ...options
  } = {},
) {
  const requests = [];
  const page = await soloPage(t, {
    titleScreen: true,
    storage,
    search,
    journeyIndexedDB: managedIndexedDB().indexedDB,
    pictures: { Image: PNGImage },
    fetchResponse: async (url, init) => {
      const value = String(url);
      requests.push(value);
      const changed = await changeResponse?.(value, init);
      if (changed !== undefined) return changed;
      const presentation = value.match(/(?:^|\/)presentation\/(.+)$/);
      if (presentation)
        return new Response(await committedAsset(`game/presentation/${presentation[1]}`));
      if (value.includes('/content-design/assets/'))
        return new Response(await readFile(value.startsWith('file:') ? new URL(value) : value));
      return undefined;
    },
    ...options,
  });
  return Object.assign(page, { requests });
}
async function start(page) {
  page.$('shell-featured').click();
  try {
    await settle(() => page.doc.body.dataset.flightState === 'running');
  } catch (error) {
    error.message += ` ${JSON.stringify({ status: page.$('shell-flight-status').textContent, errors: page.errors.map(String), home: page.$('shell-home').open, disabled: page.$('shell-featured').disabled, state: page.doc.body.dataset.flightState })}`;
    throw error;
  }
  page.frame(0);
}
function save(page, key = journeyKey) {
  if (page.doc.body.dataset.flightState === 'running') page.$('pause-button').click();
  if (!page.storage.getItem(key)) page.$('save-attempt-button').click();
  const saved = JSON.parse(page.storage.getItem(key));
  assert(saved, `${page.$('save-warning').textContent} ${page.$('run-message').textContent}`);
  return saved;
}

test('fresh Journey defaults to separately pinned FPV actors and saves the exact owner', async (t) => {
  const page = await setup(t);
  assert.equal(page.$('menu-actor-style').value, 'fpv');
  const wholeTheme = page.doc.documentElement.dataset.presentationTheme;
  await start(page);
  assert.equal(page.rendered.actorAppearance.style, 'fpv');
  assert.equal(page.rendered.actorAppearance.snapshot.canvas, undefined);
  assert.equal(page.doc.documentElement.dataset.presentationTheme, wholeTheme);
  page.key('ArrowDown');
  ticks(page, 12);
  page.key('ArrowDown', false);
  const saved = save(page);
  assert.equal(saved.format, 'xonix-session.v6');
  assert.equal(saved.actorAppearancePin.style, 'fpv');
  assert.equal(saved.actorAppearancePin.content.owner.kind, 'journey');
  assert.equal(saved.actorAppearancePin.content.editionId, 'whole-spatial-v5');
  assert.equal(saved.actorAppearancePin.content.level.id, 'first-return');
  assert.equal(saved.visualThemePin, null);
  assert.deepEqual(page.errors, []);
});

test('new campaign choice is pinned without loading an actor lease or changing simulation', async (t) => {
  const page = await setup(t);
  page.change('menu-actor-style', 'campaign');
  assert.equal(
    JSON.parse(page.storage.getItem(ACTOR_STYLE_PREFERENCES_KEY)).actorStyle,
    'campaign',
  );
  await start(page);
  assert.deepEqual(page.rendered.actorAppearance, { style: 'campaign', snapshot: null });
  const before = checkpoint(page),
    saved = save(page);
  assert.equal(saved.actorAppearancePin.style, 'campaign');
  assert.equal(saved.actorAppearancePin.presentation, null);
  assert.deepEqual(checkpoint(page), before);
});

test('Classic Continue and confirmed Restart keep the accepted actor pin despite a new preference', async (t) => {
  const storage = memoryStorage(),
    database = managedIndexedDB().indexedDB;
  let original, before;
  await t.test(
    'fresh accepted Base game saves independent world and actor revisions',
    async (t) => {
      const page = await setup(t, { storage, search: '?journey=legacy', assetIndexedDB: database });
      await start(page);
      page.key('ArrowDown');
      ticks(page, 12);
      page.key('ArrowDown', false);
      before = checkpoint(page);
      original = save(page, legacyKey);
      assert.equal(original.format, 'xonix-session.v6');
      assert.equal(original.actorAppearancePin.content.owner.kind, 'campaign');
      assert.equal(original.actorAppearancePin.style, 'fpv');
      assert.notEqual(
        original.actorAppearancePin.presentation.sha256,
        original.visualThemePin.presentation.sha256,
      );
    },
  );
  assert(original);
  await t.test('Continue and Restart ignore fresh campaign preference', async (t) => {
    storage.setItem(ACTOR_STYLE_PREFERENCES_KEY, JSON.stringify({ actorStyle: 'campaign' }));
    const page = await setup(t, { storage, search: '?journey=legacy', assetIndexedDB: database });
    assert.equal(page.$('menu-actor-style').value, 'campaign');
    page.$('shell-continue').click();
    await settle(() => page.doc.body.dataset.flightState === 'running');
    assert.deepEqual(checkpoint(page), before);
    assert.equal(page.rendered.actorAppearance.style, 'fpv');
    assert.deepEqual(save(page, legacyKey).actorAppearancePin, original.actorAppearancePin);
    page.$('overlay-restart').click();
    assert.equal(page.$('restart-dialog').open, true);
    page.$('restart-confirm').click();
    await settle(() => page.doc.body.dataset.flightState === 'running');
    page.frame(0);
    assert.equal(page.rendered.run.tick, 0);
    assert.deepEqual(save(page, legacyKey).actorAppearancePin, original.actorAppearancePin);
    assert.deepEqual(page.errors, []);
  });
  await t.test(
    'historical v5 Continue remains pinless despite the default FPV preference',
    async (t) => {
      const historical = structuredClone(original);
      historical.format = 'xonix-session.v5';
      delete historical.actorAppearancePin;
      storage.setItem(legacyKey, JSON.stringify(historical));
      storage.removeItem(ACTOR_STYLE_PREFERENCES_KEY);
      const page = await setup(t, { storage, search: '?journey=legacy', assetIndexedDB: database });
      page.$('shell-continue').click();
      await settle(() => page.doc.body.dataset.flightState === 'running');
      assert.deepEqual(checkpoint(page), before);
      assert.equal(page.rendered.actorAppearance, null);
      const saved = save(page, legacyKey);
      assert.equal(saved.format, 'xonix-session.v5');
      assert.equal(saved.actorAppearancePin, undefined);
      assert.deepEqual(page.errors, []);
    },
  );
});

test('failed fresh Next keeps the result, Retry keeps FPV, and successful Next applies the new choice', async (t) => {
  let rejectActors = false;
  let actorHash;
  const diagnostics = [],
    rejectedURLs = [];
  t.mock.method(console, 'warn', (...args) => diagnostics.push(args));
  const page = await setup(t, {
    search: '?journey=legacy',
    changeResponse: (url) => {
      if (
        rejectActors &&
        (url.endsWith('/runtime.json') || url.endsWith(`/runtime.${actorHash}.json`))
      ) {
        rejectedURLs.push(url);
        return new Response('{broken actor manifest');
      }
      return undefined;
    },
  });
  await start(page);
  const pin = save(page, legacyKey).actorAppearancePin;
  actorHash = pin.presentation.sha256;
  // Preserve the initial failed fixture as an actor-free gp4 observation. The
  // old immediate cut is hit at tick 403; its failure is not appearance loading.
  const staleRoute = createRun(page.rendered.run.level, {
    seed: 1,
    classId: 'scout',
    turnPolicy: 'immediate',
  });
  for (let tick = 0; tick < 460; tick++)
    stepRun(staleRoute, tick ? { direction: 'down' } : {}, FIXED_DT);
  assert.equal(staleRoute.status, 'respawning');
  assert.equal(staleRoute.lives, 2);
  assert.equal(authoritativeCheckpoint(staleRoute).hash, '20c2baf1bcb0138f');
  async function win() {
    if (page.doc.body.dataset.flightState !== 'running') page.$('start-button').click();
    await settle(() => page.doc.body.dataset.flightState === 'running');
    assert.equal(page.rendered.run.tick, 0);
    ticks(page, 133);
    page.key('ArrowDown');
    ticks(page, 469);
    page.key('ArrowDown', false);
    page.frame(0);
    assert.equal(
      page.rendered.run.status,
      'won',
      'A legal opening cut must really clear the mission.',
    );
    assert.equal(checkpoint(page).hash, 'd8b55c21a6756634');
  }
  await win();
  const result = page.rendered.run,
    before = checkpoint(page),
    savedBefore = page.storage.getItem(legacyKey);
  rejectActors = true;
  page.$('next-button').click();
  // A newer page theme must not bypass the injected failure: actors deliberately
  // keep their approved hash-addressed release, independent of runtime.json.
  try {
    await settle(() =>
      page.$('flight-preparation-status').textContent.includes('Could not prepare this mission'),
    );
  } catch (error) {
    error.message += ` ${JSON.stringify({ status: page.$('flight-preparation-status').textContent, levelId: page.rendered.run.levelId, diagnostics, rejectedURLs, manifestRequests: page.requests.filter((url) => /\/runtime[.]/.test(url)).slice(-6) })}`;
    throw error;
  }
  assert.equal(page.rendered.run, result);
  assert.deepEqual(checkpoint(page), before);
  assert.equal(page.storage.getItem(legacyKey), savedBefore);
  assert.equal(diagnostics.length, 1);
  assert.equal(
    rejectedURLs.length,
    1,
    'The actor release, not its separate world theme, must fail.',
  );
  page.change('menu-actor-style', 'campaign');
  page.$('retry-button').click();
  await settle(() => {
    page.frame(0);
    return page.doc.body.dataset.flightState === 'running' && page.rendered.run !== result;
  });
  assert.deepEqual(save(page, legacyKey).actorAppearancePin, pin);
  await win();
  page.$('next-button').click();
  await settle(() => {
    page.frame(0);
    return (
      page.doc.body.dataset.flightState === 'running' && page.rendered.run.levelId === 'signal-02'
    );
  });
  const next = save(page, legacyKey);
  assert.equal(next.actorAppearancePin.style, 'campaign');
  assert.equal(next.actorAppearancePin.content.level.id, 'signal-02');
  assert.equal(next.actorAppearancePin.presentation, null);
  assert.deepEqual(page.errors, []);
});

test('Journey v6 Continue validates its exact source and retains FPV after the menu preference changes', async (t) => {
  const storage = memoryStorage();
  let original, before;
  await t.test('create an actual pinned Journey flight', async (t) => {
    const page = await setup(t, { storage });
    await start(page);
    page.key('ArrowDown');
    ticks(page, 12);
    page.key('ArrowDown', false);
    before = checkpoint(page);
    original = save(page);
    assert.equal(
      original.presentationPins,
      null,
      'Journey does not invent managed-picture ownership.',
    );
  });
  assert(original);
  await t.test('restore exact source without adopting fresh preference', async (t) => {
    storage.setItem(ACTOR_STYLE_PREFERENCES_KEY, JSON.stringify({ actorStyle: 'campaign' }));
    const page = await setup(t, { storage });
    page.$('shell-continue').click();
    await settle(() => page.doc.body.dataset.flightState === 'running');
    assert.deepEqual(checkpoint(page), before);
    assert.equal(page.rendered.actorAppearance.style, 'fpv');
    assert.deepEqual(save(page).actorAppearancePin, original.actorAppearancePin);
  });
  await t.test(
    'same-ID forged source hash does not replace the current flight or saved bytes',
    async (t) => {
      const forged = structuredClone(original);
      forged.actorAppearancePin.content.owner.projectSha256 = 'f'.repeat(64);
      const raw = JSON.stringify(forged);
      storage.setItem(journeyKey, raw);
      const page = await setup(t, { storage });
      const run = page.rendered.run,
        before = checkpoint(page);
      page.$('shell-continue').click();
      await settle(
        () =>
          /actor|accepted content/i.test(page.$('shell-flight-status').textContent) &&
          page.$('shell-flight-cancel').hidden,
      );
      assert.equal(page.rendered.run, run);
      assert.deepEqual(checkpoint(page), before);
      assert.equal(storage.getItem(journeyKey), raw);
      assert.equal(page.$('shell-home').open, true);
    },
  );
  await t.test(
    'v6 file import restores exact actors; a forged actor release keeps that flight',
    async (t) => {
      const page = await setup(t);
      page.change('menu-actor-style', 'campaign');
      await start(page);
      save(page);
      page.$('overlay-brief').click();
      page.$('shell-gallery').click();
      page.$('collection-records').click();
      page.doc.querySelector('button[data-library-panel="saves"]').click();
      page.$('save-file').files = [
        new Blob([JSON.stringify(original)], { type: 'application/json' }),
      ];
      await page.$('save-file').onchange();
      assert.deepEqual(checkpoint(page), before);
      assert.equal(page.rendered.actorAppearance.style, 'fpv');
      const adopted = page.rendered.run;
      page.$('overlay-brief').click();
      page.$('shell-gallery').click();
      page.$('collection-records').click();
      page.doc.querySelector('button[data-library-panel="saves"]').click();
      const raw = page.storage.getItem(journeyKey),
        forged = structuredClone(original);
      forged.actorAppearancePin.presentation.sha256 = 'e'.repeat(64);
      page.$('save-file').files = [
        new Blob([JSON.stringify(forged)], { type: 'application/json' }),
      ];
      await page.$('save-file').onchange();
      assert.match(page.$('save-status').textContent, /actor release|actor appearance|approved/i);
      assert.equal(page.rendered.run, adopted);
      assert.deepEqual(checkpoint(page), before);
      assert.equal(page.storage.getItem(journeyKey), raw);
      assert.equal(page.$('library-dialog').open, true);
      assert.deepEqual(page.errors, []);
    },
  );
});

test('changing the preference cancels a pending fresh actor lease before flight adoption', async (t) => {
  let armed = false,
    unblock;
  const page = await setup(t, {
    changeResponse: (url) =>
      armed && url.endsWith('/runtime.json')
        ? new Promise((resolve) => {
            unblock = resolve;
          })
        : undefined,
  });
  const run = page.rendered.run,
    before = checkpoint(page);
  armed = true;
  page.$('shell-featured').click();
  await settle(() => typeof unblock === 'function');
  page.change('menu-actor-style', 'campaign');
  armed = false;
  unblock(undefined);
  await settle(() => page.$('shell-flight-cancel').hidden && !page.$('shell-featured').disabled);
  assert.equal(page.rendered.run, run);
  assert.deepEqual(checkpoint(page), before);
  assert.equal(page.rendered.actorAppearance, null);
  assert.notEqual(page.doc.body.dataset.flightState, 'running');
  // Journey Start has already left the title for its prepared briefing. The
  // cancelled launch stays there; its visible Start is a fresh explicit action.
  assert.equal(page.$('game-overlay').hidden, false);
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.frame(0);
  assert.equal(page.rendered.actorAppearance.style, 'campaign');
  assert.equal(save(page).actorAppearancePin.style, 'campaign');
  assert.deepEqual(page.errors, []);
});

for (const entryPoint of ['selector', 'cold Classic setup'])
  test(`a same-ID modified Custom pack retains authored actors through ${entryPoint} with unavailable authority`, async (t) => {
    const source = JSON.parse(
      await readFile(new URL('../content/packs/night-shift.json', import.meta.url)),
    );
    source.themes[0].palette.accent = '#ff11aa';
    const { pack } = await preparePack(source),
      assets = managedIndexedDB();
    const db = await new Promise((resolve, reject) => {
      const request = assets.indexedDB.open('revealline-assets-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('assets');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction('assets', 'readwrite');
        tx.objectStore('assets').put(
          exportPackLibrary(installPack(emptyPackLibrary(), pack)),
          'revealline.packs.dev.v1',
        );
        tx.oncomplete = resolve;
        tx.onabort = tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
    let indexUnavailable = false;
    const page = await setup(t, {
      search: '?journey=legacy',
      assetIndexedDB: assets.indexedDB,
      changeResponse: (url) =>
        indexUnavailable && url.includes('mission-library-index.json')
          ? new Response('Unavailable', { status: 503 })
          : undefined,
    });
    if (entryPoint === 'cold Classic setup') {
      indexUnavailable = true;
      page.$('pack-select').value = source.id;
      await page.$('pack-select').onchange();
      page.frame(0);
      assert.equal(page.rendered.run.levelId, source.campaigns[0].levels[0].id);
      await start(page);
      assert.equal(page.rendered.actorAppearance, null);
      assert.match(
        page.$('menu-actor-note').textContent,
        /compatibility is unavailable.*authored actors/,
      );
      assert.equal(save(page, legacyKey).actorAppearancePin, undefined);
      assert.deepEqual(page.errors, []);
      return;
    }
    page.$('shell-play').click();
    await settle(
      () => page.$('journey-chooser')?.open && page.$('journey-collection')?.children.length > 0,
    );
    page.change('journey-collection', 'Custom');
    const levelId = source.campaigns[0].levels[0].id;
    const card = [...page.$('journey-cards').children].find(
      (button) => JSON.parse(button.dataset.missionId)[3] === levelId,
    );
    assert(card, 'The modified pack must be classified Custom, not accepted by its reused ID.');
    indexUnavailable = true;
    const indexRequests = page.requests.filter((url) =>
      url.includes('mission-library-index.json'),
    ).length;
    card.click();
    await settle(() => {
      page.frame(0);
      return (
        page.doc.body.dataset.flightState === 'running' && page.rendered.run.levelId === levelId
      );
    });
    assert.equal(page.$('menu-actor-style').value, 'fpv');
    assert.equal(page.rendered.actorAppearance, null);
    assert.equal(save(page, legacyKey).actorAppearancePin, undefined);
    assert.equal(
      page.requests.filter((url) => url.includes('mission-library-index.json')).length,
      indexRequests,
    );
    assert.deepEqual(page.errors, []);
  });

test('First Flight handoff retains the actual Journey actor pin before navigation', async (t) => {
  const page = await setup(t);
  await start(page);
  page.key('ArrowDown');
  ticks(page, 12);
  page.key('ArrowDown', false);
  const before = checkpoint(page);
  let destination;
  page.win.location.assign = (value) => {
    destination = value;
  };
  page.$('first-flight-help-enter').click();
  await settle(() => !!destination, 'The checked handoff must finish saving before navigation.');
  assert.equal(new URL(destination).searchParams.get('course'), 'first-flight');
  const saved = JSON.parse(page.storage.getItem(journeyKey));
  assert.equal(saved.format, 'xonix-session.v6');
  assert.equal(saved.actorAppearancePin.style, 'fpv');
  assert.equal(saved.actorAppearancePin.content.owner.kind, 'journey');
  assert.deepEqual(checkpoint(page), before);
  assert.deepEqual(page.errors, []);
});
