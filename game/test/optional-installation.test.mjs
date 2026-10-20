import test from 'node:test';
import assert from 'node:assert/strict';
import {
  optionalInstallationKey,
  recordOptionalInstallation,
  removeOptionalInstallation,
  validateOptionalInstallationReference,
  optionalOfflineFailureMessage,
} from '../../optional-practice/install-context.mjs';
import { preparePracticeOffline } from '../../optional-practice/civilian-flight/offline.mjs';
import { installOptionalLauncher } from '../../optional-practice/launcher-template.mjs';
import { runInNewContext } from 'node:vm';
import { waitFor } from './helpers/wait-for.mjs';

const packageId = 'civilian-flight';
const root = '/revealline/practice/civilian-flight/';
const locationFor = (version, base = root) => ({
  href: `https://example.test${base}releases/${version}/site/optional-practice/civilian-flight/index.html`,
});
function memory() {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}
test('optional installations preserve previous versions and isolate stable roots without touching Journey', () => {
  const storage = memory();
  storage.setItem('journey-sample', 'untouched');
  recordOptionalInstallation({ packageId, storage, location: locationFor('v1.2.2') });
  recordOptionalInstallation({ packageId, storage, location: locationFor('v1.2.3') });
  const state = JSON.parse(storage.getItem(optionalInstallationKey(packageId, root)));
  assert.equal(state.active.version, 'v1.2.3');
  assert.equal(state.previous.version, 'v1.2.2');
  const otherRoot = '/other/practice/civilian-flight/';
  recordOptionalInstallation({ packageId, storage, location: locationFor('v1.3.0', otherRoot) });
  assert.notEqual(
    optionalInstallationKey(packageId, root),
    optionalInstallationKey(packageId, otherRoot),
  );
  removeOptionalInstallation({ packageId, storage, location: locationFor('v1.2.3') });
  assert.equal(
    JSON.parse(storage.getItem(optionalInstallationKey(packageId, root))).active.version,
    'v1.2.2',
  );
  assert.equal(
    JSON.parse(storage.getItem(optionalInstallationKey(packageId, otherRoot))).active.version,
    'v1.3.0',
  );
  assert.equal(storage.getItem('journey-sample'), 'untouched');
  assert.equal(
    recordOptionalInstallation({
      packageId,
      storage,
      location: { href: 'http://localhost:8768/optional-practice/civilian-flight/' },
    }),
    false,
  );
});

test('optional launch references reject foreign origins, roots, entries and versions', () => {
  const context = { packageId, root, baseURL: 'https://example.test' + root + 'app/' };
  const original = {
    id: packageId,
    version: 'v1.2.3',
    scope: '../releases/v1.2.3/site/',
    entry: 'optional-practice/civilian-flight/index.html',
  };
  assert.match(
    validateOptionalInstallationReference(original, context).scope,
    /^https:\/\/example.test/,
  );
  for (const change of [
    { id: 'other' },
    { entry: 'game/index.html' },
    { version: '../private' },
    { scope: 'https://evil.example/site/' },
    { scope: '/other/practice/civilian-flight/releases/v1.2.3/site/' },
    { scope: '../releases/v1.2.3/site/?edition=other' },
  ])
    assert.throws(() => validateOptionalInstallationReference({ ...original, ...change }, context));
});

test('an installation pointer is recorded only after a verified worker activates', async () => {
  const storage = memory(),
    callbacks = new Set();
  const worker = {
    state: 'installing',
    scriptURL: new URL('worker.js', locationFor('v1.2.3').href).href,
    postMessage(data, ports) {
      if (data.type === 'practice-status')
        ports[0].postMessage({ type: 'practice-status', ready: true, scope: registration.scope });
    },
    addEventListener: (_, callback) => callbacks.add(callback),
    removeEventListener: (_, callback) => callbacks.delete(callback),
  };
  const registration = {
    installing: worker,
    scope: new URL('./', locationFor('v1.2.3').href).href,
  };
  const navigator = {
    serviceWorker: {
      register: async () => registration,
      getRegistration: async () => registration,
    },
  };
  const pending = preparePracticeOffline({
    storage,
    location: locationFor('v1.2.3'),
    navigator,
  });
  await waitFor(() => callbacks.size > 0);
  assert.equal(storage.values.size, 0);
  worker.state = 'activated';
  registration.active = worker;
  for (const callback of [...callbacks]) callback();
  await pending;
  assert.equal(
    JSON.parse(storage.getItem(optionalInstallationKey(packageId, root))).active.version,
    'v1.2.3',
  );
  assert.equal(callbacks.size, 0);
  const failedStorage = memory();
  worker.state = 'installing';
  registration.active = null;
  const failed = preparePracticeOffline({
    storage: failedStorage,
    location: locationFor('v1.2.3'),
    navigator,
  });
  await waitFor(() => callbacks.size > 0);
  worker.state = 'redundant';
  for (const callback of [...callbacks]) callback();
  await assert.rejects(failed, /verification failed/);
  assert.equal(failedStorage.values.size, 0);
  assert.equal(callbacks.size, 0);
});

