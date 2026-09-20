import test from 'node:test';
import assert from 'node:assert/strict';
import { attachCouchCatalogue } from '../couch/couch-catalogue.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

// Real catalogue, shared panel, read-only host inspection and request parsing.
// DOM focus/dialog behavior, IndexedDB, Web Locks and transport are finite
// models. Reentry is through the public onClose callback, never private state.
class Locks {
  held = new Set();
  async request(key, _options, action) {
    if (this.held.has(key)) return action(null);
    this.held.add(key);
    try {
      return await action({ name: key });
    } finally {
      this.held.delete(key);
    }
  }
}

function fixture(t) {
  const doc = new Document(),
    assets = managedIndexedDB(),
    locks = new Locks(),
    requests = [];
  doc.defaultView = Object.assign(new Events(), doc.defaultView);
  const globals = {
    location: { href: 'https://game.example/releases/v-test/site/game/couch/' },
    indexedDB: assets.indexedDB,
    navigator: { locks },
    localStorage: {
      getItem: () => null,
      setItem: () => assert.fail('Navigation cannot write the Solo profile.'),
      removeItem: () => assert.fail('Navigation cannot delete the Solo profile.'),
    },
    matchMedia: () => null,
    fetch: async (url, options) => {
      requests.push({ url, options });
      assert.equal(
        url,
        'https://game.example/releases/v-test/site/game/content/optional-worlds.json',
      );
      return new Response(JSON.stringify({ format: 'revealline-optional-chapters.v1', packs: [] }));
    },
  };
  const originals = new Map(
    Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const button = doc.createElement('button'),
    other = doc.createElement('button');
  button.id = 'race-chapters';
  button.textContent = 'Chapters';
  other.id = 'another-current-control';
  other.textContent = 'Current destination';
  doc.body.append(button, other);
  let onClose = () => {},
    closeCalls = 0,
    openerFocusCalls = 0;
  const focus = button.focus.bind(button);
  button.focus = (...args) => {
    ++openerFocusCalls;
    focus(...args);
  };
  const catalogue = attachCouchCatalogue({
    document: doc,
    button,
    channel: 'dev',
    registeredEntries: [],
    getAttempt: () => assert.fail('Closing a catalogue does not capture a race.'),
    isAttemptCurrent: () => assert.fail('No race activation is involved.'),
    stage: () => assert.fail('No race preparation is involved.'),
    onClose: () => {
      ++closeCalls;
      onClose();
    },
  });
  t.after(() => {
    catalogue.dispose();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  return {
    doc,
    assets,
    requests,
    catalogue,
    button,
    other,
    $: (id) => doc.getElementById(`optional-worlds-${id}`),
    set onClose(value) {
      onClose = value;
    },
    get closeCalls() {
      return closeCalls;
    },
    get openerFocusCalls() {
      return openerFocusCalls;
    },
    async open() {
      button.focus();
      await catalogue.open();
      assert.equal(doc.activeElement, doc.getElementById('optional-worlds-top-back'));
      assert.equal(doc.getElementById('optional-worlds-dialog').getAttribute('aria-busy'), 'false');
    },
    assertReadOnly() {
      assert.deepEqual(assets.allPuts, []);
      assert.equal(requests.length, 1, 'Reopening reuses the already checked catalogue response.');
      assert.equal(requests[0].options.redirect, 'error');
    },
  };
}

test('ordinary Back closes the catalogue and restores its actual opener', async (t) => {
  const h = fixture(t);
  await h.open();
  h.$('top-back').click();
  assert.equal(h.closeCalls, 1);
  assert.equal(h.catalogue.root(), null);
  assert.equal(h.doc.activeElement, h.button);
  h.assertReadOnly();
});

test('a synchronous close callback owns its new control focus over the retired opener', async (t) => {
  const h = fixture(t);
  await h.open();
  let focusCallsAtNewDestination;
  h.onClose = () => {
    h.other.focus();
    focusCallsAtNewDestination = h.openerFocusCalls;
  };
  h.$('top-back').click();
  assert.equal(h.closeCalls, 1);
  assert.equal(h.catalogue.root(), null);
  assert.equal(
    h.doc.activeElement,
    h.other,
    'The older close must preserve the newer destination.',
  );
  assert.equal(h.openerFocusCalls, focusCallsAtNewDestination, 'No stale opener focus attempt.');
  h.assertReadOnly();
});

test('a synchronous close callback reopening Chapters owns its new visit and focus', async (t) => {
  const h = fixture(t);
  await h.open();
  let reopened, focusCallsAtNewVisit;
  h.onClose = () => {
    // open() focuses the new visit synchronously before its fresh inspection.
    reopened = h.catalogue.open();
    focusCallsAtNewVisit = h.openerFocusCalls;
  };
  h.$('top-back').click();
  assert.equal(h.closeCalls, 1);
  assert.equal(h.catalogue.root(), h.$('dialog'));
  assert.equal(h.doc.activeElement, h.$('top-back'), 'The new visit owns focus immediately.');
  assert.equal(h.openerFocusCalls, focusCallsAtNewVisit, 'No focus attempt outside the new modal.');
  await reopened;
  assert.equal(h.catalogue.root(), h.$('dialog'));
  assert.equal(h.doc.activeElement, h.$('top-back'));
  assert.equal(h.$('dialog').getAttribute('aria-busy'), 'false');
  h.assertReadOnly();
});
