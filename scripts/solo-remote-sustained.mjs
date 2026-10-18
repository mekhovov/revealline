import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, mkdir, open, readFile, realpath, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import {
  evaluateQualificationBudgets,
  qualificationSnapshotStorage,
} from './solo-qualification.mjs';
import {
  aggregateQualificationGates,
  externalQualificationBudgets,
} from './solo-qualification-observation.mjs';

const MiB = 1024 ** 2;
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const source = {
  baseline: 'b11745223861c3973ad4bf440cc536198b8e0371',
  candidate: '3adcd53792043ef02459e86168c6b33a66d6ef00',
};
const coldSourceCohort = {
  name: 'cold-main8b-candidatecce',
  baseline: '8b01991942dc764b8aa4726851699ce1985e53ae',
  baselineTree: '9373b6a74aea8fa1ef47aa17ace140b4cf714609',
  candidate: 'cce49c81d82b79aefc24898f32eeebc609e569fb',
  candidateTree: '71f7e4cb3b0a39c1d281635774371a693794dd22',
  runtime: '01bcea27ad8c63616e1718121baae12de5bbbb24',
};
const finalTimingSource = {
  baseline: '8b01991942dc764b8aa4726851699ce1985e53ae',
  baselineTree: '9373b6a74aea8fa1ef47aa17ace140b4cf714609',
  candidate: 'a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4',
  candidateTree: '6b13627e324f695b6ee8d9f2dee2eeeb7217c332',
  runtime: '32abd322afd8243e4537ce4784e2f78ee45ecbec',
};
const setupSuccessors = {
  'cold-first30': {
    priorRun: 39012635535,
    priorConclusion: 'failure',
    originalDeclaration: {
      path: 'docs/performance/solo-final-timing-cold-first30-plan.json',
      bytes: 15177,
      sha256: 'fe87b494680a8c0503ccb6809d7377cf4d9d9788bc42fcfad61d2cb3ba7dd6be',
    },
  },
  'warm-first30': {
    priorRun: 39012635503,
    priorConclusion: 'failure',
    originalDeclaration: {
      path: 'docs/performance/solo-final-timing-warm-first30-plan.json',
      bytes: 15180,
      sha256: '4941bd8a1fb185ce9252c60260a0b2f5a97453d63a66a085c9f55f54d6201b54',
    },
  },
  sentry: {
    priorRun: 39012635473,
    priorConclusion: 'failure',
    originalDeclaration: {
      path: 'docs/performance/solo-final-timing-sentry-plan.json',
      bytes: 15156,
      sha256: '20375ccdbbca9d14a483971bbd5111a9823a6c99a90af24a3150f5335593e0db',
    },
  },
  'long-rail': {
    priorRun: 39012635488,
    priorConclusion: 'failure',
    originalDeclaration: {
      path: 'docs/performance/solo-final-timing-long-rail-plan.json',
      bytes: 15162,
      sha256: '3cf600c4dae17cf2821696cd37bab7dd43e437bfc4b65cfe5e29a27959ca6744',
    },
  },
  soak: {
    priorRun: 39012635593,
    priorConclusion: 'cancelled',
    originalDeclaration: {
      path: 'docs/performance/solo-final-soak-plan.json',
      bytes: 16659,
      sha256: '073a62f519daa8d5f57904faeb2ca41c93568b9a6ff5063df6bc3321edcd9d0c',
    },
  },
};
export const COMPARISON_SETUP_DYNAMIC_ROOTS = Object.freeze([
  'scripts/soundtrack-distribution.mjs',
  'scripts/optional-distribution.mjs',
  'scripts/external-distribution.mjs',
  'scripts/optional-artwork.mjs',
]);
export function comparisonSetupSuccessor(phase) {
  assert(Object.hasOwn(setupSuccessors, phase), 'No failed setup declaration for this phase');
  return {
    format: 'SoloVerifierClosureSuccessorV1',
    ...structuredClone(setupSuccessors[phase]),
    priorNativeObservations: 0,
    reason: 'missing-dynamic-source-verifier-dependencies',
    runtimeChanged: false,
    scenarioChanged: false,
    gateChanged: false,
    automaticRetries: 0,
  };
}
function validateSetupSuccessor(plan, selected) {
  if (plan.setupSuccessor === undefined) return;
  assert.equal(selected, finalTimingSource, 'Only the exact final-source setup is admitted');
  assert.equal(plan.release.status, 'reviewed-diagnostic-only');
  assert.deepEqual(plan.setupSuccessor, comparisonSetupSuccessor(plan.phase));
  assert.equal(plan.release.onceOnlyBefore, 'a7e0219818842f02399317ca6d2a14bdd506da3d');
  for (const path of COMPARISON_SETUP_DYNAMIC_ROOTS)
    assert(
      plan.frozenTools.some((ref) => ref.path === path),
      `Missing verifier dependency ${path}`,
    );
}
export const GEOMETRIC_NEXT_SOURCE = Object.freeze({
  name: 'next-candidatec696-geometric-v1',
  baseline: '8b01991942dc764b8aa4726851699ce1985e53ae',
  baselineTree: '9373b6a74aea8fa1ef47aa17ace140b4cf714609',
  candidate: 'c696af41857840359ae473558b90682f3d71f2db',
  candidateTree: 'b70ce1c4b15023a38628c5e958b166e44898eccf',
  runtime: 'c696af41857840359ae473558b90682f3d71f2db',
  recipeHash: '0fd24c7db64be144da0d05b57ae26289b2a676a4f90df547d918c6cc13cef1a8',
});
export const GEOMETRIC_NEXT_FINAL_SOURCE = Object.freeze({
  ...GEOMETRIC_NEXT_SOURCE,
  name: 'next-candidatee1cc-geometric-v1',
  candidate: 'e1cc5dd7656bab349715cd1c3ce6e9f783508c17',
  candidateTree: '58f19392e25384620d896098fce8616b538e318d',
  runtime: 'e1cc5dd7656bab349715cd1c3ce6e9f783508c17',
});
export const GEOMETRIC_NEXT_39774_SOURCE = Object.freeze({
  ...GEOMETRIC_NEXT_SOURCE,
  name: 'next-candidate39774-geometric-v1',
  candidate: '39774cce8697d412d138ef4da11ac547a5f8e535',
  candidateTree: 'cac2369a26cac5282e4260c638b934540d17ced6',
  runtime: '39774cce8697d412d138ef4da11ac547a5f8e535',
});
export const GEOMETRIC_NEXT_DE332_SOURCE = Object.freeze({
  ...GEOMETRIC_NEXT_SOURCE,
  name: 'next-candidatede332-geometric-v1',
  candidate: 'de3324607c82787c1a1fec9c13d4f8b5cb74cee4',
  candidateTree: '2954fef5b0f1293ff2e6a97ce978a673dddaa7db',
  runtime: 'de3324607c82787c1a1fec9c13d4f8b5cb74cee4',
});
const geometricNextSource = (plan) =>
  plan.sourceCohort === GEOMETRIC_NEXT_SOURCE.name
    ? GEOMETRIC_NEXT_SOURCE
    : plan.sourceCohort === GEOMETRIC_NEXT_FINAL_SOURCE.name
      ? GEOMETRIC_NEXT_FINAL_SOURCE
      : plan.sourceCohort === GEOMETRIC_NEXT_39774_SOURCE.name
        ? GEOMETRIC_NEXT_39774_SOURCE
        : plan.sourceCohort === GEOMETRIC_NEXT_DE332_SOURCE.name
          ? GEOMETRIC_NEXT_DE332_SOURCE
          : null;
const geometricNextPlan = (plan) => geometricNextSource(plan) !== null;
const finalSoakCohort = 'soak-main8b-candidatea6e';
const anchoredSoakHash = '079d4dd76fbd914ddd4da7311f8e6cee4a0ff4fc3bc951842b2921c94c53b8ff';
const finalLifecycle = Object.freeze({
  next: {
    cohort: 'next-main8b-candidatea6e',
    hash: '17aa6627b51310ea2ccc4cca2d77a5a9f00d68c6a4edff114720480c208ae11b',
  },
  retry: {
    cohort: 'retry-main8b-candidatea6e',
    hash: '77458b3992e1f40b565bd57912bdc2b4e79ddadb8ce07b617456e220853fe9d1',
  },
  long29: {
    cohort: 'long29-main8b-candidatea6e',
    hash: '5ffad85e4dc752ea3e8bcf236f88e65c09875d58ac339c096890c0b6f2133150',
  },
});
const finalLifecyclePlan = (plan) =>
  Boolean(finalLifecycle[plan.phase]) && plan.sourceCohort === finalLifecycle[plan.phase].cohort;
const finalSustainedPlan = (plan) =>
  plan.sourceCohort === finalSoakCohort || finalLifecyclePlan(plan) || geometricNextPlan(plan);

function selectedSustainedSource(plan) {
  if (plan.sourceCohort === undefined) return null;
  if (geometricNextPlan(plan)) {
    assert.equal(plan.phase, 'next');
    return geometricNextSource(plan);
  }
  if (plan.sourceCohort === finalSoakCohort) assert.equal(plan.phase, 'soak');
  else assert(finalLifecyclePlan(plan), 'Unreviewed final lifecycle phase/source');
  return finalTimingSource;
}
function selectedTimingSource(plan) {
  if (plan.sourceCohort === undefined) return null;
  if (plan.sourceCohort === coldSourceCohort.name) {
    assert.equal(plan.phase, 'cold-first30');
    return coldSourceCohort;
  }
  if (plan.sourceCohort === 'cold-main8b-candidatea6e') assert.equal(plan.phase, 'cold-first30');
  else {
    assert.equal(plan.sourceCohort, 'timing-main8b-candidatea6e');
    assert(['warm-first30', 'sentry', 'long-rail'].includes(plan.phase));
  }
  return finalTimingSource;
}
export const SUSTAINED_PHASES = Object.freeze({
  long29: {
    previous: 'diagnostics',
    timeoutMs: 2640000,
    jobMinutes: 190,
    helperMinutes: 145,
    recipe: 'long29',
    hash: '5ffad85e4dc752ea3e8bcf236f88e65c09875d58ac339c096890c0b6f2133150',
  },
  soak: {
    previous: 'first8',
    timeoutMs: 2640000,
    jobMinutes: 190,
    helperMinutes: 145,
    recipe: 'soak',
    hash: 'c5a3c197b828c92a4e737a681153692aa02ab86b24cc62bafc9d070f3fa2b39b',
  },
  next: {
    previous: 'soak',
    timeoutMs: 1440000,
    jobMinutes: 150,
    helperMinutes: 105,
    recipe: 'next',
    hash: '869679e7a89bbd1a329ea3efd319aa8a4ffeaa1495715642a1447ab7a36dda40',
  },
  retry: {
    previous: 'next',
    timeoutMs: 1140000,
    jobMinutes: 140,
    helperMinutes: 95,
    recipe: 'retry',
    hash: '2e44c12bbe09f3f9cb27b25ee61e1a07659a77ecc5e8898c9e635b657a74606c',
  },
  diagnostics: {
    previous: 'retry',
    timeoutMs: 1800000,
    jobMinutes: 130,
    helperMinutes: 85,
    recipe: null,
  },
});

// Separate, explicitly released timing cohort. The five lifecycle phases above
// keep their original source contract, recipes, deadlines and default behavior.
export const TIMING_PHASES = Object.freeze({
  'cold-first30': {
    previous: 'latest-first8',
    hash: 'aa3a4c98c6f272ea515d1e8c9e0fb3238d78782065bfb96ae8fe4e304041e2c5',
  },
  'warm-first30': {
    previous: 'cold-first30',
    hash: '6da01ca449068ca6705012f3d6604362c581fe52c4583407797c0961acf3156d',
  },
  sentry: {
    previous: 'warm-first30',
    hash: '86cc1eea19e1d229dae865b368a94238de900ad83be5d9a4ee469b2e4dc3c0fd',
  },
  'long-rail': {
    previous: 'sentry',
    hash: 'b9afaecaadcbd0f657dd8064b9f7932c0c7ec12d6433f7d2b76f60de7ef19528',
  },
});
const timingPlan = (plan) => plan.format === 'SoloHostedTimingPlanV1';
const roleRevision = (plan, role) =>
  timingPlan(plan) || finalSustainedPlan(plan) ? plan[role].revision : source[role];
