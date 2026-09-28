import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { parse } from 'acorn';
import { readFile } from 'node:fs/promises';
import { createCompanyWorkspaceFiles } from '../../scripts/company-studio.mjs';
import {
  createStudioReward,
  previewStudioReward,
} from '../../authoring/company-studio/reward-editor.mjs';
import { validateStudioData } from '../../authoring/company-studio/model.mjs';
import { createRewardPrintPreview } from '../studio/reward-print-preview.mjs';
import { mountRewardKnowledge } from '../ui/reward-knowledge.mjs';
import { t } from '../i18n/index.mjs';
import { Document } from './helpers/couch-dom.mjs';

function fixture() {
  const workspace = createCompanyWorkspaceFiles({
    brandId: 'museum',
    editionId: 'museum-public',
    name: 'Museum',
  });
  const catalog = structuredClone(workspace.catalog),
    campaign = catalog.campaigns[0];
  campaign.rewardPath = campaign.sourcePath.replace(/\.json$/, '.rewards.json');
  const source = JSON.parse(workspace.files.get(campaign.sourcePath));
  const reward = structuredClone(
    createStudioReward({
      campaign,
      source,
      rule: 'all-missions',
      id: 'museum-print',
      locales: {
        en: {
          title: 'Exhibit',
          teaser: 'Complete the exhibit.',
          paragraph: 'An original discovery.',
        },
        uk: {
          title: 'Виставка',
          teaser: 'Завершіть виставку.',
          paragraph: 'Оригінальне відкриття.',
        },
      },
    }),
  );
  reward.payloads[0].locales.en.sources = [
    { title: 'Source evidence', url: 'https://example.org/source' },
  ];
  reward.payloads.push(
    {
      id: 'resource',
      type: 'url',
      url: 'https://example.org/resource',
      locales: { en: { title: 'Reference' }, uk: { title: 'Довідка' } },
    },
    {
      id: 'sample-code',
      type: 'public-code',
      code: 'FICTIONAL-PREVIEW',
      issuer: 'Fictional museum',
      expiresOn: '2027-01-01',
      termsUrl: 'https://example.org/terms',
      locales: {
        en: { title: 'Sample code', terms: 'A fictional example; no real offer.' },
        uk: { title: 'Приклад коду', terms: 'Вигаданий приклад, не справжня пропозиція.' },
      },
    },
  );
  const blobs = [],
    revoked = [],
    timers = new Map();
  let nextTimer = 0;
  const window = {
    URL: {
      createObjectURL(blob) {
        blobs.push(blob);
        return `blob:preview-${blobs.length}`;
      },
      revokeObjectURL(url) {
        revoked.push(url);
      },
    },
    setTimeout(callback) {
      timers.set(++nextTimer, callback);
      return nextTimer;
    },
    clearTimeout(timer) {
      timers.delete(timer);
    },
  };
  return { catalog, source, campaign, reward, window, blobs, revoked, timers };
}

test('shared print preview owns cancellation and download resources over twenty cycles without changing a reward', async () => {
  const f = fixture(),
    document = new Document(),
    before = JSON.stringify(f.reward);
  for (let cycle = 0; cycle < 20; cycle++) {
    let saved = 0;
    const viewer = createRewardPrintPreview({
      document,
      window: f.window,
      getReward: () => f.reward,
      getLocale: () => (cycle % 2 ? 'uk' : 'en'),
      onSaved() {
        saved++;
      },
      onError(error) {
        throw error;
      },
    });
    document.body.append(viewer.button);
    await viewer.button.onclick();
    assert.equal(saved, 1);
    assert.equal(f.timers.size, 1);
    const html = await f.blobs.at(-1).text();
    assert(html.includes(cycle % 2 ? 'не підтверджує перемогу' : 'does not record a player win'));
    assert(!html.includes('gameplayId'));
    viewer.dispose();
    viewer.dispose();
    assert.equal(f.timers.size, 0);
    assert.equal(f.revoked.length, cycle + 1);
    assert.equal(viewer.button.onclick, null);
    viewer.button.remove();
  }
  const pending = createRewardPrintPreview({
    document,
    window: f.window,
    getReward: () => f.reward,
  });
  const work = pending.button.onclick();
  pending.dispose();
  await work;
  assert.equal(f.blobs.length, 20, 'closing during serialization must not download');
  assert.equal(JSON.stringify(f.reward), before);
});

