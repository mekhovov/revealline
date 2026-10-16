import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createExplorationExample } from '../studio/exploration-example.mjs';
import {
  validateExplorationPayload,
  createExplorationState,
  applyExplorationAction,
} from '../rewards/exploration.mjs';
import {
  completionRewardAssetReferences,
  validateCompletionReward,
  projectRewardProgress,
} from '../rewards/model.mjs';
import { mountDiscoveryExploration } from '../ui/discovery-exploration.mjs';
import { createExplorationEditor } from '../studio/exploration-editor.mjs';
import { editDiscoveryExploration } from '../content-design/discovery.mjs';
import { createRewardMissionBindings } from '../rewards/bindings.mjs';
import {
  createStudioReward,
  rebindStudioRewardLocalization,
} from '../../authoring/company-studio/reward-editor.mjs';
import {
  createCampaignLocalization,
  validateCampaignLocalization,
} from '../editions/localization.mjs';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { compileEdition } from '../../scripts/compile-edition.mjs';
import { companyDraftFiles, companySourceDraft } from '../../scripts/company-studio.mjs';

const clone = (value) => structuredClone(value),
  sha = (value) => createHash('sha256').update(value).digest('hex');
const settles = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
async function fixture() {
  const f = await editionProviderFixture(),
    catalog = clone(f.catalog),
    descriptor = catalog.campaigns[0];
  descriptor.rewardPath = 'game/content/sample/rewards.json';
  const reward = createStudioReward({
    campaign: descriptor,
    source: f.source,
    id: 'atlas-reward',
    rule: 'all-missions',
    locales: {
      en: {
        title: 'An atlas',
        teaser: 'Compare two roles after this journey.',
        paragraph: 'A fictional teaching model.',
      },
      uk: {
        title: 'Атлас',
        teaser: 'Порівняйте дві ролі після цієї подорожі.',
        paragraph: 'Вигадана навчальна модель.',
      },
    },
  });
  const files = new Map(
    [...f.files]
      .filter(([name]) => !name.endsWith('catalog.json'))
      .map(([name, value]) => [name, Buffer.from(JSON.stringify(value))]),
  );
  files.set(descriptor.rewardPath, Buffer.from(JSON.stringify([reward])));
  files.set(
    'game/company.html',
    Buffer.from('<!doctype html><html><head></head><body>Game</body></html>'),
  );
  return { ...f, catalog, descriptor, reward, files };
}

test('registered atlas schema is bounded, bilingual and rejects code, unsafe sources and unknown choices', () => {
  const payload = createExplorationExample();
  assert.deepEqual(validateExplorationPayload(payload), payload);
  for (const change of [
    (p) => p.recipe.revision++,
    (p) => {
      p.recipe.code = 'run()';
    },
    (p) => {
      p.recipe.cards = [p.recipe.cards[0]];
    },
    (p) => {
      p.recipe.cards[0].locales.uk.body = '';
    },
    (p) => {
      p.recipe.cards[0].sourceIds = ['missing'];
    },
    (p) => {
      p.recipe.sources[0].url = 'javascript:alert(1)';
    },
    (p) => {
      p.recipe.predictions[0].expectedChoiceId = 'missing';
    },
    (p) => {
      p.recipe.predictions[0].cardIds = ['foreign'];
    },
    (p) => {
      p.recipe.predictions[0].choices[0].locales.en.feedback = '';
    },
    (p) => {
      p.recipe.cards[0].asset = { assetId: 'picture', sha256: 'a'.repeat(64) };
    },
    (p) => {
      p.locales.en.intro = 'x'.repeat(2049);
    },
  ]) {
    const changed = clone(payload);
    change(changed);
    assert.throws(() => validateExplorationPayload(changed));
  }
});

test('bounded exercise actions recompute answers without score, mastery, timers or mutation', () => {
  const recipe = createExplorationExample().recipe,
    initial = createExplorationState(recipe),
    before = JSON.stringify(initial);
  let state = applyExplorationAction(recipe, initial, {
    type: 'inspect',
    cardId: 'video-transmitter',
  });
  assert.deepEqual(state.selectedCardIds, ['camera', 'video-transmitter']);
  state = applyExplorationAction(recipe, state, {
    type: 'predict',
    predictionId: 'missing-role',
    choiceId: 'observation',
  });
  assert.equal(state.answers['missing-role'], 'observation');
  state = applyExplorationAction(recipe, state, {
    type: 'predict',
    predictionId: 'missing-role',
    choiceId: 'transmission',
  });
  assert.equal(state.answers['missing-role'], 'transmission');
  assert.equal(JSON.stringify(initial), before);
  assert.deepEqual(Object.keys(state).sort(), [
    'answers',
    'format',
    'recipeIdentity',
    'selectedCardIds',
  ]);
  for (const action of [
    { type: 'complete' },
    { type: 'predict', predictionId: 'missing-role', choiceId: 'foreign' },
    { type: 'inspect', cardId: 'camera', points: 100 },
  ])
    assert.throws(() => applyExplorationAction(recipe, state, action));
  assert.throws(() =>
    applyExplorationAction(recipe, { ...state, completed: true }, { type: 'reset' }),
  );
  assert.deepEqual(applyExplorationAction(recipe, state, { type: 'reset' }), initial);
});

