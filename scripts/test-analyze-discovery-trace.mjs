import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { analyzeDiscoveryTrace, runDiscoveryTraceAnalysis } from './analyze-discovery-trace.mjs';

// These small synthetic traces prove parser/attribution boundaries, never device performance.
const event = (name, ts, extra = {}) => ({ name, ts, pid: 7, tid: 9, ph: 'X', ...extra });
const marker = (name, ts, extra = {}) =>
  event(name, ts, { ph: 'I', cat: 'blink.user_timing', ...extra });
const renderer = (pid = 7, tid = 9) =>
  event('thread_name', 0, { ph: 'M', pid, tid, args: { name: 'CrRendererMain' } });
const counter = (ts, nodes, heap = 500) =>
  event('UpdateCounters', ts, {
    ph: 'I',
    args: { data: { documents: 2, nodes, jsEventListeners: 10, jsHeapSizeUsed: heap } },
  });
const callback = (ts, dur, path = 'game/ui/edition-rewards.mjs') =>
  event('FunctionCall', ts, {
    dur,
    args: {
      data: {
        functionName: 'renderResult',
        url: `http://127.0.0.1:9999/frozen/${path}?sensitive=omit`,
        lineNumber: 507,
      },
    },
  });
const fixture = () => ({
  traceEvents: [
    renderer(),
    event('RunTask', 0, { dur: 100_000 }),
    event('CpuProfiler::StartProfiling', 1000, { dur: 90_000 }),
    marker('start', 200_000),
    event('RunTask', 210_000, { dur: 60_000 }),
    callback(212_000, 1000),
    marker('visible', 280_000),
    event('RunTask', 300_000, { dur: 20_000 }),
    callback(301_000, 2000),
    event('RunTask', 340_000, { dur: 50_000 }),
    marker('end', 400_000),
    event('Profile', 100_000, { ph: 'P', id: 'profile1', args: { data: { startTime: 100_000 } } }),
    event('ProfileChunk', 350_000, {
      ph: 'P',
      tid: 88,
      id: 'profile1',
      args: {
        data: {
          cpuProfile: {
            nodes: [
              { id: 1, callFrame: { functionName: '(root)' } },
              {
                id: 2,
                parent: 1,
                callFrame: {
                  functionName: 'renderResult',
                  url: 'http://localhost/frozen/game/ui/edition-rewards.mjs',
                  lineNumber: 506,
                },
              },
              {
                id: 3,
                parent: 2,
                callFrame: {
                  functionName: 'validate',
                  url: 'http://localhost/frozen/game/editions/model.mjs',
                  lineNumber: 20,
                },
              },
              {
                id: 4,
                parent: 1,
                callFrame: {
                  functionName: 'engine',
                  url: 'http://localhost/game/engine/step.mjs',
                  lineNumber: 1,
                },
              },
            ],
            samples: [3, 4, 2],
          },
          timeDeltas: [115_000, 10_000, 77_000],
        },
      },
    }),
    counter(190_000, 100),
    marker('closed:0', 195_000),
    counter(390_000, 110, 450),
    marker('closed:1', 395_000),
  ],
});
const options = () => ({ window: { start: 'start', end: 'end' }, checkpointMarkers: ['visible'] });
const analyze = (value = fixture(), config = options()) =>
  analyzeDiscoveryTrace(JSON.stringify(value), config);

test('inclusive reward tasks and sampled ancestors retain exact locations without claiming exclusive cost', () => {
  const source = JSON.stringify(fixture());
  const result = analyzeDiscoveryTrace(source, options());
  assert.equal(result.qualified, false);
  assert.equal(result.trace.sha256, createHash('sha256').update(source).digest('hex'));
  assert.equal(result.tasks.selectedCount, 3);
  assert.equal(result.tasks.overThreshold.length, 1); // Exactly 50 ms is not >50 ms.
  assert.equal(result.tasks.withRewardEvidence.length, 2);
  const task = result.tasks.overThreshold[0];
  assert.equal(task.durationMs, 60);
  assert.equal(task.rewardCallbacks[0].durationMs, 1);
  assert.equal(task.rewardCallbacks[0].reportedLineNumber, 507);
  assert.equal(task.cpuSamples, 2);
  assert.equal(task.rewardStackSamples, 1);
  assert.deepEqual(
    task.rewardSampledStacks[0].stack.map((row) => row.functionName),
    ['validate', 'renderResult', '(root)'],
  );
  assert.equal(task.rewardSampledStacks[0].stack[1].line1, 507);
  assert.equal(result.tasks.observation, 'over-threshold-task-with-reward-evidence');
  assert.equal(result.cpuProfiles.profileCount, 1); // ProfileChunk has a different tid.
  assert.equal(result.tasks.profilerStartupTasks.length, 1);
  assert.equal(result.tasks.profilerStartupTasks[0].durationMs, 100);
  assert.equal(result.tasks.profilerStartupTasks[0].overlapsWindow, false);
  assert.match(result.limitations[0], /not an exclusive/);
  assert.equal(JSON.stringify(result).includes('sensitive'), false);
  assert.equal(JSON.stringify(result).includes('http://'), false);
});

