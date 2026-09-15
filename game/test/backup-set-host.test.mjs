import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { attachBackupSetPanel } from '../ui/backup-set-panel.mjs';
import { backupSetFixture } from './helpers/backup-set-fixture.mjs';
import { deferred } from './helpers/media-fixtures.mjs';
import { soloPage } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
const fetchBlob = globalThis.fetch;

async function panel() {
  const fixture = await backupSetFixture(),
    document = new Document(),
    dialog = document.createElement('dialog'),
    root = document.createElement('section'),
    close = document.createElement('button'),
    other = document.createElement('button'),
    urls = new Map(),
    revoked = [];
  dialog.open = true;
  close.setAttribute('data-close', 'library-dialog');
  document.body.append(dialog);
  dialog.append(close, other, root);
  let busy = false,
    next = 0;
  const ui = attachBackupSetPanel({
    document,
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
        const url = `blob:test-${++next}`;
        urls.set(url, blob);
        return url;
      },
      revokeObjectURL: (url) => {
        revoked.push(url);
        urls.delete(url);
      },
    },
  });
  return {
    ...fixture,
    ui,
    document,
    dialog,
    close,
    other,
    urls,
    revoked,
    $: (id) => document.getElementById(id),
    busy: () => busy,
  };
}

test('explicit native links preserve retry URLs, distinguish requested from prepared, then close releases every URL', async () => {
  const h = await panel();
  assert.equal(await h.$('prepare-backup-set').onclick(), true);
  assert.equal(h.urls.size, 5);
  assert.equal(h.$('backup-set-filenames').hidden, false);
  assert.equal(h.$('backup-set-filenames').open, false);
  assert.equal(h.$('backup-set-filename-summary').tagName, 'SUMMARY');
  assert.equal(h.$('backup-set-filename-summary').textContent, 'File names');
  assert.equal(h.$('backup-set-files').querySelectorAll('a').length, 5);
  const names = ['game', 'media', 'story', 'audio', 'coverage'].map((id) => {
    const anchor = h.$(`download-backup-${id}`);
    assert.match(anchor.download, /^RevealLine-backup-[0-9TZ]+-[a-f0-9]{32}-/);
    assert.equal(
      anchor.textContent,
      {
        game: 'Download game data',
        media: 'Download pictures',
        story: 'Download stories',
        audio: 'Download music',
        coverage: 'Download coverage report',
      }[id],
    );
    assert.equal(anchor.getAttribute('aria-describedby'), `backup-set-state-${id}`);
    assert.equal(h.$(`backup-set-filename-${id}`).textContent, anchor.download);
    assert.equal(h.$(`backup-set-purpose-${id}`).textContent, anchor.textContent);
    return anchor.download.match(/^RevealLine-backup-[0-9TZ]+-[a-f0-9]{32}-/)[0];
  });
  assert.equal(new Set(names).size, 1, 'The actual native links keep the shared prefix.');
  assert.match(h.$('backup-set-status').textContent, /No file has been saved/);
  assert.equal(h.document.activeElement.id, 'download-backup-game');
  const link = h.$('download-backup-media'),
    event = link.emit('click');
  assert.equal(event.defaultPrevented, false, 'Native anchor default action is retained.');
  assert.match(h.$('backup-set-state-media').textContent, /Download requested/);
  assert.match(h.$('backup-set-state-audio').textContent, /Prepared/);
  assert.equal(h.urls.size, 5);
  assert.equal(link.emit('click').defaultPrevented, false);
  h.$('backup-set-filenames').open = true;
  h.dialog.open = false;
  h.dialog.emit('close');
  assert.equal(h.$('backup-set-filenames').hidden, true);
  assert.equal(h.$('backup-set-filenames').open, false);
  assert.equal(h.$('backup-set-filename-list').children.length, 0);
  assert.equal(h.urls.size, 0);
  assert.equal(h.revoked.length, 5);
  assert.equal(
    link.emit('click').defaultPrevented,
    true,
    'A retained stale anchor cannot download.',
  );
});

test('Cancel joins the pending read before allowing another preparation and restores focus and controls', async () => {
  const h = await panel(),
    held = deferred(),
    entered = deferred(),
    read = h.source.readStill;
  h.source.readStill = async (options) => {
    entered.resolve();
    await held.promise;
    return read(options);
  };
  const first = h.$('prepare-backup-set').onclick();
  await entered.promise;
  assert.equal(h.close.disabled, false);
  assert.equal(h.other.disabled, true);
  assert.equal(h.document.activeElement.id, 'cancel-backup-set');
  assert.equal(h.ui.cancel(), true);
  assert.equal(h.busy(), true, 'The unfinished exporter still owns the single preparation slot.');
  assert.equal(await h.$('prepare-backup-set').onclick(), false);
  held.resolve();
  assert.equal(await first, false);
  assert.equal(h.busy(), false);
  assert.equal(h.other.disabled, false);
  assert.equal(h.document.activeElement.id, 'prepare-backup-set');
  assert.equal(h.urls.size, 0);
  assert.deepEqual(h.calls, ['media']);
});

