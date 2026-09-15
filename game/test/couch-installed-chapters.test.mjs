import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createCouchInstalledChapters } from '../couch/couch-installed-chapters.mjs';
import { createExternalChapterHost } from '../external-chapter-host.mjs';
import { createExternalChapterPointerStore } from '../external-chapter-pointer.mjs';
import { createManagedMediaStore, MANAGED_MEDIA_DATABASE } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { claimProfileWriter } from '../profile-writer.mjs';
import { installPack, preparePack } from '../packs.mjs';
import { inspectImageDataUrl } from '../content.mjs';
import { buildExternalPilot } from '../../authoring/library/external-chapter-pilot/build.mjs';
import { buildCountercurrentTheme } from '../../authoring/library/countercurrent-chapters/build.mjs';
import { buildFractureTheme } from '../../authoring/library/fracture-theme-chapters/build.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { waitFor } from './helpers/wait-for.mjs';

const pilot = await buildExternalPilot();
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function decodeImage(value) {
  const header = inspectImageDataUrl(
    typeof value === 'string'
      ? value
      : `data:image/png;base64,${Buffer.from(await value.arrayBuffer()).toString('base64')}`,
  );
  assert.equal(header.valid, true);
  return { naturalWidth: header.width, naturalHeight: header.height };
}
class Locks {
  held = new Set();
  async request(key, _options, action) {
    if (this.held.has(key)) return action(null);
    this.held.add(key);
    try {
      return await action({ name: key });
    } finally {
      this.held.delete(key);
    }
  }
}
// Actual original bytes, hashes, metadata, transactions and chapter adapters.
// Only browser pixels/decode scheduling are modelled; no native-device claim.
function pictures() {
  const urls = new Map(),
    seen = [],
    revoked = [];
  let id = 0;
  const model = { seen, urls, revoked, onDecode: null, onRelease: null };
  model.URLImpl = class extends URL {
    static createObjectURL(blob) {
      const url = `blob:couch/${++id}`;
      urls.set(url, blob);
      return url;
    }
    static revokeObjectURL(url) {
      assert.ok(urls.has(url));
      urls.delete(url);
      revoked.push(url);
    }
  };
  model.ImageClass = class {
    constructor() {
      seen.push(this);
    }
    set src(source) {
      this.source = source;
      Promise.resolve()
        .then(async () => {
          this.bytes = source.startsWith('data:')
            ? Buffer.from(source.split(',')[1], 'base64')
            : Buffer.from(await urls.get(source).arrayBuffer());
          this.width = this.naturalWidth = this.bytes.readUInt32BE(16);
          this.height = this.naturalHeight = this.bytes.readUInt32BE(20);
          this.onload?.();
        })
        .catch((error) => this.onerror?.(error));
    }
    async decode() {
      await model.onDecode?.(this);
      this.decoded = true;
    }
    removeAttribute(name) {
      assert.equal(name, 'src');
      this.released = (this.released || 0) + 1;
      model.onRelease?.(this);
    }
  };
  return model;
}
async function fixture(t, { embedded = false, chapter = pilot } = {}) {
  const assets = managedIndexedDB(),
    media = managedIndexedDB(),
    locks = new Locks();
  const values = new Map([
    ['revealline.library.dev.v1', 'unchanged solo progress'],
    ['revealline.session.dev.v1', 'unchanged paused solo attempt'],
  ]);
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem() {
      throw new Error('Couch must not write profile state.');
    },
  };
  const pointer = createExternalChapterPointerStore({
    indexedDB: assets.indexedDB,
    profileKey: 'revealline.library.dev.v1',
    packsKey: 'revealline.packs.dev.v1',
  });
  const writer = await claimProfileWriter(locks, pointer.keys.writerKey);
  const manager = createManagedMediaStore({ indexedDB: media.indexedDB, storyMedia: true });
  const still = createStillMediaStore({ managedStore: manager, decodeImage });
  const installer = createExternalChapterHost({
    indexedDB: assets.indexedDB,
    profileKey: pointer.keys.profileKey,
    packsKey: pointer.keys.packsKey,
    storage,
    lockManager: locks,
    writer,
    registeredEntries: [],
    knownDescriptors: [chapter.descriptor],
    getManagedStore: () => manager,
    decodeImage,
  });
  if (embedded) {
    const current = await installer.inspect();
    await installer.commitMutation(
      await installer.prepareMutation(current, installPack(current.packs, chapter.prior)),
    );
  } else await installer.install(chapter.prepared);
  installer.close();
  writer.release();
  const model = pictures();
  const indexedDB = {
    open(name, ...args) {
      return (name === MANAGED_MEDIA_DATABASE ? media.indexedDB : assets.indexedDB).open(
        name,
        ...args,
      );
    },
  };
  const options = {
    channel: 'dev',
    registeredEntries: [],
    indexedDB,
    storage,
    lockManager: locks,
    ...model,
  };
  const reader = createCouchInstalledChapters(options);
  const put = async (key, value) => {
    const db = await new Promise((resolve, reject) => {
      const r = assets.indexedDB.open('revealline-assets-v1', 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction('assets', 'readwrite');
        tx.oncomplete = resolve;
        tx.onabort = () => reject(tx.error);
        tx.objectStore('assets').put(value, key);
      });
    } finally {
      db.close();
    }
  };
  const writes = () => ({
    assets: assets.allPuts.length,
    media: media.allPuts.length,
    values: [...values],
  });
  t.after(() => {
    reader.dispose();
    still.close();
    manager.close();
    pointer.close();
  });
  return {
    assets,
    media,
    locks,
    values,
    storage,
    pointer,
    still,
    model,
    indexedDB,
    reader,
    options,
    put,
    writes,
  };
}
const settle = (predicate, message) => waitFor(predicate, { timeoutMs: 45000, message });

