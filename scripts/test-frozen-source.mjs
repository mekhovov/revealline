import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  frozenSource,
  committedInputMap,
  verifyCommittedInputs,
  sourceGit,
} from './frozen-source.mjs';

test('frozen input checking rejects dirty, ignored or assumed-unchanged bytes and symlink objects', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'optional-frozen-source-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  sourceGit(root, ['init', '-q']);
  sourceGit(root, ['config', 'user.email', 'fixture@example.invalid']);
  sourceGit(root, ['config', 'user.name', 'Fixture']);
  await writeFile(path.join(root, 'input.mjs'), 'export const selected = true;\n');
  await writeFile(path.join(root, '.gitignore'), 'ignored.mjs\n');
  await symlink('input.mjs', path.join(root, 'alias.mjs'));
  sourceGit(root, ['add', '.']);
  sourceGit(root, ['commit', '-qm', 'Fixture inputs']);
  const binding = frozenSource(root),
    tree = committedInputMap(root);
  assert.match(binding.sourceRevision, /^[a-f0-9]{40}$/);
  assert.equal(binding.sourceTree, sourceGit(root, ['rev-parse', 'HEAD^{tree}']));
  const original = await readFile(path.join(root, 'input.mjs'));
  verifyCommittedInputs(new Map([['input.mjs', original]]), tree);
  assert.throws(
    () => verifyCommittedInputs(new Map([['alias.mjs', original]]), tree),
    /immutable commit/,
  );
  await writeFile(path.join(root, 'ignored.mjs'), original);
  assert.deepEqual(frozenSource(root), binding);
  assert.throws(
    () => verifyCommittedInputs(new Map([['ignored.mjs', original]]), tree),
    /immutable commit/,
  );
  await writeFile(path.join(root, 'input.mjs'), 'export const selected = false;\n');
  assert.throws(() => frozenSource(root), /clean committed source/);
  sourceGit(root, ['update-index', '--assume-unchanged', 'input.mjs']);
  assert.deepEqual(frozenSource(root), binding);
  assert.throws(
    () =>
      verifyCommittedInputs(
        new Map([['input.mjs', Buffer.from('export const selected = false;\n')]]),
        tree,
      ),
    /immutable commit/,
  );
});
