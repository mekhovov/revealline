import assert from 'node:assert/strict';
import { readFile, writeFile, realpath, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const DEMO_ARMS = Object.freeze([
  'spectator-display',
  'spectator-owned-concealment-layer',
  'practice-display',
  'practice-owned-concealment-layer',
]);
export const DEMO_SOURCE_PATHS = Object.freeze([
  'game/build-info.json',
  'game/index.html',
  'game/app.mjs',
  'game/ui/demo-host.mjs',
  'game/ui/demo-clock.mjs',
  'game/ui/visual-quality-policy.mjs',
  'game/demo-experience.mjs',
  'game/replay-player.mjs',
  'game/ui/render.mjs',
  'game/replay.mjs',
  'game/core/index.mjs',
]);
export function validateDemoPlan(plan) {
  assert.equal(plan.format, 'SoloHostedDemoRecoveryPlanV1');
  assert.equal(plan.status, 'pinned-for-execution');
  assert.equal(plan.performanceExclusion, true);
  assert.equal(plan.release?.status, 'reviewed');
  assert.equal(plan.release.candidateRevision, plan.candidate.revision);
  assert.equal(plan.setupTimeoutMs, 40 * 60000);
  assert.match(plan.candidate.revision, /^[a-f0-9]{40}$/);
  assert.match(plan.candidate.tree, /^[a-f0-9]{40}$/);
  assert(Number.isSafeInteger(plan.candidate.run) && plan.candidate.run > 0);
  assert(Number.isSafeInteger(plan.candidate.artifact) && plan.candidate.artifact > 0);
  assert.match(plan.candidate.manifestSHA256, /^[a-f0-9]{64}$/);
  for (const part of ['outer', 'inner']) {
    assert.match(plan.candidate[part].sha256, /^[a-f0-9]{64}$/);
    assert(Number.isSafeInteger(plan.candidate[part].bytes) && plan.candidate[part].bytes > 0);
  }
  assert.equal(plan.playwright, '1.62.1');
  assert.equal(plan.node, '22.13.1');
  assert.equal(plan.helperTimeoutMs, 4500000);
  assert.equal(plan.rowEvidenceBytes, 32 * 1024 ** 2);
  assert.equal(plan.evidenceBytes, 256 * 1024 ** 2);
  assert.deepEqual(plan.rows, [
    {
      id: 'candidate-demo-quality-recovery',
      kind: 'demo',
      source: 'candidate',
      engine: 'chromium',
      timeoutMs: 660000,
    },
  ]);
  assert.deepEqual(plan.demo.arms, DEMO_ARMS);
  assert.deepEqual(plan.demo.qualityWindowsMs, [5000, 2500]);
  assert.equal(plan.demo.observationTimeoutMs, 360000);
  assert.equal(plan.demo.replayTimeoutMs, 120000);
  assert.equal(plan.demo.cpuThrottle, 1);
  assert.equal(plan.demo.retries, 0);
  assert.deepEqual(plan.demo.sourcePaths, DEMO_SOURCE_PATHS);
  assert(plan.demo.sourceAssets.length >= 2 && plan.demo.sourceAssets.length <= 4);
  assert.equal(
    new Set(plan.demo.sourceAssets.map((a) => a.relative)).size,
    plan.demo.sourceAssets.length,
  );
  const catalogues = plan.demo.sourceAssets.filter((a) => a.role === 'catalog');
  assert.equal(catalogues.length, 1);
  assert.equal(catalogues[0].relative, 'demo-data/catalog.json');
  assert.equal(plan.demo.expectedClip?.id, 'first-signal-left');
  assert.equal(plan.demo.expectedClip.levelId, 'signal-01');
  assert.equal(plan.demo.expectedClip.replayURL, './demo-data/first-signal-left.replay.json');
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
  for (const name of ['driver', 'probe']) {
    assert.match(plan.demo[name].path, /^scripts\/[a-z-]+\.mjs$/);
    assert.match(plan.demo[name].sha256, /^[a-f0-9]{64}$/);
    assert(Number.isSafeInteger(plan.demo[name].bytes) && plan.demo[name].bytes > 0);
  }
}
export function unchanged(a, b, key = 'demo') {
  assert(a[key] && b[key]);
  assert.equal(b[key].id, a[key].id, 'Run owner changed');
  assert.equal(b[key].tick, a[key].tick, 'Paused run advanced');
  assert.deepEqual(b[key].checkpoint, a[key].checkpoint, 'Authoritative checkpoint changed');
}
export function validQuality(value) {
  assert(value.visible && value.focused);
  assert.deepEqual(value.viewport, { width: 1280, height: 800, dpr: 1 });
  assert(['full', 'reduced', 'minimal'].includes(value.quality?.tier));
  assert.equal(value.lastDraw?.quality, value.quality.tier);
  assert(Number.isFinite(value.lastDraw.width) && value.lastDraw.width > 0);
  assert(Number.isSafeInteger(value.calibration?.samples));
}
export function assertDemoResult(raw, command, source, browserVersion) {
  assert.equal(command.status, 'closed');
  assert.equal(command.exitCode, 0);
  assert(!command.cleanupUnconfirmed && !command.survivors.length && !command.ambiguous.length);
  assert.equal(raw.format, 'SoloHostedDemoRecoveryV1');
  assert.equal(raw.status, 'pass');
  assert.equal(raw.sourceRevision, source);
  assert.equal(raw.browserVersion, browserVersion);
  assert.equal(raw.observedBrowserClosed, true);
  assert.equal(raw.ownedProcess?.exitCode, 0);
  assert(!raw.ownedProcess.exitSignal && !raw.ownedProcess.error);
  assert.equal(raw.observationSettled, true);
  for (const name of [
    'deadlineReached',
    'cleanupFailure',
    'overflow',
    'observationDrainFailure',
    'verifierDrainFailure',
    'sourceDrainFailure',
    'unexpectedSourceFetch',
  ])
    assert(!raw[name], name);
  assert.deepEqual(
    raw.arms.map((a) => a.id),
    DEMO_ARMS,
  );
  for (const arm of raw.arms) {
    assert.equal(arm.status, 'pass');
    assert.equal(arm.active.id, arm.beforeActivation.id);
    assert(arm.active.tick > arm.beforeActivation.tick);
    assert.equal(arm.active.paused, false);
    assert.equal(arm.loss.before.demo.id, arm.active.id);
    assert(arm.loss.before.demo.tick >= arm.active.tick);
    assert.equal(arm.loss.before.lastDraw.paused, false);
    assert(arm.surface.width > 0 && arm.surface.height > 0);
    assert.equal(arm.loss.isTrusted, false);
    assert.equal(arm.loss.defaultPrevented, false);
    assert.equal(arm.restore.isTrusted, false);
    unchanged(arm.loss.before, arm.loss.after);
    unchanged(arm.loss.after, arm.lost);
    assert.equal(arm.lost.drawCount, arm.loss.after.drawCount);
    assert.deepEqual(
      Object.keys(arm.lost.disabled).sort(),
      ['demo-resume', 'demo-takeover', 'demo-next', 'demo-watch-pause', 'demo-return'].sort(),
    );
    assert(Object.values(arm.lost.disabled).every((v) => v === true));
    unchanged(arm.lost, arm.restored);
    unchanged(arm.restored, arm.held);
    assert(arm.restored.drawCount > arm.lost.drawCount);
    assert.equal(arm.held.drawCount, arm.restored.drawCount);
    assert.equal(arm.resumed.demo.id, arm.held.demo.id);
    assert(arm.resumed.demo.tick > arm.held.demo.tick);
    if (arm.id.startsWith('practice')) unchanged(arm.held, arm.armed);
    validQuality(arm.resumed);
  }
  assert.equal(raw.qualityWindows.length, 2);
  for (const [i, window] of raw.qualityWindows.entries()) {
    assert.equal(window.status, 'pass');
    assert.equal(window.mode, i ? 'practice' : 'spectator');
    assert.equal(window.requestedMs, i ? 2500 : 5000);
    assert(window.elapsedMs >= window.requestedMs);
    validQuality(window.before);
    validQuality(window.after);
    assert.equal(window.before.demo.id, window.after.demo.id);
    assert(window.after.demo.tick > window.before.demo.tick);
    assert.equal(window.before.calibration.samples, window.after.calibration.samples);
    assert.equal(window.before.reducedPreference, window.after.reducedPreference);
  }
  assert.equal(raw.prefixProof.status, 'pass');
  assert.equal(raw.practiceForkProof.status, 'pass');
  assert.equal(raw.staleOwner.status, 'pass');
  assert.equal(raw.parentUnchanged, true);
  for (const name of ['parentReplay', 'demoReplay']) {
    assert.equal(raw[name]?.status, 'pass');
    assert.equal(raw[name]?.browserVersion, browserVersion);
    assert.equal(raw[name]?.ownedBrowserClosed, true);
    assert(!raw[name].cleanupFailure && !raw[name].deadlineReached);
  }
  assert.equal(raw.errors.length, 0);
  assert.equal(raw.failedRequests.length, 0);
}
export async function prepareDemoMode(ctx) {
  const { plan, admitted, digest, repository, evidence, required } = ctx;
  assert(admitted.artifacts.candidate && !admitted.artifacts.baseline);
  for (const ref of [plan.demo.driver, plan.demo.probe])
    assert.deepEqual(await digest(join(repository, ref.path)), {
      bytes: ref.bytes,
      sha256: ref.sha256,
    });
  const xvfb = await realpath('/usr/bin/xvfb-run');
  assert((await lstat(xvfb)).isFile());
  await required(
    'demo-display-preflight',
    [xvfb, '--auto-servernum', '--server-args=-screen 0 1280x800x24', '/usr/bin/xdpyinfo'],
    30000,
  );
  await required('demo-browser-version', [ctx.chromeExecutable, '--version'], 10000);
  const text = await readFile(join(evidence, 'demo-browser-version.log'), 'utf8');
  assert(Buffer.byteLength(text) < 4096);
  const versions = [...new Set(text.match(/\b\d+\.\d+\.\d+\.\d+\b/g))];
  assert.equal(versions.length, 1);
  return {
    xvfb,
    browserVersion: versions[0],
    verifiedArtifacts: {
      path: join(evidence, 'verified-artifacts.json'),
      ...(await digest(join(evidence, 'verified-artifacts.json'))),
    },
  };
}
export async function runDemoRow(ctx, row, dir, tmp) {
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
      format: 'SoloHostedDemoRecoveryCaseV1',
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
      arms: plan.demo.arms,
      qualityWindowsMs: plan.demo.qualityWindowsMs,
      observationTimeoutMs: plan.demo.observationTimeoutMs,
      replayTimeoutMs: plan.demo.replayTimeoutMs,
      cpuThrottle: 1,
      buildInfoSHA256: members.get('game/build-info.json').sha256,
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
    assert(size.isFile() && size.size <= 2 * 1024 ** 2);
    const raw = JSON.parse(await readFile(rawPath, 'utf8'));
    row.raw = { path: rawPath, ...(await digest(rawPath)) };
    assertDemoResult(raw, row.command, selected.sourceRevision, modeState.browserVersion);
    row.status = 'passed';
    row.automaticQualityTransition = raw.automaticQualityTransition;
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
