import assert from 'node:assert/strict';

export const TARGET = Object.freeze({
  repository: 'mekhovov/revealline',
  source: '37ec4fc6af9ee62747339459d28decc2a5283501',
  tree: '873e9dfdd85350b56b4d6b9cb957073e18dbdd81',
  run: 39356263374,
  attempt: 1,
  artifact: 12236777601,
  outerBytes: 1096242271,
  outerSha256: '60603890fee36244379db56669f73b4c12cd3eae1505beb3a7cf3ceee92f17a7',
  innerBytes: 1077235917,
  innerSha256: '3ed7b527ba57a3fc51006cc3b2d7b4d0558dffe217cb8ff896b765bdd385c2e4',
  manifestBytes: 533939,
  manifestSha256: 'a8679cf79dc70feabb600c908a481cc3878223fe2736bcc87c285a92707e2efe',
});
export const STAGES = Object.freeze([
  'ordinary-password-accepted',
  'en-home',
  'en-current-and-retained',
  'en-browse-back-focus',
  'exact-current-briefing',
  'native-start-pause-resume',
  'native-uk-settings-back-focus',
  'uk-current-and-retained',
  'uk-browse-back-focus',
]);
export const CURRENT_ID = JSON.stringify([
  'journey:whole-spatial-v25',
  'whole-spatial-v25',
  JSON.stringify(['candidate', 'journey-opening', 'prologue']),
  'candidate/journey-opening/prologue/first-return',
  '',
]);
// Exact prior-edition owner/membership: spatial-next-editions EDITION_HISTORY,
// apex-candidates campaign apex-aurora / pack journey-apex, journeyLibrarySource.
export const RETAINED_IDS = Object.freeze(
  ['crossing-complete', 'returning-light', 'home-signal'].map((mission) =>
    JSON.stringify([
      'journey:whole-spatial-v24',
      'whole-spatial-v24',
      JSON.stringify(['candidate', 'journey-apex', 'apex-aurora']),
      'candidate/journey-apex/apex-aurora/' + mission,
      '',
    ]),
  ),
);
export function assertArtifact(metadata, run) {
  assert.equal(metadata.id, TARGET.artifact);
  assert.equal(metadata.expired, false);
  assert.equal(metadata.size_in_bytes, TARGET.outerBytes);
  assert.equal(metadata.digest, 'sha256:' + TARGET.outerSha256);
  assert.equal(metadata.workflow_run.id, TARGET.run);
  assert.equal(metadata.workflow_run.head_sha, TARGET.source);
  assert.equal(metadata.workflow_run.repository_id, 1367404328);
  assert.equal(metadata.workflow_run.head_repository_id, 1367404328);
  assert.equal(run.id, TARGET.run);
  assert.equal(run.run_attempt, TARGET.attempt);
  assert.equal(run.head_sha, TARGET.source);
  assert.equal(run.status, 'completed');
  assert.equal(run.conclusion, 'success');
  assert.equal(run.repository.full_name, TARGET.repository);
}
export function assertOwner(owner) {
  assert.equal(owner.status, 'closed');
  assert.equal(owner.exitCode, 0);
  assert.equal(owner.signal, null);
  assert.equal(owner.violation, null);
  assert.equal(owner.forcedCleanup, false);
  assert(!owner.cleanupUnconfirmed);
  assert.deepEqual(owner.survivors, []);
  assert.deepEqual(owner.ambiguous, []);
}
export function assertBrowserReport(report, owner, tooling) {
  assertOwner(owner);
  assert.equal(report.format, 'RevealLineCompiledMenuBrowserReportV1');
  assert.equal(report.status, 'passed-controls');
  assert.deepEqual(report.target, TARGET);
  assert.equal(report.toolingRevision, tooling);
  assert.equal(report.performanceExcluded, true);
  assert.equal(report.engine, 'chromium');
  assert.equal(report.profile, 'fresh-ephemeral');
  assert.equal(report.browserVersion, '151.0.7922.34');
  assert.deepEqual(report.stages, STAGES);
  assert.deepEqual(report.cleanup, { context: 'closed', browser: 'closed', server: 'closed' });
  assert.equal(report.diagnostics.total, 0);
  assert.equal(report.diagnostics.overflow, false);
  assert.deepEqual(report.diagnostics.events, []);
  assert(!report.failure && !report.cleanupFailure);
  assert.deepEqual(report.binaryBefore, report.binaryAfter);
  assert.match(report.binaryBefore.sha256, /^[a-f0-9]{64}$/);
  assert(report.binaryBefore.bytes > 0);
  assert.deepEqual(
    report.localeEvidence.map((x) => x.locale),
    ['en', 'uk'],
  );
  for (const row of report.localeEvidence) {
    assert.equal(row.currentCount, 91);
    assert.equal(row.currentId, CURRENT_ID);
    assert.deepEqual([...row.retainedIds].sort(), [...RETAINED_IDS].sort());
    assert.equal(row.backFocus, 'shell-play');
  }
  assert.equal(report.settingsBackFocus, 'shell-options');
  assert.equal(report.navigationOverflow, false);
  assert(
    Array.isArray(report.navigationResponses) &&
      report.navigationResponses.length > 0 &&
      report.navigationResponses.length <= 8,
  );
  for (const response of report.navigationResponses) {
    assert.equal(response.path, '/game/content-design/runtime/navigation-whole-spatial-v25.json');
    assert.equal(response.status, 200);
  }
  assert.equal(report.visiblePauseValuesStable, true);
}
export function assertSignedArtifactURL(value) {
  const u = new URL(value);
  assert.equal(u.protocol, 'https:');
  assert(!u.username && !u.password && !u.hash);
  assert(/^[a-z0-9-]+\.blob\.core\.windows\.net$/.test(u.hostname));
  assert(u.searchParams.has('sig') && u.searchParams.has('se'));
  return u;
}
export function assertLoopback(value) {
  const u = new URL(value);
  assert.equal(u.protocol, 'http:');
  assert.equal(u.hostname, '127.0.0.1');
  assert(/^[0-9]+$/.test(u.port));
  assert(!u.username && !u.password && !u.search && !u.hash);
  assert.equal(u.pathname, '/');
  return u;
}
