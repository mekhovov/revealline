import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Document, Events } from './helpers/couch-dom.mjs';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { rewardAudioFixture } from './helpers/reward-audio-fixture.mjs';
import { createStudioReward } from '../../authoring/company-studio/reward-editor.mjs';
import { companySourceDraft, companyDraftFiles } from '../../scripts/company-studio.mjs';
import { compileEdition } from '../../scripts/compile-edition.mjs';
import { createRewardMissionBindings } from '../rewards/bindings.mjs';
import { REWARD_AUDIO_GROUP_FORMAT } from '../rewards/audio-groups.mjs';
import { editDiscoveryAudioGroups } from '../content-design/discovery-audio-groups.mjs';
import { createAudioGroupEditor } from '../studio/audio-group-editor.mjs';
import { reconcileEarnedRewards, validateRewardState } from '../rewards/model.mjs';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { parse } from 'acorn';
import { validateStudioData, studioSelection } from '../../authoring/company-studio/model.mjs';
import { previewStudioReward } from '../../authoring/company-studio/reward-editor.mjs';
import { rewardPresentationItems } from '../rewards/audio-groups.mjs';
import { mountRewardAudioGroup } from '../ui/reward-audio-group.mjs';
import { createAudioMaster } from '../ui/audio-master.mjs';
import { t } from '../i18n/index.mjs';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function fixture() {
  const f = await editionProviderFixture(),
    catalog = structuredClone(f.catalog),
    descriptor = catalog.campaigns[0],
    bytes = new Map();
  const asset = (id, ext, data) => {
    const value = {
      id,
      path: `game/editions/assets/sample/${id}.${ext}`,
      sha256: sha(data),
      bytes: data.length,
      approved: true,
      publication: 'public',
      dependencies: [],
    };
    catalog.assets.push(value);
    descriptor.assetIds.push(id);
    bytes.set(value.path, data);
    return { assetId: id, sha256: value.sha256 };
  };
  const original = asset('recording', 'wav', rewardAudioFixture()),
    transcripts = {
      en: asset('transcript-en', 'txt', Buffer.from('Owned recording.')),
      uk: asset('transcript-uk', 'txt', Buffer.from('Власний запис.')),
    };
  descriptor.rewardPath = 'game/content/sample/listening-rewards.json';
  const reward = structuredClone(
    createStudioReward({
      campaign: descriptor,
      source: f.source,
      id: 'listening',
      rule: 'all-missions',
      locales: {
        en: { title: 'Listening', teaser: 'Two recordings', paragraph: 'A listening room.' },
        uk: { title: 'Слухання', teaser: 'Два записи', paragraph: 'Кімната для слухання.' },
      },
    }),
  );
  reward.payloads = ['one', 'two'].map((id) => ({
    id,
    type: 'audio',
    asset: original,
    transcript: transcripts,
    locales: { en: { title: id }, uk: { title: id } },
  }));
  const files = new Map(
    [...f.files]
      .filter(([path]) => !path.endsWith('catalog.json'))
      .map(([path, data]) => [path, Buffer.from(JSON.stringify(data))]),
  );
  for (const [path, data] of bytes) files.set(path, data);
  files.set(descriptor.rewardPath, Buffer.from(JSON.stringify([reward])));
  files.set('game/company.html', Buffer.from('<!doctype html><html><body>Game</body></html>'));
  const group = {
    format: REWARD_AUDIO_GROUP_FORMAT,
    id: 'listening-order',
    locales: { en: { title: 'Listening room' }, uk: { title: 'Кімната слухання' } },
    payloadIds: ['two', 'one'],
  };
  return { ...f, catalog, descriptor, reward, files, bytes, group };
}
test('playlist edit preserves gameplay and exact requirements through Company export and selected compilation', async () => {
  const f = await fixture(),
    original = JSON.stringify(f.reward),
    before = createRewardMissionBindings(f.source, f.descriptor.id),
    edited = editDiscoveryAudioGroups(f.source, [f.reward], f.reward.id, [f.group]);
  assert.equal(JSON.stringify(f.reward), original);
  assert.deepEqual(createRewardMissionBindings(edited.source, f.descriptor.id), before);
  assert.deepEqual(edited.rewards[0].requirements, f.reward.requirements);
  f.files.set(f.descriptor.sourcePath, Buffer.from(JSON.stringify(edited.source)));
  f.files.set(f.descriptor.rewardPath, Buffer.from(JSON.stringify(edited.rewards)));
  const draft = companySourceDraft({ catalog: f.catalog, files: f.files }),
    restored = companyDraftFiles(draft);
  assert.deepEqual(JSON.parse(restored.files.get(f.descriptor.rewardPath)), edited.rewards);
  f.files.set('game/editions/assets/private-unselected.wav', Buffer.from('sentinel'));
  const compiled = await compileEdition({
    catalog: f.catalog,
    files: f.files,
    editionIds: [f.catalog.editions[0].id],
    enginePaths: ['game/company.html'],
  });
  assert.deepEqual(JSON.parse(compiled.files.get(f.descriptor.rewardPath)), edited.rewards);
  assert(!compiled.files.has('game/editions/assets/private-unselected.wav'));
  for (const [path, bytes] of f.bytes)
    assert(Buffer.from(compiled.files.get(path)).equals(Buffer.from(bytes)), path);
  const missing = structuredClone(f.catalog);
  missing.campaigns[0].assetIds = missing.campaigns[0].assetIds.filter(
    (id) => id !== 'transcript-uk',
  );
  await assert.rejects(
    compileEdition({
      catalog: missing,
      files: f.files,
      editionIds: [missing.editions[0].id],
      enginePaths: ['game/company.html'],
    }),
    /selected|declared|dependency|asset|transcript/i,
  );
});
test('playlist promise and receipt retain exact original ordering across update, import and tamper checks', async () => {
  const f = await fixture(),
    definition = editDiscoveryAudioGroups(f.source, [f.reward], f.reward.id, [f.group]).rewards[0],
    context = {
      editionId: f.catalog.editions[0].id,
      brandId: definition.brandId,
      campaignIds: [definition.campaignId],
      clears: {},
      learning: [],
      mastery: [],
    },
    promised = reconcileEarnedRewards([definition], context).state;
  for (const mission of definition.requirements.missions)
    context.clears[mission.missionId] = {
      runId: 'accepted-' + mission.missionId,
      ...mission.bindings[0],
    };
  const changed = structuredClone(definition);
  changed.revision = 'new-order';
  changed.audioGroups[0].payloadIds.reverse();
  const earned = reconcileEarnedRewards([changed], context, promised);
  assert.deepEqual(earned.granted[0].definition.audioGroups, definition.audioGroups);
  const restored = validateRewardState(JSON.parse(JSON.stringify(earned.state)), {
    editionId: context.editionId,
  });
  assert.deepEqual(restored.receipts[0].definition.audioGroups, definition.audioGroups);
  const tampered = JSON.parse(JSON.stringify(earned.state));
  tampered.receipts[0].definition.audioGroups[0].payloadIds.reverse();
  assert.throws(() => validateRewardState(tampered), /identity/);
});
test('guided playlist editor explicitly orders existing recordings, previews without earning and rejects stale drafts', async () => {
  const f = await fixture(),
    document = new Document(),
    window = new Events(),
    container = document.createElement('section');
  document.body.append(container);
  window.URL = {
    createObjectURL() {
      throw Error('No autoplay');
    },
    revokeObjectURL() {},
  };
  let source = f.source,
    rewards = [f.reward],
    applied = 0;
  const editor = createAudioGroupEditor({
    container,
    getSource: () => source,
    getRewards: () => rewards,
    getLocale: () => 'uk',
    window,
    apply(candidate) {
      source = candidate.source;
      rewards = candidate.rewards;
      applied++;
    },
  });
  const field = (name) => container.querySelector(`[data-audio-group-field="${name}"]`),
    action = (name) => container.querySelector(`[data-audio-group-action="${name}"]`).onclick();
  editor.sync();
  field('id').value = f.group.id;
  field('en').value = f.group.locales.en.title;
  field('uk').value = f.group.locales.uk.title;
  await action('add');
  await action('add');
  field('order').value = 'two';
  await action('up');
  await action('preview');
  assert(container.querySelector('[data-reward-media-files]'));
  assert.equal(applied, 0);
  await action('apply');
  assert.equal(applied, 1);
  assert.deepEqual(rewards[0].audioGroups[0].payloadIds, ['two', 'one']);
  field('group').value = f.group.id;
  field('group').onchange();
  source = { ...source, revision: 'a-new-draft' };
  await action('remove');
  assert.equal(applied, 1);
  assert(container.textContent.includes('draft changed'));
  editor.sync();
  field('group').value = f.group.id;
  field('group').onchange();
  await action('remove');
  assert.equal(applied, 2);
  assert.equal(rewards[0].audioGroups, undefined);
  assert.equal(rewards[0].payloads.length, 2);
  assert.deepEqual(rewards[0].requirements, f.reward.requirements);
  editor.dispose();
  assert.equal(container.children.length, 0);
});

