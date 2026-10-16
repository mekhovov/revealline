import vm from 'node:vm';
import { parse } from 'acorn';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { pngBytes } from './helpers/media-fixtures.mjs';
import {
  validateCampaignDescriptor,
  validateEditionRuntimeCatalog,
  resolveEditionSelection,
} from '../editions/model.mjs';
import { withStudioCampaignHero } from '../../authoring/company-studio/model.mjs';
import { companySourceDraft, companyDraftFiles } from '../../scripts/company-studio.mjs';
import { compileEdition } from '../../scripts/compile-edition.mjs';
import { loadEditionBootstrap } from '../editions/bootstrap.mjs';
import {
  editionPresentationSha256,
  captureEditionPresentation,
  validateRetainedPresentation,
} from '../editions/retained-presentation.mjs';
import { canonicalJSON } from '../data-json.mjs';
import { projectEditionThemeSelection } from '../editions/selected-presentation.mjs';
import { mountEditionExpedition, createExpeditionEntries } from '../ui/edition-expedition.mjs';
import { Document } from './helpers/couch-dom.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function fixture() {
  const f = await editionProviderFixture(),
    catalog = structuredClone(f.catalog),
    bytes = pngBytes(),
    campaign = catalog.campaigns[0],
    sourceFiles = new Map(
      [...f.files]
        .filter(([name]) => !name.endsWith('catalog.json'))
        .map(([name, value]) => [name, Buffer.from(JSON.stringify(value))]),
    );
  for (const id of ['public-key', 'alternate-key', 'locked-finale']) {
    const asset = {
      id,
      path: `game/editions/assets/sample/${id}.png`,
      sha256: sha(bytes),
      bytes: bytes.length,
      approved: true,
      publication: 'public',
      dependencies: [],
    };
    catalog.assets.push(asset);
    campaign.assetIds.push(id);
    sourceFiles.set(asset.path, bytes);
  }
  sourceFiles.set(
    'game/company.html',
    Buffer.from('<!doctype html><html><head></head><body>Game</body></html>'),
  );
  const load = (source = catalog) =>
    loadEditionBootstrap({
      fetcher: async (url) =>
        new URL(url).pathname === '/edition-catalog.json'
          ? new Response(JSON.stringify(source))
          : new Response(sourceFiles.get(new URL(url).pathname.slice(1))),
      catalogURL: 'https://fixture.invalid/edition-catalog.json',
      contentBaseURL: 'https://fixture.invalid/',
      editionId: catalog.editions[0].id,
    });
  return { ...f, catalog, campaign, sourceFiles, load };
}

test('optional campaign artwork preserves old descriptor bytes and admits only declared raster roles', async () => {
  const f = await fixture(),
    before = JSON.stringify(f.campaign);
  assert.equal(JSON.stringify(validateCampaignDescriptor(f.campaign)), before);
  assert(!Object.hasOwn(validateCampaignDescriptor(f.campaign), 'heroAssetId'));
  const updated = withStudioCampaignHero(f.catalog, f.campaign.id, 'public-key');
  assert.equal(updated.campaigns[0].heroAssetId, 'public-key');
  assert.equal(updated.editions[0].revision, f.catalog.editions[0].revision + 1);
  assert.equal(f.campaign.heroAssetId, undefined);
  assert.deepEqual(withStudioCampaignHero(updated, f.campaign.id, 'public-key'), updated);
  assert(
    !Object.hasOwn(withStudioCampaignHero(updated, f.campaign.id, '').campaigns[0], 'heroAssetId'),
  );
  for (const invalid of ['unknown', 42, {}, false])
    assert.throws(
      () => withStudioCampaignHero(f.catalog, f.campaign.id, invalid),
      /Campaign artwork/,
    );
  const bad = structuredClone(updated);
  bad.assets[0].path = 'game/editions/assets/sample/not-an-image.svg';
  assert.throws(() => validateEditionRuntimeCatalog(bad), /static raster/);
});

