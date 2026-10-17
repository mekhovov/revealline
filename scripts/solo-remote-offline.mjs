// Adapter only. The common runner retains artifact, process, resource and finalization ownership.
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { readFile, writeFile, lstat, realpath, open } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import {
  offlineGameplayAssessment,
  OFFLINE_FAILURE_WITNESS_POLICY,
  NATIVE_OFFLINE_STATE_POLICY,
  nativeOfflineStateApplied,
  validateOfflineGameplayPlan,
} from './solo-offline-gameplay.mjs';

const BASE = 'b11745223861c3973ad4bf440cc536198b8e0371';
const CANDIDATE = '3adcd53792043ef02459e86168c6b33a66d6ef00';
const CURRENT_FORMAT = 'SoloHostedOfflineCurrentPairPlan.v2';
export const INDEPENDENT_OFFLINE_FORMAT = 'SoloHostedOfflineCandidatePlan.v1';
export const INDEPENDENT_OFFLINE_RUNTIME = '32abd322afd8243e4537ce4784e2f78ee45ecbec';
const nativeFormat = (format) => [CURRENT_FORMAT, INDEPENDENT_OFFLINE_FORMAT].includes(format);
const PAIR_SOURCES = Object.freeze({
  [INDEPENDENT_OFFLINE_FORMAT]: Object.freeze({
    baseline: '8b01991942dc764b8aa4726851699ce1985e53ae',
    candidate: 'a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4',
  }),
  'SoloHostedOfflinePairPlan.v1': Object.freeze({ baseline: BASE, candidate: CANDIDATE }),
  [CURRENT_FORMAT]: Object.freeze({
    baseline: '8b01991942dc764b8aa4726851699ce1985e53ae',
    candidate: 'adb1c0c7b7dd1a526a0693917f2012d1dbc08b22',
  }),
});
export function offlinePairSources(format = 'SoloHostedOfflinePairPlan.v1') {
  assert(Object.hasOwn(PAIR_SOURCES, format), 'Unknown offline pair format');
  return PAIR_SOURCES[format];
}
// Historical failed-pair evidence is rationale, never a comparison pass or
// authority over this new job's processes. Every new owner is admitted afresh.
export const INDEPENDENT_OFFLINE_ADMISSION = Object.freeze({
  format: 'SoloIndependentOfflineCandidateAdmissionV1',
  comparison: 'not-attempted',
  priorRun: 39008793888,
  priorTooling: 'a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4',
  priorConclusion: 'failure',
  priorBaselineRevision: '8b01991942dc764b8aa4726851699ce1985e53ae',
  priorCandidateObservation: 'not-run',
  baselineGameplay: 'failed-next-deadline',
  baselineOwner: 'closed-without-forced-cleanup-or-uncertainty',
  baselineReportSHA256: 'bb858c82b76ee6699b5a1f4c49caf1c7c642fe6795447f443a8576e4fbd23fd9',
  baselineCommandSHA256: 'fba4086c34bc205885ce7524130305d3cbd79987388517075c17dbafd3543819',
  baselinePreservationSHA256: 'd06fece88cf2970d0b5090dd89395c5e78d5ec4b0628ff756635a2711d62d2a6',
  performanceQualification: false,
  physicalQualification: false,
});
export function validateIndependentOfflineAdmission(value) {
  assert.deepEqual(value, INDEPENDENT_OFFLINE_ADMISSION);
}
const MiB = 1024 ** 2;
const read = async (path) => JSON.parse(await readFile(path, 'utf8'));
const save = (path, value) =>
  writeFile(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });

export async function readBoundedJSON(path, maximumBytes = 2 * MiB) {
  const info = await lstat(path);
  assert(
    info.isFile() && !info.isSymbolicLink() && info.size <= maximumBytes,
    'Bounded regular JSON required',
  );
  const file = await open(path, 'r');
  try {
    const opened = await file.stat();
    assert.equal(opened.dev, info.dev);
    assert.equal(opened.ino, info.ino);
    const bytes = Buffer.alloc(maximumBytes + 1);
    let used = 0;
    while (used < bytes.length) {
      const result = await file.read(bytes, used, bytes.length - used, null);
      if (!result.bytesRead) break;
      used += result.bytesRead;
    }
    assert(used <= maximumBytes, 'JSON byte cap');
    return JSON.parse(bytes.subarray(0, used).toString('utf8'));
  } finally {
    await file.close();
  }
}

