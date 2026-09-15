import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
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
  make('pre', 'offline-details');
  const panel = attachOfflinePanel({
    document: doc,
    window: win,
    availability: () => ({ available: true }),
    ...overrides,
  });
  return { doc, win, dialog, button, stop, status, panel };
}

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
  assert.equal(page.button.textContent, 'Prepare offline play');
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
