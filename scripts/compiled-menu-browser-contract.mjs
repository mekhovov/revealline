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
  const startProbeLifecycle = { setup: null, cleanup: null };
  let latestPublicRead = null,
    publicReadSequence = 0,
    publicReadRecordingFailures = 0,
    publicReadUnavailable = false,
    publicReadOmittedForReadCap = false;
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
    publicRead: latestPublicRead,
    publicReadSequence,
    publicReadRecordingFailures,
    publicReadUnavailable,
    publicReadOmittedForReadCap,
    startProbeLifecycle,
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
    if (Buffer.byteLength(JSON.stringify(value, null, 2)) + 1 > 32768) {
      value = {
        ...value,
        publicRead: null,
        publicReadOmittedForTraceCap: latestPublicRead !== null,
        overflow: true,
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
  // A passive copy of an already-returned public read; never inspect cards or href.
  const recordPublicState = (state) => {
    publicReadSequence += 1;
    try {
      const scalarText = (value, cap = 128) =>
        typeof value === 'string' ? text(value, cap) : null;
      const scalarBoolean = (value) => (typeof value === 'boolean' ? value : null);
      const inputControls = state?.controls;
      const controls = Object.fromEntries(
        [
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
        ].map((id) => {
          const value = inputControls?.[id];
          return [
            id,
            {
              visible: scalarBoolean(value?.visible),
              enabled: scalarBoolean(value?.enabled),
              open: scalarBoolean(value?.open),
              text: scalarText(value?.text, 256),
            },
          ];
        }),
      );
      const candidate = {
        format: 'CompiledPublicReadV1',
        readSequence: publicReadSequence,
        phase,
        phaseSequence,
        readIteration,
        operationId: completed?.id ?? null,
        elapsedFlowMs: completed?.elapsedFlowMs ?? null,
        state: {
          startActivation: (() => {
            const input = state?.startActivation;
            if (!input || input.format !== 'CompiledStartEventProbeV1') return null;
            const fact = (row, expectedPhase) => {
              if (!row || row.phase !== expectedPhase) return null;
              return Object.fromEntries([
                ['phase', expectedPhase],
                ['eventType', row.eventType === 'click' ? 'click' : null],
                ...[
                  'trusted',
                  'defaultPrevented',
                  'isPrimary',
                  'handlerFunctionPresent',
                  'sameInstalledHandler',
                  'installedHandlerFunction',
                  'hidden',
                  'focused',
                  'startEnabled',
                ].map((key) => [key, scalarBoolean(row[key])]),
                ...['eventPhase', 'button', 'detail'].map((key) => [
                  key,
                  Number.isInteger(row[key]) && row[key] >= -1 && row[key] <= 10 ? row[key] : null,
                ]),
                ...['handlerType', 'flight', 'focusedId'].map((key) => [
                  key,
                  scalarText(row[key], 64),
                ]),
              ]);
            };
            return {
              format: 'CompiledStartEventProbeV1',
              installed: scalarBoolean(input.installed),
              disposed: scalarBoolean(input.disposed),
              teardown: scalarText(input.teardown, 32),
              failures:
                Number.isSafeInteger(input.failures) && input.failures >= 0
                  ? Math.min(input.failures, 1000000)
                  : null,
              capture: fact(input.capture, 'window-capture'),
              afterHandlerSlot: fact(input.afterHandlerSlot, 'target-after-handler-slot'),
            };
          })(),
          hidden: scalarBoolean(state?.hidden),
          focused: scalarBoolean(state?.focused),
          lang: scalarText(state?.lang),
          focusedId: scalarText(state?.focusedId),
          boot: scalarText(state?.boot),
          access: scalarText(state?.access),
          flight: scalarText(state?.flight),
          time: scalarText(state?.time, 64),
          lives: scalarText(state?.lives, 64),
          coverage: scalarText(state?.coverage, 64),
          controls,
        },
      };
      if (Buffer.byteLength(JSON.stringify(candidate, null, 2)) + 1 > 8192) {
        publicReadUnavailable = true;
        publicReadOmittedForReadCap = true;
        return;
      }
      latestPublicRead = candidate;
      publicReadUnavailable = false;
      publicReadOmittedForReadCap = false;
    } catch {
      publicReadRecordingFailures += 1;
      recordingFailures += 1;
      publicReadUnavailable = true;
    }
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
    recordPublicState,
    recordStartProbeLifecycle: (kind, outcome) =>
      safe(() => {
        if (!['setup', 'cleanup'].includes(kind) || startProbeLifecycle[kind] !== null) return;
        startProbeLifecycle[kind] = [
          'installed-or-unavailable',
          'unavailable',
          'removed',
          'unconfirmed',
        ].includes(outcome)
          ? outcome
          : 'unconfirmed';
      }),
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
        publicReadSequence,
        publicReadOmittedForReportCap: latestPublicRead !== null,
      };
      try {
        return encode({ ...report, operationTrace: omitted });
      } catch {
        return original;
      }
    },
  });
}