const diagnosticComparison = (plan) => plan.release?.status === 'reviewed-diagnostic-only';
function validateDiagnosticComparison(release, candidate = source.candidate) {
  assert.equal(
    release.scope,
    geometricNextPlan(release)
      ? 'independent-candidate-transition-diagnostics'
      : 'independent-comparison-diagnostics',
  );
  if (candidate === GEOMETRIC_NEXT_DE332_SOURCE.candidate) {
    assert.equal(release.predecessorRun, 39073210040);
    assert.equal(release.firstEightRequired, false);
    assert.equal(release.firstEightAllCorrectnessPassed, undefined);
  } else {
    assert.equal(release.predecessorRun, 38985941469);
    assert.equal(release.firstEightAllCorrectnessPassed, false);
  }
  assert.equal(release.performanceQualification, 'not-qualified-diagnostic-only');
  assert.equal(release.automaticRetries, 0);
  assert.equal(release.automaticPhaseContinuation, false);
  assert.equal(release.candidateRevision, candidate);
}
function comparisonLabels(plan) {
  return diagnosticComparison(plan)
    ? {
        comparisonAdmission: 'independent-diagnostic',
        performanceQualification: 'not-qualified-diagnostic-only',
        ...(geometricNextSource(plan) === GEOMETRIC_NEXT_DE332_SOURCE
          ? { firstEightRequired: false }
          : { firstEightAllCorrectnessPassed: false }),
        ...(plan.sourceCohort ? { sourceCohort: plan.sourceCohort } : {}),
      }
    : {};
}

// Declaration checks only. The common runner must still verify each complete
// package, V2 ready proof, source tree and CSP before admitting either role.
function validateSourceCohort(plan, selected) {
  if (plan.sourceCohort === undefined) {
    assert.equal(plan.release.sourceCohort, undefined);
    return null;
  }
  assert.equal(plan.release.sourceCohort, plan.sourceCohort);
  assert.equal(plan.release.status, 'reviewed-diagnostic-only');
  assert.equal(plan.candidate.revision, selected.candidate);
  assert.equal(plan.candidate.tree, selected.candidateTree);
  assert.equal(plan.baseline.revision, selected.baseline);
  assert.equal(plan.baseline.tree, selected.baselineTree);
  assert.equal(plan.latestRuntimeRevision, selected.runtime);
  assert(
    !plan.baseline.publishVerifiedNormal && !plan.baseline.publisher,
    'Reuse the verified normal baseline',
  );
  if (geometricNextPlan(plan)) {
    assert.deepEqual(Object.keys(plan.baseline).sort(), ['revision', 'scope', 'tree']);
    assert.equal(plan.baseline.scope, 'source-only-no-observation');
    assert.equal(plan.candidateOnly, true);
    assert.equal(plan.release.scope, 'independent-candidate-transition-diagnostics');
    if (selected === GEOMETRIC_NEXT_DE332_SOURCE) {
      assert.equal(plan.release.onceOnlyBefore, undefined);
      assert.deepEqual(plan.release.dispatch, {
        workflow: '.github/workflows/solo-native-package-consumer.yml',
        lane: 'next',
        source: GEOMETRIC_NEXT_DE332_SOURCE.candidate,
        reviewOrder: 'manual-only-after-first-eight-result-review',
      });
      assert.deepEqual(plan.candidate, {
        revision: GEOMETRIC_NEXT_DE332_SOURCE.candidate,
        tree: GEOMETRIC_NEXT_DE332_SOURCE.candidateTree,
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
        producer:
          'Exact successful Appearance39091745654, Node22.13.1; full remote package/source/CSP verification remains mandatory.',
      });
    } else {
      assert.equal(
        plan.release.onceOnlyBefore,
        geometricNextSource(plan) === GEOMETRIC_NEXT_SOURCE
          ? '0febd334619731adc26dfa3df78aab02991563af'
          : geometricNextSource(plan) === GEOMETRIC_NEXT_39774_SOURCE
            ? '5e9e16fd48f4b96b4a7fe30c72aa835ce9f536f0'
            : geometricNextSource(plan).candidate,
      );
    }
    assert.equal(plan.nativeRouteProtocol, 'authored-next-geometric-v1');
    const identity = plan.candidate;
    assert(Number.isSafeInteger(identity.run) && identity.run > 0);
    assert(Number.isSafeInteger(identity.artifact) && identity.artifact > 0);
    assert.match(identity.manifestSHA256, /^[a-f0-9]{64}$/);
    for (const name of ['outer', 'inner']) {
      assert(
        Number.isSafeInteger(identity[name]?.bytes) &&
          identity[name].bytes > 0 &&
          identity[name].bytes <= 2 * 1024 ** 3,
      );
      assert.match(identity[name].sha256, /^[a-f0-9]{64}$/);
    }
    return selected;
  }
  assert.equal(plan.candidateOnly, undefined);
  assert.equal(plan.nativeRouteProtocol, undefined);
  const reuse = plan.baseline.reusableArtifact;
  assert.equal(reuse?.format, 'SoloHostedNormalBaselineReuseV2');
  assert.equal(reuse.sourceRevision, selected.baseline);
  assert.equal(reuse.sourceTree, selected.baselineTree);
  assert.equal(reuse.producer.repository, plan.repository);
  assert.equal(reuse.producer.workflow, '.github/workflows/solo-remote-baseline-temporary.yml');
  assert.equal(reuse.producer.run, reuse.run);
  assert(Number.isSafeInteger(reuse.producer.attempt) && reuse.producer.attempt > 0);
  assert.match(reuse.producer.toolingRevision, /^[a-f0-9]{40}$/);
  assert.match(reuse.producer.toolingTree, /^[a-f0-9]{40}$/);
  assert.equal(reuse.name, `solo-normal-baseline-8b019919-${reuse.run}-${reuse.producer.attempt}`);
  for (const identity of [plan.candidate, reuse]) {
    assert(Number.isSafeInteger(identity.run) && identity.run > 0);
    assert(Number.isSafeInteger(identity.artifact) && identity.artifact > 0);
    assert.match(identity.manifestSHA256, /^[a-f0-9]{64}$/);
    for (const name of ['outer', 'inner']) {
      assert(
        Number.isSafeInteger(identity[name]?.bytes) &&
          identity[name].bytes > 0 &&
          identity[name].bytes <= 2 * 1024 ** 3,
      );
      assert.match(identity[name].sha256, /^[a-f0-9]{64}$/);
    }
  }
  assert(Number.isSafeInteger(reuse.ready?.bytes) && reuse.ready.bytes > 0);
  assert(reuse.ready.bytes <= 2 * MiB);
  assert.match(reuse.ready.sha256, /^[a-f0-9]{64}$/);
  return selected;
}

const journalHelper = 'scripts/solo-qualification-hitch-journal.mjs';
const planHasHitchJournal = (plan) => plan.hitchJournal === 'bounded-v1';
function validateTimingHitchJournalAdmission(plan, selected) {
  if (plan.hitchJournal === undefined) return;
  assert.equal(plan.hitchJournal, 'bounded-v1', 'Unknown timing journal policy');
  assert(selected, 'Journal admission requires an explicitly declared timing source');
  for (const path of [journalHelper, 'scripts/qualify-solo-runtime.mjs']) {
    const refs = plan.frozenTools?.filter((ref) => ref.path === path);
    assert.equal(refs?.length, 1, `Journal requires one frozen ${path}`);
    assert(Number.isSafeInteger(refs[0].bytes) && refs[0].bytes > 0 && refs[0].bytes < MiB);
    assert.match(refs[0].sha256, /^[a-f0-9]{64}$/);
  }
}

