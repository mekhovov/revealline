import { backupSetFixture } from './helpers/backup-set-fixture.mjs';
import { Element as DOMElement } from './helpers/couch-dom.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { attachLibraryPanel } from '../ui/library-panel.mjs';
import { emptyLibrary, exportLibrary } from '../library.mjs';

// Only DOM lifecycle and the browser's download boundary are adapted. The real
// panel, downloadJSON and web platform adapter execute for every export.
class Element extends DOMElement {
  constructor(document, tagName = 'div') {
    super(document, tagName);
    this.document = document;
  }
  remove() {
    if (this.isConnected && this.contains(this.document.activeElement))
      this.document.activeElement = this.document.body;
    super.remove();
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
    assert.equal(this.disabled || !this.getClientRects().length, false);
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

function setup(t, options = {}) {
  const nodes = new Map(),
    events = new Map(),
    frames = [],
    resizeCallbacks = [],
    requests = [],
    downloads = [],
    library = emptyLibrary();
  const document = {
    nodeType: 9,
    activeElement: null,
    hidden: false,
    querySelectorAll: () => [],
    addEventListener() {},
    hasFocus: () => true,
  };
  document.body = new Element(document, 'body');
  document.body.parentNode = document;
  document.activeElement = document.body;
  const node = (id, tag = 'div') => {
    const found = nodes.get(id) || document.body.querySelector('#' + id);
    if (found) return found;
    const created = new Element(document, tag);
    created.id = id;
    nodes.set(id, created);
    document.body.append(created);
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
    'library-operation-cancel',
    'export-backup',
    'undo-backup',
    'export-library',
    'undo-library',
    'resume-save',
    'import-save',
    'close-library',
  ])
    dialog.append(node(id, 'button'));
  node('close-library').setAttribute('data-close', 'library-dialog');
  dialog.append(node('save-json', 'textarea'), node('save-file', 'input'));
  const rail = node('library-operation-rail'),
    message = node('library-operation-message'),
    escapes = node('library-operation-controls'),
    saves = node('library-saves', 'section'),
    packs = node('library-packs', 'section'),
    actions = node('save-actions'),
    backup = node('backup-set', 'section');
  dialog.append(rail, saves, packs);
  rail.append(message, escapes);
  escapes.append(node('library-operation-cancel'));
  saves.append(backup, actions, node('save-status', 'p'));
  actions.append(node('export-session'), node('cancel-attempt-export'), node('export-library'));
  packs.append(
    node('pack-status', 'p'),
    node('pack-file', 'input'),
    node('export-packs', 'button'),
  );
  rail.hidden = true;
  node('library-operation-cancel').hidden = node('library-operation-cancel').disabled = true;
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
    requestAnimationFrame: (callback) => frames.push(callback),
    ResizeObserver: class {
      constructor(callback) {
        resizeCallbacks.push(callback);
      }
      observe() {}
    },
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
    currentSession: () => null,
    ...options,
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
    flushLayout: () => frames.splice(0).forEach((callback) => callback()),
    resizeFeedback: () => resizeCallbacks.forEach((callback) => callback()),
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
  h.requests[0].onProgress({ ticks: 0, total: 0 });
  assert.equal(h.node('save-status').querySelector('progress').hidden, true);
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

test('Stop waiting keeps a requested download protected until the platform returns', async (t) => {
  const h = setup(t),
    pending = h.node('export-library').onclick();
  assert.equal(h.node('library-operation-cancel').textContent, 'Stop waiting');
  assert.equal(h.panel.cancelAttemptExport(), true);
  assert.equal(h.node('save-status').dataset.state, 'detached');
  assert.equal(h.dialog.requestClose().defaultPrevented, true);
  assert.equal(h.dialog.open, true);
  assert.equal(h.node('library-operation-cancel').hidden, true);
  await pending;
  assert.equal(h.dialog.requestClose().defaultPrevented, false);
  assert.equal(h.dialog.open, false);
});

test('verified attempt download offers Stop waiting and reports the actual platform result afterward', async (t) => {
  const h = setup(t),
    pending = h.start();
  h.state.beforeDownload = () => {
    assert.equal(h.node('cancel-attempt-export').textContent, 'Stop waiting');
    assert.equal(h.node('cancel-attempt-export').disabled, false);
    assert.equal(h.panel.cancelAttemptExport(), true);
    assert.equal(h.node('save-status').dataset.state, 'detached');
    assert.equal(h.node('export-library').disabled, true);
    assert.equal(h.dialog.requestClose().defaultPrevented, true);
  };
  h.requests[0].resolve(h.prepared());
  await pending;
  assert.equal(h.node('save-status').dataset.state, 'ready');
  assert.match(h.node('save-status').textContent, /Download requested/);
  assert.equal(h.node('export-library').disabled, false);
  assert.equal(h.downloads.length, 1);
});

for (const action of ['export-backup', 'export-packs', 'import-save']) {
  test(`${action} awaits the external backup guard before preparation or download`, async (t) => {
    const gate = deferred();
    let guarded = 0;
    const h = setup(t, {
      assertExternalBackupSupported: () => {
        guarded++;
        return gate.promise;
      },
      pictureMedia: () => assert.fail('Refused backup must not acquire media.'),
      applyBackup: () => assert.fail('Refused backup must not commit.'),
    });
    if (action === 'import-save')
      h.node('save-json').value = JSON.stringify({ format: 'xonix-backup.v1' });
    const before = h.node('save-json').value;
    const pending = h.node(action).onclick();
    assert.equal(guarded, 1);
    assert.equal(h.downloads.length, 0);
    gate.reject(new Error('External originals require their supported companion backup.'));
    await pending;
    assert.equal(h.downloads.length, 0);
    assert.equal(h.node('save-json').value, before);
    assert.match(
      h.node(action === 'export-packs' ? 'pack-status' : 'save-status').textContent,
      /supported companion/,
    );
  });
}

test('a cancelled Library file read cannot install or unlock a newer read', async (t) => {
  const applied = [];
  const h = setup(t, {
    setLibrary: (value) => {
      applied.push(value);
      return { ok: true };
    },
  });
  const first = deferred(),
    second = deferred();
  h.node('save-file').files = [{ size: 1, text: () => first.promise }];
  const older = h.node('save-file').onchange();
  assert.match(h.node('save-status').textContent, /Reading the selected game-data file/);
  assert.equal(h.node('library-operation-cancel').hidden, false);
  h.panel.cancelAttemptExport();
  h.node('save-file').files = [{ size: 1, text: () => second.promise }];
  const newer = h.node('save-file').onchange();
  first.resolve(exportLibrary(emptyLibrary()));
  await older;
  assert.equal(applied.length, 0);
  assert.equal(h.node('export-library').disabled, true);
  assert.equal(h.node('library-operation-cancel').hidden, false);
  assert.match(h.node('save-status').textContent, /Reading the selected game-data file/);
  second.resolve(exportLibrary(emptyLibrary()));
  await newer;
  assert.equal(applied.length, 1);
  assert.match(h.node('save-status').textContent, /Player library loaded/);
  assert.equal(h.node('export-library').disabled, false);
});

function railState(h, id, cancelId = 'library-operation-cancel') {
  assert.equal(h.node('library-operation-rail').hidden, false);
  assert.equal(h.node('library-operation-rail').dataset.statusId, id);
  assert.equal(h.node(id).parentNode, h.node('library-operation-message'));
  assert.equal(h.node(cancelId).parentNode, h.node('library-operation-controls'));
  assert.equal(h.document.body.querySelectorAll('#' + id).length, 1);
  assert.equal(h.document.body.querySelectorAll('#' + cancelId).length, 1);
}

test('rail places the exact status and escape before a held read; navigation restores their original nodes', async (t) => {
  const h = setup(t),
    gate = deferred(),
    original = h.node('save-status');
  h.node('save-file').files = [{ size: 1, text: () => gate.promise }];
  const pending = h.node('save-file').onchange();
  railState(h, 'save-status');
  assert.match(original.textContent, /Reading the selected game-data file/);
  assert.equal(h.node('save-json').value, 'previous copy');
  h.panel.cancelAttemptExport();
  h.panel.open('packs');
  assert.equal(h.node('library-operation-rail').hidden, true);
  assert.equal(original.parentNode, h.node('library-saves'));
  gate.resolve('must never parse this cancelled read');
  await pending;
  assert.equal(h.node('library-operation-rail').hidden, true);
  assert.equal(h.node('save-json').value, 'previous copy');
});

test('older cancelled read cannot replace a newer Packs rail or release its controls', async (t) => {
  const h = setup(t),
    first = deferred(),
    second = deferred();
  h.node('save-file').files = [{ size: 1, text: () => first.promise }];
  const older = h.node('save-file').onchange();
  h.panel.cancelAttemptExport();
  h.panel.open('packs');
  h.node('pack-file').files = [{ size: 1, text: () => second.promise }];
  const newer = h.node('pack-file').onchange();
  railState(h, 'pack-status');
  first.resolve('cancelled bytes');
  await older;
  railState(h, 'pack-status');
  assert.equal(h.node('library-operation-cancel').hidden, false);
  assert.equal(h.node('export-library').disabled, true);
  assert.match(h.node('pack-status').textContent, /Reading the selected pack file/);
  second.reject(new Error('Native file read failed.'));
  await newer;
  railState(h, 'pack-status');
  assert.match(h.node('pack-status').textContent, /Native file read failed/);
  assert.equal(h.node('library-operation-cancel').hidden, true);
  assert.equal(h.node('save-json').value, 'previous copy');
});

test('attempt rail preserves count, cancel focus and exact sibling order across terminal navigation', async (t) => {
  const h = setup(t),
    status = h.node('save-status'),
    cancel = h.node('cancel-attempt-export');
  const originalOrder = [...h.node('save-actions').children];
  const pending = h.start();
  railState(h, 'save-status', 'cancel-attempt-export');
  assert.equal(h.document.activeElement, cancel);
  assert.equal(h.node('library-operation-cancel').hidden, true);
  h.requests[0].onProgress({ ticks: 3, total: 10 });
  assert.match(status.textContent, /3 \/ 10/);
  // Presenting the already selected current owner must not detach focused Cancel.
  h.panel.open('saves');
  assert.equal(h.document.activeElement, cancel);
  assert.equal(cancel.parentNode, h.node('library-operation-controls'));
  h.panel.cancelAttemptExport();
  assert.equal(h.document.activeElement, h.node('export-session'));
  h.requests[0].resolve(h.prepared());
  await pending;
  h.panel.open('packs');
  assert.equal(h.node('library-operation-rail').hidden, true);
  assert.deepEqual(h.node('save-actions').children, originalOrder);
  assert.equal(status.parentNode, h.node('library-saves'));
  assert.equal(cancel.hidden, true);
  assert.equal(h.downloads.length, 0);
});

test('non-abortable owner reopens with its exact detached status and no stale closed rail', async (t) => {
  const h = setup(t),
    pending = h.node('export-library').onclick();
  railState(h, 'save-status');
  h.dialog.close();
  assert.equal(h.node('library-operation-rail').hidden, true);
  assert.equal(h.node('save-status').parentNode, h.node('library-saves'));
  h.panel.open('saves');
  railState(h, 'save-status');
  assert.equal(h.node('save-status').dataset.state, 'detached');
  assert.equal(h.node('library-operation-cancel').hidden, true);
  assert.equal(h.node('export-library').disabled, true);
  await pending;
  railState(h, 'save-status');
  assert.equal(h.node('save-status').dataset.state, 'ready');
  assert.equal(h.node('export-library').disabled, false);
  h.dialog.close();
  h.panel.open('saves');
  assert.equal(h.node('library-operation-rail').hidden, true);
  assert.equal(h.node('save-status').parentNode, h.node('library-saves'));
});

for (const route of ['same-section', 'other-section', 'close-reopen']) {
  test(`backup navigation ${route} joins cancellation then clears only the invalidated backup host`, async (t) => {
    const fixture = await backupSetFixture(),
      gate = deferred(),
      entered = deferred();
    const h = setup(t, {
      base: () => ({ campaign: fixture.f.campaign, classRecipes: [] }),
      backupSet: {
        ...fixture.source,
        readContents: async () => fixture.contents,
        readMetadata: () => {
          entered.resolve();
          return gate.promise;
        },
      },
    });
    const status = h.node('backup-set-status'),
      cancel = h.node('cancel-backup-set');
    const originalOrder = [...h.node('backup-set').children];
    const pending = h.node('prepare-backup-set').onclick();
    await entered.promise;
    railState(h, 'backup-set-status', 'cancel-backup-set');
    assert.equal(h.document.activeElement, cancel);
    if (route === 'close-reopen') {
      h.dialog.close();
      assert.equal(h.node('library-operation-rail').hidden, true);
      assert.equal(status.parentNode, h.node('backup-set'));
    }
    h.panel.open(route === 'other-section' ? 'packs' : 'saves');
    railState(h, 'backup-set-status', 'cancel-backup-set');
    assert.equal(
      await h.node('prepare-backup-set').onclick(),
      false,
      'The cancelled unfinished read still owns its existing slot.',
    );
    gate.resolve(fixture.metadata);
    assert.equal(await pending, false);
    assert.equal(h.node('library-operation-rail').hidden, true);
    assert.equal(h.node('library-operation-rail').dataset.statusId, undefined);
    assert.deepEqual(h.node('backup-set').children, originalOrder);
    assert.equal(status.parentNode, h.node('backup-set'));
    assert.equal(cancel.hidden, true);
    assert.notEqual(h.document.activeElement, cancel);
    assert.equal(h.node('export-library').disabled, false);
    assert.equal(h.downloads.length, 0);
    assert.equal(h.node('save-json').value, 'previous copy');
  });
}

test('native-reported sticky overlap scrolls the live focused control clear without changing focus or ownership', async (t) => {
  const h = setup(t),
    pending = h.start();
  h.requests[0].resolve(h.prepared());
  await pending;
  const rail = h.node('library-operation-rail'),
    target = h.node('export-backup');
  h.dialog._rect = { x: 16, y: 0, width: 812, height: 390 };
  rail._rect = { x: 51.75, y: 33.75, width: 740.5, height: 192 };
  target._rect = { x: 51.75, y: 171.421875, width: 270, height: 47 };
  h.dialog.scrollTop = 548;
  target.focus();
  h.dialog.emit('focusin');
  h.flushLayout();
  assert.equal(h.dialog.scrollTop, 485.671875);
  assert.equal(h.dialog.style.scrollPaddingBlockStart, '233.75px');
  assert.equal(h.document.activeElement, target);
  assert.equal(h.state.prepareCalls, 1);
  assert.equal(h.downloads.length, 1);
  assert.match(h.node('save-status').textContent, /Download requested/);
});

test('a queued feedback layout reads current focus and cannot follow an old opener or a closed dialog', async (t) => {
  const h = setup(t),
    pending = h.start();
  h.dialog._rect = { x: 0, y: 0, width: 844, height: 390 };
  h.node('library-operation-rail')._rect = { x: 0, y: 30, width: 740, height: 190 };
  h.dialog.scrollTop = 400;
  h.flushLayout();
  assert.equal(h.dialog.scrollTop, 400, 'Active Cancel inside the rail is not scrolled.');
  h.resizeFeedback();
  h.document.activeElement = h.document.body;
  h.flushLayout();
  assert.equal(h.dialog.scrollTop, 400, 'A different screen owns the live focus.');
  h.resizeFeedback();
  h.document.activeElement = h.node('export-backup');
  assert.equal(h.node('export-backup').disabled, true);
  h.flushLayout();
  assert.equal(h.dialog.scrollTop, 400, 'A disabled opener cannot cause scrolling.');
  h.resizeFeedback();
  h.dialog.close();
  h.flushLayout();
  assert.equal(h.dialog.style.scrollPaddingBlockStart, '0px');
  assert.equal(h.dialog.scrollTop, 400);
  assert.equal(h.node('library-operation-rail').hidden, true);
  h.requests[0].resolve(h.prepared());
  await pending;
  assert.equal(h.downloads.length, 0);
});

test('Close above feedback retains its own native scroll destination', async (t) => {
  const h = setup(t),
    pending = h.start();
  h.requests[0].resolve(h.prepared());
  await pending;
  h.dialog._rect = { x: 0, y: 0, width: 844, height: 390 };
  h.node('library-operation-rail')._rect = { x: 0, y: 30, width: 740, height: 190 };
  const close = h.node('close-library');
  close._rect = { x: 780, y: -538, width: 44, height: 44 };
  close.focus();
  h.dialog.emit('focusin');
  h.flushLayout();
  assert.equal(close.scrolled, 1);
  assert.equal(h.dialog.style.scrollPaddingBlockStart, '0px');
  assert.equal(h.document.activeElement, close);
});

test('a tall Library editor keeps its beginning below feedback when its full height cannot fit', async (t) => {
  const h = setup(t),
    pending = h.start();
  h.requests[0].resolve(h.prepared());
  await pending;
  h.dialog._rect = { x: 16, y: 0, width: 812, height: 390 };
  h.node('library-operation-rail')._rect = { x: 51.75, y: 33.75, width: 740.5, height: 192 };
  const editor = h.node('save-json');
  editor._rect = { x: 51.75, y: 300, width: 700, height: 170 };
  h.dialog.scrollTop = 300;
  editor.focus();
  h.dialog.emit('focusin');
  h.flushLayout();
  assert.equal(h.dialog.scrollTop, 366.25);
  assert.equal(h.document.activeElement, editor);
  assert.equal(300 - (h.dialog.scrollTop - 300), 233.75);
  assert.equal(h.state.prepareCalls, 1);
});