export function offlineSetupSuccessor() {
  return {
    format: 'SoloVerifierClosureSuccessorV1',
    priorRun: 39012635518,
    priorConclusion: 'failure',
    priorNativeObservations: 0,
    priorManifest: {
      path: 'docs/performance/solo-remote-offline-candidate-plan.json',
      bytes: 11859,
      sha256: '071508d3f743b73eab7fcf5e1fe26b33a5a3692f09934da4b2dc09448f4f1605',
    },
    dynamicRoots: [
      'scripts/soundtrack-distribution.mjs',
      'scripts/optional-distribution.mjs',
      'scripts/external-distribution.mjs',
      'scripts/optional-artwork.mjs',
    ],
    smokeTest: 'scripts/test-solo-source-verifier-smoke.mjs',
    runtimeChanged: false,
    scenarioChanged: false,
    gateChanged: false,
    automaticRetries: 0,
    reason:
      'Sparse tooling omitted selected source-verifier validators. Original failed admission and not-run row are retained; complete verifier smoke is required before new artifact admission.',
  };
}
export function validateOfflinePlan(plan) {
  const successor = plan.setupSuccessor !== undefined;
  if (successor) {
    assert.equal(plan.format, INDEPENDENT_OFFLINE_FORMAT);
    assert.deepEqual(plan.setupSuccessor, offlineSetupSuccessor());
    for (const path of plan.setupSuccessor.dynamicRoots)
      assert(
        plan.adapterInputs.some((ref) => ref.path === path),
        'Missing source-verifier dependency',
      );
  }
  assert(Object.hasOwn(PAIR_SOURCES, plan.format), 'Unknown offline pair format');
  const sources = offlinePairSources(plan.format);
  assert.equal(plan.status, 'pinned-for-execution');
  assert.equal(plan.performanceExclusion, true);
  if (nativeFormat(plan.format)) {
    assert(plan.offline.gameplay, 'Current pair requires the unchanged installed Starter recipe');
    assert.equal(plan.baseline.tree, '9373b6a74aea8fa1ef47aa17ace140b4cf714609');
    assert.equal(
      plan.candidate.tree,
      plan.format === CURRENT_FORMAT
        ? 'fc162d7d3a7bc0d8e7212d230b4f2eb0d31ba508'
        : '6b13627e324f695b6ee8d9f2dee2eeeb7217c332',
    );
    assert.equal(plan.baseline.reusableArtifact.format, 'SoloHostedNormalBaselineReuseV2');
    assert.equal(plan.baseline.reusableArtifact.sourceRevision, sources.baseline);
    assert.equal(plan.baseline.reusableArtifact.sourceTree, plan.baseline.tree);
    assert.equal(plan.offline.nativeStatePolicy, NATIVE_OFFLINE_STATE_POLICY);
    assert.equal(plan.playwright, '1.62.1');
    assert.equal(plan.offline.expectedBrowserVersion, '151.0.7922.34');
    const release = plan.diagnosticRelease;
    assert.equal(
      release.format,
      plan.format === CURRENT_FORMAT
        ? 'SoloNativeOfflineStateDiagnosticReleaseV1'
        : 'SoloIndependentOfflineCandidateReleaseV1',
    );
    assert.equal(release.status, 'reviewed-for-cause-analysis');
    assert.equal(release.candidateRevision, sources.candidate);
    assert.equal(release.baselineRevision, sources.baseline);
    assert.equal(release.firstEightAllCorrectnessPassed, false);
    assert.equal(release.successorQualificationReleased, false);
    assert.equal(release.performanceQualificationReleased, false);
    assert.equal(
      release.onceOnlyBefore,
      successor ? 'a7e0219818842f02399317ca6d2a14bdd506da3d' : sources.candidate,
    );
    assert.equal(release.nativeStateEvidence.run, 39001646012);
    assert.equal(
      release.nativeStateEvidence.sourceRevision,
      'cce49c81d82b79aefc24898f32eeebc609e569fb',
      'Historical native probe source is independent of the candidate package',
    );
    assert.equal(release.nativeStateEvidence.browserVersion, plan.offline.expectedBrowserVersion);
    assert.equal(release.nativeStateEvidence.conclusion, 'failure');
    assert.equal(release.nativeStateEvidence.qualificationEligible, false);
    if (plan.format === INDEPENDENT_OFFLINE_FORMAT) {
      validateIndependentOfflineAdmission(release.independentAdmission);
      assert.equal(plan.bindingScope?.runtimeRevision, INDEPENDENT_OFFLINE_RUNTIME);
      assert.equal(plan.offline.failureWitnessPolicy, OFFLINE_FAILURE_WITNESS_POLICY);
    }
  }
  if (plan.offline.gameplay) {
    validateOfflineGameplayPlan(plan.offline.gameplay);
    assert.equal(plan.setupTimeoutMs, 2400000);
    assert.equal(
      plan.offline.openingRecipe.path,
      'docs/performance/fixtures/solo-remote-offline/installed-starter.qualification.fixture',
    );
    assert.equal(
      plan.offline.openingRecipe.sha256,
      '21b2d99269a7a21cc1ac7c6e960f17531c5d2cfd1ec7ac4d4b523520b25e0cb5',
    );
    assert.equal(plan.offline.openingRecipe.bytes, 5811);
  }
  assert.equal(plan.baseline.revision, sources.baseline);
  assert.equal(plan.candidate.revision, sources.candidate);
  assert.deepEqual(
    plan.rows.map(({ id, source, kind, engine, timeoutMs, performanceExclusion }) => ({
      id,
      source,
      kind,
      engine,
      timeoutMs,
      performanceExclusion,
    })),
    (plan.format === INDEPENDENT_OFFLINE_FORMAT ? ['candidate'] : ['baseline', 'candidate']).map(
      (source) => ({
        id: `offline-${source}-p1`,
        source,
        kind: 'offline-persistence',
        engine: 'chromium',
        timeoutMs: plan.offline.gameplay ? 1200000 : 900000,
        performanceExclusion: true,
      }),
    ),
  );
  assert.equal(plan.helperTimeoutMs, plan.offline.gameplay ? 6000000 : 4500000);
  assert.equal(plan.evidenceBytes, 256 * MiB);
  assert.equal(plan.profileEvidenceBytes, 1024 * MiB + 8 * MiB);
  assert.equal(plan.offline.serverPort, 18791);
  assert.equal(plan.offline.observationTimeoutMs, plan.offline.gameplay ? 960000 : 600000);
  assert.equal(plan.offline.downloadTimeoutMs, 300000);
  assert.equal(plan.offline.maximumReportBytes, 2 * MiB);
  assert.equal(plan.offline.profileMaximumBytes, 512 * MiB);
  assert.equal(plan.offline.archiveMaximumBytes, 512 * MiB);
  assert.equal(plan.offline.profileMaximumMembers, 20000);
  assert.equal(plan.offline.preservationTimeoutMs, 180000);
  assert.equal(plan.offline.retirementTimeoutMs, 180000);
  assert.equal(plan.resources.automaticRetries, 0);
  assert.equal(plan.offline.driver.path, 'scripts/observe-solo-offline-persistence.mjs');
  assert.match(plan.offline.driver.sha256, /^[a-f0-9]{64}$/);
}