// Called only after the observed child has closed. The declaration's sparse
// import closure remains unchanged; runtime input verification freezes the helper.
export async function verifyTimingHitchJournal(plan, raw, output, soloURL) {
  try {
    assert(planHasHitchJournal(plan), 'Journal was not declared');
    const resumeReadiness =
      plan.format === 'SoloHostedReadinessPlanV1' &&
      (['readiness-resume-candidate4bf', 'readiness-resume-candidatec696'].includes(
        plan.sourceCohort,
      ) ||
        ([
          'readiness-geometry-corrected-package',
          'readiness-preparation-row-candidatee1cc',
          'readiness-diagnosed-row-candidate239',
        ].includes(plan.sourceCohort) &&
          ['warm-resume', 'saved-resume'].includes(plan.phase)));
    const savedReadiness = resumeReadiness && plan.phase === 'saved-resume';
    if (plan.format === 'SoloHostedReadinessPlanV1') {
      assert.equal(plan.performanceExclusion, true);
      if (
        [
          'readiness-selected-font-settlement-candidatee1cc',
          'readiness-selected-font-direct-sheet-candidatee1cc',
        ].includes(plan.sourceCohort)
      ) {
        const { selectedFontSettlementSelection } = await import('./solo-remote-readiness.mjs');
        const selected = selectedFontSettlementSelection(plan);
        assert.equal(plan.candidate.revision, selected.source.revision);
        assert.equal(plan.runtimeRevision, selected.source.revision);
        assert.equal(plan.candidate.tree, selected.source.tree);
        assert.deepEqual(plan.fixture, selected.fixture);
        assert.equal(plan.protocol.name, selected.protocol);
        assert.equal(raw.readinessPilot.protocol, selected.protocol);
        assert.equal(plan.protocol.cancelBoundaryObservation, 'post-command-v3');
        assert.equal(raw.readinessPilot.cancelBoundaryObservation, 'post-command-v3');
        assert.equal(raw.readinessPilot.settlementObservation, 'original-demand-v1');
      } else if (plan.sourceCohort === 'readiness-optional-start-audio-candidatee1cc') {
        const { optionalAudioReadinessSelection } = await import('./solo-remote-readiness.mjs');
        const selected = optionalAudioReadinessSelection(plan);
        assert.equal(plan.candidate.revision, selected.source.revision);
        assert.equal(plan.runtimeRevision, selected.source.revision);
        assert.equal(plan.candidate.tree, selected.source.tree);
        assert.deepEqual(plan.fixture, selected.fixture);
        assert.equal(plan.protocol.name, selected.protocol);
        assert.equal(raw.readinessPilot.protocol, selected.protocol);
      } else if (
        [
          'readiness-preparation-row-candidatee1cc',
          'readiness-diagnosed-row-candidate239',
        ].includes(plan.sourceCohort)
      ) {
        const { preparationReadinessSelection } = await import('./solo-remote-readiness.mjs');
        const selected = preparationReadinessSelection(plan);
        assert.equal(plan.candidate.revision, selected.source.revision);
        assert.equal(plan.runtimeRevision, selected.source.revision);
        assert.equal(plan.candidate.tree, selected.source.tree);
        assert.deepEqual(plan.fixture, selected.fixture);
        assert.equal(plan.protocol.name, selected.protocol);
        assert.equal(raw.readinessPilot.protocol, selected.protocol);
        if (selected.requiredStartRetention) {
          assert.equal(plan.protocol.requiredStartRetention, selected.requiredStartRetention);
          assert.equal(raw.readinessPilot.requiredStartRetention, selected.requiredStartRetention);
        }
        if (selected.geometry) {
          assert.equal(plan.protocol.geometryObservation, 'phase-boundary-v1');
          assert.equal(raw.readinessPilot.geometryObservation, 'phase-boundary-v1');
        } else if (selected.cancelBoundary) {
          assert.equal(plan.protocol.cancelBoundaryObservation, 'post-command-v3');
          assert.equal(raw.readinessPilot.cancelBoundaryObservation, 'post-command-v3');
        }
      } else if (plan.sourceCohort === 'readiness-geometry-corrected-package') {
        const { geometryReadinessSelection } = await import('./solo-remote-readiness.mjs');
        const selected = geometryReadinessSelection(plan);
        assert.equal(plan.candidate.revision, selected.source.revision);
        assert.equal(plan.runtimeRevision, selected.source.revision);
        assert.equal(plan.candidate.tree, selected.source.tree);
        assert.deepEqual(plan.fixture, selected.fixture);
        assert.equal(plan.protocol.geometryObservation, 'phase-boundary-v1');
        assert.equal(raw.readinessPilot.geometryObservation, 'phase-boundary-v1');
      } else if (
        ['readiness-selected-font-candidate0feb', 'readiness-public-dpr-candidate0feb'].includes(
          plan.sourceCohort,
        )
      ) {
        assert.equal(plan.candidate.revision, '0febd334619731adc26dfa3df78aab02991563af');
        assert.equal(plan.runtimeRevision, '0febd334619731adc26dfa3df78aab02991563af');
        assert.equal(plan.candidate.tree, '692135315b5a4d0dcb98bc24314c644d37cec1ed');
        const { SELECTED_FONT_JOINED_FIXTURE, COMPACT_READINESS_FIXTURES } = await import(
          './solo-remote-readiness.mjs'
        );
        if (plan.sourceCohort === 'readiness-selected-font-candidate0feb') {
          assert.equal(plan.phase, 'selected-font-cancel');
          assert.deepEqual(plan.fixture, SELECTED_FONT_JOINED_FIXTURE);
        } else {
          assert(['public-dpr-1', 'public-dpr-3'].includes(plan.phase));
          assert.deepEqual(plan.fixture, COMPACT_READINESS_FIXTURES.full);
        }
      } else if (
        [
          'readiness-selected-font-joined-candidatec696',
          'readiness-public-dpr-candidatec696',
        ].includes(plan.sourceCohort)
      ) {
        assert.equal(plan.candidate.revision, 'c696af41857840359ae473558b90682f3d71f2db');
        assert.equal(plan.runtimeRevision, 'c696af41857840359ae473558b90682f3d71f2db');
        assert.equal(plan.candidate.tree, 'b70ce1c4b15023a38628c5e958b166e44898eccf');
        const { SELECTED_FONT_JOINED_FIXTURE, COMPACT_READINESS_FIXTURES } = await import(
          './solo-remote-readiness.mjs'
        );
        if (plan.sourceCohort === 'readiness-selected-font-joined-candidatec696') {
          assert.equal(plan.phase, 'selected-font-cancel');
          assert.deepEqual(plan.fixture, SELECTED_FONT_JOINED_FIXTURE);
        } else {
          assert(['public-dpr-1', 'public-dpr-3'].includes(plan.phase));
          assert.deepEqual(plan.fixture, COMPACT_READINESS_FIXTURES.full);
        }
      } else if (plan.sourceCohort === 'readiness-selected-font-candidatec696') {
        assert.equal(plan.phase, 'selected-font-cancel');
        assert.equal(plan.candidate.revision, 'c696af41857840359ae473558b90682f3d71f2db');
        assert.equal(plan.runtimeRevision, 'c696af41857840359ae473558b90682f3d71f2db');
        assert.equal(plan.candidate.tree, 'b70ce1c4b15023a38628c5e958b166e44898eccf');
        assert.deepEqual(plan.fixture, {
          path: 'docs/performance/fixtures/solo-readiness-font/selected-font-cancel.qualification.fixture',
          bytes: 5738,
          sha256: 'd4c774b80df93896cfd4a1f82d66c16f58a9ed68938ed88229449a2bb001cc67',
        });
      } else if (
        ['readiness-public-effects-candidatec696', 'readiness-resume-candidatec696'].includes(
          plan.sourceCohort,
        )
      ) {
        assert.equal(plan.candidate.revision, 'c696af41857840359ae473558b90682f3d71f2db');
        assert.equal(plan.runtimeRevision, 'c696af41857840359ae473558b90682f3d71f2db');
        assert.equal(plan.candidate.tree, 'b70ce1c4b15023a38628c5e958b166e44898eccf');
        const { COMPACT_READINESS_FIXTURES } = await import('./solo-remote-readiness.mjs');
        if (resumeReadiness) {
          assert.equal(plan.phase, 'saved-resume');
          assert.deepEqual(plan.fixture, COMPACT_READINESS_FIXTURES.saved);
        } else {
          assert(['public-effects-full', 'public-effects-reduced'].includes(plan.phase));
          assert.deepEqual(
            plan.fixture,
            COMPACT_READINESS_FIXTURES[plan.phase.slice('public-effects-'.length)],
          );
        }
      } else if (plan.sourceCohort === 'readiness-public-effects-candidate4bf') {
        assert(['public-effects-full', 'public-effects-reduced'].includes(plan.phase));
        assert.equal(plan.candidate.revision, '4bf5e9b3b7f2f06fbe24f50ff9457efb70a7b1a7');
        assert.equal(plan.runtimeRevision, '4bf5e9b3b7f2f06fbe24f50ff9457efb70a7b1a7');
        assert.equal(plan.candidate.tree, 'e87e64d0e14584c2a569d06bae8e7c602c5ed105');
        const { EFFECTS_READINESS_FIXTURES } = await import('./solo-remote-readiness.mjs');
        assert.deepEqual(
          plan.fixture,
          EFFECTS_READINESS_FIXTURES[plan.phase.slice('public-effects-'.length)],
        );
      } else if (resumeReadiness) {
        assert(['warm-resume', 'saved-resume'].includes(plan.phase));
        assert.equal(plan.candidate.revision, '4bf5e9b3b7f2f06fbe24f50ff9457efb70a7b1a7');
        assert.equal(plan.runtimeRevision, '4bf5e9b3b7f2f06fbe24f50ff9457efb70a7b1a7');
        assert.equal(plan.candidate.tree, 'e87e64d0e14584c2a569d06bae8e7c602c5ed105');
        assert.deepEqual(
          plan.fixture,
          savedReadiness
            ? {
                path: 'docs/performance/fixtures/solo-readiness-resume/saved.qualification.fixture',
                bytes: 4723,
                sha256: 'b739f37f5bd9c341931ed528a955614aaf1ba05075bb1baab1c2a655a5bcd527',
              }
            : {
                path: 'docs/performance/fixtures/solo-readiness-resume/warm.qualification.fixture',
                bytes: 3878,
                sha256: '95f77f635658a53ae5ab89ca9879321a37c22e512c2a0bb751ad5ed194699545',
              },
        );
      } else {
        assert.equal(plan.sourceCohort, 'readiness-candidateab45');
        assert.equal(plan.phase, 'cold-first30');
        assert.equal(plan.candidate.revision, 'ab45bfde5d54d612cbba9b038a46f13d13f417ec');
        assert.equal(plan.candidate.tree, '0d8238992621613883efcf0c73a9f4d88f3fcb10');
        assert.deepEqual(plan.fixture, {
          path: 'docs/performance/fixtures/solo-remote-timing/cold-first30.qualification.fixture',
          bytes: 6387,
          sha256: 'aa3a4c98c6f272ea515d1e8c9e0fb3238d78782065bfb96ae8fe4e304041e2c5',
        });
      }
    } else
      assert(
        finalSustainedPlan(plan) ? selectedSustainedSource(plan) : selectedTimingSource(plan),
        'Journal requires a declared source cohort',
      );
    const { HITCH_LIMITS, decodeHitchJournal } = await import(
      './solo-qualification-hitch-journal.mjs'
    );
    const report = raw?.hitchJournal;
    assert(
      Buffer.byteLength(JSON.stringify(report)) <= HITCH_LIMITS.descriptorBytes,
      'Journal descriptor cap',
    );
    assert.equal(report.format, 'SoloHitchJournalV1');
    assert.equal(report.status, 'complete');
    assert(
      !Object.hasOwn(raw, 'performanceGateStatusBeforeHitchJournal') && !raw.hitchJournalFailure,
      'Complete journal contradicts its retained failure override',
    );
    assert.deepEqual(report.limits, HITCH_LIMITS);
    assert.deepEqual(report.failures, []);
    const firstActive = finalLifecyclePlan(plan) && plan.phase === 'long29';
    assert.equal(
      report.activePlayCoverage,
      firstActive ? 'observed-first-solo-before-reload' : 'observed-final-solo',
    );
    assert.equal(report.activeDocumentPolicy, firstActive ? 'first-before-reload-v1' : undefined);
    const retry = finalLifecyclePlan(plan) && plan.phase === 'retry';
    const anchored = plan.sourceCohort === finalSoakCohort,
      heavy = ['sentry', 'long-rail'].includes(plan.phase),
      warm = plan.phase === 'warm-first30';
    assert.equal(
      report.preparationPolicy,
      anchored
        ? 'first-return-anchored-v1'
        : retry
          ? 'first-return-retry-anchored-v1'
          : heavy
            ? 'timing-heavy-v1'
            : null,
    );
    const url = new URL(soloURL);
    const specs =
      heavy || anchored || retry
        ? [
            {
              role: 'preparation',
              path: new URL('playground/', url).pathname,
              action: 'initial',
              boundary: 'before-follow-4',
            },
            {
              role: 'solo',
              path: url.pathname,
              action: 'follow-4',
              boundary: 'final-existing-public-boundary',
            },
          ]
        : warm || firstActive || savedReadiness
          ? [
              {
                role: 'solo',
                path: url.pathname,
                action: 'initial',
                boundary: savedReadiness
                  ? 'before-reload-7'
                  : firstActive
                    ? 'before-reload-8'
                    : 'before-reload-1',
              },
              {
                role: 'solo',
                path: url.pathname,
                action: savedReadiness ? 'reload-7' : firstActive ? 'reload-8' : 'reload-1',
                boundary: 'final-existing-public-boundary',
              },
            ]
          : [
              {
                role: 'solo',
                path: url.pathname,
                action: 'initial',
                boundary: 'final-existing-public-boundary',
              },
            ];
    assert.equal(report.documents?.length, specs.length, 'Exact declared document count');
    let totalBytes = 0,
      totalRecords = 0;
    const summaries = [];
    for (const [index, spec] of specs.entries()) {
      const doc = report.documents[index],
        header = doc.header;
      const identity = {
        role: spec.role,
        origin: url.origin,
        path: spec.path,
        action: spec.action,
      };
      const final = savedReadiness || (firstActive ? index === 0 : index === specs.length - 1),
        preparation = spec.role === 'preparation';
      assert.equal(doc.id, index + 1);
      assert.equal(doc.status, 'complete');
      assert.equal(doc.boundary, spec.boundary);
      assert.equal(doc.readbackVerified, true);
      assert.deepEqual(doc.identity, identity);
      assert.equal(header.format, 'SoloHitchJournalDocumentV1');
      assert.equal(header.documentId, doc.id);
      assert.deepEqual(header.identity, identity);
      assert.deepEqual(header.location, { origin: url.origin, path: spec.path });
      for (const key of ['complete', 'configured', 'sealed']) assert.equal(header[key], true);
      for (const key of ['clockInvalid', 'durationExceeded', 'postSealActive'])
        assert.equal(header[key], false);
      for (const key of ['firstOverflowAt', 'unmatchedWorkStart']) assert.equal(header[key], null);
      assert.equal(header.workScope, preparation ? 'unobserved-preparation' : 'subscribed-solo');
      for (const key of ['timeOrigin', 'startedAt', 'endedAt', 'deadline', 'activeElapsedMs'])
        assert(Number.isFinite(header[key]), key);
      assert(header.startedAt >= 0 && header.endedAt >= header.startedAt);
      assert(
        header.endedAt <= header.deadline &&
          header.deadline <= header.startedAt + HITCH_LIMITS.durationMs,
      );
      for (const key of ['activeFrames', 'activeWorkWindows'])
        assert(Number.isSafeInteger(header[key]) && header[key] >= 0);
      assert(
        header.firstCallback &&
          ['timestampMs', 'callbackAtMs', 'registeredAtMs'].every((key) =>
            Number.isFinite(header.firstCallback[key]),
          ),
      );
      if (preparation) {
        assert.equal(header.phase, 6);
        assert.equal(header.publicPhase, 'declared-preparation');
        assert.equal(header.workSubscribedAt, null);
        assert.equal(header.workCallsSeen, false);
      } else {
        assert(
          Number.isFinite(header.workSubscribedAt) &&
            header.workSubscribedAt >= 0 &&
            header.workSubscribedAt <= header.endedAt,
        );
        assert.equal(typeof header.workCallsSeen, 'boolean');
        assert(
          (final
            ? ['paused', 'result', 'picture']
            : ['boot', 'briefing', 'paused', 'picture']
          ).includes(header.publicPhase),
        );
      }
      if (firstActive || resumeReadiness) assert.equal(header.publicPhase, 'paused');
      if (final) {
        assert.equal(header.runningSeen, true);
        assert.equal(header.workCallsSeen, true);
        assert(header.activeFrames > 0 && header.activeWorkWindows > 0);
        assert(Number.isFinite(header.firstActiveAt) && Number.isFinite(header.lastActiveAt));
        assert(
          header.firstActiveAt >= 0 &&
            header.lastActiveAt > header.firstActiveAt &&
            header.lastActiveAt <= header.endedAt,
        );
        assert(header.activeElapsedMs > 0 && header.activeElapsedMs <= HITCH_LIMITS.durationMs);
      } else {
        assert.equal(header.runningSeen, false);
        assert.equal(header.firstActiveAt, null);
        assert.equal(header.lastActiveAt, null);
        assert.equal(header.activeFrames, 0);
        assert.equal(header.activeWorkWindows, 0);
        assert.equal(header.activeElapsedMs, 0);
      }
      assert(['observed', 'unobserved'].includes(header.nativeTasks));
      assert(
        header.nativeDropped === null || header.nativeDropped === 0,
        'Known native drops invalidate coverage',
      );
      if (header.nativeTasks === 'unobserved') assert.equal(header.nativeDropped, null);
      assert(
        Number.isSafeInteger(header.records) &&
          header.records >= 0 &&
          header.records <= HITCH_LIMITS.records,
      );
      assert(
        Number.isSafeInteger(header.capacity) &&
          header.capacity >= header.records &&
          header.capacity <= HITCH_LIMITS.records - totalRecords,
      );
      assert.equal(doc.bytes, header.records * HITCH_LIMITS.recordBytes);
      assert.match(doc.sha256, /^[a-f0-9]{64}$/);
      const path = `${resolve(output)}.hitches.d${String(doc.id).padStart(2, '0')}.bin`;
      assert.equal(doc.path, path, 'Journal path must be the owned row sidecar');
      assert.equal(await realpath(path), path, 'Journal sidecar alias');
      const before = await lstat(path);
      assert(
        before.isFile() && !before.isSymbolicLink() && before.size === doc.bytes,
        'Journal sidecar size/type',
      );
      const file = await open(path, 'r');
      const bytes = Buffer.alloc(doc.bytes);
      try {
        const opened = await file.stat();
        assert(
          opened.dev === before.dev && opened.ino === before.ino && opened.size === before.size,
          'Journal sidecar replaced before readback',
        );
        let offset = 0;
        while (offset < bytes.length) {
          const read = await file.read(bytes, offset, bytes.length - offset, offset);
          assert(read.bytesRead > 0, 'Truncated journal sidecar');
          offset += read.bytesRead;
        }
        const after = await file.stat();
        assert(
          after.size === before.size && after.mtimeMs === before.mtimeMs,
          'Journal sidecar changed during readback',
        );
      } finally {
        await file.close();
      }
      assert.equal(sha(bytes), doc.sha256, 'Journal sidecar digest');
      const linked = await lstat(path);
      assert(
        linked.isFile() &&
          !linked.isSymbolicLink() &&
          linked.dev === before.dev &&
          linked.ino === before.ino &&
          linked.size === before.size &&
          linked.mtimeMs === before.mtimeMs,
        'Journal sidecar link changed during readback',
      );
      const retained = Array(7).fill(0);
      for (const entry of decodeHitchJournal(bytes)) {
        assert(
          entry.startMs >= 0 && entry.endMs <= header.endedAt,
          'Hitch outside document observation',
        );
        retained[entry.kind]++;
      }
      assert.deepEqual(header.retained, retained);
      assert.deepEqual(header.observed, retained, 'Missing individual hitch records');
      totalBytes += bytes.length;
      totalRecords += header.records;
      summaries.push({
        id: doc.id,
        role: spec.role,
        records: header.records,
        bytes: bytes.length,
        activeFrames: header.activeFrames,
        activeWorkWindows: header.activeWorkWindows,
        activeElapsedMs: header.activeElapsedMs,
        nativeTasks: header.nativeTasks,
        nativeDropped: header.nativeDropped,
      });
    }
    assert(totalRecords <= HITCH_LIMITS.records, 'Row journal record budget');
    assert.equal(report.records, totalRecords);
    assert.equal(report.bytes, totalBytes);
    const final = firstActive ? summaries[0] : summaries.at(-1);
    return {
      status: 'complete',
      documents: specs.length,
      bytes: totalBytes,
      records: totalRecords,
      activePlayCoverage: report.activePlayCoverage,
      activeFrames: final.activeFrames,
      activeWorkWindows: final.activeWorkWindows,
      activeElapsedMs: final.activeElapsedMs,
      nativeTasks: final.nativeTasks,
      nativeDropped: final.nativeDropped,
      readbackVerified: true,
      ...(firstActive ? { activeDocument: 1 } : {}),
      ...(specs.length > 1 ? { documentCoverage: summaries } : {}),
    };
  } catch (error) {
    return { status: 'invalid-evidence', failure: String(error.message ?? error).slice(0, 2048) };
  }
}

