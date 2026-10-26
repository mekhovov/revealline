import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import {
  OFFLINE_GAMEPLAY,
  OFFLINE_FAILURE_WITNESS_POLICY,
  OFFLINE_FAILURE_WITNESS_TIMEOUT_MS,
  captureOfflineFailureState,
  retainOfflineReplayExport,
  offlineGameplayAssessment,
  offlineLaunchAllowsGameplay,
  playOfflineStarter,
  NATIVE_OFFLINE_STATE_POLICY,
  nativeOfflineStateApplied,
  restoreNativeOfflineState,
  validateOfflineGameplayPlan,
} from './solo-offline-gameplay.mjs';
import { validateOfflinePlan } from './solo-remote-offline.mjs';

const clone = (value) => structuredClone(value);
const stateWitness = (url) => ({
  status: 'applied',
  session: 'existing-worker-observer',
  commandCompleted: true,
  before: { online: true, url },
  after: { online: false, url },
});
function report() {
  const value = {
    gameplayRequested: true,
    preparedGameplay: { routeId: 'whole-spatial-v25', groupId: 'solo:horizon-starter' },
    browserVersion: '155.0.1.2',
    artifact: { sourceRevision: 'a'.repeat(40) },
    diagnosticOutcome: 'observed-launcher-and-cache-retained',
    offlineNavigation: { publicBootReady: true, serverStopped: true, offlineEmulation: true },
    workerSnapshots: [
      {
        stage: 'after-restart-navigation',
        identityMatches: true,
        keysMatch: true,
        indexMatches: true,
      },
    ],
    gameplay: {
      status: 'passed',
      route: 'explicit-installed-starter-url',
      serverStoppedThroughout: true,
      observedBrowserClosed: true,
      exportCount: 2,
    },
    replays: [],
  };
  for (const levelId of ['first-return', 'choose-your-share']) {
    value.replays.push({
      levelId,
      bytes: 1000,
      sha256: 'b'.repeat(64),
      nativeReplay: {
        status: 'pass',
        engine: 'chromium',
        browserVersion: value.browserVersion,
        buildIdentity: { sourceRevision: value.artifact.sourceRevision },
        observation: { match: true, status: 'pass', levelId },
        recording: { bytes: 1000, sha256: 'b'.repeat(64) },
      },
    });
  }
  return value;
}

test('negative offline launch stays a completed diagnostic and never enters public gameplay', async () => {
  const value = report();
  value.offlineNavigation.publicBootReady = false;
  value.diagnosticOutcome = 'observed-offline-launch-or-cache-failure';
  value.gameplay = { status: 'not-run-launch-unqualified' };
  value.replays = [];
  assert.equal(offlineLaunchAllowsGameplay(value), false);
  assert.equal(offlineGameplayAssessment(value), 'not-run-launch-unqualified');
  await assert.rejects(
    playOfflineStarter({
      report: value,
      page: new Proxy(
        {},
        {
          get() {
            assert.fail('A failed launch must not access gameplay controls');
          },
        },
      ),
    }),
    /No gameplay/,
  );
  value.replays.push(report().replays[0]);
  assert.equal(offlineGameplayAssessment(value), 'failed');
});

test('every original launch and cache premise is mandatory before continuation', () => {
  for (const mutate of [
    (r) => {
      r.offlineNavigation.publicBootReady = false;
    },
    (r) => {
      r.offlineNavigation.serverStopped = false;
    },
    (r) => {
      r.offlineNavigation.offlineEmulation = false;
    },
    (r) => {
      r.workerSnapshots[0].identityMatches = false;
    },
    (r) => {
      r.workerSnapshots[0].keysMatch = false;
    },
    (r) => {
      r.workerSnapshots[0].indexMatches = false;
    },
    (r) => {
      r.workerSnapshots[0].unobserved = true;
    },
    (r) => {
      r.deadlineReached = true;
    },
    (r) => {
      r.failure = 'original launch failed';
    },
  ]) {
    const value = report();
    mutate(value);
    assert.equal(offlineLaunchAllowsGameplay(value), false);
    assert.equal(offlineGameplayAssessment(value), 'failed');
  }
});