export function assertPairedBaselineArtifact(
  prior,
  paired,
  format = 'SoloHostedOfflinePairPlan.v1',
) {
  const sources = offlinePairSources(format);
  assert(paired && paired.sourceRole === 'baseline' && paired.sourceRevision === sources.baseline);
  if (format === CURRENT_FORMAT) {
    assert.equal(prior.pairFormat, format);
    assert.equal(prior.nativeOfflineStatePolicy, NATIVE_OFFLINE_STATE_POLICY);
    assert.equal(prior.artifact.sourceRevision, sources.baseline);
  }
  assert.deepEqual(prior.admission.selected, paired, 'Baseline is from another artifact admission');
  assert.equal(prior.artifact.sourceTree, paired.sourceTree);
  assert.deepEqual(prior.artifact.archiveIdentity, paired.archiveIdentity);
  assert.equal(prior.artifact.manifest.sha256, paired.manifestSHA256);
  assert.equal(prior.artifact.payloadRealpath, paired.payloadRealpath);
  assert.deepEqual(prior.securityPolicies.sourceProof, paired.sourceProof);
}

export function offlineExecutionValid(
  raw,
  command,
  source,
  browserVersion,
  pairFormat = 'SoloHostedOfflinePairPlan.v1',
) {
  const before = raw?.workerSnapshots?.find((row) => row.stage === 'ready-before-close');
  return Boolean(
    Object.hasOwn(PAIR_SOURCES, pairFormat) &&
      (!nativeFormat(pairFormat) ||
        (raw?.pairFormat === pairFormat &&
          raw.nativeOfflineStatePolicy === NATIVE_OFFLINE_STATE_POLICY &&
          source === PAIR_SOURCES[pairFormat][raw.sourceRole] &&
          ((raw.offlineNavigation?.publicBootReady !== true &&
            raw.offlineNavigation?.nativeState === undefined) ||
            nativeOfflineStateApplied(
              raw.offlineNavigation?.nativeState,
              raw.offlineNavigation?.selectedGame?.url,
            )))) &&
      (pairFormat !== INDEPENDENT_OFFLINE_FORMAT ||
        (raw?.offlineFailureWitnessPolicy === OFFLINE_FAILURE_WITNESS_POLICY &&
          raw.runtimeRevision === INDEPENDENT_OFFLINE_RUNTIME &&
          isDeepStrictEqual(raw.admission?.independentCandidate, INDEPENDENT_OFFLINE_ADMISSION))) &&
      command?.status === 'closed' &&
      command.exitCode === 0 &&
      command.completedAt &&
      !command.violation &&
      !command.forcedCleanup &&
      !command.cleanupUnconfirmed &&
      command.survivors?.length === 0 &&
      command.ambiguous?.length === 0 &&
      raw?.format === 'SoloHostedOfflinePersistencePairCaseV1' &&
      raw.status === 'completed-diagnostic' &&
      raw.artifact?.sourceRevision === source &&
      raw.browserVersion === browserVersion &&
      raw.qualificationEligible === false &&
      raw.performanceGateStatus === 'excluded-offline-persistence-diagnostic' &&
      raw.observationSettled === true &&
      raw.offlineNavigation?.responseWaitSettled === true &&
      offlineGameplayAssessment(raw) !== 'failed' &&
      before?.identityMatches &&
      before.keysMatch &&
      before.indexMatches &&
      raw.errors?.length === 0 &&
      raw.completedAt &&
      ![
        'deadlineReached',
        'cleanupFailure',
        'cdpCleanupFailure',
        'serverCleanupFailure',
        'launchDrainFailure',
        'observationDrainFailure',
        'gameplayDrainFailure',
        'errorOverflow',
        'requestFailureOverflow',
        'responseOverflow',
        'workerEventOverflow',
      ].some((key) => raw[key]),
  );
}

