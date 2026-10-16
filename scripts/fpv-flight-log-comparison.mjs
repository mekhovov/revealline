import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat, writeFile, unlink } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const axes = ['roll', 'pitch', 'yaw'];
const maximumBytes = 32 * 1024 * 1024;
const maximumRows = 250000;
const digest = (value) => createHash('sha256').update(value).digest('hex');
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const check = (condition, message) => assert.ok(condition, message);
const label = (value) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= 500;

/** Numeric CSV only, with RFC-style quoted fields. No formulas or expressions
 * are evaluated. A source's units and column mapping must be explicit. */
export function parseFlightCSV(text) {
  check(typeof text === 'string' && Buffer.byteLength(text) <= maximumBytes, 'CSV exceeds 32 MiB');
  const rows = [];
  let row = [],
    field = '',
    quoted = false,
    closed = false;
  const cell = () => {
    row.push(field.trim());
    check(row.length <= 128, 'CSV exceeds 128 columns');
    field = '';
    closed = false;
  };
  const line = () => {
    cell();
    if (row.some((value) => value !== '')) rows.push(row);
    check(rows.length <= maximumRows + 1, 'CSV exceeds 250,000 data rows');
    row = [];
  };
  text = text.replace(/^\uFEFF/, '');
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += character;
    } else if (character === ',') cell();
    else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index++;
      line();
    } else if (character === '"') {
      check(!closed && field.trim() === '', 'Unexpected CSV quote');
      field = '';
      quoted = true;
    } else {
      check(!closed || /\s/.test(character), 'Unexpected text after CSV quote');
      field += character;
    }
    check(field.length <= 4096, 'CSV field exceeds 4,096 characters');
  }
  check(!quoted, 'Unclosed CSV quote');
  if (field || row.length || closed) line();
  check(rows.length >= 4, 'At least three flight samples are required');
  const headers = rows.shift();
  check(
    headers.every(Boolean) && new Set(headers).size === headers.length,
    'CSV headers must be unique',
  );
  check(
    rows.every((values) => values.length === headers.length),
    'CSV row width differs from header',
  );
  return { headers, rows };
}

export function readFlightTrace(text, mapping) {
  check(
    mapping && label(mapping.label) && label(mapping.aircraft),
    'Source label and aircraft are required',
  );
  check(
    ['measured', 'simulation', 'synthetic'].includes(mapping.kind),
    'Declare measured, simulation or synthetic source',
  );
  if (mapping.kind === 'measured')
    check(label(mapping.firmware), 'Measured source firmware is required');
  if (mapping.kind === 'simulation')
    check(
      label(mapping.backend) && label(mapping.simulationIdentity),
      'Simulation backend and identity are required',
    );
  const sha256 = digest(text);
  if (mapping.expectedSha256 !== undefined)
    check(mapping.expectedSha256 === sha256, 'CSV does not match the declared source digest');
  const { headers, rows } = parseFlightCSV(text);
  const column = (name) => {
    check(typeof name === 'string' && headers.includes(name), `Missing mapped column: ${name}`);
    return headers.indexOf(name);
  };
  const numeric = (values, index) => {
    const source = values[index];
    check(
      source !== '' && /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(source),
      'Mapped channels must contain finite decimal numbers',
    );
    const result = Number(source);
    check(Number.isFinite(result), 'Non-finite flight sample');
    return result;
  };
  const scale = { s: 1, ms: 0.001, us: 0.000001 }[mapping.time?.unit];
  check(finite(scale), 'Time unit must be s, ms or us');
  const timeColumn = column(mapping.time.column),
    offset = mapping.time.offsetSeconds ?? 0;
  const observationColumn =
    mapping.achievedObservationColumn === undefined
      ? null
      : column(mapping.achievedObservationColumn);
  check(finite(offset) && Math.abs(offset) <= 1e9, 'Invalid explicit clock offset');
  const channels = axes.map((axis) => {
    const source = mapping.axes?.[axis];
    check(
      source && ['deg/s', 'rad/s'].includes(source.unit),
      `Explicit rotation unit required for ${axis}`,
    );
    check(source.sign === 1 || source.sign === -1, `Explicit axis sign required for ${axis}`);
    return {
      axis,
      command: column(source.command),
      achieved: column(source.achieved),
      scale: source.sign * (source.unit === 'rad/s' ? 180 / Math.PI : 1),
    };
  });
  check(
    new Set(channels.flatMap((value) => [value.command, value.achieved])).size === 6,
    'Commanded and measured axes must map to six distinct columns',
  );
  check(
    channels.every((value) => value.command !== timeColumn && value.achieved !== timeColumn),
    'Time must use its own column',
  );
  let previous = -Infinity;
  const samples = rows.map((values) => {
    const time = numeric(values, timeColumn) * scale + offset;
    check(
      finite(time) && time > previous,
      'Timestamps must strictly increase; split reset/wrapped logs first',
    );
    previous = time;
    const observed = observationColumn === null ? 1 : numeric(values, observationColumn);
    check(observed === 0 || observed === 1, 'Achieved observation marker must be 0 or 1');
    const sample = { time, command: {}, achieved: {}, observed: observed === 1 };
    for (const channel of channels) {
      sample.command[channel.axis] = numeric(values, channel.command) * channel.scale;
      sample.achieved[channel.axis] = numeric(values, channel.achieved) * channel.scale;
      check(
        Math.abs(sample.command[channel.axis]) <= 100000 &&
          Math.abs(sample.achieved[channel.axis]) <= 100000,
        'Angular sample outside diagnostic bounds; check units',
      );
    }
    return sample;
  });
  const observations = samples.filter((sample) => sample.observed);
  check(observations.length >= 3, 'At least three achieved-rate observations are required');
  return {
    samples,
    observations,
    provenance: {
      ...structuredClone(mapping),
      sha256,
      rows: samples.length,
      achievedObservations: observations.length,
    },
  };
}

