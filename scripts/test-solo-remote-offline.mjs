import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtemp, writeFile, symlink, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import {
  assertPairedBaselineArtifact,
  baselineAllowsCandidate,
  offlineExecutionValid,
  offlinePairSources,
  readBoundedJSON,
  starterSelection,
  validateOfflinePlan,
} from './solo-remote-offline.mjs';
import { OFFLINE_GAMEPLAY, NATIVE_OFFLINE_STATE_POLICY } from './solo-offline-gameplay.mjs';

const BASE = 'b11745223861c3973ad4bf440cc536198b8e0371';
const CANDIDATE = '3adcd53792043ef02459e86168c6b33a66d6ef00';
const MiB = 1024 ** 2;
const archive = fileURLToPath(new URL('./solo-remote-archive.py', import.meta.url));
const plan = () => ({
  format: 'SoloHostedOfflinePairPlan.v1',
  status: 'pinned-for-execution',
  performanceExclusion: true,
  baseline: { revision: BASE },
  candidate: { revision: CANDIDATE },
  helperTimeoutMs: 4500000,
  evidenceBytes: 256 * MiB,
  profileEvidenceBytes: 1024 * MiB + 8 * MiB,
  resources: { automaticRetries: 0 },
  rows: ['baseline', 'candidate'].map((source) => ({
    id: `offline-${source}-p1`,
    source,
    kind: 'offline-persistence',
    engine: 'chromium',
    timeoutMs: 900000,
    performanceExclusion: true,
  })),
  offline: {
    serverPort: 18791,
    observationTimeoutMs: 600000,
    downloadTimeoutMs: 300000,
    maximumReportBytes: 2 * MiB,
    profileMaximumBytes: 512 * MiB,
    archiveMaximumBytes: 512 * MiB,
    profileMaximumMembers: 20000,
    preservationTimeoutMs: 180000,
    retirementTimeoutMs: 180000,
    driver: { path: 'scripts/observe-solo-offline-persistence.mjs', sha256: 'a'.repeat(64) },
  },
});
const command = () => ({
  status: 'closed',
  exitCode: 0,
  completedAt: 'closed',
  violation: null,
  forcedCleanup: false,
  cleanupUnconfirmed: false,
  survivors: [],
  ambiguous: [],
});
const raw = () => ({
  format: 'SoloHostedOfflinePersistencePairCaseV1',
  status: 'completed-diagnostic',
  artifact: { sourceRevision: BASE },
  browserVersion: '155.0.1.2',
  qualificationEligible: false,
  performanceGateStatus: 'excluded-offline-persistence-diagnostic',
  observationSettled: true,
  offlineNavigation: { responseWaitSettled: true, publicBootReady: false },
  workerSnapshots: [
    { stage: 'ready-before-close', identityMatches: true, keysMatch: true, indexMatches: true },
  ],
  errors: [],
  completedAt: 'observed',
  diagnosticOutcome: 'observed-offline-launch-or-cache-failure',
});

test('offline admission permits only the fixed ordered pair and existing bounds', () => {
  validateOfflinePlan(plan());
  for (const mutate of [
    (p) => p.rows.reverse(),
    (p) => p.rows.push(p.rows[0]),
    (p) => {
      p.candidate.revision = BASE;
    },
    (p) => {
      p.rows[0].timeoutMs++;
    },
    (p) => {
      p.offline.observationTimeoutMs++;
    },
    (p) => {
      p.resources.automaticRetries = 1;
    },
    (p) => {
      p.rows[0].engine = 'webkit';
    },
    (p) => {
      p.offline.profileMaximumBytes++;
    },
  ]) {
    const value = plan();
    mutate(value);
    assert.throws(() => validateOfflinePlan(value));
  }
});

test('a real negative restart outcome is retained as a diagnostic, never converted to offline success', () => {
  const observation = raw();
  assert.equal(offlineExecutionValid(observation, command(), BASE, '155.0.1.2'), true);
  assert.equal(observation.offlineNavigation.publicBootReady, false);
  assert.equal(observation.qualificationEligible, false);
  assert.equal(observation.diagnosticOutcome, 'observed-offline-launch-or-cache-failure');
  const row = {
    source: 'baseline',
    status: 'completed-diagnostic',
    browserVersion: '155.0.1.2',
    rawOffline: observation,
    command: command(),
    preservation: { status: 'passed' },
    retirement: { status: 'passed' },
  };
  assert.equal(baselineAllowsCandidate(row), true);
  assert.equal(baselineAllowsCandidate({ ...row, preservation: { status: 'failed' } }), false);
  assert.equal(baselineAllowsCandidate({ ...row, retirement: null }), false);
});

