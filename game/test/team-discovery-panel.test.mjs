import test from 'node:test';
import assert from 'node:assert/strict';
import { attachTeamDiscovery } from '../couch/team-discovery.mjs';
import { Document, Element } from './helpers/couch-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';

// Real discovery panel with a finite native-dialog/focus boundary. Host input
// routing, actual artwork preparation, simulation and physical devices are separate.
function entries() {
  const levels = Object.freeze([
    Object.freeze({ id: 'first-connection', name: 'First Connection' }),
    Object.freeze({ id: 'relay-yard', name: 'Relay Yard' }),
  ]);
  const pack = Object.freeze({ id: 'team-starter', name: 'Team Starter', levels });
  return Object.freeze(
    levels.map((level, index) =>
      Object.freeze({
        key: `starter/${level.id}`,
        title: level.name,
        packName: pack.name,
        sourceLabel: 'Included arenas',
        goal: index ? 'Secure the relay core' : 'Reveal the field together',
        levelId: level.id,
        level,
        pack,
        artworkSource: 'Approved field-kit artwork',
      }),
    ),
  );
}

function held(t) {
  let resolve, reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  t.after(() => resolve(false));
  return { promise, resolve, reject };
}

function fixture(t, options = {}) {
  const doc = new Document();
  const previewDraws = [];
  doc.createElement = (tag) => {
    const element = new Element(doc, tag);
    let disabled = element.disabled;
    Object.defineProperty(element, 'disabled', {
      get: () => disabled,
      set(value) {
        disabled = !!value;
        if (disabled && doc.activeElement === element) doc.body.focus();
      },
    });
    if (options.preparePreview && tag === 'canvas')
      element.getContext = () => ({
        drawImage: (...args) => previewDraws.push(args),
        fillRect() {},
      });
    return element;
  };
  const dialog = doc.createElement('dialog'),
    list = doc.createElement('div'),
    status = doc.createElement('p'),
    back = doc.createElement('button'),
    cancel = doc.createElement('button'),
    opener = doc.createElement('button'),
    otherOpener = doc.createElement('button'),
    destination = doc.createElement('button');
  opener.textContent = 'Choose a Team arena';
  otherOpener.textContent = 'Choose from Pause';
  destination.textContent = 'Team board';
  back.textContent = 'Back';
  cancel.textContent = 'Cancel preparation';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  // The shipped dialog places its header Back before the card list. Native
  // showModal therefore focuses Back before the panel chooses its primary.
  dialog.append(back, list, status, cancel);
  let preview;
  if (options.preparePreview) {
    preview = {
      panel: doc.createElement('section'),
      canvas: doc.createElement('canvas'),
      title: doc.createElement('h3'),
      status: doc.createElement('p'),
      retry: doc.createElement('button'),
    };
    preview.panel.hidden = true;
    preview.retry.hidden = true;
    preview.panel.append(preview.title, preview.canvas, preview.status, preview.retry);
    dialog.append(preview.panel);
  }
  doc.body.append(opener, otherOpener, destination, dialog);
  dialog.hidden = true;
  dialog.showModal = () => {
    dialog.open = true;
    dialog.hidden = false;
    dialog.setAttribute('open', '');
    dialog.querySelector('button:not(:disabled)')?.focus();
  };
  dialog.close = () => {
    if (!dialog.open) return;
    dialog.open = false;
    dialog.hidden = true;
    dialog.removeAttribute('open');
    if (dialog.contains(doc.activeElement)) doc.body.focus();
    dialog.emit('close', { bubbles: false });
  };
  let available = options.entries ?? entries(),
    allowed = true,
    reads = 0,
    opened = 0,
    closed = 0;
  const calls = [];
  const panel = attachTeamDiscovery({
    document: doc,
    dialog,
    list,
    status,
    back,
    cancel,
    getEntries: () => {
      reads++;
      return available;
    },
    canOpen: () => allowed,
    preparePreview: options.preparePreview,
    preview,
    activate(row, operation) {
      calls.push({ row, operation });
      return options.activate ? options.activate(row, operation) : Promise.resolve(false);
    },
    onOpen: () => {
      opened++;
    },
    onClose: () => {
      closed++;
    },
  });
  t.after(() => panel.dispose());
  return {
    doc,
    dialog,
    list,
    status,
    back,
    cancel,
    opener,
    otherOpener,
    destination,
    panel,
    calls,
    previewDraws,
    cards: () => list.querySelectorAll('.team-discovery-play'),
    setEntries(value) {
      available = value;
    },
    allow(value) {
      allowed = value;
    },
    get entries() {
      return available;
    },
    get reads() {
      return reads;
    },
    get opened() {
      return opened;
    },
    get closed() {
      return closed;
    },
  };
}

