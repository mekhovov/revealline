import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'parse5';
import { Document } from './helpers/couch-dom.mjs';
import { mountAuthoringInputHost } from '../ui/authoring-input-host.mjs';
import { getLocale, setLocale, translateDOM } from '../i18n/index.mjs';

const page = new URL('../../authoring/viewport-lab/index.html', import.meta.url);
const html = await readFile(page, 'utf8');
let serial = 0;

// Actual HTML, entry and shared router. Geometry and browser default activation
// are finite platform boundaries; this is not a browser layout qualification.
async function fixture(t, { lateTranslation = false } = {}) {
  const doc = new Document(),
    win = doc.defaultView,
    frames = new Map(),
    observers = new Set();
  doc.parentNode = win;
  let now = 1000,
    sequence = 0;
  const pad = {
    id: 'Viewport pad',
    index: 0,
    mapping: 'standard',
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  Object.assign(win, {
    location: new URL('https://viewport.test/authoring/viewport-lab/'),
    performance: { now: () => now },
    focus() {
      doc.focused = true;
    },
    requestAnimationFrame(callback) {
      frames.set(++sequence, callback);
      return sequence;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
      }
      observe() {
        observers.add(this);
      }
      disconnect() {
        observers.delete(this);
      }
    },
  });
  const create = doc.createElement.bind(doc);
  doc.createElement = (tag) => {
    const node = create(tag);
    node.before = (sibling) => node.parentNode.insertBefore(sibling, node);
    return node;
  };
  doc.createTextNode = (value) => {
    const node = create('span');
    node.textContent = value;
    return node;
  };
  function append(parent, source) {
    if (source.nodeName === '#text') {
      parent._text = (parent._text || '') + source.value;
      return;
    }
    if (!source.tagName) return;
    const node = doc.createElement(source.tagName);
    for (const { name, value } of source.attrs || []) {
      node.setAttribute(name, value);
      if (['id', 'type', 'value', 'href', 'width', 'height'].includes(name)) node[name] = value;
      if (name === 'class') node.className = value;
      if (['hidden', 'disabled', 'open'].includes(name)) node[name] = true;
    }
    parent.append(node);
    for (const child of source.childNodes || []) append(node, child);
    if (source.tagName === 'option' && node.hasAttribute('selected')) parent.value = node.value;
  }
  const body = parse(html)
    .childNodes.find((n) => n.tagName === 'html')
    .childNodes.find((n) => n.tagName === 'body');
  for (const node of body.childNodes) append(doc.body, node);
  const $ = (id) => doc.getElementById(id),
    frame = $('game-frame'),
    stage = $('stage');
  Object.assign(stage, {
    scrollLeft: 0,
    scrollTop: 0,
    clientWidth: 300,
    scrollWidth: 1300,
    clientHeight: 280,
    scrollHeight: 740,
  });
  let source = null,
    sourceWrites = 0;
  Object.defineProperty(frame, 'src', {
    get: () => source,
    set: (value) => {
      source = value;
      sourceWrites++;
    },
  });
  const restores = [];
  for (const [key, value] of Object.entries({
    document: doc,
    window: win,
    navigator: { getGamepads: () => [pad] },
  })) {
    const before = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    restores.push(() =>
      before ? Object.defineProperty(globalThis, key, before) : delete globalThis[key],
    );
  }
  const locale = getLocale();
  setLocale('en', { persist: false });
  if (!lateTranslation) translateDOM(doc.body);
  let host;
  t.after(() => {
    win.emit('pagehide', { persisted: false });
    host?.destroy();
    doc.body.replaceChildren();
    restores.reverse().forEach((fn) => fn());
    setLocale(locale, { persist: false });
  });
  await import(`${new URL('./browser.mjs', page).href}?input=${++serial}`);
  const entry = [...html.matchAll(/<script\b[^>]*type="module"[^>]*src="([^"]+)"/g)]
    .map((match) => match[1])
    .find((path) => /input-entry\.mjs$/.test(path));
  await import(`${new URL(entry, page).href}?input=${serial}`);
  host = mountAuthoringInputHost({ document: doc, window: win });
  if (lateTranslation) translateDOM(doc.body);
  const tick = () => {
    now += 50;
    pad.timestamp = now;
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(now));
    [...observers].forEach((observer) => observer.callback());
  };
  const pulse = (index) => {
    tick();
    pad.buttons[index] = { pressed: true, value: 1 };
    tick();
    pad.buttons[index] = { pressed: false, value: 0 };
    tick();
  };
  const key = (name) => {
    const active = doc.activeElement,
      event = active.emit('keydown', { key: name, code: name });
    active.emit('keyup', { key: name, code: name });
    if (!event.defaultPrevented && ['Enter', ' '].includes(name) && active.tagName === 'BUTTON')
      active.click();
    if (
      !event.defaultPrevented &&
      name === 'Enter' &&
      active.tagName === 'SELECT' &&
      active.closest('form')?.querySelector('button[type="submit"]')
    )
      active.closest('form').emit('submit');
    return event;
  };
  tick();
  tick();
  return { doc, win, $, frame, stage, host, tick, pulse, key, sourceWrites: () => sourceWrites };
}

