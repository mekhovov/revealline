import test from 'node:test';
import assert from 'node:assert/strict';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import {
  createCampaignLocalization,
  campaignLocalizationSha256,
  validateCampaignLocalization,
} from '../editions/localization.mjs';
import { installEditionLocalization } from '../editions/localization-runtime.mjs';
import { loadEditionBootstrap } from '../editions/bootstrap.mjs';
import { contentText } from '../i18n/content.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { createContentExecutionCatalog } from '../content-design/execution.mjs';
import { createRun } from '../core/index.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { createRewardMissionBindings } from '../rewards/bindings.mjs';
import {
  captureEditionPresentation,
  editionPresentationSha256,
  validateRetainedPresentation,
} from '../editions/retained-presentation.mjs';
import { compileEdition, collectEditionSelectedFiles } from '../../scripts/compile-edition.mjs';
import { companySourceDraft, companyDraftFiles } from '../../scripts/company-studio.mjs';
import {
  validateStudioDraft,
  validateStudioHistory,
  declaredJSONPaths,
} from '../../authoring/company-studio/model.mjs';
import { soloPage, settle } from './helpers/solo-dom.mjs';

async function fixture() {
  const f = await editionProviderFixture();
  const catalog = structuredClone(f.catalog),
    descriptor = catalog.campaigns[0];
  const localized = createCampaignLocalization({
    source: f.source,
    campaignId: descriptor.id,
    campaignLocales: { uk: { name: 'Подорож відкриттів' } },
    missionLocales: Object.fromEntries(
      f.source.missions.map((mission) => [
        mission.id,
        {
          uk: {
            name: 'Перша знахідка',
            brief: 'З’єднайте острови й відкрийте картину.',
            routeDecision: 'Оберіть коротке або широке захоплення.',
          },
        },
      ]),
    ),
  });
  descriptor.localizationPath = 'game/content/sample/localization.json';
  descriptor.localizationSha256 = await campaignLocalizationSha256(localized);
  f.files.set('game/editions/catalog.json', catalog);
  f.files.set('edition-catalog.json', catalog);
  f.files.set(descriptor.localizationPath, localized);
  const load = () =>
    loadEditionBootstrap({
      editionId: catalog.editions[0].id,
      catalogURL: 'http://localhost/edition-catalog.json',
      contentBaseURL: 'http://localhost/',
      fetcher: f.fetcher,
    });
  const bytes = new Map(
    [...f.files].map(([name, data]) => [name, Buffer.from(JSON.stringify(data))]),
  );
  bytes.set(
    'game/company.html',
    Buffer.from('<!doctype html><html><head></head><body>Game</body></html>'),
  );
  return { ...f, catalog, descriptor, localized, load, bytes };
}

test('selected localization pins exact English records and rejects foreign, stale and tampered text', async () => {
  const f = await fixture();
  const sourceBefore = JSON.stringify(f.source),
    gameplayBefore = createRewardMissionBindings(f.source);
  const boot = await f.load();
  assert.deepEqual(boot.localizations[f.descriptor.id], f.localized);
  assert.equal(JSON.stringify(f.source), sourceBefore);
  assert.deepEqual(createRewardMissionBindings(boot.sources[0]), gameplayBefore);
  for (const mutate of [
    (data) => {
      data.records[0].id = 'foreign';
    },
    (data) => {
      data.records[1].fields.name.en = 'different source';
    },
    (data) => {
      data.records[1].identity = '1234567890123456';
    },
    (data) => {
      data.records[1].fields.script = { en: 'x', uk: 'y' };
    },
  ]) {
    const altered = structuredClone(f.localized);
    mutate(altered);
    assert.throws(() => validateCampaignLocalization(altered, f.source, f.descriptor));
  }
  const changed = structuredClone(f.localized);
  changed.records[0].fields.name.uk = 'Змінена обіцянка';
  f.files.set(f.descriptor.localizationPath, changed);
  await assert.rejects(f.load(), /SHA-256/);
});

