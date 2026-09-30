import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fixture as soundtrackFixture, silenceBytes } from './helpers/soundtrack-fixtures.mjs';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { inspectMP3 } from '../mp3.mjs';
import { SOUNDTRACK_CATALOGUE_FORMAT_V2 } from '../soundtrack.mjs';
import { prepareDiscoveryRecording } from '../rewards/audio-original.mjs';
import {
  inspectDiscoveryAudioHandoff,
  editDiscoveryAudioHandoff,
} from '../content-design/discovery-audio-handoff.mjs';
import { rewardAssetHandoffContext } from '../content-design/discovery-asset-handoff.mjs';
import { createAudioRewardEditor } from '../studio/audio-reward-editor.mjs';
import { createStudioReward } from '../../authoring/company-studio/reward-editor.mjs';
import { validateStudioDraft, declaredJSONPaths } from '../../authoring/company-studio/model.mjs';
import { companySourceDraft, companyDraftFiles } from '../../scripts/company-studio.mjs';
import { compileEdition } from '../../scripts/compile-edition.mjs';
import { createRewardMissionBindings } from '../rewards/bindings.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function fixture() {
  const f = await editionProviderFixture(),
    catalog = structuredClone(f.catalog),
    descriptor = catalog.campaigns[0],
    edition = catalog.editions[0],
    bytes = new Map();
  for (const [id, extension, data] of [
    ['audio', 'mp3', silenceBytes],
    ['en', 'txt', Buffer.from('An original recording of coded silence.')],
    ['uk', 'txt', Buffer.from('Оригінальний запис кодованої тиші.')],
  ]) {
    const asset = {
      id,
      path: `game/editions/assets/sample/${id}.${extension}`,
      sha256: sha(data),
      bytes: data.length,
      publication: 'public',
      approved: true,
      dependencies: [],
    };
    catalog.assets.push(asset);
    descriptor.assetIds.push(id);
    bytes.set(id, data);
  }
  descriptor.rewardPath = 'game/content/sample/rewards.json';
  const reward = createStudioReward({
    campaign: descriptor,
    source: f.source,
    id: 'listening-discovery',
    rule: 'all-missions',
    locales: {
      en: { title: 'Listening', teaser: 'A short recording', paragraph: 'An original.' },
      uk: { title: 'Слухання', teaser: 'Короткий запис', paragraph: 'Оригінал.' },
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
  audio: 'audio',
  en: 'en',
  uk: 'uk',
  payloadId: 'recording',
  locales: { en: { title: 'Recording' }, uk: { title: 'Запис' } },
};

test('ordinary Soundtrack Studio dependency graph does not import reward editing or Company source authority', async () => {
  const { readFile } = await import('node:fs/promises');
  const root = new URL('../../', import.meta.url),
    pending = ['game/ui/soundtrack-panel.mjs'],
    seen = new Set();
  while (pending.length) {
    const file = pending.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    assert(!file.startsWith('authoring/company-studio/'), file);
    assert(!file.startsWith('game/content-design/discovery'), file);
    assert(!file.endsWith('audio-reward-editor.mjs'), file);
    const url = new URL(file, root),
      source = await readFile(url, 'utf8');
    for (const match of source.matchAll(/(?:from\s*|import\s*\()['"]([^'"]+)['"]/g)) {
      if (!match[1].startsWith('.')) continue;
      const path = new URL(match[1], url).href.slice(root.href.length);
      if (path.endsWith('.mjs')) pending.push(path);
    }
  }
  assert(seen.has('game/rewards/audio-original.mjs'));
});

test('Soundtrack handoff preserves exact permitted bytes and rejects restricted, changed, long or cancelled originals', async () => {
  const f = await soundtrackFixture();
  const prepared = await prepareDiscoveryRecording(f.track, f.blob);
  assert.deepEqual(Buffer.from(await prepared.blob.arrayBuffer()), silenceBytes);
  for (const permission of ['webPlayback', 'offlineCache', 'redistribute']) {
    const track = structuredClone(f.track);
    track.policy = {
      id: track.id,
      sha256: track.asset.sha256,
      webPlayback: 'allowed',
      offlineCache: 'allowed',
      redistribute: 'allowed',
      modify: 'allowed',
      gameplayVideo: 'allowed',
      contentId: 'not-registered',
      [permission]: 'denied',
    };
    await assert.rejects(prepareDiscoveryRecording(track, f.blob), /permission/);
  }
  await assert.rejects(
    prepareDiscoveryRecording(f.track, new Blob(['false'])),
    /MPEG|MP3|metadata/,
  );
  const id = 'builtin.catalog.reviewed',
    track = {
      ...f.track,
      id,
      edition: 'reviewed',
      path: 'optional/soundtracks/reviewed.mp3',
      tags: { genres: ['ambient'], role: 'menu', energy: 1, themes: [] },
      policy: {
        id,
        sha256: f.track.asset.sha256,
        webPlayback: 'allowed',
        offlineCache: 'allowed',
        redistribute: 'denied',
        modify: 'unknown',
        gameplayVideo: 'unknown',
        contentId: 'unknown',
      },
    };
  const catalogue = {
    format: SOUNDTRACK_CATALOGUE_FORMAT_V2,
    edition: 'reviewed',
    tracks: [track],
  };
  await assert.rejects(
    prepareDiscoveryRecording({ ...f.track, id: 'renamed-upload' }, f.blob, { catalogue }),
    /permission/,
  );
  const facts = await inspectMP3(f.blob),
    count = Math.ceil(121 / facts.durationSeconds),
    long = new Blob(Array.from({ length: count }, () => silenceBytes)),
    longFacts = await inspectMP3(long);
  await assert.rejects(
    prepareDiscoveryRecording({ ...f.track, asset: longFacts }, long),
    /120 seconds/,
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(prepareDiscoveryRecording(f.track, f.blob, { signal: controller.signal }), {
    name: 'AbortError',
  });
});

test('audio handoff requires selected approved dependencies and both exact valid transcripts', async () => {
  const f = await fixture(),
    ctx = rewardAssetHandoffContext(f.owner, f.descriptor.id);
  const inspected = await inspectDiscoveryAudioHandoff(ctx, f.originals());
  const edited = editDiscoveryAudioHandoff(
    f.source,
    [f.reward],
    f.reward.id,
    ctx,
    inspected,
    command,
  );
  assert.deepEqual(edited.rewards[0].requirements, f.reward.requirements);
  assert.deepEqual(
    createRewardMissionBindings(edited.source),
    createRewardMissionBindings(f.source),
  );
  assert.notEqual(edited.rewards[0].revision, f.reward.revision);
  assert.equal(edited.rewards[0].payloads.at(-1).asset.sha256, sha(silenceBytes));
  for (const mutate of [
    (o) => {
      o.catalog.assets.find((a) => a.id === 'audio').approved = false;
    },
    (o) => {
      o.catalog.assets.find((a) => a.id === 'uk').publication = 'restricted';
    },
    (o) => {
      o.catalog.campaigns[0].assetIds = ['en', 'uk'];
    },
  ]) {
    const owner = structuredClone(f.owner);
    mutate(owner);
    await assert.rejects(async () =>
      inspectDiscoveryAudioHandoff(
        rewardAssetHandoffContext(owner, f.descriptor.id),
        f.originals(),
      ),
    );
  }
  await assert.rejects(
    inspectDiscoveryAudioHandoff(ctx, { ...f.originals(), uk: undefined }),
    /both/,
  );
  await assert.rejects(
    inspectDiscoveryAudioHandoff(ctx, { ...f.originals(), en: new Blob(['unapproved']) }),
    /not admitted/,
  );
  assert.throws(
    () =>
      editDiscoveryAudioHandoff(f.source, [f.reward], f.reward.id, ctx, inspected, {
        ...command,
        uk: 'audio',
      }),
    /select/,
  );
});

for (const host of ['Company', 'Level'])
  test(`${host} audio authoring previews without earning and round trips the exact selected media closure`, async () => {
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
    const editor = createAudioRewardEditor({
      container,
      window,
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
    const field = (id) => container.querySelector(`[data-audio-handoff-field="${id}"]`),
      action = (id) => container.querySelector(`[data-audio-handoff-action="${id}"]`);
    editor.sync();
    if (host === 'Level') {
      field('packet').files = [new File([JSON.stringify(f.packet())], 'source.json')];
      await field('packet').onchange();
    }
    const originals = f.originals();
    for (const id of ['audio', 'en', 'uk']) field(id + 'File').files = [originals[id]];
    assert.equal(await action('inspect').onclick(), true);
    for (const id of ['audio', 'en', 'uk']) {
      assert.equal(field(id).value, '');
      field(id).value = id;
    }
    field('payloadId').value = command.payloadId;
    for (const id of ['en', 'uk']) field(id + 'Title').value = command.locales[id].title;
    assert.equal(await action('preview').onclick(), true);
    assert.equal(writes, 0);
    assert.equal(container.querySelector('audio'), null, 'Audio is created only by explicit Play.');
    for (let index = 0; index < 20; index++) {
      assert.equal(await action('preview').onclick(), true);
      field('enTitle').oninput();
      assert.equal(container.querySelector('[data-reward-media="audio"]'), null);
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

test('audio editor rejects stale draft Apply and discards a late inspection after disposal', async () => {
  const f = await fixture(),
    document = new Document(),
    container = document.createElement('section'),
    window = new Events();
  document.body.append(container);
  window.URL = {
    createObjectURL() {
      assert.fail('Inspection never creates a playback URL.');
    },
    revokeObjectURL() {},
  };
  let source = f.source,
    writes = 0;
  const editor = createAudioRewardEditor({
    container,
    window,
    getSource: () => source,
    getRewards: () => [f.reward],
    getLocale: () => 'en',
    getCompanySource: () => f.owner,
    apply() {
      writes++;
      return true;
    },
  });
  const field = (id) => container.querySelector(`[data-audio-handoff-field="${id}"]`),
    action = (id) => container.querySelector(`[data-audio-handoff-action="${id}"]`);
  editor.sync();
  const originals = f.originals();
  for (const id of ['audio', 'en', 'uk']) field(id + 'File').files = [originals[id]];
  assert.equal(await action('inspect').onclick(), true);
  for (const id of ['audio', 'en', 'uk']) field(id).value = id;
  field('payloadId').value = command.payloadId;
  for (const id of ['en', 'uk']) field(id + 'Title').value = command.locales[id].title;
  source = { ...source, revision: 'changed-while-inspected' };
  assert.equal(await action('apply').onclick(), false);
  assert.equal(writes, 0);
  let release;
  originals.audio.arrayBuffer = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const pending = action('inspect').onclick();
  assert.equal(typeof release, 'function');
  editor.dispose();
  release(
    silenceBytes.buffer.slice(
      silenceBytes.byteOffset,
      silenceBytes.byteOffset + silenceBytes.length,
    ),
  );
  await pending;
  assert.equal(container.children.length, 0);
  assert.equal(writes, 0);
});
