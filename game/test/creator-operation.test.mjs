import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Element } from './helpers/couch-dom.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { runCreatorOperation } from '../creator/operation.mjs';
import { focusCreatorInstalledPlay } from '../creator/player-menu-focus.mjs';
import { attachCreatorReviewReading } from '../creator/review-reading.mjs';

function fixture(t, { controller = true } = {}) {
  const doc = new Document(),
    win = doc.defaultView;
  doc.parentNode = win;
  const node = (tag, id) => {
    const value = new Element(doc, tag, { id });
    doc.body.append(value);
    return value;
  };
  const sections = node('button', 'sections'),
    opener = node('button', 'install'),
    cancel = node('button', 'cancel'),
    play = node('a', 'play'),
    other = node('button', 'other');
  play.href = './player.html?edition=exact';
  play.setAttribute('href', play.href);
  play.hidden = cancel.hidden = true;
  const navigation = attachControllerNavigation({
    document: doc,
    keyboard: true,
    getScope: () => 'authoring',
    getRoot: () => doc.body,
    getDefaultFocus: () => sections,
  });
  t.after(() => navigation.destroy());
  opener.focus();
  if (controller) navigation.engage();
  let operationController,
    busy = false,
    installed = false,
    successFocus = 0;
  const errors = [],
    focusEvents = [];
  doc.addEventListener('focusin', (event) =>
    focusEvents.push({ id: event.target.id, disabled: event.target.disabled, busy }),
  );
  const run = (action, options = {}) =>
    runCreatorOperation(action, {
      document: doc,
      cancel,
      opener,
      onStart: (value) => {
        operationController = value;
        busy = true;
        opener.disabled = true;
        cancel.hidden = false;
        // Chromium may move native focus to body on disabling an action.
        if (doc.activeElement === opener) doc.activeElement = doc.body;
      },
      onFinish: () => {
        busy = false;
        opener.disabled = installed;
        cancel.hidden = true;
        if (doc.activeElement === cancel) doc.activeElement = doc.body;
      },
      onError: (error) => errors.push(error),
      onSuccessFocus: ({ opener, ownedFocus }) => {
        successFocus++;
        focusCreatorInstalledPlay({ document: doc, opener, ownedFocus, play, wasFocused: true });
      },
      ...options,
    });
  cancel.onclick = () => operationController.abort();
  return {
    doc,
    win,
    node,
    sections,
    opener,
    cancel,
    play,
    other,
    navigation,
    run,
    errors,
    focusEvents,
    installed() {
      installed = true;
      play.hidden = false;
    },
    retireReview() {
      installed = true;
    },
    successFocus: () => successFocus,
    busy: () => busy,
  };
}

for (const controller of [false, true])
  test(`${controller ? 'controller' : 'keyboard'} async install owns Cancel across navigation frames and returns to enabled Play after finally`, async (t) => {
    const h = fixture(t, { controller });
    let release;
    const waiting = new Promise((resolve) => {
      release = resolve;
    });
    const pending = h.run(async () => {
      await waiting;
      h.installed();
    });
    assert.equal(h.doc.activeElement, h.cancel);
    for (let frame = 0; frame < 4; frame++) h.navigation.handle({});
    assert.equal(
      h.doc.activeElement,
      h.cancel,
      'disabled Install must not send a controller to Sections',
    );
    release();
    await pending;
    assert.equal(h.doc.activeElement, h.play);
    assert.equal(h.busy(), false);
    assert.equal(h.opener.disabled, true);
    assert.equal(h.cancel.hidden, true);
    assert.equal(h.successFocus(), 1);
    assert.equal(
      h.focusEvents.some(({ disabled }) => disabled),
      false,
    );
    assert.deepEqual(h.focusEvents.at(-1), { id: 'play', disabled: false, busy: false });
  });

test('validation failure returns the enabled opener and leaves no success handoff', async (t) => {
  const h = fixture(t),
    failure = new Error('Describe your picture.');
  await h.run(async () => {
    h.navigation.handle({});
    throw failure;
  });
  assert.equal(h.doc.activeElement, h.opener);
  assert.deepEqual(h.errors, [failure]);
  assert.equal(h.play.hidden, true);
  assert.equal(h.successFocus(), 0);
  assert.equal(h.busy(), false);
});

