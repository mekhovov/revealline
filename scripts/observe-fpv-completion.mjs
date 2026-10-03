import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { startServer, PREVIEW_SECURITY_HEADERS } from './game-cli.mjs';
import {
  loadFPVObservationArtifact,
  fpvObservationDeadline as deadline,
  closeFPVObservationResources,
} from './fpv-observation-artifact.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHA = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const pin = (name, bytes) => ({ path: name, bytes: bytes.length, sha256: digest(bytes) });
const failure = (error) => String(error?.stack ?? error);
const PREFIX = 'optional-practice/civilian-fpv/';
const TIMELINE = 'toplevel,devtools.timeline,blink.user_timing';
export const FPV_COMPLETION_PROTOCOL = Object.freeze({
  id: 'civilian-fpv-airborne-completion.v1',
  course: 'flight-01',
  mode: 'self-level',
  viewport: Object.freeze({ width: 1440, height: 900 }),
  deviceScaleFactor: 1,
  attempts: 1,
  deadlineMs: 45_000,
  passiveMs: 1000,
  traceBytes: 40 * 1024 * 1024,
  traceDeadlineMs: 15_000,
});

function exact(value, fields, label) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !fields.includes(key)) ||
    fields.some((key) => !Object.hasOwn(value, key))
  )
    throw new Error(`Invalid ${label} fields.`);
}

export function validateFPVCompletionPlan(input) {
  const encoded = typeof input === 'string' ? input : JSON.stringify(input);
  if (typeof encoded !== 'string' || Buffer.byteLength(encoded) > 65536)
    throw new Error('Observation plan exceeds 64 KiB.');
  const plan = JSON.parse(encoded);
  exact(
    plan,
    [
      'format',
      'caseId',
      'protocol',
      'deviceLabel',
      'quietWindow',
      'bundle',
      'envelopeSha256',
      'sourceRevision',
      'sourceTree',
      'packageRevision',
      'trace',
    ],
    'completion plan',
  );
  if (
    plan.format !== 'revealline-fpv-completion-plan.v1' ||
    !/^[a-z0-9-]{1,64}$/.test(plan.caseId) ||
    plan.protocol !== FPV_COMPLETION_PROTOCOL.id ||
    !['none', 'timeline', 'cpu'].includes(plan.trace) ||
    !SHA.test(plan.envelopeSha256) ||
    !SHA.test(plan.packageRevision) ||
    !COMMIT.test(plan.sourceRevision) ||
    !COMMIT.test(plan.sourceTree)
  )
    throw new Error('An exact artifact binding and registered protocol are required.');
  for (const [name, limit] of [
    ['deviceLabel', 256],
    ['quietWindow', 2048],
    ['bundle', 4096],
  ])
    if (typeof plan[name] !== 'string' || !plan[name].trim() || plan[name].length > limit)
      throw new Error(`Invalid ${name}.`);
  return plan;
}

/** Preserve the completion-specific public API while sharing artifact admission. */
export async function loadFPVCompletionArtifact(planInput, options = {}) {
  const { files, binding } = await loadFPVObservationArtifact(
    validateFPVCompletionPlan(planInput),
    options,
  );
  return { files, binding };
}

/** A bounded partial is diagnostic evidence, never a complete JSON trace.
 * Stream errors/timeouts cannot consume or overwrite the functional outcome. */