test('missing cache premise, changed browser/source, stale response or failed ownership blocks the next arm', () => {
  const observation = raw();
  for (const mutate of [
    (r) => {
      r.workerSnapshots[0].indexMatches = false;
    },
    (r) => {
      r.offlineNavigation.responseWaitSettled = false;
    },
    (r) => {
      r.deadlineReached = true;
    },
    (r) => {
      r.workerEventOverflow = true;
    },
    (r) => {
      r.errors.push('caught');
    },
    (r) => {
      r.browserVersion = 'different';
    },
    (r) => {
      r.artifact.sourceRevision = CANDIDATE;
    },
    (r) => {
      r.observationSettled = false;
    },
  ]) {
    const value = structuredClone(observation);
    mutate(value);
    assert.equal(offlineExecutionValid(value, command(), BASE, '155.0.1.2'), false);
  }
  for (const change of [
    { exitCode: 1 },
    { forcedCleanup: true },
    { cleanupUnconfirmed: true },
    { survivors: [{ pid: 1 }] },
    { ambiguous: [{ pid: 2 }] },
    { violation: 'deadline' },
  ]) {
    assert.equal(
      offlineExecutionValid(observation, { ...command(), ...change }, BASE, '155.0.1.2'),
      false,
    );
  }
});

test('the paired b117 report must describe this job exact source/tree/archive/payload/proof', () => {
  const paired = {
    sourceRole: 'baseline',
    sourceRevision: BASE,
    sourceTree: 'tree',
    archiveIdentity: { bytes: 20, sha256: 'archive' },
    payloadRealpath: '/owned/baseline',
    manifestSHA256: 'manifest',
    sourceProof: { path: '/owned/source.json', bytes: 9, sha256: 'proof' },
  };
  const report = {
    admission: { selected: structuredClone(paired) },
    artifact: {
      sourceTree: paired.sourceTree,
      archiveIdentity: paired.archiveIdentity,
      manifest: { sha256: paired.manifestSHA256 },
      payloadRealpath: paired.payloadRealpath,
    },
    securityPolicies: { sourceProof: paired.sourceProof },
  };
  assertPairedBaselineArtifact(report, paired);
  for (const change of [
    { sourceTree: 'other-tree' },
    { archiveIdentity: { bytes: 20, sha256: 'other' } },
    { payloadRealpath: '/other' },
    { manifestSHA256: 'other' },
    { sourceProof: { path: '/other', bytes: 9, sha256: 'proof' } },
  ]) {
    assert.throws(() => assertPairedBaselineArtifact(report, { ...paired, ...change }));
  }
});

test('Starter selection follows real dependency closure and content-hash deduplication', () => {
  const catalogue = {
    groups: [
      { id: 'base', requires: ['shared', 'solo:horizon-starter'], files: ['a'] },
      { id: 'shared', requires: [], files: ['b'] },
      { id: 'solo:horizon-starter', requires: ['shared'], files: ['same-a'] },
    ],
    files: [
      { path: 'a', bytes: 4, sha256: 'a' },
      { path: 'same-a', bytes: 4, sha256: 'a' },
      { path: 'b', bytes: 9, sha256: 'b' },
    ],
  };
  assert.deepEqual(starterSelection({ files: [{ bytes: 3 }] }, catalogue), {
    groups: ['base', 'shared', 'solo:horizon-starter'],
    coreFiles: 1,
    coreBytes: 3,
    contentFiles: 2,
    contentBytes: 13,
  });
  const wrong = structuredClone(catalogue);
  wrong.groups[0].requires.push('undeclared');
  assert.throws(() => starterSelection({ files: [] }, wrong));
});

