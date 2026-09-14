import test from 'node:test';
import assert from 'node:assert/strict';
import { createPresentationHost } from '../presentation/host.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { hashPresentationBytes } from '../presentation/bundle.mjs';
import { compilePresentation } from '../../scripts/compile-presentation.mjs';
import { iconForSlot } from '../presentation/icons.mjs';
import { encodeSpritePNG } from '../../scripts/produce-field-kit-sprites.mjs';
import { Document } from './helpers/couch-dom.mjs';

test('accepted UI artwork decorates native and later-created controls without changing handlers or checked state', async () => {
  const bundle = createDefaultThemeBundle();
  const compiled = await compilePresentation(bundle, new Map());
  const manifest = JSON.parse(new TextDecoder().decode(compiled.files.get('runtime.json')));
  const bytes = encodeSpritePNG(iconForSlot('icon.play')),
    hash = await hashPresentationBytes(bytes);
  for (const slot of ['icon.play', 'ui.input.checkbox', 'ui.focus']) {
    const asset = manifest.resolved.assets[slot];
    Object.assign(asset, {
      id: `test.${slot}`,
      kind: 'image',
      recipe: null,
      geometry: structuredClone(bundle.slots.find((entry) => entry.id === slot).geometry),
      file: { sha256: hash, bytes: bytes.length, mime: 'image/png', width: 24, height: 24 },
    });
    manifest.resolved.bindings[slot] = { id: asset.id, revision: 1 };
  }
  manifest.resolved.assets['ui.input.checkbox'].geometry.nineSlice = {
    top: 6,
    right: 5,
    bottom: 7,
    left: 4,
  };
  manifest.urls[hash] = `./assets/${hash}.png`;
  const document = new Document(),
    root = document.documentElement,
    calls = [];
  root.style.getPropertyValue = (name) => root.style[name] ?? '';
  root.style.removeProperty = (name) => {
    delete root.style[name];
  };
  const add = (tag, id) => {
    const element = document.createElement(tag);
    element.id = id;
    document.body.append(element);
    return element;
  };
  const play = add('button', 'shell-featured'),
    checkbox = add('input', 'settings-grid');
  checkbox.type = 'checkbox';
  checkbox.setAttribute('type', 'checkbox');
  checkbox.checked = true;
  play.onclick = () => calls.push('play');
  let observerCallback,
    disconnected = false;
  document.defaultView.MutationObserver = class {
    constructor(callback) {
      observerCallback = callback;
    }
    observe(element, options) {
      assert.equal(element, root);
      assert.deepEqual(options, { childList: true, subtree: true });
    }
    disconnect() {
      disconnected = true;
    }
  };
  const host = createPresentationHost({
    document,
    baseURL: 'https://game.test/compiled/',
    fetch: async (url) =>
      new Response(url.endsWith('runtime.json') ? JSON.stringify(manifest) : bytes),
    decodeImage: async () => ({ width: 24, height: 24, close() {} }),
    createObjectURL: () => 'blob:ui-test',
    revokeObjectURL() {},
  });
  await host.load();
  const cleanup = host.apply(root);
  assert.equal(play.getAttribute('data-presentation-icon'), 'play');
  assert.equal(checkbox.getAttribute('data-presentation-input'), 'checkbox');
  assert.equal(checkbox.checked, true);
  assert.equal(root.style.getPropertyValue('--fk-border-slice-ui-input-checkbox'), '6 5 7 4');
  assert.equal(root.style.getPropertyValue('--fk-slice-ui-input-checkbox'), '6 5 7 4 fill');
  assert.equal(
    root.style.getPropertyValue('--fk-slice-width-ui-input-checkbox'),
    '6px 5px 7px 4px',
  );
  play.click();
  assert.deepEqual(calls, ['play']);
  const queryBefore = root.querySelectorAll;
  root.querySelectorAll = () => assert.fail('Later inserted nodes must not rescan the document.');
  const later = add('button', 'soundtrack-play');
  observerCallback([{ addedNodes: [later] }]);
  assert.equal(later.getAttribute('data-presentation-icon'), 'play');
  const hudText = add('small', 'fixture-percent');
  hudText.textContent = '%';
  hudText.querySelectorAll = () => assert.fail('A leaf HUD label needs no subtree scan.');
  observerCallback([{ addedNodes: [hudText] }]);
  const group = add('section', 'late-controls'),
    nested = document.createElement('button');
  nested.id = 'race-start';
  group.append(nested);
  observerCallback([{ addedNodes: [group, nested] }]);
  assert.equal(nested.getAttribute('data-presentation-icon'), 'play');
  const detached = document.createElement('button');
  detached.id = 'shell-continue';
  observerCallback([{ addedNodes: [detached] }]);
  assert.equal(detached.getAttribute('data-presentation-icon'), null);
  root.querySelectorAll = queryBefore;
  cleanup();
  assert.equal(disconnected, true);
  assert.equal(root.style.getPropertyValue('--fk-border-slice-ui-input-checkbox'), '');
  assert.equal(play.getAttribute('data-presentation-icon'), null);
  assert.equal(later.getAttribute('data-presentation-icon'), null);
  assert.equal(nested.getAttribute('data-presentation-icon'), null);
  assert.equal(checkbox.getAttribute('data-presentation-input'), null);
  assert.equal(checkbox.checked, true);
  host.close();
});
