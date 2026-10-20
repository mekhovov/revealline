import assert from 'node:assert/strict';

export const TARGET = Object.freeze({
  repository: 'mekhovov/revealline',
  source: '37ec4fc6af9ee62747339459d28decc2a5283501',
  tree: '873e9dfdd85350b56b4d6b9cb957073e18dbdd81',
  run: 39356263374,
  attempt: 1,
  artifact: 12236777601,
  outerBytes: 1096242271,
  outerSha256: '60603890fee36244379db56669f73b4c12cd3eae1505beb3a7cf3ceee92f17a7',
  innerBytes: 1077235917,
  innerSha256: '3ed7b527ba57a3fc51006cc3b2d7b4d0558dffe217cb8ff896b765bdd385c2e4',
  manifestBytes: 533939,
  manifestSha256: 'a8679cf79dc70feabb600c908a481cc3878223fe2736bcc87c285a92707e2efe',
});
export const STAGES = Object.freeze([
  'ordinary-password-accepted',
  'en-home',
  'en-current-and-retained',
  'en-browse-back-focus',
  'exact-current-briefing',
  'native-start-pause-resume',
  'native-uk-settings-back-focus',
  'uk-current-and-retained',
  'uk-browse-back-focus',
]);
export const CURRENT_ID = JSON.stringify([
  'journey:whole-spatial-v25',
  'whole-spatial-v25',
  JSON.stringify(['candidate', 'journey-opening', 'prologue']),
  'candidate/journey-opening/prologue/first-return',
  '',
]);
// Exact prior-edition owner/membership: spatial-next-editions EDITION_HISTORY,
// apex-candidates campaign apex-aurora / pack journey-apex, journeyLibrarySource.
export const RETAINED_IDS = Object.freeze(
  ['crossing-complete', 'returning-light', 'home-signal'].map((mission) =>
    JSON.stringify([
      'journey:whole-spatial-v24',
      'whole-spatial-v24',
      JSON.stringify(['candidate', 'journey-apex', 'apex-aurora']),
      'candidate/journey-apex/apex-aurora/' + mission,
      '',
    ]),
  ),
);
export function assertArtifact(metadata, run) {
  assert.equal(metadata.id, TARGET.artifact);
  assert.equal(metadata.expired, false);
  assert.equal(metadata.size_in_bytes, TARGET.outerBytes);
  assert.equal(metadata.digest, 'sha256:' + TARGET.outerSha256);
  assert.equal(metadata.workflow_run.id, TARGET.run);
  assert.equal(metadata.workflow_run.head_sha, TARGET.source);
  assert.equal(metadata.workflow_run.repository_id, 1367404328);
  assert.equal(metadata.workflow_run.head_repository_id, 1367404328);
  assert.equal(run.id, TARGET.run);
  assert.equal(run.run_attempt, TARGET.attempt);
  assert.equal(run.head_sha, TARGET.source);
  assert.equal(run.status, 'completed');
  assert.equal(run.conclusion, 'success');
  assert.equal(run.repository.full_name, TARGET.repository);
}
export function assertOwner(owner) {
  assert.equal(owner.status, 'closed');
  assert.equal(owner.exitCode, 0);
  assert.equal(owner.signal, null);
  assert.equal(owner.violation, null);
  assert.equal(owner.forcedCleanup, false);
  assert(!owner.cleanupUnconfirmed);
  assert.deepEqual(owner.survivors, []);
  assert.deepEqual(owner.ambiguous, []);
}
export function assertBrowserReport(report, owner, tooling) {
  assertOwner(owner);
  assert.equal(report.format, 'RevealLineCompiledMenuBrowserReportV1');
  assert.equal(report.status, 'passed-controls');
  assert.deepEqual(report.target, TARGET);
  assert.equal(report.toolingRevision, tooling);
  assert.equal(report.performanceExcluded, true);
  assert.equal(report.engine, 'chromium');
  assert.equal(report.profile, 'fresh-ephemeral');
  assert.equal(report.browserVersion, '151.0.7922.34');
  assert.deepEqual(report.stages, STAGES);
  assert.deepEqual(report.cleanup, { context: 'closed', browser: 'closed', server: 'closed' });
  assert.equal(report.diagnostics.total, 0);
  assert.equal(report.diagnostics.overflow, false);
  assert.deepEqual(report.diagnostics.events, []);
  assert(!report.failure && !report.cleanupFailure);
  assert.deepEqual(report.binaryBefore, report.binaryAfter);
  assert.match(report.binaryBefore.sha256, /^[a-f0-9]{64}$/);
  assert(report.binaryBefore.bytes > 0);
  assert.deepEqual(
    report.localeEvidence.map((x) => x.locale),
    ['en', 'uk'],
  );
  for (const row of report.localeEvidence) {
    assert.equal(row.currentCount, 91);
    assert.equal(row.currentId, CURRENT_ID);
    assert.deepEqual([...row.retainedIds].sort(), [...RETAINED_IDS].sort());
    assert.equal(row.backFocus, 'shell-play');
  }
  assert.equal(report.settingsBackFocus, 'shell-options');
  assert.equal(report.navigationOverflow, false);
  assert(
    Array.isArray(report.navigationResponses) &&
      report.navigationResponses.length > 0 &&
      report.navigationResponses.length <= 8,
  );
  for (const response of report.navigationResponses) {
    assert.equal(response.path, '/game/content-design/runtime/navigation-whole-spatial-v25.json');
    assert.equal(response.status, 200);
  }
  assert.equal(report.visiblePauseValuesStable, true);
}
export function assertSignedArtifactURL(value) {
  const u = new URL(value);
  assert.equal(u.protocol, 'https:');
  assert(!u.username && !u.password && !u.hash);
  assert(/^[a-z0-9-]+\.blob\.core\.windows\.net$/.test(u.hostname));
  assert(u.searchParams.has('sig') && u.searchParams.has('se'));
  return u;
}
export function assertLoopback(value) {
  const u = new URL(value);
  assert.equal(u.protocol, 'http:');
  assert.equal(u.hostname, '127.0.0.1');
  assert(/^[0-9]+$/.test(u.port));
  assert(!u.username && !u.password && !u.search && !u.hash);
  assert.equal(u.pathname, '/');
  return u;
}