test('keyboard comparison and causal feedback use safe text and leave no mounted listeners or media after disposal', async () => {
  const document = new Document(),
    container = document.createElement('div');
  document.body.append(container);
  const payload = clone(createExplorationExample());
  payload.recipe.cards[0].locales.en.body = '<script>not executable</script>';
  payload.recipe.cards[0].asset = { assetId: 'diagram', sha256: 'a'.repeat(64) };
  for (const locale of ['en', 'uk'])
    payload.recipe.cards[0].locales[locale].alt = 'Fixture diagram';
  let live = 0,
    reads = 0;
  const viewer = mountDiscoveryExploration({
    container,
    payload,
    loadImage: async (_image, _node, { signal }) => {
      assert.equal(signal.aborted, false);
      reads++;
      live++;
      return () => live--;
    },
  });
  await settles();
  assert.equal(live, 1);
  assert(container.textContent.includes('<script>not executable</script>'));
  assert.equal(container.querySelectorAll('script').length, 0);
  const camera = container.querySelector('[data-card-id="camera"]'),
    vtx = container.querySelector('[data-card-id="video-transmitter"]');
  camera.focus();
  const key = camera.emit('keydown', { key: 'ArrowRight' });
  assert.equal(key.defaultPrevented, true);
  assert.equal(document.activeElement, vtx);
  vtx.emit('click');
  assert.equal(container.querySelectorAll('article').length, 2);
  assert.equal(reads, 1, 'unchanged selected cards retain their one media owner');
  const wrong = container.querySelector('[data-choice-id="observation"]'),
    right = container.querySelector('[data-choice-id="transmission"]');
  wrong.emit('click');
  assert(
    container.textContent.includes(payload.recipe.predictions[0].choices[0].locales.en.feedback),
  );
  right.emit('click');
  assert(
    container.textContent.includes(payload.recipe.predictions[0].choices[1].locales.en.feedback),
  );
  assert.equal(container.querySelector('[data-outcome="supported"]')?.dataset.outcome, 'supported');
  container.querySelector('[data-exploration-action="reset"]').emit('click');
  assert.equal(container.querySelector('[data-outcome="supported"]'), null);
  vtx.emit('click');
  for (let i = 0; i < 20; i++) {
    camera.emit('click');
    await settles();
    camera.emit('click');
    await settles();
    assert.equal(live, 1);
  }
  viewer.dispose();
  assert.equal(live, 0);
  assert.equal(container.children.length, 0);
  camera.emit('click');
  assert.equal(container.children.length, 0);
});

test('Ukrainian preview preserves all content and cancels a pending media owner', async () => {
  const document = new Document(),
    container = document.createElement('div'),
    payload = clone(createExplorationExample());
  document.body.append(container);
  payload.recipe.cards[0].asset = { assetId: 'diagram', sha256: 'a'.repeat(64) };
  for (const locale of ['en', 'uk']) payload.recipe.cards[0].locales[locale].alt = 'Fixture';
  let resolve,
    released = 0,
    signal;
  const viewer = mountDiscoveryExploration({
    container,
    payload,
    locale: 'uk',
    loadImage: (_p, _n, options) => {
      signal = options.signal;
      return new Promise((done) => {
        resolve = done;
      });
    },
  });
  await settles();
  assert(container.textContent.includes(payload.recipe.cards[0].locales.uk.body));
  viewer.dispose();
  assert.equal(signal.aborted, true);
  resolve(() => released++);
  await settles();
  assert.equal(released, 1);
});

