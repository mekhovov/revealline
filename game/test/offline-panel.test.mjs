import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { offlineOptionalText } from '../ui/offline-copy.mjs';
import { MessageChannel } from 'node:worker_threads';
import { Document, Events } from './helpers/couch-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { offlineAvailability, prepareOffline, checkOffline } from '../offline.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { attachOfflinePanel } from '../ui/offline-panel.mjs';

function boundary(overrides = {}) {
  const doc = new Document();
  const win = new Events();
  const make = (tag, id) => {
    const element = doc.createElement(tag);
    element.id = id;
    doc.body.append(element);
    return element;
  };
  const dialog = make('dialog', 'settings-dialog');
  dialog.open = true;
  const button = make('button', 'offline-button');
  const stop = make('button', 'offline-stop');
  let stopHidden = false;
  Object.defineProperty(stop, 'hidden', {
    get: () => stopHidden,
    set(value) {
      stopHidden = value;
      if (value && doc.activeElement === stop) doc.body.focus();
    },
  });
  const status = make('p', 'offline-status');
  const note = make('p', 'offline-optional-note');
  const details = make('pre', 'offline-details');
  const panel = attachOfflinePanel({
    document: doc,
    window: win,
    availability: () => ({ available: true }),
    ...overrides,
  });
  return { doc, win, dialog, button, stop, status, note, details, panel };
}

test('all packaged optional pack names stay in details through real host progress and readiness', async (t) => {
  const readJSON = async (path) =>
    JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8'));
  const config = await readJSON('game/build-config.json');
  const catalog = await readJSON(config.optionalChapters.catalog);
  const optionalPacks = [
    ...(await Promise.all(config.optionalOffline.map(readJSON))),
    ...catalog.packs,
  ].map(({ name }) => ({ name }));
  assert.equal(optionalPacks.length, 12, 'Exercise the full current packaged optional list');
  const scope = 'https://game.example/releases/v057/site/';
  const marker = {
    format: 'revealline-offline.v1',
    version: '0.57.0',
    buildId: 'a'.repeat(64),
    scope: '../',
    worker: '../service-worker.js',
    optionalPacks,
  };
  const requests = [];
  const worker = {
    state: 'activated',
    scriptURL: `${scope}service-worker.js`,
    postMessage(data, [port]) {
      requests.push({ data, port });
    },
  };
  const registration = { scope, active: worker, installing: null, waiting: null };
  const env = {
    documentRef: { querySelector: () => ({ content: JSON.stringify(marker) }) },
    locationRef: { href: `${scope}game/` },
    secure: true,
    navigatorRef: {
      serviceWorker: {
        register: async () => registration,
        getRegistration: async () => registration,
      },
    },
    MessageChannelImpl: MessageChannel,
  };
  const available = offlineAvailability(env);
  const page = boundary({
    availability: () => available,
    prepare: (options) => prepareOffline({ ...env, ...options }),
    check: (options) => checkOffline({ ...env, ...options }),
  });
  t.after(() => page.panel.destroy());
  const noteUnchanged = () => {
    assert.equal(page.note.hidden, false);
    assert.equal(page.note.textContent, available.note);
    for (const { name } of optionalPacks) assert.ok(page.note.textContent.includes(name));
    assert.match(page.note.textContent, /Already-installed packs.*complete backup/);
    assert.doesNotMatch(page.status.textContent, /optional:|First Light|Illustrated Pressure/);
  };
  noteUnchanged();
  const pending = page.button.onclick();
  assert.match(page.status.textContent, /^Connecting to this version’s offline worker…$/);
  assert.equal(page.stop.hidden, false);
  noteUnchanged();
  await waitFor(() => requests.length === 1);
  const reply = (request, report) =>
    request.port.postMessage({
      format: 'revealline.offline-progress.v1',
      requestId: request.data.requestId,
      operationId: 'current-worker-operation',
      buildId: marker.buildId,
      scope,
      ...report,
    });
  for (const stage of ['checking', 'downloading', 'saving', 'verifying']) {
    reply(requests[0], {
      kind: 'progress',
      stage,
      progress: { completed: 3, total: 624, unit: 'files' },
    });
    await waitFor(() => page.status.dataset.stage === stage);
    assert.match(page.status.textContent, /3 \/ 624 files/);
    assert.equal(page.stop.hidden, false);
    assert.equal(page.button.disabled, true);
    noteUnchanged();
  }
  reply(requests[0], { kind: 'terminal', status: 'ready', verified: 624 });
  await pending;
  assert.equal(page.status.dataset.state, 'ready');
  assert.match(page.status.textContent, /^Offline files verified\..*624 files verified$/);
  assert.equal(page.stop.hidden, true);
  const originalResult = JSON.parse(page.details.textContent);
  assert.equal(originalResult.message, `${originalResult.summary} ${available.note}`);
  noteUnchanged();

  const checking = page.button.onclick();
  await waitFor(() => requests.length === 2);
  reply(requests[1], {
    kind: 'terminal',
    status: 'ready',
    message: 'Core offline files verified.',
    verified: 624,
  });
  await checking;
  assert.equal(page.status.textContent, 'Core offline files verified. · 624 files verified');
  assert.equal(
    JSON.parse(page.details.textContent).message,
    `Core offline files verified. ${available.note}`,
  );
  noteUnchanged();
});

