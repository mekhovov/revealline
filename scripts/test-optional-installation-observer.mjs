import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import {
  OBSERVED_PACKAGES,
  TRANSFER_TIMEOUT_MS,
  boundedOperation,
  closeAllPages,
  closeBrowserForRestart,
  unlockObservedPage,
  matchesLaunchedAppURL,
  revealFPVOffline,
  revealFPVProfiles,
  expectedImportedProfileExport,
  activateOfflineAction,
  OBSERVATION_TIMEOUT_MS,
  trackObservedResource,
  resourceCleanupIssues,
} from './optional-installation-observer-helpers.mjs';

test('browser restart requires all pages closed and a confirmed persistent-context shutdown', async () => {
  let listener;
  const actions = [];
  let pages = [
    {
      close: async () => {
        actions.push('page');
        pages = [];
      },
    },
  ];
  const context = {
    pages: () => pages,
    once: (name, callback) => {
      assert.equal(name, 'close');
      listener = callback;
    },
    off: (name, callback) => {
      assert.equal(callback, listener);
      actions.push('off');
    },
    close: async () => {
      actions.push('browser');
      listener();
    },
  };
  assert.deepEqual(await closeBrowserForRestart(context), {
    closedPageCount: 1,
    contextClosed: true,
  });
  assert.deepEqual(actions, ['page', 'browser', 'off']);
  context.close = async () => {};
  await assert.rejects(closeBrowserForRestart(context), /did not confirm closure/);
  context.close = async () => {
    throw new Error('Browser close failed');
  };
  await assert.rejects(closeBrowserForRestart(context), /Browser close failed/);
  const source = await readFile(
    new URL('./observe-optional-installation.mjs', import.meta.url),
    'utf8',
  );
  assert.match(source, /await closeBrowserForRestart\(context\)/);
  assert.match(source, /await launchBrowser\(true\)/);
  assert.match(source, /browserRestart\.passed &&/);
  assert.match(source, /app\.restartedOfflineWindow\?\.standalone/);
});

test('timed-out startup retains resource ownership and a late close failure cannot imply cleanup', async () => {
  const state = { pending: new Set(), errors: [] };
  let finishLaunch;
  const launch = new Promise((resolve) => {
    finishLaunch = resolve;
  });
  const acquisition = trackObservedResource(state, 'Browser', async () => {
    await launch;
    throw new Error('Late close failed');
  });
  const eventualFailure = acquisition.catch((error) => error);
  await assert.rejects(
    boundedOperation('Journey', () => acquisition, 2),
    /timed out/,
  );
  const recordedAtCleanup = resourceCleanupIssues(state);
  assert.equal(recordedAtCleanup.length, 1);
  assert.match(recordedAtCleanup[0].error, /pending; profile retained/);
  finishLaunch();
  assert.match((await eventualFailure).message, /Late close failed/);
  assert.equal(state.pending.size, 0);
  assert.match(resourceCleanupIssues(state)[0].error, /Late close failed/);
  // The already-written receipt remains conservatively unverified, never clean.
  assert.match(recordedAtCleanup[0].error, /profile retained/);
  const clean = { pending: new Set(), errors: [] };
  assert.equal(await trackObservedResource(clean, 'Browser', async () => 42), 42);
  assert.deepEqual(resourceCleanupIssues(clean), []);
});

test('an expired restart cannot start browser acquisition after cleanup has begun', async () => {
  const source = await readFile(
    new URL('./observe-optional-installation.mjs', import.meta.url),
    'utf8',
  );
  const functionSource = source.slice(
    source.indexOf('async function launchBrowser('),
    source.indexOf('\nconst relativeRoot'),
  );
  let acquired = false;
  await assert.rejects(
    runInNewContext(`(${functionSource})(true)`, {
      requireObservationTime: () => {
        throw new Error('Installation observation deadline exceeded.');
      },
      trackObservedResource: () => {
        acquired = true;
      },
    }),
    /deadline exceeded/,
  );
  assert.equal(acquired, false);
});