test('Viewport actual owner exposes a two-axis reader and preserves iframe through bounded directions and Back', async (t) => {
  const h = await fixture(t),
    read = h.$('viewport-read-stage');
  assert.ok(read, 'Scrollable stage requires an explicit reachable controller action.');
  read.focus();
  h.pulse(0);
  assert.equal(read.getAttribute('aria-pressed'), 'true');
  for (let i = 0; i < 12; i++) {
    h.pulse(15);
    h.pulse(13);
  }
  assert.equal(h.stage.scrollLeft, 1000);
  assert.equal(h.stage.scrollTop, 460);
  assert.equal(h.doc.activeElement, read);
  h.pulse(1);
  assert.equal(read.getAttribute('aria-pressed'), 'false');
  assert.equal(h.stage.hasAttribute('data-viewport-reading'), false);
  assert.equal(h.doc.activeElement, read);
  assert.equal(h.$('game-frame'), h.frame);
  assert.equal(h.sourceWrites(), 0);
  assert.equal(
    h.doc.querySelector('dialog[open]'),
    null,
    'Reader Back must not also open Sections.',
  );
});

test('Viewport selector Enter and implicit form submission cannot load or replace a preview', async (t) => {
  const h = await fixture(t);
  h.$('target').focus();
  h.key('Enter');
  assert.equal(h.sourceWrites(), 0, 'Selecting or canceling a target must never load a game.');
  assert.equal(h.$('target-form').emit('submit').defaultPrevented, true);
  assert.equal(h.sourceWrites(), 0);
  h.$('load-target').focus();
  h.key('Enter');
  assert.equal(h.frame.src, '../../game/couch/');
  assert.equal(h.sourceWrites(), 1);
  h.$('target').focus();
  h.pulse(0);
  h.pulse(13);
  h.pulse(0);
  assert.equal(h.$('target').value, 'solo');
  assert.equal(h.$('load-target').disabled, false);
  h.key('Enter');
  h.$('target-form').emit('submit');
  assert.equal(h.frame.src, '../../game/couch/');
  assert.equal(h.sourceWrites(), 1);
  h.$('load-target').focus();
  h.pulse(0);
  assert.equal(h.frame.src, '../../game/');
  assert.equal(h.sourceWrites(), 2);
  assert.equal(h.doc.activeElement, h.$('target'));
});

test('Viewport native entry scrolls both axes, Home/End bound both, and Escape returns without opening Sections', async (t) => {
  const h = await fixture(t),
    read = h.$('viewport-read-stage');
  let snaps = 0;
  read.scrollIntoView = () => {
    snaps++;
  };
  read.focus();
  h.key('Enter');
  assert.equal(
    read.getAttribute('aria-pressed'),
    'true',
    'First native Enter enters without immediately completing.',
  );
  const entrySnaps = snaps;
  h.key('ArrowRight');
  h.key('PageDown');
  assert.ok(h.stage.scrollLeft > 0 && h.stage.scrollTop > 0);
  assert.equal(snaps, entrySnaps, 'Reading never snaps the view back to its opener.');
  h.key('End');
  assert.equal(h.stage.scrollLeft, 1000);
  assert.equal(h.stage.scrollTop, 460);
  h.key('Home');
  assert.equal(h.stage.scrollLeft, 0);
  assert.equal(h.stage.scrollTop, 0);
  h.key('Escape');
  assert.equal(h.doc.activeElement, read);
  assert.equal(snaps, entrySnaps + 1);
  assert.equal(read.getAttribute('aria-pressed'), 'false');
  assert.equal(h.doc.querySelector('dialog[open]'), null);
});

