import test from 'node:test';
import assert from 'node:assert/strict';
import { BACKUP_FORMAT } from '../backup.mjs';
import { emptyLibrary } from '../library.mjs';
import { emptyPackLibrary } from '../packs.mjs';
import { soloPage, SoloElement, settle } from './helpers/solo-dom.mjs';

function nativeDisable(element) {
  let disabled = element.disabled;
  Object.defineProperty(element, 'disabled', {
    configurable: true,
    get: () => disabled,
    set(value) {
      disabled = value;
      if (value && element.ownerDocument.activeElement === element) {
        element.blur();
        element.emit('blur', { bubbles: false, relatedTarget: null });
      }
    },
  });
}
async function prepare(t, onHandoff = null) {
  const show = SoloElement.prototype.showModal;
  t.mock.method(SoloElement.prototype, 'showModal', function () {
    this.emit('beforetoggle', { oldState: 'closed', newState: 'open', bubbles: false });
    show.call(this);
  });
  const h = await soloPage(t, { titleScreen: true });
  Object.assign(h.win, h.doc.defaultView);
  h.doc.defaultView = h.win;
  h.$('shell-workshop').click();
  h.$('shell-library').click();
  h.doc.querySelector('[data-library-panel="saves"]').click();
  const root = h.$('library-dialog'),
    opener = h.$('save-file'),
    cancel = h.$('library-operation-cancel');
  const before = new Map(h.storage.map);
  let resolve,
    reads = 0;
  const gate = new Promise((done) => {
    resolve = done;
  });
  const body = JSON.stringify({
    format: BACKUP_FORMAT,
    library: emptyLibrary(),
    packs: emptyPackLibrary(),
    session: null,
  });
  opener.files = [
    {
      size: body.length,
      text: async () => {
        reads++;
        await gate;
        return body;
      },
    },
  ];
  nativeDisable(opener);
  nativeDisable(cancel);
  if (onHandoff) cancel.addEventListener('focusin', () => onHandoff(h, root), { once: true });
  opener.focus();
  const operation = opener.onchange();
  t.after(resolve);
  return { h, root, opener, cancel, before, operation, release: resolve, reads: () => reads };
}

test('backup preparation synchronously gives Cancel usable focus and explicit Cancel returns to Load', async (t) => {
  const { h, opener, cancel, operation, release, before } = await prepare(t);
  assert.equal(h.doc.activeElement, cancel, 'Preparation must not strand focus on BODY');
  assert.equal(cancel.disabled || cancel.hidden, false);
  assert.equal(opener.disabled, true);
  assert.equal(cancel.textContent, 'Cancel operation');
  cancel.click();
  assert.equal(h.doc.activeElement, opener);
  release();
  await operation;
  assert.equal(h.doc.activeElement, opener);
  assert.deepEqual(h.storage.map, before);
});

test('backup preparation keeps focus through the Keep decision and restores its actual Load opener', async (t) => {
  const { h, opener, cancel, operation, release, before } = await prepare(t);
  assert.equal(h.doc.activeElement, cancel);
  release();
  await settle(() => !h.$('library-operation-confirm').hidden);
  assert.equal(h.doc.activeElement, cancel);
  assert.equal(cancel.textContent, 'Keep current data');
  cancel.click();
  await operation;
  assert.equal(h.doc.activeElement, opener);
  assert.deepEqual(h.storage.map, before);
});

test('backup review does not reclaim preparation focus from a newer Close choice', async (t) => {
  const { h, root, cancel, operation, release, before } = await prepare(t);
  assert.equal(h.doc.activeElement, cancel);
  const close = root.querySelector('[data-close]');
  close.focus();
  release();
  await settle(() => !h.$('library-operation-confirm').hidden);
  assert.equal(h.doc.activeElement, close);
  root.emit('cancel', { cancelable: true });
  await operation;
  assert.equal(h.doc.activeElement, close);
  assert.deepEqual(h.storage.map, before);
});

test('a reentrant Close during the initial Cancel handoff retires work before it reads or locks controls', async (t) => {
  const { h, root, opener, operation, release, reads, before } = await prepare(t, (_, dialog) =>
    dialog.close(),
  );
  await operation;
  assert.equal(root.open, false);
  assert.equal(reads(), 0, 'A retired operation must not invoke its asynchronous work');
  assert.equal(opener.disabled, false, 'Retired setup must not re-lock restored controls');
  assert.equal(h.$('library-operation-cancel').hidden, true);
  assert.deepEqual(h.storage.map, before);
  release();
});

test('a native Close with a queued close event retires preparation before reading or re-locking controls', async (t) => {
  let dispatchClose;
  const { h, root, opener, cancel, operation, release, reads, before } = await prepare(
    t,
    (_, dialog) => {
      dialog.emit('beforetoggle', { oldState: 'open', newState: 'closed', bubbles: false });
      dialog.open = false;
      dialog.removeAttribute('open');
      dispatchClose = () => dialog.emit('close', { bubbles: false });
    },
  );
  const initial = {
    open: root.open,
    reads: reads(),
    disabled: opener.disabled,
    hidden: cancel.hidden,
  };
  dispatchClose();
  release();
  await operation;
  assert.equal(initial.open, false);
  assert.equal(initial.reads, 0, 'Native close retires preparation before its queued close event');
  assert.equal(initial.disabled, false, 'Closed dialog controls must not be re-locked');
  assert.equal(initial.hidden, true);
  assert.deepEqual(h.storage.map, before);
});