test('optional notes use plain text and are hidden when unavailable', () => {
  const page = boundary({
    availability: () => ({ available: true, note: '<b>Pack</b> is optional.' }),
  });
  assert.equal(page.note.textContent, '<b>Pack</b> is optional.');
  assert.equal(page.note.children.length, 0);
  assert.equal(page.note.hidden, false);
  page.panel.destroy();
  const empty = boundary();
  assert.equal(empty.note.textContent, '');
  assert.equal(empty.note.hidden, true);
  empty.panel.destroy();
});

test('offline host shows feedback before work and detached old callbacks cannot replace a rejoined check', async () => {
  const requests = [];
  const request = (options) => new Promise((resolve) => requests.push({ ...options, resolve }));
  const page = boundary({ prepare: request, check: request });
  const first = page.button.onclick();
  assert.equal(page.status.dataset.state, 'busy');
  assert.match(page.status.textContent, /Preparing offline/);
  assert.equal(page.button.disabled, true);
  assert.equal(page.stop.hidden, false);
  requests[0].onStatus({
    status: 'preparing',
    stage: 'downloading',
    message: 'Downloading files…',
    progress: { completed: 3, total: 10, unit: 'files' },
  });
  assert.match(page.status.textContent, /3 \/ 10 files/);
  page.stop.focus();
  page.stop.click();
  assert.equal(requests[0].signal.aborted, true);
  assert.equal(page.status.dataset.state, 'detached');
  assert.equal(page.doc.activeElement, page.button);
  assert.equal(page.button.textContent, 'Check progress');
  const second = page.button.onclick();
  requests[0].onStatus({ status: 'preparing', message: 'Old progress' });
  requests[0].resolve({ status: 'ready', message: 'Old result' });
  await first;
  assert.equal(page.button.disabled, true, 'Old finally cannot unlock the new check');
  assert.match(page.status.textContent, /Checking offline/);
  requests[1].resolve({ status: 'waiting', message: 'Close all tabs to use this update.' });
  await second;
  assert.equal(page.button.disabled, false);
  assert.equal(page.stop.hidden, true);
  assert.equal(page.button.textContent, 'Verify offline files');
  assert.match(page.status.textContent, /Close all tabs/);
  page.panel.destroy();
});

test('closing Settings detaches observation without stealing focus or reporting a failed installation', async () => {
  let request, complete;
  const page = boundary({
    prepare: (options) => {
      request = options;
      return new Promise((resolve) => (complete = resolve));
    },
  });
  const pending = page.button.onclick();
  page.dialog.open = false;
  page.doc.body.focus();
  page.dialog.emit('close');
  assert.equal(request.signal.aborted, true);
  assert.equal(page.doc.activeElement, page.doc.body);
  assert.equal(page.status.dataset.state, 'detached');
  page.dialog.open = true;
  const status = page.status.textContent;
  complete({ status: 'error', message: 'Late old failure' });
  await pending;
  assert.equal(page.status.textContent, status);
  assert.equal(page.button.textContent, 'Check progress');
  page.panel.destroy();
});

test('inactivity offers a check, real verification failure offers preparation and cached readiness settles immediately', async () => {
  let result = { status: 'still-running', message: 'Installation is still running.' };
  let writes = 0;
  const page = boundary({
    prepare: async () => {
      writes++;
      return result;
    },
    check: async () => result,
  });
  await page.button.onclick();
  assert.equal(page.status.dataset.state, 'detached');
  assert.equal(page.button.textContent, 'Check progress');
  result = { status: 'not-ready', message: 'A saved file is missing.' };
  await page.button.onclick();
  assert.equal(writes, 1, 'Checking existing work never starts another installation');
  assert.equal(page.status.dataset.state, 'error');
  assert.equal(page.button.textContent, 'Prepare shared runtime');
  result = { status: 'ready', message: 'Core verified.', verified: 600 };
  const pending = page.button.onclick();
  assert.equal(page.status.dataset.state, 'busy');
  await pending;
  assert.equal(page.status.dataset.state, 'ready');
  assert.match(page.status.textContent, /600 files verified/);
  assert.equal(page.button.textContent, 'Verify offline files');
  page.panel.destroy();
});

test('a queued old close event does not detach a reopened screen and disposal fences late results', async () => {
  let request, complete;
  const page = boundary({
    prepare: (options) => {
      request = options;
      return new Promise((resolve) => (complete = resolve));
    },
  });
  const pending = page.button.onclick();
  page.dialog.emit('close');
  assert.equal(request.signal.aborted, false);
  page.win.emit('pagehide');
  assert.equal(request.signal.aborted, true);
  page.panel.destroy();
  complete({ status: 'ready', message: 'Disposed result' });
  await pending;
  assert.equal(page.status.hidden, true);
  assert.equal(page.status.textContent, '');
  assert.equal(page.button.onclick, null);
});

