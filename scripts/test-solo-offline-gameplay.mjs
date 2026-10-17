import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import {
  OFFLINE_GAMEPLAY,
  offlineGameplayAssessment,
  offlineLaunchAllowsGameplay,
  playOfflineOpening,
  validateOfflineGameplayPlan,
} from './solo-offline-gameplay.mjs';
import { validateOfflinePlan } from './solo-remote-offline.mjs';

const clone = (value) => structuredClone(value);
function report() {
  const value = {
    gameplayRequested: true,
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
      route: 'explicit-supported-opening-url',
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
    playOfflineOpening({
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

test('the independent diagnostic retains its PR guard, qualification exclusions and fixed budgets', async () => {
  const workflow = await readFile(
    new URL('../.github/workflows/solo-remote-offline-temporary.yml', import.meta.url),
    'utf8',
  );
  assert.match(
    workflow,
    /^    if: github\.event\.pull_request\.number == 1544 && github\.event\.pull_request\.head\.repo\.full_name == github\.repository$/m,
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
  assert.match(workflow, /timeout-minutes: 165/);
  assert.match(workflow, /timeout-minutes: 104/);
  assert.match(workflow, /30s 103m node/);
  assert.match(workflow, /if: \$\{\{ always\(\) \}\}/);
  assert.equal(40 + 2 * (20 + 3 + 3) + 8, 100);
  assert.equal(39 + 104 + 2 + 10, 155);
  assert.equal(165 - 155, 10);
});

test('the direct Opening uses actual bootstrap root readiness before any public Start interaction', async () => {
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
        if (!actual) throw Error('New Opening document never became ready');
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
      playOfflineOpening({
        page,
        report: value,
        address: 'https://test.invalid/game/?journey=opening',
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
