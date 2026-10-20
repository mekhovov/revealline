import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  TARGET,
  STAGES,
  CURRENT_ID,
  RETAINED_IDS,
  assertArtifact,
  assertOwner,
  assertBrowserReport,
  assertSignedArtifactURL,
  assertLoopback,
} from './compiled-menu-browser-contract.mjs';
const owner = () => ({
  status: 'closed',
  exitCode: 0,
  signal: null,
  violation: null,
  forcedCleanup: false,
  survivors: [],
  ambiguous: [],
});
const report = () => ({
  format: 'RevealLineCompiledMenuBrowserReportV1',
  status: 'passed-controls',
  target: { ...TARGET },
  toolingRevision: 'a'.repeat(40),
  engine: 'chromium',
  profile: 'fresh-ephemeral',
  browserVersion: '151.0.7922.34',
  performanceExcluded: true,
  stages: [...STAGES],
  cleanup: { context: 'closed', browser: 'closed', server: 'closed' },
  diagnostics: { total: 0, overflow: false, events: [] },
  binaryBefore: { bytes: 10, sha256: 'b'.repeat(64) },
  binaryAfter: { bytes: 10, sha256: 'b'.repeat(64) },
  localeEvidence: ['en', 'uk'].map((locale) => ({
    locale,
    currentCount: 91,
    currentId: CURRENT_ID,
    retainedIds: [...RETAINED_IDS],
    backFocus: 'shell-play',
  })),
  settingsBackFocus: 'shell-options',
  visiblePauseValuesStable: true,
  navigationOverflow: false,
  navigationResponses: [
    { path: '/game/content-design/runtime/navigation-whole-spatial-v25.json', status: 200 },
  ],
});
test('exact historical API artifact and producer bind independently', () => {
  const artifact = {
    id: TARGET.artifact,
    expired: false,
    size_in_bytes: TARGET.outerBytes,
    digest: 'sha256:' + TARGET.outerSha256,
    workflow_run: {
      id: TARGET.run,
      head_sha: TARGET.source,
      repository_id: 1367404328,
      head_repository_id: 1367404328,
    },
  };
  const run = {
    id: TARGET.run,
    run_attempt: 1,
    head_sha: TARGET.source,
    status: 'completed',
    conclusion: 'success',
    repository: { full_name: TARGET.repository },
  };
  assertArtifact(artifact, run);
  for (const field of ['repository_id', 'head_repository_id'])
    assert.throws(() =>
      assertArtifact(
        { ...artifact, workflow_run: { ...artifact.workflow_run, [field]: undefined } },
        run,
      ),
    );
  for (const [field, value] of [
    ['id', 1],
    ['expired', true],
    ['digest', 'sha256:' + '0'.repeat(64)],
    ['size_in_bytes', 0],
  ])
    assert.throws(() => assertArtifact({ ...artifact, [field]: value }, run));
  for (const [field, value] of [
    ['head_sha', '0'.repeat(40)],
    ['run_attempt', 2],
    ['conclusion', 'failure'],
    ['status', 'in_progress'],
  ])
    assert.throws(() => assertArtifact(artifact, { ...run, [field]: value }));
});
test('complete owner excludes timeout, RSS, output, partial and leftover success', () => {
  assertOwner(owner());
  for (const [field, value] of [
    ['status', 'failed'],
    ['exitCode', 1],
    ['signal', 'SIGKILL'],
    ['violation', 'deadline'],
    ['violation', 'rss-cap'],
    ['violation', 'output-cap'],
    ['forcedCleanup', true],
    ['cleanupUnconfirmed', true],
    ['survivors', [1]],
    ['ambiguous', [1]],
  ])
    assert.throws(() => assertOwner({ ...owner(), [field]: value }));
});
test('all native flow/locale/focus/package facts are mandatory', () => {
  assertBrowserReport(report(), owner(), 'a'.repeat(40));
  for (const mutate of [
    (r) => r.stages.pop(),
    (r) => r.stages.reverse(),
    (r) => (r.target.source = '0'.repeat(40)),
    (r) => r.localeEvidence.pop(),
    (r) => (r.localeEvidence[1].backFocus = ''),
    (r) => (r.visiblePauseValuesStable = false),
    (r) => (r.settingsBackFocus = ''),
    (r) => (r.profile = 'persistent'),
    (r) => (r.cleanup.browser = 'pending'),
    (r) => (r.binaryAfter.sha256 = '0'.repeat(64)),
    (r) => (r.diagnostics.total = 1),
    (r) => (r.diagnostics.overflow = true),
    (r) => (r.navigationOverflow = true),
    (r) => delete r.navigationOverflow,
    (r) => (r.navigationOverflow = undefined),
    (r) => (r.navigationResponses = []),
    (r) => (r.navigationResponses[0].status = 404),
  ]) {
    const r = report();
    mutate(r);
    assert.throws(() => assertBrowserReport(r, owner(), 'a'.repeat(40)));
  }
});
test('current and retained identities cannot substitute another mode/edition', () => {
  assert.equal(JSON.parse(CURRENT_ID)[1], 'whole-spatial-v25');
  assert.equal(new Set(RETAINED_IDS).size, 3);
  for (const mutate of [
    (r) => r.localeEvidence[0].currentCount--,
    (r) => r.localeEvidence[1].retainedIds.pop(),
    (r) => (r.localeEvidence[1].retainedIds[0] = CURRENT_ID),
    (r) => (r.localeEvidence[0].currentId = RETAINED_IDS[0]),
  ]) {
    const r = report();
    mutate(r);
    assert.throws(() => assertBrowserReport(r, owner(), 'a'.repeat(40)));
  }
});
test('credential-less signed-blob boundary refuses arbitrary URL/redirect targets', () => {
  assertSignedArtifactURL('https://fixture.blob.core.windows.net/archive?sig=fixture&se=expiry');
  for (const url of [
    'http://fixture.blob.core.windows.net/?sig=x&se=y',
    'https://api.github.com/?sig=x&se=y',
    'https://fixture.blob.core.windows.net.evil.invalid/?sig=x&se=y',
    'https://user:pass@fixture.blob.core.windows.net/?sig=x&se=y',
    'https://fixture.blob.core.windows.net/',
  ])
    assert.throws(() => assertSignedArtifactURL(url));
});
test('ordinary credential document is restricted to generated localhost server', () => {
  assertLoopback('http://127.0.0.1:12345/');
  for (const url of [
    'https://127.0.0.1:12345/',
    'http://localhost:12345/',
    'http://127.0.0.1:12345/game/',
    'http://127.0.0.1:12345/?fixture-access=1',
  ])
    assert.throws(() => assertLoopback(url));
});
test('only the cheap consumer contract enters existing ordinary CLI discovery', async () => {
  const discovery = /(?:^|\/)(?:test-[^/]+|[^/]+\.test)\.mjs$/;
  assert(discovery.test('scripts/test-compiled-menu-browser-consumer.mjs'));
  for (const file of [
    'compiled-menu-browser-contract.mjs',
    'compiled-menu-browser-observer.mjs',
    'run-compiled-menu-browser.mjs',
  ])
    assert(!discovery.test('scripts/' + file));
  const map = JSON.parse(
    await readFile(new URL('../publishing/focused-test-map.json', import.meta.url), 'utf8'),
  );
  const row = map.categories.find((x) => x.id === 'compiled-menu-browser-contract');
  assert.deepEqual(row.commands, [
    {
      id: 'compiled-menu-browser-contract',
      command: 'node',
      args: ['--test', 'scripts/test-compiled-menu-browser-consumer.mjs'],
    },
  ]);
});
test('new fixed workflow never replaces protected Pages/main or ordinary source owners', async () => {
  const source = await readFile(
    new URL('../.github/workflows/compiled-menu-browser-37ec.yml', import.meta.url),
    'utf8',
  );
  assert.match(source, /contents: read/);
  assert.match(source, /actions: read/);
  assert.match(source, /head\.repo\.full_name == github\.repository/);
  assert.match(source, /base\.ref == 'main'/);
  assert.doesNotMatch(
    source,
    /pull_request_target|workflow_dispatch|deploy-pages|fixture-access|storageState|addInitScript|continue-on-error/,
  );
  assert.match(
    source,
    /REVEALLINE_PAGES_TEST_PASSWORD: \$\{\{ secrets\.REVEALLINE_PAGES_TEST_PASSWORD \}\}/,
  );
  assert.match(source, /scripts\/run-compiled-menu-browser\.mjs/);
});
