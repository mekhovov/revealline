import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createExplorationExample } from '../studio/exploration-example.mjs';
import {
  validateExplorationPayload,
  explorationAssetReferences,
  createExplorationState,
  applyExplorationAction,
} from '../rewards/exploration.mjs';
import { completionRewardAssetReferences } from '../rewards/model.mjs';
import { mountDiscoveryExploration } from '../ui/discovery-exploration.mjs';
import { createPrintableReward } from '../rewards/printable.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { pngBytes } from './helpers/media-fixtures.mjs';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { createStudioReward } from '../../authoring/company-studio/reward-editor.mjs';
import { compileEdition } from '../../scripts/compile-edition.mjs';
import { companyDraftFiles, companySourceDraft } from '../../scripts/company-studio.mjs';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
function payload() {
  const value = structuredClone(createExplorationExample());
  value.recipe.id = 'inspect-image-atlas';
  value.recipe.diagram = {
    asset: { assetId: 'anatomy', sha256: sha(pngBytes()) },
    locales: {
      en: { alt: 'Fictional separated parts', caption: 'Conceptual illustration, not wiring.' },
      uk: { alt: 'Вигадані окремі деталі', caption: 'Умовна ілюстрація, не схема з’єднання.' },
    },
    hotspots: [
      { cardId: 'camera', x: 0.25, y: 0.4 },
      { cardId: 'video-transmitter', x: 0.75, y: 0.6 },
    ],
  };
  return value;
}
async function fixture() {
  const f = await editionProviderFixture(),
    catalog = structuredClone(f.catalog),
    descriptor = catalog.campaigns[0],
    bytes = pngBytes();
  const asset = {
    id: 'anatomy',
    path: 'game/editions/assets/sample/anatomy.png',
    sha256: sha(bytes),
    bytes: bytes.length,
    approved: true,
    publication: 'public',
    dependencies: [],
  };
  catalog.assets.push(asset);
  descriptor.assetIds.push(asset.id);
  descriptor.rewardPath = 'game/content/sample/diagram-rewards.json';
  const reward = structuredClone(
    createStudioReward({
      campaign: descriptor,
      source: f.source,
      id: 'diagram',
      rule: 'all-missions',
      locales: {
        en: { title: 'Diagram', teaser: 'Inspect after winning', paragraph: 'A model.' },
        uk: { title: 'Схема', teaser: 'Дослідіть після перемоги', paragraph: 'Модель.' },
      },
    }),
  );
  reward.payloads = [payload()];
  const files = new Map(
    [...f.files]
      .filter(([name]) => !name.endsWith('catalog.json'))
      .map(([name, value]) => [name, Buffer.from(JSON.stringify(value))]),
  );
  files.set(descriptor.rewardPath, Buffer.from(JSON.stringify([reward])));
  files.set(asset.path, bytes);
  files.set('game/company.html', Buffer.from('<!doctype html><html><body>Game</body></html>'));
  return { ...f, catalog, descriptor, asset, bytes, reward, files };
}
test('diagram recipes preserve legacy bytes and reject unbounded or ambiguous image coordinates', () => {
  const legacy = createExplorationExample();
  assert.equal(JSON.stringify(validateExplorationPayload(legacy)), JSON.stringify(legacy));
  assert.deepEqual(explorationAssetReferences(payload().recipe), [payload().recipe.diagram.asset]);
  for (const change of [
    (p) => (p.recipe.diagram.hotspots[0].x = 1.01),
    (p) => (p.recipe.diagram.hotspots[0].y = NaN),
    (p) => p.recipe.diagram.hotspots.push(p.recipe.diagram.hotspots[0]),
    (p) => (p.recipe.diagram.hotspots[0].cardId = 'absent'),
    (p) => (p.recipe.diagram.asset.sha256 = 'invalid'),
    (p) => (p.recipe.diagram.locales.uk.alt = ''),
    (p) => (p.recipe.diagram.animation = 'spin'),
    (p) => (p.recipe.diagram.url = 'https://example.com/image.png'),
  ]) {
    const value = payload();
    change(value);
    assert.throws(() => validateExplorationPayload(value));
  }
  const recipe = validateExplorationPayload(payload()).recipe,
    state = createExplorationState(recipe);
  assert.deepEqual(
    applyExplorationAction(recipe, state, { type: 'inspect', cardId: 'video-transmitter' })
      .selectedCardIds,
    ['camera', 'video-transmitter'],
  );
});
test('native image points and the equivalent numbered list select the same cards without motion or progress writes', async () => {
  const document = new Document(),
    container = document.createElement('div');
  document.body.append(container);
  let active = 0;
  const view = mountDiscoveryExploration({
    container,
    payload: payload(),
    loadImage: async (_image, target) => {
      active++;
      const img = document.createElement('img');
      img.complete = true;
      img.naturalWidth = 960;
      target.append(img);
      return () => active--;
    },
  });
  await settle();
  const points = container.querySelectorAll('[data-diagram-card]');
  assert.equal(points.length, 2);
  assert.equal(container.querySelector('.discovery-diagram-points').hidden, false);
  points[0].focus();
  const key = points[0].emit('keydown', { key: 'ArrowRight' });
  assert(key.defaultPrevented);
  assert.equal(document.activeElement, points[1]);
  points[1].emit('click');
  assert.equal(points[1].getAttribute('aria-pressed'), 'true');
  const list = container.querySelector('[data-card-id="video-transmitter"]');
  assert.equal(list.getAttribute('aria-pressed'), 'true');
  assert.match(list.textContent, /2\./);
  list.emit('click');
  assert.equal(points[1].getAttribute('aria-pressed'), 'false');
  assert.match(
    container.querySelector('.discovery-diagram').querySelector('style').textContent,
    /@media\(max-width:480px\)/,
  );
  view.dispose();
  assert.equal(active, 0);
  assert.equal(container.children.length, 0);
});
test('missing or late diagram media keeps the text controls and cannot retain resources after disposal', async () => {
  const document = new Document(),
    container = document.createElement('div');
  document.body.append(container);
  const missing = mountDiscoveryExploration({ container, payload: payload() });
  await settle();
  assert.equal(container.querySelector('.discovery-diagram-points').hidden, true);
  assert(container.querySelector('[data-card-id="camera"]'));
  missing.dispose();
  let finish,
    signal,
    released = 0;
  const late = mountDiscoveryExploration({
    container,
    payload: payload(),
    loadImage: (_p, _target, options) => {
      signal = options.signal;
      return new Promise((resolve) => (finish = resolve));
    },
  });
  await settle();
  late.dispose();
  assert(signal.aborted);
  finish(() => released++);
  await settle();
  assert.equal(released, 1);
  assert.equal(container.children.length, 0);
  let live = 0;
  for (let i = 0; i < 20; i++) {
    const view = mountDiscoveryExploration({
      container,
      payload: payload(),
      loadImage: async (_p, target) => {
        live++;
        const image = document.createElement('img');
        image.complete = true;
        image.naturalWidth = 960;
        target.append(image);
        return () => live--;
      },
    });
    await settle();
    view.dispose();
    assert.equal(live, 0);
    assert.equal(container.children.length, 0);
  }
});
test('diagram exact dependencies survive selected edition and Studio round trips, excluding unrelated images', async () => {
  const f = await fixture(),
    build = () =>
      compileEdition({
        catalog: f.catalog,
        editionIds: [f.catalog.editions[0].id],
        files: f.files,
        enginePaths: ['game/company.html'],
      });
  assert.deepEqual(completionRewardAssetReferences([f.reward]), [
    f.reward.payloads[0].recipe.diagram.asset,
  ]);
  f.files.set('game/editions/assets/private-sentinel.png', f.bytes);
  const result = await build();
  assert.deepEqual(result.files.get(f.asset.path), f.bytes);
  assert(!result.files.has('game/editions/assets/private-sentinel.png'));
  assert.deepEqual(JSON.parse(result.files.get(f.descriptor.rewardPath)), [f.reward]);
  const restored = companyDraftFiles(companySourceDraft(f));
  assert.deepEqual(JSON.parse(restored.files.get(f.descriptor.rewardPath)), [f.reward]);
  f.reward.payloads[0].recipe.diagram.asset.sha256 = '0'.repeat(64);
  f.files.set(f.descriptor.rewardPath, Buffer.from(JSON.stringify([f.reward])));
  await assert.rejects(build(), /approved asset closure/);
  f.reward.payloads[0].recipe.diagram.asset.sha256 = f.asset.sha256;
  f.files.set(f.descriptor.rewardPath, Buffer.from(JSON.stringify([f.reward])));
  f.descriptor.assetIds = [];
  await assert.rejects(build(), /raster|closure|extension/);
});
test('printable discovery preserves the exact diagram and labelled explanations without interactive code', async () => {
  const f = await fixture(),
    requested = [];
  const result = await createPrintableReward(f.reward, {
    getImage: async (reference) => {
      requested.push(reference);
      return { bytes: f.bytes, mimeType: 'image/png' };
    },
  });
  assert.deepEqual(requested, [f.reward.payloads[0].recipe.diagram.asset]);
  assert.match(result.html, /data:image\/png;base64/);
  assert.match(result.html, /<ol>/);
  assert.match(result.html, /Conceptual illustration/);
  assert.doesNotMatch(result.html, /<script/);
});

test('the selected compiler inspects diagram bytes even when a malicious replacement has a matching hash and raster suffix', async () => {
  const f = await fixture(),
    fake = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  f.asset.sha256 = sha(fake);
  f.asset.bytes = fake.length;
  f.reward.payloads[0].recipe.diagram.asset.sha256 = f.asset.sha256;
  f.files.set(f.asset.path, fake);
  f.files.set(f.descriptor.rewardPath, Buffer.from(JSON.stringify([f.reward])));
  await assert.rejects(
    compileEdition({
      catalog: f.catalog,
      editionIds: [f.catalog.editions[0].id],
      files: f.files,
      enginePaths: ['game/company.html'],
    }),
    /static raster/,
  );
});
