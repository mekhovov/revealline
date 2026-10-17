import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { composeStackObjects } from './pages-candidate-stack.mjs';

const committedAt = '2026-10-16T03:00:00+00:00';
const git = (cwd, ...args) => {
  const result = spawnSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_AUTHOR_NAME: 'Tiny fixture',
      GIT_AUTHOR_EMAIL: 'fixture@localhost',
      GIT_COMMITTER_NAME: 'Tiny fixture',
      GIT_COMMITTER_EMAIL: 'fixture@localhost',
      GIT_AUTHOR_DATE: committedAt,
      GIT_COMMITTER_DATE: committedAt,
    },
    maxBuffer: 1024 * 1024,
    timeout: 30000,
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
};

async function fixture({ trackedAttributes, parentAttributes } = {}) {
  // Only tiny synthetic files/objects; no source repository/build is copied.
  const directory = await fs.mkdtemp(
    path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'pages-stack-'),
  );
  const source = path.join(directory, 'source');
  const clone = path.join(directory, 'clone');
  await fs.mkdir(source);
  git(source, 'init', '-b', 'main');
  if (trackedAttributes) {
    await fs.writeFile(path.join(source, '.gitattributes'), trackedAttributes);
    git(source, 'add', '.gitattributes');
  }
  const commit = async (name, contents) => {
    await fs.writeFile(path.join(source, name), contents);
    git(source, 'add', name);
    git(source, 'commit', '-m', name);
    return git(source, 'rev-parse', 'HEAD');
  };
  const base = await commit('shared.txt', 'base\n');
  git(source, 'checkout', '-b', 'parent');
  if (parentAttributes) {
    await fs.writeFile(path.join(source, '.gitattributes'), parentAttributes);
    git(source, 'add', '.gitattributes');
  }
  const parent = await commit('parent.txt', 'parent\n');
  git(source, 'checkout', '-b', 'child');
  const child = await commit('child.txt', 'child\n');
  const grandchild = await commit('grandchild.txt', 'grandchild\n');
  git(source, 'checkout', 'main');
  const main = await commit('advanced-main.txt', 'advanced main\n');
  git(source, 'checkout', '-b', 'conflict-parent', base);
  const conflictParent = await commit('shared.txt', 'parent conflict\n');
  git(source, 'checkout', '-b', 'conflict-child');
  const conflictChild = await commit('extra.txt', 'child conflict\n');
  git(source, 'checkout', '-b', 'late-conflict-child', parent);
  const lateConflictChild = await commit('shared.txt', 'late child conflict\n');
  git(source, 'checkout', 'main');
  const conflictMain = await commit('shared.txt', 'main conflict\n');
  git(source, 'clone', '--no-local', source, clone);
  // Dirty tracked and untracked content must survive every object-only call.
  await fs.writeFile(path.join(clone, 'shared.txt'), 'local unstaged\n');
  await fs.writeFile(path.join(clone, 'staged.txt'), 'local staged\n');
  git(clone, 'add', 'staged.txt');
  await fs.writeFile(path.join(clone, 'untracked.txt'), 'local untracked\n');
  return {
    directory,
    source,
    clone,
    base,
    parent,
    child,
    grandchild,
    main,
    conflictMain,
    conflictParent,
    conflictChild,
    lateConflictChild,
  };
}

async function snapshot(cwd) {
  const files = {};
  for (const name of (await fs.readdir(cwd)).filter((name) => name !== '.git').sort())
    files[name] = await fs.readFile(path.join(cwd, name), 'utf8');
  return {
    head: git(cwd, 'rev-parse', 'HEAD'),
    symbolicHead: git(cwd, 'symbolic-ref', 'HEAD'),
    refs: git(cwd, 'for-each-ref', '--format=%(refname) %(objectname)'),
    index: (await fs.readFile(path.join(cwd, '.git/index'))).toString('hex'),
    config: await fs.readFile(path.join(cwd, '.git/config'), 'utf8'),
    files,
  };
}

