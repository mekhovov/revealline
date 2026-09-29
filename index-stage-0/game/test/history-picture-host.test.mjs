import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { pngBytes, deferred } from './helpers/media-fixtures.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { presentationPicturePins } from '../flight-media-pins.mjs';
import { CURRENT_PICTURES } from '../presentation/current-pictures.mjs';
import { FORMATS, TOKEN_DEFAULTS } from '../presentation/model.mjs';
import { COMPILED_PRESENTATION_FORMAT } from '../presentation/host.mjs';
import { hashPresentationBytes } from '../presentation/bundle.mjs';

const campaign = JSON.parse(await readFile(new URL('../content/campaign.json', import.meta.url)));
const sessionKey = 'revealline.suspended.dev.v1';
const writerKey = 'revealline.library.dev.v1.writer';
const ticks = (page, count) => {
  for (let i = 0; i < count; i++) page.frame();
};
class Locks {
  held = new Set();
  calls = [];
  async request(key, options, callback) {
    const work = callback ?? options;
    this.calls.push(key);
    if (this.held.has(key)) return work(null);
    this.held.add(key);
    try {
      return await work({ name: key });
    } finally {
      this.held.delete(key);
    }
  }
}
class Picture {
  constructor() {
    this.width = this.height = this.naturalWidth = this.naturalHeight = 1;
  }
  set src(value) {
    this.url = value;
    if (value) queueMicrotask(() => this.onload?.());
  }
  decode() {
    return Promise.resolve();
  }
  removeAttribute() {
    this.url = '';
  }
}
async function pageFor(t, { read, Image = Picture, waitForPictures = true, inspectMemory } = {}) {
  const bytes = pngBytes(),
    sha256 = await hashPresentationBytes(bytes),
    slot = CURRENT_PICTURES.find(
      (row) => row.owner.levelId === campaign.levels[0].id && row.owner.themeId === 'fpv',
    );
  assert.ok(slot);
  const asset = {
    format: FORMATS.asset,
    id: 'test.history-picture',
    revision: 1,
    kind: 'image',
    description: 'Bounded original-byte history fixture; no production art claim.',
    provenance: {
      creator: 'Test',
      source: 'Owned one-pixel PNG fixture',
      license: 'Test only',
      prompt: '',
      parent: null,
    },
    file: { sha256, bytes: bytes.length, mime: 'image/png', width: 1, height: 1 },
    recipe: null,
    geometry: {
      frame: { x: 0, y: 0, width: 1, height: 1 },
      pivot: { x: 0.5, y: 0.5 },
      occupiedBounds: null,
      rotorAnchors: [],
      nineSlice: null,
    },
    quality: { stage: 'produced', evidence: [] },
  };
  const manifest = {
      format: COMPILED_PRESENTATION_FORMAT,
      source: { id: 'test.history', revision: 1 },
      resolved: {
        theme: { id: 'fpv-field-kit', revision: 1, name: 'History fixture' },
        collection: null,
        tokens: TOKEN_DEFAULTS,
        bindings: { [slot.id]: { id: asset.id, revision: 1 } },
        assets: { [slot.id]: asset },
      },
      urls: { [sha256]: `./assets/${sha256}.png` },
    },
    memory = managedIndexedDB(),
    locks = new Locks();
  let reads = 0;
  inspectMemory?.(memory, sha256);
  const page = await soloPage(t, {
    campaign,
    soundtrackIndexedDB: memory.indexedDB,
    lockManager: locks,
    pictures: { Image },
    waitForPictures,
    fetchResponse: async (url, options) => {
      if (!String(url).includes('/presentation/compiled/')) return undefined;
      if (String(url).endsWith('/runtime.json')) return new Response(JSON.stringify(manifest));
      assert.ok(String(url).endsWith(`/assets/${sha256}.png`));
      reads++;
      await read?.(options.signal);
      return new Response(bytes);
    },
  });
  return { page, memory, locks, sha256, reads: () => reads };
}
async function historyReturn(page, locks) {
  page.win.emit('pagehide', { persisted: true });
  await settle(() => !locks.held.has(writerKey));
  page.win.emit('pageshow', { persisted: true });
  assert.match(page.$('save-warning').textContent, /session-only mode/);
  page.frame(0);
  assert.equal(page.rendered.paused, true);
}

