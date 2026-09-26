import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PNGImage } from './helpers/png-image.mjs';
import { soloPage, settle, memoryStorage } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { createRun } from '../core/index.mjs';
import { companySimulationIdentity } from '../company-session.mjs';

test('edition runs the complete Solo host with canonical rules, settings and mission library', async (t) => {
  const f = await editionProviderFixture();
  const legacyKey = 'revealline.suspended.journey-sample-public.v1';
  const legacy = JSON.stringify({ format: 'revealline-company-session.v1', retained: true });
  const storage = memoryStorage({ [legacyKey]: legacy });
  const page = await soloPage(t, {
    search: '?edition=sample-public',
    titleScreen: true,
    storage,
    journeyIndexedDB: managedIndexedDB().indexedDB,
    fetchResponse: f.fetcher,
  });
  assert.equal(
    page.doc.body.dataset.editionId,
    'sample-public',
    page.errors.map((e) => e.stack).join('\n') + page.$('overlay-copy').textContent,
  );
  assert.equal(page.$('menu-actor-style').value, 'campaign');
  assert.equal(page.$('difficulty-select').options.length, 3);
  page.$('shell-featured').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.frame(0);
  const expected = createRun(
    applyGameplayTuning(
      resolveMission(f.project, f.project.missions[0].id, { difficulty: 'standard' }).level,
      resolveGameplayTuning('standard'),
    ),
  );
  assert.equal(companySimulationIdentity(page.rendered.run), companySimulationIdentity(expected));
  assert.equal(page.rendered.actorAppearance.style, 'campaign');
  page.$('settings-button').click();
  assert.equal(page.$('settings-dialog').open, true);
  assert.ok(page.$('turn-select'));
  assert.ok(page.$('controller-settings-root'));
  assert.ok(page.doc.querySelector('[data-language-control]'));
  page.$('settings-dialog').close();
  page.$('save-attempt-button').click();
  const saved = JSON.parse(storage.getItem(`${legacyKey}.solo-v2`));
  assert.equal(saved.format, 'xonix-session.v6');
  assert.equal(saved.actorAppearancePin.style, 'campaign');
  assert.equal(saved.actorAppearancePin.format, 'revealline-actor-appearance-pin.v2');
  assert.match(saved.actorAppearancePin.authoredPresentationSha256, /^[a-f0-9]{64}$/);
  assert.equal(saved.actorAppearancePin.content.editionId, 'sample-public');
  assert.equal(storage.getItem(legacyKey), legacy);
  await page.$('export-replay').onclick();
  const recording = JSON.parse(page.$('replay-json').value);
  assert.equal(recording.format, 'revealline-replay-presentation.v2');
  assert.deepEqual(recording.actorAppearancePin, saved.actorAppearancePin);
  page.$('replay-dialog').close();
  assert.ok(page.$('settings-panel-data').textContent.includes('Earlier preview save retained'));
  page.$('shell-worlds').click();
  await settle(() => page.$('journey-chooser').open);
  assert.deepEqual(
    [...page.$('journey-mode').options].map((option) => option.value),
    ['solo'],
  );
  assert.deepEqual(
    [...page.$('journey-collection').options].map((option) => option.value),
    ['', 'Journey'],
  );
  assert.equal(page.doc.querySelector('.journey-library-copy').textContent, 'Sample public');
  for (const id of ['shell-controller-lab', 'shell-replay-theater'])
    assert.equal(new URL(page.$(id).href).searchParams.get('edition'), 'sample-public');
  page.$('journey-chooser').close();
  const downloads = [...page.doc.querySelectorAll('a')].find(
    (link) => link.textContent === 'Offline play & edition data',
  );
  downloads.click();
  assert.equal(page.$('settings-dialog').open, true);
  assert.equal(page.$('settings-panel-data').hidden, false);
  assert.deepEqual(page.errors, []);
});

