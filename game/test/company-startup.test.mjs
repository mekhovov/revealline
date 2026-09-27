import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { attachInstallOfflinePanel } from '../ui/install-offline-panel.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { loadCompanyStartup } from '../ui/company-startup.mjs';
import { loadRuntimeContentProvider } from '../runtime-content-provider.mjs';
import { retainedEditionFixture } from './helpers/retained-edition-fixture.mjs';
const scope = 'https://example.test/releases/v-test/site/';
function fixture({ controlled = true, needsDownload = false } = {}) {
  const events = [],
    doc = new EventTarget(),
    win = new EventTarget(),
    sw = new EventTarget();
  doc.hidden = false;
  const worker = { scriptURL: new URL('service-worker.js', scope).href };
  sw.controller = controlled ? worker : null;
  const registration = { scope, active: worker, waiting: null, installing: null };
  sw.getRegistration = async () => registration;
  win.RevealLineBoot = {
    suspendInput() {
      events.push('suspend');
      return () => events.push('release');
    },
  };
  let signal, panelOptions;
  const options = {
    documentRef: doc,
    windowRef: win,
    navigatorRef: { serviceWorker: sw },
    locationRef: { href: new URL('game/index.html?edition=sample-public', scope).href },
    availability: { available: true, packageConsent: true, scope, buildId: 'a'.repeat(64) },
    createAccess({ requestPackage }) {
      return {
        async ensure(id, o) {
          events.push('ensure:' + id);
          signal = o.signal;
          assert.equal(o.retain, true);
          if (needsDownload) await requestPackage({ groupId: id, signal: o.signal });
          o.signal.throwIfAborted();
        },
      };
    },
    createPanel(o) {
      panelOptions = o;
      return {
        async requestPackage(request) {
          events.push('request');
          o.onOpen();
          assert.equal(o.canActivate(), false);
          request.signal.throwIfAborted();
          o.onClose();
        },
        dispose() {
          events.push('dispose');
          assert.equal(signal.aborted, true);
        },
      };
    },
    checkCore: async () => {
      events.push('check');
      return { status: 'ready', buildId: 'a'.repeat(64) };
    },
    loadProvider: async ({ ensurePackage, signal }) => {
      await ensurePackage('company:sample-public');
      signal.throwIfAborted();
      events.push('provider');
      return { ok: true };
    },
  };
  return {
    options,
    events,
    doc,
    win,
    sw,
    registration,
    worker,
    get signal() {
      return signal;
    },
    get panelOptions() {
      return panelOptions;
    },
  };
}
test('cached admission pins exact package and verifies controlling worker without a dialog', async () => {
  const f = fixture();
  assert.deepEqual(await loadCompanyStartup(f.options), { ok: true });
  assert.deepEqual(f.events, ['ensure:company:sample-public', 'check', 'provider']);
  assert.equal(f.signal.aborted, true);
});
test('explicit preparation yields boot ownership and always settles before disposal', async () => {
  const f = fixture({ needsDownload: true });
  await loadCompanyStartup(f.options);
  assert.deepEqual(f.events, [
    'ensure:company:sample-public',
    'request',
    'suspend',
    'release',
    'check',
    'provider',
    'dispose',
  ]);
});
test('uncontrolled cached bytes cannot trigger ordinary asset reads or forced activation', async () => {
  const f = fixture({ controlled: false });
  await assert.rejects(loadCompanyStartup(f.options), /Reload this page/);
  assert.deepEqual(f.events, [
    'ensure:company:sample-public',
    'request',
    'suspend',
    'release',
    'dispose',
  ]);
  assert.equal(f.sw.controller, null);
});
for (const mismatch of ['scope', 'worker', 'waiting', 'identity'])
  test('wrong ' + mismatch + ' fails closed without provider continuation', async () => {
    const f = fixture();
    if (mismatch === 'scope') f.registration.scope = 'https://example.test/other/';
    if (mismatch === 'worker') f.worker.scriptURL = 'https://example.test/other/service-worker.js';
    if (mismatch === 'waiting') f.registration.waiting = {};
    if (mismatch === 'identity')
      f.options.checkCore = async () => ({ status: 'ready', buildId: 'b'.repeat(64) });
    await assert.rejects(loadCompanyStartup(f.options), /Reload this page/);
    assert.ok(!f.events.includes('provider'));
  });
