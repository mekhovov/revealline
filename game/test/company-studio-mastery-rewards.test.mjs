import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCompanyWorkspaceFiles,
  companySourceDraft,
  companyDraftFiles,
} from '../../scripts/company-studio.mjs';
import {
  createStudioReward,
  previewStudioReward,
} from '../../authoring/company-studio/reward-editor.mjs';
import { validateStudioDraft, validateStudioData } from '../../authoring/company-studio/model.mjs';
import { editContentDiscovery } from '../content-design/discovery.mjs';
import { editDiscoveryMastery } from '../content-design/discovery-mastery.mjs';
import { createMasteryRewardEditor } from '../studio/mastery-reward-editor.mjs';
import { createRewardMissionBindings } from '../rewards/bindings.mjs';
import { JOURNEY_NO_LOSS_MASTERY } from '../mastery-journey.mjs';
import { compileEdition } from '../../scripts/compile-edition.mjs';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { Document } from './helpers/couch-dom.mjs';

const locales = {
  en: {
    title: 'Optional gallery',
    teaser: 'Win without a life lost.',
    paragraph: 'A fictional optional goal.',
  },
  uk: {
    title: 'Додаткова галерея',
    teaser: 'Переможіть без втрати життя.',
    paragraph: 'Вигадана додаткова ціль.',
  },
};
function fixture() {
  const workspace = createCompanyWorkspaceFiles({
    brandId: 'museum',
    editionId: 'museum-public',
    name: 'Museum',
  });
  workspace.catalog = structuredClone(workspace.catalog);
  const campaign = workspace.catalog.campaigns[0];
  campaign.rewardPath = campaign.sourcePath.replace(/\.json$/, '.rewards.json');
  const source = JSON.parse(workspace.files.get(campaign.sourcePath));
  const reward = createStudioReward({
    campaign,
    source,
    rule: 'all-missions',
    id: 'museum-optional',
    locales,
  });
  return { workspace, campaign, source, reward };
}

test('explicit mastery edits revise only the promise, preserve gameplay and round trip through Company Studio', () => {
  const f = fixture(),
    missionId = f.source.missions[0].id;
  const bound = editContentDiscovery(
    f.source,
    missionId,
    {
      campaignId: f.campaign.id,
      pacingBeat: 'discover',
      rewardRef: null,
      discovery: {
        exhibitLayout: 'gallery',
        finaleRewardRef: { id: f.reward.id, revision: f.reward.revision },
      },
    },
    [f.reward],
  );
  const before = JSON.stringify({ source: bound, reward: f.reward });
  const candidate = editDiscoveryMastery(bound, [f.reward], f.reward.id, [missionId]);
  const updated = candidate.rewards[0];
  assert.deepEqual(updated.requirements.mastery, [
    { id: JOURNEY_NO_LOSS_MASTERY.id, revision: '1', missionId },
  ]);
  assert.notEqual(updated.revision, f.reward.revision);
  assert.deepEqual(candidate.source.campaigns[0].discovery.finaleRewardRef, {
    id: updated.id,
    revision: updated.revision,
  });
  assert.deepEqual(
    createRewardMissionBindings(candidate.source),
    createRewardMissionBindings(bound),
  );
  assert.deepEqual(updated.payloads, f.reward.payloads);
  assert.deepEqual(updated.requirements.missions, f.reward.requirements.missions);
  assert.equal(JSON.stringify({ source: bound, reward: f.reward }), before);
  f.workspace.files.set(f.campaign.sourcePath, Buffer.from(JSON.stringify(candidate.source)));
  f.workspace.files.set(f.campaign.rewardPath, Buffer.from(JSON.stringify(candidate.rewards)));
  const packet = companySourceDraft(f.workspace),
    restored = companyDraftFiles(packet),
    validated = validateStudioDraft(packet);
  assert.deepEqual(JSON.parse(restored.files.get(f.campaign.rewardPath)), candidate.rewards);
  assert.deepEqual(validated.files.get(f.campaign.rewardPath), candidate.rewards);
  assert.deepEqual(
    validateStudioData(
      f.campaign.rewardPath,
      candidate.rewards,
      f.workspace.catalog,
      validated.files,
    ),
    candidate.rewards,
  );
  const edition = f.workspace.catalog.editions[0];
  assert.equal(previewStudioReward(updated, { edition, state: 'eligible' }).eligible, true);
  assert.equal(previewStudioReward(updated, { edition, state: 'locked' }).eligible, false);
  assert.equal(
    Object.hasOwn(previewStudioReward(updated, { edition, state: 'eligible' }), 'receipt'),
    false,
  );
  for (const invalid of [['foreign'], [missionId, missionId]])
    assert.throws(
      () => editDiscoveryMastery(bound, [f.reward], f.reward.id, invalid),
      /distinct no-life-lost/,
    );
  const removed = editDiscoveryMastery(candidate.source, candidate.rewards, updated.id, []);
  assert.deepEqual(removed.rewards[0].requirements.mastery, []);
  assert.notEqual(removed.rewards[0].revision, updated.revision);
});

