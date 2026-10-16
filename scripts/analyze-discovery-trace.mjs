import { createHash } from 'node:crypto';
import { open, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// An offline diagnostic, not a release gate or a browser-control interface.
export const DISCOVERY_TRACE_LIMITS = Object.freeze({
  maxBytes: 128 * 1024 * 1024,
  maxEvents: 1_000_000,
  maxProfileNodes: 200_000,
  maxSamples: 1_000_000,
  maxReportBytes: 16 * 1024 * 1024,
});
export const DEFAULT_REWARD_TRACE_PATHS = Object.freeze([
  'game/ui/edition-rewards.mjs',
  'game/ui/earned-result-layout.mjs',
  'game/rewards/store.mjs',
  'game/rewards/model.mjs',
  'game/ui/reward-media.mjs',
  'game/ui/reward-image.mjs',
]);
const COUNTERS = ['documents', 'nodes', 'jsEventListeners', 'jsHeapSizeUsed'];
const fail = (message) => {
  throw new Error(`Discovery trace: ${message}`);
};
function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail(`${label} must be an object`);
  return value;
}
function keys(value, allowed, label) {
  record(value, label);
  for (const key of Object.keys(value))
    if (!allowed.includes(key)) fail(`${label} has unknown field ${key}`);
}
function text(value, label, max = 256) {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    fail(`${label} must be nonempty text of at most ${max} characters`);
  return value;
}
function number(value, label, integer = false) {
  if (!Number.isFinite(value) || value < 0 || (integer && !Number.isSafeInteger(value)))
    fail(`${label} must be a nonnegative ${integer ? 'safe integer' : 'finite number'}`);
  return value;
}
function time(event, duration = false) {
  number(event.ts, `${event.name}.ts`);
  if (duration) {
    number(event.dur, `${event.name}.dur`);
    number(event.ts + event.dur, `${event.name} end`);
  }
  return event.ts;
}
function namedList(value, label, maximum = 65) {
  if (!Array.isArray(value) || value.length > maximum) fail(`${label} must be a bounded array`);
  value.forEach((name) => text(name, label));
  if (new Set(value).size !== value.length) fail(`${label} contains duplicates`);
  return value;
}
function optionsFor(value) {
  keys(
    value,
    [
      'renderer',
      'window',
      'checkpointMarkers',
      'closedCycleMarkers',
      'counterMaxAgeMs',
      'sourceBinding',
      'rewardPaths',
      'limits',
    ],
    'options',
  );
  const result = { ...value };
  if (value.renderer) {
    keys(value.renderer, ['pid', 'tid'], 'renderer');
    number(value.renderer.pid, 'renderer.pid', true);
    number(value.renderer.tid, 'renderer.tid', true);
  }
  if (value.window) {
    keys(value.window, ['start', 'end'], 'window');
    text(value.window.start, 'window.start');
    text(value.window.end, 'window.end');
    if (value.window.start === value.window.end) fail('window marks must differ');
  }
  result.checkpointMarkers = namedList(value.checkpointMarkers ?? [], 'checkpointMarkers');
  result.closedCycleMarkers = namedList(value.closedCycleMarkers ?? [], 'closedCycleMarkers');
  if (result.closedCycleMarkers.length === 1)
    fail('closedCycleMarkers needs baseline and at least one close');
  result.counterMaxAgeMs = value.counterMaxAgeMs ?? 1000;
  number(result.counterMaxAgeMs, 'counterMaxAgeMs');
  if (result.counterMaxAgeMs > 10_000) fail('counterMaxAgeMs exceeds 10000');
  if (value.sourceBinding) {
    keys(
      value.sourceBinding,
      ['sourceRevision', 'distributionSha256', 'editionId'],
      'sourceBinding',
    );
    if (!/^[a-f0-9]{40}$/.test(value.sourceBinding.sourceRevision ?? ''))
      fail('invalid sourceRevision');
    if (!/^[a-f0-9]{64}$/.test(value.sourceBinding.distributionSha256 ?? ''))
      fail('invalid distributionSha256');
    text(value.sourceBinding.editionId, 'editionId', 128);
  }
  result.rewardPaths = namedList(
    value.rewardPaths ?? DEFAULT_REWARD_TRACE_PATHS,
    'rewardPaths',
    16,
  );
  if (!result.rewardPaths.length) fail('rewardPaths must not be empty');
  for (const path of result.rewardPaths)
    if (!/^game\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.m?js$/.test(path) || path.includes('..'))
      fail('rewardPaths must be exact game module paths');
  keys(value.limits ?? {}, ['maxBytes', 'maxEvents'], 'limits');
  result.limits = { ...DISCOVERY_TRACE_LIMITS, ...value.limits };
  for (const key of ['maxBytes', 'maxEvents']) {
    number(result.limits[key], key, true);
    if (!result.limits[key] || result.limits[key] > DISCOVERY_TRACE_LIMITS[key])
      fail(`${key} may only lower the hard limit`);
  }
  return result;
}
function modulePath(url) {
  if (url === undefined || url === '') return null;
  text(url, 'frame URL', 16_384);
  let pathname;
  try {
    pathname = new URL(url, 'https://trace.invalid/').pathname;
  } catch {
    fail('malformed frame URL');
  }
  const at = pathname.indexOf('/game/');
  return at < 0 ? null : pathname.slice(at + 1);
}
function frameData(frame, cpu) {
  record(frame, 'call frame');
  const functionName = frame.functionName ?? '';
  if (typeof functionName !== 'string' || functionName.length > 1024)
    fail('invalid frame function name');
  const result = { functionName, path: modulePath(frame.url) };
  if (frame.lineNumber !== undefined) {
    if (!Number.isSafeInteger(frame.lineNumber) || frame.lineNumber < -1)
      fail('invalid frame line number');
    // CPU locations are zero-based. Timeline FunctionCall locations are preserved verbatim.
    result[cpu ? 'line1' : 'reportedLineNumber'] = cpu ? frame.lineNumber + 1 : frame.lineNumber;
  }
  return result;
}
function contains(task, at, end = at) {
  return task.ts <= at && end <= task.ts + task.dur;
}
function taskAt(tasks, at, end = at) {
  let low = 0,
    high = tasks.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (tasks[mid].ts <= at) low = mid + 1;
    else high = mid;
  }
  const task = tasks[low - 1];
  return task && contains(task, at, end) ? task : null;
}
function exactMarker(events, name) {
  const found = events.filter(
    (event) =>
      event.name === name &&
      typeof event.cat === 'string' &&
      event.cat.split(',').includes('blink.user_timing') &&
      ['I', 'i', 'R'].includes(event.ph),
  );
  if (found.length !== 1)
    fail(`mark ${name} must occur exactly once on the selected renderer (found ${found.length})`);
  return { name, ts: time(found[0]) };
}

