import { loadEditionBootstrap } from '../editions/bootstrap.mjs';
import { captureEditionPresentation } from '../editions/retained-presentation.mjs';
import { resolveEditionSelection } from '../editions/model.mjs';
import { loadRewardImage } from '../ui/reward-image.mjs';
import { createExpeditionEntries, mountEditionExpedition } from '../ui/edition-expedition.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { pngBytes } from './helpers/media-fixtures.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { createStudioReward } from '../../authoring/company-studio/reward-editor.mjs';
import { compileEdition } from '../../scripts/compile-edition.mjs';
import { companySourceDraft, companyDraftFiles } from '../../scripts/company-studio.mjs';
import { validatePublicSourceEligibility } from '../../publishing/edition-admission.mjs';
import { createRewardMissionBindings } from '../rewards/bindings.mjs';
import {
  validateCompletionReward,
  completionRewardAssetReferences,
  reconcileEarnedRewards,
  validateRewardState,
} from '../rewards/model.mjs';
import { editDiscoveryTeaser } from '../content-design/discovery-teaser.mjs';
import { editContentDiscovery } from '../content-design/discovery.mjs';
import { createTeaserRewardEditor } from '../studio/teaser-reward-editor.mjs';
import { mountLocalRewardTeaserPreview } from '../studio/reward-teaser-preview.mjs';
import { projectRewardExhibits } from '../rewards/exhibit.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const settle = async () => {
  for (let i = 0; i < 12; i++) await new Promise((r) => setTimeout(r, 2));
};
async function fixture() {
  const f = await editionProviderFixture(),
    catalog = structuredClone(f.catalog),
    descriptor = catalog.campaigns[0],
    bytes = pngBytes();
  const asset = {
    id: 'discovery-preview',
    path: 'game/editions/assets/sample/teaser.png',
    sha256: sha(bytes),
    bytes: bytes.length,
    approved: true,
    publication: 'public',
    dependencies: [],
  };
  catalog.assets.push(asset);
  descriptor.assetIds.push(asset.id);
  descriptor.rewardPath = 'game/content/sample/rewards.json';
  const original = createStudioReward({
    campaign: descriptor,
    source: f.source,
    id: 'discovery',
    rule: 'all-missions',
    locales: {
      en: { title: 'Discover', teaser: 'A separate preview', paragraph: 'Earned explanation.' },
      uk: { title: 'Відкрити', teaser: 'Окремий анонс', paragraph: 'Здобуте пояснення.' },
    },
  });
  const teaserImage = {
    asset: { assetId: asset.id, sha256: asset.sha256 },
    locales: { en: { alt: 'Closed museum doors' }, uk: { alt: 'Зачинені двері музею' } },
  };
  const source = editContentDiscovery(
    f.source,
    f.source.missions[0].id,
    {
      campaignId: descriptor.id,
      discovery: {
        exhibitLayout: 'gallery',
        finaleRewardRef: { id: original.id, revision: original.revision },
      },
    },
    [original],
  );
  const edited = editDiscoveryTeaser(source, [original], original.id, teaserImage),
    reward = edited.rewards[0];
  const files = new Map(
    [...f.files]
      .filter(([name]) => !name.endsWith('catalog.json'))
      .map(([name, value]) => [name, Buffer.from(JSON.stringify(value))]),
  );
  files.set(descriptor.sourcePath, Buffer.from(JSON.stringify(edited.source)));
  files.set(descriptor.rewardPath, Buffer.from(JSON.stringify(edited.rewards)));
  files.set(asset.path, bytes);
  files.set(
    'game/company.html',
    Buffer.from('<!doctype html><html><head></head><body>Game</body></html>'),
  );
  return {
    ...f,
    catalog,
    descriptor,
    asset,
    bytes,
    original,
    source,
    ...edited,
    reward,
    teaserImage,
    files,
    build: () =>
      compileEdition({
        catalog,
        editionIds: [catalog.editions[0].id],
        files,
        enginePaths: ['game/company.html'],
      }),
  };
}

