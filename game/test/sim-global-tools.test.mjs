import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { mountSimGlobalTools } from '../../optional-practice/civilian-fpv/sim-presentation.mjs';

function surface() {
  const doc = new Document(),
    win = new Events();
  win.location = new URL('https://example.test/revealline/optional-practice/fpv-worlds/index.html');
  const settingsRoot = doc.createElement('dialog'),
    extras = doc.createElement('section');
  settingsRoot.append(extras);
  doc.body.append(settingsRoot);
  return { doc, win, settingsRoot, panels: { extras } };
}
test('source SIM lazily loads the exact same-origin global provider once and adopts real controls', async () => {
  const s = surface(),
    calls = [],
    controls = { about: s.doc.createElement('button') };
  let adopted;
  const bridge = mountSimGlobalTools({
    document: s.doc,
    window: s.win,
    moduleURL:
      'https://example.test/revealline/optional-practice/civilian-fpv/sim-presentation.mjs',
    gameReturn: 'https://example.test/revealline/game/?lang=uk',
    settingsRoot: s.settingsRoot,
    panels: s.panels,
    loadProvider: async (url) => {
      calls.push(url);
      return {
        mountGlobalSettingsTools(options) {
          assert.equal(options.coreURL.href, 'https://example.test/revealline/game/');
          return { controls, root: () => null, back: () => false, dispose() {} };
        },
      };
    },
    onControls(value) {
      adopted = value;
    },
  });
  assert.equal(calls.length, 0, 'no module request before Settings opens');
  assert.equal(await bridge.ensure(), true);
  assert.equal(await bridge.ensure(), true);
  assert.deepEqual(calls, ['https://example.test/revealline/game/ui/global-settings-tools.mjs']);
  assert.equal(adopted, controls);
  assert.equal(s.panels.extras.querySelector('[data-sim-global-tools-fallback]').hidden, true);
  bridge.dispose();
});
test('isolated optional SIM retains its native tools and a visible core fallback after load failure', async () => {
  const s = surface(),
    native = s.doc.createElement('button');
  s.panels.extras.append(native);
  const bridge = mountSimGlobalTools({
    document: s.doc,
    window: s.win,
    moduleURL:
      'https://example.test/revealline/optional-practice/civilian-fpv/sim-presentation.mjs',
    gameReturn: 'https://example.test/revealline/game/',
    settingsRoot: s.settingsRoot,
    panels: s.panels,
    loadProvider: async () => {
      throw new Error('offline');
    },
  });
  assert.equal(await bridge.ensure(), false);
  const fallback = s.panels.extras.querySelector('[data-sim-global-tools-fallback]');
  assert.equal(fallback.hidden, false);
  assert.match(fallback.textContent, /unavailable/);
  assert.equal(fallback.querySelector('a').href, 'https://example.test/revealline/game/');
  assert.equal(native.parentElement, s.panels.extras);
  bridge.dispose();
});

test('direct source SIM derives the core extension from its own nested module location', async () => {
  const s = surface();
  let called = 0;
  const bridge = mountSimGlobalTools({
    document: s.doc,
    window: s.win,
    moduleURL:
      'https://example.test/revealline/optional-practice/civilian-fpv/sim-presentation.mjs',
    settingsRoot: s.settingsRoot,
    panels: s.panels,
    loadProvider: async (url) => {
      called++;
      assert.equal(url, 'https://example.test/revealline/game/ui/global-settings-tools.mjs');
      return {
        mountGlobalSettingsTools() {
          return { controls: {}, root: () => null, back: () => false, dispose() {} };
        },
      };
    },
  });
  assert.equal(await bridge.ensure(), true);
  assert.equal(called, 1);
  bridge.dispose();
});
test('standalone without a known return preserves tools and avoids linking to a missing core', async () => {
  const s = surface();
  const bridge = mountSimGlobalTools({
    document: s.doc,
    window: s.win,
    moduleURL:
      'https://example.test/revealline/optional-practice/civilian-fpv/sim-presentation.mjs',
    settingsRoot: s.settingsRoot,
    panels: s.panels,
    loadProvider: async () => ({}),
  });
  assert.equal(await bridge.ensure(), false, 'missing provider capability is handled');
  const fallback = s.panels.extras.querySelector('[data-sim-global-tools-fallback]');
  assert.equal(fallback.hidden, false);
  assert.equal(fallback.querySelector('a').hidden, true);
  assert.match(fallback.textContent, /does not include/);
  bridge.dispose();
});
test('a same-origin return for another core tree cannot redirect the literal provider tools', async () => {
  for (const gameReturn of [
    'https://example.test/other/game/',
    'https://other.test/revealline/game/',
  ]) {
    const s = surface();
    let called = false;
    const bridge = mountSimGlobalTools({
      document: s.doc,
      window: s.win,
      moduleURL:
        'https://example.test/revealline/optional-practice/civilian-fpv/sim-presentation.mjs',
      gameReturn,
      settingsRoot: s.settingsRoot,
      panels: s.panels,
      loadProvider: async () => {
        called = true;
      },
    });
    assert.equal(await bridge.ensure(), false);
    assert.equal(called, false);
    assert.equal(s.panels.extras.children.length, 0);
    bridge.dispose();
  }
});
