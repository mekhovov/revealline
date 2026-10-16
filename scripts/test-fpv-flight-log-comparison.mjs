import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  parseFlightCSV,
  readFlightTrace,
  compareFlightLogs,
  exportAdvancedFlightTrace,
} from './fpv-flight-log-comparison.mjs';
import {
  createAdvancedSimulation,
  initAdvancedRuntime,
  replayAdvancedRecording,
} from '../optional-practice/civilian-fpv/advanced-simulation.mjs';
import {
  createRateProfile,
  createRateEvaluator,
} from '../optional-practice/civilian-fpv/rates.mjs';

const axes = ['roll', 'pitch', 'yaw'];
const headers = 'time,rc,rr,pc,pr,yc,yr';
const mapping = () => ({
  label: 'Analytical fixture',
  aircraft: 'Synthetic only',
  kind: 'synthetic',
  time: { column: 'time', unit: 's', offsetSeconds: 0 },
  axes: Object.fromEntries(
    axes.map((axis) => [
      axis,
      {
        command: axis[0] + 'c',
        achieved: axis[0] + 'r',
        unit: 'deg/s',
        sign: 1,
      },
    ]),
  ),
});
const csv = (times = [0, 0.5, 1], command = () => 10, response = () => 10) =>
  headers +
  '\n' +
  times
    .map((time) => [time, ...axes.flatMap(() => [command(time), response(time)])].join(','))
    .join('\n') +
  '\n';
const config = () => ({
  format: 'FPVFlightComparison.v1',
  reference: mapping(),
  candidate: mapping(),
  window: { startSeconds: 0, endSeconds: 1 },
  maximumGapSeconds: 0.5,
  commandToleranceDegPerSec: 0.000001,
});
const close = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('explicit units, axis signs, clock offsets and unequal cadences preserve a known response', () => {
  const reference = csv(
    [0, 0.5, 1],
    () => 90,
    (time) => time * 20,
  );
  const candidate =
    headers +
    '\n' +
    [0, 0.25, 0.5, 0.75, 1]
      .map((time) =>
        [
          (time + 2) * 1000000,
          ...axes.flatMap(() => [-Math.PI / 2, (-time * 20 * Math.PI) / 180]),
        ].join(','),
      )
      .join('\n');
  const options = config();
  options.candidate.time = { column: 'time', unit: 'us', offsetSeconds: -2 };
  for (const channel of Object.values(options.candidate.axes)) {
    channel.unit = 'rad/s';
    channel.sign = -1;
  }
  const result = compareFlightLogs(reference, candidate, options);
  assert.equal(result.comparable, true);
  assert.equal(result.samplesCompared, 5);
  assert.equal(result.effectiveTimeResolutionSeconds, 0.5);
  for (const metric of Object.values(result.metrics)) close(metric.responseRmseDegPerSec, 0);
  assert.equal(result.qualificationGranted, false);
  assert.equal(result.tuneModified, false);
  assert.equal(result.reference.sha256, createHash('sha256').update(reference).digest('hex'));
});

test('response error integrates linear interpolation exactly and does not smear command steps', () => {
  const options = config();
  const reference = csv(
    [0, 0.5, 1],
    () => 0,
    () => 0,
  );
  const ramp = compareFlightLogs(
    reference,
    csv(
      [0, 0.5, 1],
      () => 0,
      (time) => 3 * time,
    ),
    options,
  );
  close(ramp.metrics.roll.responseRmseDegPerSec, Math.sqrt(3));
  assert.equal(ramp.metrics.roll.maximumResponseErrorDegPerSec, 3);
  const constant = compareFlightLogs(
    reference,
    csv(
      [0, 0.5, 1],
      () => 0,
      () => 2,
    ),
    options,
  );
  close(constant.metrics.roll.responseRmseDegPerSec, 2);
  const stepped = csv(
    [0, 0.5, 1],
    (time) => (time >= 0.5 ? 10 : 0),
    () => 0,
  );
  const report = compareFlightLogs(stepped, stepped, options);
  close(report.metrics.roll.referenceTrackingRmseDegPerSec, Math.sqrt(50));
});