function enter(button) {
  button.focus();
  const event = button.emit('keydown', { key: 'Enter', code: 'Enter', repeat: false });
  // Native button activation only; keyboard/controller routing belongs to the host.
  if (!event.defaultPrevented) button.click();
  button.emit('keyup', { key: 'Enter', code: 'Enter' });
}
function tap(button) {
  button.emit('pointerdown', { pointerId: 1, pointerType: 'touch' });
  button.click();
  button.emit('pointerup', { pointerId: 1, pointerType: 'touch' });
}
const ready = (h) =>
  waitFor(() => h.status.dataset.state === 'ready' && !h.cards().some((card) => card.disabled));

test('one code-owned snapshot supplies exact immutable row, level and pack identities for Play', async (t) => {
  const h = fixture(t),
    original = h.entries;
  h.allow(false);
  h.panel.open(h.opener);
  assert.equal(h.panel.isOpen(), false);
  assert.equal(h.reads, 0);
  assert.equal(h.opened, 0);
  h.allow(true);
  h.panel.open(h.opener);
  assert.equal(h.panel.isOpen(), true);
  assert.equal(h.reads, 1);
  assert.equal(h.opened, 1);
  assert.equal(h.cards().length, 2);
  assert.equal(h.panel.primary(), h.cards()[0]);
  assert.equal(h.doc.activeElement, h.panel.primary());
  for (const row of original) {
    assert.ok(h.list.textContent.includes(row.title));
    assert.ok(h.list.textContent.includes(row.packName));
    assert.ok(h.list.textContent.includes(row.sourceLabel));
    assert.ok(h.list.textContent.includes(row.goal));
  }
  assert.ok(h.cards()[1].textContent.includes(`Play ${original[1].title}`));
  h.setEntries(Object.freeze([original[0]]));
  enter(h.cards()[1]);
  await ready(h);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].row, original[1]);
  assert.equal(h.calls[0].row.pack, original[1].pack);
  assert.equal(h.calls[0].row.level, original[1].level);
  assert.equal(h.reads, 1, 'Activation uses its visit snapshot without a second lookup.');
  assert.equal(h.entries.length, 1, 'External replacement does not mutate the retained snapshot.');
  h.panel.close();
  assert.equal(h.doc.activeElement, h.opener);
  h.panel.open(h.otherOpener);
  assert.equal(h.reads, 2);
  assert.equal(h.cards().length, 1);
});

test('pending Play acknowledges immediately, disables other cards and closes only after accepted activation', async (t) => {
  const gate = held(t);
  const h = fixture(t, {
    activate: async () => {
      await gate.promise;
      h.destination.focus();
      return true;
    },
  });
  h.panel.open(h.opener);
  enter(h.panel.primary());
  await waitFor(() => h.calls.length === 1);
  const { operation } = h.calls[0];
  assert.equal(h.status.dataset.state, 'busy');
  assert.ok(h.cards().every((card) => card.disabled));
  assert.equal(h.back.disabled, false);
  assert.equal(h.cancel.disabled, false);
  assert.equal(h.cancel.hidden, false);
  assert.equal(h.doc.activeElement, h.cancel);
  assert.equal(operation.isCurrent(), true);
  operation.onStatus('Preparing reviewed relay-yard artwork…');
  assert.equal(h.status.textContent, 'Preparing reviewed relay-yard artwork…');
  tap(h.cards()[1]);
  assert.equal(h.calls.length, 1, 'Disabled cards cannot start a competing activation.');
  assert.equal(h.panel.isOpen(), true);
  h.allow(false);
  gate.resolve(true);
  await waitFor(() => !h.panel.isOpen());
  assert.equal(h.closed, 1);
  assert.equal(h.doc.activeElement, h.destination, 'Success does not restore the old opener.');
  assert.equal(
    operation.signal.aborted,
    false,
    'Accepted host preparation is not cancelled by closing.',
  );
});

