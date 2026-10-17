// Source-specific correctness diagnostics; no performance qualification or retries.
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
export const RESUME_READINESS_SOURCE = Object.freeze({
  revision: '4bf5e9b3b7f2f06fbe24f50ff9457efb70a7b1a7',
  tree: 'e87e64d0e14584c2a569d06bae8e7c602c5ed105',
});
export const RESUME_READINESS_FIXTURES = Object.freeze({
  'warm-resume': Object.freeze({
    path: 'docs/performance/fixtures/solo-readiness-resume/warm.qualification.fixture',
    bytes: 3878,
    sha256: '95f77f635658a53ae5ab89ca9879321a37c22e512c2a0bb751ad5ed194699545',
  }),
  'saved-resume': Object.freeze({
    path: 'docs/performance/fixtures/solo-readiness-resume/saved.qualification.fixture',
    bytes: 4723,
    sha256: 'b739f37f5bd9c341931ed528a955614aaf1ba05075bb1baab1c2a655a5bcd527',
  }),
});

export const COMBINED_READINESS_COHORT = 'readiness-and-muted-effects-candidate4bf';
export const EFFECTS_READINESS_FIXTURES = Object.freeze({
  full: {
    path: 'docs/performance/fixtures/solo-remote-timing/public-effects-full-first30.qualification.fixture',
    bytes: 7134,
    sha256: '6b8a1228961eb06e3731ed1db82f7a3852e45b0b1e0c41ba566cd3c9fbc7f71a',
  },
  reduced: {
    path: 'docs/performance/fixtures/solo-remote-timing/public-effects-reduced-first30.qualification.fixture',
    bytes: 7142,
    sha256: 'd25dca66beea78f53725a594bdcdd3c6228f5dd6d81e85cd21e092d031114b96',
  },
});
export function combinedReadinessRows(engine) {
  assert(READINESS_ENGINES.includes(engine));
  return ['warm-resume', 'saved-resume']
    .map((phase) => ({ ...readinessRow(engine, phase), phase }))
    .concat(engine === 'webkit' ? qualityComparisonSchedule() : []);
}
export const COMBINED_READINESS_PROTOCOL = Object.freeze({
  name: 'warm-saved-and-muted-effects-v1',
  readiness: ['warm-resume-v1', 'saved-resume-v1'],
  effects: ['full', 'reduced', 'reduced', 'full'],
  effectsEngine: 'webkit',
  effectsAudio: { muted: true, volume: 0.8, observedOperations: 0 },
  externalCadence: 'settled120',
  numericalGates: 'unchanged-raw',
  performanceQualification: false,
});
function combinedPlan(plan) {
  return (
    plan.sourceCohort === COMBINED_READINESS_COHORT || fontCompactPlan(plan) || fontDprPlan(plan)
  );
}
export function readinessRowPlan(plan, row) {
  if (!combinedPlan(plan)) return plan;
  if (fontDprPlan(plan)) {
    const expected = fontDprRows(plan.engine).find((item) => item.id === row.id);
    assert(expected, 'Undeclared font/DPR row');
    for (const [key, value] of Object.entries(expected)) assert.deepEqual(row[key], value, key);
    if (Object.hasOwn(expected, 'dpr'))
      return {
        ...plan,
        sourceCohort: 'readiness-public-dpr-candidate0feb',
        phase: `public-dpr-${expected.dpr}`,
        fixture: COMPACT_READINESS_FIXTURES.full,
        rows: [expected],
      };
    return {
      ...plan,
      sourceCohort: 'readiness-selected-font-candidate0feb',
      phase: 'selected-font-cancel',
      fixture: SELECTED_FONT_JOINED_FIXTURE,
      rows: [readinessRow(plan.engine, 'selected-font-cancel')],
      protocol: {
        name: 'selected-font-cancel-joined-v2',
        startupWait: 'immediate-partial',
        externalCadence: 'settled120',
        observationTimeoutMs: 240000,
        records: 8,
        bytes: 16384,
        numericalGates: 'unchanged-raw',
        performanceQualification: false,
      },
    };
  }
  const expected = (
    fontCompactPlan(plan) ? fontCompactRows(plan.engine) : combinedReadinessRows(plan.engine)
  ).find((item) => item.id === row.id);
  assert(expected, 'Undeclared combined row');
  for (const [key, value] of Object.entries(expected)) assert.deepEqual(row[key], value, key);
  const effect = qualityComparisonSchedule().find((arm) => arm.id === row.id);
  if (effect)
    return {
      ...plan,
      sourceCohort: fontCompactPlan(plan)
        ? 'readiness-public-effects-candidatec696'
        : 'readiness-public-effects-candidate4bf',
      phase: `public-effects-${effect.tier}`,
      fixture: (fontCompactPlan(plan) ? COMPACT_READINESS_FIXTURES : EFFECTS_READINESS_FIXTURES)[
        effect.tier
      ],
      rows: [effect],
    };
  assert(
    (fontCompactPlan(plan)
      ? ['selected-font-cancel', 'saved-resume']
      : ['warm-resume', 'saved-resume']
    ).includes(row.phase),
  );
  assert.equal(row.id, readinessRow(plan.engine, row.phase).id);
  return {
    ...plan,
    sourceCohort: fontCompactPlan(plan)
      ? row.phase === 'selected-font-cancel'
        ? 'readiness-selected-font-candidatec696'
        : 'readiness-resume-candidatec696'
      : 'readiness-resume-candidate4bf',
    phase: row.phase,
    fixture: fontCompactPlan(plan)
      ? row.phase === 'selected-font-cancel'
        ? SELECTED_FONT_FIXTURE
        : COMPACT_READINESS_FIXTURES.saved
      : RESUME_READINESS_FIXTURES[row.phase],
    rows: [readinessRow(plan.engine, row.phase)],
    protocol: {
      name: row.phase + '-v1',
      startupWait: 'immediate-partial',
      externalCadence: 'settled120',
      observationTimeoutMs: 240000,
      records: 8,
      bytes: 16384,
      numericalGates: 'unchanged-raw',
      performanceQualification: false,
    },
  };
}
function combinedFixtureInputs(plan) {
  return [
    ...plan.adapterInputs,
    ...plan.frozenTools,
    plan.fixture,
    ...(combinedPlan(plan) ? plan.additionalFixtures : []),
  ];
}

