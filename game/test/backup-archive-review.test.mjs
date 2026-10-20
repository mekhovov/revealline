import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { backupSetFixture } from './helpers/backup-set-fixture.mjs';
import { deferred } from './helpers/media-fixtures.mjs';
import { attachBackupSetPanel } from '../ui/backup-set-panel.mjs';
import { prepareBackupArchive } from '../backup-archive.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

async function harness() {
  const fixture = await backupSetFixture(),
    doc = new Document(),
    dialog = doc.createElement('dialog'),
    root = doc.createElement('section'),
    close = doc.createElement('button'),
    urls = new Map();
  close.setAttribute('data-close', 'library-dialog');
  dialog.open = true;
  doc.body.append(dialog);
  dialog.append(root, close);
  let busy = false,
    next = 0;
  const panel = attachBackupSetPanel({
    document: doc,
    dialog,
    root,
    source: fixture.source,
    busy: () => busy,
    setBusy: (value) => {
      busy = value;
    },
    refresh: () => {},
    URLImpl: {
      createObjectURL: (blob) => {
        const key = `blob:review-${++next}`;
        urls.set(key, blob);
        return key;
      },
      revokeObjectURL: (key) => urls.delete(key),
    },
  });
  const zip = (await prepareBackupArchive(fixture.source)).files[0].blob;
  const $ = (id) => doc.getElementById(id);
  const choose = (file = zip) => {
    $('backup-review-file').files = [file];
    $('backup-review-file').emit('change');
  };
  return { ...fixture, doc, dialog, root, close, urls, panel, zip, $, choose, busy: () => busy };
}

test('guided inspection offers original native files in restore order and keeps read-only wording in both languages', async () => {
  const locale = getLocale();
  try {
    setLocale('en', { persist: false });
    const h = await harness(),
      original = structuredClone(h.contents);
    assert.equal(await h.$('prepare-backup-archive').onclick(), true);
    const old = h.$('download-backup-archive');
    h.choose();
    assert.equal(await h.$('backup-review-inspect').onclick(), true);
    assert.equal(
      old.emit('click').defaultPrevented,
      true,
      'inspection retires the prior export view',
    );
    assert.equal(h.urls.size, 7);
    const results = h.$('backup-review-results');
    assert.equal(results.hidden, false);
    assert.deepEqual(
      results.querySelectorAll('ol li').map((row) => row.id),
      [
        'backup-review-step-media',
        'backup-review-step-story',
        'backup-review-step-audio',
        'backup-review-step-game',
      ],
    );
    assert.equal(h.doc.activeElement.id, 'backup-review-download-media');
    assert.match(h.$('backup-set-status').textContent, /Nothing has been imported or restored/);
    const link = h.$('backup-review-download-media'),
      url = link.href;
    assert.equal(link.emit('click').defaultPrevented, false);
    assert.match(h.$('backup-set-status').textContent, /Check that it was saved/);
    setLocale('uk', { persist: false });
    assert.equal(
      h.$('backup-review-file').isConnected,
      true,
      'localizing the label retains its native file input',
    );
    assert.equal(link.href, url);
    assert.match(h.$('backup-set-status').textContent, /Нічого не імпортовано й не відновлено/);
    assert.doesNotMatch(results.textContent, /interface:|backupReview\.|\{\{/);
    assert.deepEqual(h.contents, original);
    h.doc.hidden = true;
    h.doc.emit('visibilitychange');
    assert.equal(h.urls.size, 7, 'a completed read-only inspection survives a Files round trip');
    h.doc.hidden = false;
    h.dialog.open = false;
    h.dialog.emit('close');
    assert.equal(h.urls.size, 0);
    assert.equal(link.emit('click').defaultPrevented, true);
  } finally {
    setLocale(locale, { persist: false });
  }
});

test('choosing an invalid archive releases old extracted files and allows a clean retry', async () => {
  const h = await harness();
  assert.equal(await h.$('backup-review-inspect').onclick(), false);
  assert.equal(h.doc.activeElement.id, 'backup-review-file');
  h.choose();
  assert.equal(await h.$('backup-review-inspect').onclick(), true);
  const old = h.$('backup-review-download-game');
  h.choose(new Blob(['invalid archive']));
  assert.equal(h.urls.size, 0);
  assert.equal(old.emit('click').defaultPrevented, true);
  assert.equal(await h.$('backup-review-inspect').onclick(), false);
  assert.equal(h.$('backup-review-results').hidden, true);
  assert.equal(h.urls.size, 0);
  assert.equal(h.busy(), false);
  h.choose();
  assert.equal(await h.$('backup-review-inspect').onclick(), true);
  h.panel.invalidate();
});

for (const exit of ['cancel', 'close', 'hidden', 'selection'])
  test(`${exit} during inspection cannot publish a late result or release the operation slot early`, async () => {
    const h = await harness(),
      entered = deferred(),
      held = deferred(),
      slice = h.zip.slice.bind(h.zip);
    let first = true;
    h.zip.slice = (...args) => {
      const blob = slice(...args),
        read = blob.arrayBuffer.bind(blob);
      if (first) {
        first = false;
        blob.arrayBuffer = async () => {
          entered.resolve();
          await held.promise;
          return read();
        };
      }
      return blob;
    };
    h.choose();
    const pending = h.$('backup-review-inspect').onclick();
    await entered.promise;
    assert.equal(h.busy(), true);
    assert.equal(h.close.disabled, false);
    if (exit === 'cancel') assert.equal(h.panel.cancel(), true);
    if (exit === 'close') {
      h.dialog.open = false;
      h.dialog.emit('close');
    }
    if (exit === 'hidden') {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
    }
    if (exit === 'selection') h.choose(new Blob(['other']));
    assert.equal(h.busy(), true);
    assert.equal(await h.$('prepare-backup-archive').onclick(), false);
    held.resolve();
    assert.equal(await pending, false);
    assert.equal(h.busy(), false);
    assert.equal(h.urls.size, 0);
    assert.equal(h.$('backup-review-results').hidden, true);
    if (exit === 'cancel') assert.equal(h.doc.activeElement.id, 'backup-review-inspect');
  });
