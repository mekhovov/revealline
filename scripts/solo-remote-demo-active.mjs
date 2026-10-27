import assert from 'node:assert/strict';
import { readFile, writeFile, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepareDemoMode, DEMO_SOURCE_PATHS } from './solo-remote-demo.mjs';
export async function prepareDemoActiveMode(ctx) {
  validateDemoActivePlan(ctx.plan);
  const mode = await prepareDemoMode(ctx);
  Object.assign(ctx.report, {
    platformStratum: 'Linux Xvfb headed Chromium CPU1; fresh default context per row',
    fullApplicationCostGateStatus: 'unobserved-timer-and-messagechannel-wake-work-not-timed',
    instrumentationOverheadStatus: 'unqualified',
    historicalContaminationReplacement: false,
  });
  return mode;
}
export function validateDemoActivePlan(plan) {
  assert.equal(plan.format, 'SoloHostedDemoActivePlanV1');
  assert.equal(plan.status, 'pinned-for-execution');
  assert.equal(plan.performanceExclusion, false);
  assert.equal(plan.release?.status, 'reviewed');
  assert.equal(plan.release.candidateRevision, plan.candidate.revision);
  for (const key of [
    'latestFirst8Passed',
    'affectedDemoCorrectnessClosed',
    'noConcurrentJobLocalWork',
  ])
    assert.equal(plan.release[key], true);
  assert.equal(plan.setupTimeoutMs, 40 * 60000);
  assert.equal(plan.helperTimeoutMs, 75 * 60000);
  assert.equal(plan.rowEvidenceBytes, 32 * 1024 ** 2);
  assert.equal(plan.evidenceBytes, 256 * 1024 ** 2);
  assert.equal(plan.node, '22.13.1');
  assert.equal(plan.playwright, '1.62.1');
  assert.match(plan.candidate.revision, /^[a-f0-9]{40}$/);
  assert.match(plan.candidate.tree, /^[a-f0-9]{40}$/);
  assert(Number.isSafeInteger(plan.candidate.run) && plan.candidate.run > 0);
  assert(Number.isSafeInteger(plan.candidate.artifact) && plan.candidate.artifact > 0);
  assert.match(plan.candidate.manifestSHA256, /^[a-f0-9]{64}$/);
  for (const key of ['inner', 'outer']) {
    assert(Number.isSafeInteger(plan.candidate[key].bytes) && plan.candidate[key].bytes > 0);
    assert.match(plan.candidate[key].sha256, /^[a-f0-9]{64}$/);
  }
  assert.deepEqual(
    plan.rows,
    [1, 2, 3].map((repetition) => ({
      id: `candidate-demo-active30-p${repetition}`,
      kind: 'demo-active',
      source: 'candidate',
      engine: 'chromium',
      repetition,
      timeoutMs: 400000,
      performanceExclusion: false,
    })),
  );
  assert.equal(plan.demo.cpuThrottle, 1);
  assert.equal(plan.demo.watchingMs, 30000);
  assert.equal(plan.demo.deadlineSeconds, 240);
  assert.equal(plan.demo.replayTimeoutMs, 120000);
  assert.deepEqual(plan.demo.viewport, { width: 1280, height: 800, dpr: 1 });
  assert.deepEqual(plan.demo.sourcePaths, DEMO_SOURCE_PATHS);
  assert.equal(
    plan.demo.probe.sha256,
    '7082f727692354b48802d718ccdaa97e0e823634605a5bcd87023ffced7883a8',
  );
  assert.equal(plan.demo.expectedClip?.id, 'first-signal-left');
  assert.equal(plan.demo.expectedClip.levelId, 'signal-01');
  assert.equal(plan.demo.expectedClip.replayURL, './demo-data/first-signal-left.replay.json');
  assert(plan.demo.sourceAssets.length >= 2 && plan.demo.sourceAssets.length <= 4);
  assert.equal(
    new Set(plan.demo.sourceAssets.map((a) => a.relative)).size,
    plan.demo.sourceAssets.length,
  );
  assert.equal(
    plan.demo.sourceAssets.filter(
      (a) => a.role === 'catalog' && a.relative === 'demo-data/catalog.json',
    ).length,
    1,
  );
  assert(
    plan.demo.sourceAssets.some(
      (a) => a.role === 'replay' && './' + a.relative === plan.demo.expectedClip.replayURL,
    ),
  );
  for (const asset of plan.demo.sourceAssets) {
    assert(['catalog', 'replay'].includes(asset.role));
    assert.match(asset.relative, /^demo-data\/[a-z0-9.-]+\.json$/);
    assert.match(asset.sha256, /^[a-f0-9]{64}$/);
    assert(Number.isSafeInteger(asset.bytes) && asset.bytes > 0 && asset.bytes <= 256 * 1024);
  }
  assert.deepEqual(
    plan.adapterInputs.map((ref) => ref.path),
    [
      'scripts/solo-remote-demo-active.mjs',
      'scripts/solo-remote-demo.mjs',
      'scripts/observe-solo-demo-active.mjs',
      'scripts/solo-demo-active-observer.mjs',
    ],
  );
  for (const ref of plan.adapterInputs) {
    assert.match(ref.sha256, /^[a-f0-9]{64}$/);
    assert(Number.isSafeInteger(ref.bytes) && ref.bytes > 0 && ref.bytes < 1024 ** 2);
  }
  for (const key of ['driver', 'probe']) {
    assert.match(plan.demo[key].path, /^scripts\/[a-z-]+\.mjs$/);
    assert.match(plan.demo[key].sha256, /^[a-f0-9]{64}$/);
    assert(Number.isSafeInteger(plan.demo[key].bytes) && plan.demo[key].bytes > 0);
  }
}
export function demoActiveAssessment(raw, command, plan, version) {
  let correctness = 'fail';
  try {
    assert.equal(command.status, 'closed');
    assert.equal(command.exitCode, 0);
    assert(
      !command.cleanupUnconfirmed &&
        !command.forcedCleanup &&
        !command.survivors.length &&
        !command.ambiguous.length,
    );
    assert.equal(raw.format, 'SoloHostedDemoScopedRafWorkV1');
    assert.equal(raw.status, 'pass-scoped-observation');
    assert.equal(raw.sourceRevision, plan.sourceRevision);
    assert.equal(raw.browserVersion, version);
    assert.equal(raw.artifactArchiveSha256, plan.artifactArchiveSha256);
    assert.equal(raw.driverSha256, plan.driverSha256);
    assert.equal(raw.observedBrowserClosed, true);
    assert.equal(raw.observationSettled, true);
    assert.equal(raw.ownedProcess.exitCode, 0);
    assert(!raw.ownedProcess.exitSignal && !raw.ownedProcess.error);
    for (const key of [
      'deadlineReached',
      'cleanupFailure',
      'overflow',
      'observationDrainFailure',
      'sourceDrainFailure',
      'verifierDrainFailure',
      'sourceResponseAfterPreparation',
      'failure',
    ])
      assert(!raw[key], key);
    assert.equal(raw.prefixProof.status, 'pass');
    assert.equal(raw.prefixProof.rows.length, 2);
    assert(raw.prefixProof.rows.every((r) => r.match));
    assert.equal(raw.nativeReplay.status, 'pass');
    assert.equal(raw.nativeReplay.browserVersion, version);
    assert.equal(raw.nativeReplay.ownedBrowserClosed, true);
    assert(!raw.nativeReplay.cleanupFailure && !raw.nativeReplay.deadlineReached);
    assert.equal(raw.aggregate.valid, true);
    assert(raw.aggregate.phaserFrames > 0 && raw.aggregate.demoFrames > 0);
    assert(raw.rawWindow.endedAtMs - raw.rawWindow.startedAtMs >= 30000);
    assert(raw.windowStop.tickAtStop > raw.before.run.tick);
    assert.equal(raw.errors.length, 0);
    assert.equal(raw.failedRequests.length, 0);
    assert.equal(
      raw.fullApplicationCostGateStatus,
      'unobserved-timer-and-messagechannel-wake-work-not-timed',
    );
    assert.equal(raw.instrumentationOverheadStatus, 'unqualified');
    correctness = 'pass';
  } catch {
    /* Preserve the exact raw failure; no retry or numerical reinterpretation. */
  }
  return {
    correctness,
    rawScopedRafGateStatus: raw?.scopedRafGates?.status ?? 'unobserved',
    status:
      correctness === 'pass' && raw.scopedRafGates?.status === 'pass-scoped-raf-only'
        ? 'passed'
        : 'failed',
    qualification: 'scoped-rAF-work-and-cadence-only',
    fullApplicationCost: 'unobserved',
    historicalReplacementCredit: false,
  };
}