test('history return retires same-owner speculative work before a late ordinary rejection', async (t) => {
  const gate = deferred();
  let signal, readSettled;
  const { page, memory, locks } = await pageFor(t, {
    waitForPictures: false,
    async read(nextSignal) {
      signal = nextSignal;
      try {
        await gate.promise; // Model a transport that rejects after ignoring abort.
      } finally {
        readSettled = true;
      }
    },
  });
  await settle(() => signal);
  const run = page.rendered.run,
    checkpoint = authoritativeCheckpoint(run);
  await historyReturn(page, locks);
  assert.equal(signal.aborted, true, 'A prewarm is cancelled even when Start never joined it.');
  const message = page.$('run-message').textContent,
    writes = memory.allPuts.length;
  gate.reject(new Error('Late original read failed after navigation'));
  await settle(() => readSettled);
  // Drain the already-rejected transport's promise continuations, not an I/O deadline.
  await new Promise((resolve) => setImmediate(resolve));
  ticks(page, 5);
  assert.equal(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.equal(page.$('run-message').textContent, message);
  assert.equal(page.$('picture-use-legacy').hidden, true);
  assert.equal(memory.allPuts.length, writes);
  assert.equal(locks.calls.filter((key) => key === writerKey).length, 1);
  assert.deepEqual(page.errors, []);
});

test('an unfinished new original offers reload and export without another download or a legacy choice', async (t) => {
  const gate = deferred();
  let signal;
  const { page, memory, locks, reads } = await pageFor(t, {
    waitForPictures: false,
    async read(nextSignal) {
      signal = nextSignal;
      await gate.promise;
    },
  });
  await settle(() => signal);
  await historyReturn(page, locks);
  gate.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  const checkpoint = authoritativeCheckpoint(page.rendered.run),
    writes = memory.allPuts.length,
    storage = new Map(page.storage.map);
  let reloads = 0;
  page.win.location.reload = () => reloads++;
  page.$('start-button').click();
  await settle(() => page.$('flight-preparation-status').dataset.state === 'error');
  assert.match(page.$('run-message').textContent, /cannot save a new picture.*Export.*reloading/);
  assert.doesNotMatch(
    page.$('flight-preparation-status').textContent,
    /unavailable|missing|restore/i,
  );
  assert.equal(page.$('picture-use-legacy').hidden, true);
  assert.equal(page.$('picture-export-data').hidden, false);
  assert.equal(page.$('picture-reload').hidden, false);
  assert.equal(reads(), 1);
  assert.equal(reloads, 0, 'Recovery never navigates automatically.');
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.deepEqual(page.storage.map, storage);
  assert.equal(memory.allPuts.length, writes);
  const recoveryMessage = page.$('flight-preparation-status').textContent;
  page.$('picture-export-data').focus();
  page.$('picture-export-data').click();
  assert.equal(page.$('library-dialog').open, true);
  assert.equal(page.$('library-saves').hidden, false);
  assert.equal(page.$('picture-export-data').hidden, false);
  assert.equal(page.$('picture-reload').hidden, false);
  assert.equal(page.$('flight-preparation-status').textContent, recoveryMessage);
  page.$('library-dialog').close();
  await settle(() => page.doc.activeElement === page.$('picture-export-data'));
  assert.equal(page.$('picture-reload').hidden, false, 'Export returns directly to Reload.');
  assert.equal(page.$('flight-preparation-status').textContent, recoveryMessage);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.deepEqual(page.storage.map, storage);
  assert.equal(memory.allPuts.length, writes);
  page.$('picture-reload').click();
  assert.equal(reloads, 1);
  assert.equal(reads(), 1);
  assert.equal(locks.calls.filter((key) => key === writerKey).length, 1);
  assert.deepEqual(page.errors, []);
});

test('settled writer recovery clears on explicit retry, world change and page retirement', async (t) => {
  const gate = deferred();
  let signal;
  const { page, memory, locks, reads } = await pageFor(t, {
    waitForPictures: false,
    async read(nextSignal) {
      signal = nextSignal;
      await gate.promise;
    },
  });
  await settle(() => signal);
  await historyReturn(page, locks);
  gate.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  const writes = memory.allPuts.length,
    storage = new Map(page.storage.map),
    checkpoint = authoritativeCheckpoint(page.rendered.run);
  page.$('start-button').click();
  await settle(() => !page.$('picture-reload').hidden);

  page.$('start-button').click();
  assert.equal(page.$('picture-reload').hidden, true, 'An explicit retry replaces recovery.');
  assert.equal(page.$('flight-preparation-status').dataset.state, 'busy');
  await settle(() => !page.$('picture-reload').hidden);

  page.$('theme-select').value = 'ukraine';
  const changingWorld = page.$('theme-select').onchange();
  assert.equal(page.$('picture-reload').hidden, true, 'The previous world cannot retain actions.');
  await changingWorld;
  await historyReturn(page, locks);
  assert.equal(page.$('picture-export-data').hidden, true);
  assert.equal(page.$('picture-reload').hidden, true);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.deepEqual(page.storage.map, storage);
  assert.equal(memory.allPuts.length, writes);
  assert.equal(reads(), 1);
  assert.deepEqual(page.errors, []);
});

test('history Continue and explicit Resume keep the saved pin and checkpoint without reacquiring or writing', async (t) => {
  const { page, memory, locks, sha256, reads } = await pageFor(t);
  page.$('start-button').click();
  page.key('ArrowDown');
  ticks(page, 13);
  page.key('ArrowDown', false);
  page.$('pause-button').click();
  const saved = JSON.parse(page.storage.getItem(sessionKey)),
    checkpoint = authoritativeCheckpoint(page.rendered.run);
  page.change('turn-select', 'grid-center');
  await settle(() => page.doc.body.dataset.pictureState === 'ready');
  await historyReturn(page, locks);
  const storage = new Map(page.storage.map),
    writes = memory.allPuts.length;
  // A fresh read-only choice may reuse the exact published history already retained.
  page.change('turn-select', 'immediate');
  await settle(() => page.doc.body.dataset.pictureState === 'ready');
  assert.equal(reads(), 1);
  assert.equal(memory.allPuts.length, writes);
  page.$('shell-menu').click();
  page.$('shell-continue').click();
  await settle(() => page.doc.body.dataset.flightState === 'paused');
  page.frame(0);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.equal(page.rendered.backdrop.pin.sha256, sha256);
  assert.deepEqual(
    page.rendered.backdrop.pin,
    presentationPicturePins(saved.presentationPins).choices.find(
      (pin) => pin.identity.themeId === 'fpv',
    ),
  );
  ticks(page, 3);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  page.$('library-button').click();
  page.$('export-session').click();
  await settle(() => page.$('save-json').value.startsWith('{'));
  const exported = JSON.parse(page.$('save-json').value);
  assert.equal(exported.runId, saved.runId);
  assert.deepEqual(exported.presentationPins, saved.presentationPins);
  assert.deepEqual(exported.replay.checkpoint, saved.replay.checkpoint);
  page.$('library-dialog').close();
  page.$('start-button').click();
  ticks(page, 2);
  assert.equal(page.rendered.paused, false);
  assert.ok(page.rendered.run.tick > saved.replay.ticks);
  assert.deepEqual(page.storage.map, storage);
  assert.equal(memory.allPuts.length, writes);
  assert.equal(locks.calls.filter((key) => key === writerKey).length, 1);
  assert.deepEqual(page.errors, []);
});

test('history cancellation preserves selected pins while a new explicit Start retries only their decode', async (t) => {
  const gate = deferred();
  let decodes = 0,
    originalStored = false;
  class HeldPicture extends Picture {
    decode() {
      // Original validation happens before durable history exists; hold the
      // selected-picture display only after that actual commit completes.
      if (!originalStored) return Promise.resolve();
      decodes++;
      return decodes === 1 ? gate.promise : Promise.resolve();
    }
  }
  const { page, memory, locks, sha256, reads } = await pageFor(t, {
    Image: HeldPicture,
    waitForPictures: false,
    inspectMemory(memory, hash) {
      memory.afterAnyCommit = () => {
        if (memory.allPuts.some(([store, key]) => store === 'mediaBlobs' && key === hash))
          originalStored = true;
      };
    },
  });
  await settle(() => decodes === 1);
  const checkpoint = authoritativeCheckpoint(page.rendered.run);
  await historyReturn(page, locks);
  const writes = memory.allPuts.length;
  gate.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  ticks(page, 3);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.equal(page.rendered.paused, true);
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.frame(0);
  assert.equal(page.rendered.backdrop.pin.sha256, sha256);
  assert.equal(decodes, 2);
  assert.equal(reads(), 1);
  assert.equal(memory.allPuts.length, writes);
  assert.equal(locks.calls.filter((key) => key === writerKey).length, 1);
  assert.equal(page.$('picture-reload').hidden, true);
  assert.deepEqual(page.errors, []);
});