for (const boundary of ['new focus', 'Tab', 'blur', 'hidden', 'persisted pagehide', 'dialog'])
  test(`Viewport reader retires on ${boundary} without scrolling or stealing newer focus`, async (t) => {
    const h = await fixture(t),
      read = h.$('viewport-read-stage');
    read.focus();
    h.pulse(0);
    h.pulse(15);
    const position = h.stage.scrollLeft;
    if (boundary === 'new focus') h.$('preset').focus();
    else if (boundary === 'Tab') {
      h.key('Tab');
      h.$('preset').focus();
    } else if (boundary === 'blur') {
      h.doc.focused = false;
      h.win.emit('blur');
    } else if (boundary === 'hidden') {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
    } else if (boundary === 'persisted pagehide') h.win.emit('pagehide', { persisted: true });
    else {
      const dialog = h.doc.createElement('dialog'),
        button = h.doc.createElement('button');
      dialog.append(button);
      h.doc.body.append(dialog);
      dialog.showModal();
      button.focus();
    }
    const focus = h.doc.activeElement;
    h.tick();
    assert.equal(h.doc.activeElement, focus, 'Retiring a reader must preserve the newer owner.');
    h.pulse(15);
    assert.equal(h.stage.scrollLeft, position);
    assert.equal(read.getAttribute('aria-pressed'), 'false');
    assert.equal(h.stage.hasAttribute('data-viewport-reading'), false);
    if (boundary === 'blur' || boundary === 'hidden') assert.equal(h.doc.activeElement, focus);
    assert.equal(h.sourceWrites(), 0);
  });

test('Viewport notes reader uses the same owned Back and bounded overflow contract', async (t) => {
  const h = await fixture(t),
    read = h.$('viewport-read-notes'),
    region = h.$('viewport-notes-region');
  Object.assign(region, {
    scrollLeft: 0,
    clientWidth: 300,
    scrollWidth: 300,
    scrollTop: 0,
    clientHeight: 200,
    scrollHeight: 800,
  });
  read.focus();
  h.pulse(0);
  h.key('End');
  assert.equal(region.scrollTop, 600);
  assert.equal(region.scrollLeft, 0);
  h.pulse(0);
  assert.equal(h.doc.activeElement, read);
  assert.equal(read.getAttribute('aria-pressed'), 'false');
});

test('Viewport inactive stage is not a native Tab stop and Enter preview survives neutral polling', async (t) => {
  const h = await fixture(t);
  h.$('load-target').focus();
  h.pulse(0);
  h.tick();
  assert.equal(h.stage.getAttribute('tabindex'), null);
  const enter = h.doc.querySelector('.authoring-preview-enter');
  assert.equal(enter.hidden, false);
  h.$('direct-open').focus();
  h.key('Tab');
  // Browser Tab default moves to the next eligible native button. The stage
  // no longer intercepts that traversal with a non-controller tabindex stop.
  enter.focus();
  h.tick();
  h.tick();
  assert.equal(h.doc.activeElement, enter);
  assert.equal(h.sourceWrites(), 1);
});

test('Viewport live locale preserves loaded/pending identity and derives reader names after late heading bindings', async (t) => {
  const h = await fixture(t, { lateTranslation: true });
  h.$('load-target').focus();
  h.pulse(0);
  h.$('target').focus();
  h.pulse(0);
  h.pulse(13);
  h.pulse(0);
  assert.equal(h.$('target').value, 'solo');
  for (const language of ['uk', 'en']) {
    setLocale(language, { persist: false });
    const label = h.$('viewport-read-stage').getAttribute('aria-label');
    assert.ok(label.endsWith(h.$('viewport-preview-title').textContent.trim()));
    assert.match(h.$('loaded-target').textContent, /Couch/);
    assert.match(h.frame.title || h.frame.getAttribute('title'), /Couch/);
    assert.match(h.$('status').textContent, /Couch/);
    assert.match(h.$('status').textContent, /Solo/);
    assert.equal(h.frame.src, '../../game/couch/');
    assert.equal(h.sourceWrites(), 1);
    assert.equal(h.$('direct-open').href, '../../game/');
    assert.equal(h.$('load-target').disabled, false);
  }
});

