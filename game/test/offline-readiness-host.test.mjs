import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { Document } from './helpers/couch-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { attachOfflineReadiness } from '../ui/offline-readiness.mjs';
import { downloadFiles } from '../download-catalogue.mjs';
import * as downloadSession from '../offline-download-session.mjs';
import {
  syncOfflinePackageChoices,
  attachOfflinePackageChoice,
} from '../ui/offline-package-choices.mjs';
import { formatNumber, localizedText, t } from '../i18n/index.mjs';

// Execute the shipped downloads host. Only platform/storage boundaries are
// supplied here; the summary, host selection and visibility handlers are real.
async function fixture({ unavailable = false } = {}) {
  const doc = new Document(),
    win = doc.defaultView;
  const html = await readFile(new URL('../downloads.html', import.meta.url), 'utf8');
  for (const [, tag, id] of html.matchAll(/<([a-z0-9-]+)\b[^>]*\bid="([^"]+)"/g)) {
    const element = doc.createElement(tag);
    element.id = id;
    doc.body.append(element);
  }
  doc.hidden = false;
  win.parent = { postMessage() {} };
  const scope = 'https://game.example/releases/v1/site/';
  const location = new URL(`${scope}game/downloads.html?embedded=1`);
  const file = (path, kind = 'gameplay') => ({
    path,
    kind,
    bytes: 10,
    sha256: path.padEnd(64, '0'),
  });
  const files = [file('base'), file('sim'), file('song', 'soundtrack')];
  const catalogue = {
    format: 'revealline-offline-content.v2',
    files,
    groups: [
      { id: 'base', kind: 'gameplay', files: ['base'], requires: [] },
      {
        id: 'extras:sim',
        kind: 'gameplay',
        category: 'experience',
        title: 'Simulator',
        launchPath: 'optional-practice/sim/',
        requires: ['base'],
        files: ['sim'],
      },
      { id: 'album', kind: 'soundtrack', title: 'Music', requires: [], files: ['song'] },
    ],
  };
  const state = {
    runtime: 'missing',
    launcher: 'ready',
    retained: false,
    active: null,
    hold: null,
  };
  const requests = [];
  const report = (list) => ({
    ready: list.every((item) => item.path === 'base'),
    totalBytes: list.length * 10,
    remainingBytes: 10,
    requiredBytes: 10,
    availableBytes: 1000,
  });
  const store = {
    async inspect(list, options) {
      requests.push({ type: 'inspect', list, options });
      return report(list);
    },
    async estimate(list) {
      return report(list);
    },
    async states() {
      return [];
    },
    async download() {
      throw new Error('A readiness check must never download');
    },
  };
  const source = (await readFile(new URL('../downloads.mjs', import.meta.url), 'utf8'))
    .replace(/import\s+[\s\S]*?\s+from\s+'[^']+';/g, '')
    .replaceAll('import.meta.url', JSON.stringify(`${scope}game/downloads.mjs`));
  vm.runInNewContext(source, {
    ...downloadSession,
    document: doc,
    window: win,
    location,
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
    queueMicrotask,
    navigator: { storage: { persisted: async () => state.retained } },
    formatNumber,
    localizedText,
    t,
    onLocaleChange: () => {},
    offlineAvailability: () => ({
      available: !unavailable,
      buildId: 'test-build',
      version: '1.0',
      reason: 'unavailable',
    }),
    createOfficialDownloads: () => store,
    downloadFiles,
    syncOfflinePackageChoices,
    attachOfflinePackageChoice,
    loadDownloadMetadata: async () => ({ catalogue, core: { files: [] } }),
    checkOffline: async () => {
      requests.push({ type: 'runtime' });
      if (state.hold) await state.hold;
      return { status: state.runtime };
    },
    checkInstalledLauncher: async () => {
      requests.push({ type: 'launcher' });
      return { status: state.launcher };
    },
    installedAppURL: () => `${scope}app/`,
    gameUpdatesURL: () => new URL(`${scope}app/update.html`),
    readGameUpdateContext: () => null,
    readOfflineDestination: () => null,
    readInstalledState: () => ({ active: state.active }),
    installedPresentation: () => false,
    restoredGameplaySelection: () => ({ selected: [], all: false }),
    captureInstallPrompt: () => null,
    installInstructions: () => ({ platform: 'browser' }),
    attachDownloadsNavigation: () => ({ setVisible() {}, dispose() {} }),
    attachOfflineReadiness: (options) => attachOfflineReadiness({ ...options, document: doc }),
    createSoundtrackSource: () => ({}),
    SOUNDTRACK_CATALOGUE: {},
    SOUNDTRACK_ARCHIVES: {},
  });
  const element = (id) => doc.getElementById(id);
  const summary = element('offline-readiness');
  await waitFor(() => summary.dataset.state === (unavailable ? 'unavailable' : 'incomplete'));
  if (!unavailable) await waitFor(() => !element('offline-readiness-check').disabled);
  const message = (action) =>
    win.emit('message', {
      origin: location.origin,
      source: win.parent,
      data: { format: 'revealline.offline-panel.v1', action },
    });
  return { doc, win, state, requests, element, summary, message, scope };
}

