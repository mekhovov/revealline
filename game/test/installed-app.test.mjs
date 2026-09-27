import test from 'node:test';
import assert from 'node:assert/strict';
import {
  installedAppURL,
  validateInstalledEdition,
  readInstalledState,
  stageInstalledEdition,
  activateInstalledEdition,
  reviewInstalledMigration,
  recordInstalledMigration,
  invalidateInstalledMigration,
  INSTALLED_STATE_KEY,
  updateInstalledSelection,
  rememberInstalledPackages,
  prepareInstalledLauncher,
  checkInstalledLauncher,
} from '../installed-app.mjs';
const locationRef = {
  href: 'https://game.example/revealline/releases/v2.0.0/site/game/downloads.html',
};
const a = {
  version: '1.0.0',
  scope: 'https://game.example/revealline/releases/v1.0.0/site/',
  selection: ['base'],
  allGameplay: false,
};
const b = {
  version: '2.0.0',
  scope: 'https://game.example/revealline/releases/v2.0.0/site/',
  selection: ['base'],
  allGameplay: false,
};
function setup() {
  const values = new Map(),
    assets = new Map(),
    held = new Set();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const locks = {
    async request(name, options, callback) {
      const work = callback || options;
      return work(held.has(name) ? null : { name });
    },
  };
  return {
    storage,
    values,
    assets,
    held,
    locks,
    locationRef,
    readAsset: async (key) => assets.get(key) ?? null,
  };
}
const profile = (version) => `revealline.library.release-${version}.v1`;
test('verified bookmarked packages extend only the active edition without replacing broader update choices', async () => {
  const h = setup();
  const state = {
    active: { ...a, selection: ['base', 'solo:existing'], allGameplay: true },
    previous: b,
    pending: { ...b, selection: ['base', 'team:pending'] },
    migration: { untouched: true },
  };
  h.storage.setItem(INSTALLED_STATE_KEY, JSON.stringify(state));
  const calls = [];
  const locks = {
    request: async (name, options, work) => {
      calls.push({ name, signal: options.signal });
      return work();
    },
  };
  const controller = new AbortController();
  assert.equal(
    await rememberInstalledPackages(a.scope, ['versus:bookmark', 'base'], {
      ...h,
      locks,
      signal: controller.signal,
    }),
    true,
  );
  assert.deepEqual(readInstalledState(h.storage), {
    ...state,
    active: { ...state.active, selection: ['base', 'solo:existing', 'versus:bookmark'] },
  });
  assert.deepEqual(calls, [{ name: 'revealline.installed-app.switch', signal: controller.signal }]);
  const before = h.storage.getItem(INSTALLED_STATE_KEY);
  assert.equal(await rememberInstalledPackages(b.scope, ['team:other-edition'], h), false);
  assert.equal(h.storage.getItem(INSTALLED_STATE_KEY), before);
  controller.abort();
  await assert.rejects(
    rememberInstalledPackages(a.scope, ['team:cancelled'], { ...h, signal: controller.signal }),
    { name: 'AbortError' },
  );
  assert.equal(h.storage.getItem(INSTALLED_STATE_KEY), before);
});

test('cancelled queued bookmark selection leaves installed state untouched', async () => {
  const h = setup(),
    controller = new AbortController();
  h.storage.setItem(INSTALLED_STATE_KEY, JSON.stringify({ active: a }));
  const before = h.storage.getItem(INSTALLED_STATE_KEY);
  let entered;
  const pending = rememberInstalledPackages(a.scope, ['team:bookmark'], {
    ...h,
    signal: controller.signal,
    locks: {
      request: (_name, _options, work) =>
        new Promise((resolve, reject) => {
          entered = () => work().then(resolve, reject);
        }),
    },
  });
  controller.abort();
  entered();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(h.storage.getItem(INSTALLED_STATE_KEY), before);
});

test('one launcher identity covers immutable editions, and foreign or credentialed editions are rejected', () => {
  assert.equal(installedAppURL(locationRef), 'https://game.example/revealline/app/');
  assert.deepEqual(validateInstalledEdition(b, locationRef), b);
  for (const scope of [
    'https://elsewhere.example/revealline/releases/v2/site/',
    'https://game.example/other/',
    'https://user:secret@game.example/revealline/releases/v2/site/',
  ])
    assert.throws(() => validateInstalledEdition({ ...b, scope }, locationRef));
});
test('an embedded host can use its held writer, but losing ownership or another edition writer keeps the old selection', async () => {
  const h = setup();
  const key = `${profile(a.version)}.writer`;
  h.held.add(key);
  assert.equal(
    (await activateInstalledEdition(a, { ...h, ownsWriter: (name) => name === key })).activated,
    true,
  );
  h.held.add(`${profile(b.version)}.writer`);
  await assert.rejects(
    activateInstalledEdition(b, { ...h, ownsWriter: (name) => name === key }),
    /Close the game window/,
  );
  h.held.delete(`${profile(b.version)}.writer`);
  let held = true;
  await assert.rejects(
    activateInstalledEdition(b, {
      ...h,
      ownsWriter: (name) => held && name === key,
      readAsset: async () => {
        held = false;
        return null;
      },
    }),
    /stopped owning/,
  );
  assert.deepEqual(readInstalledState(h.storage).active, a);
});