test('teasers require both localized descriptions and independent exact art; legacy data stays unchanged', async () => {
  const f = await fixture();
  assert.equal(JSON.stringify(validateCompletionReward(f.original)), JSON.stringify(f.original));
  assert.deepEqual(completionRewardAssetReferences([f.reward]), [f.teaserImage.asset]);
  for (const change of [
    (x) => delete x.teaserImage.locales.uk,
    (x) => (x.teaserImage.locales.en.alt = ''),
    (x) => (x.teaserImage.url = 'https://unadmitted.invalid/image.png'),
    (x) => (x.teaserImage.asset.sha256 = 'latest'),
    (x) =>
      x.payloads.push({
        id: 'earned-art',
        type: 'image',
        asset: x.teaserImage.asset,
        locales: {
          en: { title: 'Earned', alt: 'Earned' },
          uk: { title: 'Здобуто', alt: 'Здобуто' },
        },
      }),
    (x) =>
      x.payloads.push({
        id: 'alias',
        type: 'image',
        asset: { assetId: 'renamed-final', sha256: x.teaserImage.asset.sha256 },
        locales: {
          en: { title: 'Earned', alt: 'Earned' },
          uk: { title: 'Здобуто', alt: 'Здобуто' },
        },
      }),
  ]) {
    const value = structuredClone(f.reward);
    change(value);
    assert.throws(() => validateCompletionReward(value));
  }
});

test('teaser edits rebind authored presentation only; promised and earned revisions survive import', async () => {
  const f = await fixture();
  assert.deepEqual(
    createRewardMissionBindings(f.source),
    createRewardMissionBindings(f.project.source),
  );
  assert.deepEqual(f.reward.requirements, f.original.requirements);
  assert.equal(f.source.campaigns[0].discovery.finaleRewardRef.revision, f.reward.revision);
  const context = {
    editionId: f.catalog.editions[0].id,
    brandId: f.descriptor.brandId,
    campaignIds: [f.descriptor.id],
    clears: {},
    learning: [],
    mastery: [],
  };
  const locked = reconcileEarnedRewards([f.reward], context).state;
  const future = editDiscoveryTeaser(f.source, [f.reward], f.reward.id, {
    ...f.teaserImage,
    asset: { assetId: 'future-preview', sha256: 'a'.repeat(64) },
  });
  for (const mission of f.reward.requirements.missions)
    context.clears[mission.missionId] = {
      runId: 'accepted-' + mission.missionId,
      ...mission.bindings[0],
    };
  const update = reconcileEarnedRewards(future.rewards, context, locked);
  assert.equal(update.granted.length, 1);
  assert.deepEqual(update.granted[0].definition.teaserImage, f.teaserImage);
  assert.deepEqual(
    validateRewardState(JSON.stringify(update.state)).receipts[0].definition,
    f.reward,
  );
  assert.equal(reconcileEarnedRewards(future.rewards, context, update.state).granted.length, 0);
  const removed = editDiscoveryTeaser(f.source, [f.reward], f.reward.id, null);
  assert.equal(Object.hasOwn(removed.rewards[0], 'teaserImage'), false);
  assert.deepEqual(
    createRewardMissionBindings(removed.source),
    createRewardMissionBindings(f.source),
  );
});

test('compiled and source draft round trips include admitted teaser bytes and reject missing/private/corrupt media', async () => {
  const f = await fixture(),
    built = await f.build();
  assert.deepEqual(built.files.get(f.asset.path), f.bytes);
  const roundTrip = companyDraftFiles(companySourceDraft({ catalog: f.catalog, files: f.files }));
  assert.deepEqual(JSON.parse(roundTrip.files.get(f.descriptor.rewardPath)), f.rewards);
  validatePublicSourceEligibility({
    files: new Map([[f.asset.path, f.bytes]]),
    assets: f.catalog.assets,
  });
  f.files.set(f.asset.path, Buffer.alloc(f.bytes.length));
  await assert.rejects(f.build(), /SHA-256/);
  f.files.set(f.asset.path, f.bytes);
  f.asset.publication = 'restricted';
  await assert.rejects(f.build(), /public|publication/);
  f.asset.publication = 'public';
  f.descriptor.assetIds = [];
  await assert.rejects(f.build(), /closure|asset/);
});

test('locked Collection projection carries only separately authored teaser refs', async () => {
  const f = await fixture(),
    rows = projectRewardExhibits({
      campaigns: f.source.campaigns,
      definitions: [f.reward],
      receipts: [],
      progress: [],
    })[0].rows;
  assert.deepEqual(rows[0].teaserImage, f.teaserImage);
  assert.equal(rows[0].image, null);
  assert.equal(rows[0].receipt, null);
  assert.equal(JSON.stringify(rows).includes('Earned explanation.'), false);
});

