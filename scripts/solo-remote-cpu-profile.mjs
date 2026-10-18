import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, lstat, mkdir, open, readFile, realpath, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { readSupplementalJSON } from './solo-remote-supplemental.mjs';

const MiB = 1024 ** 2;
export const CPU_PROFILE_SOURCE = '3adcd53792043ef02459e86168c6b33a66d6ef00';
export const CPU_PROFILE_RECIPE =
  'aa3a4c98c6f272ea515d1e8c9e0fb3238d78782065bfb96ae8fe4e304041e2c5';
export const LONG_RAIL_CPU_SOURCE = 'a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4';
export const LONG_RAIL_CPU_RECIPE =
  'b9afaecaadcbd0f657dd8064b9f7932c0c7ec12d6433f7d2b76f60de7ef19528';
export const FIRST_VICTORY_CPU_SOURCE = 'e1cc5dd7656bab349715cd1c3ce6e9f783508c17';
export const FIRST_VICTORY_CPU_RECIPE =
  '561510be9786c949f65e6fcf0c0352e7e892c710ec80958e7139040e3911caa1';
export const FIRST_VICTORY_239_CPU_SOURCE = '239c574ecddd5bb6d5896e621d9edc53e7f6a313';
// Exact independently verified successful producer metadata; full remote admission remains required.
const FIRST_VICTORY_239_CPU_CANDIDATE = Object.freeze({
  revision: '239c574ecddd5bb6d5896e621d9edc53e7f6a313',
  tree: '1ac7f17971498d2a8be19085f00a9f732db42798',
  run: 39049194998,
  artifact: 12107584924,
  outer: {
    bytes: 1091981388,
    sha256: 'de57853058db05207dd93f0fd2cb38dd57589485dc0a5cfcc81221d1d1710aec',
  },
  inner: {
    bytes: 1073799309,
    sha256: '0a0f4273b3ac6cc906b6625063d52229a39c92b108d1dba296b7bd5628028f17',
  },
  manifestSHA256: 'abe173d91aece2ba590c0c2442d48f151b13e23a88fa0ead7b6690f4f95b9d36',
});
export const FIRST_VICTORY_DE332_CPU_SOURCE = 'de3324607c82787c1a1fec9c13d4f8b5cb74cee4';
const FIRST_VICTORY_DE332_CPU_CANDIDATE = Object.freeze({
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
});
export const FIRST_VICTORY_797E03_CPU_SOURCE = '797e03f28743921842df6aa57520a72016ba3dfc';
const FIRST_VICTORY_797E03_CPU_CANDIDATE = Object.freeze({
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
  producer:
    'Successful Appearance39104551453; compact metadata independently verified. Full payload/source/worker/CSP validation remains mandatory in hosted consumer.',
});

const FRAME_TRACE_CANDIDATE = Object.freeze({
  revision: '9d5139b9983c700a6a708f65f379fa4d5a8b0395',
  tree: '99f9e6cea7ea7dc27c93609aae632908531d93d1',
  run: 39122543440,
  artifact: 12135616655,
  outer: {
    bytes: 1094656114,
    sha256: '84c1621400e4a4a7ce662cf0ee52916fe03e716ec51f0559fbaa218bafa01888',
  },
  inner: {
    bytes: 1075818191,
    sha256: 'ef878c4d42fdcb8ae61ff1e05c4199a6c1b7023decd45a35c9f5fd1dcecd2b16',
  },
  manifestSHA256: '8d4bc6d5d25e92e4743afa9d241180735b16cd446e333ab7b0dab0bca45641c2',
});
const warmFrameTrace = (plan) =>
  plan?.phase === 'warm-browser-frame-trace' && plan?.sourceCohort === 'warm-frame-9d5139-v1';