export function baselineAllowsCandidate(
  row,
  source = BASE,
  pairFormat = 'SoloHostedOfflinePairPlan.v1',
) {
  return (
    row?.source === 'baseline' &&
    row?.status === 'completed-diagnostic' &&
    row?.preservation?.status === 'passed' &&
    row?.retirement?.status === 'passed' &&
    offlineExecutionValid(row.rawOffline, row.command, source, row.browserVersion, pairFormat)
  );
}

export function starterSelection(core, catalogue) {
  const groups = new Map(catalogue.groups.map((g) => [g.id, g]));
  const files = new Map(catalogue.files.map((f) => [f.path, f]));
  const seen = new Set(),
    selected = new Map();
  const visit = (id) => {
    assert(groups.has(id));
    if (seen.has(id)) return;
    seen.add(id);
    const group = groups.get(id);
    for (const dependency of group.requires) visit(dependency);
    for (const path of group.files) {
      const item = files.get(path);
      assert(item);
      selected.set(item.sha256, item);
    }
  };
  visit('base');
  assert.deepEqual([...seen].sort(), ['base', 'shared', 'solo:horizon-starter']);
  return {
    groups: [...seen].sort(),
    coreFiles: core.files.length,
    coreBytes: core.files.reduce((n, f) => n + f.bytes, 0),
    contentFiles: selected.size,
    contentBytes: [...selected.values()].reduce((n, f) => n + f.bytes, 0),
  };
}