test('both complete same-engine recordings and clean offline control ownership are required', () => {
  assert.equal(offlineGameplayAssessment(report()), 'passed');
  for (const mutate of [
    (r) => {
      r.gameplay.status = 'awaiting-post-close-strict-replay';
    },
    (r) => {
      r.gameplay.deadlineReached = true;
    },
    (r) => {
      r.gameplay.serverStoppedThroughout = false;
    },
    (r) => {
      r.gameplay.observedBrowserClosed = false;
    },
    (r) => {
      r.gameplay.exportCount = 1;
    },
    (r) => {
      r.replays.pop();
    },
    (r) => {
      r.replays.push(clone(r.replays[0]));
    },
    (r) => {
      r.replays[0].levelId = 'wrong';
    },
    (r) => {
      r.replays[1].bytes = 262145;
    },
    (r) => {
      r.replays[1].nativeReplay.status = 'fail';
    },
    (r) => {
      r.replays[1].nativeReplay.observation.match = false;
    },
    (r) => {
      r.replays[1].nativeReplay.engine = 'webkit';
    },
    (r) => {
      r.replays[1].nativeReplay.browserVersion = 'other';
    },
    (r) => {
      r.replays[1].nativeReplay.buildIdentity.sourceRevision = 'c'.repeat(40);
    },
    (r) => {
      r.replays[1].nativeReplay.recording.sha256 = 'c'.repeat(64);
    },
    (r) => {
      r.replays[1].nativeReplay.recording.bytes++;
    },
  ]) {
    const value = report();
    mutate(value);
    assert.equal(offlineGameplayAssessment(value), 'failed');
  }
});

test('the added finite work cannot change the original diagnostic timeout or expand fixed bounds', async () => {
  validateOfflineGameplayPlan(clone(OFFLINE_GAMEPLAY));
  for (const name of [
    'diagnosticTimeoutMs',
    'playTimeoutMs',
    'replayTimeoutMs',
    'maximumExports',
    'maximumExportBytes',
  ]) {
    const value = clone(OFFLINE_GAMEPLAY);
    value[name]++;
    assert.throws(() => validateOfflineGameplayPlan(value));
  }
  const manifest = JSON.parse(
    await readFile(new URL('../docs/performance/solo-remote-offline-plan.json', import.meta.url)),
  );
  manifest.status = 'pinned-for-execution';
  validateOfflinePlan(manifest);
  for (const modify of [
    (p) => {
      p.helperTimeoutMs++;
    },
    (p) => {
      p.offline.observationTimeoutMs++;
    },
    (p) => {
      p.rows[0].timeoutMs++;
    },
    (p) => {
      p.setupTimeoutMs++;
    },
  ]) {
    const changed = clone(manifest);
    modify(changed);
    assert.throws(() => validateOfflinePlan(changed));
  }
});

