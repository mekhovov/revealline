import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'parse5';
import { Document } from './helpers/couch-dom.mjs';
import { getLocale, setLocale, translateDOM } from '../i18n/index.mjs';
import { mountCreatorGuide } from '../../authoring/community/creator-guide.mjs';

const html = await readFile(
  new URL('../../authoring/community/index.html', import.meta.url),
  'utf8',
);
const ids = ['automatic', 'meaning', 'try', 'picture', 'campaign', 'recover', 'more'];

function fixture(t, { referrer = '' } = {}) {
  const doc = new Document(),
    win = doc.defaultView,
    frames = new Map(),
    observers = new Set(),
    scrolls = [];
  let now = 1000,
    serial = 0;
  doc.parentNode = win;
  doc.referrer = referrer;
  const pad = {
    id: 'Creator Guide test pad',
    index: 0,
    mapping: 'standard',
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  Object.assign(win, {
    location: new URL('https://guide.test/authoring/community/index.html'),
    innerHeight: 600,
    performance: { now: () => now },
    scrollBy: (value) => scrolls.push(value),
    requestAnimationFrame(callback) {
      frames.set(++serial, callback);
      return serial;
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
  const append = (parent, source) => {
    if (source.nodeName === '#text') {
      parent._text = (parent._text || '') + source.value;
      return;
    }
    if (!source.tagName) return;
    const node = doc.createElement(source.tagName);
    for (const { name, value } of source.attrs || []) {
      node.setAttribute(name, value);
      if (['id', 'type', 'value', 'href', 'content'].includes(name)) node[name] = value;
      if (name === 'class') node.className = value;
      if (['hidden', 'disabled', 'open'].includes(name)) node[name] = true;
    }
    parent.append(node);
    for (const child of source.childNodes || []) append(node, child);
  };
  const root = parse(html).childNodes.find((node) => node.tagName === 'html');
  for (const name of ['head', 'body'])
    root.childNodes
      .find((node) => node.tagName === name)
      .childNodes.forEach((node) => append(doc[name], node));
  const restore = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { getGamepads: () => [pad] },
  });
  const locale = getLocale();
  setLocale('en', { persist: false });
  const host = mountCreatorGuide({ document: doc, window: win });
  // Deliberately bind static headings after the local derived labels.
  translateDOM(doc.body);
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
  const key = (value) => {
    const node = doc.activeElement,
      event = node.emit('keydown', { key: value, code: value });
    node.emit('keyup', { key: value, code: value });
    if (
      !event.defaultPrevented &&
      ['Enter', ' '].includes(value) &&
      ['BUTTON', 'A'].includes(node.tagName)
    )
      node.click();
    [...observers].forEach((observer) => observer.callback());
    return event;
  };
  for (const id of ids)
    Object.assign(doc.getElementById(`creator-guide-${id}-region`), {
      clientHeight: 180,
      scrollHeight: 780,
      scrollTop: 0,
    });
  t.after(() => {
    host.destroy();
    doc.body.replaceChildren();
    doc.head.replaceChildren();
    restore ? Object.defineProperty(globalThis, 'navigator', restore) : delete globalThis.navigator;
    setLocale(locale, { persist: false });
  });
  tick();
  tick();
  return {
    doc,
    win,
    host,
    pad,
    tick,
    pulse,
    key,
    frames,
    observers,
    scrolls,
    $: (id) => doc.getElementById(id),
    sections: doc.querySelector('.authoring-input-rail button'),
  };
}

// Actual markup + shared router/Confirm/navigation. Geometry is finite test data,
// not a claim about browser layout, scroll extent or OS downloads.
test('all seven Guide Sections keep a real reader focused through neutral controller frames', (t) => {
  const h = fixture(t);
  for (const id of ids) {
    h.sections.click();
    const dialog = h.doc.querySelector('dialog[open]');
    const option = [...dialog.querySelectorAll('button')].find(
      (node) => node.textContent === h.$(id).textContent.trim(),
    );
    assert.ok(option, id);
    option.click();
    h.tick();
    h.tick();
    assert.equal(h.doc.activeElement, h.$(`creator-guide-read-${id}`), id);
    assert.equal(h.host.navigation.readingState(), null);
    assert.equal(h.$(`creator-guide-${id}-region`).tabIndex, -1);
  }
});

test('all seven contents links focus their reader without changing URL, following links or downloading', (t) => {
  const h = fixture(t),
    activations = [];
  h.doc.addEventListener('click', (event) => {
    if (event.target.tagName === 'A' && !event.target.id.startsWith('creator-guide-contents-'))
      activations.push(event.target.href);
  });
  const href = h.win.location.href;
  for (const id of ids) {
    const contents = h.$(`creator-guide-contents-${id}`);
    contents.focus();
    h.pulse(0);
    assert.equal(h.doc.activeElement, h.$(`creator-guide-read-${id}`));
    assert.equal(h.host.navigation.readingState(), null);
    h.tick();
    assert.equal(h.doc.activeElement, h.$(`creator-guide-read-${id}`));
  }
  assert.deepEqual(activations, []);
  assert.equal(h.win.location.href, href);
});

test('native first Enter owns section reading; Home/End and Back restore the exact entry', (t) => {
  const h = fixture(t),
    read = h.$('creator-guide-read-recover'),
    region = h.$('creator-guide-recover-region');
  read.focus();
  h.key('Enter');
  assert.equal(h.host.navigation.readingState()?.regionId, region.id);
  assert.equal(region.getAttribute('data-controller-reading'), 'true');
  assert.equal(read.getAttribute('aria-pressed'), 'true');
  h.key('End');
  assert.equal(region.scrollTop, 600);
  h.key('Home');
  assert.equal(region.scrollTop, 0);
  h.key('ArrowDown');
  assert.equal(region.scrollTop, 48);
  h.key('Escape');
  assert.equal(h.host.navigation.readingState(), null);
  assert.equal(h.doc.activeElement, read);
  assert.equal(region.hasAttribute('data-controller-reading'), false);
  assert.equal(region.tabIndex, -1);
  h.tick();
  assert.equal(h.doc.activeElement, read);
});

test('controller reading protects held Confirm, finishes once and then routes Back through the checked return', (t) => {
  const h = fixture(t, { referrer: 'https://guide.test/game/studio/?project=existing' });
  const read = h.$('creator-guide-read-meaning'),
    region = h.$('creator-guide-meaning-region'),
    home = h.$('creator-guide-return');
  let returns = 0;
  home.onclick = () => returns++;
  read.focus();
  h.pad.buttons[0] = { pressed: true, value: 1 };
  h.tick();
  const duplicate = read.emit('click', { button: 0, detail: 0, isTrusted: true });
  assert.equal(duplicate.defaultPrevented, true);
  assert.equal(h.host.navigation.readingState(), null);
  h.pad.buttons[0] = { pressed: false, value: 0 };
  h.tick();
  assert.equal(h.host.navigation.readingState()?.regionId, region.id);
  h.pulse(13);
  assert.equal(region.scrollTop, 48);
  h.pulse(0);
  assert.equal(h.host.navigation.readingState(), null);
  assert.equal(h.doc.activeElement, read);
  assert.equal(returns, 0);
  h.pulse(0);
  h.pulse(1);
  assert.equal(h.doc.activeElement, read);
  assert.equal(returns, 0);
  h.pulse(1);
  assert.equal(returns, 1);
  assert.equal(home.href, 'https://guide.test/game/studio/?project=existing');
});

test('the existing whole-page controller reader remains available alongside section readers', (t) => {
  const h = fixture(t),
    read = h.doc.querySelector('.authoring-reference-read');
  read.focus();
  h.pulse(0);
  h.pulse(13);
  assert.deepEqual(h.scrolls, [{ left: 0, top: 360, behavior: 'instant' }]);
  h.pulse(1);
  assert.equal(h.doc.activeElement, read);
  assert.equal(read.getAttribute('aria-pressed'), 'false');
  assert.equal(h.doc.querySelector('dialog[open]'), null);
});

test('EN/UK/EN updates section, Contents and reader names without replacing rich link slots or reader ownership', (t) => {
  const h = fixture(t),
    read = h.$('creator-guide-read-automatic'),
    region = h.$('creator-guide-automatic-region');
  const slot = region.querySelector('a[data-i18n-slot]');
  read.focus();
  h.pulse(0);
  const en = read.getAttribute('aria-label');
  for (const locale of ['uk', 'en']) {
    setLocale(locale, { persist: false });
    h.tick();
    const heading = h.$('automatic').textContent.trim();
    assert.ok(read.getAttribute('aria-label').endsWith(heading));
    assert.equal(h.host.navigation.readingState()?.label, heading);
    assert.equal(h.host.navigation.readingState()?.regionId, region.id);
    assert.equal(region.querySelector('a[data-i18n-slot]'), slot);
    assert.equal(h.$('creator-guide-read-automatic'), read);
    assert.equal(h.doc.activeElement, region);
    assert.equal(h.$('creator-guide-contents-meaning').textContent, h.$('meaning').textContent);
    assert.equal(read.getAttribute('aria-label') === en, locale === 'en');
  }
});

for (const boundary of ['blur', 'hidden', 'cached pagehide'])
  test(`section reading retires without navigation or focus theft on ${boundary}`, (t) => {
    const h = fixture(t),
      read = h.$('creator-guide-read-campaign'),
      contents = h.$('creator-guide-contents-more');
    read.focus();
    h.pulse(0);
    let returns = 0;
    h.$('creator-guide-return').onclick = () => returns++;
    if (boundary === 'hidden') {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
    } else h.win.emit(boundary === 'blur' ? 'blur' : 'pagehide', { persisted: true });
    [...h.observers].forEach((observer) => observer.callback());
    assert.equal(h.host.navigation.readingState(), null);
    assert.equal(read.getAttribute('aria-pressed'), 'false');
    assert.equal(h.$('creator-guide-campaign-region').tabIndex, -1);
    assert.equal(returns, 0);
    h.doc.hidden = false;
    contents.focus();
    h.tick();
    assert.equal(h.doc.activeElement, contents);
    contents.click();
    h.pulse(0);
    assert.equal(h.host.navigation.readingState()?.regionId, 'creator-guide-more-region');
  });

test('newer native focus and a modal retire the section reader without activating its links', (t) => {
  const h = fixture(t),
    read = h.$('creator-guide-read-try');
  read.focus();
  h.pulse(0);
  h.$('creator-guide-contents-picture').focus();
  h.tick();
  assert.equal(h.host.navigation.readingState(), null);
  assert.equal(h.doc.activeElement, h.$('creator-guide-contents-picture'));
  read.focus();
  h.pulse(0);
  h.pulse(9);
  assert.equal(h.host.navigation.readingState(), null);
  // The first Menu ends the reader; the next opens Sections.
  h.pulse(9);
  assert.ok(h.doc.querySelector('dialog[open]'));
  const active = h.doc.activeElement;
  h.$('creator-guide-contents-picture').click();
  assert.equal(h.doc.activeElement, active);
});

test('terminal disposal removes only local handlers and shared ownership, keeping every existing destination intact', (t) => {
  const h = fixture(t),
    destinations = [...h.doc.querySelectorAll('main a')].map((node) => node.getAttribute('href'));
  assert.equal(destinations.filter((value) => value.endsWith('.md')).length, 10);
  assert.equal(h.doc.querySelectorAll('a[download]').length, 2);
  const read = h.$('creator-guide-read-picture');
  read.focus();
  h.pulse(0);
  h.win.emit('pagehide', { persisted: false });
  assert.equal(h.frames.size, 0);
  assert.equal(h.observers.size, 0);
  assert.equal(h.host.navigation.readingState(), null);
  assert.equal(read.onclick, null);
  assert.equal(h.$('creator-guide-contents-picture').onclick, null);
  assert.deepEqual(
    [...h.doc.querySelectorAll('main a')].map((node) => node.getAttribute('href')),
    destinations,
  );
  setLocale('uk', { persist: false });
  assert.equal(h.frames.size, 0);
});

for (const referrer of [
  '',
  'https://outside.test/authoring/tool/',
  'https://guide.test/game/test/manual/guide.html',
])
  test(`direct or ineligible-referrer entry has a real localized Content Studio destination (${referrer || 'direct'})`, (t) => {
    const h = fixture(t, { referrer }),
      link = h.$('creator-guide-return');
    assert.equal(link.href, 'https://guide.test/game/studio/');
    assert.equal(link.textContent, 'Content Studio');
    setLocale('uk', { persist: false });
    assert.equal(link.textContent, 'Студія вмісту');
    setLocale('en', { persist: false });
    assert.equal(link.textContent, 'Content Studio');
    assert.equal(link.href, 'https://guide.test/game/studio/');
  });

test('a real authoring referrer remains the checked previous-page destination', (t) => {
  const h = fixture(t, { referrer: 'https://guide.test/authoring/asset-studio/?theme=fpv' });
  const link = h.$('creator-guide-return');
  assert.equal(link.href, 'https://guide.test/authoring/asset-studio/?theme=fpv');
  assert.equal(link.textContent, 'Return to previous page');
});

test('explicit reader Back and repeated mounting retain one shared input owner', (t) => {
  const h = fixture(t),
    entry = h.$('creator-guide-read-more'),
    done = h.$('creator-guide-read-more-done');
  assert.equal(mountCreatorGuide({ document: h.doc, window: h.win }), h.host);
  assert.equal(h.frames.size, 1);
  assert.equal(h.doc.querySelectorAll('.authoring-input-rail').length, 1);
  entry.focus();
  h.key('Enter');
  assert.equal(done.disabled, false);
  done.focus();
  h.key('Enter');
  assert.equal(h.host.navigation.readingState(), null);
  assert.equal(done.disabled, true);
  assert.equal(h.doc.activeElement, entry);
});
