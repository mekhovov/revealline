import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { encodePagesReport, redactPagesText } from './solo-pages-smoke.mjs';
import {
  captureBeforeValidation,
  settlePostflightChecks,
} from './compiled-menu-browser-finalization.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  TARGET,
  STAGES,
  CURRENT_ID,
  RETAINED_IDS,
  assertArtifact,
  assertOwner,
  assertBrowserReport,
  assertSignedArtifactURL,
  assertLoopback,
  createCompiledOperationTrace,
  installCompiledStartEventProbe,
} from './compiled-menu-browser-contract.mjs';
const owner = () => ({
  status: 'closed',
  exitCode: 0,
  signal: null,
  violation: null,
  forcedCleanup: false,
  survivors: [],
  ambiguous: [],
});
const report = () => ({
  format: 'RevealLineCompiledMenuBrowserReportV1',
  status: 'passed-controls',
  target: { ...TARGET },
  toolingRevision: 'a'.repeat(40),
  engine: 'chromium',
  profile: 'fresh-ephemeral',
  browserVersion: '151.0.7922.34',
  performanceExcluded: true,
  stages: [...STAGES],
  cleanup: { context: 'closed', browser: 'closed', server: 'closed' },
  diagnostics: { total: 0, overflow: false, events: [] },
  binaryBefore: { bytes: 10, sha256: 'b'.repeat(64) },
  binaryAfter: { bytes: 10, sha256: 'b'.repeat(64) },
  localeEvidence: ['en', 'uk'].map((locale) => ({
    locale,
    currentCount: 91,
    currentId: CURRENT_ID,
    retainedIds: [...RETAINED_IDS],
    backFocus: 'shell-play',
  })),
  settingsBackFocus: 'shell-options',
  visiblePauseValuesStable: true,
  navigationOverflow: false,
  navigationResponses: [
    { path: '/game/content-design/runtime/navigation-whole-spatial-v25.json', status: 200 },
  ],
});
test('exact historical API artifact and producer bind independently', () => {
  const artifact = {
    id: TARGET.artifact,
    expired: false,
    size_in_bytes: TARGET.outerBytes,
    digest: 'sha256:' + TARGET.outerSha256,
    workflow_run: {
      id: TARGET.run,
      head_sha: TARGET.source,
      repository_id: 1367404328,
      head_repository_id: 1367404328,
    },
  };
  const run = {
    id: TARGET.run,
    run_attempt: 1,
    head_sha: TARGET.source,
    status: 'completed',
    conclusion: 'success',
    repository: { full_name: TARGET.repository },
  };
  assertArtifact(artifact, run);
  for (const field of ['repository_id', 'head_repository_id'])
    assert.throws(() =>
      assertArtifact(
        { ...artifact, workflow_run: { ...artifact.workflow_run, [field]: undefined } },
        run,
      ),
    );
  for (const [field, value] of [
    ['id', 1],
    ['expired', true],
    ['digest', 'sha256:' + '0'.repeat(64)],
    ['size_in_bytes', 0],
  ])
    assert.throws(() => assertArtifact({ ...artifact, [field]: value }, run));
  for (const [field, value] of [
    ['head_sha', '0'.repeat(40)],
    ['run_attempt', 2],
    ['conclusion', 'failure'],
    ['status', 'in_progress'],
  ])
    assert.throws(() => assertArtifact(artifact, { ...run, [field]: value }));
});
test('complete owner excludes timeout, RSS, output, partial and leftover success', () => {
  assertOwner(owner());
  for (const [field, value] of [
    ['status', 'failed'],
    ['exitCode', 1],
    ['signal', 'SIGKILL'],
    ['violation', 'deadline'],
    ['violation', 'rss-cap'],
    ['violation', 'output-cap'],
    ['forcedCleanup', true],
    ['cleanupUnconfirmed', true],
    ['survivors', [1]],
    ['ambiguous', [1]],
  ])
    assert.throws(() => assertOwner({ ...owner(), [field]: value }));
});
test('all native flow/locale/focus/package facts are mandatory', () => {
  assertBrowserReport(report(), owner(), 'a'.repeat(40));
  for (const mutate of [
    (r) => r.stages.pop(),
    (r) => r.stages.reverse(),
    (r) => (r.target.source = '0'.repeat(40)),
    (r) => r.localeEvidence.pop(),
    (r) => (r.localeEvidence[1].backFocus = ''),
    (r) => (r.visiblePauseValuesStable = false),
    (r) => (r.settingsBackFocus = ''),
    (r) => (r.profile = 'persistent'),
    (r) => (r.cleanup.browser = 'pending'),
    (r) => (r.binaryAfter.sha256 = '0'.repeat(64)),
    (r) => (r.diagnostics.total = 1),
    (r) => (r.diagnostics.overflow = true),
    (r) => (r.navigationOverflow = true),
    (r) => delete r.navigationOverflow,
    (r) => (r.navigationOverflow = undefined),
    (r) => (r.navigationResponses = []),
    (r) => (r.navigationResponses[0].status = 404),
  ]) {
    const r = report();
    mutate(r);
    assert.throws(() => assertBrowserReport(r, owner(), 'a'.repeat(40)));
  }
});
test('current and retained identities cannot substitute another mode/edition', () => {
  assert.equal(JSON.parse(CURRENT_ID)[1], 'whole-spatial-v25');
  assert.equal(new Set(RETAINED_IDS).size, 3);
  for (const mutate of [
    (r) => r.localeEvidence[0].currentCount--,
    (r) => r.localeEvidence[1].retainedIds.pop(),
    (r) => (r.localeEvidence[1].retainedIds[0] = CURRENT_ID),
    (r) => (r.localeEvidence[0].currentId = RETAINED_IDS[0]),
  ]) {
    const r = report();
    mutate(r);
    assert.throws(() => assertBrowserReport(r, owner(), 'a'.repeat(40)));
  }
});
test('credential-less signed-blob boundary refuses arbitrary URL/redirect targets', () => {
  assertSignedArtifactURL('https://fixture.blob.core.windows.net/archive?sig=fixture&se=expiry');
  for (const url of [
    'http://fixture.blob.core.windows.net/?sig=x&se=y',
    'https://api.github.com/?sig=x&se=y',
    'https://fixture.blob.core.windows.net.evil.invalid/?sig=x&se=y',
    'https://user:pass@fixture.blob.core.windows.net/?sig=x&se=y',
    'https://fixture.blob.core.windows.net/',
  ])
    assert.throws(() => assertSignedArtifactURL(url));
});
test('ordinary credential document is restricted to generated localhost server', () => {
  assertLoopback('http://127.0.0.1:12345/');
  for (const url of [
    'https://127.0.0.1:12345/',
    'http://localhost:12345/',
    'http://127.0.0.1:12345/game/',
    'http://127.0.0.1:12345/?fixture-access=1',
  ])
    assert.throws(() => assertLoopback(url));
});
test('only the cheap consumer contract enters existing ordinary CLI discovery', async () => {
  const discovery = /(?:^|\/)(?:test-[^/]+|[^/]+\.test)\.mjs$/;
  assert(discovery.test('scripts/test-compiled-menu-browser-consumer.mjs'));
  for (const file of [
    'compiled-menu-browser-contract.mjs',
    'compiled-menu-browser-observer.mjs',
    'run-compiled-menu-browser.mjs',
  ])
    assert(!discovery.test('scripts/' + file));
  const map = JSON.parse(
    await readFile(new URL('../publishing/focused-test-map.json', import.meta.url), 'utf8'),
  );
  const row = map.categories.find((x) => x.id === 'compiled-menu-browser-contract');
  assert.deepEqual(row.commands, [
    {
      id: 'compiled-menu-browser-contract',
      command: 'node',
      args: ['--test', 'scripts/test-compiled-menu-browser-consumer.mjs'],
    },
  ]);
});
test('new fixed workflow never replaces protected Pages/main or ordinary source owners', async () => {
  const source = await readFile(
    new URL('../.github/workflows/compiled-menu-browser-37ec.yml', import.meta.url),
    'utf8',
  );
  assert.match(source, /contents: read/);
  assert.match(source, /actions: read/);
  assert.match(source, /head\.repo\.full_name == github\.repository/);
  assert.match(source, /base\.ref == 'main'/);
  assert.doesNotMatch(
    source,
    /pull_request_target|workflow_dispatch|deploy-pages|fixture-access|storageState|addInitScript|continue-on-error/,
  );
  assert.match(
    source,
    /REVEALLINE_PAGES_TEST_PASSWORD: \$\{\{ secrets\.REVEALLINE_PAGES_TEST_PASSWORD \}\}/,
  );
  assert.match(source, /scripts\/run-compiled-menu-browser\.mjs/);
});

