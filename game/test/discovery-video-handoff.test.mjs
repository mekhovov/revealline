import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { pngBytes } from './helpers/media-fixtures.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { prepareDiscoveryVideoOriginal } from '../rewards/video-original.mjs';
import { mountRewardVideoExport } from '../studio/reward-video-export.mjs';
import {
  inspectDiscoveryVideoHandoff,
  editDiscoveryVideoHandoff,
} from '../content-design/discovery-video-handoff.mjs';
import { rewardAssetHandoffContext } from '../content-design/discovery-asset-handoff.mjs';
import { createVideoRewardEditor } from '../studio/video-reward-editor.mjs';
import { createStudioReward } from '../../authoring/company-studio/reward-editor.mjs';
import { validateStudioDraft, declaredJSONPaths } from '../../authoring/company-studio/model.mjs';
import { companySourceDraft, companyDraftFiles } from '../../scripts/company-studio.mjs';
import { compileEdition } from '../../scripts/compile-edition.mjs';
import { createRewardMissionBindings } from '../rewards/bindings.mjs';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const videoBytes = await readFile(
  new URL('./fixtures/video/owned-poster-fixture.mp4', import.meta.url),
);
const picture = pngBytes();
const roles = ['video', 'poster', 'en', 'uk', 'enCaptions', 'ukCaptions'];
const videoInfo = {
  mime: 'video/mp4',
  width: 640,
  height: 360,
  durationSeconds: 6,
  bytes: videoBytes.length,
  sha256: sha(videoBytes),
};
const decoder = async () => ({ info: videoInfo, dispose() {} }); // Trusted host metadata seam; native decode has separate coverage.
const original = () => ({
  source: { original: new Blob([videoBytes]), info: videoInfo },
  poster: {
    blob: new Blob([picture]),
    asset: { sha256: sha(picture) },
    capture: { sourceSha256: sha(videoBytes) },
  },
});
async function fixture() {
  const f = await editionProviderFixture(),
    catalog = structuredClone(f.catalog),
    descriptor = catalog.campaigns[0],
    edition = catalog.editions[0],
    bytes = new Map();
  for (const [id, extension, data] of [
    ['video', 'mp4', videoBytes],
    ['poster', 'png', picture],
    ['en', 'txt', Buffer.from('An original geometric test pattern.')],
    ['uk', 'txt', Buffer.from('Оригінальний геометричний тестовий візерунок.')],
    ['enCaptions', 'vtt', Buffer.from('WEBVTT\n\n00:00.000 --> 00:06.000\nA geometric pattern.\n')],
    [
      'ukCaptions',
      'vtt',
      Buffer.from('WEBVTT\n\n00:00.000 --> 00:06.000\nГеометричний візерунок.\n'),
    ],
  ]) {
    catalog.assets.push({
      id,
      path: `game/editions/assets/sample/${id}.${extension}`,
      sha256: sha(data),
      bytes: data.length,
      publication: 'public',
      approved: true,
      dependencies: [],
    });
    descriptor.assetIds.push(id);
    bytes.set(id, data);
  }
  descriptor.rewardPath = 'game/content/sample/rewards.json';
  const reward = createStudioReward({
    campaign: descriptor,
    source: f.source,
    id: 'clip-discovery',
    rule: 'all-missions',
    locales: {
      en: { title: 'Pattern', teaser: 'A short clip', paragraph: 'An original.' },
      uk: { title: 'Візерунок', teaser: 'Коротке відео', paragraph: 'Оригінал.' },
    },
  });
  const files = new Map([...f.files].map(([path, data]) => [path, structuredClone(data)]));
  files.set(descriptor.rewardPath, [reward]);
  const owner = { catalog, files, editionId: edition.id };
  const originals = () =>
    Object.fromEntries([...bytes].map(([id, data]) => [id, new File([data], `${id}.dat`)]));
  const packet = () => ({
    format: 'revealline-company-source-draft.v1',
    catalog,
    files: declaredJSONPaths(catalog).map((path) => ({ path, data: files.get(path) })),
  });
  return { ...f, catalog, descriptor, edition, reward, files, owner, originals, bytes, packet };
}
const command = {
  ...Object.fromEntries(roles.map((role) => [role, role])),
  payloadId: 'clip',
  locales: { en: { title: 'Clip' }, uk: { title: 'Відео' } },
};