const frameRecipe = Object.freeze({
  path: 'docs/performance/fixtures/solo-remote-timing/warm-first30.qualification.fixture',
  bytes: 6570,
  sha256: '6da01ca449068ca6705012f3d6604362c581fe52c4583407797c0961acf3156d',
});
const frameProfile = Object.freeze({
  mode: 'browser-frame-trace',
  maximumMs: 30000,
  maximumBytes: 64 * MiB,
  bufferKiB: 8192,
  chunkBytes: 65536,
  maximumReads: 1025,
  sampling: false,
  screenshots: false,
  heap: false,
});
function validateFrameFirstEight(release) {
  assert.equal(release.firstEightRequired, true);
  assert.equal(release.firstEightAllCorrectnessPassed, true);
  const proof = release.firstEightEvidence;
  assert(proof && typeof proof === 'object' && !Array.isArray(proof));
  assert.deepEqual(
    Object.keys(proof).sort(),
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
  assert.equal(proof.format, 'SoloFirstEightCorrectnessEvidenceV1');
  assert.equal(proof.sourceRevision, FRAME_TRACE_CANDIDATE.revision);
  for (const key of ['runId', 'artifactId'])
    assert(Number.isSafeInteger(proof[key]) && proof[key] > 0);
  for (const key of ['artifactSHA256', 'summarySHA256']) assert.match(proof[key], /^[a-f0-9]{64}$/);
  assert.equal(proof.correctness, 'passed');
  assert.equal(proof.ownersClosed, true);
}
function validateFrameTracePlan(plan) {
  assert.equal(plan.format, 'SoloHostedCpuProfilePlanV1');
  assert.equal(plan.status, 'reviewed-diagnostic-only');
  assert(warmFrameTrace(plan));
  assert.equal(plan.repository, 'mekhovov/revealline');
  for (const key of Object.keys(FRAME_TRACE_CANDIDATE))
    assert.deepEqual(plan.candidate[key], FRAME_TRACE_CANDIDATE[key], key);
  assert.equal(plan.runtimeRevision, FRAME_TRACE_CANDIDATE.revision);
  assert.deepEqual(plan.baseline, {
    revision: '8b01991942dc764b8aa4726851699ce1985e53ae',
    tree: '9373b6a74aea8fa1ef47aa17ace140b4cf714609',
  });
  assert.equal(plan.upload, undefined);
  assert.equal(plan.stressOrigin, undefined);
  assert.equal(plan.node, '22.13.1');
  assert.equal(plan.playwright, '1.62.1');
  assert.equal(plan.cpu, 'fresh-verified-mid');
  assert.equal(plan.calibrationPreset, 'mid');
  assert.equal(plan.calibrationTimeoutMs, 5 * 60000);
  assert.equal(plan.performanceExclusion, true);
  assert.equal(plan.maxParallel, 1);
  assert.equal(plan.automaticRetries, 0);
  assert.equal(plan.automaticPhaseContinuation, false);
  assert.equal(plan.setupTimeoutMs, 40 * 60000);
  assert.equal(plan.helperTimeoutMs, 75 * 60000);
  assert.equal(plan.evidenceBytes, 256 * MiB);
  assert.equal(plan.rowEvidenceBytes, 128 * MiB);
  assert.equal(plan.scenarioTimeoutMs, 360000);
  assert.deepEqual(plan.rows, [rowDefinition(plan)]);
  assert.deepEqual(plan.recipe, frameRecipe);
  assert.deepEqual(plan.profile, frameProfile);
  assert.equal(plan.release.status, 'reviewed');
  assert.equal(plan.release.scope, 'single-browser-frame-diagnostic');
  assert.equal(plan.release.performanceQualification, 'excluded-browser-frame-tracing');
  validateFrameFirstEight(plan.release);
  assert.deepEqual(plan.release.dispatch, {
    workflow: '.github/workflows/solo-native-package-consumer.yml',
    lane: 'frame-trace',
    ref: 'main',
    source: FRAME_TRACE_CANDIDATE.revision,
    automaticRetries: 0,
  });
  assert.deepEqual(
    plan.adapterInputs.map((x) => x.path),
    ['scripts/solo-remote-cpu-profile.mjs', 'scripts/solo-remote-baseline.mjs'],
  );
  assert(
    Array.isArray(plan.frozenTools) && plan.frozenTools.length > 0 && plan.frozenTools.length <= 64,
  );
  assert.equal(new Set(references(plan).map((x) => x.path)).size, references(plan).length);
  for (const path of [
    'scripts/solo-qualification-cpu-profile.mjs',
    'scripts/qualify-solo-runtime.mjs',
    'scripts/run-solo-remote-correctness.mjs',
    'scripts/solo-remote-supplemental.mjs',
    'scripts/solo-remote-sustained.mjs',
    'scripts/calibrate-solo-performance.mjs',
    'scripts/vendor/devtools-benchmark.mjs',
  ])
    assert(plan.frozenTools.some((ref) => ref.path === path));
  for (const ref of references(plan)) {
    assert(/^(scripts|game|docs)\//.test(ref.path) && !ref.path.split('/').includes('..'));
    assert(Number.isSafeInteger(ref.bytes) && ref.bytes > 0 && ref.bytes < MiB);
    assert.match(ref.sha256, /^[a-f0-9]{64}$/);
  }
  return plan;
}

const firstVictory797 = (plan) =>
  plan?.phase === 'first-victory-cpu-profile' &&
  plan?.sourceCohort === 'first-victory-797e03-main8b-v1';
function validate797FirstEight(release) {
  assert.equal(release.firstEightRequired, true);
  assert.equal(release.firstEightAllCorrectnessPassed, true);
  const proof = release.firstEightEvidence;
  assert(proof && typeof proof === 'object' && !Array.isArray(proof));
  assert.deepEqual(
    Object.keys(proof).sort(),
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
  assert.equal(proof.format, 'SoloFirstEightCorrectnessEvidenceV1');
  assert.equal(proof.sourceRevision, '797e03f28743921842df6aa57520a72016ba3dfc');
  for (const key of ['runId', 'artifactId'])
    assert(Number.isSafeInteger(proof[key]) && proof[key] > 0);
  for (const key of ['artifactSHA256', 'summarySHA256']) assert.match(proof[key], /^[a-f0-9]{64}$/);
  assert.equal(proof.correctness, 'passed');
  assert.equal(proof.ownersClosed, true);
}
const firstVictoryDe332 = (plan) =>
  plan?.phase === 'first-victory-cpu-profile' &&
  plan?.sourceCohort === 'first-victory-de332-main8b-v1';
const firstVictory239 = (plan) =>
  plan?.phase === 'first-victory-cpu-profile' &&
  plan?.sourceCohort === 'first-victory-239-main8b-v1';
const firstVictory = (plan) => plan?.phase === 'first-victory-cpu-profile';
const longRail = (plan) => plan?.phase === 'long-rail-cpu-profile';
const source = (plan) =>
  warmFrameTrace(plan)
    ? FRAME_TRACE_CANDIDATE.revision
    : firstVictory(plan)
      ? firstVictory797(plan)
        ? FIRST_VICTORY_797E03_CPU_SOURCE
        : firstVictoryDe332(plan)
          ? FIRST_VICTORY_DE332_CPU_SOURCE
          : firstVictory239(plan)
            ? FIRST_VICTORY_239_CPU_SOURCE
            : FIRST_VICTORY_CPU_SOURCE
      : longRail(plan)
        ? LONG_RAIL_CPU_SOURCE
        : CPU_PROFILE_SOURCE;
const recipeHash = (plan) =>
  warmFrameTrace(plan)
    ? frameRecipe.sha256
    : firstVictory(plan)
      ? firstVictory797(plan)
        ? '0c279175bbc49ae0426dcf628b3fb7607031d3943cde56f9c6ea3d7420f2ddf3'
        : firstVictoryDe332(plan)
          ? 'b1f50b274862dbe09237011e40f5fced6042095e745f488c44d72933906ef5ba'
          : firstVictory239(plan)
            ? '328ae1964a398623c9dd1b71ff14c91e3dbb4156670558bcf381306334e9cf4c'
            : FIRST_VICTORY_CPU_RECIPE
      : longRail(plan)
        ? LONG_RAIL_CPU_RECIPE
        : CPU_PROFILE_RECIPE;
const rowDefinition = (plan) => ({
  id: warmFrameTrace(plan)
    ? 'warm-browser-frame-trace-chromium-candidate'
    : firstVictory(plan)
      ? 'first-victory-cpu-profile-chromium-candidate'
      : longRail(plan)
        ? 'long-rail-cpu-profile-chromium-candidate'
        : 'cold-cpu-profile-chromium-candidate',
  kind: 'cpu-profile',
  source: 'candidate',
  engine: 'chromium',
  timeoutMs: 480000,
  performanceExclusion: true,
});
const references = (plan) => [
  plan.recipe,
  ...(longRail(plan) ? [plan.upload] : []),
  ...plan.adapterInputs,
  ...plan.frozenTools,
];

export function longRailProfileOrigin() {
  return {
    run: 39015298582,
    job: 117346097375,
    artifact: 12094722207,
    artifactBytes: 771453,
    artifactSHA256: 'f6aeb2f30c77beeb53e367fb2a50bf570dc46299974f820a750d72ee61334953',
    calibrationSHA256: 'd8969abe0039b2ba6b40202a6e9eb6f07832bd0cc05ac341af9c3ce2c038b9f2',
    reportSHA256: '6b9fc01476295961c91ea9ca263df4dd083e5342ad85fa789185162a17b6597f',
    commandSHA256: 'c4a0fc245cd19724b3006c1e49d4500c57497bea9801cd2155b1af21dc699519',
    rate: 4.19,
    originalTarget: 1000,
    originalVerification: [956, 1000.5, 1011.5],
    newHostCalibration: false,
    scope: 'fixed-diagnostic-factor-only',
    predecessorScenarioStatus: 'fail',
    predecessorCommandStatus: 'closed',
    predecessorExitCode: 1,
    predecessorForcedCleanup: false,
    predecessorSurvivors: 0,
    predecessorAmbiguous: 0,
  };
}

export function firstVictoryProfileOrigin() {
  return {
    run: 39044567236,
    job: 117430670106,
    artifact: 12105263002,
    artifactBytes: 321167,
    artifactSHA256: '144684a77dc08ef29353dc3a7f5f57d2cac72425f488998e01ed8b2f697cf0d3',
    calibrationSHA256: 'ca43b506baa91e8d124dac9f4579d0e6d737416b29c2114904c264e647ef3549',
    reportSHA256: 'cd3e2bac36df06e262f2a562be4b9d31ec9c936a66cc348afdcf784d872dd63a',
    commandSHA256: 'cb0e3b3a776fed9c88b29c64dd29e312d13958a4ee8a71502a63b29622b52d9f',
    rate: 2.42,
    originalTarget: 1000,
    originalVerification: [927.5, 986, 865],
    newHostCalibration: false,
    scope: 'fixed-diagnostic-factor-only',
    predecessorScenarioStatus: 'fail',
    predecessorCommandStatus: 'closed',
    predecessorExitCode: 1,
    predecessorForcedCleanup: false,
    predecessorSurvivors: 0,
    predecessorAmbiguous: 0,
  };
}

export function firstVictoryDe332ProfileOrigin() {
  return {
    run: 39098131087,
    job: 117588741556,
    artifact: 12125224496,
    artifactBytes: 675224,
    artifactSHA256: '87cd36fdda0b0703df7ba5407772441df4a19ed2969176f9f9a4f917c8d61f29',
    calibrationSHA256: 'b2a2ccb1cee2590ae84b086de14311c5ac64c0926e477bda05b691b37fa5e2fb',
    reportSHA256: '23d8edf87017318af9d0dd17311a3879e8f0d1b9f093edea052f1c488d1dda81',
    commandSHA256: 'e376615aceb20d27d024481ce005dfe8580e2379cad59cee53b7a34e104c4306',
    rate: 3.88,
    originalTarget: 1000,
    originalVerification: [1036, 1045, 1000.5],
    newHostCalibration: false,
    scope: 'fixed-diagnostic-factor-only',
    predecessorScenarioStatus: 'pass',
    predecessorPerformanceStatus: 'fail',
    predecessorCommandStatus: 'closed',
    predecessorExitCode: 2,
    predecessorForcedCleanup: false,
    predecessorSurvivors: 0,
    predecessorAmbiguous: 0,
  };
}

export function validateCpuProfilePlan(plan) {
  if (warmFrameTrace(plan)) return validateFrameTracePlan(plan);
  assert.equal(plan.format, 'SoloHostedCpuProfilePlanV1');
  assert.equal(plan.status, 'reviewed-diagnostic-only');
  assert(
    ['cold-cpu-profile', 'long-rail-cpu-profile', 'first-victory-cpu-profile'].includes(plan.phase),
  );
  const victory = firstVictory(plan),
    current = longRail(plan) || victory;
  assert.equal(plan.repository, 'mekhovov/revealline');
  assert.equal(plan.candidate.revision, source(plan));
  if (victory) {
    if (firstVictory797(plan)) {
      for (const key of ['revision', 'tree', 'run', 'artifact', 'outer', 'inner', 'manifestSHA256'])
        assert.deepEqual(plan.candidate[key], FIRST_VICTORY_797E03_CPU_CANDIDATE[key], key);
      assert.equal(plan.runtimeRevision, FIRST_VICTORY_797E03_CPU_SOURCE);
      validate797FirstEight(plan.release);
    } else if (firstVictoryDe332(plan)) {
      for (const key of ['revision', 'tree', 'run', 'artifact', 'outer', 'inner', 'manifestSHA256'])
        assert.deepEqual(plan.candidate[key], FIRST_VICTORY_DE332_CPU_CANDIDATE[key], key);
      assert.equal(plan.runtimeRevision, FIRST_VICTORY_DE332_CPU_SOURCE);
    } else if (firstVictory239(plan)) {
      for (const key of ['revision', 'tree', 'run', 'artifact', 'outer', 'inner', 'manifestSHA256'])
        assert.deepEqual(plan.candidate[key], FIRST_VICTORY_239_CPU_CANDIDATE[key], key);
      assert.equal(plan.runtimeRevision, FIRST_VICTORY_239_CPU_SOURCE);
    } else {
      assert.equal(plan.sourceCohort, 'first-victory-e1cc-main8b-v1');
      assert.equal(plan.candidate.tree, '58f19392e25384620d896098fce8616b538e318d');
      assert.equal(plan.runtimeRevision, FIRST_VICTORY_CPU_SOURCE);
      assert.equal(plan.candidate.run, 39037874955);
      assert.equal(plan.candidate.artifact, 12104590541);
      assert.deepEqual(plan.candidate.outer, {
        bytes: 1091965213,
        sha256: 'fb85094a61cdc329ccf8a1488b6e3ca1043ef5f249a6b33729bb04141336af1e',
      });
      assert.deepEqual(plan.candidate.inner, {
        bytes: 1073790972,
        sha256: '6c8bbb6aafe3f9d55e2fb445d5846a5e9d02ebd648c4e630889743bf76ec421e',
      });
      assert.equal(
        plan.candidate.manifestSHA256,
        '23f555db20036838cc1601f2cebf8f1a75eb62fb0c6cf36f1e1988035b3e1b64',
      );
    }
    assert.equal(plan.baseline.revision, '8b01991942dc764b8aa4726851699ce1985e53ae');
    assert.equal(plan.baseline.tree, '9373b6a74aea8fa1ef47aa17ace140b4cf714609');
    for (const key of ['artifact', 'reusableArtifact', 'publisher', 'buildCommand'])
      assert.equal(plan.baseline[key], undefined);
    assert.equal(plan.upload, undefined);
  } else if (current) {
    assert.equal(plan.sourceCohort, 'long-rail-a6-main8b-v1');
    assert.equal(plan.candidate.tree, '6b13627e324f695b6ee8d9f2dee2eeeb7217c332');
    assert.equal(plan.runtimeRevision, '32abd322afd8243e4537ce4784e2f78ee45ecbec');
    assert.equal(plan.candidate.run, 39008793814);
    assert.equal(plan.candidate.artifact, 12092903788);
    assert.deepEqual(plan.candidate.outer, {
      bytes: 1091879339,
      sha256: 'a61fd756ce362abacf5dd5f329bed1a936db2b888b9f814cf5924a781964e14a',
    });
    assert.deepEqual(plan.candidate.inner, {
      bytes: 1073755490,
      sha256: '52a9f82f48b3e657755f2c5735826b827caa1e866430d30939d05113b1fa67b1',
    });
    assert.equal(
      plan.candidate.manifestSHA256,
      'b0e56f24e4d49c6c9ee42000f472ca895c883ca02e1063db741e2eddfe428fb7',
    );
    assert.equal(plan.baseline.revision, '8b01991942dc764b8aa4726851699ce1985e53ae');
    assert.equal(plan.baseline.tree, '9373b6a74aea8fa1ef47aa17ace140b4cf714609');
    for (const key of ['artifact', 'reusableArtifact', 'publisher', 'buildCommand'])
      assert.equal(plan.baseline[key], undefined);
    assert.deepEqual(plan.upload, {
      path: 'docs/performance/fixtures/solo-remote-timing/long-rail.xonix.fixture',
      bytes: 3563,
      sha256: '821897e571449bb5ec27678eef09c5955d9e9be873aaaf76736ff1aadbd0d84c',
    });
  } else {
    assert.equal(plan.sourceCohort, undefined);
    assert.equal(plan.upload, undefined);
    assert.equal(plan.baseline.revision, 'b11745223861c3973ad4bf440cc536198b8e0371');
    assert(plan.baseline.reusableArtifact);
  }
  assert.equal(plan.node, '22.13.1');
  assert.equal(plan.playwright, '1.62.1');
  assert.equal(
    plan.cpu,
    firstVictoryDe332(plan) || firstVictory797(plan)
      ? 3.88
      : victory
        ? 2.42
        : current
          ? 4.19
          : 2.46,
  );
  assert.equal(plan.performanceExclusion, true);
  assert.equal(plan.automaticRetries, 0);
  assert.equal(plan.automaticPhaseContinuation, false);
  assert.equal(plan.maxParallel, 1);
  assert.equal(plan.setupTimeoutMs, 40 * 60000);
  assert.equal(plan.helperTimeoutMs, 75 * 60000);
  assert.equal(plan.evidenceBytes, 256 * MiB);
  assert.equal(plan.rowEvidenceBytes, 128 * MiB);
  assert.deepEqual(plan.rows, [rowDefinition(plan)]);
  assert.equal(plan.recipe.sha256, recipeHash(plan));
  if (current)
    assert.equal(
      plan.recipe.bytes,
      victory
        ? firstVictory797(plan)
          ? 3547
          : firstVictoryDe332(plan)
            ? 3545
            : firstVictory239(plan)
              ? 3524
              : 3527
        : 4562,
    );
  assert.equal(
    plan.recipe.path,
    victory
      ? firstVictory797(plan)
        ? 'docs/performance/fixtures/solo-remote-sustained/first-victory-cpu-797e03.qualification.fixture'
        : firstVictoryDe332(plan)
          ? 'docs/performance/fixtures/solo-remote-sustained/first-victory-cpu-de332.qualification.fixture'
          : firstVictory239(plan)
            ? 'docs/performance/fixtures/solo-remote-sustained/first-victory-cpu-239.qualification.fixture'
            : 'docs/performance/fixtures/solo-remote-sustained/first-victory-cpu-e1cc.qualification.fixture'
      : current
        ? 'docs/performance/fixtures/solo-remote-timing/long-rail.qualification.fixture'
        : 'docs/performance/fixtures/solo-remote-timing/cold-first30.qualification.fixture',
  );
  assert.deepEqual(plan.profile, {
    maximumMs: 240000,
    maximumBytes: 64 * MiB,
    samplingIntervalUs: 1000,
    traceBytes: 0,
    screenshots: false,
    heap: false,
  });
  assert.equal(plan.release.scope, 'single-causal-cpu-profile');
  if (firstVictory797(plan)) validate797FirstEight(plan.release);
  else if (victory) {
    assert.equal(plan.release.firstEightRequired, false);
    assert.equal(plan.release.firstEightAllCorrectnessPassed, undefined);
  } else assert.equal(plan.release.firstEightAllCorrectnessPassed, false);
  assert.equal(plan.release.performanceQualification, 'excluded-cpu-profiling');
  if (victory) {
    assert.equal(
      plan.release.predecessorRun,
      firstVictoryDe332(plan) || firstVictory797(plan) ? 39098131087 : 39044567236,
    );
    assert.equal(plan.release.priorProofInspected, true);
    assert.equal(plan.release.noUnclosedOwners, true);
    assert.equal(
      plan.release.ownerClosureScope,
      firstVictoryDe332(plan) || firstVictory797(plan)
        ? 'specific-de332-next-chromium-r1-command-only'
        : 'specific-next-chromium-r2-command-only',
    );
    assert.equal(plan.release.allPriorPlannedJobsClosed, undefined);
    assert.equal(
      plan.release.onceOnlyBefore,
      firstVictoryDe332(plan) || firstVictory797(plan)
        ? undefined
        : firstVictory239(plan)
          ? FIRST_VICTORY_239_CPU_SOURCE
          : '7c7cc2648331870683ac7b76850bbeff859f802e',
    );
    if (firstVictory239(plan))
      assert.deepEqual(plan.release.priorProfileAttempt, {
        run: 39049194706,
        job: 117444171935,
        tooling: FIRST_VICTORY_239_CPU_SOURCE,
        candidate: FIRST_VICTORY_CPU_SOURCE,
        conclusion: 'failure',
        stage: 'candidate-source-fetch',
        nativeObservations: 0,
        sourceCheckoutMinutes: 3,
        boundsChanged: false,
        inference: 'inconclusive-external-setup-timeout',
      });
    else assert.equal(plan.release.priorProfileAttempt, undefined);
    assert.deepEqual(
      plan.stressOrigin,
      firstVictoryDe332(plan) || firstVictory797(plan)
        ? firstVictoryDe332ProfileOrigin()
        : firstVictoryProfileOrigin(),
    );
    if (firstVictoryDe332(plan) || firstVictory797(plan))
      assert.deepEqual(plan.release.dispatch, {
        workflow: '.github/workflows/solo-native-package-consumer.yml',
        lane: 'hud-cpu',
        ref: 'main',
        source: source(plan),
        automaticRetries: 0,
      });
  } else if (current) {
    assert.equal(plan.release.predecessorRun, 39015298582);
    assert.equal(plan.release.priorProofInspected, true);
    assert.equal(plan.release.noUnclosedOwners, true);
    assert.equal(plan.release.ownerClosureScope, 'specific-long-rail-chromium-r1-command-only');
    assert.equal(plan.release.allPriorPlannedJobsClosed, undefined);
    assert.equal(plan.release.siblingQualificationJobsMayRemainActive, true);
    assert.equal(plan.release.onceOnlyBefore, 'c41a02216c0811952232a387fd1743e09452c269');
    assert.deepEqual(plan.stressOrigin, longRailProfileOrigin());
  } else {
    assert.equal(plan.release.predecessorRun, 38991754594);
    for (const key of ['priorProofInspected', 'noUnclosedOwners', 'allPriorPlannedJobsClosed'])
      assert.equal(plan.release[key], true);
    assert.equal(plan.stressOrigin.run, 38991754594);
    assert.equal(plan.stressOrigin.artifact, 12085597903);
    assert.equal(plan.stressOrigin.rate, 2.46);
    assert.equal(plan.stressOrigin.newHostCalibration, false);
    assert.equal(plan.stressOrigin.scope, 'fixed-diagnostic-factor-only');
  }
  assert.deepEqual(
    plan.adapterInputs.map(({ path }) => path),
    ['scripts/solo-remote-cpu-profile.mjs', 'scripts/solo-remote-baseline.mjs'],
  );
  assert(plan.frozenTools.length > 0 && plan.frozenTools.length <= 64);
  assert.equal(new Set(references(plan).map(({ path }) => path)).size, references(plan).length);
  for (const path of [
    'scripts/solo-qualification-cpu-profile.mjs',
    'scripts/solo-remote-supplemental.mjs',
    'scripts/qualify-solo-runtime.mjs',
    'scripts/run-solo-remote-correctness.mjs',
    ...(victory
      ? [
          'scripts/solo-qualification-next-route.mjs',
          'scripts/solo-qualification-hitch-journal.mjs',
        ]
      : []),
    ...(current
      ? [
          'scripts/soundtrack-distribution.mjs',
          'scripts/optional-distribution.mjs',
          'scripts/external-distribution.mjs',
          'scripts/optional-artwork.mjs',
          'scripts/verify-solo-build.mjs',
        ]
      : []),
  ])
    assert(plan.frozenTools.some((ref) => ref.path === path));
  for (const ref of references(plan)) {
    assert(/^(scripts|game|docs)\//.test(ref.path) && !ref.path.split('/').includes('..'));
    assert(Number.isSafeInteger(ref.bytes) && ref.bytes > 0 && ref.bytes < MiB);
    assert.match(ref.sha256, /^[a-f0-9]{64}$/);
  }
  return plan;
}
export function bindCpuProfileJob(manifest) {
  assert.equal(manifest.format, 'SoloHostedCpuProfileManifestV1');
  return validateCpuProfilePlan({
    ...structuredClone(manifest),
    format: 'SoloHostedCpuProfilePlanV1',
    rows: [rowDefinition(manifest)],
  });
}
export function cpuProfileMatrix(manifest) {
  const plan = bindCpuProfileJob(manifest);
  return {
    include: [
      {
        phase: plan.phase,
        engine: 'chromium',
        jobMinutes: 130,
        stepMinutes: 78,
        outerSeconds: 4620,
      },
    ],
  };
}
async function verifyInputs(ctx) {
  for (const ref of references(ctx.plan)) {
    const path = resolve(ctx.repository, ref.path);
    assert(path.startsWith(ctx.repository + '/'));
    assert.equal(await realpath(path), path);
    const info = await lstat(path);
    assert(info.isFile() && !info.isSymbolicLink());
    assert.deepEqual(await ctx.digest(path), { bytes: ref.bytes, sha256: ref.sha256 });
  }
}
export async function prepareCpuProfileMode(ctx) {
  validateCpuProfilePlan(ctx.plan);
  await verifyInputs(ctx);
  assert.equal(ctx.admitted.status, 'passed');
  const input = join(ctx.work, 'cpu-profile-inputs');
  await mkdir(input);
  const recipePath = join(input, 'scenario.qualification.json');
  await copyFile(resolve(ctx.repository, ctx.plan.recipe.path), recipePath);
  assert.deepEqual(await ctx.digest(recipePath), {
    bytes: ctx.plan.recipe.bytes,
    sha256: ctx.plan.recipe.sha256,
  });
  await copyFile(recipePath, join(ctx.evidence, 'scenario.qualification.json'));
  if (longRail(ctx.plan)) {
    const upload = join(input, 'long-rail.xonix.json');
    await copyFile(resolve(ctx.repository, ctx.plan.upload.path), upload);
    assert.deepEqual(await ctx.digest(upload), {
      bytes: ctx.plan.upload.bytes,
      sha256: ctx.plan.upload.sha256,
    });
    await copyFile(upload, join(ctx.evidence, 'long-rail.xonix.json'));
  }
  const scenario = await readSupplementalJSON(recipePath, MiB);
  assert.equal(
    scenario.timeoutMs,
    warmFrameTrace(ctx.plan) ? ctx.plan.scenarioTimeoutMs : ctx.plan.profile.maximumMs,
  );
  assert.equal(scenario.kind, 'performance');
  assert(scenario.expectedReplayDefinition && scenario.replayRequirements);
  if (warmFrameTrace(ctx.plan)) {
    const { verifiedMidCalibration, prepareCalibrationScratch } = await import(
      './solo-remote-sustained.mjs'
    );
    const path = join(ctx.evidence, 'fresh-mid-calibration.json');
    const scratch = await prepareCalibrationScratch(ctx.report);
    await ctx.required(
      'fresh-mid-calibration',
      [process.execPath, join(ctx.here, 'calibrate-solo-performance.mjs'), path],
      ctx.plan.calibrationTimeoutMs,
      { env: { ...ctx.cleanEnv, TMPDIR: scratch.path } },
    );
    const mode = {
      recipePath,
      ...verifiedMidCalibration(await readSupplementalJSON(path, MiB)),
      calibration: { path, ...(await ctx.digest(path)) },
    };
    Object.assign(ctx.report, {
      performanceExclusion: true,
      performanceQualification: 'excluded-browser-frame-tracing',
      firstEightRequired: true,
      firstEightAllCorrectnessPassed: true,
      releaseScope: ctx.plan.release.scope,
      frameTraceStratum: {
        engine: 'chromium',
        cpu: mode.cpu,
        calibration: mode.calibration,
        browserVersion: mode.browserVersion,
      },
    });
    return mode;
  }
  Object.assign(ctx.report, {
    performanceExclusion: true,
    performanceQualification: 'excluded-cpu-profiling',
    ...(firstVictory797(ctx.plan)
      ? { firstEightRequired: true, firstEightAllCorrectnessPassed: true }
      : firstVictory(ctx.plan)
        ? { firstEightRequired: false }
        : { firstEightAllCorrectnessPassed: false }),
    releaseScope: ctx.plan.release.scope,
    stressOrigin: ctx.plan.stressOrigin,
  });
  return { recipePath };
}
export function cpuProfileArguments(ctx, url, dir) {
  if (warmFrameTrace(ctx.plan)) {
    assert(Number.isFinite(ctx.modeState.cpu) && ctx.modeState.cpu >= 1 && ctx.modeState.cpu <= 20);
    assert(ctx.modeState.calibration && typeof ctx.modeState.browserVersion === 'string');
    return [
      join(ctx.here, 'qualify-solo-runtime.mjs'),
      url,
      ctx.modeState.recipePath,
      join(dir, 'report.json'),
      '--server-fixture-access',
      '--work-probe',
      '--cadence=settled120',
      '--cpu=' + ctx.modeState.cpu,
      '--browser=chromium',
      '--source-revision=' + source(ctx.plan),
      '--frame-trace=warm-first3-v1',
    ];
  }
  return [
    join(ctx.here, 'qualify-solo-runtime.mjs'),
    url,
    ctx.modeState.recipePath,
    join(dir, 'report.json'),
    '--server-fixture-access',
    '--work-probe',
    '--cadence=settled120',
    `--cpu=${firstVictoryDe332(ctx.plan) || firstVictory797(ctx.plan) ? 3.88 : firstVictory(ctx.plan) ? 2.42 : longRail(ctx.plan) ? 4.19 : 2.46}`,
    '--browser=chromium',
    `--source-revision=${source(ctx.plan)}`,
    '--cpu-profile',
    ...(firstVictory(ctx.plan)
      ? ['--hitch-journal', '--authored-next-route=authored-next-geometric-v1']
      : []),
  ];
}

export function frameTraceAssessment(plan, raw, command, readback, mode) {
  validateFrameTracePlan(plan);
  const replay = raw?.replay?.nativeVerification,
    trace = raw?.frameTrace;
  const calibration = mode?.calibration;
  const calibrated =
    Number.isFinite(mode?.cpu) &&
    mode.cpu >= 1 &&
    mode.cpu <= 20 &&
    typeof mode.browserVersion === 'string' &&
    Number.isSafeInteger(calibration?.bytes) &&
    calibration.bytes > 0 &&
    calibration.bytes <= MiB &&
    /^[a-f0-9]{64}$/.test(calibration.sha256);
  const correct =
    calibrated &&
    command?.status === 'closed' &&
    command.exitCode === 0 &&
    !command.signal &&
    !command.forcedCleanup &&
    !command.cleanupUnconfirmed &&
    !command.violation &&
    command.survivors?.length === 0 &&
    command.ambiguous?.length === 0 &&
    raw?.format === 'SoloQualificationReportV1' &&
    raw.kind === 'frame-trace-diagnostic' &&
    raw.cpuProfile === undefined &&
    raw.scenarioKind === 'performance' &&
    raw.audioProof === false &&
    raw.scenarioStatus === 'pass' &&
    raw.scenarioSHA256 === frameRecipe.sha256 &&
    raw.sourceRevision === FRAME_TRACE_CANDIDATE.revision &&
    raw.buildIdentity?.sourceRevision === FRAME_TRACE_CANDIDATE.revision &&
    raw.environment?.engine === 'chromium' &&
    raw.environment.headless === true &&
    raw.environment.cpuThrottle === mode.cpu &&
    raw.environment.contextMode === 'ephemeral' &&
    raw.environment.browserVersion === mode.browserVersion &&
    raw.environment.requestedDisplay?.viewport?.width === 1280 &&
    raw.environment.requestedDisplay.viewport.height === 800 &&
    raw.environment.requestedDisplay.deviceScaleFactor === 1 &&
    raw.environment.requestedDisplay.isMobile === false &&
    raw.environment.requestedDisplay.hasTouch === false &&
    raw.workProbe === true &&
    raw.cadenceProtocol === 'settled120' &&
    raw.baselineRuntime === false &&
    raw.replay?.scope === 'completed-scenario' &&
    replay?.status === 'pass' &&
    replay.engine === 'chromium' &&
    replay.browserVersion === raw.environment.browserVersion &&
    raw.pageErrors?.length === 0 &&
    !raw.failure &&
    !raw.finalReadFailure &&
    !raw.failureCleanupFailure &&
    !raw.contextCleanupFailure &&
    !raw.replayFailure;
  const retained =
    readback?.status === 'passed' &&
    trace?.status === 'retained' &&
    trace.protocol === 'warm-first3-v1' &&
    trace.backend?.applicationRenderer === 'unobserved' &&
    trace.backend.hardwareGraphics === 'unobserved' &&
    trace.maximumMs === 30000 &&
    trace.maximumBytes === 64 * MiB &&
    trace.bufferKiB === 8192 &&
    trace.chunkBytes === 65536 &&
    trace.maximumReads === 1025 &&
    trace.stopReason === 'safe-border-direction-3' &&
    Number.isFinite(trace.stopRequestedElapsedMs) &&
    trace.stopRequestedElapsedMs >= 0 &&
    trace.stopRequestedElapsedMs <= 30000 &&
    Number.isFinite(trace.preStartSetupMs) &&
    trace.preStartSetupMs >= 0 &&
    trace.preStartSetupMs < 60000 &&
    trace.startAcknowledged === true &&
    trace.completionObserved === true &&
    trace.dataLossOccurred === false &&
    trace.streamEOF === true &&
    trace.streamClosed === true &&
    trace.cdpDetached === true &&
    !trace.limitReached &&
    !trace.bufferFull &&
    !trace.failure &&
    !trace.startOutcomeUnknown &&
    !trace.completionUnconfirmed &&
    !trace.ownerClosureRequested &&
    !trace.ownerCloseFailure &&
    !trace.streamCloseFailure &&
    !trace.detachFailure &&
    !raw.frameTraceFailure &&
    trace.bytes === readback.bytes &&
    trace.sha256 === readback.sha256 &&
    trace.bytes > 0 &&
    trace.bytes <= 64 * MiB &&
    readback.inspectionVerified === true;
  return {
    status:
      correct && retained && raw?.performanceGateStatus === 'excluded-browser-frame-tracing'
        ? 'passed'
        : 'failed',
    nativeRecipeCorrectness: correct ? 'pass' : 'fail',
    traceRetention: retained ? 'pass' : 'fail',
    rawPerformanceGateStatus: raw?.performanceGateStatus ?? 'unobserved',
    performanceQualification: 'excluded-browser-frame-tracing',
    firstEightRequired: true,
    firstEightAllCorrectnessPassed: true,
    calibration: calibration ?? null,
    cpu: mode?.cpu ?? null,
    backend: trace?.backend ?? {
      applicationRenderer: 'unobserved',
      hardwareGraphics: 'unobserved',
    },
    scope:
      'One perturbed Chromium warm browser-frame trace with a fresh verified mid calibration. No numerical qualification, physical presentation, hardware GPU, OS scheduling or causal attribution is inferred.',
  };
}
export async function readFrameTraceEvidence(path, raw) {
  const { inspectFrameTrace, FRAME_TRACE_CATEGORIES } = await import(
    './solo-qualification-cpu-profile.mjs'
  );
  assert.equal(raw?.file, path);
  assert.equal(await realpath(path), path);
  const info = await lstat(path);
  assert(info.isFile() && !info.isSymbolicLink() && info.size > 0 && info.size <= 64 * MiB);
  const handle = await open(path, 'r');
  try {
    const opened = await handle.stat();
    assert.equal(opened.dev, info.dev);
    assert.equal(opened.ino, info.ino);
    assert.equal(opened.size, info.size);
    const bytes = Buffer.alloc(info.size + 1);
    let offset = 0;
    while (offset < bytes.length) {
      const result = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (!result.bytesRead) break;
      offset += result.bytesRead;
    }
    assert.equal(offset, info.size, 'Trace changed size during readback');
    const after = await handle.stat();
    assert.equal(after.dev, info.dev);
    assert.equal(after.ino, info.ino);
    assert.equal(after.size, info.size);
    const retained = bytes.subarray(0, offset),
      identity = { bytes: offset, sha256: createHash('sha256').update(retained).digest('hex') };
    assert.deepEqual(identity, { bytes: raw.bytes, sha256: raw.sha256 });
    assert.deepEqual(raw.categories, FRAME_TRACE_CATEGORIES);
    assert.deepEqual(inspectFrameTrace(retained, raw.anchors), raw.inspection);
    return { status: 'passed', ...identity, inspectionVerified: true };
  } finally {
    await handle.close();
  }
}

export function cpuProfileAssessment(plan, raw, command, profileReadback, mode) {
  if (warmFrameTrace(plan)) return frameTraceAssessment(plan, raw, command, profileReadback, mode);
  const profile = raw?.cpuProfile,
    replay = raw?.replay?.nativeVerification;
  const correct =
    command?.status === 'closed' &&
    command.exitCode === 0 &&
    !command.forcedCleanup &&
    !command.cleanupUnconfirmed &&
    !command.violation &&
    command.survivors?.length === 0 &&
    command.ambiguous?.length === 0 &&
    raw?.format === 'SoloQualificationReportV1' &&
    raw.kind === 'cpu-profile' &&
    raw.scenarioKind === 'performance' &&
    raw.audioProof === false &&
    raw.scenarioStatus === 'pass' &&
    raw.scenarioSHA256 === recipeHash(plan) &&
    raw.sourceRevision === source(plan) &&
    raw.buildIdentity?.sourceRevision === source(plan) &&
    raw.environment?.engine === 'chromium' &&
    raw.environment.cpuThrottle === plan.cpu &&
    raw.environment.contextMode === 'ephemeral' &&
    typeof raw.environment.browserVersion === 'string' &&
    raw.environment.requestedDisplay?.viewport?.width === 1280 &&
    raw.environment.requestedDisplay.viewport.height === 800 &&
    raw.environment.requestedDisplay.deviceScaleFactor === 1 &&
    raw.environment.requestedDisplay.isMobile === false &&
    raw.environment.requestedDisplay.hasTouch === false &&
    raw.workProbe === true &&
    raw.cadenceProtocol === 'settled120' &&
    raw.baselineRuntime === false &&
    raw.replay?.scope === 'completed-scenario' &&
    replay?.status === 'pass' &&
    replay.engine === 'chromium' &&
    replay.browserVersion === raw.environment.browserVersion &&
    raw.pageErrors?.length === 0 &&
    !raw.failure &&
    !raw.finalReadFailure &&
    !raw.failureCleanupFailure &&
    !raw.contextCleanupFailure &&
    !raw.replayFailure &&
    (!firstVictory(plan) ||
      (raw.hitchJournal?.status === 'complete' &&
        !raw.hitchJournalFailure &&
        raw.actions?.filter((a) => a.type === 'authored-next-route').length === 1 &&
        raw.actions.some(
          (a) =>
            a.type === 'authored-next-route' &&
            a.status === 'passed-public-route' &&
            a.protocol === 'authored-next-geometric-v1' &&
            a.mission === 'first-return' &&
            a.unsettled === 0 &&
            a.heldKeys?.length === 0,
        )));
  const retained =
    profileReadback?.status === 'passed' &&
    profile?.status === 'retained' &&
    profile.maximumMs === plan.profile.maximumMs &&
    profile.samplingIntervalUs === plan.profile.samplingIntervalUs &&
    !profile.limitReached &&
    profile.stopReason === 'actions-ended' &&
    Number.isSafeInteger(profile.sampleCount) &&
    profile.sampleCount > 0 &&
    Number.isSafeInteger(profile.nodeCount) &&
    profile.nodeCount > 0 &&
    profile.bytes === profileReadback.bytes &&
    profile.sha256 === profileReadback.sha256 &&
    profile.bytes > 0 &&
    profile.bytes <= plan.profile.maximumBytes &&
    !raw.cpuProfileFailure &&
    !raw.cpuProfileLimit;
  return {
    status:
      correct && retained && raw?.performanceGateStatus === 'excluded-cpu-profiling'
        ? 'passed'
        : 'failed',
    nativeRecipeCorrectness: correct ? 'pass' : 'fail',
    profileRetention: retained ? 'pass' : 'fail',
    rawPerformanceGateStatus: raw?.performanceGateStatus ?? 'unobserved',
    performanceQualification: 'excluded-cpu-profiling',
    ...(firstVictory797(plan)
      ? { firstEightRequired: true, firstEightAllCorrectnessPassed: true }
      : firstVictory(plan)
        ? { firstEightRequired: false }
        : { firstEightAllCorrectnessPassed: false }),
    scope:
      'One causal JavaScript CPU profile; no timing, device, thermal, trace or prerequisite credit. Fixed stress factor is not calibrated on this host.',
  };
}
export async function runCpuProfileRow(ctx, row, dir, tmp) {
  await verifyInputs(ctx);
  const { startProductionPreview } = await import('./serve-production-preview.mjs');
  const { PUBLIC_SECURITY_HEADERS } = await import('./game-cli.mjs');
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
    const bytes = Buffer.from(await response.arrayBuffer()),
      build = JSON.parse(bytes);
    assert.equal(build.sourceRevision, source(ctx.plan));
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
    row.artifactAdmission = ctx.admitted.artifacts.candidate;
    row.command = await ctx.run(
      row.id,
      [process.execPath, ...cpuProfileArguments(ctx, url, dir)],
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
    const raw = await readSupplementalJSON(join(dir, 'report.json'));
    row.profileReadback = { status: 'failed' };
    try {
      if (warmFrameTrace(ctx.plan)) {
        row.profileReadback = await readFrameTraceEvidence(
          join(dir, 'report.json.frame-trace.json'),
          raw.frameTrace,
        );
      } else {
        const profilePath = join(dir, 'report.json.cpuprofile');
        assert.equal(raw.cpuProfile?.file, profilePath);
        assert.equal(await realpath(profilePath), profilePath);
        const info = await lstat(profilePath);
        assert(
          info.isFile() &&
            !info.isSymbolicLink() &&
            info.size > 0 &&
            info.size <= ctx.plan.profile.maximumBytes,
        );
        const identity = await ctx.digest(profilePath);
        assert.deepEqual(identity, { bytes: raw.cpuProfile.bytes, sha256: raw.cpuProfile.sha256 });
        row.profileReadback = { status: 'passed', ...identity };
      }
    } catch (error) {
      row.profileReadback.failure = String(error);
    }
    Object.assign(
      row,
      cpuProfileAssessment(ctx.plan, raw, row.command, row.profileReadback, ctx.modeState),
    );
    row.browserVersion = raw.environment?.browserVersion;
    await verifyInputs(ctx);
  } finally {
    if (server)
      await Promise.race([
        new Promise((yes, no) => {
          server.server.close((error) => (error ? no(error) : yes()));
          server.server.closeAllConnections();
        }),
        delay(10000).then(() => {
          throw Error('CPU-profile owned preview close deadline');
        }),
      ]).catch((error) => {
        row.serverCleanupFailure = String(error);
        row.status = 'failed';
        throw error;
      });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, input, output] = process.argv.slice(2),
    bytes = await readFile(input);
  if (mode === 'matrix-plan')
    process.stdout.write(`matrix=${JSON.stringify(cpuProfileMatrix(JSON.parse(bytes)))}\n`);
  else {
    assert.equal(mode, 'bind-plan');
    const plan = bindCpuProfileJob(JSON.parse(bytes));
    plan.manifestInput = {
      path: resolve(input),
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
    await writeFile(output, JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
  }
}