function launcher(
  fetcher,
  query = '',
  { storage = memory(), offlineReady = false, services = {} } = {},
) {
  const elements = Object.fromEntries(
    ['locale', 'title', 'check', 'open', 'prepare', 'previous', 'status', 'remove', 'download'].map(
      (id) => [id, { hidden: true, textContent: '', disabled: false }],
    ),
  );
  const events = new Map(),
    timers = new Map(),
    locations = [];
  const context = {
    document: { documentElement: {}, getElementById: (id) => elements[id] },
    navigator: { language: 'en' },
    localStorage: storage,
    location: {
      href: 'https://example.test' + root + 'app/' + query,
      assign: (url) => locations.push(url),
    },
    fetch: fetcher,
    AbortController,
    TextDecoder,
    Uint8Array,
    URL,
    optionalInstallationKey,
    validateOptionalInstallationReference,
    inspectOptionalOffline: async (base) =>
      typeof offlineReady === 'function' ? offlineReady(base) : offlineReady,
    services,
    setTimeout(callback) {
      timers.set(callback, callback);
      return callback;
    },
    clearTimeout(callback) {
      timers.delete(callback);
    },
    addEventListener(name, callback) {
      events.set(name, callback);
    },
  };
  const ready = runInNewContext(
    `(${installOptionalLauncher.toString()})(${JSON.stringify({ packageId, root })}, { optionalInstallationKey, validateOptionalInstallationReference, inspectOptionalOffline, ...services })`,
    context,
  );
  return { elements, events, timers, locations, ready };
}

test('launcher failures use localized safe copy, retain usable actions and retranslate without retrying', async () => {
  const current = {
    id: packageId,
    version: 'v1.2.3',
    scope: '../releases/v1.2.3/site/',
    entry: 'optional-practice/civilian-flight/index.html',
  };
  for (const locale of ['en', 'uk']) {
    for (const operation of ['prepare', 'remove']) {
      for (const reason of ['idle-timeout', 'overall-timeout', 'cancelled', 'unknown']) {
        for (const legacyService of [false, true]) {
          const error = Object.assign(new Error('SECRET https://private.test/<script>'), {
            offlineCode: reason,
          });
          let calls = 0;
          const fail = async () => {
            calls++;
            throw error;
          };
          const storage = memory();
          recordOptionalInstallation({ packageId, storage, location: locationFor('v1.2.3') });
          const saved = storage.getItem(optionalInstallationKey(packageId, root));
          const f = launcher(async () => new Response(JSON.stringify(current)), '?lang=' + locale, {
            storage,
            offlineReady: true,
            services: {
              prepareOptionalOffline: fail,
              removeOptionalOffline: fail,
              ...(!legacyService ? { optionalOfflineFailureMessage } : {}),
            },
          });
          await f.ready;
          const open = f.elements.open.href;
          await f.elements[operation === 'prepare' ? 'download' : 'remove'].onclick();
          for (const language of [locale, locale === 'en' ? 'uk' : 'en']) {
            f.elements.locale.value = language;
            f.elements.locale.onchange();
            const text = f.elements.status.textContent;
            assert.doesNotMatch(
              text,
              /SECRET|private\.test|script|Needs repair|Потрібне відновлення/,
            );
            if (!legacyService)
              assert.equal(text, optionalOfflineFailureMessage(error, language, operation));
            else
              assert.match(
                text,
                language === 'uk' ? /Не вдалося/ : /not completed|Could not remove/,
              );
          }
          assert.equal(calls, 1, 'Changing language must not repeat the failed operation');
          assert.equal(f.elements.open.hidden, false);
          assert.equal(new URL(f.elements.open.href).pathname, new URL(open).pathname);
          assert.equal(f.elements.remove.hidden, false);
          assert.equal(storage.getItem(optionalInstallationKey(packageId, root)), saved);
          assert.equal(f.elements.download.disabled, false);
          await f.elements.check.onclick();
          assert.match(f.elements.status.textContent, /Ready offline|Готово офлайн/);
        }
      }
    }
  }
});