test('offline action requires fresh observable work, native Enter and a fresh terminal status', async () => {
  async function exercise({
    initial = '',
    changes = ['Preparing…', 'Ready offline'],
    expected = /ready offline/i,
    progressOnly = false,
    stillBusy = false,
  }) {
    const node = { textContent: initial, contains: () => false };
    let observer,
      disconnected = false;
    const environment = {
      document: {
        body: {},
        querySelector: (selector) =>
          selector === '#status'
            ? node
            : selector === '#prepare'
              ? { disabled: stillBusy }
              : stillBusy
                ? {}
                : null,
      },
      MutationObserver: class {
        constructor(callback) {
          observer = callback;
        }
        observe() {}
        disconnect() {
          disconnected = true;
        }
      },
    };
    // Keep the witness in one isolated browser-like global between evaluations.
    const browser = { ...environment };
    const invoke = (fn, input) => {
      browser.input = input;
      return runInNewContext(`(${fn.toString()})(input)`, browser);
    };
    const emit = (text) => {
      node.textContent = text;
      observer([{ target: node, addedNodes: [] }]);
    };
    const page = {
      evaluate: async (fn, input) => invoke(fn, input),
      locator: () => ({
        press: async (key) => {
          assert.equal(key, 'Enter');
          if (progressOnly)
            observer([{ target: {}, addedNodes: [{ nodeType: 1, matches: () => true }] }]);
          else if (changes.length) emit(changes[0]);
        },
      }),
      waitForFunction: async (fn, input, options) => {
        assert.ok([30_000, TRANSFER_TIMEOUT_MS].includes(options.timeout));
        if (options.timeout === TRANSFER_TIMEOUT_MS && changes.length > 1) emit(changes[1]);
        if (!invoke(fn, input)) throw new Error('No fresh observed transition');
      },
    };
    try {
      await activateOfflineAction(page, { button: '#prepare', status: '#status', expected });
    } finally {
      assert.equal(disconnected, true);
      assert.equal(browser.__optionalInstallationWitness, undefined);
    }
  }
  await exercise({});
  await exercise({ changes: ['Ready offline'] });
  await exercise({ progressOnly: true });
  await exercise({ initial: 'Ready offline', changes: ['Preparing…', 'Ready offline'] });
  await assert.rejects(exercise({ initial: 'Ready offline', changes: [] }), /No fresh/);
  await assert.rejects(exercise({ stillBusy: true }), /No fresh/);
  await assert.rejects(
    exercise({ changes: ['Preparing…', 'Storage quota denied'] }),
    /Offline action failed/,
  );
  await exercise({
    changes: ['Preparing…', 'Verification failed'],
    expected: /verification failed/i,
  });
});

