import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getLocale, setLocale, t } from '../i18n/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { preparePack, emptyPackLibrary, installPack, exportPackLibrary } from '../packs.mjs';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { activateMissionCard, openMissionLibrary } from './helpers/library-selection.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';
import { PNGImage } from './helpers/png-image.mjs';
import { createJourneyBackend } from '../journey/profile.mjs';
import { campaignKey } from '../library.mjs';
import { activateHostAction } from './helpers/host-action.mjs';

const profileKey = 'revealline.library.dev.v1';
const sessionKey = 'revealline.suspended.dev.v1';

function english(context) {
  const locale = getLocale();
  context.after(() => setLocale(locale, { persist: false }));
  setLocale('en', { persist: false });
}

function snapshot(page) {
  page.frame(0);
  return {
    run: page.rendered.run,
    checkpoint: authoritativeCheckpoint(page.rendered.run),
    picture: page.rendered.backdrop,
    profile: page.storage.getItem(profileKey),
    saved: page.storage.getItem(sessionKey),
    focus: page.doc.activeElement,
    scroll: page.doc.documentElement.scrollTop,
    flight: page.doc.body.dataset.flightState,
  };
}

function unchanged(page, before) {
  page.frame(0);
  assert.equal(page.rendered.run, before.run);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), before.checkpoint);
  assert.equal(page.rendered.backdrop, before.picture);
  assert.equal(page.storage.getItem(profileKey), before.profile);
  assert.equal(page.storage.getItem(sessionKey), before.saved);
  assert.equal(page.doc.activeElement, before.focus);
  assert.equal(page.doc.documentElement.scrollTop, before.scroll);
  assert.equal(page.doc.body.dataset.flightState, before.flight);
}

async function startAndPause(page) {
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.$('pause-button').click();
  page.$('journey-skip').focus();
  page.doc.documentElement.scrollTop = 83;
}

async function settlesWithFlightState(page, predicate) {
  try {
    await settle(predicate);
  } catch (error) {
    error.message += `\n${JSON.stringify({
      flight: page.doc.body.dataset.flightState,
      level: page.rendered.run.levelId,
      status: page.$('flight-preparation-status').textContent,
      stage: page.$('flight-preparation-status').dataset.stage,
      skip: page.$('journey-skip').textContent,
      warning: page.$('run-message').textContent,
    })}`;
    throw error;
  }
}

