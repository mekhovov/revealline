import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';

const fixtureURL = new URL(
  '../docs/performance/fixtures/solo-replay-portability/first-eight-39109911286.json',
  import.meta.url,
);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export async function loadReplayPortabilityCase(id) {
  assert((await stat(fixtureURL)).size <= 131072, 'Fixed replay identities exceed bound');
  const bytes = await readFile(fixtureURL);
  assert(bytes.length <= 131072, 'Fixed replay identities exceed bound');
  const fixture = JSON.parse(bytes);
  assert.equal(fixture.format, 'SoloReplayPortabilityFixedCasesV1');
  const row = fixture.cases.find((entry) => entry.id === id);
  assert(row, 'Undeclared portability recording');
  row.nativeModules = fixture.nodeModules.map(
    (item) => row.nativeModuleOverrides.find((override) => override.path === item.path) ?? item,
  );
  assert.equal(Buffer.byteLength(row.recording.text), row.recording.bytes);
  assert.equal(sha256(row.recording.text), row.recording.sha256);
  return { fixture, row };
}

/** Self-contained for injection into the separate production-module companion document.
 * Exact scalar columns, not a permissive replay validator or a state hash.
 * Only player/enemies are complete; classic and all other sections are excluded. */
export function traceReplayPortability(recording, dependencies, strictCheckpoint, reference) {
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const bytesOf = (value) => new TextEncoder().encode(JSON.stringify(value)).length;
  const playerKeys = ['x', 'y', 'direction', 'queuedDirection', 'speed', 'cutting', 'graceUntil'];
  const enemyKeys = [
    'id',
    'type',
    'course',
    'x',
    'y',
    'radius',
    'vx',
    'vy',
    'speed',
    'clockwise',
    'perimeter',
    'stunnedUntil',
    'slowUntil',
    'slowFactor',
    'axis',
    'period',
    'warningSeconds',
    'activeSeconds',
    'laneWidth',
    'bossPhase',
    'lane',
    'nextWarningAt',
    'warningUntil',
    'activeUntil',
  ];
  const paths = [
    ...playerKeys.map((key) => 'player.' + key),
    ...enemyKeys.map((key) => 'enemies[0].' + key),
  ];
  check(paths.length <= 64, 'Scalar field cap exceeded');
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const source = recording.replay ?? recording;
  check(bytesOf(recording) <= 16384, 'Recording exceeds scalar diagnostic bound');
  const data = dependencies.snapshotReplay(source);
  check(Number.isSafeInteger(data.ticks) && data.ticks >= 0 && data.ticks <= 4000, 'Tick bound');
  check(Array.isArray(data.segments) && data.segments.length <= 40, 'Segment bound');
  check(typeof data.releaseAfter === 'boolean', 'Release flag');
  check(data.level.enemies.length === 1, 'Only the fixed one-enemy recordings are admitted');
  let totalTicks = 0;
  for (const segment of data.segments) {
    check(Number.isSafeInteger(segment.ticks) && segment.ticks > 0, 'Invalid segment ticks');
    check(typeof segment.releaseBefore === 'boolean', 'Invalid release boundary');
    totalTicks += segment.ticks;
  }
  check(totalTicks === data.ticks, 'Segment tick total');
  const frames =
    1 +
    data.ticks +
    data.segments.filter((segment) => segment.releaseBefore).length +
    Number(data.releaseAfter);
  const frameBytes = 8 + paths.length * 9;
  const binaryBytes = frames * frameBytes;
  check(4 * Math.ceil(binaryBytes / 3) + 16384 <= 2 * 1024 * 1024, 'Trace size bound');
  const buffer = new ArrayBuffer(binaryBytes);
  const view = new DataView(buffer);
  const dictionary = [];
  const dictionaryIndex = new Map();
  let frame = 0;
  const run = dependencies.createRun(data.level, data.options);
  const write = (phase, segment) => {
    check(
      run.player && Array.isArray(run.enemies) && run.enemies.length === 1,
      'Scalar section shape changed',
    );
    check(Number.isSafeInteger(run.tick) && run.tick >= 0 && run.tick <= 4000, 'State tick bound');
    check(frame < frames, 'Trace frame overflow');
    let offset = frame++ * frameBytes;
    view.setUint32(offset, run.tick, true);
    view.setUint16(offset + 4, segment, true);
    view.setUint8(offset + 6, phase);
    view.setUint8(offset + 7, run.enemies.length);
    offset += 8;
    const values = [
      ...playerKeys.map((key) => run.player[key]),
      ...enemyKeys.map((key) => run.enemies[0][key]),
    ];
    for (const value of values) {
      // The authoritative pick() omits both absent and undefined properties.
      if (value === undefined) view.setUint8(offset, 0);
      else if (value === null) view.setUint8(offset, 1);
      else if (value === false) view.setUint8(offset, 2);
      else if (value === true) view.setUint8(offset, 3);
      else if (typeof value === 'number') {
        check(Number.isFinite(value), 'Non-finite authoritative scalar');
        view.setUint8(offset, 4);
        view.setFloat64(offset + 1, value, true);
      } else {
        check(typeof value === 'string', 'Non-scalar authoritative field');
        check(new TextEncoder().encode(value).length <= 128, 'Scalar string bound');
        if (!dictionaryIndex.has(value)) {
          check(dictionary.length < 64, 'String dictionary bound');
          dictionaryIndex.set(value, dictionary.length);
          dictionary.push(value);
        }
        view.setUint8(offset, 5);
        view.setUint32(offset + 1, dictionaryIndex.get(value), true);
      }
      offset += 9;
    }
  };
  write(0, 65535);
  for (let segment = 0; segment < data.segments.length; segment++) {
    const command = data.segments[segment];
    if (command.releaseBefore) {
      dependencies.releaseInputs(run);
      write(1, segment);
    }
    for (let tick = 0; tick < command.ticks; tick++) {
      check(run.status !== 'won' && run.status !== 'lost', 'Commands after terminal');
      dependencies.stepRun(run, command.input, dependencies.FIXED_DT);
      write(2, segment);
    }
  }
  if (data.releaseAfter) {
    dependencies.releaseInputs(run);
    write(3, data.segments.length);
  }
  check(frame === frames && run.tick === data.ticks, 'Trace completion mismatch');
  const finalCheckpoint = dependencies.authoritativeCheckpoint(run);
  check(same(finalCheckpoint, strictCheckpoint), 'Trace differs from strict final reconstruction');
  const header = {
    format: 'SoloReplayScalarColumnsV1',
    paths,
    dictionary,
    frames,
    frameBytes,
    finalCheckpoint,
    coverage: 'complete-player-and-enemies-only',
    excludedSections: ['classic', 'all-other-authoritative-sections'],
  };
  check(bytesOf(header) <= 16384, 'Trace metadata bound');
  const encode = (bytes) => {
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 8192)
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    return btoa(binary);
  };
  if (reference === undefined) return { ...header, data: encode(new Uint8Array(buffer)) };

  check(reference && reference.format === header.format, 'Reference trace format');
  check(
    same(reference.paths, paths) &&
      reference.frames === frames &&
      reference.frameBytes === frameBytes &&
      reference.coverage === header.coverage &&
      same(reference.excludedSections, header.excludedSections),
    'Reference trace shape',
  );
  check(
    Array.isArray(reference.dictionary) &&
      reference.dictionary.length <= 64 &&
      new Set(reference.dictionary).size === reference.dictionary.length &&
      reference.dictionary.every(
        (value) => typeof value === 'string' && new TextEncoder().encode(value).length <= 128,
      ),
    'Reference dictionary',
  );
  const { data: encoded, ...referenceHeader } = reference;
  check(bytesOf(referenceHeader) <= 16384, 'Reference metadata bound');
  check(
    typeof encoded === 'string' &&
      encoded.length === 4 * Math.ceil(binaryBytes / 3) &&
      /^[A-Za-z0-9+/]*={0,2}$/.test(encoded),
    'Reference binary length/encoding',
  );
  const binary = atob(encoded);
  check(binary.length === binaryBytes, 'Reference binary size');
  const priorBytes = Uint8Array.from(binary, (value) => value.charCodeAt(0));
  check(encode(priorBytes) === encoded, 'Non-canonical base64');
  const prior = new DataView(priorBytes.buffer);
  const scalar = (dataView, offset, strings) => {
    const tag = dataView.getUint8(offset);
    const bits = dataView.getBigUint64(offset + 1, true);
    if (tag <= 3) {
      check(bits === 0n, 'Nonzero empty scalar payload');
      return { tag, value: [undefined, null, false, true][tag], bits: null };
    }
    if (tag === 4) {
      const value = dataView.getFloat64(offset + 1, true);
      check(Number.isFinite(value), 'Invalid reference numeric scalar');
      return { tag, value, bits };
    }
    check(tag === 5 && bits < BigInt(strings.length), 'Invalid reference scalar tag/index');
    return { tag, value: strings[Number(bits)], bits: null };
  };
  const display = (value) => ({
    type: ['absent', 'null', 'boolean', 'boolean', 'number', 'string'][value.tag],
    ...(value.tag === 0 ? {} : { value: value.value }),
    ...(value.tag === 4
      ? {
          bits: value.bits.toString(16).padStart(16, '0'),
          negativeZero: Object.is(value.value, -0),
        }
      : {}),
  });
  const ordered = (bits) => {
    const sign = 1n << 63n;
    return bits & sign ? sign - (bits & (sign - 1n)) : sign + bits;
  };
  const detail = (path, expected, actual, canonicalEqual) => {
    const distance =
      expected.tag === 4 && actual.tag === 4 ? ordered(expected.bits) - ordered(actual.bits) : null;
    return {
      path,
      expected: display(expected),
      actual: display(actual),
      canonicalEqual,
      ulpDistance: distance === null ? null : (distance < 0n ? -distance : distance).toString(),
    };
  };
  let firstBitDifference = null,
    firstCanonicalDifference = null;
  let bitDifferingSamples = 0,
    canonicalDifferingSamples = 0;
  let bitReconvergences = 0,
    canonicalReconvergences = 0;
  let previousBit = false,
    previousCanonical = false;
  for (let sample = 0; sample < frames; sample++) {
    const start = sample * frameBytes;
    for (let index = 0; index < 8; index++)
      check(
        prior.getUint8(start + index) === view.getUint8(start + index),
        'Reference tick/release/frame identity differs',
      );
    const bits = [],
      canonical = [];
    for (let column = 0; column < paths.length; column++) {
      const offset = start + 8 + column * 9;
      const expected = scalar(prior, offset, reference.dictionary);
      const actual = scalar(view, offset, dictionary);
      const exact =
        expected.tag === actual.tag &&
        (expected.tag === 4 ? expected.bits === actual.bits : expected.value === actual.value);
      const canonicalEqual = expected.tag === actual.tag && expected.value === actual.value;
      if (!exact) bits.push(detail(paths[column], expected, actual, canonicalEqual));
      if (!canonicalEqual) canonical.push(detail(paths[column], expected, actual, false));
    }
    const identity = {
      sample,
      tick: view.getUint32(start, true),
      segment: view.getUint16(start + 4, true),
      phase: ['initial', 'release-before', 'tick', 'release-after'][view.getUint8(start + 6)],
    };
    if (bits.length) {
      bitDifferingSamples++;
      firstBitDifference ??= { ...identity, fields: bits };
    }
    if (canonical.length) {
      canonicalDifferingSamples++;
      firstCanonicalDifference ??= { ...identity, fields: canonical };
    }
    if (previousBit && !bits.length) bitReconvergences++;
    if (previousCanonical && !canonical.length) canonicalReconvergences++;
    previousBit = bits.length > 0;
    previousCanonical = canonical.length > 0;
  }
  const result = {
    format: 'SoloReplayPortabilityScalarDiagnosticV1',
    status: 'complete',
    coverage: header.coverage,
    excludedSections: header.excludedSections,
    samples: frames,
    firstBitDifference,
    firstCanonicalDifference,
    bitDifferingSamples,
    canonicalDifferingSamples,
    bitReconvergences,
    canonicalReconvergences,
    referenceFinalCheckpoint: reference.finalCheckpoint,
    observedFinalCheckpoint: finalCheckpoint,
    strictVerdictChanged: false,
    scope:
      'First divergence within complete canonical player/enemy columns only. Classic and other sections remain unobserved. Signed zero alone does not change canonical replay hashing. No qualification or regression verdict.',
  };
  check(bytesOf(result) <= 65536, 'Diagnostic output bound');
  return result;
}

