import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { acquireFocusedGitInputs } from './focused-git-inputs.mjs';
import { loadFocusedExecutionInputs, packageScriptShellSemantics } from './focused-tests.mjs';

const commands = [{ id: 'package', command: 'npm', args: ['run', 'test:example'] }];
async function fixture(fn) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'revealline-ci-inputs-'));
  const git = (...args) => {
    const r = spawnSync('git', ['-C', root, ...args], {
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_CONFIG_COUNT: '0',
      },
    });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  try {
    git('init', '--quiet');
    git('config', 'user.name', 'Fixture');
    git('config', 'user.email', 'fixture@example.invalid');
    await fs.mkdir(path.join(root, 'game/test'), { recursive: true });
    await fs.mkdir(path.join(root, 'authoring/fpv-worlds'), { recursive: true });
    await fs.writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({
        scripts: {
          'test:example': 'node --test game/test/*.test.mjs',
          preinstall: 'node MUST_NOT_EXECUTE.mjs',
        },
      }),
    );
    await fs.writeFile(path.join(root, 'package-lock.json'), '{}');
    await fs.writeFile(path.join(root, 'authoring/fpv-worlds/package.json'), '{}');
    await fs.writeFile(path.join(root, 'authoring/fpv-worlds/package-lock.json'), '{}');
    await fs.writeFile(
      path.join(root, 'game/test/a.test.mjs'),
      'throw new Error("must not execute");',
    );
    await fs.writeFile(path.join(root, 'game/test/b.test.mjs'), '// data only');
    git('add', '.');
    git('commit', '--quiet', '-m', 'fixture');
    await fn({ root, git, head: git('rev-parse', 'HEAD') });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

const acquire = (root, head, extra = {}) =>
  acquireFocusedGitInputs(commands, root, {
    expectedSource: head,
    loadInputs: loadFocusedExecutionInputs,
    readShellSemantics: packageScriptShellSemantics,
    ...extra,
  });
const normalized = (inputs) => ({ ...inputs, repositoryFiles: [...inputs.repositoryFiles].sort() });

test('tiny real Git snapshot matches filesystem inputs without executing candidate scripts', () =>
  fixture(async ({ root, git, head }) => {
    const before = {
      head: git('rev-parse', 'HEAD'),
      refs: git('show-ref'),
      index: await fs.readFile(path.join(root, '.git/index')),
    };
    const acquired = await acquire(root, head);
    const actual = await loadFocusedExecutionInputs(commands, root, {
      shellSemantics: packageScriptShellSemantics(root),
    });
    assert.deepEqual(normalized(acquired.inputs), normalized(actual));
    assert.equal(acquired.sourceRevision, head);
    assert.equal(acquired.sourceTree, git('rev-parse', 'HEAD^{tree}'));
    assert.equal(acquired.setupFiles.length, 6);
    assert.equal(acquired.setupFiles.find((x) => x.path === '.npmrc').gitBlob, null);
    assert.equal(git('rev-parse', 'HEAD'), before.head);
    assert.equal(git('show-ref'), before.refs);
    assert.deepEqual(await fs.readFile(path.join(root, '.git/index')), before.index);
    assert.equal(git('status', '--porcelain'), '');
  }));

test('sparse missing test bodies retain exact Git-backed file discovery', () =>
  fixture(async ({ root, head }) => {
    await fs.rm(path.join(root, 'game'), { recursive: true });
    const result = await acquire(root, head);
    assert.deepEqual(result.inputs.repositoryFiles, [
      'game/test/a.test.mjs',
      'game/test/b.test.mjs',
    ]);
  }));

test('tracked symlink tests resolve exactly as existing filesystem discovery', () =>
  fixture(async ({ root, git }) => {
    await fs.symlink('a.test.mjs', path.join(root, 'game/test/alias.test.mjs'));
    git('add', '.');
    git('commit', '--quiet', '-m', 'symlink');
    const result = await acquire(root, git('rev-parse', 'HEAD'));
    const actual = await loadFocusedExecutionInputs(commands, root, {
      shellSemantics: packageScriptShellSemantics(root),
    });
    assert.deepEqual(normalized(result.inputs), normalized(actual));
  }));

test('custom script-shell is preserved as unsupported-for-dedup, never assumed default', () =>
  fixture(async ({ root, git }) => {
    await fs.writeFile(path.join(root, '.npmrc'), 'script-shell=/bin/bash\n');
    git('add', '.npmrc');
    git('commit', '--quiet', '-m', 'config');
    const result = await acquire(root, git('rev-parse', 'HEAD'));
    assert.equal(result.inputs.shellSemantics, null);
    assert.ok(result.setupFiles.find((x) => x.path === '.npmrc').gitBlob);
  }));

