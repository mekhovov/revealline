import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const directory = path.resolve(process.argv[2] || 'docs/branch-reconciliation/2026-09-22');
const read = async (name) => JSON.parse(await readFile(path.join(directory, name), 'utf8'));
const ledger = await read('reconciled.json');
const patchIndex = await read('patch-index.json');
if (ledger.main !== patchIndex.main) throw new Error('Snapshot main mismatch');
const exec = promisify(execFile);
const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0' };
const git = async (...args) =>
  (await exec('git', args, { env, maxBuffer: 64 * 1024 * 1024 })).stdout;
const proofs = [];
for (const tip of [...new Set(ledger.worktrees.map((worktree) => worktree.head).filter(Boolean))]) {
  const represented = ledger.refs.filter((ref) => ref.tip === tip);
  if (represented.length) {
    proofs.push({
      tip,
      kind: 'recorded-branch-tip',
      refs: represented.map((ref) => ({
        location: ref.location,
        name: ref.name,
        classification: ref.classification,
      })),
    });
    continue;
  }
  try {
    const [ahead, behind] = (
      await git('rev-list', '--left-right', '--count', `${tip}...${ledger.main}`)
    )
      .trim()
      .split(/\s+/)
      .map(Number);
    const uniqueCommits = (await git('rev-list', `${ledger.main}..${tip}`))
      .trim()
      .split('\n')
      .filter(Boolean);
    const proof = {
      tip,
      ahead,
      behind,
      uniqueCommits,
      kind: ahead === 0 ? 'already-merged' : 'unique-committed-worktree-needs-review',
    };
    if (ahead > 0) {
      const source = spawn(
        'git',
        [
          'log',
          '--no-merges',
          '--format=medium',
          '--no-ext-diff',
          '--no-renames',
          '--full-index',
          '-p',
          `${ledger.main}..${tip}`,
        ],
        { env },
      );
      const patches = spawn('git', ['patch-id', '--stable'], { env });
      source.stdout.pipe(patches.stdin);
      let output = '',
        errors = '';
      patches.stdout.on('data', (data) => {
        output += data;
      });
      source.stderr.on('data', (data) => {
        errors += data;
      });
      patches.stderr.on('data', (data) => {
        errors += data;
      });
      await Promise.all(
        [source, patches].map(
          (child) =>
            new Promise((resolve, reject) => {
              child.on('error', reject);
              child.on('close', (code) =>
                code === 0 ? resolve() : reject(new Error(`Git exited ${code}: ${errors}`)),
              );
            }),
        ),
      );
      proof.patches = output
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [patchId, commit] = line.split(' ');
          return {
            commit,
            patchId,
            mainSuccessors: patchIndex.mainIndex
              .filter((item) => item.patchId === patchId)
              .map((item) => item.commit),
          };
        });
      if (
        proof.patches.length === uniqueCommits.length &&
        proof.patches.every((item) => item.mainSuccessors.length)
      )
        proof.kind = 'historical-patch-match-needs-retention-review';
      proof.changedPaths = (
        await git(
          'diff',
          '--name-status',
          '--find-renames',
          (await git('merge-base', ledger.main, tip)).trim(),
          tip,
        )
      )
        .trim()
        .split('\n')
        .filter(Boolean);
    }
    proofs.push(proof);
  } catch (error) {
    proofs.push({ tip, kind: 'unresolved-object-or-comparison-error', error: error.message });
  }
}
ledger.worktreeCommitAccounting = ledger.worktrees.map((worktree) => ({
  path: worktree.path,
  tip: worktree.head || null,
  detached: !!worktree.detached,
  proof: proofs.find((item) => item.tip === worktree.head) || { kind: 'missing-worktree-head' },
  dirtyChangesCovered: false,
}));
const result = {
  schemaVersion: 1,
  main: ledger.main,
  generatedAt: new Date().toISOString(),
  scope:
    'All captured worktree HEADs, including clean detached checkouts. Branch representation does not imply that branch is already reconciled. Dirty changes remain separate.',
  proofs,
};
await writeFile(
  path.join(directory, 'worktree-commits.json'),
  `${JSON.stringify(result, null, 2)}\n`,
);
await writeFile(path.join(directory, 'reconciled.json'), `${JSON.stringify(ledger, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      worktrees: ledger.worktreeCommitAccounting.length,
      outsideBranchInventory: proofs.filter((item) => item.kind !== 'recorded-branch-tip'),
      complete: false,
    },
    null,
    2,
  ),
);