function collectProfiles(events, renderer, tasks, rewardPaths) {
  const starts = events.filter(
    (event) => event.name === 'Profile' && event.pid === renderer.pid && event.tid === renderer.tid,
  );
  const profiles = new Map();
  let nodeCount = 0,
    sampleCount = 0,
    uncontainedSamples = 0,
    negativeTimeDeltas = 0;
  for (const start of starts) {
    if (!['string', 'number'].includes(typeof start.id)) fail('Profile needs an id');
    const id = String(start.id);
    if (profiles.has(id)) fail('duplicate CPU Profile id');
    const startTime = number(start.args?.data?.startTime, 'Profile.startTime');
    profiles.set(id, { startTime, nodes: new Map(), chunks: [], cache: new Map() });
  }
  // ProfileChunk is emitted from the profiler thread, not CrRendererMain. Associate by process/id.
  for (const event of events) {
    if (event.name !== 'ProfileChunk' || event.pid !== renderer.pid) continue;
    const profile = profiles.get(String(event.id));
    if (!profile) continue; // Other profiled threads may share this process.
    time(event);
    const data = record(event.args?.data, 'ProfileChunk.data');
    const cpu = record(data.cpuProfile ?? {}, 'ProfileChunk.cpuProfile');
    if (
      !Array.isArray(cpu.nodes ?? []) ||
      !Array.isArray(cpu.samples ?? []) ||
      !Array.isArray(data.timeDeltas ?? [])
    )
      fail('ProfileChunk arrays are malformed');
    const samples = cpu.samples ?? [],
      deltas = data.timeDeltas ?? [];
    if (samples.length !== deltas.length) fail('CPU samples/timeDeltas length mismatch');
    sampleCount += samples.length;
    if (sampleCount > DISCOVERY_TRACE_LIMITS.maxSamples) fail('CPU sample limit exceeded');
    for (const node of cpu.nodes ?? []) {
      record(node, 'CPU node');
      number(node.id, 'CPU node id', true);
      if (!node.id || profile.nodes.has(node.id)) fail('duplicate or zero CPU node id');
      if (node.parent !== undefined) number(node.parent, 'CPU parent', true);
      profile.nodes.set(node.id, { parent: node.parent, frame: frameData(node.callFrame, true) });
      if (++nodeCount > DISCOVERY_TRACE_LIMITS.maxProfileNodes) fail('CPU node limit exceeded');
    }
    profile.chunks.push({ ts: event.ts, samples, deltas });
  }
  for (const profile of profiles.values()) {
    const stackFor = (id) => {
      if (profile.cache.has(id)) return profile.cache.get(id);
      const stack = [],
        seen = new Set();
      let cursor = id;
      while (cursor !== undefined) {
        if (seen.has(cursor)) fail('cyclic CPU parent chain');
        if (stack.length === 128) fail('CPU stack exceeds 128 frames');
        seen.add(cursor);
        const node = profile.nodes.get(cursor);
        if (!node) fail(`missing CPU node ${cursor}`);
        stack.push(node.frame);
        cursor = node.parent;
      }
      const result = { stack, reward: stack.some((frame) => rewardPaths.has(frame.path)) };
      profile.cache.set(id, result);
      return result;
    };
    // Validate even nodes that were not sampled; a broken stack is not partial evidence.
    for (const id of profile.nodes.keys()) stackFor(id);
    let at = profile.startTime;
    for (const chunk of profile.chunks.sort((a, b) => a.ts - b.ts)) {
      for (let index = 0; index < chunk.samples.length; index++) {
        number(chunk.samples[index], 'sample node id', true);
        const delta = chunk.deltas[index];
        // Chrome can emit out-of-order samples. Preserve their signed deltas,
        // reconstruct exact timestamps, and locate each independently (never clamp).
        if (!Number.isSafeInteger(delta)) fail('sample time delta must be a safe integer');
        if (delta < 0) negativeTimeDeltas++;
        at += delta;
        number(at, 'sample time');
        if (at < profile.startTime) fail('sample precedes CPU profile start');
        const basis = stackFor(chunk.samples[index]);
        const task = taskAt(tasks, at);
        if (!task) {
          uncontainedSamples++;
          continue;
        }
        task.sampleCount++;
        if (basis.reward) task.rewardSampleCount++;
        if (basis.reward) {
          const key = JSON.stringify(basis.stack);
          const previous = task.stacks.get(key);
          if (previous) previous.samples++;
          else task.stacks.set(key, { samples: 1, stack: basis.stack });
        }
      }
    }
  }
  return {
    profileCount: profiles.size,
    nodeCount,
    sampleCount,
    uncontainedSamples,
    negativeTimeDeltas,
    available: sampleCount > 0,
  };
}