function sampleAt(samples, time, maximumGapSeconds) {
  let low = 0,
    high = samples.length - 1;
  check(
    time >= samples[low].time && time <= samples[high].time,
    'Declared comparison window is not fully covered',
  );
  while (low + 1 < high) {
    const middle = (low + high) >> 1;
    if (samples[middle].time <= time) low = middle;
    else high = middle;
  }
  if (time === samples[high].time) low = high;
  if (time === samples[low].time) return samples[low];
  const left = samples[low],
    right = samples[high],
    gap = right.time - left.time;
  check(gap <= maximumGapSeconds + 1e-9, 'Interpolation crosses a missing-data gap');
  const fraction = (time - left.time) / gap;
  return {
    time,
    command: { ...left.command },
    achieved: Object.fromEntries(
      axes.map((axis) => [
        axis,
        left.achieved[axis] + fraction * (right.achieved[axis] - left.achieved[axis]),
      ]),
    ),
  };
}

/** Time-weighted comparison. Command channels use sample-and-hold; measured
 * rotation is linearly interpolated. Clock offsets are declared, never fitted. */
export function compareFlightLogs(referenceCSV, candidateCSV, configuration) {
  check(configuration?.format === 'FPVFlightComparison.v1', 'Unsupported comparison configuration');
  const { startSeconds: start, endSeconds: end } = configuration.window ?? {};
  check(
    finite(start) && finite(end) && end > start && end - start <= 720,
    'Declare a comparison window of at most 720 seconds',
  );
  const maximumGapSeconds = configuration.maximumGapSeconds;
  check(
    finite(maximumGapSeconds) && maximumGapSeconds > 0 && maximumGapSeconds <= 1,
    'Declare maximum gap in seconds (0..1)',
  );
  const tolerance = configuration.commandToleranceDegPerSec;
  check(
    finite(tolerance) && tolerance >= 0 && tolerance <= 10,
    'Declare command tolerance in degrees/second (0..10)',
  );
  const reference = readFlightTrace(referenceCSV, configuration.reference);
  const candidate = readFlightTrace(candidateCSV, configuration.candidate);
  const alignedSample = (trace, time) => ({
    ...sampleAt(trace.samples, time, maximumGapSeconds),
    achieved: sampleAt(trace.observations, time, maximumGapSeconds).achieved,
  });
  const gaps = (trace) => {
    alignedSample(trace, start);
    alignedSample(trace, end);
    let maximum = 0;
    for (let index = 1; index < trace.observations.length; index++) {
      const previous = trace.observations[index - 1],
        current = trace.observations[index];
      if (current.time <= start || previous.time >= end) continue;
      maximum = Math.max(maximum, current.time - previous.time);
    }
    check(maximum <= maximumGapSeconds + 1e-9, 'Comparison window contains a missing-data gap');
    return maximum;
  };
  const maximumReferenceGapSeconds = gaps(reference),
    maximumCandidateGapSeconds = gaps(candidate);
  // Include both streams' timestamps so brief candidate command changes cannot
  // disappear between reference samples. Exact linear integrals measure errors;
  // command discontinuities are additionally checked at every event boundary.
  const times = [
    ...new Set([
      start,
      end,
      ...[reference, candidate].flatMap((trace) =>
        trace.samples
          .filter((sample) => sample.time > start && sample.time < end)
          .map((sample) => sample.time),
      ),
    ]),
  ].sort((a, b) => a - b);
  const aligned = times.map((time) => ({
    time,
    reference: alignedSample(reference, time),
    candidate: alignedSample(candidate, time),
  }));
  const metrics = Object.fromEntries(
    axes.map((axis) => {
      let responseSquared = 0,
        referenceTrackingSquared = 0,
        candidateTrackingSquared = 0;
      let maximumCommandError = 0,
        maximumResponseError = 0;
      for (const row of aligned) {
        const referenceRate = row.reference.achieved[axis],
          candidateRate = row.candidate.achieved[axis];
        maximumCommandError = Math.max(
          maximumCommandError,
          Math.abs(row.reference.command[axis] - row.candidate.command[axis]),
        );
        maximumResponseError = Math.max(
          maximumResponseError,
          Math.abs(referenceRate - candidateRate),
        );
      }
      for (let index = 1; index < aligned.length; index++) {
        const left = aligned[index - 1],
          right = aligned[index];
        const integral = (a, b) => ((right.time - left.time) * (a * a + a * b + b * b)) / 3;
        responseSquared += integral(
          left.reference.achieved[axis] - left.candidate.achieved[axis],
          right.reference.achieved[axis] - right.candidate.achieved[axis],
        );
        // Commands hold their left-hand value over this interval. A command
        // change at its right endpoint must not be smeared into earlier time.
        referenceTrackingSquared += integral(
          left.reference.achieved[axis] - left.reference.command[axis],
          right.reference.achieved[axis] - left.reference.command[axis],
        );
        candidateTrackingSquared += integral(
          left.candidate.achieved[axis] - left.candidate.command[axis],
          right.candidate.achieved[axis] - left.candidate.command[axis],
        );
      }
      return [
        axis,
        {
          maximumCommandErrorDegPerSec: maximumCommandError,
          commandedMotionMatches: maximumCommandError <= tolerance,
          responseRmseDegPerSec: Math.sqrt(responseSquared / (end - start)),
          maximumResponseErrorDegPerSec: maximumResponseError,
          referenceTrackingRmseDegPerSec: Math.sqrt(referenceTrackingSquared / (end - start)),
          candidateTrackingRmseDegPerSec: Math.sqrt(candidateTrackingSquared / (end - start)),
        },
      ];
    }),
  );
  const comparable = Object.values(metrics).every((metric) => metric.commandedMotionMatches);
  return {
    format: 'FPVFlightComparisonReport.v1',
    comparable,
    status: comparable ? 'matched-command-traces' : 'commands-differ',
    qualificationGranted: false,
    tuneModified: false,
    configuration: structuredClone(configuration),
    reference: reference.provenance,
    candidate: candidate.provenance,
    samplesCompared: aligned.length,
    maximumReferenceGapSeconds,
    maximumCandidateGapSeconds,
    effectiveTimeResolutionSeconds: Math.max(
      maximumReferenceGapSeconds,
      maximumCandidateGapSeconds,
    ),
    metrics,
    limits: [
      'Explicit source mappings and clock offsets; no automatic latency alignment or parameter fitting.',
      'Matching commands does not establish matching throttle, environment, airframe or controller.',
      'Sparse samples cannot qualify motor delay, filters, vibration or physical display latency.',
      'Synthetic traces test the comparison software and do not qualify a real aircraft.',
    ],
  };
}