// Bind public play to the actual admitted artifact's installed selection. A
// similarly named historical mission is not proof that its route was downloaded.
export function assertStarterGameplaySelection(core, catalogue, navigation, chapter, recipe) {
  const expected = recipe.offlinePreparation;
  assert.equal(expected?.format, 'SoloInstalledStarterRecipeV1');
  assert.deepEqual(recipe.query, { journey: expected.routeId });
  assert.equal(expected.routeId, 'whole-spatial-v25');
  assert.equal(expected.packId, 'journey-opening');
  assert.equal(expected.campaignId, 'prologue');
  assert.equal(expected.groupId, 'solo:horizon-starter');
  assert.deepEqual(expected.missionIds, ['first-return', 'choose-your-share']);
  const selection = starterSelection(core, catalogue);
  const installed = new Set(selection.groups);
  const destinations = catalogue.destinations.filter(
    (item) =>
      item.path === 'game/' &&
      item.mode === 'solo' &&
      item.routeId === expected.routeId &&
      !item.libraryId,
  );
  assert.equal(destinations.length, 1, 'Exactly one declared Solo destination');
  for (const group of [...destinations[0].runtimeGroups, ...destinations[0].groups])
    assert(installed.has(group), `Gameplay destination is not installed: ${group}`);
  const selectedPaths = new Set([
    ...core.files.map((item) => item.path),
    ...catalogue.groups.filter((item) => installed.has(item.id)).flatMap((item) => item.files),
  ]);
  for (const item of catalogue.navigationBootstraps.filter(
    (item) => item.path === 'game/index.html' && item.routeId === expected.routeId,
  ))
    for (const path of item.files)
      assert(selectedPaths.has(path), `Gameplay bootstrap is not installed: ${path}`);
  for (const required of expected.requiredFiles) {
    assert(selectedPaths.has(required.path), `Prepared file is not installed: ${required.path}`);
    assert.deepEqual(
      [...core.files, ...catalogue.files].find((item) => item.path === required.path),
      required,
    );
  }
  assert.equal(navigation.id, expected.routeId);
  assert.equal(navigation.navigation.starterPackId, expected.packId);
  const campaign = navigation.navigation.views.solo.campaigns.find(
    (item) => item.id === expected.campaignId && item.packId === expected.packId,
  );
  assert.deepEqual(
    campaign?.levels.slice(0, 2).map((item) => item.id),
    expected.missionIds,
  );
  assert(
    chapter.packs.some(
      (item) => item.id === expected.packId && item.campaignIds.includes(expected.campaignId),
    ),
  );
  assert.deepEqual(
    chapter.campaigns.find((item) => item.id === expected.campaignId)?.missionIds.slice(0, 2),
    expected.missionIds,
  );
  const missions = expected.missionIds.map((id) => {
    const matches = catalogue.missions.filter(
      (item) =>
        item.routeId === expected.routeId && item.missionId === id && item.modes.includes('solo'),
    );
    assert.equal(matches.length, 1, 'Unambiguous prepared mission identity required');
    assert.equal(matches[0].current, true);
    assert.deepEqual(matches[0].groups, [expected.groupId]);
    assert(matches[0].groups.every((group) => installed.has(group)));
    return matches[0].id;
  });
  assert.deepEqual(missions, expected.catalogueMissionIds);
  assert.deepEqual(
    [recipe.expectedReplayDefinition.level.id, recipe.expectedNextReplayDefinition.level.id],
    expected.missionIds,
  );
  return { ...expected, installedGroups: selection.groups, destination: destinations[0] };
}

