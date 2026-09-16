import test from 'node:test';
import assert from 'node:assert/strict';
import { createPresentationHost } from '../presentation/host.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { hashPresentationBytes } from '../presentation/bundle.mjs';
import { compilePresentation } from '../../scripts/compile-presentation.mjs';
import { iconForSlot } from '../presentation/icons.mjs';
import { encodeSpritePNG } from '../../scripts/produce-field-kit-sprites.mjs';
import { Document } from './helpers/couch-dom.mjs';

let artworkPromise;
async function artwork() {
  return (artworkPromise ??= makeArtwork());
}
async function makeArtwork() {
  const bundle = createDefaultThemeBundle();
  const compiled = await compilePresentation(bundle, new Map());
  const manifest = JSON.parse(new TextDecoder().decode(compiled.files.get('runtime.json')));
  const images = new Map();
  for (const slot of [
    'icon.play',
    'icon.retry',
    'icon.close',
    'ui.input.checkbox',
    'ui.input.toggle',
    'ui.focus',
  ]) {
    const bytes = encodeSpritePNG(iconForSlot(slot.startsWith('icon.') ? slot : 'icon.play')),
      hash = await hashPresentationBytes(bytes);
    images.set(`assets/${hash}.png`, bytes);
    manifest.urls[hash] = `./assets/${hash}.png`;
    const asset = manifest.resolved.assets[slot];
    Object.assign(asset, {
      id: `test.${slot}`,
      kind: 'image',
      recipe: null,
      geometry: structuredClone(bundle.slots.find((entry) => entry.id === slot).geometry),
      file: {
        sha256: hash,
        bytes: bytes.length,
        mime: 'image/png',
        width: 24,
        height: 24,
      },
    });
    manifest.resolved.bindings[slot] = { id: asset.id, revision: 1 };
  }
  manifest.resolved.assets['ui.input.checkbox'].geometry.nineSlice = {
    top: 6,
    right: 5,
    bottom: 7,
    left: 4,
  };
  return { manifest, images };
}
async function controlEnvironment() {
  const { manifest, images } = await artwork();
  const document = new Document(),
    root = document.documentElement,
    observers = [];
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
  document.defaultView.MutationObserver = class {
    constructor(callback) {
      this.callback = callback;
      this.disconnected = false;
      observers.push(this);
    }
    observe(element, options) {
      assert.equal(element, root);
      assert.deepEqual(options, { childList: true, subtree: true });
    }
    disconnect() {
      this.disconnected = true;
    }
  };
  const host = createPresentationHost({
    document,
    baseURL: 'https://game.test/compiled/',
    fetch: async (url) =>
      new Response(
        url.endsWith('runtime.json')
          ? JSON.stringify(manifest)
          : images.get(url.slice('https://game.test/compiled/'.length)),
      ),
    decodeImage: async () => ({ width: 24, height: 24, close() {} }),
    createObjectURL: () => 'blob:ui-test',
    revokeObjectURL() {},
  });
  await host.load();
  return {
    host,
    document,
    root,
    add,
    observers,
    deliver: (records) => observers.at(-1).callback(records),
  };
}

test('accepted UI artwork decorates native and later-created controls without changing handlers or checked state', async () => {
  const {
    host,
    document,
    root,
    add,
    observers,
    deliver: observerCallback,
  } = await controlEnvironment();
  const calls = [],
    play = add('button', 'shell-featured'),
    checkbox = add('input', 'settings-grid');
  checkbox.type = 'checkbox';
  checkbox.setAttribute('type', 'checkbox');
  checkbox.checked = true;
  play.onclick = () => calls.push('play');
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
  assert.equal(observers[0].disconnected, true);
  assert.equal(root.style.getPropertyValue('--fk-border-slice-ui-input-checkbox'), '');
  assert.equal(play.getAttribute('data-presentation-icon'), null);
  assert.equal(later.getAttribute('data-presentation-icon'), null);
  assert.equal(nested.getAttribute('data-presentation-icon'), null);
  assert.equal(checkbox.getAttribute('data-presentation-input'), null);
  assert.equal(checkbox.checked, true);
  host.close();
});