export function validateTimingPlan(plan) {
  assert.equal(plan.format, 'SoloHostedTimingPlanV1');
  const spec = TIMING_PHASES[plan.phase];
  assert(spec, 'Unknown timing phase');
  assert.equal(plan.repository, 'mekhovov/revealline');
  assert.equal(plan.node, '22.13.1');
  assert.equal(plan.playwright, '1.62.1');
  const selected = validateSourceCohort(plan, selectedTimingSource(plan));
  validateSetupSuccessor(plan, selected);
  const expectedSource = selected ?? source;
  validateTimingHitchJournalAdmission(plan, selected);
  assert.equal(plan.baseline.revision, expectedSource.baseline);
  assert.match(plan.candidate.revision, /^[a-f0-9]{40}$/);
  assert.notEqual(plan.candidate.revision, expectedSource.baseline);
  assert.equal(plan.candidate.revision, plan.latestSourceRevision);
  assert.match(plan.latestRuntimeRevision, /^[a-f0-9]{40}$/);
  assert(['chromium', 'webkit'].includes(plan.engine));
  assert([1, 2, 3].includes(plan.repetition));
  const release = plan.release;
  assert.equal(release.format, 'SoloHostedTimingReleaseV1');
  const diagnostic = diagnosticComparison(plan);
  assert(
    diagnostic || release.status === 'reviewed-and-released',
    'Explicit latest-source timing release required',
  );
  if (diagnostic) {
    validateDiagnosticComparison(release, expectedSource.candidate);
    assert.equal(plan.candidate.revision, expectedSource.candidate);
    assert.equal(
      plan.latestRuntimeRevision,
      selected ? selected.runtime : '0d9fef1120face4c0f9998ebd24a94e6df0d85c0',
    );
  }
  assert.equal(release.phase, plan.phase);
  assert.equal(release.previousPhase, spec.previous);
  assert.equal(release.candidateRevision, plan.candidate.revision);
  assert.equal(release.baselineRevision, expectedSource.baseline);
  assert.equal(release.latestRuntimeRevision, plan.latestRuntimeRevision);
  for (const field of [
    'noUnclosedOwners',
    'allPriorPlannedJobsClosed',
    'priorProofInspected',
    'latestProductionPackageVerified',
  ])
    assert.equal(release[field], true);
  assert.equal(release.firstEightAllCorrectnessPassed, !diagnostic);
  assert(
    Array.isArray(release.evidence) && release.evidence.length > 0 && release.evidence.length <= 32,
  );
  for (const ref of release.evidence) {
    assert(Number.isSafeInteger(ref.runId) && ref.runId > 0);
    assert(Number.isSafeInteger(ref.artifactId) && ref.artifactId > 0);
    assert.match(ref.artifactSHA256, /^[a-f0-9]{64}$/);
    assert.match(ref.summarySHA256, /^[a-f0-9]{64}$/);
    assert(['passed', 'failed-reviewed'].includes(ref.disposition));
  }
  assert.equal(plan.helperTimeoutMs, 75 * 60000);
  assert.equal(plan.setupTimeoutMs, 40 * 60000);
  assert.equal(plan.calibrationTimeoutMs, 5 * 60000);
  assert.equal(plan.calibrationPreset, 'mid');
  assert.equal(plan.evidenceBytes, 512 * MiB);
  assert.equal(plan.rowEvidenceBytes, 128 * MiB);
  assert.equal(plan.performanceExclusion, diagnostic);
  assert.deepEqual(
    plan.adapterInputs.map((ref) => ref.path),
    ['scripts/solo-remote-sustained.mjs', 'scripts/solo-remote-baseline.mjs'],
  );
  assert(plan.baseline.reusableArtifact, 'The existing pinned normal baseline must be reused');
  for (const ref of plan.adapterInputs) {
    assert(Number.isSafeInteger(ref.bytes) && ref.bytes > 0 && ref.bytes < MiB);
    assert.match(ref.sha256, /^[a-f0-9]{64}$/);
  }
  const roles = roleOrder(plan.repetition, plan.phase);
  assert.deepEqual(
    plan.rows.map((row) => row.source),
    roles,
  );
  assert.equal(new Set(plan.rows.map((row) => row.id)).size, 2);
  for (const row of plan.rows) {
    assert.equal(row.id, `timing-${plan.phase}-${plan.engine}-r${plan.repetition}-${row.source}`);
    assert.equal(row.kind, 'timing');
    assert.equal(row.engine, plan.engine);
    assert.equal(row.timeoutMs, 480000);
    assert.equal(row.performanceExclusion, diagnostic);
  }
  assert.deepEqual(
    Object.keys(plan.recipes).sort(),
    [
      'cold-first30',
      'warm-first30',
      'sentry',
      'long-rail',
      'sentry-level',
      'long-rail-level',
    ].sort(),
  );
  for (const [phase, value] of Object.entries(TIMING_PHASES))
    assert.equal(plan.recipes[phase].sha256, value.hash);
  assert.equal(
    plan.recipes['sentry-level'].sha256,
    'caad15d6f4770bc5e48935db1655e2892cfb5bd9093a72d0d7795125e8d2d3fa',
  );
  assert.equal(
    plan.recipes['long-rail-level'].sha256,
    '821897e571449bb5ec27678eef09c5955d9e9be873aaaf76736ff1aadbd0d84c',
  );
  for (const ref of Object.values(plan.recipes)) {
    assert.match(ref.path, /^docs\/performance\/fixtures\/solo-remote-timing\/[a-z0-9.-]+$/);
    assert(Number.isSafeInteger(ref.bytes) && ref.bytes > 0 && ref.bytes <= 16384);
    assert.match(ref.sha256, /^[a-f0-9]{64}$/);
  }
  assert(
    Array.isArray(plan.frozenTools) && plan.frozenTools.length > 0 && plan.frozenTools.length <= 64,
  );
  assert.equal(new Set(plan.frozenTools.map((ref) => ref.path)).size, plan.frozenTools.length);
  for (const ref of plan.frozenTools) {
    assert.match(ref.path, /^scripts\/[a-zA-Z0-9/_.-]+$/);
    assert(!ref.path.split('/').includes('..'));
    assert.match(ref.sha256, /^[a-f0-9]{64}$/);
  }
  return plan;
}

export function bindTimingJob(manifest, engine, repetition) {
  assert.equal(manifest.format, 'SoloHostedTimingManifestV1');
  const plan = structuredClone(manifest);
  delete plan.jobs;
  plan.format = 'SoloHostedTimingPlanV1';
  plan.engine = engine;
  plan.repetition = repetition;
  plan.helperTimeoutMs = 75 * 60000;
  plan.performanceExclusion = diagnosticComparison(plan);
  plan.rows = roleOrder(repetition, plan.phase).map((role) => ({
    id: `timing-${plan.phase}-${engine}-r${repetition}-${role}`,
    kind: 'timing',
    engine,
    source: role,
    timeoutMs: 480000,
    performanceExclusion: plan.performanceExclusion,
  }));
  return validateTimingPlan(plan);
}