export async function prepareOfflineMode(ctx) {
  const { plan, here, repository, evidence, admitted, required, digest } = ctx;
  assert(admitted.artifacts.baseline && admitted.artifacts.candidate);
  const ref = async (path) => ({ path, ...(await digest(path)) });
  const executables = {};
  for (const name of ['Xvfb', 'xvfb-run', 'xauth', 'xdpyinfo']) {
    const path = await realpath(`/usr/bin/${name}`),
      info = await lstat(path);
    assert(
      info.isFile() && !info.isSymbolicLink() && info.mode & 0o111,
      `Required display tool: ${name}`,
    );
    executables[name] = await ref(path);
  }
  await required(
    'offline-display-preflight',
    [
      executables['xvfb-run'].path,
      '--auto-servernum',
      '--server-args=-screen 0 1280x800x24',
      executables.xdpyinfo.path,
    ],
    30000,
  );
  await required('offline-browser-version', [ctx.chromeExecutable, '--version'], 10000);
  const versionText = await readFile(join(evidence, 'offline-browser-version.log'), 'utf8');
  assert(Buffer.byteLength(versionText) < 4096);
  const versions = [...new Set(versionText.match(/\b\d+\.\d+\.\d+\.\d+\b/g))];
  assert.equal(versions.length, 1, 'Exactly one actual browser version is required');
  if (nativeFormat(plan.format))
    assert.equal(
      versions[0],
      plan.offline.expectedBrowserVersion,
      'Native correction browser stratum',
    );
  const driver = join(repository, plan.offline.driver.path);
  assert.deepEqual(await digest(driver), {
    bytes: plan.offline.driver.bytes,
    sha256: plan.offline.driver.sha256,
  });
  const wrapper = await ref(join(here, 'run-solo-remote-correctness.mjs'));
  const verified = await ref(join(evidence, 'verified-artifacts.json'));
  const frozenInputs = [];
  for (const path of [
    'scripts/game-cli.mjs',
    'scripts/serve-production-preview.mjs',
    'scripts/optional-installation-observer-helpers.mjs',
    'scripts/solo-qualification-export.mjs',
    'scripts/solo-remote-offline.mjs',
    'scripts/solo-offline-gameplay.mjs',
    ...(plan.offline.gameplay
      ? [
          'scripts/solo-qualification-native-replay.mjs',
          'scripts/solo-qualification-replay-core.mjs',
          plan.offline.openingRecipe.path,
        ]
      : []),
  ]) {
    frozenInputs.push({ path, ...(await digest(join(repository, path))) });
  }
  const mode = {
    executables,
    browserVersion: versions[0],
    browserIdentity: await ref(ctx.chromeExecutable),
    wrapper,
    verified,
    driver,
    frozenInputs,
    artifactReceipt: admitted,
  };
  await save(join(evidence, 'offline-environment.json'), mode);
  return mode;
}