test('removed controls release decoration ownership before host cleanup without changing external attributes', async () => {
  const { host, root, add, deliver } = await controlEnvironment();
  const prior = add('button', 'shell-featured'),
    changed = add('button', 'shell-continue'),
    predecorated = add('button', 'race-start'),
    checkbox = add('input', 'settings-grid');
  prior.setAttribute('data-presentation-icon', 'authored');
  predecorated.setAttribute('data-presentation-icon', 'play');
  checkbox.type = 'checkbox';
  checkbox.id = 'soundtrack-play';
  checkbox.checked = true;
  const cleanup = host.apply(root);
  changed.setAttribute('data-presentation-icon', 'screen-owner');
  for (const node of [prior, changed, predecorated, checkbox]) node.remove();
  deliver([{ addedNodes: [], removedNodes: [prior, changed, predecorated, checkbox] }]);
  assert.equal(prior.getAttribute('data-presentation-icon'), 'authored');
  assert.equal(changed.getAttribute('data-presentation-icon'), 'screen-owner');
  assert.equal(predecorated.getAttribute('data-presentation-icon'), 'play');
  assert.equal(checkbox.getAttribute('data-presentation-input'), null);
  assert.equal(checkbox.getAttribute('data-presentation-icon'), null);
  assert.equal(checkbox.checked, true);
  // A detached node now belongs to its caller, even if it reuses our former value.
  prior.setAttribute('data-presentation-icon', 'play');
  cleanup();
  cleanup();
  assert.equal(prior.getAttribute('data-presentation-icon'), 'play');
  assert.equal(changed.getAttribute('data-presentation-icon'), 'screen-owner');
  host.close();
});

test('batched live moves and removal then reinsertion preserve the original decoration lease', async () => {
  const { host, document, root, add, deliver } = await controlEnvironment();
  const first = add('section', 'first'),
    second = add('section', 'second'),
    play = add('button', 'shell-featured'),
    changed = add('button', 'shell-continue');
  play.setAttribute('data-presentation-icon', 'authored');
  first.append(play, changed);
  const cleanup = host.apply(root);
  second.append(play);
  changed.remove();
  changed.setAttribute('data-presentation-icon', 'screen-owner');
  document.body.append(changed);
  deliver([
    { addedNodes: [], removedNodes: [play, changed] },
    { addedNodes: [play, changed], removedNodes: [] },
  ]);
  assert.equal(play.getAttribute('data-presentation-icon'), 'play');
  assert.equal(changed.getAttribute('data-presentation-icon'), 'screen-owner');
  cleanup();
  assert.equal(play.getAttribute('data-presentation-icon'), 'authored');
  assert.equal(changed.getAttribute('data-presentation-icon'), 'screen-owner');
  host.close();
});

test('removed subtree notifications include descendants moved out before delivery', async () => {
  const { host, document, root, add, deliver } = await controlEnvironment();
  const group = add('section', 'group'),
    nested = add('section', 'nested'),
    staysDetached = add('button', 'shell-featured'),
    movedOutside = add('button', 'shell-continue'),
    reinserted = add('button', 'race-start');
  group.append(nested);
  nested.append(staysDetached, movedOutside, reinserted);
  const cleanup = host.apply(root);
  const outside = document.createElement('section');
  group.remove();
  outside.append(movedOutside);
  document.body.append(reinserted);
  // Subtree observation continues until the ancestor's removal is delivered.
  deliver([
    { addedNodes: [], removedNodes: [group] },
    { addedNodes: [], removedNodes: [movedOutside, reinserted] },
    { addedNodes: [reinserted], removedNodes: [] },
  ]);
  assert.equal(staysDetached.getAttribute('data-presentation-icon'), null);
  assert.equal(movedOutside.getAttribute('data-presentation-icon'), null);
  assert.equal(reinserted.getAttribute('data-presentation-icon'), 'play');
  // Later attachment gets a fresh baseline, not the original visit's baseline.
  movedOutside.setAttribute('data-presentation-icon', 'new-owner');
  document.body.append(movedOutside);
  deliver([{ addedNodes: [movedOutside], removedNodes: [] }]);
  assert.equal(movedOutside.getAttribute('data-presentation-icon'), 'play');
  cleanup();
  assert.equal(movedOutside.getAttribute('data-presentation-icon'), 'new-owner');
  assert.equal(reinserted.getAttribute('data-presentation-icon'), null);
  host.close();
});

test('HUD removals do not scan live controls and repeated replacements restore each removed control', async () => {
  const { host, root, add, deliver } = await controlEnvironment();
  const live = add('button', 'shell-featured'),
    small = add('small', 'percent');
  const cleanup = host.apply(root);
  const read = live.getAttribute,
    contains = root.contains,
    query = root.querySelectorAll;
  live.getAttribute = () => assert.fail('A HUD removal must not read live decoration records.');
  root.contains = (node) => {
    assert.notEqual(node, live, 'A HUD removal must not scan live ownership.');
    return contains.call(root, node);
  };
  root.querySelectorAll = () => assert.fail('Removal must not rescan the document.');
  small.remove();
  deliver([{ addedNodes: [], removedNodes: [small] }]);
  for (let i = 0; i < 25; i++) {
    const replacement = add('button', 'shell-continue');
    deliver([{ addedNodes: [replacement], removedNodes: [] }]);
    assert.equal(replacement.getAttribute('data-presentation-icon'), 'play');
    replacement.remove();
    deliver([{ addedNodes: [], removedNodes: [replacement] }]);
    assert.equal(replacement.getAttribute('data-presentation-icon'), null);
  }
  live.getAttribute = read;
  root.contains = contains;
  root.querySelectorAll = query;
  assert.equal(live.getAttribute('data-presentation-icon'), 'play');
  cleanup();
  host.close();
});