test('scoped contentText translates authoring, Journey, runtime and exact custom pressure records without changing gameplay', async (t) => {
  const locale = getLocale();
  t.after(() => setLocale(locale, { persist: false }));
  const f = await fixture(),
    boot = await f.load();
  const catalog = createContentExecutionCatalog(boot.source, { mode: 'solo' });
  const entry = catalog.entries.find((item) => item.difficulty === 'expert');
  const level = entry.manifests[0].level;
  setLocale('uk', { persist: false });
  assert.equal(contentText(level, 'name'), level.name);
  const before = JSON.stringify(catalog.entries),
    binding = createRewardMissionBindings(boot.source);
  const localization = installEditionLocalization(boot);
  try {
    assert.equal(contentText(level, 'name'), 'Перша знахідка');
    assert.equal(contentText(catalog.journey().missions[0], 'campaignTitle'), 'Подорож відкриттів');
    assert.equal(
      contentText(entry.manifests[0], 'design.routeDecision'),
      'Оберіть коротке або широке захоплення.',
    );
    assert.equal(localization.briefFor(level), 'З’єднайте острови й відкрийте картину.');
    const run = createRun(
      applyGameplayTuning(level, resolveGameplayTuning('expert', { playerSpeed: 1.2 })),
    );
    const runBefore = JSON.stringify(run.level);
    assert.equal(contentText(run.level, 'name'), 'Перша знахідка');
    const fake = structuredClone(run.level);
    fake.goal.coverage = 0.9;
    assert.equal(
      contentText(fake, 'name'),
      fake.name,
      'A familiar revision cannot translate altered geometry/rules.',
    );
    assert.equal(JSON.stringify(run.level), runBefore);
    assert.equal(JSON.stringify(catalog.entries), before);
    assert.deepEqual(createRewardMissionBindings(boot.source), binding);
    setLocale('en', { persist: false });
    assert.equal(contentText(level, 'name'), level.name);
  } finally {
    localization.dispose();
  }
  setLocale('uk', { persist: false });
  assert.equal(
    contentText(level, 'name'),
    level.name,
    'Disposal invalidates immutable lookup caches.',
  );
});

test('compiler excludes other campaign languages and preserves exact selected sidecars through Studio and retained snapshots', async () => {
  const f = await fixture();
  const packet = companySourceDraft({ catalog: f.catalog, files: f.bytes });
  const draft = validateStudioDraft(packet);
  await validateStudioHistory(draft.catalog, draft.files);
  assert.ok(declaredJSONPaths(f.catalog).includes(f.descriptor.localizationPath));
  assert.deepEqual(
    JSON.parse(companyDraftFiles(packet).files.get(f.descriptor.localizationPath)),
    f.localized,
  );
  const boot = await f.load(),
    snapshot = await captureEditionPresentation(boot);
  assert.deepEqual(
    (await validateRetainedPresentation(snapshot, { edition: f.catalog.editions[0] })).bootstrap
      .localizations,
    boot.localizations,
  );
  const legacy = structuredClone(boot);
  delete legacy.localizations;
  assert.notEqual(await editionPresentationSha256(legacy), await editionPresentationSha256(boot));
  f.catalog.campaigns.push({
    ...f.descriptor,
    id: 'excluded-campaign',
    sourcePath: 'game/content/excluded/project.json',
    localizationPath: 'game/content/excluded/translations.json',
  });
  f.bytes.set(
    'game/content/excluded/translations.json',
    Buffer.from('PRIVATE_TRANSLATION_SENTINEL'),
  );
  const selected = await collectEditionSelectedFiles({
    catalog: f.catalog,
    editionIds: [f.catalog.editions[0].id],
    read: async (name) => f.bytes.get(name),
  });
  assert.equal(selected.has('game/content/excluded/translations.json'), false);
  const build = () =>
    compileEdition({
      catalog: f.catalog,
      editionIds: [f.catalog.editions[0].id],
      files: f.bytes,
      enginePaths: ['game/company.html'],
    });
  const first = await build(),
    second = await build();
  assert.equal(first.files.has(f.descriptor.localizationPath), true);
  assert.equal(first.files.has('game/content/excluded/translations.json'), false);
  assert.deepEqual(first.files, second.files);
  for (const bytes of first.files.values())
    assert.equal(bytes.includes('PRIVATE_TRANSLATION_SENTINEL'), false);
  f.bytes.set(
    f.descriptor.localizationPath,
    Buffer.from(JSON.stringify({ ...f.localized, revision: 'forged' })),
  );
  await assert.rejects(build(), /SHA-256/);
});

test('actual edition launch switches names and ready briefs between Ukrainian and English with unchanged run bytes', async (t) => {
  const originalLocale = getLocale();
  t.after(() => setLocale(originalLocale, { persist: false }));
  const f = await fixture();
  setLocale('en', { persist: false });
  const page = await soloPage(t, {
    search: '?edition=sample-public',
    titleScreen: true,
    fetchResponse: f.fetcher,
  });
  page.$('shell-featured').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  const before = JSON.stringify(page.rendered.run.level);
  setLocale('uk', { persist: false });
  assert.match(page.$('mission-brief-title').textContent, /Перша знахідка/);
  assert.match(page.$('mission-brief-copy').textContent, /З’єднайте острови/);
  assert.equal(JSON.stringify(page.rendered.run.level), before);
  setLocale('en', { persist: false });
  assert.match(page.$('mission-brief-title').textContent, new RegExp(f.source.missions[0].name));
  assert.equal(JSON.stringify(page.rendered.run.level), before);
});
