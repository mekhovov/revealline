// Common source/archive/process/finalization ownership is reused.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, lstat, mkdir, open, readFile, realpath, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const MiB = 1024 ** 2;
const SOURCE = {
  baseline: 'b11745223861c3973ad4bf440cc536198b8e0371',
  candidate: '3adcd53792043ef02459e86168c6b33a66d6ef00',
};
const PREPARATION_SOURCE = 'bffcbd838a7bb925da8aaf030695773f893d8bda';
const PREPARATION_FIX = 'b5b985f7049537a278632ba82228bb671f7f135a';
const preparationConfirmation = (plan) =>
  plan.release?.format === 'SoloStartPreparationConfirmationReleaseV1';
const finalRecovery = (plan) => plan.release?.format === 'SoloFinalRecoveryConfirmationReleaseV1';
const finalAudio = (plan) => plan.release?.format === 'SoloFinalAudioConfirmationReleaseV1';
const finalSource = (plan) => finalRecovery(plan) || finalAudio(plan);
const repeatedRecovery = (plan) => preparationConfirmation(plan) || finalRecovery(plan);
const FINAL_RECOVERY = Object.freeze({
  candidate: 'a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4',
  candidateTree: '6b13627e324f695b6ee8d9f2dee2eeeb7217c332',
  baseline: '8b01991942dc764b8aa4726851699ce1985e53ae',
  baselineTree: '9373b6a74aea8fa1ef47aa17ace140b4cf714609',
  runtime: '32abd322afd8243e4537ce4784e2f78ee45ecbec',
});
const importDiagnostic = (plan) => plan.release?.format === 'SoloMusicImportDiagnosticReleaseV1';
const rolesFor = (plan, spec) => (importDiagnostic(plan) ? ['candidate'] : spec.roles);
function sourceRevision(plan, role) {
  assert(['baseline', 'candidate'].includes(role));
  if (finalSource(plan)) return FINAL_RECOVERY[role];
  return role === 'candidate' && preparationConfirmation(plan) ? PREPARATION_SOURCE : SOURCE[role];
}
export const AUXILIARY_JOBS = Object.freeze({
  'speech-chromium': {
    recipe: 'speech',
    engine: 'chromium',
    roles: ['baseline', 'candidate'],
    timeoutMs: 540000,
    helperMinutes: 75,
    jobMinutes: 120,
  },
  'music-chromium': {
    recipe: 'music',
    engine: 'chromium',
    roles: ['baseline', 'candidate'],
    timeoutMs: 600000,
    helperMinutes: 75,
    jobMinutes: 120,
  },
  'recovery-chromium': {
    recipe: 'recovery',
    engine: 'chromium',
    roles: ['candidate'],
    timeoutMs: 420000,
    helperMinutes: 60,
    jobMinutes: 105,
  },
  'recovery-webkit': {
    recipe: 'recovery',
    engine: 'webkit',
    roles: ['candidate'],
    timeoutMs: 420000,
    helperMinutes: 60,
    jobMinutes: 105,
  },
  'speech-webkit': {
    recipe: 'speech',
    engine: 'webkit',
    roles: ['baseline', 'candidate'],
    timeoutMs: 540000,
    helperMinutes: 75,
    jobMinutes: 120,
  },
  'music-webkit': {
    recipe: 'music',
    engine: 'webkit',
    roles: ['baseline', 'candidate'],
    timeoutMs: 600000,
    helperMinutes: 75,
    jobMinutes: 120,
  },
});
const HASHES = {
  speech: '235350a6011bd9ebcfa73aa815b6a4c616f945ca67278c64b93a906e8388411d',
  music: 'dd68efc71bb3b75ad8fa28817dd7d99630e312300286d142b24b6fab9990c493',
  recovery: '907929279c5231edb727cad3ff42e45ddf146129215fc27a9a6b809e0cd227d2',
};
function validateRelease(plan) {
  const diagnostic = plan.status === 'reviewed-diagnostic-only';
  assert(diagnostic || plan.status === 'reviewed-and-released');
  assert.equal(plan.release.firstEightAllCorrectnessPassed, !diagnostic);
  if (plan.release.musicProofBytes !== undefined) {
    assert(diagnostic && !repeatedRecovery(plan));
    assert.equal(plan.release.musicProofBytes, 32 * MiB);
  }
  if (diagnostic) {
    assert.equal(
      plan.release.scope,
      finalAudio(plan)
        ? 'independent-final-source-paired-audio-confirmation'
        : finalRecovery(plan)
          ? 'independent-final-source-recovery-confirmation'
          : preparationConfirmation(plan)
            ? 'independent-start-preparation-confirmation'
            : importDiagnostic(plan)
              ? 'independent-audio-import-duration-diagnostic'
              : 'independent-audio-and-synthetic-recovery',
    );
    assert.equal(
      plan.release.predecessorRun,
      finalAudio(plan) ? 38992974900 : finalRecovery(plan) ? 38995660472 : 38985941469,
    );
    assert.equal(plan.release.automaticRetries, 0);
    assert.equal(plan.release.performanceQualification, 'excluded');
  }
  if (finalAudio(plan)) {
    assert(diagnostic, 'Final audio remains paired diagnostic evidence');
    assert.equal(plan.runtimeRevision, FINAL_RECOVERY.runtime);
    assert.equal(plan.release.candidateRevision, FINAL_RECOVERY.candidate);
    assert.equal(plan.release.onceOnlyBefore, FINAL_RECOVERY.candidate);
    assert.deepEqual(plan.release.selectedJobs, [
      'speech-chromium',
      'music-chromium',
      'speech-webkit',
      'music-webkit',
    ]);
    assert.equal(plan.release.musicProofBytes, 32 * MiB);
  }
  if (importDiagnostic(plan)) {
    assert(diagnostic);
    assert.deepEqual(plan.release.selectedJobs, ['music-webkit']);
    assert.equal(plan.release.correction.previousRun, 38995660514);
    assert.deepEqual(plan.release.importProbe, { elements: 8, records: 64 });
    assert.equal(plan.release.musicProofBytes, 32 * MiB);
  } else assert.equal(plan.release.importProbe, undefined);
  if (repeatedRecovery(plan)) {
    assert(diagnostic, 'Start confirmation remains independent correctness evidence');
    if (finalRecovery(plan)) {
      assert.equal(plan.runtimeRevision, FINAL_RECOVERY.runtime);
      assert.equal(plan.release.runtimeFix, undefined);
      assert.equal(plan.release.onceOnlyBefore, FINAL_RECOVERY.candidate);
    } else assert.equal(plan.release.runtimeFix, PREPARATION_FIX);
    assert.equal(plan.release.candidateRevision, sourceRevision(plan, 'candidate'));
    assert.deepEqual(plan.release.selectedJobs, ['recovery-chromium', 'recovery-webkit']);
    assert.deepEqual(plan.release.repetitions, [1, 2, 3]);
  } else assert.equal(plan.release.repetitions, undefined);
  if (plan.release.selectedJobs !== undefined) {
    const selected = plan.release.selectedJobs;
    assert(diagnostic, 'Subset observations require an independent diagnostic release');
    assert(Array.isArray(selected) && selected.length > 0);
    assert.deepEqual(
      selected,
      Object.keys(AUXILIARY_JOBS).filter((job) => selected.includes(job)),
      'Selected jobs must be unique known jobs in declared order',
    );
  }
}
export function validateAuxiliaryPlan(plan) {
  assert.equal(plan.format, 'SoloHostedAuxiliaryPlanV1');
  validateRelease(plan);
  assert.equal(plan.repository, 'mekhovov/revealline');
  assert.equal(plan.maxParallel, 2);
  assert.equal(plan.release.priorProofInspected, true);
  assert.equal(plan.release.noUnclosedOwners, true);
  assert(
    Array.isArray(plan.release.evidence) &&
      plan.release.evidence.length > 0 &&
      plan.release.evidence.length <= 32,
  );
  for (const row of plan.release.evidence) {
    assert(Number.isSafeInteger(row.runId) && row.runId > 0);
    assert(Number.isSafeInteger(row.artifactId) && row.artifactId > 0);
    assert.match(row.artifactSHA256, /^[a-f0-9]{64}$/);
    assert.match(row.summarySHA256, /^[a-f0-9]{64}$/);
  }
  const spec = AUXILIARY_JOBS[plan.job];
  assert(spec);
  if (plan.release.selectedJobs)
    assert(plan.release.selectedJobs.includes(plan.job), 'Job is outside this reviewed release');
  assert.equal(plan.candidate.revision, sourceRevision(plan, 'candidate'));
  if (repeatedRecovery(plan)) {
    assert(plan.release.repetitions.includes(plan.repetition));
    assert.equal(plan.observationId, `${plan.job}-r${plan.repetition}`);
  } else {
    assert.equal(plan.repetition, undefined);
    assert.equal(plan.observationId, undefined);
  }
  assert.equal(plan.baseline.revision, sourceRevision(plan, 'baseline'));
  if (finalSource(plan)) {
    assert.equal(plan.candidate.tree, FINAL_RECOVERY.candidateTree);
    assert.equal(plan.baseline.tree, FINAL_RECOVERY.baselineTree);
  }
  assert.equal(plan.node, '22.13.1');
  assert.equal(plan.playwright, '1.62.1');
  assert.equal(plan.performanceExclusion, true);
  assert.equal(plan.cpu, 1);
  assert.equal(plan.setupTimeoutMs, 2400000);
  assert.equal(plan.fixturePreparationTimeoutMs, 180000);
  assert.equal(plan.helperTimeoutMs, spec.helperMinutes * 60000);
  assert.equal(plan.evidenceBytes, 256 * MiB);
  assert.equal(plan.rowEvidenceBytes, 32 * MiB);
  assert.deepEqual(
    plan.adapterInputs.map((ref) => ref.path),
    [
      'scripts/solo-remote-auxiliary.mjs',
      ...(plan.baseline.reusableArtifact ? ['scripts/solo-remote-baseline.mjs'] : []),
    ],
  );
  assert(plan.frozenTools.length > 0 && plan.frozenTools.length <= 64);
  assert.equal(new Set(plan.frozenTools.map((ref) => ref.path)).size, plan.frozenTools.length);
  assert.deepEqual(
    plan.rows.map(({ id, source, kind, engine, timeoutMs, performanceExclusion }) => ({
      id,
      source,
      kind,
      engine,
      timeoutMs,
      performanceExclusion,
    })),
    rolesFor(plan, spec).map((source) => ({
      id: `${plan.observationId ?? plan.job}-${source}`,
      source,
      kind: 'auxiliary',
      engine: spec.engine,
      timeoutMs: spec.timeoutMs,
      performanceExclusion: true,
    })),
  );
  assert.equal(plan.recipes[spec.recipe].sha256, HASHES[spec.recipe]);
  assert.deepEqual(Object.keys(plan.recipes).sort(), ['music', 'recovery', 'speech']);
  assert.equal(plan.uploads.length, 3);
  assert.equal(new Set(plan.uploads.map((ref) => ref.name)).size, 3);
  for (const ref of [
    ...Object.values(plan.recipes),
    ...plan.uploads,
    ...plan.frozenTools,
    ...plan.adapterInputs,
  ]) {
    assert(!ref.path.split('/').includes('..') && /^(scripts|game|docs)\//.test(ref.path));
    assert.match(ref.sha256, /^[a-f0-9]{64}$/);
    assert(Number.isSafeInteger(ref.bytes) && ref.bytes > 0 && ref.bytes < MiB);
  }
  assert.equal(
    plan.musicBundle.sha256,
    'aa25ae643608cfa9a2dd6aac1a3dcd7ba65d667f998144d0927c194df7c1e99f',
  );
  assert.equal(plan.musicBundle.bytes, 3124928);
  return plan;
}
export function bindAuxiliaryJob(manifest, job, repetition = 1) {
  assert.equal(manifest.format, 'SoloHostedAuxiliaryManifestV1');
  validateRelease(manifest);
  assert.deepEqual(
    manifest.jobs.map(({ id }) => id),
    Object.keys(AUXILIARY_JOBS),
  );
  const spec = AUXILIARY_JOBS[job];
  assert(spec);
  if (manifest.release.selectedJobs)
    assert(manifest.release.selectedJobs.includes(job), 'Job is outside this reviewed release');
  const plan = structuredClone(manifest);
  delete plan.jobs;
  plan.format = 'SoloHostedAuxiliaryPlanV1';
  plan.job = job;
  if (repeatedRecovery(plan)) {
    assert(plan.release.repetitions.includes(repetition));
    plan.repetition = repetition;
    plan.observationId = `${job}-r${repetition}`;
  } else assert.equal(repetition, 1);
  plan.helperTimeoutMs = spec.helperMinutes * 60000;
  plan.rows = rolesFor(plan, spec).map((source) => ({
    id: `${plan.observationId ?? job}-${source}`,
    source,
    kind: 'auxiliary',
    engine: spec.engine,
    timeoutMs: spec.timeoutMs,
    performanceExclusion: true,
  }));
  return validateAuxiliaryPlan(plan);
}
export function auxiliaryMatrix(manifest) {
  validateRelease(manifest);
  return {
    include: (manifest.release.selectedJobs ?? Object.keys(AUXILIARY_JOBS)).flatMap((job) =>
      (manifest.release.repetitions ?? [1]).map((repetition) => {
        const plan = bindAuxiliaryJob(manifest, job, repetition);
        const spec = AUXILIARY_JOBS[plan.job];
        return {
          job,
          observation: plan.observationId ?? job,
          repetition,
          // Final lanes reserve one extra minute for each complete source checkout.
          jobMinutes: spec.jobMinutes + (finalSource(plan) ? 2 : 0),
          stepMinutes: spec.helperMinutes + 3,
          outerSeconds: (spec.helperMinutes + 2) * 60,
        };
      }),
    ),
  };
}
export async function readAuxiliaryJSON(path, maximum = 32 * MiB) {
  const info = await lstat(path);
  assert(info.isFile() && !info.isSymbolicLink() && info.size <= maximum);
  assert.equal(await realpath(path), resolve(path));
  const file = await open(path, 'r');
  try {
    const before = await file.stat();
    assert(before.dev === info.dev && before.ino === info.ino && before.size === info.size);
    const buffer = Buffer.alloc(maximum + 1);
    let count = 0;
    while (count < buffer.length) {
      const part = await file.read(buffer, count, buffer.length - count, count);
      if (!part.bytesRead) break;
      count += part.bytesRead;
    }
    assert(count <= maximum && count === info.size);
    const after = await file.stat();
    assert(after.size === before.size && after.mtimeMs === before.mtimeMs);
    return JSON.parse(buffer.subarray(0, count).toString('utf8'));
  } finally {
    await file.close();
  }
}
async function verifyInputs(ctx) {
  for (const ref of [
    ...Object.values(ctx.plan.recipes),
    ...ctx.plan.uploads,
    ...ctx.plan.frozenTools,
    ...ctx.plan.adapterInputs,
  ]) {
    const path = resolve(ctx.repository, ref.path);
    assert(path.startsWith(ctx.repository + '/'));
    const info = await lstat(path);
    assert(info.isFile() && !info.isSymbolicLink());
    assert.deepEqual(await ctx.digest(path), { bytes: ref.bytes, sha256: ref.sha256 });
  }
}
export async function prepareAuxiliaryMode(ctx) {
  validateAuxiliaryPlan(ctx.plan);
  await verifyInputs(ctx);
  if (finalSource(ctx.plan)) {
    assert.equal(ctx.admitted.status, 'passed');
    const admitted = ctx.admitted.artifacts.candidate;
    assert.equal(admitted.sourceRevision, FINAL_RECOVERY.candidate);
    assert.equal(admitted.sourceTree, FINAL_RECOVERY.candidateTree);
    assert.equal(admitted.manifestSHA256, ctx.plan.candidate.manifestSHA256);
    assert.deepEqual(admitted.archiveIdentity, ctx.plan.candidate.inner);
  }
  const spec = AUXILIARY_JOBS[ctx.plan.job];
  if (rolesFor(ctx.plan, spec).includes('baseline')) await ctx.ensureBaseline();
  const inputs = join(ctx.work, 'auxiliary-inputs');
  await mkdir(inputs);
  const recipe = ctx.plan.recipes[spec.recipe];
  const scenario = join(inputs, 'scenario.qualification.json');
  await copyFile(resolve(ctx.repository, recipe.path), scenario);
  assert.deepEqual(await ctx.digest(scenario), { bytes: recipe.bytes, sha256: recipe.sha256 });
  for (const upload of ctx.plan.uploads) {
    const target = join(inputs, upload.name);
    assert(!upload.name.includes('/') && !upload.name.includes('..'));
    await copyFile(resolve(ctx.repository, upload.path), target);
    assert.deepEqual(await ctx.digest(target), { bytes: upload.bytes, sha256: upload.sha256 });
  }
  let audioFixture = null;
  if (spec.recipe === 'music') {
    const output = join(ctx.work, 'exact-audio-fixtures');
    await ctx.required(
      'exact-audio-fixtures',
      [
        process.execPath,
        join(ctx.here, 'prepare-solo-audio-fixtures.mjs'),
        output,
        '--creator-download',
      ],
      ctx.plan.fixturePreparationTimeoutMs,
    );
    const provenance = await readAuxiliaryJSON(join(output, 'provenance.json'), MiB);
    assert.equal(provenance.status, 'prepared-not-executed');
    const bundle = join(output, 'recorded-music.rlsound');
    assert.deepEqual(await ctx.digest(bundle), {
      bytes: ctx.plan.musicBundle.bytes,
      sha256: ctx.plan.musicBundle.sha256,
    });
    await copyFile(bundle, join(inputs, 'recorded-music.rlsound'));
    assert.deepEqual(await ctx.digest(join(inputs, 'recorded-music.rlsound')), {
      bytes: ctx.plan.musicBundle.bytes,
      sha256: ctx.plan.musicBundle.sha256,
    });
    await copyFile(
      join(output, 'provenance.json'),
      join(ctx.evidence, 'audio-fixture-provenance.json'),
    );
    audioFixture = {
      bytes: ctx.plan.musicBundle.bytes,
      sha256: ctx.plan.musicBundle.sha256,
      scope:
        'Exact public archived recordings imported locally; no remote streaming or audible-output claim.',
    };
  }
  ctx.report.performanceExclusion = true;
  ctx.report.firstEightAllCorrectnessPassed = ctx.plan.release.firstEightAllCorrectnessPassed;
  ctx.report.releaseScope = ctx.plan.release.scope ?? 'after-reviewed-first-eight';
  ctx.report.auxiliaryScope =
    'Linux correctness-only; intrusive audio identity or synthetic handler delivery. No timing, actual GPU loss, physical audio, or thermal qualification.';
  return { recipePath: scenario, browserVersion: null, audioFixture };
}
export function auxiliaryArguments(ctx, row, url, dir) {
  const spec = AUXILIARY_JOBS[ctx.plan.job];
  return [
    join(ctx.here, 'qualify-solo-runtime.mjs'),
    url,
    ctx.modeState.recipePath,
    join(dir, 'report.json'),
    '--server-fixture-access',
    '--work-probe',
    '--cadence=settled120',
    '--cpu=1',
    `--browser=${row.engine}`,
    `--source-revision=${sourceRevision(ctx.plan, row.source)}`,
    ...(row.source === 'baseline' ? ['--baseline-runtime'] : []),
    ...(row.engine === 'webkit' ? ['--context=persistent'] : []),
    ...(spec.recipe !== 'recovery' ? ['--audio-proof'] : []),
    ...(importDiagnostic(ctx.plan) ? ['--audio-proof-import-events'] : []),
    ...(spec.recipe === 'music' && ctx.plan.release.musicProofBytes
      ? ['--audio-proof-music-capacity']
      : []),
  ];
}
export function auxiliaryAssessment(plan, row, raw, command, browserVersion) {
  const spec = AUXILIARY_JOBS[plan.job],
    replay = raw?.replay?.nativeVerification;
  const common =
    command?.status === 'closed' &&
    command.exitCode === 0 &&
    !command.forcedCleanup &&
    !command.cleanupUnconfirmed &&
    !command.violation &&
    command.survivors?.length === 0 &&
    command.ambiguous?.length === 0 &&
    raw?.scenarioStatus === 'pass' &&
    raw.scenarioSHA256 === HASHES[spec.recipe] &&
    raw.sourceRevision === sourceRevision(plan, row.source) &&
    raw.buildIdentity?.sourceRevision === sourceRevision(plan, row.source) &&
    raw.environment?.engine === row.engine &&
    raw.environment?.cpuThrottle === 1 &&
    raw.environment?.contextMode === (row.engine === 'webkit' ? 'persistent' : 'ephemeral') &&
    typeof raw.environment?.browserVersion === 'string' &&
    (!browserVersion || raw.environment.browserVersion === browserVersion) &&
    raw.replay?.scope === 'completed-scenario' &&
    replay?.status === 'pass' &&
    replay.engine === row.engine &&
    replay.browserVersion === raw.environment.browserVersion &&
    raw.pageErrors?.length === 0 &&
    !raw.failure &&
    !raw.finalReadFailure &&
    !raw.failureCleanupFailure &&
    !raw.audioIdentityFailure &&
    !raw.contextCleanupFailure &&
    !raw.replayFailure;
  const audio = raw?.audioIdentity;
  const capacityMatches =
    !plan.release.musicProofBytes ||
    spec.recipe !== 'music' ||
    raw?.audioProofOptions?.aggregateEncodedBytes === plan.release.musicProofBytes;
  const importProbe =
    raw?.actions?.find((action) => action.audioPublicContext?.importProbe?.records?.length)
      ?.audioPublicContext.importProbe ?? raw?.finalState?.audioProof?.importProbe;
  const importProbeComplete =
    !importDiagnostic(plan) ||
    (raw?.audioProofOptions?.importEvents === true &&
      importProbe?.records?.length > 0 &&
      importProbe.records.length <= 64 &&
      importProbe.observedElements > 0 &&
      importProbe.observedElements <= 8 &&
      importProbe.droppedElements === 0 &&
      importProbe.droppedRecords === 0 &&
      importProbe.observerErrors === 0 &&
      importProbe.limits?.elements === 8 &&
      importProbe.limits?.records === 64);
  const admitted =
    spec.recipe === 'recovery'
      ? raw?.performanceGateStatus === 'excluded-synthetic-recovery'
      : raw?.performanceGateStatus === 'excluded-audio-identity-profiling' &&
        audio?.status === 'pass' &&
        [
          audio.pending,
          audio.failed,
          audio.capped,
          audio.droppedStarts,
          audio.droppedMediaEvents,
        ].every((n) => n === 0);
  return {
    status: common && admitted && capacityMatches && importProbeComplete ? 'passed' : 'failed',
    ...(importDiagnostic(plan)
      ? { importProbe: importProbeComplete ? 'recorded-within-bounds' : 'incomplete' }
      : {}),
    correctness: common ? 'pass' : 'fail',
    performanceQualification: 'excluded',
    firstEightAllCorrectnessPassed: plan.release.firstEightAllCorrectnessPassed,
    audioIdentity: spec.recipe === 'recovery' ? 'not-requested' : (audio?.status ?? 'unobserved'),
    scope:
      spec.recipe === 'recovery'
        ? 'Synthetic main-display loss/restore+blur/resize/explicit Resume only; no Demo or actual GPU-loss credit.'
        : 'Exact encoded identity linked to native API starts/advancement; no listening/speaker or video-approval claim.',
  };
}
export async function runAuxiliaryRow(ctx, row, dir, tmp) {
  await verifyInputs(ctx);
  const { startProductionPreview } = await import(
    pathToFileURL(join(ctx.here, 'serve-production-preview.mjs')).href
  );
  const { PUBLIC_SECURITY_HEADERS } = await import(
    pathToFileURL(join(ctx.here, 'game-cli.mjs')).href
  );
  let server;
  try {
    server = await startProductionPreview({
      root: ctx.payloads[row.source],
      port: 0,
      fixtureAccess: true,
      cache: 'policy',
    });
    const response = await fetch(new URL('game/build-info.json', server.url), {
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(response.status, 200);
    const bytes = Buffer.from(await response.arrayBuffer()),
      build = JSON.parse(bytes);
    assert.equal(build.sourceRevision, sourceRevision(ctx.plan, row.source));
    for (const [name, value] of Object.entries(PUBLIC_SECURITY_HEADERS))
      assert.equal(response.headers.get(name), value);
    const url = new URL('game/?journey=opening', server.url).href;
    row.served = {
      url,
      build,
      buildInfoSHA256: createHash('sha256').update(bytes).digest('hex'),
      headers: server.headers,
      mode: server.mode,
      fixtureAccess: server.fixtureAccess,
    };
    row.artifactAdmission = ctx.admitted.artifacts[row.source];
    row.command = await ctx.run(
      row.id,
      [process.execPath, ...auxiliaryArguments(ctx, row, url, dir)],
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
    const raw = await readAuxiliaryJSON(join(dir, 'report.json'));
    Object.assign(
      row,
      auxiliaryAssessment(ctx.plan, row, raw, row.command, ctx.modeState.browserVersion),
    );
    row.browserVersion = raw.environment?.browserVersion;
    assert.equal(typeof row.browserVersion, 'string');
    if (ctx.modeState.browserVersion)
      assert.equal(row.browserVersion, ctx.modeState.browserVersion);
    else ctx.modeState.browserVersion = row.browserVersion;
    await verifyInputs(ctx);
  } finally {
    if (server)
      await Promise.race([
        new Promise((yes, no) => {
          server.server.close((error) => (error ? no(error) : yes()));
          server.server.closeAllConnections();
        }),
        delay(10000).then(() => {
          throw Error('Auxiliary owned preview close deadline');
        }),
      ]).catch((error) => {
        row.serverCleanupFailure = String(error);
        row.status = 'failed';
        throw error;
      });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, input, output, job, repetition = '1'] = process.argv.slice(2);
  const bytes = await readFile(input);
  if (mode === 'matrix-plan')
    process.stdout.write(`matrix=${JSON.stringify(auxiliaryMatrix(JSON.parse(bytes)))}\n`);
  else {
    assert.equal(mode, 'bind-plan');
    const plan = bindAuxiliaryJob(JSON.parse(bytes), job, Number(repetition));
    plan.manifestInput = {
      path: resolve(input),
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
    await writeFile(output, JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
  }
}