test('Viewport all five pad presets and canceled target preserve the exact loaded iframe', async (t) => {
  const h = await fixture(t);
  h.$('load-target').focus();
  h.pulse(0);
  h.$('target').focus();
  h.pulse(0);
  h.pulse(13);
  h.pulse(1);
  assert.equal(h.$('target').value, 'couch');
  assert.equal(h.frame.src, '../../game/couch/');
  for (const [value, width, height] of [
    ['390x844', '390', '844'],
    ['844x390', '844', '390'],
    ['768x1024', '768', '1024'],
    ['1280x720', '1280', '720'],
    ['1280x800', '1280', '800'],
  ]) {
    h.$('preset').focus();
    h.pulse(0);
    for (let i = 0; i < 5; i++) h.pulse(12);
    for (
      let i = 0;
      i < ['390x844', '844x390', '768x1024', '1280x720', '1280x800'].indexOf(value);
      i++
    )
      h.pulse(13);
    h.pulse(0);
    assert.equal(h.frame.width, width);
    assert.equal(h.frame.height, height);
    assert.equal(h.$('game-frame'), h.frame);
    assert.equal(h.sourceWrites(), 1);
  }
});

test('Viewport shared child ownership requires explicit entry and restores only the real Return control', async (t) => {
  const h = await fixture(t),
    child = new Document(),
    childWindow = child.defaultView;
  child.parentNode = childWindow;
  const start = child.createElement('button');
  start.id = 'child-start';
  child.body.append(start);
  let launches = 0;
  start.onclick = () => {
    launches++;
  };
  h.frame.contentDocument = child;
  h.frame.contentWindow = childWindow;
  childWindow.focus = () => {
    h.frame.focus();
    h.win.emit('blur');
  };
  h.$('load-target').focus();
  h.pulse(0);
  h.frame.emit('load');
  const enter = h.doc.querySelector('.authoring-preview-enter'),
    back = child.querySelector('.authoring-preview-return');
  assert.ok(back);
  h.frame.focus();
  start.focus();
  assert.equal(
    h.doc.activeElement,
    h.$('target'),
    'Late child focus retains its newer parent control.',
  );
  const stale = child.body.emit('keydown', { key: 'Enter' });
  assert.equal(stale.defaultPrevented, true);
  assert.equal(launches, 0);
  enter.focus();
  h.pulse(0);
  assert.equal(h.doc.activeElement, h.frame);
  assert.equal(child.activeElement, start);
  const entered = child.body.emit('keydown', { key: 'Enter' });
  assert.equal(entered.defaultPrevented, false);
  back.focus();
  back.click();
  assert.equal(h.doc.activeElement, enter);
  h.tick();
  assert.equal(h.doc.activeElement, enter);
  assert.equal(h.sourceWrites(), 1);
});

test('Viewport terminal pagehide disposes local readers and generic preview ownership without reload', async (t) => {
  const h = await fixture(t),
    read = h.$('viewport-read-stage');
  read.focus();
  h.pulse(0);
  h.win.emit('pagehide', { persisted: false });
  assert.equal(h.$('viewport-read-stage'), null);
  assert.equal(h.stage.hasAttribute('data-viewport-reading'), false);
  assert.equal(h.doc.querySelector('.authoring-preview-enter'), null);
  assert.equal(h.stage.getAttribute('tabindex'), '0');
  h.tick();
  assert.equal(h.sourceWrites(), 0);
});

test('Viewport Sections has stable controls and preview targets before and after loading', async (t) => {
  const h = await fixture(t);
  for (const [headingId, targetId] of [
    ['viewport-controls-title', 'target'],
    ['viewport-preview-title', 'viewport-read-stage'],
  ]) {
    const heading = h.$(headingId);
    assert.ok(heading, headingId);
    assert.equal(heading.dataset.authoringTarget, targetId);
    h.host.navigation.handle({ menu: true });
    const action = [...h.doc.querySelector('dialog[open]').querySelectorAll('button')].find(
      (button) => button.textContent.trim() === heading.textContent.trim(),
    );
    assert.ok(action);
    action.focus();
    h.pulse(0);
    h.tick();
    assert.equal(h.doc.activeElement, h.$(targetId));
  }
  h.$('load-target').focus();
  h.pulse(0);
  assert.equal(h.frame.src, '../../game/couch/');
  assert.equal(h.doc.activeElement, h.$('target'));
});
