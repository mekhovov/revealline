import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, realpath, open, readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
const MiB = 1024 ** 2;
export const RASTER_CASES = ['full', 'reduced', 'minimal'].flatMap((quality) =>
  ['settled', 'acquire', 'warning', 'active'].map((mode) => ({ quality, mode })),
);
export const RASTER_JOBS = ['raster-chromium', 'raster-webkit'];
export function validateRasterPlan(plan) {
  assert.equal(plan.format, 'SoloHostedRasterPlanV1');
  assert.equal(plan.status, 'reviewed-and-released');
  assert.equal(plan.release?.status, 'reviewed');
  assert.equal(plan.release.candidateRevision, plan.candidate.revision);
  assert.equal(plan.repository, 'mekhovov/revealline');
  assert.equal(plan.node, '22.13.1');
  assert.equal(plan.playwright, '1.62.1');
  assert.equal(plan.performanceExclusion, true);
  assert.equal(plan.maxParallel, 2);
  assert(RASTER_JOBS.includes(plan.job));
  assert.match(plan.candidate.revision, /^[a-f0-9]{40}$/);
  assert.match(plan.candidate.tree, /^[a-f0-9]{40}$/);
  for (const k of ['run', 'artifact'])
    assert(Number.isSafeInteger(plan.candidate[k]) && plan.candidate[k] > 0);
  for (const k of ['inner', 'outer']) {
    assert.match(plan.candidate[k].sha256, /^[a-f0-9]{64}$/);
    assert(Number.isSafeInteger(plan.candidate[k].bytes) && plan.candidate[k].bytes > 0);
  }
  assert.match(plan.candidate.manifestSHA256, /^[a-f0-9]{64}$/);
  assert.equal(plan.setupTimeoutMs, 40 * 60000);
  assert.equal(plan.helperTimeoutMs, 75 * 60000);
  assert.equal(plan.rowEvidenceBytes, 128 * MiB);
  assert.equal(plan.evidenceBytes, 256 * MiB);
  assert.deepEqual(plan.rows, [
    {
      id: plan.job,
      kind: 'raster',
      source: 'candidate',
      engine: plan.job.slice(7),
      timeoutMs: 1200000,
    },
  ]);
  assert.equal(plan.raster.observationTimeoutMs, 120000);
  assert.equal(plan.raster.retryCount, 0);
  assert.equal(plan.raster.pixelTolerance, 0);
  assert.deepEqual(plan.raster.cases, RASTER_CASES);
  assert.equal(plan.raster.conditionalLocalization, true);
  assert.deepEqual(
    plan.adapterInputs.map((r) => r.path),
    ['scripts/solo-remote-raster.mjs'],
  );
  assert(plan.frozenTools.length > 0 && plan.frozenTools.length <= 32);
  const refs = [
    ...plan.frozenTools,
    ...plan.adapterInputs,
    plan.raster.fixture,
    ...Object.values(plan.raster.primitiveInputs).flat(),
  ];
  assert.equal(new Set(plan.frozenTools.map((r) => r.path)).size, plan.frozenTools.length);
  for (const r of refs) {
    assert(/^(scripts|docs)\/[a-zA-Z0-9_./-]+$/.test(r.path) && !r.path.split('/').includes('..'));
    assert.match(r.sha256, /^[a-f0-9]{64}$/);
    assert(Number.isSafeInteger(r.bytes) && r.bytes > 0 && r.bytes < MiB);
  }
  assert.equal(
    plan.raster.fixture.sha256,
    '3cee13dba69ac219a54924a0a9663e03fa18115e02e9d79eb9503b8c62ae2a6b',
  );
  assert.deepEqual(Object.keys(plan.raster.primitiveInputs).sort(), [
    'atlasUploads',
    'originalAfterNoiseComparators',
    'postTintPNGs',
  ]);
  assert.equal(plan.raster.primitiveInputs.atlasUploads.length, 8);
  assert.equal(plan.raster.primitiveInputs.postTintPNGs.length, 2);
  assert.equal(plan.raster.primitiveInputs.originalAfterNoiseComparators.length, 2);
  return plan;
}
export function bindRasterJob(manifest, job) {
  assert.equal(manifest.format, 'SoloHostedRasterManifestV1');
  assert.equal(manifest.status, 'reviewed-and-released');
  assert.deepEqual(manifest.jobs, RASTER_JOBS);
  assert(RASTER_JOBS.includes(job));
  const plan = structuredClone(manifest);
  delete plan.jobs;
  plan.format = 'SoloHostedRasterPlanV1';
  plan.job = job;
  plan.rows = [
    { id: job, kind: 'raster', source: 'candidate', engine: job.slice(7), timeoutMs: 1200000 },
  ];
  return validateRasterPlan(plan);
}
export async function readRasterJSON(path, maximum = 4 * MiB) {
  const before = await lstat(path);
  assert(before.isFile() && !before.isSymbolicLink() && before.size <= maximum);
  assert.equal(await realpath(path), resolve(path));
  const file = await open(path, 'r');
  try {
    const stat = await file.stat();
    assert(stat.dev === before.dev && stat.ino === before.ino && stat.size === before.size);
    const buffer = Buffer.alloc(maximum + 1);
    let count = 0;
    while (count < buffer.length) {
      const n = (await file.read(buffer, count, buffer.length - count, null)).bytesRead;
      if (!n) break;
      count += n;
    }
    assert(count <= maximum && count === before.size);
    return JSON.parse(buffer.subarray(0, count));
  } finally {
    await file.close();
  }
}
export function strictControlReproduced(value, count) {
  if (!value?.clean || value.status !== 'failed-strict-invariants' || value.cases?.length !== count)
    return false;
  if (
    JSON.stringify(value.invariantFailures) !==
    JSON.stringify(['Identical-input raster differs; concealment unobserved: full/acquire'])
  )
    return false;
  const expected = count === 12 ? RASTER_CASES : RASTER_CASES.slice(0, 2);
  if (
    !value.cases.every((r, i) => r.quality === expected[i].quality && r.mode === expected[i].mode)
  )
    return false;
  const first = value.cases[0],
    second = value.cases[1];
  return (
    first.determinism?.length === 2 &&
    first.determinism.every((x) => x.equal === true) &&
    second.determinism?.length === 2 &&
    second.determinism[0].equal === false &&
    second.determinism[1].equal === true
  );
}
export function primitiveInputPremises(inputs) {
  assert.equal(inputs.postTintPNGs.length, 2);
  assert.equal(inputs.atlasUploads.length, 8);
  assert.equal(inputs.originalAfterNoiseComparators.length, 2);
  assert.equal(inputs.postTintPNGs[0].sha256, inputs.postTintPNGs[1].sha256);
  assert.equal(inputs.postTintPNGs[0].base64, inputs.postTintPNGs[1].base64);
  assert.equal(new Set(inputs.atlasUploads.map((r) => `${r.owner}/${r.index}`)).size, 8);
  for (let index = 0; index < 4; index++) {
    const a = inputs.atlasUploads.find((r) => r.owner === 5 && r.index === index);
    const b = inputs.atlasUploads.find((r) => r.owner === 7 && r.index === index);
    assert(a && b);
    assert.equal(a.bytes, 16384);
    assert.equal(b.bytes, 16384);
    assert.equal(a.sha256, b.sha256);
    assert.equal(a.base64, b.base64);
  }
  return true;
}
export function rasterAssessment(raw, command, source, engine) {
  const clean =
    command?.status === 'closed' &&
    !command.forcedCleanup &&
    !command.cleanupUnconfirmed &&
    !command.violation &&
    command.survivors?.length === 0 &&
    command.ambiguous?.length === 0;
  const primary = raw?.primary;
  const complete =
    clean &&
    raw?.format === 'SoloHostedNativeRasterV1' &&
    raw.sourceRevision === source &&
    raw.engine === engine &&
    typeof raw.browserVersion === 'string' &&
    primary?.clean &&
    primary?.cases?.length === 12 &&
    primary.cases.every(
      (r, i) => r.quality === RASTER_CASES[i].quality && r.mode === RASTER_CASES[i].mode,
    ) &&
    !raw.failure;
  const pass =
    complete &&
    command.exitCode === 0 &&
    raw.status === 'automated-invariants-pass-visual-review-pending' &&
    primary.invariantFailures.length === 0;
  return {
    status: pass ? 'passed' : 'failed',
    raster: pass
      ? 'automated-invariants-pass-visual-review-pending'
      : complete
        ? 'failed-strict-invariants'
        : 'incomplete',
    performanceQualification: 'excluded',
    physicalQualification: 'unobserved',
    historicalMacFailure: 'retained-unresolved',
    localization: raw?.localizationDisposition ?? 'separate-diagnostic-results-retained',
  };
}
async function verifyInputs(ctx) {
  for (const r of [
    ...ctx.plan.frozenTools,
    ...ctx.plan.adapterInputs,
    ctx.plan.raster.fixture,
    ...Object.values(ctx.plan.raster.primitiveInputs).flat(),
  ]) {
    const p = resolve(ctx.repository, r.path);
    assert.equal(await realpath(p), p);
    assert((await lstat(p)).isFile());
    assert.deepEqual(await ctx.digest(p), { bytes: r.bytes, sha256: r.sha256 });
  }
}
export async function prepareRasterMode(ctx) {
  await verifyInputs(ctx);
  assert.equal(ctx.admitted.status, 'passed');
  assert.equal(ctx.admitted.artifacts.candidate.sourceRevision, ctx.plan.candidate.revision);
  const inputs = join(ctx.evidence, 'raster-inputs');
  await mkdir(inputs);
  for (const r of [
    ctx.plan.raster.fixture,
    ...Object.values(ctx.plan.raster.primitiveInputs).flat(),
  ]) {
    const name = r.path.split('/').at(-1);
    await copyFile(join(ctx.repository, r.path), join(inputs, name));
    assert.deepEqual(await ctx.digest(join(inputs, name)), { bytes: r.bytes, sha256: r.sha256 });
  }
  return {
    scope:
      'Fresh Linux native-API synthetic full12; default browser backend is not inferred as GPU, and historical Mac failure remains unresolved.',
  };
}
export async function runRasterRow(ctx, row, dir, tmp) {
  await verifyInputs(ctx);
  const { startProductionPreview } = await import(
    pathToFileURL(join(ctx.here, 'serve-production-preview.mjs'))
  );
  const { PUBLIC_SECURITY_HEADERS } = await import(pathToFileURL(join(ctx.here, 'game-cli.mjs')));
  let server;
  try {
    server = await startProductionPreview({
      root: ctx.payloads.candidate,
      port: 0,
      fixtureAccess: false,
      cache: 'policy',
    });
    const response = await fetch(new URL('game/build-info.json', server.url), {
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(response.status, 200);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert(bytes.length < MiB);
    const build = JSON.parse(bytes);
    assert.equal(build.sourceRevision, ctx.plan.candidate.revision);
    for (const [key, value] of Object.entries(PUBLIC_SECURITY_HEADERS))
      assert.equal(response.headers.get(key), value);
    const manifest = await readRasterJSON(join(ctx.payloads.candidate, 'manifest.json'), 32 * MiB);
    const resources = manifest.files
      .filter(
        (r) =>
          r.path.endsWith('.mjs') ||
          ['authoring/motion-lab/presets.json', 'game/content/themes.json'].includes(r.path),
      )
      .map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 }));
    assert(resources.length <= 8000);
    const absolute = (r) => ({ ...r, path: resolve(ctx.repository, r.path) });
    const execution = {
      format: 'SoloHostedRasterExecutionV1',
      sourceRevision: ctx.plan.candidate.revision,
      engine: row.engine,
      address: new URL('game/', server.url).href,
      artifact: {
        ...ctx.admitted.artifacts.candidate,
        buildInfoSHA256: createHash('sha256').update(bytes).digest('hex'),
      },
      scratch: tmp,
      browserModule: ctx.browserModule,
      chromeExecutable: ctx.chromeExecutable,
      observationTimeoutMs: 120000,
      fixture: absolute(ctx.plan.raster.fixture),
      primitiveInputs: Object.fromEntries(
        Object.entries(ctx.plan.raster.primitiveInputs).map(([key, refs]) => [
          key,
          refs.map(absolute),
        ]),
      ),
      resources,
    };
    const executionPath = join(dir, 'execution-plan.json');
    await writeFile(executionPath, JSON.stringify(execution, null, 2) + '\n', { flag: 'wx' });
    row.served = {
      address: execution.address,
      fixtureAccess: server.fixtureAccess,
      mode: server.mode,
      build,
    };
    row.artifactAdmission = ctx.admitted.artifacts.candidate;
    row.command = await ctx.run(
      row.id,
      [
        process.execPath,
        join(ctx.here, 'observe-solo-native-raster.mjs'),
        executionPath,
        join(dir, 'raster'),
      ],
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
    const raw = await readRasterJSON(join(dir, 'raster/report.json'));
    Object.assign(row, rasterAssessment(raw, row.command, ctx.plan.candidate.revision, row.engine));
    row.browserVersion = raw.browserVersion;
    await verifyInputs(ctx);
  } finally {
    if (server)
      await Promise.race([
        new Promise((yes, no) => {
          server.server.close((e) => (e ? no(e) : yes()));
          server.server.closeAllConnections();
        }),
        delay(10000).then(() => {
          throw Error('Raster owned preview close deadline');
        }),
      ]).catch((e) => {
        row.serverCleanupFailure = String(e);
        row.status = 'failed';
        throw e;
      });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, input, output, job] = process.argv.slice(2),
    manifest = await readRasterJSON(input, 2 * MiB);
  if (mode === 'matrix-plan')
    process.stdout.write(
      `matrix=${JSON.stringify({
        include: RASTER_JOBS.map((job) => {
          bindRasterJob(manifest, job);
          return { job };
        }),
      })}\n`,
    );
  else {
    assert.equal(mode, 'bind-plan');
    await writeFile(output, JSON.stringify(bindRasterJob(manifest, job), null, 2) + '\n', {
      flag: 'wx',
    });
  }
}
