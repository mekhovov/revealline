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
  assertMigrationLauncherReady,
  readMigrationLauncherState,
  waitForMigrationLauncher,
} from './optional-installation-migration.mjs';
import { installPracticeWorker as installFPV } from '../optional-practice/worker-template.mjs';
import { installPracticeWorker as installGym } from '../optional-practice/civilian-flight/worker-template.mjs';

const launcherScope = 'http://127.0.0.1:123/practice/civilian-fpv/app/';
const launcherCache = (revision) =>
  `revealline.optional.package.v1:/practice/civilian-fpv/app/:${revision}`;
function launcherFixture() {
  const expected = {
    scope: launcherScope,
    revision: 'b'.repeat(64),
    legacyStatus: false,
    cacheNames: [launcherCache('a'.repeat(64)), launcherCache('b'.repeat(64))],
  };
  const state = {
    caches: [...expected.cacheNames],
    registrations: 1,
    active: { state: 'activated', scriptURL: launcherScope + 'worker.js' },
    installing: null,
    waiting: null,
    sameActive: true,
    reply: {
      type: 'practice-status',
      scope: launcherScope,
      revision: expected.revision,
      ready: true,
      statusPresent: true,
      status: 'ready',
    },
  };
  return { expected, state };
}
test('launcher readiness binds actual owner revision and exact retained caches, not just active state', () => {
  const { expected, state } = launcherFixture();
  assertMigrationLauncherReady(state, expected);
  for (const defect of [
    'old-owner',
    'installing',
    'waiting',
    'missing-old',
    'missing-new',
    'orphan',
    'wrong-script',
    'unknown',
    'unready',
    'changed-owner',
    'wrong-scope',
  ]) {
    const bad = structuredClone(state);
    if (defect === 'old-owner') bad.reply.revision = 'a'.repeat(64);
    if (defect === 'installing') bad.installing = { state: 'installing' };
    if (defect === 'waiting') bad.waiting = { state: 'installed' };
    if (defect === 'missing-old') bad.caches.shift();
    if (defect === 'missing-new') bad.caches.pop();
    if (defect === 'orphan') bad.caches.push(launcherCache('c'.repeat(64)));
    if (defect === 'wrong-script') bad.active.scriptURL += '?other';
    if (defect === 'unknown') bad.reply.status = 'unknown';
    if (defect === 'unready') bad.reply.ready = false;
    if (defect === 'changed-owner') bad.sameActive = false;
    if (defect === 'wrong-scope') bad.reply.scope += 'other/';
    assert.throws(() => assertMigrationLauncherReady(bad, expected), defect);
  }
});
test('exact historical worker supports its absent status field, never explicit unknown or false readiness', () => {
  const { expected, state } = launcherFixture();
  state.reply.status = null;
  assert.throws(() => assertMigrationLauncherReady(state, expected));
  expected.legacyStatus = true;
  state.reply.statusPresent = false;
  assertMigrationLauncherReady(state, expected);
  state.reply.statusPresent = true;
  state.reply.status = 'unknown';
  assert.throws(() => assertMigrationLauncherReady(state, expected));
  state.reply.status = null;
  state.reply.ready = false;
  assert.throws(() => assertMigrationLauncherReady(state, expected));
});
test('launcher waiter retains transition states and rejects timeout without creating or repairing caches', async () => {
  const { expected, state } = launcherFixture();
  let calls = 0;
  const previous = structuredClone(state);
  previous.reply.revision = 'a'.repeat(64);
  previous.waiting = { state: 'installed' };
  const receipt = {};
  await waitForMigrationLauncher(
    { evaluate: async () => (++calls === 1 ? previous : state) },
    expected,
    receipt,
    { timeoutMs: 1000 },
  );
  assert.equal(receipt.ready, true);
  assert.deepEqual(receipt.snapshots, [previous, state]);
  const failed = {};
  await assert.rejects(
    waitForMigrationLauncher({ evaluate: async () => previous }, expected, failed, {
      timeoutMs: 5,
    }),
    /exact revision-bound/,
  );
  assert.equal(failed.ready, undefined);
  assert.deepEqual(failed.snapshots, [previous]);
  await assert.rejects(
    waitForMigrationLauncher(
      { evaluate: async () => state },
      { ...expected, scope: 'https://other.test/practice/civilian-fpv/app/' },
      {},
    ),
  );
});
for (const [name, installer, namespace] of [
  ['Academy/Worlds', installFPV, 'package'],
  ['Gym', installGym, 'civilian-flight'],
])
  test(`${name} actual worker activation preserves exactly one prior stable shell and unrelated runtime`, async () => {
    const base = `http://127.0.0.1:123/practice/${namespace === 'package' ? 'civilian-fpv' : 'civilian-flight'}/app/`;
    const prefix = `revealline.optional.${namespace}.v1:${new URL(base).pathname}:`;
    const names = new Set([
      prefix + 'obsolete',
      prefix + 'previous',
      prefix + 'current',
      'unrelated-runtime',
    ]);
    const events = {};
    installer(
      {
        registration: { scope: base },
        addEventListener: (name, callback) => {
          events[name] = callback;
        },
        caches: { keys: async () => [...names], delete: async (name) => names.delete(name) },
      },
      [],
      'current',
    );
    let pending;
    events.activate({
      waitUntil(value) {
        pending = value;
      },
    });
    await pending;
    assert.deepEqual([...names], [prefix + 'previous', prefix + 'current', 'unrelated-runtime']);
  });
