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
    packaged: options.packaged ?? true,
    unavailable: options.unavailable,
    onOpen: () => calls.opened++,
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