for (const ending of ['failure', 'cancel'])
  test(`an installation ${ending} returns to Approve after its one-use review retires`, async (t) => {
    const h = fixture(t),
      approve = h.node('button', 'approve');
    let release;
    const pending = h.run(
      async (signal) => {
        h.retireReview();
        await new Promise((resolve) => {
          release = resolve;
        });
        if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
        throw new Error('Storage write failed');
      },
      { restoreTo: approve },
    );
    h.navigation.handle({});
    assert.equal(h.doc.activeElement, h.cancel);
    if (ending === 'cancel') h.cancel.click();
    release();
    await pending;
    assert.equal(h.opener.disabled, true);
    assert.equal(h.doc.activeElement, approve);
    assert.equal(h.successFocus(), 0);
    assert.equal(h.busy(), false);
    assert.equal(h.errors[0].name, ending === 'cancel' ? 'AbortError' : 'Error');
  });

test('Cancel aborts the pending operation and a late result cannot advance to Play', async (t) => {
  const h = fixture(t);
  let release, signal;
  const pending = h.run(async (value) => {
    signal = value;
    await new Promise((resolve) => {
      release = resolve;
    });
  });
  h.navigation.handle({ confirm: true });
  assert.equal(signal.aborted, true);
  assert.equal(h.doc.activeElement, h.cancel);
  release();
  await pending;
  assert.equal(h.doc.activeElement, h.opener);
  assert.equal(h.successFocus(), 0);
  assert.equal(h.busy(), false);
});

for (const loss of ['new focus', 'pointer elsewhere', 'blur', 'hidden', 'pagehide', 'disconnected'])
  test(`${loss} permanently retires async focus ownership even if Cancel becomes focused again`, async (t) => {
    const h = fixture(t);
    let release;
    const pending = h.run(async () => {
      await new Promise((resolve) => {
        release = resolve;
      });
      h.installed();
    });
    if (loss === 'new focus') h.other.focus();
    else if (loss === 'pointer elsewhere') h.other.emit('pointerdown');
    else if (loss === 'blur') h.win.emit('blur');
    else if (loss === 'hidden') {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
      h.doc.hidden = false;
    } else h.win.emit(loss === 'disconnected' ? 'gamepaddisconnected' : 'pagehide');
    h.cancel.focus();
    release();
    await pending;
    assert.equal(h.successFocus(), 0);
    assert.notEqual(h.doc.activeElement, h.play);
    assert.equal(h.busy(), false);
  });

test('an operation ending after a newer control is chosen leaves that exact control focused', async (t) => {
  const h = fixture(t);
  let release;
  const pending = h.run(async () => {
    await new Promise((resolve) => {
      release = resolve;
    });
    h.installed();
  });
  h.other.focus();
  release();
  await pending;
  assert.equal(h.doc.activeElement, h.other);
  assert.equal(h.successFocus(), 0);
});

for (const origin of ['different focused control', 'unowned delayed callback'])
  test(`${origin} cannot borrow another interaction's focus`, async (t) => {
    const h = fixture(t, { controller: false });
    h.other.focus();
    await h.run(
      async () => {
        assert.equal(h.doc.activeElement, h.other);
        h.installed();
      },
      origin === 'unowned delayed callback' ? { opener: undefined } : {},
    );
    assert.equal(h.doc.activeElement, h.other);
    assert.equal(h.successFocus(), 0);
    assert.equal(
      h.focusEvents.some(({ id }) => id === 'cancel'),
      false,
    );
  });

for (const input of ['controller', 'keyboard'])
  test(`${input} reads every review row and Back restores the entry without approving`, (t) => {
    const h = fixture(t, { controller: input === 'controller' }),
      card = h.node('article', 'card'),
      heading = h.doc.createElement('h3'),
      details = h.doc.createElement('div');
    heading.textContent = '1. Dawn Signal';
    details.textContent = 'Picture, map and verified route. Final validation line.';
    const { entry, region, done } = attachCreatorReviewReading({
      card,
      heading,
      content: [details],
      index: 0,
      navigation: h.navigation,
    });
    region.clientHeight = 100;
    region.scrollHeight = 400;
    let approvals = 0;
    const approve = h.node('button', 'approve');
    approve.onclick = () => approvals++;
    entry.focus();
    entry.click();
    assert.equal(h.navigation.readingState().regionId, region.id);
    assert.equal(h.doc.activeElement, region);
    for (let step = 0; step < 10; step++) {
      if (input === 'controller') h.navigation.handle({ direction: 'down' });
      else region.emit('keydown', { key: 'ArrowDown' });
    }
    assert.equal(region.scrollTop, 300);
    if (input === 'controller') h.navigation.handle({ back: true });
    else region.emit('keydown', { key: 'Escape' });
    assert.equal(h.navigation.readingState(), null);
    assert.equal(h.doc.activeElement, entry);
    assert.equal(approvals, 0);
    assert.equal(region.getAttribute('aria-labelledby'), heading.id);
    done.focus();
    done.click();
    assert.equal(h.doc.activeElement, entry, 'the visible Back action also works outside reading');
    assert.equal(approvals, 0);
  });
