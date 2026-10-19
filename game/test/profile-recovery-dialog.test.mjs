import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { attachProfileRecoveryDialog } from '../ui/profile-recovery-dialog.mjs';
import { attachProfileRecoveryView } from '../ui/profile-recovery.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const turn = () => new Promise((resolve) => setImmediate(resolve));

function fixture(options = {}) {
  const doc = new Document(),
    win = new Events();
  const add = (tag, id, parent = doc.body) => {
    const node = doc.createElement(tag);
    node.id = id;
    parent.append(node);
    return node;
  };
  const settings = add('dialog', 'settings-dialog');
  settings.open = true;
  const dialog = add('dialog', 'profile-recovery-dialog');
  let nativeCloses = 0;
  dialog.showModal = () => {
    dialog.open = true;
    options.afterNativeOpen?.({ dialog });
  };
  dialog.close = () => {
    dialog.open = false;
    nativeCloses++;
  };
  for (const match of html.matchAll(/<([\w-]+)[^>]*\bid="(profile-recovery-[^"]+)"[^>]*>/g)) {
    if (match[2] === dialog.id) continue;
    const node = add(match[1], match[2], match[2] === 'profile-recovery-open' ? settings : dialog);
    node.hidden = /\bhidden\b/.test(match[0]);
    node.disabled = /\bdisabled\b/.test(match[0]);
  }
  const $ = (id) => doc.getElementById(`profile-recovery-${id}`);
  const calls = { loads: 0, catalogs: [], readers: [], closes: 0, opened: 0 },
    revoked = [];
  const channel = Object.freeze({ id: 'release-v0.42.0', version: 'v0.42.0' });
  const reader = {
    discover: async () => ({ channels: [channel], diagnostics: [] }),
    review: async () => ({
      channel,
      profile: { status: 'absent' },
      saved: { status: 'absent' },
      diagnostics: [],
    }),
    exportStoredData: async () => ({
      blob: new Blob(['raw']),
      filename: 'stored.json',
      completeStoredSnapshot: true,
    }),
    close: async () => {
      calls.closes++;
    },
    ...options.reader,
  };
  const runtime = {
    async loadCatalogs(version, args) {
      calls.catalogs.push({ version, args });
      return options.catalogs ? options.catalogs(version, args) : [{ channelId: channel.id }];
    },
    createReader(args) {
      calls.readers.push(args);
      return reader;
    },
    attachView(args) {
      return attachProfileRecoveryView({
        ...args,
        createURL: () => 'blob:owned',
        revokeURL: (url) => revoked.push(url),
      });
    },
  };
  const host = attachProfileRecoveryDialog({
    document: doc,
    window: win,
    currentVersion: 'v0.42.0',
    editionId: options.editionId,
    packaged: options.packaged ?? true,
    resolveSourceVersion: options.resolveSourceVersion,
    unavailable: options.unavailable,
    onOpen: () => {
      calls.opened++;
      options.onOpen?.({ doc, settings, dialog });
    },
    onPresentationChange: options.onPresentationChange,
    load: () => {
      calls.loads++;
      return options.load ? options.load(runtime) : runtime;
    },
  });
  return {
    doc,
    win,
    settings,
    dialog,
    $,
    host,
    calls,
    reader,
    revoked,
    nativeCloses: () => nativeCloses,
  };
}

test('Settings recovery stays lazy, uses the supplied version and keeps Settings underneath', async () => {
  const h = fixture();
  assert.equal(h.calls.loads, 0);
  assert.equal(h.$('open').disabled, false);
  assert.equal(await h.$('open').onclick(), true);
  assert.equal(h.dialog.open, true);
  assert.equal(h.settings.open, true);
  assert.equal(h.calls.catalogs[0].version, 'v0.42.0');
  assert.equal(h.calls.readers[0].currentVersion, 'v0.42.0');
  assert.equal(h.calls.readers[0].recoveryCatalogs[0].channelId, 'release-v0.42.0');
  assert.equal(h.calls.opened, 1);
  await h.$('back').onclick();
  assert.equal(h.dialog.open, false);
  assert.equal(h.settings.open, true);
  assert.equal(h.doc.activeElement, h.$('open'));
  assert.equal(h.calls.closes, 1);
});