function selection(plan) {
  if (plan.sourceCohort === 'readiness-selected-font-candidate0feb') {
    assert.equal(plan.phase, 'selected-font-cancel');
    return {
      source: FONT_DPR_SOURCE,
      fixture: SELECTED_FONT_JOINED_FIXTURE,
      protocol: 'selected-font-cancel-joined-v2',
      requestPolicy: 'same-url-two-v2',
      font: true,
      resume: false,
      documents: 1,
    };
  }
  if (plan.sourceCohort === 'readiness-public-dpr-candidate0feb') {
    assert(['public-dpr-1', 'public-dpr-3'].includes(plan.phase));
    return {
      source: FONT_DPR_SOURCE,
      quality: true,
      density: true,
      resume: false,
      documents: 1,
      compact: true,
    };
  }
  if (plan.sourceCohort === 'readiness-selected-font-candidatec696') {
    assert.equal(plan.phase, 'selected-font-cancel');
    return {
      source: SELECTED_FONT_SOURCE,
      fixture: SELECTED_FONT_FIXTURE,
      protocol: 'selected-font-cancel-v1',
      font: true,
      resume: false,
      documents: 1,
    };
  }
  if (combinedPlan(plan))
    return {
      source: fontDprPlan(plan)
        ? FONT_DPR_SOURCE
        : fontCompactPlan(plan)
          ? SELECTED_FONT_SOURCE
          : RESUME_READINESS_SOURCE,
      combined: true,
    };
  if (plan.sourceCohort === 'readiness-public-effects-candidatec696') {
    assert(['public-effects-full', 'public-effects-reduced'].includes(plan.phase));
    return {
      source: SELECTED_FONT_SOURCE,
      quality: true,
      resume: false,
      documents: 1,
      compact: true,
    };
  }
  if (plan.sourceCohort === 'readiness-resume-candidatec696') {
    assert.equal(plan.phase, 'saved-resume');
    assert.equal(plan.engine, 'webkit');
    return {
      source: SELECTED_FONT_SOURCE,
      fixture: COMPACT_READINESS_FIXTURES.saved,
      protocol: 'saved-resume-v1',
      resume: true,
      documents: 2,
      compact: true,
    };
  }
  if (plan.sourceCohort === 'readiness-public-effects-candidate4bf') {
    assert(['public-effects-full', 'public-effects-reduced'].includes(plan.phase));
    return { source: RESUME_READINESS_SOURCE, quality: true, resume: false, documents: 1 };
  }
  if (plan.sourceCohort === 'readiness-resume-candidate4bf') {
    assert(Object.hasOwn(RESUME_READINESS_FIXTURES, plan.phase));
    return {
      source: RESUME_READINESS_SOURCE,
      fixture: RESUME_READINESS_FIXTURES[plan.phase],
      protocol: plan.phase + '-v1',
      resume: true,
      documents: plan.phase === 'saved-resume' ? 2 : 1,
    };
  }
  assert.equal(plan.sourceCohort, 'readiness-candidateab45');
  assert.equal(plan.phase, 'cold-first30');
  return {
    source: READINESS_SOURCE,
    fixture: READINESS_FIXTURE,
    protocol: 'first-running-v1',
    resume: false,
    documents: 1,
  };
}
export const SELECTED_FONT_SOURCE = Object.freeze({
  revision: 'c696af41857840359ae473558b90682f3d71f2db',
  tree: 'b70ce1c4b15023a38628c5e958b166e44898eccf',
});
export const SELECTED_FONT_FIXTURE = Object.freeze({
  path: 'docs/performance/fixtures/solo-readiness-font/selected-font-cancel.qualification.fixture',
  bytes: 5738,
  sha256: 'd4c774b80df93896cfd4a1f82d66c16f58a9ed68938ed88229449a2bb001cc67',
});
export const FONT_COMPACT_COHORT = 'readiness-font-and-compact-candidatec696';
export const COMPACT_READINESS_FIXTURES = Object.freeze({
  saved: {
    path: 'docs/performance/fixtures/solo-readiness-font/saved-compact-v2.qualification.fixture',
    bytes: 5057,
    sha256: '0cd16229c6e490023bc2a6ce1b83e5631cb92d0460a2c2fb712ce38c0e2a2270',
  },
  full: {
    path: 'docs/performance/fixtures/solo-readiness-font/public-effects-full-compact-v2.qualification.fixture',
    bytes: 7367,
    sha256: 'ed26c97daf58226b48d02eb014cbfa5d9351e686916fd91d41c1741445051ab5',
  },
  reduced: {
    path: 'docs/performance/fixtures/solo-readiness-font/public-effects-reduced-compact-v2.qualification.fixture',
    bytes: 7375,
    sha256: '2e7c56516c53b6fbcb9f63a807662ecc3d9e63d8812f0ef6377ac41c2532bd9d',
  },
});
export const FONT_COMPACT_PROTOCOL = Object.freeze({
  name: 'selected-font-saved-and-muted-effects-v1',
  readiness: ['selected-font-cancel-v1', 'saved-resume-v1'],
  effects: ['full', 'reduced', 'reduced', 'full'],
  effectsEngine: 'webkit',
  effectsAudio: { muted: true, volume: 0.8, observedOperations: 0 },
  externalCadence: 'settled120',
  numericalGates: 'unchanged-raw',
  performanceQualification: false,
});
export function fontCompactRows(engine) {
  assert(READINESS_ENGINES.includes(engine));
  return [
    { ...readinessRow(engine, 'selected-font-cancel'), phase: 'selected-font-cancel' },
  ].concat(
    engine === 'webkit'
      ? [
          { ...readinessRow(engine, 'saved-resume'), phase: 'saved-resume' },
          ...qualityComparisonSchedule(),
        ]
      : [],
  );
}
function fontCompactPlan(plan) {
  return plan?.sourceCohort === FONT_COMPACT_COHORT;
}
export const FONT_DPR_SOURCE = Object.freeze({
  revision: '0febd334619731adc26dfa3df78aab02991563af',
  tree: '692135315b5a4d0dcb98bc24314c644d37cec1ed',
});
export const FONT_DPR_COHORT = 'readiness-joined-font-and-dpr-candidate0feb';
export const SELECTED_FONT_JOINED_FIXTURE = Object.freeze({
  path: 'docs/performance/fixtures/solo-readiness-font/selected-font-cancel-joined-v2.qualification.fixture',
  bytes: 5746,
  sha256: 'e46e4f0a75ef5f982373b464a487efe74e63fa7145500e4ff2ac93cb4a3d46d5',
});
export const FONT_DPR_PROTOCOL = Object.freeze({
  name: 'joined-selected-font-and-same-viewport-dpr-v1',
  readiness: ['selected-font-cancel-joined-v2'],
  fontRequests: { maximum: 2, policy: 'same-url-two-v2', originalFetches: 1 },
  density: [1, 3, 3, 1],
  effects: ['full', 'full', 'full', 'full'],
  effectsEngine: 'webkit',
  viewport: { width: 400, height: 850 },
  effectsAudio: { muted: true, volume: 0.8, observedOperations: 0 },
  externalCadence: 'settled120',
  numericalGates: 'unchanged-raw',
  performanceQualification: false,
});
export function densityComparisonSchedule() {
  return [1, 3, 3, 1].map((dpr, index) => ({
    id: `public-full-dpr-p${Math.floor(index / 2) + 1}-dpr${dpr}`,
    pair: Math.floor(index / 2) + 1,
    ordinal: index + 1,
    tier: 'full',
    dpr,
    source: 'candidate',
    engine: 'webkit',
    timeoutMs: 480000,
    performanceExclusion: true,
  }));
}
export function fontDprRows(engine) {
  assert(READINESS_ENGINES.includes(engine));
  return [
    { ...readinessRow(engine, 'selected-font-cancel'), phase: 'selected-font-cancel' },
  ].concat(engine === 'webkit' ? densityComparisonSchedule() : []);
}
function fontDprPlan(plan) {
  return plan?.sourceCohort === FONT_DPR_COHORT;
}
function densityPlan(plan) {
  return fontDprPlan(plan) || plan?.sourceCohort === 'readiness-public-dpr-candidate0feb';
}
function comparisonSchedule(plan) {
  return densityPlan(plan) ? densityComparisonSchedule() : qualityComparisonSchedule();
}
export const READINESS_ENGINES = ['chromium', 'webkit'];
export function readinessRow(engine, phase = 'cold-first30') {
  assert(['cold-first30', 'warm-resume', 'saved-resume', 'selected-font-cancel'].includes(phase));
  assert(READINESS_ENGINES.includes(engine));
  return {
    id: phase === 'cold-first30' ? `readiness-${engine}` : `readiness-${phase}-${engine}`,
    kind: 'readiness',
    source: 'candidate',
    engine,
    timeoutMs: 480000,
    performanceExclusion: true,
  };
}
export function validateReadinessPlan(plan) {
  if (fontDprPlan(plan)) {
    assert.equal(plan.format, 'SoloHostedReadinessPlanV1');
    assert.equal(plan.phase, 'joined-selected-font-and-same-viewport-dpr');
    assert.deepEqual(plan.protocol, FONT_DPR_PROTOCOL);
    assert.deepEqual(plan.rows, fontDprRows(plan.engine));
    assert.deepEqual(plan.fixture, SELECTED_FONT_JOINED_FIXTURE);
    assert.deepEqual(plan.additionalFixtures, [COMPACT_READINESS_FIXTURES.full]);
    assert.equal(plan.release.comparisonScope, 'same-viewport-dpr-full-muted-only');
    validateReadinessPlan(readinessRowPlan(plan, plan.rows[0]));
    const refs = combinedFixtureInputs(plan);
    assert.equal(new Set(refs.map((r) => r.path)).size, refs.length);
    assert(plan.frozenTools.some((r) => r.path === 'scripts/solo-qualification-observation.mjs'));
    return plan;
  }
  if (combinedPlan(plan)) {
    assert.equal(plan.format, 'SoloHostedReadinessPlanV1');
    assert.equal(
      plan.phase,
      fontCompactPlan(plan)
        ? 'selected-font-saved-and-muted-effects'
        : 'warm-saved-and-muted-effects',
    );
    assert.deepEqual(
      plan.protocol,
      fontCompactPlan(plan) ? FONT_COMPACT_PROTOCOL : COMBINED_READINESS_PROTOCOL,
    );
    assert.deepEqual(
      plan.rows,
      fontCompactPlan(plan) ? fontCompactRows(plan.engine) : combinedReadinessRows(plan.engine),
    );
    assert.deepEqual(
      plan.fixture,
      fontCompactPlan(plan) ? SELECTED_FONT_FIXTURE : RESUME_READINESS_FIXTURES['warm-resume'],
    );
    assert.deepEqual(
      plan.additionalFixtures,
      fontCompactPlan(plan)
        ? [
            COMPACT_READINESS_FIXTURES.saved,
            COMPACT_READINESS_FIXTURES.full,
            COMPACT_READINESS_FIXTURES.reduced,
          ]
        : [
            RESUME_READINESS_FIXTURES['saved-resume'],
            EFFECTS_READINESS_FIXTURES.full,
            EFFECTS_READINESS_FIXTURES.reduced,
          ],
    );
    assert.equal(plan.release.comparisonScope, 'muted-public-effects-bundle-only');
    validateReadinessPlan(readinessRowPlan(plan, plan.rows[0]));
    const refs = combinedFixtureInputs(plan);
    assert.equal(new Set(refs.map((r) => r.path)).size, refs.length);
    assert(plan.frozenTools.some((r) => r.path === 'scripts/solo-qualification-observation.mjs'));
    return plan;
  }
  assert.equal(plan.format, 'SoloHostedReadinessPlanV1');
  assert.equal(plan.status, 'reviewed-readiness-diagnostic-only');
  const selected = selection(plan);
  assert.equal(plan.repository, 'mekhovov/revealline');
  assert.equal(plan.node, '22.13.1');
  assert.equal(plan.playwright, '1.62.1');
  assert.equal(plan.candidate.revision, selected.source.revision);
  assert.equal(plan.candidate.tree, selected.source.tree);
  assert.equal(plan.runtimeRevision, selected.source.revision);
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
  assert.deepEqual(plan.fixture, selected.fixture);
  assert.deepEqual(plan.rows, [readinessRow(plan.engine, plan.phase)]);
  assert.deepEqual(plan.protocol, {
    name: selected.protocol,
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
  assert.equal(plan.release.candidateRevision, selected.source.revision);
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
  if (selected.resume)
    assert(
      plan.frozenTools.some((r) => r.path === 'scripts/solo-qualification-replay-identity.mjs'),
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
  plan.rows = combinedPlan(plan)
    ? fontDprPlan(plan)
      ? fontDprRows(engine)
      : fontCompactPlan(plan)
        ? fontCompactRows(engine)
        : combinedReadinessRows(engine)
    : [readinessRow(engine, plan.phase)];
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
  for (const ref of combinedFixtureInputs(ctx.plan)) {
    const path = resolve(ctx.repository, ref.path);
    assert(path.startsWith(ctx.repository + '/') && (await realpath(path)) === path);
    const s = await lstat(path);
    assert(s.isFile() && !s.isSymbolicLink());
    assert.deepEqual(await ctx.digest(path), { bytes: ref.bytes, sha256: ref.sha256 });
  }
}
export async function prepareReadinessMode(ctx) {
  validateReadinessPlan(ctx.plan);
  const selected = selection(ctx.plan);
  await inputs(ctx);
  assert.equal(ctx.admitted.status, 'passed');
  const a = ctx.admitted.artifacts.candidate;
  assert.equal(a.sourceRevision, selected.source.revision);
  assert.equal(a.sourceTree, selected.source.tree);
  assert.equal(a.manifestSHA256, ctx.plan.candidate.manifestSHA256);
  assert.deepEqual(a.archiveIdentity, ctx.plan.candidate.inner);
  ctx.report.performanceExclusion = true;
  ctx.report.firstEightAllCorrectnessPassed = false;
  return {
    scope: combinedPlan(ctx.plan)
      ? fontDprPlan(ctx.plan)
        ? 'One joined selected-font correctness observation per engine; WebKit additionally has two counterbalanced Full-effects DPR pairs at the same viewport. All original failures and numeric verdicts retained; no automatic retry or physical qualification.'
        : fontCompactPlan(ctx.plan)
          ? 'One exact selected-font cancellation per engine; WebKit additionally observes the compact saved Resume route and two muted public-effects pairs. Old failed routes remain failed; all numerical verdicts retained.'
          : 'Fixed serial warm/saved readiness observations; WebKit additionally has two muted public-effects pairs. All numerical failures retained; no physical qualification or automatic retry.'
      : 'One candidate correctness pilot per engine; no timing comparison, forced calibration delay, automatic retry or physical-device qualification.',
  };
}
export function readinessArguments(ctx, row, url, dir) {
  if (combinedPlan(ctx.plan)) {
    const effect = comparisonSchedule(ctx.plan).find((arm) => arm.id === row.id);
    if (effect) return qualityComparisonArguments(ctx, effect, url, dir);
    return readinessArguments({ ...ctx, plan: readinessRowPlan(ctx.plan, row) }, row, url, dir);
  }
  const selected = selection(ctx.plan);
  return [
    join(ctx.here, 'qualify-solo-runtime.mjs'),
    url,
    resolve(ctx.repository, ctx.plan.fixture.path),
    join(dir, 'report.json'),
    `--source-revision=${selected.source.revision}`,
    '--server-fixture-access',
    `--browser=${row.engine}`,
    '--cpu=1',
    '--work-probe',
    '--hitch-journal',
    '--cadence=settled120',
    `--readiness-probe=${selected.protocol}`,
    ...(row.engine === 'webkit'
      ? ['--context=persistent', '--viewport=400x850', '--dpr=3', '--mobile-context']
      : []),
  ];
}
export async function readReadinessJSON(path, text = false) {
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
    return text ? b.subarray(0, n).toString('utf8') : JSON.parse(b.subarray(0, n));
  } finally {
    await f.close();
  }
}
export async function readinessAssessment(
  plan,
  row,
  raw,
  command,
  journal,
  finalReplayText = null,
) {
  const selected = selection(plan);
  const { assessReadinessPilot, assessResumeReadiness, assessSelectedFontReadiness } = await import(
    './solo-qualification-readiness.mjs'
  );
  const groups =
    selected.documents === 2
      ? ['before-resume', 'saved-restored-before-resume', 'after-resume']
      : ['before-resume', 'after-resume'];
  const readiness = selected.font
    ? assessSelectedFontReadiness(
        raw?.readinessObservation,
        raw?.snapshots?.at(-1)?.application,
        raw?.readinessDocuments,
        raw?.selectedFontTransport,
        selected.requestPolicy ?? 'single-v1',
      )
    : selected.resume
      ? assessResumeReadiness({
          protocol: selected.protocol,
          documents: raw?.readinessDocuments,
          observations: raw?.readinessObservations,
          applications: groups.map(
            (group) => raw?.snapshots?.find((s) => s.group === group)?.application,
          ),
          replayEvidence: raw?.readinessReplayEvidence,
          finalReplayText,
        })
      : assessReadinessPilot(
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
    assert.equal(raw.scenarioKind, selected.resume || selected.font ? 'lifecycle' : 'performance');
    assert.equal(raw.scenarioStatus, 'pass');
    assert.equal(raw.scenarioSHA256, plan.fixture.sha256);
    assert.equal(raw.sourceRevision, selected.source.revision);
    assert.equal(raw.buildIdentity.sourceRevision, selected.source.revision);
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
    assert.equal(raw.readinessPilot.protocol, selected.protocol);
    assert.equal(raw.readinessPilot.performanceQualification, false);
    assert.equal(raw.startupCadenceObservations.length, selected.documents);
    for (const observation of raw.startupCadenceObservations)
      assert.equal(observation.pilotStartupWait, 'omitted; immediate partial samples retained');
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
      ...(selected.font ? ['selectedFontFailure'] : []),
    ])
      assert(!raw[key], key);
    assert.equal(raw.replay.scope, 'completed-scenario');
    const native = raw.replay.nativeVerification;
    assert.equal(native.status, 'pass');
    assert.equal(native.engine, row.engine);
    assert.equal(native.browserVersion, raw.environment.browserVersion);
    assert.equal(native.observation?.match, true);
    if (selected.font || selected.compact) {
      const fixture = JSON.parse(
        await readFile(new URL('../' + selected.fixture.path, import.meta.url)),
      );
      assert.equal(raw.actions.length, fixture.actions.length);
      for (let i = 0; i < raw.actions.length; i++) {
        const a = raw.actions[i],
          expected = fixture.actions[i];
        assert.equal(a.path, String(i));
        assert.equal(a.type, expected.type);
        assert.equal(a.label, expected.label ?? null);
        assert(
          a.status === 'pass' ||
            (expected.optional === true &&
              expected.selector ===
                '#settings-dialog[open][data-settings-view="categories"] button[data-close="settings-dialog"]' &&
              a.status === 'skipped-not-visible'),
        );
      }
    } else assert(raw.actions.every((a) => a.status === 'pass'));
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
  const activePlan = readinessRowPlan(ctx.plan, row);
  const selected = selection(activePlan);
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
    assert.equal(build.sourceRevision, selected.source.revision);
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
    const journal = await verifyTimingHitchJournal(activePlan, raw, output, url);
    if (!selected.resume && !selected.quality)
      Object.assign(row, await readinessAssessment(activePlan, row, raw, row.command, journal));
    let finalReplayText = null;
    row.browserVersion = raw.environment?.browserVersion;
    if (raw.replay) {
      assert.equal(raw.replay.file, output + '.replay.json');
      assert(raw.replay.bytes <= 16 * MiB);
      assert.deepEqual(await ctx.digest(raw.replay.file), {
        bytes: raw.replay.bytes,
        sha256: raw.replay.sha256,
      });
      if (selected.resume) {
        finalReplayText = await readReadinessJSON(raw.replay.file, true);
        assert.equal(Buffer.byteLength(finalReplayText), raw.replay.bytes);
        assert.equal(sha(finalReplayText), raw.replay.sha256);
      }
    }
    if (selected.resume)
      Object.assign(
        row,
        await readinessAssessment(activePlan, row, raw, row.command, journal, finalReplayText),
      );
    if (selected.quality) {
      const arm = comparisonSchedule(activePlan).find((a) => a.id === row.id);
      const assessed = await assessQualityComparisonArm(
        raw,
        row.command,
        journal,
        arm,
        ctx.admitted,
        activePlan,
      );
      Object.assign(row, assessed, {
        comparisonStatus: assessed.status,
        diagnosticStatus: assessed.status === 'observed-comparison-arm' ? 'passed' : 'failed',
        status:
          assessed.status === 'observed-comparison-arm' &&
          assessed.numericStatus === 'pass-observed-window'
            ? 'passed'
            : 'failed',
        qualityRawReport: { path: output, ...(await ctx.digest(output)) },
        qualityJournal: journal,
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
  if (combinedPlan(ctx.plan) && selected.quality) await collectQualityComparison(ctx);
}
export async function collectQualityComparison(ctx) {
  const observations = [];
  for (const arm of comparisonSchedule(ctx.plan)) {
    const row = ctx.report.rows.find((value) => value.id === arm.id);
    if (
      !row?.qualityRawReport ||
      row.serverCleanupFailure ||
      row.diagnosticStatus !== 'passed' ||
      row.comparisonStatus !== 'observed-comparison-arm'
    )
      continue;
    assert.equal(row.qualityRawReport.path, join(ctx.evidence, arm.id, 'report.json'));
    const raw = await readReadinessJSON(row.qualityRawReport.path);
    assert.deepEqual(await ctx.digest(row.qualityRawReport.path), {
      bytes: row.qualityRawReport.bytes,
      sha256: row.qualityRawReport.sha256,
    });
    observations.push({ arm, raw, command: row.command, journal: row.qualityJournal });
  }
  ctx.report.qualityComparison = {
    ...(await assessQualityComparisonCohort(observations, ctx.admitted, ctx.plan)),
    observedArms: observations.map((r) => r.arm.id),
    requiredArms: comparisonSchedule(ctx.plan).map((r) => r.id),
  };
  return ctx.report.qualityComparison;
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

// Source-bound comparison helpers used only by the explicit combined selector.
// The explicit combined source declaration admits these diagnostic-only arms.
export function qualityComparisonSchedule() {
  return ['full', 'reduced', 'reduced', 'full'].map((tier, index) => ({
    id: `public-effects-p${Math.floor(index / 2) + 1}-${tier}`,
    pair: Math.floor(index / 2) + 1,
    ordinal: index + 1,
    tier,
    source: 'candidate',
    engine: 'webkit',
    timeoutMs: 480000,
    performanceExclusion: true,
  }));
}
export async function assessQualityComparisonArm(
  raw,
  command,
  journal,
  arm,
  admitted,
  plan = null,
) {
  const {
    QUALITY_COMPARISON_SOURCE: source,
    QUALITY_COMPARISON_RECIPES: recipes,
    qualificationQualityAudioBoundary,
  } = await import('./solo-qualification-observation.mjs');
  const density = densityPlan(plan);
  const compact = plan?.sourceCohort === 'readiness-public-effects-candidatec696' || density;
  const expectedSource = density
    ? FONT_DPR_SOURCE.revision
    : compact
      ? SELECTED_FONT_SOURCE.revision
      : source;
  const expectedTree = density
    ? FONT_DPR_SOURCE.tree
    : compact
      ? SELECTED_FONT_SOURCE.tree
      : 'e87e64d0e14584c2a569d06bae8e7c602c5ed105';
  const expectedRecipe = compact
    ? COMPACT_READINESS_FIXTURES[arm?.tier]?.sha256
    : recipes[arm?.tier];
  let failure = null;
  try {
    if (plan) {
      assert.equal(selection(plan).quality, true);
      assert.equal(plan.candidate.revision, expectedSource);
      assert.equal(plan.candidate.tree, expectedTree);
    }
    assert.deepEqual(arm, comparisonSchedule(plan)[arm.ordinal - 1]);
    assert.equal(admitted?.status, 'passed');
    const artifact = admitted.artifacts?.candidate;
    assert.equal(artifact?.sourceRevision, expectedSource);
    assert.equal(artifact.sourceTree, expectedTree);
    assert.match(artifact.manifestSHA256, /^[a-f0-9]{64}$/);
    assert(artifact.archiveIdentity?.bytes > 0);
    assert.match(artifact.archiveIdentity.sha256, /^[a-f0-9]{64}$/);
    assert.equal(command.status, 'closed');
    assert([0, 2].includes(command.exitCode));
    assert(!command.forcedCleanup && !command.cleanupUnconfirmed && !command.violation);
    assert.deepEqual(command.survivors, []);
    assert.deepEqual(command.ambiguous, []);
    assert.equal(raw.format, 'SoloQualificationReportV1');
    assert.equal(raw.kind, 'performance');
    assert.equal(raw.scenarioStatus, 'pass');
    assert(
      ['pass-observed-window', 'fail', 'inconclusive'].includes(raw.performanceGateStatus),
      'Required original numerical verdict',
    );
    assert.equal(raw.scenarioSHA256, expectedRecipe);
    assert.equal(raw.sourceRevision, expectedSource);
    assert.equal(raw.buildIdentity.sourceRevision, expectedSource);
    assert.equal(raw.environment.engine, 'webkit');
    assert.equal(typeof raw.environment.browserVersion, 'string');
    assert(raw.environment.browserVersion.length > 0);
    assert.equal(raw.environment.contextMode, 'persistent');
    assert.equal(raw.environment.cpuThrottle, 1);
    assert.equal(raw.environment.headless, true);
    assert.deepEqual(raw.environment.requestedDisplay, {
      viewport: { width: 400, height: 850 },
      deviceScaleFactor: density ? arm.dpr : 3,
      isMobile: true,
      hasTouch: true,
    });
    const cleanup = raw.environment.contextOwner?.cleanup;
    assert.equal(cleanup?.status, 'closed');
    assert(cleanup.profileRemoved && cleanup.browserClosed);
    assert.equal(raw.workProbe, true);
    assert.equal(raw.cadenceProtocol, 'settled120');
    assert.equal(raw.cacheMode, 'fresh-context');
    assert.equal(raw.baselineRuntime, false);
    assert.equal(raw.audioProof, false);
    assert(!raw.readinessPilot && !raw.journalCost && !raw.cpuProfile && !raw.memory);
    assert.equal(raw.externalCadenceCalibration.status, 'measured-before-play');
    assert.equal(raw.externalCadenceCalibration.samples.length, 120);
    assert(
      raw.externalCadenceCalibration.baselineMs >= 4 &&
        raw.externalCadenceCalibration.baselineMs <= 50,
    );
    assert.equal(journal?.status, 'complete');
    assert.deepEqual(raw.pageErrors, []);
    for (const name of [
      'failure',
      'hitchJournalFailure',
      'replayFailure',
      'contextCleanupFailure',
      'finalReadFailure',
      'failureCleanupFailure',
      'performanceGateStatusBeforeHitchJournal',
    ])
      assert(!raw[name], name);
    if (compact) {
      const fixture = JSON.parse(
        await readFile(new URL('../' + COMPACT_READINESS_FIXTURES[arm.tier].path, import.meta.url)),
      );
      assert.equal(raw.actions.length, fixture.actions.length);
      for (let i = 0; i < raw.actions.length; i++) {
        const actual = raw.actions[i],
          expected = fixture.actions[i];
        assert.equal(actual.path, String(i));
        assert.equal(actual.type, expected.type);
        assert.equal(actual.label, expected.label ?? null);
        assert(
          actual.status === 'pass' ||
            (expected.optional === true &&
              expected.selector ===
                '#settings-dialog[open][data-settings-view="categories"] button[data-close="settings-dialog"]' &&
              actual.status === 'skipped-not-visible'),
        );
      }
    } else assert(raw.actions.every((a) => a.status === 'pass'));
    const settings = raw.actions.filter((a) => a.publicEffects);
    assert.equal(settings.length, 1);
    assert.equal(settings[0].publicEffects.checked, arm.tier === 'reduced');
    assert.equal(settings[0].publicEffects.effects, arm.tier);
    assert(['briefing', 'paused'].includes(settings[0].publicEffects.phase));
    assert.equal(typeof settings[0].publicEffects.systemReduced, 'boolean');
    assert.equal(raw.finalState.state, 'paused');
    assert.deepEqual(raw.finalState.display, raw.environment.initialDisplay);
    const q = raw.qualityComparison;
    assert.equal(q.format, 'SoloPublicEffectsComparisonArmV1');
    assert.equal(q.sourceRevision, expectedSource);
    assert.equal(q.scenarioSHA256, expectedRecipe);
    assert.equal(q.tier, arm.tier);
    if (density) {
      assert.equal(q.densityComparison, 'same-viewport-v1');
      assert.equal(q.deviceScaleFactor, arm.dpr);
      assert.equal(raw.environment.initialDisplay.width, 400);
      assert.equal(raw.environment.initialDisplay.height, 850);
      assert.equal(raw.environment.initialDisplay.devicePixelRatio, arm.dpr);
    } else assert(!q.densityComparison);
    assert.equal(q.documents, 1);
    assert.equal(q.performanceQualification, false);
    const observation = q.observation;
    assert.equal(observation.format, 'SoloSubmittedTierObservationV1');
    assert.equal(observation.status, 'complete');
    assert.equal(observation.invalid, false);
    assert.equal(observation.overflow, false);
    assert(
      Number.isSafeInteger(observation.samples) &&
        observation.samples > 0 &&
        observation.samples <= 5000,
    );
    assert.equal(observation.activeEntries, 1);
    const counts = [0, 0, 0];
    counts[arm.tier === 'full' ? 0 : 1] = observation.samples;
    assert.deepEqual(
      observation.counts,
      counts,
      'Mixed/adapted tiers retain data but invalidate this fixed-tier comparison',
    );
    assert.equal(observation.transitionCount, 1);
    assert.deepEqual(observation.transitions, [
      observation.firstAtMs,
      1,
      arm.tier === 'full' ? 0 : 1,
    ]);
    assert(Number.isFinite(observation.firstAtMs) && Number.isFinite(observation.lastAtMs));
    assert(observation.lastAtMs - observation.firstAtMs >= 29000);
    assert(observation.lastAtMs - observation.firstAtMs <= 240000);
    assert(
      Number.isSafeInteger(observation.firstTick) && Number.isSafeInteger(observation.lastTick),
    );
    assert(observation.lastTick >= observation.firstTick && observation.firstTick >= 0);
    const probe = raw.finalState.probe;
    assert.equal(
      probe.work.totals[probe.phases.indexOf('running') * probe.work.width],
      observation.samples,
    );
    assert.deepEqual(probe.submittedTiers, observation);
    assert.equal(raw.snapshots.length, 2);
    raw.snapshots.forEach(qualificationQualityAudioBoundary);
    if (density)
      for (const snapshot of raw.snapshots) {
        const owner = snapshot.application?.resources?.phaser;
        for (const surface of [owner?.displayed, owner?.detachedBoard]) {
          assert.equal(surface?.canvases, 1);
          assert(Number.isSafeInteger(surface.width) && surface.width > 0);
          assert(Number.isSafeInteger(surface.height) && surface.height > 0);
          assert(
            Number.isSafeInteger(surface.pixels) &&
              surface.pixels === surface.width * surface.height,
          );
        }
        assert.equal(typeof snapshot.application.canvas?.desynchronized, 'boolean');
        assert.equal(typeof snapshot.application.canvas?.willReadFrequently, 'boolean');
      }
    const application = raw.snapshots.at(-1)?.application;
    assert.equal(application?.sourceRevision, expectedSource);
    assert.equal(typeof application.audio?.muted, 'boolean');
    assert(
      Number.isFinite(application.audio?.volume) &&
        application.audio.volume >= 0 &&
        application.audio.volume <= 1,
    );
    assert.equal(application.quality.tier, arm.tier);
    assert.equal(application.interruptions.count, 0);
    assert.equal(raw.replay.scope, 'completed-scenario');
    const native = raw.replay.nativeVerification;
    assert.equal(native.status, 'pass');
    assert.equal(native.engine, 'webkit');
    assert.equal(native.browserVersion, raw.environment.browserVersion);
    assert.equal(native.observation.match, true);
    assert.equal(native.observation.levelId, 'first-return');
    assert(native.observation.features.movingTicks >= 3300);
    assert(native.observation.features.directionChangesWithMovement >= 20);
    assert(native.observation.ticks >= observation.lastTick);
  } catch (error) {
    failure = String(error.message ?? error).slice(0, 2048);
  }
  const numeric = raw?.performanceGateStatus ?? 'unobserved';
  return {
    status: failure ? 'invalid-comparison' : 'observed-comparison-arm',
    failure,
    rawPerformanceGateStatus: numeric,
    numericStatus: numeric,
    observedBaselineMs: raw?.externalCadenceCalibration?.baselineMs ?? null,
    ...(density
      ? {
          rasterObservation: {
            viewport: { width: 400, height: 850 },
            deviceScaleFactor: arm.dpr,
            theoreticalViewportRaster: {
              width: 400 * arm.dpr,
              height: 850 * arm.dpr,
              pixels: 400 * 850 * arm.dpr * arm.dpr,
            },
            theoreticalScope:
              'Viewport arithmetic only; not canvas allocation or physical scanout.',
            canvases: (raw?.snapshots ?? []).slice(0, 2).map((snapshot) => ({
              group: snapshot.group ?? null,
              ...Object.fromEntries(
                ['displayed', 'detachedBoard'].map((key) => {
                  const value = snapshot.application?.resources?.phaser?.[key];
                  return [
                    key,
                    value
                      ? {
                          canvases: value.canvases,
                          width: value.width,
                          height: value.height,
                          pixels: value.pixels,
                        }
                      : null,
                  ];
                }),
              ),
              contextAttributes: snapshot.application?.canvas
                ? {
                    desynchronized: snapshot.application.canvas.desynchronized,
                    willReadFrequently: snapshot.application.canvas.willReadFrequently,
                  }
                : null,
            })),
            graphicsBackend: null,
            graphicsBackendStatus:
              'unobserved; this quality observer does not request GPU capabilities',
          },
        }
      : {}),
    baselineScope:
      'This arm’s unchanged pre-play calibration; never matched or redefined during gameplay.',
    performanceQualification: false,
    physicalQualification: false,
    scope:
      'Muted public preference bundle; zero observed audio operations do not prove native context state or audible output. No causal GPU attribution, overhead-free claim or changed numerical verdict.',
  };
}

export function qualityComparisonArguments(ctx, arm, url, dir) {
  assert.deepEqual(arm, comparisonSchedule(ctx.plan)[arm.ordinal - 1]);
  const density = densityPlan(ctx.plan);
  const compact =
    density ||
    fontCompactPlan(ctx.plan) ||
    ctx.plan?.sourceCohort === 'readiness-public-effects-candidatec696';
  return [
    join(ctx.here, 'qualify-solo-runtime.mjs'),
    url,
    resolve(
      ctx.repository,
      compact
        ? COMPACT_READINESS_FIXTURES[arm.tier].path
        : `docs/performance/fixtures/solo-remote-timing/public-effects-${arm.tier}-first30.qualification.fixture`,
    ),
    join(dir, 'report.json'),
    '--source-revision=' +
      (density
        ? FONT_DPR_SOURCE.revision
        : compact
          ? SELECTED_FONT_SOURCE.revision
          : RESUME_READINESS_SOURCE.revision),
    '--server-fixture-access',
    '--browser=webkit',
    '--cpu=1',
    '--work-probe',
    '--hitch-journal',
    '--cadence=settled120',
    '--context=persistent',
    '--viewport=400x850',
    `--dpr=${density ? arm.dpr : 3}`,
    '--mobile-context',
    `--visual-quality-observation=${arm.tier}`,
    ...(density ? ['--density-comparison=same-viewport-v1'] : []),
  ];
}

export async function assessQualityComparisonCohort(observations, admitted, plan = null) {
  const { qualificationQualityAudioBoundary } = await import(
    './solo-qualification-observation.mjs'
  );
  const schedule = comparisonSchedule(plan),
    density = densityPlan(plan),
    results = [];
  if (!Array.isArray(observations) || observations.length !== schedule.length)
    return { status: 'incomplete-comparison', results, performanceQualification: false };
  let matched = true,
    signature;
  for (let i = 0; i < schedule.length; i++) {
    const item = observations[i];
    try {
      assert.deepEqual(item.arm, schedule[i]);
    } catch {
      matched = false;
    }
    const result = await assessQualityComparisonArm(
      item.raw,
      item.command,
      item.journal,
      schedule[i],
      admitted,
      plan ? readinessRowPlan(plan, schedule[i]) : null,
    );
    const raw = item.raw;
    const current = JSON.stringify([
      raw?.sourceRevision,
      raw?.environment?.engine,
      raw?.environment?.browserVersion,
      raw?.environment?.architecture,
      raw?.environment?.osRelease,
      density
        ? { ...raw?.environment?.requestedDisplay, deviceScaleFactor: null }
        : raw?.environment?.requestedDisplay,
      density
        ? { ...raw?.environment?.initialDisplay, devicePixelRatio: null }
        : raw?.environment?.initialDisplay,
      raw?.environment?.documentCacheControl,
      result.status === 'observed-comparison-arm'
        ? raw.snapshots.map(qualificationQualityAudioBoundary)
        : null,
      raw?.actions?.find((action) => action.publicEffects)?.publicEffects.systemReduced,
    ]);
    if (signature !== undefined && signature !== current) matched = false;
    signature ??= current;
    results.push({ id: schedule[i].id, pair: schedule[i].pair, ...result });
  }
  return {
    status:
      matched && results.every((r) => r.status === 'observed-comparison-arm')
        ? 'complete-diagnostic-comparison'
        : 'invalid-comparison',
    results,
    performanceQualification: false,
    physicalQualification: false,
    scope: density
      ? 'Two same-viewport DPR pairs only. All raw numerical failures remain failures; no significance, GPU causality or physical-device conclusion is inferred.'
      : 'Two counterbalanced pairs only; all raw numerical failures remain failures, and no significance or decoration-causality verdict is inferred.',
  };
}