test('legacy launcher failure never invents an available saved copy', async () => {
  const current = {
    id: packageId,
    version: 'v1.2.3',
    scope: '../releases/v1.2.3/site/',
    entry: 'optional-practice/civilian-flight/index.html',
  };
  for (const locale of ['en', 'uk']) {
    for (const readiness of ['no-pointer', false, { status: 'unknown' }]) {
      const storage = memory();
      if (readiness !== 'no-pointer')
        recordOptionalInstallation({ packageId, storage, location: locationFor('v1.2.3') });
      const f = launcher(async () => new Response(JSON.stringify(current)), '?lang=' + locale, {
        storage,
        offlineReady: readiness === 'no-pointer' ? false : readiness,
        services: {
          prepareOptionalOffline: async () => {
            throw new Error('SECRET');
          },
        },
      });
      await f.ready;
      await f.elements.download.onclick();
      assert.equal(f.elements.open.hidden, true);
      assert.doesNotMatch(
        f.elements.status.textContent,
        /SECRET|remain available|залишаються доступними|Ready offline|Готово офлайн/,
      );
    }
  }
});

test('stable launcher forwards a bounded cosmetic pin without admitting navigation or storage context', async () => {
  const current = {
    id: packageId,
    version: 'v1.2.3',
    scope: '../releases/v1.2.3/site/',
    entry: 'optional-practice/civilian-flight/index.html',
  };
  const fetcher = async () => new Response(JSON.stringify(current));
  const valid = launcher(
    fetcher,
    '?appearanceFamily=tryzub&appearanceRevision=r1&edition=foreign&script=remote',
  );
  await valid.ready;
  await valid.elements.check.onclick();
  const target = new URL(valid.elements.prepare.href);
  assert.deepEqual(
    [...target.searchParams],
    [
      ['lang', 'en'],
      ['appearanceFamily', 'tryzub'],
      ['appearanceRevision', 'r1'],
    ],
  );
  for (const query of [
    '?appearanceFamily=tryzub',
    '?appearanceFamily=../private&appearanceRevision=r1',
    '?appearanceFamily=tryzub&appearanceFamily=dos&appearanceRevision=r1',
  ]) {
    const invalid = launcher(fetcher, query);
    await invalid.ready;
    await invalid.elements.check.onclick();
    assert.equal(new URL(invalid.elements.prepare.href).search, '?lang=en');
  }
});