test('touch Stay keeps the selected card ready and restores its focus without activating another arena', async (t) => {
  const gate = held(t),
    h = fixture(t, { activate: () => gate.promise });
  h.panel.open(h.opener);
  const selected = h.cards()[1];
  tap(selected);
  await waitFor(() => h.calls.length === 1);
  assert.equal(h.doc.activeElement, h.cancel);
  gate.resolve(false);
  await ready(h);
  assert.equal(h.panel.isOpen(), true);
  assert.equal(h.closed, 0);
  assert.equal(h.doc.activeElement, selected);
  assert.equal(h.calls[0].row, h.entries[1]);
  assert.match(h.status.textContent, /kept|stay|current|ready|unchanged/i);
  h.panel.close();
  h.panel.open(h.otherOpener);
  assert.equal(h.panel.primary().textContent, selected.textContent);
  assert.equal(h.doc.activeElement, h.panel.primary());
  h.panel.close();
  const nativeOpen = h.dialog.showModal;
  h.dialog.showModal = () => {
    nativeOpen();
    // Model a synchronous newer focus choice during the native open boundary.
    h.cards()[0].focus();
  };
  h.panel.open(h.opener);
  assert.equal(h.panel.primary().textContent, selected.textContent);
  assert.equal(h.doc.activeElement, h.cards()[0], 'A newer deliberate card focus is not stolen.');
});

test('Stay completion respects a newer pointer focus on Back', async (t) => {
  const gate = held(t),
    h = fixture(t, { activate: () => gate.promise });
  h.panel.open(h.opener);
  enter(h.panel.primary());
  await waitFor(() => h.calls.length === 1);
  h.back.emit('pointerdown', { pointerId: 1, pointerType: 'touch' });
  h.back.focus();
  gate.resolve(false);
  await ready(h);
  assert.equal(h.doc.activeElement, h.back);
  assert.equal(h.panel.isOpen(), true);
  assert.equal(h.closed, 0);
});

test('Cancel aborts an unresolved activation immediately and returns to its reusable selected card', async (t) => {
  const gate = held(t),
    h = fixture(t, { activate: () => gate.promise });
  h.panel.open(h.opener);
  const selected = h.cards()[1];
  enter(selected);
  await waitFor(() => h.calls.length === 1);
  const { operation } = h.calls[0];
  enter(h.cancel);
  assert.equal(operation.signal.aborted, true);
  assert.equal(operation.isCurrent(), false);
  assert.equal(h.status.dataset.state, 'ready');
  assert.match(h.status.textContent, /cancel/i);
  assert.ok(h.cards().every((card) => !card.disabled));
  assert.equal(h.cancel.hidden, true);
  assert.equal(h.doc.activeElement, selected);
  assert.equal(h.panel.isOpen(), true);
  const message = h.status.textContent;
  operation.onStatus('Stale preparation message');
  gate.resolve(true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.status.textContent, message);
  assert.equal(h.doc.activeElement, selected);
  assert.equal(h.closed, 0);
});