export function timingMatrix(manifest) {
  const expected = ['chromium', 'webkit'].flatMap((engine) =>
    [1, 2, 3].map((repetition) => ({ engine, repetition })),
  );
  assert.deepEqual(manifest.jobs, expected, 'Exactly six declared timing jobs');
  return {
    include: expected.map(({ engine, repetition }) => {
      const plan = bindTimingJob(manifest, engine, repetition);
      return {
        phase: plan.phase,
        engine,
        repetition,
        jobMinutes: selectedTimingSource(plan) === finalTimingSource ? 122 : 120,
        stepMinutes: 78,
        outerSeconds: 77 * 60,
      };
    }),
  };
}

function roleOrder(repetition, phase) {
  return phase === 'diagnostics'
    ? ['candidate']
    : repetition === 2
      ? ['candidate', 'baseline']
      : ['baseline', 'candidate'];
}
export function validateRelease(release, phase, selected = null) {
  assert(SUSTAINED_PHASES[phase], 'Unknown phase');
  assert.equal(release.format, 'SoloHostedPhaseReleaseV1');
  const diagnostic = release.status === 'reviewed-diagnostic-only';
  assert(
    diagnostic || release.status === 'reviewed-and-released',
    'An explicit reviewed phase release is required',
  );
  if (diagnostic) validateDiagnosticComparison(release, selected?.candidate);
  assert.equal(release.phase, phase);
  assert.equal(release.previousPhase, SUSTAINED_PHASES[phase].previous);
  assert.equal(release.candidateRevision, selected?.candidate ?? source.candidate);
  assert.equal(release.baselineRevision, selected?.baseline ?? source.baseline);
  assert.equal(release.noUnclosedOwners, true);
  assert.equal(release.allPriorPlannedJobsClosed, true);
  assert.equal(release.priorProofInspected, true);
  assert(
    Array.isArray(release.evidence) && release.evidence.length > 0 && release.evidence.length <= 32,
  );
  for (const ref of release.evidence) {
    assert(Number.isSafeInteger(ref.runId) && ref.runId > 0);
    assert(Number.isSafeInteger(ref.artifactId) && ref.artifactId > 0);
    assert.match(ref.artifactSHA256, /^[a-f0-9]{64}$/);
    assert.match(ref.summarySHA256, /^[a-f0-9]{64}$/);
    assert(['passed', 'failed-reviewed'].includes(ref.disposition));
  }
  if (
    (diagnostic || ['soak', 'long29'].includes(phase)) &&
    selected !== GEOMETRIC_NEXT_DE332_SOURCE
  )
    assert.equal(release.firstEightAllCorrectnessPassed, !diagnostic);
  return release;
}

export function validateSustainedPlan(plan) {
  if (timingPlan(plan)) return validateTimingPlan(plan);
  assert.equal(plan.format, 'SoloHostedSustainedPlanV1');
  const selected = validateSourceCohort(plan, selectedSustainedSource(plan));
  validateSetupSuccessor(plan, selected);
  if (selected) {
    assert.equal(plan.latestSourceRevision, selected.candidate);
    assert.equal(plan.hitchJournal, 'bounded-v1');
    assert.equal(plan.ownedResources, plan.phase === 'soak' ? 'source-bounds-v1' : undefined);
    validateTimingHitchJournalAdmission(plan, selected);
    for (const path of plan.phase === 'soak'
      ? [
          'scripts/solo-qualification-snapshot-store.mjs',
          'scripts/solo-owned-resource-assessment.mjs',
        ]
      : []) {
      const refs = plan.frozenTools?.filter((ref) => ref.path === path);
      assert.equal(refs?.length, 1, `Anchored soak requires one frozen ${path}`);
      assert(Number.isSafeInteger(refs[0].bytes) && refs[0].bytes > 0 && refs[0].bytes < MiB);
      assert.match(refs[0].sha256, /^[a-f0-9]{64}$/);
    }
  } else {
    assert.equal(
      plan.hitchJournal,
      undefined,
      'Lifecycle journal requires a separate reviewed admission',
    );
    assert.equal(
      plan.ownedResources,
      undefined,
      'Owner analysis requires a separate reviewed admission',
    );
  }
  const spec = SUSTAINED_PHASES[plan.phase];
  assert(spec);
  assert.equal(plan.node, '22.13.1');
  assert.equal(plan.playwright, '1.62.1');
  assert.equal(plan.repository, 'mekhovov/revealline');
  assert.equal(plan.baseline.revision, selected?.baseline ?? source.baseline);
  assert.equal(plan.candidate.revision, selected?.candidate ?? source.candidate);
  assert(['chromium', 'webkit'].includes(plan.engine));
  assert([1, 2, 3].includes(plan.repetition));
  validateRelease(plan.release, plan.phase, selected);
  assert.equal(plan.helperTimeoutMs, spec.helperMinutes * 60000);
  assert.equal(plan.evidenceBytes, 512 * MiB);
  assert.equal(plan.rowEvidenceBytes, 128 * MiB);
  assert.equal(plan.setupTimeoutMs, 40 * 60000); // After the separately bounded 20-minute dependency setup.
  assert.equal(plan.calibrationTimeoutMs, 5 * 60000);
  assert.equal(plan.calibrationPreset, 'mid');
  assert.deepEqual(
    plan.adapterInputs.map((ref) => ref.path),
    [
      'scripts/solo-remote-sustained.mjs',
      ...(plan.baseline.reusableArtifact ? ['scripts/solo-remote-baseline.mjs'] : []),
    ],
  );
  for (const ref of plan.adapterInputs) {
    assert(Number.isSafeInteger(ref.bytes) && ref.bytes > 0 && ref.bytes < MiB);
    assert.match(ref.sha256, /^[a-f0-9]{64}$/);
  }
  assert.equal(plan.performanceExclusion, diagnosticComparison(plan) || plan.phase === 'retry');
  const roles = geometricNextPlan(plan) ? ['candidate'] : roleOrder(plan.repetition, plan.phase);
  assert.deepEqual(
    plan.rows.map((row) => row.source),
    roles,
  );
  assert.equal(new Set(plan.rows.map((row) => row.id)).size, roles.length);
  for (const row of plan.rows) {
    assert.equal(row.id, `${plan.phase}-${plan.engine}-r${plan.repetition}-${row.source}`);
    assert.equal(row.kind, plan.phase === 'diagnostics' ? 'diagnostics' : 'lifecycle');
    assert.equal(row.engine, plan.engine);
    assert.equal(row.timeoutMs, spec.timeoutMs);
    assert.equal(row.performanceExclusion, plan.performanceExclusion);
  }
  if (geometricNextPlan(plan)) {
    assert.equal(
      plan.recipes.next.path,
      'docs/performance/fixtures/solo-remote-sustained/next-geometric.qualification.fixture',
    );
    assert.equal(plan.recipes.next.bytes, 9086);
    for (const path of [
      'scripts/solo-qualification-next-route.mjs',
      ...COMPARISON_SETUP_DYNAMIC_ROOTS,
    ]) {
      const refs = plan.frozenTools.filter((ref) => ref.path === path);
      assert.equal(refs.length, 1, `Missing exact native route dependency ${path}`);
      assert(Number.isSafeInteger(refs[0].bytes) && refs[0].bytes > 0 && refs[0].bytes < MiB);
    }
  }
  if (spec.recipe)
    assert.equal(
      plan.recipes[spec.recipe].sha256,
      selected
        ? plan.phase === 'soak'
          ? anchoredSoakHash
          : geometricNextPlan(plan)
            ? GEOMETRIC_NEXT_SOURCE.recipeHash
            : finalLifecycle[plan.phase].hash
        : spec.hash,
    );
  for (const ref of Object.values(plan.recipes)) {
    assert.match(ref.path, /^docs\/performance\/fixtures\/solo-remote-sustained\/[a-z0-9.-]+$/);
    assert(Number.isSafeInteger(ref.bytes) && ref.bytes > 0 && ref.bytes <= 16384);
    assert.match(ref.sha256, /^[a-f0-9]{64}$/);
  }
  assert.equal(
    plan.recipes.opening.sha256,
    'd36ab449fe115f49b3caf9f29e7f6558d155e6a83ef973748fab08784b8fda3e',
  );
  assert(
    Array.isArray(plan.frozenTools) && plan.frozenTools.length > 0 && plan.frozenTools.length <= 64,
  );
  assert.equal(new Set(plan.frozenTools.map((ref) => ref.path)).size, plan.frozenTools.length);
  for (const ref of plan.frozenTools) {
    assert.match(ref.path, /^scripts\/[a-zA-Z0-9/_.-]+$/);
    assert(!ref.path.split('/').includes('..'));
    assert.match(ref.sha256, /^[a-f0-9]{64}$/);
  }
  return plan;
}

export function bindSustainedJob(manifest, engine, repetition) {
  assert.equal(manifest.format, 'SoloHostedSustainedManifestV1');
  const plan = structuredClone(manifest);
  delete plan.jobs;
  plan.format = 'SoloHostedSustainedPlanV1';
  plan.engine = engine;
  plan.repetition = repetition;
  const spec = SUSTAINED_PHASES[plan.phase];
  assert(spec);
  plan.helperTimeoutMs = spec.helperMinutes * 60000;
  plan.performanceExclusion = diagnosticComparison(plan) || plan.phase === 'retry';
  plan.rows = (geometricNextPlan(plan) ? ['candidate'] : roleOrder(repetition, plan.phase)).map(
    (role) => ({
      id: `${plan.phase}-${engine}-r${repetition}-${role}`,
      kind: plan.phase === 'diagnostics' ? 'diagnostics' : 'lifecycle',
      engine,
      source: role,
      timeoutMs: spec.timeoutMs,
      performanceExclusion: plan.performanceExclusion,
    }),
  );
  return validateSustainedPlan(plan);
}

export function sustainedMatrix(manifest) {
  const expected = ['chromium', 'webkit'].flatMap((engine) =>
    [1, 2, 3].map((repetition) => ({ engine, repetition })),
  );
  assert.deepEqual(manifest.jobs, expected, 'Exactly six declared jobs in one released phase');
  return {
    include: expected.map(({ engine, repetition }) => {
      const plan = bindSustainedJob(manifest, engine, repetition),
        spec = SUSTAINED_PHASES[plan.phase];
      return {
        phase: plan.phase,
        engine,
        repetition,
        jobMinutes: spec.jobMinutes + (finalSustainedPlan(plan) ? 2 : 0),
        stepMinutes: spec.helperMinutes + 3,
        outerSeconds: (spec.helperMinutes + 2) * 60,
      };
    }),
  };
}

async function checkedJSON(path, maximumBytes = 16 * MiB) {
  const info = await lstat(path);
  assert(
    info.isFile() && !info.isSymbolicLink() && info.size <= maximumBytes,
    'Bounded regular report required',
  );
  return JSON.parse(await readFile(path, 'utf8'));
}
async function verifyInputs(ctx) {
  for (const ref of [
    ...Object.values(ctx.plan.recipes),
    ...ctx.plan.frozenTools,
    ...ctx.plan.adapterInputs,
  ]) {
    const path = resolve(ctx.repository, ref.path);
    assert(path.startsWith(ctx.repository + '/'));
    const info = await lstat(path);
    assert(info.isFile() && !info.isSymbolicLink());
    const actual = await ctx.digest(path);
    assert.equal(actual.sha256, ref.sha256, `Changed input: ${ref.path}`);
    if (ref.bytes !== undefined) assert.equal(actual.bytes, ref.bytes);
  }
}
export function verifiedMidCalibration(raw) {
  assert.equal(raw.failure, null);
  assert.equal(typeof raw.browser, 'string');
  assert(raw.browser.length > 0 && raw.finishedAt);
  const mid = raw.result?.presets?.mid;
  assert.equal(mid?.status, 'verified');
  assert.equal(mid.target, 1000);
  assert(Number.isFinite(mid.rate) && mid.rate >= 1 && mid.rate <= 20);
  assert(Array.isArray(mid.verification) && mid.verification.length === 3);
  assert(mid.verification.every((x) => Number.isFinite(x) && x > 0));
  const sorted = [...mid.verification].sort((a, b) => a - b);
  const median = sorted[1],
    spread = (sorted[2] - sorted[0]) / median;
  assert.equal(mid.median, median);
  assert.equal(mid.spread, spread);
  assert(Math.abs(median - 1000) / 1000 <= 0.1 && spread <= 0.2);
  return { cpu: mid.rate, browserVersion: raw.browser };
}