function harness() {
  const doc = new Document(),
    win = new Events(),
    container = doc.createElement('section'),
    urls = new Map();
  doc.body.append(container);
  let serial = 0;
  win.URL = {
    createObjectURL: (blob) => {
      const id = 'blob:teaser-' + serial++;
      urls.set(id, blob);
      return id;
    },
    revokeObjectURL: (id) => urls.delete(id),
  };
  return { doc, win, container, urls };
}

test('local teaser preview verifies hash before showing art and releases every resource across twenty cycles', async () => {
  const f = await fixture(),
    h = harness();
  for (let i = 0; i < 20; i++) {
    const preview = mountLocalRewardTeaserPreview({
      container: h.container,
      teaserImage: f.teaserImage,
      locale: 'uk',
      window: h.win,
    });
    const input = h.container.querySelector('input');
    input.files = [
      {
        name: 'teaser.png',
        size: f.bytes.length,
        arrayBuffer: async () => Buffer.alloc(f.bytes.length),
      },
    ];
    input.emit('change');
    await settle();
    assert.equal(h.urls.size, 0);
    assert.equal(h.container.querySelector('img'), null);
    input.files = [{ name: 'teaser.png', size: f.bytes.length, arrayBuffer: async () => f.bytes }];
    input.emit('change');
    await settle();
    assert.equal(h.urls.size, 1);
    assert.equal(h.container.querySelector('img').alt, f.teaserImage.locales.uk.alt);
    preview.dispose();
    assert.equal(h.urls.size, 0);
    assert.equal(h.container.children.length, 0);
  }
});

test('disposing a pending local teaser read prevents late images and object URLs', async () => {
  const f = await fixture(),
    h = harness();
  let finish;
  const preview = mountLocalRewardTeaserPreview({
    container: h.container,
    teaserImage: f.teaserImage,
    window: h.win,
  });
  const input = h.container.querySelector('input');
  input.files = [
    {
      name: 'teaser.png',
      size: f.bytes.length,
      arrayBuffer: () => new Promise((r) => (finish = r)),
    },
  ];
  input.emit('change');
  preview.dispose();
  finish(f.bytes);
  await settle();
  assert.equal(h.urls.size, 0);
  assert.equal(h.container.children.length, 0);
});

test('shared Studio editor previews without changing drafts and applies/removes only explicitly', async () => {
  const f = await fixture(),
    h = harness();
  let draft = { source: f.source, rewards: [f.original] },
    writes = 0;
  // Start with the matching pre-teaser authored reference.
  draft.source = editContentDiscovery(
    f.source,
    f.source.missions[0].id,
    {
      campaignId: f.descriptor.id,
      discovery: {
        exhibitLayout: 'gallery',
        finaleRewardRef: { id: f.original.id, revision: f.original.revision },
      },
    },
    draft.rewards,
  );
  const originalBindings = createRewardMissionBindings(draft.source);
  const editor = createTeaserRewardEditor({
    container: h.container,
    window: h.win,
    getSource: () => draft.source,
    getRewards: () => draft.rewards,
    getLocale: () => 'en',
    apply: (value) => {
      draft = value;
      writes++;
    },
  });
  editor.sync();
  const field = (key) => h.container.querySelector(`[data-teaser-field="${key}"]`);
  const action = (key) => h.container.querySelector(`[data-teaser-action="${key}"]`);
  field('assetId').value = f.asset.id;
  field('sha256').value = f.asset.sha256;
  field('enAlt').value = f.teaserImage.locales.en.alt;
  field('ukAlt').value = f.teaserImage.locales.uk.alt;
  await action('preview').onclick();
  assert.equal(writes, 0);
  await action('apply').onclick();
  assert.equal(writes, 1);
  assert.deepEqual(draft.rewards[0].teaserImage, f.teaserImage);
  assert.deepEqual(createRewardMissionBindings(draft.source), originalBindings);
  await action('remove').onclick();
  assert.equal(writes, 2);
  assert.equal(Object.hasOwn(draft.rewards[0], 'teaserImage'), false);
  editor.dispose();
  assert.equal(h.container.children.length, 0);
});