test('the successor diagnostic retains one push admission, exclusions and fixed budgets', async () => {
  const workflow = await readFile(
    new URL('../.github/workflows/solo-remote-offline-temporary.yml', import.meta.url),
    'utf8',
  );
  assert.match(
    workflow,
    /^    if: github\.event\.pull_request\.number == 1544 && github\.event\.pull_request\.head\.repo\.full_name == github\.repository && github\.event\.before == 'bffcbd838a7bb925da8aaf030695773f893d8bda'$/m,
  );
  const plan = JSON.parse(
    await readFile(
      new URL('../docs/performance/solo-remote-offline-plan.json', import.meta.url),
      'utf8',
    ),
  );
  validateOfflinePlan(plan);
  assert.equal(plan.diagnosticRelease.format, 'SoloOfflineIndependentDiagnosticReleaseV1');
  assert.equal(plan.diagnosticRelease.status, 'reviewed-for-cause-analysis');
  assert.equal(plan.diagnosticRelease.candidateRevision, plan.candidate.revision);
  assert.equal(plan.diagnosticRelease.baselineRevision, plan.baseline.revision);
  assert.equal(plan.diagnosticRelease.firstEightAllCorrectnessPassed, false);
  assert.equal(plan.diagnosticRelease.successorQualificationReleased, false);
  assert.equal(plan.diagnosticRelease.performanceQualificationReleased, false);
  assert.equal(plan.diagnosticRelease.priorEvidence.conclusion, 'failure');
  assert.equal(plan.cohort, 'linux-offline-3adcd537-starter-admission-witness-pair04');
  assert.equal(plan.diagnosticRelease.onceOnlyBefore, 'bffcbd838a7bb925da8aaf030695773f893d8bda');
  const prior = plan.diagnosticRelease.priorSetupEvidence;
  assert.equal(prior.run, 38991754614);
  assert.equal(prior.conclusion, 'failure');
  assert.equal(prior.baseline, 'not-run');
  assert.equal(prior.candidate, 'not-run');
  assert.equal(prior.profilesCreated, 0);
  assert.equal(prior.ownedClosureEstablished, false);
  const admission = plan.diagnosticRelease.priorGameplayAdmissionEvidence;
  assert.equal(admission.run, 38992974772);
  assert.equal(admission.conclusion, 'failure');
  assert.equal(admission.failedField, 'unobserved-snapshot-assigned-after-assertion');
  assert.equal(admission.candidate, 'not-observed-baseline-gate');
  assert.equal(admission.ownedClosureEstablished, true);
  const owner = plan.diagnosticRelease.ownerCorrection;
  const historical = JSON.parse(
    await readFile(
      new URL(
        '../docs/performance/fixtures/solo-remote-offline/owner-pair04-source.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  assert.deepEqual(historical, {
    format: 'SoloHistoricalOfflineOwnerSourceV1',
    run: 38995660465,
    sourceRevision: '1ccf8368a3dcd099e1608c8a9433e6f0c0518e8f',
    path: 'scripts/run-solo-remote-correctness.mjs',
    bytes: 52211,
    sha256: '42750c0bb862b5ca28dfb8394b6381694418b0ed9240a70f006652fcfde28235',
  });
  for (const key of ['path', 'bytes', 'sha256']) assert.equal(owner[key], historical[key]);
  assert.match(workflow, /timeout-minutes: 165/);
  assert.match(workflow, /timeout-minutes: 104/);
  assert.match(workflow, /30s 103m node/);
  assert.match(workflow, /if: \$\{\{ always\(\) \}\}/);
  assert.equal(40 + 2 * (20 + 3 + 3) + 8, 100);
  assert.equal(39 + 104 + 2 + 10, 155);
  assert.equal(165 - 155, 10);
});

test('the installed Starter uses actual bootstrap root readiness before any public Start interaction', async () => {
  for (const ready of [false, true]) {
    const value = report();
    value.replays = [];
    const bytes = Buffer.from('exact selected HTML');
    const events = [],
      pending = [];
    // Real bootstrap contract (game/boot.mjs): only documentElement owns bootState.
    // A conflicting body value catches both false admission and universal timeout.
    const document = {
      documentElement: { dataset: { bootState: ready ? 'ready' : 'loading' } },
      body: { dataset: { bootState: ready ? 'loading' : 'ready' } },
    };
    const page = {
      async goto() {
        events.push('navigation');
        return {
          status: () => 200,
          fromServiceWorker: () => true,
          body: async () => bytes,
          headers: () => ({ 'content-security-policy': 'test-policy' }),
        };
      },
      async waitForFunction(predicate, _arg, options) {
        events.push('new-document-readiness');
        assert(options.timeout > 0 && options.timeout <= 120000);
        const actual = runInNewContext(`(${predicate.toString()})()`, { document });
        assert.equal(actual, ready, 'The predicate must read the real bootstrap owner');
        if (!actual) throw Error('New installed Starter document never became ready');
      },
      locator() {
        assert.fail('No gameplay in this bounded entry control');
      },
      evaluate() {
        assert.equal(ready, true, 'Access snapshot cannot precede new document readiness');
        events.push('post-ready-access-snapshot');
        throw Error('Stop after proving readiness admission');
      },
    };
    await assert.rejects(
      playOfflineStarter({
        page,
        report: value,
        address: 'https://test.invalid/game/?journey=whole-spatial-v25',
        entryHTMLSha256: createHash('sha256').update(bytes).digest('hex'),
        csp: 'test-policy',
        accessKey: 'public-access',
        ensureOwner() {},
        isServerStopped: () => true,
        step() {},
        pending,
      }),
      ready ? /Stop after proving readiness/ : /never became ready/,
    );
    await Promise.allSettled(pending);
    assert.deepEqual(
      events,
      ready
        ? ['navigation', 'new-document-readiness', 'post-ready-access-snapshot']
        : ['navigation', 'new-document-readiness'],
    );
    assert.equal(value.gameplay.status, 'failed');
    assert.equal(value.gameplay.exports.length, 0);
  }
});

test('every failed offline restart field is retained before rejection without a public Start', async () => {
  const valid = {
    unlocked: true,
    remembered: true,
    online: false,
    controller: 'https://test.invalid/service-worker.js',
  };
  for (const changed of [
    { unlocked: false },
    { remembered: false },
    { online: true },
    { controller: null },
  ]) {
    const value = report(),
      restart = { ...valid, ...changed },
      bytes = Buffer.from('exact selected HTML'),
      pending = [];
    let snapshotCount = 0;
    const page = {
      async goto() {
        return {
          status: () => 200,
          fromServiceWorker: () => true,
          body: async () => bytes,
          headers: () => ({ 'content-security-policy': 'test-policy' }),
        };
      },
      async waitForFunction(predicate) {
        assert.equal(
          runInNewContext(`(${predicate.toString()})()`, {
            document: { documentElement: { dataset: { bootState: 'ready' } } },
          }),
          true,
        );
      },
      evaluate() {
        snapshotCount++;
        return restart;
      },
      locator() {
        assert.fail('A failed restart field must prevent every public Start interaction');
      },
    };
    await assert.rejects(
      playOfflineStarter({
        page,
        report: value,
        address: 'https://test.invalid/game/?journey=whole-spatial-v25',
        entryHTMLSha256: createHash('sha256').update(bytes).digest('hex'),
        csp: 'test-policy',
        accessKey: 'public-access',
        ensureOwner() {},
        isServerStopped: () => true,
        step() {},
        pending,
      }),
      { code: 'ERR_ASSERTION' },
    );
    await Promise.allSettled(pending);
    assert.equal(snapshotCount, 1);
    assert.deepEqual(value.gameplay.offlineRestart, restart);
    assert.equal(value.gameplay.status, 'failed');
    assert.equal(value.gameplay.exports.length, 0);
  }
});

test('the same retained native session restores both navigated documents without property injection', async () => {
  const state = { online: false, url: 'about:blank' },
    calls = [],
    limits = [];
  const navigator = {};
  Object.defineProperty(navigator, 'onLine', { get: () => state.online });
  const descriptor = Object.getOwnPropertyDescriptor(navigator, 'onLine');
  const page = {
    evaluate: (fn) =>
      runInNewContext(`(${fn.toString()})()`, {
        navigator,
        location: { href: state.url },
      }),
  };
  const cdp = {
    send(method, parameters) {
      calls.push({ method, parameters });
      state.online = false;
    },
  };
  for (const url of [
    'https://test.invalid/game/',
    'https://test.invalid/game/?journey=whole-spatial-v25',
  ]) {
    // The exact native V2 report observes this reset after each navigation.
    state.online = true;
    state.url = url;
    const witness = {};
    await restoreNativeOfflineState({
      page,
      cdp,
      witness,
      expectedURL: url,
      ensureOwner() {},
      isServerStopped: () => true,
      bounded: async (_label, action, ms) => {
        limits.push(ms);
        return action();
      },
      remaining: () => 4000,
    });
    assert.equal(nativeOfflineStateApplied(witness, url), true);
    assert.equal(witness.before.online, true);
    assert.equal(witness.after.online, false);
    assert.deepEqual(Object.getOwnPropertyDescriptor(navigator, 'onLine'), descriptor);
  }
  assert.deepEqual(limits, Array(6).fill(4000));
  assert.deepEqual(
    calls,
    Array(2).fill({
      method: 'Network.overrideNetworkState',
      parameters: { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 },
    }),
  );
});

test('native state correction retains failures and stops on ownership, transport or document changes', async () => {
  for (const scenario of [
    'stopped-before',
    'stopped-after',
    'server-running',
    'wrong-before-url',
    'wrong-after-url',
    'still-online',
    'command-rejected',
    'command-timeout',
  ]) {
    const expectedURL = 'https://test.invalid/game/',
      witness = {};
    let active = scenario !== 'stopped-before',
      reads = 0,
      commands = 0;
    await assert.rejects(
      restoreNativeOfflineState({
        page: {
          evaluate() {
            reads++;
            if (scenario === 'stopped-after') active = false;
            return {
              online: reads === 1 || scenario === 'still-online',
              url:
                (reads === 1 && scenario === 'wrong-before-url') ||
                (reads === 2 && scenario === 'wrong-after-url')
                  ? 'https://unexpected.invalid/'
                  : expectedURL,
            };
          },
        },
        cdp: {
          send() {
            commands++;
            if (scenario === 'command-rejected') throw Error('Native command rejected');
          },
        },
        witness,
        expectedURL,
        ensureOwner: () => assert(active, 'Owner stopped'),
        isServerStopped: () => scenario !== 'server-running',
        bounded: async (label, action, ms) => {
          assert.equal(ms, 5000);
          if (label === 'Restore owned native offline state' && scenario === 'command-timeout')
            throw Error('Native command deadline');
          return action();
        },
      }),
    );
    assert.equal(witness.status, 'failed', scenario);
    assert.equal(typeof witness.failure, 'string');
    assert.equal(nativeOfflineStateApplied(witness, expectedURL), false);
    if (
      [
        'stopped-before',
        'stopped-after',
        'server-running',
        'wrong-before-url',
        'command-timeout',
      ].includes(scenario)
    )
      assert.equal(commands, 0, scenario);
    if (['wrong-after-url', 'still-online'].includes(scenario))
      assert.equal(witness.commandCompleted, true);
    if (scenario === 'still-online') assert.equal(witness.after.online, true);
  }
});

test('corrected observer requires both native witnesses and every existing transport and replay gate', () => {
  const value = report(),
    launcherURL = 'https://test.invalid/game/',
    address = launcherURL + '?journey=whole-spatial-v25';
  value.nativeOfflineStatePolicy = NATIVE_OFFLINE_STATE_POLICY;
  value.offlineNavigation.selectedGame = { url: launcherURL };
  value.offlineNavigation.nativeState = stateWitness(launcherURL);
  value.gameplay.address = address;
  value.gameplay.nativeState = stateWitness(address);
  assert.equal(offlineLaunchAllowsGameplay(value), true);
  assert.equal(offlineGameplayAssessment(value), 'passed');
  for (const mutate of [
    (r) => {
      r.nativeOfflineStatePolicy = 'unknown-policy';
    },
    (r) => {
      delete r.offlineNavigation.nativeState;
    },
    (r) => {
      r.offlineNavigation.nativeState.after.online = true;
    },
    (r) => {
      r.offlineNavigation.nativeState.before.url = address;
    },
    (r) => {
      r.offlineNavigation.nativeState.commandCompleted = false;
    },
    (r) => {
      r.offlineNavigation.serverStopped = false;
    },
    (r) => {
      r.offlineNavigation.offlineEmulation = false;
    },
    (r) => {
      r.workerSnapshots[0].keysMatch = false;
    },
  ]) {
    const changed = clone(value);
    mutate(changed);
    assert.equal(offlineLaunchAllowsGameplay(changed), false);
    assert.equal(offlineGameplayAssessment(changed), 'failed');
  }
  for (const mutate of [
    (r) => {
      delete r.gameplay.nativeState;
    },
    (r) => {
      r.gameplay.nativeState.after.online = true;
    },
    (r) => {
      r.gameplay.nativeState.status = 'failed';
    },
    (r) => {
      r.gameplay.nativeState.session = 'detached';
    },
    (r) => {
      r.gameplay.nativeState.after.url = launcherURL;
    },
    (r) => {
      r.replays[0].nativeReplay.observation.match = false;
    },
    (r) => {
      r.gameplay.serverStoppedThroughout = false;
    },
  ]) {
    const changed = clone(value);
    mutate(changed);
    assert.equal(offlineGameplayAssessment(changed), 'failed');
  }
  assert.equal(
    offlineGameplayAssessment(report()),
    'passed',
    'Historical assessment remains unchanged',
  );
});

test('corrected Starter navigation restores native state before readiness and still rejects an online access snapshot', async () => {
  for (const restoreFails of [true, false]) {
    const value = report(),
      launcherURL = 'https://test.invalid/game/',
      address = launcherURL + '?journey=whole-spatial-v25';
    value.nativeOfflineStatePolicy = NATIVE_OFFLINE_STATE_POLICY;
    value.offlineNavigation.selectedGame = { url: launcherURL };
    value.offlineNavigation.nativeState = stateWitness(launcherURL);
    const bytes = Buffer.from('exact selected HTML'),
      pending = [],
      events = [];
    const page = {
      async goto() {
        events.push('navigation');
        return {
          status: () => 200,
          fromServiceWorker: () => true,
          body: async () => bytes,
          headers: () => ({ 'content-security-policy': 'test-policy' }),
        };
      },
      async waitForFunction() {
        events.push('ready');
      },
      async evaluate() {
        events.push('access');
        return { unlocked: true, remembered: true, online: true, controller: 'service-worker.js' };
      },
      locator() {
        assert.fail('A failed native correction or online access snapshot must never reach Start');
      },
    };
    await assert.rejects(
      playOfflineStarter({
        page,
        report: value,
        address,
        entryHTMLSha256: createHash('sha256').update(bytes).digest('hex'),
        csp: 'test-policy',
        accessKey: 'public-access',
        ensureOwner() {},
        isServerStopped: () => true,
        step() {},
        pending,
        async restoreNativeState(witness, url, remaining) {
          events.push('restore');
          assert.equal(url, address);
          assert(remaining(5000) <= 5000);
          Object.assign(witness, stateWitness(url));
          if (restoreFails) {
            witness.status = 'failed';
            throw Error('Native restore failed');
          }
        },
      }),
    );
    await Promise.allSettled(pending);
    assert.deepEqual(
      events,
      restoreFails ? ['navigation', 'restore'] : ['navigation', 'restore', 'ready', 'access'],
    );
    assert.equal(value.gameplay.status, 'failed');
    assert.equal(value.gameplay.exports.length, 0);
    if (!restoreFails) assert.equal(value.gameplay.offlineRestart.online, true);
  }
});

test('late native command settlement cannot overwrite a failed witness or start another operation', async () => {
  const expectedURL = 'https://test.invalid/game/',
    witness = {};
  let finish,
    reads = 0,
    pending;
  const command = new Promise((resolve) => {
    finish = resolve;
  });
  await assert.rejects(
    restoreNativeOfflineState({
      page: {
        evaluate() {
          reads++;
          return { online: true, url: expectedURL };
        },
      },
      cdp: {
        send() {
          return command;
        },
      },
      witness,
      expectedURL,
      ensureOwner() {},
      isServerStopped: () => true,
      bounded: async (label, action) => {
        if (label !== 'Restore owned native offline state') return action();
        pending = action();
        throw Error('Native command deadline');
      },
    }),
    /Native command deadline/,
  );
  const failed = clone(witness);
  finish();
  await pending;
  assert.deepEqual(witness, failed);
  assert.equal(reads, 1);
  assert.equal(nativeOfflineStateApplied(witness, expectedURL), false);
  await assert.rejects(restoreNativeOfflineState({ witness }), /cannot be reused/);
  assert.deepEqual(witness, failed);
});

test('failure DOM witness reads once only after failure and preserves the original failure', async () => {
  const value = { status: 'failed', failure: 'Original Next timeout', deadlineReached: true },
    pending = [];
  let reads = 0,
    rectangles = 0;
  const element = {
    tagName: 'BUTTON',
    id: 'next-button',
    hidden: false,
    disabled: false,
    textContent: 'x'.repeat(2000),
    dataset: { kind: 'won' },
    getAttribute: () => null,
    getBoundingClientRect: () => {
      rectangles++;
      return { x: 10, y: 20, width: 30, height: 40 };
    },
  };
  const page = {
    evaluate: async (fn) => {
      reads++;
      return runInNewContext(`(${fn.toString()})()`, {
        location: { href: 'http://offline/game/' },
        navigator: {
          onLine: false,
          serviceWorker: { controller: { scriptURL: 'http://offline/service-worker.js' } },
        },
        document: {
          visibilityState: 'visible',
          hasFocus: () => true,
          documentElement: { dataset: { bootState: 'ready' } },
          body: { dataset: { flightState: 'won' } },
          activeElement: element,
          querySelector: () => element,
        },
      });
    },
  };
  const options = { page, value, pending, ensureOwner() {}, isServerStopped: () => true };
  const witness = await captureOfflineFailureState(options);
  assert.equal(reads, 1);
  assert.equal(rectangles, 1);
  assert.equal(pending.length, 1);
  assert.equal(witness.status, 'captured');
  assert.equal(witness.policy, OFFLINE_FAILURE_WITNESS_POLICY);
  assert.equal(witness.snapshot.preparation.text.length, 512);
  assert.equal(witness.snapshot.flight, 'won');
  assert.equal(witness.snapshot.online, false);
  assert.equal(value.failure, 'Original Next timeout');
  assert.equal(value.status, 'failed');
  for (const unfailed of [{ status: 'running' }, { status: 'failed' }])
    await assert.rejects(captureOfflineFailureState({ ...options, value: unfailed }));
  assert.equal(reads, 1, 'No active-play evidence reads');
});

test('failure witness owns only two seconds of cleanup and ignores late snapshot settlement', async () => {
  assert.equal(OFFLINE_GAMEPLAY.playTimeoutMs, 120000);
  assert.equal(OFFLINE_FAILURE_WITNESS_TIMEOUT_MS, 2000);
  let finish;
  const read = new Promise((resolve) => {
    finish = resolve;
  });
  const value = { status: 'failed', failure: 'Original timeout', deadlineReached: true },
    pending = [];
  await captureOfflineFailureState({
    page: { evaluate: () => read },
    value,
    pending,
    ensureOwner() {},
    isServerStopped: () => true,
  });
  assert.equal(value.failureState.status, 'unavailable');
  assert.match(value.failureState.failure, /deadline/);
  const retained = clone(value);
  finish({ flight: 'running' });
  await Promise.all(pending);
  assert.deepEqual(value, retained);
});

test('failure witness cannot admit owner loss, server restart, a closed page or oversized evidence', async () => {
  for (const change of [
    {
      ensureOwner() {
        throw Error('Owner lost');
      },
    },
    { isServerStopped: () => false },
    {
      page: {
        evaluate: async () => {
          throw Error('Page closed');
        },
      },
    },
    { page: { evaluate: async () => ({ text: 'x'.repeat(16385) }) } },
  ]) {
    const value = { status: 'failed', failure: 'Original failure' };
    const witness = await captureOfflineFailureState({
      page: { evaluate: async () => ({ flight: 'paused' }) },
      value,
      pending: [],
      ensureOwner() {},
      isServerStopped: () => true,
      ...change,
    });
    assert.equal(witness.status, 'unavailable');
    assert.equal(witness.snapshot, undefined);
    assert.equal(value.failure, 'Original failure');
    assert.equal(value.status, 'failed');
  }
});

test('independent partial replay retention preserves exact bytes separately from strict verification', async (t) => {
  const output = await mkdtemp(join(tmpdir(), 'solo-offline-export-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const text = JSON.stringify({
    replay: { level: { id: 'first-return' }, segments: [{ ticks: 10 }], checkpoint: {} },
  });
  const item = {
    text,
    entry: {
      label: 'offline-first-earned-capture',
      levelId: 'first-return',
      bytes: Buffer.byteLength(text),
      sha256: createHash('sha256').update(text).digest('hex'),
    },
  };
  const options = { output, item, ensureOwner() {}, isServerStopped: () => true };
  const retained = await retainOfflineReplayExport(options);
  assert.equal(await readFile(retained.path, 'utf8'), text);
  assert.equal(retained.retention, 'raw-unverified-recording');
  assert.equal(retained.nativeReplay.status, 'not-run');
  await assert.rejects(retainOfflineReplayExport(options), { code: 'EEXIST' });
  assert.equal(
    await readFile(retained.path, 'utf8'),
    text,
    'No overwrite after failed duplicate retention',
  );
  for (const change of [
    { entry: { ...item.entry, label: '../../escape' } },
    { entry: { ...item.entry, bytes: item.entry.bytes + 1 } },
    { entry: { ...item.entry, sha256: '0'.repeat(64) } },
    { text: 'x'.repeat(OFFLINE_GAMEPLAY.maximumExportBytes + 1) },
  ])
    await assert.rejects(retainOfflineReplayExport({ ...options, item: { ...item, ...change } }));
  for (const override of [
    {
      ensureOwner() {
        throw Error('Owner cancelled');
      },
    },
    { isServerStopped: () => false },
    { output: join(output, 'absent') },
  ])
    await assert.rejects(retainOfflineReplayExport({ ...options, ...override }));
});
