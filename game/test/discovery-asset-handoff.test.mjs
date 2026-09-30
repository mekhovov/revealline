import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { pngBytes, deferred } from './helpers/media-fixtures.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { createStudioReward } from '../../authoring/company-studio/reward-editor.mjs';
import { validateStudioDraft, declaredJSONPaths } from '../../authoring/company-studio/model.mjs';
import { companySourceDraft, companyDraftFiles } from '../../scripts/company-studio.mjs';
import { compileEdition } from '../../scripts/compile-edition.mjs';
import { createRewardMissionBindings } from '../rewards/bindings.mjs';
import { validateCompletionRewards } from '../rewards/model.mjs';
import {
  prepareRewardRasterOriginal,
  rewardAssetHandoffContext,
  inspectDiscoveryAssetHandoff,
  editDiscoveryAssetHandoff,
} from '../content-design/discovery-asset-handoff.mjs';
import { createAssetRewardEditor } from '../studio/asset-reward-editor.mjs';
import { mountRewardAssetExport } from '../studio/reward-asset-export.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const copy = {
  en: { title: 'A useful picture', alt: 'An original sample' },
  uk: { title: 'Корисне зображення', alt: 'Оригінальний зразок' },
};
async function fixture() {
  const f = await editionProviderFixture(),
    catalog = structuredClone(f.catalog),
    descriptor = catalog.campaigns[0],
    edition = catalog.editions[0],
    bytes = pngBytes();
  const asset = {
    id: 'approved-original',
    path: 'game/editions/assets/sample/original.png',
    sha256: sha(bytes),
    bytes: bytes.length,
    approved: true,
    publication: 'public',
    dependencies: [],
  };
  catalog.assets.push(asset);
  descriptor.assetIds.push(asset.id);
  descriptor.rewardPath = 'game/content/sample/rewards.json';
  const reward = createStudioReward({
    campaign: descriptor,
    source: f.source,
    id: 'sample-discovery',
    rule: 'all-missions',
    locales: {
      en: { title: 'Discovery', teaser: 'A useful picture', paragraph: 'Source-linked knowledge.' },
      uk: { title: 'Відкриття', teaser: 'Корисне зображення', paragraph: 'Знання з джерелами.' },
    },
  });
  const files = new Map([...f.files].map(([key, value]) => [key, structuredClone(value)]));
  files.set(descriptor.rewardPath, [reward]);
  const presets = files.get(edition.boot.presets);
  presets.characters['handoff-character'] = {
    ...structuredClone(Object.values(presets.characters)[0]),
    label: 'Handoff character',
    src: '../../' + asset.path,
  };
  presets.rewardCharacters = ['handoff-character'];
  const owner = { catalog, files, editionId: edition.id };
  const packet = () => ({
    format: 'revealline-company-source-draft.v1',
    catalog,
    files: declaredJSONPaths(catalog).map((path) => ({ path, data: files.get(path) })),
  });
  return {
    ...f,
    catalog,
    descriptor,
    edition,
    bytes,
    asset,
    reward,
    files,
    owner,
    packet,
    original: () => new File([bytes], 'renamed-original.png', { type: 'image/png' }),
  };
}
const command = (f, extra = {}) => ({
  assetId: f.asset.id,
  payloadId: 'picture',
  recipeId: 'handoff-character',
  locales: copy,
  ...extra,
});