async function verifyNodeModules(fixture) {
  let total = 0;
  for (const item of fixture.nodeModules) {
    assert(/^game\/[A-Za-z0-9/_.-]+$/.test(item.path) && !item.path.includes('..'));
    const url = new URL('../' + item.path, import.meta.url);
    assert.equal((await stat(url)).size, item.bytes, 'Node module byte count: ' + item.path);
    assert(item.bytes <= 2 * 1024 * 1024);
    total += item.bytes;
    assert(total <= 16 * 1024 * 1024, 'Node source byte bound');
    const bytes = await readFile(url);
    assert.equal(bytes.length, item.bytes);
    assert.equal(sha256(bytes), item.sha256, 'Node source differs: ' + item.path);
  }
}

export async function createReplayPortabilityReference(recordId, recordingText) {
  const { fixture, row } = await loadReplayPortabilityCase(recordId);
  assert.equal(process.version, fixture.nodeVersion, 'Original Node patch is required');
  assert.equal(Buffer.byteLength(recordingText), row.recording.bytes);
  assert.equal(sha256(recordingText), row.recording.sha256, 'Recording bytes changed');
  await verifyNodeModules(fixture);
  const [core, replay] = await Promise.all([
    import('../game/core/index.mjs'),
    import('../game/replay.mjs'),
  ]);
  const recording = JSON.parse(recordingText);
  const verified = replay.verifyReplay(recording.replay ?? recording);
  assert.equal(verified.match, false, 'Original Node mismatch was not reproduced');
  assert.deepEqual(verified.actual, row.nodeObservation.actual);
  assert.deepEqual(verified.diagnostics, row.nodeObservation.diagnostics);
  const trace = traceReplayPortability(
    recording,
    {
      snapshotReplay: replay.snapshotReplay,
      createRun: core.createRun,
      stepRun: core.stepRun,
      releaseInputs: core.releaseInputs,
      FIXED_DT: core.FIXED_DT,
      authoritativeCheckpoint: replay.authoritativeCheckpoint,
    },
    verified.actual.checkpoint,
  );
  await verifyNodeModules(fixture);
  const reference = {
    format: 'SoloReplayPortabilityReferenceV1',
    recordId,
    recordingSHA256: row.recording.sha256,
    nodeVersion: process.version,
    nodeSourceRevision: fixture.nodeSourceRevision,
    nodeModules: fixture.nodeModules,
    nodeCheckpoint: verified.actual.checkpoint,
    trace,
    traceSHA256: sha256(JSON.stringify(trace)),
  };
  const text = JSON.stringify(reference);
  assert(Buffer.byteLength(text) <= 2 * 1024 * 1024, 'Reference exceeds two MiB');
  return text;
}