test('native child close refreshes entry without bypassing busy restrictions or retaining a disposed listener', async () => {
  let reason = 'Finish the pending save first.',
    checks = 0;
  const h = fixture({ unavailable: () => (checks++, reason) });
  const child = h.doc.createElement('dialog');
  h.doc.body.append(child);
  child.showModal();
  child.close();
  assert.equal(h.$('open').disabled, true);
  assert.equal(h.$('entry-status').textContent, reason);
  reason = '';
  child.showModal();
  child.close();
  assert.equal(h.$('open').disabled, false);
  assert.equal(h.calls.loads, 0, 'Returning does not open or prepare recovery');
  await h.host.open();
  child.showModal();
  child.close();
  assert.equal(h.$('open').disabled, true, 'The current recovery reader still owns entry');
  await h.host.close();
  h.settings.open = false;
  const hiddenChecks = checks;
  child.showModal();
  child.close();
  assert.equal(checks, hiddenChecks, 'Closed Settings does not refresh unrelated tools');
  h.settings.open = true;
  await h.host.dispose();
  const disposedChecks = checks;
  child.showModal();
  child.close();
  assert.equal(checks, disposedChecks);
});

test('Escape and Back join pending reader cleanup and revoke raw URLs before native close', async () => {
  const pending = deferred();
  let closes = 0;
  const h = fixture({
    reader: {
      close: () => {
        closes++;
        return pending.promise;
      },
    },
  });
  await h.host.open();
  await h.$('find').onclick();
  await h.$('review').onclick();
  await h.$('export').onclick();
  const back = h.$('back').onclick();
  const escape = h.dialog.emit('cancel');
  const closing = h.host.close();
  assert.equal(escape.defaultPrevented, true);
  await turn();
  assert.equal(closes, 1);
  assert.deepEqual(h.revoked, ['blob:owned']);
  assert.equal(h.nativeCloses(), 0);
  assert.equal(h.settings.open, true);
  pending.resolve();
  await Promise.all([back, closing]);
  assert.equal(h.nativeCloses(), 1);
  assert.equal(h.doc.activeElement, h.$('open'));
});

test('closing during module loading prevents late reader creation and a later open is fresh', async () => {
  const pending = deferred();
  let runtime;
  const h = fixture({
    load: (value) => {
      runtime = value;
      return pending.promise;
    },
  });
  const opening = h.host.open();
  await turn();
  await h.host.close();
  assert.equal(h.nativeCloses(), 1);
  pending.resolve(runtime);
  await opening;
  await turn();
  assert.equal(h.calls.readers.length, 0);
  await h.host.open();
  assert.equal(h.calls.readers.length, 1);
  await h.host.close();
});

test('failed catalog leaves raw discovery, review and explicit native export usable', async () => {
  const h = fixture({
    catalogs: async () => {
      throw new Error('Pinned catalog unavailable');
    },
  });
  await h.host.open();
  assert.deepEqual(h.calls.readers[0].recoveryCatalogs, []);
  assert.match(
    h.$('catalog-status').textContent,
    /Pinned catalog unavailable.*Raw profile diagnostics/,
  );
  await h.$('find').onclick();
  await h.$('review').onclick();
  await h.$('export').onclick();
  assert.equal(h.$('download').href, 'blob:owned');
  assert.equal(h.$('download').download, 'stored.json');
  assert.equal(h.$('originals-review').disabled, true);
  await h.host.close();
});

test('unbuilt host keeps raw diagnostics and never requests or grants a historical catalog', async () => {
  const h = fixture({ packaged: false });
  await h.host.open();
  assert.equal(h.calls.catalogs.length, 0);
  assert.deepEqual(h.calls.readers[0].recoveryCatalogs, []);
  assert.match(h.$('catalog-status').textContent, /packaged release/);
  assert.equal(h.$('find').disabled, false);
  await h.host.close();
});

test('incompatible operation disables entry without cancelling or replacing that operation', async () => {
  let reason = 'Finish pending import';
  const h = fixture({ unavailable: () => reason });
  assert.equal(h.$('open').disabled, true);
  assert.equal(await h.host.open(), false);
  assert.equal(h.calls.loads, 0);
  assert.equal(h.calls.opened, 0);
  reason = '';
  h.host.refresh();
  assert.equal(h.$('open').disabled, false);
  h.settings.open = false;
  assert.equal(await h.host.open(), false);
  h.settings.open = true;
  await h.host.open();
  await h.host.close();
});