test('launcher activation is insufficient until its exact cached shell is verified', async () => {
  const calls = [];
  let ready = false;
  const worker = {
    state: 'activated',
    postMessage(message, [port]) {
      calls.push(message.type);
      port.postMessage({
        format: 'revealline.launcher-health.v1',
        requestId: message.requestId,
        status: ready ? 'ready' : 'incomplete',
        message: 'Missing launcher HTML.',
      });
    },
  };
  const serviceWorker = {
    register: async () => ({ active: worker }),
    getRegistration: async () => ({ active: worker }),
  };
  const options = { navigatorRef: { serviceWorker }, locationRef, timeout: 100 };
  assert.equal((await checkInstalledLauncher(options)).status, 'incomplete');
  await assert.rejects(prepareInstalledLauncher(options), /Missing launcher HTML/);
  ready = true;
  assert.equal((await prepareInstalledLauncher(options)).status, 'ready');
  assert.deepEqual(calls, [
    'revealline.launcher-check',
    'revealline.launcher-prepare',
    'revealline.launcher-prepare',
  ]);
});
test('first activation uses local state; no soundtrack readiness or server request is required', async () => {
  const h = setup();
  await stageInstalledEdition(a, h);
  assert.equal((await activateInstalledEdition(a, h)).activated, true);
  assert.deepEqual(readInstalledState(h.storage).active, a);
  assert.equal(readInstalledState(h.storage).pending, null);
});
test('a downloaded update stays pending until the existing transfer transaction commits', async () => {
  const h = setup();
  await activateInstalledEdition(a, h);
  h.storage.setItem(profile(a.version), 'earlier progress');
  await stageInstalledEdition(b, h);
  assert.equal((await activateInstalledEdition(b, h)).activated, false);
  assert.deepEqual(readInstalledState(h.storage).active, a);
  const review = await reviewInstalledMigration('v1.0.0', '2.0.0', h);
  // The existing backup transaction supplies the verified compatible target.
  h.storage.setItem(profile(b.version), 'copied progress');
  await recordInstalledMigration(review, h);
  h.storage.setItem(profile(b.version), 'copied progress plus a legitimate newer save');
  assert.equal((await activateInstalledEdition(b, h)).activated, true);
  assert.deepEqual(readInstalledState(h.storage).previous, a);
  assert.equal(h.storage.getItem(profile(a.version)), 'earlier progress');
});
test('changed source, a live writer and interrupted migration all keep the old edition selected', async () => {
  const h = setup();
  await activateInstalledEdition(a, h);
  h.storage.setItem(profile(a.version), 'progress');
  await stageInstalledEdition(b, h);
  const review = await reviewInstalledMigration(a.version, b.version, h);
  h.storage.setItem(profile(b.version), 'copy');
  await recordInstalledMigration(review, h);
  h.storage.setItem(profile(a.version), 'new progress');
  assert.equal((await activateInstalledEdition(b, h)).activated, false);
  h.held.add(`${profile(a.version)}.writer`);
  await assert.rejects(activateInstalledEdition(b, h), /Close the game window/);
  h.held.clear();
  h.assets.set(`${profile(b.version)}.backup-journal`, { pending: true });
  await assert.rejects(activateInstalledEdition(b, h), /recovery/);
  assert.deepEqual(readInstalledState(h.storage).active, a);
});
test('undo or another profile replacement invalidates a completed migration certificate', async () => {
  const h = setup();
  h.storage.setItem(
    INSTALLED_STATE_KEY,
    JSON.stringify({ active: a, pending: b, migration: { from: a.version, to: b.version } }),
  );
  invalidateInstalledMigration(h.storage);
  assert.equal(readInstalledState(h.storage).migration, null);
});

test('rollback selects the preserved earlier profile without overwriting either edition', async () => {
  const h = setup();
  await activateInstalledEdition(a, h);
  await activateInstalledEdition(b, h);
  h.storage.setItem(profile(a.version), 'earlier progress');
  h.storage.setItem(profile(b.version), 'new progress');
  assert.equal(
    (await activateInstalledEdition(a, { ...h, restorePrevious: true })).activated,
    true,
  );
  assert.deepEqual(readInstalledState(h.storage).active, a);
  assert.equal(h.storage.getItem(profile(b.version)), 'new progress');
  assert.equal(h.storage.getItem(profile(a.version)), 'earlier progress');
  await updateInstalledSelection(a.scope, ['base', 'chapter:night-shift'], h);
  assert.deepEqual(readInstalledState(h.storage).active.selection, ['base', 'chapter:night-shift']);
  await assert.rejects(
    activateInstalledEdition(a, { ...h, restorePrevious: true }),
    /previous edition changed/,
  );
});
