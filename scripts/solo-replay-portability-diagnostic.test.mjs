import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import {
  traceReplayPortability,
  loadReplayPortabilityCase,
  createReplayPortabilityReference,
  withReplayPortabilityNodeSource,
  prepareReplayPortabilityRequest,
  assertReplayPortabilityNativeModules,
} from './solo-replay-portability-diagnostic.mjs';

const sha = (text) => createHash('sha256').update(text).digest('hex');
const recording = (ticks = 4, extra = {}) => ({
  level: { enemies: [{ id: 'keeper', type: 'bouncer' }] },
  options: {},
  ticks,
  segments: ticks ? [{ ticks, releaseBefore: false, input: {} }] : [],
  releaseAfter: false,
  ...extra,
});
const model = (change = () => {}) => ({
  FIXED_DT: 1 / 60,
  snapshotReplay: (value) => structuredClone(value),
  createRun() {
    const run = {
      tick: 0,
      status: 'running',
      player: {
        x: 0,
        y: 0,
        direction: 'down',
        queuedDirection: null,
        speed: 0,
        cutting: false,
        graceUntil: 0,
      },
      enemies: [{ id: 'keeper', type: 'bouncer', course: 'field-course.v2', x: 58.5, y: 23.5 }],
    };
    change(run, 'initial');
    return run;
  },
  stepRun(run) {
    run.tick++;
    run.player.x = run.tick;
    change(run, 'tick');
  },
  releaseInputs(run) {
    change(run, 'release');
  },
  authoritativeCheckpoint: (run) => ({
    algorithm: 'model-only',
    hash: JSON.stringify([run.tick, run.player, run.enemies]),
    sections: {},
  }),
});
function strictModel(data, dependencies) {
  const run = dependencies.createRun();
  for (const command of data.segments) {
    if (command.releaseBefore) dependencies.releaseInputs(run);
    for (let tick = 0; tick < command.ticks; tick++)
      dependencies.stepRun(run, command.input, dependencies.FIXED_DT);
  }
  if (data.releaseAfter) dependencies.releaseInputs(run);
  return dependencies.authoritativeCheckpoint(run);
}
const trace = (data, dependencies = model(), reference) =>
  traceReplayPortability(data, dependencies, strictModel(data, dependencies), reference);
const compare = (data, actual, expected = model()) => trace(data, actual, trace(data, expected));

test('all 31 canonical player/enemy columns are complete, with classic explicitly excluded', () => {
  const result = compare(recording(), model());
  assert.equal(result.samples, 5);
  assert.equal(result.status, 'complete');
  assert.equal(result.coverage, 'complete-player-and-enemies-only');
  assert.deepEqual(result.excludedSections, ['classic', 'all-other-authoritative-sections']);
  assert.equal(result.firstBitDifference, null);
  assert.equal(result.firstCanonicalDifference, null);
  assert.equal(result.strictVerdictChanged, false);
  const reference = trace(recording());
  assert.equal(reference.paths.length, 31);
  assert.equal(reference.frameBytes, 287);
  const alteredClassic = model((run) => {
    run.classic = { terrain: [1, 2, 3] };
  });
  assert.equal(compare(recording(), alteredClassic).firstCanonicalDifference, null);
});

test('initial and late differences report the first exact sample and every changed selected field', () => {
  const initial = compare(
    recording(),
    model((run, phase) => {
      if (phase === 'initial') {
        run.player.x = 9;
        run.enemies[0].x = 60;
      }
    }),
  );
  assert.equal(initial.firstCanonicalDifference.phase, 'initial');
  assert.equal(initial.firstCanonicalDifference.tick, 0);
  assert.deepEqual(
    initial.firstCanonicalDifference.fields.map((row) => row.path),
    ['player.x', 'enemies[0].x'],
  );
  const late = compare(
    recording(),
    model((run) => {
      if (run.tick === 4) run.player.x = 4.5;
    }),
  );
  assert.equal(late.firstCanonicalDifference.tick, 4);
});