export async function prepareCalibrationScratch(report) {
  const owner = report.scratchOwner;
  assert(owner && resolve(owner.path) === owner.path);
  assert.equal(await realpath(owner.path), owner.path, 'Calibration scratch owner alias');
  const root = await lstat(owner.path);
  assert(root.isDirectory() && !root.isSymbolicLink());
  assert.equal(root.dev, owner.device);
  assert.equal(root.ino, owner.inode);
  const path = join(owner.path, 'c00');
  assert(Buffer.byteLength(path) <= 52, 'Calibration scratch exceeds socket budget');
  await mkdir(path);
  const info = await lstat(path);
  assert(info.isDirectory() && !info.isSymbolicLink());
  const record = { path, device: info.dev, inode: info.ino, owner };
  report.calibrationScratch = record;
  return record;
}

export function sustainedSnapshotStorage(plan, recipe) {
  const options = qualificationSnapshotStorage(
    recipe.evidenceStorage === undefined ? [] : ['--snapshot-chunks'],
    recipe,
  );
  if (options)
    assert(
      [...plan.frozenTools, ...plan.adapterInputs].some(
        (ref) => ref.path === 'scripts/solo-qualification-snapshot-store.mjs',
      ),
      'Chunked lifecycle evidence requires a frozen snapshot-store helper',
    );
  return options;
}

export async function prepareSustainedMode(ctx) {
  validateSustainedPlan(ctx.plan);
  await verifyInputs(ctx);
  if (ctx.plan.phase !== 'diagnostics' && !geometricNextPlan(ctx.plan)) await ctx.ensureBaseline();
  assert(ctx.admitted.artifacts.candidate);
  const mode = { cpu: 1, browserVersion: null, calibration: null, recipePath: null };
  if (ctx.plan.phase !== 'diagnostics') {
    const inputs = join(ctx.work, 'sustained-inputs');
    await mkdir(inputs);
    for (const [key, name] of timingPlan(ctx.plan)
      ? [
          [ctx.plan.phase, 'scenario.qualification.json'],
          ...(ctx.plan.phase === 'sentry' ? [['sentry-level', 'sentry-detour.xonix.json']] : []),
          ...(ctx.plan.phase === 'long-rail' ? [['long-rail-level', 'long-rail.xonix.json']] : []),
        ]
      : [
          [ctx.plan.phase, 'scenario.qualification.json'],
          ['opening', 'first-return.xonix.json'],
        ]) {
      const ref = ctx.plan.recipes[key],
        target = join(inputs, name);
      await writeFile(target, await readFile(resolve(ctx.repository, ref.path)), { flag: 'wx' });
      assert.deepEqual(await ctx.digest(target), { bytes: ref.bytes, sha256: ref.sha256 });
    }
    mode.recipePath = join(inputs, 'scenario.qualification.json');
    const recipe = await checkedJSON(mode.recipePath, MiB);
    mode.snapshotStorage = sustainedSnapshotStorage(ctx.plan, recipe);
    if (ctx.plan.sourceCohort === finalSoakCohort)
      assert(mode.snapshotStorage, 'Anchored soak requires chunked evidence');
  }
  if (ctx.plan.engine === 'chromium') {
    const path = join(ctx.evidence, 'fresh-mid-calibration.json');
    const scratch = await prepareCalibrationScratch(ctx.report);
    await ctx.required(
      'fresh-mid-calibration',
      [process.execPath, join(ctx.here, 'calibrate-solo-performance.mjs'), path],
      ctx.plan.calibrationTimeoutMs,
      { env: { ...ctx.cleanEnv, TMPDIR: scratch.path } },
    );
    Object.assign(mode, verifiedMidCalibration(await checkedJSON(path, MiB)));
    mode.calibration = { path, ...(await ctx.digest(path)) };
  }
  Object.assign(ctx.report, {
    performanceExclusion: ctx.plan.performanceExclusion,
    timingQualification: diagnosticComparison(ctx.plan)
      ? 'not-qualified-diagnostic-only'
      : ctx.plan.phase === 'retry'
        ? 'excluded-retention-profiling'
        : 'new-linux-stratum-only',
    ...comparisonLabels(ctx.plan),
    phaseRelease: ctx.plan.release,
    sustainedStratum: {
      engine: ctx.plan.engine,
      repetition: ctx.plan.repetition,
      cpu: mode.cpu,
      calibration: mode.calibration,
      scope: geometricNextPlan(ctx.plan)
        ? 'Candidate-only authored transition/resource diagnostic. No baseline observation, timing comparison, later-layout qualification or physical-device inference.'
        : 'Paired within this hosted runner only. No historical macOS, physical device, GPU, memory-bandwidth or thermal inference.',
    },
  });
  return mode;
}

export function sustainedArguments(ctx, row, url, dir) {
  const base = [
    `--source-revision=${ctx.plan[row.source].revision}`,
    '--server-fixture-access',
    `--browser=${row.engine}`,
    `--cpu=${ctx.modeState.cpu}`,
  ];
  if (ctx.plan.phase === 'diagnostics') {
    const artifact = ctx.admitted.artifacts.candidate;
    return [
      join(ctx.here, 'qualify-solo-diagnostics.mjs'),
      'run',
      url,
      join(dir, 'diagnostics'),
      ...base,
      '--pairs=10',
      '--seed=1544',
      '--duration=30000',
      `--artifact-manifest=${join(ctx.payloads.candidate, 'manifest.json')}`,
      `--artifact-sha256=${artifact.archiveIdentity.sha256}`,
      ...(ctx.modeState.calibration ? [`--calibration=${ctx.modeState.calibration.path}`] : []),
      '--note=Fixed Linux paired diagnostics cohort; no concurrent job-local build, download, test, profiler or archive. Independent host and browser stratum.',
    ];
  }
  return [
    join(ctx.here, 'qualify-solo-runtime.mjs'),
    url,
    ctx.modeState.recipePath,
    join(dir, 'report.json'),
    ...base,
    '--work-probe',
    ...(geometricNextPlan(ctx.plan) ? ['--authored-next-route=authored-next-geometric-v1'] : []),
    ...(planHasHitchJournal(ctx.plan) ? ['--hitch-journal'] : []),
    ...(planHasHitchJournal(ctx.plan) && ['sentry', 'long-rail'].includes(ctx.plan.phase)
      ? ['--hitch-journal-preparation=timing-heavy-v1']
      : []),
    ...(ctx.plan.sourceCohort === finalSoakCohort
      ? ['--hitch-journal-preparation=first-return-anchored-v1']
      : []),
    ...(finalLifecyclePlan(ctx.plan) && ctx.plan.phase === 'retry'
      ? ['--hitch-journal-preparation=first-return-retry-anchored-v1']
      : []),
    ...(finalLifecyclePlan(ctx.plan) && ctx.plan.phase === 'long29'
      ? ['--hitch-journal-active-document=first-before-reload-v1']
      : []),
    '--cadence=settled120',
    ...(ctx.modeState.snapshotStorage ? ['--snapshot-chunks'] : []),
    ...(row.source === 'baseline' ? ['--baseline-runtime'] : []),
    ...(row.engine === 'webkit' ? ['--context=persistent'] : []),
    ...(timingPlan(ctx.plan) && row.engine === 'webkit'
      ? ['--viewport=400x850', '--dpr=3', '--mobile-context']
      : []),
    ...(ctx.plan.phase === 'retry' && row.engine === 'chromium' ? ['--memory-profile'] : []),
  ];
}

export function lifecycleAssessment(plan, row, raw, command, browserVersion) {
  const replay = raw?.replay?.nativeVerification;
  const correct =
    command.status === 'closed' &&
    [0, 2].includes(command.exitCode) &&
    raw?.scenarioStatus === 'pass' &&
    raw.scenarioSHA256 === plan.recipes[plan.phase].sha256 &&
    raw.sourceRevision === roleRevision(plan, row.source) &&
    raw.buildIdentity?.sourceRevision === roleRevision(plan, row.source) &&
    raw.environment?.engine === row.engine &&
    raw.environment?.contextMode === (row.engine === 'webkit' ? 'persistent' : 'ephemeral') &&
    (!browserVersion || raw.environment.browserVersion === browserVersion) &&
    replay?.status === 'pass' &&
    replay.engine === row.engine &&
    replay.browserVersion === raw.environment.browserVersion &&
    Array.isArray(raw.pageErrors) &&
    raw.pageErrors.length === 0 &&
    !raw.contextCleanupFailure &&
    !raw.replayFailure &&
    !raw.failure;
  const rules = raw?.resources;
  const expectedRules = timingPlan(plan) || ['next', 'long29'].includes(plan.phase) ? 0 : 3;
  const resources =
    expectedRules === 0 && Array.isArray(rules) && rules.length === 0
      ? 'not-requested-by-frozen-recipe'
      : Array.isArray(rules) &&
          rules.length === expectedRules &&
          rules.every((rule) => rule.status === 'pass')
        ? 'pass'
        : Array.isArray(rules) && rules.some((rule) => rule.status === 'fail')
          ? 'fail'
          : 'unobserved';
  const repeat = raw?.actions?.find((action) => action.type === 'repeat');
  const elapsed = plan.phase !== 'soak' || repeat?.elapsedMs >= 1800000;
  const performance = raw?.performanceGateStatus ?? 'unobserved';
  const eligible = plan.phase !== 'retry';
  const retained =
    plan.phase === 'retry' &&
    (row.engine !== 'chromium' || performance === 'excluded-memory-profiling');
  return {
    correctness: correct && elapsed ? 'pass' : 'fail',
    resourceStatus: resources,
    rawPerformanceGateStatus: performance,
    performanceQualification: eligible ? performance : 'excluded-retention',
    status:
      correct &&
      elapsed &&
      ['pass', 'not-requested-by-frozen-recipe'].includes(resources) &&
      (eligible ? performance === 'pass-observed-window' && command.exitCode === 0 : retained)
        ? 'passed'
        : 'failed',
    ...comparisonLabels(plan),
  };
}

// Post-child, post-hydration analysis only. Original numeric/resource-rule
// statuses remain visible; finite owner bounds do not prove retention stability.
export async function anchoredSoakAssessment(
  plan,
  row,
  raw,
  command,
  browserVersion,
  journalVerification,
) {
  assert.equal(plan.sourceCohort, finalSoakCohort);
  const inherited = lifecycleAssessment(plan, row, raw, command, browserVersion);
  const { assessSoloOwnedResources } = await import('./solo-owned-resource-assessment.mjs');
  let owned;
  try {
    owned = assessSoloOwnedResources(raw);
  } catch (error) {
    owned = {
      format: 'SoloOwnedResourceAssessmentV1',
      bounds: { status: 'invalid-evidence' },
      retention: { status: 'inconclusive' },
      failure: String(error.message ?? error).slice(0, 2048),
      gameplayQualification: false,
      nativeMemoryQualification: false,
    };
  }
  const repeats = raw?.actions?.filter((action) => action.type === 'repeat') ?? [];
  const protocol =
    raw?.kind === 'lifecycle' &&
    raw.scenarioKind === 'lifecycle' &&
    raw.workProbe === true &&
    raw.cadenceProtocol === 'settled120' &&
    raw.cacheMode === 'fresh-context' &&
    raw.baselineRuntime === (row.source === 'baseline') &&
    raw.replay?.scope === 'completed-scenario' &&
    !raw.finalReadFailure &&
    !raw.failureCleanupFailure &&
    repeats.length === 1 &&
    repeats[0].status === 'pass' &&
    Number.isSafeInteger(repeats[0].iterations) &&
    repeats[0].iterations > 0 &&
    repeats[0].iterations <= 360 &&
    repeats[0].elapsedMs >= 1800000;
  const journalComplete =
    journalVerification?.status === 'complete' &&
    !Object.hasOwn(raw ?? {}, 'performanceGateStatusBeforeHitchJournal') &&
    !raw?.hitchJournalFailure;
  return {
    ...inherited,
    numericObservationStatus: inherited.status,
    protocolStatus: protocol ? 'pass' : 'fail',
    correctness: protocol ? inherited.correctness : 'fail',
    ownedResourceAssessment: owned,
    ownedResourceBoundsStatus: owned.bounds.status,
    retentionQualification: 'review-required',
    hitchJournalVerification: journalVerification ?? {
      status: 'invalid-evidence',
      failure: 'Journal not independently verified',
    },
    performanceEvidenceStatus: journalComplete ? 'complete' : 'invalid-evidence',
    performanceGateStatusBeforeHitchJournal: raw?.performanceGateStatusBeforeHitchJournal ?? null,
    status:
      inherited.status === 'passed' && protocol && journalComplete
        ? owned.bounds.status === 'pass'
          ? 'review-required'
          : owned.bounds.status === 'inconclusive'
            ? 'inconclusive'
            : 'failed'
        : 'failed',
    scope:
      'Exact anchored 34.29% First Return route only. Original numeric and three canvas-rule results are separate from all-owner bounds and manual retention review. No historical 51.43% route substitution, physical qualification, native-memory qualification or automatic resume.',
  };
}