test('current raw report admission rejects oversized and aliased inputs before parsing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'offline-report-test-'));
  try {
    const valid = join(root, 'valid.json'),
      large = join(root, 'large.json'),
      link = join(root, 'alias.json');
    await writeFile(valid, '{"observed":true}');
    await writeFile(large, ' '.repeat(33));
    await symlink(valid, link);
    assert.deepEqual(await readBoundedJSON(valid, 32), { observed: true });
    await assert.rejects(readBoundedJSON(large, 32), /Bounded regular JSON/);
    await assert.rejects(readBoundedJSON(link, 32), /Bounded regular JSON/);
  } finally {
    await rm(root, { recursive: true });
  }
});

const py = (source) =>
  execFileSync('python3', ['-B', '-c', source, archive], {
    stdio: 'pipe',
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });
const imports = `import os,sys,runpy,tempfile,pathlib,tarfile,io,copy,json,hashlib\na=runpy.run_path(sys.argv[1])\n`;
test('profile inventory preserves link text without following it and rejects hard links, special files and caps', () => {
  py(
    imports +
      `
with tempfile.TemporaryDirectory() as d:
 r=pathlib.Path(d).resolve(); p=r/'profile';p.mkdir();(r/'outside').write_bytes(b'do not read');(p/'link').symlink_to(r/'outside');(p/'data').write_bytes(b'abc')
 lim={'maximumMembers':10,'maximumSourceBytes':10}
 inv=a['profile_inventory'](p,lim)
 assert inv['sourceBytes']==3 and next(x for x in inv['files'] if x['path']=='link')['kind']=='symlink'
 for limits in [{'maximumMembers':1,'maximumSourceBytes':10},{'maximumMembers':10,'maximumSourceBytes':2}]:
  try:a['profile_inventory'](p,limits);raise RuntimeError('cap falsely accepted')
  except AssertionError:pass
 os.link(p/'data',p/'hard')
 try:a['profile_inventory'](p,lim);raise RuntimeError('hard link accepted')
 except AssertionError:pass
 (p/'hard').unlink();os.mkfifo(p/'fifo')
 try:a['profile_inventory'](p,lim);raise RuntimeError('special file accepted')
 except AssertionError:pass
`,
  );
});

test('profile archive readback rejects changed bytes, type, mode, traversal, duplicates and missing members', () => {
  py(
    imports +
      `
with tempfile.TemporaryDirectory() as d:
 r=pathlib.Path(d).resolve();data=b'exact';row={'path':'data','kind':'file','mode':0o600,'bytes':5,'sha256':hashlib.sha256(data).hexdigest()}
 inv={'files':[row]};limits={'maximumArchiveBytes':1024*1024,'maximumMembers':10}
 for failure in ['valid','bytes','type','mode','traversal','duplicate','missing']:
  path=r/(failure+'.tar')
  with tarfile.open(path,'w:') as t:
   if failure!='missing':
    info=tarfile.TarInfo('../data' if failure=='traversal' else 'data');info.mode=0o644 if failure=='mode' else 0o600
    if failure=='type':info.type=tarfile.SYMTYPE;info.linkname='other';t.addfile(info)
    else:
     info.size=5;t.addfile(info,io.BytesIO(b'wrong' if failure=='bytes' else data))
     if failure=='duplicate':t.addfile(info,io.BytesIO(data))
  if failure=='valid':a['verify_profile_tar'](path,inv,limits)
  else:
   try:a['verify_profile_tar'](path,inv,limits);raise RuntimeError('bad archive accepted '+failure)
   except AssertionError:pass
`,
  );
});

