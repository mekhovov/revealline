import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const evidencePath = 'docs/verification/presentation-recovery-20260923/pr256-v0930-coverage.json';
const refs = Object.freeze({
  currentBase: 'a5e6df101130eb920d4cb82f598c4de4a3aaee5a',
  oldPr256Base: '069890158c9f2c766e334564f752716491057727',
  oldPr256Head: '4ecf8b520225c4369cdc482460e0d042f82e3af0',
  pr233Base: 'c3398112e9a739225fdc2e8bf603b45f52a5cbb6',
  pr233Head: '80a47a3b25167d9dcd0bdf98b1bde6a95d112269',
  successorRuntime: 'ba6b7edd14b16d8af513839aadf104a5ceb6c543',
});
const expected = Object.freeze({
  pr256Paths: 154,
  pr233Paths: 139,
  pr256PathListSha256: '57ee6fe602c24260ed5b9adc7f90776b53e9a73b90dc86980ab701adc12ea6c5',
  pr233PathListSha256: '2579b4fc04ffabcb5e9fb6752ad457fc772af0e503db623fa4b8cf2ed2ee21a1',
});
const historicalEvidence = new Set([
  'docs/verification/presentation-recovery-20260922/pr256-native-http.json',
  'docs/verification/presentation-recovery-20260922/pr256-native-qualification.json',
  'docs/verification/presentation-recovery-20260922/pr256-native-server.mjs',
]);
const supersededStatus = 'docs/ux-delivery-status-20260922.md';
const run = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const optional = (...args) => {
  try {
    return run(...args);
  } catch {
    return null;
  }
};
const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const changes = (base, head) =>
  run('diff', '--name-status', '--no-renames', `${base}..${head}`)
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status, path] = line.split('\t');
      return { status, path };
    })
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
const blob = (commit, path) => optional('rev-parse', `${commit}:${path}`);
const pathHash = (rows) => sha256(`${rows.map(({ path }) => path).join('\n')}\n`);

function buildEvidence() {
  assert.equal(run('merge-base', refs.currentBase, refs.successorRuntime), refs.currentBase);
  const pr256 = changes(refs.oldPr256Base, refs.oldPr256Head);
  const pr233 = changes(refs.pr233Base, refs.pr233Head);
  assert.equal(pr256.length, expected.pr256Paths);
  assert.equal(pr233.length, expected.pr233Paths);
  assert.equal(pathHash(pr256), expected.pr256PathListSha256);
  assert.equal(pathHash(pr233), expected.pr233PathListSha256);
  const pr233Paths = new Set(pr233.map(({ path }) => path));
  assert(pr233.every(({ path }) => pr256.some((row) => row.path === path)));
  const rows = pr256.map(({ status, path }) => {
    const oldBaseBlob = blob(refs.oldPr256Base, path);
    const oldHeadBlob = blob(refs.oldPr256Head, path);
    const successorBlob = blob(refs.successorRuntime, path);
    const currentBaseBlob = blob(refs.currentBase, path);
    const pr233FinalBlob = pr233Paths.has(path) ? blob(refs.pr233Head, path) : null;
    let classification;
    let rationale;
    if (path === supersededStatus) {
      classification = 'superseded-status-omitted';
      rationale =
        'Obsolete v0.82/v0.85 queue register is replaced by docs/plan-status-2026-09-23.md.';
      assert.equal(successorBlob, null);
    } else if (historicalEvidence.has(path)) {
      classification = 'historical-evidence-retained';
      rationale =
        'Historical source 3563ef evidence is retained byte-exact and is not successor qualification.';
      assert.equal(successorBlob, oldHeadBlob);
    } else if (successorBlob === oldHeadBlob) {
      classification = 'byte-identical';
      rationale = 'Old PR256 final blob is retained exactly.';
    } else if (successorBlob === currentBaseBlob) {
      classification = 'current-main-preserved';
      rationale = 'Current accepted main supersedes the stale PR256 version of this path.';
    } else {
      classification = 'ported';
      rationale =
        'PR256 behavior is composed with current-main changes and reviewed conflict corrections.';
      assert(successorBlob, `Missing successor blob for ${path}`);
    }
    return {
      path,
      oldStatus: status,
      oldBaseBlob,
      oldHeadBlob,
      successorBlob,
      inPr233: pr233Paths.has(path),
      pr233FinalBlob,
      classification,
      rationale,
      verification: [
        'node --test game/test/visual-sessions.test.mjs',
        'node --test game/test/first-flight-entry.test.mjs',
        'node --test game/test/gameplay-pressure-host.test.mjs',
      ],
    };
  });
  assert.equal(new Set(rows.map(({ path }) => path)).size, expected.pr256Paths);
  assert.equal(rows.filter(({ inPr233 }) => inPr233).length, expected.pr233Paths);
  assert(rows.every(({ classification }) => classification));
  return {
    format: 'revealline-pr-coverage.v1',
    generatedAt: '2026-09-23T10:16:37.000Z',
    refs,
    expected,
    provenance: {
      pr256CombinedPatchId: 'c3865c509444b02846b656382970bc433949c429',
      pr233CombinedPatchId: 'c40e8f8693e23282b2a36eff8332714b4695b390',
      pr233Occurrences: 1,
      note: 'Patch IDs are provenance only; per-path blob and classification rows are the coverage proof.',
    },
    rows,
  };
}

const actual = buildEvidence();
if (process.argv.includes('--write'))
  writeFileSync(evidencePath, `${JSON.stringify(actual, null, 2)}\n`);
else assert.deepEqual(JSON.parse(readFileSync(evidencePath, 'utf8')), actual);
console.log(
  `PR256 coverage verified: ${actual.rows.length} paths; PR233 exact-once subset ${actual.rows.filter(({ inPr233 }) => inPr233).length}.`,
);
