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
import { deferred } from './helpers/media-fixtures.mjs';

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
  const manager = createManagedMediaStore({
    indexedDB: media.indexedDB,
    storyMedia: true,
    soundtrackCatalogue: true,
  });
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

async function readyInstalledPage(t, { coarse = false } = {}) {
  const f = await fixture(t);
  f.reader.dispose();
  const page = await couchPage(t, {
    initialLevel: null,
    coarse,
    ImageClass: f.model.ImageClass,
    assetDatabase: f.indexedDB,
    storage: f.storage,
    lockManager: f.locks,
    URLImpl: f.model.URLImpl,
  });
  const choice = page
    .$('race-level')
    .options.find((option) => option.value.startsWith('installed/'));
  assert.ok(choice);
  page.$('race-focus').click();
  page.$('race-level').value = choice.value;
  await action(page.$('race-level'), 'change');
  page.$('race-setup-back').click();
  page.frame(0);
  assert.equal(page.state(), 'ready');
  return { f, page };
}

function holdInitialConfirmation(t, f) {
  const gate = deferred(),
    request = f.locks.request.bind(f.locks);
  let hold = true,
    entered = false;
  f.locks.request = async (...args) => {
    if (hold) {
      hold = false;
      entered = true;
      await gate.promise;
    }
    return request(...args);
  };
  t.after(() => gate.resolve());
  return { gate, entered: () => entered };
}

for (const interruption of ['Tab to Help', 'pointer to Help', 'Help then BODY'])
  test(`initial Start ownership preserves a newer ${interruption} choice`, async (t) => {
    const { f, page } = await readyInstalledPage(t),
      writes = f.writes(),
      checkpoint = page.checkpoint(),
      runs = [...page.renders],
      picture = page.drawOptions[0].backdrop,
      held = holdInitialConfirmation(t, f);
    page.$('race-start').focus();
    const starting = action(page.$('race-start'));
    await settle(held.entered, 'Initial installed confirmation must enter its real lock.');
    assert.equal(page.doc.activeElement === page.$('race-picture-cancel'), true);
    const help = page.$('race-help');
    if (interruption === 'Tab to Help') {
      // Exercise the host's actual Tab routing, without selecting its target for it.
      for (let count = 0; page.doc.activeElement !== help && count < 24; count++) {
        const before = page.doc.activeElement;
        const event = before.emit('keydown', { key: 'Tab', code: 'Tab' });
        assert.equal(event.defaultPrevented, true, 'The host owns this menu Tab.');
        assert.equal(page.doc.activeElement !== before, true, 'Tab must advance menu focus.');
      }
      assert.equal(page.doc.activeElement === help, true, 'Help must be reachable using Tab only.');
    } else {
      help.emit('pointerdown', { pointerType: 'touch', button: 0, isPrimary: true });
      help.focus();
      if (interruption === 'Help then BODY') page.doc.body.focus();
    }
    const owner = page.doc.activeElement;
    held.gate.resolve();
    await starting;
    page.frame(0);
    assert.equal(
      page.state(),
      'ready',
      'An older confirmation cannot authorize launch after newer focus.',
    );
    assert.equal(page.$('race-start').disabled, false);
    assert.equal(page.doc.activeElement === owner, true, 'Confirmation must preserve newer focus.');
    assert.equal(
      page.renders.every((run, index) => run === runs[index]),
      true,
    );
    assert.deepEqual(page.checkpoint(), checkpoint);
    assert.equal(page.drawOptions[0].backdrop === picture, true);
    assert.equal(page.drawOptions[1].backdrop === picture, true);
    assert.deepEqual(f.writes(), writes);
    // Deliberate activation is admitted even when a touch browser leaves old focus.
    await action(page.$('race-start'));
    page.frame(0);
    assert.equal(page.state(), 'running');
    assert.equal(page.drawOptions[0].backdrop === picture, true);
    assert.deepEqual(f.writes(), writes);
  });

