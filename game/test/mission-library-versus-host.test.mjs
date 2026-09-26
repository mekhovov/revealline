import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { couchPage } from './helpers/couch-host.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { classicLibrarySources } from '../mission-library/classic-source.mjs';
import { preparePack, installPack } from '../packs.mjs';
import { createExternalChapterHost } from '../external-chapter-host.mjs';
import { claimProfileWriter } from '../profile-writer.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import { createCandidateVersusHost } from '../content-design/versus-host.mjs';
import { journeyLibrarySource } from '../mission-library/journey-source.mjs';

const index = JSON.parse(
  await readFile(new URL('../content/mission-library-index.json', import.meta.url)),
);
const model = createMissionLibrary(
  classicLibrarySources(index, { availability: () => ({ state: 'ready' }), launch: () => true }),
);
const late = model.missions.find((row) => row.runtimeId === 'signal-12');
const settle = (predicate) => waitFor(predicate, { timeoutMs: 10000 });
class Locks {
  held = new Set();
  async request(name, options, work) {
    if (this.held.has(name)) return work(null);
    this.held.add(name);
    try {
      return await work({ name });
    } finally {
      this.held.delete(name);
    }
  }
}
async function fixture(t, { href, fetchResponse, installedSource, ...options } = {}) {
  const databases = new Map(),
    values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const indexedDB = {
    open(name, ...args) {
      if (!databases.has(name)) databases.set(name, managedIndexedDB());
      return databases.get(name).indexedDB.open(name, ...args);
    },
  };
  const locks = new Locks();
  if (installedSource) {
    let media;
    const { pack } = await preparePack(installedSource);
    const writer = await claimProfileWriter(locks, 'revealline.library.dev.v1.writer');
    const installer = createExternalChapterHost({
      indexedDB,
      profileKey: 'revealline.library.dev.v1',
      packsKey: 'revealline.packs.dev.v1',
      storage,
      lockManager: locks,
      writer,
      registeredEntries: [],
      knownDescriptors: [],
      getManagedStore: () =>
        (media ??= createManagedMediaStore({ indexedDB, soundtrackCatalogue: true })),
    });
    const before = await installer.inspect();
    await installer.commitMutation(
      await installer.prepareMutation(before, installPack(before.packs, pack)),
    );
    installer.close();
    media?.close();
    writer.release();
  }
  const p = await couchPage(t, {
    initialLevel: null,
    href: href ?? 'http://localhost/game/couch/?journey=legacy',
    storage,
    previewStorage: storage,
    lockManager: locks,
    assetDatabase: indexedDB,
    fetchResponse: async (path, request) => {
      const response = await fetchResponse?.(path, request);
      if (response !== undefined) return response;
      if (String(path).includes('/content-design/assets/'))
        return new Response(await readFile(path));
      if (path === '../content/packs/fpv-arcade-r5.json')
        return new Response('Fixture isolates Base library', { status: 503 });
    },
    ...options,
  });
  return p;
}
function beginOpen(p, { focus = true } = {}) {
  // Preserve the real anchor click and Couch-shell departure guards while
  // joining its operation, rather than timing catalogue compilation with polls.
  const opener = p.$('race-library-switch'),
    listeners = opener.listeners.get('click'),
    pending = [];
  opener.listeners.set(
    'click',
    new Set(
      [...listeners].map((listener) => (event) => {
        const result = listener.call(opener, event);
        if (result instanceof Promise) pending.push(result);
        return result;
      }),
    ),
  );
  try {
    if (focus) opener.focus();
    opener.click();
  } finally {
    opener.listeners.set('click', listeners);
  }
  assert.equal(pending.length, 1, 'The real Missions click owns one preparation.');
  assert.match(p.$('race-message').textContent, /Preparing missions/);
  return pending[0];
}
async function open(p) {
  await beginOpen(p);
  assert.equal(p.$('journey-chooser')?.open, true, p.$('race-message').textContent);
}

