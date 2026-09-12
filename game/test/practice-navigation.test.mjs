import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { attachPracticeNavigation } from '../ui/practice-navigation.mjs';

class Element {
  constructor(tag, attributes = {}, parentElement = null) {
    this.tag = tag;
    this.attributes = attributes;
    this.parentElement = parentElement;
  }
  hasAttribute(name) {
    return Object.hasOwn(this.attributes, name);
  }
  getAttribute(name) {
    return this.attributes[name] ?? null;
  }
  closest(selector) {
    assert.equal(selector, 'a[href]');
    return this.tag === 'a' && this.hasAttribute('href')
      ? this
      : this.parentElement?.closest(selector) || null;
  }
}
function fixture(enabled = true) {
  const listeners = new Map(),
    blocked = [],
    doc = {
      URL: 'https://game.test/game/?practice=1&controller-preview=1',
      baseURI: 'https://game.test/game/?practice=1&controller-preview=1',
      addEventListener(type, callback, capture) {
        assert.equal(capture, true, 'guard must run before the anchor handler');
        listeners.set(type, callback);
      },
      removeEventListener(type, callback, capture) {
        assert.equal(capture, true);
        if (listeners.get(type) === callback) listeners.delete(type);
      },
    },
    api = attachPracticeNavigation({
      enabled,
      document: doc,
      onBlocked: (value) => blocked.push(value),
    });
  return {
    api,
    doc,
    listeners,
    blocked,
    activate(target, type = 'click', fields = {}) {
      const event = {
        target,
        detail: 0,
        defaultPrevented: false,
        propagationStopped: false,
        ...fields,
        preventDefault() {
          this.defaultPrevented = true;
        },
        stopPropagation() {
          this.propagationStopped = true;
        },
      };
      listeners.get(type)?.(event);
      // Model a target handler reached only after document capture.
      if (!event.propagationStopped) target.onclick?.();
      return event;
    },
  };
}
const anchor = (href, attributes = {}) => new Element('a', { href, ...attributes });

test('ordinary solo mode installs no navigation listeners and leaves links untouched', () => {
  const f = fixture(false),
    link = anchor('./');
  assert.equal(f.listeners.size, 0);
  assert.equal(f.activate(link).defaultPrevented, false);
  assert.equal(link.getAttribute('href'), './');
  assert.deepEqual(f.blocked, []);
  f.api.destroy();
});

test('nested and text targets are blocked in capture before an anchor target handler', () => {
  const f = fixture(),
    link = anchor('./'),
    nested = new Element('span', {}, link),
    text = { parentElement: nested };
  let activated = 0;
  for (const target of [link, nested, text]) {
    target.onclick = () => activated++;
    const event = f.activate(target);
    assert.equal(event.defaultPrevented, true);
    assert.equal(event.propagationStopped, true);
  }
  assert.equal(activated, 0);
  assert.deepEqual(f.blocked, Array(3).fill({ href: './' }));
  assert.equal(link.getAttribute('href'), './', 'the guard must not rewrite source destinations');
});

test('controller-style synthetic clicks, keyboard clicks and modified auxiliary clicks cannot leave practice', () => {
  const f = fixture();
  for (const [type, fields] of [
    ['click', { detail: 0, isTrusted: false }],
    ['click', { detail: 0, isTrusted: true }],
    ['click', { detail: 1, metaKey: true }],
    ['click', { detail: 1, ctrlKey: true }],
    ['auxclick', { button: 1, detail: 1 }],
    ['auxclick', { button: 1, shiftKey: true }],
  ])
    assert.equal(
      f.activate(anchor('couch/', { target: '_blank' }), type, fields).defaultPrevented,
      true,
    );
  assert.equal(f.blocked.length, 6);
});

test('only fragments resolving to the current document retain their default behavior', () => {
  const f = fixture();
  for (const href of ['#', '#missions', `${f.doc.URL}#missions`]) {
    const event = f.activate(anchor(href));
    assert.equal(event.defaultPrevented, false, href);
    assert.equal(event.propagationStopped, false, href);
  }
  for (const href of [
    './#missions',
    '?practice=1#missions',
    '../#missions',
    'https://other.test/game/#missions',
    'https://game.test/game/?practice=0#missions',
  ])
    assert.equal(f.activate(anchor(href)).defaultPrevented, true, href);
  f.doc.baseURI = 'https://other.test/';
  assert.equal(f.activate(anchor('#missions')).defaultPrevented, true);
});

test('downloads remain available while malformed, empty and non-http navigation is blocked', () => {
  const f = fixture();
  assert.equal(
    f.activate(anchor('blob:https://game.test/file', { download: 'backup.json' })).defaultPrevented,
    false,
  );
  assert.equal(f.activate(anchor('./replay.json', { download: '' })).defaultPrevented, false);
  for (const href of [
    '',
    'https://[',
    'javascript:alert(1)',
    'data:text/html,test',
    'mailto:test@example.com',
  ])
    assert.equal(f.activate(anchor(href)).defaultPrevented, true, href);
  assert.equal(f.blocked.length, 5);
});

test('non-anchor controls remain active and teardown is idempotent', () => {
  const f = fixture(),
    button = new Element('button'),
    noHref = new Element('a');
  let clicks = 0;
  button.onclick = () => clicks++;
  assert.equal(f.activate(button).defaultPrevented, false);
  assert.equal(f.activate(noHref).defaultPrevented, false);
  assert.equal(clicks, 1);
  const oldListener = f.listeners.get('click');
  f.api.destroy();
  f.api.destroy();
  assert.equal(f.listeners.size, 0);
  assert.equal(f.activate(anchor('./')).defaultPrevented, false);
  oldListener({ target: anchor('./') });
  assert.deepEqual(f.blocked, []);
});

test('every actual solo-page navigation link is contained in preview mode', async () => {
  const source = await readFile(new URL('../index.html', import.meta.url), 'utf8'),
    links = [...source.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)].map((match) => match[1]),
    f = fixture();
  assert.ok(links.includes('./'));
  assert.ok(links.includes('couch/'));
  assert.ok(links.includes('playground/'));
  assert.ok(links.includes('replay-theater/'));
  for (const href of links) assert.equal(f.activate(anchor(href)).defaultPrevented, true, href);
  assert.equal(f.blocked.length, links.length);
});

test('enabled guard rejects unusable host adapters instead of pretending containment', () => {
  assert.throws(() => attachPracticeNavigation({ enabled: true, document: {} }), TypeError);
  const f = fixture();
  assert.throws(
    () => attachPracticeNavigation({ enabled: true, document: f.doc, onBlocked: null }),
    TypeError,
  );
});
