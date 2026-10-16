import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCompanyStartup } from '../ui/company-startup.mjs';
import { loadRuntimeContentProvider } from '../runtime-content-provider.mjs';
import { retainedEditionFixture } from './helpers/retained-edition-fixture.mjs';

for (const controlled of [false, true])
  test(`company startup requires no install dialog or controlling worker: controlled=${controlled}`, async () => {
    const documentRef = new EventTarget(),
      windowRef = new EventTarget();
    let assets = 0;
    const result = await loadCompanyStartup({
      documentRef,
      windowRef,
      locationRef: { href: 'https://game.test/game/?edition=sample-public' },
      availability: {
        available: true,
        packageConsent: true,
        scope: 'https://game.test/',
        version: 'test',
      },
      navigatorRef: {
        serviceWorker: {
          controller: controlled ? {} : null,
          getRegistration: () => assert.fail('Online play must not require worker registration'),
        },
      },
      createPanel: () => assert.fail('Online play must not open the offline popup'),
      checkCore: () => assert.fail('Online play must not verify the offline core'),
      loadProvider: async ({ ensurePackage, signal }) => {
        await ensurePackage('company:sample-public');
        signal.throwIfAborted();
        assets++;
        return { online: true };
      },
    });
    assert.deepEqual(result, { online: true });
    assert.equal(assets, 1);
  });

test('leaving company startup still cancels its ordinary asset loading', async () => {
  const windowRef = new EventTarget();
  await assert.rejects(
    loadCompanyStartup({
      documentRef: new EventTarget(),
      windowRef,
      availability: { available: false },
      loadProvider: async ({ ensurePackage, signal }) => {
        await ensurePackage('company:sample-public');
        windowRef.dispatchEvent(new Event('pagehide'));
        signal.throwIfAborted();
      },
    }),
    { name: 'AbortError' },
  );
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