test('edition Continue preserves a matching receipt and rejects a same-ID changed palette without overwriting recovery', async (t) => {
  const storage = memoryStorage(),
    key = 'revealline.suspended.journey-sample-public.v1.solo-v2';
  let saved;
  await t.test('save the accepted appearance', async (t) => {
    const f = await editionProviderFixture(),
      page = await soloPage(t, {
        search: '?edition=sample-public',
        titleScreen: true,
        storage,
        journeyIndexedDB: managedIndexedDB().indexedDB,
        fetchResponse: f.fetcher,
      });
    page.$('shell-featured').click();
    await settle(() => page.doc.body.dataset.flightState === 'running');
    page.frame(0);
    page.$('pause-button').click();
    page.$('save-attempt-button').click();
    saved = storage.getItem(key);
    assert.ok(saved, page.$('save-warning').textContent + page.$('run-message').textContent);
  });
  await t.test('matching edition resumes', async (t) => {
    const f = await editionProviderFixture(),
      page = await soloPage(t, {
        search: '?edition=sample-public',
        titleScreen: true,
        storage,
        journeyIndexedDB: managedIndexedDB().indexedDB,
        fetchResponse: f.fetcher,
      });
    page.$('shell-continue').click();
    await settle(() => page.doc.body.dataset.flightState === 'running');
    page.frame(0);
    page.$('pause-button').click();
    page.$('save-attempt-button').click();
    assert.deepEqual(
      JSON.parse(storage.getItem(key)).actorAppearancePin,
      JSON.parse(saved).actorAppearancePin,
    );
  });
  for (const change of ['palette', 'missing receipt'])
    await t.test(change, async (t) => {
      const f = await editionProviderFixture();
      let raw = saved;
      if (change === 'palette') f.data.themes.themes[0].palette.accent = '#ff00ff';
      else {
        const prior = JSON.parse(saved);
        prior.actorAppearancePin.format = 'revealline-actor-appearance-pin.v1';
        delete prior.actorAppearancePin.authoredPresentationSha256;
        raw = JSON.stringify(prior);
      }
      storage.setItem(key, raw);
      const page = await soloPage(t, {
        search: '?edition=sample-public',
        titleScreen: true,
        storage,
        journeyIndexedDB: managedIndexedDB().indexedDB,
        fetchResponse: f.fetcher,
      });
      const run = page.rendered.run;
      page.$('shell-continue').click();
      await settle(
        () =>
          /earlier artwork|artwork receipt/i.test(page.$('shell-flight-status').textContent) &&
          page.$('shell-flight-cancel').hidden,
      );
      assert.equal(page.rendered.run, run);
      assert.equal(storage.getItem(key), raw);
      assert.equal(page.$('shell-home').open, true);
    });
});

