// Actual app/Library/core with finite DOM, locks and IndexedDB. Prepared JSON
// authority is real; this does not claim native file download or disk recovery.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, memoryStorage } from './helpers/solo-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { buildExternalPilot } from '../../authoring/library/external-chapter-pilot/build.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { emptyLibrary } from '../library.mjs';
import {
  createExternalBackupAssets,
  EXTERNAL_BACKUP_JOURNAL_FORMAT,
} from '../external-backup-assets.mjs';
import { BACKUP_JOURNAL_FORMAT } from '../backup-storage.mjs';
import { SOUNDTRACK_DATABASE } from '../soundtrack-store.mjs';
const pilot = await buildExternalPilot();
const profile = 'revealline.library.dev.v1',
  packsKey = 'revealline.packs.dev.v1';
const settle = (predicate, message = 'Native source host should finish its bounded operation.') =>
  waitFor(predicate, { timeoutMs: 30000, message });
// Retained-original verification is bulk work; join the actual action before checking readiness.
// This test allowance does not change any runtime deadline or storage lease.
const INVENTORY_TIMEOUT_MS = 180000;
const CANCEL_JOIN_TIMEOUT_MS = 15000;
function sourceDiagnostic(p, phase) {
  return JSON.stringify({
    phase,
    status: p.$('optional-worlds-status')?.textContent,
    reloadDisabled: p.$('optional-worlds-reload')?.disabled,
    sourceState: p.$('optional-worlds-source-state')?.textContent,
    chooseDisabled: p.$('optional-worlds-source-choose')?.disabled,
    errors: p.errors.map((error) => String(error?.stack ?? error)),
  });
}
function clickOperation(p, control) {
  const button = p.$(control),
    original = button.onclick;
  assert.equal(button.disabled, false, `${control} must be enabled`);
  let operation;
  button.onclick = function (...args) {
    operation = original.apply(this, args);
    return operation;
  };
  try {
    button.click();
  } finally {
    button.onclick = original;
  }
  assert.equal(typeof operation?.then, 'function', `${control} must expose its action promise`);
  return operation;
}
async function waitSource(
  p,
  phase,
  {
    operation,
    ready = () => !p.$('optional-worlds-reload').disabled,
    timeoutMs = INVENTORY_TIMEOUT_MS,
    cancelJoinTimeoutMs = CANCEL_JOIN_TIMEOUT_MS,
  } = {},
) {
  let completed = !operation,
    rejected = false,
    failure;
  operation?.then(
    () => {
      completed = true;
    },
    (error) => {
      completed = rejected = true;
      failure = error;
    },
  );
  try {
    await waitFor(() => completed && (operation || ready()), { timeoutMs, message: phase });
    if (rejected) throw failure;
    // A fulfilled panel handler can still report a refused installation.
    assert.ok(ready(), `Completed action is not ready: ${sourceDiagnostic(p, phase)}`);
  } catch (error) {
    const beforeCancel = sourceDiagnostic(p, phase);
    let cleanup = 'No pending action to cancel.';
    if (!completed || (!operation && p.$('optional-worlds-reload')?.disabled)) {
      const cancel = p.$('optional-worlds-cancel');
      if (p.$('optional-worlds-dialog')?.open && cancel && !cancel.hidden) {
        cancel.click();
        cleanup = 'Actual panel Cancel requested.';
      }
      if (operation) {
        try {
          await waitFor(() => completed, { timeoutMs: cancelJoinTimeoutMs });
          cleanup += ' Action promise settled after cancellation.';
        } catch {
          cleanup += ' Action promise did not settle within the cleanup allowance.';
        }
      } else {
        // The shell's open callback exposes no promise. Its native Cancel path
        // still aborts the panel; this cannot claim all async unwind has joined.
        cleanup += ' Shell open exposes no promise to join.';
      }
    }
    assert.fail(`${phase}: ${error?.message ?? error}\n${beforeCancel}\n${cleanup}`);
  }
}
class Locks {
  held = new Set();
  async request(name, options, callback) {
    const fn = callback ?? options;
    if (this.held.has(name)) return fn(null);
    this.held.add(name);
    try {
      return await fn({ name });
    } finally {
      this.held.delete(name);
    }
  }
}
class Picture {
  width = 1774;
  height = 887;
  naturalWidth = 1774;
  naturalHeight = 887;
  set src(value) {
    this.url = value;
    if (value) queueMicrotask(() => this.onload?.());
  }
  get src() {
    return this.url;
  }
  async decode() {}
  removeAttribute() {
    this.url = '';
  }
}
async function page(t, f = {}) {
  f.assets ??= managedIndexedDB();
  f.media ??= managedIndexedDB();
  f.storage ??= memoryStorage();
  f.locks ??= new Locks();
  const p = await soloPage(t, {
    assetIndexedDB: f.assets.indexedDB,
    soundtrackIndexedDB: f.media.indexedDB,
    storage: f.storage,
    lockManager: f.locks,
    pictures: { Image: Picture },
    ...f.options,
  });
  const fetchBefore = globalThis.fetch;
  globalThis.fetch = async (url, options) =>
    String(url).includes('optional-worlds.json')
      ? new Response(await readFile(new URL('../content/optional-worlds.json', import.meta.url)))
      : fetchBefore(url, options);
  t.after(() => {
    globalThis.fetch = fetchBefore;
  });
  return Object.assign(p, { fixture: f });
}
async function worlds(p) {
  p.$('shell-menu').click();
  p.$('shell-worlds').click();
  await waitSource(p, 'Open More worlds and authenticate installed originals', {
    ready: () => !!p.$('optional-worlds-source-install') && !p.$('optional-worlds-reload').disabled,
  });
}
async function install(p) {
  await worlds(p);
  p.$('optional-worlds-source-pack').files = [pilot.payloads.pack];
  p.$('optional-worlds-source-media').files = [pilot.payloads.media];
  await waitSource(p, `Install and authenticate exact ${pilot.descriptor.id}`, {
    operation: clickOperation(p, 'optional-worlds-source-install'),
    ready: () =>
      !p.$('optional-worlds-reload').disabled && !p.$('optional-worlds-source-choose').disabled,
  });
  assert.equal(
    p.$('optional-worlds-source-choose').disabled,
    false,
    p.$('optional-worlds-status').textContent + p.$('optional-worlds-source-state').textContent,
  );
}
async function choose(p) {
  const phase = `Choose and authenticate exact ${pilot.descriptor.id}`;
  await waitSource(p, phase, {
    operation: clickOperation(p, 'optional-worlds-source-choose'),
    ready: () => !p.$('optional-worlds-dialog').open,
  });
  // Selection starts its own picture read; a fulfilled Choose is not image readiness.
  try {
    await settle(() => p.doc.body.dataset.pictureState === 'ready');
  } catch (error) {
    assert.fail(
      `${phase}: picture did not become ready: ${error.message}\n${sourceDiagnostic(p, phase)}\n${JSON.stringify({ pack: p.$('pack-select').value, pictureState: p.doc.body.dataset.pictureState })}`,
    );
  }
  p.frame(0);
  assert.equal(p.$('pack-select').value, pilot.descriptor.id);
}
function ticks(p, count) {
  for (let i = 0; i < count; i++) p.frame();
}
function direction(p, value) {
  if (value) {
    p.key('Arrow' + value[0].toUpperCase() + value.slice(1));
    p.key('Arrow' + value[0].toUpperCase() + value.slice(1), false);
  }
}