test('campaign artwork survives Studio/export compilation and exact role assignments affect retained presentation identity only when present', async () => {
  const f = await fixture(),
    before = await f.load(),
    projected = projectEditionThemeSelection({
      brand: before.selection.brand,
      projects: [before.source],
      themes: before.boot.themes,
    });
  const legacy = {
    editionId: before.selection.edition.id,
    themes: projected.themes,
    presets: before.boot.presets,
    assets: f.catalog.assets
      .map(({ id, path, sha256, bytes }) => ({ id, path, sha256, bytes }))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
  };
  assert.equal(await editionPresentationSha256(before), sha(canonicalJSON(legacy)));
  const updated = withStudioCampaignHero(f.catalog, f.campaign.id, 'public-key'),
    bootstrap = await f.load(updated),
    snapshot = await captureEditionPresentation(bootstrap),
    first = await editionPresentationSha256(bootstrap);
  assert.notEqual(first, await editionPresentationSha256(before));
  const switched = withStudioCampaignHero(updated, f.campaign.id, 'alternate-key'),
    after = await f.load(switched);
  assert.notEqual(first, await editionPresentationSha256(after));
  const restored = await validateRetainedPresentation(snapshot, { edition: switched.editions[0] });
  assert.equal(restored.bootstrap.selection.campaigns[0].heroAssetId, 'public-key');
  const draft = companyDraftFiles(companySourceDraft({ catalog: updated, files: f.sourceFiles }));
  assert.equal(draft.catalog.campaigns[0].heroAssetId, 'public-key');
  const result = await compileEdition({
    catalog: draft.catalog,
    editionIds: [updated.editions[0].id],
    files: new Map([...f.sourceFiles, ...draft.files]),
    enginePaths: ['game/company.html'],
  });
  assert(result.files.has('game/editions/assets/sample/public-key.png'));
  assert.equal(
    JSON.parse(result.files.get('edition-catalog.json')).campaigns[0].heroAssetId,
    'public-key',
  );
  assert.deepEqual(bootstrap.source.missions, before.source.missions);
  const corrupted = structuredClone(updated),
    fake = Buffer.alloc(corrupted.assets[0].bytes);
  corrupted.assets[0].sha256 = sha(fake);
  const malformed = new Map(f.sourceFiles);
  malformed.set(corrupted.assets[0].path, fake);
  await assert.rejects(
    compileEdition({
      catalog: corrupted,
      editionIds: [corrupted.editions[0].id],
      files: malformed,
      enginePaths: ['game/company.html'],
    }),
    /bounded static raster/,
  );
});

test('expedition shows selected public campaign art without looking into locked payloads or replacing canonical buttons', async () => {
  const f = await fixture(),
    catalog = withStudioCampaignHero(f.catalog, f.campaign.id, 'public-key'),
    doc = new Document(),
    dialog = doc.createElement('dialog'),
    cards = doc.createElement('div'),
    requests = [];
  dialog.id = 'journey-chooser';
  cards.id = 'journey-cards';
  dialog.append(cards);
  doc.body.append(dialog);
  dialog.showModal();
  const provider = {
    editionId: catalog.editions[0].id,
    route: { id: catalog.editions[0].id, source: f.source },
    selection: resolveEditionSelection(catalog, { editionId: catalog.editions[0].id }),
    rewards: [],
    assetURL(id) {
      requests.push(id);
      return `https://fixture.invalid/${catalog.assets.find((a) => a.id === id).path}`;
    },
  };
  const original = doc.createElement('button');
  original.textContent = 'Launch canonical mission';
  original.dataset.missionId =
    createExpeditionEntries(provider)[0].missions[0].aliases[0].libraryId;
  cards.append(original);
  const view = mountEditionExpedition({ provider, document: doc, window: {} });
  view.refresh();
  const image = doc.querySelector('[data-campaign-hero="public-key"]');
  assert(image);
  assert.equal(image.loading, 'lazy');
  assert(image.alt.includes(f.source.campaigns[0].name));
  assert.deepEqual(requests, ['public-key']);
  assert.equal(cards.children[0], original);
  image.emit('error');
  assert(image.hidden);
  assert(
    doc
      .querySelector('.edition-expedition-campaign')
      .textContent.includes(f.source.campaigns[0].name),
  );
  view.dispose();
  assert.equal(doc.querySelector('[data-campaign-hero]'), null);
  const legacy = structuredClone(provider.selection);
  delete legacy.campaigns[0].heroAssetId;
  const old = mountEditionExpedition({
    provider: { ...provider, selection: legacy },
    document: doc,
    window: {},
  });
  old.refresh();
  assert.equal(doc.querySelector('[data-campaign-hero]'), null);
  old.dispose();
});