// Capture the existing native property handler's promise, then use readiness
// predicates too: a completed handler alone is not permission to start.
function action(element, event = 'click') {
  const handler = element[`on${event}`];
  assert.equal(typeof handler, 'function');
  let result;
  element[`on${event}`] = (...args) => (result = handler(...args));
  try {
    element.emit(event);
  } finally {
    element[`on${event}`] = handler;
  }
  return Promise.resolve(result);
}
function blurWhenDisabled(element) {
  let disabled = element.disabled;
  Object.defineProperty(element, 'disabled', {
    configurable: true,
    get: () => disabled,
    set(value) {
      disabled = value;
      if (value && element.ownerDocument.activeElement === element) element.blur();
    },
  });
}

test('installed couch reader authenticates the same three originals without acquiring a writer or changing solo data', async (t) => {
  const f = await fixture(t),
    before = f.writes();
  const rows = await f.reader.refresh();
  assert.equal(rows.length, 3);
  assert.ok(rows.every((row) => row.chapter === 'FPV Front · Pressure Pictures · Installed'));
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i],
      binding = await f.reader.select(row, { raceId: i });
    assert.equal(binding, f.reader.current());
    assert.equal(binding.fit, 'contain');
    assert.equal(binding.sampling, 'nearest');
    assert.equal(binding.pin.identity.baseCampaignKey, pilot.descriptor.campaignKey);
    assert.equal(binding.pin.identity.levelId, row.level.id);
    assert.equal(
      sha(binding.image.bytes),
      pilot.descriptor.originals.find((original) => original.levelId === row.level.id).sha256,
    );
    assert.equal(await f.reader.confirm(row, { raceId: i }), binding);
    await assert.rejects(f.reader.confirm(row, { raceId: i + 10 }), /in-memory|Load the selected/);
  }
  await assert.rejects(f.reader.select({ ...rows[0] }, { raceId: 9 }), /current installed/);
  await assert.rejects(
    f.reader.select(rows[0], { raceId: 9, themeId: 'ukraine' }),
    /does not belong/,
  );
  const fresh = await f.reader.refresh();
  await assert.rejects(f.reader.select(rows[0], { raceId: 9 }), /current installed/);
  assert.notEqual(fresh[0], rows[0]);
  f.reader.dispose();
  assert.equal(f.model.urls.size, 0);
  assert.ok(f.model.seen.every((image) => image.released === 1));
  assert.deepEqual(f.writes(), before);
  assert.equal(f.locks.held.size, 0);
  const other = createCouchInstalledChapters({ ...f.options, channel: 'release-v0.37.0' });
  try {
    assert.deepEqual(await other.refresh(), []);
  } finally {
    other.dispose();
  }
  assert.deepEqual(
    f.writes(),
    before,
    'a different exact channel does not borrow the dev pack or write a profile',
  );
});