export async function bindOfflineCase(ctx, row, dir, tmp) {
  const { plan, modeState: mode, digest, admitted } = ctx;
  const selected = admitted.artifacts[row.source];
  assert(
    selected &&
      selected.sourceRole === row.source &&
      selected.sourceRevision === plan[row.source].revision,
  );
  const root = selected.payloadRealpath;
  const manifest = await read(join(root, 'manifest.json'));
  assert.equal((await digest(join(root, 'manifest.json'))).sha256, selected.manifestSHA256);
  assert.equal(manifest.sourceRevision, selected.sourceRevision);
  const rows = new Map(manifest.files.map((file) => [file.path, file]));
  assert.equal(rows.size, manifest.files.length);
  const names = [
    '_headers',
    'offline-cache.json',
    'offline-content.json',
    'app/manifest.webmanifest',
    'app/index.html',
    'app/service-worker.js',
    'app/app.mjs',
    'game/index.html',
    'game/build-info.json',
    'game/downloads.mjs',
    'game/installed-app.mjs',
    'game/offline-download-session.mjs',
    'game/locales/en/interface.json',
    'game/content-design/runtime/navigation-whole-spatial-v25.json',
    'game/content-design/runtime/chapter-journey-opening.json',
  ];
  const metadata = [];
  for (const name of names) {
    const file = rows.get(name);
    assert(file);
    assert.deepEqual(await digest(join(root, name)), { bytes: file.bytes, sha256: file.sha256 });
    metadata.push(file);
  }
  const worker = await readFile(join(root, 'app/service-worker.js'), 'utf8');
  const match = worker.match(/const CONFIG = (\{[^\n]+\});/);
  assert(match);
  const config = JSON.parse(match[1]);
  assert(config.files.length <= 64);
  const index = config.files.find((file) => file.path === 'index.html');
  assert(index);
  assert.equal(index.sha256, rows.get('app/index.html').sha256);
  assert.equal(index.bytes, rows.get('app/index.html').bytes);
  const core = await read(join(root, 'offline-cache.json')),
    catalogue = await read(join(root, 'offline-content.json')),
    selection = starterSelection(core, catalogue);
  let preparedGameplay = null;
  if (plan.offline.gameplay) {
    const recipePath = join(ctx.repository, plan.offline.openingRecipe.path);
    assert.deepEqual(await digest(recipePath), {
      bytes: plan.offline.openingRecipe.bytes,
      sha256: plan.offline.openingRecipe.sha256,
    });
    preparedGameplay = assertStarterGameplaySelection(
      core,
      catalogue,
      await read(join(root, 'game/content-design/runtime/navigation-whole-spatial-v25.json')),
      await read(join(root, 'game/content-design/runtime/chapter-journey-opening.json')),
      await read(recipePath),
    );
  }
  const activation = (await read(join(root, 'game/locales/en/interface.json')))[
    'downloads.activationReady'
  ];
  assert.equal(
    activation,
    'This edition will open from the app icon at the next launch. Your saved progress is kept.',
  );
  const ref = async (path) => ({ path, ...(await digest(path)) });
  const casePlan = {
    format: 'SoloHostedOfflinePersistencePairCasePlanV1',
    pairFormat: plan.format,
    interfaceStatus: 'peer-reviewed-bound',
    status: 'pinned-for-execution',
    engine: 'chromium',
    sourceRole: row.source,
    driverSha256: plan.offline.driver.sha256,
    artifact: {
      sourceRevision: selected.sourceRevision,
      sourceTree: selected.sourceTree,
      archiveSha256: selected.archiveIdentity.sha256,
      archiveIdentity: selected.archiveIdentity,
      buildInfoSha256: rows.get('game/build-info.json').sha256,
      entryHTMLSha256: rows.get('game/index.html').sha256,
      payloadRoot: root,
      payloadRealpath: root,
      metadata,
      manifest: { path: join(root, 'manifest.json'), sha256: selected.manifestSHA256 },
    },
    storage: { scratch: tmp, outputRoot: dir },
    selection,
    preparedGameplay,
    launcherBuildId: config.id,
    activationReadyPattern: '^' + activation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$',
    serverPort: plan.offline.serverPort,
    expectedBrowserVersion: mode.browserVersion,
    chromeExecutable: ctx.chromeExecutable,
    playwrightModule: ctx.browserModule,
    frozenInputs: mode.frozenInputs,
    securityPolicyAuthority: { sourceProof: selected.sourceProof },
    commonOwner: {
      wrapper: mode.wrapper,
      verifiedArtifacts: mode.verified,
      offlineDriverPath: mode.driver,
      scratchAuthority: row.scratchAuthority,
      verifiedArtifactsFormat: 'SoloHostedVerifiedArtifactsV1',
      selectedArtifactRecord: selected,
    },
    limits: {
      observationTimeoutMs: plan.offline.observationTimeoutMs,
      downloadTimeoutMs: 300000,
      maximumReportBytes: 2 * MiB,
      minimumInitialScratchFreeBytes: 768 * MiB,
      minimumRemainingScratchFreeBytes: 256 * MiB,
    },
    platform: {
      os: 'linux',
      browser: 'chromium',
      display: 'headed-Xvfb',
      sourceRole: row.source,
      browserIdentity: mode.browserIdentity,
      sameActualBrowserVersionRequired: true,
    },
    scope:
      'Distinct Linux passive offline-persistence diagnostic; authentication access fixture only. No repair/retry/cache or readiness injection. Prior Mac failures unchanged. Restart diagnostic alone gives no gameplay qualification; optional installed Starter play/replay is separately labeled. No physical PWA or performance qualification.',
    gameplay: plan.offline.gameplay ?? null,
    openingRecipe: plan.offline.openingRecipe ?? null,
    ...(plan.format === INDEPENDENT_OFFLINE_FORMAT
      ? {
          independentAdmission: plan.diagnosticRelease.independentAdmission,
          runtimeRevision: plan.bindingScope.runtimeRevision,
          failureWitnessPolicy: plan.offline.failureWitnessPolicy,
        }
      : {}),
    firstArmReport: null,
    firstArmClosure: null,
    firstArmArgv: null,
    firstArmPlanSHA256: null,
    firstArmInvocation: null,
  };
  if (plan.format === INDEPENDENT_OFFLINE_FORMAT) {
    assert.equal(row.source, 'candidate');
    validateIndependentOfflineAdmission(casePlan.independentAdmission);
  } else if (row.source === 'candidate') {
    const prior = mode.baseline;
    assert(baselineAllowsCandidate(prior, plan.baseline.revision, plan.format));
    casePlan.firstArmReport = await ref(prior.rawReport.path);
    casePlan.firstArmClosure = await ref(prior.commandReceipt.path);
    casePlan.firstArmArgv = prior.command.argv;
    casePlan.firstArmPlanSHA256 = prior.casePlan.sha256;
    casePlan.firstArmInvocation = {
      driver: mode.driver,
      plan: prior.casePlan.path,
      output: dirname(prior.rawReport.path),
    };
  }
  const path = join(dir, 'case-plan.json');
  await save(path, casePlan);
  return { plan: casePlan, ref: await ref(path) };
}

