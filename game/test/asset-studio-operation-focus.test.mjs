import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { createStudioOperations } from '../../authoring/asset-studio/operation.mjs';
import { captureStudioOperationFocus } from '../../authoring/asset-studio/operation-focus.mjs';

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function fixture() {
  const doc = new Document(),
    win = new Events();
  win.getComputedStyle = doc.defaultView.getComputedStyle;
  const region = doc.createElement('section'),
    opener = doc.createElement('button'),
    successor = doc.createElement('button'),
    other = doc.createElement('button'),
    cancelButton = doc.createElement('button'),
    target = doc.createElement('p');
  region.append(opener, successor);
  doc.body.append(region, other, cancelButton, target);
  let lease,
    epoch = 0;
  const operations = createStudioOperations({
    target,
    cancelButton,
    setBusy(busy, { restoreFocus = true } = {}) {
      if (busy) {
        lease?.cancel();
        const origin = doc.activeElement,
          ticket = ++epoch;
        lease = captureStudioOperationFocus(origin, {
          document: doc,
          window: win,
          cancelButton,
          isCurrent: () => epoch === ticket,
          resolveTarget: (eligible) => (eligible(origin) ? origin : successor),
        });
      }
      const returning = busy ? null : lease;
      if (!busy) lease = null;
      region.inert = busy;
      // Native inert/removal/disable effects are modeled at the DOM boundary.
      if (busy && region.contains(doc.activeElement)) doc.activeElement = doc.body;
      if (!restoreFocus) returning?.cancel();
      else returning?.restore();
    },
  });
  return { doc, win, region, opener, successor, other, cancelButton, target, operations };
}
for (const mutation of ['disabled', 'removed'])
  test(`settled ${mutation} trigger returns to its logical enabled successor exactly once`, async () => {
    const f = fixture();
    f.opener.focus();
    await f.operations.run('Mutating', () => {
      if (mutation === 'disabled') f.opener.disabled = true;
      else f.opener.remove();
    });
    assert.equal(f.doc.activeElement, f.successor);
    assert.equal(f.operations.busy, false);
    assert.equal(f.cancelButton.hidden, true);
    assert.equal(
      [...f.doc.captureListeners.values()].reduce((n, rows) => n + rows.size, 0),
      0,
    );
  });

for (const intent of [
  'focus',
  'pointer',
  'keyboard',
  'window blur',
  'hidden',
  'pagehide',
  'dialog',
])
  test(`${intent} permanently retires delayed completion focus even if focus later becomes empty`, async () => {
    const f = fixture(),
      gate = deferred();
    f.opener.focus();
    const work = f.operations.run('Waiting', async () => {
      await gate.promise;
      f.opener.disabled = true;
    });
    if (intent === 'focus') f.other.focus();
    if (intent === 'pointer') f.other.emit('pointerdown');
    if (intent === 'keyboard') f.other.emit('keydown', { key: 'Tab' });
    if (intent === 'window blur') f.win.emit('blur');
    if (intent === 'hidden') {
      f.doc.hidden = true;
      f.doc.emit('visibilitychange');
      f.doc.hidden = false;
    }
    if (intent === 'pagehide') f.win.emit('pagehide', { persisted: true });
    if (intent === 'dialog') {
      const dialog = f.doc.createElement('dialog');
      f.doc.body.append(dialog);
      dialog.emit('beforetoggle', { newState: 'open' });
    }
    f.doc.activeElement = f.doc.body;
    gate.resolve();
    await work;
    assert.equal(f.doc.activeElement, f.doc.body);
  });

for (const targetState of [
  'hidden',
  'disabled',
  'inert',
  'removed',
  'closed details',
  'CSS hidden',
])
  test(`an unavailable ${targetState} successor never receives focus`, async () => {
    const f = fixture();
    f.opener.focus();
    await f.operations.run('Mutating', () => {
      f.opener.disabled = true;
      if (targetState === 'hidden') f.successor.hidden = true;
      if (targetState === 'disabled') f.successor.disabled = true;
      if (targetState === 'inert') f.successor.inert = true;
      if (targetState === 'removed') f.successor.remove();
      if (targetState === 'CSS hidden') f.successor.style.display = 'none';
      if (targetState === 'closed details') {
        const details = f.doc.createElement('details');
        f.region.append(details);
        details.append(f.successor);
      }
    });
    assert.equal(f.doc.activeElement, f.doc.body);
  });

test('element blur preserves ownership, but programmatic work without an initiating focus does not acquire it', async () => {
  const f = fixture();
  await f.operations.run('Automatic work', () => {
    f.opener.disabled = true;
  });
  assert.equal(f.doc.activeElement, f.doc.body);
  f.opener.disabled = false;
  f.opener.focus();
  await f.operations.run('Focused work', () => {
    f.win.emit('blur', { target: f.opener });
  });
  assert.equal(f.doc.activeElement, f.opener);
});

for (const cancelWith of ['button', 'Escape'])
  test(`${cancelWith} cancellation returns owned focus and an obsolete completion cannot disturb a newer operation`, async () => {
    const f = fixture(),
      old = deferred(),
      next = deferred();
    f.opener.focus();
    const first = f.operations.run('Old', async (task) => {
      await old.promise;
      task.check();
    });
    if (cancelWith === 'button') {
      f.cancelButton.focus();
      f.cancelButton.onclick();
    } else {
      f.doc.body.emit('keydown', { key: 'Escape' });
      f.operations.cancel();
    }
    assert.equal(f.doc.activeElement, f.opener);
    f.successor.focus();
    const second = f.operations.run('New', async (task) => {
      await next.promise;
      task.check();
    });
    old.resolve();
    await first;
    assert.equal(f.operations.busy, true);
    assert.equal(f.doc.activeElement, f.doc.body);
    next.resolve();
    await second;
    assert.equal(f.doc.activeElement, f.successor);
  });

for (const ending of ['detached save', 'dispose'])
  test(`${ending} never restores focus at its later settlement`, async () => {
    const f = fixture(),
      gate = deferred();
    f.opener.focus();
    const work = f.operations.run('Saving', async (task) => {
      task.commit();
      await gate.promise;
      task.check();
    });
    if (ending === 'detached save') {
      f.cancelButton.focus();
      f.cancelButton.onclick();
      f.doc.activeElement = f.doc.body;
    } else f.operations.dispose();
    gate.resolve();
    await work;
    assert.equal(f.doc.activeElement, f.doc.body);
  });

test('a resolver that hands focus or operation ownership elsewhere cannot return an older target', () => {
  for (const newer of ['focus', 'operation']) {
    const f = fixture();
    let current = true;
    f.opener.focus();
    const lease = captureStudioOperationFocus(f.opener, {
      document: f.doc,
      window: f.win,
      cancelButton: f.cancelButton,
      isCurrent: () => current,
      resolveTarget: () => {
        if (newer === 'focus') f.other.focus();
        else current = false;
        return f.successor;
      },
    });
    f.doc.activeElement = f.doc.body;
    assert.equal(lease.restore(), false);
    assert.equal(f.doc.activeElement, newer === 'focus' ? f.other : f.doc.body);
  }
});