test('publication rejects a changed original generation after actual decode and a changed pointer before Start', async (t) => {
  const f = await fixture(t),
    rows = await f.reader.refresh();
  let decodes = 0,
    mutated = false;
  f.model.onDecode = async () => {
    if (++decodes !== 4) return;
    const current = await f.still.read();
    const prepared = await f.still.prepare(current.document.library, current.assets, {
      previous: current.document,
      executionCatalog: pilot.prepared.executionCatalog,
    });
    await f.still.commit(prepared, { expectedGeneration: current.generation });
    mutated = true;
  };
  await assert.rejects(f.reader.select(rows[0], { raceId: 1 }), /changed|stale|generation/i);
  assert.equal(mutated, true, 'the race rejected a real post-decode metadata commit');
  assert.equal(f.reader.current(), null);
  assert.equal(f.model.urls.size, 0);
  f.model.onDecode = null;
  const binding = await f.reader.select(rows[0], { raceId: 2 });
  const raw = await f.pointer.snapshot();
  await f.put(f.pointer.keys.packsKey, `${raw.packs}\n`);
  const before = f.writes();
  await assert.rejects(f.reader.confirm(rows[0], { raceId: 2 }), /snapshot changed/);
  assert.equal(
    f.reader.current(),
    binding,
    'existing pinned race image remains owned until explicit replacement/disposal',
  );
  await f.reader.refresh();
  assert.deepEqual(f.writes(), before);
});

test('cancelled decode is joined before replacement and cannot publish a late image', async (t) => {
  const f = await fixture(t),
    rows = await f.reader.refresh(),
    before = f.writes();
  let decodes = 0,
    finish;
  const firstStatus = [],
    nextStatus = [];
  f.model.onDecode = async () => {
    if (++decodes === 4)
      await new Promise((resolve) => {
        finish = resolve;
      });
  };
  const pending = f.reader.select(rows[0], {
    raceId: 1,
    onStatus: (status) => firstStatus.push(status),
  });
  assert.equal(firstStatus[0].stage, 'verifying');
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  await settle(() => finish, 'fourth actual original decode never started');
  assert.equal(firstStatus.at(-1).stage, 'decoding');
  const next = f.reader.select(rows[1], {
    raceId: 2,
    onStatus: (status) => nextStatus.push(status),
  });
  assert.equal(nextStatus[0].stage, 'verifying');
  await rejected;
  const detachedCount = firstStatus.length;
  finish();
  const binding = await next;
  assert.equal(binding.pin.identity.levelId, rows[1].level.id);
  assert.equal(f.reader.current(), binding);
  assert.equal(f.model.urls.size, 1);
  assert.equal(
    firstStatus.length,
    detachedCount,
    'cancelled decoding cannot publish late readiness',
  );
  assert.equal(nextStatus.at(-1).status, 'ready');
  assert.ok(
    nextStatus.every((status) => status.progress === null),
    'authentication has no invented file denominator',
  );
  assert.deepEqual(f.writes(), before);
});

test('pending journals, missing descriptors and absent original bytes refuse instead of displaying generic artwork', async (t) => {
  const f = await fixture(t),
    raw = await f.pointer.snapshot();
  await f.put(f.pointer.keys.journalKey, { phase: 'untrusted test journal' });
  let before = f.writes();
  await assert.rejects(f.reader.refresh(), /recovery/);
  assert.deepEqual(f.writes(), before);
  await f.put(f.pointer.keys.journalKey, null);
  await f.put(f.pointer.keys.indexKey, null);
  before = f.writes();
  await assert.rejects(f.reader.refresh(), /descriptor index/);
  assert.deepEqual(f.writes(), before);
  await f.put(f.pointer.keys.indexKey, raw.index);
  const rows = await f.reader.refresh();
  const db = await new Promise((resolve) => {
    const r = f.media.indexedDB.open(MANAGED_MEDIA_DATABASE, 4);
    r.onsuccess = () => resolve(r.result);
  });
  await new Promise((resolve, reject) => {
    const tx = db.transaction('mediaBlobs', 'readwrite');
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
    tx.objectStore('mediaBlobs').delete(pilot.descriptor.originals[0].sha256);
  });
  db.close();
  before = f.writes();
  await assert.rejects(f.reader.select(rows[0], { raceId: 1 }), /missing|unavailable|original/i);
  assert.equal(f.reader.current(), null);
  assert.deepEqual(f.writes(), before);
});