test('initial Start ownership survives admitted direct touch without prior button focus', async (t) => {
  const { f, page } = await readyInstalledPage(t, { coarse: true }),
    writes = f.writes(),
    held = holdInitialConfirmation(t, f);
  page.doc.body.focus();
  page.$('race-start').emit('pointerdown', { pointerType: 'touch', button: 0, isPrimary: true });
  const starting = action(page.$('race-start'));
  await settle(held.entered, 'Touch Start must reach required authentication.');
  assert.equal(page.state(), 'ready');
  held.gate.resolve();
  await starting;
  page.frame(0);
  assert.equal(page.state(), 'running');
  assert.deepEqual(f.writes(), writes);
});

test('initial Start ownership keeps a shipped synchronous touch start immediate', async (t) => {
  const page = await couchPage(t, { coarse: true });
  page.doc.body.focus();
  page.$('race-start').emit('pointerdown', { pointerType: 'touch', button: 0, isPrimary: true });
  const starting = action(page.$('race-start'));
  page.frame(0);
  assert.equal(
    page.state(),
    'running',
    'The synchronous shipped path needs no additional action or turn.',
  );
  await starting;
});

test('initial Start ownership checks newer focus produced during completion cleanup', async (t) => {
  const { f, page } = await readyInstalledPage(t),
    held = holdInitialConfirmation(t, f),
    writes = f.writes(),
    checkpoint = page.checkpoint(),
    start = page.$('race-start'),
    help = page.$('race-help');
  start.focus();
  const starting = action(start);
  await settle(held.entered, 'Initial confirmation must be pending.');
  let disabled = start.disabled,
    moved = false;
  Object.defineProperty(start, 'disabled', {
    configurable: true,
    get: () => disabled,
    set(value) {
      disabled = value;
      if (!value && !moved) {
        moved = true;
        help.focus();
      }
    },
  });
  held.gate.resolve();
  await starting;
  page.frame(0);
  assert.equal(moved, true, 'The completion UI callback actually changed focus.');
  assert.equal(
    page.state(),
    'ready',
    'Final launch must recheck ownership after completion callbacks.',
  );
  assert.equal(page.doc.activeElement === help, true);
  assert.deepEqual(page.checkpoint(), checkpoint);
  assert.deepEqual(f.writes(), writes);
});

test('interrupted async Start confirmation stays ready after blur and return until a fresh Start', async (t) => {
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
  const choice = page
    .$('race-level')
    .options.find((option) => option.value.startsWith('installed/'));
  page.$('race-focus').click();
  page.$('race-level').value = choice.value;
  await action(page.$('race-level'), 'change');
  page.$('race-setup-back').click();
  page.frame(0);
  const runs = [...page.renders],
    checkpoint = page.checkpoint(),
    picture = page.drawOptions[0].backdrop,
    entered = deferred(),
    gate = deferred(),
    request = f.locks.request.bind(f.locks);
  let hold = true;
  f.locks.request = async (...args) => {
    if (hold) {
      hold = false;
      entered.resolve();
      await gate.promise;
    }
    return request(...args);
  };
  page.$('race-start').focus();
  const starting = action(page.$('race-start'));
  await entered.promise;
  assert.equal(page.doc.activeElement === page.$('race-picture-cancel'), true);
  page.doc.focused = false;
  page.win.emit('blur');
  page.doc.body.focus();
  page.doc.focused = true;
  page.frame(0);
  gate.resolve();
  await starting;
  page.frame(0);
  assert.equal(page.state(), 'ready', 'The interrupted Start gesture cannot resume on return.');
  assert.equal(page.$('race-start').disabled, false, 'The confirmed picture remains usable.');
  assert.equal(page.doc.activeElement === page.doc.body, true);
  assert.equal(
    page.renders.every((run, index) => run === runs[index]),
    true,
  );
  assert.deepEqual(page.checkpoint(), checkpoint);
  assert.equal(page.drawOptions[0].backdrop === picture, true);
  assert.equal(page.drawOptions[1].backdrop === picture, true);
  await action(page.$('race-start'));
  page.frame(0);
  assert.equal(page.state(), 'running');
  assert.deepEqual(f.writes(), before);
});

