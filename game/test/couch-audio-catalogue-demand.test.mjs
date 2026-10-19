import test from 'node:test';
import assert from 'node:assert/strict';
import { attachCouchMusicHost } from '../couch/couch-music-host.mjs';
import { attachSettingsPanels } from '../ui/settings-panels.mjs';
import { createAudioMaster } from '../ui/audio-master.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { prepareSoundtrackLibrary } from '../soundtrack-bundle.mjs';
import { emptySoundtrackLibrary, upgradeSoundtrackLibrary } from '../soundtrack.mjs';
import { ONLINE_SOUNDTRACK_CATALOGUE_URL } from '../online-soundtrack-catalogue.mjs';
import { Document, Element } from './helpers/couch-dom.mjs';
import { audioHarness, settleUntil } from './helpers/soundtrack-audio.mjs';
import { memoryIndexedDB, structuralProbe } from './helpers/soundtrack-fixtures.mjs';
import { publicCatalogueResponse } from './helpers/soundtrack-public-catalogue.mjs';

const microtasks = () => new Promise((resolve) => setImmediate(resolve));

async function setup(t, prefix = 'race') {
  const doc = new Document();
  const audio = audioHarness();
  const memory = memoryIndexedDB();
  const master = createAudioMaster({ muted: true, volume: 0.65 });
  const manager = createManagedMediaStore({
    indexedDB: memory.indexedDB,
    soundtrackCatalogue: true,
  });
  await manager.commitDomain(
    'audio',
    await prepareSoundtrackLibrary(upgradeSoundtrackLibrary(emptySoundtrackLibrary()), [], {
      probeMedia: structuralProbe,
    }),
    { expectedGeneration: 0, publicStyles: ['fpv'] },
  );
  manager.close();
  const globals = new Map(
    ['indexedDB', 'fetch'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  const unexpectedRequests = [];
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: memory.indexedDB });
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: async (url) => {
      unexpectedRequests.push(String(url));
      throw new Error(`Unexpected host network request: ${url}`);
    },
  });
  const create = doc.createElement.bind(doc);
  const mediaElements = [];
  doc.createElement = (tag) => {
    if (tag !== 'audio') return create(tag);
    const media = mediaElements.length === 0 ? audio.media : audioHarness().media;
    const element = new Element(doc, 'audio');
    for (const [key, value] of Object.entries(element))
      if (!Object.hasOwn(media, key)) media[key] = value;
    Object.setPrototypeOf(media, Object.getPrototypeOf(element));
    mediaElements.push(media);
    return media;
  };
  // The real Couch entry passes its authored Audio panel to attachCouchMusicHost.
  // Only geometry/DOM and native media are modeled; both host and tab owner execute.
  const root = doc.createElement('section');
  const list = doc.createElement('div');
  list.className = 'field-kit-settings-tabs';
  list.setAttribute('role', 'tablist');
  root.append(list);
  const tabs = {},
    panels = {};
  for (const category of ['controls', 'audio', 'display']) {
    const tab = doc.createElement('button'),
      panel = doc.createElement('section');
    tab.id = `${prefix}-settings-tab-${category}`;
    panel.id = `${prefix}-settings-panel-${category}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panel.id);
    tab.setAttribute('aria-selected', String(category === 'controls'));
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    list.append(tab);
    root.append(panel);
    tabs[category] = tab;
    panels[category] = panel;
  }
  doc.body.append(root);
  const settings = attachSettingsPanels({ root, document: doc });
  const requests = [];
  const host = attachCouchMusicHost({
    document: doc,
    root: panels.audio,
    prefix,
    soundscape: audio.soundscape,
    audioMaster: master,
    onlineCatalogueDownload: {
      fetch: async (url) => {
        requests.push(url);
        assert.equal(url, ONLINE_SOUNDTRACK_CATALOGUE_URL);
        return publicCatalogueResponse();
      },
    },
  });
  t.after(async () => {
    host.dispose();
    settings.destroy();
    await audio.soundscape.dispose();
    master.dispose();
    for (const [key, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    assert.deepEqual(unexpectedRequests, [], 'No speculative host network demand');
  });
  await settleUntil(
    () =>
      host.session.snapshot().readyForStart &&
      doc.getElementById('soundtrack-settings-play-styles')?.disabled === false,
  );
  await microtasks();
  const before = { master: master.snapshot(), puts: memory.allPuts.length };
  assert.deepEqual(
    requests,
    [],
    'Muted boot and local saved-style hydration do not request metadata',
  );
  assert(mediaElements.every((media) => media.plays === 0));
  assert.equal(doc.getElementById('soundtrack-settings-style-fpv').checked, true);
  return {
    doc,
    audio,
    memory,
    master,
    mediaElements,
    root,
    tabs,
    panels,
    settings,
    host,
    requests,
    before,
  };
}

async function assertSaved(f) {
  const manager = createManagedMediaStore({
    indexedDB: f.memory.indexedDB,
    soundtrackCatalogue: true,
  });
  try {
    const saved = await manager.readDomain('audio');
    assert.equal(saved.generation, 1);
    assert.deepEqual(saved.publicStyles, ['fpv']);
  } finally {
    manager.close();
  }
  assert.deepEqual(f.master.snapshot(), f.before.master);
  assert.equal(f.memory.allPuts.length, f.before.puts);
}

for (const prefix of ['race', 'coop']) {
  test(`${prefix}: actual selected Audio owner demands metadata without playback or save`, async (t) => {
    const f = await setup(t, prefix);
    assert.equal(f.panels.audio.hidden, true);
    f.tabs.audio.focus();
    f.tabs.audio.click();
    assert.equal(f.settings.selected(), f.tabs.audio.id);
    assert.equal(f.panels.audio.hidden, false);
    await settleUntil(() => f.requests.length === 1);
    await settleUntil(
      () => f.doc.getElementById('soundtrack-settings-style-fpv').parentNode.hidden === false,
    );
    assert.deepEqual(f.requests, [ONLINE_SOUNDTRACK_CATALOGUE_URL]);
    assert(f.mediaElements.every((media) => media.plays === 0));
    assert.equal(f.audio.context.state, 'suspended');
    assert.equal(f.host.root(), null, 'Audio browse does not open Studio');
    await assertSaved(f);
  });

  test(`${prefix}: saved FPV Play owns demand without visiting Audio or changing mute/storage`, async (t) => {
    const f = await setup(t, prefix);
    const playing = f.host.session.play();
    assert.equal(f.audio.context.state, 'running', 'Audio wake stays in the Play activation turn');
    assert.equal(await playing, true);
    assert.deepEqual(f.requests, [ONLINE_SOUNDTRACK_CATALOGUE_URL]);
    assert.equal(f.host.player.snapshot().track.title, 'FPV');
    assert.equal(f.host.player.snapshot().playing, true);
    assert.equal(f.panels.audio.hidden, true);
    assert.equal(f.host.root(), null);
    await assertSaved(f);
  });
}

for (const retirement of [
  'deselected',
  'disabled',
  'aria-disabled',
  'inert',
  'hidden',
  'replaced-tab',
  'replaced-owner',
  'moved-content',
  'hidden-document',
  'hidden-visibility',
  'disposed',
]) {
  test(`actual Couch Audio browse rejects ${retirement} ownership before admission`, async (t) => {
    const f = await setup(t);
    f.tabs.audio.click();
    if (retirement === 'deselected') f.tabs.display.click();
    else if (retirement === 'disabled') f.tabs.audio.disabled = true;
    else if (retirement === 'aria-disabled') f.tabs.audio.setAttribute('aria-disabled', 'true');
    else if (retirement === 'inert') f.panels.audio.inert = true;
    else if (retirement === 'hidden') f.panels.audio.hidden = true;
    else if (retirement === 'replaced-tab') {
      f.tabs.audio.remove();
      const tab = f.doc.createElement('button');
      tab.id = f.tabs.audio.id;
      f.root.append(tab);
    } else if (retirement === 'replaced-owner') {
      f.panels.audio.remove();
      const panel = f.doc.createElement('section');
      panel.id = f.panels.audio.id;
      f.root.append(panel);
    } else if (retirement === 'moved-content') {
      const section = f.panels.audio.querySelector('[data-couch-music]');
      f.doc.body.append(section);
    } else if (retirement === 'hidden-document') f.doc.hidden = true;
    else if (retirement === 'hidden-visibility') f.doc.visibilityState = 'hidden';
    else f.host.dispose();
    await microtasks();
    assert.deepEqual(f.requests, []);
    assert(f.mediaElements.every((media) => media.plays === 0));
    if (retirement !== 'disposed') await assertSaved(f);
  });
}
