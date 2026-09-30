import { rewardAudioFixture as wav } from './helpers/reward-audio-fixture.mjs';
import { mountLocalRewardMediaPreview } from '../studio/reward-media-preview.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Document, Element, Events } from './helpers/couch-dom.mjs';
import { pngBytes } from './helpers/media-fixtures.mjs';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { createAudioMaster } from '../ui/audio-master.mjs';
import { mountRewardMedia } from '../ui/reward-media.mjs';
import { resolveEditionSelection } from '../editions/model.mjs';
import {
  inspectRewardMediaBytes,
  validateRewardCaptions,
  rewardMediaReferences,
} from '../rewards/media-format.mjs';
import { compileEdition } from '../../scripts/compile-edition.mjs';
import { createStudioReward } from '../../authoring/company-studio/reward-editor.mjs';
import { companyDraftFiles, companySourceDraft } from '../../scripts/company-studio.mjs';
import { validatePublicSourceEligibility } from '../../publishing/edition-admission.mjs';
import { loadEditionBootstrap } from '../editions/bootstrap.mjs';
import { captureEditionPresentation } from '../editions/retained-presentation.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const settles = async () => {
  for (let i = 0; i < 12; i++) await new Promise((resolve) => setTimeout(resolve, 2));
};
async function fixture(type = 'video') {
  const f = await editionProviderFixture(),
    catalog = structuredClone(f.catalog),
    descriptor = catalog.campaigns[0],
    bytes = new Map(),
    requests = [],
    locales = { en: { title: 'Diagnostic recording' }, uk: { title: 'Діагностичний запис' } };
  const asset = (id, extension, data) => {
    const path = `game/editions/assets/sample/${id}.${extension}`;
    catalog.assets.push({
      id,
      path,
      sha256: sha(data),
      bytes: data.length,
      publication: 'public',
      approved: true,
      dependencies: [],
    });
    descriptor.assetIds.push(id);
    bytes.set(path, data);
    return { assetId: id, sha256: sha(data) };
  };
  const payload = {
    id: 'recording',
    type,
    locales,
    asset: asset(
      'recording',
      type === 'video' ? 'mp4' : 'wav',
      type === 'video'
        ? await readFile(new URL('./fixtures/video/owned-poster-fixture.mp4', import.meta.url))
        : wav(),
    ),
    transcript: Object.fromEntries(
      ['en', 'uk'].map((locale) => [
        locale,
        asset(
          `transcript-${locale}`,
          'txt',
          Buffer.from(
            locale === 'en' ? 'Owned diagnostic recording.' : 'Власний діагностичний запис.',
          ),
        ),
      ]),
    ),
  };
  if (type === 'video') {
    payload.poster = asset('poster', 'png', pngBytes());
    payload.captions = Object.fromEntries(
      ['en', 'uk'].map((locale) => [
        locale,
        asset(
          `captions-${locale}`,
          'vtt',
          Buffer.from(
            `WEBVTT\n\n00:00.000 --> 00:01.000\n${locale === 'en' ? 'Diagnostic.' : 'Діагностика.'}\n`,
          ),
        ),
      ]),
    );
  }
  const fetcher = async (url) => {
    const path = new URL(url).pathname.slice(1);
    requests.push(path);
    return bytes.has(path) ? new Response(bytes.get(path)) : new Response('', { status: 404 });
  };
  const provider = {
    editionId: catalog.editions[0].id,
    rootURL: 'https://fixture.invalid/',
    catalog,
    currentCatalog: catalog,
    bootstrap: {
      catalog,
      selection: resolveEditionSelection(catalog, { editionId: catalog.editions[0].id }),
    },
  };
  const sourceFiles = new Map(
    [...f.files]
      .filter(([name]) => !name.endsWith('catalog.json'))
      .map(([name, value]) => [name, Buffer.from(JSON.stringify(value))]),
  );
  for (const [name, value] of bytes) sourceFiles.set(name, value);
  descriptor.rewardPath = 'game/content/sample/rewards.json';
  const reward = structuredClone(
    createStudioReward({
      campaign: descriptor,
      source: f.source,
      id: 'media-reward',
      rule: 'all-missions',
      locales: {
        en: { title: 'Media', teaser: 'A recording', paragraph: 'Fictional diagnostic.' },
        uk: { title: 'Медіа', teaser: 'Запис', paragraph: 'Вигадана діагностика.' },
      },
    }),
  );
  reward.payloads = [payload];
  sourceFiles.set(descriptor.rewardPath, Buffer.from(JSON.stringify([reward])));
  sourceFiles.set(
    'game/company.html',
    Buffer.from('<!doctype html><html><head></head><body>Game</body></html>'),
  );
  return {
    ...f,
    catalog,
    descriptor,
    payload,
    reward,
    bytes,
    requests,
    fetcher,
    provider,
    sourceFiles,
    build: () =>
      compileEdition({
        catalog,
        editionIds: [provider.editionId],
        files: sourceFiles,
        enginePaths: ['game/company.html'],
      }),
  };
}
function harness(f, { facts = {}, playFailure = false } = {}) {
  const document = new Document(),
    window = new Events(),
    container = document.createElement('section'),
    urls = new Map(),
    videos = [];
  document.body.append(container);
  let next = 1,
    gains = 0,
    subscribers = 0;
  const originalMaster = createAudioMaster({ muted: false, volume: 0.6 });
  const audioMaster = {
    ...originalMaster,
    subscribe(fn) {
      subscribers++;
      const release = originalMaster.subscribe(fn);
      return () => {
        subscribers--;
        release();
      };
    },
  };
  const URLImpl = {
    createObjectURL(blob) {
      const url = `blob:reward-${next++}`;
      urls.set(url, blob);
      return url;
    },
    revokeObjectURL(url) {
      urls.delete(url);
    },
  };
  class Media extends Element {
    constructor(type) {
      super(document, type);
      this.duration = facts.duration ?? 6;
      this.videoWidth = facts.width ?? 640;
      this.videoHeight = facts.height ?? 360;
      this.paused = true;
      this.playCalls = 0;
      this.loads = 0;
    }
    load() {
      this.loads++;
      if (this.src) queueMicrotask(() => this.emit('loadedmetadata'));
    }
    pause() {
      this.paused = true;
      this.emit('pause');
    }
    play() {
      this.playCalls++;
      if (playFailure) return Promise.reject(new Error('Gesture required'));
      this.paused = false;
      this.emit('play');
      return Promise.resolve();
    }
    removeAttribute(name) {
      super.removeAttribute(name);
      if (name === 'src') this.src = '';
    }
  }
  const options = {
    container,
    provider: f.provider,
    payload: f.payload,
    fetcher: f.fetcher,
    document,
    window,
    URLImpl,
    audioMaster,
    musicDucker: {
      acquire(factor) {
        assert.equal(factor, 0);
        gains++;
        let released = false;
        return () => {
          if (!released) {
            released = true;
            gains--;
          }
        };
      },
    },
    createMedia(type) {
      const media = new Media(type);
      videos.push(media);
      return media;
    },
  };
  return {
    options,
    document,
    window,
    container,
    urls,
    videos,
    audioMaster,
    play: () => container.querySelector('[data-reward-media-action="play"]').emit('click'),
    counts: () => ({ gains, subscribers, urls: urls.size }),
  };
}