async function running(p, id) {
  try {
    await settle(() => {
      p.frame(0);
      return p.renders[0]?.level.id === id && p.state() === 'running';
    });
  } catch (error) {
    error.message += ` ${JSON.stringify({ level: p.renders[0]?.level.id, state: p.state(), message: p.$('race-message').textContent, chooser: p.$('journey-chooser-status')?.textContent })}`;
    throw error;
  }
}

test('Versus All missions lists exact Journey and retained Classic rows without downloading artwork', async (t) => {
  const requests = [];
  const p = await fixture(t, {
    fetchResponse: (path) => {
      requests.push(String(path));
    },
  });
  assert.equal(p.$('race-library-switch').textContent, 'All missions');
  const before = p.checkpoint();
  await open(p);
  assert.equal(p.$('journey-mode').value, 'versus');
  assert.equal(p.$('journey-collection').value, '');
  assert.equal(p.$('journey-cards').children.length, 327);
  assert.match(p.$('journey-cards').children[0].textContent, /Journey/);
  const classic = [...p.$('journey-cards').children].filter((card) =>
    card.querySelector('.journey-card-tags').textContent.includes('Classic'),
  );
  assert.equal(classic.length, 188);
  assert.match(classic.find((card) => card.dataset.missionId === late.id).textContent, /Play/);
  assert(!requests.some((path) => path.includes('/content-design/assets/')));
  p.$('journey-back').click();
  p.frame(0);
  assert.deepEqual(p.checkpoint(), before);
  assert.equal(p.doc.activeElement, p.$('race-library-switch'));
});

test('empty-profile Versus library starts a late Base mission directly and pauses both boards before replacement', async (t) => {
  const p = await fixture(t);
  await open(p);
  [...p.$('journey-cards').children].find((card) => card.dataset.missionId === late.id).click();
  await running(p, late.runtimeId);
  assert.equal(p.renders[1].level.id, late.runtimeId);
  p.key('ArrowDown');
  p.frames(12);
  p.key('ArrowDown', false);
  await open(p);
  const before = p.checkpoint();
  const first = model.missions[0];
  [...p.$('journey-cards').children].find((card) => card.dataset.missionId === first.id).click();
  await settle(() => p.$('race-library-replace')?.open);
  p.$('race-library-stay').click();
  await settle(() => p.$('journey-chooser')?.open);
  p.frame(0);
  assert.deepEqual(p.checkpoint(), before);
  assert.equal(p.$('journey-back').textContent, 'Back to race');
  [...p.$('journey-cards').children].find((card) => card.dataset.missionId === first.id).click();
  await settle(() => p.$('race-library-replace')?.open);
  p.$('race-library-play').click();
  await running(p, first.runtimeId);
  assert.equal(p.renders[1].level.id, first.runtimeId);
});

test('incoming opaque Versus selection launches the exact late Base mission, not the default', async (t) => {
  const params = new URLSearchParams({ journey: 'legacy', 'library-mission': late.id });
  const p = await fixture(t, { href: `http://localhost/game/couch/?${params}` });
  await running(p, late.runtimeId);
  assert.equal(p.renders[1].level.id, late.runtimeId);
  assert.equal(p.$('journey-chooser').open, false);
});

test('incoming held mission metadata cannot replace either board after newer same-page focus', async (t) => {
  let release,
    entered = false;
  const gate = new Promise((resolve) => (release = resolve));
  const params = new URLSearchParams({ journey: 'legacy', 'library-mission': late.id });
  const page = fixture(t, {
    href: `http://localhost/game/couch/?${params}`,
    fetchResponse: async (path) => {
      if (path !== '../content/mission-library-index.json') return;
      entered = true;
      await gate;
      return new Response(JSON.stringify(index));
    },
  });
  await settle(() => entered);
  const options = globalThis.document.getElementById('race-options');
  options.focus();
  release();
  const p = await page;
  p.frame(0);
  assert.equal(p.renders[0].level.id, 'signal-01');
  assert.equal(p.renders[1].level.id, 'signal-01');
  assert.equal(p.state(), 'ready');
  assert.equal(p.doc.activeElement, options);
  assert.equal(p.$('journey-chooser').open, false);
});

