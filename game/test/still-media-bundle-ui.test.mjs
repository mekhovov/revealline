import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { exportMediaBundle, importMediaBundle } from '../media-bundle.mjs';
import { prepareStoredStillMedia } from '../media-storage-record.mjs';
import { prepareStillAsset } from '../media-still.mjs';
import { createSoundtrackStore } from '../soundtrack-store.mjs';
import { exportSoundtrackBundle } from '../soundtrack-bundle.mjs';
import { stillAuthoringKeys } from '../ui/still-media-catalog.mjs';
import {
  mediaFixture,
  libraryRecord,
  pngBytes,
  provenance,
  deferred,
} from './helpers/media-fixtures.mjs';
import { fixture as audioFixture, memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import { workshop, decodeImage } from './helpers/still-workshop.mjs';

// Actual UI/route/store/binary APIs; Canvas, decoder, IndexedDB, device and native
// browser default actions are explicitly modeled. No disk/hardware claim.
const bytes = async (blob) => Buffer.from(await blob.arrayBuffer());
const f = mediaFixture(true),
  image = await prepareStillAsset(
    new Blob([pngBytes()]),
    { id: 'picture-a', provenance: provenance() },
    { decodeImage },
  );
const library = libraryRecord(f.identity);
library.assets = [image.asset];
const prepared = await prepareStoredStillMedia(
  library,
  [{ sha256: image.asset.sha256, blob: image.blob }],
  { executionCatalog: f.catalog, decodeImage },
);
const generic = new Blob(['Retained original source, not a display picture.']);
const genericHash = createHash('sha256')
  .update(await bytes(generic))
  .digest('hex');
async function backup(assigned = true) {
  const doc = structuredClone(prepared.library);
  doc.legacy.items = [{ id: 'retained-source', sha256: genericHash }];
  if (!assigned) doc.library.assignments = [];
  return exportMediaBundle(doc, [...prepared.assets, { sha256: genericHash, blob: generic }], {
    decodeImage,
  });
}
const bundle = await backup(),
  unassigned = await backup(false);

test('actual workshop reviews without writes, explicitly restores all originals, and prepares a separate native download', async (t) => {
  const h = await workshop(t);
  await h.open();
  const store = h.store(),
    before = await store.read();
  h.choose(bundle);
  assert.equal(await h.$('review-originals').onclick(), true);
  assert.deepEqual(await store.read(), before);
  assert.match(
    h.$('bundle-review').textContent,
    /2 distinct retained originals.*No data has been restored/,
  );
  assert.equal(h.doc.activeElement, h.$('restore-originals'));
  const reviewed = h.$('bundle-review').textContent,
    selected = h.$('bundle-file').files;
  h.$('bundle-file').focus();
  h.$('bundle-file').dispatchEvent(new Event('cancel', { bubbles: true }));
  assert.equal(h.host.panel.dialog.open, true);
  assert.equal(h.doc.activeElement, h.$('bundle-file'));
  assert.equal(h.$('bundle-file').files, selected);
  assert.equal(h.$('bundle-review').textContent, reviewed);
  assert.equal(h.$('restore-originals').disabled, false);
  assert.deepEqual(await store.read(), before);
  assert.equal(await h.$('restore-originals').onclick(), true);
  const restored = await store.read();
  assert.equal(restored.generation, 1);
  assert.equal(restored.assets.length, 2);
  assert.deepEqual(restored.document.legacy.items, [
    { id: 'retained-source', sha256: genericHash },
  ]);
  assert.deepEqual(await bytes(await store.readBlob(genericHash)), await bytes(generic));
  assert.deepEqual(await bytes(await store.readBlob(image.asset.sha256)), pngBytes());
  assert.equal(h.host.panel.snapshot().ready, false);
  await h.$('reload').onclick();
  await h.$('show-saved').onclick();
  assert.equal(h.paints.at(-1).asset.sha256, image.asset.sha256);
  let clicks = 0;
  h.$('download-originals').addEventListener('click', () => ++clicks);
  assert.equal(await h.$('prepare-originals').onclick(), true);
  const link = h.$('download-originals');
  assert.equal(clicks, 0);
  assert.equal(link.hidden, false);
  assert.equal(h.doc.activeElement, link);
  assert.equal(link.download, 'fpv-line-originals.rlmedia');
  assert.deepEqual(await bytes(h.urls.get(link.href)), await bytes(bundle));
  assert.match(h.$('status').textContent, /has not saved a file to disk/);
  link.click();
  assert.equal(clicks, 1);
  assert.match(h.$('status').textContent, /download requested/i);
  assert.equal(h.revoked.length, 0, 'Explicit native download does not revoke retry copy.');
  link.click();
  assert.equal(clicks, 2);
  h.host.panel.close();
  assert.deepEqual(h.revoked, [link.href || 'blob:workshop-1']);
});

for (const mode of ['preserve', 'restore'])
  test(`actual ${mode} review distinguishes assignments while retaining current and incoming history`, async (t) => {
    const h = await workshop(t);
    await h.open();
    await h.upload();
    const before = await h.store().read(),
      clears = h.clears;
    h.choose(unassigned, mode);
    await h.$('review-originals').onclick();
    assert.equal((await h.store().read()).generation, before.generation);
    assert.match(
      h.$('bundle-policy').textContent,
      mode === 'restore' ? /removing current bindings/ : /Keep destination assignments/,
    );
    assert.equal(await h.$('restore-originals').onclick(), true);
    const after = await h.store().read();
    assert.equal(after.document.library.assignments.length, mode === 'preserve' ? 1 : 0);
    if (mode === 'preserve')
      assert.deepEqual(after.document.library.assignments, before.document.library.assignments);
    assert.equal(after.document.library.presentations.length, 2);
    assert.equal(after.document.library.assets.length, 2);
    assert.equal(
      after.assets.length,
      2,
      'Same image bytes share physical original; generic retained.',
    );
    assert.equal(h.clears, clears, 'Restore does not clear an already inspected preview.');
  });

test('corrupt bundle, quota refusal, and stale writer keep exact prior storage and preview', async (t) => {
  const h = await workshop(t);
  await h.open();
  await h.upload();
  const store = h.store(),
    before = await store.read(),
    clears = h.clears;
  const corrupt = await bytes(bundle);
  corrupt[corrupt.length - 1] ^= 1;
  h.choose(new Blob([corrupt]));
  assert.equal(await h.$('review-originals').onclick(), false);
  assert.equal(h.$('restore-originals').disabled, true);
  assert.deepEqual(await store.read(), before);
  assert.equal(h.clears, clears);
  h.choose(bundle);
  assert.equal(await h.$('review-originals').onclick(), true);
  h.memory.failAnyPutAt = 1;
  assert.equal(await h.$('restore-originals').onclick(), false);
  h.memory.failAnyPutAt = null;
  assert.deepEqual(await store.read(), before);
  assert.equal(h.$('restore-originals').disabled, true);
  assert.equal(h.clears, clears);
  await h.$('review-originals').onclick();
  const next = await store.prepare(before.document.library, before.assets, {
    previous: before.document,
    executionCatalog: f.catalog,
  });
  await store.commit(next, { expectedGeneration: before.generation });
  const concurrent = await store.read();
  assert.equal(await h.$('restore-originals').onclick(), false);
  assert.match(h.$('status').textContent, /changed|generation|Reload/i);
  assert.deepEqual(await store.read(), concurrent);
  assert.equal(h.clears, clears);
});

test('review binds the exact installed catalog, selected file and explicit assignment policy', async (t) => {
  const h = await workshop(t);
  await h.open();
  h.choose(bundle);
  await h.$('review-originals').onclick();
  h.$('bundle-mode').value = 'restore';
  h.$('bundle-mode').onchange();
  assert.equal(h.$('restore-originals').disabled, true);
  assert.equal(await h.$('restore-originals').onclick(), false);
  await h.$('review-originals').onclick();
  h.$('bundle-file').files = [unassigned];
  assert.equal(
    await h.$('restore-originals').onclick(),
    false,
    'Even without a synthetic change event, review cannot change file.',
  );
  h.choose(bundle);
  await h.$('review-originals').onclick();
  h.rows.set(stillAuthoringKeys().packs, '{"format":"xonix-pack-library.v1","packs":[]}');
  assert.equal(await h.$('restore-originals').onclick(), false);
  assert.match(h.$('status').textContent, /Installed packs changed/);
  assert.equal((await h.store().read()).generation, 0);
  assert.equal(h.held.size, 0);
});

test('cancelled late review and double commands cannot publish stale restore or download', async (t) => {
  const gate = deferred(),
    entered = deferred();
  let slow = false;
  const h = await workshop(t, {
    host: {
      decodeImage: async () => {
        if (slow) {
          entered.resolve();
          await gate.promise;
        }
        return decodeImage();
      },
    },
  });
  await h.open();
  h.choose(bundle);
  slow = true;
  const pending = h.$('review-originals').onclick();
  await entered.promise;
  assert.equal(await h.$('review-originals').onclick(), false);
  assert.equal(await h.$('prepare-originals').onclick(), false);
  h.$('bundle-mode').value = 'restore';
  h.$('bundle-mode').onchange();
  slow = false;
  await h.$('reload').onclick();
  h.choose(unassigned);
  await h.$('review-originals').onclick();
  const review = h.$('bundle-review').textContent;
  gate.resolve();
  assert.equal(await pending, false);
  assert.equal(h.$('bundle-review').textContent, review);
  assert.equal(h.$('restore-originals').disabled, false);
  assert.equal(await h.$('restore-originals').onclick(), true);
  assert.equal((await h.store().read()).document.library.assignments.length, 0);
});

test('allocation-time cancellation and hidden lifecycle release prepared download without late artifacts', async (t) => {
  let cancel = false,
    h;
  h = await workshop(t, {
    allocate: () => {
      if (cancel) h.$('cancel').onclick();
    },
  });
  await h.open();
  cancel = true;
  assert.equal(await h.$('prepare-originals').onclick(), false);
  assert.equal(h.$('download-originals').hidden, true);
  assert.equal(h.revoked.length, 1);
  cancel = false;
  await h.$('reload').onclick();
  await h.$('prepare-originals').onclick();
  const url = h.$('download-originals').href;
  h.doc.hidden = true;
  h.doc.emit('visibilitychange');
  assert.equal(h.$('download-originals').hidden, true);
  assert.ok(h.revoked.includes(url));
  h.win.emit('pagehide', { persisted: true });
  h.doc.hidden = false;
  h.win.emit('pageshow', { persisted: true });
  assert.equal(h.host.panel.dialog.open, false);
  assert.equal(h.$('restore-originals').disabled, true);
});

test('shared v3 MP3 recovery is byte-identical after originals restore', async (t) => {
  const memory = memoryIndexedDB(),
    audio = await audioFixture(),
    old = createSoundtrackStore({ indexedDB: memory.indexedDB });
  await old.commit(audio.prepared, { expectedGeneration: 0 });
  old.close();
  const expected = await exportSoundtrackBundle(audio.library, audio.assets);
  const h = await workshop(t, { memory });
  await h.open();
  h.choose(bundle);
  await h.$('review-originals').onclick();
  await h.$('restore-originals').onclick();
  h.host.panel.close();
  assert.equal(await h.hostNode('export-audio').onclick(), true);
  const actual = h.urls.get(h.hostNode('download-audio').href);
  assert.deepEqual(await bytes(actual), await bytes(expected));
  assert.equal(
    (await importMediaBundle(bundle, { decodeImage })).assets.length,
    2,
    'Image backup does not claim the separate audio file.',
  );
});

test('actual controller router reaches download/review/restore and held Confirm cannot apply the newly reviewed file', async (t) => {
  const reviewEntered = deferred(),
    finishReview = deferred();
  let holdReview = false,
    now = 0;
  const pad = {
    index: 0,
    id: 'Workshop controller',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  const h = await workshop(t, {
    host: {
      readPads: () => [pad],
      decodeImage: async () => {
        if (holdReview) {
          reviewEntered.resolve();
          await finishReview.promise;
        }
        return decodeImage();
      },
    },
  });
  h.win.performance = { now: () => now };
  const frame = (time) => {
    now = time;
    h.frame(time);
  };
  await h.open();
  const press = (id, down) => {
    pad.buttons[id] = { pressed: down, value: down ? 1 : 0 };
  };
  frame(0);
  press(0, true);
  frame(1);
  press(0, false);
  frame(2);
  await h.$('prepare-originals').onclick();
  let downloads = 0;
  h.$('download-originals').addEventListener('click', () => ++downloads);
  press(0, true);
  frame(3);
  assert.equal(downloads, 0, 'Download waits for Confirm release.');
  frame(500);
  assert.equal(downloads, 0, 'A held Confirm does not activate early.');
  press(0, false);
  frame(501);
  assert.equal(downloads, 1, 'Release commits the captured download exactly once.');
  const echo = h.doc.emit('keydown', { key: 'Enter', target: h.$('download-originals') });
  assert.equal(echo.defaultPrevented, true, 'Native compatibility tail cannot download twice.');
  h.$('download-originals').click();
  h.doc.emit('keyup', { key: 'Enter', target: h.$('download-originals') });
  assert.equal(downloads, 1);
  frame(1800); // Advance the host clock past the finite compatibility echo window.
  const key = h.doc.emit('keydown', { key: 'Enter', target: h.$('download-originals') });
  assert.equal(key.defaultPrevented, false, 'Browser owns Enter on the native anchor.');
  h.$('download-originals').click(); // Explicitly modeled native browser default.
  h.doc.emit('keyup', { key: 'Enter', target: h.$('download-originals') });
  assert.equal(downloads, 2);
  frame(1801); // Native keyboard handoff requires a fresh physical-neutral sample.
  h.choose(bundle);
  h.$('review-originals').focus();
  h.host.navigation.sync();
  const reviewed = deferred();
  let reviews = 0;
  const original = h.$('review-originals').onclick;
  h.$('review-originals').onclick = () => {
    reviews++;
    const result = original();
    result.then(reviewed.resolve);
    return result;
  };
  holdReview = true;
  press(0, true);
  frame(2001);
  frame(2500);
  assert.equal(reviews, 0, 'Held Review has not begun validating or changed targets.');
  press(0, false);
  frame(2501);
  await reviewEntered.promise;
  assert.equal(reviews, 1);
  h.$('cancel').focus();
  press(0, true);
  frame(2502); // Capture Cancel while the real image decode is outstanding.
  finishReview.resolve();
  assert.equal(await reviewed.promise, true);
  assert.equal(h.doc.activeElement, h.$('restore-originals'));
  frame(3000);
  assert.equal(
    (await h.store().read()).generation,
    0,
    'Held old target cannot confirm newly focused Restore.',
  );
  press(0, false);
  frame(3001);
  assert.equal(
    (await h.store().read()).generation,
    0,
    'Release of the replaced target stays cancelled.',
  );
  const restored = deferred();
  const restore = h.$('restore-originals').onclick;
  h.$('restore-originals').onclick = () => {
    const result = restore();
    result.then(restored.resolve);
    return result;
  };
  press(0, true);
  frame(3002);
  frame(3500);
  assert.equal((await h.store().read()).generation, 0, 'Explicit Restore also waits for release.');
  press(0, false);
  frame(3501);
  assert.equal(await restored.promise, true);
  assert.equal((await h.store().read()).generation, 1);
});