test('media roles share strict native headers and bounded plain UTF-8/WebVTT admission', async () => {
  const f = await fixture();
  for (const { role, reference } of rewardMediaReferences(f.payload)) {
    const asset = f.catalog.assets.find((a) => a.id === reference.assetId);
    assert(inspectRewardMediaBytes(asset, role, f.bytes.get(asset.path)).mime);
  }
  const audio = await fixture('audio'),
    a = audio.catalog.assets[0];
  assert.equal(inspectRewardMediaBytes(a, 'audio', audio.bytes.get(a.path)).mime, 'audio/wav');
  for (const bad of [
    'WEBVTT\n\n00:00.000 --> 00:01.000\n<script>bad</script>',
    'WEBVTT\n\nSTYLE\n::cue { background: red; }',
    'WEBVTT\n\n00:00.000 --> 00:02:01.000\nToo long',
    'WEBVTT\n\n00:02.000 --> 00:01.000\nReversed',
  ])
    assert.throws(() => validateRewardCaptions(bad));
  assert.throws(
    () => inspectRewardMediaBytes({ ...a, path: 'anything.mp4' }, 'audio', audio.bytes.get(a.path)),
    /extension/,
  );
  assert.throws(() => inspectRewardMediaBytes(a, 'audio', Buffer.alloc(a.bytes)), /header/);
  const transcript = f.catalog.assets.find((a) => a.id === 'transcript-en');
  assert.throws(
    () =>
      inspectRewardMediaBytes(
        { ...transcript, bytes: 2 },
        'transcript',
        new Uint8Array([255, 255]),
      ),
    /encoded/,
  );
});