function counterReport(events, marks, maxAgeMs) {
  const counters = events
    .filter((event) => event.name === 'UpdateCounters')
    .map((event) => {
      const data = record(event.args?.data, 'UpdateCounters.data');
      const values = {};
      for (const key of COUNTERS) {
        if (data[key] !== undefined) values[key] = number(data[key], `UpdateCounters.${key}`, true);
      }
      return { ts: time(event), values };
    })
    .sort((a, b) => a.ts - b.ts);
  const snapshots = marks.map((mark) => {
    let low = 0,
      high = counters.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (counters[mid].ts <= mark.ts) low = mid + 1;
      else high = mid;
    }
    const sample = counters[low - 1];
    if (!sample || mark.ts - sample.ts > maxAgeMs * 1000)
      fail(`no fresh preceding UpdateCounters for ${mark.name}`);
    return { ...mark, counterTs: sample.ts, ageMs: (mark.ts - sample.ts) / 1000, ...sample.values };
  });
  const trends = {};
  for (const key of COUNTERS) {
    const values = snapshots.map((snapshot) => snapshot[key]);
    if (!values.length || values.some((value) => value === undefined)) {
      trends[key] = { available: false };
      continue;
    }
    const first = values[0],
      last = values.at(-1);
    trends[key] = {
      available: true,
      first,
      last,
      delta: last - first,
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }
  return {
    observedCounterEvents: counters.length,
    snapshots,
    trends,
    scope:
      'Selected renderer counters at caller-declared closed-cycle marks; marks do not prove UI actions or collection.',
    gcControlled: false,
    retainingPathsMeasured: false,
    nativeMediaDecodersMeasured: false,
    retentionQualified: false,
  };
}