export async function captureFPVCompletionTrace(
  client,
  save,
  {
    maxBytes = FPV_COMPLETION_PROTOCOL.traceBytes,
    timeoutMs = FPV_COMPLETION_PROTOCOL.traceDeadlineMs,
  } = {},
) {
  if (
    !Number.isSafeInteger(maxBytes) ||
    maxBytes < 1 ||
    maxBytes > FPV_COMPLETION_PROTOCOL.traceBytes ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 60_000
  )
    throw new Error('Invalid trace capture bounds.');
  let stream,
    size = 0,
    onComplete;
  const chunks = [];
  const result = { status: 'failed', qualified: false, maxBytes, timeoutMs, streamClosed: false };
  const expires = Date.now() + timeoutMs;
  const bounded = (promise) =>
    deadline(promise, Math.max(1, expires - Date.now()), 'Trace capture');
  try {
    const complete = new Promise((resolve) => {
      onComplete = resolve;
      client.once('Tracing.tracingComplete', resolve);
    });
    await bounded(client.send('Tracing.end'));
    ({ stream } = await bounded(complete));
    if (typeof stream !== 'string' || !stream) throw new Error('Trace stream is missing.');
    for (;;) {
      const row = await bounded(client.send('IO.read', { handle: stream, size: 65536 }));
      const bytes = Buffer.from(row.data, row.base64Encoded ? 'base64' : 'utf8');
      const remaining = maxBytes - size;
      chunks.push(bytes.subarray(0, remaining));
      size += Math.min(remaining, bytes.length);
      if (bytes.length > remaining) throw new Error('Trace byte limit exceeded.');
      if (row.eof) break;
    }
    result.status = 'complete';
  } catch (error) {
    result.error = failure(error);
  } finally {
    client.removeListener('Tracing.tracingComplete', onComplete);
    if (stream) {
      try {
        await deadline(client.send('IO.close', { handle: stream }), 2000, 'Trace stream close');
        result.streamClosed = true;
      } catch (error) {
        result.closeError = failure(error);
        result.status = 'failed';
      }
    }
  }
  const bytes = Buffer.concat(chunks, size);
  const name = result.status === 'complete' ? 'trace.json' : 'trace.json.partial';
  await save(name, bytes);
  result.file = pin(name, bytes);
  return result;
}

/** Exact top-level task names remain visible; no profiler task is subtracted.
 * These are inclusive renderer intervals, not exclusive reward-work attribution. */
export function analyzeFPVCompletionTrace(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length > FPV_COMPLETION_PROTOCOL.traceBytes)
    throw new Error('Complete trace exceeds its bound.');
  const trace = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (!Array.isArray(trace.traceEvents) || trace.traceEvents.length > 1_000_000)
    throw new Error('Invalid trace event inventory.');
  const names = ['start', 'visible', 'accepted', 'passive-start', 'passive-end', 'end'];
  const marks = {};
  for (const name of names) {
    const rows = trace.traceEvents.filter((event) => event.name === `fpv-completion:${name}`);
    if (rows.length !== 1 || !Number.isFinite(rows[0].ts))
      throw new Error(`Missing or ambiguous ${name} boundary.`);
    marks[name] = rows[0];
  }
  const { pid, tid } = marks.start;
  if (
    !Number.isInteger(pid) ||
    !Number.isInteger(tid) ||
    names.some((name) => marks[name].pid !== pid || marks[name].tid !== tid) ||
    ['visible', 'accepted'].some(
      (name) => marks[name].ts < marks.start.ts || marks[name].ts > marks['passive-start'].ts,
    ) ||
    marks['passive-start'].ts >= marks['passive-end'].ts ||
    marks['passive-end'].ts > marks.end.ts ||
    marks['passive-end'].ts - marks['passive-start'].ts < 990_000 ||
    !trace.traceEvents.some(
      (event) =>
        event.pid === pid &&
        event.tid === tid &&
        event.name === 'thread_name' &&
        event.args?.name === 'CrRendererMain',
    )
  )
    throw new Error('The renderer or ordered passive boundaries cannot be established.');
  const events = trace.traceEvents.filter((event) => event.pid === pid && event.tid === tid);
  const supported = ['RunTask', 'ThreadControllerImpl::RunTask'];
  const taskNames = supported.filter((name) =>
    events.some((event) => event.name === name && event.ph === 'X'),
  );
  if (taskNames.length !== 1)
    throw new Error('Missing or ambiguous complete renderer task family.');
  const tasks = events
    .filter((event) => event.name === taskNames[0] && event.ph === 'X')
    .sort((a, b) => a.ts - b.ts);
  for (let index = 0; index < tasks.length; index++) {
    const task = tasks[index];
    if (
      !Number.isFinite(task.ts) ||
      !Number.isFinite(task.dur) ||
      task.dur < 0 ||
      (index && tasks[index - 1].ts + tasks[index - 1].dur > task.ts)
    )
      throw new Error('Invalid or overlapping top-level task intervals.');
  }
  const windows = {};
  for (const [name, first, last] of [
    ['whole', 'start', 'end'],
    ['completion', 'visible', 'passive-end'],
    ['passive', 'passive-start', 'passive-end'],
  ]) {
    const start = marks[first].ts,
      end = marks[last].ts;
    const selected = tasks.filter((task) => task.ts < end && task.ts + task.dur > start);
    if (!selected.length || end <= start) throw new Error(`No complete task coverage for ${name}.`);
    windows[name] = {
      startUs: start,
      endUs: end,
      tasks: selected.length,
      maximumMs: selected.reduce((highest, task) => Math.max(highest, task.dur / 1000), 0),
      over50: selected
        .filter((task) => task.dur > 50_000)
        .map((task) => ({
          startUs: task.ts,
          durationMs: task.dur / 1000,
          overlapMs: (Math.min(end, task.ts + task.dur) - Math.max(start, task.ts)) / 1000,
          fullyInsideWindow: task.ts >= start && task.ts + task.dur <= end,
        })),
    };
  }
  return {
    status: 'analyzed',
    qualified: false,
    events: trace.traceEvents.length,
    renderer: { pid, tid },
    taskName: taskNames[0],
    windows,
    limitation:
      'Inclusive tasks only. Boundary/startup tasks are retained; no exclusive reward, GPU or universal 50 ms qualification.',
  };
}