async function exportCurrent(p) {
  p.$('library-button').click();
  await p.$('export-backup').onclick();
  assert.match(
    p.$('save-status').textContent,
    /Game data prepared/,
    p.$('save-status').textContent,
  );
  return JSON.parse(p.$('save-json').value);
}
async function importCurrent(p, value) {
  p.$('library-button').click();
  p.$('save-json').value = JSON.stringify(value);
  await p.$('import-save').onclick();
  assert.match(
    p.$('save-status').textContent,
    /Game data restored/,
    p.$('save-status').textContent,
  );
}

test('paused external flight exports exact v2 descriptor/session; import and Undo adopt each complete native asset pair', async (t) => {
  const f = {};
  let backup, checkpoint, pin;
  await t.test('actual source install and current paused JSON export', async (t) => {
    const p = await page(t, f);
    await install(p);
    await choose(p);
    p.$('start-button').click();
    direction(p, 'down');
    ticks(p, 151);
    p.$('pause-button').click();
    p.frame(0);
    checkpoint = authoritativeCheckpoint(p.rendered.run);
    pin = p.rendered.backdrop.pin;
    backup = await exportCurrent(p);
    assert.equal(backup.format, 'xonix-backup.v2');
    assert.deepEqual(backup.externalChapters.chapters, [pilot.descriptor]);
    assert.equal(backup.session.format, 'xonix-session.v4');
    assert.equal(backup.session.replay.ticks, p.rendered.run.tick);
    assert.equal(backup.packs.packs[0].id, pilot.descriptor.id);
    assert(!JSON.stringify(backup).includes('data:image'));
    assert.deepEqual(authoritativeCheckpoint(p.rendered.run), checkpoint);
    assert.equal(p.rendered.paused, true);
    assert.deepEqual(p.errors, []);
  });
  await t.test(
    'new target profile with retained originals restores and explicitly Undoes the index',
    async (t) => {
      const target = { media: f.media };
      const p = await page(t, target);
      const prior = await exportCurrent(p);
      assert.deepEqual(prior.externalChapters.chapters, []);
      const originals = target.media.contents();
      await importCurrent(p, backup);
      assert.equal(p.$('undo-backup').disabled, false);
      assert.deepEqual(
        target.assets.contents().get('assets').get(`${profile}.external-chapter-index.v1`).chapters,
        [pilot.descriptor],
      );
      const roundtrip = await exportCurrent(p);
      assert.deepEqual(roundtrip.session, backup.session);
      p.$('library-dialog').close();
      p.$('continue-saved').click();
      await settle(
        () =>
          p.$('pack-select').value === pilot.descriptor.id &&
          p.doc.body.dataset.pictureState === 'ready',
      );
      p.frame(0);
      assert.deepEqual(authoritativeCheckpoint(p.rendered.run), checkpoint);
      assert.deepEqual(p.rendered.backdrop.pin, pin);
      assert.equal(p.rendered.paused, true);
      p.$('library-button').click();
      await p.$('undo-backup').onclick();
      assert.match(
        p.$('save-status').textContent,
        /Previous collection, packs and saved flight restored/,
      );
      assert.deepEqual(
        target.assets.contents().get('assets').get(`${profile}.external-chapter-index.v1`).chapters,
        [],
      );
      assert.equal(
        JSON.parse(target.assets.contents().get('assets').get(packsKey)).packs.length,
        0,
      );
      assert.equal(target.storage.getItem('revealline.suspended.dev.v1'), null);
      assert.deepEqual(
        target.media.contents(),
        originals,
        'Metadata backup/Undo must not rewrite or delete original media.',
      );
      assert.deepEqual(p.errors, []);
    },
  );
  await t.test(
    'missing original metadata refuses before any target profile or asset write',
    async (t) => {
      const p = await page(t);
      p.$('library-button').click();
      const local = new Map(p.storage.map),
        assets = p.fixture.assets.contents();
      const puts = p.fixture.assets.allPuts.length;
      p.$('save-json').value = JSON.stringify(backup);
      await p.$('import-save').onclick();
      assert.match(p.$('save-status').textContent, /original|presentation|missing/i);
      assert.doesNotMatch(p.$('save-status').textContent, /Game data restored/);
      assert.deepEqual(p.storage.map, local);
      assert.deepEqual(p.fixture.assets.contents(), assets);
      assert.equal(p.fixture.assets.allPuts.length, puts);
      assert.deepEqual(p.errors, []);
    },
  );
  await t.test(
    'native asset transaction refusal keeps the old target and does not report a restore',
    async (t) => {
      const p = await page(t, { media: f.media });
      p.$('library-button').click();
      const local = new Map(p.storage.map),
        assets = p.fixture.assets.contents();
      p.fixture.assets.failAnyPutAt = 1;
      p.$('save-json').value = JSON.stringify(backup);
      await p.$('import-save').onclick();
      p.fixture.assets.failAnyPutAt = null;
      assert.doesNotMatch(p.$('save-status').textContent, /Game data restored/);
      assert.match(p.$('save-status').textContent, /fail|write|storage/i);
      assert.deepEqual(p.storage.map, local);
      assert.deepEqual(p.fixture.assets.contents(), assets);
      assert.deepEqual(p.errors, []);
    },
  );
  await t.test(
    'an original lost after durable commit reports committed-but-not-ready without inventing a rollback',
    async (t) => {
      const p = await page(t, { media: f.media });
      let deletion;
      p.fixture.assets.afterAnyCommit = () => {
        const state = p.fixture.assets.contents().get('assets');
        if (
          deletion ||
          state.get(`${profile}.backup-journal`) !== null ||
          !state.get(`${profile}.external-chapter-index.v1`)?.chapters.length
        )
          return;
        deletion = (async () => {
          const db = await new Promise((resolve, reject) => {
            const req = f.media.indexedDB.open(SOUNDTRACK_DATABASE, 4);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
          try {
            await new Promise((resolve, reject) => {
              const tx = db.transaction('mediaBlobs', 'readwrite');
              tx.objectStore('mediaBlobs').delete(pilot.descriptor.originals[0].sha256);
              tx.oncomplete = resolve;
              tx.onabort = () => reject(tx.error);
            });
          } finally {
            db.close();
          }
        })();
      };
      t.after(async () => {
        p.fixture.assets.afterAnyCommit = null;
        await deletion;
      });
      p.$('library-button').click();
      p.$('save-json').value = JSON.stringify(backup);
      await p.$('import-save').onclick();
      assert(deletion, 'Lose the physical original only after the final native commit.');
      await deletion;
      assert.match(p.$('save-status').textContent, /Game data committed.*exact originals/);
      assert.doesNotMatch(p.$('save-status').textContent, /rolled back|Game data restored/);
      assert.deepEqual(
        p.fixture.assets.contents().get('assets').get(`${profile}.external-chapter-index.v1`)
          .chapters,
        [pilot.descriptor],
      );
      assert.equal(
        p.fixture.assets.contents().get('assets').get(`${profile}.backup-journal`),
        null,
      );
      assert.deepEqual(
        JSON.parse(p.storage.getItem('revealline.suspended.dev.v1')),
        backup.session,
      );
      p.frame(0);
      ticks(p, 10);
      assert.equal(p.rendered.paused, true);
      assert.equal(p.rendered.run.tick, 0);
      assert.deepEqual(p.errors, []);
    },
  );
});

test('closing during descriptor hashing cancels export and a changed flight cannot publish its stale result', async (t) => {
  const p = await page(t);
  await install(p);
  await choose(p);
  p.$('start-button').click();
  direction(p, 'down');
  ticks(p, 25);
  p.$('library-button').click();
  p.$('save-json').value = 'previous prepared export';
  const before = authoritativeCheckpoint(p.rendered.run);
  const originalISO = Date.prototype.toISOString;
  const subtle = globalThis.crypto.subtle,
    originalDigest = subtle.digest;
  let captureTimeSeen = false,
    release,
    pending;
  Date.prototype.toISOString = function () {
    captureTimeSeen = true;
    return originalISO.call(this);
  };
  subtle.digest = async function (...args) {
    const result = await originalDigest.apply(this, args);
    // The operation's one capture timestamp precedes snapshot(). The next
    // native descriptor digest is after its first synchronous current-state read.
    if (captureTimeSeen && !release)
      await new Promise((resolve) => {
        release = resolve;
      });
    return result;
  };
  t.after(async () => {
    Date.prototype.toISOString = originalISO;
    subtle.digest = originalDigest;
    release?.();
    await pending;
  });
  pending = p.$('export-backup').onclick();
  await settle(() => !!release);
  p.$('library-dialog').close();
  assert.equal(p.$('save-status').dataset.state, 'cancelled');
  const cancelledMessage = p.$('save-status').textContent;
  p.$('start-button').click();
  ticks(p, 6);
  p.$('pause-button').click();
  p.frame(0);
  assert.notDeepEqual(authoritativeCheckpoint(p.rendered.run), before);
  assert.equal(p.rendered.paused, true);
  release();
  await pending;
  // Close now abandons this preparing operation immediately. The lower snapshot
  // guard still rejects changed state; its late error cannot replace Cancelled.
  assert.equal(p.$('save-status').textContent, cancelledMessage);
  assert.equal(p.$('save-status').dataset.state, 'cancelled');
  assert.equal(p.$('save-json').value, 'previous prepared export');
  assert.deepEqual(p.errors, []);
});

async function putAsset(memory, key, value) {
  const db = await new Promise((resolve, reject) => {
    const req = memory.indexedDB.open('revealline-assets-v1', 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction('assets', 'readwrite');
      tx.objectStore('assets').put(value, key);
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

for (const mode of ['own-v2', 'mixed', 'legacy-v1-indexed'])
  test(`actual startup ${mode === 'own-v2' ? 'recovers' : 'preserves and refuses'} ${mode} backup publication before catalog adoption`, async (t) => {
    const f = { assets: managedIndexedDB(), storage: memoryStorage() };
    const assets = createExternalBackupAssets({
      indexedDB: f.assets.indexedDB,
      storage: f.storage,
      profileKey: profile,
      packsKey,
      writer: { writable: true },
    });
    const prior = JSON.stringify(emptyLibrary());
    const before = await assets.snapshot(),
      keys = assets.keys;
    const journal = assets.journal({
      format: EXTERNAL_BACKUP_JOURNAL_FORMAT,
      token: 'owned-host-interruption',
      targets: {
        profileKey: profile,
        packsKey,
        sessionKey: keys.sessionKey,
        lockKey: keys.lockKey,
        indexKey: keys.indexKey,
      },
      previous: { profile: prior, session: null, packs: before.packs, index: before.index },
      next: {
        packs: JSON.stringify({ format: 'xonix-pack-library.v1', packs: [pilot.prepared.pack] }),
        index: { format: 'revealline-external-chapter-index.v1', chapters: [pilot.descriptor] },
      },
    });
    f.storage.setItem(keys.lockKey, journal.token);
    await assets.begin(before, journal);
    await assets.publish(journal);
    f.storage.setItem(profile, 'partially written profile');
    f.storage.setItem(keys.sessionKey, 'partially written session');
    if (mode === 'mixed')
      await putAsset(f.assets, keys.externalJournalKey, { retained: 'ambiguous external journal' });
    if (mode === 'legacy-v1-indexed')
      await putAsset(f.assets, keys.journalKey, {
        format: BACKUP_JOURNAL_FORMAT,
        token: journal.token,
        targets: {
          profileKey: profile,
          packsKey,
          sessionKey: keys.sessionKey,
          lockKey: keys.lockKey,
        },
        previous: { profile: prior, session: null, packs: before.packs },
      });
    assets.close();
    const rawAssets = f.assets.contents(),
      rawLocal = new Map(f.storage.map),
      puts = f.assets.allPuts.length;
    const p = await page(t, f);
    if (mode === 'own-v2') {
      const state = f.assets.contents().get('assets');
      assert.equal(state.get(packsKey), null);
      assert.equal(state.get(keys.indexKey), null);
      assert.equal(state.get(keys.journalKey), null);
      assert.equal(f.storage.getItem(profile), prior);
      assert.equal(f.storage.getItem(keys.sessionKey), null);
      assert.equal(f.storage.getItem(keys.lockKey), null);
      assert.match(p.$('save-warning').textContent, /rolled back|Interrupted/);
    } else {
      assert.deepEqual(f.assets.contents(), rawAssets);
      assert.deepEqual(f.storage.map, rawLocal);
      assert.equal(f.assets.allPuts.length, puts);
      assert.match(p.$('save-warning').textContent, /recover|journal|legacy|Pending/i);
    }
    assert.equal(p.$('pack-select').value, '');
    assert.equal(p.rendered.run.tick, 0);
    assert.equal(p.rendered.paused, true);
    assert.deepEqual(p.errors, []);
  });