test('sequential sampling detects transient divergence that reconverges before the final checkpoint', () => {
  const result = compare(
    recording(),
    model((run) => {
      if (run.tick === 2) run.player.x++;
    }),
  );
  assert.equal(result.firstCanonicalDifference.tick, 2);
  assert.equal(result.canonicalDifferingSamples, 1);
  assert.equal(result.canonicalReconvergences, 1);
  assert.deepEqual(result.referenceFinalCheckpoint, result.observedFinalCheckpoint);
});

test('release-before and release-after changes are distinct from tick changes', () => {
  const change = model((run, phase) => {
    if (phase === 'release') run.player.queuedDirection = 'left';
  });
  const before = recording(2, {
    segments: [{ ticks: 2, releaseBefore: true, input: {} }],
  });
  const first = compare(before, change);
  assert.equal(first.firstCanonicalDifference.phase, 'release-before');
  assert.equal(first.firstCanonicalDifference.tick, 0);
  const after = compare(recording(2, { releaseAfter: true }), change);
  assert.equal(after.firstCanonicalDifference.phase, 'release-after');
  assert.equal(after.firstCanonicalDifference.tick, 2);
});

test('signed zero differs in bits but not canonical checkpoint scalars; one ULP is preserved', () => {
  const zero = compare(
    recording(0),
    model((run) => {
      run.player.x = -0;
    }),
  );
  assert.equal(zero.firstBitDifference.fields[0].actual.bits, '8000000000000000');
  assert.equal(zero.firstBitDifference.fields[0].canonicalEqual, true);
  assert.equal(zero.firstCanonicalDifference, null);
  assert.equal(zero.firstBitDifference.fields[0].ulpDistance, '0');
  const expected = model((run) => {
    run.player.x = 1;
  });
  const actual = model((run) => {
    run.player.x = 1 + Number.EPSILON;
  });
  const ulp = compare(recording(0), actual, expected);
  assert.equal(ulp.firstCanonicalDifference.fields[0].ulpDistance, '1');
});

test('absent and undefined match authoritative pick semantics; null and type changes do not', () => {
  const missing = model((run) => {
    delete run.player.queuedDirection;
  });
  const undefinedValue = model((run) => {
    run.player.queuedDirection = undefined;
  });
  assert.equal(compare(recording(), undefinedValue, missing).firstCanonicalDifference, null);
  assert.equal(
    compare(recording(), model(), missing).firstCanonicalDifference.fields[0].path,
    'player.queuedDirection',
  );
  const changedType = model((run) => {
    run.player.speed = '0';
  });
  assert.equal(
    compare(recording(), changedType).firstCanonicalDifference.fields[0].path,
    'player.speed',
  );
});

test('string dictionary numbering is not mistaken for a scalar difference', () => {
  const data = recording();
  const reference = trace(data);
  const old = reference.dictionary;
  reference.dictionary = [...old].reverse();
  const bytes = Buffer.from(reference.data, 'base64');
  for (let frame = 0; frame < reference.frames; frame++)
    for (let column = 0; column < 31; column++) {
      const offset = frame * 287 + 8 + column * 9;
      if (bytes[offset] === 5) {
        const value = old[bytes.readUInt32LE(offset + 1)];
        bytes.writeUInt32LE(reference.dictionary.indexOf(value), offset + 1);
      }
    }
  reference.data = bytes.toString('base64');
  assert.equal(trace(data, model(), reference).firstBitDifference, null);
});