test('changed source rejects native activation and visibility teardown releases the next prepared set', async () => {
  const h = await panel();
  await h.$('prepare-backup-set').onclick();
  const link = h.$('download-backup-game');
  h.changeGame();
  assert.equal(link.emit('click').defaultPrevented, true);
  assert.equal(h.urls.size, 0);
  assert.equal(h.document.activeElement.id, 'prepare-backup-set');
  assert.equal(h.$('backup-set-filenames').hidden, true);
  await h.$('prepare-backup-set').onclick();
  assert.equal(h.$('backup-set-filenames').open, false);
  assert.notEqual(h.$('backup-set-filename-game').textContent, link.download);
  assert.equal(h.$('backup-set-filename-game').textContent, h.$('download-backup-game').download);
  assert.equal(h.urls.size, 5);
  h.document.hidden = true;
  h.document.emit('visibilitychange');
  assert.equal(h.urls.size, 0);
});

test('actual solo host exports a paused unfinished flight without changing its checkpoint, storage or intent', async (t) => {
  const h = await soloPage(t);
  h.$('start-button').click();
  h.key('ArrowDown');
  for (let i = 0; i < 30; i++) h.frame();
  h.key('ArrowDown', false);
  h.$('library-button').click();
  const saves = [...h.$('library-dialog').querySelectorAll('button')].find(
    (node) => node.dataset.libraryPanel === 'saves',
  );
  saves.click();
  h.frame(0);
  const before = authoritativeCheckpoint(h.rendered.run),
    stored = new Map(h.storage.map),
    music = h.$('music-preview').textContent;
  assert.equal(h.rendered.paused, true);
  assert.equal(
    await h.$('prepare-backup-set').onclick(),
    true,
    h.$('backup-set-status').textContent,
  );
  assert.deepEqual(authoritativeCheckpoint(h.rendered.run), before);
  assert.deepEqual(h.storage.map, stored);
  assert.equal(h.$('music-preview').textContent, music);
  const link = h.$('download-backup-game'),
    game = await (await fetchBlob(link.href)).json();
  assert.ok(game.session?.replay);
  assert.equal(game.session.replay.ticks, h.rendered.run.tick);
  assert.equal(h.document?.hidden ?? h.doc.hidden, false);
  assert.equal(h.doc.activeElement.id, 'download-backup-game');
  h.$('library-dialog').dispatchEvent(new Event('cancel', { cancelable: true }));
  h.$('library-dialog').close();
  h.frame(0);
  assert.equal(h.rendered.paused, true);
  assert.deepEqual(authoritativeCheckpoint(h.rendered.run), before);
  assert.deepEqual(h.errors, []);
});

for (const exit of ['escape', 'controller'])
  test(`actual Library ${exit} cancels backup preparation without double-closing or resuming`, async (t) => {
    const pad = {
        index: 0,
        id: 'Backup navigation',
        connected: true,
        mapping: 'standard',
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
      },
      h = await soloPage(t, { readPads: () => [pad] });
    h.$('start-button').click();
    h.key('ArrowDown');
    for (let i = 0; i < 30; i++) h.frame();
    h.key('ArrowDown', false);
    h.$('library-button').click();
    [...h.$('library-dialog').querySelectorAll('button')]
      .find((node) => node.dataset.libraryPanel === 'saves')
      .click();
    h.frame();
    h.frame();
    const before = authoritativeCheckpoint(h.rendered.run),
      stored = new Map(h.storage.map),
      operation = h.$('prepare-backup-set').onclick();
    assert.equal(h.$('cancel-backup-set').hidden, false);
    if (exit === 'escape') {
      const event = new Event('cancel', { cancelable: true });
      if (h.$('library-dialog').dispatchEvent(event)) h.$('library-dialog').close();
      assert.equal(event.defaultPrevented, true);
    } else {
      pad.buttons[1] = { pressed: true, value: 1 };
      h.frame();
      pad.buttons[1] = { pressed: false, value: 0 };
      h.frame();
    }
    assert.equal(await operation, false);
    assert.equal(h.$('library-dialog').open, true);
    assert.equal(h.$('backup-set-files').children.length, 0);
    assert.equal(h.doc.activeElement.id, 'prepare-backup-set');
    assert.equal(h.rendered.paused, true);
    assert.deepEqual(authoritativeCheckpoint(h.rendered.run), before);
    assert.deepEqual(h.storage.map, stored);
    assert.doesNotMatch(h.$('controller-ui-hint').textContent, /operation is still in progress/);
    assert.deepEqual(h.errors, []);
    assert.equal(await h.$('prepare-backup-set').onclick(), true);
    const downloadUrl = h.$('download-backup-game').href;
    // Model the native details open state; the browser owns summary activation.
    h.$('backup-set-filenames').open = true;
    h.$('backup-set-filename-summary').focus();
    assert.equal(h.doc.activeElement.id, 'backup-set-filename-summary');
    if (exit === 'escape') {
      const event = new Event('cancel', { cancelable: true });
      if (h.$('library-dialog').dispatchEvent(event)) h.$('library-dialog').close();
      assert.equal(event.defaultPrevented, true);
    } else {
      pad.buttons[1] = { pressed: true, value: 1 };
      h.frame();
      pad.buttons[1] = { pressed: false, value: 0 };
      h.frame();
    }
    assert.equal(h.$('library-dialog').open, true, 'First Back closes only File names.');
    assert.equal(h.$('backup-set-filenames').open, false);
    assert.equal(h.$('backup-set-filenames').hidden, false);
    assert.equal(h.doc.activeElement.id, 'backup-set-filename-summary');
    assert.equal(h.$('backup-set-filename-list').children.length, 10);
    assert.equal(h.$('download-backup-game').href, downloadUrl);
    assert.equal((await fetchBlob(downloadUrl)).status, 200);
    assert.doesNotMatch(h.$('controller-ui-hint').textContent, /operation is still in progress/);
    if (exit === 'escape') {
      const event = new Event('cancel', { cancelable: true });
      if (h.$('library-dialog').dispatchEvent(event)) h.$('library-dialog').close();
      assert.equal(event.defaultPrevented, false);
    } else {
      pad.buttons[1] = { pressed: true, value: 1 };
      h.frame();
      pad.buttons[1] = { pressed: false, value: 0 };
      h.frame();
    }
    assert.equal(h.$('library-dialog').open, false, 'Second Back follows the dialog origin.');
    assert.equal(h.$('backup-set-filenames').hidden, true);
    assert.equal(h.$('backup-set-filenames').open, false);
    assert.equal(h.$('backup-set-filename-list').children.length, 0);
    await assert.rejects(fetchBlob(downloadUrl), /fetch failed/);
    assert.equal(h.rendered.paused, true);
    assert.deepEqual(authoritativeCheckpoint(h.rendered.run), before);
    assert.deepEqual(h.storage.map, stored);
    assert.deepEqual(h.errors, []);
  });