test('blur cancels catalog loading; pagehide closes without allowing a late reader', async () => {
  const pending = deferred();
  let signal;
  const h = fixture({
    catalogs: (_version, args) => {
      signal = args.signal;
      return pending.promise;
    },
  });
  const opening = h.host.open();
  await turn();
  h.win.emit('blur');
  assert.equal(signal.aborted, true);
  assert.equal(h.dialog.open, true);
  h.win.emit('pagehide');
  await h.host.close();
  pending.resolve([]);
  await opening;
  await turn();
  assert.equal(h.calls.readers.length, 0);
  assert.equal(h.dialog.open, false);
});

test('current writer refusal remains visible without a fallback reader or lock bypass', async () => {
  const h = fixture({
    reader: {
      review: async () => {
        throw new Error('This profile is busy. Close its game tab before reviewing it.');
      },
    },
  });
  await h.host.open();
  await h.$('find').onclick();
  await h.$('review').onclick();
  assert.match(h.$('status').textContent, /profile is busy/);
  assert.equal(h.$('export').disabled, true);
  assert.equal(h.calls.readers.length, 1);
  assert.equal(h.$('find').disabled, false);
  await h.host.close();
});

test('source recovery resolves its comparison version only on entry without granting catalog authority', async () => {
  let reads = 0;
  const h = fixture({
    packaged: false,
    resolveSourceVersion: async () => {
      reads++;
      return '0.50.0';
    },
  });
  assert.equal(reads, 0);
  await h.host.open();
  assert.equal(reads, 1);
  assert.equal(h.calls.readers[0].currentVersion, '0.50.0');
  assert.deepEqual(h.calls.readers[0].recoveryCatalogs, []);
  assert.equal(h.calls.catalogs.length, 0);
  await h.host.close();
  const packaged = fixture({
    resolveSourceVersion: () => {
      throw new Error('Packaged identity must not use source configuration');
    },
  });
  await packaged.host.open();
  assert.equal(packaged.calls.readers[0].currentVersion, 'v0.42.0');
  await packaged.host.close();
});

test('closing while source-version resolution is pending prevents late reader creation', async () => {
  const pending = deferred();
  const h = fixture({ packaged: false, resolveSourceVersion: () => pending.promise });
  const opening = h.host.open();
  await turn();
  await h.host.close();
  pending.resolve('0.50.0');
  assert.equal(await opening, false);
  await turn();
  assert.equal(h.calls.loads, 0);
  assert.equal(h.calls.readers.length, 0);
  assert.equal(h.dialog.open, false);
});

test('edition recovery binds its reader without fetching unrelated historical catalogs', async () => {
  const h = fixture({ editionId: 'coupa-all' });
  await h.host.open();
  assert.equal(h.calls.readers[0].editionId, 'coupa-all');
  assert.deepEqual(h.calls.readers[0].recoveryCatalogs, []);
  assert.deepEqual(h.calls.catalogs, []);
  await h.host.close();
});

test('recovery presentation commits once after native open and preserves rejected and repeated attempts', async (t) => {
  let presentations = 0,
    h;
  h = fixture({
    onPresentationChange: () => {
      presentations++;
      assert.equal(h.dialog.open, true);
      assert.equal(h.settings.open, true);
      assert.equal(h.doc.activeElement === h.$('back'), true);
    },
  });
  t.after(() => h.host.dispose());
  assert.equal(presentations, 0);
  const first = h.host.open();
  assert.equal(presentations, 1);
  assert.equal(await h.host.open(), false);
  assert.equal(presentations, 1);
  await first;
  await h.host.close();
  assert.equal(presentations, 1);
  await h.host.open();
  assert.equal(presentations, 2);
  await h.host.close();
  h.settings.close();
  assert.equal(await h.host.open(), false);
  assert.equal(presentations, 2);
});

test('recovery does not notify when its pre-open owner rejects admission', async (t) => {
  let presentations = 0;
  const h = fixture({
    onOpen: ({ settings }) => settings.close(),
    onPresentationChange: () => presentations++,
  });
  t.after(() => h.host.dispose());
  assert.equal(await h.host.open(), false);
  assert.equal(h.dialog.open, false);
  assert.equal(h.calls.loads, 0);
  assert.equal(presentations, 0);
});

test('recovery retires a committed native open when public Back immediately returns to Settings', async (t) => {
  let presentations = 0,
    closing;
  const h = fixture({
    afterNativeOpen: () => {
      closing = h.$('back').onclick();
    },
    onPresentationChange: () => presentations++,
  });
  t.after(() => h.host.dispose());
  assert.equal(await h.host.open(), false);
  assert.equal(typeof closing?.then, 'function');
  await closing;
  assert.equal(h.dialog.open, false);
  assert.equal(presentations, 1);
});