test('Company Studio actual eligible-preview callback exposes printable text and explicit source/code links only after its synthetic requirements pass', async () => {
  const f = fixture(),
    document = new Document(),
    nodes = new Map();
  for (const id of [
    'rewards-json',
    'reward-preview-select',
    'reward-preview-state',
    'reward-preview-locale',
    'reward-preview',
  ]) {
    const element = document.createElement(id === 'reward-preview' ? 'section' : 'select');
    nodes.set(id, element);
    document.body.append(element);
  }
  nodes.get('rewards-json').value = JSON.stringify([f.reward]);
  nodes.get('reward-preview-state').value = 'locked';
  nodes.get('reward-preview-locale').value = 'en';
  const catalog = f.catalog,
    files = new Map([[f.campaign.sourcePath, f.source]]),
    edition = { id: 'museum-public', brandId: 'museum', campaignIds: [f.campaign.id] },
    script = await readFile(
      new URL('../../authoring/company-studio/studio.mjs', import.meta.url),
      'utf8',
    ),
    tree = parse(script, { ecmaVersion: 'latest', sourceType: 'module' }),
    declaration = tree.body.find(
      (entry) => entry.type === 'FunctionDeclaration' && entry.id.name === 'previewRewardDraft',
    ),
    before = JSON.stringify({ catalog, reward: f.reward, source: f.source }),
    viewers = [];
  const context = vm.createContext({
    document,
    catalog,
    files,
    t,
    $: (id) => nodes.get(id),
    selectedCampaign: () => f.campaign,
    selected: () => ({ edition }),
    validateStudioData,
    previewStudioReward,
    mountRewardKnowledge,
    chooseOptions(element, options, value) {
      element.value = value;
    },
    disposeRewardPreviews() {
      viewers.splice(0).forEach((viewer) => viewer.dispose());
    },
    rewardPreviewExplorations: viewers,
    createRewardPrintPreview: (options) =>
      createRewardPrintPreview({ ...options, window: f.window }),
    node(tag, text) {
      const element = document.createElement(tag);
      if (text !== undefined) element.textContent = text;
      return element;
    },
  });
  vm.runInContext(script.slice(declaration.start, declaration.end), context);
  const preview = () => vm.runInContext('previewRewardDraft()', context),
    panel = nodes.get('reward-preview');
  preview();
  assert.equal(panel.querySelector('button'), null);
  assert.equal(panel.querySelector('a'), null);
  nodes.get('reward-preview-state').value = 'eligible';
  preview();
  assert(panel.querySelector('button'));
  const links = panel.querySelectorAll('a');
  assert.deepEqual(
    links.map((link) => link.href),
    ['https://example.org/source', 'https://example.org/resource', 'https://example.org/terms'],
  );
  assert(links.every((link) => link.target === '_blank' && link.rel === 'noopener noreferrer'));
  assert(panel.textContent.includes('FICTIONAL-PREVIEW'));
  assert(panel.textContent.includes('Fictional museum'));
  assert(panel.textContent.includes('2027-01-01'));
  assert(!panel.textContent.includes('Payload:'));
  await panel.querySelector('button').onclick();
  assert((await f.blobs[0].text()).includes('Author preview'));
  assert.equal(f.timers.size, 1);
  nodes.get('reward-preview-state').value = 'partial';
  preview();
  assert.equal(panel.querySelector('button'), null);
  assert.equal(panel.querySelector('code'), null);
  assert.equal(f.timers.size, 0);
  assert.equal(f.revoked.length, 1);
  assert.equal(JSON.stringify({ catalog, reward: f.reward, source: f.source }), before);
});
