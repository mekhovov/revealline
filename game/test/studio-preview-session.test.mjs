import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudioPreviewSession, isStudioPreview } from '../studio-preview-session.mjs';
import { loadRuntimeContentProvider } from '../runtime-content-provider.mjs';
import { companyEntryHref } from '../company-entry.mjs';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { createStudioReward } from '../../authoring/company-studio/reward-editor.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

function openEarnedResult(page) {
  const checkpoint = authoritativeCheckpoint(page.rendered.run);
  assert.equal(page.$('game-overlay').hidden, true, 'The earned picture keeps its own screen.');
  if (!page.$('skip-celebration').hidden) page.$('skip-celebration').click();
  page.frame(0);
  assert.equal(page.$('show-result').hidden, false);
  page.$('show-result').click();
  assert.equal(page.$('game-overlay').hidden, false);
  assert.equal(page.$('game-overlay').dataset.kind, 'won');
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
}

test('Studio preview storage starts fresh each visit and has no player writer lease', async () => {
  assert.equal(createStudioPreviewSession('http://localhost/game/'), null);
  assert.equal(isStudioPreview('http://localhost/game/?studio-preview=0'), false);
  const first = createStudioPreviewSession('http://localhost/game/?studio-preview=1');
  const second = createStudioPreviewSession('http://localhost/game/?studio-preview=1');
  first.storage.setItem('profile', 'preview');
  first.sessionStorage.setItem('flight', 'preview');
  await first.writeAsset('history', { local: true });
  assert.equal(second.storage.getItem('profile'), null);
  assert.equal(second.sessionStorage.getItem('flight'), null);
  assert.equal(await second.readAsset('history'), null);
  assert.equal(first.writer.writable, false);
  const options = first.journeyOptions('journey-sample-public');
  assert.equal(options.canWrite(), false);
  await assert.rejects(options.backend.read(), /storage/);
});

test('legacy launcher and edition switching keep Studio preview isolation explicit', async () => {
  const f = await editionProviderFixture();
  const href = companyEntryHref(
    'http://localhost/game/company.html?edition=sample-public&studio-preview=1',
  );
  assert.equal(isStudioPreview(href), true);
  const provider = await loadRuntimeContentProvider({
    locationRef: { href },
    documentRef: { documentElement: { dataset: {} } },
    fetcher: f.fetcher,
  });
  for (const parameters of [
    {},
    { edition: 'sample-public' },
    { 'studio-preview': null },
    { course: 'first-flight' },
  ])
    assert.equal(isStudioPreview(provider.href(parameters)), true);
});

test('actual Studio game launch, accepted win, reward reveal and Retry never open player databases or write profiles', async (t) => {
  const f = await editionProviderFixture();
  f.source.missions[0].actors = [];
  f.source.missions[0].coverage = 0.2;
  const compiled = compileContentProject(f.source);
  f.data.campaign.levels = [
    resolveMission(compiled, f.source.missions[0].id, { difficulty: 'standard' }).level,
  ];
  const catalog = structuredClone(f.catalog),
    campaign = catalog.campaigns[0];
  campaign.rewardPath = 'game/content/sample/rewards.json';
  const copy = {
    title: 'Preview discovery',
    teaser: 'A preview promise',
    paragraph: 'Fictional preview knowledge.',
  };
  const reward = createStudioReward({
    campaign,
    source: f.source,
    rule: 'mission-win',
    missionId: f.source.missions[0].id,
    id: 'preview-discovery',
    locales: { en: copy, uk: copy },
  });
  f.files.set('game/editions/catalog.json', catalog);
  f.files.set('edition-catalog.json', catalog);
  f.files.set(campaign.rewardPath, [reward]);
  const storage = memoryStorage({
    'revealline.library.company-sample-public-dev.v1': 'untouched player library',
    'revealline.suspended.journey-sample-public.v1.solo-v2': 'untouched player flight',
  });
  const before = [...storage.map];
  let databaseOpens = 0,
    locks = 0;
  const forbiddenDatabase = {
    open() {
      databaseOpens++;
      throw new Error('Preview opened player database');
    },
  };
  const page = await soloPage(t, {
    search: '?edition=sample-public&studio-preview=1',
    titleScreen: true,
    storage,
    fetchResponse: f.fetcher,
    journeyIndexedDB: forbiddenDatabase,
    assetIndexedDB: forbiddenDatabase,
    soundtrackIndexedDB: forbiddenDatabase,
    lockManager: {
      request() {
        locks++;
        throw new Error('Preview claimed player lock');
      },
    },
  });
  assert.ok(page.$('edition-studio-preview'));
  page.$('shell-featured').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.frame(0);
  page.key('ArrowDown');
  for (let tick = 0; tick < 900 && page.rendered.run.status === 'running'; tick++) page.frame();
  page.key('ArrowDown', false);
  assert.equal(
    page.rendered.run.status,
    'won',
    'The shared engine accepts the legal preview capture.',
  );
  await settle(() => {
    page.frame(0);
    return page.$('completion-reward-shelf').querySelector('article')?.dataset.earned === 'true';
  });
  openEarnedResult(page);
  assert.match(page.$('overlay-copy').textContent, /Preview mission complete/);
  assert.match(page.$('overlay-copy').textContent, /Player progress is unchanged/);
  assert.equal(page.$('completion-reward-save-status').dataset.durable, 'false');
  assert.equal(page.$('completion-reward-retry-save').hidden, true);
  assert.equal(page.$('journey-save-export').hidden, true);
  const retry = page.$('retry-button');
  retry.click();
  await settle(() => {
    page.frame(0);
    return page.rendered.run.status === 'running';
  });
  page.$('pause-button').click();
  page.$('save-attempt-button').click();
  await new Promise((resolve) => setImmediate(resolve));
  page.$('choose-mission').click();
  await settle(() => page.$('journey-chooser')?.open);
  const pin = page.$('journey-goal-pin');
  assert.equal(pin.disabled, false);
  pin.click();
  assert.equal(page.$('journey-goal-find').disabled, false);
  page.$('journey-back').click();
  assert.deepEqual([...storage.map], before);
  assert.deepEqual(storage.writes, []);
  assert.equal(databaseOpens, 0);
  assert.equal(locks, 0);
  assert.deepEqual(page.errors, []);
});

test('a normal edition win uses player-facing campaign copy instead of authored test wording', async (t) => {
  const f = await editionProviderFixture();
  f.source.missions[0].actors = [];
  f.source.missions[0].coverage = 0.2;
  const compiled = compileContentProject(f.source);
  f.data.campaign.levels = [
    resolveMission(compiled, f.source.missions[0].id, { difficulty: 'standard' }).level,
  ];
  const page = await soloPage(t, {
    search: '?edition=sample-public',
    titleScreen: true,
    storage: memoryStorage(),
    fetchResponse: f.fetcher,
  });
  page.$('shell-featured').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.frame(0);
  page.key('ArrowDown');
  for (let tick = 0; tick < 900 && page.rendered.run.status === 'running'; tick++) page.frame();
  page.key('ArrowDown', false);
  page.frame(0);
  assert.equal(page.rendered.run.status, 'won');
  openEarnedResult(page);
  assert.match(
    page.$('overlay-copy').textContent,
    /Mission complete\. Keep exploring your campaign/,
  );
  assert.doesNotMatch(page.$('overlay-copy').textContent, /authored test|Legacy|preview/i);
  assert.equal(page.$('next-button').disabled, false);
  assert.deepEqual(page.errors, []);
});