test('actual Company eligible preview renders one shared playlist and releases it when locked', async (testContext) => {
  const f = await fixture(),
    document = new Document(),
    nodes = new Map(),
    viewers = [],
    editionId = f.catalog.editions[0].id,
    reward = { ...f.reward, audioGroups: [f.group] },
    files = new Map([[f.descriptor.sourcePath, f.source]]),
    requests = [];
  for (const id of [
    'rewards-json',
    'reward-preview-select',
    'reward-preview-state',
    'reward-preview-locale',
    'reward-preview',
  ]) {
    const node = document.createElement('section');
    nodes.set(id, node);
    document.body.append(node);
  }
  nodes.get('rewards-json').value = JSON.stringify([reward]);
  nodes.get('reward-preview-state').value = 'eligible';
  nodes.get('reward-preview-locale').value = 'uk';
  testContext.mock.method(globalThis, 'fetch', async (url) => {
    const path = new URL(url).pathname.slice(1);
    requests.push(path);
    return new Response(f.bytes.get(path));
  });
  const script = await readFile(
      new URL('../../authoring/company-studio/studio.mjs', import.meta.url),
      'utf8',
    ),
    declaration = parse(script, { ecmaVersion: 'latest', sourceType: 'module' }).body.find(
      (node) => node.type === 'FunctionDeclaration' && node.id.name === 'previewRewardDraft',
    ),
    panel = nodes.get('reward-preview');
  let owners = 0;
  const context = vm.createContext({
    document,
    catalog: f.catalog,
    editionId,
    files,
    t,
    $: (id) => nodes.get(id),
    selectedCampaign: () => f.descriptor,
    selected: () => studioSelection(f.catalog, editionId),
    validateStudioData,
    previewStudioReward,
    rewardPresentationItems,
    mountRewardAudioGroup,
    rootURL: 'https://fixture.invalid/',
    acquireStudioRewardAudio() {
      owners++;
      return {
        master: createAudioMaster({ muted: false }),
        release() {
          owners--;
        },
      };
    },
    createRewardPrintPreview: () => ({ button: document.createElement('button'), dispose() {} }),
    chooseOptions() {},
    disposeRewardPreviews() {
      viewers.splice(0).forEach((v) => v.dispose());
    },
    rewardPreviewExplorations: viewers,
    node(tag, text) {
      const value = document.createElement(tag);
      if (text !== undefined) value.textContent = text;
      return value;
    },
  });
  vm.runInContext(script.slice(declaration.start, declaration.end), context);
  const preview = () => vm.runInContext('previewRewardDraft()', context);
  preview();
  for (let i = 0; i < 12; i++) await new Promise((resolve) => setTimeout(resolve, 2));
  assert.equal(panel.querySelectorAll('[data-reward-audio-group]').length, 1);
  assert.equal(panel.querySelectorAll('[data-reward-media]').length, 1);
  assert(panel.textContent.includes('Кімната слухання'));
  assert.deepEqual(requests, ['game/editions/assets/sample/transcript-uk.txt']);
  assert.equal(panel.querySelector('audio'), null);
  nodes.get('reward-preview-state').value = 'locked';
  preview();
  assert.equal(owners, 0);
  assert.equal(panel.querySelector('[data-reward-audio-group]'), null);
});
