import assert from 'node:assert/strict';
import { readFile, writeFile, realpath, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assessSoloOwnedResources } from './solo-owned-resource-assessment.mjs';

export const DEMO_DE332_COHORT = 'demo-de332-diagnostic-v1';
const de332Package = {
  revision: 'de3324607c82787c1a1fec9c13d4f8b5cb74cee4',
  tree: '2954fef5b0f1293ff2e6a97ce978a673dddaa7db',
  run: 39091745654,
  artifact: 12123463810,
  outer: {
    bytes: 1094606342,
    sha256: '47a1b17e91edd11434e2b9ad08883f43b0b3374c33569aebe24a4731cc8cba27',
  },
  inner: {
    bytes: 1075789325,
    sha256: 'd4e051135af877e6bb473b71713be4cc8a0b1bca877f892fa04675059fbe94aa',
  },
  manifestSHA256: '74525fe396c239be2950585cb28d32455706b27628e02e8cc194f770f885f10d',
};
export const DEMO_RUNTIME73_COHORT = 'demo-runtime73-diagnostic-v1';
const runtime73Package = {
  revision: '73a345cec696d7789198cf295ca5c37b17ca0e71',
  tree: 'ea30e68636b3342f8e60664a79d425e11e27ff1e',
  run: 39099979283,
  artifact: 12127570566,
  outer: {
    bytes: 1094639407,
    sha256: '6d93e34b3372e24f1f010bb630d7d7b688fdbc8a1280b3f3a9945e99ac171e64',
  },
  inner: {
    bytes: 1075807617,
    sha256: '17d7135c4d16693f0ddb5ee655d6552fdedc18ef7add72aefa7d8e39a7b24a54',
  },
  manifestSHA256: 'd16a636797b4269357cb6302211c71503819b0ca7ae333d244587cee7d159d93',
};
export const DEMO_RUNTIME797_COHORT = 'demo-runtime797-diagnostic-v1';
const runtime797Package = {
  revision: '797e03f28743921842df6aa57520a72016ba3dfc',
  tree: 'bd53120f0cdfa462b8d63c2de5aa61e9c6658ac5',
  run: 39104551453,
  artifact: 12128990483,
  outer: {
    bytes: 1094639112,
    sha256: '76a01b2d29119f1bc4d8aaa8da77846160133067d0eb3036f5791c3198b5b897',
  },
  inner: {
    bytes: 1075807530,
    sha256: '5eb1c3e70d8fc460ddeba3762137306cf2e6902c315172c633702621883b7e9c',
  },
  manifestSHA256: '497efcff7f399c12030bfa5297f8e67faaa97ef26626ac88a1b924fcb23db6a0',
};
const de332Assets = [
  {
    role: 'catalog',
    relative: 'demo-data/catalog.json',
    bytes: 6839,
    sha256: '3d4fbe0437fb6dfc7e4140e72e597012e95ec82c007621e6dee358c38baf4078',
  },
  {
    role: 'replay',
    relative: 'demo-data/first-signal-left.replay.json',
    bytes: 10793,
    sha256: '900f921146e37324dfefc90f55bfc60c03bd8a2954d53353ecae25df8a55c54a',
  },
  {
    role: 'replay',
    relative: 'demo-data/first-signal-left.chromium-macos.replay.json',
    bytes: 10801,
    sha256: 'b18d9d343ffca2b7efec6c3ec0266d80ed0603804420f444159e4214533bd11e',
  },
];
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
export const DEMO_RESOURCE_SOURCE_PATHS = Object.freeze([
  ...DEMO_SOURCE_PATHS,
  'game/demo-sources.mjs',
  'game/demo-director.mjs',
]);
export const DEMO_RESOURCE_MODE = 'close-reopen-resources-v1';
export function validateDemoResourceContract(contract, source) {
  assert.match(source, /^[a-f0-9]{40}$/);
  assert.deepEqual(contract, {
    mode: DEMO_RESOURCE_MODE,
    sourceRevision: source,
    resources: { format: 'DemoOwnedResourcesV1', sourceRevision: source },
    cyclesPerMode: 10,
    modes: ['spectator', 'practice'],
    snapshotLimit: 64,
  });
}