test('explicit native playback respects the real audio master, language, foreground lease and blur', async () => {
  const f = await fixture(),
    h = harness(f),
    viewer = mountRewardMedia({ ...h.options, locale: 'uk' });
  await settles();
  assert.equal(h.videos.length, 0);
  assert.equal(
    f.requests.some((path) => path.endsWith('.mp4')),
    false,
  );
  assert(h.container.textContent.includes('Власний діагностичний запис.'));
  h.play();
  await settles();
  const media = h.videos[0];
  assert.equal(media.autoplay, false);
  assert.equal(media.playCalls, 1);
  assert.equal(media.volume, 0.6);
  assert.equal(media.muted, false);
  assert.equal(h.counts().gains, 1);
  assert.equal(media.querySelector('track').srclang, 'uk');
  h.audioMaster.setMuted(true);
  assert.equal(media.muted, true);
  h.audioMaster.setVolume(0.2);
  h.audioMaster.setMuted(false);
  assert.equal(media.volume, 0.2);
  h.window.emit('blur');
  assert(media.paused);
  assert.equal(h.counts().gains, 0);
  h.window.emit('focus');
  await settles();
  assert.equal(media.playCalls, 1);
  viewer.dispose();
  assert.deepEqual(h.counts(), { gains: 0, subscribers: 0, urls: 0 });
  assert.equal(h.container.children.length, 0);
});

test('one audio source owns foreground and 20 result cycles release media, leases and listeners', async () => {
  const f = await fixture('audio'),
    h = harness(f);
  for (let index = 0; index < 20; index++) {
    const viewer = mountRewardMedia(h.options);
    await settles();
    h.play();
    await settles();
    assert.equal(h.counts().gains, 1);
    const otherContainer = h.document.createElement('div');
    h.document.body.append(otherContainer);
    const other = mountRewardMedia({ ...h.options, container: otherContainer });
    await settles();
    otherContainer.querySelector('[data-reward-media-action="play"]').emit('click');
    await settles();
    assert(h.videos.at(-2).paused);
    assert.equal(h.counts().gains, 1);
    other.dispose();
    viewer.dispose();
    otherContainer.remove();
    assert.deepEqual(h.counts(), { gains: 0, subscribers: 0, urls: 0 });
  }
  assert([...h.window.listeners.values()].every((set) => set.size === 0));
  assert([...h.document.listeners.values()].every((set) => set.size === 0));
});