async function customPage(context) {
  const recipe = JSON.parse(
    await readFile(new URL('../content/packs/night-shift.json', import.meta.url), 'utf8'),
  );
  recipe.id = 'localization-owned-skip';
  recipe.campaigns = [
    {
      ...recipe.campaigns[0],
      id: 'localization-owned-skip-campaign',
      levels: ['custom-first', 'custom-next'].map((id, index) => ({
        ...retryFixture('self-contact').level,
        id,
        // Deliberately share the official destination's English title. Only
        // exact source ownership, never its spelling, may authorize translation.
        name: index ? 'Relay Orchard' : 'My first mission',
        rules: { lives: 3 },
      })),
    },
  ];
  recipe.levelVisuals = [];
  recipe.visualOverrides = {};
  const { pack } = await preparePack(recipe);
  const assets = managedIndexedDB();
  const database = await new Promise((resolve, reject) => {
    const request = assets.indexedDB.open('revealline-assets-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('assets');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise((resolve, reject) => {
    const transaction = database.transaction('assets', 'readwrite');
    transaction
      .objectStore('assets')
      .put(exportPackLibrary(installPack(emptyPackLibrary(), pack)), 'revealline.packs.dev.v1');
    transaction.oncomplete = resolve;
    transaction.onabort = transaction.onerror = () => reject(transaction.error);
  });
  database.close();
  const page = await soloPage(context, {
    titleScreen: true,
    assetIndexedDB: assets.indexedDB,
    journeyIndexedDB: managedIndexedDB().indexedDB,
  });
  await openMissionLibrary(page, 'shell-play');
  page.$('journey-collection').value = 'Custom';
  page.$('journey-collection').emit('change');
  const card = [...page.$('journey-cards').children].find(
    (element) => JSON.parse(element.dataset.missionId)[3] === 'custom-first',
  );
  assert.ok(card);
  await activateMissionCard(card);
  assert.equal(page.doc.body.dataset.flightState, 'briefing');
  return page;
}

for (const source of ['official', 'custom'])
  test(`${source} armed Solo Skip repaints its destination without changing confirmation or the flight`, async (context) => {
    english(context);
    const page = source === 'custom' ? await customPage(context) : await soloPage(context);
    if (source === 'official') {
      // Join the real catalogue operation before exercising the already-armed
      // caption. Cold lookup lifecycle has its own deliberately held case below.
      await openMissionLibrary(page, 'overlay-missions');
      page.$('journey-back').click();
    }
    await startAndPause(page);
    const skip = page.$('journey-skip');
    skip.click();
    await settlesWithFlightState(page, () => skip.textContent === t('interface:confirmSkip'));
    const before = snapshot(page);
    for (const locale of ['uk', 'en', 'uk']) {
      setLocale(locale, { persist: false });
      const name =
        source === 'official' && locale === 'uk' ? 'Сад ретрансляторів' : 'Relay Orchard';
      assert.equal(skip.textContent, t('interface:confirmSkip'));
      assert.ok(
        page
          .$('run-message')
          .textContent.includes(t('interface:solo.universalSkipConfirm', { mission: name })),
      );
      unchanged(page, before);
    }
    // The existing confirmation remains armed: one deliberate activation still
    // launches exactly the destination selected before any locale changes.
    skip.click();
    await settlesWithFlightState(page, () => {
      page.frame(0);
      return (
        page.doc.body.dataset.flightState === 'running' &&
        page.rendered.run.levelId === (source === 'custom' ? 'custom-next' : 'signal-02')
      );
    });
    assert.notEqual(page.rendered.run, before.run);
    assert.deepEqual(page.errors, []);
  });

test('Journey Skip translates its armed destination and held preparation without rearming or awarding progress', async (context) => {
  english(context);
  const memory = managedIndexedDB(),
    backend = createJourneyBackend(memory);
  let hold = false,
    requests = 0,
    release;
  const artwork = new Promise((resolve) => {
    release = resolve;
  });
  context.after(release);
  const page = await soloPage(context, {
    search: '?journey=opening',
    journeyIndexedDB: memory.indexedDB,
    pictures: { Image: PNGImage },
    fetchResponse: async (path) => {
      if (String(path).includes('/content-design/assets/')) {
        if (hold && String(path).endsWith('/choose-your-share.png')) {
          requests++;
          await artwork;
        }
        return new Response(await readFile(path));
      }
    },
  });
  await startAndPause(page);
  const skip = page.$('journey-skip');
  skip.click();
  assert.equal(skip.textContent, t('interface:confirmSkip'));
  const before = snapshot(page),
    profile = await backend.read();
  for (const language of ['uk', 'en']) {
    setLocale(language, { persist: false });
    assert.ok(
      page
        .$('run-message')
        .textContent.includes(
          t('interface:solo.universalSkipConfirm', { mission: t('content:chooseYourShare') }),
        ),
    );
    unchanged(page, before);
    assert.deepEqual(await backend.read(), profile);
  }
  hold = true;
  skip.click();
  await settlesWithFlightState(page, () => requests === 1);
  const status = page.$('flight-preparation-status');
  for (const language of ['uk', 'en']) {
    setLocale(language, { persist: false });
    assert.equal(status.textContent, t('interface:solo.candidateVerifying'));
    assert.equal(status.dataset.state, 'busy');
    assert.equal(requests, 1, 'One confirmation starts only the retained exact destination.');
    unchanged(page, before);
    assert.deepEqual(await backend.read(), profile);
  }
  page.$('flight-preparation-cancel').click();
  release();
  assert.equal(status.dataset.state, 'cancelled');
  assert.equal(skip.textContent, t('interface:skipMission'));
  unchanged(page, before);
  assert.deepEqual((await backend.read()).clears.solo, profile.clears.solo);
  assert.deepEqual(page.errors, []);
});

test('pending Skip lookup and unknown failure translate without restarting or exposing diagnostics', async (context) => {
  english(context);
  const diagnostic = new Error('LOCALIZATION_PRIVATE_DIAGNOSTIC_42');
  const warnings = [];
  context.mock.method(console, 'warn', (...args) => warnings.push(args));
  let rejectLookup;
  const lookup = new Promise((_, reject) => {
    rejectLookup = reject;
  });
  let requests = 0;
  const page = await soloPage(context, {
    fetchResponse(path) {
      if (path !== 'content/mission-library-index.json') return;
      requests++;
      return lookup;
    },
  });
  await startAndPause(page);
  const skip = page.$('journey-skip');
  skip.click();
  await settle(() => requests === 1);
  const before = snapshot(page);
  const status = page.$('flight-preparation-status');
  for (const locale of ['uk', 'en']) {
    setLocale(locale, { persist: false });
    assert.equal(status.textContent, t('interface:solo.findingNextMission'));
    assert.equal(status.dataset.state, 'busy');
    assert.equal(requests, 1);
    unchanged(page, before);
  }
  rejectLookup(diagnostic);
  await settle(() => status.dataset.state === 'error');
  for (const locale of ['uk', 'en']) {
    setLocale(locale, { persist: false });
    assert.equal(status.textContent, t('interface:solo.skipUnavailable'));
    assert.doesNotMatch(status.textContent, /LOCALIZATION_PRIVATE_DIAGNOSTIC/);
    assert.equal(skip.textContent, t('interface:skipMission'));
    assert.equal(requests, 1);
    unchanged(page, before);
  }
  assert.ok(warnings.some((entry) => entry.includes(diagnostic)));
  assert.deepEqual(page.errors, []);
});

for (const action of ['Skip', 'Next'])
  test(`${action} failed boundary download gives live safe recovery while preserving the current flight`, async (context) => {
    english(context);
    const diagnostic = new Error('LOCALIZATION_BOUNDARY_PRIVATE_DIAGNOSTIC_43'),
      warnings = [];
    context.mock.method(console, 'warn', (...args) => warnings.push(args));
    const campaign = JSON.parse(
      await readFile(new URL('../content/campaign.json', import.meta.url), 'utf8'),
    );
    campaign.id = 'localization-boundary';
    campaign.levels = [
      {
        ...retryFixture('self-contact').level,
        id: 'boundary-clear',
        name: 'Boundary clear',
        goal: { coverage: 0.1 },
        rules: { lives: 3 },
      },
    ];
    campaign.briefs = [];
    const index = JSON.parse(
      await readFile(new URL('../content/mission-library-index.json', import.meta.url), 'utf8'),
    );
    const destination = index.missions.find((row) => row.packId === 'fpv-arcade-r5');
    assert.ok(destination);
    index.missions = [
      {
        ...index.missions[0],
        campaignKey: campaignKey(campaign),
        levelId: campaign.levels[0].id,
        levelRevision: campaign.levels[0].revision,
        levelIndex: 0,
      },
      destination,
    ];
    let requests = 0;
    const page = await soloPage(context, {
      campaign,
      fetchResponse(path) {
        if (path === 'content/mission-library-index.json')
          return new Response(JSON.stringify(index));
        if (path === 'content/packs/fpv-arcade-r5.json') {
          requests++;
          throw diagnostic;
        }
      },
    });
    await openMissionLibrary(page, 'overlay-missions');
    page.$('journey-back').click();
    page.$('start-button').click();
    await settle(() => page.doc.body.dataset.flightState === 'running');
    if (action === 'Skip') {
      page.$('pause-button').click();
      page.$('journey-skip').focus();
      page.$('journey-skip').click();
      await settle(() => page.$('journey-skip').textContent === t('interface:confirmSkip'));
    } else {
      page.key('ArrowDown');
      page.key('ArrowDown', false);
      for (let tick = 0; tick < 900 && page.rendered.run.status !== 'won'; tick++) page.frame();
      assert.equal(page.rendered.run.status, 'won');
      if (!page.$('skip-celebration').hidden) page.$('skip-celebration').click();
      if (page.$('game-overlay').hidden) page.$('show-result').click();
      await settle(() => !page.$('next-button').disabled);
      page.$('next-button').focus();
    }
    page.doc.documentElement.scrollTop = 47;
    const before = snapshot(page);
    if (action === 'Skip') page.$('journey-skip').click();
    else await activateHostAction(page.$('next-button'));
    const status = page.$('flight-preparation-status');
    await settlesWithFlightState(page, () => status.dataset.state === 'error');
    for (const language of ['uk', 'en']) {
      setLocale(language, { persist: false });
      assert.equal(
        status.textContent,
        action === 'Skip'
          ? t('interface:solo.prepareSkipFailed', { mission: t('content:orchardCrossing') })
          : t('interface:solo.prepareResultNextFailed'),
      );
      assert.doesNotMatch(status.textContent, /LOCALIZATION_BOUNDARY_PRIVATE_DIAGNOSTIC/);
      assert.equal(requests, 1);
      unchanged(page, before);
    }
    assert.ok(warnings.some((entry) => entry.some((value) => value?.cause === diagnostic)));
    assert.deepEqual(page.errors, []);
  });