function validateRuntimeFirstEight(evidence, sourceRevision = runtime73Package.revision) {
  assert(
    evidence && typeof evidence === 'object',
    'Actual same-source first-eight evidence required',
  );
  assert.deepEqual(
    Object.keys(evidence).sort(),
    [
      'format',
      'sourceRevision',
      'runId',
      'artifactId',
      'artifactSHA256',
      'summarySHA256',
      'correctness',
      'ownersClosed',
    ].sort(),
  );
  assert.equal(evidence.format, 'SoloFirstEightCorrectnessEvidenceV1');
  assert.equal(evidence.sourceRevision, sourceRevision);
  assert(Number.isSafeInteger(evidence.runId) && evidence.runId > 0);
  assert(Number.isSafeInteger(evidence.artifactId) && evidence.artifactId > 0);
  assert.match(evidence.artifactSHA256, /^[a-f0-9]{64}$/);
  assert.match(evidence.summarySHA256, /^[a-f0-9]{64}$/);
  assert.equal(evidence.correctness, 'passed');
  assert.equal(evidence.ownersClosed, true);
}

export function validateDemoPlan(plan) {
  const resources = plan.format === 'SoloHostedDemoResourcePlanV1';
  assert(resources || plan.format === 'SoloHostedDemoRecoveryPlanV1');
  if (
    plan.sourceCohort !== undefined ||
    [de332Package.revision, runtime73Package.revision, runtime797Package.revision].includes(
      plan.candidate?.revision,
    )
  ) {
    const runtime797 = plan.sourceCohort === DEMO_RUNTIME797_COHORT;
    const runtime73 = plan.sourceCohort === DEMO_RUNTIME73_COHORT;
    const candidate = runtime797 ? runtime797Package : runtime73 ? runtime73Package : de332Package;
    assert.equal(
      plan.sourceCohort,
      runtime797 ? DEMO_RUNTIME797_COHORT : runtime73 ? DEMO_RUNTIME73_COHORT : DEMO_DE332_COHORT,
    );
    for (const [key, value] of Object.entries(candidate))
      assert.deepEqual(plan.candidate[key], value);
    assert.equal(plan.runtimeRevision, candidate.revision);
    if (runtime797) {
      assert.equal(plan.release.firstEightRequired, true);
      assert.equal(plan.release.firstEightSourceRevision, runtime797Package.revision);
      assert.equal(plan.release.firstEightAllCorrectnessPassed, true);
      validateRuntimeFirstEight(plan.release.firstEightEvidence, runtime797Package.revision);
    } else if (runtime73) {
      assert.equal(plan.release.firstEightSourceRevision, runtime73Package.revision);
      assert.equal(plan.release.firstEightAllCorrectnessPassed, true);
      validateRuntimeFirstEight(plan.release.firstEightEvidence);
    }
    assert.equal(
      plan.release?.format,
      runtime797
        ? 'SoloDemoRuntime797DiagnosticReleaseV1'
        : runtime73
          ? 'SoloDemoRuntime73DiagnosticReleaseV1'
          : 'SoloDemoDe332DiagnosticReleaseV1',
    );
    assert.equal(
      plan.release.scope,
      resources ? 'independent-demo-resource-cycles' : 'independent-demo-synthetic-recovery',
    );
    assert.deepEqual(plan.release.dispatch, {
      workflow: '.github/workflows/solo-native-package-consumer.yml',
      ref: 'refs/heads/main',
      lane: resources ? 'demo-resources' : 'demo-recovery',
      source: candidate.revision,
    });
    assert.equal(plan.release.physicalQualification, 'unobserved');
    assert.equal(plan.release.performanceQualification, 'excluded');
    assert.equal(plan.release.automaticRetries, 0);
    assert.equal(plan.release.priorProofInspected, true);
    assert.equal(plan.release.noUnclosedOwners, true);
    assert.deepEqual(plan.release.evidence, [
      {
        runId: 39096176143,
        artifactId: 12125002138,
        artifactSHA256: 'd6b5ed1d46c6f89eab6d40361893f2dedb2d6698a50b6ba612cf6058c68c705d',
        summarySHA256: 'c67a520f87683b2a43479919f27e798c7cb3adff9a0d0896d815d554d5918955',
      },
    ]);
    assert.deepEqual(plan.demo.sourceAssets, de332Assets);
  }
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
      id: resources ? 'candidate-demo-close-reopen-resources' : 'candidate-demo-quality-recovery',
      kind: 'demo',
      source: 'candidate',
      engine: 'chromium',
      timeoutMs: 660000,
    },
  ]);
  assert.deepEqual(plan.demo.arms, resources ? [] : DEMO_ARMS);
  assert.deepEqual(plan.demo.qualityWindowsMs, resources ? [] : [5000, 2500]);
  if (resources) validateDemoResourceContract(plan.demo.resourceCycles, plan.candidate.revision);
  else assert.equal(plan.demo.resourceCycles, undefined);
  assert.equal(plan.demo.observationTimeoutMs, 360000);
  assert.equal(plan.demo.replayTimeoutMs, 120000);
  assert.equal(plan.demo.cpuThrottle, 1);
  assert.equal(plan.demo.retries, 0);
  assert.deepEqual(
    plan.demo.sourcePaths,
    resources ? DEMO_RESOURCE_SOURCE_PATHS : DEMO_SOURCE_PATHS,
  );
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
export function assertDemoResult(raw, command, source, browserVersion, resourceContract) {
  assert.equal(command.status, 'closed');
  assert.equal(command.exitCode, 0);
  assert(!command.cleanupUnconfirmed && !command.survivors.length && !command.ambiguous.length);
  if (resourceContract) validateDemoResourceContract(resourceContract, source);
  assert.equal(
    raw.format,
    resourceContract ? 'SoloHostedDemoResourceV1' : 'SoloHostedDemoRecoveryV1',
  );
  if (!resourceContract) assert.equal(raw.resourceContract, undefined);
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
  if (resourceContract) {
    assert(!raw.failure, 'Raw Demo resource failure remains authoritative');
    assert.deepEqual(raw.resourceContract, resourceContract);
    assert(Array.isArray(raw.sources) && raw.sources.length > 0 && raw.sources.length <= 16);
    const urls = new Set();
    let capturedBytes = 0;
    for (const entry of raw.sources) {
      assert(typeof entry.url === 'string' && entry.url.length <= 4096 && !urls.has(entry.url));
      urls.add(entry.url);
      assert(['module', 'catalog', 'replay'].includes(entry.role));
      assert.equal(entry.status, 200);
      assert(!entry.failure);
      assert(
        Number.isSafeInteger(entry.responses) &&
          entry.responses > 0 &&
          entry.responses <= (entry.role === 'module' ? 1 : 21),
      );
      assert.equal(entry.verifiedResponses, entry.responses);
      assert(
        Number.isSafeInteger(entry.bytes) &&
          entry.bytes > 0 &&
          entry.bytes <= (entry.role === 'module' ? 1024 * 1024 : 256 * 1024),
      );
      assert.match(entry.sha256, /^[a-f0-9]{64}$/);
      capturedBytes += entry.bytes * entry.responses;
    }
    assert(capturedBytes <= 8 * 1024 ** 2);
    assert.deepEqual(raw.arms, []);
    assert.deepEqual(raw.qualityWindows, []);
    assert.deepEqual(
      raw.resourceAssessment,
      assessDemoResourceCycles(raw, source, resourceContract),
    );
    assert.equal(raw.cycleProof?.status, 'pass');
    assert.equal(raw.cycleProof.rows.length, 20);
    for (const [i, row] of raw.cycleProof.rows.entries()) {
      assert.equal(row.mode, raw.cycles[i].mode);
      assert.equal(row.cycle, raw.cycles[i].cycle);
      assert.equal(row.sourceMatch, true);
      assert.equal(row.match, true);
      assert.deepEqual(row.expected, raw.snapshots[raw.cycles[i].paused].demo.checkpoint);
      assert.deepEqual(row.actual, row.expected);
    }
  } else {
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
  }
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
export function assessDemoResourceCycles(raw, source, contract) {
  validateDemoResourceContract(contract, source);
  assert.equal(raw.sourceRevision, source);
  assert(Array.isArray(raw.snapshots) && raw.snapshots.length <= 64);
  assert.equal(raw.cycles.length, 20);
  const used = new Set(),
    runs = new Set(),
    snapshots = [],
    comparable = new Map();
  for (const [i, row] of raw.cycles.entries()) {
    const mode = i < 10 ? 'spectator' : 'practice';
    assert.equal(row.mode, mode);
    assert.equal(row.cycle, (i % 10) + 1);
    assert.equal(row.status, 'pass');
    assert.deepEqual(
      row.actions,
      mode === 'practice'
        ? ['open', 'watch-pause', 'details', 'takeover', 'resume', 'ArrowRight', 'pause', 'back']
        : ['open', 'watch-pause', 'back'],
    );
    assert(row.opened && Number.isSafeInteger(row.opened.tick) && row.opened.tick > 0);
    assert.equal(row.opened.paused, false);
    assert(!runs.has(row.opened.id), 'Reopened spectator owner must be fresh');
    runs.add(row.opened.id);
    let bytes = 0;
    for (const name of ['localStorage', 'sessionStorage']) {
      const rows = row.storageBefore?.[name];
      assert(Array.isArray(rows) && rows.length <= 256, 'Missing bounded web storage proof');
      const keys = new Set();
      for (const entry of rows) {
        assert(typeof entry.key === 'string' && entry.key.length <= 256 && !keys.has(entry.key));
        keys.add(entry.key);
        assert(
          Number.isSafeInteger(entry.bytes) && entry.bytes >= 0 && entry.bytes <= 4 * 1024 ** 2,
        );
        assert.match(entry.sha256, /^[a-f0-9]{64}$/);
        bytes += entry.bytes;
      }
    }
    assert(bytes <= 8 * 1024 ** 2);
    assert.deepEqual(
      row.storageBefore,
      raw.resourceStorageBaseline,
      'Web storage changed between cycles',
    );
    assert.deepEqual(row.storageBefore, row.storageAfter, 'Demo changed observed web storage');
    for (const boundary of ['paused', 'closed']) {
      const index = row[boundary];
      assert(Number.isSafeInteger(index) && index >= 0 && index < raw.snapshots.length);
      assert(!used.has(index), 'Boundary may not be reused');
      used.add(index);
      const value = raw.snapshots[index];
      assert.equal(value.label, `${mode}-${row.cycle}-${boundary}`);
      assert(value.visible && value.focused);
      assert.deepEqual(value.viewport, { width: 1280, height: 800, dpr: 1 });
      assert.equal(value.diagnosticsSource, 'public-paused-export');
      assert.deepEqual(value.resourceContract, contract.resources);
      assert.equal(value.resources?.demo?.format, 'DemoOwnedResourcesV1');
      assert.equal(value.open, boundary === 'paused');
      assert.equal(value.resources.demo.active, boundary === 'paused');
      unchanged(raw.snapshots[0], value, 'ordinary');
      snapshots.push({ group: `${mode}-${boundary}`, application: { resources: value.resources } });
    }
    const paused = raw.snapshots[row.paused];
    unchanged(paused, raw.snapshots[row.closed]);
    assert.equal(paused.drawCount, raw.snapshots[row.closed].drawCount);
    assert.equal(paused.lastDraw.paused, true);
    assert.equal(paused.practice, mode === 'practice');
    validQuality(paused);
    const comparison = {
      tier: paused.quality.tier,
      reduced: paused.reducedPreference,
      width: paused.lastDraw.width,
      calibrationSamples: paused.calibration.samples,
    };
    if (comparable.has(mode))
      assert.deepEqual(comparison, comparable.get(mode), 'Comparable Demo cycle changed');
    else comparable.set(mode, comparison);
    if (mode === 'spectator') {
      assert.equal(paused.demo.id, row.opened.id);
      assert(paused.demo.tick >= row.opened.tick);
      assert.equal(row.fork, null);
    } else {
      assert(row.fork && row.fork.demo && row.fork.source);
      assert.equal(row.fork.source.id, row.opened.id);
      assert.equal(row.fork.source.tick, row.fork.demo.tick);
      assert(!runs.has(row.fork.demo.id), 'Practice owner must be fresh');
      runs.add(row.fork.demo.id);
      assert.notEqual(row.fork.demo.id, row.opened.id);
      assert.equal(paused.demo.id, row.fork.demo.id);
      assert(paused.demo.tick > row.fork.demo.tick);
      assert.equal(row.direction, 'right');
    }
  }
  const derived = {
    format: 'SoloQualificationReportV1',
    sourceRevision: source,
    failure: raw.failure,
    snapshots,
  };
  const groups = {};
  let bounds, rows;
  for (const mode of contract.modes)
    for (const boundary of ['paused', 'closed']) {
      const group = `${mode}-${boundary}`;
      const result = assessSoloOwnedResources(derived, {
        group,
        last: 10,
        demo: contract.resources,
      });
      assert.equal(result.bounds.failures, 0, 'Owned resource accounting failed');
      bounds ??= result.bounds;
      rows ??= result.rows;
      groups[group] = result.retention;
    }
  return {
    format: 'SoloDemoResourceCycleAssessmentV1',
    rawFailurePresent: Boolean(raw.failure),
    bounds,
    rows,
    groups,
    nativeMemoryQualification: false,
    recoveryQualification: false,
    scope:
      'Twenty public close/reopen cycles. Owner observations only, not a native memory or leak verdict. Practice has exact state reconstruction, not a public practice replay export. Web storage covers local/session stores; IndexedDB contents are unobserved.',
  };
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
      format: plan.demo.resourceCycles
        ? 'SoloHostedDemoResourceCaseV1'
        : 'SoloHostedDemoRecoveryCaseV1',
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
      ...(plan.demo.resourceCycles ? { resourceCycles: plan.demo.resourceCycles } : {}),
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
    assertDemoResult(
      raw,
      row.command,
      selected.sourceRevision,
      modeState.browserVersion,
      plan.demo.resourceCycles,
    );
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