test('ambiguous renderers need exact named pid/tid rather than taking the first process', () => {
  const value = fixture();
  value.traceEvents.unshift(renderer(8, 10));
  assert.throws(() => analyze(value), /ambiguous/);
  assert.deepEqual(analyze(value, { ...options(), renderer: { pid: 7, tid: 9 } }).renderer, {
    pid: 7,
    tid: 9,
  });
  assert.throws(() => analyze(value, { renderer: { pid: 7, tid: 88 } }), /not named/);
});

test('claimed marks must be unique, ordered and on the selected thread', () => {
  for (const alter of [
    (events) =>
      events.splice(
        events.findIndex((row) => row.name === 'end'),
        1,
      ),
    (events) => events.push(marker('start', 205_000)),
    (events) => {
      events.find((row) => row.name === 'end').ts = 199_000;
    },
    (events) => {
      events.find((row) => row.name === 'end').tid = 88;
    },
    (events) => {
      events.find((row) => row.name === 'visible').ts = 401_000;
    },
  ]) {
    const value = fixture();
    alter(value.traceEvents);
    assert.throws(() => analyze(value), /mark|checkpoint/);
  }
  const report = analyze(fixture(), {});
  assert.equal(report.window.explicit, false);
  assert.equal(report.window.start.ts, 0);
});

test('partial-window tasks keep full inclusive duration and mixed startup classification', () => {
  const value = fixture();
  value.traceEvents.find((row) => row.name === 'start').ts = 215_000;
  value.traceEvents.push(event('CpuProfiler::StartProfiling', 220_000, { dur: 1000 }));
  const report = analyze(value);
  assert.equal(report.tasks.overThreshold[0].durationMs, 60);
  assert.equal(report.tasks.overThreshold[0].fullyInsideWindow, false);
  assert.equal(
    report.tasks.overThreshold[0].classification,
    'contains-profiler-startup-possibly-mixed',
  );
  assert.equal(report.tasks.rewardEvidenceOverThresholdCountExcludingProfilerStartup, 0);
  assert.equal(report.tasks.profilerStartupTasks.length, 2);
});

test('resource-only trace remains usable without sampled CPU attribution', () => {
  const value = fixture();
  value.traceEvents = value.traceEvents.filter(
    (row) => !['Profile', 'ProfileChunk', 'FunctionCall'].includes(row.name),
  );
  const report = analyze(value, { ...options(), closedCycleMarkers: ['closed:0', 'closed:1'] });
  assert.equal(report.cpuProfiles.available, false);
  assert.equal(report.tasks.observation, 'no-reward-evidence-identified');
  assert.equal(report.tasks.overThreshold.length, 1); // Unattributed long work is still reported.
  assert.deepEqual(report.counters.trends.nodes, {
    available: true,
    first: 100,
    last: 110,
    delta: 10,
    min: 100,
    max: 110,
  });
  assert.deepEqual(report.counters.trends.jsHeapSizeUsed, {
    available: true,
    first: 500,
    last: 450,
    delta: -50,
    min: 450,
    max: 500,
  });
  assert.equal(report.counters.snapshots[1].ageMs, 5);
  assert.equal(report.counters.gcControlled, false);
  assert.equal(report.counters.retainingPathsMeasured, false);
  assert.equal(report.counters.nativeMediaDecodersMeasured, false);
  assert.equal(report.counters.retentionQualified, false);
});

test('a mixed profiler-startup task with a long reward callback never produces a negative finding', () => {
  const report = analyze(
    {
      traceEvents: [
        renderer(),
        event('RunTask', 1000, { dur: 100_000 }),
        event('CpuProfiler::StartProfiling', 2000, { dur: 1000 }),
        callback(10_000, 70_000),
      ],
    },
    {},
  );
  assert.equal(report.tasks.overThreshold[0].rewardCallbacks[0].durationMs, 70);
  assert.equal(report.tasks.rewardEvidenceOverThresholdCount, 1);
  assert.equal(report.tasks.rewardEvidenceOverThresholdCountExcludingProfilerStartup, 0);
  assert.equal(report.tasks.profilerStartupTasks.length, 1);
  assert.equal(report.tasks.observation, 'over-threshold-task-with-reward-evidence');
  assert.equal(report.qualified, false);
});

test('closed marks cannot silently reuse stale or missing counters, reverse time, or duplicate names', () => {
  const config = { ...options(), closedCycleMarkers: ['closed:0', 'closed:1'] };
  assert.throws(() => analyze(fixture(), { ...config, counterMaxAgeMs: 1 }), /no fresh/);
  assert.throws(
    () => analyze(fixture(), { ...config, closedCycleMarkers: ['closed:1', 'closed:0'] }),
    /increasing/,
  );
  assert.throws(
    () => analyze(fixture(), { ...config, closedCycleMarkers: ['closed:0', 'closed:0'] }),
    /duplicates/,
  );
  const value = fixture();
  value.traceEvents = value.traceEvents.filter((row) => row.name !== 'UpdateCounters');
  assert.throws(() => analyze(value, config), /no fresh/);
  const partial = fixture();
  delete partial.traceEvents.find((row) => row.name === 'UpdateCounters').args.data.documents;
  assert.deepEqual(analyze(partial, config).counters.trends.documents, { available: false });
});