test('Couch recovers installed R5 originals when its optional shipped URL is unavailable', async (t) => {
  const pack = JSON.parse(
    await readFile(new URL('../content/packs/fpv-arcade-r5.json', import.meta.url), 'utf8'),
  );
  const { pack: prepared } = await preparePack(pack, { decodeImage });
  const f = await fixture(t, { embedded: true, chapter: { ...pilot, prior: prepared } }),
    before = f.writes();
  f.reader.dispose();
  let attempts = 0;
  const page = await couchPage(t, {
    initialLevel: null,
    ImageClass: f.model.ImageClass,
    assetDatabase: f.indexedDB,
    storage: f.storage,
    lockManager: f.locks,
    URLImpl: f.model.URLImpl,
    fetchResponse(path) {
      if (path === '../content/packs/fpv-arcade-r5.json') {
        attempts++;
        return { ok: false, status: 404 };
      }
    },
  });
  assert.equal(attempts, 1);
  assert.equal(page.renders[0].level.id, 'signal-01');
  const choices = page
    .$('race-level')
    .options.filter((option) => option.value.startsWith('installed/'));
  assert.equal(choices.length, 3);
  assert.match(page.$('race-installed-status').textContent, /Featured Pressure Lines.*unavailable/);
  assert.match(page.$('race-installed-status').textContent, /3 installed maps available/);
  page.$('race-focus').click();
  page.$('race-level').value = choices[0].value;
  await action(page.$('race-level'), 'change');
  await settle(() => !page.$('race-start').disabled, page.$('race-message').textContent);
  page.$('race-setup-back').click();
  page.frame();
  const binding = page.drawOptions[0].backdrop,
    original = pack.levelVisuals.find((item) => item.levelId === 'orchard-crossing').visualOverrides
      .background;
  assert.equal(page.renders[0].level.id, 'orchard-crossing');
  assert.equal(binding, page.drawOptions[1].backdrop);
  assert.equal(
    sha(binding.image.bytes),
    sha(Buffer.from(original.dataUrl.split(',')[1], 'base64')),
  );
  assert.equal(page.renders[0].tick, 0, 'checking an installed map does not start either player');
  await action(page.$('race-start'));
  page.frame();
  page.key('KeyD');
  page.frames(8);
  page.key('KeyD', false);
  assert.ok(page.renders[0].player.x > page.renders[0].level.spawn.x);
  assert.equal(page.renders[1].player.x, page.renders[1].level.spawn.x);
  assert.deepEqual(f.writes(), before, 'Couch reuses installed bytes without mutating solo data');
});

