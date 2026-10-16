import test from 'node:test';
import assert from 'node:assert/strict';
import { createCampaignFeedbackEditor } from '../studio/campaign-feedback-editor.mjs';
import { editCampaignFeedback } from '../content-design/campaign-feedback.mjs';
import { createRewardMissionBindings } from '../rewards/bindings.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import {
  validateStudioDraft,
  DRAFT_FORMAT,
  declaredJSONPaths,
} from '../../authoring/company-studio/model.mjs';
import { compileEdition } from '../../scripts/compile-edition.mjs';
import { loadEditionBootstrap } from '../editions/bootstrap.mjs';
import {
  captureEditionPresentation,
  validateRetainedPresentation,
} from '../editions/retained-presentation.mjs';
import {
  createCampaignLocalization,
  campaignLocalizationSha256,
} from '../editions/localization.mjs';
import { rebindStudioRewardLocalization } from '../../authoring/company-studio/reward-editor.mjs';

const input = {
  lines: { en: ['An original connection.'], uk: ['Оригінальне з’єднання.'] },
  victoryMotif: 'open-horizon-v1',
};
test('Company source draft, selected compiler and retained snapshot preserve exact feedback and exclude another campaign', async () => {
  const f = await editionProviderFixture(),
    catalog = structuredClone(f.catalog),
    descriptor = catalog.campaigns[0],
    edition = catalog.editions[0];
  const source = editCampaignFeedback(f.source, descriptor.id, input);
  const localization = createCampaignLocalization({
    source: f.source,
    campaignId: descriptor.id,
    campaignLocales: { uk: { name: 'Майстерня' } },
    missionLocales: Object.fromEntries(
      f.source.missions.map((item) => [
        item.id,
        { uk: { name: 'З’єднання', brief: 'Створіть з’єднання.', routeDecision: 'Оберіть шлях.' } },
      ]),
    ),
  });
  descriptor.localizationPath = descriptor.sourcePath.replace('.json', '.localization.json');
  const rebound = await rebindStudioRewardLocalization({ localization, source, descriptor });
  descriptor.localizationSha256 = await campaignLocalizationSha256(rebound.localization);
  const files = new Map(f.files);
  files.set(descriptor.sourcePath, source);
  files.set(descriptor.localizationPath, rebound.localization);
  const packet = {
    format: DRAFT_FORMAT,
    catalog,
    files: declaredJSONPaths(catalog).map((path) => ({ path, data: files.get(path) })),
  };
  const restored = validateStudioDraft(JSON.stringify(packet));
  assert.deepEqual(
    restored.files.get(descriptor.sourcePath).campaigns[0].discovery.feedback,
    source.campaigns[0].discovery.feedback,
  );
  const bootstrap = await loadEditionBootstrap({
    editionId: edition.id,
    catalogURL: 'https://feedback.test/catalog.json',
    contentBaseURL: 'https://feedback.test/',
    fetcher: async (url) => {
      const path = new URL(url).pathname.slice(1);
      return new Response(JSON.stringify(path === 'catalog.json' ? catalog : files.get(path)));
    },
  });
  const snapshot = await captureEditionPresentation(bootstrap),
    historical = await validateRetainedPresentation(snapshot, { edition });
  assert.deepEqual(
    historical.bootstrap.source.campaigns[0].discovery.feedback,
    source.campaigns[0].discovery.feedback,
  );
  const byteFiles = new Map(
    [...files].map(([path, value]) => [path, Buffer.from(JSON.stringify(value))]),
  );
  byteFiles.set('game/company.html', Buffer.from('<html><head></head><body>Test</body></html>'));
  byteFiles.set('game/content/foreign.json', Buffer.from('PRIVATE-FEEDBACK-SENTINEL'));
  const result = await compileEdition({
    catalog,
    editionIds: [edition.id],
    files: byteFiles,
    enginePaths: ['game/company.html'],
  });
  assert(result.files.has(descriptor.sourcePath));
  assert(!result.files.has('game/content/foreign.json'));
  assert.equal(
    [...result.files.values()].some((value) =>
      Buffer.from(value).includes(Buffer.from('PRIVATE-FEEDBACK-SENTINEL')),
    ),
    false,
  );
  assert.deepEqual(createRewardMissionBindings(source), createRewardMissionBindings(f.source));
  const broken = structuredClone(packet);
  broken.files.find(
    (row) => row.path === descriptor.sourcePath,
  ).data.campaigns[0].discovery.feedback.victoryMotif = 'unregistered';
  assert.throws(() => validateStudioDraft(broken), /motif/);
});