test('recording, tick, segment, actor, scalar, dictionary and reconstruction bounds fail closed', () => {
  assert.throws(() => trace(recording(4001)), /Tick bound/);
  assert.throws(
    () =>
      trace(
        recording(41, {
          segments: Array.from({ length: 41 }, () => ({
            ticks: 1,
            releaseBefore: false,
            input: {},
          })),
        }),
      ),
    /Segment bound/,
  );
  assert.throws(() => trace(recording(1, { padding: 'x'.repeat(16384) })), /Recording exceeds/);
  assert.throws(() => trace(recording(1, { level: { enemies: [{}, {}] } })), /one-enemy/);
  for (const value of [NaN, Infinity, {}, [], 'x'.repeat(129)])
    assert.throws(() =>
      trace(
        recording(0),
        model((run) => {
          run.player.x = value;
        }),
      ),
    );
  assert.throws(
    () =>
      trace(
        recording(65),
        model((run) => {
          run.player.direction = String(run.tick);
        }),
      ),
    /dictionary bound/,
  );
  assert.throws(() => traceReplayPortability(recording(), model(), {}), /strict final/);
  const changedShape = model((run) => {
    if (run.tick === 1) run.enemies.push({});
  });
  assert.throws(() => trace(recording(), changedShape), /section shape changed/);
});

test('reference truncation, malformed tags/payloads, frame identity and metadata overflow are rejected', () => {
  const data = recording();
  const original = trace(data);
  const reject = (change, pattern) => {
    const reference = structuredClone(original);
    change(reference);
    assert.throws(() => trace(data, model(), reference), pattern);
  };
  reject((value) => {
    value.data = value.data.slice(4);
  }, /binary length/);
  reject((value) => {
    value.paths.pop();
  }, /trace shape/);
  reject((value) => {
    value.padding = 'x'.repeat(16384);
  }, /metadata bound/);
  reject((value) => {
    const bytes = Buffer.from(value.data, 'base64');
    bytes[8] = 9;
    value.data = bytes.toString('base64');
  }, /tag\/index/);
  reject((value) => {
    const bytes = Buffer.from(value.data, 'base64');
    bytes[0] = 1;
    value.data = bytes.toString('base64');
  }, /frame identity/);
  reject((value) => {
    const bytes = Buffer.from(value.data, 'base64');
    const offset = 8 + 3 * 9; // null queuedDirection
    bytes[offset + 1] = 1;
    value.data = bytes.toString('base64');
  }, /Nonzero empty/);
});

test('largest admitted trace remains below two MiB with all release samples and full columns', () => {
  const data = recording(4000, {
    segments: Array.from({ length: 40 }, () => ({ ticks: 100, releaseBefore: true, input: {} })),
    releaseAfter: true,
  });
  const result = trace(data);
  assert.equal(result.frames, 4042);
  assert(Buffer.byteLength(JSON.stringify(result)) < 2 * 1024 * 1024);
  assert(Buffer.byteLength(JSON.stringify(trace(data, model(), result))) <= 65536);
});

const ids = [
  'baseline-first30-chromium',
  'baseline-first30-webkit',
  'candidate-first30-chromium',
  'candidate-first30-webkit',
];
test('fixed evidence contains all four exact recordings and honest retained mismatch sections', async () => {
  const expectedSections = [
    ['player', 'enemies'],
    ['player', 'enemies', 'classic'],
    ['player', 'enemies'],
    ['enemies', 'classic'],
  ];
  for (let index = 0; index < ids.length; index++) {
    const { fixture, row } = await loadReplayPortabilityCase(ids[index]);
    assert.equal(fixture.sourceRun, 39109911286);
    assert.equal(fixture.sourceArtifact, 12130067688);
    assert.equal(fixture.nodeModules.length, 47);
    assert.equal(sha(row.recording.text), row.recording.sha256);
    assert.equal(Buffer.byteLength(row.recording.text), row.recording.bytes);
    const data = JSON.parse(row.recording.text).replay;
    assert.equal(data.ticks, row.recording.ticks);
    assert.equal(data.segments.length, row.recording.segments);
    assert.equal(data.releaseAfter, false);
    assert(data.segments.every((segment) => !segment.releaseBefore));
    assert.deepEqual(
      row.nodeObservation.diagnostics.map((value) => value.section),
      expectedSections[index],
    );
    assert(4 * Math.ceil(((data.ticks + 1) * 287) / 3) + 16384 <= 2 * 1024 * 1024);
  }
  await assert.rejects(loadReplayPortabilityCase('any-other-recording'));
});

