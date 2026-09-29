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
  const a = resolveEditionContext({ editionId: 'sample', version }),
    b = resolveEditionContext({ editionId: 'droneaid-nl-community', version });
  assert.notEqual(a.profileKey, b.profileKey);
  assert.equal(a.writerKey, `${a.profileKey}.writer`);
  assert.deepEqual(editionAppIdentity({ editionId: 'sample', basePath }), {
    id: '/revealline/editions/sample/',
    start_url: '/revealline/editions/sample/app/',
    scope: '/revealline/editions/sample/',
  });
  assert.notEqual(
    officialContentOwner({ editionId: 'sample', packId: 'shared', revision: '1' }),
    officialContentOwner({ editionId: 'droneaid-nl-community', packId: 'shared', revision: '1' }),
  );
  for (const editionId of ['../sample', 'sample/other', 'Sample', '', 'a'.repeat(65)])
    assert.throws(() => resolveEditionContext({ editionId, version }));
  assert.throws(() => editionAppIdentity({ editionId: 'sample', basePath: '//elsewhere/' }));
});

test('transfer discovers earlier same-edition profiles; read-only recovery protects other editions', () => {
  const h = harness('sample');
  for (const editionId of [undefined, 'sample', 'droneaid-nl-community']) {
    const context = resolveEditionContext({ editionId, version: '0.131.0' });
    h.storage.setItem(context.profileKey, '{}');
  }
  const rows = discoverProfileTransfers({
    storage: h.storage,
    currentVersion: version,
    editionId: 'sample',
  });
  assert.deepEqual(
    rows.map((row) => row.editionId),
    ['sample'],
  );
  assert.equal(discoverProfileTransfers({ storage: h.storage, currentVersion: version }).length, 1);
  const channel = resolveEditionContext({ editionId: 'sample', version }).channel;
  assert.equal(recoveryChannel(channel, version, { editionId: 'sample' }).support, 'current');
  assert.equal(recoveryChannel(channel, version).support, 'protected-unknown');
});

test('same-release installed editions have independent state and writer locks', async () => {
  const h = harness('sample');
  await activateInstalledEdition(candidate('sample'), h);
  const drone = { ...h, locationRef: { href: `${candidate('droneaid-nl-community').scope}game/` } };
  await activateInstalledEdition(candidate('droneaid-nl-community'), drone);
  assert.equal(readInstalledState(h.storage, { editionId: 'sample' }).active.editionId, 'sample');
  assert.equal(
    readInstalledState(h.storage, { editionId: 'droneaid-nl-community' }).active.editionId,
    'droneaid-nl-community',
  );
  assert.equal(h.storage.getItem(installedStateKey()), null);
  await assert.rejects(activateInstalledEdition(candidate('droneaid-nl-community'), h), /identity/);
  h.held.add(resolveEditionContext({ editionId: 'sample', version }).writerKey);
  await assert.rejects(activateInstalledEdition(candidate('sample'), h), /Close the game window/);
  assert.equal(
    (await activateInstalledEdition(candidate('droneaid-nl-community'), drone)).activated,
    true,
  );
});

test('branded updates require source review and retain both profiles through rollback', async () => {
  const h = harness('sample'),
    old = candidate('sample', '0.131.0'),
    next = candidate('sample');
  await activateInstalledEdition(old, h);
  const oldKey = resolveEditionContext(old).profileKey,
    nextKey = resolveEditionContext(next).profileKey;
  h.storage.setItem(oldKey, 'old progress');
  await stageInstalledEdition(next, h);
  assert.equal((await activateInstalledEdition(next, h)).activated, false);
  const review = await reviewInstalledMigration(old.version, next.version, h);
  h.storage.setItem(nextKey, 'copied progress');
  await assert.rejects(
    recordInstalledMigration({ ...review, editionId: 'droneaid-nl-community' }, h),
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

test('canonical DroneAid launch reads existing installed state and migrates without changing profile identity', async () => {
  const editionId = 'droneaid-nl-community';
  const h = harness(editionId);
  const old = candidate(editionId, '0.131.0');
  await activateInstalledEdition(old, h);
  const oldKey = resolveEditionContext(old).profileKey;
  h.storage.setItem(oldKey, 'legacy route progress');
  const next = {
    ...candidate(editionId),
    scope: candidate(editionId).scope.replace(`/editions/${editionId}/`, '/editions/droneaid/'),
  };
  const canonical = { ...h, locationRef: { href: `${next.scope}game/` } };
  assert.equal(readInstalledState(h.storage, canonical).active.editionId, editionId);
  assert.equal(readInstalledState(h.storage, canonical).active.scope, old.scope);
  await stageInstalledEdition(next, canonical);
  const review = await reviewInstalledMigration(old.version, next.version, canonical);
  assert.equal(review.editionId, editionId);
  const nextKey = resolveEditionContext(next).profileKey;
  h.storage.setItem(nextKey, 'copied legacy route progress');
  await recordInstalledMigration(review, canonical);
  assert.equal((await activateInstalledEdition(next, canonical)).activated, true);
  assert.equal(
    (await activateInstalledEdition(old, { ...canonical, restorePrevious: true })).activated,
    true,
  );
  assert.equal(h.storage.getItem(oldKey), 'legacy route progress');
  assert.equal(h.storage.getItem(nextKey), 'copied legacy route progress');
  assert.equal(h.storage.getItem(installedStateKey('droneaid')), null);
  await assert.rejects(
    activateInstalledEdition(
      {
        ...next,
        scope: next.scope.replace('/editions/droneaid/', '/editions/droneaid-community/'),
      },
      canonical,
    ),
    /outside this app/,
  );
});