// Filesystem-only closure fixtures; real process ownership is exercised by the existing Linux owner tests.
test(
  'Linux closed-profile preservation reads every member and retirement rejects later mutation or archive tampering',
  { skip: process.platform !== 'linux' },
  () => {
    py(
      imports +
        `
def put(path,value):path.write_text(json.dumps(value));b=path.read_bytes();return {'path':str(path),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
with tempfile.TemporaryDirectory() as d:
 root=pathlib.Path(d).resolve();os.environ['RUNNER_TEMP']=str(root);run=root/'run';run.mkdir();owned=root/'sc-ABCDEF';scratch=owned/'r00';scratch.mkdir(parents=True)
 for scenario in ['valid','mutated','archive','owner','scratch']:
  profile=scratch/('solo-offline-pair-baseline-'+scenario);profile.mkdir();(profile/'data').write_bytes(b'original');(profile/'data').chmod(0o600);(profile/'link').symlink_to('data')
  out=run/scenario;out.mkdir();ident=profile.stat();casepath=out/'case.json';reportpath=out/'report.json';driver='/declared/driver.mjs';argv=['xvfb-run','node',driver,str(casepath),str(out)]
  ownerinfo=owned.stat();scratchinfo=scratch.stat()
  authority=put(out/'scratch-authority.json',{'format':'SoloHostedRowScratchV1','runRoot':str(run),'rowId':scenario,'storage':{'outputRoot':str(out),'scratchRoot':str(scratch),'device':scratchinfo.st_dev,'inode':scratchinfo.st_ino+(1 if scenario=='scratch' else 0),'scratchOwner':{'path':str(owned),'device':ownerinfo.st_dev,'inode':ownerinfo.st_ino,'maximumRowPathBytes':52}}})
  case=put(casepath,{'commonOwner':{'offlineDriverPath':driver,'scratchAuthority':authority}})
  command=put(out/'command.json',{'status':'closed','exitCode':1,'completedAt':'closed','argv':argv,'forcedCleanup':scenario=='owner','survivors':[],'ambiguous':[]})
  raw=put(reportpath,{'status':'fail','plan':{'path':str(casepath),'sha256':case['sha256']},'observationSettled':True,'profileRetained':str(profile),'profileIdentity':{'dev':ident.st_dev,'ino':ident.st_ino}})
  plan={'format':'SoloHostedClosedProfilePlanV1','runRoot':str(run),'scratchRoot':str(scratch),'profile':{'path':str(profile),'device':ident.st_dev,'inode':ident.st_ino},'scratchAuthority':authority,'command':command,'rawReport':raw,'casePlan':case,'expectedArgv':argv,'destination':str(run/'profile-evidence'/scenario),'limits':{'maximumSourceBytes':512*1024**2,'maximumArchiveBytes':512*1024**2,'maximumMembers':20000,'minimumFreeBytes':1024**3+4*1024**2}}
  if scenario in ['owner','scratch']:
   try:a['preserve_profile'](plan);raise RuntimeError('unclean owner admitted')
   except AssertionError:pass
   assert profile.exists();continue
  preserved=a['preserve_profile'](plan);assert preserved['status']=='passed' and preserved['sourceUnchanged'];assert profile.exists()
  retirement={'format':'SoloHostedClosedProfileRetirementV1','profilePlan':put(out/'profile-plan.json',plan),'preservation':put(out/'preservation.json',preserved)}
  if scenario=='mutated':(profile/'data').write_bytes(b'changed')
  if scenario=='archive':pathlib.Path(preserved['archive']['path']).write_bytes(b'changed archive')
  if scenario=='valid':assert a['retire_profile'](retirement)['removed'] and not profile.exists()
  else:
   try:a['retire_profile'](retirement);raise RuntimeError('mutation retired')
   except AssertionError:pass
   assert profile.exists()
`,
    );
  },
);

const CURRENT_FORMAT = 'SoloHostedOfflineCurrentPairPlan.v2';
const currentPlan = () => {
  // Adapter admission fixture only: no candidate artifact/download identity, so
  // this cannot be an executable declaration for the common artifact owner.
  const value = plan(),
    sources = offlinePairSources(CURRENT_FORMAT);
  Object.assign(value, {
    format: CURRENT_FORMAT,
    playwright: '1.62.1',
    helperTimeoutMs: 6000000,
    setupTimeoutMs: 2400000,
    baseline: {
      revision: sources.baseline,
      tree: '9373b6a74aea8fa1ef47aa17ace140b4cf714609',
      reusableArtifact: {
        format: 'SoloHostedNormalBaselineReuseV2',
        sourceRevision: sources.baseline,
        sourceTree: '9373b6a74aea8fa1ef47aa17ace140b4cf714609',
      },
    },
    candidate: { revision: sources.candidate, tree: '71f7e4cb3b0a39c1d281635774371a693794dd22' },
    diagnosticRelease: {
      format: 'SoloNativeOfflineStateDiagnosticReleaseV1',
      status: 'reviewed-for-cause-analysis',
      candidateRevision: sources.candidate,
      baselineRevision: sources.baseline,
      firstEightAllCorrectnessPassed: false,
      successorQualificationReleased: false,
      performanceQualificationReleased: false,
      onceOnlyBefore: sources.candidate,
      nativeStateEvidence: {
        run: 39001646012,
        sourceRevision: sources.candidate,
        browserVersion: '151.0.7922.34',
        conclusion: 'failure',
        qualificationEligible: false,
      },
    },
  });
  for (const row of value.rows) row.timeoutMs = 1200000;
  Object.assign(value.offline, {
    observationTimeoutMs: 960000,
    gameplay: OFFLINE_GAMEPLAY,
    nativeStatePolicy: NATIVE_OFFLINE_STATE_POLICY,
    expectedBrowserVersion: '151.0.7922.34',
    openingRecipe: {
      path: 'docs/performance/fixtures/solo-remote-offline/installed-starter.qualification.fixture',
      bytes: 5811,
      sha256: '21b2d99269a7a21cc1ac7c6e960f17531c5d2cfd1ec7ac4d4b523520b25e0cb5',
    },
  });
  return value;
};