export async function exportAdvancedFlightTrace(source) {
  const original = typeof source === 'string' ? source : JSON.stringify(source);
  const { replayAdvancedRecording } = await import(
    '../optional-practice/civilian-fpv/advanced-simulation.mjs'
  );
  const replay = await replayAdvancedRecording(original, { includeTelemetry: true });
  check(
    replay.verified && replay.verificationScope === 'complete',
    'Only complete verified replays can be exported',
  );
  const record = JSON.parse(original);
  const { createRateEvaluator } = await import('../optional-practice/civilian-fpv/rates.mjs');
  const evaluator = record.config.configuration.rateProfile
    ? createRateEvaluator(record.config.configuration.rateProfile)
    : null;
  let controls = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
  const events = record.inputs.map((input) => {
    if (input.length === 7)
      controls = { roll: input[3], pitch: input[4], yaw: input[5], throttle: input[6] };
    return {
      time: input[0] / record.config.frequency,
      controls: { ...controls },
      sequence: input[1],
      timestampUs: input[2],
      command: Object.fromEntries(
        axes.map((axis) => [
          axis,
          evaluator ? evaluator.rate(axis, controls[axis]) : controls[axis] * 400,
        ]),
      ),
    };
  });
  const telemetry = replay.telemetrySamples;
  const observedTimes = new Set(telemetry.map((sample) => sample.seconds));
  const times = [...new Set([...observedTimes, ...events.map((event) => event.time)])].sort(
    (a, b) => a - b,
  );
  let eventIndex = -1,
    observationIndex = 0;
  const headers = [
    'time_s',
    ...axes.flatMap((axis) => [`command_${axis}_dps`, `achieved_${axis}_dps`]),
    'throttle',
    'voltage_v',
    'current_a',
    'saturated',
    'consumed_sequence',
    'sample_age_us',
    'achieved_observed',
  ];
  const csv =
    headers.join(',') +
    '\n' +
    times
      .map((time) => {
        while (events[eventIndex + 1]?.time <= time) eventIndex++;
        while (telemetry[observationIndex + 1]?.seconds <= time) observationIndex++;
        const left = telemetry[observationIndex],
          right = telemetry[observationIndex + 1] ?? left;
        const fraction =
          right.seconds === left.seconds
            ? 0
            : (time - left.seconds) / (right.seconds - left.seconds);
        const event = events[eventIndex],
          observed = observedTimes.has(time);
        return [
          time,
          ...axes.flatMap((axis) => [
            event?.command[axis] ?? 0,
            left.achievedRates[axis] +
              fraction * (right.achievedRates[axis] - left.achievedRates[axis]),
          ]),
          event?.controls.throttle ?? 0,
          observed ? left.voltage : '',
          observed ? left.current : '',
          observed ? Number(left.saturated) : '',
          event?.sequence ?? -1,
          event ? Math.max(0, Math.round(time * 1000000) - event.timestampUs) : '',
          Number(observed),
        ].join(',');
      })
      .join('\n') +
    '\n';
  return {
    csv,
    metadata: {
      format: 'FPVVerifiedFlightTrace.v1',
      verified: true,
      recordingSha256: digest(original),
      csvSha256: digest(csv),
      backend: record.config.backend,
      simulationIdentity: record.simulationIdentity ?? record.identity,
      comparison: replay.comparison,
      configuration: record.config,
      telemetryHz: replay.telemetryHz,
      physicsHz: record.config.frequency,
      rows: times.length,
      achievedObservations: telemetry.length,
      limits: [
        'Telemetry is sampled at 50 Hz mission boundaries, not at the physics frequency.',
        'Command transitions use exact consumed substep times. Added event rows interpolate achieved rotation and are marked achieved_observed=0; they are not new sensor observations.',
        'This is a verified simulated trace, not measured physical-aircraft evidence.',
      ],
      mapping: {
        label: 'Verified SIM replay',
        aircraft: record.config.aircraft.id,
        kind: 'simulation',
        backend: record.config.backend,
        simulationIdentity: record.simulationIdentity ?? record.identity,
        expectedSha256: digest(csv),
        achievedObservationColumn: 'achieved_observed',
        time: { column: 'time_s', unit: 's', offsetSeconds: 0 },
        axes: Object.fromEntries(
          axes.map((axis) => [
            axis,
            {
              command: `command_${axis}_dps`,
              achieved: `achieved_${axis}_dps`,
              unit: 'deg/s',
              sign: 1,
            },
          ]),
        ),
      },
    },
  };
}