test('cancelled Start confirmation cannot overwrite Retry for the same untouched attempt', async (t) => {
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
  const choice = page
    .$('race-level')
    .options.find((option) => option.value.startsWith('installed/'));
  page.$('race-focus').click();
  page.$('race-level').value = choice.value;
  await action(page.$('race-level'), 'change');
  page.$('race-setup-back').click();
  page.frame();
  const held = page.checkpoint(),
    runs = [...page.renders];
  const oldEntered = deferred(),
    oldGate = deferred(),
    decodeEntered = deferred(),
    decodeGate = deferred();
  const request = f.locks.request.bind(f.locks);
  let holdNext = true;
  f.locks.request = async (...args) => {
    if (holdNext) {
      holdNext = false;
      oldEntered.resolve();
      await oldGate.promise;
      throw new Error('Delayed old confirmation refusal.');
    }
    return request(...args);
  };
  page.$('race-start').focus();
  const starting = action(page.$('race-start'));
  await oldEntered.promise;
  assert.equal(page.$('race-picture-cancel').hidden, false);
  assert.equal(page.doc.activeElement === page.$('race-picture-cancel'), true);
  page.$('race-picture-cancel').click();
  assert.equal(page.doc.activeElement === page.$('race-chapter-retry'), true);
  f.model.onDecode = async () => {
    decodeEntered.resolve();
    await decodeGate.promise;
  };
  const retrying = action(page.$('race-chapter-retry'));
  oldGate.resolve();
  await starting;
  await decodeEntered.promise;
  assert.equal(page.doc.activeElement === page.$('race-picture-cancel'), true);
  assert.equal(
    page.$('race-picture-cancel').hidden,
    false,
    'The newer read still owns the busy UI.',
  );
  assert.equal(page.$('race-chapter-retry').disabled, true);
  assert.equal(page.$('race-start').disabled, true);
  assert.doesNotMatch(page.$('race-message').textContent, /Delayed old confirmation refusal/);
  assert.deepEqual(page.checkpoint(), held);
  decodeGate.resolve();
  await retrying;
  page.frame(0);
  assert.equal(page.$('race-start').disabled, false);
  assert.equal(page.doc.activeElement === page.$('race-start'), true);
  assert.equal(
    page.renders.every((run, index) => run === runs[index]),
    true,
  );
  assert.deepEqual(page.checkpoint(), held);
  assert.deepEqual(f.writes(), before);
});

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
  const owner = f.reader.presentationOwner(rows[0]);
  assert.equal(owner.entry.sourcePackId, rows[0].sourcePackId);
  assert.equal(owner.pack.id, rows[0].sourcePackId);
  assert(Object.isFrozen(owner));
  assert.throws(() => f.reader.presentationOwner({ ...rows[0] }), /current installed/);
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
  assert.throws(() => f.reader.presentationOwner(rows[0]), /current installed/);
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