test('registered retained presentations restore promised teaser bytes and verify them during export', async (t) => {
  const f = await fixture(),
    id = f.catalog.editions[0].id,
    rootURL = 'https://fixture.invalid/';
  const requests = [];
  const fetcher = async (url) => {
    const path = new URL(url).pathname.slice(1);
    requests.push(path);
    return path === 'edition-catalog.json'
      ? new Response(JSON.stringify(f.catalog))
      : f.files.has(path)
        ? new Response(f.files.get(path))
        : new Response('', { status: 404 });
  };
  t.mock.method(globalThis, 'fetch', fetcher);
  const load = () =>
    loadEditionBootstrap({
      fetcher,
      catalogURL: rootURL + 'edition-catalog.json',
      contentBaseURL: rootURL,
      editionId: id,
      allowMissing: false,
    });
  const snapshot = await captureEditionPresentation(await load()),
    serialized = Buffer.from(JSON.stringify(snapshot));
  const history = {
    id: snapshot.authoredPresentationSha256,
    path: 'game/editions/retained/sample/original.json',
    bytes: serialized.length,
    sha256: sha(serialized),
  };
  f.files.set(history.path, serialized);
  f.catalog.editions[0].presentationHistory = [history];
  f.catalog.editions[0].revision++;
  const oldAsset = structuredClone(f.asset),
    oldTeaser = structuredClone(f.teaserImage);
  f.asset.id = 'replacement-preview';
  f.asset.path = 'game/editions/assets/sample/replacement.png';
  f.descriptor.assetIds = [f.asset.id];
  f.files.set(f.asset.path, f.bytes);
  const next = editDiscoveryTeaser(f.source, f.rewards, f.reward.id, {
    ...f.teaserImage,
    asset: { assetId: f.asset.id, sha256: f.asset.sha256 },
  });
  f.files.set(f.descriptor.sourcePath, Buffer.from(JSON.stringify(next.source)));
  f.files.set(f.descriptor.rewardPath, Buffer.from(JSON.stringify(next.rewards)));
  const bootstrap = await load(),
    h = harness(),
    controller = new AbortController();
  const release = await loadRewardImage({
    container: h.container,
    image: oldTeaser,
    provider: { editionId: id, rootURL, bootstrap, catalog: f.catalog },
    signal: controller.signal,
    URLImpl: h.win.URL,
    inspect: true,
  });
  assert.equal(h.urls.size, 1);
  assert(requests.includes(history.path));
  assert(requests.includes(oldAsset.path));
  release();
  assert.equal(h.urls.size, 0);
  const built = await f.build();
  assert(built.files.has(oldAsset.path));
  assert(built.files.has(f.asset.path));
  f.files.set(oldAsset.path, Buffer.alloc(oldAsset.bytes));
  await assert.rejects(f.build(), /SHA-256/);
});

test('campaign selector explicitly previews one pinned finale, releases it on close and never launches a mission', async (t) => {
  const f = await fixture(),
    h = harness(),
    id = f.catalog.editions[0].id;
  const provider = {
    editionId: id,
    route: { id, source: f.source },
    rewards: f.rewards,
    rootURL: 'https://fixture.invalid/',
    catalog: f.catalog,
    selection: resolveEditionSelection(f.catalog, { editionId: id }),
    bootstrap: {
      catalog: f.catalog,
      selection: resolveEditionSelection(f.catalog, { editionId: id }),
    },
  };
  const chooser = h.doc.createElement('dialog'),
    cards = h.doc.createElement('div');
  chooser.id = 'journey-chooser';
  cards.id = 'journey-cards';
  chooser.append(cards);
  h.doc.body.append(chooser);
  let launches = 0,
    requests = 0;
  for (const mission of createExpeditionEntries(provider)[0].missions) {
    const card = h.doc.createElement('button');
    card.dataset.missionId = mission.aliases[0].libraryId;
    card.onclick = () => launches++;
    cards.append(card);
  }
  t.mock.method(globalThis, 'fetch', async (url) => {
    requests++;
    assert(new URL(url).pathname.endsWith('teaser.png'));
    return new Response(f.bytes);
  });
  chooser.showModal();
  const view = mountEditionExpedition({ provider, document: h.doc, window: h.win });
  assert.equal(requests, 0);
  for (let cycle = 0; cycle < 20; cycle++) {
    chooser.showModal();
    view.refresh();
    h.doc.querySelector('[data-expedition-teaser="discovery"]').click();
    await settle();
    assert.equal(h.urls.size, 1);
    chooser.close();
    assert.equal(h.urls.size, 0);
  }
  assert.equal(requests, 20);
  assert.equal(launches, 0);
  view.dispose();
  assert.equal(h.urls.size, 0);
});