test('actual Couch selection shares the exact installed image, keeps separate motion and restores asynchronous action focus', async (t) => {
  const f = await fixture(t),
    before = f.writes();
  f.reader.dispose();
  const page = await couchPage(t, {
    initialLevel: null,
    ImageClass: f.model.ImageClass,
    assetDatabase: f.indexedDB,
    storage: f.storage,
    lockManager: f.locks,
    URLImpl: f.model.URLImpl,
  });
  assert.equal(page.renders[0].level.id, 'orchard-crossing');
  const installed = page
    .$('race-level')
    .options.filter((option) => option.value.startsWith('installed/'));
  assert.equal(installed.length, 3);
  page.$('race-focus').click();
  page.$('race-level').value = installed[0].value;
  await action(page.$('race-level'), 'change');
  assert.equal(page.$('race-start').disabled, true);
  await settle(() => !page.$('race-start').disabled, page.$('race-message').textContent);
  page.$('race-setup-back').click();
  page.frame();
  const binding = page.drawOptions[0].backdrop;
  assert.equal(binding, page.drawOptions[1].backdrop);
  assert.equal(sha(binding.image.bytes), binding.pin.sha256);
  assert.equal(page.$('race-canvas-0').width, 1152);
  assert.equal(page.$('race-canvas-0').height, 576);
  assert.equal(page.renders[0].tick, 0, 'choosing a chapter did not start it');
  await action(page.$('race-start'));
  page.frame();
  page.key('KeyD');
  page.key('ArrowLeft');
  page.frames(8);
  page.key('KeyD', false);
  page.key('ArrowLeft', false);
  assert.ok(page.renders[0].player.x > page.renders[0].level.spawn.x);
  assert.ok(page.renders[1].player.x < page.renders[1].level.spawn.x);
  page.$('race-pause').click();
  page.frame();
  const held = page.checkpoint();
  page.$('race-options').click();
  page.frames(3);
  page.$('race-options-back').click();
  assert.deepEqual(page.checkpoint(), held);
  assert.equal(page.drawOptions[0].backdrop, binding);
  await action(page.$('race-start'));
  page.frame();
  assert.equal(page.drawOptions[1].backdrop, binding);
  page.$('race-pause').click();
  page.$('race-focus').click();
  page.$('race-confirm-reset').click();
  await settle(
    () => !page.$('race-start').disabled,
    'next prepared installed race did not become ready',
  );
  const refresh = page.$('race-installed-refresh');
  blurWhenDisabled(refresh);
  refresh.focus();
  await action(refresh);
  assert.equal(page.doc.activeElement, refresh);
  assert.equal(page.$('race-start').disabled, false);
  // A real decode is left pending; Back must cancel, preserve a disabled Start,
  // and a later Retry must return focus without auto-starting the race.
  let finish;
  f.model.onDecode = async () => {
    if (!finish)
      await new Promise((resolve) => {
        finish = resolve;
      });
  };
  page.$('race-level').value = installed[1].value;
  await action(page.$('race-level'), 'change');
  await settle(() => finish, 'pending map original was not read');
  assert.equal(page.$('race-preparation').dataset.state, 'busy');
  assert.equal(page.$('race-preparation').dataset.stage, 'decoding');
  assert.equal(page.$('race-preparation').closest('[hidden]'), null);
  assert.equal(page.$('race-preparation').closest('[inert]'), null);
  assert.equal(page.$('race-setup-back').disabled, false);
  page.$('race-setup-back').click();
  assert.equal(page.$('race-start').disabled, true);
  assert.match(page.$('race-message').textContent, /cancelled/);
  assert.equal(page.$('race-preparation').hidden, true);
  finish();
  f.model.onDecode = null;
  const retry = page.$('race-chapter-retry');
  blurWhenDisabled(retry);
  retry.focus();
  await action(retry);
  assert.equal(page.$('race-start').disabled, false);
  assert.equal(page.doc.activeElement, page.$('race-start'));
  page.frame();
  assert.equal(page.renders[0].tick, 0);
  page.$('race-focus').click();
  finish = null;
  f.model.onDecode = async () => {
    if (!finish)
      await new Promise((resolve) => {
        finish = resolve;
      });
  };
  refresh.focus();
  const movedRefresh = action(refresh);
  await settle(() => finish, 'refresh original decode did not start');
  page.$('race-time').focus();
  finish();
  f.model.onDecode = null;
  await movedRefresh;
  assert.equal(
    page.doc.activeElement,
    page.$('race-time'),
    'async refresh respects navigation to another visible control',
  );
  finish = null;
  f.model.onDecode = async () => {
    if (!finish)
      await new Promise((resolve) => {
        finish = resolve;
      });
  };
  refresh.focus();
  const cancelledRefresh = action(refresh);
  await settle(() => finish, 'second refresh original decode did not start');
  page.$('race-setup-back').click();
  const backFocus = page.doc.activeElement;
  await cancelledRefresh;
  finish();
  f.model.onDecode = null;
  assert.equal(page.doc.activeElement, backFocus, 'late refresh cannot steal Back focus');
  assert.equal(page.$('race-start').disabled, true);
  assert.doesNotMatch(page.$('race-installed-status').textContent, /Checking installed/);
  await action(retry);
  assert.equal(page.$('race-start').disabled, false);
  assert.deepEqual(f.writes(), before);
  page.win.emit('pagehide', { persisted: false });
  assert.equal(f.model.urls.size, 0);
});