test('edition pause keeps canonical Skip confirmation and Watch first cut actions reachable', async (t) => {
  const f = await editionProviderFixture();
  const second = {
    ...structuredClone(f.source.missions[0]),
    id: 'farther-shore',
    name: 'Farther shore',
  };
  f.source.missions.push(second);
  f.source.campaigns[0].missionIds.push(second.id);
  const project = compileContentProject(f.source);
  f.data.campaign.levels.push(resolveMission(project, second.id).level);
  const page = await soloPage(t, {
    search: '?edition=sample-public',
    titleScreen: true,
    journeyIndexedDB: managedIndexedDB().indexedDB,
    fetchResponse: f.fetcher,
  });
  const actions = page.$('game-overlay').querySelector('.overlay-actions');
  assert.equal(page.$('journey-skip').parentElement, actions);
  assert.equal(page.$('demo-button').parentElement, actions);
  page.$('shell-featured').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.frame(0);
  const first = page.rendered.run;
  page.$('pause-button').click();
  assert.equal(page.$('game-overlay').hidden, false);
  assert.equal(page.$('journey-skip').hidden, false);
  page.$('journey-skip').click();
  assert.match(page.$('journey-skip').textContent, /Confirm skip/i);
  assert.equal(page.rendered.run, first, 'The first activation only asks for confirmation.');
  page.$('journey-skip').click();
  await settle(() => {
    page.frame(0);
    return page.rendered.run.levelId === second.id;
  });
  page.$('pause-button').click();
  assert.equal(page.$('game-overlay').hidden, false);
  assert.equal(page.$('demo-button').hidden, false);
  page.$('demo-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.frame(0);
  assert.equal(page.rendered.run.levelId, f.project.missions[0].id);
  assert.match(page.$('run-message').textContent, /Demonstration.*no.*(award|reward)/i);
  assert.deepEqual(page.errors, []);
});

test('edition First Flight uses shared course rules and returns to its own company', async (t) => {
  const f = await editionProviderFixture();
  const page = await soloPage(t, {
    search: '?edition=sample-public&course=first-flight&lesson=close-line',
    titleScreen: true,
    fetchResponse: f.fetcher,
  });
  assert.equal(page.rendered.run.levelId, 'first-flight-close-line');
  const destinations = [];
  page.win.location.assign = (href) => destinations.push(href);
  page.$('first-flight-exit').click();
  assert.equal(new URL(destinations[0]).searchParams.get('edition'), 'sample-public');
  assert.equal(new URL(destinations[0]).searchParams.has('course'), false);
  assert.deepEqual(page.errors, []);
});

test('edition controller practice reconstructs only its selected mission without shared Playground storage', async (t) => {
  const f = await editionProviderFixture();
  const page = await soloPage(t, {
    search: `?edition=sample-public&practice=1&edition-mission=${f.project.missions[0].id}&difficulty=expert&turn-policy=grid-center&class=scout`,
    fetchResponse: f.fetcher,
  });
  const expected = createRun(
    applyGameplayTuning(
      resolveMission(f.project, f.project.missions[0].id, { difficulty: 'expert' }).level,
      resolveGameplayTuning('expert'),
    ),
    { turnPolicy: 'grid-center' },
  );
  assert.equal(companySimulationIdentity(page.rendered.run), companySimulationIdentity(expected));
  assert.deepEqual(page.errors, []);
});

// The actual entry, provider, canonical catalogue and first attempt for every
// declared audience. Only browser DOM/canvas/PNG decoding are modeled.
test('every declared edition boots and starts through the canonical Solo host', async (t) => {
  const catalog = JSON.parse(
    await readFile(new URL('../editions/catalog.json', import.meta.url), 'utf8'),
  );
  const bytes = new Map();
  const fetchResponse = async (value) => {
    const request = new URL(String(value), 'http://localhost/game/');
    const pathname =
      request.protocol === 'file:'
        ? request.pathname.slice(new URL('../../', import.meta.url).pathname.length)
        : request.pathname.slice(1);
    if (!/^game\/(?:editions\/|content\/company-)/.test(pathname)) return undefined;
    if (!bytes.has(pathname))
      bytes.set(pathname, await readFile(new URL(`../../${pathname}`, import.meta.url)));
    return new Response(bytes.get(pathname));
  };
  for (const edition of catalog.editions)
    await t.test(edition.id, async (t) => {
      const page = await soloPage(t, {
        search: `?edition=${edition.id}`,
        titleScreen: true,
        journeyIndexedDB: managedIndexedDB().indexedDB,
        pictures: { Image: PNGImage },
        fetchResponse,
      });
      assert.equal(page.doc.body.dataset.editionId, edition.id);
      page.$('shell-worlds').click();
      await settle(() => page.$('journey-chooser')?.open === true);
      const count = catalog.campaigns
        .filter((campaign) => edition.campaignIds.includes(campaign.id))
        .reduce(
          (total, campaign) =>
            total + JSON.parse(bytes.get(campaign.sourcePath).toString()).missions.length,
          0,
        );
      assert.equal(page.$('journey-cards').children.length, count);
      assert.deepEqual(
        [...page.$('journey-mode').options].map((option) => option.value),
        ['solo'],
      );
      page.$('journey-chooser').close();
      page.$('shell-featured').click();
      await settle(() => page.doc.body.dataset.flightState === 'running');
      page.frame(0);
      assert.equal(page.rendered.actorAppearance.style, 'campaign');
      assert.equal(page.rendered.run.status, 'running');
      assert.deepEqual(page.errors, []);
    });
});

test('same-origin installed creator campaign cannot inject missions into a selected edition', async (t) => {
  const { generateCreatorProject } = await import('../creator/templates.mjs');
  const { prepareCreatorBundle, approveCreatorBundle } = await import('../creator/bundle.mjs');
  const {
    createCreatorStore,
    reviewCreatorInstallation,
    installPreparedCreatorBundle,
    installedCreatorManifests,
  } = await import('../creator/installed.mjs');
  const { creatorSHA256 } = await import('../creator/bytes.mjs');
  const { pngBytes } = await import('./helpers/media-fixtures.mjs');
  const media = managedIndexedDB(),
    store = createCreatorStore({ indexedDB: media.indexedDB });
  const generated = generateCreatorProject({
    id: 'unrelated-installed',
    name: 'Unrelated creator campaign',
    seed: 8,
  });
  const project = structuredClone(generated.project),
    blob = new Blob([pngBytes()], { type: 'image/png' }),
    sha256 = await creatorSHA256(await blob.arrayBuffer());
  project.assets = [
    {
      format: 'AssetRevisionV1',
      id: 'picture',
      revision: '1',
      kind: 'reveal-background',
      path: `content-design/assets/creator/${sha256}.png`,
      sha256,
      bytes: blob.size,
      width: 1,
      height: 1,
      alt: 'Fixture',
      review: 'candidate',
    },
  ];
  project.missions[0].presentation.backgroundAssetId = 'picture';
  const themes = JSON.parse(
    await readFile(new URL('../content-design/themes.json', import.meta.url), 'utf8'),
  ).themes;
  const decodeImage = async () => ({ naturalWidth: 1, naturalHeight: 1 });
  const pack = await prepareCreatorBundle(
    {
      project,
      packId: 'collection',
      themes,
      provenance: generated.provenance,
      credits: { creator: 'Fixture', picture: 'Fixture', license: 'Fixture permission' },
    },
    [{ sha256, blob }],
    { decodeImage },
  );
  const approval = approveCreatorBundle(pack),
    review = await reviewCreatorInstallation(store, pack, approval);
  await installPreparedCreatorBundle(store, pack, approval, review, { decodeImage });
  assert.equal((await installedCreatorManifests(store)).length, 1);
  store.close();
  const f = await editionProviderFixture(),
    page = await soloPage(t, {
      search: '?edition=sample-public',
      titleScreen: true,
      soundtrackIndexedDB: media.indexedDB,
      journeyIndexedDB: managedIndexedDB().indexedDB,
      fetchResponse: f.fetcher,
    });
  page.$('shell-worlds').click();
  await settle(() => page.$('journey-chooser').open);
  assert.deepEqual(
    [...page.$('journey-collection').options].map((option) => option.value),
    ['', 'Journey'],
  );
  assert.ok(!page.$('journey-cards').textContent.includes('Unrelated creator campaign'));
  assert.deepEqual(page.errors, []);
});