test('Picture Workshop clip producer remains outside Company editing and progress dependency graphs', async () => {
  const root = new URL('../../', import.meta.url),
    pending = ['game/ui/video-poster-workshop.mjs'],
    seen = new Set();
  while (pending.length) {
    const file = pending.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    assert(!file.startsWith('authoring/company-studio/'), file);
    assert(!file.startsWith('game/content-design/discovery'), file);
    assert(!file.endsWith('media-reward-editor.mjs'), file);
    const url = new URL(file, root),
      source = await readFile(url, 'utf8');
    for (const match of source.matchAll(/(?:from\s*|import\s*\()['"]([^'"]+)['"]/g)) {
      if (!match[1].startsWith('.')) continue;
      const path = new URL(match[1], url).href.slice(root.href.length);
      if (path.endsWith('.mjs')) pending.push(path);
    }
  }
  assert(seen.has('game/rewards/video-original.mjs'));
});

test('clip producer preserves complete source and captured poster bytes with exact binding and limits', async () => {
  const value = await prepareDiscoveryVideoOriginal(original());
  assert.deepEqual(Buffer.from(await value.video.blob.arrayBuffer()), videoBytes);
  assert.deepEqual(Buffer.from(await value.poster.blob.arrayBuffer()), picture);
  for (const alter of [
    (o) => (o.source.info = { ...o.source.info, sha256: 'a'.repeat(64) }),
    (o) => (o.poster.capture.sourceSha256 = 'a'.repeat(64)),
    (o) => (o.poster.asset.sha256 = 'a'.repeat(64)),
    (o) => (o.source.info = { ...o.source.info, durationSeconds: 121 }),
    (o) => (o.source.info = { ...o.source.info, width: 1921 }),
  ]) {
    const o = original();
    alter(o);
    await assert.rejects(prepareDiscoveryVideoOriginal(o));
  }
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(prepareDiscoveryVideoOriginal(original(), { signal: controller.signal }), {
    name: 'AbortError',
  });
});

test('six-original handoff preserves requirements and gameplay while requiring exact selected publication rights', async () => {
  const f = await fixture(),
    ctx = rewardAssetHandoffContext(f.owner, f.descriptor.id);
  let disposed = 0;
  const inspected = await inspectDiscoveryVideoHandoff(ctx, f.originals(), {
    openSource: async () => ({
      info: videoInfo,
      dispose() {
        disposed++;
      },
    }),
  });
  assert.equal(disposed, 1);
  const result = editDiscoveryVideoHandoff(
    f.source,
    [f.reward],
    f.reward.id,
    ctx,
    inspected,
    command,
  );
  assert.deepEqual(result.rewards[0].requirements, f.reward.requirements);
  assert.deepEqual(
    createRewardMissionBindings(result.source),
    createRewardMissionBindings(f.source),
  );
  assert.notEqual(result.rewards[0].revision, f.reward.revision);
  for (const alter of [
    (o) => (o.catalog.assets.find((a) => a.id === 'video').approved = false),
    (o) => (o.catalog.assets.find((a) => a.id === 'ukCaptions').publication = 'restricted'),
    (o) => (o.catalog.campaigns[0].assetIds = ['poster', 'en', 'uk', 'enCaptions', 'ukCaptions']),
  ]) {
    const owner = structuredClone(f.owner);
    alter(owner);
    await assert.rejects(async () =>
      inspectDiscoveryVideoHandoff(
        rewardAssetHandoffContext(owner, f.descriptor.id),
        f.originals(),
        { openSource: decoder },
      ),
    );
  }
  for (const key of roles)
    await assert.rejects(
      inspectDiscoveryVideoHandoff(
        ctx,
        { ...f.originals(), [key]: undefined },
        { openSource: decoder },
      ),
    );
  await assert.rejects(
    inspectDiscoveryVideoHandoff(
      ctx,
      { ...f.originals(), uk: new Blob(['unapproved']) },
      { openSource: decoder },
    ),
    /not admitted/,
  );
  assert.throws(
    () =>
      editDiscoveryVideoHandoff(f.source, [f.reward], f.reward.id, ctx, inspected, {
        ...command,
        ukCaptions: 'video',
      }),
    /select/,
  );
  assert.throws(
    () =>
      editDiscoveryVideoHandoff(
        f.source,
        [f.reward],
        f.reward.id,
        { ...ctx, identity: 'changed' },
        inspected,
        command,
      ),
    /changed/,
  );
});

test('video inspection rejects excessive caption timing, false metadata, malformed text and abort, disposing native acquisition', async () => {
  const f = await fixture(),
    ctx = rewardAssetHandoffContext(f.owner, f.descriptor.id);
  for (const info of [
    { ...videoInfo, durationSeconds: 5 },
    { ...videoInfo, sha256: 'a'.repeat(64) },
    { ...videoInfo, height: 1081 },
  ]) {
    let closed = 0;
    await assert.rejects(
      inspectDiscoveryVideoHandoff(ctx, f.originals(), {
        openSource: async () => ({
          info,
          dispose() {
            closed++;
          },
        }),
      }),
    );
    assert.equal(closed, 1);
  }
  const controller = new AbortController();
  await assert.rejects(
    inspectDiscoveryVideoHandoff(ctx, f.originals(), {
      signal: controller.signal,
      openSource: async () => {
        controller.abort();
        return { info: videoInfo, dispose() {} };
      },
    }),
    { name: 'AbortError' },
  );
  const bad = Buffer.from('WEBVTT\n\n00:00.000 --> 00:01.000\n<script>bad</script>\n');
  f.catalog.assets.find((a) => a.id === 'enCaptions').sha256 = sha(bad);
  f.catalog.assets.find((a) => a.id === 'enCaptions').bytes = bad.length;
  await assert.rejects(
    inspectDiscoveryVideoHandoff(
      rewardAssetHandoffContext(f.owner, f.descriptor.id),
      { ...f.originals(), enCaptions: new Blob([bad]) },
      { openSource: decoder },
    ),
    /markup/,
  );
});
for (const host of ['Company', 'Level'])
  test(`${host} video authoring previews without earning and round trips the exact selected media closure`, async () => {
    const f = await fixture(),
      document = new Document(),
      window = new Events(),
      container = document.createElement('section');
    document.body.append(container);
    const urls = new Set();
    window.URL = {
      createObjectURL() {
        const url = `blob:${urls.size}`;
        urls.add(url);
        return url;
      },
      revokeObjectURL(url) {
        urls.delete(url);
      },
    };
    let source = f.source,
      rewards = [f.reward],
      writes = 0;
    const editor = createVideoRewardEditor({
      container,
      window,
      openSource: decoder,
      getSource: () => source,
      getRewards: () => rewards,
      getLocale: () => 'uk',
      ...(host === 'Company' ? { getCompanySource: () => f.owner } : {}),
      apply(candidate) {
        source = candidate.source;
        rewards = candidate.rewards;
        writes++;
        return true;
      },
    });
    const field = (id) => container.querySelector(`[data-video-handoff-field="${id}"]`),
      action = (id) => container.querySelector(`[data-video-handoff-action="${id}"]`);
    editor.sync();
    if (host === 'Level') {
      field('packet').files = [new File([JSON.stringify(f.packet())], 'source.json')];
      await field('packet').onchange();
    }
    const originals = f.originals();
    for (const id of roles) field(id + 'File').files = [originals[id]];
    assert.equal(await action('inspect').onclick(), true);
    for (const id of roles) {
      assert.equal(field(id).value, '');
      field(id).value = id;
    }
    field('payloadId').value = command.payloadId;
    for (const id of ['en', 'uk']) field(id + 'Title').value = command.locales[id].title;
    assert.equal(await action('preview').onclick(), true);
    assert.equal(writes, 0);
    assert.equal(container.querySelector('video'), null, 'Video is created only by explicit Play.');
    for (let index = 0; index < 20; index++) {
      assert.equal(await action('preview').onclick(), true);
      await new Promise((resolve) => setImmediate(resolve));
      field('enTitle').oninput();
      assert.equal(container.querySelector('[data-reward-media="video"]'), null);
      assert.equal(urls.size, 0);
    }
    assert.equal(await action('apply').onclick(), true);
    assert.equal(writes, 1);
    assert.equal(urls.size, 0);
    f.files.set(f.descriptor.sourcePath, source);
    f.files.set(f.descriptor.rewardPath, rewards);
    const byteFiles = new Map(
      [...f.files].map(([path, data]) => [path, Buffer.from(JSON.stringify(data))]),
    );
    for (const asset of f.catalog.assets) byteFiles.set(asset.path, f.bytes.get(asset.id));
    const packet = companySourceDraft({ catalog: f.catalog, files: byteFiles });
    assert.deepEqual(
      validateStudioDraft(JSON.stringify(packet)).files.get(f.descriptor.rewardPath),
      rewards,
    );
    const restored = companyDraftFiles(JSON.stringify(packet));
    for (const asset of f.catalog.assets) restored.files.set(asset.path, f.bytes.get(asset.id));
    restored.files.set(
      'game/company.html',
      Buffer.from('<html><head></head><body>Fixture</body></html>'),
    );
    const compiled = await compileEdition({
      catalog: restored.catalog,
      editionIds: [f.edition.id],
      files: restored.files,
      enginePaths: ['game/company.html'],
    });
    for (const asset of f.catalog.assets)
      assert.deepEqual(Buffer.from(compiled.files.get(asset.path)), f.bytes.get(asset.id));
    editor.dispose();
    assert.equal(urls.size, 0);
  });

test('shared video editor rejects stale drafts and disposes a late native inspection without playback or writes', async () => {
  const f = await fixture(),
    document = new Document(),
    container = document.createElement('section'),
    window = new Events();
  document.body.append(container);
  window.URL = {
    createObjectURL() {
      assert.fail('Inspection cannot play or allocate preview URLs.');
    },
    revokeObjectURL() {},
  };
  let source = f.source,
    writes = 0,
    release = null,
    closed = 0,
    delayed = false;
  const editor = createVideoRewardEditor({
    container,
    window,
    getSource: () => source,
    getRewards: () => [f.reward],
    getLocale: () => 'en',
    getCompanySource: () => f.owner,
    openSource: async () => {
      if (delayed)
        await new Promise((resolve) => {
          release = resolve;
        });
      return {
        info: videoInfo,
        dispose() {
          closed++;
        },
      };
    },
    apply() {
      writes++;
      return true;
    },
  });
  const field = (id) => container.querySelector(`[data-video-handoff-field="${id}"]`),
    action = (id) => container.querySelector(`[data-video-handoff-action="${id}"]`);
  editor.sync();
  const originals = f.originals();
  for (const role of roles) field(role + 'File').files = [originals[role]];
  assert.equal(await action('inspect').onclick(), true);
  for (const role of roles) field(role).value = role;
  field('payloadId').value = command.payloadId;
  for (const locale of ['en', 'uk']) field(locale + 'Title').value = command.locales[locale].title;
  source = { ...source, revision: 'edited-after-inspection' };
  assert.equal(await action('apply').onclick(), false);
  assert.equal(writes, 0);
  delayed = true;
  const pending = action('inspect').onclick();
  while (!release) await new Promise((resolve) => setImmediate(resolve));
  editor.dispose();
  release();
  await pending;
  assert.equal(closed, 2);
  assert.equal(writes, 0);
  assert.equal(container.children.length, 0);
});

test('video export links stay explicit and release all URLs across repeated preparation, reset and late cancellation', async () => {
  const document = new Document(),
    container = document.createElement('section'),
    urls = new Map();
  document.body.append(container);
  let next = 0,
    read = () => original();
  const exporter = mountRewardVideoExport({
    container,
    getOriginal: () => read(),
    URLImpl: {
      createObjectURL(blob) {
        const url = `blob:video-${++next}`;
        urls.set(url, blob);
        return url;
      },
      revokeObjectURL(url) {
        assert(urls.delete(url));
      },
    },
  });
  const action = (id) => container.querySelector(`[data-video-export-action="${id}"]`),
    link = (id) => container.querySelector(`[data-video-export-file="${id}"]`);
  assert.equal(link('video').hidden, true);
  for (let count = 0; count < 20; count++) {
    assert.equal(await action('prepare').onclick(), true);
    assert.equal(urls.size, 2);
    assert.equal(link('video').hidden, false);
    assert.deepEqual(Buffer.from(await urls.get(link('video').href).arrayBuffer()), videoBytes);
    exporter.reset();
    assert.equal(urls.size, 0);
  }
  let resolve;
  read = () =>
    new Promise((done) => {
      resolve = done;
    });
  const pending = action('prepare').onclick();
  exporter.dispose();
  resolve(original());
  await pending;
  assert.equal(urls.size, 0);
  assert.equal(container.children.length, 0);
});