async function openingHandoff() {
  const route = await loadAuthoredJourneyRoute('opening');
  const themes = JSON.parse(
    await readFile(new URL('../content-design/themes.json', import.meta.url)),
  ).themes;
  const host = createCandidateVersusHost(route.source, { themes });
  const library = createMissionLibrary([
    journeyLibrarySource({
      editionId: route.id,
      edition: route.label,
      catalog: host.catalog,
      profile: { snapshot: () => ({ clears: {}, skipped: {} }) },
      launch: () => true,
    }),
  ]);
  const target = library.missions.find((row) => row.runtimeId.endsWith('/choose-your-share'));
  return new URLSearchParams({ journey: 'opening', 'library-mission': target.id });
}

test('incoming exact Journey selection survives a failed unused opener picture', async (t) => {
  const params = await openingHandoff();
  const requested = [];
  const p = await fixture(t, {
    href: `http://localhost/game/couch/?${params}`,
    fetchResponse: async (path) => {
      if (!String(path).includes('/content-design/assets/')) return;
      requested.push(String(path));
      if (requested.length === 1) return new Response('Unavailable opener', { status: 503 });
      return new Response(await readFile(path));
    },
  });
  await running(p, 'choose-your-share');
  assert.equal(p.renders[1].level.id, 'choose-your-share');
  assert(requested[0].endsWith('/first-return.png'));
  assert(requested.some((path) => path.endsWith('/choose-your-share.png')));
  assert.equal(p.$('journey-chooser').open, false);
});

test('incoming selection retires on newer focus while its unused opener picture waits', async (t) => {
  const params = await openingHandoff();
  let release,
    held = false;
  const gate = new Promise((resolve) => (release = resolve));
  const page = fixture(t, {
    href: `http://localhost/game/couch/?${params}`,
    fetchResponse: async (path) => {
      if (!String(path).includes('/content-design/assets/')) return;
      if (!held) {
        held = true;
        await gate;
      }
      return new Response(await readFile(path));
    },
  });
  await settle(() => held);
  const options = globalThis.document.getElementById('race-options');
  options.focus();
  release();
  const p = await page;
  p.frame(0);
  assert.equal(p.renders[0].level.id, 'first-return');
  assert.equal(p.renders[1].level.id, 'first-return');
  assert.equal(p.state(), 'ready');
  assert.equal(p.doc.activeElement, options);
  assert.equal(p.$('journey-chooser')?.open ?? false, false);
});

test('unfinished Journey selection requires Stay or Replace and preserves both boards on Stay', async (t) => {
  const p = await fixture(t, { href: 'http://localhost/game/couch/' });
  p.$('race-start').click();
  await running(p, 'first-return');
  p.key('ArrowDown');
  p.frames(6);
  p.key('ArrowDown', false);
  await open(p);
  const before = p.checkpoint();
  const target = () =>
    [...p.$('journey-cards').children].find((card) =>
      JSON.parse(card.dataset.missionId)[3].endsWith('/choose-your-share'),
    );
  target().click();
  await settle(() => p.$('race-library-replace')?.open);
  p.frame(0);
  assert.deepEqual(p.checkpoint(), before);
  p.$('race-library-stay').click();
  await settle(() => p.$('journey-chooser')?.open);
  p.frame(0);
  assert.deepEqual(p.checkpoint(), before);
  assert.equal(p.state(), 'paused');
  target().click();
  await settle(() => p.$('race-library-replace')?.open);
  p.$('race-library-play').click();
  await running(p, 'choose-your-share');
  assert.equal(p.renders[1].level.id, 'choose-your-share');
});

test('Classic Versus selects an exact Journey handoff and preserves the release prefix', async (t) => {
  const p = await fixture(t);
  await open(p);
  const target = [...p.$('journey-cards').children].find((card) =>
    JSON.parse(card.dataset.missionId)[3].endsWith('/choose-your-share'),
  );
  assert(target);
  target.click();
  await settle(() => new URL(globalThis.location.href).searchParams.has('library-mission'));
  const destination = new URL(globalThis.location.href);
  assert.equal(destination.pathname, '/game/couch/');
  assert.equal(destination.searchParams.get('journey'), 'whole-spatial-v25');
  assert.equal(destination.searchParams.get('library-mission'), target.dataset.missionId);
});

