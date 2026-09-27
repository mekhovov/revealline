import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attachInstallOfflinePanel,
  guardInstallOfflineBlur,
  installOfflineFrameFocused,
} from '../ui/install-offline-panel.mjs';
import { captureInstallPrompt, installInstructions } from '../ui/pwa-install.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';

function setup(options = {}) {
  const document = new Document(),
    window = new Events(),
    values = new Map();
  window.location = new URL('https://game.example/revealline/releases/v2.0.0/site/game/');
  window.navigator = {};
  window.matchMedia = () => ({ matches: false });
  window.localStorage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  };
  if (options.caches) window.caches = options.caches;
  const messages = [],
    statuses = [];
  const panel = attachInstallOfflinePanel({
    document,
    window,
    downloadsURL: new URL('downloads.html', window.location),
    onStatus: (text) => statuses.push(text),
    ...options,
  });
  const connect = () => {
    const iframe = panel.root().querySelector('iframe');
    iframe.contentWindow = { postMessage: (message) => messages.push(message), focus() {} };
    iframe.emit('load');
    return iframe;
  };
  const send = (iframe, data, changes = {}) =>
    window.emit('message', {
      origin: window.location.origin,
      source: iframe.contentWindow,
      data: { format: 'revealline.offline-panel.v1', ...data },
      ...changes,
    });
  return { document, window, panel, messages, statuses, connect, send };
}
test('menu remains lightweight until opened; closing restores focus without any resume action', () => {
  let opened = 0,
    closed = 0;
  const h = setup({ onOpen: () => opened++, onClose: () => closed++ });
  const opener = h.document.createElement('button');
  h.document.body.append(opener);
  opener.focus();
  assert.equal(h.document.querySelector('iframe'), null);
  assert.equal(h.panel.root(), null);
  assert.equal(h.panel.open(), true);
  assert.equal(opened, 1);
  assert.equal(h.panel.isOpen(), true);
  assert.equal(h.document.activeElement.id, 'install-offline-downloads');
  h.panel.close();
  assert.equal(h.panel.root(), null, 'A closed panel cannot intercept host controller input.');
  assert.equal(closed, 1);
  assert.equal(h.document.activeElement, opener);
  h.panel.open();
  assert.equal(h.panel.root()?.open, true);
  h.panel.dispose();
});
test('a requested package resolves only for the exact embedded source after verified readiness', async () => {
  const h = setup();
  let resolved = false;
  const waiting = h.panel.requestPackage({ groupId: 'solo:border' }).then(() => {
    resolved = true;
  });
  const iframe = h.connect();
  assert.ok(
    h.messages.some(
      (message) => message.action === 'select-package' && message.groupId === 'solo:border',
    ),
  );
  h.send(
    iframe,
    { action: 'packages-ready', groups: ['solo:border'] },
    { origin: 'https://elsewhere.example' },
  );
  h.send(iframe, { action: 'packages-ready', groups: ['solo:border'] }, { source: {} });
  h.send(iframe, { action: 'packages-ready', groups: ['solo:horizon-starter'] });
  await Promise.resolve();
  assert.equal(resolved, false);
  h.send(iframe, { action: 'packages-ready', groups: ['base', 'solo:border'] });
  await waiting;
  assert.equal(resolved, true);
  assert.equal(h.panel.isOpen(), false);
  h.panel.dispose();
});
test('closing or aborting the chooser cancels the mission request without downloading', async () => {
  const h = setup();
  const waiting = h.panel.requestPackage({ groupId: 'solo:border' });
  h.connect();
  h.panel.close();
  await assert.rejects(waiting, { name: 'AbortError' });
  const controller = new AbortController();
  const again = h.panel.requestPackage({ groupId: 'solo:border', signal: controller.signal });
  controller.abort();
  await assert.rejects(again, { name: 'AbortError' });
  assert.ok(h.messages.every((message) => !['download', 'prepare'].includes(message.action)));
  h.panel.dispose();
});
test('install prompts require a deliberate request and dismissal does not loop', async () => {
  const h = setup(),
    install = captureInstallPrompt(h.window);
  let prompts = 0;
  h.window.emit('beforeinstallprompt', {
    prompt: async () => {
      prompts++;
    },
    userChoice: Promise.resolve({ outcome: 'dismissed' }),
  });
  assert.equal(prompts, 0);
  assert.equal(install.available(), true);
  assert.equal((await install.request()).outcome, 'dismissed');
  assert.equal(install.available(), false);
  assert.equal((await install.request()).outcome, 'unavailable');
  assert.equal(prompts, 1);
  assert.equal(installInstructions({ userAgent: 'iPhone Safari' }).platform, 'apple-mobile');
  assert.equal(
    installInstructions({ userAgent: 'Macintosh Safari', maxTouchPoints: 5 }).platform,
    'apple-mobile',
  );
  h.panel.dispose();
});

test('late native install opportunity is suggested once at a safe menu boundary', () => {
  let safe = false;
  const h = setup({ canActivate: () => safe });
  h.window.emit('beforeinstallprompt', { prompt() {} });
  assert.deepEqual(h.statuses, []);
  safe = true;
  h.window.emit('beforeinstallprompt', { prompt() {} });
  assert.equal(h.statuses.length, 1);
  assert.match(h.statuses[0], /Install Reveal Line/);
  assert.equal(h.panel.suggest(), false);
  assert.equal(h.document.querySelector('iframe'), null);
  h.panel.dispose();
});

test('cold menu reports saved metadata without treating it as verified readiness', async () => {
  const h = setup({
    caches: {
      open: async () => ({
        keys: async () => ['checkpoint'],
        match: async () =>
          new Response(
            JSON.stringify({
              edition: 'https://game.example/revealline/releases/v2.0.0/site/',
              group: 'gameplay',
              complete: true,
            }),
          ),
      }),
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(h.statuses, ['Saved offline selection · open Offline play to verify.']);
  assert.equal(h.document.querySelector('iframe'), null);
  h.panel.dispose();
});

test('owned iframe focus keeps a pending package request; actual window loss still cancels it', async () => {
  const h = setup(),
    controller = new AbortController();
  const waiting = h.panel.requestPackage({ groupId: 'solo:border', signal: controller.signal });
  const iframe = h.connect();
  const blurred = guardInstallOfflineBlur(() => controller.abort(), h.document);
  h.window.addEventListener('blur', blurred);
  // Parent blur may precede its final activeElement update to the child frame.
  h.document.focused = false;
  h.window.emit('blur');
  iframe.focus();
  h.document.focused = true;
  await Promise.resolve();
  assert.equal(installOfflineFrameFocused(h.document), true);
  assert.equal(controller.signal.aborted, false);
  assert.equal(h.panel.isOpen(), true);
  h.document.focused = false;
  h.window.emit('blur');
  await assert.rejects(waiting, { name: 'AbortError' });
  assert.equal(h.panel.isOpen(), false);
  h.panel.dispose();
});

test('untrusted frames, hidden pages and closed panels never suppress foreground-loss handling', async () => {
  const h = setup();
  h.panel.open();
  const frame = h.connect(),
    forged = h.document.createElement('iframe');
  h.document.body.append(forged);
  let losses = 0;
  const blurred = guardInstallOfflineBlur(() => losses++, h.document);
  forged.focus();
  blurred();
  await Promise.resolve();
  assert.equal(losses, 1);
  frame.focus();
  h.document.hidden = true;
  blurred();
  await Promise.resolve();
  assert.equal(losses, 2);
  h.document.hidden = false;
  h.panel.close();
  blurred();
  assert.equal(losses, 3);
  h.panel.dispose();
});