test('selected pack refresh requires exact validated content and reports its source owner without store or Solo writes', async (t) => {
  const f = await fixture(t),
    before = f.writes(),
    stored = await f.pointer.snapshot(),
    expectedPack = (await preparePack(structuredClone(pilot.prepared.pack), { decodeImage })).pack;
  assert.notEqual(
    expectedPack,
    pilot.prepared.pack,
    'Identity is content-based, not object equality.',
  );
  const rows = await f.reader.refresh({ expectedPack });
  assert.equal(rows.length, expectedPack.campaigns[0].levels.length);
  assert.ok(rows.every((row) => row.sourcePackId === expectedPack.id));
  assert.deepEqual(
    rows.map((row) => row.level.id),
    expectedPack.campaigns[0].levels.map((level) => level.id),
  );
  assert.deepEqual(f.writes(), before);

  for (const difference of ['metadata', 'gameplay body', 'absent pack']) {
    const candidate = structuredClone(expectedPack);
    if (difference === 'metadata') candidate.description += ' Different reviewed description.';
    else if (difference === 'gameplay body') candidate.campaigns[0].levels[0].goal.coverage -= 0.01;
    else candidate.id = 'uninstalled-expected-pack';
    const selected = (await preparePack(candidate, { decodeImage })).pack;
    if (difference !== 'absent pack') {
      assert.equal(selected.id, expectedPack.id);
      assert.equal(selected.version, expectedPack.version);
      assert.equal(selected.campaigns[0].id, expectedPack.campaigns[0].id);
    }
    await assert.rejects(
      f.reader.refresh({ expectedPack: selected }),
      /The selected chapter changed\. Refresh Chapters before playing\./,
      `${difference} cannot refresh as the previously selected exact pack`,
    );
    assert.deepEqual(f.writes(), before, `${difference} rejection must remain read-only`);
    assert.deepEqual(await f.pointer.snapshot(), stored);
  }

  const recovered = await f.reader.refresh({ expectedPack });
  assert.equal(recovered.length, rows.length);
  assert.ok(recovered.every((row) => row.sourcePackId === expectedPack.id));
  assert.deepEqual(f.writes(), before);
  assert.deepEqual(await f.pointer.snapshot(), stored);
  assert.equal(f.locks.held.size, 0);
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
    const r = f.media.indexedDB.open(MANAGED_MEDIA_DATABASE, 5);
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
  const pendingMap = action(page.$('race-level'), 'change');
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
  await pendingMap;
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

// These cases finish the actual installed race through its input and clock.
// The boundary models delay decoding/lock delivery; they do not edit a run,
// fabricate a result or certify browser pixels.
async function completedInstalledRound(t, format) {
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
  const choice = page
    .$('race-level')
    .options.find((option) => option.value.startsWith('installed/'));
  assert.ok(choice);
  page.$('race-focus').click();
  assert.equal(page.$('race-format').value, 'single');
  if (format !== 'single') {
    page.$('race-format').value = format;
    await action(page.$('race-format'), 'change');
  }
  page.$('race-level').value = choice.value;
  await action(page.$('race-level'), 'change');
  await settle(
    () => !page.$('race-start').disabled,
    'The installed first round never became ready.',
  );
  page.$('race-setup-back').click();
  await action(page.$('race-start'));
  page.frame(0);
  assert.equal(page.state(), 'running');
  page.key('KeyS');
  page.frames(151, 200);
  page.key('KeyS', false);
  page.frame(0);
  assert.equal(page.state(), 'finished');
  const completed = {
    runs: [...page.renders],
    checkpoint: page.checkpoint(),
    picture: page.drawOptions[0].backdrop,
    results: [0, 1].map((i) => page.$(`race-result-${i}`).textContent),
    wins: page.$('series-score').textContent,
    selection: page.$('race-level').value,
  };
  assert.notEqual(completed.wins, '0 : 0', 'The input route must yield a nonzero series result.');
  assert.equal(page.$('race-format').value, format);
  assert.equal(
    page
      .$('race-start')
      .textContent.startsWith(`${format === 'single' ? 'Rematch' : 'Next round'}:`),
    true,
  );
  assert.equal(sha(completed.picture.image.bytes), completed.picture.pin.sha256);
  assert.equal(completed.picture === page.drawOptions[1].backdrop, true);
  assert.deepEqual(f.writes(), before);
  return { f, page, before, completed };
}
function assertCompletedInstalled(page, completed) {
  page.frame(0);
  assert.equal(page.state(), 'finished', 'The accepted completed round still owns Results.');
  assert.equal(
    page.renders.every((run, i) => run === completed.runs[i]),
    true,
  );
  assert.deepEqual(page.checkpoint(), completed.checkpoint);
  assert.deepEqual(
    [0, 1].map((i) => page.$(`race-result-${i}`).textContent),
    completed.results,
  );
  assert.equal(page.$('series-score').textContent, completed.wins);
  assert.equal(page.$('race-level').value, completed.selection);
  assert.equal(
    page.drawOptions.every((options) => options.backdrop === completed.picture),
    true,
  );
  assert.equal(completed.picture.image.released || 0, 0);
  assert.equal(page.$('race-review').hidden, false);
}

for (const format of ['single', 'first-to-two']) {
  const continuation = format === 'single' ? 'Rematch' : 'Next round';
  test(`installed ${continuation} decode failure keeps completed Results, wins and the original available to View`, async (t) => {
    const diagnostics = [];
    t.mock.method(console, 'warn', (...args) => diagnostics.push(args));
    const { f, page, before, completed } = await completedInstalledRound(t, format),
      priorImages = f.model.seen.length;
    f.model.onDecode = async () => {
      throw new Error('Held installed Next decode refused.');
    };
    page.$('race-start').focus();
    await action(page.$('race-start'));
    assertCompletedInstalled(page, completed);
    assert.equal(page.$('race-start').disabled, false);
    assert.equal(
      page.$('race-message').textContent,
      `The ${continuation.toLowerCase()} picture could not be prepared. Results are kept. Choose ${continuation} to retry.`,
    );
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0][0], 'Next picture preparation failed.');
    assert.match(diagnostics[0][1].message, /decode refused/);
    const rejected = f.model.seen.slice(priorImages);
    assert.ok(rejected.length > 0, 'The refusal occurred after actual image allocation.');
    assert.ok(rejected.every((image) => image.released === 1));
    assert.equal(f.model.urls.has(completed.picture.image.source), true);
    page.$('race-review').click();
    page.frame(0);
    assert.equal(page.$('race-boards').hidden, false);
    assertCompletedInstalled(page, completed);
    page.$('race-pause').click();
    assertCompletedInstalled(page, completed);
    assert.equal(page.doc.activeElement === page.$('race-review'), true);
    assert.deepEqual(f.writes(), before);
  });

  test(`installed ${continuation} confirmation refusal retains the prior lease until one successful retry starts play`, async (t) => {
    const diagnostics = [];
    t.mock.method(console, 'warn', (...args) => diagnostics.push(args));
    const { f, page, completed } = await completedInstalledRound(t, format),
      raw = await f.pointer.snapshot(),
      gate = deferred(),
      request = f.locks.request.bind(f.locks),
      priorImages = f.model.seen.length;
    let armed = true;
    f.locks.request = async (...args) => {
      if (
        armed &&
        page
          .$('race-preparation')
          .textContent.includes('Confirming the next chapter before adopting it')
      ) {
        armed = false;
        await gate.promise;
      }
      return request(...args);
    };
    page.$('race-start').focus();
    const pending = action(page.$('race-start'));
    await settle(() => !armed, 'The final installed confirmation never requested its lock.');
    assertCompletedInstalled(page, completed);
    assert.equal(page.$('race-start').disabled, true);
    assert.equal(page.$('race-picture-cancel').hidden, false);
    assert.ok(f.model.seen.slice(priorImages).some((image) => image.decoded && !image.released));
    await f.put(f.pointer.keys.packsKey, `${raw.packs}\n`);
    const afterExternalChange = f.writes();
    gate.resolve();
    await pending;
    assertCompletedInstalled(page, completed);
    assert.equal(page.$('race-start').disabled, false);
    assert.equal(
      page.$('race-message').textContent,
      `The ${continuation.toLowerCase()} picture could not be prepared. Results are kept. Choose ${continuation} to retry.`,
    );
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0][0], 'Next picture preparation failed.');
    assert.match(diagnostics[0][1].message, /snapshot changed/);
    assert.ok(f.model.seen.slice(priorImages).every((image) => image.released === 1));
    assert.deepEqual(
      f.writes(),
      afterExternalChange,
      'The failed read performs no compensating save.',
    );
    await f.put(f.pointer.keys.packsKey, raw.packs);
    const beforeRetry = f.writes();
    page.$('race-start').focus();
    await action(page.$('race-start'));
    page.frame(0);
    assert.equal(
      page.state(),
      'running',
      'The uninterrupted continuation starts after confirmation without another Start.',
    );
    assert.equal(
      page.renders.every((run, i) => run !== completed.runs[i]),
      true,
    );
    assert.equal(
      page.$('series-score').textContent,
      format === 'single' ? '0 : 0' : completed.wins,
    );
    assert.equal(completed.picture.image.released, 1);
    const nextPicture = page.drawOptions[0].backdrop;
    assert.equal(nextPicture === completed.picture, false);
    assert.equal(nextPicture === page.drawOptions[1].backdrop, true);
    assert.deepEqual(nextPicture.pin.identity, completed.picture.pin.identity);
    assert.equal(sha(nextPicture.image.bytes), completed.picture.pin.sha256);
    page.$('race-pause').click();
    page.frame(0);
    assert.equal(page.state(), 'paused');
    const paused = page.checkpoint();
    page.frames(20);
    assert.deepEqual(page.checkpoint(), paused);
    assert.equal(page.drawOptions[0].backdrop === nextPicture, true);
    await action(page.$('race-start'));
    page.frame(0);
    assert.equal(page.state(), 'running');
    assert.equal(page.drawOptions[0].backdrop === nextPicture, true);
    assert.deepEqual(f.writes(), beforeRetry);
  });

  test(`installed cancelled ${continuation} cannot overwrite a newer retry or revive Start after blur and return`, async (t) => {
    const { f, page, before, completed } = await completedInstalledRound(t, format),
      oldGate = deferred(),
      newGate = deferred();
    let oldImage, newImage;
    f.model.onDecode = async (image) => {
      oldImage = image;
      await oldGate.promise;
    };
    page.$('race-start').focus();
    const first = action(page.$('race-start'));
    await settle(() => oldImage, 'The cancelled candidate decoder never started.');
    assertCompletedInstalled(page, completed);
    page.$('race-picture-cancel').focus();
    page.$('race-picture-cancel').click();
    await first;
    assertCompletedInstalled(page, completed);
    assert.equal(page.doc.activeElement === page.$('race-start'), true);
    assert.equal(page.$('race-start').disabled, false);
    assert.match(page.$('race-message').textContent, /cancelled.*Results are kept/s);
    f.model.onDecode = async (image) => {
      newImage = image;
      await newGate.promise;
    };
    const retry = action(page.$('race-start'));
    await settle(() => newImage, 'The replacement candidate decoder never started.');
    assertCompletedInstalled(page, completed);
    assert.equal(page.doc.activeElement === page.$('race-picture-cancel'), true);
    oldGate.resolve();
    await settle(() => oldImage.decoded, 'The cancelled decoder did not settle.');
    assert.equal(oldImage.released, 1);
    assert.equal(page.$('race-start').disabled, true);
    assert.equal(page.$('race-picture-cancel').hidden, false);
    assertCompletedInstalled(page, completed);
    page.doc.focused = false;
    page.win.emit('blur');
    page.doc.body.focus();
    page.doc.focused = true;
    newGate.resolve();
    await retry;
    page.frame(0);
    assert.equal(page.state(), 'ready');
    assert.equal(page.doc.activeElement === page.doc.body, true);
    assert.equal(completed.picture.image.released, 1);
    assert.equal(
      page.$('series-score').textContent,
      format === 'single' ? '0 : 0' : completed.wins,
    );
    assert.equal(page.drawOptions[0].backdrop === page.drawOptions[1].backdrop, true);
    const ready = page.checkpoint();
    page.frames(20);
    assert.deepEqual(page.checkpoint(), ready);
    await action(page.$('race-start'));
    page.frame(0);
    assert.equal(page.state(), 'running');
    assert.deepEqual(f.writes(), before);
  });
}