test('Versus mode filter exposes the same qualified Journey identities in Solo without duplicates', async (t) => {
  const p = await fixture(t);
  await open(p);
  const original = [...p.$('journey-cards').children].map((card) => card.dataset.missionId);
  p.$('journey-mode').value = 'solo';
  p.$('journey-mode').emit('change');
  const cards = [...p.$('journey-cards').children];
  assert.deepEqual(
    cards.map((card) => card.dataset.missionId),
    original,
  );
  assert.equal(new Set(original).size, 327);
  const target = cards[1];
  assert.match(target.textContent, /Journey.*Band 1\/12.*Play/);
  target.click();
  await settle(() => new URL(globalThis.location.href).searchParams.has('library-mission'));
  const destination = new URL(globalThis.location.href);
  assert.equal(destination.pathname, '/game/');
  assert.equal(destination.searchParams.get('journey'), 'whole-spatial-v25');
  assert.equal(destination.searchParams.get('library-mission'), target.dataset.missionId);
  assert.equal(p.doc.documentElement.dataset.toolState, 'ready');
});

for (const collection of ['Journey', 'Classic'])
  test(`Versus Team filter hands an exact ${collection} mission to its Team host`, async (t) => {
    const p = await fixture(t);
    await open(p);
    p.$('journey-mode').value = 'team';
    p.$('journey-mode').emit('change');
    const cards = [...p.$('journey-cards').children];
    assert.equal(cards.length, 14);
    assert.equal(new Set(cards.map((card) => card.dataset.missionId)).size, 14);
    const target = cards.find((card) =>
      card.querySelector('.journey-card-tags').textContent.includes(collection),
    );
    assert.match(target.textContent, /Play/);
    target.click();
    await settle(() => new URL(globalThis.location.href).searchParams.has('library-mission'));
    const destination = new URL(globalThis.location.href);
    assert.equal(destination.pathname, '/game/couch/relay-rescue.html');
    assert.equal(
      destination.searchParams.get('journey'),
      collection === 'Journey' ? 'team-cultural-specialist-originals-2' : 'legacy',
    );
    assert.equal(destination.searchParams.get('library-mission'), target.dataset.missionId);
    assert.equal(p.doc.documentElement.dataset.toolState, 'ready');
  });

for (const custom of [false, true])
  test(`installed ${custom ? 'modified Custom' : 'official Classic'} selection stages the exact late level without falling back to its chapter opener`, async (t) => {
    const source = JSON.parse(
      await readFile(new URL('../content/packs/night-shift.json', import.meta.url)),
    );
    if (custom) source.name = 'Player night shift';
    const p = await fixture(t, { installedSource: source });
    await open(p);
    p.$('journey-collection').value = custom ? 'Custom' : 'Classic';
    p.$('journey-collection').emit('change');
    const lateLevel = source.campaigns[0].levels.at(-1);
    const card = [...p.$('journey-cards').children].find(
      (card) => JSON.parse(card.dataset.missionId)[3] === lateLevel.id,
    );
    assert(card);
    assert.match(card.textContent, /Play/);
    card.click();
    await running(p, lateLevel.id);
    assert.equal(p.renders[1].level.id, lateLevel.id);
    assert.equal(p.renders[0].seed, p.renders[1].seed);
    await open(p);
    if (custom) {
      p.$('journey-collection').value = 'Classic';
      p.$('journey-collection').emit('change');
      const original = [...p.$('journey-cards').children].find(
        (card) => JSON.parse(card.dataset.missionId)[3] === lateLevel.id,
      );
      assert.match(original.textContent, /Unavailable.*different edition/);
      assert.equal(original.disabled, true);
    }
  });

