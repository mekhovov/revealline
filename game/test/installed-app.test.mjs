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
  MAX_INSTALLED_PACKAGES,
  validateInstalledSelection,
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
const fullGameplaySelection = ['base', ...Array.from({ length: 107 }, (_, i) => `chapter:${i}`)];
test('same-address updates activate all 108 gameplay packages and preserve progress and writer gates', async () => {
  const h = setup();
  h.locationRef = new URL('https://game.example/revealline/app/update.html');
  const old = { ...a, scope: 'https://game.example/revealline/', buildId: 'a'.repeat(64) };
  const next = {
    ...old,
    buildId: 'b'.repeat(64),
    selection: fullGameplaySelection,
    allGameplay: true,
  };
  h.storage.setItem(INSTALLED_STATE_KEY, JSON.stringify({ active: old }));
  h.storage.setItem(profile(old.version), 'existing progress');
  await stageInstalledEdition(next, h);
  const writer = `${profile(old.version)}.writer`;
  h.held.add(writer);
  let prepared = 0;
  const activate = () =>
    activateInstalledEdition(next, {
      ...h,
      prepare: async () => {
        prepared++;
      },
    });
  await assert.rejects(activate(), /Close the game window/);
  assert.equal(prepared, 0);
  assert.deepEqual(readInstalledState(h.storage).active, old);
  h.held.delete(writer);
  assert.equal((await activate()).activated, true);
  assert.equal(prepared, 1);
  assert.deepEqual(readInstalledState(h.storage).active, next);
  assert.equal(readInstalledState(h.storage).pending, null);
  assert.equal(h.storage.getItem(profile(old.version)), 'existing progress');
});
test('adding and removing packages retain a full gameplay selection beyond the old 100-package ceiling', async () => {
  const h = setup();
  h.storage.setItem(
    INSTALLED_STATE_KEY,
    JSON.stringify({ active: { ...a, selection: fullGameplaySelection, allGameplay: true } }),
  );
  await rememberInstalledPackages(a.scope, ['team:later', 'base'], h);
  assert.deepEqual(readInstalledState(h.storage).active.selection, [
    ...fullGameplaySelection,
    'team:later',
  ]);
  assert.equal(readInstalledState(h.storage).active.allGameplay, true);
  await updateInstalledSelection(a.scope, fullGameplaySelection, h);
  assert.deepEqual(readInstalledState(h.storage).active.selection, fullGameplaySelection);
  assert.equal(readInstalledState(h.storage).active.allGameplay, false);
});
test('bounded package validation reports selection errors separately and still rejects foreign scopes', async () => {
  const h = setup();
  const limit = Array.from({ length: MAX_INSTALLED_PACKAGES }, (_, i) => `chapter:${i}`);
  assert.deepEqual(validateInstalledSelection(limit), limit);
  for (const selection of [
    null,
    'base',
    [...limit, 'overflow'],
    [''],
    [42],
    ['x'.repeat(201)],
    new Array(1),
  ]) {
    assert.throws(
      () => validateInstalledEdition({ ...b, selection }, locationRef),
      /installed download selection/,
    );
    await assert.rejects(
      stageInstalledEdition({ ...b, selection }, h),
      /installed download selection/,
    );
    await assert.rejects(
      updateInstalledSelection(b.scope, selection, h),
      /installed download selection/,
    );
    await assert.rejects(
      rememberInstalledPackages(b.scope, selection, h),
      /installed download selection/,
    );
    assert.equal(h.storage.getItem(INSTALLED_STATE_KEY), null);
  }
  for (const scope of ['https://elsewhere.example/revealline/', 'https://game.example/other/'])
    assert.throws(
      () =>
        validateInstalledEdition({ ...b, scope, selection: fullGameplaySelection }, locationRef),
      /outside this app/,
    );
  const copied = validateInstalledSelection(fullGameplaySelection);
  assert.notEqual(copied, fullGameplaySelection);
});
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

test('same-URL worker preparation waits for migration, recovery and profile ownership', async () => {
  const h = setup(),
    scope = 'https://game.example/revealline/',
    previous = { ...a, scope },
    candidate = { ...b, scope };
  await activateInstalledEdition(previous, h);
  h.storage.setItem(profile(a.version), 'saved progress');
  await stageInstalledEdition(candidate, h);
  let calls = 0;
  const options = { ...h, prepare: async () => calls++ };
  assert.equal((await activateInstalledEdition(candidate, options)).activated, false);
  assert.equal(calls, 0, 'An unreviewed transfer must never replace the old worker.');
  h.assets.set(`${profile(a.version)}.backup-journal`, { pending: true });
  await assert.rejects(activateInstalledEdition(candidate, options), /recovery/);
  assert.equal(calls, 0);
  h.assets.clear();
  h.held.add(`${profile(a.version)}.writer`);
  await assert.rejects(activateInstalledEdition(candidate, options), /Close the game window/);
  assert.equal(calls, 0);
  assert.deepEqual(readInstalledState(h.storage).active, previous);
});

test('verified core preparation holds profile locks until activation and a failure keeps the old selection', async () => {
  const h = setup(),
    held = new Set();
  await activateInstalledEdition(a, h);
  const locks = {
    async request(name, options, callback) {
      held.add(name);
      try {
        return await (callback || options)({ name });
      } finally {
        held.delete(name);
      }
    },
  };
  const prepare = async () => {
    assert.deepEqual(
      held,
      new Set([
        'revealline.installed-app.switch',
        `${profile(a.version)}.writer`,
        `${profile(b.version)}.writer`,
      ]),
    );
    assert.deepEqual(readInstalledState(h.storage).active, a);
    await Promise.resolve();
    assert.equal(held.size, 3);
  };
  await assert.rejects(
    activateInstalledEdition(b, {
      ...h,
      locks,
      prepare: async () => {
        await prepare();
        throw new Error('Core verification failed.');
      },
    }),
    /Core verification failed/,
  );
  assert.deepEqual(readInstalledState(h.storage).active, a);
  assert.equal(held.size, 0);
  assert.equal((await activateInstalledEdition(b, { ...h, locks, prepare })).activated, true);
  assert.deepEqual(readInstalledState(h.storage).active, b);
  assert.equal(held.size, 0);
});
