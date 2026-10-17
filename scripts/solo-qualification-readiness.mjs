// Explicit correctness-only observer. Historical timing recipes and gates stay intact.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const READINESS_PILOT = Object.freeze({
  protocol: 'first-running-v1',
  sourceRevision: 'ab45bfde5d54d612cbba9b038a46f13d13f417ec',
  scenarioSHA256: 'aa3a4c98c6f272ea515d1e8c9e0fb3238d78782065bfb96ae8fe4e304041e2c5',
  records: 8,
  bytes: 16384,
});
export function qualificationReadinessOptions(flags, scenario, bytes) {
  const selected = flags.filter((flag) => flag.startsWith('--readiness-probe'));
  if (!selected.length) return null;
  assert.deepEqual(selected, ['--readiness-probe=first-running-v1']);
  assert.deepEqual(
    flags.filter((flag) => flag.startsWith('--source-revision')),
    [`--source-revision=${READINESS_PILOT.sourceRevision}`],
  );
  for (const flag of ['--work-probe', '--hitch-journal', '--cadence=settled120'])
    assert(flags.includes(flag), `Readiness requires ${flag}`);
  assert(
    !flags.some((flag) =>
      /^--(?:memory-profile|audio-proof|cpu-profile|journal-cost-probe|baseline-runtime|snapshot-chunks|hitch-journal-preparation)/.test(
        flag,
      ),
    ),
    'Readiness is an independent cold correctness observation',
  );
  assert.equal(createHash('sha256').update(bytes).digest('hex'), READINESS_PILOT.scenarioSHA256);
  assert.deepEqual(scenario, JSON.parse(bytes));
  assert.equal(scenario.timeoutMs, 240000);
  return READINESS_PILOT;
}

// Serialized unchanged into the top document. Called only on actual trusted
// Start clicks and phase changes, never from rAF/update/draw. No app export.
export function createBrowserReadinessProbe(getScene, environment = globalThis) {
  const documentRef = environment.document,
    records = [],
    runs = new WeakMap();
  let dropped = 0,
    errors = 0,
    runSequence = 0,
    firstRunning = false,
    disposed = false,
    previousPhase = null;
  const number = (value) => (Number.isFinite(value) ? value : null);
  function record(kind, event = null) {
    if (disposed) return;
    if (records.length >= 8) {
      dropped = Math.min(65535, dropped + 1);
      return;
    }
    try {
      const scene = getScene(),
        run = scene?.lastPaint?.run,
        c = scene?.cadence?.snapshot(),
        phase = documentRef.body?.dataset.flightState;
      if (run && !runs.has(run)) runs.set(run, ++runSequence);
      const row = {
        kind,
        atMs: number(environment.performance.now()),
        phase: ['briefing', 'running', 'paused', 'result', 'picture'].includes(phase)
          ? phase
          : 'other',
        visible: documentRef.hidden === false,
        focused: documentRef.hasFocus(),
        trusted: event ? event.isTrusted === true : null,
        run: run ? runs.get(run) : null,
        tick: number(run?.tick),
        prepared: typeof scene?.prepared === 'function' ? scene.prepared() === true : null,
        displayedBoardValid:
          typeof scene?.displayedBoardValid === 'boolean' ? scene.displayedBoardValid : null,
        preparedRunMatches: run ? scene?.preparedState?.run === run : null,
        submittedRunMatches: run ? scene?.submittedRun === run : null,
        levelId:
          typeof run?.level?.id === 'string' && run.level.id.length <= 128 ? run.level.id : null,
        cadence: c
          ? {
              samples: number(c.samples),
              required: number(c.required),
              baselineMs: number(c.baselineMs),
              restartedSamples: number(c.restartedSamples),
              waiting: typeof c.waiting === 'boolean' ? c.waiting : null,
              status: ['pending-quiet-preparation', 'measured-before-play'].includes(c.status)
                ? c.status
                : 'unknown',
            }
          : null,
      };
      records.push(row);
    } catch {
      errors = Math.min(65535, errors + 1);
    }
  }
  function click(event) {
    if (event.isTrusted !== true) return;
    const button = event.target?.closest?.('#shell-featured, #start-button');
    if (button) record('start-click', event);
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    documentRef.removeEventListener('click', click, true);
    environment.removeEventListener('pagehide', dispose);
  }
  documentRef.addEventListener('click', click, true);
  environment.addEventListener('pagehide', dispose, { once: true });
  return {
    phase(phase) {
      if (disposed || phase === previousPhase) return;
      previousPhase = phase;
      if (phase === 'running' && !firstRunning) {
        firstRunning = true;
        record('first-running');
      } else if (firstRunning && phase !== 'running') record('after-running');
    },
    export() {
      if (documentRef.body?.dataset.flightState === 'running')
        throw new Error('Readiness export requires an existing non-running boundary');
      const result = {
        format: 'SoloFirstRunningReadinessV1',
        protocol: 'first-running-v1',
        capacity: 8,
        maximumBytes: 16384,
        dropped,
        errors,
        disposed,
        records: records.map((row) => ({ ...row, cadence: row.cadence && { ...row.cadence } })),
        scope:
          'Passive public-click/phase boundary snapshots; not proof of physical display completion.',
      };
      if (new TextEncoder().encode(JSON.stringify(result)).byteLength > 16384)
        throw new Error('Readiness evidence cap exceeded');
      return result;
    },
    dispose,
  };
}

