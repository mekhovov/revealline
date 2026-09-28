import { rewardPresentationItems } from '../rewards/audio-groups.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { parse } from 'acorn';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Document } from './helpers/couch-dom.mjs';
import { pngBytes } from './helpers/media-fixtures.mjs';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import {
  createStudioReward,
  previewStudioReward,
} from '../../authoring/company-studio/reward-editor.mjs';
import { validateStudioData, studioSelection } from '../../authoring/company-studio/model.mjs';
import { createExplorationExample } from '../studio/exploration-example.mjs';
import { mountDiscoveryExploration } from '../ui/discovery-exploration.mjs';
import { loadRewardImage } from '../ui/reward-image.mjs';
import { t } from '../i18n/index.mjs';

const settle = async () => {
  for (let i = 0; i < 12; i++) await new Promise((resolve) => setTimeout(resolve, 2));
};
test('Company eligible diagram preview verifies selected exact bytes and cancels closed requests', async () => {
  const f = await editionProviderFixture(),
    catalog = structuredClone(f.catalog),
    campaign = catalog.campaigns[0],
    editionId = catalog.editions[0].id,
    bytes = pngBytes(),
    sha256 = createHash('sha256').update(bytes).digest('hex'),
    path = 'game/editions/assets/sample/preview-diagram.png';
  catalog.assets.push({
    id: 'preview-diagram',
    path,
    sha256,
    bytes: bytes.length,
    approved: true,
    publication: 'public',
    dependencies: [],
  });
  campaign.assetIds.push('preview-diagram');
  campaign.rewardPath = 'game/content/sample/preview-rewards.json';
  const payload = structuredClone(createExplorationExample());
  payload.recipe.id = 'inspect-image-atlas';
  payload.recipe.diagram = {
    asset: { assetId: 'preview-diagram', sha256 },
    locales: {
      en: { alt: 'Fictional parts', caption: 'An illustration.' },
      uk: { alt: 'Вигадані деталі', caption: 'Ілюстрація.' },
    },
    hotspots: [{ cardId: payload.recipe.cards[0].id, x: 0.5, y: 0.5 }],
  };
  const reward = structuredClone(
    createStudioReward({
      campaign,
      source: f.source,
      id: 'preview-diagram',
      rule: 'all-missions',
      locales: {
        en: { title: 'Illustration', teaser: 'An illustrated discovery', paragraph: 'Example.' },
        uk: { title: 'Ілюстрація', teaser: 'Ілюстроване відкриття', paragraph: 'Приклад.' },
      },
    }),
  );
  reward.payloads = [payload];
  const document = new Document(),
    nodes = new Map(),
    viewers = [],
    requests = [],
    blobs = [],
    revoked = [],
    files = new Map([[campaign.sourcePath, f.source]]);
  for (const id of [
    'rewards-json',
    'reward-preview-select',
    'reward-preview-state',
    'reward-preview-locale',
    'reward-preview',
  ]) {
    const node = document.createElement('div');
    nodes.set(id, node);
    document.body.append(node);
  }
  nodes.get('rewards-json').value = JSON.stringify([reward]);
  nodes.get('reward-preview-state').value = 'eligible';
  nodes.get('reward-preview-locale').value = 'en';
  const script = await readFile(
      new URL('../../authoring/company-studio/studio.mjs', import.meta.url),
      'utf8',
    ),
    declaration = parse(script, { ecmaVersion: 'latest', sourceType: 'module' }).body.find(
      (entry) => entry.type === 'FunctionDeclaration' && entry.id.name === 'previewRewardDraft',
    ),
    URLImpl = {
      createObjectURL(blob) {
        blobs.push(blob);
        return `blob:diagram-${blobs.length}`;
      },
      revokeObjectURL(url) {
        revoked.push(url);
      },
    },
    dispose = () => viewers.splice(0).forEach((view) => view.dispose());
  let pending = false,
    finish;
  const priorFetch = globalThis.fetch;
  globalThis.fetch = async (url, { signal }) => {
    requests.push({ path: new URL(url).pathname.slice(1), signal });
    if (pending)
      await new Promise((resolve) => {
        finish = resolve;
      });
    return new Response(bytes);
  };
  const context = vm.createContext({
    document,
    catalog,
    editionId,
    files,
    t,
    URL: URLImpl,
    rootURL: 'https://fixture.invalid/',
    $: (id) => nodes.get(id),
    selectedCampaign: () => campaign,
    selected: () => studioSelection(catalog, editionId),
    validateStudioData,
    previewStudioReward,
    rewardPresentationItems,
    mountDiscoveryExploration,
    loadRewardImage: (options) => loadRewardImage({ ...options, URLImpl }),
    chooseOptions() {},
    disposeRewardPreviews: dispose,
    rewardPreviewExplorations: viewers,
    createRewardPrintPreview: () => ({ button: document.createElement('button'), dispose() {} }),
    node(tag, text) {
      const node = document.createElement(tag);
      if (text !== undefined) node.textContent = text;
      return node;
    },
  });
  vm.runInContext(script.slice(declaration.start, declaration.end), context);
  const preview = () => vm.runInContext('previewRewardDraft()', context);
  try {
    preview();
    await settle();
    assert.deepEqual(
      requests.map((request) => request.path),
      [path],
    );
    assert.equal(nodes.get('reward-preview').querySelector('img').alt, 'Fictional parts');
    assert.deepEqual(new Uint8Array(await blobs[0].arrayBuffer()), new Uint8Array(bytes));
    pending = true;
    preview();
    await settle();
    assert.deepEqual(revoked, ['blob:diagram-1']);
    const last = requests.at(-1);
    assert(!last.signal.aborted);
    nodes.get('reward-preview-state').value = 'locked';
    preview();
    assert(last.signal.aborted);
    finish();
    await settle();
    assert.equal(blobs.length, 1);
    assert.equal(nodes.get('reward-preview').querySelector('img'), null);
  } finally {
    dispose();
    globalThis.fetch = priorFetch;
  }
});