/** The functional path is independent of trace success, including tracing.start. */
export async function finishFPVCompletionProcedure({ attempt, passive, trace, functional }) {
  const result = { functionalStatus: 'failed', trace: { status: 'not-started' } };
  let first;
  try {
    result.attempt = await attempt();
    if (!result.attempt.accepted) throw new Error('The single bounded flight did not complete.');
    result.passive = await passive();
  } catch (error) {
    first = error;
    result.failure = failure(error);
  }
  try {
    result.trace = await trace();
  } catch (error) {
    result.trace = { status: 'failed', qualified: false, error: failure(error) };
  }
  if (result.attempt?.accepted) {
    try {
      result.functional = await functional();
      result.functionalStatus = 'complete';
    } catch (error) {
      result.functionalFailure = failure(error);
      first ??= error;
    }
  }
  result.procedureComplete = !first;
  return result;
}

export async function closeFPVCompletionResources(operations) {
  return closeFPVObservationResources(operations);
}

const WRAPPER = String.raw`
import { mountFlightApp } from './app.mjs';
let active = null, raf = null, disposed = false;
const accepted = [];
const app = mountFlightApp({onAttempt: value => {
  accepted.push({at: performance.now(), course: value.course.id, attempt: value.attempt, verification: value.verification});
  performance.mark('fpv-completion:accepted');
}});
const read = () => ({at: performance.now(), visibility: document.visibilityState, focused: document.hasFocus(),
  snapshot: app.snapshot(), complete: !document.getElementById('complete').hidden});
function frame(now) {
  if (disposed) return;
  if (active) {
    const value = read(); active.frames.push({raf: now, ...value});
    if (value.snapshot.status === 'complete' && !active.terminal) {
      active.terminal = value; performance.mark('fpv-completion:visible');
    }
  }
  raf = requestAnimationFrame(frame);
}
const key = event => { if (active) active.keys.push({at: performance.now(), type: event.type, code: event.code, trusted: event.isTrusted}); };
window.addEventListener('keydown', key); window.addEventListener('keyup', key); raf = requestAnimationFrame(frame);
globalThis.fpvObservation = {
  read, resources: () => app.resources(), currentAttempt: () => app.exportAttempt(), settled: () => app.settled(),
  begin() {
    if (active) throw Error('Window already active');
    performance.mark('fpv-completion:start');
    active = {start: performance.now(), frames: [], keys: [], longTasks: [], terminal: null};
    const value = active; value.observer = new PerformanceObserver(list => value.longTasks.push(...list.getEntries().map(({startTime, duration}) => ({startTime, duration}))));
    value.observer.observe({type: 'longtask', buffered: false});
  },
  async passive() {
    await app.settled(); if (accepted.length !== 1) throw Error('Expected one ordinary admitted proof');
    performance.mark('fpv-completion:passive-start'); const start = performance.now();
    await new Promise(resolve => setTimeout(resolve, 1000)); performance.mark('fpv-completion:passive-end');
    return {start, end: performance.now(), state: read()};
  },
  end() {
    if (!active) throw Error('No active window');
    const value = active; active = null;
    value.longTasks.push(...value.observer.takeRecords().map(({startTime, duration}) => ({startTime, duration})));
    value.observer.disconnect(); delete value.observer;
    performance.mark('fpv-completion:end'); value.end = performance.now(); value.final = read();
    value.accepted = structuredClone(accepted); return value;
  },
  dispose() {
    if (!disposed) { disposed = true; cancelAnimationFrame(raf); active?.observer.disconnect(); active = null;
      window.removeEventListener('keydown', key); window.removeEventListener('keyup', key); app.dispose(); }
    return app.resources();
  }
};
`;