test('current offline format admits only the exact cce/8b sources and preserves original fixed pair bounds', () => {
  validateOfflinePlan(currentPlan());
  validateOfflinePlan(plan());
  assert.deepEqual(offlinePairSources(), { baseline: BASE, candidate: CANDIDATE });
  assert(Object.isFrozen(offlinePairSources(CURRENT_FORMAT)));
  assert.throws(() => offlinePairSources('unreviewed'));
  for (const mutate of [
    (p) => {
      delete p.format;
    },
    (p) => {
      p.format = 'unreviewed';
    },
    (p) => {
      p.candidate.revision = CANDIDATE;
    },
    (p) => {
      p.baseline.revision = BASE;
    },
    (p) => {
      p.baseline.tree = 'a'.repeat(40);
    },
    (p) => {
      p.candidate.tree = 'b'.repeat(40);
    },
    (p) => {
      p.baseline.reusableArtifact.format = 'SoloHostedNormalBaselineReuseV1';
    },
    (p) => {
      p.baseline.reusableArtifact.sourceRevision = BASE;
    },
    (p) => {
      p.offline.gameplay = null;
    },
    (p) => {
      p.offline.openingRecipe.sha256 = 'c'.repeat(64);
    },
    (p) => {
      p.offline.nativeStatePolicy = 'unreviewed';
    },
    (p) => {
      p.offline.expectedBrowserVersion = '151.0.7922.35';
    },
    (p) => {
      p.playwright = '1.62.2';
    },
    (p) => {
      p.diagnosticRelease.firstEightAllCorrectnessPassed = true;
    },
    (p) => {
      p.diagnosticRelease.successorQualificationReleased = true;
    },
    (p) => {
      p.diagnosticRelease.performanceQualificationReleased = true;
    },
    (p) => {
      p.diagnosticRelease.onceOnlyBefore = CANDIDATE;
    },
    (p) => {
      p.diagnosticRelease.nativeStateEvidence.run++;
    },
    (p) => {
      p.diagnosticRelease.nativeStateEvidence.conclusion = 'success';
    },
    (p) => {
      p.diagnosticRelease.nativeStateEvidence.qualificationEligible = true;
    },
    (p) => {
      p.diagnosticRelease.nativeStateEvidence.sourceRevision = CANDIDATE;
    },
    (p) => {
      p.rows.reverse();
    },
    (p) => {
      p.rows[0].timeoutMs++;
    },
    (p) => {
      p.offline.profileMaximumBytes++;
    },
    (p) => {
      p.offline.downloadTimeoutMs++;
    },
    (p) => {
      p.resources.automaticRetries++;
    },
  ]) {
    const changed = structuredClone(currentPlan());
    mutate(changed);
    assert.throws(() => validateOfflinePlan(changed));
  }
});