test('caption failure before metadata or during playback releases its decoder and requires a fresh explicit Play', async () => {
  for (const beforeMetadata of [true, false]) {
    const f = await fixture(),
      h = harness(f),
      createMedia = h.options.createMedia;
    let firstTrack;
    h.options.createMedia = (type) => {
      const media = createMedia(type),
        first = h.videos.length === 1;
      media.load = function () {
        this.loads++;
        if (!this.src) return;
        const track = this.querySelector('track');
        if (first) firstTrack = track;
        queueMicrotask(() => {
          // Native text-track failures do not bubble to the media element.
          if (first && beforeMetadata) track.emit('error', { bubbles: false });
          this.emit('loadedmetadata', { bubbles: false });
        });
      };
      return media;
    };
    const viewer = mountRewardMedia(h.options);
    try {
      await settles();
      h.play();
      await settles();
      const failed = h.videos[0];
      if (!beforeMetadata) {
        assert.equal(failed.playCalls, 1);
        firstTrack.emit('error', { bubbles: false });
      }
      await settles();
      assert.equal(failed.playCalls, beforeMetadata ? 0 : 1);
      assert.equal(failed.paused, true);
      assert.equal(failed.src, '');
      assert.equal(failed.parentNode, null);
      assert.equal(failed.children.length, 0);
      assert(failed.loads >= 2, 'Removing the failed source resets the native decoder.');
      assert([...failed.listeners.values()].every((set) => set.size === 0));
      assert([...firstTrack.listeners.values()].every((set) => set.size === 0));
      assert.deepEqual(h.counts(), { gains: 0, subscribers: 0, urls: 1 });
      assert(h.container.querySelector('details').textContent.includes('Owned diagnostic'));
      assert.equal(h.container.querySelector('img').hidden, false);
      assert.match(
        h.container.querySelector('[role="status"]').textContent,
        /This exact recording cannot play here/,
      );
      failed.emit('loadedmetadata', { bubbles: false });
      firstTrack.emit('error', { bubbles: false });
      await settles();
      assert.equal(h.videos.length, 1, 'Late decoder events never prepare or play a new source.');
      h.play();
      await settles();
      assert.equal(h.videos.length, 2);
      assert.equal(h.videos[1].playCalls, 1);
      assert.equal(h.videos[1].paused, false);
      assert.deepEqual(h.counts(), { gains: 1, subscribers: 1, urls: 3 });
    } finally {
      viewer.dispose();
    }
    assert.deepEqual(h.counts(), { gains: 0, subscribers: 0, urls: 0 });
    assert([...h.window.listeners.values()].every((set) => set.size === 0));
    assert([...h.document.listeners.values()].every((set) => set.size === 0));
  }
});

test('invalid native facts, missing exact bytes, delayed completion and autoplay rejection leave useful fallback', async () => {
  const f = await fixture();
  for (const facts of [
    { duration: Infinity },
    { duration: 121 },
    { width: 4000 },
    { duration: 0.5 },
  ]) {
    const h = harness(f, { facts }),
      viewer = mountRewardMedia(h.options);
    await settles();
    h.play();
    await settles();
    assert.equal(h.videos[0].playCalls, 0);
    assert.equal(h.counts().gains, 0);
    assert(h.container.querySelector('details').textContent.includes('Owned diagnostic'));
    viewer.dispose();
    assert.equal(h.urls.size, 0);
  }
  const broken = await fixture();
  broken.bytes.set(broken.catalog.assets[0].path, Buffer.alloc(broken.catalog.assets[0].bytes));
  const b = harness(broken),
    bv = mountRewardMedia(b.options);
  await settles();
  b.play();
  await settles();
  assert.equal(b.videos.length, 0);
  assert(b.container.querySelector('details'));
  bv.dispose();
  const rejected = harness(f, { playFailure: true }),
    rv = mountRewardMedia(rejected.options);
  await settles();
  rejected.play();
  await settles();
  assert.equal(rejected.counts().gains, 0);
  rv.dispose();
  const waiting = harness(f),
    wv = mountRewardMedia({
      ...waiting.options,
      fetcher: () => new Promise(() => {}),
      timeoutMs: 20,
    });
  waiting.play();
  wv.dispose();
  await settles();
  assert.equal(waiting.urls.size, 0);
  assert.equal(waiting.videos.length, 0);
});

test('compiler and Company Studio round trips retain exact media closure while rejecting tampering and private source', async () => {
  for (const type of ['audio', 'video']) {
    const f = await fixture(type),
      built = await f.build();
    for (const path of f.bytes.keys()) assert(built.files.has(path));
    const restored = companyDraftFiles(
      companySourceDraft({ catalog: f.catalog, files: f.sourceFiles }),
    );
    assert.deepEqual(JSON.parse(restored.files.get(f.descriptor.rewardPath)), [f.reward]);
    validatePublicSourceEligibility({ files: new Map(f.bytes), assets: f.catalog.assets });
    const rogue = new Map(f.bytes);
    rogue.set('game/editions/assets/unreviewed.vtt', Buffer.from('private'));
    assert.throws(
      () => validatePublicSourceEligibility({ files: rogue, assets: f.catalog.assets }),
      /eligibility/,
    );
    const pinned = f.catalog.assets[0],
      original = f.sourceFiles.get(pinned.path);
    f.sourceFiles.set(pinned.path, Buffer.alloc(pinned.bytes));
    await assert.rejects(f.build(), /SHA-256/);
    f.sourceFiles.set(pinned.path, original);
    const transcript = f.catalog.assets.find((a) => a.id === 'transcript-en');
    const transcriptBytes = f.sourceFiles.get(transcript.path);
    transcript.path = transcript.path.replace('.txt', '.html');
    f.sourceFiles.set(transcript.path, transcriptBytes);
    await assert.rejects(f.build(), /extension/);
  }
});

