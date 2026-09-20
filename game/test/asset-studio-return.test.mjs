import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assetStudioHref,
  studioReturnLinks,
  isAssetStudioReturn,
  clearAssetStudioReturn,
  mountStudioReturnLinks,
} from '../ui/asset-studio-return.mjs';
import { soloPage, SoloElement } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { attachGameShell } from '../ui/game-shell.mjs';

for (const base of [
  'http://localhost/',
  'https://mekhovov.github.io/revealline/releases/v0.69.1/site/',
  'https://mekhovov.github.io/revealline-archive-36/releases/v0.68.2/site/',
]) {
  test(`Studio links keep the exact release route under ${base}`, () => {
    for (const index of ['', 'index.html']) {
      const studio = assetStudioHref(`${base}game/${index}?journey=opening&pack=old#flight`);
      assert.equal(studio, `${base}authoring/asset-studio/?journey=opening`);
      assert.deepEqual(studioReturnLinks(studio), {
        game: `${base}game/?journey=opening`,
        workshop: `${base}game/?journey=opening&workshop=asset-studio`,
      });
    }
  });
}

test('navigation hints cannot supply arbitrary destinations, launch commands or duplicate context', () => {
  for (const query of [
    '?journey=opening&journey=border',
    '?journey=https://other.test/',
    '?journey=../../game/',
    '?journey=',
  ]) {
    assert.equal(
      assetStudioHref(`https://example.test/game/${query}`),
      'https://example.test/authoring/asset-studio/',
    );
    assert.equal(
      studioReturnLinks(`https://example.test/authoring/asset-studio/${query}`).workshop,
      'https://example.test/game/?workshop=asset-studio',
    );
  }
  for (const query of [
    '',
    '?workshop=other',
    '?workshop=asset-studio&workshop=asset-studio',
    ...['course', 'practice', 'pack', 'mode-return', 'mode-return-v2'].map(
      (name) => `?workshop=asset-studio&${name}=1`,
    ),
  ])
    assert.equal(isAssetStudioReturn(query), false, query);
  assert.equal(isAssetStudioReturn('?journey=opening&workshop=asset-studio'), true);
});

test('consuming the UI hint preserves history state and the Journey route, without storage', () => {
  const state = { existing: 'state' };
  const calls = [];
  const host = {
    location: { href: 'https://example.test/game/?journey=opening&workshop=asset-studio#section' },
    history: { state, replaceState: (...args) => calls.push(args) },
  };
  clearAssetStudioReturn(host);
  assert.deepEqual(calls, [[state, '', 'https://example.test/game/?journey=opening#section']]);
  host.history.replaceState = () => {
    throw new Error('History unavailable');
  };
  assert.doesNotThrow(() => clearAssetStudioReturn(host));
});

function nativeDialogs(t) {
  const open = SoloElement.prototype.showModal;
  const origins = new WeakMap();
  t.mock.method(SoloElement.prototype, 'showModal', function () {
    if (this.open) return;
    origins.set(this, this.ownerDocument.activeElement);
    this.emit('beforetoggle', { newState: 'open', oldState: 'closed' });
    open.call(this);
    this.querySelector('button:not(:disabled),select:not(:disabled),input:not(:disabled)')?.focus();
  });
  t.mock.method(SoloElement.prototype, 'close', function () {
    if (!this.open) return;
    this.open = false;
    this.removeAttribute('open');
    origins.get(this)?.focus();
    queueMicrotask(() => this.emit('close', { bubbles: false }));
  });
}