test('overall observation deadline encloses the journey but preserves report and cleanup', async () => {
  assert.equal(OBSERVATION_TIMEOUT_MS, 600_000);
  const source = await readFile(
    new URL('./observe-optional-installation.mjs', import.meta.url),
    'utf8',
  );
  assert.match(
    source,
    /try \{\s*await boundedOperation\(\s*'Complete installation observation',\s*async \(\) => \{/,
  );
  assert.match(source, /},\s*OBSERVATION_TIMEOUT_MS,?\s*\);\s*} catch \(error\)/);
  assert.match(source, /} finally \{\s*const cleanupErrors/);
  assert.match(source, /await writeFile\(output, JSON.stringify\(report/);
  assert.match(
    source,
    /sha\(await readFile\(helperURL\)\);\s*\/\/[^\n]*\n\s*requireObservationTime\(\);\s*report =/,
  );
});

test('installation observer covers all three public app identities and current offline controls', async () => {
  assert.deepEqual(Object.keys(OBSERVED_PACKAGES), [
    'civilian-flight',
    'civilian-fpv',
    'fpv-worlds',
  ]);
  for (const [id, adapter] of Object.entries(OBSERVED_PACKAGES)) {
    const markup = await readFile(
      new URL(`../optional-practice/${id}/index.html`, import.meta.url),
      'utf8',
    );
    for (const selector of [adapter.prepare, adapter.status]) {
      assert.ok(markup.includes(`id="${selector.slice(1)}"`), `${id} must contain ${selector}`);
    }
  }
  for (const [id, adapter] of Object.entries(OBSERVED_PACKAGES)) {
    const source = await readFile(
      new URL(
        `../optional-practice/${id === 'civilian-flight' ? id : 'civilian-fpv'}/${id === 'fpv-worlds' ? 'world-' : ''}app.mjs`,
        import.meta.url,
      ),
      'utf8',
    );
    assert.ok(source.includes(`idPrefix: '${adapter.settingsPrefix}-shell'`));
    assert.ok(source.includes(`prefix: '${adapter.settingsPrefix}-settings'`));
    assert.equal(adapter.mounted, `#${adapter.settingsPrefix}-shell-action-settings`);
  }
  const gym = OBSERVED_PACKAGES['civilian-flight'];
  assert.equal(gym.panel, '#gym-settings-tab-content');
  assert.equal(gym.close, '#gym-shell-action-settings-back');
  const gymSource = await readFile(
    new URL('../optional-practice/civilian-flight/app.mjs', import.meta.url),
    'utf8',
  );
  assert.match(
    gymSource,
    /offlineControls\.append\(\$\('offline'\), \$\('remove-offline'\), \$\('package-status'\)\)/,
  );
  assert.match(gymSource, /content: \[offlineControls\]/);
  const shell = await readFile(new URL('../game/ui/mode-play-shell.mjs', import.meta.url), 'utf8');
  assert.ok(shell.includes("button('back', back, false, `${name}-back`)"));
  assert.ok(
    TRANSFER_TIMEOUT_MS > 300_000,
    'The harness must permit the app-owned five-minute limit.',
  );
});

test('launcher destinations preserve exact app identity and the defined locale query', async () => {
  const entry =
    'http://127.0.0.1:4000/revealline/practice/civilian-flight/releases/v1.2.3/site/optional-practice/civilian-flight/index.html';
  assert.equal(matchesLaunchedAppURL(entry + '?lang=en', entry), true);
  assert.equal(matchesLaunchedAppURL(new URL(entry + '?lang=uk'), entry, 'uk'), true);
  for (const observed of [
    entry,
    entry + '?lang=uk',
    entry + '?lang=de',
    entry + '?lang=en&lang=en',
    entry + '?lang=en&action=play',
    entry + '?lang=en#other',
    entry.replace('4000', '4001') + '?lang=en',
    entry.replace('v1.2.3', 'v1.2.2') + '?lang=en',
  ]) {
    assert.equal(matchesLaunchedAppURL(observed, entry), false, observed);
  }
  const launcher = await readFile(
    new URL('../optional-practice/launcher-template.mjs', import.meta.url),
    'utf8',
  );
  assert.ok(
    launcher.includes("url.searchParams.set('lang', locale)"),
    'Track the actual launcher locale contract.',
  );
});

test('bounded operation returns results, preserves errors, and rejects stalls', async () => {
  assert.equal(await boundedOperation('success', () => 42, 50), 42);
  await assert.rejects(
    boundedOperation(
      'failure',
      () => {
        throw new Error('original');
      },
      50,
    ),
    /original/,
  );
  await assert.rejects(
    boundedOperation('stalled operation', () => new Promise(() => {}), 5),
    /stalled operation timed out/,
  );
});

test('Academy offline controls expand the ordinary closed Workshop disclosure in every offline flow', async () => {
  const markup = await readFile(
    new URL('../optional-practice/civilian-fpv/index.html', import.meta.url),
    'utf8',
  );
  const disclosure = markup.match(
    /<details>\s*<summary data-sim-copy="workshopAndOffline">[\s\S]*?<\/details>/,
  )?.[0];
  assert.ok(disclosure, 'Workshop & offline is initially a closed disclosure.');
  for (const id of ['install-offline', 'remove-offline'])
    assert.ok(disclosure.includes(`id="${id}"`));
  let helpOpen = false;
  let disclosureOpen = false;
  const clicks = [];
  const page = {
    locator: (selector) => ({
      isVisible: async () => helpOpen,
      locator: () => ({ getAttribute: async () => (disclosureOpen ? '' : null) }),
      press: async (key) => {
        assert.equal(key, 'Enter');
        clicks.push(selector);
        disclosureOpen = true;
      },
      waitFor: async ({ state }) => {
        assert.equal(state, 'visible');
        assert.equal(
          helpOpen && disclosureOpen,
          true,
          `${selector} must be reachable through public controls.`,
        );
      },
    }),
  };
  const openHelp = async () => {
    clicks.push('#help');
    helpOpen = true;
  };
  await revealFPVOffline(page, openHelp);
  assert.deepEqual(clicks, ['#help', 'summary[data-sim-copy="workshopAndOffline"]']);
  await revealFPVOffline(page, openHelp);
  assert.equal(clicks.length, 2, 'An already-open disclosure must not be toggled closed.');
  const observer = await readFile(
    new URL('./observe-optional-installation.mjs', import.meta.url),
    'utf8',
  );
  assert.equal(
    observer.match(/await revealFPVOffline\(page, \(\) => clickFPV\('#help'\)\)/g)?.length,
    5,
    'Preparation, failed download, quota denial/retry removal share the same public disclosure action.',
  );
});

test('opt-in quota denial preserves pointers, resets before retry and retains exact helper authority', async () => {
  const observer = await readFile(
    new URL('./observe-optional-installation.mjs', import.meta.url),
    'utf8',
  );
  assert.match(observer, /OPTIONAL_INSTALLATION_QUOTA_PROBE === '1'/);
  assert.match(observer, /origin: new URL\(served.url\).origin/);
  assert.match(observer, /assert.equal\(quotaProbeReport.completed, true/);
  assert.match(observer, /denied.keys\[keyFor\(id\)\], upgraded.keys\[keyFor\(id\)\]/);
  assert.match(
    observer,
    /sourceStable: quotaProbeSha256 === sha\(await readFile\(quotaProbeURL\)\)/,
  );
  const denial = observer.indexOf("'controlled-quota-denial-preserves-all-pointers'");
  const rollback = observer.indexOf("'candidate-removed-retained-path-restored'");
  const retry = observer.indexOf("'quota-restored-pristine-retry-prepared'");
  assert(denial > 0 && rollback > denial && retry > rollback);
  assert.match(observer, /quotaProbeReport\?\.retryPreparedAndRemoved === true/);
  assert.doesNotMatch(observer, /Storage.clearDataForOrigin|quotaSize: null/);
});

test('profile import and every export open the ordinary transfer disclosure without toggling it closed', async () => {
  let setupOpen = false;
  let transferOpen = false;
  const actions = [];
  const page = {
    locator: (selector) => ({
      isVisible: async () => setupOpen,
      filter: ({ hasText }) => {
        assert.ok(hasText.test('Back up or import a profile'));
        return {
          locator: () => ({ getAttribute: async () => (transferOpen ? '' : null) }),
          press: async (key) => {
            assert.equal(key, 'Enter');
            actions.push(selector);
            transferOpen = true;
          },
        };
      },
    }),
    getByRole: (role, options) => ({
      waitFor: async ({ state }) => {
        assert.equal(role, 'textbox');
        assert.deepEqual(options, { name: 'Profile JSON', exact: true });
        assert.equal(state, 'visible');
        assert.ok(setupOpen && transferOpen);
      },
    }),
  };
  const openSetup = async () => {
    actions.push('#setup');
    setupOpen = true;
  };
  await revealFPVProfiles(page, openSetup);
  await revealFPVProfiles(page, openSetup);
  assert.deepEqual(actions, ['#setup', '#setup-dialog summary']);
  // Closing Setup destroys its radio editor, so the next visit is collapsed again.
  setupOpen = transferOpen = false;
  await revealFPVProfiles(page, openSetup);
  assert.equal(actions.length, 4);
  const guide = await readFile(
    new URL('../optional-practice/civilian-fpv/radio-guide.mjs', import.meta.url),
    'utf8',
  );
  assert.ok(guide.includes("transfer: t('Back up or import a profile'"));
  const observer = await readFile(
    new URL('./observe-optional-installation.mjs', import.meta.url),
    'utf8',
  );
  assert.equal(
    observer.match(/await revealFPVProfiles\(page, \(\) => clickFPV\('#setup', 'controls'\)\)/g)
      ?.length,
    2,
  );
});

test('profile export expectations preserve the entire legacy fixture and current radio library', () => {
  const fixture = {
    format: 'FlightProfiles.v1',
    radio: { id: 'fixture', verified: false },
    response: { id: 'response' },
  };
  assert.deepEqual(expectedImportedProfileExport('FlightProfiles.v1', fixture), fixture);
  const library = expectedImportedProfileExport('FlightProfiles.v2', fixture);
  assert.deepEqual(library, { ...fixture, format: 'FlightProfiles.v2', radios: [fixture.radio] });
  assert.equal(fixture.format, 'FlightProfiles.v1');
  assert.throws(() => expectedImportedProfileExport('FlightProfiles.v99', fixture), /Unsupported/);
  for (const damaged of [
    { ...library, radios: [] },
    { ...library, radio: { ...fixture.radio, verified: true } },
    { ...library, response: { id: 'changed' } },
    { ...library, extra: 'unexpected' },
  ])
    assert.notDeepEqual(damaged, library);
});

test('offline restart closes every page and rejects surviving windows', async () => {
  const pages = new Set();
  for (let index = 0; index < 4; index++) {
    const page = { close: async () => pages.delete(page) };
    pages.add(page);
  }
  assert.equal(await closeAllPages({ pages: () => [...pages] }), 4);
  assert.equal(pages.size, 0);
  await assert.rejects(
    closeAllPages({ pages: () => [{ close: async () => {} }] }),
    /zero surviving pages/,
  );
});

test('access-gated candidates require normal-form credentials and never expose them in errors', async () => {
  const actions = [];
  const page = {
    locator: (selector) => ({
      getAttribute: async () => 'locked',
      fill: async (value) => actions.push(['fill', selector, value]),
      click: async () => actions.push(['click', selector]),
    }),
    waitForFunction: async () => actions.push(['wait-for-unlock']),
  };
  await assert.rejects(unlockObservedPage(page), /OPTIONAL_INSTALLATION_PASSWORD/);
  assert.equal(actions.length, 0, 'Missing credentials must not modify access state.');
  assert.equal(await unlockObservedPage(page, 'synthetic-test-password'), true);
  assert.deepEqual(
    actions.map(([action]) => action),
    ['fill', 'click', 'wait-for-unlock'],
  );
  page.locator = () => ({
    getAttribute: async () => 'locked',
    fill: async () => {
      throw new Error('Diagnostics include synthetic-test-password');
    },
  });
  await assert.rejects(unlockObservedPage(page, 'synthetic-test-password'), (error) => {
    assert.match(error.message, /did not unlock/);
    assert.ok(!error.message.includes('synthetic-test-password'));
    return true;
  });
  page.locator = () => ({ getAttribute: async () => 'unlocked' });
  assert.equal(await unlockObservedPage(page), false);
});