export async function prepareReplayPortabilityRequest(request, context) {
  assert.deepEqual(Object.keys(request).sort(), ['format', 'recordId', 'referenceText']);
  assert.equal(request.format, 'SoloReplayPortabilityRequestV1');
  assert.equal(typeof request.referenceText, 'string');
  assert(Buffer.byteLength(request.referenceText) <= 2 * 1024 * 1024, 'Reference exceeds two MiB');
  assert(
    Number.isSafeInteger(context.timeoutMs) && context.timeoutMs > 0 && context.timeoutMs <= 120000,
    'Diagnostic cannot widen native replay deadline',
  );
  const { fixture, row } = await loadReplayPortabilityCase(request.recordId);
  assert.equal(context.engine, row.engine);
  assert.equal(context.expected.browserVersion, row.browserVersion);
  assert.equal(context.expected.buildIdentity.sourceRevision, row.sourceRevision);
  assert.equal(Buffer.byteLength(context.recordingText), row.recording.bytes);
  assert.equal(sha256(context.recordingText), row.recording.sha256, 'Recording bytes changed');
  const reference = JSON.parse(request.referenceText);
  assert.equal(reference.format, 'SoloReplayPortabilityReferenceV1');
  assert.equal(reference.recordId, row.id);
  assert.equal(reference.recordingSHA256, row.recording.sha256);
  assert.equal(reference.nodeVersion, fixture.nodeVersion);
  assert.equal(reference.nodeSourceRevision, fixture.nodeSourceRevision);
  assert.deepEqual(reference.nodeModules, fixture.nodeModules);
  assert.deepEqual(reference.nodeCheckpoint, row.nodeObservation.actual.checkpoint);
  assert.deepEqual(reference.trace.finalCheckpoint, reference.nodeCheckpoint);
  assert.equal(sha256(JSON.stringify(reference.trace)), reference.traceSHA256);
  assert.equal(reference.trace.format, 'SoloReplayScalarColumnsV1');
  assert.equal(reference.trace.frames, row.recording.ticks + 1);
  assert.equal(reference.trace.frameBytes, 287);
  assert.equal(reference.trace.coverage, 'complete-player-and-enemies-only');
  assert.deepEqual(reference.trace.excludedSections, [
    'classic',
    'all-other-authoritative-sections',
  ]);
  assert.deepEqual(reference.trace.paths, fixture.columns);
  assert.equal(reference.trace.paths.length, 31);
  assert(Array.isArray(reference.trace.dictionary) && reference.trace.dictionary.length <= 64);
  assert.equal(new Set(reference.trace.dictionary).size, reference.trace.dictionary.length);
  assert(
    reference.trace.dictionary.every(
      (value) => typeof value === 'string' && Buffer.byteLength(value) <= 128,
    ),
  );
  assert.equal(typeof reference.trace.data, 'string');
  assert.equal(reference.trace.data.length, 4 * Math.ceil((reference.trace.frames * 287) / 3));
  const { data: encoded, ...header } = reference.trace;
  assert(Buffer.byteLength(JSON.stringify(header)) <= 16384);
  const decoded = Buffer.from(encoded, 'base64');
  assert.equal(decoded.length, reference.trace.frames * 287);
  assert.equal(decoded.toString('base64'), encoded);
  const view = new DataView(decoded.buffer, decoded.byteOffset, decoded.byteLength);
  const recording = JSON.parse(row.recording.text).replay;
  let segment = 0,
    endTick = recording.segments[0]?.ticks ?? 0;
  for (let frame = 0; frame < reference.trace.frames; frame++) {
    while (frame > endTick) endTick += recording.segments[++segment].ticks;
    const start = frame * 287;
    assert.equal(view.getUint16(start + 4, true), frame === 0 ? 65535 : segment);
    assert.equal(view.getUint32(start, true), frame);
    assert.equal(view.getUint8(start + 6), frame === 0 ? 0 : 2);
    assert.equal(view.getUint8(start + 7), 1);
    for (let column = 0; column < 31; column++) {
      const offset = start + 8 + column * 9;
      const tag = view.getUint8(offset),
        bits = view.getBigUint64(offset + 1, true);
      assert(tag <= 5);
      if (tag <= 3) assert.equal(bits, 0n);
      else if (tag === 4) assert(Number.isFinite(view.getFloat64(offset + 1, true)));
      else assert(bits < BigInt(reference.trace.dictionary.length));
    }
  }
  return { row, reference };
}

export function assertReplayPortabilityNativeModules(row, report) {
  assert.equal(report.status, 'pass', 'Original strict native replay must still pass');
  assert.deepEqual(report.observation.checkpoint, row.nativeCheckpoint);
  const game = new URL('./', report.buildIdentity.url);
  for (const expected of row.nativeModules) {
    const url = new URL(expected.path.slice('game/'.length), game).href;
    const actual = report.modules.find((entry) => entry.url === url);
    assert(actual && actual.status === 200 && !actual.failure);
    assert.equal(actual.bytes, expected.bytes);
    assert.equal(actual.sha256, expected.sha256, 'Native module differs: ' + expected.path);
  }
}