export function timingAssessment(plan, row, raw, command, browserVersion, journalVerification) {
  if (
    planHasHitchJournal(plan) &&
    journalVerification?.status === 'complete' &&
    (Object.hasOwn(raw ?? {}, 'performanceGateStatusBeforeHitchJournal') ||
      raw?.hitchJournalFailure)
  )
    journalVerification = {
      status: 'invalid-evidence',
      failure: 'Complete journal contradicts its retained failure override',
    };
  const inherited = lifecycleAssessment(plan, row, raw, command, browserVersion);
  const display =
    row.engine === 'webkit'
      ? {
          viewport: { width: 400, height: 850 },
          deviceScaleFactor: 3,
          isMobile: true,
          hasTouch: true,
        }
      : {
          viewport: { width: 1280, height: 800 },
          deviceScaleFactor: 1,
          isMobile: false,
          hasTouch: false,
        };
  let valid = false;
  try {
    assert.equal(raw.workProbe, true);
    assert.equal(raw.kind, 'performance');
    assert.equal(raw.scenarioKind, 'performance');
    assert.equal(raw.cadenceProtocol, 'settled120');
    assert.equal(raw.baselineRuntime, row.source === 'baseline');
    assert.equal(
      raw.cacheMode,
      plan.phase === 'warm-first30' ? 'warm-http-reload' : 'fresh-context',
    );
    assert.deepEqual(raw.environment.requestedDisplay, display);
    assert.equal(raw.replay.scope, 'completed-scenario');
    assert(!raw.finalReadFailure && !raw.failureCleanupFailure);
    if (row.engine === 'webkit') {
      assert.equal(raw.environment.contextOwner?.cleanup?.status, 'closed');
      assert.equal(raw.environment.contextOwner.cleanup.profileRemoved, true);
      assert.equal(raw.environment.contextOwner.cleanup.browserClosed, true);
    }
    valid = true;
  } catch {
    /* Raw gates and failures remain in the retained report. */
  }
  return {
    ...inherited,
    protocolStatus: valid ? 'pass' : 'fail',
    correctness: valid ? inherited.correctness : 'fail',
    status:
      valid && (!planHasHitchJournal(plan) || journalVerification?.status === 'complete')
        ? inherited.status
        : 'failed',
    ...(planHasHitchJournal(plan)
      ? {
          hitchJournalVerification: journalVerification ?? {
            status: 'invalid-evidence',
            failure: 'Journal not independently verified',
          },
          performanceEvidenceStatus:
            journalVerification?.status === 'complete' ? 'complete' : 'invalid-evidence',
          performanceGateStatusBeforeHitchJournal:
            raw?.performanceGateStatusBeforeHitchJournal ?? null,
        }
      : {}),
    scope: diagnosticComparison(plan)
      ? 'Independent hosted comparison diagnostics only. Raw numerical/replay/protocol failures remain unchanged; prerequisite remains false and overall performance is not qualified.'
      : 'Latest-source hosted timing only; neither physical-device evidence nor replacement credit for historical macOS observations.',
  };
}

export function longRecordingAssessment(plan, row, raw, command, browserVersion) {
  const inherited = lifecycleAssessment(plan, row, raw, command, browserVersion);
  const repeats = raw?.actions?.filter((action) => action.type === 'repeat') ?? [];
  const pre =
    raw?.snapshots?.filter((snapshot) => snapshot.group === 'continuous-recording-paused') ?? [];
  const identity = raw?.replayIdentity;
  const pair = identity?.observations;
  const actions = raw?.actions ?? [];
  const labels = [
    'before-saved-flight-reload',
    'public-saved-flight-reload',
    'public-load-saved-flight',
    'public-restored-pause-owner',
    'after-saved-flight-reload',
  ];
  const positions = labels.map((label) =>
    actions.findIndex((action) => action.label === label && action.status === 'pass'),
  );
  const ordered = positions.every(
    (index, at) => index >= 0 && (at === 0 || index > positions[at - 1]),
  );
  const duration =
    repeats.length === 1 &&
    repeats[0].status === 'pass' &&
    repeats[0].elapsedMs >= 1740000 &&
    repeats[0].iterations <= 870;
  const restored =
    identity?.format === 'SoloPublicReplayIdentityPairV1' &&
    identity.mode === 'exact-public-bytes-pair' &&
    identity.status === 'pass' &&
    pair?.length === 2 &&
    pair.every(
      (item) =>
        Number.isSafeInteger(item.bytes) &&
        item.bytes > 0 &&
        item.bytes <= 32 * MiB &&
        /^[a-f0-9]{64}$/.test(item.sha256),
    ) &&
    pair[0].bytes === pair[1].bytes &&
    pair[0].sha256 === pair[1].sha256 &&
    raw.replay?.scope === 'completed-scenario' &&
    raw.replay.bytes === pair[1].bytes &&
    raw.replay.sha256 === pair[1].sha256;
  let performance;
  try {
    assert.equal(pre.length, 1, 'One pre-reload snapshot is required');
    assert.equal(pre[0].phase, 'paused');
    const application = evaluateQualificationBudgets(pre[0].application);
    const external = externalQualificationBudgets(pre[0].probe);
    performance = {
      application,
      external,
      ...aggregateQualificationGates({
        application,
        external,
        workProbe: true,
        baselineRuntime: row.source === 'baseline',
        applicationAvailable: Boolean(pre[0].application),
      }),
      snapshotGroup: pre[0].group,
      scope:
        'Only the paused pre-reload document window; final new-document metrics are not substituted.',
    };
  } catch (error) {
    performance = { status: 'invalid-evidence', failure: String(error.message) };
  }
  const correctness =
    inherited.correctness === 'pass' &&
    duration &&
    ordered &&
    restored &&
    !raw.finalReadFailure &&
    !raw.failureCleanupFailure;
  return {
    ...inherited,
    correctness: correctness ? 'pass' : 'fail',
    durationStatus: duration ? 'pass' : 'fail',
    publicSavedReload: {
      status: restored && ordered ? 'pass' : 'fail',
      identity,
      scope:
        'Exact public replay bytes survived same-context reload and ordinary paused Load; save-call attribution/OS-flush/browser-restart are not proved.',
    },
    preReloadPerformance: performance,
    finalDocumentPerformanceGateStatus: raw?.performanceGateStatus ?? 'unobserved',
    performanceQualification: performance.status,
    status:
      correctness &&
      inherited.resourceStatus === 'not-requested-by-frozen-recipe' &&
      performance.status === 'pass-observed-window' &&
      [0, 2].includes(command.exitCode)
        ? 'passed'
        : 'failed',
    ...comparisonLabels(plan),
  };
}

// Explicit final-source lifecycle admission. These post-child checks preserve
// numerical failures and the original memory-profile/continuous-recording rules.
export function finalLifecycleAssessment(plan, row, raw, command, browserVersion, journal) {
  assert(finalLifecyclePlan(plan));
  const inherited = (plan.phase === 'long29' ? longRecordingAssessment : lifecycleAssessment)(
    plan,
    row,
    raw,
    command,
    browserVersion,
  );
  let protocol = false;
  try {
    assert.equal(raw.workProbe, true);
    assert.equal(raw.cadenceProtocol, 'settled120');
    assert.equal(raw.baselineRuntime, row.source === 'baseline');
    assert.equal(raw.cacheMode, 'fresh-context');
    assert.equal(raw.scenarioKind, plan.phase === 'long29' ? 'performance' : 'lifecycle');
    assert.equal(
      raw.kind,
      plan.phase === 'retry' && row.engine === 'chromium' ? 'memory-profile' : raw.scenarioKind,
    );
    assert.equal(raw.replay.scope, 'completed-scenario');
    assert(!raw.finalReadFailure && !raw.failureCleanupFailure);
    if (row.engine === 'webkit') {
      assert.equal(raw.environment.contextOwner?.cleanup?.status, 'closed');
      assert.equal(raw.environment.contextOwner.cleanup.profileRemoved, true);
      assert.equal(raw.environment.contextOwner.cleanup.browserClosed, true);
    }
    const topCount = { next: 119, retry: 13, long29: 17 }[plan.phase];
    assert(
      raw.actions.every((action) => action.status === 'pass'),
      'No failed or skipped route actions',
    );
    assert.equal(raw.actions.filter((action) => /^\d+$/.test(action.path)).length, topCount);
    for (let i = 0; i < topCount; i++)
      assert.equal(raw.actions.find((action) => action.path === String(i))?.status, 'pass');
    if (plan.phase === 'next') {
      assert.equal(
        raw.actions.filter((action) => action.type === 'result' && action.status === 'pass').length,
        11,
      );
      assert.equal(raw.snapshots.filter((snapshot) => snapshot.group === 'next-result').length, 11);
    } else if (plan.phase === 'retry') {
      const repeats = raw.actions.filter((action) => action.type === 'repeat');
      assert.equal(repeats.length, 1);
      assert.equal(repeats[0].iterations, 20);
      assert.equal(repeats[0].status, 'pass');
      assert.equal(raw.snapshots.filter((snapshot) => snapshot.group === 'completed').length, 20);
      assert.equal(raw.snapshots.filter((snapshot) => snapshot.group === 'last-retry').length, 1);
    }
    protocol = true;
  } catch {
    // Keep the complete raw protocol and numerical results in the row evidence.
  }
  const complete =
    journal?.status === 'complete' &&
    !Object.hasOwn(raw ?? {}, 'performanceGateStatusBeforeHitchJournal') &&
    !raw?.hitchJournalFailure;
  return {
    ...inherited,
    numericObservationStatus: inherited.status,
    protocolStatus: protocol ? 'pass' : 'fail',
    correctness: protocol ? inherited.correctness : 'fail',
    hitchJournalVerification: journal ?? {
      status: 'invalid-evidence',
      failure: 'Journal not independently verified',
    },
    performanceEvidenceStatus: complete ? 'complete' : 'invalid-evidence',
    performanceGateStatusBeforeHitchJournal: raw?.performanceGateStatusBeforeHitchJournal ?? null,
    status: protocol && complete ? inherited.status : 'failed',
    scope:
      plan.phase === 'long29'
        ? 'Original continuous recording and exact public saved-reload bytes. Only the first active document supplies recording timing; restored paused document remains separately retained.'
        : 'Exact authored lifecycle route only; Retry retains Chromium memory profiling exclusion. Original canvas rules do not establish all-owner retention stability.',
  };
}