test('earned recordings restore only the registered exact retained original and compiler checks retained media bytes', async () => {
  const f = await fixture('audio'),
    id = f.provider.editionId;
  const catalogURL = 'https://fixture.invalid/edition-catalog.json';
  const fetcher = async (url) => {
    const path = new URL(url).pathname.slice(1);
    f.requests.push(path);
    return path === 'edition-catalog.json'
      ? new Response(JSON.stringify(f.catalog))
      : f.sourceFiles.has(path)
        ? new Response(f.sourceFiles.get(path))
        : new Response('', { status: 404 });
  };
  const load = () =>
    loadEditionBootstrap({
      fetcher,
      catalogURL,
      contentBaseURL: f.provider.rootURL,
      editionId: id,
      allowMissing: false,
    });
  const original = await load(),
    snapshot = await captureEditionPresentation(original),
    serialized = Buffer.from(JSON.stringify(snapshot));
  const history = {
    id: snapshot.authoredPresentationSha256,
    path: `game/editions/retained/${id}/original.json`,
    bytes: serialized.length,
    sha256: sha(serialized),
  };
  f.sourceFiles.set(history.path, serialized);
  f.catalog.editions[0].presentationHistory = [history];
  f.catalog.editions[0].revision++;
  const originalAsset = structuredClone(f.catalog.assets[0]),
    originalPayload = structuredClone(f.payload),
    replacement = wav();
  replacement[100] = 1;
  f.catalog.assets[0].sha256 = sha(replacement);
  f.catalog.assets[0].path = 'game/editions/assets/sample/new-recording.wav';
  f.sourceFiles.set(f.catalog.assets[0].path, replacement);
  f.reward.revision = '2';
  f.reward.payloads[0].asset.sha256 = sha(replacement);
  f.sourceFiles.set(f.descriptor.rewardPath, Buffer.from(JSON.stringify([f.reward])));
  const bootstrap = await load();
  const h = harness({
    ...f,
    payload: originalPayload,
    fetcher,
    provider: { ...f.provider, bootstrap },
  });
  const viewer = mountRewardMedia(h.options);
  await settles();
  h.play();
  await settles();
  assert.equal(h.videos[0].playCalls, 1);
  assert(f.requests.includes(history.path));
  assert(f.requests.includes(originalAsset.path));
  viewer.dispose();
  const build = await f.build();
  assert(build.files.has(originalAsset.path));
  assert(build.files.has(f.catalog.assets[0].path));
  f.sourceFiles.set(originalAsset.path, Buffer.alloc(originalAsset.bytes));
  await assert.rejects(f.build(), /exact SHA-256/);
});

test('Level Studio local preview matches authored pins, uses the shared viewer and clears all owners on reset', async () => {
  const f = await fixture('audio'),
    h = harness(f);
  h.window.URL = h.options.URLImpl;
  const create = h.document.createElement.bind(h.document);
  h.document.createElement = (tag) =>
    ['audio', 'video'].includes(tag) ? h.options.createMedia(tag) : create(tag);
  const preview = mountLocalRewardMediaPreview({
    container: h.container,
    payload: f.payload,
    window: h.window,
  });
  const input = h.container.querySelector('input');
  input.files = [...f.bytes].map(([path, bytes]) => ({
    name: path.split('/').at(-1),
    size: bytes.length,
    arrayBuffer: async () => bytes,
  }));
  input.emit('change');
  await settles();
  h.play();
  await settles();
  assert.equal(h.videos[0].playCalls, 1);
  assert.equal(f.requests.length, 0);
  input.files = [{ name: 'unrelated.wav', size: 1, arrayBuffer: async () => new Uint8Array([0]) }];
  input.emit('change');
  await settles();
  assert.equal(h.urls.size, 0);
  assert(h.container.textContent.includes('differs from every authored reward pin'));
  preview.dispose();
  assert.equal(h.container.children.length, 0);
});
