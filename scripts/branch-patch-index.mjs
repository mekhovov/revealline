import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const directory = path.resolve(process.argv[2] || 'docs/branch-reconciliation/2026-09-22');
const inventory = JSON.parse(await readFile(path.join(directory, 'inventory.json'), 'utf8'));
const exec = promisify(execFile);
const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0' };
async function index(revisions) {
  const log = spawn(
    'git',
    [
      'log',
      '--no-merges',
      '--format=medium',
      '--no-ext-diff',
      '--no-renames',
      '--full-index',
      '-p',
      ...revisions,
    ],
    { env },
  );
  const patch = spawn('git', ['patch-id', '--stable'], { env });
  log.stdout.pipe(patch.stdin);
  let output = '',
    errors = '';
  patch.stdout.on('data', (data) => {
    output += data;
  });
  log.stderr.on('data', (data) => {
    errors += data;
  });
  patch.stderr.on('data', (data) => {
    errors += data;
  });
  await Promise.all(
    [log, patch].map(
      (child) =>
        new Promise((resolve, reject) => {
          child.on('error', reject);
          child.on('close', (code) =>
            code === 0 ? resolve() : reject(new Error(`Git exited ${code}: ${errors}`)),
          );
        }),
    ),
  );
  return output
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [patchId, commit] = line.split(' ');
      return { patchId, commit };
    });
}
const mainIndex = await index([inventory.main]);
const mainByPatch = new Map();
for (const item of mainIndex) {
  const commits = mainByPatch.get(item.patchId) || [];
  commits.push(item.commit);
  mainByPatch.set(item.patchId, commits);
}
console.log(`Indexed ${mainIndex.length} main non-merge patches.`);
const tips = [
  ...new Set(
    inventory.refs.filter((ref) => ref.classification === 'unclassified').map((ref) => ref.tip),
  ),
];
const candidateIndex = await index([...tips, '--not', inventory.main]);
const candidateByCommit = new Map(candidateIndex.map((item) => [item.commit, item]));
const uniqueCommits = [
  ...new Set(
    inventory.refs
      .filter((ref) => ref.classification === 'unclassified')
      .flatMap((ref) => ref.relationship.uniqueCommits || [])
      .map((item) => item.sha),
  ),
];
const commits = [];
for (const commit of uniqueCommits) {
  const item = candidateByCommit.get(commit);
  const files = (
    await exec(
      'git',
      ['diff-tree', '--root', '--no-commit-id', '--name-status', '-r', '-M', commit],
      { env, maxBuffer: 16 * 1024 * 1024 },
    )
  ).stdout
    .trim()
    .split('\n')
    .filter(Boolean);
  commits.push({
    commit,
    patchId: item?.patchId || null,
    equivalentMainCommits: item ? mainByPatch.get(item.patchId) || [] : [],
    files,
  });
}
const byCommit = new Map(commits.map((item) => [item.commit, item]));
const refs = inventory.refs
  .filter((ref) => ref.classification === 'unclassified')
  .map((ref) => {
    const patches = (ref.relationship.uniqueCommits || []).map((item) => byCommit.get(item.sha));
    return {
      location: ref.location,
      name: ref.name,
      tip: ref.tip,
      patches: patches.map((item) => item.commit),
      allNonMergePatchesMatchMain:
        patches.length > 0 &&
        patches.every((item) => item.patchId && item.equivalentMainCommits.length),
      unmatched: patches
        .filter((item) => !item.patchId || !item.equivalentMainCommits.length)
        .map((item) => item.commit),
    };
  });
const result = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  main: inventory.main,
  command:
    'git log --no-merges --format=medium --no-ext-diff --no-renames --full-index -p REVISION | git patch-id --stable',
  limitations: [
    'Stable patch IDs ignore whitespace and are evidence of patch equivalence, not current runtime acceptance.',
    'Merge commits and empty patches require separate inspection.',
    'No ref is classified solely by this index; later reversal, binary content, path changes and owner intent need review.',
  ],
  mainIndex,
  commits,
  refs,
};
await writeFile(path.join(directory, 'patch-index.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      candidateCommits: commits.length,
      refs: refs.length,
      fullyMatchedCandidates: refs.filter((ref) => ref.allNonMergePatchesMatchMain).length,
    },
    null,
    2,
  ),
);
