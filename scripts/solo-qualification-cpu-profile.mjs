import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, writeFile } from 'node:fs/promises';

/** A separate diagnostic recording. Never use its timings as qualification. */
export function createQualificationCpuProfile(cdp, { file, maximumMs, onLimit = () => {} }) {
  assert(Number.isInteger(maximumMs) && maximumMs > 0 && maximumMs <= 300000);
  const report = {
    status: 'not-started',
    file,
    maximumMs,
    samplingIntervalUs: 1000,
    scope:
      'Chromium main-thread CDP CPU profile, including preparation and public UI. Entire run excluded from timing gates; workers, GPU and native decoder work are not fully observed.',
  };
  let timer,
    stopPromise,
    started = false;
  const send = async (method, params) => {
    let deadline;
    try {
      return await Promise.race([
        cdp.send(method, params),
        new Promise((_, reject) => {
          deadline = setTimeout(() => reject(new Error(`${method} exceeded 10 seconds`)), 10000);
        }),
      ]);
    } finally {
      clearTimeout(deadline);
    }
  };
  const stop = (reason = 'completed') => {
    if (stopPromise) return stopPromise;
    clearTimeout(timer);
    stopPromise = (async () => {
      report.stopReason = reason;
      report.stopRequestedAt = new Date().toISOString();
      if (!started) return report;
      try {
        const { profile } = await send('Profiler.stop');
        report.profileStartTimeUs = profile.startTime;
        report.profileEndTimeUs = profile.endTime;
        report.sampleCount = profile.samples?.length ?? 0;
        report.nodeCount = profile.nodes?.length ?? 0;
        const bytes = JSON.stringify(profile) + '\n';
        assert(Buffer.byteLength(bytes) <= 64 * 1024 * 1024, 'CPU profile exceeds 64 MiB bound');
        await writeFile(file, bytes, { flag: 'wx' });
        report.bytes = Buffer.byteLength(bytes);
        report.sha256 = createHash('sha256').update(bytes).digest('hex');
        report.status = 'retained';
      } catch (error) {
        report.status = 'failed';
        report.failure = String(error.stack ?? error);
      } finally {
        report.stoppedAt = new Date().toISOString();
      }
      return report;
    })();
    return stopPromise;
  };
  return {
    report,
    async start() {
      assert.equal(report.status, 'not-started', 'CPU profile may only start once');
      try {
        try {
          await access(file);
          throw new Error('Refusing to overwrite an existing CPU profile');
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
        await send('Profiler.enable');
        await send('Profiler.setSamplingInterval', { interval: report.samplingIntervalUs });
        await send('Profiler.start');
        started = true;
        report.status = 'recording';
        report.startedAt = new Date().toISOString();
        timer = setTimeout(async () => {
          report.limitReached = true;
          await stop('profile-duration-limit');
          await onLimit();
        }, maximumMs);
        timer.unref?.();
      } catch (error) {
        report.status = 'failed';
        report.failure = String(error.stack ?? error);
        throw error;
      }
    },
    stop,
  };
}

const FRAME_TRACE_RECIPE_SHA256 =
  '6da01ca449068ca6705012f3d6604362c581fe52c4583407797c0961acf3156d';
export const FRAME_TRACE_CATEGORIES = Object.freeze([
  'toplevel',
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'disabled-by-default-devtools.timeline.frame',
  'blink.user_timing',
  'cc',
  'viz',
  'gpu',
]);
export const FRAME_TASK_TRACE_PROTOCOL = 'warm-first3-tasks-v2';
export const FRAME_TASK_TRACE_CATEGORIES = Object.freeze(FRAME_TRACE_CATEGORIES.slice(0, 5));
export function frameTraceCategories(protocol = 'warm-first3-v1') {
  assert(
    ['warm-first3-v1', FRAME_TASK_TRACE_PROTOCOL].includes(protocol),
    'Unknown frame trace protocol',
  );
  return protocol === FRAME_TASK_TRACE_PROTOCOL
    ? FRAME_TASK_TRACE_CATEGORIES
    : FRAME_TRACE_CATEGORIES;
}
export const FRAME_TRACE_LIMITS = Object.freeze({
  maximumMs: 30000,
  bufferKiB: 8192,
  maximumBytes: 64 * 1024 * 1024,
  chunkBytes: 65536,
  maximumReads: 1025,
});
const FRAME_TRACE_MARKS = Object.freeze({
  start: 'solo-frame-trace-before-public-start-v1',
  end: 'solo-frame-trace-after-safe-border-direction-3-v1',
});

/** This narrow observer is not a timing gate or a physical presentation clock. */
export function qualificationFrameTraceOptions(flags, engine, scenarioBytes) {
  const selected = flags.filter((flag) => flag.startsWith('--frame-trace'));
  if (!selected.length) return null;
  assert.equal(selected.length, 1);
  const protocol = selected[0].slice('--frame-trace='.length);
  assert.equal(selected[0], '--frame-trace=' + protocol);
  frameTraceCategories(protocol);
  assert.equal(engine, 'chromium');
  assert(
    !flags.some((flag) => ['--cpu-profile', '--memory-profile', '--audio-proof'].includes(flag)),
  );
  assert(flags.includes('--work-probe') && flags.includes('--cadence=settled120'));
  assert(
    !flags.includes('--fixture-access') && !flags.some((flag) => flag.startsWith('--public-url')),
  );
  assert.equal(createHash('sha256').update(scenarioBytes).digest('hex'), FRAME_TRACE_RECIPE_SHA256);
  return Object.freeze({ protocol, recipeSHA256: FRAME_TRACE_RECIPE_SHA256 });
}

export function inspectFrameTrace(bytes, anchors) {
  assert(
    Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= FRAME_TRACE_LIMITS.maximumBytes,
  );
  const value = JSON.parse(bytes.toString('utf8'));
  assert(Array.isArray(value.traceEvents), 'Missing traceEvents array');
  const found = { start: [], end: [] };
  for (const event of value.traceEvents) {
    for (const key of ['start', 'end']) {
      if (
        event.name === FRAME_TRACE_MARKS[key] &&
        typeof event.cat === 'string' &&
        event.cat.split(',').includes('blink.user_timing')
      )
        found[key].push(event);
    }
  }
  const result = {};
  for (const key of ['start', 'end']) {
    assert.equal(found[key].length, 1, 'Required unique ' + key + ' anchor absent or duplicated');
    const event = found[key][0],
      anchor = anchors[key];
    assert(anchor && Number.isFinite(anchor.startTime) && Number.isFinite(anchor.timeOrigin));
    assert(
      Number.isFinite(event.ts) &&
        Number.isSafeInteger(event.pid) &&
        Number.isSafeInteger(event.tid),
    );
    assert(Number.isFinite(anchor.cdpRequestElapsedMs) && anchor.cdpRequestElapsedMs >= 0);
    assert(
      Number.isFinite(anchor.before) &&
        Number.isFinite(anchor.after) &&
        anchor.before <= anchor.startTime &&
        anchor.startTime <= anchor.after,
    );
    result[key] = {
      traceUs: event.ts,
      browserMs: anchor.startTime,
      browserBracketMs: [anchor.before, anchor.after],
      cdpRequestElapsedMs: anchor.cdpRequestElapsedMs,
      traceMinusBrowserMs: event.ts / 1000 - anchor.startTime,
      pid: event.pid,
      tid: event.tid,
    };
  }
  assert.equal(result.start.pid, result.end.pid, 'Anchor process changed');
  assert.equal(result.start.tid, result.end.tid, 'Anchor thread changed');
  assert.equal(anchors.start.timeOrigin, anchors.end.timeOrigin, 'Anchor document changed');
  assert(
    result.end.traceUs >= result.start.traceUs && result.end.browserMs >= result.start.browserMs,
  );
  assert(
    result.end.traceUs - result.start.traceUs <= FRAME_TRACE_LIMITS.maximumMs * 1000,
    'Anchor trace window exceeds 30 seconds',
  );
  return {
    eventCount: value.traceEvents.length,
    anchors: result,
    mappingOffsetDifferenceMs: result.end.traceMinusBrowserMs - result.start.traceMinusBrowserMs,
    uncertainty:
      'The two page-clock brackets and CDP round-trip durations are retained separately. Trace and performance clocks are not assumed identical; interpolation is diagnostic only. End was requested after direction 3 and may execute later. No GPU completion or physical presentation claim.',
  };
}

/** Reuses the existing row-owned CDP connection; no launch, flags, signals or sampling. */
export function createQualificationFrameTrace(
  cdp,
  { file, remainingMs, onLimit = () => {}, protocol = 'warm-first3-v1' },
) {
  const categories = frameTraceCategories(protocol);
  assert.equal(typeof remainingMs, 'function');
  const report = {
    status: 'not-started',
    protocol,
    file,
    ...FRAME_TRACE_LIMITS,
    categories: [...categories],
    categoryCoverage:
      protocol === FRAME_TASK_TRACE_PROTOCOL
        ? 'Task/frame subset. Broad cc, viz and gpu categories are omitted; cross-tagged events may remain. Reduced coverage is not a guarantee against trace loss.'
        : 'Original broad task/frame, cc, viz and gpu categories.',
    anchors: {},
    backend: {
      applicationRenderer: 'unobserved',
      hardwareGraphics: 'unobserved',
      reason:
        'The existing fixed warm observer emits no renderer or GL identity. No graphics context is created or queried for this diagnostic. CDP categories and the browser name do not establish hardware acceleration.',
    },
    launchScope:
      'Existing qualifier launch options are unchanged. The parent report retains browser version, requested headless/display settings, CPU and cadence; Playwright default flags and physical GPU backend are not independently enumerated.',
    scope:
      'Separate perturbed Chromium browser-frame diagnostic; all timing gates excluded. Browser trace categories do not prove physical display/GPU completion or OS scheduling causes.',
  };
  let timer,
    started = false,
    startRequested = false,
    closeOwnerPromise,
    stopPromise,
    finishPromise,
    endPromise,
    completion,
    stream,
    completionResolve;
  const complete = new Promise((resolve) => {
    completionResolve = resolve;
  });
  const completeHandler = (value) => {
    if (!completion) {
      completion = value;
      if (typeof value?.stream === 'string' && value.stream.length > 0) stream = value.stream;
      report.completionObserved = true;
      clearTimeout(timer);
      completionResolve(value);
    }
  };
  const usageHandler = (value) => {
    for (const key of ['percentFull', 'value'])
      if (Number.isFinite(value[key])) {
        report.maximumBufferUsage = Math.max(report.maximumBufferUsage ?? 0, value[key]);
        if (value[key] >= 1) report.bufferFull = true;
      }
  };
  const fail = (error) => {
    report.status = 'incomplete';
    report.failure ??= String(error.stack ?? error).slice(0, 8192);
  };
  const bounded = async (operation, name, cleanup = false) => {
    let timeout;
    const ms = cleanup ? 10000 : Math.min(10000, remainingMs());
    assert(Number.isFinite(ms) && ms > 0, 'Frame trace has no remaining scenario time');
    try {
      return await Promise.race([
        operation(),
        new Promise((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error(name + ' exceeded remaining command bound')),
            ms,
          );
        }),
      ]);
    } finally {
      clearTimeout(timeout);
    }
  };
  const send = (name, params) => bounded(() => cdp.send(name, params), name, name === 'IO.close');
  const requestOwnerClose = (reason) => {
    if (closeOwnerPromise) return closeOwnerPromise;
    report.ownerClosureRequested = reason;
    report.cleanupAuthority =
      'The row-owned browser must close when start or completion is unknown. A stream delivered after CDP detach cannot be inspected or independently closed here; no universal stream-closure claim.';
    closeOwnerPromise = bounded(() => onLimit(reason), 'owned-browser-close', true)
      .then(() => {
        report.ownerCloseCallbackSettled = true;
      })
      .catch((error) => {
        fail(error);
        report.ownerCloseFailure = String(error.message).slice(0, 4096);
      });
    return closeOwnerPromise;
  };

  const anchor = async (key) => {
    const name = FRAME_TRACE_MARKS[key],
      requested = performance.now();
    const expression =
      '(() => { const name=' +
      JSON.stringify(name) +
      '; if(performance.getEntriesByName(name).length) throw new Error("Duplicate trace anchor"); const before=performance.now(); const entry=performance.mark(name); const after=performance.now(); return {name, before, after, startTime:entry.startTime, timeOrigin:performance.timeOrigin, phase:document.body?.dataset.flightState?.slice(0, 32) ?? null}; })()';
    const result = await send('Runtime.evaluate', { expression, returnByValue: true });
    assert(
      !result.exceptionDetails && result.result?.value?.name === name,
      'Trace anchor evaluation failed',
    );
    report.anchors[key] = {
      ...result.result.value,
      cdpRequestElapsedMs: performance.now() - requested,
    };
  };
  const stop = (reason) => {
    if (stopPromise) return stopPromise;
    report.stopReason = reason;
    if (report.traceRequestStartedMs !== undefined)
      report.stopRequestedElapsedMs = performance.now() - report.traceRequestStartedMs;
    stopPromise = (async () => {
      if (!startRequested) return;
      try {
        await send('Tracing.end');
      } catch (error) {
        fail(error);
      }
      // Completion may arrive despite a rejected or timed-out end command.
      try {
        const value = completion ?? (await bounded(() => complete, 'Tracing.tracingComplete'));
        assert(typeof stream === 'string' && stream.length > 0, 'Trace stream unavailable');
        assert(value.traceFormat === undefined || value.traceFormat === 'json');
        assert(value.streamCompression === undefined || value.streamCompression === 'none');
        report.dataLossOccurred = value.dataLossOccurred;
        assert.equal(value.dataLossOccurred, false, 'Trace data loss or missing loss flag');
      } catch (error) {
        fail(error);
        if (!completion || !stream) {
          report.completionUnconfirmed = true;
          void requestOwnerClose('trace-completion-unconfirmed');
        }
      }
    })();
    return stopPromise;
  };
  return {
    report,
    async start() {
      assert.equal(report.status, 'not-started');
      try {
        try {
          await access(file);
          throw new Error('Refusing to overwrite frame trace');
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
        const available = await send('Tracing.getCategories');
        assert(Array.isArray(available.categories));
        for (const category of categories)
          assert(
            available.categories.includes(category),
            'Required trace category unavailable: ' + category,
          );
        cdp.on('Tracing.tracingComplete', completeHandler);
        cdp.on('Tracing.bufferUsage', usageHandler);
        report.traceRequestStartedMs = performance.now();
        startRequested = true;
        // Arm at the request boundary, not at the potentially delayed reply.
        timer = setTimeout(() => {
          report.limitReached = true;
          fail(new Error('Frame trace duration limit reached before confirmed stop'));
          void stop('trace-duration-limit').catch(fail);
          void requestOwnerClose('trace-duration-limit');
        }, FRAME_TRACE_LIMITS.maximumMs);
        timer.unref?.();
        const startOperation = cdp.send('Tracing.start', {
          transferMode: 'ReturnAsStream',
          streamFormat: 'json',
          streamCompression: 'none',
          bufferUsageReportingInterval: 1000,
          traceConfig: {
            recordMode: 'recordUntilFull',
            traceBufferSizeInKb: FRAME_TRACE_LIMITS.bufferKiB,
            enableSampling: false,
            enableSystrace: false,
            includedCategories: [...categories],
            excludedCategories: ['*'],
          },
        });
        void startOperation.then(
          () => {
            report.startAcknowledged = true;
            if (report.startOutcomeUnknown || stopPromise) {
              fail(
                new Error('Tracing.start acknowledged after setup had already failed or stopped'),
              );
              void requestOwnerClose('late-start-acknowledgement');
            }
          },
          () => {},
        );
        await bounded(() => startOperation, 'Tracing.start');
        assert(!stopPromise && !report.failure, 'Trace start completed after its owned window');
        started = true;
        report.status = 'recording';
        await anchor('start');
      } catch (error) {
        fail(error);
        if (startRequested && !started) {
          report.startOutcomeUnknown = true;
          void requestOwnerClose('trace-start-unconfirmed');
        }
        await stop('setup-failure');
        throw error;
      }
    },
    afterDirectionThree() {
      if (endPromise) return;
      assert(started, 'Frame trace was not started');
      // Deliberately not awaited by the action loop; no extra active-action wait.
      endPromise = anchor('end')
        .catch(fail)
        .then(() => stop('safe-border-direction-3'));
      void endPromise.catch(fail);
    },
    finish(reason = 'actions-ended') {
      if (finishPromise) return finishPromise;
      finishPromise = (async () => {
        const chunks = [];
        let total = 0;
        try {
          if (endPromise) await endPromise;
          else await stop(reason);
          if (stream) {
            for (let reads = 0; ; reads++) {
              assert(
                reads < FRAME_TRACE_LIMITS.maximumReads,
                'Trace stream read count exceeded bound',
              );
              const part = await send('IO.read', {
                handle: stream,
                size: FRAME_TRACE_LIMITS.chunkBytes,
              });
              assert(typeof part.data === 'string' && typeof part.eof === 'boolean');
              assert(part.base64Encoded === undefined || typeof part.base64Encoded === 'boolean');
              if (part.base64Encoded)
                assert(
                  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
                    part.data,
                  ),
                  'Invalid base64 trace chunk',
                );
              const chunk = Buffer.from(part.data, part.base64Encoded ? 'base64' : 'utf8');
              assert(
                chunk.length <= FRAME_TRACE_LIMITS.chunkBytes,
                'Trace chunk exceeded requested bound',
              );
              assert(
                total + chunk.length <= FRAME_TRACE_LIMITS.maximumBytes,
                'Trace exceeds 64 MiB evidence bound',
              );
              if (chunk.length) {
                chunks.push(chunk);
                total += chunk.length;
              }
              assert(chunk.length || part.eof, 'Empty nonfinal trace chunk');
              if (part.eof) {
                report.streamEOF = true;
                break;
              }
            }
          }
        } catch (error) {
          fail(error);
        } finally {
          clearTimeout(timer);
          if (stream)
            try {
              await send('IO.close', { handle: stream });
              report.streamClosed = true;
            } catch (error) {
              fail(error);
              report.streamCloseFailure = String(error.message).slice(0, 4096);
            }
          cdp.off('Tracing.tracingComplete', completeHandler);
          cdp.off('Tracing.bufferUsage', usageHandler);
          try {
            await bounded(() => cdp.detach(), 'CDP.detach', true);
            report.cdpDetached = true;
          } catch (error) {
            fail(error);
            report.detachFailure = String(error.message).slice(0, 4096);
          }
        }
        if (closeOwnerPromise) await closeOwnerPromise;
        if (total) {
          const bytes = Buffer.concat(chunks, total);
          try {
            await writeFile(file, bytes, { flag: 'wx' });
            report.bytes = total;
            report.sha256 = createHash('sha256').update(bytes).digest('hex');
            report.inspection = inspectFrameTrace(bytes, report.anchors);
          } catch (error) {
            fail(error);
          }
        }
        if (
          !report.failure &&
          report.streamEOF &&
          report.streamClosed &&
          report.inspection &&
          !report.limitReached &&
          report.stopRequestedElapsedMs <= FRAME_TRACE_LIMITS.maximumMs &&
          !report.bufferFull
        )
          report.status = 'retained';
        else {
          report.status = 'incomplete';
          report.failure ??=
            'Complete bounded start/end trace unavailable; partial bytes retained when available.';
        }
        return report;
      })();
      return finishPromise;
    },
  };
}