test('dirty and untracked package configuration cannot influence planned commands', () =>
  fixture(async ({ root, head }) => {
    await fs.writeFile(path.join(root, 'package.json'), '{}');
    await assert.rejects(acquire(root, head), /package.json|source|configuration/i);
    await fs.writeFile(path.join(root, '.npmrc'), 'script-shell=/bin/bash\n');
    await assert.rejects(acquire(root, head), /package.json|source|configuration/i);
  }));

test('untracked npm configuration is rejected even when package bytes match', () =>
  fixture(async ({ root, head }) => {
    await fs.writeFile(path.join(root, '.npmrc'), 'script-shell=/bin/bash\n');
    await assert.rejects(acquire(root, head), /configuration|npmrc/i);
  }));

test('wrong head and moving source identity fail closed', () =>
  fixture(async ({ root, git, head }) => {
    await assert.rejects(acquire(root, 'f'.repeat(40)), /source|head/i);
    await assert.rejects(
      acquire(root, head, {
        readShellSemantics() {
          git('commit', '--allow-empty', '--quiet', '-m', 'advance');
          return 'posix';
        },
      }),
      /source|head|changed/i,
    );
  }));

test('source setup symlinks are rejected before npm can read an outside file', () =>
  fixture(async ({ root, git }) => {
    await fs.symlink('/dev/null', path.join(root, '.npmrc'));
    git('add', '.npmrc');
    git('commit', '--quiet', '-m', 'unsupported config');
    let invoked = false;
    await assert.rejects(
      acquire(root, git('rev-parse', 'HEAD'), {
        readShellSemantics() {
          invoked = true;
          return 'posix';
        },
      }),
      /regular|configuration|npmrc/i,
    );
    assert.equal(invoked, false);
  }));

test('malformed, duplicate, truncated and invalid-UTF8 tree records are rejected', () =>
  fixture(async ({ root, head }) => {
    for (const corrupt of [
      (bytes) => bytes.subarray(0, bytes.length - 1),
      (bytes) => Buffer.concat([bytes, bytes.subarray(0, bytes.indexOf(0) + 1)]),
      (bytes) => Buffer.from(bytes.toString().replace('040000 tree', '100644 tree')),
      (bytes) => Buffer.concat([Buffer.from([255]), bytes]),
    ]) {
      await assert.rejects(
        acquire(root, head, {
          spawn(command, args, options) {
            const result = spawnSync(command, args, options);
            return args.includes('ls-tree')
              ? { ...result, stdout: corrupt(result.stdout) }
              : result;
          },
        }),
        /tree|encoding|mode|entry/i,
      );
    }
  }));

test('outside test symlinks cannot be silently omitted by the existing tolerant loader', () =>
  fixture(async ({ root, git }) => {
    await fs.symlink('/dev/null', path.join(root, 'game/test/outside.test.mjs'));
    git('add', '.');
    git('commit', '--quiet', '-m', 'outside link');
    await assert.rejects(acquire(root, git('rev-parse', 'HEAD')), /symlink/i);
  }));

test('authoring npm configuration is also source-bound before dependency setup', () =>
  fixture(async ({ root, head }) => {
    await fs.writeFile(path.join(root, 'authoring/fpv-worlds/.npmrc'), 'ignore-scripts=false\n');
    await assert.rejects(acquire(root, head), /configuration|npmrc/i);
  }));

test('invalid UTF8 symlink targets cannot authorize silently reduced file discovery', () =>
  fixture(async ({ root, git }) => {
    await fs.symlink(Buffer.from([255]), path.join(root, 'game/test/invalid.test.mjs'));
    git('add', '.');
    git('commit', '--quiet', '-m', 'invalid link encoding');
    await assert.rejects(acquire(root, git('rev-parse', 'HEAD')), /symlink/i);
  }));

test('missing symlink objects fail closed without lazy fetch or swallowed acquisition errors', () =>
  fixture(async ({ root, git }) => {
    await fs.symlink('a.test.mjs', path.join(root, 'game/test/alias.test.mjs'));
    git('add', '.');
    git('commit', '--quiet', '-m', 'link');
    const link = git('rev-parse', 'HEAD:game/test/alias.test.mjs');
    await assert.rejects(
      acquire(root, git('rev-parse', 'HEAD'), {
        spawn(command, args, options) {
          assert.equal(options.env.GIT_NO_LAZY_FETCH, '1');
          if (args.includes('cat-file') && args.includes(link))
            return { status: 128, stdout: Buffer.alloc(0) };
          return spawnSync(command, args, options);
        },
      }),
      /object|source|metadata/i,
    );
  }));
