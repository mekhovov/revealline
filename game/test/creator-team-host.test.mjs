import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { parse } from 'parse5';
import { Document } from './helpers/couch-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { setLocale, getLocale } from '../i18n/index.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { mountTeamCreatorStudio } from '../creator/team-studio.mjs';
import { generateCreatorTeamCampaign, prepareCreatorTeamCampaign } from '../creator/team.mjs';
import {
  prepareCreatorTeamMediaCampaign,
  exportCreatorTeamMediaCampaign,
  importCreatorTeamMediaCampaign,
} from '../creator/team-media.mjs';
import { createInstalledTeamCampaignStore } from '../creator/team-installed.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const decodeImage = async () => ({ naturalWidth: 1152, naturalHeight: 576 });
const html = await readFile(new URL('../creator/team.html', import.meta.url), 'utf8');
function png() {
  const chunk = (type, body) => {
    const bytes = Buffer.concat([Buffer.from(type), body]);
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const size = Buffer.alloc(4),
      tail = Buffer.alloc(4);
    size.writeUInt32BE(body.length);
    tail.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([size, bytes, tail]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1152);
  header.writeUInt32BE(576, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.alloc((1152 * 4 + 1) * 576))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const pixels = png(),
  picture = new Blob([pixels], { type: 'image/png' });
let preparedPromise;
const prepared = () =>
  (preparedPromise ??= (async () => {
    const source = generateCreatorTeamCampaign({
      id: 'my-team-campaign',
      name: 'My Team campaign',
      seed: 0,
    });
    return prepareCreatorTeamCampaign(source.pack, source.provenance);
  })());

async function fixture(t, { services = {}, overrides = {}, storeOptions = {} } = {}) {
  const doc = new Document(),
    win = doc.defaultView;
  doc.parentNode = win;
  const body = parse(html)
    .childNodes.find((n) => n.tagName === 'html')
    .childNodes.find((n) => n.tagName === 'body');
  function append(parent, source) {
    if (!source.tagName) return;
    const node = doc.createElement(source.tagName);
    for (const { name, value } of source.attrs) {
      node.setAttribute(name, value);
      if (['id', 'type', 'value', 'href'].includes(name)) node[name] = value;
      if (['hidden', 'disabled', 'open'].includes(name)) node[name] = true;
      if (name === 'class') node.className = value;
    }
    parent.append(node);
    for (const child of source.childNodes ?? []) append(node, child);
  }
  for (const child of body.childNodes) append(doc.body, child);
  const sections = doc.createElement('button');
  sections.id = 'sections';
  doc.body.prepend(sections);
  const independent = doc.createElement('button');
  independent.id = 'independent-disabled';
  independent.disabled = true;
  doc.body.append(independent);
  const navigation = attachControllerNavigation({
    document: doc,
    keyboard: true,
    getScope: () => 'authoring',
    getRoot: () => doc.body,
    getDefaultFocus: () => sections,
  });
  const realStore = createInstalledTeamCampaignStore({
    indexedDB: managedIndexedDB().indexedDB,
    decodeImage,
    ...storeOptions,
  });
  const store = { ...realStore, ...overrides },
    downloads = [];
  const host = mountTeamCreatorStudio({
    document: doc,
    window: win,
    store,
    inputHost: { navigation },
    services: {
      prepareGameplay: async () => prepared(),
      preparePicture: async (_file, { alt, fit }) => {
        if (!alt.trim()) throw new Error('Describe your picture.');
        return {
          blob: picture,
          sha256: hash(pixels),
          bytes: picture.size,
          mime: 'image/png',
          width: 1152,
          height: 576,
          alt,
          fit,
        };
      },
      prepareMedia: (gameplay, bindings, assets, options) =>
        prepareCreatorTeamMediaCampaign(gameplay, bindings, assets, { ...options, decodeImage }),
      download: (blob, name) => downloads.push({ blob, name }),
      ...services,
    },
  });
  t.after(() => {
    host.destroy();
    navigation.destroy();
  });
  const $ = (id) => doc.getElementById(id);
  const act = (id) => {
    $(id).focus();
    return $(id).onclick();
  };
  async function reviewed() {
    await act('generate');
    for (const input of doc.querySelectorAll('input[type="file"]'))
      if (input.id.startsWith('team-picture')) input.files = [picture];
    await act('review');
    assert.equal($('approval-panel').hidden, false, $('status').textContent);
  }
  return {
    doc,
    win,
    navigation,
    store,
    realStore,
    $,
    act,
    reviewed,
    downloads,
    host,
    sections,
    independent,
  };
}

test('actual Team host keeps async Cancel owned, leaves shared controls alone and returns on failed/cancelled generation', async (t) => {
  let release, signal;
  const h = await fixture(t, {
    services: {
      prepareGameplay: async (_pack, _proof, options) => {
        signal = options.signal;
        await new Promise((resolve) => {
          release = resolve;
        });
        return prepared();
      },
    },
  });
  h.navigation.engage();
  const pending = h.act('generate');
  assert.equal(h.doc.activeElement, h.$('cancel'));
  for (let i = 0; i < 4; i++) h.navigation.handle({});
  assert.equal(h.doc.activeElement, h.$('cancel'));
  assert.equal(h.sections.disabled, false);
  assert.equal(h.independent.disabled, true);
  h.$('cancel').onclick();
  assert.equal(signal.aborted, true);
  release();
  await pending;
  assert.equal(h.doc.activeElement, h.$('generate'));
  assert.equal(h.$('media-panel').hidden, true);
  h.$('campaign-name').value = '';
  await h.act('generate');
  assert.equal(h.doc.activeElement, h.$('generate'));
  assert.equal(h.$('status').classList.contains('error'), true);
});

test('invalid and cancelled regeneration preserve prior media selections and gameplay', async (t) => {
  let cancelNext = false,
    release;
  const h = await fixture(t, {
    services: {
      prepareGameplay: async () => {
        if (cancelNext)
          await new Promise((r) => {
            release = r;
          });
        return prepared();
      },
    },
  });
  await h.reviewed();
  const original = h.$('team-picture-0');
  h.$('campaign-name').value = '';
  h.$('campaign-name').emit('input');
  await h.act('generate');
  assert.equal(h.$('team-picture-0'), original);
  assert.equal(original.files[0], picture);
  assert.equal(h.$('media-panel').hidden, false);
  h.$('campaign-name').value = 'My Team campaign';
  h.$('campaign-name').emit('input');
  cancelNext = true;
  const pending = h.act('generate');
  h.$('cancel').onclick();
  release();
  await pending;
  assert.equal(h.$('team-picture-0'), original);
  assert.equal(h.$('review').disabled, false);
});

test('storage denial leaves validated review readable and exact export available, without enabling Install', async (t) => {
  const h = await fixture(t, {
    overrides: {
      reviewInstall: async () => {
        throw new Error('Storage unavailable');
      },
    },
  });
  await h.reviewed();
  await h.act('creator-review-read-0');
  assert.equal(h.$('creator-review-reading-0').dataset.controllerReading, 'true');
  assert.equal(h.$('install').disabled, true);
  assert.equal(h.$('download').disabled, true);
  h.navigation.handle({ back: true });
  assert.equal(h.doc.activeElement, h.$('creator-review-read-0'));
  assert.equal(h.$('download').disabled, true, 'reading must not approve');
  await h.act('approve');
  await h.act('download');
  assert.equal(h.downloads.length, 1);
  const imported = await importCreatorTeamMediaCampaign(h.downloads[0].blob, { decodeImage });
  assert.equal(imported.evidence.length, 12);
  assert.equal(imported.pack.levels.length, 2);
});

test('Team install is retryable and only its owned successful completion advances to Open Team', async (t) => {
  let attempts = 0;
  const h = await fixture(t, {
    overrides: {
      install: async () => {
        if (++attempts === 1) throw new Error('Transient write failure');
        return { editionId: 'a'.repeat(64), alreadyInstalled: false };
      },
    },
  });
  await h.reviewed();
  await h.act('approve');
  await h.act('install');
  assert.equal(h.doc.activeElement, h.$('install'));
  assert.equal(h.$('install').disabled, false);
  await h.act('install');
  assert.equal(h.doc.activeElement, h.$('play'));
  assert.equal(h.$('play').href, '../couch/relay-rescue.html');
  assert.equal(h.$('team-play-help').hidden, false);
});

for (const loss of ['new focus', 'blur', 'hidden', 'pagehide'])
  test(`actual Team install does not reclaim focus after ${loss}`, async (t) => {
    let release;
    const h = await fixture(t, {
      overrides: {
        install: async () => {
          await new Promise((r) => {
            release = r;
          });
          return { editionId: 'b'.repeat(64) };
        },
      },
    });
    await h.reviewed();
    await h.act('approve');
    const pending = h.act('install');
    if (loss === 'new focus') h.sections.focus();
    if (loss === 'blur') h.win.emit('blur');
    if (loss === 'hidden') {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
    }
    if (loss === 'pagehide') h.win.emit('pagehide');
    release();
    await pending;
    assert.notEqual(h.doc.activeElement, h.$('play'));
    if (loss === 'pagehide') assert.equal(h.$('play').hidden, true);
  });

test('actual installed runtime reopen preserves exact portable bytes; explicit public edits invalidate approval and revalidate', async (t) => {
  const h = await fixture(t);
  await h.reviewed();
  await h.act('approve');
  await h.act('download');
  await h.act('install');
  const original = Buffer.from(await h.downloads[0].blob.arrayBuffer());
  await h.act('refresh-installed');
  const button = h.doc.querySelector('[data-team-edition]');
  assert.ok(button);
  button.focus();
  await button.onclick();
  assert.equal(h.$('download').disabled, true);
  assert.equal(h.$('team-fit-0').disabled, true);
  assert.equal(h.$('team-alt-0').disabled, true);
  assert.equal(h.$('team-picture-0').files, undefined, 'no invented original source file');
  await h.act('review');
  await h.act('approve');
  await h.act('download');
  assert.deepEqual(Buffer.from(await h.downloads[1].blob.arrayBuffer()), original);
  const current = await importCreatorTeamMediaCampaign(h.downloads[1].blob, { decodeImage });
  assert.deepEqual(
    Buffer.from(await exportCreatorTeamMediaCampaign(current).arrayBuffer()),
    original,
  );
  h.$('creator-credit').value = '';
  h.$('creator-credit').emit('input');
  assert.equal(h.$('download').disabled, true);
  await h.act('review');
  assert.equal(h.$('approval-panel').hidden, true);
  h.$('creator-credit').value = 'Changed public credit';
  h.$('creator-credit').emit('input');
  await h.act('review');
  await h.act('approve');
  await h.act('download');
  const changed = await importCreatorTeamMediaCampaign(h.downloads[2].blob, { decodeImage });
  assert.equal(changed.manifest.credits.creator, 'Changed public credit');
  assert.deepEqual(changed.manifest.gameplay, current.manifest.gameplay);
  assert.deepEqual(changed.manifest.assets, current.manifest.assets);
  assert.notDeepEqual(Buffer.from(await h.downloads[2].blob.arrayBuffer()), original);
});

test('installed raw public metadata, custom mission name and retained video survive untouched re-review exactly', async (t) => {
  const video = new Blob(['modeled inspected complete video'], { type: 'video/mp4' }),
    videoHash = hash(Buffer.from(await video.arrayBuffer()));
  const inspectVideo = async () => ({
    info: {
      sha256: videoHash,
      bytes: video.size,
      mime: 'video/mp4',
      width: 1280,
      height: 720,
      durationSeconds: 6,
    },
    dispose() {},
  });
  const source = generateCreatorTeamCampaign({
    id: 'imported-campaign',
    name: ' Imported campaign ',
    seed: 0,
  });
  const pack = structuredClone(source.pack);
  pack.levels[0].name = 'A custom mission title';
  const gameplay = await prepareCreatorTeamCampaign(pack, source.provenance);
  const media = await prepareCreatorTeamMediaCampaign(
    gameplay,
    gameplay.pack.levels.map((level, index) => ({
      levelId: level.id,
      pictureSha256: hash(pixels),
      ...(index
        ? {}
        : {
            story: {
              videoSha256: videoHash,
              startSeconds: 1,
              endSeconds: 4,
              description: ' A public victory description ',
            },
          }),
    })),
    [
      { sha256: hash(pixels), blob: picture },
      { sha256: videoHash, blob: video },
    ],
    {
      decodeImage,
      inspectVideo,
      credits: { creator: ' Creator ', media: ' Media credit ', license: ' Permission ' },
    },
  );
  const h = await fixture(t, {
    storeOptions: { inspectVideo },
    services: {
      prepareMedia: (gameplay, bindings, assets, options) =>
        prepareCreatorTeamMediaCampaign(gameplay, bindings, assets, {
          ...options,
          decodeImage,
          inspectVideo,
        }),
    },
  });
  const receipt = await h.realStore.install(media);
  await h.act('refresh-installed');
  const open = h.doc.querySelector(`[data-team-edition="${receipt.editionId}"]`);
  open.focus();
  await open.onclick();
  assert.equal(h.$('campaign-name').value, ' Imported campaign ');
  assert.equal(h.$('team-story-0').value, ' A public victory description ');
  assert.equal(h.$('team-start-0').value, '1');
  assert.equal(h.$('team-end-0').value, '4');
  assert.equal(
    h.$('team-video-0').closest('article').querySelectorAll('p').at(-1).hidden,
    true,
    'a retained video must not show the empty-file means picture-only instruction',
  );
  await h.act('review');
  assert.equal(h.$('creator-review-title-0').textContent, 'A custom mission title');
  await h.act('approve');
  await h.act('download');
  assert.deepEqual(
    Buffer.from(await h.downloads[0].blob.arrayBuffer()),
    Buffer.from(await exportCreatorTeamMediaCampaign(media).arrayBuffer()),
  );
  h.$('team-end-0').value = '9';
  h.$('team-end-0').emit('input');
  await h.act('review');
  assert.equal(
    h.$('approval-panel').hidden,
    true,
    'invalid edited range is revalidated against retained video',
  );
});

test('beforeunload and persisted page return abort current work without destroying the usable editor', async (t) => {
  let release,
    waiting = true,
    signal;
  const h = await fixture(t, {
    services: {
      prepareGameplay: async (_pack, _proof, options) => {
        signal = options.signal;
        if (waiting)
          await new Promise((resolve) => {
            release = resolve;
          });
        return prepared();
      },
    },
  });
  const pending = h.act('generate');
  h.win.emit('beforeunload');
  h.win.emit('pagehide', { persisted: true });
  assert.equal(signal.aborted, true);
  release();
  await pending;
  h.win.emit('pageshow', { persisted: true });
  waiting = false;
  await h.act('generate');
  assert.equal(h.$('media-panel').hidden, false);
  await h.act('refresh-installed');
  assert.equal(h.$('status').classList.contains('error'), false);
});

test('review dimensions and storage availability both follow live EN/UK changes', async (t) => {
  const previous = getLocale();
  t.after(() => setLocale(previous));
  await setLocale('en');
  const h = await fixture(t);
  await h.reviewed();
  const detail = h.$('creator-review-reading-0').querySelector('p');
  assert.match(detail.textContent, /picture only/);
  assert.match(h.$('package-summary').textContent, /ready to install/);
  await setLocale('uk');
  assert.match(detail.textContent, /лише зображення/);
  assert.doesNotMatch(h.$('package-summary').textContent, /ready to install/);
  assert.match(h.$('package-summary').textContent, /готов/);
});
