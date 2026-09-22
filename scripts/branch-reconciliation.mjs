import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Read-only Git/GitHub census. Writes only its explicitly selected output directory.
const exec = promisify(execFile);
const repository = process.env.RECONCILIATION_REPOSITORY || 'mekhovov/revealline';
const output = path.resolve(process.argv[2] || 'docs/branch-reconciliation/2026-09-22');
const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' };
async function run(command, args, cwd = process.cwd()) {
  return (await exec(command, args, { cwd, env, maxBuffer: 64 * 1024 * 1024 })).stdout;
}
const git = (...args) => run('git', args);
async function api(endpoint) {
  return JSON.parse(await run('gh', ['api', '--paginate', '--slurp', endpoint])).flat();
}
async function mapLimit(values, limit, operation) {
  const result = new Array(values.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, async () => {
      while (next < values.length) {
        const index = next++;
        result[index] = await operation(values[index], index);
      }
    }),
  );
  return result;
}
const startedAt = new Date().toISOString();
const [remoteBranches, pulls, localText, worktreeText, mainResponse] = await Promise.all([
  api(`repos/${repository}/branches?per_page=100`),
  api(`repos/${repository}/pulls?state=all&per_page=100`),
  git('for-each-ref', '--format=%(refname)%09%(objectname)', 'refs/heads'),
  git('worktree', 'list', '--porcelain', '-z'),
  api(`repos/${repository}/git/ref/heads/main`),
]);
const main = mainResponse[0].object.sha;
await git('cat-file', '-e', `${main}^{commit}`);
const worktrees = [];
let current;
for (const field of worktreeText.split('\0')) {
  if (field.startsWith('worktree ')) {
    current = { path: field.slice(9) };
    worktrees.push(current);
  } else if (field.startsWith('HEAD ')) current.head = field.slice(5);
  else if (field.startsWith('branch ')) current.branch = field.slice(7);
  else if (field === 'detached') current.detached = true;
  else if (field.startsWith('locked')) current.locked = field;
  else if (field.startsWith('prunable')) current.prunable = field;
}
await mapLimit(worktrees, 4, async (worktree) => {
  try {
    const status = await run(
      'git',
      ['status', '--porcelain=v1', '-z', '--untracked-files=normal'],
      worktree.path,
    );
    worktree.dirty = status.length > 0;
    worktree.statusEntries = status.split('\0').filter(Boolean);
  } catch (error) {
    worktree.statusError = error.message;
    worktree.dirty = null;
  }
});
const localRefs = localText
  .trim()
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [ref, tip] = line.split('\t');
    return { location: 'local', name: ref.slice(11), tip };
  });
const remoteRefs = remoteBranches.map(({ name, commit }) => ({
  location: 'github',
  name,
  tip: commit.sha,
}));
const refs = [...localRefs, ...remoteRefs];
const tips = [...new Set(refs.map(({ tip }) => tip))];
const analysis = new Map(
  await mapLimit(tips, 4, async (tip) => {
    try {
      await git('cat-file', '-e', `${tip}^{commit}`);
      const [ahead, behind] = (await git('rev-list', '--left-right', '--count', `${tip}...${main}`))
        .trim()
        .split(/\s+/)
        .map(Number);
      const mergeBase = (await git('merge-base', main, tip)).trim();
      const uniqueCommits = ahead
        ? (await git('log', '--format=%H%x09%s', `${main}..${tip}`))
            .trim()
            .split('\n')
            .filter(Boolean)
            .map((line) => {
              const [sha, ...subject] = line.split('\t');
              return { sha, subject: subject.join('\t') };
            })
        : [];
      return [tip, { ahead, behind, mergeBase, uniqueCommits }];
    } catch (error) {
      return [tip, { error: error.message }];
    }
  }),
);
for (const ref of refs) {
  ref.relationship = analysis.get(ref.tip);
  ref.pullRequests = pulls
    .filter((pr) => pr.head.ref === ref.name && pr.head.repo?.full_name === repository)
    .map((pr) => ({
      number: pr.number,
      state: pr.state,
      draft: pr.draft,
      title: pr.title,
      head: pr.head.sha,
      base: pr.base.ref,
      mergedAt: pr.merged_at,
      mergeCommit: pr.merge_commit_sha,
      url: pr.html_url,
    }));
  ref.worktrees = worktrees
    .filter((wt) => wt.branch === `refs/heads/${ref.name}`)
    .map((wt) => wt.path);
  ref.ownerTask = null;
  ref.stablePatchGroup = null;
  ref.successor = null;
  ref.releaseEvidence = [];
  if (ref.relationship.ahead === 0) {
    ref.classification = 'already-merged';
    ref.proof = { kind: 'git-ancestry', main, tip: ref.tip };
  } else if (ref.pullRequests.some((pr) => pr.state === 'open' && pr.head === ref.tip)) {
    ref.classification = 'represented-by-open-pr';
    ref.proof = {
      kind: 'exact-head-open-pr',
      numbers: ref.pullRequests
        .filter((pr) => pr.state === 'open' && pr.head === ref.tip)
        .map((pr) => pr.number),
    };
  } else {
    ref.classification = 'unclassified';
    ref.requiredAction = ref.relationship.error
      ? 'Resolve unavailable Git object before comparison.'
      : 'Inspect unique changes, patch equivalence, successor and owner intent; names alone are not evidence.';
  }
}
const classifications = {};
for (const ref of refs)
  classifications[ref.classification] = (classifications[ref.classification] || 0) + 1;
const result = {
  schemaVersion: 1,
  repository,
  startedAt,
  completedAt: new Date().toISOString(),
  main,
  rules: [
    'No branch or worktree was mutated.',
    'Dirty worktrees are preserved; status is metadata only.',
    'Open PR coverage is exact-head, not merge approval.',
    'Ancestry covers committed changes only, never dirty worktree contents.',
    'Unclassified entries are blockers to full reconciliation completion.',
  ],
  counts: {
    localBranches: localRefs.length,
    githubBranches: remoteRefs.length,
    uniqueTips: tips.length,
    worktrees: worktrees.length,
    dirtyWorktrees: worktrees.filter((wt) => wt.dirty).length,
    classifications,
  },
  refs,
  worktrees,
};
await mkdir(output, { recursive: true });
await writeFile(path.join(output, 'inventory.json'), `${JSON.stringify(result, null, 2)}\n`);
await writeFile(
  path.join(output, 'README.md'),
  `# Branch reconciliation snapshot\n\nCaptured ${result.completedAt} against main \`${main}\`.\n\nThis is an inventory, not a claim that reconciliation or production acceptance is complete.\n\n${Object.entries(
    result.counts,
  )
    .map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`)
    .join(
      '\n',
    )}\n\nSee inventory.json for every ref, PR mapping, comparison and worktree status. Unclassified refs and dirty worktree contents require owner-coordinated review. Historical names are never sufficient proof to exclude unique changes.\n`,
);
console.log(JSON.stringify({ output, main, counts: result.counts }, null, 2));