test('exact original transfer and all three reward uses preserve source hashes and authoritative requirements', async () => {
  const f = await fixture(),
    ctx = rewardAssetHandoffContext(f.owner, f.descriptor.id);
  const original = await prepareRewardRasterOriginal({
    blob: f.original(),
    sha256: f.asset.sha256,
    mime: 'image/png',
    name: 'saved-r4',
  });
  assert.deepEqual(Buffer.from(await original.blob.arrayBuffer()), f.bytes);
  assert.equal(original.filename, 'saved-r4.png');
  for (const purpose of ['teaser', 'image', 'cosmetic']) {
    const inspection = await inspectDiscoveryAssetHandoff(ctx, original.blob, purpose);
    const edited = editDiscoveryAssetHandoff(
      f.source,
      [f.reward],
      f.reward.id,
      ctx,
      inspection,
      command(f),
    );
    const reward = edited.rewards[0];
    assert.notEqual(reward.revision, f.reward.revision);
    assert.equal(reward.id, f.reward.id);
    assert.deepEqual(reward.requirements, f.reward.requirements);
    assert.deepEqual(
      createRewardMissionBindings(edited.source),
      createRewardMissionBindings(f.source),
    );
    if (purpose === 'teaser') assert.equal(reward.teaserImage.asset.sha256, f.asset.sha256);
    else assert.equal(reward.payloads.at(-1).type, purpose);
  }
});

test('handoff rejects missing approval, restricted dependencies, foreign ownership, unknown bytes and unsupported rasters', async () => {
  const f = await fixture();
  for (const mutate of [
    (o) => {
      o.catalog.assets[0].approved = false;
    },
    (o) => {
      o.catalog.assets[0].publication = 'restricted';
    },
    (o) => {
      o.catalog.campaigns[0].assetIds = [];
      o.catalog.editions[0].assetIds = [f.asset.id];
    },
    (o) => {
      o.catalog.assets.push({
        ...f.asset,
        id: 'unreviewed-dependency',
        path: 'game/editions/assets/sample/dependency.png',
        approved: false,
      });
      o.catalog.assets[0].dependencies.push('unreviewed-dependency');
    },
  ]) {
    const owner = structuredClone(f.owner);
    mutate(owner);
    await assert.rejects(async () =>
      inspectDiscoveryAssetHandoff(
        rewardAssetHandoffContext(owner, f.descriptor.id),
        f.original(),
        'image',
      ),
    );
  }
  assert.throws(() => rewardAssetHandoffContext(f.owner, 'foreign-campaign'));
  const ctx = rewardAssetHandoffContext(f.owner, f.descriptor.id);
  await assert.rejects(inspectDiscoveryAssetHandoff(ctx, new Blob(['unreviewed']), 'image'));
  await assert.rejects(inspectDiscoveryAssetHandoff(ctx, f.original(), 'video'));
  await assert.rejects(
    prepareRewardRasterOriginal({ blob: f.original(), sha256: 'a'.repeat(64), mime: 'image/png' }),
  );
  await assert.rejects(
    prepareRewardRasterOriginal({
      blob: new Blob(['<svg/>']),
      sha256: sha('<svg/>'),
      mime: 'image/svg+xml',
    }),
  );
});

test('matching bytes never invent a character or overwrite a different payload kind', async () => {
  const f = await fixture(),
    ctx = rewardAssetHandoffContext(f.owner, f.descriptor.id);
  const image = await inspectDiscoveryAssetHandoff(ctx, f.original(), 'image');
  assert.throws(
    () =>
      editDiscoveryAssetHandoff(
        f.source,
        [f.reward],
        f.reward.id,
        ctx,
        image,
        command(f, { payloadId: f.reward.payloads[0].id }),
      ),
    /same kind/,
  );
  const cosmetic = await inspectDiscoveryAssetHandoff(ctx, f.original(), 'cosmetic');
  assert.throws(
    () =>
      editDiscoveryAssetHandoff(
        f.source,
        [f.reward],
        f.reward.id,
        ctx,
        cosmetic,
        command(f, { recipeId: 'starter' }),
      ),
    /registered character/,
  );
  const edited = editDiscoveryAssetHandoff(
    f.source,
    [f.reward],
    f.reward.id,
    ctx,
    image,
    command(f),
  );
  const teaser = await inspectDiscoveryAssetHandoff(ctx, f.original(), 'teaser');
  assert.throws(
    () =>
      editDiscoveryAssetHandoff(
        edited.source,
        edited.rewards,
        f.reward.id,
        ctx,
        teaser,
        command(f),
      ),
    /separate/,
  );
});