export function analyzeDiscoveryTrace(input, options = {}) {
  const settings = optionsFor(options);
  if (typeof input !== 'string' && !(input instanceof Uint8Array))
    fail('input must be JSON text or bytes');
  const byteLength = typeof input === 'string' ? Buffer.byteLength(input) : input.byteLength;
  if (byteLength > settings.limits.maxBytes) fail('trace byte limit exceeded');
  const bytes = Buffer.from(input);
  let trace;
  try {
    trace = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    fail('input is not valid UTF-8 JSON');
  }
  record(trace, 'trace');
  if (!Array.isArray(trace.traceEvents) || trace.traceEvents.length > settings.limits.maxEvents)
    fail('traceEvents missing or event limit exceeded');
  const events = trace.traceEvents;
  events.forEach((event) => record(event, 'trace event'));
  const renderers = new Map();
  for (const event of events) {
    if (event.name !== 'thread_name' || event.args?.name !== 'CrRendererMain') continue;
    number(event.pid, 'renderer pid', true);
    number(event.tid, 'renderer tid', true);
    renderers.set(`${event.pid}:${event.tid}`, { pid: event.pid, tid: event.tid });
  }
  let renderer = settings.renderer;
  if (renderer) {
    if (!renderers.has(`${renderer.pid}:${renderer.tid}`))
      fail('explicit renderer is not named CrRendererMain');
  } else {
    if (renderers.size !== 1)
      fail(`renderer is ambiguous or missing (${renderers.size}); specify pid/tid`);
    renderer = [...renderers.values()][0];
  }
  const thread = events.filter((event) => event.pid === renderer.pid && event.tid === renderer.tid);
  const tasks = thread
    .filter((event) => event.name === 'RunTask' && event.ph === 'X')
    .map((event) => {
      time(event, true);
      return {
        ts: event.ts,
        dur: event.dur,
        callbacks: [],
        startup: [],
        stacks: new Map(),
        sampleCount: 0,
        rewardSampleCount: 0,
      };
    })
    .sort((a, b) => a.ts - b.ts);
  if (!tasks.length) fail('selected renderer has no complete RunTask events');
  for (let index = 1; index < tasks.length; index++)
    if (tasks[index - 1].ts + tasks[index - 1].dur > tasks[index].ts)
      fail('overlapping renderer RunTask events prevent unique containment');
  let window;
  if (settings.window) {
    const start = exactMarker(thread, settings.window.start),
      end = exactMarker(thread, settings.window.end);
    if (start.ts >= end.ts) fail('window marks are not in increasing order');
    window = { start, end, explicit: true };
  } else
    window = {
      start: { ts: tasks[0].ts },
      end: { ts: tasks.at(-1).ts + tasks.at(-1).dur },
      explicit: false,
    };
  const checkpoints = settings.checkpointMarkers.map((name) => exactMarker(thread, name));
  for (const mark of checkpoints)
    if (mark.ts < window.start.ts || mark.ts > window.end.ts)
      fail(`checkpoint ${mark.name} is outside measurement window`);
  const closes = settings.closedCycleMarkers.map((name) => exactMarker(thread, name));
  for (let index = 1; index < closes.length; index++)
    if (closes[index - 1].ts >= closes[index].ts)
      fail('closed-cycle marks are not in increasing order');
  const rewardPaths = new Set(settings.rewardPaths);
  let uncontainedRewardCallbacks = 0;
  const orphanStartupEvents = [];
  for (const event of thread) {
    if (event.ph !== 'X' || !['FunctionCall', 'CpuProfiler::StartProfiling'].includes(event.name))
      continue;
    time(event, true);
    const task = taskAt(tasks, event.ts, event.ts + event.dur);
    if (event.name === 'CpuProfiler::StartProfiling') {
      const item = { ts: event.ts, durationMs: event.dur / 1000 };
      if (task) task.startup.push(item);
      else orphanStartupEvents.push(item);
      continue;
    }
    const frame = frameData(event.args?.data, false);
    if (!rewardPaths.has(frame.path)) continue;
    if (task) task.callbacks.push({ ts: event.ts, durationMs: event.dur / 1000, ...frame });
    else uncontainedRewardCallbacks++;
  }
  const cpuProfiles = collectProfiles(events, renderer, tasks, rewardPaths);
  const selected = tasks.filter(
    (task) => task.ts < window.end.ts && task.ts + task.dur > window.start.ts,
  );
  const projectTask = (task) => ({
    ts: task.ts,
    durationMs: task.dur / 1000,
    fullyInsideWindow: task.ts >= window.start.ts && task.ts + task.dur <= window.end.ts,
    overlapsWindow: task.ts < window.end.ts && task.ts + task.dur > window.start.ts,
    classification: task.startup.length
      ? 'contains-profiler-startup-possibly-mixed'
      : 'application-or-browser-task',
    rewardCallbacks: task.callbacks,
    cpuSamples: task.sampleCount,
    rewardStackSamples: task.rewardSampleCount,
    rewardSampledStacks: [...task.stacks.values()]
      .sort((a, b) => b.samples - a.samples)
      .slice(0, 8),
    distinctRewardSampledStacks: task.stacks.size,
    ...(task.startup.length ? { profilerStartupEvents: task.startup } : {}),
  });
  const relevant = (task) => task.callbacks.length > 0 || task.rewardSampleCount > 0;
  const rewardTasks = selected.filter(relevant);
  const overThreshold = selected.filter((task) => task.dur > 50_000);
  const startup = tasks.filter((task) => task.startup.length);
  const rewardOverThreshold = rewardTasks.filter((task) => task.dur > 50_000);
  const rewardOverThresholdWithoutStartup = rewardOverThreshold.filter(
    (task) => !task.startup.length,
  );
  if (overThreshold.length + rewardTasks.length + startup.length > 5000)
    fail('task report row limit exceeded');
  const report = {
    format: 'revealline-discovery-trace-analysis.v1',
    qualified: false,
    trace: {
      bytes: byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      eventCount: events.length,
    },
    renderer,
    sourceBinding: settings.sourceBinding ?? null,
    sourceBindingAuthority:
      'Caller-supplied artifact identity; this analyzer verifies only trace bytes. Preserve the separate artifact and input-protocol receipts.',
    window,
    checkpoints,
    rewardPaths: settings.rewardPaths,
    cpuProfiles,
    uncontainedRewardCallbacks,
    tasks: {
      selectedCount: selected.length,
      thresholdMs: 50,
      maxDurationMs: selected.length
        ? selected.reduce((max, task) => Math.max(max, task.dur), 0) / 1000
        : null,
      overThreshold: overThreshold.map(projectTask),
      withRewardEvidence: rewardTasks.map(projectTask),
      rewardEvidenceOverThresholdCount: rewardOverThreshold.length,
      rewardEvidenceOverThresholdCountExcludingProfilerStartup:
        rewardOverThresholdWithoutStartup.length,
      profilerStartupTasks: startup.map(projectTask),
      orphanProfilerStartupEvents: orphanStartupEvents,
      observation: rewardOverThreshold.length
        ? 'over-threshold-task-with-reward-evidence'
        : rewardTasks.length
          ? 'no-over-threshold-task-with-observed-reward-evidence'
          : 'no-reward-evidence-identified',
    },
    keyEventsInWindow: thread.filter(
      (event) =>
        event.name === 'EventDispatch' &&
        ['keydown', 'keyup'].includes(event.args?.data?.type) &&
        number(event.ts, 'key event time') >= window.start.ts &&
        event.ts <= window.end.ts,
    ).length,
    counters: counterReport(thread, closes, settings.counterMaxAgeMs),
    limitations: [
      'RunTask duration is inclusive main-thread elapsed time, not an exclusive reward-rendering cost.',
      'Callbacks and sampled ancestor stacks locate reward work within a task; other engine, layout, browser and instrumentation work may share that task.',
      'CPU sampling can miss work. No matching stack or callback is not proof of zero cost. Only the listed exact module paths were classified.',
      'Profiler-startup-containing tasks remain visible and may contain application work; they are separated rather than silently removed.',
      'UpdateCounters are renderer-wide observations, not forced-GC heap snapshots, retaining paths, detached-node ownership or native decoder accounting.',
      'Window/cycle marks and source identity require an independent normal-UI/artifact receipt; this report does not qualify gameplay, memory, first-win or release acceptance.',
    ],
  };
  if (Buffer.byteLength(JSON.stringify(report)) > DISCOVERY_TRACE_LIMITS.maxReportBytes)
    fail('report byte limit exceeded');
  return report;
}