test('current candidate admission requires the matching 8b first arm and every archive/source witness', () => {
  const sources = offlinePairSources(CURRENT_FORMAT),
    paired = {
      sourceRole: 'baseline',
      sourceRevision: sources.baseline,
      sourceTree: 'tree',
      archiveIdentity: { bytes: 20, sha256: 'archive' },
      payloadRealpath: '/owned/baseline',
      manifestSHA256: 'manifest',
      sourceProof: { path: '/owned/source.json', bytes: 9, sha256: 'proof' },
    };
  const prior = {
    pairFormat: CURRENT_FORMAT,
    nativeOfflineStatePolicy: NATIVE_OFFLINE_STATE_POLICY,
    admission: { selected: structuredClone(paired) },
    artifact: {
      sourceRevision: paired.sourceRevision,
      sourceTree: paired.sourceTree,
      archiveIdentity: paired.archiveIdentity,
      manifest: { sha256: paired.manifestSHA256 },
      payloadRealpath: paired.payloadRealpath,
    },
    securityPolicies: { sourceProof: paired.sourceProof },
  };
  assertPairedBaselineArtifact(prior, paired, CURRENT_FORMAT);
  assert.throws(
    () => assertPairedBaselineArtifact(prior, paired),
    'Historical default cannot accept current sources',
  );
  for (const mutate of [
    (r) => {
      delete r.pairFormat;
    },
    (r) => {
      r.pairFormat = 'SoloHostedOfflinePairPlan.v1';
    },
    (r) => {
      r.nativeOfflineStatePolicy = 'unreviewed';
    },
    (r) => {
      r.artifact.sourceRevision = BASE;
    },
    (r) => {
      r.admission.selected.sourceRevision = BASE;
    },
    (r) => {
      r.artifact.sourceTree = 'other';
    },
    (r) => {
      r.artifact.archiveIdentity.sha256 = 'other';
    },
    (r) => {
      r.artifact.payloadRealpath = '/other';
    },
    (r) => {
      r.artifact.manifest.sha256 = 'other';
    },
    (r) => {
      r.securityPolicies.sourceProof.sha256 = 'other';
    },
  ]) {
    const changed = structuredClone(prior);
    mutate(changed);
    assert.throws(() => assertPairedBaselineArtifact(changed, paired, CURRENT_FORMAT));
  }
});

test('current negative outcomes remain negative and cannot bypass pair identity or owned closure', () => {
  const sources = offlinePairSources(CURRENT_FORMAT),
    observation = raw();
  Object.assign(observation, {
    pairFormat: CURRENT_FORMAT,
    sourceRole: 'baseline',
    nativeOfflineStatePolicy: NATIVE_OFFLINE_STATE_POLICY,
    artifact: { sourceRevision: sources.baseline },
    gameplayRequested: true,
    gameplay: { status: 'not-run-launch-unqualified' },
    replays: [],
  });
  const row = {
    source: 'baseline',
    status: 'completed-diagnostic',
    browserVersion: observation.browserVersion,
    rawOffline: observation,
    command: command(),
    preservation: { status: 'passed' },
    retirement: { status: 'passed' },
  };
  assert.equal(baselineAllowsCandidate(row, sources.baseline, CURRENT_FORMAT), true);
  assert.equal(observation.offlineNavigation.publicBootReady, false);
  assert.equal(observation.qualificationEligible, false);
  for (const mutate of [
    (r) => {
      delete r.rawOffline.pairFormat;
    },
    (r) => {
      delete r.rawOffline.nativeOfflineStatePolicy;
    },
    (r) => {
      r.rawOffline.sourceRole = 'candidate';
    },
    (r) => {
      r.rawOffline.offlineNavigation.nativeState = { status: 'failed' };
    },
    (r) => {
      r.rawOffline.offlineNavigation.nativeState = {};
    },
    (r) => {
      r.rawOffline.offlineNavigation.publicBootReady = true;
    },
    (r) => {
      r.rawOffline.artifact.sourceRevision = BASE;
    },
    (r) => {
      r.rawOffline.workerSnapshots[0].keysMatch = false;
    },
    (r) => {
      r.command.violation = 'inspection failure';
    },
    (r) => {
      r.command.survivors.push({ pid: 1 });
    },
    (r) => {
      r.preservation.status = 'failed';
    },
    (r) => {
      r.retirement.status = 'failed';
    },
  ]) {
    const changed = structuredClone(row);
    mutate(changed);
    assert.equal(baselineAllowsCandidate(changed, sources.baseline, CURRENT_FORMAT), false);
  }
});