test('shared Level/Campaign and Company editor previews without earning, applies explicitly and rejects stale drafts', async () => {
  const f = fixture(),
    document = new Document(),
    container = document.createElement('section');
  document.body.append(container);
  let source = f.source,
    rewards = [f.reward],
    writes = 0;
  const editor = createMasteryRewardEditor({
    container,
    getSource: () => source,
    getRewards: () => rewards,
    getLocale: () => 'uk',
    apply(candidate) {
      source = candidate.source;
      rewards = candidate.rewards;
      writes++;
    },
  });
  editor.sync();
  const check = () => container.querySelector('input');
  check().checked = true;
  container.querySelector('[data-mastery-action="preview"]').onclick();
  assert.equal(writes, 0);
  assert.deepEqual(rewards[0].requirements.mastery, []);
  await container.querySelector('[data-mastery-action="apply"]').onclick();
  assert.equal(writes, 1);
  assert.equal(rewards[0].requirements.mastery[0].missionId, source.missions[0].id);
  assert.equal(check().checked, true);
  source = { ...source, revision: 'concurrent-author-change' };
  await container.querySelector('[data-mastery-action="apply"]').onclick();
  assert.equal(writes, 1);
  assert.match(container.textContent, /draft changed/);
  editor.sync();
  const staleAction = container.querySelector('[data-mastery-action="apply"]').onclick;
  editor.dispose();
  await staleAction();
  assert.equal(writes, 1);
  assert.equal(container.children.length, 0);
});

test('the player compiler admits only the supported exact optional predicate and preserves its selected closure', async () => {
  const f = await editionProviderFixture(),
    catalog = structuredClone(f.catalog),
    campaign = catalog.campaigns[0],
    edition = catalog.editions[0];
  campaign.rewardPath = campaign.sourcePath.replace(/\.json$/, '.rewards.json');
  const missionId = f.source.missions[0].id;
  const reward = createStudioReward({
    campaign,
    source: f.source,
    rule: 'all-missions',
    masteryMissionIds: [missionId],
    id: 'sample-optional',
    locales,
  });
  const files = new Map(
    [...f.files].map(([path, value]) => [path, Buffer.from(JSON.stringify(value))]),
  );
  files.set(campaign.rewardPath, Buffer.from(JSON.stringify([reward])));
  files.set(
    'game/company.html',
    Buffer.from('<!doctype html><html><head><title>Fixture</title></head><body></body></html>'),
  );
  const compile = (content = reward) =>
    compileEdition({
      catalog,
      editionIds: [edition.id],
      files: new Map([...files, [campaign.rewardPath, Buffer.from(JSON.stringify([content]))]]),
      enginePaths: ['game/company.html'],
    });
  const built = await compile();
  assert.equal(built.runtimeCatalog.editions.length, 1);
  for (const patch of [{ id: 'unknown' }, { revision: '2' }, { missionId: 'omitted-mission' }]) {
    const altered = structuredClone(reward);
    Object.assign(altered.requirements.mastery[0], patch);
    await assert.rejects(
      compile(altered),
      /Unsupported exact Journey mastery|declared required mission/,
    );
  }
  const plain = createStudioReward({
    campaign,
    source: f.source,
    rule: 'all-missions',
    id: 'sample-plain',
    locales,
  });
  assert.deepEqual(plain.requirements.mastery, []);
  await compile(plain);
});
