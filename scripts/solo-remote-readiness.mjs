// Held source-specific correctness pilot; no performance qualification or retries.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, open, readFile, realpath, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
const MiB = 1024 ** 2;
const sha = (b) => createHash('sha256').update(b).digest('hex');
export const READINESS_SOURCE = Object.freeze({
  revision: 'ab45bfde5d54d612cbba9b038a46f13d13f417ec',
  tree: '0d8238992621613883efcf0c73a9f4d88f3fcb10',
});
export const READINESS_FIXTURE = Object.freeze({
  path: 'docs/performance/fixtures/solo-remote-timing/cold-first30.qualification.fixture',
  bytes: 6387,
  sha256: 'aa3a4c98c6f272ea515d1e8c9e0fb3238d78782065bfb96ae8fe4e304041e2c5',
});
export const READINESS_ENGINES = ['chromium', 'webkit'];
export function readinessRow(engine) {
  assert(READINESS_ENGINES.includes(engine));
  return {
    id: `readiness-${engine}`,
    kind: 'readiness',
    source: 'candidate',
    engine,
    timeoutMs: 480000,
    performanceExclusion: true,
  };
}
export function validateReadinessPlan(plan) {
  assert.equal(plan.format, 'SoloHostedReadinessPlanV1');
  assert.equal(plan.status, 'reviewed-readiness-diagnostic-only');
  assert.equal(plan.sourceCohort, 'readiness-candidateab45');
  assert.equal(plan.phase, 'cold-first30');
  assert.equal(plan.repository, 'mekhovov/revealline');
  assert.equal(plan.node, '22.13.1');
  assert.equal(plan.playwright, '1.62.1');
  assert.equal(plan.candidate.revision, READINESS_SOURCE.revision);
  assert.equal(plan.candidate.tree, READINESS_SOURCE.tree);
  assert.equal(plan.runtimeRevision, READINESS_SOURCE.revision);
  assert.deepEqual(plan.baseline, {
    revision: '8b01991942dc764b8aa4726851699ce1985e53ae',
    tree: '9373b6a74aea8fa1ef47aa17ace140b4cf714609',
  });
  assert.equal(plan.cpu, 1);
  assert.equal(plan.maxParallel, 2);
  assert.equal(plan.automaticRetries, 0);
  assert.equal(plan.performanceExclusion, true);
  assert.equal(plan.hitchJournal, 'bounded-v1');
  assert.equal(plan.setupTimeoutMs, 40 * 60000);
  assert.equal(plan.helperTimeoutMs, 75 * 60000);
  assert.equal(plan.rowEvidenceBytes, 32 * MiB);
  assert.equal(plan.evidenceBytes, 256 * MiB);
  assert.deepEqual(plan.fixture, READINESS_FIXTURE);
  assert.deepEqual(plan.rows, [readinessRow(plan.engine)]);
  assert.deepEqual(plan.protocol, {
    name: 'first-running-v1',
    startupWait: 'immediate-partial',
    externalCadence: 'settled120',
    observationTimeoutMs: 240000,
    records: 8,
    bytes: 16384,
    numericalGates: 'unchanged-raw',
    performanceQualification: false,
  });
  assert.equal(plan.release.scope, 'independent-native-readiness-pilot');
  assert.equal(
    plan.release.readinessPrerequisite,
    'diagnosticStatus-passed-and-readinessCorrectness-pass',
  );
  assert.equal(plan.release.candidateRevision, READINESS_SOURCE.revision);
  assert.equal(plan.release.firstEightAllCorrectnessPassed, false);
  assert.equal(plan.release.performanceQualification, 'excluded');
  assert.equal(plan.release.physicalQualification, 'unobserved');
  assert.equal(plan.release.automaticRetries, 0);
  assert.equal(plan.release.priorProofInspected, true);
  assert.equal(plan.release.noUnclosedOwners, true);
  assert.match(plan.release.onceOnlyBefore, /^[a-f0-9]{40}$/);
  for (const key of ['run', 'artifact'])
    assert(Number.isSafeInteger(plan.candidate[key]) && plan.candidate[key] > 0);
  for (const key of ['outer', 'inner']) {
    assert(
      Number.isSafeInteger(plan.candidate[key]?.bytes) &&
        plan.candidate[key].bytes > 0 &&
        plan.candidate[key].bytes <= 2 * 1024 ** 3,
    );
    assert.match(plan.candidate[key].sha256, /^[a-f0-9]{64}$/);
  }
  assert.match(plan.candidate.manifestSHA256, /^[a-f0-9]{64}$/);
  assert.deepEqual(
    plan.adapterInputs.map((r) => r.path),
    ['scripts/solo-remote-readiness.mjs'],
  );
  assert(plan.frozenTools.length > 0 && plan.frozenTools.length <= 64);
  const refs = [...plan.adapterInputs, ...plan.frozenTools, plan.fixture];
  assert.equal(new Set(refs.map((r) => r.path)).size, refs.length);
  for (const r of refs) {
    assert(/^(scripts|docs)\/[a-zA-Z0-9_./-]+$/.test(r.path) && !r.path.split('/').includes('..'));
    assert(Number.isSafeInteger(r.bytes) && r.bytes > 0 && r.bytes < MiB);
    assert.match(r.sha256, /^[a-f0-9]{64}$/);
  }
  for (const path of [
    'run-solo-remote-correctness.mjs',
    'verify-solo-build.mjs',
    'solo-remote-archive.py',
    'serve-production-preview.mjs',
    'game-cli.mjs',
    'qualify-solo-runtime.mjs',
    'solo-qualification-readiness.mjs',
    'solo-readiness-gpu.mjs',
    'solo-qualification-hitch-journal.mjs',
    'solo-remote-sustained.mjs',
    'solo-qualification-cadence.mjs',
    'solo-qualification-native-replay.mjs',
    'solo-qualification-export.mjs',
    'solo-qualification.mjs',
    'soundtrack-distribution.mjs',
    'optional-distribution.mjs',
    'external-distribution.mjs',
    'optional-artwork.mjs',
  ])
    assert(
      plan.frozenTools.some((r) => r.path === 'scripts/' + path),
      path,
    );
  return plan;
}
export function bindReadinessJob(manifest, engine) {
  assert.equal(manifest.format, 'SoloHostedReadinessManifestV1');
  assert.deepEqual(manifest.engines, READINESS_ENGINES);
  const plan = structuredClone(manifest);
  delete plan.engines;
  plan.format = 'SoloHostedReadinessPlanV1';
  plan.engine = engine;
  plan.rows = [readinessRow(engine)];
  return validateReadinessPlan(plan);
}
export function readinessMatrix(manifest) {
  return {
    include: READINESS_ENGINES.map((engine) => {
      bindReadinessJob(manifest, engine);
      return { engine, jobMinutes: 130, stepMinutes: 78, outerSeconds: 4620 };
    }),
  };
}
async function inputs(ctx) {
  for (const ref of [...ctx.plan.adapterInputs, ...ctx.plan.frozenTools, ctx.plan.fixture]) {
    const path = resolve(ctx.repository, ref.path);
    assert(path.startsWith(ctx.repository + '/') && (await realpath(path)) === path);
    const s = await lstat(path);
    assert(s.isFile() && !s.isSymbolicLink());
    assert.deepEqual(await ctx.digest(path), { bytes: ref.bytes, sha256: ref.sha256 });
  }
}
export async function prepareReadinessMode(ctx) {
  validateReadinessPlan(ctx.plan);
  await inputs(ctx);
  assert.equal(ctx.admitted.status, 'passed');
  const a = ctx.admitted.artifacts.candidate;
  assert.equal(a.sourceRevision, READINESS_SOURCE.revision);
  assert.equal(a.sourceTree, READINESS_SOURCE.tree);
  assert.equal(a.manifestSHA256, ctx.plan.candidate.manifestSHA256);
  assert.deepEqual(a.archiveIdentity, ctx.plan.candidate.inner);
  ctx.report.performanceExclusion = true;
  ctx.report.firstEightAllCorrectnessPassed = false;
  return {
    scope:
      'One candidate correctness pilot per engine; no timing comparison, forced calibration delay, automatic retry or physical-device qualification.',
  };
}
export function readinessArguments(ctx, row, url, dir) {
  return [
    join(ctx.here, 'qualify-solo-runtime.mjs'),
    url,
    resolve(ctx.repository, ctx.plan.fixture.path),
    join(dir, 'report.json'),
    `--source-revision=${READINESS_SOURCE.revision}`,
    '--server-fixture-access',
    `--browser=${row.engine}`,
    '--cpu=1',
    '--work-probe',
    '--hitch-journal',
    '--cadence=settled120',
    '--readiness-probe=first-running-v1',
    ...(row.engine === 'webkit'
      ? ['--context=persistent', '--viewport=400x850', '--dpr=3', '--mobile-context']
      : []),
  ];
}
export async function readReadinessJSON(path) {
  const s = await lstat(path);
  assert(s.isFile() && !s.isSymbolicLink() && s.size > 0 && s.size <= 16 * MiB);
  assert.equal(await realpath(path), resolve(path));
  const f = await open(path, 'r');
  try {
    const opened = await f.stat();
    assert(opened.dev === s.dev && opened.ino === s.ino && opened.size === s.size);
    const b = Buffer.alloc(s.size + 1);
    let n = 0;
    while (n < b.length) {
      const part = await f.read(b, n, b.length - n, n);
      if (!part.bytesRead) break;
      n += part.bytesRead;
    }
    const after = await f.stat();
    assert(n === s.size && after.size === s.size && after.mtimeMs === s.mtimeMs);
    const linked = await lstat(path);
    assert(
      linked.dev === s.dev &&
        linked.ino === s.ino &&
        linked.size === s.size &&
        linked.mtimeMs === s.mtimeMs,
    );
    return JSON.parse(b.subarray(0, n));
  } finally {
    await f.close();
  }
}
export async function readinessAssessment(plan, row, raw, command, journal) {
  const { assessReadinessPilot } = await import('./solo-qualification-readiness.mjs');
  const readiness = assessReadinessPilot(
    raw?.readinessObservation,
    raw?.snapshots?.at(-1)?.application,
    raw?.readinessDocuments,
  );
  let failure = null;
  try {
    assert.equal(command.status, 'closed');
    assert([0, 2].includes(command.exitCode));
    assert(!command.forcedCleanup && !command.cleanupUnconfirmed && !command.violation);
    assert.deepEqual(command.survivors, []);
    assert.deepEqual(command.ambiguous, []);
    assert.equal(raw.format, 'SoloQualificationReportV1');
    assert.equal(raw.kind, 'readiness-diagnostic');
    assert.equal(raw.scenarioKind, 'performance');
    assert.equal(raw.scenarioStatus, 'pass');
    assert.equal(raw.scenarioSHA256, plan.fixture.sha256);
    assert.equal(raw.sourceRevision, READINESS_SOURCE.revision);
    assert.equal(raw.buildIdentity.sourceRevision, READINESS_SOURCE.revision);
    assert.equal(raw.environment.engine, row.engine);
    assert.equal(typeof raw.environment.browserVersion, 'string');
    assert.equal(raw.environment.cpuThrottle, 1);
    const graphics = raw.environment.graphicsCapability;
    assert.equal(graphics?.format, 'SoloReadinessGpuCapabilityV1');
    assert.equal(graphics.engine, row.engine);
    assert.equal(graphics.canProceed, true);
    assert.equal(graphics.requestBudgetMs, 5000);
    assert.equal(graphics.cleanupBudgetMs, 2000);
    assert.equal(graphics.maximumBytes, 16384);
    assert(Buffer.byteLength(JSON.stringify(graphics)) <= 16384);
    assert(['response-observed', 'unsupported'].includes(graphics.status));
    if (graphics.status === 'response-observed' || graphics.failureStage === 'get-info') {
      assert.equal(row.engine, 'chromium');
      assert.equal(graphics.requestSettled, true);
      assert.equal(graphics.sessionDetached, true);
    } else {
      assert.equal(graphics.status, 'unsupported');
      assert.equal(graphics.requestSettled, false);
      assert.equal(graphics.sessionDetached, false);
      assert.equal(
        graphics.reason,
        row.engine === 'webkit' ? 'non-chromium-engine' : 'browser-session-api-unavailable',
      );
    }
    assert(!graphics.requestTimedOut && !graphics.cleanupFailure && !graphics.creationTimedOut);
    assert.equal(raw.environment.contextMode, row.engine === 'webkit' ? 'persistent' : 'ephemeral');
    if (row.engine === 'webkit') {
      const c = raw.environment.contextOwner?.cleanup;
      assert.equal(c?.status, 'closed');
      assert(c.profileRemoved && c.browserClosed);
    }
    assert.equal(raw.workProbe, true);
    assert.equal(raw.cadenceProtocol, 'settled120');
    assert.equal(raw.cacheMode, 'fresh-context');
    assert.equal(raw.baselineRuntime, false);
    assert.equal(raw.readinessPilot.protocol, 'first-running-v1');
    assert.equal(raw.readinessPilot.performanceQualification, false);
    assert.equal(raw.startupCadenceObservations.length, 1);
    assert.equal(
      raw.startupCadenceObservations[0].pilotStartupWait,
      'omitted; immediate partial samples retained',
    );
    assert.deepEqual(raw.readinessAssessment, readiness);
    assert.equal(readiness.status, 'passed');
    assert.equal(journal?.status, 'complete');
    assert(
      !raw.hitchJournalFailure && !Object.hasOwn(raw, 'performanceGateStatusBeforeHitchJournal'),
    );
    assert.deepEqual(raw.pageErrors, []);
    for (const key of [
      'failure',
      'readinessFailure',
      'gpuSetupFailure',
      'replayFailure',
      'contextCleanupFailure',
      'finalReadFailure',
      'failureCleanupFailure',
    ])
      assert(!raw[key], key);
    assert.equal(raw.replay.scope, 'completed-scenario');
    const native = raw.replay.nativeVerification;
    assert.equal(native.status, 'pass');
    assert.equal(native.engine, row.engine);
    assert.equal(native.browserVersion, raw.environment.browserVersion);
    assert.equal(native.observation?.match, true);
    assert(raw.actions.every((a) => a.status === 'pass'));
  } catch (error) {
    failure = String(error.message ?? error).slice(0, 2048);
  }
  const numeric = raw?.performanceGateStatus ?? 'unobserved';
  return {
    status: failure
      ? 'failed'
      : numeric === 'pass-observed-window'
        ? 'passed'
        : ['fail', 'invalid-evidence'].includes(numeric)
          ? 'failed'
          : 'inconclusive',
    readinessCorrectness: failure ? 'fail' : 'pass',
    diagnosticStatus: failure ? 'failed' : 'passed',
    readinessAssessment: readiness,
    readinessFailure: failure,
    rawPerformanceGateStatus: numeric,
    numericObservationStatus: numeric,
    hitchJournalVerification: journal,
    firstEightAllCorrectnessPassed: false,
    performanceQualification: 'excluded',
    scope:
      'Independent readiness acknowledgment only. Raw timing failures remain non-passing; one observation per engine cannot qualify general performance.',
  };
}
export async function runReadinessRow(ctx, row, dir, tmp) {
  await inputs(ctx);
  const { startProductionPreview } = await import(
    pathToFileURL(join(ctx.here, 'serve-production-preview.mjs'))
  );
  const { PUBLIC_SECURITY_HEADERS } = await import(pathToFileURL(join(ctx.here, 'game-cli.mjs')));
  let server;
  try {
    server = await startProductionPreview({
      root: ctx.payloads.candidate,
      port: 0,
      fixtureAccess: true,
      cache: 'policy',
    });
    const response = await fetch(new URL('game/build-info.json', server.url), {
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(response.status, 200);
    for (const [key, value] of Object.entries(PUBLIC_SECURITY_HEADERS))
      assert.equal(response.headers.get(key), value);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert(bytes.length < MiB);
    const build = JSON.parse(bytes);
    assert.equal(build.sourceRevision, READINESS_SOURCE.revision);
    const url = new URL('game/?journey=opening', server.url).href;
    row.served = {
      url,
      build,
      buildInfoSHA256: sha(bytes),
      headers: server.headers,
      mode: server.mode,
      fixtureAccess: server.fixtureAccess,
    };
    row.artifactAdmission = ctx.admitted.artifacts.candidate;
    row.command = await ctx.run(
      row.id,
      [process.execPath, ...readinessArguments(ctx, row, url, dir)],
      row.timeoutMs,
      {
        env: { ...ctx.cleanEnv, TMPDIR: tmp },
        log: join(dir, 'command.log'),
        receipt: join(dir, 'command.json'),
        inspect: async () => {
          await ctx.inspect();
          assert((await ctx.evidenceSize(dir)) <= ctx.plan.rowEvidenceBytes);
        },
      },
    );
    const output = join(dir, 'report.json'),
      raw = await readReadinessJSON(output);
    const { verifyTimingHitchJournal } = await import('./solo-remote-sustained.mjs');
    const journal = await verifyTimingHitchJournal(ctx.plan, raw, output, url);
    Object.assign(row, await readinessAssessment(ctx.plan, row, raw, row.command, journal));
    row.browserVersion = raw.environment?.browserVersion;
    if (raw.replay) {
      assert.equal(raw.replay.file, output + '.replay.json');
      assert(raw.replay.bytes <= 16 * MiB);
      assert.deepEqual(await ctx.digest(raw.replay.file), {
        bytes: raw.replay.bytes,
        sha256: raw.replay.sha256,
      });
    }
    await inputs(ctx);
  } catch (error) {
    row.readinessCorrectness = 'fail';
    row.diagnosticStatus = 'failed';
    throw error;
  } finally {
    if (server)
      await Promise.race([
        new Promise((yes, no) => {
          server.server.close((e) => (e ? no(e) : yes()));
          server.server.closeAllConnections();
        }),
        delay(10000).then(() => {
          throw Error('Readiness preview close deadline');
        }),
      ]).catch((error) => {
        row.serverCleanupFailure = String(error);
        row.status = 'failed';
        row.readinessCorrectness = 'fail';
        row.diagnosticStatus = 'failed';
        throw error;
      });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, input, output, engine] = process.argv.slice(2);
  const bytes = await readFile(input),
    manifest = JSON.parse(bytes);
  if (mode === 'matrix-plan')
    process.stdout.write(`matrix=${JSON.stringify(readinessMatrix(manifest))}\n`);
  else {
    assert.equal(mode, 'bind-plan');
    const plan = bindReadinessJob(manifest, engine);
    plan.manifestInput = { path: resolve(input), bytes: bytes.length, sha256: sha(bytes) };
    await writeFile(output, JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
  }
}
