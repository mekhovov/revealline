import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { mountStudioGuide } from '../../authoring/asset-studio/guide.mjs';

function fixture() {
  const document = new Document();
  const window = new Events();
  const make = (tag, id, parent = document.body) => {
    const element = document.createElement(tag);
    element.id = id;
    parent.append(element);
    return element;
  };
  const guide = make('details', 'studio-guide');
  const summary = make('summary', 'studio-guide-open', guide);
  const copy = make('div', 'guide-copy', guide);
  const close = make('button', 'studio-guide-close', copy);
  close.hidden = true;
  const outside = make('button', 'outside');
  // Model the native focus loss when the focused details body becomes hidden.
  let open = false;
  Object.defineProperty(guide, 'open', {
    get: () => open,
    set(value) {
      open = value;
      if (!value && copy.contains(document.activeElement)) document.activeElement = document.body;
    },
  });
  const owner = mountStudioGuide({ document });
  let cancellations = 0;
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') cancellations++;
  });
  return {
    document,
    window,
    guide,
    summary,
    close,
    outside,
    owner,
    cancellations: () => cancellations,
    key(target, key) {
      const event = target.emit('keydown', { key });
      // This fixture models element bubbling; finish the native document-to-window edge.
      if (!event.cancelBubble) window.emit('keydown', event);
      return event;
    },
    open() {
      summary.focus();
      guide.open = true;
      guide.emit('toggle');
    },
  };
}

test('Close collapses the inline reader and returns native focus to its summary', () => {
  const f = fixture();
  assert.equal(f.close.hidden, false, 'Close is available only after its handler is installed.');
  f.open();
  f.close.focus();
  f.close.click();
  assert.equal(f.guide.open, false);
  assert.equal(f.document.activeElement, f.summary);
  assert.equal(f.cancellations(), 0);
});

test('guide Escape is consumed before the existing global cancellation listener', () => {
  const f = fixture();
  f.open();
  f.close.focus();
  const event = f.key(f.close, 'Escape');
  assert.equal(event.defaultPrevented, true);
  assert.equal(f.guide.open, false);
  assert.equal(f.document.activeElement, f.summary);
  assert.equal(f.cancellations(), 0);
  const next = f.key(f.summary, 'Escape');
  assert.equal(next.defaultPrevented, false);
  assert.equal(f.cancellations(), 1, 'A second Escape follows the existing cancellation route.');
});

test('an open guide does not consume Escape or other keys from the authoring controls', () => {
  const f = fixture();
  f.open();
  f.outside.focus();
  const outside = f.key(f.outside, 'Escape');
  assert.equal(outside.defaultPrevented, false);
  assert.equal(f.cancellations(), 1);
  assert.equal(f.guide.open, true);
  for (const key of ['Enter', ' ', 'Tab', 'ArrowDown']) {
    const event = f.key(f.summary, key);
    assert.equal(event.defaultPrevented, false, `${key} retains its native behavior.`);
  }
});

test('programmatic Close cannot take focus from an unrelated control', () => {
  const f = fixture();
  f.open();
  f.outside.focus();
  f.close.click();
  assert.equal(f.guide.open, false);
  assert.equal(f.document.activeElement, f.outside);
});

for (const state of ['hidden', 'blurred', 'inert', 'removed']) {
  test(`closing a ${state} guide never forces return focus`, () => {
    const f = fixture();
    f.open();
    f.close.focus();
    let focuses = 0;
    f.summary.focus = () => focuses++;
    if (state === 'hidden') f.document.hidden = true;
    if (state === 'blurred') f.document.focused = false;
    if (state === 'inert') f.guide.inert = true;
    if (state === 'removed') f.guide.remove();
    f.close.click();
    assert.equal(focuses, 0);
  });
}

test('a later focus choice is not revisited after closing the guide', async () => {
  const f = fixture();
  f.open();
  f.close.focus();
  f.close.click();
  f.outside.focus();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.document.activeElement, f.outside);
});

test('terminal disposal removes Escape ownership and the scripted Close action', () => {
  const f = fixture();
  f.open();
  f.close.focus();
  f.owner.dispose();
  f.owner.dispose();
  assert.equal(f.close.hidden, true);
  assert.equal(f.close.onclick, null);
  const event = f.key(f.summary, 'Escape');
  assert.equal(event.defaultPrevented, false);
  assert.equal(f.guide.open, true, 'Native disclosure state is independent of the retired owner.');
});
