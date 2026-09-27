import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { completionReport, hasExactCurrentCoverage } from './branch-reconciliation-rules.mjs';

function fixture() {
  return {
    refs: [{ tip: 'a', classification: 'already-merged', proof: { kind: 'ancestry' } }],
    worktrees: [{ path: '/fixture', head: 'a', dirty: false }],
    worktreeCommitAccounting: [
      { path: '/fixture', tip: 'a', proof: { kind: 'recorded-branch-tip' } },
    ],
    dirtyWorktreeAccounting: [],
  };
}

test('resolved ledger can complete without an unclassified count property', () => {
  assert.equal(completionReport(fixture()).complete, true);
});
test('historical patch equality cannot substitute for current changed-path retention', () => {
  assert.equal(
    hasExactCurrentCoverage({ allNonMergePatchesMatchMain: true, changes: [{ exact: false }] }),
    false,
  );
  assert.equal(hasExactCurrentCoverage({ allChangedPathsExact: true, changes: [] }), false);
  assert.equal(
    hasExactCurrentCoverage({ allChangedPathsExact: true, changes: [{ exact: false }] }),
    false,
  );
  assert.equal(
    hasExactCurrentCoverage({ allChangedPathsExact: true, changes: [{ exact: true }] }),
    true,
  );
});
test('pending ref kinds and missing proofs never count as complete', () => {
  for (const classification of [
    'unclassified',
    'unique-changes-require-intake',
    'active-awaiting-owner-draft',
    'represented-by-open-pr',
    'superseded-duplicate',
  ]) {
    const ledger = fixture();
    ledger.refs[0].classification = classification;
    assert.equal(completionReport(ledger).complete, false, classification);
  }
  const ledger = fixture();
  delete ledger.refs[0].proof;
  assert.equal(completionReport(ledger).complete, false);
});
test('detached and missing committed worktree accounting blocks completion', () => {
  const ledger = fixture();
  ledger.worktreeCommitAccounting = [];
  assert.equal(completionReport(ledger).complete, false);
  ledger.worktreeCommitAccounting = [
    {
      path: '/fixture',
      tip: 'a',
      proof: { kind: 'historical-patch-match-needs-retention-review' },
    },
  ];
  assert.equal(completionReport(ledger).complete, false);
});
test('dirty, unknown status and explicit hold remain blocking', () => {
  for (const dirty of [true, null]) {
    const ledger = fixture();
    ledger.worktrees[0].dirty = dirty;
    assert.equal(completionReport(ledger).complete, false);
  }
  const ledger = fixture();
  ledger.worktrees[0].statusError = 'unreadable';
  assert.equal(completionReport(ledger).complete, false);
  delete ledger.worktrees[0].statusError;
  ledger.completion = { complete: false };
  assert.equal(completionReport(ledger).complete, false);
});
test('dirty retention requires tip, content digest and actual owner evidence', () => {
  const ledger = fixture();
  ledger.worktrees[0].dirty = true;
  ledger.dirtyWorktreeAccounting = [
    { path: '/fixture', head: 'old', classification: 'owner-approved-retention' },
  ];
  assert.equal(completionReport(ledger).complete, false);
  ledger.dirtyWorktreeAccounting[0].head = 'a';
  assert.equal(completionReport(ledger).complete, false);
  ledger.worktrees[0].dirtySnapshotDigest = 'a'.repeat(64);
  ledger.dirtyWorktreeAccounting[0].dirtySnapshotDigest = 'b'.repeat(64);
  ledger.dirtyWorktreeAccounting[0].ownerEvidence = 'explicit owner retention receipt';
  assert.equal(completionReport(ledger).complete, false);
  ledger.dirtyWorktreeAccounting[0].dirtySnapshotDigest = 'a'.repeat(64);
  assert.equal(completionReport(ledger).complete, true);
});
test('census refuses missing output and existing snapshot before any API operation', () => {
  const script = new URL('./branch-reconciliation.mjs', import.meta.url);
  assert.throws(
    () => execFileSync(process.execPath, [script.pathname], { stdio: 'pipe' }),
    /NEW snapshot directory/,
  );
  const directory = mkdtempSync(path.join(os.tmpdir(), 'reconciliation-immutable-test-'));
  const file = path.join(directory, 'inventory.json');
  writeFileSync(file, 'preserved snapshot\n');
  assert.throws(
    () => execFileSync(process.execPath, [script.pathname, directory], { stdio: 'pipe' }),
    /EEXIST/,
  );
  assert.equal(readFileSync(file, 'utf8'), 'preserved snapshot\n');
});