test('new focus while installed mission verification waits retires launch without replacing either board', async (t) => {
  const source = JSON.parse(
    await readFile(new URL('../content/packs/night-shift.json', import.meta.url)),
  );
  const p = await fixture(t, { installedSource: source });
  await open(p);
  const card = [...p.$('journey-cards').children].find(
    (card) => JSON.parse(card.dataset.missionId)[3] === source.campaigns[0].levels.at(-1).id,
  );
  let release,
    held = false;
  const request = globalThis.navigator.locks.request.bind(globalThis.navigator.locks);
  t.mock.method(globalThis.navigator.locks, 'request', async (...args) => {
    if (!held) {
      held = true;
      await new Promise((resolve) => (release = resolve));
    }
    return request(...args);
  });
  const before = p.checkpoint();
  card.click();
  await settle(() => release);
  p.$('race-options').focus();
  release();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  p.frame(0);
  assert.deepEqual(p.checkpoint(), before);
  assert.equal(p.doc.activeElement, p.$('race-options'));
  assert.equal(p.$('journey-chooser').open, false);
  assert.equal(p.$('race-library-replace'), null);
  assert.equal(p.state(), 'ready');
});

test('new Journey Versus mounts the same library and chooses an exact authored mission', async (t) => {
  const p = await fixture(t, { href: 'http://localhost/game/couch/' });
  assert.equal(p.renders[0].level.id, 'first-return');
  await open(p);
  assert.equal(p.$('journey-cards').children.length, 327);
  const card = [...p.$('journey-cards').children].find((card) =>
    JSON.parse(card.dataset.missionId)[3].endsWith('/choose-your-share'),
  );
  assert(card);
  card.click();
  await running(p, 'choose-your-share');
  assert.equal(p.renders[1].level.id, 'choose-your-share');
  await open(p);
  [...p.$('journey-cards').children].find((card) => card.dataset.missionId === late.id).click();
  await settle(() => p.$('race-library-replace')?.open);
  p.$('race-library-play').click();
  await settle(() => new URL(globalThis.location.href).searchParams.get('journey') === 'legacy');
  assert.equal(new URL(globalThis.location.href).searchParams.get('library-mission'), late.id);
});