for (const mode of ['reply', 'legacy', 'null', 'false', 'garbage', 'throw', 'timeout'])
  test(`read-only launcher status closes both owned ports after ${mode}`, async (t) => {
    const { state, expected } = launcherFixture();
    const incoming = { ...state.reply };
    if (mode === 'legacy') delete incoming.status;
    if (mode === 'null') incoming.status = null;
    if (mode === 'false') incoming.status = false;
    if (mode === 'garbage') incoming.status = 'garbage';
    const original = new Map(
      ['caches', 'navigator', 'MessageChannel'].map((key) => [
        key,
        Object.getOwnPropertyDescriptor(globalThis, key),
      ]),
    );
    const closed = [];
    let port;
    const worker = {
      ...state.active,
      postMessage(data, [value]) {
        assert.deepEqual(data, { type: 'practice-status' });
        assert.equal(value, port.port2);
        if (mode === 'throw') throw new Error('closed');
        if (!['throw', 'timeout'].includes(mode))
          queueMicrotask(() => port.port1.onmessage({ data: incoming }));
      },
    };
    const registration = { scope: launcherScope, active: worker };
    for (const [key, value] of Object.entries({
      caches: { keys: async () => state.caches },
      navigator: { serviceWorker: { getRegistrations: async () => [registration] } },
      MessageChannel: class {
        constructor() {
          port = this;
          this.port1 = { close: () => closed.push(1) };
          this.port2 = { close: () => closed.push(2) };
        }
      },
    }))
      Object.defineProperty(globalThis, key, { configurable: true, value });
    try {
      if (mode === 'timeout') t.mock.timers.enable({ apis: ['setTimeout'] });
      const pending = readMigrationLauncherState({ scope: launcherScope });
      if (mode === 'timeout') {
        await new Promise((resolve) => setImmediate(resolve));
        t.mock.timers.tick(1000);
      }
      const observed = await pending;
      assert.deepEqual(closed, [1, 2]);
      assert.equal(port.port1.onmessage, null);
      if (['throw', 'timeout'].includes(mode)) assert.equal(observed.reply, null);
      else {
        expected.legacyStatus = true;
        if (mode === 'reply' || mode === 'legacy') assertMigrationLauncherReady(observed, expected);
        else assert.throws(() => assertMigrationLauncherReady(observed, expected));
        assert.equal(observed.reply.statusPresent, mode !== 'legacy');
      }
    } finally {
      for (const [key, descriptor] of original)
        descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key];
    }
  });

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

test('only pinned Gym or Worlds session activation may accompany the complete migration matrix', () => {
  for (const mode of ['gym-v0.142.4-98ad851', 'worlds-v0.142.4-98ad851']) {
    const active = { activeSession: mode, activeWindow: 'owned-pwa-target-activation-98ad851' };
    assert.equal(selectHistoricalMigration(MIGRATION_MODE, { ...options, ...active }), true);
    assert.throws(() =>
      selectHistoricalMigration(MIGRATION_MODE, { ...options, activeSession: mode }),
    );
    assert.throws(() =>
      selectHistoricalMigration(MIGRATION_MODE, {
        ...options,
        ...active,
        activeWindow: 'owned-window-minimize-98ad851',
      }),
    );
    assert.throws(() =>
      selectHistoricalMigration(MIGRATION_MODE, { ...options, ...active, download: 'all-short' }),
    );
  }
  assert.throws(() =>
    selectHistoricalMigration(MIGRATION_MODE, {
      ...options,
      activeSession: 'academy-v0.142.4-98ad851',
      activeWindow: 'owned-pwa-target-activation-98ad851',
    }),
  );
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
test('retained stable launcher has both exact admitted shell caches but only one worker', () => {
  const { references, state } = ownership();
  const { expected } = launcherFixture();
  const launcher = {
    workerScope: launcherScope,
    cacheName: expected.cacheNames[1],
    cacheNames: expected.cacheNames,
  };
  state.caches.push(...expected.cacheNames);
  state.workers.push({ scope: launcherScope, active: 'activated' });
  assertMigrationOwnership(state, references, keyFor, [launcher]);
  for (const fault of ['missing-old', 'orphan', 'duplicate-worker']) {
    const bad = structuredClone(state);
    if (fault === 'missing-old')
      bad.caches = bad.caches.filter((name) => name !== expected.cacheNames[0]);
    if (fault === 'orphan') bad.caches.push(launcherCache('d'.repeat(64)));
    if (fault === 'duplicate-worker')
      bad.workers.push({ scope: launcherScope, active: 'activated' });
    assert.throws(() => assertMigrationOwnership(bad, references, keyFor, [launcher]), fault);
  }
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
