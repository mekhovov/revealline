import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { hasExactCurrentCoverage } from './branch-reconciliation-rules.mjs';

const directory = path.resolve(process.argv[2] || 'docs/branch-reconciliation/2026-09-22');
const inventory = JSON.parse(await readFile(path.join(directory, 'inventory.json'), 'utf8'));
const patches = JSON.parse(await readFile(path.join(directory, 'patch-index.json'), 'utf8'));
if (inventory.main !== patches.main) throw new Error('Snapshot main mismatch');
const exec = promisify(execFile);
const git = async (...args) =>
  (
    await exec('git', args, {
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
      maxBuffer: 64 * 1024 * 1024,
    })
  ).stdout;
const mainTree = new Map(
  (await git('ls-tree', '-r', '-z', inventory.main))
    .split('\0')
    .filter(Boolean)
    .map((line) => {
      const tab = line.indexOf('\t'),
        [mode, type, oid] = line.slice(0, tab).split(' ');
      return [line.slice(tab + 1), { mode, type, oid }];
    }),
);
const coverage = [];
for (const tip of [
  ...new Set(
    inventory.refs.filter((ref) => ref.classification === 'unclassified').map((ref) => ref.tip),
  ),
]) {
  const ref = inventory.refs.find((item) => item.tip === tip);
  if (!ref.relationship.mergeBase) continue;
  const fields = (
    await git(
      'diff-tree',
      '-r',
      '--raw',
      '--no-abbrev',
      '--no-renames',
      '-z',
      ref.relationship.mergeBase,
      tip,
    )
  )
    .split('\0')
    .filter(Boolean);
  const changes = [];
  for (let index = 0; index < fields.length; index += 2) {
    const [oldMode, newMode, oldOid, newOid, status] = fields[index].slice(1).split(' ');
    const file = fields[index + 1],
      main = mainTree.get(file);
    const exact = status === 'D' ? !main : main?.oid === newOid && main?.mode === newMode;
    changes.push({
      path: file,
      status,
      oldMode,
      newMode,
      oldOid,
      newOid,
      main: main || null,
      exact,
    });
  }
  const patchRecord = patches.refs.find((item) => item.tip === tip);
  coverage.push({
    tip,
    mergeBase: ref.relationship.mergeBase,
    allChangedPathsExact: changes.length > 0 && changes.every((item) => item.exact),
    allNonMergePatchesMatchMain: patchRecord?.allNonMergePatchesMatchMain || false,
    changes,
  });
}
const proven = coverage.filter(hasExactCurrentCoverage);
for (const ref of inventory.refs) {
  if (ref.classification !== 'unclassified') continue;
  const proof = proven.find((item) => item.tip === ref.tip);
  if (!proof) {
    if (coverage.find((item) => item.tip === ref.tip)?.allNonMergePatchesMatchMain) {
      ref.candidateProof = {
        file: 'patch-index.json',
        kind: 'historical-patch-match-only',
        tip: ref.tip,
      };
      ref.requiredAction =
        'Review present-day retention or explicit successor/reversion intent. Historical patch IDs alone do not prove current coverage.';
    }
    continue;
  }
  ref.classification = 'patch-equivalent-to-main';
  ref.stablePatchGroup =
    patches.refs
      .find((item) => item.tip === ref.tip)
      ?.patches.map((commit) => patches.commits.find((item) => item.commit === commit)?.patchId)
      .filter(Boolean) || [];
  ref.successor = {
    main: inventory.main,
    commits:
      patches.refs
        .find((item) => item.tip === ref.tip)
        ?.patches.flatMap(
          (commit) =>
            patches.commits.find((item) => item.commit === commit)?.equivalentMainCommits || [],
        ) || [],
  };
  ref.proof = {
    kind: 'exact-final-changed-path-blobs-and-modes',
    file: 'coverage.json',
    tip: ref.tip,
    main: inventory.main,
    caveat:
      'Committed changes only. Dirty work remains separate. Patch history coverage is not a fresh runtime regression test.',
  };
  delete ref.requiredAction;
}
inventory.counts.classifications = {};
for (const ref of inventory.refs)
  inventory.counts.classifications[ref.classification] =
    (inventory.counts.classifications[ref.classification] || 0) + 1;
const result = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  main: inventory.main,
  coverage,
};
await writeFile(path.join(directory, 'coverage.json'), `${JSON.stringify(result, null, 2)}\n`);
await writeFile(path.join(directory, 'reconciled.json'), `${JSON.stringify(inventory, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      tipsExamined: coverage.length,
      exactTreeCoverage: coverage.filter((item) => item.allChangedPathsExact).length,
      classifications: inventory.counts.classifications,
    },
    null,
    2,
  ),
);