export async function runDemoActiveRow(ctx, row, dir, tmp) {
  const { plan, report, repository, admitted, digest, run, modeState } = ctx;
  const { startProductionPreview } = await import(
    pathToFileURL(join(ctx.here, 'serve-production-preview.mjs'))
  );
  const { PUBLIC_SECURITY_HEADERS } = await import(pathToFileURL(join(ctx.here, 'game-cli.mjs')));
  let server;
  try {
    const selected = admitted.artifacts.candidate;
    const manifest = JSON.parse(
      await readFile(join(selected.payloadRealpath, 'manifest.json'), 'utf8'),
    );
    assert.equal(
      (await digest(join(selected.payloadRealpath, 'manifest.json'))).sha256,
      selected.manifestSHA256,
    );
    const members = new Map(manifest.files.map((r) => [r.path, r]));
    const metadata = plan.demo.sourcePaths.map((path) => {
      const member = members.get(path);
      assert(member, path);
      return member;
    });
    for (const member of metadata)
      assert.deepEqual(await digest(join(selected.payloadRealpath, member.path)), {
        bytes: member.bytes,
        sha256: member.sha256,
      });
    for (const asset of plan.demo.sourceAssets) {
      const member = members.get('game/' + asset.relative);
      assert(member, 'Pinned Demo data absent from verified payload');
      assert.equal(member.bytes, asset.bytes);
      assert.equal(member.sha256, asset.sha256);
    }
    server = await startProductionPreview({
      root: selected.payloadRealpath,
      port: 0,
      fixtureAccess: true,
      cache: 'policy',
    });
    const address = new URL('game/', server.url).href;
    const response = await fetch(new URL('build-info.json', address), {
      signal: AbortSignal.timeout(10000),
    });
    const build = await response.json();
    assert.equal(build.sourceRevision, selected.sourceRevision);
    for (const [key, value] of Object.entries(PUBLIC_SECURITY_HEADERS))
      assert.equal(response.headers.get(key), value);
    const bound = {
      format: 'SoloHostedDemoScopedRafWorkCaseV1',
      status: 'pinned-for-execution',
      sourceRole: 'candidate',
      sourceRevision: selected.sourceRevision,
      address,
      browserVersion: modeState.browserVersion,
      chromeExecutable: ctx.chromeExecutable,
      playwrightModule: ctx.browserModule,
      artifact: selected,
      metadata,
      storage: { scratch: tmp, outputRoot: dir },
      commonOwner: {
        verifiedArtifacts: modeState.verifiedArtifacts,
        scratchAuthority: row.scratchAuthority,
      },
      driver: plan.demo.driver,
      probe: plan.demo.probe,
      engine: 'chromium',
      watchingMs: plan.demo.watchingMs,
      deadlineSeconds: plan.demo.deadlineSeconds,
      viewport: plan.demo.viewport,
      driverSha256: plan.demo.driver.sha256,
      artifactArchiveSha256: selected.archiveIdentity.sha256,
      replayTimeoutMs: plan.demo.replayTimeoutMs,
      cpuThrottle: 1,
      buildInfoSha256: members.get('game/build-info.json').sha256,
      sourceAssets: plan.demo.sourceAssets,
      expectedClip: plan.demo.expectedClip,
      scope: plan.scope,
      fixtureAccess: true,
    };
    const path = join(dir, 'bound-plan.json');
    await writeFile(path, JSON.stringify(bound, null, 2) + '\n', { flag: 'wx' });
    row.command = await run(
      row.id,
      [
        modeState.xvfb,
        '--auto-servernum',
        '--server-args=-screen 0 1280x800x24',
        process.execPath,
        join(repository, plan.demo.driver.path),
        path,
        join(dir, 'report.json'),
      ],
      row.timeoutMs,
      {
        env: { ...ctx.cleanEnv, TMPDIR: tmp },
        inspect: async () => {
          await ctx.inspect();
          assert((await ctx.evidenceSize(dir)) <= plan.rowEvidenceBytes, 'Demo row evidence cap');
        },
      },
    );
    const rawPath = join(dir, 'report.json');
    const size = await lstat(rawPath);
    assert(size.isFile() && size.size <= 8 * 1024 ** 2);
    const raw = JSON.parse(await readFile(rawPath, 'utf8'));
    row.raw = { path: rawPath, ...(await digest(rawPath)) };
    Object.assign(row, demoActiveAssessment(raw, row.command, bound, modeState.browserVersion));
  } finally {
    if (server) {
      try {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(Error('Demo server close deadline')), 5000);
          server.server.close((error) => {
            clearTimeout(timer);
            error ? reject(error) : resolve();
          });
          server.server.closeAllConnections();
        });
      } catch (error) {
        report.serverCleanupFailure = true;
        row.serverCleanupFailure = true;
        throw error;
      }
    }
  }
}
