import test from 'node:test';
import assert from 'node:assert/strict';
import { attachLibraryPanel } from '../ui/library-panel.mjs';
import { emptyLibrary } from '../library.mjs';

// Only DOM lifecycle and the browser's download boundary are adapted. The real
// panel, downloadJSON and web platform adapter execute for every export.
class Element {
  constructor(document, tagName = 'div') {
    Object.assign(this, {
      document,
      tagName,
      children: [],
      listeners: new Map(),
      dataset: {},
      style: {},
      disabled: false,
      hidden: false,
      open: false,
      isConnected: true,
      value: '',
      textContent: '',
    });
  }
  append(...children) {
    this.children.push(...children);
  }
  replaceChildren(...children) {
    this.children = children;
  }
  querySelectorAll(selector) {
    const tags = selector.split(',');
    return this.children.flatMap((child) => [
      ...(tags.includes(child.tagName) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }
  emit(type) {
    const event = {
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
    };
    for (const handler of this.listeners.get(type) || []) handler(event);
    return event;
  }
  focus() {
    assert.equal(this.disabled || this.hidden || !this.isConnected, false);
    this.document.activeElement = this;
  }
  showModal() {
    this.open = true;
  }
  close() {
    this.open = false;
    this.emit('close');
  }
  requestClose() {
    const event = this.emit('cancel');
    if (!event.defaultPrevented) this.close();
    return event;
  }
  click() {
    if (!this.disabled) return this.onclick?.();
  }
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function setup(t) {
  const nodes = new Map(),
    events = new Map(),
    requests = [],
    downloads = [],
    library = emptyLibrary();
  const document = { activeElement: null, hidden: false, querySelectorAll: () => [] };
  const node = (id, tag = 'div') => {
    if (!nodes.has(id)) nodes.set(id, new Element(document, tag));
    return nodes.get(id);
  };
  document.getElementById = node;
  document.createElement = (tag) => {
    const element = new Element(document, tag);
    if (tag === 'a')
      element.click = () => {
        downloads.at(-1).name = element.download;
        downloads.at(-1).copyAtClick = node('save-json').value;
        state.beforeDownload?.();
      };
    return element;
  };
  const dialog = node('library-dialog');
  for (const id of [
    'export-session',
    'cancel-attempt-export',
    'export-backup',
    'undo-backup',
    'export-library',
    'undo-library',
    'resume-save',
    'import-save',
    'close-library',
  ])
    dialog.append(node(id, 'button'));
  dialog.append(node('save-json', 'textarea'), node('save-file', 'input'));
  node('cancel-attempt-export').hidden = node('cancel-attempt-export').disabled = true;
  node('save-json').value = 'previous copy';
  const state = {
    source: {
      source: 'stored',
      label: 'Export saved attempt',
      reason: 'Export the saved checkpoint.',
    },
    pauses: 0,
    prepareCalls: 0,
    beforeDownload: null,
    downloadError: null,
  };
  const replacements = {
    document,
    location: { href: 'https://example.test/game/' },
    fetch: async () => ({ ok: true, json: async () => ({ packs: [] }) }),
    addEventListener: (name, handler) => events.set(name, handler),
    setTimeout: () => 0,
  };
  for (const [key, value] of Object.entries(replacements)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() =>
      previous ? Object.defineProperty(globalThis, key, previous) : delete globalThis[key],
    );
  }
  t.mock.method(URL, 'createObjectURL', (blob) => {
    if (state.downloadError) throw state.downloadError;
    downloads.push({ blob });
    return 'blob:owned-attempt';
  });
  const panel = attachLibraryPanel({
    get: () => ({ library, packs: { format: 'xonix-pack-library.v1', packs: [] }, presets: {} }),
    saved: () => null,
    pause: () => state.pauses++,
    attemptExportSource: () => ({ ...state.source }),
    prepareAttemptFile: (options) => {
      state.prepareCalls++;
      const job = deferred();
      requests.push({ ...job, ...options });
      return job.promise;
    },
    suspend: () => assert.fail('The panel must never call the old suspend callback.'),
  });
  panel.open('saves');
  const session = {
    format: 'xonix-session.v1',
    savedAt: '2026-09-12T12:34:56.000Z',
    replay: { level: { name: 'Retained flight' } },
  };
  const prepared = (overrides = {}) => ({
    session: structuredClone(session),
    source: state.source.source,
    context: 'installed-campaign',
    assertCurrent() {},
    ...overrides,
  });
  return {
    panel,
    node,
    state,
    document,
    dialog,
    requests,
    downloads,
    prepared,
    start: () => node('export-session').onclick(),
    pagehide: () => events.get('pagehide')(),
  };
}

test('source labels and unavailability follow the host, without suspending or verifying on refresh', (t) => {
  const h = setup(t);
  assert.equal(h.node('export-session').textContent, 'Export saved attempt');
  h.state.source = {
    source: 'current',
    label: 'Export current attempt',
    reason: 'Current paused flight.',
  };
  h.panel.refresh();
  assert.equal(h.node('export-session').textContent, 'Export current attempt');
  h.state.source = {
    source: null,
    label: 'Export attempt',
    reason: 'Training does not export a campaign attempt.',
  };
  h.panel.refresh();
  assert.equal(h.node('export-session').disabled, true);
  assert.equal(h.node('attempt-export-source').textContent, h.state.source.reason);
  h.start();
  assert.equal(h.state.prepareCalls, 0);
  assert.equal(h.state.pauses, 1, 'Only the existing explicit Library open pauses.');
});

test('one stored export verifies, rechecks authority, copies before the real web adapter, and restores controls', async (t) => {
  const h = setup(t);
  const pending = h.start();
  await h.start();
  assert.equal(h.requests.length, 1);
  assert.equal(h.node('export-library').disabled, true);
  assert.equal(h.node('cancel-attempt-export').disabled, false);
  assert.equal(h.document.activeElement, h.node('cancel-attempt-export'));
  h.panel.refresh();
  assert.equal(h.node('resume-save').disabled, true);
  assert.equal(h.node('cancel-attempt-export').disabled, false);
  h.requests[0].onProgress({ ticks: 120, total: 240 });
  assert.match(h.node('save-status').textContent, /120 \/ 240/);
  let checked = false;
  const prepared = h.prepared({
    assertCurrent() {
      checked = true;
      assert.equal(h.node('save-json').value, 'previous copy');
    },
  });
  h.state.beforeDownload = () => assert.equal(checked, true);
  h.requests[0].resolve(prepared);
  await pending;
  assert.equal(h.downloads.length, 1);
  assert.deepEqual(JSON.parse(h.downloads[0].copyAtClick), prepared.session);
  assert.deepEqual(JSON.parse(await h.downloads[0].blob.text()), prepared.session);
  assert.equal(h.downloads[0].name, 'revealline-suspended-flight.json');
  assert.match(h.node('save-status').textContent, /Saved attempt prepared: Retained flight/);
  assert.match(h.node('save-status').textContent, /Download requested/);
  assert.equal(h.node('cancel-attempt-export').hidden, true);
  assert.equal(h.node('export-library').disabled, false);
  assert.equal(
    h.node('undo-library').disabled,
    true,
    'Existing independent disabled state survives.',
  );
  assert.equal(h.document.activeElement, h.node('export-session'));
  assert.equal(h.state.pauses, 1);
});

test('current replay-only export names its source and retains the matching-campaign warning', async (t) => {
  const h = setup(t);
  h.state.source.source = 'current';
  const pending = h.start();
  h.requests[0].resolve(h.prepared({ context: 'replay-only' }));
  await pending;
  assert.match(h.node('save-status').textContent, /Current attempt prepared/);
  assert.match(h.node('save-status').textContent, /exact matching campaign is still required/);
});

for (const route of ['button', 'Escape', 'controller Back']) {
  test(`${route} cancels verification immediately, keeps the dialog open, and rejects late publication`, async (t) => {
    const h = setup(t),
      pending = h.start(),
      request = h.requests[0];
    if (route === 'button') h.node('cancel-attempt-export').click();
    else if (route === 'Escape') assert.equal(h.dialog.requestClose().defaultPrevented, true);
    else assert.equal(h.panel.cancelAttemptExport(), true);
    assert.equal(request.signal.aborted, true);
    assert.equal(h.dialog.open, true);
    assert.equal(h.document.activeElement, h.node('export-session'));
    assert.equal(h.panel.cancelAttemptExport(), false);
    const cancelled = h.node('save-status').textContent;
    request.onProgress({ ticks: 999, total: 1000 });
    request.resolve(
      h.prepared({
        assertCurrent() {
          assert.fail('Cancelled results are not inspected.');
        },
      }),
    );
    await pending;
    assert.equal(h.node('save-status').textContent, cancelled);
    assert.equal(h.node('save-json').value, 'previous copy');
    assert.equal(h.downloads.length, 0);
    assert.equal(h.state.pauses, 1);
  });
}

for (const route of ['close', 'pagehide']) {
  test(`${route} aborts and suppresses a pending export without restoring focus`, async (t) => {
    const h = setup(t),
      pending = h.start();
    if (route === 'close') h.dialog.close();
    else h.pagehide();
    assert.equal(h.requests[0].signal.aborted, true);
    assert.notEqual(h.document.activeElement, h.node('export-session'));
    h.requests[0].resolve(h.prepared());
    await pending;
    assert.equal(h.node('save-json').value, 'previous copy');
    assert.equal(h.downloads.length, 0);
  });
}

test('a stale host assertion or failed verification preserves the previous copy and permits a fresh attempt', async (t) => {
  const h = setup(t);
  const first = h.start();
  h.requests[0].resolve(
    h.prepared({
      assertCurrent() {
        throw new Error('The saved slot changed.');
      },
    }),
  );
  await first;
  assert.match(h.node('save-status').textContent, /saved slot changed/);
  assert.equal(h.node('save-json').value, 'previous copy');
  const second = h.start();
  h.requests[1].reject(new Error('The checkpoint did not verify.'));
  await second;
  assert.match(h.node('save-status').textContent, /checkpoint did not verify/);
  assert.equal(h.node('save-json').value, 'previous copy');
  assert.equal(h.downloads.length, 0);
});

test('a cancelled operation cannot clear a newer operation or overwrite its status', async (t) => {
  const h = setup(t),
    first = h.start();
  h.panel.cancelAttemptExport();
  const second = h.start();
  h.requests[1].onProgress({ ticks: 20, total: 40 });
  h.requests[0].resolve(h.prepared());
  await first;
  assert.match(h.node('save-status').textContent, /20 \/ 40/);
  assert.equal(h.node('export-library').disabled, true);
  assert.equal(h.node('cancel-attempt-export').hidden, false);
  h.requests[1].resolve(h.prepared());
  await second;
  assert.equal(h.downloads.length, 1);
});

test('adapter failure retains the already verified copy and reports the real error', async (t) => {
  const h = setup(t),
    pending = h.start();
  h.state.downloadError = new Error('Download unavailable in this host.');
  h.requests[0].resolve(h.prepared());
  await pending;
  assert.equal(JSON.parse(h.node('save-json').value).replay.level.name, 'Retained flight');
  assert.match(h.node('save-status').textContent, /Download unavailable/);
  assert.equal(h.node('export-session').disabled, false);
});

test('ordinary library transactions retain their protected cancellation behavior', async (t) => {
  const h = setup(t),
    pending = h.node('export-library').onclick();
  assert.equal(h.panel.cancelAttemptExport(), false);
  assert.equal(h.dialog.requestClose().defaultPrevented, true);
  assert.equal(h.dialog.open, true);
  assert.equal(h.node('cancel-attempt-export').hidden, true);
  await pending;
  assert.equal(h.dialog.requestClose().defaultPrevented, false);
  assert.equal(h.dialog.open, false);
});