export function summarizeFPVCompletionFrames(raw, passive) {
  const pairs = raw.frames.slice(1).map((last, index) => ({
    first: raw.frames[index],
    last,
    delta: last.raf - raw.frames[index].raf,
  }));
  const measure = (rows) => {
    const values = rows.map((item) => item.delta).sort((a, b) => a - b);
    return {
      intervals: values.length,
      p95Ms: values[Math.ceil(values.length * 0.95) - 1] ?? null,
      maximumMs: values.at(-1) ?? null,
    };
  };
  return {
    whole: measure(pairs),
    active: measure(
      pairs.filter(
        ({ first, last }) =>
          first.snapshot.status === 'active' &&
          ['active', 'complete'].includes(last.snapshot.status),
      ),
    ),
    passive: passive
      ? measure(
          pairs.filter(({ first, last }) => first.at >= passive.start && last.at <= passive.end),
        )
      : null,
    allFramesVisible:
      raw.frames.length > 0 && raw.frames.every((item) => item.visibility === 'visible'),
    allFramesFocused: raw.frames.length > 0 && raw.frames.every((item) => item.focused === true),
    maximumHeightMm: raw.frames.reduce(
      (highest, item) => Math.max(highest, item.snapshot.position.y),
      0,
    ),
    trustedKeyboardEvents: raw.keys.length > 0 && raw.keys.every((item) => item.trusted === true),
    longTasks: raw.longTasks,
  };
}