test('worker transition during provider loading cancels remaining asset work', async () => {
  const f = fixture();
  f.options.loadProvider = async ({ ensurePackage, signal }) => {
    await ensurePackage('company:sample-public');
    f.sw.dispatchEvent(new Event('controllerchange'));
    signal.throwIfAborted();
    throw Error('unreachable');
  };
  await assert.rejects(loadCompanyStartup(f.options), { name: 'AbortError' });
});
test('pagehide settles pending consent before disposal and never continues provider', async () => {
  const f = fixture({ needsDownload: true });
  f.options.createPanel = (o) => ({
    requestPackage({ signal }) {
      o.onOpen();
      queueMicrotask(() => f.win.dispatchEvent(new Event('pagehide')));
      return new Promise((resolve, reject) =>
        signal.addEventListener('abort', () => reject(signal.reason), { once: true }),
      );
    },
    dispose() {
      f.events.push('dispose');
      assert.equal(f.signal.aborted, true);
    },
  });
  await assert.rejects(loadCompanyStartup(f.options), { name: 'AbortError' });
  assert.ok(!f.events.includes('provider'));
  assert.equal(f.events.at(-1), 'release');
});
test('empty exact package does not require a worker or dialog', async () => {
  const f = fixture({ controlled: false });
  f.options.loadProvider = async ({ ensurePackage }) =>
    ensurePackage('company:empty', { requiresAssets: false });
  await loadCompanyStartup(f.options);
  assert.deepEqual(f.events, ['ensure:company:empty']);
});
test('development/native/legacy contract does not perform package or worker work', async () => {
  const f = fixture();
  f.options.availability = { available: false };
  await loadCompanyStartup(f.options);
  assert.deepEqual(f.events, ['provider']);
});
test('provider admits exact current/retained identity before assets and bypasses standalone', async () => {
  const f = await retainedEditionFixture({ originalArtwork: true });
  f.replacePicture();
  for (const retained of [null, f.descriptor.id]) {
    const order = [];
    const result = await loadRuntimeContentProvider({
      documentRef: { documentElement: { dataset: {} } },
      locationRef: {
        href:
          'http://localhost/game/index.html?edition=sample-public' +
          (retained ? '&presentation=' + retained : ''),
      },
      fetcher: f.fetcher,
      ensurePackage: async (id, o) => {
        order.push(id);
        assert.equal(o.requiresAssets, true);
        assert.equal(o.retain, true);
      },
      verifyAssets: async () => order.push('assets'),
    });
    assert.deepEqual(order, ['company:sample-public' + (retained ? ':' + retained : ''), 'assets']);
    assert.equal(result.retainedPresentationId, retained);
  }
  let calls = 0;
  await loadRuntimeContentProvider({
    documentRef: { documentElement: { dataset: { editionId: 'sample-public' } } },
    locationRef: { href: 'http://localhost/game/index.html' },
    fetcher: f.fetcher,
    ensurePackage: async () => {
      calls++;
    },
    verifyAssets: async () => {},
  });
  assert.equal(calls, 0);
});
test('canceled or rejected provider admission performs zero asset verification', async () => {
  const f = await retainedEditionFixture({ originalArtwork: true });
  for (const cancelled of [false, true]) {
    const controller = new AbortController();
    let verified = 0;
    await assert.rejects(
      loadRuntimeContentProvider({
        documentRef: { documentElement: { dataset: {} } },
        locationRef: { href: 'http://localhost/game/index.html?edition=sample-public' },
        fetcher: f.fetcher,
        signal: controller.signal,
        ensurePackage: async () => {
          if (cancelled) controller.abort();
          else throw Error('declined');
        },
        verifyAssets: async () => {
          verified++;
        },
      }),
    );
    assert.equal(verified, 0);
  }
});

test('tool admission verifies the actual document marker scope, not the canonical game URL', async () => {
  const f = fixture();
  const tool = {
    href: new URL('game/replay-theater/index.html?edition=sample-public', scope).href,
  };
  f.doc.defaultView = { location: tool };
  f.options.checkCore = async ({ locationRef }) => {
    assert.equal(locationRef, tool);
    return { status: 'ready', buildId: 'a'.repeat(64) };
  };
  await loadCompanyStartup(f.options);
});

test('real preparation panel stays inside the visible boot root and leaves gameplay concealed', async () => {
  const f = fixture({ needsDownload: true });
  const doc = new Document(),
    win = new Events();
  win.location = new URL(f.options.locationRef.href);
  win.navigator = {};
  win.matchMedia = () => ({ matches: false });
  const boot = doc.createElement('section');
  boot.setAttribute('id', 'boot-screen');
  doc.body.append(boot);
  const gameplay = doc.createElement('main');
  gameplay.inert = true;
  doc.body.append(gameplay);
  doc.documentElement.dataset.bootState = 'loading';
  win.RevealLineBoot = f.win.RevealLineBoot;
  f.options.createPanel = (o) =>
    attachInstallOfflinePanel({ ...o, downloadsURL: new URL('downloads.html', win.location) });
  f.options.documentRef = doc;
  f.options.windowRef = win;
  const pending = loadCompanyStartup(f.options);
  await Promise.resolve();
  const dialog = doc.getElementById('install-offline-dialog');
  assert.ok(dialog?.open);
  assert.equal(dialog.parentElement, boot);
  assert.equal(gameplay.inert, true);
  assert.equal(doc.documentElement.dataset.bootState, 'loading');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /body > :not\(#boot-screen\):not\(script\)/);
  const frame = dialog.querySelector('iframe');
  frame.contentWindow = { postMessage() {} };
  win.emit('message', {
    origin: win.location.origin,
    source: frame.contentWindow,
    data: {
      format: 'revealline.offline-panel.v1',
      action: 'packages-ready',
      groups: ['company:sample-public'],
    },
  });
  await pending;
  assert.equal(doc.getElementById('install-offline-dialog'), null);
  assert.equal(gameplay.inert, true);
  assert.deepEqual(
    f.events.filter((e) => ['suspend', 'release'].includes(e)),
    ['suspend', 'release'],
  );
});