test('downloads dashboard uses verified host checks and rechecks the currently selected files', async () => {
  const h = await fixture();
  assert.equal(h.element('offline-readiness-runtime').textContent, 'Download or repair needed');
  assert.equal(h.element('offline-readiness-content').textContent, 'Verified on this device');
  assert.match(h.element('offline-readiness-sim').textContent, /0 of 1 bundled/);
  h.state.runtime = 'ready';
  h.state.retained = true;
  h.state.active = { scope: h.scope, buildId: 'test-build' };
  await h.element('offline-readiness-check').onclick();
  assert.equal(h.summary.dataset.state, 'filesReady');
  assert.match(h.element('offline-readiness-selection').textContent, /This edition/);
  assert.match(h.element('offline-readiness-retention').textContent, /granted.*backup/);
  assert.ok(h.requests.filter((r) => r.type === 'inspect').every((r) => r.options.verify === true));
  const sim = h.doc.querySelector('input[data-group="extras:sim"]');
  sim.checked = true;
  sim.onchange();
  assert.equal(h.summary.dataset.state, 'checking');
  await waitFor(() => h.summary.dataset.state === 'incomplete');
  assert.equal(h.element('offline-readiness-content').textContent, 'Download or repair needed');
});

test('closing or hiding the downloads host retires late checks and requires an explicit recheck', async () => {
  const h = await fixture();
  h.state.runtime = 'ready';
  let release;
  h.state.hold = new Promise((resolve) => {
    release = resolve;
  });
  const pending = h.element('offline-readiness-check').onclick();
  await waitFor(() => h.summary.dataset.state === 'checking');
  h.message('panel-closed');
  assert.equal(h.summary.dataset.state, 'stale');
  release();
  await pending;
  h.state.hold = null;
  h.message('panel-opened');
  assert.equal(
    h.summary.dataset.state,
    'stale',
    'reopening cannot reuse the completed hidden check',
  );
  await h.element('offline-readiness-check').onclick();
  assert.equal(h.summary.dataset.state, 'filesReady');
  h.doc.hidden = true;
  h.doc.emit('visibilitychange');
  h.doc.hidden = false;
  h.doc.emit('visibilitychange');
  assert.equal(h.summary.dataset.state, 'stale');
  await h.element('offline-readiness-check').onclick();
  h.win.emit('storage', { key: 'revealline.installed-app.v1' });
  assert.equal(
    h.summary.dataset.state,
    'stale',
    'another window selecting an edition retires the observation',
  );
  await h.element('offline-readiness-check').onclick();
  h.win.emit('pagehide', { persisted: true });
  h.win.emit('pageshow', { persisted: true });
  assert.equal(h.summary.dataset.state, 'stale');
});

test('an unsupported or unbuilt downloads page offers no false readiness or enabled recheck', async () => {
  const h = await fixture({ unavailable: true });
  assert.equal(h.element('offline-readiness-check').disabled, true);
  assert.equal(h.requests.length, 0);
  assert.match(h.element('offline-readiness-status').textContent, /Reconnect and reload/);
});