export function assessReadinessPilot(observation, application, documents) {
  const failures = [];
  const check = (condition, reason) => {
    if (!condition) failures.push(reason);
  };
  check(documents === 1, 'exactly-one-observed-document');
  check(observation?.format === 'SoloFirstRunningReadinessV1', 'readiness-format');
  check(observation?.protocol === READINESS_PILOT.protocol, 'readiness-protocol');
  check(observation?.capacity === 8 && observation.maximumBytes === 16384, 'readiness-bounds');
  const encoded = JSON.stringify(observation ?? null);
  check(Buffer.byteLength(encoded) <= READINESS_PILOT.bytes, 'readiness-byte-limit');
  const records = Array.isArray(observation?.records) ? observation.records : [];
  check(records.length > 0 && records.length <= 8, 'bounded-records-present');
  check(observation?.dropped === 0 && observation?.errors === 0, 'complete-readiness-observation');
  const clicks = records.filter((row) => row.kind === 'start-click'),
    running = records.filter((row) => row.kind === 'first-running');
  check(clicks.length === 1 && clicks[0]?.trusted === true, 'one-trusted-public-start');
  check(running.length === 1, 'one-first-running-boundary');
  const start = clicks[0],
    active = running[0],
    cadence = active?.cadence;
  check(
    Number.isFinite(start?.atMs) &&
      start.atMs >= 0 &&
      Number.isFinite(active?.atMs) &&
      start.atMs <= active.atMs,
    'public-start-before-running',
  );
  check(active?.phase === 'running' && active.visible && active.focused, 'foreground-running');
  check(active?.tick === 0 && active.levelId === 'first-return', 'initial-authoritative-tick');
  check(Number.isSafeInteger(active?.run) && active.run > 0, 'observed-run-identity');
  check(
    active?.prepared === true &&
      active.displayedBoardValid === true &&
      active.preparedRunMatches === true &&
      active.submittedRunMatches === true,
    'accepted-prepared-board-submitted',
  );
  check(
    cadence?.samples === 30 &&
      cadence.required === 30 &&
      cadence.status === 'measured-before-play' &&
      cadence.waiting === false &&
      Number.isFinite(cadence.baselineMs) &&
      cadence.baselineMs >= 4 &&
      cadence.baselineMs <= 50,
    'complete-pre-play-cadence',
  );
  check(
    application?.cadenceCalibration?.status === 'measured-before-play' &&
      application.cadenceCalibration.samples === 30 &&
      application.cadenceCalibration.required === 30 &&
      application.cadenceCalibration.baselineMs === cadence?.baselineMs &&
      application.baselineMs === cadence?.baselineMs,
    'paused-export-retains-accepted-baseline',
  );
  return {
    status: failures.length ? 'failed' : 'passed',
    failures,
    startBranch:
      start?.cadence?.status === 'measured-before-play' && start.cadence.samples === 30
        ? 'already-ready-observed; pending-path-unobserved'
        : start?.cadence?.status === 'pending-quiet-preparation' &&
            Number.isInteger(start.cadence.samples) &&
            start.cadence.samples >= 0 &&
            start.cadence.samples < 30
          ? 'incomplete-at-public-click-observed'
          : 'pre-click-cadence-unobserved',
    performanceQualification: false,
    scope:
      'Single diagnostic readiness observation; original numerical and replay verdicts remain independent. No physical-device, display completion or broad performance qualification.',
  };
}
