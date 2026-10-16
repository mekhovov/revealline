import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureVersusEntryPackage } from '../couch/versus-package-readiness.mjs';

function fixture({ packageConsent = true, ensure, controller = new AbortController() } = {}) {
  const entry = {},
    owner = {},
    owners = new WeakMap([[entry, owner]]),
    calls = [],
    reader = {
      presentationOwner() {
        calls.push('official-reader');
        throw new Error('official reader must not inspect Creator content');
      },
    },
    downloads = {
      async ensure(group, options) {
        calls.push(['ensure', group, options]);
        await ensure?.({ entry, owner, owners });
      },
      async ensureMission() {
        throw new Error('mission package must not replace Creator ownership');
      },
      async ensureClassic() {
        throw new Error('classic package must not replace Creator ownership');
      },
    },
    options = { signal: controller.signal };
  return {
    calls,
    options,
    run: () =>
      ensureVersusEntryPackage(entry, {
        options,
        packageConsent,
        creatorOwnerFor: (row) => owners.get(row),
        candidateJourney: null,
        authoredRouteId: 'unused',
        shippedMaps: [],
        downloads,
        reader,
        isOfficialPack: () => true,
      }),
  };
}

test('Creator Versus keeps consent gating and retains only the shared runtime', async () => {
  const disabled = fixture({ packageConsent: false });
  await disabled.run();
  assert.deepEqual(disabled.calls, []);

  const enabled = fixture();
  await enabled.run();
  assert.deepEqual(enabled.calls, [['ensure', 'runtime:versus', enabled.options]]);
});

test('a missing Creator Versus runtime fails without consulting the official reader', async () => {
  const context = fixture({
    ensure: async () => {
      throw new Error('runtime missing');
    },
  });
  await assert.rejects(context.run(), /runtime missing/);
  assert.deepEqual(context.calls, [['ensure', 'runtime:versus', context.options]]);
});

test('an abort raised during Creator runtime preparation wins before ownership recheck', async () => {
  const controller = new AbortController(),
    context = fixture({
      controller,
      ensure: async () => controller.abort(),
    });
  await assert.rejects(context.run(), { name: 'AbortError' });
  assert.deepEqual(context.calls, [['ensure', 'runtime:versus', context.options]]);
});

test('Creator ownership is rechecked after asynchronous runtime preparation', async () => {
  const entry = {},
    owner = {},
    owners = new WeakMap([[entry, owner]]),
    options = { signal: new AbortController().signal };
  await assert.rejects(
    ensureVersusEntryPackage(entry, {
      options,
      packageConsent: true,
      creatorOwnerFor: (row) => owners.get(row),
      candidateJourney: null,
      authoredRouteId: 'unused',
      shippedMaps: [],
      downloads: {
        async ensure(group) {
          assert.equal(group, 'runtime:versus');
          owners.delete(entry);
        },
      },
      reader: { presentationOwner: () => assert.fail('official reader used') },
      isOfficialPack: () => true,
    }),
    /ownership changed during package preparation/,
  );
});
