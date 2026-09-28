import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterProject } from '../content-design/starter.mjs';
import { compileContentProject } from '../content-design/project.mjs';
import { createDraftHistory } from '../content-design/drafts.mjs';
import { editContentStructure } from '../content-design/structure.mjs';
import {
  editContentDiscovery,
  projectDiscoveryPreview,
  DISCOVERY_PACING_BEATS,
  DISCOVERY_EXHIBIT_LAYOUTS,
} from '../content-design/discovery.mjs';
import {
  validateEditionCampaignProject,
  validateEditionRewardBundle,
} from '../editions/project.mjs';
import { createRewardMissionBindings } from '../rewards/bindings.mjs';
import { createStudioReward } from '../../authoring/company-studio/reward-editor.mjs';
import {
  createCompanyWorkspaceFiles,
  companySourceDraft,
  companyDraftFiles,
} from '../../scripts/company-studio.mjs';
import { createDiscoveryEditor } from '../studio/discovery-editor.mjs';
import { Document } from './helpers/couch-dom.mjs';

const locales = {
  en: { title: 'Discovery', teaser: 'A promised exhibit', paragraph: 'A fictional example.' },
  uk: { title: 'Відкриття', teaser: 'Обіцяна виставка', paragraph: 'Вигаданий приклад.' },
};
function fixture(source = createStarterProject(), brandId = 'museum') {
  const campaign = { ...source.campaigns[0], brandId, rewardPath: 'game/content/rewards.json' };
  const rewards = ['mission-win', 'all-missions'].map((rule, index) =>
    createStudioReward({
      campaign,
      source,
      rule,
      missionId: source.missions[0].id,
      id: `discovery-${index}`,
      locales,
    }),
  );
  const ref = (index) => ({ id: rewards[index].id, revision: rewards[index].revision });
  const command = {
    campaignId: campaign.id,
    pacingBeat: 'discover',
    rewardRef: ref(0),
    discovery: { exhibitLayout: 'mosaic', finaleRewardRef: ref(1) },
  };
  return { source, campaign, rewards, command };
}

test('optional discovery fields round trip without changing gameplay bindings or historical defaults', () => {
  const f = fixture();
  const before = JSON.stringify(f.source);
  assert.equal(JSON.stringify(compileContentProject(f.source).source), before);
  const changed = editContentDiscovery(f.source, f.source.missions[0].id, f.command, f.rewards);
  assert.equal(JSON.stringify(f.source), before);
  assert.notEqual(changed.revision, f.source.revision);
  assert.equal(changed.missions[0].revision, f.source.missions[0].revision);
  assert.equal(changed.campaigns[0].revision, f.source.campaigns[0].revision);
  assert.deepEqual(createRewardMissionBindings(changed), createRewardMissionBindings(f.source));
  const history = createDraftHistory(f.source);
  history.replace(changed);
  assert.deepEqual(compileContentProject(history.export()).source, changed);
  history.undo();
  assert.deepEqual(history.current(), f.source);
  history.redo();
  assert.deepEqual(history.current(), changed);
});

test('discovery registry rejects unknown recipes, stale references and a finale bound as a mission reward', () => {
  const f = fixture();
  assert.equal(DISCOVERY_PACING_BEATS.length, 6);
  assert.deepEqual(DISCOVERY_EXHIBIT_LAYOUTS, ['route', 'gallery', 'mosaic']);
  for (const command of [
    { ...f.command, pacingBeat: 'future-engine-rule' },
    { ...f.command, rewardRef: { ...f.command.rewardRef, revision: 'future' } },
    { ...f.command, rewardRef: f.command.discovery.finaleRewardRef },
    { ...f.command, discovery: { exhibitLayout: 'unknown' } },
    { ...f.command, discovery: { ...f.command.discovery, bonusLives: 4 } },
  ])
    assert.throws(() =>
      editContentDiscovery(f.source, f.source.missions[0].id, command, f.rewards),
    );
  const changed = editContentDiscovery(f.source, f.source.missions[0].id, f.command, f.rewards);
  assert.throws(
    () => validateEditionCampaignProject(changed, { ...f.campaign, rewardPath: undefined }),
    /reference/,
  );
  assert.throws(
    () => validateEditionRewardBundle([f.rewards[1]], changed, { descriptor: f.campaign }),
    /reference/,
  );
  assert.deepEqual(
    validateEditionRewardBundle(f.rewards, changed, { descriptor: f.campaign }),
    f.rewards,
  );
});