for (const chapterSource of ['optional', 'bundled'])
  test(
    `${chapterSource} chapter failure and retry stay inline, then Play stages the exact selected mission without automatic launch`,
    { timeout: 120000 },
    async (t) => {
      const catalog = JSON.parse(
        await readFile(new URL('../content/optional-worlds.json', import.meta.url)),
      );
      const chapter =
        chapterSource === 'optional'
          ? catalog.packs.find((item) => item.id === 'original-fpv-pressure')
          : { path: 'game/content/packs/night-shift.json' };
      const bytes = await readFile(new URL(`../../${chapter.path}`, import.meta.url));
      const source = JSON.parse(bytes);
      const target = model.missions.find(
        (row) => row.runtimeId === source.campaigns[0].levels.at(-1).id,
      );
      let fail = true,
        heldDownload = null,
        releaseDownload = null,
        fetches = 0,
        nextURL = 0;
      const urls = new Map();
      class PictureURL extends URL {
        static createObjectURL(blob) {
          const url = `blob:versus-library/${++nextURL}`;
          urls.set(url, blob);
          return url;
        }
        static revokeObjectURL(url) {
          urls.delete(url);
        }
      }
      class Picture {
        set src(value) {
          this.ready = Promise.resolve().then(async () => {
            const bytes = value.startsWith('data:')
              ? Buffer.from(value.split(',')[1], 'base64')
              : Buffer.from(await urls.get(value).arrayBuffer());
            assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
            this.width = this.naturalWidth = bytes.readUInt32BE(16);
            this.height = this.naturalHeight = bytes.readUInt32BE(20);
            this.onload?.();
          });
        }
        async decode() {
          await this.ready;
        }
        removeAttribute() {}
      }
      const p = await fixture(t, {
        ImageClass: Picture,
        URLImpl: PictureURL,
        fetchResponse: async (path) => {
          const url = new URL(path, 'http://localhost/game/couch/');
          if (url.pathname.endsWith('/game/content/optional-worlds.json'))
            return new Response(JSON.stringify(catalog));
          if (url.pathname.endsWith(`/${chapter.path}`)) {
            fetches++;
            if (heldDownload) await heldDownload;
            return fail
              ? new Response('Controlled offline failure', { status: 503 })
              : new Response(bytes, { headers: { 'content-length': String(bytes.length) } });
          }
        },
      });
      p.$('race-start').click();
      await running(p, 'signal-01');
      await open(p);
      p.$('journey-search').value = target.name;
      p.$('journey-search').emit('input');
      const card = () =>
        [...p.$('journey-cards').children].find((card) => card.dataset.missionId === target.id);
      assert.match(card().textContent, /Download/);
      const before = p.checkpoint(),
        picture = p.drawOptions[0].backdrop;
      card().click();
      await settle(() => card().textContent.includes('Retry'));
      assert.equal(p.$('journey-chooser').open, true);
      assert.equal(p.$('journey-search').value, target.name);
      fail = false;
      heldDownload = new Promise((resolve) => {
        releaseDownload = resolve;
      });
      card().click();
      await settle(() => fetches === 2 && card().textContent.includes('Preparing'));
      card().click();
      await settle(() =>
        card().querySelector('.journey-card-action').textContent.startsWith('Download'),
      );
      releaseDownload();
      heldDownload = null;
      await new Promise((resolve) => setImmediate(resolve));
      p.frame(0);
      assert.deepEqual(p.checkpoint(), before);
      assert.equal(p.$('journey-search').value, target.name);
      card().click();
      await waitFor(() => card().querySelector('.journey-card-action').textContent === 'Play', {
        timeoutMs: 60000,
      });
      assert.equal(fetches, 3);
      p.frame(0);
      assert.deepEqual(p.checkpoint(), before);
      assert.equal(p.drawOptions[0].backdrop, picture);
      assert.equal(p.$('journey-chooser').open, true);
      card().click();
      await waitFor(() => p.$('race-library-replace')?.open, { timeoutMs: 60000 });
      p.$('race-library-stay').click();
      await settle(() => p.$('journey-chooser').open);
      p.frame(0);
      assert.deepEqual(p.checkpoint(), before);
      assert.equal(p.drawOptions[0].backdrop, picture);
      card().click();
      await waitFor(() => p.$('race-library-replace')?.open, { timeoutMs: 60000 });
      p.$('race-library-play').click();
      await running(p, target.runtimeId);
      assert.equal(p.renders[1].level.id, target.runtimeId);
      assert.equal(p.drawOptions[0].backdrop, p.drawOptions[1].backdrop);
    },
  );

for (const interruption of ['blur', 'focus', 'pointer'])
  test(
    `a cancelled lazy Versus library opening cannot regain focus after ${interruption}`,
    { timeout: 120000 },
    async (t) => {
      let release, enter;
      const gate = new Promise((resolve) => (release = resolve));
      const entered = new Promise((resolve) => (enter = resolve));
      const p = await fixture(t, {
        fetchResponse: async (path) => {
          if (path === '../content/mission-library-index.json') {
            enter();
            await gate;
            return new Response(JSON.stringify(index));
          }
        },
      });
      const opening = beginOpen(p, { focus: false });
      try {
        await entered;
        assert.match(p.$('race-message').textContent, /Preparing missions/);
        if (interruption === 'blur') {
          p.doc.focused = false;
          p.win.emit('blur');
          p.doc.focused = true;
          p.win.emit('focus');
        } else if (interruption === 'focus') p.$('race-options').focus();
        else p.doc.emit('pointerdown');
        const focused = p.doc.activeElement;
        release();
        await opening;
        assert.ok(
          p.$('journey-collection'),
          'The owned lazy opening finished mounting its controls.',
        );
        await new Promise((resolve) => setImmediate(resolve));
        assert.equal(p.$('journey-chooser').open, false);
        assert.equal(p.doc.activeElement, focused);
        await open(p);
        assert.equal(p.$('journey-cards').children.length, 327);
      } finally {
        release();
        await opening;
      }
    },
  );