async function modeledRequest() {
  const { fixture, row } = await loadReplayPortabilityCase(ids[0]);
  const data = JSON.parse(row.recording.text).replay;
  const dependencies = model();
  dependencies.authoritativeCheckpoint = () => row.nodeObservation.actual.checkpoint;
  const columns = traceReplayPortability(data, dependencies, row.nodeObservation.actual.checkpoint);
  const reference = {
    format: 'SoloReplayPortabilityReferenceV1',
    recordId: row.id,
    recordingSHA256: row.recording.sha256,
    nodeVersion: fixture.nodeVersion,
    nodeSourceRevision: fixture.nodeSourceRevision,
    nodeModules: fixture.nodeModules,
    nodeCheckpoint: row.nodeObservation.actual.checkpoint,
    trace: columns,
    traceSHA256: sha(JSON.stringify(columns)),
  };
  return {
    row,
    reference,
    request: {
      format: 'SoloReplayPortabilityRequestV1',
      recordId: row.id,
      referenceText: JSON.stringify(reference),
    },
    context: {
      recordingText: row.recording.text,
      engine: row.engine,
      timeoutMs: 120000,
      expected: {
        browserVersion: row.browserVersion,
        buildIdentity: { sourceRevision: row.sourceRevision },
      },
    },
  };
}
test('opt-in admission binds fixed recording/source/browser/Node/checkpoint and rejects changed or oversized input', async () => {
  const { request, context, reference } = await modeledRequest();
  assert.equal((await prepareReplayPortabilityRequest(request, context)).row.id, ids[0]);
  for (const change of [
    (value) => {
      value.recordingSHA256 = '0'.repeat(64);
    },
    (value) => {
      value.nodeVersion = 'v22.22.2';
    },
    (value) => {
      value.nodeSourceRevision = '0'.repeat(40);
    },
    (value) => {
      value.nodeModules[0].sha256 = '0'.repeat(64);
    },
    (value) => {
      value.nodeCheckpoint.hash = '0'.repeat(16);
    },
    (value) => {
      value.traceSHA256 = '0'.repeat(64);
    },
  ]) {
    const altered = structuredClone(reference);
    change(altered);
    await assert.rejects(
      prepareReplayPortabilityRequest(
        {
          ...request,
          referenceText: JSON.stringify(altered),
        },
        context,
      ),
    );
  }
  await assert.rejects(
    prepareReplayPortabilityRequest(
      { ...request, referenceText: ' '.repeat(2 * 1024 * 1024 + 1) },
      context,
    ),
    /two MiB/,
  );
  await assert.rejects(
    prepareReplayPortabilityRequest(request, {
      ...context,
      timeoutMs: 120001,
    }),
    /deadline/,
  );
  await assert.rejects(
    prepareReplayPortabilityRequest(request, {
      ...context,
      recordingText: context.recordingText + ' ',
    }),
  );
  await assert.rejects(
    prepareReplayPortabilityRequest(request, {
      ...context,
      engine: 'webkit',
    }),
  );
});