export async function observeFPVCompletion({ planFile, playwrightModule, output }) {
  if (!planFile || !playwrightModule || !output)
    throw new Error('Plan, external Playwright module and new output directory are required.');
  const planBytes = await readFile(planFile);
  const plan = validateFPVCompletionPlan(planBytes.toString());
  await mkdir(output); // No recursive or overwrite: every attempt has its own evidence directory.
  const save = (name, bytes) => writeFile(path.join(output, name), bytes, { flag: 'wx' });
  const json = (name, value) => save(name, JSON.stringify(value, null, 2) + '\n');
  const report = {
    format: 'revealline-fpv-completion-observation.v1',
    qualified: false,
    plan,
    functionalStatus: 'not-started',
    timingStatus: 'not-observed',
    trace: { status: 'not-started' },
    errors: [],
    limits: [
      'One automated desktop Self-level drill using ordinary keyboard controls and read-only snapshots; no engine/progress injection.',
      'Observation and tracing add overhead. No matched 5% regression, cold launch, input-to-photon, physical radio or human-learning qualification.',
      'Inclusive task observations do not attribute exclusive reward, GPU, heap or decoder costs. No universal 50 ms claim.',
    ],
  };
  let work,
    served,
    browser,
    page,
    client,
    tracing = false,
    raw,
    pendingWindow = false;
  try {
    await save('plan.json', planBytes);
    report.instrumentation = [];
    for (const name of [
      'scripts/observe-fpv-completion.mjs',
      'scripts/fpv-observation-artifact.mjs',
      'scripts/game-cli.mjs',
      'publishing/edition-zip.mjs',
      'publishing/optional-package-admission.mjs',
      'publishing/optional-package-policy.mjs',
      'publishing/edition-admission.mjs',
      'game/editions/package-budget.mjs',
    ]) {
      const bytes = await readFile(path.join(ROOT, name));
      report.instrumentation.push(pin(name, bytes));
    }
    const { files, binding } = await loadFPVCompletionArtifact(plan, {
      base: path.dirname(path.resolve(planFile)),
    });
    report.artifact = binding;
    const html = files.get(PREFIX + 'index.html').toString();
    assert.equal((html.match(/data-civilian-fpv="true"/g) ?? []).length, 1);
    assert.equal((html.match(/src="app.mjs"/g) ?? []).length, 1);
    const host = html
      .replace('data-civilian-fpv="true"', 'data-civilian-fpv="false"')
      .replace('src="app.mjs"', 'src="completion-observer.mjs"');
    const instrumentation = new Map([
      [PREFIX + 'completion-observer.html', Buffer.from(host)],
      [PREFIX + 'completion-observer.mjs', Buffer.from(WRAPPER)],
    ]);
    assert([...instrumentation.keys()].every((name) => !files.has(name)));
    await save('host.html', Buffer.from(host));
    await save('wrapper.mjs', Buffer.from(WRAPPER));
    report.instrumentation.push(
      pin('host.html', Buffer.from(host)),
      pin('wrapper.mjs', Buffer.from(WRAPPER)),
    );
    work = await mkdtemp(path.join(tmpdir(), 'fpv-completion-'));
    for (const [name, bytes] of [...files, ...instrumentation]) {
      const target = path.join(work, name);
      assert(target.startsWith(work + path.sep));
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, bytes, { flag: 'wx' });
    }
    await writeFile(
      path.join(work, '.xonix-build.json'),
      JSON.stringify({ tool: 'xonix-game-cli', formatVersion: 1 }),
    );
    served = await startServer({ root: work, port: 0 });
    report.servedMembers = [];
    for (const [name, bytes] of files) {
      const response = await fetch(new URL(name, served.url));
      const actual = Buffer.from(await response.arrayBuffer());
      assert(response.ok);
      assert.equal(digest(actual), digest(bytes));
      report.servedMembers.push(pin(name, actual));
    }
    const { chromium } = await import(pathToFileURL(path.resolve(playwrightModule)).href);
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext({
      viewport: FPV_COMPLETION_PROTOCOL.viewport,
      deviceScaleFactor: 1,
    });
    page = await context.newPage();
    page.setDefaultTimeout(10_000);
    page.on('pageerror', (error) => report.errors.push(failure(error)));
    const response = await page.goto(new URL(PREFIX + 'completion-observer.html', served.url).href);
    report.headers = await response.allHeaders();
    for (const [key, value] of Object.entries(PREVIEW_SECURITY_HEADERS))
      assert.equal(report.headers[key.toLowerCase()], value);
    report.serverPolicy =
      'Existing packaged-preview headers, including its explicit soundtrack origins; not a deployed public origin.';
    await page.waitForFunction(() => globalThis.fpvObservation);
    await page.evaluate(() => globalThis.fpvObservation.settled());
    report.browser = {
      version: browser.version(),
      viewport: FPV_COMPLETION_PROTOCOL.viewport,
      deviceScaleFactor: 1,
      headless: true,
    };
    const initial = await page.evaluate(() => ({
      attempt: globalThis.fpvObservation.currentAttempt(),
      state: globalThis.fpvObservation.read(),
    }));
    assert.equal(initial.attempt.course, 'flight-01');
    assert.equal(initial.attempt.mode, 'self-level');
    assert.equal(initial.attempt.frames.length, 0);
    assert.equal(initial.state.snapshot.status, 'disarmed');
    client = await context.newCDPSession(page);
    if (plan.trace !== 'none') {
      report.traceCategories = (
        plan.trace === 'cpu' ? `${TIMELINE},disabled-by-default-v8.cpu_profiler` : TIMELINE
      ).split(',');
      try {
        await client.send('Tracing.start', {
          categories: report.traceCategories.join(','),
          transferMode: 'ReturnAsStream',
        });
        tracing = true;
      } catch (error) {
        report.trace = { status: 'start-failed', qualified: false, error: failure(error) };
      }
    }
    const exportProof = async () => {
      await page.locator('#notebook-button').click();
      await page.evaluate(() => globalThis.fpvObservation.settled());
      await page
        .getByRole('button', { name: 'Export verified flight proofs', exact: true })
        .click();
      const value = await page
        .getByRole('textbox', { name: 'Flight proof backup JSON', exact: true })
        .inputValue();
      await page.locator('[data-close="notebook-dialog"]').click();
      return value;
    };
    const procedure = await finishFPVCompletionProcedure({
      attempt: async () => {
        await page.evaluate(() => globalThis.fpvObservation.begin());
        pendingWindow = true;
        await page.locator('#arm').click();
        await page.locator('#flight-canvas').click();
        let held = null;
        try {
          const until = Date.now() + FPV_COMPLETION_PROTOCOL.deadlineMs;
          while (Date.now() < until) {
            const { snapshot: state } = await page.evaluate(() => globalThis.fpvObservation.read());
            if (state.status !== 'active') break;
            const height = state.position.y / 1000,
              velocity = state.velocity.y / 1000;
            const desiredVelocity = Math.max(
              -0.5,
              Math.min(0.9, ((state.step === 0 ? 1.8 : 0) - height) * 1.4),
            );
            const throttle =
              state.step > 0 && height < 0.08
                ? 0
                : Math.max(0.2, Math.min(0.75, 0.5 + (desiredVelocity - velocity) * 0.18));
            const current = state.lastInput.throttle / 1000;
            const next =
              current < throttle - 0.012
                ? 'ArrowUp'
                : current > throttle + 0.012
                  ? 'ArrowDown'
                  : null;
            if (next !== held) {
              if (held) await page.keyboard.up(held);
              held = next;
              if (held) await page.keyboard.down(held);
            }
            await page.waitForTimeout(80);
          }
        } finally {
          if (held) await page.keyboard.up(held);
        }
        const terminal = await page.evaluate(() => globalThis.fpvObservation.read());
        return { accepted: terminal.snapshot.status === 'complete', terminal };
      },
      passive: () => page.evaluate(() => globalThis.fpvObservation.passive()),
      trace: async () => {
        if (pendingWindow) {
          raw = await page.evaluate(() => globalThis.fpvObservation.end());
          pendingWindow = false;
          await json('attempt-raw.json', raw);
          report.raw = pin('attempt-raw.json', Buffer.from(JSON.stringify(raw, null, 2) + '\n'));
        }
        if (!tracing)
          return report.trace.status === 'start-failed'
            ? report.trace
            : { status: 'not-requested', qualified: false };
        tracing = false;
        return captureFPVCompletionTrace(client, save);
      },
      functional: async () => {
        const proof = await exportProof(),
          parsed = JSON.parse(proof);
        assert.equal(parsed.attempts.length, 1);
        assert.equal(parsed.attempts[0].session, 'practice');
        assert.equal(parsed.attempts[0].course, 'flight-01');
        await save('proof-backup.json', proof);
        await page.locator('#retry').click();
        const retry = await page.evaluate(() => ({
          state: globalThis.fpvObservation.read(),
          attempt: globalThis.fpvObservation.currentAttempt(),
        }));
        assert.equal(retry.state.snapshot.status, 'disarmed');
        assert.equal(retry.state.snapshot.ticks, 0);
        assert.equal(retry.attempt.course, 'flight-01');
        assert.equal(retry.attempt.frames.length, 0);
        const afterRetry = await exportProof();
        assert.equal(digest(afterRetry), digest(proof));
        await page.reload();
        await page.waitForFunction(() => globalThis.fpvObservation);
        await page.evaluate(() => globalThis.fpvObservation.settled());
        const afterReload = await exportProof();
        assert.equal(digest(afterReload), digest(proof));
        return {
          proof: pin('proof-backup.json', Buffer.from(proof)),
          proofs: 1,
          retry: {
            course: retry.attempt.course,
            status: retry.state.snapshot.status,
            ticks: retry.state.snapshot.ticks,
            frames: retry.attempt.frames.length,
          },
          proofUnchangedAfterRetry: true,
          proofUnchangedAfterReload: true,
        };
      },
    });
    Object.assign(report, procedure);
    if (raw) {
      report.timing = summarizeFPVCompletionFrames(raw, report.passive);
      report.timingStatus =
        report.passive &&
        report.passive.end - report.passive.start >= 990 &&
        report.timing.passive.intervals > 0 &&
        report.timing.allFramesVisible &&
        report.timing.allFramesFocused &&
        report.timing.trustedKeyboardEvents &&
        report.timing.maximumHeightMm > 1200 &&
        raw.accepted.length === 1 &&
        raw.accepted[0].verification.saved === true
          ? 'observed'
          : 'incomplete';
    }
    if (report.trace.status === 'complete') {
      try {
        report.traceAnalysis = analyzeFPVCompletionTrace(
          await readFile(path.join(output, report.trace.file.path)),
        );
      } catch (error) {
        report.traceAnalysis = { status: 'unavailable', qualified: false, error: failure(error) };
      }
    }
    assert.equal(report.errors.length, 0, 'Runtime errors were observed.');
  } catch (error) {
    report.failure = failure(error);
    report.procedureComplete = false;
  } finally {
    if (pendingWindow && page) {
      try {
        await json(
          'failed-active-window.json',
          await page.evaluate(() => globalThis.fpvObservation.end()),
        );
      } catch (error) {
        report.rawRecoveryError = failure(error);
      }
    }
    if (tracing) {
      try {
        report.trace = await captureFPVCompletionTrace(client, save);
      } catch (error) {
        report.trace = { status: 'failed', qualified: false, error: failure(error) };
      }
    }
    report.cleanup = await closeFPVCompletionResources([
      ...(page
        ? [
            [
              'input',
              async () => {
                await page.keyboard.up('ArrowUp');
                await page.keyboard.up('ArrowDown');
              },
            ],
            [
              'app',
              async () => {
                report.disposed = await page.evaluate(() => globalThis.fpvObservation?.dispose());
              },
            ],
          ]
        : []),
      ...(browser ? [['browser', () => browser.close()]] : []),
      ...(served
        ? [
            [
              'server',
              () =>
                new Promise((resolve, reject) =>
                  served.server.close((error) => (error ? reject(error) : resolve())),
                ),
            ],
          ]
        : []),
      ...(work ? [['temporary-site', () => rm(work, { recursive: true, force: true })]] : []),
    ]);
    report.completed =
      report.procedureComplete === true && report.cleanup.completed && report.errors.length === 0;
    await json('observation.json', report);
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [planFile, playwrightModule, output, ...extra] = process.argv.slice(2);
  if (extra.length)
    throw new Error(
      'Usage: node scripts/observe-fpv-completion.mjs PLAN PLAYWRIGHT_MODULE NEW_OUTPUT',
    );
  const report = await observeFPVCompletion({ planFile, playwrightModule, output });
  console.log(
    JSON.stringify({
      completed: report.completed,
      functional: report.functionalStatus,
      timing: report.timingStatus,
      trace: report.trace.status,
      qualified: false,
    }),
  );
  if (
    !report.completed ||
    report.timingStatus !== 'observed' ||
    (report.plan.trace !== 'none' &&
      (report.trace.status !== 'complete' || report.traceAnalysis?.status !== 'analyzed'))
  )
    process.exitCode = 1;
}
