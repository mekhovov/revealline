import assert from 'node:assert/strict';
import test from 'node:test';
import { soloPage, SoloElement, settle } from './helpers/solo-dom.mjs';
import { createStoryFixture, inspectionEnvironment } from './helpers/victory-story-fixture.mjs';
import { pngBytes, mediaFixture, libraryRecord } from './helpers/media-fixtures.mjs';
import { validateMediaLibrary } from '../media-library.mjs';
import { createPresentationPins } from '../presentation-pins.mjs';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { createStoryMediaStore } from '../story-media-store.mjs';
import { loadLibrary } from '../library.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const source = createStoryFixture(),
  base = mediaFixture(false),
  raw = libraryRecord(base.identity);
raw.assets = source.library.assets;
const library = validateMediaLibrary(raw, { identityCatalog: base.identityCatalog });
const pin = createPresentationPins({
  library,
  identityCatalog: base.identityCatalog,
  ...base.request(),
  themeIds: ['fpv'],
}).choices[0];
const f = {
    ...source,
    ...base,
    library,
    pin,
    descriptor: { ...source.descriptor, picturePin: pin },
  },
  key = 'revealline.library.dev.v1';
class Picture {
  width = 1;
  height = 1;
  naturalWidth = 1;
  naturalHeight = 1;
  set src(value) {
    this.url = value;
    if (value) queueMicrotask(() => this.onload?.());
  }
  get src() {
    return this.url;
  }
  decode() {
    return Promise.resolve();
  }
  removeAttribute() {
    this.url = '';
  }
}
function browserVideo(page) {
  const create = page.doc.createElement.bind(page.doc),
    videos = [];
  const canvas = (element) => {
    const context = new Proxy(
      { canvas: element },
      {
        get(target, key) {
          return key in target ? target[key] : () => {};
        },
        set(target, key, value) {
          target[key] = value;
          return true;
        },
      },
    );
    element.getContext = () => context;
  };
  canvas(page.$('gallery-canvas'));
  page.doc.createElement = (tag) => {
    const element = create(tag);
    if (tag === 'canvas') canvas(element);
    element.insertBefore = (child, target) => {
      child.remove();
      const index = element.children.indexOf(target);
      assert(index >= 0);
      element.children.splice(index, 0, child);
      child.parentNode = element;
      return child;
    };
    if (tag !== 'video') return element;
    let time = 0;
    Object.assign(element, {
      readyState: 0,
      seeking: false,
      paused: true,
      plays: 0,
      duration: NaN,
      videoWidth: 0,
      videoHeight: 0,
      ended: false,
    });
    Object.defineProperty(element, 'currentTime', {
      get: () => time,
      set(value) {
        time = value;
        element.seeking = true;
        queueMicrotask(() => {
          element.seeking = false;
          element.emit('seeked');
        });
      },
    });
    element.pause = () => {
      element.paused = true;
    };
    element.play = () => {
      element.plays++;
      element.paused = false;
      return Promise.resolve();
    };
    element.removeAttribute = (name) => {
      SoloElement.prototype.removeAttribute.call(element, name);
      if (name === 'src') element.src = '';
    };
    element.load = () => {
      if (!element.src) return;
      queueMicrotask(() => {
        element.readyState = 2;
        element.duration = 6;
        element.videoWidth = 640;
        element.videoHeight = 360;
        element.emit('loadedmetadata');
        element.emit('loadeddata');
      });
    };
    videos.push(element);
    return element;
  };
  return videos;
}
async function setup(t) {
  const memory = memoryIndexedDB(),
    manager = createManagedMediaStore({ indexedDB: memory.indexedDB, storyMedia: true }),
    decodeImage = async () => ({ naturalWidth: 1, naturalHeight: 1 }),
    still = createStillMediaStore({ managedStore: manager, decodeImage }),
    stories = createStoryMediaStore({ managedStore: manager, decodeImage });
  await still.commit(
    await still.prepare(f.library, [{ sha256: f.pin.sha256, blob: new Blob([pngBytes()]) }], {
      executionCatalog: f.catalog,
    }),
    { expectedGeneration: 0 },
  );
  async function bind(revision) {
    const descriptor = {
      ...f.descriptor,
      revision,
      segment: revision === 1 ? f.descriptor.segment : { startSeconds: 1, endSeconds: 3 },
    };
    await stories.commit(
      await stories.stage({ descriptor, blob: f.blob }, inspectionEnvironment().options),
    );
    await stories.commit(
      await stories.stageBinding(
        { picturePin: f.pin, story: { id: descriptor.id, revision } },
        {
          expectedGeneration: (await stories.readMetadata()).generation,
          ...inspectionEnvironment().options,
        },
      ),
    );
  }
  await bind(1);
  const page = await soloPage(t, {
      campaign: { ...f.campaign, title: 'Story host journey' },
      soundtrackIndexedDB: memory.indexedDB,
      pictures: { Image: Picture },
    }),
    videos = browserVideo(page);
  t.after(() => {
    stories.close();
    manager.close();
  });
  return Object.assign(page, { memory, manager, stories, bind, videos });
}
function frame(page, n) {
  for (let i = 0; i < n; i++) page.frame();
}
function win(page) {
  page.frame(0);
  assert.equal(page.rendered.run.status, 'running');
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  for (let i = 0; i < 1000 && page.rendered.run.status === 'running'; i++) page.frame();
  assert.equal(page.rendered.run.status, 'won');
  page.frame(0);
}
function control(page, label) {
  return [...page.$('victory-story-dialog').querySelectorAll('button')].find(
    (button) => button.textContent === label,
  );
}
async function ready(page) {
  assert.equal(
    page.$('victory-story-dialog').open,
    true,
    'Native story action must open its dialog before codec work.',
  );
  await settle(
    () =>
      ['ready', 'poster', 'error', 'unavailable'].includes(
        page.$('victory-story-dialog').dataset.storyState,
      ),
    'Story should finish native modeled metadata/seek.',
  );
  assert.notEqual(page.$('victory-story-dialog').dataset.storyState, 'error');
  assert.notEqual(page.$('victory-story-dialog').dataset.storyState, 'unavailable');
}