test('exhibit preview exposes route, teaser and explicit requirements without earning or mutating anything', () => {
  const f = fixture();
  const changed = editContentDiscovery(f.source, f.source.missions[0].id, f.command, f.rewards);
  const before = JSON.stringify({ changed, rewards: f.rewards });
  const preview = projectDiscoveryPreview(changed, f.campaign.id, f.rewards, 'uk');
  assert.equal(preview.layout, 'mosaic');
  assert.equal(preview.missions[0].pacingBeat, 'discover');
  assert.equal(preview.missions[0].reward.teaser, locales.uk.teaser);
  assert.deepEqual(preview.finale.requirements, [f.source.missions[0].id]);
  assert.equal(Object.hasOwn(preview, 'receipt'), false);
  assert.equal(Object.hasOwn(preview, 'clears'), false);
  assert.equal(JSON.stringify({ changed, rewards: f.rewards }), before);
});

test('duplicated journeys retain style but cannot inherit promises scoped to old identities', () => {
  const f = fixture();
  const changed = editContentDiscovery(f.source, f.source.missions[0].id, f.command, f.rewards);
  const copy = editContentStructure(changed, {
    action: 'duplicate',
    kind: 'campaign',
    id: 'new-campaign',
    sourceId: f.campaign.id,
    name: 'New exhibit',
  });
  const campaign = copy.campaigns.find((item) => item.id === 'new-campaign');
  assert.deepEqual(campaign.discovery, { exhibitLayout: 'mosaic' });
  const mission = copy.missions.find((item) => campaign.missionIds.includes(item.id));
  assert.equal(mission.design.pacingBeat, 'discover');
  assert.equal(Object.hasOwn(mission.design, 'rewardRef'), false);
  assert.deepEqual(copy.missions[0].design.rewardRef, f.command.rewardRef);
});

test('Company Studio source packets preserve discovery design with the exact sidecar', () => {
  const workspace = createCompanyWorkspaceFiles({
    brandId: 'museum',
    editionId: 'museum-public',
    name: 'Museum',
  });
  workspace.catalog = structuredClone(workspace.catalog);
  const descriptor = workspace.catalog.campaigns[0];
  descriptor.rewardPath = descriptor.sourcePath.replace(/\.json$/, '.rewards.json');
  const source = JSON.parse(workspace.files.get(descriptor.sourcePath));
  const f = fixture(source);
  const changed = editContentDiscovery(source, source.missions[0].id, f.command, f.rewards);
  workspace.files.set(descriptor.sourcePath, Buffer.from(JSON.stringify(changed)));
  workspace.files.set(descriptor.rewardPath, Buffer.from(JSON.stringify(f.rewards)));
  const restored = companyDraftFiles(companySourceDraft(workspace));
  assert.deepEqual(JSON.parse(restored.files.get(descriptor.sourcePath)), changed);
  assert.deepEqual(JSON.parse(restored.files.get(descriptor.rewardPath)), f.rewards);
});

test('the shared discovery editor previews pending choices and applies only after an explicit submit', () => {
  const f = fixture();
  let source = f.source,
    writes = 0;
  const document = new Document();
  for (const id of [
    'tools',
    'campaign',
    'beat',
    'reward',
    'layout',
    'finale',
    'locale',
    'form',
    'show',
    'preview',
    'result',
  ]) {
    const element = document.createElement(
      ['campaign', 'beat', 'reward', 'layout', 'finale', 'locale'].includes(id) ? 'select' : 'div',
    );
    element.id = `discovery-${id}`;
    document.body.append(element);
  }
  const node = (id) => document.getElementById(`discovery-${id}`);
  const editor = createDiscoveryEditor({
    document,
    getSource: () => source,
    getMission: () => source.missions[0],
    getRewards: () => f.rewards,
    apply: (value) => {
      source = value;
      writes++;
    },
  });
  editor.sync();
  node('beat').value = 'choose';
  node('layout').value = 'gallery';
  node('reward').value = JSON.stringify(f.command.rewardRef);
  node('finale').value = JSON.stringify(f.command.discovery.finaleRewardRef);
  const preview = node('show').onclick();
  assert.equal(preview.layout, 'gallery');
  assert.equal(writes, 0);
  assert.equal(source.missions[0].design.pacingBeat, undefined);
  node('form').onsubmit({ preventDefault() {} });
  assert.equal(writes, 1);
  assert.equal(source.missions[0].design.pacingBeat, 'choose');
  assert.deepEqual(source.missions[0].design.rewardRef, f.command.rewardRef);
  assert.equal(node('preview').children.length, 0);
});