test('load replacement and stale cleanup preserve the new application and release removed ownership', async () => {
  const { host, document, root, add, observers, deliver } = await controlEnvironment();
  const play = add('button', 'shell-featured'),
    removed = add('button', 'shell-continue');
  play.setAttribute('data-presentation-icon', 'authored');
  const oldCleanup = host.apply(root);
  removed.remove();
  deliver([{ addedNodes: [], removedNodes: [removed] }]);
  removed.setAttribute('data-presentation-icon', 'play');
  await host.load();
  assert.equal(observers[0].disconnected, true);
  assert.equal(play.getAttribute('data-presentation-icon'), 'authored');
  assert.equal(removed.getAttribute('data-presentation-icon'), 'play');
  document.body.append(removed);
  const newCleanup = host.apply(root);
  oldCleanup();
  observers[0].callback([{ addedNodes: [removed], removedNodes: [] }]);
  assert.equal(play.getAttribute('data-presentation-icon'), 'play');
  assert.equal(removed.getAttribute('data-presentation-icon'), 'play');
  newCleanup();
  newCleanup();
  assert.equal(play.getAttribute('data-presentation-icon'), 'authored');
  assert.equal(removed.getAttribute('data-presentation-icon'), 'play');
  host.close();
});

test('owned role changes across live moves retain the first baseline and preserve external changes', async () => {
  const { host, root, add, deliver } = await controlEnvironment();
  const first = add('section', 'role-first'),
    second = add('section', 'role-second'),
    button = add('button', 'shell-featured'),
    checkbox = add('input', 'role-checkbox');
  button.setAttribute('data-presentation-icon', 'authored-button');
  checkbox.type = 'checkbox';
  checkbox.checked = true;
  checkbox.setAttribute('data-presentation-input', 'authored-input');
  first.append(button, checkbox);
  const cleanup = host.apply(root);
  const move = (parent) => {
    parent.append(button, checkbox);
    deliver([
      { addedNodes: [], removedNodes: [button, checkbox] },
      { addedNodes: [button, checkbox], removedNodes: [] },
    ]);
  };
  for (const parent of [second, first]) {
    button.id = 'retry-button';
    checkbox.setAttribute('role', 'switch');
    move(parent);
    assert.equal(button.getAttribute('data-presentation-icon'), 'retry');
    assert.equal(checkbox.getAttribute('data-presentation-input'), 'toggle');
    button.id = 'shell-featured';
    checkbox.removeAttribute('role');
    move(parent);
    assert.equal(button.getAttribute('data-presentation-icon'), 'play');
    assert.equal(checkbox.getAttribute('data-presentation-input'), 'checkbox');
  }
  button.setAttribute('data-presentation-icon', 'screen-owner');
  button.id = 'retry-button';
  move(second);
  assert.equal(button.getAttribute('data-presentation-icon'), 'screen-owner');
  checkbox.remove();
  deliver([{ addedNodes: [], removedNodes: [checkbox] }]);
  assert.equal(checkbox.getAttribute('data-presentation-input'), 'authored-input');
  assert.equal(checkbox.checked, true);
  cleanup();
  assert.equal(button.getAttribute('data-presentation-icon'), 'screen-owner');
  host.close();
});

test('overlapping decoration selectors retain last-match behavior and restore the first baseline', async () => {
  const { host, root, add, deliver } = await controlEnvironment();
  const button = add('button', 'retry-button');
  button.classList.add('dialog-close');
  button.setAttribute('data-presentation-icon', 'authored');
  const cleanup = host.apply(root);
  assert.equal(button.getAttribute('data-presentation-icon'), 'close');
  button.classList.remove('dialog-close');
  deliver([{ addedNodes: [button], removedNodes: [button] }]);
  assert.equal(button.getAttribute('data-presentation-icon'), 'retry');
  button.classList.add('dialog-close');
  deliver([{ addedNodes: [button], removedNodes: [button] }]);
  assert.equal(button.getAttribute('data-presentation-icon'), 'close');
  cleanup();
  cleanup();
  assert.equal(button.getAttribute('data-presentation-icon'), 'authored');
  host.close();
});