export async function runOfflineRow(ctx, row, dir, tmp) {
  const { plan, here, output, run, required, digest, modeState: mode } = ctx;
  const ref = async (path) => ({ path, ...(await digest(path)) });
  const bound = await bindOfflineCase(ctx, row, dir, tmp);
  row.casePlan = bound.ref;
  const observation = join(dir, 'observation');
  const argv = [
    mode.executables['xvfb-run'].path,
    '--auto-servernum',
    '--server-args=-screen 0 1280x800x24',
    process.execPath,
    mode.driver,
    bound.ref.path,
    observation,
  ];
  const command = await run(row.id, argv, row.timeoutMs, {
    env: { ...ctx.cleanEnv, TMPDIR: tmp },
    log: join(dir, 'command.log'),
    receipt: join(dir, 'command.json'),
  });
  row.command = command;
  row.commandReceipt = await ref(join(dir, 'command.json'));
  const raw = await readBoundedJSON(join(observation, 'report.json'), 2 * MiB);
  row.rawReport = await ref(join(observation, 'report.json'));
  row.browserVersion = raw.browserVersion;
  row.diagnosticOutcome = raw.diagnosticOutcome ?? null;
  row.offlineQualification = 'not-qualified-diagnostic-only';
  assert.equal(Boolean(raw.gameplayRequested), Boolean(plan.offline.gameplay));
  row.gameplayAssessment = offlineGameplayAssessment(raw);
  row.offlineGameplayQualification =
    row.gameplayAssessment === 'passed'
      ? 'public-installed-starter-capture-next-strict-replay-only'
      : row.gameplayAssessment;
  assert.equal(raw.plan.path, bound.ref.path);
  assert.equal(raw.plan.sha256, bound.ref.sha256);
  const observationValid = offlineExecutionValid(
    raw,
    command,
    plan[row.source].revision,
    mode.browserVersion,
    plan.format,
  );
  assert.equal(command.status, 'closed', 'Do not preserve or retire an uncertain native owner');
  const profile = raw.profileRetained,
    identity = await lstat(profile);
  assert.equal(dirname(profile), tmp);
  assert(identity.isDirectory() && !identity.isSymbolicLink());
  assert.equal(identity.dev, raw.profileIdentity.dev);
  assert.equal(identity.ino, raw.profileIdentity.ino);
  const destination = join(output, 'profile-evidence', row.id);
  const profilePlan = {
    format: 'SoloHostedClosedProfilePlanV1',
    runRoot: output,
    scratchRoot: tmp,
    profile: { path: profile, device: identity.dev, inode: identity.ino },
    scratchAuthority: row.scratchAuthority,
    command: row.commandReceipt,
    rawReport: row.rawReport,
    casePlan: bound.ref,
    expectedArgv: command.argv,
    destination,
    limits: {
      maximumSourceBytes: 512 * MiB,
      maximumArchiveBytes: 512 * MiB,
      maximumMembers: 20000,
      minimumFreeBytes: 1024 * MiB + 4 * MiB,
    },
  };
  const profilePlanPath = join(dir, 'profile-plan.json');
  await save(profilePlanPath, profilePlan);
  await required(
    `${row.id}-profile-preserve`,
    [
      'python3',
      '-B',
      join(here, 'solo-remote-archive.py'),
      'profile',
      profilePlanPath,
      join(dir, 'profile-preservation.json'),
    ],
    180000,
  );
  row.preservation = await read(join(dir, 'profile-preservation.json'));
  assert.equal(row.preservation.status, 'passed');
  const retirePlan = {
    format: 'SoloHostedClosedProfileRetirementV1',
    profilePlan: await ref(profilePlanPath),
    preservation: await ref(join(dir, 'profile-preservation.json')),
  };
  const retirePath = join(dir, 'profile-retirement-plan.json');
  await save(retirePath, retirePlan);
  await required(
    `${row.id}-profile-retire`,
    [
      'python3',
      '-B',
      join(here, 'solo-remote-archive.py'),
      'profile-retire',
      retirePath,
      join(dir, 'profile-retirement.json'),
    ],
    180000,
  );
  row.retirement = await read(join(dir, 'profile-retirement.json'));
  assert.equal(row.retirement.status, 'passed');
  row.status = observationValid ? 'completed-diagnostic' : 'failed';
  if (row.source === 'baseline') mode.baseline = { ...row, rawOffline: raw };
  assert(
    observationValid,
    'Incomplete offline observation; failed raw evidence and closed profile were preserved',
  );
}