test('superseding embedded inspection cancels the old decoder between images and retains the exact legacy fit', async (t) => {
  const f = await fixture(t, { embedded: true }),
    before = f.writes();
  let replacement;
  f.model.onRelease = () => {
    if (replacement) return;
    replacement = f.reader.refresh();
  };
  const initial = f.reader.refresh();
  await assert.rejects(initial, { name: 'AbortError' });
  assert.ok(replacement);
  const rows = await replacement;
  assert.equal(
    f.model.seen.length,
    4,
    'one old decoded original plus exactly three replacement originals',
  );
  f.model.onRelease = null;
  const binding = await f.reader.select(rows[0], { raceId: 1 });
  const source = pilot.prior.levelVisuals.find((entry) => entry.levelId === rows[0].level.id)
    .visualOverrides.background;
  assert.equal(binding.image.source, source.dataUrl);
  assert.equal(binding.fit, source.fit);
  assert.equal(binding.pin, undefined, 'legacy owner stays on its authored embedded path');
  f.reader.clear();
  assert.ok(f.model.seen.every((image) => image.released === 1));
  assert.deepEqual(f.writes(), before);
});

test('main-lobby Back cancels an explicitly pending Retry and never enables Start after the late decode', async (t) => {
  const f = await fixture(t),
    before = f.writes();
  f.reader.dispose();
  const page = await couchPage(t, {
    initialLevel: null,
    ImageClass: f.model.ImageClass,
    assetDatabase: f.indexedDB,
    storage: f.storage,
    lockManager: f.locks,
    URLImpl: f.model.URLImpl,
  });
  const installed = page
    .$('race-level')
    .options.find((option) => option.value.startsWith('installed/'));
  let finish;
  f.model.onDecode = async () => {
    if (!finish)
      await new Promise((resolve) => {
        finish = resolve;
      });
  };
  page.$('race-focus').click();
  page.$('race-level').value = installed.value;
  await action(page.$('race-level'), 'change');
  await settle(() => finish, 'setup decode did not start');
  page.$('race-setup-back').click();
  finish();
  assert.equal(page.$('race-chapter-retry').hidden, false);
  finish = null;
  page.$('race-chapter-retry').focus();
  const retry = action(page.$('race-chapter-retry'));
  await settle(() => finish, 'lobby Retry decode did not start');
  page.key('Escape', true, page.$('race-chapter-retry'));
  page.key('Escape', false, page.$('race-chapter-retry'));
  const observed = {
    message: page.$('race-message').textContent,
    focus: page.doc.activeElement.id,
  };
  finish();
  f.model.onDecode = null;
  await retry;
  assert.match(
    observed.message,
    /cancelled/,
    'Back cancels even when the lobby itself has no parent screen',
  );
  assert.equal(observed.focus, 'race-chapter-retry');
  assert.equal(page.$('race-start').disabled, true);
  assert.equal(page.$('race-chapter-retry').disabled, false);
  assert.equal(f.model.urls.size, 0);
  page.frame();
  assert.equal(page.renders[0].tick, 0);
  assert.equal(page.drawOptions[0].backdrop, null);
  await action(page.$('race-chapter-retry'));
  assert.equal(page.$('race-start').disabled, false);
  // Delay only the Web Locks scheduling boundary; the actual host still checks
  // its snapshot, and Back must defeat an already requested Start as well.
  const request = f.locks.request;
  let grant;
  f.locks.request = async function (...args) {
    f.locks.request = request;
    await new Promise((resolve) => {
      grant = resolve;
    });
    return request.apply(this, args);
  };
  page.$('race-start').focus();
  const start = action(page.$('race-start'));
  await settle(() => grant, 'Start snapshot check did not request the lock');
  page.key('Escape', true, page.$('race-start'));
  page.key('Escape', false, page.$('race-start'));
  grant();
  await start;
  page.frame();
  assert.match(page.$('race-message').textContent, /cancelled/);
  assert.equal(page.$('race-start').disabled, true);
  assert.equal(page.state(), 'ready');
  assert.equal(page.renders[0].tick, 0);
  assert.equal(page.drawOptions[0].backdrop, null);
  assert.deepEqual(f.writes(), before);
});

