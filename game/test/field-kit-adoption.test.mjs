import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  stageFieldKitAdoptionTree,
  updateFieldKitAdoptionRef,
  validateFieldKitAdoptionHistory,
} from '../../scripts/field-kit-adoption.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { reviseStudioTheme } from '../presentation/studio-session.mjs';
import { exportThemeBundle } from '../presentation/bundle.mjs';
import { compilePresentation } from '../../scripts/compile-presentation.mjs';
import {
  checkFieldKitReadiness,
  PRODUCTION_LEDGER,
} from '../../scripts/check-field-kit-readiness.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const own = (files) => new Map([...files].map(([name, body]) => [name, Buffer.from(body)]));
const git = (root, args, input) =>
  execFileSync('git', ['-C', root, ...args], {
    input,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
    .toString()
    .trim();
function manifest(files, source = { id: 'fixture', revision: 1 }) {
  files.set(
    'manifest.json',
    Buffer.from(
      JSON.stringify({
        format: 'revealline-presentation-build.v1',
        source,
        files: [...files]
          .filter(([name]) => name !== 'manifest.json')
          .map(([name, body]) => ({
            path: name,
            bytes: body.length,
            sha256: sha(body),
          })),
      }),
    ),
  );
  return files;
}
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'field-kit-adoption-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  git(root, ['init', '-q', '-b', 'fixture']);
  git(root, ['config', 'user.name', 'Fixture']);
  git(root, ['config', 'user.email', 'fixture@example.invalid']);
  const before = manifest(new Map([['runtime.json', Buffer.from('old runtime')]]));
  for (const [name, body] of new Map([
    [PRODUCTION_LEDGER, Buffer.from('old ledger')],
    ['unrelated.txt', Buffer.from('keep this')],
    ...[...before].map(([name, body]) => [`game/presentation/compiled/${name}`, body]),
  ])) {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.writeFile(path.join(root, name), body);
  }
  git(root, ['add', '.']);
  git(root, ['commit', '-qm', 'Fixture baseline']);
  const parent = git(root, ['rev-parse', 'HEAD']);
  const after = manifest(new Map([['runtime.json', Buffer.from('new runtime')]]), {
    id: 'fixture',
    revision: 2,
  });
  const files = new Map([
    ['production.rltheme', Buffer.from('new ledger')],
    ...[...after].map(([name, body]) => [`compiled/${name}`, body]),
  ]);
  return { root, parent, before, files };
}
async function transaction(f) {
  const tree = await stageFieldKitAdoptionTree(f.root, f.parent, f.before, f.files);
  const commit = git(f.root, ['commit-tree', tree, '-p', f.parent], 'Fixture adoption\n');
  return {
    parent: f.parent,
    tree,
    commit,
    ref: `refs/heads/codex/field-kit-adoption-${commit.slice(0, 16)}`,
  };
}

test('private-index staging changes ledger and compiled output in one tree, leaving checkout and index exact', async (t) => {
  const f = await fixture(t);
  const index = await fs.readFile(path.join(f.root, '.git/index'));
  const staged = await transaction(f);
  assert.equal(git(f.root, ['show', `${staged.tree}:${PRODUCTION_LEDGER}`]), 'new ledger');
  assert.equal(
    git(f.root, ['show', `${staged.tree}:game/presentation/compiled/runtime.json`]),
    'new runtime',
  );
  assert.equal(git(f.root, ['show', `${staged.tree}:unrelated.txt`]), 'keep this');
  assert.equal(git(f.root, ['rev-parse', 'HEAD']), f.parent);
  assert.deepEqual(await fs.readFile(path.join(f.root, '.git/index')), index);
  assert.equal(await fs.readFile(path.join(f.root, PRODUCTION_LEDGER), 'utf8'), 'old ledger');
  assert.equal(
    await fs.readFile(path.join(f.root, 'game/presentation/compiled/runtime.json'), 'utf8'),
    'old runtime',
  );
  assert.equal(git(f.root, ['status', '--porcelain']), '');
  assert.equal(await stageFieldKitAdoptionTree(f.root, f.parent, f.before, f.files), staged.tree);
});

test('changed or incomplete baseline inventory and unowned output fail before exposing a ref', async (t) => {
  const f = await fixture(t);
  const changed = manifest(new Map([['runtime.json', Buffer.from('changed old runtime')]]));
  await assert.rejects(
    stageFieldKitAdoptionTree(f.root, f.parent, changed, f.files),
    /pinned Git parent/,
  );
  const invalid = new Map([
    ...f.files,
    ['compiled/unowned.txt', Buffer.from('not compiler-owned')],
  ]);
  await assert.rejects(stageFieldKitAdoptionTree(f.root, f.parent, f.before, invalid), /unlisted/);
  assert.equal(git(f.root, ['for-each-ref', '--format=%(refname)', 'refs/heads/codex/']), '');
  assert.equal(git(f.root, ['status', '--porcelain']), '');
});

test('recovery after an unreachable commit or completed ref update is idempotent; rollback preserves predecessor', async (t) => {
  const f = await fixture(t),
    tx = await transaction(f);
  assert.equal(git(f.root, ['for-each-ref', '--format=%(refname)', tx.ref]), '');
  assert.equal(updateFieldKitAdoptionRef(f.root, tx), 'adopted-review-ref');
  assert.equal(updateFieldKitAdoptionRef(f.root, tx), 'already-adopted');
  assert.equal(git(f.root, ['rev-parse', tx.ref]), tx.commit);
  assert.equal(updateFieldKitAdoptionRef(f.root, tx, { rollback: true }), 'rolled-back-review-ref');
  assert.equal(updateFieldKitAdoptionRef(f.root, tx, { rollback: true }), 'already-absent');
  assert.equal(git(f.root, ['show', `${f.parent}:${PRODUCTION_LEDGER}`]), 'old ledger');
  assert.equal(git(f.root, ['rev-parse', 'HEAD']), f.parent);
});

test('adoption and rollback reject another owner, symbolic aliases and user advances', async (t) => {
  const f = await fixture(t),
    tx = await transaction(f);
  assert.throws(
    () => updateFieldKitAdoptionRef(f.root, { ...tx, ref: 'refs/heads/fixture' }),
    /ownership/,
  );
  git(f.root, ['update-ref', tx.ref, f.parent]);
  assert.throws(() => updateFieldKitAdoptionRef(f.root, tx), /ref changed/);
  assert.throws(() => updateFieldKitAdoptionRef(f.root, tx, { rollback: true }), /ref changed/);
  git(f.root, ['update-ref', '-d', tx.ref]);
  git(f.root, ['symbolic-ref', tx.ref, 'refs/heads/fixture']);
  assert.throws(() => updateFieldKitAdoptionRef(f.root, tx), /symbolic/);
  assert.throws(() => updateFieldKitAdoptionRef(f.root, tx, { rollback: true }), /symbolic/);
  assert.equal(git(f.root, ['rev-parse', 'refs/heads/fixture']), f.parent);
});

test('rollback refuses a checked-out review branch even when its commit is unchanged', async (t) => {
  const f = await fixture(t),
    tx = await transaction(f);
  updateFieldKitAdoptionRef(f.root, tx);
  git(f.root, ['checkout', '-q', tx.ref.slice('refs/heads/'.length)]);
  assert.throws(() => updateFieldKitAdoptionRef(f.root, tx, { rollback: true }), /checked out/);
  assert.equal(git(f.root, ['rev-parse', 'HEAD']), tx.commit);
});

test('adoption preserves immutable history and exact old runtime; readiness remains an independent hard gate', async () => {
  const prior = createDefaultThemeBundle();
  const next = reviseStudioTheme(prior, { tokens: { amber: '#ffca70' } });
  const before = own((await compilePresentation(prior)).files);
  const after = own((await compilePresentation(next, new Map(), { previousOutput: before })).files);
  const oldLedger = Buffer.from(await (await exportThemeBundle(prior)).arrayBuffer());
  const newLedger = Buffer.from(await (await exportThemeBundle(next)).arrayBuffer());
  await validateFieldKitAdoptionHistory(oldLedger, newLedger, before, after);
  await assert.rejects(checkFieldKitReadiness(new Blob([newLedger])), /not ready/);
  const missing = new Map(after);
  missing.delete(`runtime.${sha(before.get('runtime.json'))}.json`);
  manifest(missing, { id: next.id, revision: next.revision });
  await assert.rejects(
    validateFieldKitAdoptionHistory(oldLedger, newLedger, before, missing),
    /exact published runtime/,
  );
  const wrongOwner = manifest(new Map(after), { id: 'another-owner', revision: next.revision });
  await assert.rejects(
    validateFieldKitAdoptionHistory(oldLedger, newLedger, before, wrongOwner),
    /different owners/,
  );
  await assert.rejects(
    validateFieldKitAdoptionHistory(oldLedger, oldLedger, before, after),
    /different owners|exactly once/,
  );
});