test('Title Settings Library cancel consumes filename detail before native dialog close and refocus', async (t) => {
  const h = await soloPage(t);
  h.$('shell-settings').focus();
  h.$('shell-settings').click();
  h.$('settings-tab-data').click();
  h.$('settings-saves').focus();
  h.$('settings-saves').click();
  [...h.$('library-dialog').querySelectorAll('button')]
    .find((node) => node.dataset.libraryPanel === 'saves')
    .click();
  assert.equal(await h.$('prepare-backup-set').onclick(), true);
  const dialog = h.$('library-dialog'),
    summary = h.$('backup-set-filename-summary'),
    before = authoritativeCheckpoint(h.rendered.run),
    stored = new Map(h.storage.map),
    cancelStates = [];
  let closes = 0;
  dialog.addEventListener('cancel', (event) => cancelStates.push(event.defaultPrevented));
  dialog.addEventListener('close', () => {
    closes++;
  });
  // A file input emits its own bubbling, non-cancelable cancel. The native
  // dialog close request below is a separate event with the dialog as target.
  h.$('backup-set-filenames').open = true;
  for (const id of ['save-file', 'pack-file']) {
    const input = h.$(id),
      status = h.$('backup-set-status').textContent;
    input.focus();
    input.dispatchEvent(new Event('cancel', { bubbles: true }));
    assert.equal(dialog.open, true);
    assert.equal(h.$('backup-set-filenames').open, true);
    assert.equal(h.$('backup-set-status').textContent, status);
    assert.equal(h.doc.activeElement, input);
    assert.equal(h.$('backup-set-files').children.length, 5);
  }
  assert.deepEqual(cancelStates, [false, false]);
  cancelStates.length = 0;
  // The browser owns native summary activation; retain its resulting open state.
  summary.focus();
  const first = new Event('cancel', { cancelable: true });
  if (dialog.dispatchEvent(first)) dialog.close();
  await Promise.resolve();
  assert.equal(first.bubbles, false, 'A native dialog cancel is cancellable, not bubbling.');
  assert.deepEqual(
    cancelStates,
    [true],
    'The existing Library listener consumes the first cancel.',
  );
  assert.equal(closes, 0);
  assert.equal(dialog.open, true);
  assert.equal(h.$('settings-dialog').open, true);
  assert.equal(h.$('backup-set-filenames').open, false);
  assert.equal(h.doc.activeElement === summary, true, h.doc.activeElement.id);
  assert.equal(h.$('backup-set-files').children.length, 5);
  const second = new Event('cancel', { cancelable: true });
  if (dialog.dispatchEvent(second)) dialog.close();
  await Promise.resolve();
  assert.deepEqual(cancelStates, [true, false]);
  assert.equal(closes, 1);
  assert.equal(dialog.open, false);
  assert.equal(h.$('settings-dialog').open, true);
  assert.equal(h.doc.activeElement.id, 'settings-saves');
  assert.deepEqual(authoritativeCheckpoint(h.rendered.run), before);
  assert.deepEqual(h.storage.map, stored);
  assert.deepEqual(h.errors, []);
});
