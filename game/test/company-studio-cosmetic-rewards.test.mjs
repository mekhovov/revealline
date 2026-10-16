import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { createStudioReward } from '../../authoring/company-studio/reward-editor.mjs';
import {
  validateStudioDraft,
  DRAFT_FORMAT,
  declaredJSONPaths,
} from '../../authoring/company-studio/model.mjs';
import {
  discoveryCosmeticContext,
  editDiscoveryCosmetic,
} from '../content-design/discovery-cosmetics.mjs';
import { createCosmeticRewardEditor } from '../studio/cosmetic-reward-editor.mjs';
import { createRewardMissionBindings } from '../rewards/bindings.mjs';
import { compileEdition } from '../../scripts/compile-edition.mjs';
import { createPrintableReward } from '../rewards/printable.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { pngBytes } from './helpers/media-fixtures.mjs';

const locales = {
  en: { title: 'Glider', teaser: 'Finish the workshop.', paragraph: 'Optional appearance.' },
  uk: { title: 'Планер', teaser: 'Завершіть майстерню.', paragraph: 'Додаткове оформлення.' },
};
async function fixture() {
  const f = await editionProviderFixture(),
    catalog = structuredClone(f.catalog),
    campaign = catalog.campaigns[0],
    edition = catalog.editions[0];
  campaign.rewardPath = campaign.sourcePath.replace('.json', '.rewards.json');
  const presets = structuredClone(f.data.presets),
    body = structuredClone(presets.characters[f.data.themes.themes[0].player]);
  body.label = 'Optional original';
  body.src = '../../game/content/sample/optional.png';
  presets.characters['optional-glider'] = body;
  presets.rewardCharacters = ['optional-glider'];
  const image = pngBytes(),
    asset = {
      id: 'optional-body-image',
      path: 'game/content/sample/optional.png',
      bytes: image.length,
      sha256: createHash('sha256').update(image).digest('hex'),
      approved: true,
      publication: 'public',
      dependencies: [],
    };
  catalog.assets.push(asset);
  campaign.assetIds.push(asset.id);
  const reward = createStudioReward({
    campaign,
    source: f.source,
    rule: 'all-missions',
    id: 'sample-cosmetic',
    locales,
  });
  const files = new Map(f.files);
  files.set(edition.boot.presets, presets);
  files.set(campaign.rewardPath, [reward]);
  const contextSource = { catalog, editionId: edition.id, files },
    context = discoveryCosmeticContext(contextSource),
    recipe = context.registry[0];
  const payload = {
    id: 'appearance',
    type: 'cosmetic',
    recipeId: recipe.recipeId,
    recipeRevision: recipe.recipeRevision,
    locales: { en: { title: 'Glider' }, uk: { title: 'Планер' } },
  };
  const packet = (values = files) => ({
    format: DRAFT_FORMAT,
    catalog,
    files: declaredJSONPaths(catalog).map((path) => ({ path, data: values.get(path) })),
  });
  return {
    ...f,
    catalog,
    campaign,
    edition,
    files,
    reward,
    contextSource,
    context,
    payload,
    packet,
    asset,
    image,
  };
}

test('exact cosmetic binding revisions preserve gameplay and round trip through the existing Company source packet', async () => {
  const f = await fixture(),
    before = JSON.stringify(f.source),
    candidate = editDiscoveryCosmetic(f.source, [f.reward], f.reward.id, f.payload, f.context);
  assert.notEqual(candidate.rewards[0].revision, f.reward.revision);
  assert.deepEqual(
    createRewardMissionBindings(candidate.source),
    createRewardMissionBindings(f.source),
  );
  assert.deepEqual(candidate.rewards[0].requirements, f.reward.requirements);
  assert.equal(JSON.stringify(f.source), before);
  f.files.set(f.campaign.sourcePath, candidate.source);
  f.files.set(f.campaign.rewardPath, candidate.rewards);
  const restored = validateStudioDraft(JSON.stringify(f.packet()));
  assert.deepEqual(restored.files.get(f.campaign.rewardPath), candidate.rewards);
  assert.deepEqual(
    discoveryCosmeticContext({ ...restored, editionId: f.edition.id }).registry,
    f.context.registry,
  );
  const invalid = { ...f.context, selection: { ...f.context.selection, brand: { id: 'foreign' } } };
  assert.throws(
    () => editDiscoveryCosmetic(f.source, [f.reward], f.reward.id, f.payload, invalid),
    /owns/,
  );
  const printable = await createPrintableReward(candidate.rewards[0], { preview: true });
  assert.match(printable.html, /does not change collision/);
  assert.match(printable.html, /character-v1-/);
});

