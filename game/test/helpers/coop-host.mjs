import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Document, Events, Element } from './couch-dom.mjs';
import { mountCouch } from './couch-host.mjs';
import { FIXED_DT } from '../../coop/core.mjs';
import { installCoopPresentation, waitFor } from './coop-presentation-fixture.mjs';

const html = await readFile(new URL('../../couch/relay-rescue.html', import.meta.url), 'utf8');
let sequence = 0;

/** Real markup and game modules, with a minimal DOM, inert Canvas, and controlled frame callbacks. */
export async function page(
  t,
  {
    touch = false,
    href = 'http://localhost/game/couch/relay-rescue.html',
    returnStorage = null,
    beforeImport = () => {},
    nativeFocus = false,
    nativeVisibility = false,
    onReady = () => {},
    expectError = false,
    readyStartDisabled = false,
    capturePaint = false,
    presentation = {},
    waitPicture = true,
  } = {},
) {
  const doc = new Document(),
    win = new Events();
  doc.parentNode = win;
  mountCouch(doc, html);
  const $ = (id) => doc.getElementById(id);
  // Model only native dialog state/default cancel; production owns its lifecycle.
  for (const dialog of doc.querySelectorAll('dialog')) {
    dialog.hidden = true;
    dialog.showModal = () => {
      dialog.emit('beforetoggle', { newState: 'open', oldState: 'closed', bubbles: false });
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
  }
  if (nativeVisibility) {
    for (const element of doc.querySelectorAll('*')) {
      for (const key of ['hidden', 'disabled']) {
        let value = element[key];
        Object.defineProperty(element, key, {
          configurable: true,
          get: () => value,
          set(next) {
            value = next;
            if (next && element.contains(doc.activeElement)) {
              const old = doc.activeElement;
              doc.activeElement = doc.body;
              old.emit('blur', { bubbles: false });
            }
          },
        });
      }
    }
  }
  const drawImages = [];
  let failPaint = false,
    paintDepth = 0,
    paintHash = null,
    lastPaint = null;
  const visits = [];

  $('coop-canvas').width = 1152;
  $('coop-canvas').height = 576;
  const context = new Proxy(
    {},
    {
      get(target, key) {
        if (Object.hasOwn(target, key)) return target[key];
        return (...args) => {
          if (key === 'drawImage') drawImages.push(args[0]);
          if (key === 'save') {
            if (paintDepth === 0) {
              if (failPaint) {
                failPaint = false;
                throw new Error('Modeled Canvas paint failure');
              }
              if (capturePaint) paintHash = createHash('sha256');
            }
            paintDepth++;
          }
          paintHash?.update(JSON.stringify([key, ...args]));
          if (key === 'restore' && --paintDepth === 0 && paintHash) {
            lastPaint = paintHash.digest('hex');
            paintHash = null;
          }
        };
      },
      set(target, key, value) {
        target[key] = value;
        paintHash?.update(JSON.stringify(['set', key, value]));
        return true;
      },
    },
  );
  $('coop-canvas').getContext = () => context;
  const frames = new Map(),
    originals = new Map();
  let nextFrame = 0;
  const pads = [];
  const touchListeners = new Set();
  const touchQuery = {
    matches: touch,
    addEventListener: (type, fn) => touchListeners.add(fn),
    removeEventListener: (type, fn) => touchListeners.delete(fn),
  };
  const install = (key, descriptor) => {
    if (!originals.has(key)) originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, ...descriptor });
  };
  for (const [key, value] of Object.entries({
    document: doc,
    window: win,
    navigator: { getGamepads: () => pads },
    location: { href, assign: (url) => visits.push(url) },
    matchMedia: (query) => (query === '(any-pointer: coarse)' ? touchQuery : { matches: false }),
    requestAnimationFrame(callback) {
      frames.set(++nextFrame, callback);
      return nextFrame;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
  }))
    install(key, { value, writable: true });
  for (const key of ['localStorage', 'sessionStorage', 'indexedDB']) {
    if (key === 'sessionStorage' && returnStorage) {
      install(key, { value: returnStorage });
      continue;
    }
    install(key, {
      get() {
        throw new Error(`Unexpected co-op storage access: ${key}`);
      },
    });
  }
  t.after(() => {
    win.emit('pagehide');
    frames.clear();
    for (const [key, original] of originals)
      if (original) Object.defineProperty(globalThis, key, original);
      else delete globalThis[key];
  });
  const focusAttempts = [];
  if (nativeFocus) {
    const focus = Element.prototype.focus;
    t.mock.method(Element.prototype, 'focus', function (...args) {
      focusAttempts.push({
        id: this.id,
        phase: doc.documentElement.dataset.toolState,
        disabled: this.disabled,
      });
      if (!this.disabled && !this.closest('[hidden],[inert]') && this.getClientRects().length)
        focus.apply(this, args);
    });
  }
  let toolState = 'loading';
  Object.defineProperty(doc.documentElement.dataset, 'toolState', {
    configurable: true,
    get: () => toolState,
    set(value) {
      toolState = value;
      if (value === 'ready') onReady({ $, doc, win });
    },
  });
  const artwork = installCoopPresentation({ doc, win, install, ...presentation });
  beforeImport({ $, doc, win, install });
  await import(`../../couch/relay-rescue.mjs?host-test=${++sequence}`);
  if (!expectError) {
    if (waitPicture)
      await waitFor(
        () => $('coop-picture-status').dataset.state === 'ready',
        () => $('coop-picture-status').textContent,
      );
    assert.equal(
      $('coop-start').disabled,
      waitPicture ? readyStartDisabled : true,
      $('coop-boot').textContent,
    );
    assert.equal(doc.documentElement.dataset.toolState, 'ready');
    assert.ok(frames.size);
  }
  $('coop-difficulty').value = 'standard';
  const selectFile = (text, read = async () => text) => {
    $('coop-pack-file').closest('details').open = true;
    $('coop-pack-file').files = [{ size: Buffer.byteLength(text), text: read }];
    return $('coop-pack-file').onchange();
  };
  const choose = (id, value) => {
    $(id).value = value;
    return $(id).onchange();
  };
  const press = (key) => {
    const target = doc.activeElement;
    const event = target.emit('keydown', { key, code: key, repeat: false });
    if (!event.defaultPrevented && key === 'Escape') {
      const dialog = target.closest('dialog[open]');
      if (dialog) {
        const cancel = dialog.emit('cancel', { bubbles: false });
        if (!cancel.defaultPrevented) dialog.close();
      }
    }
    if (!event.defaultPrevented && key === 'Tab') {
      const dialog = target.closest('dialog[open]');
      if (dialog) {
        const stops = [
          ...dialog.querySelectorAll('button,a[href],input,select,textarea,summary,[tabindex]'),
        ].filter(
          (node) =>
            node.tabIndex >= 0 &&
            !node.disabled &&
            !node.closest('[hidden],[inert]') &&
            node.getClientRects().length,
        );
        const index = stops.indexOf(target);
        if (index >= 0) stops[(index + 1) % stops.length]?.focus();
      }
    }
    if (!event.defaultPrevented && key === 'Enter' && target.tagName === 'BUTTON') target.click();
    // Model only the native anchor default after actual keyboard/click handlers.
    if (!event.defaultPrevented && key === 'Enter' && target.tagName === 'A') {
      const click = target.emit('click', { button: 0 });
      if (!click.defaultPrevented)
        visits.push(new URL(target.getAttribute('href'), globalThis.location.href).href);
    }
    return event;
  };
  const tap = (key) => {
    press(key);
    doc.activeElement.emit('keyup', { key, code: key });
  };
  let now = 0;
  const tick = (count = 1) => {
    for (let index = 0; index < count; index++) {
      const [id, callback] = frames.entries().next().value;
      frames.delete(id);
      callback((now += FIXED_DT * 1000));
    }
  };
  return {
    artwork,
    drawImages,
    $,
    doc,
    win,
    visits,
    get lastPaint() {
      return lastPaint;
    },
    failNextPaint() {
      failPaint = true;
    },
    selectFile,
    choose,
    press,
    tap,
    tick,
    pads,
    focusAttempts,
    touchPads: [...doc.querySelectorAll('.race-pad')],
    setTouch(value) {
      touchQuery.matches = value;
      for (const fn of touchListeners) fn();
    },
    // This minimal host has no native summary activation. Model only that
    // browser default while retaining real navigation/cancel callbacks.
    disclose(id) {
      $(id).open = true;
      $(id).querySelector('summary').focus();
    },
  };
}
