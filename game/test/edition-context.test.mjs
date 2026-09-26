import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveEditionContext,
  editionAppIdentity,
  officialContentOwner,
  installedStateKey,
} from '../edition-context.mjs';
import { recoveryChannel } from '../profile-channel.mjs';
import { discoverProfileTransfers } from '../profile-transfer.mjs';
import {
  activateInstalledEdition,
  readInstalledState,
  stageInstalledEdition,
  reviewInstalledMigration,
  recordInstalledMigration,
} from '../installed-app.mjs';

const version = '0.132.1';
const basePath = '/revealline/';
const candidate = (editionId, release = version) => ({
  editionId,
  version: release,
  scope: `https://game.test/revealline/editions/${editionId}/releases/v${release}/site/`,
});
function harness(editionId) {
  const values = new Map(),
    held = new Set();
  return {
    values,
    held,
    locationRef: { href: `${candidate(editionId).scope}game/downloads.html` },
    storage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      key: (i) => [...values.keys()][i] ?? null,
      get length() {
        return values.size;
      },
    },
    readAsset: async () => null,
    locks: {
      request: async (name, options, callback) =>
        (callback || options)(held.has(name) ? null : { name }),
    },
  };
}

test('default channels retain their exact spellings; same-release company profiles and app IDs differ', () => {
  assert.equal(resolveEditionContext({ version: 'v0.132.1' }).channel, 'release-v0.132.1');
  assert.equal(resolveEditionContext({ version: 'DEV' }).channel, 'dev');
  const a = resolveEditionContext({ editionId: 'coupa', version }),
    b = resolveEditionContext({ editionId: 'droneaid', version });
  assert.notEqual(a.profileKey, b.profileKey);
  assert.equal(a.writerKey, `${a.profileKey}.writer`);
  assert.deepEqual(editionAppIdentity({ editionId: 'coupa', basePath }), {
    id: '/revealline/editions/coupa/',
    start_url: '/revealline/editions/coupa/app/',
    scope: '/revealline/editions/coupa/',
  });
  assert.notEqual(
    officialContentOwner({ editionId: 'coupa', packId: 'shared', revision: '1' }),
    officialContentOwner({ editionId: 'droneaid', packId: 'shared', revision: '1' }),
  );
  for (const editionId of ['../coupa', 'coupa/other', 'Coupa', '', 'a'.repeat(65)])
    assert.throws(() => resolveEditionContext({ editionId, version }));
  assert.throws(() => editionAppIdentity({ editionId: 'coupa', basePath: '//elsewhere/' }));
});

test('transfer discovers earlier same-edition profiles; read-only recovery protects other editions', () => {
  const h = harness('coupa');
  for (const editionId of [undefined, 'coupa', 'droneaid']) {
    const context = resolveEditionContext({ editionId, version: '0.131.0' });
    h.storage.setItem(context.profileKey, '{}');
  }
  const rows = discoverProfileTransfers({
    storage: h.storage,
    currentVersion: version,
    editionId: 'coupa',
  });
  assert.deepEqual(
    rows.map((row) => row.editionId),
    ['coupa'],
  );
  assert.equal(discoverProfileTransfers({ storage: h.storage, currentVersion: version }).length, 1);
  const channel = resolveEditionContext({ editionId: 'coupa', version }).channel;
  assert.equal(recoveryChannel(channel, version, { editionId: 'coupa' }).support, 'current');
  assert.equal(recoveryChannel(channel, version).support, 'protected-unknown');
});

test('same-release installed editions have independent state and writer locks', async () => {
  const h = harness('coupa');
  await activateInstalledEdition(candidate('coupa'), h);
  const drone = { ...h, locationRef: { href: `${candidate('droneaid').scope}game/` } };
  await activateInstalledEdition(candidate('droneaid'), drone);
  assert.equal(readInstalledState(h.storage, { editionId: 'coupa' }).active.editionId, 'coupa');
  assert.equal(
    readInstalledState(h.storage, { editionId: 'droneaid' }).active.editionId,
    'droneaid',
  );
  assert.equal(h.storage.getItem(installedStateKey()), null);
  await assert.rejects(activateInstalledEdition(candidate('droneaid'), h), /identity/);
  h.held.add(resolveEditionContext({ editionId: 'coupa', version }).writerKey);
  await assert.rejects(activateInstalledEdition(candidate('coupa'), h), /Close the game window/);
  assert.equal((await activateInstalledEdition(candidate('droneaid'), drone)).activated, true);
});

test('branded updates require source review and retain both profiles through rollback', async () => {
  const h = harness('coupa'),
    old = candidate('coupa', '0.131.0'),
    next = candidate('coupa');
  await activateInstalledEdition(old, h);
  const oldKey = resolveEditionContext(old).profileKey,
    nextKey = resolveEditionContext(next).profileKey;
  h.storage.setItem(oldKey, 'old progress');
  await stageInstalledEdition(next, h);
  assert.equal((await activateInstalledEdition(next, h)).activated, false);
  const review = await reviewInstalledMigration(old.version, next.version, h);
  h.storage.setItem(nextKey, 'copied progress');
  await assert.rejects(
    recordInstalledMigration({ ...review, editionId: 'droneaid' }, h),
    /another edition/,
  );
  await recordInstalledMigration(review, h);
  assert.equal((await activateInstalledEdition(next, h)).activated, true);
  assert.equal(
    (await activateInstalledEdition(old, { ...h, restorePrevious: true })).activated,
    true,
  );
  assert.equal(h.storage.getItem(oldKey), 'old progress');
  assert.equal(h.storage.getItem(nextKey), 'copied progress');
});