// Diagnostic bookkeeping only: no callback, timeout, promise or error substitution.
export function createCompiledOperationTrace(budget, redact) {
  const events = [];
  let eventSequence = 0,
    operationSequence = 0,
    phaseSequence = 0;
  let phase = null,
    readIteration = 0,
    locale = null;
  let current = null,
    completed = null,
    nativeAction = null;
  let overflow = false,
    dropped = 0,
    recordingFailures = 0;
  const safe = (work) => {
    try {
      return work();
    } catch {
      recordingFailures += 1;
      return undefined;
    }
  };
  const text = (value, cap = 128) => {
    try {
      return String(redact(String(value), cap)).slice(0, cap);
    } catch {
      recordingFailures += 1;
      return '[trace text unavailable]';
    }
  };
  const time = () => {
    try {
      const value = budget.now();
      return Number.isFinite(value) && value >= 0 ? Math.round(value * 1000) / 1000 : null;
    } catch {
      recordingFailures += 1;
      return null;
    }
  };
  const began = time();
  const elapsed = (now, start) =>
    now !== null && start !== null ? Math.max(0, Math.round((now - start) * 1000) / 1000) : null;
  const summary = () => ({
    format: 'CompiledOperationTraceV1',
    events,
    eventSequence,
    operationSequence,
    phaseSequence,
    currentPhase: phase,
    phaseReadIteration: readIteration,
    locale,
    currentOperation: current,
    lastCompletedOperation: completed,
    lastCompletedNativeAction: nativeAction,
    overflow,
    droppedEvents: dropped,
    recordingFailures,
  });
  const compact = (row) =>
    row === null
      ? null
      : {
          id: row.id,
          label: row.label,
          phase: row.phase,
          readIteration: row.readIteration,
          locale: row.locale,
          event: row.event,
        };
  const snapshot = () => {
    let value = summary();
    if (Buffer.byteLength(JSON.stringify(value, null, 2)) + 1 > 32768) {
      value = {
        ...value,
        currentOperation: compact(current),
        lastCompletedOperation: compact(completed),
        lastCompletedNativeAction: compact(nativeAction),
        overflow: true,
        summaryDetailsOmitted: true,
      };
    }
    return JSON.parse(JSON.stringify(value));
  };
  const append = (entry) => {
    eventSequence += 1;
    const event = Object.freeze({ sequence: eventSequence, ...entry });
    // Reserve half the trace cap for bounded current/last-action summary fields.
    if (
      events.length >= 128 ||
      Buffer.byteLength(JSON.stringify([...events, event], null, 2)) + 1 > 16384
    ) {
      overflow = true;
      dropped += 1;
      return;
    }
    events.push(event);
  };
  const start = (args) => {
    const now = time(),
      cap = args.length > 2 ? args[2] : 10000;
    const deadline = budget.deadline;
    const op = Object.freeze({
      id: ++operationSequence,
      label: text(args[0]),
      nativeAction:
        typeof args[0] === 'string' &&
        (args[0].startsWith('native ') ||
          [
            'ordinary password entry',
            'ordinary password submission',
            'real exact mission card',
          ].includes(args[0])),
      phase,
      phaseSequence,
      readIteration,
      locale,
      elapsedFlowMs: elapsed(now, began),
      requestedCapMs: Number.isFinite(cap) && cap >= 0 ? cap : null,
      remainingFlowMs:
        now !== null && Number.isFinite(deadline) ? Math.max(0, deadline - now) : null,
    });
    current = op;
    append({ event: 'started', ...op });
    return { op, began: now };
  };
  const finish = (entry, event, error) => {
    if (!entry) return;
    const now = time();
    const row = Object.freeze({
      ...entry.op,
      event,
      elapsedFlowMs: elapsed(now, began),
      elapsedOperationMs: elapsed(now, entry.began),
      ...(event === 'rejected'
        ? {
            errorName: text(error?.name ?? 'Error'),
            errorMessage: text(error?.message ?? error, 512),
          }
        : {}),
    });
    completed = row;
    if (event === 'fulfilled' && entry.op.nativeAction) {
      nativeAction = row;
    }
    if (current?.id === entry.op.id) current = null;
    append(row);
  };
  function step(...args) {
    const entry = safe(() => start(args));
    let result;
    try {
      result = Reflect.apply(budget.step, budget, args);
    } catch (error) {
      safe(() => finish(entry, 'rejected', error));
      throw error;
    }
    // Native Promise observation only; no thenable assimilation or replacement.
    safe(() =>
      Promise.prototype.then.call(
        result,
        () => {
          safe(() => finish(entry, 'fulfilled'));
        },
        (error) => {
          safe(() => finish(entry, 'rejected', error));
        },
      ),
    );
    return result;
  }
  return Object.freeze({
    step,
    enterPhase: (label) =>
      safe(() => {
        phase = text(label);
        phaseSequence += 1;
        readIteration = 0;
      }),
    noteRead: () =>
      safe(() => {
        readIteration += 1;
      }),
    setLocale: (value) =>
      safe(() => {
        locale = value === 'en' || value === 'uk' ? value : null;
      }),
    snapshot: () => safe(snapshot),
    encodeReport: (report, encode) => {
      // Preserve the pre-existing report and its encoding failure as authority.
      const original = encode(report),
        trace = safe(snapshot);
      if (!trace) return original;
      try {
        return encode({ ...report, operationTrace: trace });
      } catch {
        /* diagnostic only */
      }
      const omitted = {
        format: 'CompiledOperationTraceV1',
        events: [],
        overflow: true,
        omittedForReportCap: true,
        eventSequence,
        operationSequence,
      };
      try {
        return encode({ ...report, operationTrace: omitted });
      } catch {
        return original;
      }
    },
  });
}
