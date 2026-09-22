import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, SoloElement, settle } from './helpers/solo-dom.mjs';
import { captureOperationFocus } from '../ui/operation-focus.mjs';

// Native disabling immediately moves focus off the button. Keep this local:
// the shared minimal DOM deliberately does not claim browser focus semantics.
function nativeDisabled(element, onEnable = () => {}) {
  let disabled = element.disabled;
  Object.defineProperty(element, 'disabled', {
    configurable: true,
    get: () => disabled,
    set(value) {
      const was = disabled;
      disabled = value;
      if (value && element.ownerDocument.activeElement === element) {
        element.blur();
        // Native blur does not bubble, but window/document capture still observes it.
        element.emit('blur', { bubbles: false, relatedTarget: null });
      }
      if (was && !value) onEnable();
    },
  });
}
async function pending(t, { failure = false, onEnable } = {}) {
  const show = SoloElement.prototype.showModal;
  t.mock.method(SoloElement.prototype, 'showModal', function () {
    this.emit('beforetoggle', { oldState: 'closed', newState: 'open', bubbles: false });
    show.call(this);
  });
  const h = await soloPage(t, { titleScreen: true });
  // Model the actual Window identity, preserving this harness's style/Event stubs.
  Object.assign(h.win, h.doc.defaultView);
  h.doc.defaultView = h.win;
  h.$('shell-workshop').click();
  h.$('shell-library').click();
  h.doc.querySelector('[data-library-panel="packs"]').click();
  const root = h.$('library-dialog');
  await settle(() =>
    [...h.$('builtin-packs').querySelectorAll('button')].some(
      (node) => node.textContent === 'Install fieldcraft',
    ),
  );
  const opener = [...h.$('builtin-packs').querySelectorAll('button')].find(
    (node) => node.textContent === 'Install fieldcraft',
  );
  assert.equal(root.open, true);
  const original = globalThis.fetch;
  let finish,
    requested = false;
  const gate = new Promise((resolve) => {
    finish = resolve;
  });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === 'content/packs/fieldcraft.json') {
      requested = true;
      await gate;
      if (failure) throw new Error('Original chapter unavailable');
    }
    return original(url, options);
  });
  nativeDisabled(opener, () => onEnable?.(h));
  nativeDisabled(h.$('library-operation-cancel'));
  opener.focus();
  opener.click();
  await settle(() => requested);
  assert.equal(opener.disabled, true);
  assert.equal(
    h.doc.activeElement === h.$('library-operation-cancel'),
    true,
    'Cancel owns usable focus throughout preparation',
  );
  const complete = async () => {
    finish();
    await settle(() => !opener.disabled);
    await new Promise((resolve) => setImmediate(resolve));
    h.frame(0);
  };
  t.after(finish);
  return { h, opener, root, complete };
}
for (const failure of [false, true]) {
  test(`install ${failure ? 'error' : 'completion'} restores its still-owned actual button after native disable`, async (t) => {
    const { h, opener, root, complete } = await pending(t, { failure });
    const before = h.rendered.run;
    await complete();
    assert.equal(h.doc.activeElement === opener, true, 'Return to the exact initiating action');
    assert.equal(root.open, true);
    assert.equal(h.rendered.paused, true);
    assert.equal(h.rendered.run.tick, 0, 'Completion does not start a flight');
    assert.equal(h.rendered.run === before, true);
    const status = h.$('pack-status');
    assert.match(
      status.textContent,
      failure ? /Original chapter unavailable/ : /Validated and installed/,
    );
    if (!failure)
      assert.ok(
        [...h.$('installed-packs').querySelectorAll('button')].some((e) =>
          e.textContent.startsWith('Play '),
        ),
      );
  });
}
for (const decision of ['focus', 'blur', 'hidden', 'pagehide', 'close', 'new-dialog', 'body-key']) {
  test(`install completion does not reclaim focus after ${decision}, even after returning to BODY`, async (t) => {
    const { h, opener, root, complete } = await pending(t);
    if (decision === 'focus') {
      const back = root.querySelector('[data-close]');
      back.focus();
      back.blur();
    } else if (decision === 'blur') {
      h.win.emit('blur');
      h.win.emit('focus');
    } else if (decision === 'hidden') {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
      h.doc.hidden = false;
      h.doc.emit('visibilitychange');
    } else if (decision === 'pagehide') h.win.emit('pagehide', { persisted: true });
    else if (decision === 'close') {
      root.close();
      root.showModal();
    } else if (decision === 'new-dialog') {
      h.$('help-dialog').showModal();
      h.$('help-dialog').close();
    } else h.doc.body.emit('keydown', { key: 'Tab', code: 'Tab' });
    await complete();
    assert.equal(
      h.doc.activeElement === opener,
      false,
      'A completed operation cannot undo newer intent',
    );
  });
}
test('install enable callback choosing another control is not overwritten', async (t) => {
  const { h, opener, root, complete } = await pending(t, {
    onEnable(page) {
      page.$('library-dialog').querySelector?.('[data-close]')?.focus();
    },
  });
  await complete();
  assert.equal(h.doc.activeElement === opener, false);
  assert.equal(root.contains(h.doc.activeElement), true);
});
// Start on the usable Cancel control. Native interior Tab remains browser-owned;
// travel through a newer non-owned control before renewing explicit Cancel intent.
function tabToCancel(h, root) {
  const cancel = h.$('library-operation-cancel');
  assert.equal(h.doc.activeElement, cancel);
  const eligible = (node) => {
    if (node.disabled || node.closest('[hidden],[inert]')) return false;
    if (node.hasAttribute('tabindex') && Number(node.getAttribute('tabindex')) < 0) return false;
    for (
      let ancestor = node.parentElement;
      ancestor && ancestor !== root;
      ancestor = ancestor.parentElement
    )
      if (
        ancestor.tagName === 'DETAILS' &&
        !ancestor.open &&
        ancestor.querySelector('summary') !== node
      )
        return false;
    return true;
  };
  let left = false;
  const visited = new Set();
  const all = [...root.querySelectorAll('button,a,input,select,textarea,summary,[tabindex]')];
  for (let step = 0; step < all.length + 2; step++) {
    const active = h.doc.activeElement;
    const event = active.emit('keydown', { key: 'Tab', code: 'Tab' });
    if (!event.defaultPrevented) {
      const index = all.indexOf(active);
      for (let n = 1; n <= all.length; n++) {
        const next = all[(index + n) % all.length];
        if (eligible(next)) {
          next.focus();
          break;
        }
      }
    }
    const current = h.doc.activeElement;
    assert.ok(
      root.contains(current) && !current.disabled,
      'Native Tab stays on a usable dialog control',
    );
    current.emit('keyup', { key: 'Tab', code: 'Tab' });
    visited.add(current);
    if (current === cancel && left) {
      assert.ok(
        visited.has(h.$('library-operation-message')),
        'Native Tab reaches the readable operation message',
      );
      assert.ok(
        visited.has(root.querySelector('[data-close="library-dialog"]')),
        'Native Tab reaches Close before returning',
      );
      return cancel;
    }
    if (current !== cancel) left = true;
  }
  assert.fail('Native Tab must visit another action and return to Cancel');
}
test('explicit Library Cancel after a native Tab cycle renews return to the actual Install action', async (t) => {
  const { h, opener, root, complete } = await pending(t);
  const cancel = tabToCancel(h, root);
  cancel.click();
  assert.equal(h.doc.activeElement === opener, true);
  await complete();
  assert.equal(h.doc.activeElement === opener, true);
  assert.match(h.$('pack-status').textContent, /Cancelled/);
});
for (const interruption of ['background', 'closed-root', 'cleanup-focus', 'cleanup-blur']) {
  test(`fresh explicit Cancel cannot restore after ${interruption}`, async (t) => {
    const { h, opener, root, complete } = await pending(t, {
      onEnable(page) {
        if (interruption === 'cleanup-focus')
          [...page.$('library-dialog').querySelectorAll('summary')]
            .find((e) => e.textContent === 'Paste pack JSON')
            .focus();
        if (interruption === 'cleanup-blur') page.win.emit('blur');
      },
    });
    const cancel = tabToCancel(h, root),
      callback = cancel.onclick;
    if (interruption === 'background') {
      h.doc.focused = false;
      h.win.emit('blur');
    }
    if (interruption === 'closed-root') root.close();
    callback(); // A queued actual control handler must still respect current ownership.
    assert.equal(h.doc.activeElement === opener, false);
    await complete();
    assert.equal(h.doc.activeElement === opener, false);
  });
}
test('Cancel while actual pack commit is finishing remains detached and cannot restore focus', async (t) => {
  const { h, opener, complete } = await pending(t);
  const cancel = h.$('library-operation-cancel'),
    text = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(SoloElement.prototype),
      'textContent',
    );
  let stopped = false;
  Object.defineProperty(cancel, 'textContent', {
    configurable: true,
    get() {
      return text.get.call(this);
    },
    set(value) {
      text.set.call(this, value);
      if (value === 'Stop waiting' && !stopped) {
        stopped = true;
        queueMicrotask(() => {
          cancel.focus();
          cancel.click();
        });
      }
    },
  });
  await complete();
  assert.equal(stopped, true, 'The actual commit stage was reached before Stop waiting');
  assert.equal(h.doc.activeElement === opener, false);
  assert.match(h.$('pack-status').textContent, /Validated and installed/);
  assert.ok(
    [...h.$('installed-packs').querySelectorAll('button')].some((e) =>
      e.textContent.startsWith('Play '),
    ),
  );
});
test('fresh return intent refuses a target outside its captured dialog', async (t) => {
  const { h, opener, complete } = await pending(t);
  const cancel = h.$('library-operation-cancel'),
    outside = h.$('shell-featured');
  cancel.focus();
  const lease = captureOperationFocus(cancel, { restoreTo: outside });
  assert.equal(lease.restore(), false);
  assert.equal(h.doc.activeElement === outside, false);
  cancel.click();
  await complete();
  assert.equal(h.doc.activeElement === opener, true);
});