for (const mode of ['Company', 'Level'])
  test(`${mode} editor applies a selected original and survives source/reward export, import and selected player compilation`, async () => {
    const f = await fixture(),
      doc = new Document(),
      window = new Events(),
      container = doc.createElement('section');
    doc.body.append(container);
    const live = new Map(),
      revoked = [];
    window.URL = {
      createObjectURL(blob) {
        const url = 'blob:' + (live.size + revoked.length);
        live.set(url, blob);
        return url;
      },
      revokeObjectURL(url) {
        revoked.push(url);
        live.delete(url);
      },
    };
    let source = f.source,
      rewards = [f.reward],
      writes = 0;
    const editor = createAssetRewardEditor({
      container,
      window,
      getSource: () => source,
      getRewards: () => rewards,
      getLocale: () => 'uk',
      ...(mode === 'Company' ? { getCosmeticSource: () => f.owner } : {}),
      apply(candidate) {
        source = candidate.source;
        rewards = candidate.rewards;
        writes++;
        return true;
      },
    });
    const field = (id) => container.querySelector(`[data-asset-handoff-field="${id}"]`),
      action = (id) => container.querySelector(`[data-asset-handoff-action="${id}"]`);
    editor.sync();
    if (mode === 'Level') {
      field('packet').files = [new File([JSON.stringify(f.packet())], 'source.json')];
      await field('packet').onchange();
    }
    field('purpose').value = 'image';
    field('purpose').onchange();
    field('file').files = [f.original()];
    field('file').onchange();
    assert.equal(await action('inspect').onclick(), true);
    assert.equal(writes, 0);
    assert.equal(field('asset').value, '');
    field('asset').value = f.asset.id;
    field('asset').onchange();
    field('payloadId').value = 'picture';
    for (const locale of ['en', 'uk']) {
      field(locale + 'Title').value = copy[locale].title;
      field(locale + 'Alt').value = copy[locale].alt;
    }
    assert.equal(await action('preview').onclick(), true);
    assert.equal(writes, 0);
    assert.equal(live.size, 1);
    assert.equal(container.querySelector('img').alt, copy.uk.alt);
    assert.equal(await action('apply').onclick(), true);
    assert.equal(writes, 1);
    assert.equal(live.size, 0);
    f.files.set(f.descriptor.sourcePath, source);
    f.files.set(f.descriptor.rewardPath, rewards);
    const byteFiles = new Map(
      [...f.files].map(([path, value]) => [path, Buffer.from(JSON.stringify(value))]),
    );
    byteFiles.set(f.asset.path, f.bytes);
    const packet = companySourceDraft({ catalog: f.catalog, files: byteFiles });
    const restored = validateStudioDraft(JSON.stringify(packet));
    assert.deepEqual(restored.files.get(f.descriptor.rewardPath), rewards);
    assert.deepEqual(validateCompletionRewards(JSON.parse(JSON.stringify(rewards))), rewards);
    const diskInput = companyDraftFiles(JSON.stringify(packet));
    diskInput.files.set(f.asset.path, f.bytes);
    diskInput.files.set(
      'game/company.html',
      Buffer.from('<html><head></head><body>Fixture</body></html>'),
    );
    const compiled = await compileEdition({
      catalog: diskInput.catalog,
      editionIds: [f.edition.id],
      files: diskInput.files,
      enginePaths: ['game/company.html'],
    });
    assert.deepEqual(Buffer.from(compiled.files.get(f.asset.path)), f.bytes);
    assert.deepEqual(
      JSON.parse(Buffer.from(compiled.files.get(f.descriptor.rewardPath)).toString()),
      rewards,
    );
    editor.dispose();
    assert.equal(live.size, 0);
  });