test('authoring revisions rebind exact promises and localization while retaining gameplay and completion requirements', async () => {
  const f = await fixture(),
    source = clone(f.source);
  source.campaigns[0].discovery = {
    exhibitLayout: 'gallery',
    finaleRewardRef: { id: f.reward.id, revision: f.reward.revision },
  };
  const localization = createCampaignLocalization({
    source,
    campaignId: f.descriptor.id,
    campaignLocales: { uk: { name: 'Атлас' } },
    missionLocales: Object.fromEntries(
      source.missions.map((mission) => [
        mission.id,
        {
          uk: {
            name: 'Місія',
            brief: 'Уважно прокладіть маршрут.',
            routeDecision: 'Оберіть шлях.',
          },
        },
      ]),
    ),
  });
  const candidate = editDiscoveryExploration(
    source,
    [f.reward],
    f.reward.id,
    createExplorationExample(),
  );
  assert.notEqual(candidate.rewards[0].revision, f.reward.revision);
  assert.equal(
    candidate.source.campaigns[0].discovery.finaleRewardRef.revision,
    candidate.rewards[0].revision,
  );
  assert.deepEqual(candidate.rewards[0].requirements, f.reward.requirements);
  assert.deepEqual(
    createRewardMissionBindings(candidate.source),
    createRewardMissionBindings(source),
  );
  const rebound = await rebindStudioRewardLocalization({
    localization,
    source: candidate.source,
    descriptor: f.descriptor,
  });
  assert.deepEqual(
    validateCampaignLocalization(rebound.localization, candidate.source, f.descriptor),
    rebound.localization,
  );
  assert.equal(rebound.localization.records[0].fields.name.uk, 'Атлас');
  assert.equal(
    projectRewardProgress(candidate.rewards[0], {
      editionId: f.catalog.editions[0].id,
      brandId: f.descriptor.brandId,
      campaignIds: [f.descriptor.id],
      clears: {},
      learning: [],
      mastery: [],
    }).eligible,
    false,
  );
});

test('selected edition compilation and Company Studio roundtrip preserve atlas languages and exact media closure', async () => {
  const f = await fixture(),
    payload = clone(createExplorationExample()),
    bytes = Buffer.from('approved raster fixture'),
    asset = {
      id: 'atlas-card',
      path: 'game/editions/assets/atlas-card.webp',
      sha256: sha(bytes),
      bytes: bytes.length,
      publication: 'public',
      approved: true,
      dependencies: [],
    };
  payload.recipe.cards[0].asset = { assetId: asset.id, sha256: asset.sha256 };
  for (const locale of ['en', 'uk'])
    payload.recipe.cards[0].locales[locale].alt = 'An injected card picture';
  const reward = validateCompletionReward({ ...f.reward, payloads: [payload] });
  f.catalog.assets.push(asset);
  f.descriptor.assetIds.push(asset.id);
  f.files.set(asset.path, bytes);
  f.files.set(f.descriptor.rewardPath, Buffer.from(JSON.stringify([reward])));
  assert.deepEqual(completionRewardAssetReferences([reward]), [payload.recipe.cards[0].asset]);
  const build = () =>
    compileEdition({
      catalog: f.catalog,
      editionIds: [f.catalog.editions[0].id],
      files: f.files,
      enginePaths: ['game/company.html'],
    });
  const result = await build();
  assert.deepEqual(JSON.parse(result.files.get(f.descriptor.rewardPath)), [reward]);
  assert.deepEqual(result.files.get(asset.path), bytes);
  const restored = companyDraftFiles(companySourceDraft(f));
  assert.deepEqual(JSON.parse(restored.files.get(f.descriptor.rewardPath)), [reward]);
  const changed = clone(reward);
  changed.payloads[0].recipe.cards[0].asset.sha256 = '0'.repeat(64);
  f.files.set(f.descriptor.rewardPath, Buffer.from(JSON.stringify([changed])));
  await assert.rejects(build(), /approved asset closure/);
  changed.payloads[0].recipe.cards[0].asset.sha256 = asset.sha256;
  asset.path = 'game/editions/assets/atlas-card.json';
  f.files.set(asset.path, bytes);
  f.files.set(f.descriptor.rewardPath, Buffer.from(JSON.stringify([changed])));
  await assert.rejects(build(), /supported raster/);
});

test('shared Studio controls preview without writes and explicitly apply and export an authored atlas', async () => {
  const f = await fixture(),
    document = new Document(),
    container = document.createElement('div');
  document.body.append(container);
  let source = f.source,
    rewards = [f.reward],
    writes = 0;
  const downloads = [],
    editor = createExplorationEditor({
      container,
      getSource: () => source,
      getRewards: () => rewards,
      apply: (next) => {
        source = next.source;
        rewards = next.rewards;
        writes++;
      },
      window: {
        URL: {
          createObjectURL: (blob) => {
            downloads.push(blob);
            return 'blob:preview';
          },
          revokeObjectURL() {},
        },
        setTimeout: (fn) => fn(),
      },
    });
  editor.sync();
  const action = (id) => container.querySelector(`[data-exploration-action="${id}"]`);
  await action('example').onclick();
  await action('preview').onclick();
  assert.equal(writes, 0);
  assert(container.querySelector('.discovery-exploration'));
  container.querySelector('[data-choice-id="transmission"]').emit('click');
  assert.equal(writes, 0);
  await action('apply').onclick();
  assert.equal(writes, 1);
  assert(rewards[0].payloads.some((item) => item.type === 'exploration'));
  await action('export').onclick();
  assert.equal(downloads.length, 1);
  assert.deepEqual(JSON.parse(await downloads[0].text()), rewards);
  editor.dispose();
  assert.equal(container.children.length, 0);
});