test('malformed CPU sample mappings, deltas and parent chains are rejected rather than invented', () => {
  for (const alter of [
    (data) => {
      data.timeDeltas.pop();
    },
    (data) => {
      data.timeDeltas[0] = 'not-a-number';
    },
    (data) => {
      data.timeDeltas[0] = -1;
    }, // Would precede the profile's start.
    (data) => {
      data.cpuProfile.samples[0] = 999;
    },
    (data) => {
      data.cpuProfile.nodes[0].parent = 3;
    },
    (data) => {
      data.cpuProfile.nodes[2].parent = 999;
    },
    (data) => {
      data.cpuProfile.nodes.push(data.cpuProfile.nodes[0]);
    },
  ]) {
    const value = fixture();
    alter(value.traceEvents.find((row) => row.name === 'ProfileChunk').args.data);
    assert.throws(() => analyze(value), /CPU|sample/);
  }
});

test('signed CPU deltas preserve out-of-order sample timestamps without clamping', () => {
  const value = fixture();
  value.traceEvents.find((row) => row.name === 'ProfileChunk').args.data.timeDeltas = [
    115_000, -1000, 88_000,
  ];
  const report = analyze(value);
  assert.equal(report.cpuProfiles.negativeTimeDeltas, 1);
  assert.equal(report.tasks.overThreshold[0].cpuSamples, 2);
  assert.equal(report.tasks.withRewardEvidence[1].cpuSamples, 1);
});

test('bounds and ambiguous containment fail closed; byte/event ceilings can only be lowered', () => {
  assert.throws(() => analyzeDiscoveryTrace('x'), /JSON/);
  assert.throws(() => analyzeDiscoveryTrace(new Uint8Array([255])), /UTF-8/);
  assert.throws(() => analyzeDiscoveryTrace('{}'), /traceEvents/);
  assert.throws(() => analyze(fixture(), { limits: { maxBytes: 100 } }), /byte limit/);
  assert.throws(() => analyze(fixture(), { limits: { maxEvents: 2 } }), /event limit/);
  assert.throws(
    () => analyze(fixture(), { limits: { maxBytes: 200 * 1024 * 1024 } }),
    /hard limit/,
  );
  assert.throws(() => analyze(fixture(), { inventedGate: true }), /unknown/);
  assert.throws(() => analyze(fixture(), { rewardPaths: ['game/../secret.js'] }), /exact game/);
  const value = fixture();
  value.traceEvents.push(event('RunTask', 215_000, { dur: 1000 }));
  assert.throws(() => analyze(value), /overlapping/);
  const broken = fixture();
  broken.traceEvents.find((row) => row.name === 'RunTask').dur = -1;
  assert.throws(() => analyze(broken), /nonnegative/);
});

test('explicit source binding is preserved as caller supplied, never attested by a trace', () => {
  const sourceBinding = {
    sourceRevision: 'a'.repeat(40),
    distributionSha256: 'b'.repeat(64),
    editionId: 'fpv-learning',
  };
  const result = analyze(fixture(), { ...options(), sourceBinding });
  assert.deepEqual(result.sourceBinding, sourceBinding);
  assert.match(result.sourceBindingAuthority, /Caller-supplied/);
  assert.throws(
    () => analyze(fixture(), { sourceBinding: { ...sourceBinding, distributionSha256: 'short' } }),
    /distributionSha256/,
  );
});

test('CLI writes a new report only; refusal preserves both prior report and trace', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'discovery-trace-test-'));
  try {
    const tracePath = join(dir, 'trace.json'),
      optionsPath = join(dir, 'options.json'),
      outputPath = join(dir, 'report.json');
    const source = JSON.stringify(fixture());
    await writeFile(tracePath, source);
    await writeFile(optionsPath, JSON.stringify(options()));
    const args = ['--trace', tracePath, '--options', optionsPath, '--out', outputPath];
    const result = await runDiscoveryTraceAnalysis(args);
    assert.equal(result.qualified, false);
    const output = await readFile(outputPath, 'utf8');
    assert.equal(
      JSON.parse(output).trace.sha256,
      createHash('sha256').update(source).digest('hex'),
    );
    await assert.rejects(runDiscoveryTraceAnalysis(args), { code: 'EEXIST' });
    await assert.rejects(runDiscoveryTraceAnalysis([...args, '--trace', tracePath]), /duplicate/);
    await assert.rejects(
      runDiscoveryTraceAnalysis([
        '--trace',
        tracePath,
        '--options',
        optionsPath,
        '--out',
        tracePath,
      ]),
      /must differ/,
    );
    assert.equal(await readFile(outputPath, 'utf8'), output);
    assert.equal(await readFile(tracePath, 'utf8'), source);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