test('launcher keeps missing-file repair and removal visible after checking an available release', async () => {
  for (const [locale, instructions] of [
    ['en', /Remove this offline copy, then download it again/],
    ['uk', /Видаліть цю офлайн-копію, потім завантажте її знову/],
  ]) {
    const storage = memory();
    recordOptionalInstallation({ packageId, storage, location: locationFor('v1.2.3') });
    const current = {
      id: packageId,
      version: 'v1.2.3',
      scope: '../releases/v1.2.3/site/',
      entry: 'optional-practice/civilian-flight/index.html',
    };
    for (const available of [true, false]) {
      const f = launcher(
        async () => {
          if (!available) throw new Error('Offline');
          return new Response(JSON.stringify(current));
        },
        '?lang=' + locale,
        { storage, offlineReady: false },
      );
      await f.ready;
      assert.match(f.elements.status.textContent, instructions);
      assert.equal(f.elements.remove.hidden, false);
      assert.equal(f.elements.open.hidden, true);
    }
    recordOptionalInstallation({ packageId, storage, location: locationFor('v1.2.2') });
    recordOptionalInstallation({ packageId, storage, location: locationFor('v1.2.3') });
    let hold,
      release,
      failedPrevious = false,
      reads = 0;
    const retained = launcher(
      async () => new Response(JSON.stringify(current)),
      '?lang=' + locale,
      {
        storage,
        offlineReady: async (base) => {
          reads++;
          if (failedPrevious && base.href.includes('/v1.2.2/')) return false;
          return hold && base.href.includes('/v1.2.3/')
            ? new Promise((resolve) => (release = resolve))
            : true;
        },
      },
    );
    await retained.ready;
    assert.equal(retained.elements.previous.hidden, false);
    const previous = retained.elements.previous.href;
    hold = true;
    const pending = retained.elements.check.onclick();
    await waitFor(() => release);
    const inFlightReads = reads;
    await retained.elements.check.onclick();
    assert.equal(reads, inFlightReads, 'Repeated Check cannot overlap a pending hash verification');
    assert.equal(retained.elements.check.disabled, true);
    assert.equal(
      retained.elements.previous.hidden,
      false,
      'Previously verified rollback stays visible',
    );
    assert.equal(retained.elements.previous.href, previous);
    assert.match(retained.elements.status.textContent, /Checking prepared|Перевірка підготовлених/);
    hold = false;
    release(true);
    await pending;
    assert.equal(retained.elements.previous.hidden, false);
    assert.equal(retained.elements.check.disabled, false);
    failedPrevious = true;
    await retained.elements.check.onclick();
    assert.equal(
      retained.elements.previous.hidden,
      true,
      'A newly failed check removes the stale action',
    );
    assert.equal(retained.elements.open.hidden, false, 'The ready active version remains usable');
    assert.match(retained.elements.status.textContent, instructions);
  }
});

test('launcher distinguishes unfinished verification from missing files without inventing readiness', async () => {
  for (const [locale, unfinished] of [
    ['en', /Offline verification could not finish/],
    ['uk', /Не вдалося завершити офлайн-перевірку/],
  ]) {
    const storage = memory();
    recordOptionalInstallation({ packageId, storage, location: locationFor('v1.2.2') });
    recordOptionalInstallation({ packageId, storage, location: locationFor('v1.2.3') });
    const saved = storage.getItem(optionalInstallationKey(packageId, root));
    const current = {
      id: packageId,
      version: 'v1.2.3',
      scope: '../releases/v1.2.3/site/',
      entry: 'optional-practice/civilian-flight/index.html',
    };
    let status = 'unknown',
      missingPrevious = false;
    const f = launcher(async () => new Response(JSON.stringify(current)), '?lang=' + locale, {
      storage,
      offlineReady: async (base) => ({
        status: missingPrevious && base.href.includes('/v1.2.2/') ? 'unavailable' : status,
      }),
    });
    await f.ready;
    assert.match(f.elements.status.textContent, unfinished);
    assert.equal(
      f.elements.open.hidden,
      true,
      'An unknown initial check cannot certify a saved pointer',
    );
    assert.equal(f.elements.previous.hidden, true);
    status = 'ready';
    await f.elements.check.onclick();
    const active = f.elements.open.href,
      previous = f.elements.previous.href;
    assert.equal(f.elements.open.hidden, false);
    assert.equal(f.elements.previous.hidden, false);
    status = 'unknown';
    await f.elements.check.onclick();
    assert.match(f.elements.status.textContent, unfinished);
    assert.equal(
      f.elements.open.hidden,
      false,
      'An inconclusive recheck retains the known prepared action',
    );
    assert.equal(f.elements.previous.hidden, false);
    assert.equal(f.elements.open.href, active);
    assert.equal(f.elements.previous.href, previous);
    missingPrevious = true;
    await f.elements.check.onclick();
    assert.equal(
      f.elements.previous.hidden,
      true,
      'Confirmed missing files still remove the broken action',
    );
    assert.equal(f.elements.open.hidden, false);
    assert.match(f.elements.status.textContent, /Needs repair|Потрібне відновлення/);
    assert.equal(
      storage.getItem(optionalInstallationKey(packageId, root)),
      saved,
      'Verification does not mutate saved versions',
    );
  }
});