test('Company Studio actual picture callback previews and applies its explicit role while preserving pending catalog edits', async () => {
  const f = await fixture(),
    html = await readFile(
      new URL('../../authoring/company-studio/index.html', import.meta.url),
      'utf8',
    ),
    script = await readFile(
      new URL('../../authoring/company-studio/studio.mjs', import.meta.url),
      'utf8',
    ),
    tree = parse(script, { ecmaVersion: 'latest', sourceType: 'module' }),
    doc = new Document(),
    nodes = new Map();
  for (const id of ['campaign-art-form', 'campaign-hero-asset', 'campaign-hero-preview']) {
    assert(html.includes(`id="${id}"`));
    nodes.set(id, doc.createElement(id.endsWith('preview') ? 'img' : 'select'));
  }
  let submission;
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (
      value.type === 'AssignmentExpression' &&
      script.slice(value.left.start, value.left.end) === "$('campaign-art-form').onsubmit"
    )
      submission = value.right.arguments[0];
    for (const [key, child] of Object.entries(value))
      if (!['start', 'end'].includes(key))
        if (Array.isArray(child)) child.forEach(visit);
        else visit(child);
  }
  visit(tree);
  assert(submission);
  const context = vm.createContext({
    catalog: f.catalog,
    editorBuffers: new Map(),
    withStudioCampaignHero,
    $: (id) => nodes.get(id),
    rootURL: new URL('https://fixture.invalid/'),
    URL,
    selectedCampaign: () => context.catalog.campaigns[0],
    t: (key, values) => values?.name ?? key,
    applyCatalog: async (next) => {
      context.catalog = next;
    },
  });
  const submit = vm.runInContext(`(${script.slice(submission.start, submission.end)})`, context);
  const definition = tree.body.find(
    (node) => node.type === 'FunctionDeclaration' && node.id.name === 'renderCampaignHero',
  );
  const preview = vm.runInContext(`(${script.slice(definition.start, definition.end)})`, context);
  nodes.get('campaign-hero-asset').value = 'public-key';
  preview();
  assert.equal(nodes.get('campaign-hero-preview').hidden, false);
  assert.equal(nodes.get('campaign-hero-preview').alt, f.campaign.name);
  assert(nodes.get('campaign-hero-preview').src.endsWith('/public-key.png'));
  await submit({ preventDefault() {} });
  assert.equal(context.catalog.campaigns[0].heroAssetId, 'public-key');
  const applied = context.catalog;
  context.editorBuffers.set('catalog', 'unapplied');
  nodes.get('campaign-hero-asset').value = 'alternate-key';
  await assert.rejects(submit({ preventDefault() {} }), /pending catalog/);
  assert.equal(context.catalog, applied);
  context.editorBuffers.clear();
  nodes.get('campaign-hero-asset').value = '';
  await submit({ preventDefault() {} });
  preview();
  assert.equal(nodes.get('campaign-hero-preview').hidden, true);
  assert(!Object.hasOwn(context.catalog.campaigns[0], 'heroAssetId'));
});