export async function geometricNextAssessment(plan, row, raw, command, browserVersion, journal) {
  assert(geometricNextPlan(plan));
  const inherited = lifecycleAssessment(plan, row, raw, command, browserVersion);
  let protocolFailure = null;
  try {
    assert.equal(row.source, 'candidate');
    assert.equal(raw.workProbe, true);
    assert.equal(raw.cadenceProtocol, 'settled120');
    assert.equal(raw.baselineRuntime, false);
    assert.equal(raw.cacheMode, 'fresh-context');
    assert.equal(raw.scenarioKind, 'lifecycle');
    assert.equal(raw.kind, 'lifecycle');
    assert.equal(raw.replay.scope, 'completed-scenario');
    assert(!raw.finalReadFailure && !raw.failureCleanupFailure);
    if (row.engine === 'webkit') {
      assert.equal(raw.environment.contextOwner?.cleanup?.status, 'closed');
      assert.equal(raw.environment.contextOwner.cleanup.profileRemoved, true);
      assert.equal(raw.environment.contextOwner.cleanup.browserClosed, true);
    }
    const { NEXT_ROUTE_IDENTITIES, NEXT_ROUTE_PROTOCOL } = await import(
      './solo-qualification-next-route.mjs'
    );
    assert.equal(raw.actions.length, 60);
    const routes = raw.actions.filter((action) => action.type === 'authored-next-route');
    assert.equal(routes.length, 11);
    for (const [index, action] of raw.actions.entries()) {
      assert.equal(action.path, String(index));
      assert.equal(
        action.status,
        action.type === 'authored-next-route' ? 'passed-public-route' : 'pass',
      );
    }
    for (const [index, action] of routes.entries()) {
      assert.equal(action.path, String(6 + 5 * index));
      assert.equal(action.protocol, NEXT_ROUTE_PROTOCOL);
      assert.equal(action.mission, NEXT_ROUTE_IDENTITIES[index].id);
      assert.equal(action.initial.mission, action.mission);
      assert.equal(action.final.mission, action.mission);
      assert.equal(action.initial.autoNext, false);
      assert.equal(action.final.autoNext, false);
      assert.equal(action.initial.lives, 3);
      assert.equal(action.final.lives, 3);
      assert.equal(action.final.status, 'won');
      assert(
        Number.isSafeInteger(action.initial.tick) &&
          action.initial.tick >= 0 &&
          action.initial.tick <= 12,
      );
      assert(Number.isSafeInteger(action.final.tick) && action.final.tick > action.initial.tick);
      assert(
        Number.isFinite(action.elapsedMs) && action.elapsedMs >= 0 && action.elapsedMs <= 60000,
      );
      assert(Number.isSafeInteger(action.reads) && action.reads > 0 && action.reads <= 1201);
      assert.equal(action.unsettled, 0);
      assert.deepEqual(action.heldKeys, []);
      assert(!action.failure && !action.cleanupFailure);
      assert(
        Array.isArray(action.events) && action.events.length > 0 && action.events.length <= 128,
      );
      assert(action.events.every((event) => event.status === 'settled'));
      assert(Array.isArray(action.stages) && action.stages.length <= 32);
      assert(Buffer.byteLength(JSON.stringify(action)) <= 65536);
    }
    assert.equal(raw.actions.filter((action) => action.type === 'result').length, 11);
    for (let index = 0; index < 10; index++) assert.equal(raw.actions[9 + 5 * index].type, 'click');
    assert.equal(raw.snapshots.filter((snapshot) => snapshot.group === 'next-result').length, 11);
  } catch (error) {
    protocolFailure = String(error.message ?? error).slice(0, 2048);
  }
  const complete =
    journal?.status === 'complete' &&
    !Object.hasOwn(raw ?? {}, 'performanceGateStatusBeforeHitchJournal') &&
    !raw?.hitchJournalFailure;
  return {
    ...inherited,
    numericObservationStatus: inherited.status,
    protocolStatus: protocolFailure ? 'fail' : 'pass',
    protocolFailure,
    correctness: protocolFailure ? 'fail' : inherited.correctness,
    hitchJournalVerification: journal ?? {
      status: 'invalid-evidence',
      failure: 'Journal not independently verified',
    },
    performanceEvidenceStatus: complete ? 'complete' : 'invalid-evidence',
    performanceGateStatusBeforeHitchJournal: raw?.performanceGateStatusBeforeHitchJournal ?? null,
    status: !protocolFailure && complete ? inherited.status : 'failed',
    candidateOnly: true,
    scope:
      geometricNextSource(plan) === GEOMETRIC_NEXT_DE332_SOURCE
        ? 'Exactly eleven authored missions and ten manual Next transitions on de332. Existing HUD markers and bounded journal retain attribution evidence; excluded from timing comparison. Native final replay remains required. No baseline, uninstrumented geometry or native-memory qualification.'
        : geometricNextSource(plan) === GEOMETRIC_NEXT_39774_SOURCE
          ? 'Exactly eleven authored missions and ten manual Next transitions on 39774. Trusted input plus bounded rendered-state polling; excluded from timing comparison. Native final replay remains required. No baseline, uninstrumented geometry or native-memory qualification.'
          : geometricNextSource(plan) === GEOMETRIC_NEXT_FINAL_SOURCE
            ? 'Exactly eleven authored missions and ten manual Next transitions on e1cc. Trusted input plus bounded rendered-state polling; excluded from timing comparison. Native final replay remains required. No baseline, uninstrumented geometry or native-memory qualification.'
            : 'Exactly eleven authored missions and ten manual Next transitions on c696. Trusted input plus bounded rendered-state polling; excluded from timing comparison. Native final replay remains required. No baseline, later-layout or native-memory qualification.',
  };
}

export function diagnosticsAssessment(raw, manifest, row, command, expectedBrowserVersion) {
  const observations = raw?.observations;
  const versions = Array.isArray(observations)
    ? [...new Set(observations.map((x) => x.environment?.browser))]
    : [];
  const expected = expectedBrowserVersion ? `${row.engine} ${expectedBrowserVersion}` : null;
  const complete =
    command.status === 'closed' &&
    command.exitCode === 0 &&
    raw?.status === 'pass' &&
    raw.limit === 0.05 &&
    raw.plannedPairs === 10 &&
    raw.completePairs === 10 &&
    raw.noAdaptationWitness?.status === 'observed-full' &&
    observations?.length === 20 &&
    observations.every((x) => x.valid) &&
    versions.length === 1 &&
    typeof versions[0] === 'string' &&
    (!expected || versions[0] === expected) &&
    manifest?.configuration?.sourceRevision === source.candidate &&
    manifest.configuration.pairs === 10 &&
    manifest.configuration.seed === 1544 &&
    manifest.configuration.durationMs === 30000 &&
    manifest.configuration.browser === row.engine &&
    manifest.executions?.length === 20 &&
    manifest.executions.every((x) => x.status === 'complete' && x.exitCode === 0);
  return {
    status: complete ? 'passed' : 'failed',
    rawPerformanceGateStatus: raw?.status ?? 'unobserved',
    browserIdentity: versions[0] ?? null,
    strictReplay: 'not-a-full-run-replay-observer',
    contextScope: 'Existing observer context; separate from persistent WebKit lifecycle qualifier',
  };
}

export async function runSustainedRow(ctx, row, dir, tmp) {
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
    const identity = await fetch(new URL('game/build-info.json', server.url), {
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(identity.status, 200);
    for (const [key, value] of Object.entries(PUBLIC_SECURITY_HEADERS))
      assert.equal(identity.headers.get(key), value);
    const identityBytes = Buffer.from(await identity.arrayBuffer());
    const build = JSON.parse(identityBytes);
    assert.equal(build.sourceRevision, roleRevision(ctx.plan, row.source));
    const url = new URL('game/?journey=opening', server.url).href;
    row.served = {
      url,
      build,
      buildInfoSHA256: sha(identityBytes),
      headers: server.headers,
      mode: server.mode,
      fixtureAccess: server.fixtureAccess,
    };
    const admitted = ctx.admitted.artifacts[row.source];
    assert.equal(admitted.sourceRevision, build.sourceRevision);
    row.artifactAdmission = admitted;
    const command = await ctx.run(
      row.id,
      [process.execPath, ...sustainedArguments(ctx, row, url, dir)],
      row.timeoutMs,
      {
        env: { ...ctx.cleanEnv, TMPDIR: tmp },
        log: join(dir, 'command.log'),
        receipt: join(dir, 'command.json'),
        inspect: async () => {
          await ctx.inspect();
          assert((await ctx.evidenceSize(dir)) <= ctx.plan.rowEvidenceBytes, 'Row evidence cap');
        },
      },
    );
    row.command = command;
    if (ctx.plan.phase === 'diagnostics') {
      const raw = await checkedJSON(join(dir, 'diagnostics/analysis.json'));
      const manifest = await checkedJSON(join(dir, 'diagnostics/manifest.json'));
      assert.equal(manifest.configuration.cpuRate, ctx.modeState.cpu);
      assert.equal(raw.provenance?.sourceRevision, source.candidate);
      assert.equal(
        raw.provenance?.declaredArtifactSha256,
        ctx.admitted.artifacts.candidate.archiveIdentity.sha256,
      );
      Object.assign(
        row,
        diagnosticsAssessment(raw, manifest, row, command, ctx.modeState.browserVersion),
      );
    } else {
      const raw = ctx.modeState.snapshotStorage
        ? await (
            await import('./solo-qualification-snapshot-store.mjs')
          ).readQualificationSnapshotReport(join(dir, 'report.json'), ctx.modeState.snapshotStorage)
        : await checkedJSON(join(dir, 'report.json'), ctx.plan.rowEvidenceBytes);
      assert.equal(raw.environment?.cpuThrottle, ctx.modeState.cpu);
      const journalVerification = planHasHitchJournal(ctx.plan)
        ? await verifyTimingHitchJournal(ctx.plan, raw, join(dir, 'report.json'), url)
        : undefined;
      Object.assign(
        row,
        await (
          ctx.plan.sourceCohort === finalSoakCohort
            ? anchoredSoakAssessment
            : geometricNextPlan(ctx.plan)
              ? geometricNextAssessment
              : finalLifecyclePlan(ctx.plan)
                ? finalLifecycleAssessment
                : timingPlan(ctx.plan)
                  ? timingAssessment
                  : ctx.plan.phase === 'long29'
                    ? longRecordingAssessment
                    : lifecycleAssessment
        )(ctx.plan, row, raw, command, ctx.modeState.browserVersion, journalVerification),
      );
      row.browserVersion = raw.environment?.browserVersion;
      assert.equal(typeof row.browserVersion, 'string');
      if (ctx.modeState.browserVersion)
        assert.equal(row.browserVersion, ctx.modeState.browserVersion);
      else ctx.modeState.browserVersion = row.browserVersion;
    }
    Object.assign(row, comparisonLabels(ctx.plan));
    await verifyInputs(ctx);
  } finally {
    if (server) {
      await Promise.race([
        new Promise((resolveClose, reject) => {
          server.server.close((error) => (error ? reject(error) : resolveClose()));
          server.server.closeAllConnections();
        }),
        delay(10000).then(() => {
          throw new Error('Sustained owned preview close deadline');
        }),
      ]).catch((error) => {
        row.serverCleanupFailure = String(error);
        row.status = 'failed';
        throw error;
      });
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, input, output, engine, repetition] = process.argv.slice(2);
  const bytes = await readFile(input);
  if (mode === 'timing-matrix-plan')
    process.stdout.write(`matrix=${JSON.stringify(timingMatrix(JSON.parse(bytes)))}\n`);
  else if (mode === 'bind-timing-plan') {
    const plan = bindTimingJob(JSON.parse(bytes), engine, Number(repetition));
    plan.manifestInput = { path: resolve(input), bytes: bytes.length, sha256: sha(bytes) };
    await writeFile(output, JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
  } else if (mode === 'matrix-plan')
    process.stdout.write(`matrix=${JSON.stringify(sustainedMatrix(JSON.parse(bytes)))}\n`);
  else {
    assert.equal(mode, 'bind-plan');
    const plan = bindSustainedJob(JSON.parse(bytes), engine, Number(repetition));
    plan.manifestInput = { path: resolve(input), bytes: bytes.length, sha256: sha(bytes) };
    await writeFile(output, JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
  }
}