test('host cancellation during foreground loss leaves focus ownership with the host', async (t) => {
  const gate = held(t),
    h = fixture(t, { activate: () => gate.promise });
  h.panel.open(h.opener);
  enter(h.panel.primary());
  await waitFor(() => h.calls.length === 1);
  h.destination.focus();
  h.doc.focused = false;
  h.panel.cancel();
  assert.equal(h.calls[0].operation.signal.aborted, true);
  assert.equal(h.status.dataset.state, 'ready');
  assert.equal(h.doc.activeElement, h.destination);
  assert.equal(h.panel.isOpen(), true);
  gate.resolve(false);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.doc.activeElement, h.destination);
  h.doc.focused = true;
});

test('Back aborts preparation and returns to the actual opener', async (t) => {
  const gate = held(t),
    h = fixture(t, { activate: () => gate.promise });
  h.panel.open(h.otherOpener);
  enter(h.panel.primary());
  await waitFor(() => h.calls.length === 1);
  enter(h.back);
  assert.equal(h.calls[0].operation.signal.aborted, true);
  assert.equal(h.panel.isOpen(), false);
  assert.equal(h.doc.activeElement, h.otherOpener);
  assert.equal(h.closed, 1);
  gate.resolve(true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.doc.activeElement, h.otherOpener);
  assert.equal(h.closed, 1);
});