test('Company and Level Studio explicit source selection uses the same safe preview and immutable edit path', async () => {
  for (const integrated of [true, false]) {
    const f = await fixture(),
      doc = new Document(),
      container = doc.createElement('section');
    doc.body.append(container);
    let source = f.source,
      rewards = [f.reward],
      writes = 0;
    const editor = createCosmeticRewardEditor({
      container,
      getSource: () => source,
      getRewards: () => rewards,
      getLocale: () => 'uk',
      ...(integrated ? { getCosmeticSource: () => f.contextSource } : {}),
      apply(candidate) {
        source = candidate.source;
        rewards = candidate.rewards;
        writes++;
      },
    });
    editor.sync();
    const field = (name) => container.querySelector(`[data-cosmetic-field="${name}"]`);
    if (!integrated) {
      const json = JSON.stringify(f.packet());
      field('packet').files = [{ size: Buffer.byteLength(json), text: async () => json }];
      await field('packet').onchange();
    }
    field('enTitle').value = 'Workshop glider';
    field('ukTitle').value = 'Планер майстерні';
    await container.querySelector('[data-cosmetic-action="preview"]').onclick();
    assert.equal(writes, 0);
    assert.ok(container.querySelector('[data-cosmetic-original]'));
    await container.querySelector('[data-cosmetic-action="apply"]').onclick();
    assert.equal(writes, 1);
    assert.equal(rewards[0].payloads.at(-1).type, 'cosmetic');
    source = { ...source, revision: 'changed' };
    await container.querySelector('[data-cosmetic-action="apply"]').onclick();
    assert.equal(writes, 1);
    assert.match(container.textContent, /draft changed/);
    const stale = container.querySelector('[data-cosmetic-action="apply"]').onclick;
    editor.dispose();
    await stale();
    assert.equal(writes, 1);
    assert.equal(container.children.length, 0);
  }
});

test('compiler admits exact selected raster closure and rejects stale recipe pins, wrong MIME and absent bodies', async () => {
  const f = await fixture(),
    candidate = editDiscoveryCosmetic(f.source, [f.reward], f.reward.id, f.payload, f.context);
  const files = new Map(
    [...f.files].map(([path, value]) => [path, Buffer.from(JSON.stringify(value))]),
  );
  files.set(f.campaign.sourcePath, Buffer.from(JSON.stringify(candidate.source)));
  files.set(f.campaign.rewardPath, Buffer.from(JSON.stringify(candidate.rewards)));
  files.set(f.asset.path, f.image);
  files.set(
    'game/company.html',
    Buffer.from('<!doctype html><html><head><title>Fixture</title></head><body></body></html>'),
  );
  const compile = (overrides = {}) =>
    compileEdition({
      catalog: f.catalog,
      editionIds: [f.edition.id],
      files,
      enginePaths: ['game/company.html'],
      ...overrides,
    });
  const built = await compile();
  assert.ok(built.files.has(f.asset.path));
  const altered = structuredClone(candidate.rewards);
  altered[0].payloads.at(-1).recipeRevision = 'stale';
  await assert.rejects(
    compile({
      files: new Map([...files, [f.campaign.rewardPath, Buffer.from(JSON.stringify(altered))]]),
    }),
    /exact reward character/,
  );
  const removed = structuredClone(f.files.get(f.edition.boot.presets));
  removed.rewardCharacters = [];
  await assert.rejects(
    compile({
      files: new Map([...files, [f.edition.boot.presets, Buffer.from(JSON.stringify(removed))]]),
    }),
    /exact reward character/,
  );
  const invalidBytes = new Uint8Array(f.image.length),
    changedCatalog = structuredClone(f.catalog),
    changedAsset = changedCatalog.assets.find((entry) => entry.id === f.asset.id);
  changedAsset.sha256 = createHash('sha256').update(invalidBytes).digest('hex');
  const changedContext = discoveryCosmeticContext({ ...f.contextSource, catalog: changedCatalog });
  const changedReward = structuredClone(candidate.rewards);
  changedReward[0].payloads.at(-1).recipeRevision = changedContext.registry[0].recipeRevision;
  await assert.rejects(
    compile({
      catalog: changedCatalog,
      files: new Map([
        ...files,
        [f.asset.path, invalidBytes],
        [f.campaign.rewardPath, Buffer.from(JSON.stringify(changedReward))],
      ]),
    }),
    /image|PNG|raster/i,
  );
});