test('a brief candidate command pulse between reference samples makes response comparison ineligible', () => {
  const options = config();
  const report = compareFlightLogs(
    csv(),
    csv([0, 0.1, 0.2, 0.5, 1], (t) => (t === 0.1 ? 50 : 10)),
    options,
  );
  assert.equal(report.comparable, false);
  assert.equal(report.status, 'commands-differ');
  assert.equal(report.metrics.roll.maximumCommandErrorDegPerSec, 40);
  assert.equal(report.qualificationGranted, false);
  assert.deepEqual(options, config());
});

test('CSV handles quoted fields and BOM but rejects ambiguous headers, malformed rows and expressions', () => {
  const quoted = csv().replace(headers, '"time","rc","rr","pc","pr","yc","yr"');
  assert.equal(parseFlightCSV('\uFEFF' + quoted.replaceAll('\n', '\r\n')).rows.length, 3);
  for (const text of [
    csv().replace('time,rc', 'rc,rc'),
    csv().replace('0,10', '0,10,10'),
    csv().replace('time', '"time'),
    csv().replace('time', '"time"oops'),
  ])
    assert.throws(() => parseFlightCSV(text));
  for (const value of ['', '=1+2', 'NaN', 'Infinity', '0xff', '1e999', '100001'])
    assert.throws(() => readFlightTrace(csv().replace('0,10,10', `0,${value},10`), mapping()));
});

test('CSV capacity accepts the exact row boundary and measures UTF-8 bytes, not characters', () => {
  const rows = 'value\n' + '0\n'.repeat(250000);
  assert.equal(parseFlightCSV(rows).rows.length, 250000);
  assert.throws(() => parseFlightCSV(rows + '0\n'), /250,000 data rows/);
  const bytesAtLimit = 'é'.repeat(16 * 1024 * 1024);
  assert.equal(Buffer.byteLength(bytesAtLimit), 32 * 1024 * 1024);
  // The exact byte boundary reaches normal CSV validation; one more multibyte
  // character must fail the shared byte guard before field validation begins.
  assert.throws(() => parseFlightCSV(bytesAtLimit), /field exceeds 4,096/);
  assert.throws(() => parseFlightCSV(bytesAtLimit + 'é'), /CSV exceeds 32 MiB/);
});