test('export offers unchanged bytes only after preparation, cancels late reads and releases every owned URL', async () => {
  const f = await fixture(),
    doc = new Document(),
    container = doc.createElement('section');
  doc.body.append(container);
  const blobs = new Map(),
    revoked = [];
  let pending = null;
  const exporter = mountRewardAssetExport({
    container,
    getOriginal: async () => {
      if (pending) await pending.promise;
      return { blob: f.original(), sha256: f.asset.sha256, mime: 'image/png', name: 'fixture' };
    },
    URLImpl: {
      createObjectURL(blob) {
        const url = 'blob:' + (blobs.size + revoked.length);
        blobs.set(url, blob);
        return url;
      },
      revokeObjectURL(url) {
        revoked.push(url);
        blobs.delete(url);
      },
    },
  });
  const prepare = container.querySelector('[data-asset-export-action="prepare"]');
  for (let index = 0; index < 20; index++) {
    assert.equal(await prepare.onclick(), true);
    assert.equal(blobs.size, 1);
    assert.deepEqual(Buffer.from(await [...blobs.values()][0].arrayBuffer()), f.bytes);
    exporter.reset();
    assert.equal(blobs.size, 0);
  }
  pending = deferred();
  const running = prepare.onclick();
  exporter.reset();
  pending.resolve();
  assert.equal(await running, false);
  assert.equal(blobs.size, 0);
  pending = deferred();
  const disposed = prepare.onclick();
  exporter.dispose();
  pending.resolve();
  assert.equal(await disposed, false);
  assert.equal(blobs.size, 0);
});

test('receiver cancellation and changed draft invalidate inspection without stale preview or write', async () => {
  const f = await fixture(),
    doc = new Document(),
    window = new Events(),
    container = doc.createElement('section');
  doc.body.append(container);
  const urls = new Set();
  window.URL = {
    createObjectURL() {
      urls.add('blob:x');
      return 'blob:x';
    },
    revokeObjectURL(url) {
      urls.delete(url);
    },
  };
  let source = f.source,
    writes = 0;
  const editor = createAssetRewardEditor({
    container,
    window,
    getSource: () => source,
    getRewards: () => [f.reward],
    getLocale: () => 'en',
    getCosmeticSource: () => f.owner,
    apply() {
      writes++;
    },
  });
  editor.sync();
  const field = (id) => container.querySelector(`[data-asset-handoff-field="${id}"]`),
    action = (id) => container.querySelector(`[data-asset-handoff-action="${id}"]`);
  const gate = deferred(),
    file = f.original(),
    read = file.arrayBuffer.bind(file);
  file.arrayBuffer = async () => {
    await gate.promise;
    return read();
  };
  field('file').files = [file];
  const pending = action('inspect').onclick();
  field('purpose').value = 'image';
  field('purpose').onchange();
  gate.resolve();
  await pending;
  assert.equal(field('asset').children.length, 0);
  field('file').files = [f.original()];
  await action('inspect').onclick();
  field('asset').value = f.asset.id;
  field('payloadId').value = 'picture';
  for (const locale of ['en', 'uk']) {
    field(locale + 'Title').value = copy[locale].title;
    field(locale + 'Alt').value = copy[locale].alt;
  }
  source = { ...source, revision: 'changed' };
  assert.equal(await action('apply').onclick(), false);
  assert.equal(writes, 0);
  editor.dispose();
  assert.equal(urls.size, 0);
});

test('ordinary picture export dependency graph excludes reward editors and Company source authority', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../../', import.meta.url),
    pending = ['game/studio/reward-asset-export.mjs'],
    seen = new Set();
  while (pending.length) {
    const file = pending.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    assert(!file.startsWith('authoring/company-studio/'), file);
    assert(!file.startsWith('game/content-design/discovery'), file);
    assert(!file.endsWith('asset-reward-editor.mjs'), file);
    const url = new URL(file, root),
      source = await readFile(url, 'utf8');
    for (const match of source.matchAll(/(?:from\s*|import\s*\()['"]([^'"]+)['"]/g)) {
      if (!match[1].startsWith('.')) continue;
      const path = new URL(match[1], url).href.slice(root.href.length);
      if (path.endsWith('.mjs')) pending.push(path);
    }
  }
  assert(seen.has('game/rewards/raster-original.mjs'));
});