test('offline completion restores the focused escape action but never background focus', async () => {
  let complete;
  const page = boundary({
    prepare: () => new Promise((resolve) => (complete = resolve)),
  });
  const pending = page.button.onclick();
  page.stop.focus();
  complete({ status: 'ready', message: 'Core verified.' });
  await pending;
  assert.equal(page.doc.activeElement, page.button);
  page.panel.destroy();

  const hidden = boundary({
    prepare: () => new Promise(() => {}),
  });
  hidden.button.onclick();
  hidden.stop.focus();
  hidden.doc.hidden = true;
  hidden.stop.click();
  assert.equal(hidden.doc.activeElement, hidden.doc.body);
  hidden.panel.destroy();
});

test('offline locale changes preserve the active observation, progress, focus and terminal diagnostics', async (context) => {
  const locale = getLocale();
  context.after(() => setLocale(locale, { persist: false }));
  setLocale('en', { persist: false });
  let request, complete;
  const page = boundary({
    availability: () => ({
      available: true,
      note: 'Journey candidate artwork is not included in offline preparation.',
      optionalPacks: [],
      optionalArtwork: { name: 'Journey candidate artwork' },
    }),
    prepare: (options) => {
      request = options;
      return new Promise((resolve) => {
        complete = resolve;
      });
    },
  });
  context.after(() => page.panel.destroy());
  const pending = page.button.onclick();
  page.stop.focus();
  request.onStatus({
    status: 'preparing',
    stage: 'downloading',
    messageCode: 'downloading',
    progress: { completed: 22, total: 993, unit: 'files' },
  });
  const meter = page.status.querySelector('progress');
  for (const language of ['uk', 'en', 'uk']) {
    setLocale(language, { persist: false });
    assert.equal(page.doc.activeElement, page.stop);
    assert.equal(request.signal.aborted, false);
    assert.equal(page.button.disabled, true);
    assert.equal(meter.value, 22);
    assert.equal(meter.max, 993);
    if (language === 'uk') {
      assert.match(page.status.textContent, /Завантажуємо.*22 із 993 файлів/);
      assert.equal(meter.getAttribute('aria-label'), '22 із 993 файлів');
      assert.match(page.note.textContent, /не входять до підготовки/);
      assert.doesNotMatch(page.note.textContent, /Journey|offline/);
    } else assert.match(page.status.textContent, /Downloading.*22 \/ 993 files/);
  }
  complete({ status: 'ready', messageCode: 'ready', verified: 993, buildId: 'unchanged' });
  await pending;
  assert.match(page.status.textContent, /Файли.*Перевірено 993 файли/);
  const diagnostics = page.details.textContent;
  assert.equal(page.doc.activeElement, page.button);
  setLocale('en', { persist: false });
  assert.match(page.status.textContent, /Offline files verified.*993 files verified/);
  assert.equal(page.details.textContent, diagnostics);
  assert.equal(page.doc.activeElement, page.button);
});

test('offline failures and unavailable environments retain live localized explanations', async (context) => {
  const locale = getLocale();
  context.after(() => setLocale(locale, { persist: false }));
  setLocale('en', { persist: false });
  const unavailable = boundary({
    availability: () => ({ available: false, messageCode: 'development' }),
  });
  context.after(() => unavailable.panel.destroy());
  const failure = boundary({
    prepare: async () => {
      throw Object.assign(new Error('diagnostic transport detail'), {
        offlineCode: 'workerChanged',
      });
    },
  });
  context.after(() => failure.panel.destroy());
  await failure.button.onclick();
  setLocale('uk', { persist: false });
  assert.match(unavailable.status.textContent, /готовому випуску/);
  assert.equal(unavailable.button.hidden, true);
  assert.match(failure.status.textContent, /Служба автономної роботи змінилася/);
  assert.equal(failure.status.dataset.state, 'error');
  assert.equal(JSON.parse(failure.details.textContent).message, 'diagnostic transport detail');
});

test('only exact first-party optional release metadata translates pack names', async (context) => {
  const locale = getLocale();
  context.after(() => setLocale(locale, { persist: false }));
  const path = 'game/content/packs/fpv-arcade-r3.json';
  const bytes = await readFile(new URL(`../../${path}`, import.meta.url));
  const pack = JSON.parse(bytes);
  const metadata = {
    path,
    id: pack.id,
    name: pack.name,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
  setLocale('uk', { persist: false });
  assert.match(offlineOptionalText({ optionalPacks: [metadata] }), /Перше світло R3/);
  const changed = { ...metadata, sha256: '0'.repeat(64) };
  assert.ok(offlineOptionalText({ optionalPacks: [changed] }).startsWith(pack.name));
});