test('failed observer report is sanitized before exit validation and all postchecks still run', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cmb-finalization-'));
  const secret = randomUUID();
  const privateReport = join(directory, 'private-report.json');
  const publicReport = join(directory, 'public-report.json');
  const order = [];
  try {
    const payload = {
      format: 'RevealLineCompiledMenuBrowserReportV1',
      toolingRevision: 'a'.repeat(40),
      target: TARGET,
      status: 'failed',
      failure: 'fixture visible Missions failure ' + secret,
      failureDetails: {
        step: 'fixture native Missions click',
        message: 'fixture failure ' + secret,
      },
    };
    let childFailure;
    try {
      await promisify(execFile)(
        process.execPath,
        [
          '--max-old-space-size=128',
          '--input-type=module',
          '--eval',
          'import { writeFileSync } from "node:fs"; writeFileSync(process.env.CMB_TEST_REPORT, process.env.CMB_TEST_PAYLOAD); process.stdout.write("DO_NOT_UPLOAD_" + process.env.CMB_TEST_SECRET); process.exitCode = 1;',
        ],
        {
          timeout: 10000,
          maxBuffer: 65536,
          env: {
            ...process.env,
            CMB_TEST_REPORT: privateReport,
            CMB_TEST_PAYLOAD: JSON.stringify(payload),
            CMB_TEST_SECRET: secret,
          },
        },
      );
    } catch (error) {
      childFailure = error;
    }
    assert.equal(childFailure?.code, 1);
    assert.equal(childFailure.signal, null);
    assert.equal(childFailure.stdout, 'DO_NOT_UPLOAD_' + secret);
    const terminal = { ...owner(), exitCode: childFailure.code };
    const originalFailure = new Error('original observer exit validation');
    const outcome = await captureBeforeValidation(
      async () => {
        order.push('capture');
        const report = JSON.parse(await readFile(privateReport, 'utf8'));
        assert.equal(report.failureDetails.step, 'fixture native Missions click');
        await writeFile(publicReport, encodePagesReport(report, secret));
        return report;
      },
      () => {
        order.push('validate');
        assert.throws(() => assertOwner(terminal));
        throw originalFailure;
      },
    );
    assert.equal(outcome.validationFailed, true);
    assert.equal(outcome.validationError, originalFailure);
    assert.equal(outcome.captureFailed, false);
    assert.equal(outcome.value.failure, payload.failure);
    const publicBytes = await readFile(publicReport, 'utf8');
    assert(!publicBytes.includes(secret));
    assert(!publicBytes.includes('DO_NOT_UPLOAD_'));
    assert.equal(JSON.parse(publicBytes).failureDetails.step, 'fixture native Missions click');
    const checks = [];
    for (const label of ['source', 'dependencies', 'node']) {
      const file = join(directory, label + '.txt');
      await writeFile(file, 'unchanged-' + label);
      checks.push({
        label,
        check: async () => {
          order.push(label);
          assert.equal(await readFile(file, 'utf8'), 'unchanged-' + label);
        },
      });
    }
    const postflight = await settlePostflightChecks(checks);
    assert.deepEqual(order, ['capture', 'validate', 'source', 'dependencies', 'node']);
    assert.deepEqual(
      postflight.map(({ label, status }) => ({ label, status })),
      ['source', 'dependencies', 'node'].map((label) => ({ label, status: 'passed' })),
    );
    assert.equal(outcome.validationError, originalFailure);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('report capture and postcheck failures never suppress original validation or later checks', async () => {
  const captureError = new Error('missing observer report');
  const originalFailure = new Error('original exit validation');
  const outcome = await captureBeforeValidation(
    async () => {
      throw captureError;
    },
    () => {
      throw originalFailure;
    },
  );
  assert.equal(outcome.captureFailed, true);
  assert.equal(outcome.captureError, captureError);
  assert.equal(outcome.validationFailed, true);
  assert.equal(outcome.validationError, originalFailure);
  const seen = [];
  const postflightError = new Error('source mismatch');
  const results = await settlePostflightChecks([
    {
      label: 'source',
      check: async () => {
        seen.push('source');
        throw postflightError;
      },
    },
    {
      label: 'dependencies',
      check: async () => {
        seen.push('dependencies');
      },
    },
    {
      label: 'node',
      check: async () => {
        seen.push('node');
      },
    },
  ]);
  assert.deepEqual(seen, ['source', 'dependencies', 'node']);
  assert.equal(results[0].status, 'failed');
  assert.equal(results[0].error, postflightError);
  assert.equal(results[1].status, 'passed');
  assert.equal(results[2].status, 'passed');
  assert.equal(outcome.validationError, originalFailure);
  let validations = 0;
  const accepted = await captureBeforeValidation(
    async () => 'retained',
    () => {
      validations += 1;
    },
  );
  assert.equal(accepted.value, 'retained');
  assert.equal(accepted.captureFailed, false);
  assert.equal(accepted.validationFailed, false);
  assert.equal(validations, 1);
});

test('unavailable postflight admission never launches checks or erases original failure', async () => {
  const originalFailure = new Error('original observer failure');
  const outcome = await captureBeforeValidation(
    async () => ({ status: 'failed' }),
    () => {
      throw originalFailure;
    },
  );
  const guard = new Error('existing campaign deadline or disk/ownership guard');
  const attempted = [];
  let admitted = 0;
  const results = await settlePostflightChecks(
    ['source', 'dependencies', 'node'].map((label) => ({
      label,
      check: async () => {
        attempted.push(label);
      },
    })),
    async () => {
      admitted += 1;
      throw guard;
    },
  );
  assert.equal(admitted, 3);
  assert.deepEqual(attempted, []);
  assert.deepEqual(
    results.map((x) => x.status),
    ['unavailable', 'unavailable', 'unavailable'],
  );
  assert(results.every((x) => x.error === guard));
  assert.equal(outcome.validationError, originalFailure);
});

test('operation trace preserves exact promise, arguments, phase reads and fulfilled native action', async () => {
  let now = 1000,
    resolve;
  const pending = new Promise((done) => {
    resolve = done;
  });
  const argsSeen = [],
    work = () => 'original callback';
  const budget = {
    deadline: 571000,
    now: () => now,
    step(...args) {
      assert.equal(this, budget);
      argsSeen.push(args);
      return pending;
    },
  };
  const trace = createCompiledOperationTrace(budget, (value) => value);
  trace.setLocale('en');
  trace.enterPhase('visible Missions');
  trace.noteRead();
  assert.equal(trace.step('native click #shell-play', work, 4500), pending);
  assert.deepEqual(argsSeen, [['native click #shell-play', work, 4500]]);
  assert.equal(argsSeen[0][1], work);
  assert.equal(trace.snapshot().events[0].event, 'started');
  now = 1250;
  resolve('unchanged value');
  assert.equal(await pending, 'unchanged value');
  const value = trace.snapshot();
  assert.equal(value.events.length, 2);
  assert.equal(value.lastCompletedNativeAction.label, 'native click #shell-play');
  assert.equal(value.lastCompletedNativeAction.phase, 'visible Missions');
  assert.equal(value.lastCompletedNativeAction.readIteration, 1);
  assert.equal(value.lastCompletedNativeAction.requestedCapMs, 4500);
  assert.equal(value.lastCompletedNativeAction.elapsedOperationMs, 250);
  assert.equal(value.currentOperation, null);
  trace.enterPhase('current source');
  assert.equal(trace.snapshot().phaseReadIteration, 0);
  assert.equal(trace.snapshot().phaseSequence, 2);
  for (const label of [
    'ordinary password entry',
    'ordinary password submission',
    'real exact mission card',
    'native Ukrainian language',
  ]) {
    assert.equal(trace.step(label, work), pending);
    await pending;
    assert.equal(trace.snapshot().lastCompletedNativeAction.label, label);
  }
});

test('operation trace preserves rejection, synchronous throw and nonassimilated thenables', async () => {
  const original = new Error('original rejection'),
    rejected = Promise.reject(original);
  const trace = createCompiledOperationTrace(
    { deadline: 1000, now: () => 10, step: () => rejected },
    (value) => value,
  );
  const same = trace.step('read public DOM', () => {});
  assert.equal(same, rejected);
  await assert.rejects(same, (error) => error === original);
  assert.equal(trace.snapshot().lastCompletedOperation.errorMessage, original.message);
  assert.equal(trace.snapshot().lastCompletedNativeAction, null);
  const sync = new Error('original synchronous throw');
  const hostile = createCompiledOperationTrace(
    {
      get deadline() {
        throw new Error('diagnostic getter');
      },
      now() {
        throw new Error('diagnostic clock');
      },
      step() {
        throw sync;
      },
    },
    () => {
      throw new Error('diagnostic redactor');
    },
  );
  assert.throws(
    () => hostile.step('native click #shell-play'),
    (error) => error === sync,
  );
  let readThen = 0;
  const thenable = {
    get then() {
      readThen += 1;
      throw new Error('must not read');
    },
  };
  const foreign = createCompiledOperationTrace(
    { deadline: 100, now: () => 0, step: () => thenable },
    (value) => value,
  );
  assert.equal(foreign.step('untouched caller-owned result'), thenable);
  assert.equal(readThen, 0);
  const encodeError = new Error('original report encoding');
  assert.throws(
    () =>
      trace.encodeReport({}, () => {
        throw encodeError;
      }),
    (error) => error === encodeError,
  );
});

test('operation trace is append-only, bounded and redacted while retaining last native action', async () => {
  const secret = randomUUID();
  const trace = createCompiledOperationTrace(
    { deadline: 570000, now: () => 0, step: () => Promise.resolve('original') },
    (value, cap) => redactPagesText(value, secret, cap),
  );
  trace.enterPhase('visible Missions ' + secret);
  trace.setLocale('uk');
  await trace.step('native filter journey-mode ' + secret);
  const first = trace.snapshot().events;
  for (let i = 0; i < 180; i += 1) {
    trace.noteRead();
    await trace.step('read public DOM ' + secret + ' ' + i);
  }
  await trace.step('native click #journey-back ' + secret);
  const value = trace.snapshot();
  assert(value.events.length <= 128);
  assert(Buffer.byteLength(JSON.stringify(value, null, 2)) + 1 <= 32768);
  assert.equal(value.overflow, true);
  assert(value.droppedEvents > 0);
  assert.deepEqual(value.events.slice(0, first.length), first);
  assert(value.lastCompletedNativeAction.label.startsWith('native click #journey-back'));
  assert(!JSON.stringify(value).includes(secret));
  assert.equal(value.locale, 'uk');
  assert.equal(value.phaseReadIteration, 180);
});

test('operation trace fits the unchanged combined report cap without hiding original diagnostics', async () => {
  const secret = randomUUID();
  const trace = createCompiledOperationTrace(
    {
      deadline: 570000,
      now: () => 0,
      step: () => Promise.reject(new Error(secret + ' x'.repeat(300))),
    },
    (value, cap) => redactPagesText(value, secret, cap),
  );
  for (let i = 0; i < 40; i += 1) {
    await assert.rejects(trace.step('read public DOM ' + secret + ' ' + 'x'.repeat(90)));
  }
  const ordinary = {
    diagnostics: { total: 1, overflow: false, events: [{ message: 'x'.repeat(250000) }] },
  };
  const encoded = trace.encodeReport(ordinary, (value) => encodePagesReport(value, secret));
  assert(Buffer.byteLength(encoded) <= 262144);
  const decoded = JSON.parse(encoded);
  assert.deepEqual(decoded.diagnostics, ordinary.diagnostics);
  assert.equal(decoded.operationTrace.omittedForReportCap, true);
  assert.equal(decoded.operationTrace.overflow, true);
  assert.deepEqual(decoded.operationTrace.events, []);
  assert(!encoded.includes(secret));
  const original = encodePagesReport(ordinary, secret);
  assert.equal(
    trace.encodeReport(ordinary, (value) => {
      if (value.operationTrace) throw new Error('diagnostic encoding unavailable');
      return encodePagesReport(value, secret);
    }),
    original,
  );
});

test('latest public read copies only allowed scalars and controls without reading cards', async () => {
  let now = 50;
  const state = {
    hidden: false,
    focused: true,
    lang: 'en',
    focusedId: 'start-button',
    boot: 'ready',
    access: 'accepted',
    flight: 'briefing',
    time: '0:00',
    lives: '3',
    coverage: '0%',
    controls: { 'start-button': { visible: true, enabled: true, open: false, text: 'Start' } },
    payloadHistory: { mustNotRetain: true },
    get cards() {
      throw new Error('cards must never be inspected');
    },
    get href() {
      throw new Error('href must never be inspected');
    },
  };
  const pending = Promise.resolve(state);
  const budget = { deadline: 570050, now: () => now, step: () => pending };
  const trace = createCompiledOperationTrace(budget, (value) => value);
  trace.enterPhase('accepted briefing');
  trace.noteRead();
  assert.equal(
    trace.step('read public DOM', () => state),
    pending,
  );
  assert.equal(await pending, state);
  trace.recordPublicState(state);
  const copied = trace.snapshot().publicRead;
  assert.equal(copied.phase, 'accepted briefing');
  assert.equal(copied.readIteration, 1);
  assert.equal(copied.operationId, trace.snapshot().lastCompletedOperation.id);
  assert.equal(copied.elapsedFlowMs, trace.snapshot().lastCompletedOperation.elapsedFlowMs);
  assert.equal(copied.state.flight, 'briefing');
  assert.equal(copied.state.focusedId, 'start-button');
  assert.deepEqual(copied.state.controls['start-button'], {
    visible: true,
    enabled: true,
    open: false,
    text: 'Start',
  });
  assert.equal(Object.hasOwn(copied.state, 'cards'), false);
  assert.equal(Object.hasOwn(copied.state, 'href'), false);
  assert.equal(Object.hasOwn(copied.state, 'payloadHistory'), false);
  assert.equal(Object.keys(copied.state.controls).length, 13);
  assert.equal(state.controls['start-button'].text, 'Start');
  state.controls['start-button'].text = 'changed input';
  copied.state.controls['start-button'].text = 'changed returned snapshot';
  assert.equal(trace.snapshot().publicRead.state.controls['start-button'].text, 'Start');
});

test('latest public read stays bounded and replaces prior reads without history or extra operations', () => {
  const trace = createCompiledOperationTrace(
    { deadline: 570000, now: () => 0, step: () => Promise.resolve() },
    (value) => value,
  );
  const ids = [
    'shell-home',
    'shell-play',
    'shell-options',
    'journey-chooser',
    'journey-back',
    'start-button',
    'pause-button',
    'shell-menu',
    'settings-dialog',
    'mission-replace-dialog',
    'mode-leave-dialog',
    'flight-preparation-status',
    'run-message',
  ];
  const controls = Object.fromEntries(
    ids.map((id) => [
      id,
      {
        visible: true,
        enabled: true,
        open: false,
        text: 'x'.repeat(5000),
      },
    ]),
  );
  for (let i = 0; i < 200; i += 1) {
    trace.noteRead();
    trace.recordPublicState({ flight: i === 199 ? 'unknown-public-state' : 'briefing', controls });
  }
  const value = trace.snapshot();
  assert.equal(value.publicReadSequence, 200);
  assert.equal(value.publicRead.readSequence, 200);
  assert.equal(value.publicRead.readIteration, 200);
  assert.equal(value.publicRead.state.flight, 'unknown-public-state');
  assert.equal(value.publicRead.state.controls['run-message'].text.length, 256);
  assert.equal(value.publicRead.state.controls['run-message'].visible, true);
  assert.equal(value.publicReadUnavailable, false);
  assert.equal(value.publicReadRecordingFailures, 0);
  assert.equal(value.operationSequence, 0);
  assert.deepEqual(value.events, []);
  assert.equal(Object.hasOwn(value, 'publicReadHistory'), false);
  assert(Buffer.byteLength(JSON.stringify(value.publicRead, null, 2)) + 1 <= 8192);
  assert(Buffer.byteLength(JSON.stringify(value, null, 2)) + 1 <= 32768);
  const nonAsciiControls = Object.fromEntries(
    ids.map((id) => [
      id,
      {
        visible: true,
        enabled: true,
        open: false,
        text: '界'.repeat(5000),
      },
    ]),
  );
  trace.recordPublicState({ flight: 'paused', controls: nonAsciiControls });
  const omitted = trace.snapshot();
  assert.deepEqual(omitted.publicRead, value.publicRead);
  assert.equal(omitted.publicReadSequence, 201);
  assert.equal(omitted.publicReadUnavailable, true);
  assert.equal(omitted.publicReadOmittedForReadCap, true);
  assert(Buffer.byteLength(JSON.stringify(omitted, null, 2)) + 1 <= 32768);
  trace.recordPublicState({
    flight: 'running',
    controls: {
      'start-button': { visible: false, enabled: true, open: false, text: 'Resume' },
    },
  });
  const recovered = trace.snapshot();
  assert.equal(recovered.publicRead.readSequence, 202);
  assert.equal(recovered.publicRead.state.flight, 'running');
  assert.equal(recovered.publicReadUnavailable, false);
  assert.equal(recovered.publicReadOmittedForReadCap, false);
});

test('public read redaction and unavailable fields cannot replace prior complete evidence or caller failures', () => {
  const secret = randomUUID();
  const trace = createCompiledOperationTrace(
    { deadline: 570000, now: () => 0, step: () => Promise.resolve() },
    (value, cap) => redactPagesText(value, secret, cap),
  );
  trace.recordPublicState({
    flight: secret,
    hidden: 'not a boolean',
    focused: false,
    controls: {
      'flight-preparation-status': {
        visible: true,
        enabled: false,
        open: false,
        text: 'Preparing ' + secret,
      },
    },
  });
  const first = trace.snapshot().publicRead;
  assert(!JSON.stringify(first).includes(secret));
  assert.equal(first.state.hidden, null);
  assert.equal(first.state.focused, false);
  assert.equal(first.state.time, null);
  assert.deepEqual(first.state.controls['start-button'], {
    visible: null,
    enabled: null,
    open: null,
    text: null,
  });
  assert.equal(first.state.controls['flight-preparation-status'].visible, true);
  const original = new Error('original public getter');
  assert.doesNotThrow(() =>
    trace.recordPublicState({
      get flight() {
        throw original;
      },
    }),
  );
  const failed = trace.snapshot();
  assert.deepEqual(failed.publicRead, first);
  assert.equal(failed.publicReadSequence, 2);
  assert.equal(failed.publicReadUnavailable, true);
  assert.equal(failed.publicReadRecordingFailures, 1);
  assert.equal(failed.recordingFailures, 1);
  trace.recordPublicState({ flight: 'paused', hidden: false, focused: true });
  const recovered = trace.snapshot();
  assert.equal(recovered.publicRead.readSequence, 3);
  assert.equal(recovered.publicRead.state.flight, 'paused');
  assert.equal(recovered.publicReadUnavailable, false);
  assert.equal(recovered.publicReadRecordingFailures, 1);
  assert.equal(recovered.recordingFailures, 1);
  const hostile = createCompiledOperationTrace(
    { deadline: 570000, now: () => 0, step: () => Promise.resolve() },
    () => {
      throw new Error('diagnostic redaction');
    },
  );
  assert.doesNotThrow(() => hostile.recordPublicState({ flight: 'briefing' }));
  assert(hostile.snapshot().recordingFailures > 0);
  assert.equal(hostile.snapshot().publicRead.state.flight, '[trace text unavailable]');
});

test('public read report-cap omission keeps every original diagnostic and exact-cap fallback authoritative', () => {
  const secret = randomUUID();
  const trace = createCompiledOperationTrace(
    { deadline: 570000, now: () => 0, step: () => Promise.resolve() },
    (value, cap) => redactPagesText(value, secret, cap),
  );
  trace.recordPublicState({
    flight: 'briefing',
    controls: {
      'run-message': { visible: true, enabled: true, open: false, text: secret },
    },
  });
  const ordinary = {
    diagnostics: { total: 1, overflow: false, events: [{ message: 'x'.repeat(261000) }] },
  };
  const encoded = trace.encodeReport(ordinary, (value) => encodePagesReport(value, secret));
  assert(Buffer.byteLength(encoded) <= 262144);
  const decoded = JSON.parse(encoded);
  assert.deepEqual(decoded.diagnostics, ordinary.diagnostics);
  assert.equal(decoded.operationTrace.omittedForReportCap, true);
  assert.equal(decoded.operationTrace.publicReadOmittedForReportCap, true);
  assert.equal(decoded.operationTrace.publicReadSequence, 1);
  assert(!encoded.includes(secret));
  const original = encodePagesReport(ordinary, secret);
  assert.equal(
    trace.encodeReport(ordinary, (value) => {
      if (value.operationTrace) throw new Error('no room even for omission marker');
      return encodePagesReport(value, secret);
    }),
    original,
  );
  const failure = new Error('original report encoding failure');
  assert.throws(
    () =>
      trace.encodeReport({}, () => {
        throw failure;
      }),
    (error) => error === failure,
  );
});

function startEventFixture({ failTargetAdd = false, failWindowRemove = false } = {}) {
  const order = [],
    windowListeners = new Set(),
    targetListeners = new Set(),
    options = [];
  let calls = 0,
    forbidden = 0;
  const button = {
    disabled: false,
    onclick() {
      calls += 1;
      order.push('original-handler');
    },
    contains: (target) => target?.inside === true,
    addEventListener(type, callback, opts) {
      assert.equal(type, 'click');
      options.push(opts);
      targetListeners.add(callback);
      if (failTargetAdd) throw new Error('target registration failed');
    },
    removeEventListener(type, callback, capture) {
      assert.equal(type, 'click');
      assert.equal(capture, false);
      targetListeners.delete(callback);
    },
  };
  const win = {
    addEventListener(type, callback, opts) {
      assert.equal(type, 'click');
      options.push(opts);
      windowListeners.add(callback);
    },
    removeEventListener(type, callback, capture) {
      assert.equal(type, 'click');
      assert.equal(capture, true);
      if (failWindowRemove) throw new Error('window removal unconfirmed');
      windowListeners.delete(callback);
    },
  };
  const doc = {
    body: { dataset: { flightState: 'briefing' } },
    hidden: false,
    hasFocus: () => true,
    activeElement: { id: 'start-button' },
    getElementById(id) {
      assert.equal(id, 'start-button');
      return button;
    },
  };
  const event = (target = button) => ({
    type: 'click',
    target,
    isTrusted: true,
    defaultPrevented: false,
    eventPhase: 1,
    button: 0,
    detail: 1,
    isPrimary: false,
    preventDefault() {
      forbidden += 1;
    },
    stopPropagation() {
      forbidden += 1;
    },
    stopImmediatePropagation() {
      forbidden += 1;
    },
  });
  const capture = (value) => {
    order.push('window-capture');
    for (const callback of windowListeners) callback(value);
  };
  const target = (value) => {
    value.eventPhase = 2;
    button.onclick.call(button, value);
    order.push('target-observer');
    for (const callback of targetListeners) callback(value);
  };
  return {
    win,
    doc,
    button,
    order,
    options,
    event,
    capture,
    target,
    calls: () => calls,
    forbidden: () => forbidden,
    listeners: () => [windowListeners.size, targetListeners.size],
  };
}

test('passive Start probe records capture then the existing handler slot without invoking or altering native activation', () => {
  const f = startEventFixture(),
    original = f.button.onclick;
  const probe = installCompiledStartEventProbe({ window: f.win, document: f.doc });
  assert.equal(f.calls(), 0);
  assert.deepEqual(f.options, [
    { capture: true, passive: true },
    { capture: false, passive: true },
  ]);
  assert.equal(f.button.onclick, original);
  const event = f.event();
  f.capture(event);
  assert.equal(probe.snapshot().capture.eventPhase, 1);
  assert.equal(probe.snapshot().afterHandlerSlot, null);
  f.target(event);
  assert.equal(f.calls(), 1);
  assert.equal(f.button.onclick, original);
  assert.deepEqual(f.order, ['window-capture', 'original-handler', 'target-observer']);
  const result = probe.snapshot();
  assert.equal(result.capture.trusted, true);
  assert.equal(result.capture.defaultPrevented, false);
  assert.equal(result.capture.handlerType, 'function');
  assert.equal(result.capture.handlerFunctionPresent, true);
  assert.equal(result.capture.sameInstalledHandler, true);
  assert.equal(result.afterHandlerSlot.phase, 'target-after-handler-slot');
  assert.equal(result.afterHandlerSlot.eventPhase, 2);
  assert.equal(result.afterHandlerSlot.flight, 'briefing');
  assert.equal(result.afterHandlerSlot.focused, true);
  assert.equal(f.forbidden(), 0);
  assert.deepEqual(probe.dispose(), { disposed: true, teardown: 'removed', failures: 0 });
  assert.deepEqual(f.listeners(), [0, 0]);
  assert.deepEqual(probe.dispose(), { disposed: true, teardown: 'removed', failures: 0 });
});

test('passive Start probe keeps only the first matching click and distinguishes capture-only delivery', () => {
  const f = startEventFixture(),
    probe = installCompiledStartEventProbe({ window: f.win, document: f.doc });
  f.capture(f.event({ inside: false }));
  assert.equal(probe.snapshot().capture, null);
  const first = f.event();
  f.capture(first);
  const captured = probe.snapshot().capture;
  f.doc.body.dataset.flightState = 'running';
  for (let i = 0; i < 256; i += 1) {
    const later = f.event();
    f.capture(later);
    f.target(later);
  }
  assert.deepEqual(probe.snapshot().capture, captured);
  assert.equal(probe.snapshot().afterHandlerSlot, null);
  f.button.onclick = () => {};
  f.target(first);
  assert.equal(probe.snapshot().afterHandlerSlot.sameInstalledHandler, false);
  const fixed = probe.snapshot();
  f.doc.body.dataset.flightState = 'paused';
  f.target(first);
  assert.deepEqual(probe.snapshot(), fixed);
  assert.equal(f.forbidden(), 0);
  probe.dispose();
});

test('passive Start probe bounds scalar copies and isolates failed getters without substituting another activation', () => {
  const f = startEventFixture(),
    probe = installCompiledStartEventProbe({ window: f.win, document: f.doc });
  f.doc.body.dataset.flightState = '界'.repeat(10000);
  f.doc.activeElement.id = '界'.repeat(10000);
  const first = f.event();
  f.capture(first);
  f.target(first);
  const copied = probe.snapshot();
  assert.equal(copied.capture.flight.length, 64);
  assert.equal(copied.capture.focusedId.length, 64);
  assert(Buffer.byteLength(JSON.stringify(copied)) < 4096);
  copied.capture.flight = 'changed';
  assert.notEqual(probe.snapshot().capture.flight, 'changed');
  probe.dispose();
  const broken = startEventFixture(),
    failed = installCompiledStartEventProbe({ window: broken.win, document: broken.doc });
  Object.defineProperty(broken.button, 'onclick', {
    configurable: true,
    get() {
      throw new Error('private detail');
    },
  });
  const blocked = broken.event();
  assert.doesNotThrow(() => broken.capture(blocked));
  assert.equal(failed.snapshot().failures, 1);
  Object.defineProperty(broken.button, 'onclick', { value: () => {}, writable: true });
  broken.capture(broken.event());
  assert.equal(failed.snapshot().capture, null);
  assert.equal(failed.snapshot().failures, 1);
  assert(!JSON.stringify(failed.snapshot()).includes('private detail'));
  failed.dispose();
  const trace = createCompiledOperationTrace(
    { deadline: 100, now: () => 0, step: () => Promise.resolve() },
    (s, cap) => String(s).slice(0, cap),
  );
  trace.recordPublicState({ startActivation: probe.snapshot() });
  assert.equal(trace.snapshot().publicRead.state.startActivation.disposed, true);
  trace.recordStartProbeLifecycle('setup', 'unavailable');
  trace.recordStartProbeLifecycle('setup', 'removed');
  assert.equal(trace.snapshot().startProbeLifecycle.setup, 'unavailable');
});

test('passive Start probe removes partial registrations and retains unconfirmed cleanup honestly', () => {
  const partial = startEventFixture({ failTargetAdd: true });
  const probe = installCompiledStartEventProbe({ window: partial.win, document: partial.doc });
  assert.equal(probe.snapshot().installed, false);
  assert.equal(probe.snapshot().failures, 1);
  assert.deepEqual(partial.listeners(), [0, 0]);
  assert.equal(probe.dispose().teardown, 'removed');
  const unknown = startEventFixture({ failTargetAdd: true, failWindowRemove: true });
  const unavailable = installCompiledStartEventProbe({
    window: unknown.win,
    document: unknown.doc,
  });
  assert.equal(unavailable.snapshot().installed, false);
  assert.equal(unavailable.dispose().teardown, 'unconfirmed');
  assert.equal(unavailable.dispose().teardown, 'unconfirmed');
  const absent = installCompiledStartEventProbe({
    window: {},
    document: { getElementById: () => null },
  });
  assert.equal(absent.snapshot().installed, false);
  assert.equal(absent.dispose().teardown, 'removed');
});
