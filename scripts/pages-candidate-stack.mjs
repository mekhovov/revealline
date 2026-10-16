/** Tiny object-composition foundation, NOT a PR graph or measurement contract.
 * Callers must separately freeze/recheck PR dependencies, exact snapshots,
 * protected paths and external overlays. No merge or qualification is admitted.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { lstatSync } from 'node:fs';
import path from 'node:path';

const sha = (value) => {
  assert.ok(
    typeof value === 'string' && value.length === 40 && /^[a-f0-9]{40}$/.test(value),
    'Invalid exact SHA',
  );
  return value;
};

function date(value) {
  assert.ok(
    typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.exec(value)?.[0] === value,
    'An explicit ISO timestamp is required',
  );
  const wall = new Date(value.slice(0, 19) + 'Z');
  assert.ok(
    Number.isFinite(Date.parse(value)) &&
      Number.isFinite(wall.getTime()) &&
      wall.toISOString().slice(0, 19) === value.slice(0, 19),
    'Invalid ISO timestamp',
  );
  return value;
}

function git(cwd, args, committedAt, attributeSource) {
  // Do not inherit alternate Git directories, indexes, injected config or dates.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
  );
  Object.assign(env, {
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_TERMINAL_PROMPT: '0',
    GIT_OPTIONAL_LOCKS: '0',
    GIT_NO_LAZY_FETCH: '1',
    GIT_NO_REPLACE_OBJECTS: '1',
    GIT_GRAFT_FILE: '/dev/null',
    GIT_ATTR_NOSYSTEM: '1',
    GIT_ALLOW_PROTOCOL: '',
    GIT_PROTOCOL_FROM_USER: '0',
    GIT_AUTHOR_NAME: 'Pages diagnostic',
    GIT_AUTHOR_EMAIL: 'pages-diagnostic@localhost',
    GIT_COMMITTER_NAME: 'Pages diagnostic',
    GIT_COMMITTER_EMAIL: 'pages-diagnostic@localhost',
    GIT_AUTHOR_DATE: committedAt,
    GIT_COMMITTER_DATE: committedAt,
  });
  if (attributeSource !== undefined) env.GIT_ATTR_SOURCE = sha(attributeSource);
  const result = spawnSync(
    'git',
    [
      '-c',
      'core.hooksPath=/dev/null',
      '-c',
      'commit.gpgSign=false',
      '-c',
      'core.fsmonitor=false',
      '-c',
      'gc.auto=0',
      '-c',
      'protocol.allow=never',
      '-c',
      'merge.renormalize=false',
      '-c',
      'core.attributesFile=/dev/null',
      '-c',
      'core.bigFileThreshold=512m',
      '-c',
      'i18n.commitEncoding=UTF-8',
      // The explicit option also fails closed on Git versions lacking this feature.
      ...(attributeSource === undefined ? [] : [`--attr-source=${attributeSource}`]),
      ...args,
    ],
    { cwd, env, encoding: 'utf8', maxBuffer: 1024 * 1024, timeout: 30000 },
  );
  assert.equal(result.status, 0, `Git object operation failed: ${args[0]}`);
  return result.stdout.trim();
}

function rejectLocalObjectOverrides(cwd, committedAt) {
  // info/attributes has higher precedence even with an object attribute source.
  // Resolve both private and common directories, including linked worktrees.
  const directories = [
    git(cwd, ['rev-parse', '--absolute-git-dir'], committedAt),
    git(cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir'], committedAt),
  ];
  const files = new Set([
    git(cwd, ['rev-parse', '--path-format=absolute', '--git-path', 'info/attributes'], committedAt),
    ...directories.flatMap((directory) =>
      ['attributes', 'grafts'].map((name) => path.join(directory, 'info', name)),
    ),
  ]);
  for (const file of files) {
    assert.ok(path.isAbsolute(file), 'Repository override path must be absolute');
    try {
      lstatSync(file);
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    assert.fail('Repository info attributes or grafts are unsupported');
  }
}

/** Compose only existing commit objects. Never fetch, checkout, update a ref or
 * touch the index/worktree. New trees/commits are unreferenced diagnostic objects.
 */
export function composeStackObjects(input, cwd, committedAt) {
  assert.ok(input && typeof input === 'object' && !Array.isArray(input), 'Invalid stack input');
  assert.deepEqual(Object.keys(input).sort(), ['headShas', 'mainSha']);
  const mainSha = sha(input.mainSha);
  assert.ok(
    Array.isArray(input.headShas) && input.headShas.length >= 2 && input.headShas.length <= 3,
    'Only two or three ordered heads are supported',
  );
  const headShas = input.headShas.map(sha);
  assert.equal(new Set([mainSha, ...headShas]).size, headShas.length + 1, 'Duplicate stack SHA');
  assert.ok(typeof cwd === 'string' && cwd.length > 0, 'Missing object repository');
  date(committedAt);
  assert.ok(
    !git(cwd, ['config', '--null', '--list'], committedAt)
      .split('\0')
      .some(
        (entry) =>
          (/^merge\./.test(entry) && entry !== 'merge.renormalize\nfalse') ||
          /^diff\.(?:renames|renamelimit)\n/.test(entry),
      ),
    'Ambient merge configuration is unsupported by object-only composition',
  );
  rejectLocalObjectOverrides(cwd, committedAt);
  for (const revision of [mainSha, ...headShas])
    assert.equal(git(cwd, ['cat-file', '-t', revision], committedAt), 'commit', 'Missing commit');
  for (let index = 1; index < headShas.length; index++)
    git(cwd, ['merge-base', '--is-ancestor', headShas[index - 1], headShas[index]], committedAt);

  const steps = [];
  let current = mainSha;
  for (const headSha of headShas) {
    rejectLocalObjectOverrides(cwd, committedAt);
    // Preserve object-authored rules, including rules added by the previous step;
    // never consult dirty working-tree or index attributes for this merge.
    const tree = sha(
      git(cwd, ['merge-tree', '--write-tree', current, headSha], committedAt, current),
    );
    const commit = sha(
      git(
        cwd,
        [
          'commit-tree',
          tree,
          '-p',
          current,
          '-p',
          headSha,
          '-m',
          'Read-only Pages stack measurement',
        ],
        committedAt,
      ),
    );
    steps.push({ headSha, tree, commit });
    current = commit;
  }
  return {
    format: 'revealline-pages-stack-object-composition.v1',
    mainSha,
    headShas,
    steps,
    tree: steps.at(-1).tree,
    commit: current,
    mergeAuthorized: false,
    qualificationPerformed: false,
    productionDeploymentPerformed: false,
  };
}
