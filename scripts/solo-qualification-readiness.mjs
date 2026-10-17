// Explicit correctness-only observer. Historical timing recipes and gates stay intact.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createQualificationReplayIdentity } from './solo-qualification-replay-identity.mjs';

export const READINESS_PILOT = Object.freeze({
  protocol: 'first-running-v1',
  sourceRevision: 'ab45bfde5d54d612cbba9b038a46f13d13f417ec',
  scenarioSHA256: 'aa3a4c98c6f272ea515d1e8c9e0fb3238d78782065bfb96ae8fe4e304041e2c5',
  records: 8,
  bytes: 16384,
});
export const RESUME_READINESS_PILOTS = Object.freeze({
  'warm-resume-v1': Object.freeze({
    protocol: 'warm-resume-v1',
    sourceRevision: '4bf5e9b3b7f2f06fbe24f50ff9457efb70a7b1a7',
    scenarioSHA256: '95f77f635658a53ae5ab89ca9879321a37c22e512c2a0bb751ad5ed194699545',
    documents: 1,
    records: 8,
    bytes: 16384,
  }),
  'saved-resume-v1': Object.freeze({
    protocol: 'saved-resume-v1',
    sourceRevision: '4bf5e9b3b7f2f06fbe24f50ff9457efb70a7b1a7',
    scenarioSHA256: 'b739f37f5bd9c341931ed528a955614aaf1ba05075bb1baab1c2a655a5bcd527',
    documents: 2,
    records: 8,
    bytes: 16384,
  }),
});
export const SELECTED_FONT_PILOT = Object.freeze({
  protocol: 'selected-font-cancel-v1',
  sourceRevision: 'c696af41857840359ae473558b90682f3d71f2db',
  scenarioSHA256: 'd4c774b80df93896cfd4a1f82d66c16f58a9ed68938ed88229449a2bb001cc67',
  documents: 1,
  records: 8,
  bytes: 16384,
});
export const SELECTED_FONT_JOINED_PILOT = Object.freeze({
  protocol: 'selected-font-cancel-joined-v2',
  sourceRevision: '0febd334619731adc26dfa3df78aab02991563af',
  scenarioSHA256: 'e46e4f0a75ef5f982373b464a487efe74e63fa7145500e4ff2ac93cb4a3d46d5',
  requestPolicy: 'same-url-two-v2',
  documents: 1,
  records: 8,
  bytes: 16384,
});
export const COMPACT_SAVED_READINESS_PILOT = Object.freeze({
  protocol: 'saved-resume-v1',
  sourceRevision: 'c696af41857840359ae473558b90682f3d71f2db',
  scenarioSHA256: '0cd16229c6e490023bc2a6ce1b83e5631cb92d0460a2c2fb712ce38c0e2a2270',
  documents: 2,
  records: 8,
  bytes: 16384,
});
export function qualificationReadinessOptions(flags, scenario, bytes) {
  const selected = flags.filter((flag) => flag.startsWith('--readiness-probe'));
  if (!selected.length) {
    assert(
      !scenario.selectedFontCancellation,
      'Selected-font fault requires exact readiness opt-in',
    );
    return null;
  }
  const protocol = selected[0]?.slice('--readiness-probe='.length);
  const successorSaved =
    protocol === 'saved-resume-v1' &&
    flags.includes('--source-revision=c696af41857840359ae473558b90682f3d71f2db');
  const pilot = successorSaved
    ? COMPACT_SAVED_READINESS_PILOT
    : protocol === READINESS_PILOT.protocol
      ? READINESS_PILOT
      : protocol === SELECTED_FONT_PILOT.protocol
        ? SELECTED_FONT_PILOT
        : protocol === SELECTED_FONT_JOINED_PILOT.protocol
          ? SELECTED_FONT_JOINED_PILOT
          : RESUME_READINESS_PILOTS[protocol];
  assert(pilot, 'Unknown readiness protocol');
  if (pilot === SELECTED_FONT_JOINED_PILOT)
    assert(
      !flags.some((flag) => /^--(?:density-comparison|visual-quality-observation)/.test(flag)),
      'Font and density are separate observations',
    );
  assert.deepEqual(selected, [`--readiness-probe=${pilot.protocol}`]);
  assert.deepEqual(
    flags.filter((flag) => flag.startsWith('--source-revision')),
    [`--source-revision=${pilot.sourceRevision}`],
  );
  for (const flag of ['--work-probe', '--hitch-journal', '--cadence=settled120'])
    assert(flags.includes(flag), `Readiness requires ${flag}`);
  assert(
    !flags.some((flag) =>
      /^--(?:memory-profile|audio-proof|cpu-profile|journal-cost-probe|baseline-runtime|snapshot-chunks|hitch-journal-preparation)/.test(
        flag,
      ),
    ),
    'Readiness is an independent exact-recipe correctness observation',
  );
  assert.equal(createHash('sha256').update(bytes).digest('hex'), pilot.scenarioSHA256);
  assert.deepEqual(scenario, JSON.parse(bytes));
  assert.equal(scenario.timeoutMs, 240000);
  if ([SELECTED_FONT_PILOT, SELECTED_FONT_JOINED_PILOT].includes(pilot)) {
    assert.equal(scenario.kind, 'lifecycle');
    assert(!scenario.cacheMode, 'Font routing cannot qualify warm HTTP caching');
    assert(flags.includes('--server-fixture-access'));
    assert(
      !flags.some(
        (flag) =>
          flag === '--fixture-access' ||
          flag.startsWith('--public-url') ||
          flag.startsWith('--manifest'),
      ),
    );
  }
  return pilot;
}

