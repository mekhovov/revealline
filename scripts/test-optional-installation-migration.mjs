import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MIGRATION_IDS,
  MIGRATION_MODE,
  selectHistoricalMigration,
  assertMigrationOwnership,
  assertMigrationUnrelated,
  assertMigrationWorldRetention,
  openHistoricalMigrationSurface,
  seedHistoricalMigrationWorld,
} from './optional-installation-migration.mjs';

const options = { historical: true, worldSeed: true };
test('strict opt-in preserves omitted/default selection and rejects combined lanes', () => {
  assert.equal(selectHistoricalMigration(undefined, {}), false);
  assert.equal(selectHistoricalMigration(MIGRATION_MODE, options), true);
  assert.throws(() => selectHistoricalMigration('all', options));
  for (const key of ['historical', 'worldSeed'])
    assert.throws(() => selectHistoricalMigration(MIGRATION_MODE, { ...options, [key]: false }));
  for (const key of ['download', 'quota', 'quotaPackages', 'activeSession', 'activeWindow'])
    for (const value of ['1', '', 'all-short', 'overall-worlds'])
      assert.throws(() => selectHistoricalMigration(MIGRATION_MODE, { ...options, [key]: value }));
});

const keyFor = (id) => `key:${id}`;
function ownership() {
  const references = Object.fromEntries(
    MIGRATION_IDS.map((id) => [
      id,
      {
        active: {
          version: 'v0.200.0',
          scope: `http://127.0.0.1:123/practice/${id}/releases/v0.200.0/site/`,
          workerScope: `http://127.0.0.1:123/practice/${id}/releases/v0.200.0/site/optional-practice/${id}/`,
          cacheName: `cache:/practice/${id}/current`,
        },
        previous: {
          version: 'v0.142.4',
          scope: `http://127.0.0.1:123/practice/${id}/releases/v0.142.4/site/`,
          workerScope: `http://127.0.0.1:123/practice/${id}/releases/v0.142.4/site/optional-practice/${id}/`,
          cacheName: `cache:/practice/${id}/old`,
        },
      },
    ]),
  );
  const refs = Object.values(references).flatMap((row) => [row.active, row.previous]);
  const state = {
    keys: Object.fromEntries(
      MIGRATION_IDS.map((id) => [
        keyFor(id),
        JSON.stringify(
          Object.fromEntries(
            Object.entries(references[id]).map(([kind, ref]) => [
              kind,
              {
                id,
                version: ref.version,
                scope: ref.scope,
                entry: `optional-practice/${id}/index.html`,
              },
            ]),
          ),
        ),
      ]),
    ),
    caches: refs.map((row) => row.cacheName),
    workers: refs.map((row) => ({ scope: row.workerScope, active: 'activated' })),
  };
  return { references, state };
}
test('retained runtime ownership requires exact pointer scopes and active workers/cache for both versions', () => {
  const { references, state } = ownership();
  assertMigrationOwnership(state, references, keyFor);
  for (const fault of ['cache', 'worker', 'inactive', 'pointer', 'extra-cache', 'extra-worker']) {
    const bad = structuredClone(state);
    if (fault === 'cache') bad.caches.pop();
    if (fault === 'worker') bad.workers.pop();
    if (fault === 'inactive') bad.workers[1].active = 'installing';
    if (fault === 'extra-cache') bad.caches.push('unexpected-staging-cache');
    if (fault === 'extra-worker')
      bad.workers.push({ scope: 'http://127.0.0.1:123/orphan/', active: 'activated' });
    if (fault === 'pointer') {
      const pointer = JSON.parse(bad.keys[keyFor(MIGRATION_IDS[0])]);
      pointer.previous.scope += 'different/';
      bad.keys[keyFor(MIGRATION_IDS[0])] = JSON.stringify(pointer);
    }
    assert.throws(() => assertMigrationOwnership(bad, references, keyFor), fault);
  }
});
test('unrelated packages remain exact during selected update/removal', () => {
  const { state } = ownership(),
    after = structuredClone(state);
  after.keys[keyFor(MIGRATION_IDS[0])] = '{}';
  after.caches = after.caches.filter((name) => !name.includes(`/practice/${MIGRATION_IDS[0]}/`));
  after.workers = after.workers.filter(
    (row) => !row.scope.includes(`/practice/${MIGRATION_IDS[0]}/`),
  );
  assertMigrationUnrelated(state, after, MIGRATION_IDS[0], keyFor);
  after.caches.pop();
  assert.throws(() => assertMigrationUnrelated(state, after, MIGRATION_IDS[0], keyFor));
});
function worldReceipt() {
  const row = { key: 'a'.repeat(64), sha256: 'b'.repeat(64) };
  const baseline = {
    card: { id: 'fixture', title: 'C4 retained world' },
    database: {
      name: 'revealline-fpv-worlds-v1',
      version: 2,
      stores: ['projects', 'revisions'].map((name) => ({
        name,
        count: 1,
        sha256: 'c'.repeat(64),
        rows: [row],
      })),
    },
  };
  return {
    preparedBeforeInstallation: true,
    baseline,
    checks: [
      'historical-baseline',
      ...MIGRATION_IDS.map((id) => `after-upgrade:${id}`),
      ...MIGRATION_IDS.map((id) => `after-rollback:${id}`),
    ].map((label) => ({ label, ...structuredClone(baseline) })),
  };
}
test('migration data receipt requires all seven ordered nonempty unchanged world witnesses', () => {
  const receipt = worldReceipt();
  assert.equal(assertMigrationWorldRetention(receipt), true);
  for (const fault of ['missing', 'order', 'empty', 'changed']) {
    const bad = structuredClone(receipt);
    if (fault === 'missing') bad.checks.pop();
    if (fault === 'order') bad.checks.reverse();
    if (fault === 'empty') bad.checks[1].database.stores[0].count = 0;
    if (fault === 'changed') bad.checks[6].database.stores[0].rows[0].sha256 = 'd'.repeat(64);
    assert.throws(() => assertMigrationWorldRetention(bad), fault);
  }
});
function fakePage(id, { blocking = false, hidden = false, disabled = false } = {}) {
  const prefix = id === 'civilian-flight' ? 'gym' : 'worlds';
  const pathname = `/revealline/practice/${id}/releases/v0.142.4/site/optional-practice/${id}/index.html`;
  const actions = [],
    dialogs = blocking ? ['unexpected-dialog'] : [`${prefix}-shell-home-dialog`];
  return {
    actions,
    url: () => `http://127.0.0.1:123${pathname}`,
    locator(selector) {
      return {
        evaluateAll: async () => dialogs,
        waitFor: async (options) => {
          assert.equal(options.state, 'visible');
          if (hidden) throw new Error('Hidden');
        },
        isEnabled: async () => !disabled,
        press: async (key, options) => {
          assert.equal(key, 'Enter');
          assert(options.timeout > 0 && options.timeout <= 30000);
          actions.push(selector);
        },
      };
    },
  };
}
test('historical Gym route uses visible Settings→Help, not current Content controls', async () => {
  const page = fakePage('civilian-flight');
  await openHistoricalMigrationSurface(page, 'civilian-flight', 'offline', page.url());
  assert.deepEqual(page.actions, ['#gym-shell-action-settings', '#gym-shell-action-help']);
});
test('historical Worlds routes use visible Missions→Creator/Library', async () => {
  for (const tab of ['creator', 'packs']) {
    const page = fakePage('fpv-worlds');
    await openHistoricalMigrationSurface(page, 'fpv-worlds', tab, page.url());
    assert.deepEqual(page.actions, ['#worlds-shell-action-missions', `[data-tab="${tab}"]`]);
  }
});
test('historical routing rejects wrong releases, blocking dialogs, hidden/disabled controls and arbitrary actions', async () => {
  const page = fakePage('fpv-worlds');
  await assert.rejects(
    openHistoricalMigrationSurface(
      page,
      'fpv-worlds',
      'packs',
      page.url().replace('v0.142.4', 'v0.142.5'),
    ),
  );
  await assert.rejects(openHistoricalMigrationSurface(page, 'fpv-worlds', 'anything', page.url()));
  for (const flag of ['blocking', 'hidden', 'disabled']) {
    const bad = fakePage('fpv-worlds', { [flag]: true });
    await assert.rejects(openHistoricalMigrationSurface(bad, 'fpv-worlds', 'packs', bad.url()));
    assert.deepEqual(bad.actions, []);
  }
});
test('historical world seeding uses ordinary clone/title/install controls after empty-store check', async () => {
  const page = fakePage('fpv-worlds'),
    original = page.locator.bind(page),
    changes = [];
  page.locator = (selector) => ({
    ...original(selector),
    evaluate: async () => ({ value: 'first-template', label: 'First template' }),
    fill: async (value) => changes.push({ selector, value }),
    press: async (key) => changes.push({ selector, key }),
  });
  page.waitForFunction = async () => changes.push({ expectedReadyStatus: true });
  const result = await seedHistoricalMigrationWorld(page, async () => ({ stores: [] }), page.url());
  assert.equal(result.template.value, 'first-template');
  assert.deepEqual(changes, [
    { selector: '#worlds-shell-action-missions', key: 'Enter' },
    { selector: '[data-tab="creator"]', key: 'Enter' },
    { selector: '#clone-challenge', key: 'Enter' },
    { selector: '#creator-title', value: 'C4 retained world' },
    { selector: '#creator-title', key: 'Tab' },
    { selector: '#install-project', key: 'Enter' },
    { expectedReadyStatus: true },
  ]);
});
test('historical seed rejects populated stores before public mutations', async () => {
  const page = fakePage('fpv-worlds');
  await assert.rejects(
    seedHistoricalMigrationWorld(
      page,
      async () => ({ stores: [{ name: 'projects', count: 1 }] }),
      page.url(),
    ),
  );
  assert.deepEqual(page.actions, []);
});
test('historical seed stops after a late readonly result before any mutations', async () => {
  const page = fakePage('fpv-worlds');
  let alive = true;
  await assert.rejects(
    seedHistoricalMigrationWorld(
      page,
      async () => {
        alive = false;
        return { stores: [] };
      },
      page.url(),
      {
        requireActive() {
          assert(alive, 'expired');
        },
      },
    ),
    /expired/,
  );
  assert.deepEqual(page.actions, []);
});
test('historical seed rechecks liveness after native fill before later Tab/install actions', async () => {
  const page = fakePage('fpv-worlds'),
    original = page.locator.bind(page),
    actions = [];
  let alive = true;
  page.locator = (selector) => ({
    ...original(selector),
    evaluate: async () => ({ value: 'template', label: 'Template' }),
    press: async (key) => actions.push([selector, key]),
    fill: async () => {
      alive = false;
    },
  });
  await assert.rejects(
    seedHistoricalMigrationWorld(page, async () => ({ stores: [] }), page.url(), {
      requireActive() {
        assert(alive, 'expired');
      },
    }),
    /expired/,
  );
  assert(
    !actions.some(([selector]) => selector === '#install-project' || selector === '#creator-title'),
  );
});