// Passive, fixed-slot observation of one real Start click; never invoke its handler.
export function installCompiledStartEventProbe({
  window: win = globalThis.window,
  document: doc = globalThis.document,
} = {}) {
  let button = null,
    installedHandler = null,
    capturedEvent = null;
  let capture = null,
    afterHandlerSlot = null,
    failures = 0;
  let installed = false,
    disposed = false,
    teardown = 'not-requested',
    cleanupUnconfirmed = false;
  const removers = [];
  const safe = (work) => {
    try {
      return work();
    } catch {
      failures += 1;
      return undefined;
    }
  };
  const clean = () => {
    let removed = true;
    for (const remove of removers.splice(0)) {
      try {
        remove();
      } catch {
        failures += 1;
        removed = false;
      }
    }
    installed = false;
    if (!removed) cleanupUnconfirmed = true;
    return removed;
  };
  const facts = (event, phase) => {
    const handler = button.onclick;
    const number = (value, minimum, maximum) =>
      Number.isInteger(value) && value >= minimum && value <= maximum ? value : null;
    return Object.freeze({
      phase,
      eventType: event.type === 'click' ? 'click' : null,
      trusted: event.isTrusted === true,
      defaultPrevented: event.defaultPrevented === true,
      eventPhase: number(event.eventPhase, 0, 3),
      button: number(event.button, -1, 4),
      detail: number(event.detail, 0, 10),
      isPrimary: typeof event.isPrimary === 'boolean' ? event.isPrimary : null,
      handlerType: typeof handler,
      handlerFunctionPresent: typeof handler === 'function',
      sameInstalledHandler: handler === installedHandler,
      installedHandlerFunction: typeof installedHandler === 'function',
      hidden: doc.hidden === true,
      focused: doc.hasFocus() === true,
      flight:
        typeof doc.body?.dataset?.flightState === 'string'
          ? doc.body.dataset.flightState.slice(0, 64)
          : null,
      focusedId:
        typeof doc.activeElement?.id === 'string' ? doc.activeElement.id.slice(0, 64) : null,
      startEnabled: button.disabled === false,
    });
  };
  const atCapture = (event) =>
    safe(() => {
      if (disposed || capturedEvent || event.type !== 'click') return;
      if (event.target !== button && !button.contains(event.target)) return;
      capturedEvent = event;
      capture = facts(event, 'window-capture');
    });
  const atTarget = (event) =>
    safe(() => {
      if (disposed || afterHandlerSlot || event !== capturedEvent || event.type !== 'click') return;
      afterHandlerSlot = facts(event, 'target-after-handler-slot');
    });
  safe(() => {
    button = doc.getElementById('start-button');
    if (!button || !win?.addEventListener || !button.addEventListener) return;
    installedHandler = button.onclick;
    // Register cleanup before registration, including a partially-throwing host.
    removers.push(() => win.removeEventListener('click', atCapture, true));
    win.addEventListener('click', atCapture, { capture: true, passive: true });
    removers.push(() => button.removeEventListener('click', atTarget, false));
    button.addEventListener('click', atTarget, { capture: false, passive: true });
    installed = true;
  });
  if (!installed) clean();
  return Object.freeze({
    snapshot: () => ({
      format: 'CompiledStartEventProbeV1',
      installed,
      disposed,
      teardown,
      failures,
      capture: capture ? { ...capture } : null,
      afterHandlerSlot: afterHandlerSlot ? { ...afterHandlerSlot } : null,
    }),
    dispose: () => {
      if (!disposed) {
        disposed = true;
        teardown = clean() && !cleanupUnconfirmed ? 'removed' : 'unconfirmed';
        capturedEvent = null;
      }
      return { disposed, teardown, failures };
    },
  });
}