test('native source readback and original strict checkpoint are mandatory, not diagnostic success substitutes', async () => {
  const { row } = await loadReplayPortabilityCase(ids[0]);
  const url = 'http://127.0.0.1:1234/game/build-identity.json';
  const report = {
    status: 'pass',
    observation: { checkpoint: row.nativeCheckpoint },
    buildIdentity: { url },
    modules: row.nativeModules.map((item) => ({
      url: new URL(item.path.slice(5), new URL('./', url)).href,
      status: 200,
      bytes: item.bytes,
      sha256: item.sha256,
    })),
  };
  assertReplayPortabilityNativeModules(row, report);
  for (const change of [
    (value) => {
      value.status = 'fail';
    },
    (value) => {
      value.observation.checkpoint.hash = '0'.repeat(16);
    },
    (value) => {
      value.modules.pop();
    },
    (value) => {
      value.modules[0].sha256 = '0'.repeat(64);
    },
    (value) => {
      value.modules[0].failure = 'load failed';
    },
  ]) {
    const bad = structuredClone(report);
    change(bad);
    assert.throws(() => assertReplayPortabilityNativeModules(row, bad));
  }
});

test('historical Node mirror executes its checked modules and removes all owned files', async () => {
  const { fixture } = await loadReplayPortabilityCase(ids[0]);
  let root;
  await withReplayPortabilityNodeSource(fixture, async (rootURL) => {
    root = new URL(rootURL);
    assert(root.href.startsWith('file:'));
    assert.notEqual(root.href, new URL('../', import.meta.url).href);
    const catalog = await readFile(new URL('game/i18n/catalogs.mjs', root));
    assert.equal(catalog.length, 1264959);
    assert.equal(sha(catalog), 'ba333d67a719078e6fca92094bee9d60e7fdcfd2ed197adadefed115766e9224');
    const core = await import(new URL('game/core/index.mjs', root));
    const replay = await import(new URL('game/replay.mjs', root));
    assert.equal(typeof core.createRun, 'function');
    assert.equal(typeof replay.verifyReplay, 'function');
  });
  await assert.rejects(stat(root), { code: 'ENOENT' });
});

test('changed owned Node bytes are refused after execution and still removed', async () => {
  const { fixture } = await loadReplayPortabilityCase(ids[0]);
  let root;
  await assert.rejects(
    withReplayPortabilityNodeSource(fixture, async (rootURL) => {
      root = new URL(rootURL);
      const target = new URL('game/core/index.mjs', root);
      const bytes = await readFile(target);
      bytes[0] ^= 1;
      await writeFile(target, bytes);
    }),
    /Node source differs/,
  );
  await assert.rejects(stat(root), { code: 'ENOENT' });
});

test('owned Node source cannot borrow a symlink to the tooling checkout', async () => {
  const { fixture } = await loadReplayPortabilityCase(ids[0]);
  let root;
  await assert.rejects(
    withReplayPortabilityNodeSource(fixture, async (rootURL) => {
      root = new URL(rootURL);
      const target = new URL('game/core/index.mjs', root);
      await rm(target);
      await symlink(fileURLToPath(new URL('../game/core/index.mjs', import.meta.url)), target);
    }),
    /Node source must be a regular file/,
  );
  await assert.rejects(stat(root), { code: 'ENOENT' });
});

test('Node reference failure removes the owned mirror without importing a fallback', async () => {
  const { fixture } = await loadReplayPortabilityCase(ids[0]);
  let root;
  await assert.rejects(
    withReplayPortabilityNodeSource(fixture, async (rootURL) => {
      root = new URL(rootURL);
      throw new Error('modeled reference failure');
    }),
    /modeled reference failure/,
  );
  await assert.rejects(stat(root), { code: 'ENOENT' });
});

test('historical Node catalog, borrowed modules, closure and source identity cannot be repinned', async () => {
  const { fixture } = await loadReplayPortabilityCase(ids[0]);
  for (const change of [
    (value) => {
      value.nodeSourceRevision = '0'.repeat(40);
    },
    (value) => {
      value.nodeModules.find((item) => item.path === 'game/i18n/catalogs.mjs').sha256 = '0'.repeat(
        64,
      );
    },
    (value) => {
      value.nodeModules.find((item) => item.path === 'game/core/index.mjs').sha256 = '0'.repeat(64);
    },
    (value) => {
      value.nodeModules.pop();
    },
    (value) => {
      value.nodeModules[0].path = 'game/../outside.mjs';
    },
  ]) {
    const invalid = structuredClone(fixture);
    change(invalid);
    let called = false;
    await assert.rejects(
      withReplayPortabilityNodeSource(invalid, async () => {
        called = true;
      }),
    );
    assert.equal(called, false, 'Changed source must be refused before execution');
  }
});