test('advanced main plus ordered parent and child compose deterministically without checkout or refs', async () => {
  const f = await fixture();
  const beforeSource = await snapshot(f.source);
  const beforeClone = await snapshot(f.clone);
  const input = { mainSha: f.main, headShas: [f.parent, f.child] };
  const first = composeStackObjects(input, f.clone, committedAt);
  const oldEnvironment = {
    GIT_INDEX_FILE: process.env.GIT_INDEX_FILE,
    GIT_OBJECT_DIRECTORY: process.env.GIT_OBJECT_DIRECTORY,
    GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME,
  };
  let second;
  try {
    process.env.GIT_INDEX_FILE = path.join(f.directory, 'must-not-write-index');
    process.env.GIT_OBJECT_DIRECTORY = path.join(f.directory, 'must-not-use-objects');
    process.env.GIT_AUTHOR_NAME = 'Untrusted inherited identity';
    second = composeStackObjects(input, f.clone, committedAt);
  } finally {
    for (const [name, value] of Object.entries(oldEnvironment)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
  assert.deepEqual(second, first);
  await assert.rejects(fs.lstat(path.join(f.directory, 'must-not-write-index')), {
    code: 'ENOENT',
  });
  assert.deepEqual(
    first.steps.map((row) => row.headSha),
    input.headShas,
  );
  assert.equal(first.steps.length, 2);
  let previous = f.main;
  for (const row of first.steps) {
    assert.equal(
      git(f.clone, 'show', '-s', '--format=%P', row.commit),
      `${previous} ${row.headSha}`,
    );
    assert.equal(git(f.clone, 'show', '-s', '--format=%T', row.commit), row.tree);
    assert.equal(
      git(f.clone, 'show', '-s', '--format=%an|%ae|%cn|%ce', row.commit),
      'Pages diagnostic|pages-diagnostic@localhost|Pages diagnostic|pages-diagnostic@localhost',
    );
    const epoch = String(Date.parse(committedAt) / 1000);
    assert.equal(git(f.clone, 'show', '-s', '--format=%at|%ct', row.commit), `${epoch}|${epoch}`);
    previous = row.commit;
  }
  for (const [name, contents] of [
    ['shared.txt', 'base'],
    ['advanced-main.txt', 'advanced main'],
    ['parent.txt', 'parent'],
    ['child.txt', 'child'],
  ])
    assert.equal(git(f.clone, 'show', `${first.commit}:${name}`), contents);
  assert.equal(first.tree, first.steps.at(-1).tree);
  assert.equal(first.commit, first.steps.at(-1).commit);
  for (const flag of ['mergeAuthorized', 'qualificationPerformed', 'productionDeploymentPerformed'])
    assert.equal(first[flag], false);
  const three = composeStackObjects(
    { mainSha: f.main, headShas: [f.parent, f.child, f.grandchild] },
    f.clone,
    committedAt,
  );
  assert.equal(three.steps.length, 3);
  assert.equal(git(f.clone, 'show', `${three.commit}:grandchild.txt`), 'grandchild');
  assert.deepEqual(await snapshot(f.source), beforeSource);
  assert.deepEqual(await snapshot(f.clone), beforeClone);
  git(f.clone, 'config', 'merge.fixture.driver', 'must-never-run');
  const beforeDriver = await snapshot(f.clone);
  assert.throws(
    () => composeStackObjects(input, f.clone, committedAt),
    /Ambient merge configuration/,
  );
  assert.deepEqual(await snapshot(f.source), beforeSource);
  assert.deepEqual(await snapshot(f.clone), beforeDriver);
});

test('conflict and invalid stack rejection preserve source, clone, HEAD, refs, index and worktree', async () => {
  const f = await fixture();
  const beforeSource = await snapshot(f.source);
  const beforeClone = await snapshot(f.clone);
  const input = { mainSha: f.main, headShas: [f.parent, f.child] };
  const invalid = [
    { ...input, headShas: [f.child, f.parent] },
    { ...input, headShas: [f.parent, f.conflictParent] },
    { ...input, headShas: [f.parent, 'f'.repeat(40)] },
    { ...input, headShas: [f.parent, f.parent] },
    { ...input, headShas: [f.main, f.child] },
    { ...input, headShas: [f.parent] },
    { ...input, headShas: [f.parent, f.child, f.grandchild, f.conflictChild] },
    { ...input, mainSha: f.main.toUpperCase() },
    { ...input, headShas: [f.parent, f.child + '\n'] },
    { ...input, extra: true },
    { mainSha: f.conflictMain, headShas: [f.conflictParent, f.conflictChild] },
    { mainSha: f.conflictMain, headShas: [f.parent, f.lateConflictChild] },
  ];
  for (const value of invalid)
    assert.throws(() => composeStackObjects(value, f.clone, committedAt));
  for (const value of [
    undefined,
    null,
    'now',
    '2026-02-30T03:00:00Z',
    '2026-10-16',
    '2026-10-16T25:00:00Z',
    committedAt + '\n',
  ])
    assert.throws(() => composeStackObjects(input, f.clone, value));
  assert.deepEqual(await snapshot(f.source), beforeSource);
  assert.deepEqual(await snapshot(f.clone), beforeClone);
});

test('repository info attributes are rejected without changing the file or repository', async () => {
  const f = await fixture();
  const input = { mainSha: f.conflictMain, headShas: [f.conflictParent, f.conflictChild] };
  const attributes = path.join(f.clone, '.git/info/attributes');
  await fs.writeFile(attributes, 'shared.txt merge=union\n');
  const before = await snapshot(f.clone);
  assert.throws(
    () => composeStackObjects(input, f.clone, committedAt),
    /Repository info attributes/,
  );
  assert.equal(await fs.readFile(attributes, 'utf8'), 'shared.txt merge=union\n');
  assert.deepEqual(await snapshot(f.clone), before);
});

test('untracked and dirty tracked worktree attributes cannot resolve a frozen conflict', async () => {
  for (const trackedAttributes of [undefined, 'shared.txt merge=text\n']) {
    const f = await fixture({ trackedAttributes });
    await fs.writeFile(path.join(f.clone, '.gitattributes'), 'shared.txt merge=union\n');
    const before = await snapshot(f.clone);
    assert.throws(() =>
      composeStackObjects(
        { mainSha: f.conflictMain, headShas: [f.conflictParent, f.conflictChild] },
        f.clone,
        committedAt,
      ),
    );
    assert.deepEqual(await snapshot(f.clone), before);
  }
});

test('external attribute files and inherited global/system attribute configuration are neutralized', async () => {
  const f = await fixture();
  const external = path.join(f.directory, 'external-attributes');
  const config = path.join(f.directory, 'external-config');
  await fs.writeFile(external, 'shared.txt merge=union\n');
  await fs.writeFile(config, `[core]\n\tattributesFile = ${external}\n`);
  git(f.clone, 'config', 'core.attributesFile', external);
  const before = await snapshot(f.clone);
  const names = ['GIT_CONFIG_GLOBAL', 'GIT_CONFIG_SYSTEM', 'GIT_ATTR_NOSYSTEM', 'GIT_ATTR_SOURCE'];
  const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    process.env.GIT_CONFIG_GLOBAL = config;
    process.env.GIT_CONFIG_SYSTEM = config;
    process.env.GIT_ATTR_NOSYSTEM = '0';
    process.env.GIT_ATTR_SOURCE = f.parent;
    assert.throws(() =>
      composeStackObjects(
        { mainSha: f.conflictMain, headShas: [f.conflictParent, f.conflictChild] },
        f.clone,
        committedAt,
      ),
    );
  } finally {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
  assert.deepEqual(await snapshot(f.clone), before);
});

test('ambient local merge semantics are refused and commit encoding is internally pinned', async () => {
  const f = await fixture();
  const input = { mainSha: f.main, headShas: [f.parent, f.child] };
  const original = composeStackObjects(input, f.clone, committedAt);
  git(f.clone, 'config', 'i18n.commitEncoding', 'ISO-8859-1');
  const encoded = await snapshot(f.clone);
  assert.deepEqual(composeStackObjects(input, f.clone, committedAt), original);
  assert.deepEqual(await snapshot(f.clone), encoded);
  for (const [key, value] of [
    ['merge.default', 'union'],
    ['merge.directoryRenames', 'true'],
    ['merge.renames', 'false'],
  ]) {
    git(f.clone, 'config', key, value);
    const before = await snapshot(f.clone);
    assert.throws(
      () => composeStackObjects(input, f.clone, committedAt),
      /Ambient merge configuration/,
    );
    assert.deepEqual(await snapshot(f.clone), before);
    git(f.clone, 'config', '--unset', key);
  }
});

test('object-authored attributes remain supported and later merges read the current synthetic parent', async () => {
  for (const options of [
    { trackedAttributes: 'shared.txt merge=union\n' },
    { parentAttributes: 'shared.txt merge=union\n' },
  ]) {
    const f = await fixture(options);
    const before = await snapshot(f.clone);
    const result = composeStackObjects(
      { mainSha: f.conflictMain, headShas: [f.parent, f.lateConflictChild] },
      f.clone,
      committedAt,
    );
    const contents = git(f.clone, 'show', `${result.commit}:shared.txt`);
    assert.ok(contents.includes('main conflict'));
    assert.ok(contents.includes('late child conflict'));
    assert.equal(result.mergeAuthorized, false);
    assert.deepEqual(await snapshot(f.clone), before);
  }
});

test('replacement refs cannot substitute different objects for exact pinned SHAs', async () => {
  const f = await fixture();
  const input = { mainSha: f.main, headShas: [f.parent, f.child] };
  const expected = composeStackObjects(input, f.clone, committedAt);
  git(f.clone, 'replace', f.main, f.conflictParent);
  const before = await snapshot(f.clone);
  assert.deepEqual(composeStackObjects(input, f.clone, committedAt), expected);
  assert.deepEqual(await snapshot(f.clone), before);
});

test('legacy grafts cannot fabricate reversed ancestry and remain untouched', async () => {
  const f = await fixture();
  const file = path.join(f.clone, '.git/info/grafts');
  const contents = `${f.parent} ${f.child}\n${f.child} ${f.base}\n`;
  await fs.writeFile(file, contents);
  const before = await snapshot(f.clone);
  assert.throws(
    () =>
      composeStackObjects({ mainSha: f.main, headShas: [f.child, f.parent] }, f.clone, committedAt),
    /Repository info attributes or grafts/,
  );
  assert.equal(await fs.readFile(file, 'utf8'), contents);
  assert.deepEqual(await snapshot(f.clone), before);
});

test('common-directory and symbolic-link info attributes fail closed', async () => {
  const f = await fixture();
  const worktree = path.join(f.directory, 'linked-worktree');
  git(f.clone, 'worktree', 'add', '--detach', worktree, f.main);
  const external = path.join(f.directory, 'attributes');
  await fs.writeFile(external, 'shared.txt merge=union\n');
  const info = path.join(f.clone, '.git/info/attributes');
  await fs.symlink(external, info);
  const beforeClone = await snapshot(f.clone);
  const beforeFiles = await fs.readFile(path.join(worktree, 'shared.txt'), 'utf8');
  assert.throws(
    () =>
      composeStackObjects(
        { mainSha: f.conflictMain, headShas: [f.conflictParent, f.conflictChild] },
        worktree,
        committedAt,
      ),
    /Repository info attributes/,
  );
  assert.equal(await fs.readlink(info), external);
  assert.equal(await fs.readFile(path.join(worktree, 'shared.txt'), 'utf8'), beforeFiles);
  assert.deepEqual(await snapshot(f.clone), beforeClone);
});
