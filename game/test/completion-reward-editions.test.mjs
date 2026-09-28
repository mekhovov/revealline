import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { createRewardMissionBindings } from '../rewards/bindings.mjs';
import { loadEditionBootstrap } from '../editions/bootstrap.mjs';
import {
  validateEditionCampaignProject,
  validateEditionRewardBundle,
} from '../editions/project.mjs';
import {
  captureEditionPresentation,
  editionPresentationSha256,
  validateRetainedPresentation,
} from '../editions/retained-presentation.mjs';
import { validateCampaignDescriptor } from '../editions/model.mjs';
import { collectEditionSelectedFiles, compileEdition } from '../../scripts/compile-edition.mjs';
import { createCandidateSoloHost } from '../content-design/solo-host.mjs';
import { resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { dataIdentity } from '../data-json.mjs';
import { COMPANY_LESSONS } from '../company-campaigns/lessons.mjs';
import { completionLearningReference } from '../rewards/learning.mjs';
import {
  companySourceDraft,
  companyDraftFiles,
  companyStudioReport,
} from '../../scripts/company-studio.mjs';
import {
  validateStudioDraft,
  validateStudioData,
  validateStudioReport,
  declaredJSONPaths,
} from '../../authoring/company-studio/model.mjs';

const bytes = (value) => Buffer.from(JSON.stringify(value));
const digest = (value) => createHash('sha256').update(value).digest('hex');

test('Company Studio exports, imports and reports selected rewards through the same admission boundary', async () => {
  const f = await fixture();
  const packet = companySourceDraft(f);
  assert.ok(declaredJSONPaths(f.catalog).includes(f.descriptor.rewardPath));
  const studio = validateStudioDraft(packet),
    restored = companyDraftFiles(packet);
  assert.deepEqual(studio.files.get(f.descriptor.rewardPath), [f.reward]);
  assert.deepEqual(JSON.parse(restored.files.get(f.descriptor.rewardPath)), [f.reward]);
  const result = await compileEdition({
    catalog: f.catalog,
    editionIds: [f.edition.id],
    files: f.files,
    enginePaths: ['game/company.html'],
  });
  assert.equal(validateStudioReport(companyStudioReport(f.catalog, result)).summary.rewards, 1);
  const altered = structuredClone(f.reward);
  altered.requirements.missions[0].bindings[0].gameplayId = 'forged';
  assert.throws(
    () => validateStudioData(f.descriptor.rewardPath, [altered], f.catalog, studio.files),
    /gameplay binding/,
  );
  const changedPacket = structuredClone(packet);
  changedPacket.files.find((item) => item.path === f.descriptor.rewardPath).data = [altered];
  assert.throws(() => companyDraftFiles(changedPacket), /gameplay binding/);
  assert.throws(
    () =>
      validateStudioDraft({
        ...packet,
        files: packet.files.filter((item) => item.path !== f.descriptor.rewardPath),
      }),
    /every declared JSON/,
  );
});

async function fixture() {
  const f = await editionProviderFixture();
  const catalog = structuredClone(f.catalog),
    descriptor = catalog.campaigns[0],
    edition = catalog.editions[0];
  descriptor.rewardPath = 'game/content/sample/rewards.json';
  const media = Buffer.from('approved reward image');
  const asset = {
    id: 'sample-reward-art',
    path: 'game/editions/assets/reward.png',
    sha256: digest(media),
    bytes: media.length,
    publication: 'public',
    approved: true,
    dependencies: [],
  };
  descriptor.assetIds.push(asset.id);
  catalog.assets.push(asset);
  const mission = createRewardMissionBindings(f.source)[0];
  const reward = {
    format: 'revealline-completion-reward.v1',
    id: 'sample-first-discovery',
    revision: '1',
    brandId: descriptor.brandId,
    campaignId: descriptor.id,
    scope: { kind: 'mission', id: mission.levelId },
    locales: {
      en: { title: 'A discovery', teaser: 'Finish the first connection.' },
      uk: { title: 'Відкриття', teaser: 'Завершіть перше з’єднання.' },
    },
    requirements: {
      missions: [{ missionId: mission.levelId, bindings: mission.bindings }],
      learning: [],
      mastery: [],
    },
    payloads: [
      {
        id: 'picture',
        type: 'image',
        asset: { assetId: asset.id, sha256: asset.sha256 },
        locales: {
          en: { title: 'Discovery', alt: 'An illustrated discovery.' },
          uk: { title: 'Відкриття', alt: 'Ілюстроване відкриття.' },
        },
      },
    ],
  };
  const files = new Map(
    [...f.files]
      .filter(([name]) => !name.endsWith('catalog.json'))
      .map(([name, value]) => [name, bytes(value)]),
  );
  files.set(descriptor.rewardPath, bytes([reward]));
  files.set(asset.path, media);
  files.set(
    'game/company.html',
    Buffer.from('<!doctype html><html><head></head><body>Game</body></html>'),
  );
  const requests = [];
  const load = (activeCatalog = catalog) =>
    loadEditionBootstrap({
      editionId: edition.id,
      catalogURL: 'https://reward.test/catalog.json',
      contentBaseURL: 'https://reward.test/',
      fetcher: async (url) => {
        const name = new URL(url).pathname.slice(1);
        requests.push(name);
        const data = name === 'catalog.json' ? bytes(activeCatalog) : files.get(name);
        return new Response(data ?? null, { status: data ? 200 : 404 });
      },
    });
  return { ...f, catalog, files, descriptor, edition, asset, reward, requests, load };
}

test('learning reward requirements compile, bootstrap and round trip only with their exact selected lesson sidecar', async () => {
  const f = await fixture();
  const lesson = {
    ...structuredClone(COMPANY_LESSONS[0]),
    campaignId: f.descriptor.id,
    missionId: f.source.missions[0].id,
  };
  f.descriptor.lessonPath = 'game/content/sample/lessons.json';
  f.reward.requirements.learning = [completionLearningReference(lesson)];
  f.files.set(f.descriptor.lessonPath, bytes([lesson]));
  f.files.set(f.descriptor.rewardPath, bytes([f.reward]));
  const bootstrap = await f.load();
  assert.deepEqual(
    bootstrap.rewards[f.descriptor.id][0].requirements.learning,
    f.reward.requirements.learning,
  );
  const packet = companySourceDraft(f),
    roundTrip = companyDraftFiles(packet);
  assert.deepEqual(JSON.parse(roundTrip.files.get(f.descriptor.lessonPath)), [lesson]);
  assert.deepEqual(JSON.parse(roundTrip.files.get(f.descriptor.rewardPath)), [f.reward]);
  const compile = (files = f.files) =>
    compileEdition({
      catalog: f.catalog,
      editionIds: [f.edition.id],
      files,
      enginePaths: ['game/company.html'],
    });
  const output = await compile();
  assert(output.files.has(f.descriptor.lessonPath));
  const historical = await captureEditionPresentation(bootstrap);
  const changed = new Map(f.files);
  changed.set(f.descriptor.lessonPath, bytes([{ ...lesson, fixtureRevision: 'new-fixture' }]));
  await assert.rejects(compile(changed), /exact selected lesson/);
  const missing = new Map(f.files);
  missing.set(f.descriptor.lessonPath, bytes([]));
  await assert.rejects(compile(missing), /exact selected lesson/);
  const restored = await validateRetainedPresentation(historical, { edition: f.edition });
  assert.deepEqual(
    restored.bootstrap.rewards[f.descriptor.id][0].requirements.learning,
    f.reward.requirements.learning,
  );
  for (const field of ['lessonId', 'lessonRevision', 'fixtureRevision', 'lessonIdentity']) {
    const bad = structuredClone(f.reward);
    bad.requirements.learning[0][field] =
      field === 'lessonIdentity' ? '0123456789abcdef' : 'foreign';
    assert.throws(
      () =>
        validateStudioData(
          f.descriptor.rewardPath,
          [bad],
          f.catalog,
          new Map([
            [f.descriptor.sourcePath, f.source],
            [f.descriptor.lessonPath, [lesson]],
          ]),
        ),
      /exact selected lesson/,
    );
  }
  const mastery = structuredClone(f.reward);
  mastery.requirements.mastery = [{ id: 'seal', revision: '1', missionId: lesson.missionId }];
  assert.throws(
    () =>
      validateEditionRewardBundle([mastery], f.source, {
        descriptor: f.descriptor,
        assets: f.catalog.assets,
        lessons: [lesson],
      }),
    /mastery requires a registered/,
  );
});

test('reward bindings use the canonical candidate host and its single pressure application', async () => {
  const f = await fixture();
  const host = createCandidateSoloHost(f.source, {
    themes: f.data.themes.themes,
    corePackIds: f.source.packs.map((pack) => pack.id),
  });
  const binding = createRewardMissionBindings(f.source)[0];
  for (const pinned of binding.bindings) {
    const prepared = await host.preparer.prepare(
      {
        missionId: binding.journeyMissionIds[0],
        difficulty: pinned.difficulty,
        seed: 7,
        turnPolicy: 'immediate',
      },
      { gameplayTuning: resolveGameplayTuning(pinned.difficulty) },
    );
    const run = prepared.run;
    assert.equal(
      pinned.gameplayId,
      dataIdentity({ ruleset: run.ruleset, level: run.level, classes: run.classRecipes }),
    );
    assert.equal(host.catalog.find(binding.journeyMissionIds[0]).levelId, binding.levelId);
  }
  host.preparer.dispose();
});

test('bootstrap and reproducible compiler collect only selected reward sidecars and media', async () => {
  const f = await fixture();
  const omitted = {
    ...f.descriptor,
    id: 'omitted-campaign',
    sourcePath: 'game/content/omitted/project.json',
    rewardPath: 'game/content/omitted/rewards.json',
    assetIds: ['omitted-art'],
  };
  f.catalog.campaigns.push(omitted);
  f.catalog.editions.push({
    ...f.edition,
    id: 'omitted-edition',
    campaignIds: [omitted.id],
    entryCampaignId: omitted.id,
  });
  f.catalog.assets.push({
    ...f.asset,
    id: 'omitted-art',
    path: 'game/editions/assets/omitted.png',
  });
  f.files.set(omitted.rewardPath, bytes({ privateSentinel: 'DO-NOT-PUBLISH' }));
  const bootstrap = await f.load();
  assert.deepEqual(bootstrap.rewards[f.descriptor.id], [f.reward]);
  assert.ok(!f.requests.some((name) => name.includes('omitted')));
  const requested = [];
  const selected = await collectEditionSelectedFiles({
    catalog: f.catalog,
    editionIds: [f.edition.id],
    read: async (name) => {
      requested.push(name);
      return f.files.get(name);
    },
  });
  assert.ok(selected.has(f.descriptor.rewardPath));
  assert.ok(selected.has(f.asset.path));
  assert.ok(!requested.some((name) => name.includes('omitted')));
  const compile = () =>
    compileEdition({
      catalog: f.catalog,
      editionIds: [f.edition.id],
      files: f.files,
      enginePaths: ['game/company.html'],
    });
  const first = await compile(),
    second = await compile();
  assert.deepEqual(first.manifest, second.manifest);
  assert.deepEqual([...first.files], [...second.files]);
  assert.ok(first.files.has(f.descriptor.rewardPath));
  assert.ok(first.files.has(f.asset.path));
  assert.ok(![...first.files.values()].some((value) => value.includes('DO-NOT-PUBLISH')));
});

test('selected reward admission rejects altered gameplay, foreign scopes, wrong assets and unsupported viewers', async () => {
  const f = await fixture();
  const project = validateEditionCampaignProject(f.source, f.descriptor);
  const validate = (reward) =>
    validateEditionRewardBundle([reward], project, {
      descriptor: f.descriptor,
      assets: f.catalog.assets,
      editionId: f.edition.id,
    });
  for (const [mutate, expected] of [
    [
      (r) => {
        r.brandId = 'foreign';
      },
      /another campaign or brand/,
    ],
    [
      (r) => {
        r.requirements.missions[0].bindings[0].gameplayId = 'forged';
      },
      /gameplay binding/,
    ],
    [
      (r) => {
        r.scope = { kind: 'edition', id: 'foreign-edition' };
      },
      /outside the selected/,
    ],
    [
      (r) => {
        r.payloads[0].asset.sha256 = '0'.repeat(64);
      },
      /approved asset closure/,
    ],
    [
      (r) => {
        r.payloads[0] = {
          type: 'cosmetic',
          id: 'look',
          recipeId: 'anything',
          recipeRevision: '1',
          locales: { en: { title: 'Look' }, uk: { title: 'Вигляд' } },
        };
      },
      /registered player viewer/,
    ],
  ]) {
    const altered = structuredClone(f.reward);
    mutate(altered);
    assert.throws(() => validate(altered), expected);
    f.files.set(f.descriptor.rewardPath, bytes([altered]));
    await assert.rejects(f.load(), expected);
    await assert.rejects(
      compileEdition({
        catalog: f.catalog,
        editionIds: [f.edition.id],
        files: f.files,
        enginePaths: ['game/company.html'],
      }),
      expected,
    );
  }
  assert.throws(
    () => validateCampaignDescriptor({ ...f.descriptor, rewardPath: '../rewards.json' }),
    /bounded JSON/,
  );
  f.catalog.assets[0].path = 'game/editions/assets/reward.svg';
  assert.throws(() => validate(f.reward), /supported raster/);
});

test('reward revisions are pinned by retained presentation, while absent sidecars preserve legacy identities', async () => {
  const f = await fixture();
  const before = await f.load(),
    firstHash = await editionPresentationSha256(before);
  const snapshot = await captureEditionPresentation(before);
  assert.ok(snapshot.files.some((item) => item.path === f.descriptor.rewardPath));
  const retained = await validateRetainedPresentation(snapshot, { edition: f.edition });
  assert.deepEqual(retained.bootstrap.rewards, before.rewards);
  const altered = structuredClone(f.reward);
  altered.locales.en.teaser = 'A changed promise.';
  f.files.set(f.descriptor.rewardPath, bytes([altered]));
  assert.notEqual(await editionPresentationSha256(await f.load()), firstHash);
  const tampered = structuredClone(snapshot);
  tampered.files.find((item) => item.path === f.descriptor.rewardPath).data[0] = altered;
  await assert.rejects(
    validateRetainedPresentation(tampered, { edition: f.edition }),
    /receipt differs/,
  );
  delete f.descriptor.rewardPath;
  const legacy = await f.load();
  assert.equal(Object.hasOwn(legacy, 'rewards'), false);
  assert.equal(
    (await captureEditionPresentation(legacy)).files.some((item) =>
      item.path.includes('rewards.json'),
    ),
    false,
  );
  const withoutRewards = { ...legacy };
  delete withoutRewards.rewards;
  assert.equal(
    await editionPresentationSha256(legacy),
    await editionPresentationSha256(withoutRewards),
  );
});

test('an edition finale may require other selected campaigns, but a campaign finale cannot widen its scope', async () => {
  const f = await fixture();
  const secondSource = structuredClone(f.source);
  secondSource.id = 'second-source';
  secondSource.missions[0].id = 'second-mission';
  secondSource.campaigns[0].id = 'second-campaign';
  secondSource.campaigns[0].missionIds = ['second-mission'];
  secondSource.packs[0].id = 'second-pack';
  secondSource.packs[0].campaignIds = ['second-campaign'];
  const secondDescriptor = {
    ...f.descriptor,
    id: 'second-campaign',
    sourcePath: 'game/content/sample/second.json',
    assetIds: [],
  };
  delete secondDescriptor.rewardPath;
  f.catalog.campaigns.push(secondDescriptor);
  // Different descriptor order catches accidental index-based source matching.
  f.edition.campaignIds.unshift(secondDescriptor.id);
  f.files.set(secondDescriptor.sourcePath, bytes(secondSource));
  const second = createRewardMissionBindings(secondSource)[0];
  const finale = {
    ...f.reward,
    scope: { kind: 'edition', id: f.edition.id },
    requirements: {
      ...f.reward.requirements,
      missions: [
        ...f.reward.requirements.missions,
        { missionId: second.missionId, bindings: second.bindings },
      ],
    },
  };
  f.files.set(f.descriptor.rewardPath, bytes([finale]));
  const boot = await f.load();
  assert.equal(boot.rewards[f.descriptor.id][0].requirements.missions.length, 2);
  const compiled = await compileEdition({
    catalog: f.catalog,
    editionIds: [f.edition.id],
    files: f.files,
    enginePaths: ['game/company.html'],
  });
  assert.ok(compiled.files.has(f.descriptor.rewardPath));
  validateStudioDraft(companySourceDraft(f));
  f.files.set(
    f.descriptor.rewardPath,
    bytes([{ ...finale, scope: { kind: 'campaign', id: f.descriptor.id } }]),
  );
  await assert.rejects(f.load(), /omitted mission/);
  f.files.set(f.descriptor.rewardPath, bytes([finale]));
  f.edition.campaignIds = [f.descriptor.id];
  await assert.rejects(f.load(), /omitted mission/);
});
