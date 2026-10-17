// Adapter only. The common runner retains artifact, process, resource and finalization ownership.
import assert from 'node:assert/strict';
import { readFile, writeFile, lstat, realpath, open } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import {
  offlineGameplayAssessment,
  validateOfflineGameplayPlan,
} from './solo-offline-gameplay.mjs';

const BASE = 'b11745223861c3973ad4bf440cc536198b8e0371';
const CANDIDATE = '3adcd53792043ef02459e86168c6b33a66d6ef00';
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

export function validateOfflinePlan(plan) {
  assert.equal(plan.format, 'SoloHostedOfflinePairPlan.v1');
  assert.equal(plan.status, 'pinned-for-execution');
  assert.equal(plan.performanceExclusion, true);
  if (plan.offline.gameplay) {
    validateOfflineGameplayPlan(plan.offline.gameplay);
    assert.equal(plan.setupTimeoutMs, 2400000);
    assert.equal(
      plan.offline.openingRecipe.path,
      'docs/performance/fixtures/solo-remote-offline/original-art-opening.qualification.fixture',
    );
    assert.equal(
      plan.offline.openingRecipe.sha256,
      'f5459da998a91a3e401bf69306d08e7fd2dd3850058d4580dae6f042dce090d8',
    );
    assert.equal(plan.offline.openingRecipe.bytes, 2707);
  }
  assert.equal(plan.baseline.revision, BASE);
  assert.equal(plan.candidate.revision, CANDIDATE);
  assert.deepEqual(
    plan.rows.map(({ id, source, kind, engine, timeoutMs, performanceExclusion }) => ({
      id,
      source,
      kind,
      engine,
      timeoutMs,
      performanceExclusion,
    })),
    [
      {
        id: 'offline-baseline-p1',
        source: 'baseline',
        kind: 'offline-persistence',
        engine: 'chromium',
        timeoutMs: plan.offline.gameplay ? 1200000 : 900000,
        performanceExclusion: true,
      },
      {
        id: 'offline-candidate-p1',
        source: 'candidate',
        kind: 'offline-persistence',
        engine: 'chromium',
        timeoutMs: plan.offline.gameplay ? 1200000 : 900000,
        performanceExclusion: true,
      },
    ],
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

export function assertPairedBaselineArtifact(prior, paired) {
  assert(paired && paired.sourceRole === 'baseline' && paired.sourceRevision === BASE);
  assert.deepEqual(prior.admission.selected, paired, 'Baseline is from another artifact admission');
  assert.equal(prior.artifact.sourceTree, paired.sourceTree);
  assert.deepEqual(prior.artifact.archiveIdentity, paired.archiveIdentity);
  assert.equal(prior.artifact.manifest.sha256, paired.manifestSHA256);
  assert.equal(prior.artifact.payloadRealpath, paired.payloadRealpath);
  assert.deepEqual(prior.securityPolicies.sourceProof, paired.sourceProof);
}

export function offlineExecutionValid(raw, command, source, browserVersion) {
  const before = raw?.workerSnapshots?.find((row) => row.stage === 'ready-before-close');
  return Boolean(
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

export function baselineAllowsCandidate(row, source = BASE) {
  return (
    row?.source === 'baseline' &&
    row?.status === 'completed-diagnostic' &&
    row?.preservation?.status === 'passed' &&
    row?.retirement?.status === 'passed' &&
    offlineExecutionValid(row.rawOffline, row.command, source, row.browserVersion)
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
  const selection = starterSelection(
    await read(join(root, 'offline-cache.json')),
    await read(join(root, 'offline-content.json')),
  );
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
      'Distinct Linux passive offline-persistence diagnostic; authentication access fixture only. No repair/retry/cache or readiness injection. Prior Mac failures unchanged. Restart diagnostic alone gives no gameplay qualification; optional public Opening play/replay is separately labeled. No physical PWA or performance qualification.',
    gameplay: plan.offline.gameplay ?? null,
    openingRecipe: plan.offline.openingRecipe ?? null,
    firstArmReport: null,
    firstArmClosure: null,
    firstArmArgv: null,
    firstArmPlanSHA256: null,
    firstArmInvocation: null,
  };
  if (row.source === 'candidate') {
    const prior = mode.baseline;
    assert(baselineAllowsCandidate(prior));
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
      ? 'public-opening-capture-next-strict-replay-only'
      : row.gameplayAssessment;
  assert.equal(raw.plan.path, bound.ref.path);
  assert.equal(raw.plan.sha256, bound.ref.sha256);
  const observationValid = offlineExecutionValid(
    raw,
    command,
    plan[row.source].revision,
    mode.browserVersion,
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