test('real A flight freezes before edit B; win records A before optional play, better B cannot replace earned Collection story', async (t) => {
  const p = await setup(t);
  p.$('start-button').click();
  frame(p, 120);
  await p.bind(2);
  win(p);
  const first = loadLibrary(p.storage, key).library;
  assert.equal(first.format, 'xonix-library.v4');
  assert.equal(first.storyReceipts[0].storyPin.revision, 1);
  assert.equal(p.$('view-victory-story').hidden, false);
  const won = authoritativeCheckpoint(p.rendered.run),
    saved = p.storage.getItem(key);
  p.$('view-victory-story').click();
  await ready(p);
  assert(p.videos.every((video) => video.plays === 0));
  const video = p.videos.findLast((item) => item.isConnected);
  assert.equal(video.currentTime, 2, 'Retained A segment, despite current B binding');
  control(p, 'Play').click();
  await settle(() => p.$('victory-story-dialog').dataset.storyState === 'playing');
  p.frame(0);
  assert.equal(video.plays, 1);
  assert.equal(p.storage.getItem(key), saved);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), won);
  control(p, 'Skip').click();
  assert.equal(p.$('victory-story-dialog').dataset.storyState, 'poster');
  assert.equal(p.$('victory-story-dialog').querySelector('canvas').hidden, false);
  p.$('victory-story-dialog').querySelector('button').click();
  assert.equal(video.src, '');
  p.$('retry-button').click();
  await settle(
    () =>
      p.doc.body.dataset.pictureState === 'ready' && p.doc.body.dataset.flightState === 'running',
  );
  win(p);
  const better = loadLibrary(p.storage, key).library;
  assert(better.gallery[0].time < first.gallery[0].time);
  assert.equal(better.storyReceipts[0].storyPin.revision, 1);
  p.$('shell-collection').click();
  await settle(() => p.$('gallery-grid').querySelector('button'));
  p.$('gallery-grid').querySelector('button').click();
  await settle(() => !p.$('gallery-story').hidden);
  p.$('gallery-story').click();
  await ready(p);
  assert.equal(p.videos.findLast((item) => item.isConnected).currentTime, 2);
  assert.equal(
    loadLibrary(p.storage, key).library.storyReceipts[0].earnedRunId,
    first.storyReceipts[0].earnedRunId,
  );
  assert.deepEqual(p.errors, []);
});

test('missing pinned movie leaves won exact poster and a finite restore message without reallocating or awarding', async (t) => {
  const p = await setup(t);
  p.$('start-button').click();
  win(p);
  const library = p.storage.getItem(key),
    before = authoritativeCheckpoint(p.rendered.run);
  await p.stories.removeOriginal(f.descriptor.source.sha256, {
    expectedGeneration: (await p.stories.readMetadata()).generation,
  });
  p.$('view-victory-story').click();
  await settle(() => p.$('victory-story-dialog').dataset.storyState === 'unavailable');
  assert.equal(p.videos.length, 0);
  const canvas = p.$('victory-story-dialog').querySelector('canvas');
  assert.equal(canvas.hidden, false);
  assert.equal(p.storage.getItem(key), library);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), before);
  assert.deepEqual(p.errors, []);
});