async function boundedFile(filename, bytes = maximumBytes) {
  check((await stat(filename)).size <= bytes, 'Input file exceeds its size limit');
  const value = await readFile(filename, 'utf8');
  check(Buffer.byteLength(value) <= bytes, 'Input file grew beyond its size limit');
  return value;
}
async function main(args) {
  if (args[0] === 'trace' && args.length === 4) {
    const result = await exportAdvancedFlightTrace(await boundedFile(args[1], 8 * 1024 * 1024));
    await writeFile(args[2], result.csv, { flag: 'wx' });
    try {
      await writeFile(args[3], JSON.stringify(result.metadata, null, 2) + '\n', { flag: 'wx' });
    } catch (error) {
      await unlink(args[2]);
      throw error;
    }
    process.stdout.write(
      JSON.stringify({
        verified: true,
        rows: result.metadata.rows,
        telemetryHz: result.metadata.telemetryHz,
      }) + '\n',
    );
  } else if (args[0] === 'compare' && args.length === 5) {
    const [reference, candidate, config] = await Promise.all([
      boundedFile(args[1]),
      boundedFile(args[2]),
      boundedFile(args[3], 65536),
    ]);
    const report = compareFlightLogs(reference, candidate, JSON.parse(config));
    await writeFile(args[4], JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    process.stdout.write(
      JSON.stringify({ comparable: report.comparable, qualificationGranted: false }) + '\n',
    );
    if (!report.comparable) process.exitCode = 2;
  } else
    throw new Error(
      'Usage: fpv-flight-log-comparison.mjs trace RECORDING.json TRACE.csv METADATA.json | compare REFERENCE.csv CANDIDATE.csv CONFIG.json REPORT.json',
    );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  });
