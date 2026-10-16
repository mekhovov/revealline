import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  CURRICULUM_TEXTILE_LIGHTING_FILES,
  CURRICULUM_TEXTILE_LIGHTING_ASSET_IDS,
  createCurriculumTextileLighting,
} from '../company-campaigns/curriculum-textile-lighting.mjs';
import { inspectRewardMediaBytes } from '../rewards/media-format.mjs';
import { validateCompletionReward, completionRewardAssetReferences } from '../rewards/model.mjs';
import { createExplorationState, applyExplorationAction } from '../rewards/exploration.mjs';
import { mountDiscoveryExploration } from '../ui/discovery-exploration.mjs';
import { Document } from './helpers/couch-dom.mjs';
const root = new URL('../../', import.meta.url);
const json = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const assets = CURRICULUM_TEXTILE_LIGHTING_FILES.map((row) => ({
  ...row,
  approved: true,
  publication: 'public',
  dependencies: [],
}));
const payload = () => createCurriculumTextileLighting('ukraine-threads-03', assets)[0];
const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

test('White on White comparison uses exact supported originals and rejects substituted or unapproved studies', async () => {
  let total = 0;
  for (const asset of assets) {
    const bytes = await readFile(new URL(asset.path, root));
    assert.equal(bytes.length, asset.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], [1536, 1024]);
    inspectRewardMediaBytes(asset, 'poster', bytes);
    assert(bytes.length <= 4 * 1024 * 1024);
    total += bytes.length;
  }
  assert.equal(total, 9594047);
  assert.equal(new Set(assets.map((row) => row.sha256)).size, 3);
  for (const mutation of [
    (row) => {
      row.sha256 = '0'.repeat(64);
    },
    (row) => {
      row.publication = 'private';
    },
    (row) => {
      row.approved = false;
    },
  ]) {
    const wrong = structuredClone(assets);
    mutation(wrong[0]);
    assert.throws(
      () => createCurriculumTextileLighting('ukraine-threads-03', wrong),
      /exact reviewed/,
    );
  }
  assert.deepEqual(createCurriculumTextileLighting('ukraine-threads-02', []), []);
});

test('the authored comparison preserves the existing win and never creates learning evidence', async () => {
  const value = payload(),
    recipe = value.recipe;
  assert.equal(recipe.id, 'inspect-compare-atlas');
  assert.equal(recipe.cards.length, 3);
  for (const locale of ['en', 'uk']) {
    for (const card of recipe.cards) {
      assert(card.locales[locale].alt.length > 60);
      assert(card.sourceIds.every((id) => recipe.sources.some((source) => source.id === id)));
    }
  }
  assert.match(value.locales.en.intro, /vary slightly/);
  assert.match(recipe.cards[2].locales.en.sourceNote, /generated separately/);
  const original = (await json('game/content/company-campaigns/ukraine-threads.rewards.json')).find(
    (row) => row.scope.id === 'ukraine-threads-03',
  );
  const candidate = validateCompletionReward({
    ...original,
    payloads: [...original.payloads.filter((p) => p.id !== value.id), value],
  });
  assert.deepEqual(candidate.requirements, original.requirements);
  assert.equal(candidate.requirements.missions.length, 1);
  for (const id of CURRICULUM_TEXTILE_LIGHTING_ASSET_IDS)
    assert(completionRewardAssetReferences([candidate]).some((ref) => ref.assetId === id));
  let state = createExplorationState(recipe);
  state = applyExplorationAction(recipe, state, { type: 'inspect', cardId: 'left' });
  assert.deepEqual(state.selectedCardIds, ['diffuse', 'left']);
  state = applyExplorationAction(recipe, state, { type: 'inspect', cardId: 'right' });
  assert.deepEqual(state.selectedCardIds, ['left', 'right']);
  state = applyExplorationAction(recipe, state, {
    type: 'predict',
    predictionId: 'shadow-or-dye',
    choiceId: 'assume-dye',
  });
  assert.equal(state.answers['shadow-or-dye'], 'assume-dye');
  state = applyExplorationAction(recipe, state, {
    type: 'predict',
    predictionId: 'shadow-or-dye',
    choiceId: 'compare-light',
  });
  assert.equal(state.answers['shadow-or-dye'], 'compare-light');
  assert.equal(Object.hasOwn(state, 'completed'), false);
  assert.deepEqual(createExplorationState(recipe).answers, {});
});

test('the three authored studies share the existing Ukrainian comparison controls and bounded media ownership', async () => {
  const doc = new Document(),
    container = doc.createElement('section'),
    live = new Set();
  doc.body.append(container);
  let loads = 0,
    releases = 0;
  const view = mountDiscoveryExploration({
    container,
    payload: payload(),
    locale: 'uk',
    loadImage: async (image, target) => {
      const expected = assets.find((row) => row.id === image.asset.assetId);
      assert.equal(image.asset.sha256, expected.sha256);
      assert(!live.has(expected.id));
      live.add(expected.id);
      loads++;
      const img = doc.createElement('img');
      img.alt = image.locales.uk.alt;
      target.append(img);
      return () => {
        live.delete(expected.id);
        releases++;
      };
    },
  });
  await settle();
  const diffuse = container.querySelector('[data-card-id="diffuse"]'),
    left = container.querySelector('[data-card-id="left"]'),
    right = container.querySelector('[data-card-id="right"]');
  diffuse.focus();
  diffuse.emit('keydown', { key: 'ArrowRight' });
  assert.equal(doc.activeElement, left);
  left.emit('click');
  await settle();
  assert.equal(live.size, 2);
  right.emit('click');
  await settle();
  assert.equal(live.size, 2);
  assert.equal(loads, 3);
  assert.equal(releases, 1);
  assert.equal(left.getAttribute('aria-pressed'), 'true');
  assert.equal(right.getAttribute('aria-pressed'), 'true');
  view.dispose();
  assert.equal(live.size, 0);
  assert.equal(releases, 3);
});

test('the selected Ukraine asset closure including the studies stays within the edition budget', async () => {
  const c = await json('game/editions/catalog.json'),
    e = c.editions.find((row) => row.id === 'ukraine-culture'),
    b = c.brands.find((row) => row.id === e.brandId);
  const inventory = new Map([...c.assets, ...assets].map((row) => [row.id, row])),
    selected = new Set();
  const add = (id) => {
    if (!id || selected.has(id)) return;
    selected.add(id);
    const row = inventory.get(id);
    assert(row);
    for (const d of row.dependencies ?? []) add(d);
  };
  [
    ...b.assetIds,
    b.logoAssetId,
    b.heroAssetId,
    b.iconAssetId,
    b.fontAssetId,
    ...c.campaigns.filter((row) => e.campaignIds.includes(row.id)).flatMap((row) => row.assetIds),
    ...CURRICULUM_TEXTILE_LIGHTING_ASSET_IDS,
  ].forEach(add);
  const bytes = [...selected].reduce((sum, id) => sum + inventory.get(id).bytes, 0);
  assert(bytes < 32 * 1024 * 1024);
});