test('actual Solo boot returns to the Studio opener and Back restores Workshop on Home without starting', async (t) => {
  nativeDialogs(t);
  const h = await soloPage(t, { titleScreen: true, search: '?workshop=asset-studio' });
  assert.equal(h.$('shell-home').open, true);
  assert.equal(h.$('shell-workshop-dialog').open, true);
  assert.equal(h.doc.activeElement.id, 'shell-asset-studio');
  const checkpoint = authoritativeCheckpoint(h.rendered.run);
  const stored = [...h.storage.map];
  const back = h.$('shell-asset-studio').emit('keydown', { key: 'Escape', code: 'Escape' });
  assert.equal(back.defaultPrevented, true, 'Escape cannot close the parent native group');
  await Promise.resolve();
  assert.equal(h.$('shell-home').open, true);
  assert.equal(h.$('shell-workshop-dialog').open, false);
  assert.equal(h.doc.activeElement.id, 'shell-workshop');
  h.frame();
  assert.equal(h.rendered.paused, true);
  assert.equal(h.rendered.run.tick, 0);
  assert.deepEqual(authoritativeCheckpoint(h.rendered.run), checkpoint);
  assert.deepEqual([...h.storage.map], stored);
  assert.deepEqual(h.errors, []);
  h.$('shell-workshop').click();
  const controllerBack = h.$('shell-workshop-dialog').emit('cancel');
  assert.equal(controllerBack.defaultPrevented, true);
  await Promise.resolve();
  assert.equal(h.$('shell-home').open, true);
  assert.equal(h.$('shell-workshop-dialog').open, false);
  assert.equal(h.doc.activeElement.id, 'shell-workshop');
});

test('actual Solo outgoing Studio link preserves its authored Journey route', async (t) => {
  const h = await soloPage(t, {
    titleScreen: true,
    search: '?journey=opening',
    waitForPictures: false,
  });
  assert.equal(
    h.$('shell-asset-studio').href,
    'http://localhost/authoring/asset-studio/?journey=opening',
  );
  assert.equal(h.$('shell-workshop-dialog').open, false);
  assert.equal(h.rendered.run.tick, 0);
  assert.deepEqual(h.errors, []);
});

for (const replacement of ['dialog', 'dispose', 'hidden', 'blurred', 'focus']) {
  test(`Workshop restoration does not cover a newer ${replacement} owner`, async (t) => {
    nativeDialogs(t);
    const h = await soloPage(t, { titleScreen: true });
    h.win.emit('pagehide', { persisted: false });
    let shell;
    shell = attachGameShell({
      document: h.doc,
      initial: false,
      canContinue: () => false,
      pause() {
        if (replacement === 'dialog') {
          h.$('settings-dialog').showModal();
          h.$('settings-dialog').querySelector('button').focus();
        } else if (replacement === 'dispose') shell.destroy();
        else if (replacement === 'focus') h.$('shell-options').focus();
        else if (replacement === 'hidden') h.doc.hidden = true;
        else h.doc.focused = false;
      },
    });
    t.after(() => shell.destroy());
    assert.equal(shell.openWorkshop({ assetStudio: true }), false);
    assert.equal(h.$('shell-workshop-dialog').open, false);
    if (replacement === 'dialog') assert.ok(h.$('settings-dialog').contains(h.doc.activeElement));
    if (replacement === 'focus') assert.equal(h.doc.activeElement.id, 'shell-options');
    h.doc.hidden = false;
    h.doc.focused = true;
    assert.equal(h.rendered.run.tick, 0);
  });
}

test('early Studio entry enables links only after assigning their complete fixed destinations', () => {
  const writes = [];
  const make = (id) => ({
    set href(value) {
      writes.push([id, 'href', value]);
    },
    removeAttribute(name) {
      writes.push([id, 'remove', name]);
    },
    set inert(value) {
      writes.push([id, 'inert', value]);
    },
  });
  const nodes = new Map(
    ['studio-workshop-return', 'studio-game-return'].map((id) => [id, make(id)]),
  );
  mountStudioReturnLinks({
    document: { getElementById: (id) => nodes.get(id) },
    href: 'https://example.test/authoring/asset-studio/?journey=opening',
  });
  for (const [id, destination] of [
    ['studio-workshop-return', '?journey=opening&workshop=asset-studio'],
    ['studio-game-return', '?journey=opening'],
  ]) {
    const owned = writes.filter((row) => row[0] === id);
    assert.deepEqual(owned[0], [id, 'href', 'https://example.test/game/' + destination]);
    assert.deepEqual(owned.slice(1), [
      [id, 'remove', 'inert'],
      [id, 'inert', false],
      [id, 'remove', 'aria-disabled'],
    ]);
  }
});