test('verified app actions do not wait for unrelated retained-version or launcher checks', async () => {
  for (const delayed of ['previous', 'launcher']) {
    const storage = memory();
    recordOptionalInstallation({ packageId, storage, location: locationFor('v1.2.2') });
    recordOptionalInstallation({ packageId, storage, location: locationFor('v1.2.3') });
    let finish;
    const f = launcher(
      async () => {
        throw new Error('Offline');
      },
      '',
      {
        storage,
        offlineReady: async (base) => {
          if (delayed === 'previous' ? base.href.includes('/v1.2.2/') : base.href.endsWith('/app/'))
            return new Promise((resolve) => {
              finish = resolve;
            });
          return { status: 'ready' };
        },
      },
    );
    await waitFor(() => finish);
    await new Promise((resolve) => setImmediate(resolve));
    try {
      assert.equal(f.elements.open.hidden, false, `${delayed} check cannot hide a verified app`);
      assert.match(f.elements.open.href, /\/v1\.2\.3\//);
      assert.match(f.elements.status.textContent, /Checking prepared/);
      assert.equal(f.elements.check.disabled, true);
    } finally {
      finish({ status: 'unknown' });
      await f.ready;
    }
    assert.equal(f.elements.open.hidden, false);
    assert.match(f.elements.status.textContent, /Offline verification could not finish/);
  }
});

test('retained ready copy stays reachable while active verification stalls, including locale changes', async () => {
  const storage = memory();
  recordOptionalInstallation({ packageId, storage, location: locationFor('v1.2.2') });
  recordOptionalInstallation({ packageId, storage, location: locationFor('v1.2.3') });
  let finish;
  const f = launcher(
    async () => {
      throw new Error('Offline');
    },
    '',
    {
      storage,
      offlineReady: (base) =>
        base.href.includes('/v1.2.3/')
          ? new Promise((resolve) => {
              finish = resolve;
            })
          : { status: 'ready' },
    },
  );
  await waitFor(() => finish);
  await new Promise((resolve) => setImmediate(resolve));
  try {
    assert.equal(f.elements.open.hidden, true, 'No saved pointer alone certifies active readiness');
    assert.equal(f.elements.previous.hidden, false);
    assert.match(f.elements.previous.href, /\/v1\.2\.2\//);
    f.elements.locale.value = 'uk';
    f.elements.locale.onchange();
    assert.equal(new URL(f.elements.previous.href).searchParams.get('lang'), 'uk');
  } finally {
    finish({ status: 'unavailable' });
    await f.ready;
  }
  assert.equal(f.elements.previous.hidden, false);
  assert.equal(f.elements.open.hidden, true);
  assert.match(f.elements.status.textContent, /Потрібне відновлення/);
});

test('invalid retained metadata cannot blank a separately verified active app', async () => {
  const storage = memory();
  recordOptionalInstallation({ packageId, storage, location: locationFor('v1.2.3') });
  const key = optionalInstallationKey(packageId, root),
    saved = JSON.parse(storage.getItem(key));
  saved.previous = { ...saved.active, scope: 'https://untrusted.example/' };
  storage.setItem(key, JSON.stringify(saved));
  const checked = [];
  const f = launcher(
    async () => {
      throw new Error('Offline');
    },
    '',
    {
      storage,
      offlineReady: (base) => {
        checked.push(base.href);
        return { status: 'ready' };
      },
    },
  );
  await f.ready;
  assert.equal(f.elements.open.hidden, false);
  assert.equal(f.elements.previous.hidden, true);
  assert.equal(checked.length, 2);
  assert.ok(checked.every((url) => url.startsWith('https://example.test/')));
  assert.equal(storage.getItem(key), JSON.stringify(saved), 'Inspection never rewrites pointers');
});

test('leaving during readiness checks cancels publication and play intent even after pageshow', async () => {
  for (const returnToPage of [false, true]) {
    const storage = memory();
    recordOptionalInstallation({ packageId, storage, location: locationFor('v1.2.3') });
    const pending = [];
    let requests = 0;
    const f = launcher(
      async () => {
        requests++;
        throw new Error('Offline');
      },
      '?action=play',
      {
        storage,
        offlineReady: () => new Promise((resolve) => pending.push(resolve)),
      },
    );
    await waitFor(() => pending.length === 2);
    f.events.get('pagehide')();
    if (returnToPage) f.events.get('pageshow')();
    for (const finish of pending) finish({ status: 'ready' });
    await f.ready;
    assert.equal(f.elements.open.hidden, true);
    assert.equal(requests, 0);
    assert.deepEqual(f.locations, []);
    assert.equal(f.elements.check.disabled, false);
  }
});

test('abandoned fetch cannot replay play intent after pageshow, but a live timeout can fall back offline', async () => {
  for (const abandoned of [true, false]) {
    const storage = memory();
    recordOptionalInstallation({ packageId, storage, location: locationFor('v1.2.3') });
    let fail, signal;
    const f = launcher(
      (_url, options) => {
        signal = options.signal;
        return new Promise((_resolve, reject) => {
          fail = reject;
        });
      },
      '?action=play',
      { storage, offlineReady: true },
    );
    await waitFor(() => fail);
    if (abandoned) {
      f.events.get('pagehide')();
      f.events.get('pageshow')();
    } else {
      assert.equal(f.timers.size, 1);
      [...f.timers.values()][0]();
    }
    assert.equal(signal.aborted, true);
    fail(new Error('Aborted'));
    await f.ready;
    assert.equal(f.locations.length, abandoned ? 0 : 1);
    assert.equal(f.elements.open.hidden, false, 'Verified manual Open stays available');
    assert.equal(f.timers.size, 0);
  }
});

test('stable launcher keeps locale and appearance on auto-play and verified offline fallback', async () => {
  const current = {
    id: packageId,
    version: 'v1.2.3',
    scope: '../releases/v1.2.3/site/',
    entry: 'optional-practice/civilian-flight/index.html',
  };
  const query = '?action=play&lang=uk&appearanceFamily=dnipro-porcelain&appearanceRevision=r1';
  const online = launcher(async () => new Response(JSON.stringify(current)), query);
  await online.ready;
  assert.equal(online.locations.length, 1);
  const storage = memory();
  recordOptionalInstallation({ packageId, storage, location: locationFor('v1.2.2') });
  const saved = storage.getItem(optionalInstallationKey(packageId, root));
  const offline = launcher(
    async () => {
      throw new Error('Unavailable');
    },
    query,
    {
      storage,
      offlineReady: true,
    },
  );
  await offline.ready;
  assert.equal(offline.locations.length, 1);
  for (const [href, version] of [
    [online.locations[0], 'v1.2.3'],
    [offline.locations[0], 'v1.2.2'],
  ]) {
    const target = new URL(href);
    assert.equal(target.pathname, root + `releases/${version}/site/` + current.entry);
    assert.deepEqual(
      [...target.searchParams],
      [
        ['lang', 'uk'],
        ['appearanceFamily', 'dnipro-porcelain'],
        ['appearanceRevision', 'r1'],
      ],
    );
  }
  assert.equal(offline.elements.open.href, offline.locations[0]);
  assert.equal(storage.getItem(optionalInstallationKey(packageId, root)), saved);
});

test('stable launcher reads only a bounded explicit pointer and cancels abandoned checks', async () => {
  const requests = [];
  const current = {
    id: packageId,
    version: 'v1.2.3',
    scope: '../releases/v1.2.3/site/',
    entry: 'optional-practice/civilian-flight/index.html',
  };
  const first = launcher(async (url, options) => {
    requests.push({ url, options });
    return new Response(JSON.stringify(current));
  });
  assert.equal(requests.length, 0);
  await first.ready;
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.redirect, 'error');
  assert.equal(requests[0].options.credentials, 'omit');
  assert.equal(
    first.elements.prepare.href,
    'https://example.test' + root + 'releases/v1.2.3/site/' + current.entry + '?lang=en',
  );
  assert.equal(first.elements.prepare.hidden, false);
  assert.equal(first.timers.size, 0);
  const oversized = launcher(async () => new Response(' '.repeat(4097)));
  await oversized.ready;
  assert.equal(oversized.elements.prepare.hidden, true);
  assert.equal(oversized.elements.check.disabled, false);
  assert.match(oversized.elements.status.textContent, /unavailable/);
  let finish, signal;
  const abandoned = launcher((_url, options) => {
    signal = options.signal;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const pending = abandoned.ready;
  await waitFor(() => !!signal);
  abandoned.events.get('pagehide')();
  assert.equal(signal.aborted, true);
  finish(new Response(JSON.stringify(current)));
  await pending;
  assert.equal(abandoned.elements.prepare.hidden, true);
  assert.equal(abandoned.timers.size, 0);
});