for (const outcome of ['cancel', 'replacement'])
  test(`installed candidate ready callback ${outcome} retains accepted ownership until a confirmed commit`, async (t) => {
    const f = await fixture(t),
      rows = await f.reader.refresh(),
      accepted = await f.reader.select(rows[0], { raceId: 1 }),
      before = f.writes(),
      priorImages = f.model.seen.length;
    let replacement;
    const pending = f.reader.stage(rows[1], {
      raceId: 2,
      onStatus(status) {
        if (status.status !== 'ready') return;
        if (outcome === 'cancel') f.reader.cancel();
        else replacement = f.reader.stage(rows[2], { raceId: 3 });
      },
    });
    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(f.reader.current() === accepted, true);
    assert.equal(accepted.image.released || 0, 0);
    if (outcome === 'replacement') {
      assert.ok(replacement);
      const candidate = await replacement;
      assert.equal(f.reader.current() === accepted, true);
      await candidate.confirm();
      assert.equal(f.reader.current() === accepted, true);
      const retire = candidate.commit();
      assert.equal(f.reader.current() === candidate.picture, true);
      assert.equal(
        accepted.image.released || 0,
        0,
        'Publication and old-lease cleanup are separate.',
      );
      retire();
      retire();
      assert.equal(accepted.image.released, 1);
      candidate.cancel();
      assert.equal(candidate.picture.image.released || 0, 0);
      assert.equal(await f.reader.confirm(rows[2], { raceId: 3 }), candidate.picture);
    } else {
      assert.ok(f.model.seen.slice(priorImages).every((image) => image.released === 1));
      assert.equal(await f.reader.confirm(rows[0], { raceId: 1 }), accepted);
    }
    assert.deepEqual(f.writes(), before);
    f.reader.dispose();
    assert.equal(f.model.urls.size, 0);
    assert.ok(f.model.seen.every((image) => image.released === 1));
  });