export async function runDiscoveryTraceAnalysis(argv) {
  const flags = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index],
      value = argv[index + 1];
    if (
      !['--trace', '--options', '--out'].includes(key) ||
      flags.has(key) ||
      !value ||
      value.startsWith('--')
    )
      fail('use --trace INPUT --options OPTIONS --out NEW_OUTPUT (no duplicate flags)');
    flags.set(key, resolve(value));
  }
  if (flags.size !== 3) fail('--trace, --options and --out are required');
  if (new Set(flags.values()).size !== 3) fail('input/options/output paths must differ');
  const optionsBytes = await readBounded(flags.get('--options'), 64 * 1024, 'options');
  const options = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(optionsBytes));
  const limits = optionsFor(options).limits;
  const report = analyzeDiscoveryTrace(
    await readBounded(flags.get('--trace'), limits.maxBytes, 'trace'),
    options,
  );
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (Buffer.byteLength(serialized) > DISCOVERY_TRACE_LIMITS.maxReportBytes)
    fail('report byte limit exceeded');
  await writeFile(flags.get('--out'), serialized, { flag: 'wx' });
  return {
    output: flags.get('--out'),
    traceSha256: report.trace.sha256,
    qualified: false,
    observation: report.tasks.observation,
  };
}
async function readBounded(path, maxBytes, label) {
  const handle = await open(path, 'r');
  try {
    const metadata = await handle.stat();
    if (!metadata.isFile()) fail(`${label} must be a regular file`);
    if (metadata.size > maxBytes) fail(`${label} byte limit exceeded`);
    // A file growing after stat cannot cause an unbounded read or allocation.
    const chunks = [];
    const buffer = Buffer.alloc(Math.min(64 * 1024, maxBytes + 1));
    let total = 0;
    for (;;) {
      const { bytesRead } = await handle.read(
        buffer,
        0,
        Math.min(buffer.length, maxBytes + 1 - total),
        null,
      );
      if (!bytesRead) break;
      total += bytesRead;
      if (total > maxBytes) fail(`${label} byte limit exceeded`);
      chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
    }
    return Buffer.concat(chunks, total);
  } finally {
    await handle.close();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runDiscoveryTraceAnalysis(process.argv.slice(2))
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
