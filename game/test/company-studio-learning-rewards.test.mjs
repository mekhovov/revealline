import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { parse } from 'acorn';
import { readFile } from 'node:fs/promises';
import { createCompanyWorkspaceFiles } from '../../scripts/company-studio.mjs';
import { createStudioReward } from '../../authoring/company-studio/reward-editor.mjs';
import { validateStudioData } from '../../authoring/company-studio/model.mjs';
import { COMPANY_LESSONS } from '../company-campaigns/lessons.mjs';
import { completionLearningReference } from '../rewards/learning.mjs';
import { Document } from './helpers/couch-dom.mjs';

test('Company Studio actual author action binds only its explicitly checked lesson/mastery goals and preserves source/profile isolation', async () => {
  const workspace = createCompanyWorkspaceFiles({
      brandId: 'museum',
      editionId: 'museum-public',
      name: 'Museum',
    }),
    catalog = structuredClone(workspace.catalog),
    campaign = catalog.campaigns[0],
    source = JSON.parse(workspace.files.get(campaign.sourcePath)),
    lesson = {
      ...structuredClone(COMPANY_LESSONS[0]),
      missionId: source.missions[0].id,
      campaignId: campaign.id,
    };
  campaign.lessonPath = campaign.sourcePath.replace(/\.json$/, '.lessons.json');
  campaign.rewardPath = campaign.sourcePath.replace(/\.json$/, '.rewards.json');
  const files = new Map([
      [campaign.sourcePath, source],
      [campaign.lessonPath, [lesson]],
      [campaign.rewardPath, []],
    ]),
    editorBuffers = new Map(),
    document = new Document(),
    nodes = new Map();
  const control = (id, value = '') => {
    const element = document.createElement('input');
    element.id = id;
    element.value = value;
    nodes.set(id, element);
    document.body.append(element);
    return element;
  };
  control('rewards-json', '[]');
  control('reward-rule', 'all-missions');
  control('reward-mission', '');
  control('reward-missions');
  const mastery = control('reward-mastery'),
    masteryChoice = document.createElement('input');
  masteryChoice.type = 'checkbox';
  masteryChoice.value = source.missions[0].id;
  masteryChoice.checked = true;
  mastery.append(masteryChoice);
  const learning = control('reward-learning'),
    choice = document.createElement('input');
  choice.type = 'checkbox';
  choice.value = lesson.id;
  choice.checked = true;
  learning.append(choice);
  for (const locale of ['en', 'uk'])
    for (const field of ['title', 'teaser', 'paragraph'])
      control(`reward-${field}-${locale}`, `${locale} ${field}`);
  control('reward-preview-select');
  const script = await readFile(
      new URL('../../authoring/company-studio/studio.mjs', import.meta.url),
      'utf8',
    ),
    html = await readFile(
      new URL('../../authoring/company-studio/index.html', import.meta.url),
      'utf8',
    ),
    tree = parse(script, { ecmaVersion: 'latest', sourceType: 'module' }),
    declaration = tree.body.find(
      (entry) => entry.type === 'FunctionDeclaration' && entry.id.name === 'addRewardDraft',
    ),
    before = JSON.stringify({ source, lesson, catalog });
  assert(html.includes('id="reward-learning"'));
  const context = vm.createContext({
    catalog,
    files,
    editorBuffers,
    validateStudioData,
    // The production handler and model share a realm; normalize only this VM boundary.
    createStudioReward: (input) => createStudioReward(JSON.parse(JSON.stringify(input))),
    $: (id) => nodes.get(id),
    selectedCampaign: () => campaign,
    format: (value) => JSON.stringify(value),
    changed() {},
    chooseOptions() {},
  });
  vm.runInContext(script.slice(declaration.start, declaration.end), context);
  vm.runInContext('addRewardDraft()', context);
  const reward = JSON.parse(nodes.get('rewards-json').value)[0];
  assert.deepEqual(reward.requirements.learning, [completionLearningReference(lesson)]);
  assert.deepEqual(reward.requirements.mastery, [
    { id: 'journey-no-loss-win', revision: '1', missionId: source.missions[0].id },
  ]);
  assert.deepEqual(validateStudioData(campaign.rewardPath, [reward], catalog, files), [reward]);
  assert.equal(
    files.get(campaign.rewardPath).length,
    0,
    'The action edits the draft, not the applied source.',
  );
  assert.equal(editorBuffers.get(campaign.rewardPath), nodes.get('rewards-json').value);
  assert.equal(JSON.stringify({ source, lesson, catalog }), before);
  choice.checked = false;
  masteryChoice.checked = false;
  vm.runInContext('addRewardDraft()', context);
  assert.deepEqual(JSON.parse(nodes.get('rewards-json').value)[1].requirements.learning, []);
  assert.deepEqual(JSON.parse(nodes.get('rewards-json').value)[1].requirements.mastery, []);
});