test(
  'exact original Node patch reproduces all four retained final mismatches before any trace comparison',
  { skip: process.version !== 'v22.13.1' },
  async () => {
    for (const id of ids) {
      const { row } = await loadReplayPortabilityCase(id);
      const text = await createReplayPortabilityReference(id, row.recording.text);
      assert(Buffer.byteLength(text) <= 2 * 1024 * 1024);
      const reference = JSON.parse(text);
      assert.deepEqual(reference.nodeCheckpoint, row.nodeObservation.actual.checkpoint);
    }
  },
);

async function invokeCompanionBody({
  strictMatch = true,
  diagnosticFailure = false,
  diagnosticTimeout = false,
  invalidRequest = false,
  consumeBudget = false,
  cleanupFailure = false,
  overflow = false,
} = {}) {
  const source = await readFile(
    new URL('./diagnose-solo-replay-portability.mjs', import.meta.url),
    'utf8',
  );
  const body = source
    .slice(source.indexOf('export async function diagnoseNativeReplayPortability'))
    .replace('export async function', 'async function');
  const events = new Map();
  const state = { closed: false, launched: 0, strictCalls: 0, evaluate: 0, elapsed: 0 };
  let deadline;
  const strict = {
    status: strictMatch ? 'pass' : 'fail',
    observation: { checkpoint: {} },
    ...(overflow ? { padding: 'x'.repeat(512 * 1024) } : {}),
  };
  const csp = 'test-csp';
  const page = {
    on: (name, callback) => events.set(name, callback),
    route: async () => {},
    addInitScript: async () => {},
    goto: async () => {
      events.get('response')({
        url: () => 'http://127.0.0.1/game/core/index.mjs',
        status: () => 200,
        body: async () => Buffer.from('model-source'),
        headers: () => ({ 'content-security-policy': csp }),
      });
      return {
        status: () => 200,
        body: async () => Buffer.from(JSON.stringify({ sourceRevision: '1'.repeat(40) })),
        headers: () => ({ 'content-security-policy': csp }),
      };
    },
    url: () => 'http://127.0.0.1/game/build-identity.json',
    evaluate: async () => {
      state.evaluate++;
      if (diagnosticFailure) throw new Error('diagnostic-only failure');
      if (diagnosticTimeout) {
        queueMicrotask(() => deadline());
        return new Promise(() => {});
      }
      return { status: 'complete', strictVerdictChanged: false, observedFinalCheckpoint: {} };
    },
  };
  const browser = {
    version: () => 'test-browser',
    newContext: async () => ({ newPage: async () => page, close: async () => {} }),
    close: async () => {
      state.closed = true;
      if (cleanupFailure) throw new Error('close failed');
    },
  };
  const callback = vm.runInNewContext('(' + body + ')', {
    assert,
    Buffer,
    URL,
    digest: sha,
    performance: { now: () => state.elapsed },
    setTimeout: (callback, milliseconds) => {
      deadline = callback;
      state.deadlineMs = milliseconds;
      return 1;
    },
    clearTimeout: () => {},
    traceReplayPortability: () => {},
    replayVerificationRequestAllowed: () => true,
    assertReplayVerificationIdentity: () => {},
    prepareReplayPortabilityRequest: async () => {
      if (invalidRequest) throw new Error('invalid fixed request');
      return {
        row: { id: 'modeled', recording: { sha256: '2'.repeat(64) }, nativeCheckpoint: {} },
        reference: { trace: {} },
      };
    },
    verifyNativeQualificationReplay: async (options) => {
      state.strictCalls++;
      state.strictBudget = options.timeoutMs;
      state.elapsed = consumeBudget ? 25 : 7;
      return strict;
    },
    assertReplayPortabilityNativeModules: (_row, value) => assert.equal(value.status, 'pass'),
  });
  const options = {
    playwright: {
      chromium: {
        launch: async () => {
          state.launched++;
          return browser;
        },
      },
    },
    engine: 'chromium',
    observedBrowserClosed: true,
    recordingText: '{}',
    timeoutMs: 25,
    portabilityDiagnostic: {},
    expected: {
      browserVersion: 'test-browser',
      buildIdentity: { url: page.url(), sourceRevision: '1'.repeat(40) },
      csp,
    },
  };
  return { report: await callback(options), state, strict };
}
test('companion leaves the exact executed native verifier byte-identical', async () => {
  const { fixture } = await loadReplayPortabilityCase(ids[0]);
  const bytes = await readFile(new URL('./solo-qualification-native-replay.mjs', import.meta.url));
  assert.equal(bytes.length, fixture.nativeVerifier.bytes);
  assert.equal(sha(bytes), fixture.nativeVerifier.sha256);
  assert(!bytes.toString().includes('portabilityDiagnostic'));
});
test('companion rejects malformed opt-in before native effects and never resets the owner budget', async () => {
  const invalid = await invokeCompanionBody({ invalidRequest: true });
  assert.equal(invalid.report.status, 'incomplete');
  assert.match(invalid.report.failure, /invalid fixed request/);
  assert.equal(invalid.state.strictCalls, 0);
  assert.equal(invalid.state.launched, 0);
  const normal = await invokeCompanionBody();
  assert.equal(normal.state.strictBudget, 25);
  assert.equal(normal.state.deadlineMs, 18);
  const exhausted = await invokeCompanionBody({ consumeBudget: true });
  assert.equal(exhausted.report.status, 'incomplete');
  assert.equal(exhausted.state.launched, 0);
  assert.strictEqual(exhausted.report.strict, exhausted.strict);
});
test('actual companion body keeps strict failure and diagnostic errors/timeouts separate and closes trace owner', async () => {
  for (const options of [
    { strictMatch: false },
    { diagnosticFailure: true },
    { diagnosticTimeout: true },
    {},
  ]) {
    const { report, state, strict } = await invokeCompanionBody(options);
    assert.strictEqual(report.strict, strict);
    assert.equal(report.strict.status, options.strictMatch === false ? 'fail' : 'pass');
    assert.equal(report.strictVerdictChanged, false);
    assert.equal(
      report.status,
      options.strictMatch === false || options.diagnosticFailure || options.diagnosticTimeout
        ? 'incomplete'
        : 'complete',
    );
    assert.equal(state.strictCalls, 1);
    if (options.strictMatch === false) {
      assert.equal(state.launched, 0);
      assert.equal(state.evaluate, 0);
    } else {
      assert.equal(state.closed, true);
      assert.equal(state.evaluate, 1);
    }
  }
});

test('cleanup failure or whole-envelope overflow cannot become a completed diagnostic', async () => {
  const closed = await invokeCompanionBody({ cleanupFailure: true });
  assert.equal(closed.report.status, 'incomplete');
  assert.equal(closed.report.cleanupFailures.length, 1);
  assert.equal(closed.report.strict.status, 'pass');
  const overflow = await invokeCompanionBody({ overflow: true });
  assert.equal(overflow.report.status, 'incomplete');
  assert.equal(overflow.report.evidenceOverflow.maximumBytes, 512 * 1024);
  assert(overflow.report.evidenceOverflow.bytes > 512 * 1024);
  assert.equal(overflow.report.strictIdentity.status, 'pass');
  assert.equal(overflow.report.comparison, undefined);
  assert(Buffer.byteLength(JSON.stringify(overflow.report)) <= 512 * 1024);
});