test('trace row preflight preserves event rows and rejects overflow before replay or CLI writes', async (t) => {
  // At 1 kHz, these consumed events plus 36,001 mission observations have
  // exactly 250,000 distinct times. The deliberately invalid format proves
  // that the accepted boundary proceeds to verification without a long replay.
  const source = {
    format: 'invalid-test-format',
    config: { frequency: 1000 },
    missionTicks: 36000,
    inputs: Array.from({ length: 225263 }, (_, step) => [step, step, step * 1000]),
  };
  await assert.rejects(exportAdvancedFlightTrace(source), /Unsupported Advanced recording/);
  source.inputs.push([225263, 225263, 225263000]);
  const serialized = JSON.stringify(source);
  assert.ok(Buffer.byteLength(serialized) < 6 * 1024 * 1024);
  await assert.rejects(exportAdvancedFlightTrace(serialized), /CSV exceeds 250,000 data rows/);

  const directory = await mkdtemp(path.join(tmpdir(), 'fpv-log-capacity-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const input = path.join(directory, 'record.json'),
    output = path.join(directory, 'trace.csv'),
    meta = path.join(directory, 'meta.json');
  await writeFile(input, serialized);
  assert.throws(
    () =>
      execFileSync(
        process.execPath,
        ['scripts/fpv-flight-log-comparison.mjs', 'trace', input, output, meta],
        { stdio: 'pipe' },
      ),
    (error) => error.status === 1 && /CSV exceeds 250,000 data rows/.test(String(error.stderr)),
  );
  await assert.rejects(access(output), { code: 'ENOENT' });
  await assert.rejects(access(meta), { code: 'ENOENT' });
});

test('source mappings require known units, distinct axes and provenance without guessing firmware', () => {
  for (const mutate of [
    (m) => {
      m.time.unit = 'ticks';
    },
    (m) => {
      m.time.unit = 'constructor';
    },
    (m) => {
      delete m.axes.roll.unit;
    },
    (m) => {
      m.axes.roll.sign = 0;
    },
    (m) => {
      m.axes.roll.command = 'missing';
    },
    (m) => {
      m.axes.roll.achieved = 'rc';
    },
    (m) => {
      m.axes.roll.command = 'time';
    },
    (m) => {
      m.kind = 'measured';
    },
    (m) => {
      m.kind = 'simulation';
    },
    (m) => {
      m.expectedSha256 = '0'.repeat(64);
    },
  ]) {
    const source = mapping();
    mutate(source);
    assert.throws(() => readFlightTrace(csv(), source));
  }
});

test('comparison refuses clock resets, incomplete windows and missing data instead of fitting them away', () => {
  for (const times of [
    [0, 0.5, 0.5],
    [0, 0.5, 0.4],
  ])
    assert.throws(() => readFlightTrace(csv(times), mapping()), /strictly increase/);
  const options = config();
  assert.throws(() => compareFlightLogs(csv([0.1, 0.5, 1]), csv(), options), /not fully covered/);
  options.maximumGapSeconds = 0.49;
  assert.throws(() => compareFlightLogs(csv(), csv(), options), /missing-data gap/);
  options.maximumGapSeconds = 0.5;
  options.window.endSeconds = 721;
  assert.throws(() => compareFlightLogs(csv(), csv(), options), /720 seconds/);
});

async function recording(ticks = 5) {
  await initAdvancedRuntime();
  const sim = createAdvancedSimulation({ floor: false });
  try {
    for (let tick = 0; tick < ticks; tick++) {
      sim.enqueueInput({
        sequence: tick,
        timestampUs: tick * 20000,
        controls: { roll: 0.1, pitch: 0, yaw: 0, throttle: 0.4 },
      });
      sim.stepMission();
    }
    return sim.recording();
  } finally {
    sim.dispose();
  }
}

test('verified SIM trace freezes input, includes comparison/configuration and declares 50 Hz telemetry', async () => {
  const record = await recording(),
    original = structuredClone(record);
  const pending = exportAdvancedFlightTrace(record);
  record.finalHash = '00000000';
  const exported = await pending;
  assert.equal(exported.metadata.rows, 6);
  assert.equal(exported.metadata.telemetryHz, 50);
  assert.equal(exported.metadata.physicsHz, original.config.frequency);
  assert.deepEqual(exported.metadata.configuration, original.config);
  assert.deepEqual(exported.metadata.comparison, original.comparison);
  const trace = readFlightTrace(exported.csv, exported.metadata.mapping);
  assert.deepEqual(
    trace.samples.map((sample) => sample.time),
    [0, 0.02, 0.04, 0.06, 0.08, 0.1],
  );
  assert.equal(trace.provenance.sha256, exported.metadata.csvSha256);
  await assert.rejects(exportAdvancedFlightTrace(record), /verification failed/);
});

test('verified trace export requires two completed missions and leaves no short-flight output files', async (t) => {
  for (const ticks of [0, 1]) {
    const record = await recording(ticks);
    const replay = await replayAdvancedRecording(record);
    assert.equal(replay.verified, true);
    assert.equal(replay.verificationScope, 'complete');
    await assert.rejects(
      exportAdvancedFlightTrace(record),
      /At least three achieved-rate observations are required/,
    );
  }
  const exported = await exportAdvancedFlightTrace(await recording(2));
  const trace = readFlightTrace(exported.csv, exported.metadata.mapping);
  assert.equal(trace.observations.length, 3);
  assert.deepEqual(
    trace.observations.map((sample) => sample.time),
    [0, 0.02, 0.04],
  );

  const directory = await mkdtemp(path.join(tmpdir(), 'fpv-log-short-flight-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const input = path.join(directory, 'record.json'),
    output = path.join(directory, 'trace.csv'),
    meta = path.join(directory, 'meta.json');
  await writeFile(input, JSON.stringify(await recording(1)));
  assert.throws(
    () =>
      execFileSync(
        process.execPath,
        ['scripts/fpv-flight-log-comparison.mjs', 'trace', input, output, meta],
        { stdio: 'pipe' },
      ),
    (error) =>
      error.status === 1 && /At least three achieved-rate observations/.test(String(error.stderr)),
  );
  await assert.rejects(access(output), { code: 'ENOENT' });
  await assert.rejects(access(meta), { code: 'ENOENT' });
});

test('export preserves boundary and sub-mission command pulses without fabricating achieved observations', async () => {
  await initAdvancedRuntime();
  for (const portable of [false, true]) {
    const profile = createRateProfile();
    const sim = createAdvancedSimulation({
      floor: false,
      ...(portable ? { rateProfile: profile } : {}),
    });
    try {
      const input = (sequence, timestampUs, roll) => ({
        sequence,
        timestampUs,
        controls: { roll, pitch: 0, yaw: 0, throttle: 0.4 },
      });
      sim.enqueueInput(input(0, 0, 0.1));
      sim.enqueueInput(input(1, 20000, 0));
      sim.enqueueInput(input(2, 24000, 0.2));
      sim.enqueueInput(input(3, 28000, 0));
      for (let tick = 0; tick < 3; tick++) sim.stepMission();
      const exported = await exportAdvancedFlightTrace(sim.recording());
      const trace = readFlightTrace(exported.csv, exported.metadata.mapping);
      const rate = (value) =>
        portable ? createRateEvaluator(profile).rate('roll', value) : value * 400;
      assert.deepEqual(
        trace.samples.map((row) => [row.time, row.command.roll, row.observed]),
        [
          [0, rate(0.1), true],
          [0.02, 0, true],
          [0.024, rate(0.2), false],
          [0.028, 0, false],
          [0.04, 0, true],
          [0.06, 0, true],
        ],
      );
      assert.equal(exported.metadata.achievedObservations, 4);
      const options = {
        ...config(),
        reference: exported.metadata.mapping,
        candidate: exported.metadata.mapping,
        window: { startSeconds: 0, endSeconds: 0.06 },
        maximumGapSeconds: 0.025,
      };
      const report = compareFlightLogs(exported.csv, exported.csv, options);
      assert.equal(report.comparable, true);
      close(report.effectiveTimeResolutionSeconds, 0.02);
      options.maximumGapSeconds = 0.01;
      assert.throws(
        () => compareFlightLogs(exported.csv, exported.csv, options),
        /missing-data gap/,
      );
    } finally {
      sim.dispose();
    }
  }
});

test('interpolated rows cannot masquerade as achieved-rate samples or conceal a measurement gap', () => {
  const input = csv([0, 0.25, 0.5, 0.75, 1]);
  const rows = input.trim().split('\n');
  rows[0] += ',observed';
  for (let index = 1; index < rows.length; index++) rows[index] += index % 2 ? ',1' : ',0';
  // An unobserved row's value is ignored; rates are derived from true observations.
  rows[2] = rows[2].replaceAll(',10,10', ',10,999');
  const marked = rows.join('\n');
  const options = config();
  options.candidate.achievedObservationColumn = 'observed';
  const report = compareFlightLogs(csv(), marked, options);
  assert.equal(report.metrics.roll.responseRmseDegPerSec, 0);
  assert.equal(report.effectiveTimeResolutionSeconds, 0.5);
  options.maximumGapSeconds = 0.3;
  assert.throws(() => compareFlightLogs(csv(), marked, options), /missing-data gap/);
  assert.throws(() => readFlightTrace(marked.replace(',0\n', ',2\n'), options.candidate), /marker/);
});

test('opt-in replay telemetry covers only requested prefix while default replay retains compact shape', async () => {
  const record = await recording(120);
  const ordinary = await replayAdvancedRecording(record);
  assert.equal(Object.hasOwn(ordinary, 'telemetrySamples'), false);
  const prefix = await replayAdvancedRecording(record, {
    throughMission: 2,
    includeTelemetry: true,
  });
  assert.equal(prefix.verificationScope, 'prefix');
  assert.equal(prefix.telemetrySamples.length, 3);
  assert.equal(prefix.telemetrySamples[2].missionTick, 2);
  prefix.telemetrySamples[0].achievedRates.roll = 1234;
  assert.notEqual(prefix.telemetrySamples[1].achievedRates.roll, 1234);
  await assert.rejects(replayAdvancedRecording(record, { includeTelemetry: 'true' }), /telemetry/i);
});

test('CLI refuses to overwrite evidence and cleans up an incomplete trace pair', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'fpv-log-comparison-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const input = path.join(directory, 'record.json'),
    output = path.join(directory, 'trace.csv'),
    meta = path.join(directory, 'meta.json');
  await writeFile(input, JSON.stringify(await recording()));
  await writeFile(meta, 'existing evidence');
  assert.throws(() =>
    execFileSync(
      process.execPath,
      ['scripts/fpv-flight-log-comparison.mjs', 'trace', input, output, meta],
      { stdio: 'pipe' },
    ),
  );
  assert.equal(await readFile(meta, 'utf8'), 'existing evidence');
  await assert.rejects(access(output), { code: 'ENOENT' });
});