test('closing and reopening retires old completion, status and focus authority', async (t) => {
  const old = held(t),
    current = held(t);
  let activations = 0;
  const h = fixture(t, { activate: () => (++activations === 1 ? old.promise : current.promise) });
  h.panel.open(h.opener);
  enter(h.panel.primary());
  await waitFor(() => h.calls.length === 1);
  const first = h.calls[0].operation;
  h.panel.close();
  h.panel.open(h.otherOpener);
  const selected = h.cards()[1];
  enter(selected);
  await waitFor(() => h.calls.length === 2);
  const second = h.calls[1].operation;
  second.onStatus('Current arena preparation');
  const focus = h.doc.activeElement;
  first.onStatus('Obsolete arena preparation');
  old.resolve(true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(first.signal.aborted, true);
  assert.equal(first.isCurrent(), false);
  assert.equal(second.isCurrent(), true);
  assert.equal(h.panel.isOpen(), true);
  assert.equal(h.status.textContent, 'Current arena preparation');
  assert.equal(h.status.dataset.state, 'busy');
  assert.equal(h.doc.activeElement, focus);
  assert.equal(h.closed, 1);
  current.resolve(false);
  await ready(h);
  assert.equal(h.doc.activeElement, selected);
  h.panel.close();
  assert.equal(h.doc.activeElement, h.otherOpener);
});

test('failed preparation keeps the catalogue open and allows a deliberate retry', async (t) => {
  let tries = 0;
  const h = fixture(t, {
    activate: async () => {
      if (++tries === 1) throw new Error('Reviewed artwork could not be decoded.');
      return true;
    },
  });
  h.panel.open(h.opener);
  const selected = h.panel.primary(),
    original = h.entries;
  enter(selected);
  await waitFor(() => h.status.dataset.state === 'error');
  assert.equal(h.panel.isOpen(), true);
  assert.equal(h.closed, 0);
  assert.ok(h.cards().every((card) => !card.disabled));
  assert.match(h.status.textContent, /could not prepare|preparation failed/i);
  assert.match(h.status.textContent, /retry|again/i);
  assert.equal(h.doc.activeElement, selected);
  assert.equal(h.entries, original);
  enter(selected);
  await waitFor(() => !h.panel.isOpen());
  assert.equal(tries, 2);
  assert.equal(h.calls[0].row, h.calls[1].row);
  assert.equal(h.closed, 1);
});

test('an empty visit has a readable ready state and a working Back target', (t) => {
  const h = fixture(t, { entries: Object.freeze([]) });
  h.panel.open(h.opener);
  assert.equal(h.cards().length, 0);
  assert.equal(h.status.dataset.state, 'ready');
  assert.ok(h.status.textContent.trim());
  assert.equal(h.panel.primary(), h.back);
  assert.equal(h.doc.activeElement, h.back);
  enter(h.back);
  assert.equal(h.panel.isOpen(), false);
  assert.equal(h.doc.activeElement, h.opener);
});

test('synchronous abort can open a new visit and preparation without old cleanup changing its controls', async (t) => {
  const old = held(t),
    current = held(t);
  let activations = 0;
  const h = fixture(t, { activate: () => (++activations === 1 ? old.promise : current.promise) });
  h.panel.open(h.opener);
  enter(h.panel.primary());
  await waitFor(() => h.calls.length === 1);
  const first = h.calls[0].operation;
  first.signal.addEventListener(
    'abort',
    () => {
      h.panel.close();
      h.panel.open(h.otherOpener);
      enter(h.cards()[1]);
    },
    { once: true },
  );
  h.panel.cancel();
  assert.equal(h.calls.length, 2, 'Abort listener reentry executes synchronously.');
  const second = h.calls[1].operation;
  assert.equal(first.signal.aborted, true);
  assert.equal(second.signal.aborted, false);
  assert.equal(second.isCurrent(), true);
  assert.equal(h.panel.isOpen(), true);
  assert.equal(h.status.dataset.state, 'busy');
  assert.ok(h.cards().every((card) => card.disabled));
  assert.equal(h.cancel.hidden, false);
  assert.equal(h.doc.activeElement, h.cancel);
  second.onStatus('New visit owns preparation');
  old.resolve(true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.status.textContent, 'New visit owns preparation');
  assert.equal(h.status.dataset.state, 'busy');
  assert.equal(h.doc.activeElement, h.cancel);
  assert.equal(h.closed, 1);
  current.resolve(false);
  await ready(h);
  h.panel.close();
  assert.equal(h.doc.activeElement, h.otherOpener);
});

test('disposal aborts pending work and prevents later callbacks or reopening from taking ownership', async (t) => {
  const gate = held(t),
    h = fixture(t, { activate: () => gate.promise });
  h.panel.open(h.opener);
  enter(h.panel.primary());
  await waitFor(() => h.calls.length === 1);
  const operation = h.calls[0].operation;
  h.panel.dispose();
  h.panel.dispose();
  assert.equal(operation.signal.aborted, true);
  assert.equal(operation.isCurrent(), false);
  assert.equal(h.panel.isOpen(), false);
  h.destination.focus();
  const message = h.status.textContent,
    reads = h.reads;
  operation.onStatus('Disposed preparation finished');
  gate.reject(new Error('Disposed decode failed'));
  await new Promise((resolve) => setImmediate(resolve));
  h.panel.open(h.otherOpener);
  assert.equal(h.panel.isOpen(), false);
  assert.equal(h.reads, reads);
  assert.equal(h.status.textContent, message);
  assert.equal(h.doc.activeElement, h.destination);
});

test('a preview abort may reopen the native dialog without an older close clearing the new visit', async (t) => {
  const old = held(t),
    current = held(t),
    preparations = [];
  let released = 0,
    confirmed = 0;
  const h = fixture(t, {
    preparePreview(row, operation) {
      preparations.push({ row, operation });
      return preparations.length === 1 ? old.promise : current.promise;
    },
  });
  h.panel.open(h.opener);
  await waitFor(() => preparations.length === 1);
  const first = preparations[0].operation,
    previousCard = h.cards()[0],
    replacement = Object.freeze([
      Object.freeze({ ...h.entries[1], key: 'new/relay-yard', title: 'New visit Relay Yard' }),
    ]);
  first.signal.addEventListener(
    'abort',
    () => {
      h.dialog.close();
      h.setEntries(replacement);
      h.panel.open(h.otherOpener);
    },
    { once: true },
  );

  h.panel.close();

  assert.equal(h.panel.isOpen(), true, 'The older close cannot close the reentrant visit.');
  assert.equal(h.dialog.open, true);
  assert.equal(h.opened, 2);
  assert.equal(h.closed, 1);
  assert.equal(h.reads, 2);
  assert.equal(h.list.hidden, false);
  assert.equal(h.cards().length, 1);
  const newCard = h.cards()[0],
    message = h.status.textContent;
  assert.ok(newCard !== previousCard, 'The replacement visit owns a different card node.');
  assert.equal(newCard.textContent, 'Play New visit Relay Yard');
  assert.equal(newCard.disabled, false);
  assert.ok(h.doc.activeElement === newCard, 'The new visit keeps its own focused card.');
  assert.equal(first.signal.aborted, true);
  assert.equal(first.isCurrent(), false);
  assert.equal(preparations.length, 1, 'The cancelled preparation retains the global permit.');
  assert.equal(h.calls.length, 0, 'Browsing and closing do not activate an arena.');

  old.resolve({
    image: { identity: 'retired-visit-picture' },
    confirm() {
      confirmed++;
    },
    release() {
      released++;
    },
  });
  await waitFor(() => released === 1 && preparations.length === 2);

  assert.equal(confirmed, 0, 'A late retired handle is never confirmed for drawing.');
  assert.deepEqual(h.previewDraws, [], 'The retired picture cannot reach the new gallery.');
  assert.equal(preparations[1].row === replacement[0], true);
  assert.equal(preparations[1].operation.signal.aborted, false);
  assert.equal(preparations[1].operation.isCurrent(), true);
  assert.equal(h.panel.isOpen(), true);
  assert.ok(h.cards()[0] === newCard, 'Late release preserves the replacement card.');
  assert.ok(h.doc.activeElement === newCard, 'Late release preserves the newer focus.');
  assert.equal(h.status.textContent, message);
  assert.equal(h.status.dataset.state, 'ready');
  assert.equal(h.closed, 1);
  assert.equal(h.calls.length, 0);
});

// Real open/focus handoff with the observed desktop Large-display clip: the
// action intersects the panel yet its bottom is outside the scrollport.
function clippedOpening(
  t,
  rect = { x: 250, y: 683.906, width: 364, height: 47 },
  nativePrimary = false,
) {
  const h = fixture(t);
  h.doc.documentElement.clientWidth = 1280;
  h.doc.documentElement.clientHeight = 720;
  h.dialog._rect = { x: 230, y: 12, width: 820, height: 696 };
  h.dialog.clientLeft = h.dialog.clientTop = 0;
  h.dialog.clientWidth = 820;
  h.dialog.clientHeight = 696;
  const show = h.dialog.showModal;
  let target;
  const scrolls = [];
  h.dialog.showModal = () => {
    show();
    target = h.panel.primary();
    target._rect = rect;
    t.mock.method(target, 'scrollIntoView', (options) => {
      scrolls.push({ options, focused: h.doc.activeElement === target, open: h.dialog.open });
    });
    if (nativePrimary) target.focus();
    h.beforeFocus?.(target);
  };
  return Object.assign(h, { scrolls, target: () => target });
}

test('opening Team arenas fully reveals a partially clipped focused Play action', (t) => {
  const h = clippedOpening(t);
  assert.equal(h.panel.open(h.otherOpener), true);
  assert.equal(h.doc.activeElement, h.target());
  assert.deepEqual(h.scrolls, [
    {
      options: { block: 'nearest', inline: 'nearest', behavior: 'instant' },
      focused: true,
      open: true,
    },
  ]);
  assert.deepEqual(h.calls, [], 'Opening and revealing never starts or replaces an attempt');
  assert.equal(h.panel.primary().textContent, 'Play First Connection');
});

test('opening Team arenas preserves scroll when the selected Play action is fully visible', (t) => {
  const h = clippedOpening(t, { x: 250, y: 550, width: 364, height: 47 });
  h.panel.open(h.otherOpener);
  assert.equal(h.doc.activeElement, h.target());
  assert.deepEqual(h.scrolls, []);
});

for (const newer of ['focus', 'close', 'hidden', 'layout-focus'])
  test(`a newer ${newer} during catalogue opening vetoes its stale reveal`, (t) => {
    const h = clippedOpening(t);
    h.beforeFocus = (target) => {
      if (newer === 'layout-focus') {
        const read = target.getBoundingClientRect.bind(target);
        t.mock.method(target, 'getBoundingClientRect', () => {
          h.destination.focus();
          return read();
        });
      } else {
        target.addEventListener('focusin', () => {
          if (newer === 'focus') h.destination.focus();
          if (newer === 'close') h.panel.close();
          if (newer === 'hidden') h.doc.hidden = true;
        });
      }
    };
    h.panel.open(h.otherOpener);
    assert.deepEqual(h.scrolls, []);
    assert.deepEqual(h.calls, []);
    if (newer === 'focus' || newer === 'layout-focus')
      assert.equal(h.doc.activeElement, h.destination);
  });

test('native primary autofocus still reveals the clipped action without taking focus again', (t) => {
  const h = clippedOpening(t, undefined, true);
  let focuses = 0;
  h.beforeFocus = (target) => {
    t.mock.method(target, 'focus', () => {
      focuses++;
      assert.fail('The current native autofocus must not be reassigned');
    });
  };
  h.panel.open(h.otherOpener);
  assert.equal(h.doc.activeElement, h.target());
  assert.equal(focuses, 0);
  assert.equal(h.scrolls.length, 1);
  assert.deepEqual(h.calls, []);
});

function previewReturning(t, rect = { x: 250, y: 742.906, width: 364, height: 47 }) {
  const h = fixture(t, { preparePreview: async () => ({ image: null, release() {} }) });
  h.doc.documentElement.clientWidth = 844;
  h.doc.documentElement.clientHeight = 390;
  h.dialog._rect = { x: 20, y: 12, width: 804, height: 366 };
  h.dialog.clientLeft = h.dialog.clientTop = 0;
  h.dialog.clientWidth = 804;
  h.dialog.clientHeight = 366;
  h.panel.open(h.otherOpener);
  const target = h.list.querySelector('.team-discovery-preview-button'),
    scrolls = [];
  target.focus();
  target.click();
  assert.equal(h.doc.activeElement, h.back);
  target._rect = rect;
  t.mock.method(target, 'scrollIntoView', (options) => {
    scrolls.push({
      options,
      focused: h.doc.activeElement === target,
      cardsVisible: !h.list.hidden,
    });
  });
  return { ...h, target, scrolls };
}

test('return from a locked preview reveals its exact offscreen opener without starting an attempt', (t) => {
  const h = previewReturning(t);
  h.back.click();
  assert.equal(h.doc.activeElement, h.target);
  assert.deepEqual(h.scrolls, [
    {
      options: { block: 'nearest', inline: 'nearest', behavior: 'instant' },
      focused: true,
      cardsVisible: true,
    },
  ]);
  assert.deepEqual(h.calls, []);
  assert.equal(h.panel.isOpen(), true);
});

test('return to a fully visible preview opener preserves the catalogue scroll position', (t) => {
  const h = previewReturning(t, { x: 250, y: 180, width: 364, height: 47 });
  h.back.click();
  assert.equal(h.doc.activeElement, h.target);
  assert.deepEqual(h.scrolls, []);
});

for (const newer of ['focus', 'layout-focus', 'close'])
  test(`newer ${newer} during preview return vetoes the old opener reveal`, (t) => {
    const h = previewReturning(t);
    if (newer === 'layout-focus') {
      const read = h.target.getBoundingClientRect.bind(h.target);
      t.mock.method(h.target, 'getBoundingClientRect', () => {
        h.destination.focus();
        return read();
      });
    } else {
      h.target.addEventListener('focusin', () => {
        if (newer === 'focus') h.destination.focus();
        else h.panel.close();
      });
    }
    h.back.click();
    assert.deepEqual(h.scrolls, []);
    assert.deepEqual(h.calls, []);
    if (newer !== 'close') assert.equal(h.doc.activeElement, h.destination);
  });