// Serialized unchanged into the top document. Called only on actual trusted
// Start clicks and phase changes, never from rAF/update/draw. No app export.
export function createBrowserReadinessProbe(
  getScene,
  environment = globalThis,
  protocol = 'first-running-v1',
) {
  if (
    ![
      'first-running-v1',
      'warm-resume-v1',
      'saved-resume-v1',
      'selected-font-cancel-v1',
      'selected-font-cancel-joined-v2',
    ].includes(protocol)
  )
    throw new Error('Unknown readiness protocol');
  const resume = protocol.endsWith('-resume-v1'),
    font = ['selected-font-cancel-v1', 'selected-font-cancel-joined-v2'].includes(protocol);
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
      if (font) {
        row.font = {
          openDialogs: Math.min(9, documentRef.querySelectorAll('dialog[open]').length),
          preparation:
            documentRef.getElementById('flight-preparation-status')?.dataset.state ?? null,
          acceptedTheme: documentRef.documentElement.dataset.interfaceTheme ?? null,
          selectedTheme:
            documentRef
              .getElementById('theme-card-dnipro-porcelain')
              ?.getAttribute('aria-pressed') === 'true',
          loaded:
            documentRef.fonts?.check(
              '600 16px "Field Kit Display"',
              'Workshop Майстерня 012345',
            ) === true,
          defaultPrevented: event ? event.defaultPrevented === true : null,
        };
      }
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
  function back(event) {
    if (
      !font ||
      event.isTrusted !== true ||
      event.code !== 'Escape' ||
      event.repeat ||
      documentRef.querySelectorAll('dialog[open]').length ||
      documentRef.getElementById('flight-preparation-status')?.dataset.state !== 'busy'
    )
      return;
    record('cancel-back', event);
    environment.queueMicrotask(() => record('cancel-complete', event));
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    documentRef.removeEventListener('click', click, true);
    if (font) documentRef.removeEventListener('keydown', back, true);
    environment.removeEventListener('pagehide', dispose);
  }
  documentRef.addEventListener('click', click, true);
  if (font) documentRef.addEventListener('keydown', back, true);
  environment.addEventListener('pagehide', dispose, { once: true });
  return {
    boundary(label) {
      if (
        !font ||
        label !== 'font-release-no-start' ||
        documentRef.body?.dataset.flightState === 'running'
      )
        throw new Error('Invalid selected-font passive boundary');
      record('font-release-no-start');
    },
    phase(phase) {
      if (disposed || phase === previousPhase) return;
      previousPhase = phase;
      if (phase === 'running' && !firstRunning) {
        firstRunning = true;
        record('first-running');
      } else if (resume && firstRunning && phase === 'running') record('resumed-running');
      else if (firstRunning && phase !== 'running') record('after-running');
    },
    export() {
      if (documentRef.body?.dataset.flightState === 'running')
        throw new Error('Readiness export requires an existing non-running boundary');
      const result = {
        format: 'SoloFirstRunningReadinessV1',
        protocol,
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

// Reuse the existing exact-byte pair owner for saved restoration. Only scalar
// receipts survive each already-acquired public export; final replay remains
// under the qualifier's existing single native replay owner.
export function createResumeReplayEvidence(protocol) {
  const saved = protocol === 'saved-resume-v1';
  assert(saved || protocol === 'warm-resume-v1');
  const expected = saved
    ? ['before-resume', 'saved-restored', 'after-resume']
    : ['before-resume', 'after-resume'];
  const pair = saved ? createQualificationReplayIdentity() : null;
  const report = {
    format: 'SoloResumeReplayEvidenceV1',
    protocol,
    status: 'pending',
    receipts: [],
    ...(pair ? { restoration: pair.report } : {}),
  };
  return {
    report,
    observe(label, text) {
      try {
        assert.equal(label, expected[report.receipts.length], 'Exact Resume export order');
        const bytes = Buffer.byteLength(text);
        assert(bytes > 0 && bytes <= 32 * 1024 ** 2, 'Resume replay byte bound');
        const recording = JSON.parse(text),
          replay = recording.replay ?? recording;
        assert(Number.isSafeInteger(replay.ticks) && replay.ticks > 0 && replay.ticks <= 28800);
        assert.equal(replay.level?.id, 'first-return');
        const checkpoint = JSON.stringify(replay.checkpoint);
        assert(checkpoint && checkpoint.length < 16384, 'Bounded replay checkpoint');
        const receipt = {
          label,
          bytes,
          sha256: createHash('sha256').update(text).digest('hex'),
          ticks: replay.ticks,
          checkpointSHA256: createHash('sha256').update(checkpoint).digest('hex'),
        };
        if (pair && report.receipts.length < 2) pair.observe(text);
        report.receipts.push(receipt);
        return receipt;
      } catch (error) {
        report.status = 'failed';
        report.failure = String(error.message).slice(0, 1024);
        throw error;
      }
    },
    finish() {
      assert.notEqual(report.status, 'failed');
      assert.equal(report.receipts.length, expected.length);
      pair?.finish();
      report.status = 'complete';
      return report;
    },
  };
}

export function assessResumeReadiness({
  protocol,
  documents,
  observations,
  applications,
  replayEvidence,
  finalReplayText,
}) {
  const failures = [],
    check = (condition, name) => {
      if (!condition) failures.push(name);
    };
  const saved = protocol === 'saved-resume-v1',
    pilot = RESUME_READINESS_PILOTS[protocol];
  check(Boolean(pilot), 'exact-resume-protocol');
  const expectedDocuments = saved ? 2 : 1;
  check(documents === expectedDocuments, 'exact-document-count');
  check(
    Array.isArray(observations) && observations.length === expectedDocuments,
    'document-observations',
  );
  const list = Array.isArray(observations) ? observations : [];
  check(Buffer.byteLength(JSON.stringify(list)) <= 16384, 'aggregate-readiness-byte-cap');
  check(
    list.reduce((sum, row) => sum + (row?.records?.length ?? 0), 0) <= 8,
    'aggregate-record-cap',
  );
  for (const observation of list) {
    check(
      observation?.format === 'SoloFirstRunningReadinessV1' && observation.protocol === protocol,
      'readiness-format',
    );
    check(observation?.capacity === 8 && observation.maximumBytes === 16384, 'readiness-bounds');
    check(observation?.dropped === 0 && observation.errors === 0, 'complete-observation');
    const records = Array.isArray(observation?.records) ? observation.records : [];
    check(
      records.every(
        (row, i) =>
          Number.isFinite(row.atMs) &&
          row.atMs >= 0 &&
          (i === 0 || row.atMs >= records[i - 1].atMs),
      ),
      'monotonic-document-records',
    );
  }
  const first = Array.isArray(list[0]?.records) ? list[0].records : [],
    last = Array.isArray(list.at(-1)?.records) ? list.at(-1).records : [];
  check(
    JSON.stringify(first.map((r) => r.kind)) ===
      JSON.stringify(
        saved
          ? ['start-click', 'first-running', 'after-running']
          : [
              'start-click',
              'first-running',
              'after-running',
              'start-click',
              'resumed-running',
              'after-running',
            ],
      ),
    'exact-initial-boundaries',
  );
  if (saved)
    check(
      JSON.stringify(last.map((r) => r.kind)) ===
        JSON.stringify(['start-click', 'first-running', 'after-running']),
      'exact-restored-boundaries',
    );
  const initialClick = first[0],
    initial = first[1],
    paused = first[2],
    click = saved ? last[0] : first[3],
    resumed = saved ? last[1] : first[4],
    final = last.at(-1);
  const completeCadence = (c) =>
    c?.samples === 30 &&
    c.required === 30 &&
    c.waiting === false &&
    c.status === 'measured-before-play' &&
    Number.isFinite(c.baselineMs) &&
    c.baselineMs >= 4 &&
    c.baselineMs <= 50;
  const prepared = (row) =>
    row?.prepared === true &&
    row.displayedBoardValid === true &&
    row.preparedRunMatches === true &&
    row.submittedRunMatches === true;
  const foreground = (row) => row?.visible === true && row.focused === true;
  check(initialClick?.trusted === true && click?.trusted === true, 'trusted-public-clicks');
  check(
    initial?.phase === 'running' &&
      initial.tick === 0 &&
      initial.levelId === 'first-return' &&
      foreground(initial),
    'initial-tick-zero',
  );
  check(prepared(initial) && completeCadence(initial?.cadence), 'initial-preparation');
  check(
    [initial, resumed].every((r) => Number.isSafeInteger(r?.run) && r.run > 0),
    'observed-local-run-identities',
  );
  check(
    paused?.phase === 'paused' &&
      Number.isSafeInteger(paused.tick) &&
      paused.tick > 0 &&
      paused.run === initial?.run,
    'initial-authoritative-pause',
  );
  check(
    click?.phase === 'paused' && click.tick === paused?.tick && foreground(click),
    'explicit-resume-at-paused-tick',
  );
  check(
    resumed?.phase === 'running' &&
      resumed.tick === click?.tick &&
      resumed.run === click?.run &&
      foreground(resumed),
    'resume-before-first-new-tick',
  );
  if (!saved) check(click?.run === initial?.run, 'same-warm-run');
  check(prepared(resumed), 'accepted-prepared-board-submitted');
  check(completeCadence(resumed?.cadence), 'complete-resume-cadence');
  if (!saved)
    check(
      resumed?.cadence?.baselineMs === initial?.cadence?.baselineMs &&
        click?.cadence?.baselineMs === initial?.cadence?.baselineMs,
      'warm-baseline-retained',
    );
  check(
    final?.phase === 'paused' &&
      final.run === resumed?.run &&
      Number.isSafeInteger(final.tick) &&
      final.tick > resumed?.tick &&
      foreground(final),
    'positive-resumed-play-then-public-pause',
  );
  check(
    Number.isFinite(resumed?.atMs) && final?.atMs - resumed.atMs >= 400,
    'declared-no-new-input-window',
  );
  // This compares actual elapsed browser time, never a hidden/preparation delta.
  // It is not an inspection of the application's private accumulator.
  check(
    Number.isFinite(final?.atMs) &&
      final?.tick - resumed?.tick <= Math.ceil(((final.atMs - resumed.atMs) * 120) / 1000),
    'no-ticks-beyond-observed-resumed-time',
  );
  const apps = Array.isArray(applications) ? applications : [];
  check(
    apps.length === (saved ? 3 : 2) &&
      apps.every((a) => a && typeof a.cadenceCalibration === 'object'),
    'all-paused-application-exports',
  );
  const matchingApp = (app, c) =>
    completeCadence(app?.cadenceCalibration) &&
    app.baselineMs === c?.baselineMs &&
    app.cadenceCalibration.baselineMs === c?.baselineMs;
  check(matchingApp(apps[0], initial?.cadence), 'initial-paused-baseline');
  check(matchingApp(apps.at(-1), resumed?.cadence), 'resumed-paused-baseline');
  const receipts = replayEvidence?.receipts ?? [];
  check(
    replayEvidence?.format === 'SoloResumeReplayEvidenceV1' &&
      replayEvidence.protocol === protocol &&
      replayEvidence.status === 'complete' &&
      !replayEvidence.failure,
    'complete-public-replay-receipts',
  );
  check(
    JSON.stringify(receipts.map((r) => r.label)) ===
      JSON.stringify(
        saved
          ? ['before-resume', 'saved-restored', 'after-resume']
          : ['before-resume', 'after-resume'],
      ),
    'exact-replay-export-order',
  );
  check(
    receipts.every(
      (r) =>
        Number.isSafeInteger(r.bytes) &&
        r.bytes > 0 &&
        r.bytes <= 32 * 1024 ** 2 &&
        /^[a-f0-9]{64}$/.test(r.sha256) &&
        /^[a-f0-9]{64}$/.test(r.checkpointSHA256),
    ),
    'bounded-export-identities',
  );
  check(
    receipts[0]?.ticks === paused?.tick && receipts.at(-1)?.ticks === final?.tick,
    'observed-ticks-match-public-replay',
  );
  if (saved) {
    const a = receipts[0],
      b = receipts[1],
      pair = replayEvidence?.restoration;
    check(
      a?.bytes === b?.bytes &&
        a?.sha256 === b?.sha256 &&
        a?.checkpointSHA256 === b?.checkpointSHA256 &&
        b?.ticks === click?.tick,
      'exact-saved-checkpoint-and-recording',
    );
    check(
      pair?.format === 'SoloPublicReplayIdentityPairV1' &&
        pair.mode === 'exact-public-bytes-pair' &&
        pair.status === 'pass' &&
        !pair.failure &&
        pair.observations?.length === 2 &&
        pair.observations.every(
          (r, i) => r.bytes === receipts[i]?.bytes && r.sha256 === receipts[i]?.sha256,
        ),
      'existing-restoration-pair-proof',
    );
  }
  let neutralTicks = 0,
    directions = [];
  try {
    assert(
      typeof finalReplayText === 'string' && Buffer.byteLength(finalReplayText) <= 32 * 1024 ** 2,
    );
    const receipt = receipts.at(-1);
    assert.equal(Buffer.byteLength(finalReplayText), receipt?.bytes);
    assert.equal(createHash('sha256').update(finalReplayText).digest('hex'), receipt?.sha256);
    const recording = JSON.parse(finalReplayText),
      replay = recording.replay ?? recording;
    assert.equal(replay.ticks, final?.tick);
    assert.equal(
      createHash('sha256').update(JSON.stringify(replay.checkpoint)).digest('hex'),
      receipt.checkpointSHA256,
    );
    assert(Array.isArray(replay.segments) && replay.segments.length <= 28800);
    let offset = 0;
    const seenDirections = new Set();
    for (const segment of replay.segments) {
      assert(Number.isSafeInteger(segment.ticks) && segment.ticks > 0 && segment.ticks <= 28800);
      const end = offset + segment.ticks;
      assert(end <= 28800);
      const overlap = Math.max(0, Math.min(end, final.tick) - Math.max(offset, resumed.tick));
      if (overlap) {
        const input = segment.input;
        assert(
          input.boost === false &&
            input.action === false &&
            input.pickup === false &&
            input.switchClass === null,
        );
        assert([null, 'left', 'right', 'up', 'down'].includes(input.direction));
        seenDirections.add(input.direction);
        neutralTicks += overlap;
      }
      offset = end;
    }
    assert.equal(offset, replay.ticks);
    assert.equal(neutralTicks, final.tick - resumed.tick);
    assert(neutralTicks > 0);
    directions = [...seenDirections];
  } catch {
    check(false, 'neutral-discrete-replay-commands-through-resumed-window');
  }
  return {
    status: failures.length ? 'failed' : 'passed',
    failures,
    protocol,
    neutralTicks,
    directions,
    observedResumedMs:
      Number.isFinite(final?.atMs) && Number.isFinite(resumed?.atMs)
        ? final.atMs - resumed.atMs
        : null,
    performanceQualification: false,
    scope:
      'Resume correctness only. Continuous steering may persist; discrete commands remain neutral. Private clock debt and physical display completion are not directly observed. Final strict source-native replay is independently required.',
  };
}

export const selectedFont = Object.freeze({
  relativePath: 'ui/fonts/field-kit/handjet-display-600.woff2',
  bytes: 38120,
  sha256: '4797c11d5e17c3f5f9b5b3fa96efb4fd2aabb877fb4d625dfc8eb7465464e145',
  fetchTimeoutMs: 10000,
  maximumHoldMs: 60000,
  cleanupReserveMs: 2000,
  records: 16,
  maximumEvidenceBytes: 16384,
});
export function createSelectedFontHold(
  entryURL,
  {
    now = () => performance.now(),
    setTimer = setTimeout,
    clearTimer = clearTimeout,
    requestPolicy = 'single-v1',
  } = {},
) {
  assert(['single-v1', 'same-url-two-v2'].includes(requestPolicy));
  const joined = requestPolicy === 'same-url-two-v2';
  const requestLimit = joined ? 2 : 1;
  const routes = [];
  let forwarding = false,
    rejectedOwned = 0;
  let lastClock = -Infinity;
  const clock = () => {
    const value = now();
    assert(
      Number.isFinite(value) && value >= 0 && value >= lastClock,
      'Finite monotonic font-owner clock',
    );
    lastClock = value;
    return value;
  };
  clock();
  const target = new URL(selectedFont.relativePath, entryURL);
  assert(['http:', 'https:'].includes(target.protocol));
  let claimed = 0,
    released = false,
    done = false,
    closing = false,
    timer,
    decide,
    validated,
    cancelWait,
    task = null,
    deadline,
    cleanupDeadline,
    operationId = 0;
  const releaseDecision = new Promise((resolve) => {
    decide = resolve;
  });
  const ready = new Promise((resolve) => {
    validated = resolve;
  });
  const cancellation = new Promise((resolve) => {
    cancelWait = () => resolve({ cancelled: true });
  });
  const pending = new Map(),
    ownedResponses = new Set(),
    disposedResponses = new WeakSet();
  const report = {
    format: joined ? 'SoloSelectedFontHoldV2' : 'SoloSelectedFontHoldV1',
    ...(joined ? { requestPolicy, maximumRequests: 2 } : {}),
    targetPath: target.pathname,
    expected: selectedFont,
    status: 'unobserved',
    released: false,
    responseDisposed: false,
    abortSettled: false,
    records: [],
    dropped: 0,
    failure: null,
    timedOutOperations: [],
  };
  const record = (kind) => {
    if (report.records.length < selectedFont.records) report.records.push({ kind, atMs: clock() });
    else report.dropped = Math.min(65535, report.dropped + 1);
  };
  const fail = (error) => {
    report.status = 'failed';
    report.failure ??= String(error?.message ?? error).slice(0, 1024);
    decide(false);
    validated(false);
  };
  async function bounded(promise, until, label, cancellable) {
    let timeout;
    const expired = () => {
      if (!report.timedOutOperations.includes(label) && report.timedOutOperations.length < 8)
        report.timedOutOperations.push(label);
      fail(new Error(label + ' deadline reached'));
      return { timedOut: true };
    };
    assert(Number.isFinite(until) && until >= 0, 'Finite font-owner deadline');
    if (clock() >= until) return expired();
    try {
      const result = await Promise.race([
        promise,
        new Promise((resolve) => {
          timeout = setTimer(() => resolve({ timedOut: true }), Math.max(0, until - clock()));
        }),
        ...(cancellable ? [cancellation] : []),
      ]);
      if (result.timedOut || clock() >= until) return expired();
      return result;
    } finally {
      clearTimer(timeout);
    }
  }
  async function operation(label, action, until, { cleanup = false, onLate } = {}) {
    assert(Number.isFinite(until) && until >= 0, 'Finite font-owner operation deadline');
    if (clock() >= until) {
      if (!report.timedOutOperations.includes(label) && report.timedOutOperations.length < 8)
        report.timedOutOperations.push(label);
      throw new Error(label + ' deadline reached before native action');
    }
    const id = ++operationId;
    assert(id <= 8, 'Selected-font native operation cap');
    pending.set(id, label);
    // Both handlers are attached immediately; late rejection is never unhandled.
    const completion = Promise.resolve()
      .then(() => {
        assert(clock() < until, label + ' deadline reached before native action');
        return action();
      })
      .then(
        (value) => {
          pending.delete(id);
          return { ok: true, value };
        },
        (error) => {
          pending.delete(id);
          fail(error);
          return { ok: false, error };
        },
      );
    const result = await bounded(completion, until, label, !cleanup);
    if (result.timedOut || result.cancelled) {
      if (onLate)
        void completion.then((outcome) => (outcome.ok ? onLate(outcome.value) : null)).catch(fail);
      throw new Error(label + (result.timedOut ? ' timed out' : ' cancelled'));
    }
    if (!result.ok) throw result.error;
    return result.value;
  }
  function beginCleanup() {
    cleanupDeadline ??= Math.min(deadline ?? clock(), clock()) + selectedFont.cleanupReserveMs;
    return cleanupDeadline;
  }
  async function disposeResponse(response) {
    if (disposedResponses.has(response)) return;
    ownedResponses.add(response);
    disposedResponses.add(response);
    try {
      await operation(
        'response-dispose',
        async () => {
          await response.dispose();
          ownedResponses.delete(response);
          report.responseDisposed = true;
          record('response-disposed');
        },
        beginCleanup(),
        { cleanup: true },
      );
    } catch (error) {
      fail(error);
    }
  }
  return {
    async handle(route) {
      const request = route.request();
      if (request.url() !== target.href) return false;
      claimed++;
      if (claimed > requestLimit || closing || (joined && (done || forwarding))) {
        if (joined) rejectedOwned++;
        fail(new Error('Duplicate or closed selected-font request'));
        cancelWait();
        try {
          await operation(
            'duplicate-abort',
            async () => {
              await route.abort('failed');
              if (joined) rejectedOwned--;
            },
            beginCleanup(),
            { cleanup: true },
          );
        } catch (error) {
          fail(error);
        }
        return true;
      }
      const entry = { route, fulfillmentSettled: false, abortionSettled: false };
      routes.push(entry);
      if (joined && claimed > 1) {
        try {
          assert.equal(request.method(), 'GET');
          assert.equal(request.resourceType(), 'font');
          assert.equal(request.headers().range, undefined);
          record('same-original-request-joined');
        } catch (error) {
          fail(error);
          cancelWait();
        }
        await task;
        return true;
      }
      deadline = clock() + selectedFont.maximumHoldMs;
      timer = setTimer(() => {
        report.timedOutOperations.push('hold');
        fail(new Error('Selected-font hold deadline reached'));
        cancelWait();
      }, selectedFont.maximumHoldMs);
      task = (async () => {
        let response,
          fulfilled = false;
        try {
          assert.equal(request.method(), 'GET');
          assert.equal(request.resourceType(), 'font');
          assert.equal(request.headers().range, undefined);
          report.status = 'fetching';
          record('request-matched');
          response = await operation(
            'response-fetch',
            () =>
              route.fetch({ timeout: selectedFont.fetchTimeoutMs, maxRedirects: 0, maxRetries: 0 }),
            Math.min(deadline, clock() + selectedFont.fetchTimeoutMs),
            { onLate: disposeResponse },
          );
          ownedResponses.add(response);
          assert.equal(response.url(), target.href, 'Redirected font response');
          assert.equal(response.status(), 200, 'Original font must be available');
          const headers = response.headers();
          assert.equal(headers['content-type']?.split(';')[0].trim().toLowerCase(), 'font/woff2');
          assert.equal(headers['content-length'], String(selectedFont.bytes));
          const bytes = await operation('response-body', () => response.body(), deadline);
          assert.equal(bytes.length, selectedFont.bytes);
          report.actualBytes = bytes.length;
          report.actualSHA256 = createHash('sha256').update(bytes).digest('hex');
          assert.equal(
            report.actualSHA256,
            selectedFont.sha256,
            'Original font integrity mismatch',
          );
          if (closing || report.failure)
            throw new Error('Font owner cancelled before original response settled');
          report.status = 'held';
          record('original-response-validated');
          validated(true);
          const shouldRelease = await releaseDecision;
          assert(shouldRelease && !closing && !report.failure, 'Font hold was cancelled');
          forwarding = true;
          // The original APIResponse, bytes and headers are shared without a second fetch.
          // Joining closes when forwarding starts; every admitted route stays owned to settlement.
          await Promise.all(
            routes.map((item) =>
              operation(
                'response-fulfill',
                async () => {
                  await item.route.fulfill({ response });
                  item.fulfillmentSettled = true;
                },
                deadline,
              ),
            ),
          );
          fulfilled = true;
          report.released = true;
          record('original-response-forwarded');
        } catch (error) {
          fail(error);
        } finally {
          const end = beginCleanup();
          if (!fulfilled)
            await Promise.all(
              routes
                .filter((item) => !item.fulfillmentSettled)
                .map(async (item) => {
                  try {
                    await operation(
                      'request-abort',
                      async () => {
                        await item.route.abort('failed');
                        item.abortionSettled = true;
                        report.abortSettled = routes.every(
                          (r) => r.fulfillmentSettled || r.abortionSettled,
                        );
                        record('request-aborted');
                      },
                      end,
                      { cleanup: true },
                    );
                  } catch (error) {
                    fail(error);
                  }
                }),
            );
          if (response) await disposeResponse(response);
          clearTimer(timer);
          done = true;
          if (!report.failure && fulfilled && report.responseDisposed && pending.size === 0)
            report.status = 'complete';
        }
      })();
      await task;
      return true;
    },
    async waitUntilHeld() {
      const result = await bounded(
        ready.then((ok) => ({ ok })),
        clock() + selectedFont.fetchTimeoutMs,
        'request-observation',
        true,
      );
      assert(
        result.ok && report.status === 'held',
        'Validated selected-font response was not held before Start',
      );
    },
    releaseAfterPublicCancellation() {
      assert.equal(report.status, 'held', 'Only the validated pending original may be released');
      assert.equal(released, false, 'No repeated release');
      released = true;
      record('declared-public-cancel-boundary');
      decide(true);
    },
    async close() {
      closing = true;
      if (!done) {
        fail(new Error('Selected-font owner closed before release settled'));
        cancelWait();
      }
      if (task && !done)
        await bounded(
          task.then(
            () => ({ ok: true }),
            (error) => {
              fail(error);
              return { ok: false };
            },
          ),
          beginCleanup(),
          'owner-close',
          false,
        );
      clearTimer(timer);
    },
    snapshot() {
      const result = {
        ...report,
        claimed,
        done,
        closed:
          closing &&
          done &&
          pending.size === 0 &&
          ownedResponses.size === 0 &&
          (!joined ||
            (rejectedOwned === 0 &&
              routes.every((r) => r.fulfillmentSettled || r.abortionSettled))),
        ...(joined
          ? {
              ownedRouteCount:
                routes.filter((r) => !r.fulfillmentSettled && !r.abortionSettled).length +
                rejectedOwned,
              routes: routes.map((r, index) => ({
                index,
                fulfillmentSettled: r.fulfillmentSettled,
                abortionSettled: r.abortionSettled,
              })),
              rejectedOwned,
              joinsClosed: forwarding || closing || done,
            }
          : {}),
        ownedResponseCount: ownedResponses.size,
        pendingOperations: [...pending.values()],
        records: report.records.map((row) => ({ ...row })),
        timedOutOperations: [...report.timedOutOperations],
      };
      assert(Buffer.byteLength(JSON.stringify(result)) <= selectedFont.maximumEvidenceBytes);
      return result;
    },
  };
}

// Public-action boundary only: this is checked before releasing the held response.
export function assertSelectedFontCancelled(observation, protocol = SELECTED_FONT_PILOT.protocol) {
  assert([SELECTED_FONT_PILOT.protocol, SELECTED_FONT_JOINED_PILOT.protocol].includes(protocol));
  assert.equal(observation?.format, 'SoloFirstRunningReadinessV1');
  assert.equal(observation.protocol, protocol);
  assert.equal(observation.capacity, 8);
  assert.equal(observation.maximumBytes, 16384);
  assert.equal(observation.dropped, 0);
  assert.equal(observation.errors, 0);
  assert(Buffer.byteLength(JSON.stringify(observation)) <= 16384);
  assert.deepEqual(
    observation.records.map((row) => row.kind),
    ['start-click', 'cancel-back', 'cancel-complete'],
  );
  const [start, back, cancelled] = observation.records;
  assert(start.trusted && back.trusted && cancelled.trusted);
  for (const row of [back, cancelled]) {
    assert(row.visible && row.focused && row.phase !== 'running');
    assert.equal(row.tick, 0);
    assert(Number.isSafeInteger(row.run) && row.run > 0);
    assert.equal(row.levelId, 'first-return');
    assert.equal(row.font?.openDialogs, 0);
    assert.equal(row.font.selectedTheme, true);
    assert.equal(row.font.loaded, false);
    assert.notEqual(row.font.acceptedTheme, 'dnipro-porcelain');
  }
  assert.equal(back.font.preparation, 'busy');
  assert.equal(cancelled.font.preparation, 'cancelled');
  assert.equal(cancelled.font.defaultPrevented, true);
  assert.equal(back.run, cancelled.run);
  assert(start.atMs <= back.atMs && back.atMs <= cancelled.atMs);
  return cancelled;
}
export function assessSelectedFontReadiness(
  observation,
  application,
  documents,
  transport,
  requestPolicy = 'single-v1',
) {
  const protocol =
    requestPolicy === 'same-url-two-v2'
      ? SELECTED_FONT_JOINED_PILOT.protocol
      : SELECTED_FONT_PILOT.protocol;
  const failures = [];
  try {
    assert.equal(documents, 1);
    assert.equal(observation?.format, 'SoloFirstRunningReadinessV1');
    assert.equal(observation.protocol, protocol);
    assert.equal(observation.capacity, 8);
    assert.equal(observation.maximumBytes, 16384);
    assert.equal(observation.dropped, 0);
    assert.equal(observation.errors, 0);
    assert(Buffer.byteLength(JSON.stringify(observation)) <= 16384);
    const rows = observation.records;
    assert.deepEqual(
      rows.map((row) => row.kind),
      [
        'start-click',
        'cancel-back',
        'cancel-complete',
        'font-release-no-start',
        'start-click',
        'first-running',
        'after-running',
      ],
    );
    const cancelled = assertSelectedFontCancelled(
      { ...observation, records: rows.slice(0, 3) },
      protocol,
    );
    const released = rows[3],
      start = rows[4],
      active = rows[5];
    for (let i = 0; i < rows.length; i++) {
      assert(Number.isFinite(rows[i].atMs) && rows[i].atMs >= 0);
      if (i) assert(rows[i].atMs >= rows[i - 1].atMs);
    }
    for (const row of [released, start, active]) {
      assert.equal(row.run, cancelled.run);
      assert.equal(row.tick, 0);
      assert.equal(row.levelId, 'first-return');
      assert(row.visible && row.focused);
      assert.equal(row.font?.openDialogs, 0);
      assert.equal(row.font.selectedTheme, true);
      assert.equal(row.font.loaded, true);
      assert.equal(row.font.acceptedTheme, 'dnipro-porcelain');
    }
    assert.notEqual(released.phase, 'running');
    assert.notEqual(start.phase, 'running');
    assert.equal(start.trusted, true);
    assert.equal(active.phase, 'running');
    assertSelectedFontTransport(transport, requestPolicy);
    const ready = assessReadinessPilot(
      { ...observation, protocol: READINESS_PILOT.protocol, records: [start, active, rows[6]] },
      application,
      documents,
    );
    assert.equal(ready.status, 'passed', ready.failures.join(', '));
  } catch (error) {
    failures.push(String(error.message ?? error).slice(0, 2048));
  }
  return {
    status: failures.length ? 'failed' : 'passed',
    failures,
    scope:
      'One exact native shared-font response withheld through trusted public cancellation, then unchanged response and explicit Start; no performance or physical-display qualification.',
  };
}

// Explicit prospective transport admission; legacy callers retain single-v1.
export function assertSelectedFontTransport(transport, requestPolicy = 'single-v1') {
  assert(['single-v1', 'same-url-two-v2'].includes(requestPolicy));
  const joined = requestPolicy === 'same-url-two-v2';
  assert.equal(transport?.format, joined ? 'SoloSelectedFontHoldV2' : 'SoloSelectedFontHoldV1');
  assert.equal(transport.status, 'complete');
  if (joined) {
    assert.equal(transport.requestPolicy, requestPolicy);
    assert.equal(transport.maximumRequests, 2);
    assert(
      Number.isSafeInteger(transport.claimed) && transport.claimed >= 1 && transport.claimed <= 2,
    );
    assert.equal(transport.routes?.length, transport.claimed);
    assert.equal(transport.ownedRouteCount, 0);
    assert.equal(transport.rejectedOwned, 0);
    assert.equal(transport.joinsClosed, true);
    transport.routes.forEach((route, index) =>
      assert.deepEqual(route, {
        index,
        fulfillmentSettled: true,
        abortionSettled: false,
      }),
    );
  } else assert.equal(transport.claimed, 1);
  assert.equal(transport.released, true);
  assert.equal(transport.done, true);
  assert.equal(transport.closed, true);
  assert.equal(transport.responseDisposed, true);
  assert.equal(transport.ownedResponseCount, 0);
  assert.deepEqual(transport.pendingOperations, []);
  assert.deepEqual(transport.timedOutOperations, []);
  assert.equal(transport.failure, null);
  assert.equal(transport.dropped, 0);
  assert.deepEqual(transport.expected, selectedFont);
  assert.equal(transport.actualBytes, selectedFont.bytes);
  assert.equal(transport.actualSHA256, selectedFont.sha256);
  assert(Array.isArray(transport.records) && transport.records.length <= selectedFont.records);
  const events = transport.records.map((r) => r.kind);
  if (joined) {
    assert.equal(
      events.filter((kind) => kind === 'same-original-request-joined').length,
      transport.claimed - 1,
    );
    const join = events.indexOf('same-original-request-joined');
    assert(join < 0 || (join > 0 && join < events.indexOf('original-response-forwarded')));
  }
  assert.deepEqual(
    joined ? events.filter((kind) => kind !== 'same-original-request-joined') : events,
    [
      'request-matched',
      'original-response-validated',
      'declared-public-cancel-boundary',
      'original-response-forwarded',
      'response-disposed',
    ],
  );
  assert(Buffer.byteLength(JSON.stringify(transport)) <= selectedFont.maximumEvidenceBytes);
  return true;
}