for (const [name, build] of [
  ['Fracture', () => buildFractureTheme('ukraine')],
  ['Countercurrent', () => buildCountercurrentTheme('coupa')],
])
  test(`new ${name} owner keeps exact installed originals through the reader and shared Couch boards without solo writes`, async (t) => {
    const chapter = await build();
    const f = await fixture(t, { chapter }),
      before = f.writes();
    const rows = await f.reader.refresh();
    assert.equal(rows.length, 3);
    assert.deepEqual(
      rows.map((row) => row.level.id),
      chapter.descriptor.originals.map((original) => original.levelId),
    );
    for (const [index, row] of rows.entries()) {
      const binding = await f.reader.select(row, { raceId: index });
      const original = chapter.descriptor.originals[index];
      assert.equal(binding.pin.identity.baseCampaignKey, chapter.descriptor.campaignKey);
      assert.notEqual(binding.pin.identity.baseCampaignKey, pilot.descriptor.campaignKey);
      assert.equal(binding.pin.identity.themeId, chapter.descriptor.themeId);
      assert.equal(binding.pin.identity.levelId, original.levelId);
      assert.equal(binding.pin.sha256, original.sha256);
      assert.equal(sha(binding.image.bytes), original.sha256);
      assert.equal(binding.image.bytes.length, original.bytes);
      assert.equal(await f.reader.confirm(row, { raceId: index }), binding);
    }
    f.reader.dispose();
    assert.equal(f.model.urls.size, 0);
    const page = await couchPage(t, {
      initialLevel: null,
      ImageClass: f.model.ImageClass,
      assetDatabase: f.indexedDB,
      storage: f.storage,
      lockManager: f.locks,
      URLImpl: f.model.URLImpl,
    });
    assert.equal(
      page.renders[0].level.id,
      'orchard-crossing',
      'fresh shipped default is preserved',
    );
    const installed = page
      .$('race-level')
      .options.filter((option) => option.value.startsWith('installed/'));
    assert.equal(installed.length, 3);
    page.$('race-focus').click();
    page.$('race-level').value = installed[0].value;
    await action(page.$('race-level'), 'change');
    await settle(() => !page.$('race-start').disabled, `${name} original did not become ready`);
    page.$('race-setup-back').click();
    page.frame();
    const binding = page.drawOptions[0].backdrop;
    assert.equal(binding, page.drawOptions[1].backdrop);
    assert.equal(binding.pin.identity.baseCampaignKey, chapter.descriptor.campaignKey);
    assert.equal(binding.pin.identity.themeId, chapter.descriptor.themeId);
    assert.equal(sha(binding.image.bytes), chapter.descriptor.originals[0].sha256);
    for (const run of page.renders) {
      assert.equal(run.level.id, chapter.descriptor.originals[0].levelId);
      assert.equal(run.width, 72);
      assert.equal(run.height, 36);
      assert.equal(run.tick, 0, 'selection never starts a race');
    }
    const firstPosition = { x: page.renders[0].player.x, y: page.renders[0].player.y };
    await action(page.$('race-start'));
    page.frame();
    page.key('ArrowDown');
    page.frames(8);
    page.key('ArrowDown', false);
    assert.deepEqual({ x: page.renders[0].player.x, y: page.renders[0].player.y }, firstPosition);
    assert.ok(page.renders[1].player.y > page.renders[1].level.spawn.y);
    assert.equal(page.drawOptions[0].backdrop, binding);
    assert.equal(page.drawOptions[1].backdrop, binding);
    page.$('race-pause').click();
    page.frame();
    const paused = page.checkpoint();
    page.frames(3);
    assert.deepEqual(page.checkpoint(), paused);
    assert.deepEqual(f.writes(), before);
    assert.equal(f.locks.held.size, 0);
    page.win.emit('pagehide', { persisted: false });
    assert.equal(f.model.urls.size, 0);
    assert.deepEqual(f.writes(), before);
  });
