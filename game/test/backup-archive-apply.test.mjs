import test from 'node:test';
import assert from 'node:assert/strict';
import { attachBackupArchiveApply } from '../ui/backup-archive-apply.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { deferred } from './helpers/media-fixtures.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

function setup(execute) {
  const doc = new Document(),
    root = doc.createElement('section');
  doc.body.append(root);
  let current = true;
  const ui = attachBackupArchiveApply({
    document: doc,
    root,
    execute,
    current: () => current,
    busy: () => false,
  });
  for (const id of ['media', 'story', 'audio', 'journey']) {
    const row = doc.createElement('div');
    root.append(row);
    ui.add({ id }, row);
  }
  return {
    doc,
    root,
    $: (id) => doc.getElementById(`backup-apply-${id}`),
    retire: () => {
      current = false;
      root.remove();
    },
  };
}

test('only the next applicable component can start; downloads and skip choices cannot count as saved', async () => {
  const calls = [],
    h = setup(async (file) => {
      calls.push(file.id);
      return { state: 'saved' };
    });
  assert.equal(h.$('review-story').disabled, true);
  assert.equal(await h.$('review-story').onclick(), false);
  assert.equal(await h.$('review-media').onclick(), true);
  assert.equal(h.$('review-media').disabled, true);
  assert.match(h.$('summary').textContent, /Saved 1 of 4/);
  assert.equal(h.$('keep-story').onclick(), true);
  assert.match(h.$('summary').textContent, /Saved 1 of 4.*kept unchanged: 1/);
  assert.equal(await h.$('review-audio').onclick(), true);
  assert.equal(await h.$('review-journey').onclick(), true);
  assert.deepEqual(calls, ['media', 'audio', 'journey']);
  assert.match(h.$('summary').textContent, /Saved 3 of 4/);
  assert.equal(await h.$('review-story').onclick(), true);
  assert.match(h.$('summary').textContent, /All 4 included components reported saved/);
});

test('failed or partial steps retain earlier success, block later steps and can be reviewed again', async () => {
  const results = [
    { state: 'saved' },
    { state: 'failed', error: 'Missing poster' },
    { state: 'partial', notice: 'sessionOnly' },
    { state: 'saved' },
  ];
  const h = setup(async () => results.shift());
  await h.$('review-media').onclick();
  assert.equal(await h.$('review-story').onclick(), false);
  assert.match(h.$('status-story').textContent, /Missing poster/);
  assert.equal(h.$('review-audio').disabled, true);
  assert.equal(await h.$('review-story').onclick(), false);
  assert.match(h.$('status-story').textContent, /only partly saved/);
  assert.equal(h.$('review-audio').disabled, true);
  await h.$('review-story').onclick();
  assert.equal(h.$('review-audio').disabled, false);
  assert.match(h.$('summary').textContent, /Saved 2 of 4/);
});

test('a pending owner commit blocks other steps, then records actual completion without stealing newer focus', async () => {
  const wait = deferred(),
    h = setup(() => wait.promise),
    other = h.doc.createElement('button');
  h.root.append(other);
  const pending = h.$('review-media').onclick();
  assert.equal(h.$('keep-media').onclick(), false);
  assert.equal(await h.$('review-story').onclick(), false);
  other.focus();
  wait.resolve({ state: 'saved', notice: 'reloadMusic' });
  await pending;
  assert.match(h.$('status-media').textContent, /Saved on this device/);
  assert.equal(h.doc.activeElement, other);
});

test('retiring the archive while an owner finishes cannot publish a stale receipt into another view', async () => {
  const wait = deferred(),
    h = setup(() => wait.promise),
    old = h.$('status-media');
  const pending = h.$('review-media').onclick();
  h.retire();
  wait.resolve({ state: 'saved' });
  await pending;
  assert.match(old.textContent, /Preparing review/);
  assert.equal(await h.$('review-media')?.onclick?.(), undefined);
});

test('unexpected outcome is unconfirmed, never unchanged; EN/UK copy retains partial recovery instructions', async () => {
  const locale = getLocale();
  try {
    setLocale('en', { persist: false });
    const h = setup(async () => {
      throw new Error('connection lost after write');
    });
    await h.$('review-media').onclick();
    assert.match(h.$('status-media').textContent, /Some changes may already be saved/);
    assert.equal(h.$('review-story').disabled, true);
    setLocale('uk', { persist: false });
    assert.match(h.$('status-media').textContent, /Деякі зміни вже могли зберегтися/);
    assert.doesNotMatch(h.root.textContent, /interface:|backupApply\.|\{\{/);
  } finally {
    setLocale(locale, { persist: false });
  }
});
