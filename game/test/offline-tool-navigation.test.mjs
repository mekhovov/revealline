import test from 'node:test';
import assert from 'node:assert/strict';
import { attachOfflineToolNavigation } from '../ui/offline-tool-navigation.mjs';

function fixture(access) {
  const events = new Map();
  const doc = {
    hidden: false,
    hasFocus: () => true,
    addEventListener: (name, fn) => events.set(name, fn),
    removeEventListener: (name) => events.delete(name),
  };
  const visited = [];
  const win = {
    location: { href: 'https://game.test/release/game/', assign: (url) => visited.push(url) },
    addEventListener() {},
    removeEventListener() {},
  };
  const dispose = attachOfflineToolNavigation({
    document: doc,
    window: win,
    access,
    availability: { available: true, packageConsent: true, scope: 'https://game.test/release/' },
  });
  const click = (href, extra = {}) => {
    const anchor = { href, target: '', hasAttribute: () => false };
    const event = {
      target: { closest: () => anchor },
      button: 0,
      preventDefault() {
        this.defaultPrevented = true;
      },
      ...extra,
    };
    return events.get('click')(event);
  };
  return { doc, events, visited, dispose, click };
}

test('tool navigation waits for the exact approved package before leaving the host', async () => {
  let finish;
  const f = fixture({
    ensureURL: async (url) => {
      assert.equal(url.pathname, '/release/authoring/asset-studio/');
      await new Promise((resolve) => (finish = resolve));
    },
  });
  const pending = f.click('https://game.test/release/authoring/asset-studio/');
  assert.deepEqual(f.visited, []);
  finish();
  await pending;
  assert.deepEqual(f.visited, ['https://game.test/release/authoring/asset-studio/']);
  f.dispose();
});

test('cancelled consent, backgrounding and disposal cannot navigate later', async () => {
  let finish;
  const f = fixture({ ensureURL: () => new Promise((resolve) => (finish = resolve)) });
  const pending = f.click('https://game.test/release/game/playground/');
  f.doc.hidden = true;
  f.events.get('visibilitychange')();
  finish();
  await pending;
  assert.deepEqual(f.visited, []);
  f.dispose();
});

test('external links and mode-departure owners keep their original behavior', async () => {
  const f = fixture({ ensureURL: () => assert.fail('unexpected package request') });
  await f.click('https://elsewhere.test/authoring/tool/');
  await f.click('https://game.test/release/game/couch/');
  await f.click('https://game.test/release/authoring/asset-studio/', { defaultPrevented: true });
  await f.click('https://game.test/release/authoring/asset-studio/', { metaKey: true });
  assert.deepEqual(f.visited, []);
  f.dispose();
});