test('shared editor previews without writes, applies bilingual recipes, rejects stale drafts and disposes every audition', async () => {
  const f = await editionProviderFixture(),
    doc = new Document(),
    window = new Events(),
    container = doc.createElement('section');
  doc.body.append(container);
  let source = f.source,
    writes = 0,
    created = 0,
    disposed = 0,
    events = 0;
  const editor = createCampaignFeedbackEditor({
    container,
    window,
    getSource: () => source,
    getCampaignId: () => source.campaigns[0].id,
    getLocale: () => 'uk',
    apply: (candidate) => {
      source = candidate;
      writes++;
    },
    createSound: () => {
      created++;
      return {
        configure() {},
        async enable() {
          return true;
        },
        event() {
          events++;
        },
        dispose() {
          disposed++;
        },
      };
    },
  });
  editor.sync();
  const field = (id) => container.querySelector(`[data-campaign-feedback-field="${id}"]`),
    action = (id) => container.querySelector(`[data-campaign-feedback-action="${id}"]`);
  field('enabled').checked = true;
  field('en').value = input.lines.en[0];
  field('uk').value = input.lines.uk[0];
  field('motif').value = input.victoryMotif;
  await action('preview').onclick();
  assert.equal(writes, 0);
  assert.match(container.textContent, /Оригінальне з’єднання/);
  for (let cycle = 0; cycle < 20; cycle++) {
    await action('audition').onclick();
    await action('stop').onclick();
  }
  assert.equal(created, 20);
  assert.equal(disposed, 20);
  assert.equal(events, 20);
  assert.equal(writes, 0);
  await action('apply').onclick();
  assert.equal(writes, 1);
  assert.deepEqual(source.campaigns[0].discovery.feedback.lines, input.lines);
  source = { ...source, revision: 'another-tab' };
  await action('apply').onclick();
  assert.equal(writes, 1);
  assert.match(container.textContent, /draft changed/);
  editor.dispose();
  assert.equal(container.children.length, 0);
  assert.equal(disposed, created);
});
test('closing an audition before asynchronous enable resolves cannot produce a late victory cue', async () => {
  const f = await editionProviderFixture(),
    doc = new Document(),
    container = doc.createElement('section');
  doc.body.append(container);
  let release,
    events = 0,
    disposed = 0;
  const editor = createCampaignFeedbackEditor({
    container,
    window: new Events(),
    getSource: () => f.source,
    getCampaignId: () => f.source.campaigns[0].id,
    getLocale: () => 'en',
    apply: () => assert.fail(),
    createSound: () => ({
      configure() {},
      enable: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
      event: () => events++,
      dispose: () => disposed++,
    }),
  });
  editor.sync();
  const pending = container.querySelector('[data-campaign-feedback-action="audition"]').onclick();
  editor.dispose();
  release(true);
  await pending;
  assert.equal(events, 0);
  assert.equal(disposed, 1);
});

test('actual Company feedback apply cancels newer JSON, selection and source changes during locale hashing', async () => {
  const { readFile } = await import('node:fs/promises'),
    { parse } = await import('acorn'),
    vm = await import('node:vm');
  const text = await readFile(
      new URL('../../authoring/company-studio/studio.mjs', import.meta.url),
      'utf8',
    ),
    tree = parse(text, { ecmaVersion: 'latest', sourceType: 'module' }),
    call = tree.body
      .flatMap((item) => item.declarations ?? [])
      .find((item) => item.id.name === 'discoveryEditor').init,
    callback = call.arguments[0].properties.find((item) => item.key.name === 'apply').value;
  for (const change of [
    'source-buffer',
    'catalog-buffer',
    'edition',
    'revision',
    'files',
    'none',
  ]) {
    const f = await editionProviderFixture(),
      catalog = structuredClone(f.catalog),
      descriptor = catalog.campaigns[0];
    descriptor.localizationPath = descriptor.sourcePath.replace('.json', '.localization.json');
    const source = editCampaignFeedback(f.source, descriptor.id, input),
      files = new Map(f.files);
    files.set(descriptor.localizationPath, {});
    let resolve;
    const pending = new Promise((done) => {
        resolve = done;
      }),
      element = { value: '' },
      context = vm.createContext({
        catalog,
        files,
        revision: 1,
        loadGeneration: 1,
        editionId: catalog.editions[0].id,
        editorBuffers: new Map(),
        structuredClone,
        Map,
        format: JSON.stringify,
        $: () => element,
        selectedCampaign: () => descriptor,
        validateEditionRuntimeCatalog: (value) => value,
        validateStudioData: () => {},
        rebindStudioRewardLocalization: () => pending,
        changed: () => {},
        renderCatalog: () => {},
      });
    const apply = vm.runInContext(`(${text.slice(callback.start, callback.end)})`, context),
      result = apply(source);
    if (change === 'source-buffer') context.editorBuffers.set(descriptor.sourcePath, 'new draft');
    if (change === 'catalog-buffer') context.editorBuffers.set('catalog', 'new catalog');
    if (change === 'edition') context.editionId = 'another-edition';
    if (change === 'revision') context.revision++;
    if (change === 'files') context.files = new Map(files);
    const expectedFiles = context.files;
    resolve({ localization: {}, sha256: '1'.repeat(64) });
    if (change === 'none') {
      await result;
      assert.equal(context.files.get(descriptor.sourcePath), source);
      assert.equal(context.catalog.editions[0].revision, catalog.editions[0].revision + 1);
    } else {
      await assert.rejects(result, /context changed/);
      assert.equal(context.files, expectedFiles);
      assert.equal(context.files.get(descriptor.sourcePath), f.source);
      assert.equal(context.catalog, catalog);
    }
  }
});
