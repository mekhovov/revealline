import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { checkSourceIdentity } from './check-source-identity.mjs';

const cli = fileURLToPath(new URL('./check-source-identity.mjs', import.meta.url));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'source-identity-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  git('init', '--quiet');
  git('config', 'user.name', 'Source Identity Fixture');
  git('config', 'user.email', 'fixture@example.invalid');
  git('config', 'core.fileMode', 'true');
  await fs.writeFile(path.join(root, 'plain.txt'), 'first\n');
  await fs.writeFile(path.join(root, 'run.sh'), '#!/bin/sh\n');
  await fs.chmod(path.join(root, 'run.sh'), 0o755);
  git('add', '--', 'plain.txt', 'run.sh');
  git('commit', '--quiet', '-m', 'fixture');
  return { root, git };
}

test('pristine raw files produce exact HEAD identity and a reproducible content/mode aggregate', async (t) => {
  const { root, git } = await fixture(t);
  const actual = await checkSourceIdentity({ root });
  assert.equal(actual.sourceRevision, git('rev-parse', 'HEAD'));
  assert.equal(actual.sourceTree, git('rev-parse', 'HEAD^{tree}'));
  assert.equal(actual.files, 2);
  assert.equal(actual.bytes, 16);
  assert.equal(actual.allTrackedSourceContentsAndModesMatch, true);
  const descriptors = [
    ['plain.txt', '100644', sha('first\n')],
    ['run.sh', '100755', sha('#!/bin/sh\n')],
  ];
  assert.equal(
    actual.aggregateSha256,
    sha(descriptors.map((row) => `${JSON.stringify(row)}\n`).join('')),
  );
  const fromRoot = JSON.parse(execFileSync(process.execPath, [cli], { cwd: root }));
  const explicit = JSON.parse(execFileSync(process.execPath, [cli, '--root', root]));
  assert.deepEqual(fromRoot, actual);
  assert.deepEqual(explicit, actual);
});

test('same-size byte changes are refused even when Git is told to assume the file unchanged', async (t) => {
  const { root, git } = await fixture(t);
  git('update-index', '--assume-unchanged', 'plain.txt');
  await fs.writeFile(path.join(root, 'plain.txt'), 'other\n');
  assert.equal(git('diff', '--name-only'), '');
  await assert.rejects(checkSourceIdentity({ root }), /Tracked content differs.*plain\.txt/);
});

test('a changed executable bit is refused independently of core.fileMode', async (t) => {
  const { root, git } = await fixture(t);
  git('config', 'core.fileMode', 'false');
  await fs.chmod(path.join(root, 'run.sh'), 0o644);
  assert.equal(git('diff', '--name-only'), '');
  await assert.rejects(checkSourceIdentity({ root }), /Tracked mode differs.*run\.sh/);
});

test('a missing tracked file fails instead of qualifying a partial sparse checkout', async (t) => {
  const { root } = await fixture(t);
  await fs.unlink(path.join(root, 'plain.txt'));
  await assert.rejects(checkSourceIdentity({ root }), /ENOENT/);
});

test('untracked cache/dependencies and an unrelated staged index blob do not change HEAD evidence', async (t) => {
  const { root, git } = await fixture(t);
  const before = await checkSourceIdentity({ root });
  for (const name of ['.cache', 'node_modules']) {
    await fs.mkdir(path.join(root, name));
    await fs.writeFile(path.join(root, name, 'extra.txt'), 'untracked');
  }
  const oid = execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd: root, input: 'other\n' })
    .toString()
    .trim();
  git('update-index', '--cacheinfo', `100644,${oid},plain.txt`);
  assert.notEqual(git('diff', '--cached', '--name-only'), '');
  assert.deepEqual(await checkSourceIdentity({ root }), before);
});

test('symlink target bytes are authenticated without reading the target', async (t) => {
  const { root, git } = await fixture(t);
  await fs.symlink('not-present', path.join(root, 'link'));
  git('add', '--', 'link');
  git('commit', '--quiet', '-m', 'tracked link');
  const actual = await checkSourceIdentity({ root });
  assert.equal(actual.files, 3);
  assert.equal(actual.bytes, 27);
  await fs.unlink(path.join(root, 'link'));
  await fs.symlink('also-absent', path.join(root, 'link'));
  await assert.rejects(checkSourceIdentity({ root }), /Tracked content differs.*link/);
});

test('a regular tracked file replaced by a symlink is refused even if target bytes match', async (t) => {
  const { root } = await fixture(t);
  await fs.writeFile(path.join(root, 'untracked-copy'), 'first\n');
  await fs.unlink(path.join(root, 'plain.txt'));
  await fs.symlink('untracked-copy', path.join(root, 'plain.txt'));
  await assert.rejects(checkSourceIdentity({ root }), /Tracked mode differs.*plain\.txt/);
});

test('streamed blobs include bytes beyond the first read buffer', async (t) => {
  const { root, git } = await fixture(t);
  const body = Buffer.alloc(3 * 65536 + 9, 47);
  body[body.length - 1] = 99;
  await fs.writeFile(path.join(root, 'large.bin'), body);
  git('add', '--', 'large.bin');
  git('commit', '--quiet', '-m', 'streamed fixture');
  const before = await checkSourceIdentity({ root });
  assert.equal(before.bytes, 16 + body.length);
  body[body.length - 1] = 100;
  await fs.writeFile(path.join(root, 'large.bin'), body);
  await assert.rejects(checkSourceIdentity({ root }), /Tracked content differs.*large\.bin/);
});
