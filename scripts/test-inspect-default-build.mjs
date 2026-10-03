import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  inspectDefaultBuild,
  inspectDefaultBuildInputs,
  verifyAvailableCommittedSources,
} from './inspect-default-build.mjs';
import { sourceGit } from './frozen-source.mjs';

async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'default-input-test-')));
  t.after(() => fs.rm(root, { force: true, recursive: true }));
  await fs.mkdir(path.join(root, 'game/test'), { recursive: true });
  await fs.mkdir(path.join(root, 'game/offline'));
  await fs.writeFile(path.join(root, 'game/index.html'), '<main>Bounded fixture</main>');
  await fs.writeFile(path.join(root, 'game/unreferenced.txt'), 'An included original.');
  await fs.writeFile(path.join(root, 'game/test/source-only.mjs'), 'source only');
  await fs.writeFile(path.join(root, 'game/offline/source-only.js'), 'source only');
  await fs.writeFile(path.join(root, '.gitignore'), 'game/ignored.txt\n');
  await fs.writeFile(
    path.join(root, 'game/build-config.json'),
    JSON.stringify({ version: '0.1.0', entry: 'game/index.html', include: ['game'] }),
  );
  sourceGit(root, ['init', '-q']);
  sourceGit(root, ['config', 'user.name', 'Fixture']);
  sourceGit(root, ['config', 'user.email', 'fixture@example.invalid']);
  sourceGit(root, ['add', '.']);
  sourceGit(root, ['commit', '-qm', 'Bounded inspection fixture']);
  return root;
}

test('default input inspection binds all committed include originals with shared source-only exclusions', async (t) => {
  const root = await fixture(t);
  const before = sourceGit(root, ['status', '--porcelain']);
  const result = await inspectDefaultBuildInputs(root);
  assert.equal(result.format, 'revealline-default-build-inputs.v1');
  assert.equal(result.sourceRevision, sourceGit(root, ['rev-parse', 'HEAD']));
  assert.equal(result.sourceTree, sourceGit(root, ['rev-parse', 'HEAD^{tree}']));
  assert.equal(result.files, 3);
  assert.equal(
    result.bytes,
    (
      await Promise.all(
        ['index.html', 'unreferenced.txt', 'build-config.json'].map(
          async (name) => (await fs.stat(path.join(root, 'game', name))).size,
        ),
      )
    ).reduce((a, b) => a + b, 0),
  );
  assert.equal(sourceGit(root, ['status', '--porcelain']), before);
  assert.deepEqual((await fs.readdir(root)).sort(), ['.git', '.gitignore', 'game']);
});

test('sparse missing unreferenced originals fail with exact hydration bytes instead of undercounting', async (t) => {
  const root = await fixture(t);
  const name = 'game/unreferenced.txt';
  const bytes = (await fs.stat(path.join(root, name))).size;
  sourceGit(root, ['update-index', '--skip-worktree', name]);
  await fs.rm(path.join(root, name));
  assert.equal(sourceGit(root, ['status', '--porcelain']), '');
  await assert.rejects(inspectDefaultBuildInputs(root), (error) => {
    assert.match(error.message, /1 missing committed build inputs/);
    assert.deepEqual(error.missingInputs, { files: [name], bytes });
    return true;
  });
  await assert.rejects(fs.access(path.join(root, name)), /ENOENT/);
});

test('default input inspection rejects dirty, assumed-unchanged, ignored and linked originals', async (t) => {
  const root = await fixture(t);
  const name = 'game/unreferenced.txt',
    target = path.join(root, name),
    original = await fs.readFile(target);
  await fs.writeFile(target, 'changed');
  await assert.rejects(inspectDefaultBuildInputs(root), /clean committed source/);
  sourceGit(root, ['update-index', '--assume-unchanged', name]);
  await assert.rejects(inspectDefaultBuildInputs(root), /immutable commit/);
  await fs.writeFile(target, original);
  await fs.writeFile(path.join(root, 'game/ignored.txt'), 'not admitted');
  await assert.rejects(inspectDefaultBuildInputs(root), /committed include closure/);
  await fs.rm(path.join(root, 'game/ignored.txt'));
  await fs.rm(target);
  await fs.symlink('index.html', target);
  await assert.rejects(inspectDefaultBuildInputs(root), /symbolic inputs/);
});

test('inspection refuses another checkout and malformed CLI arguments without producing output', async (t) => {
  const root = await fixture(t),
    out = path.join(root, 'report.json');
  await assert.rejects(inspectDefaultBuild({ root, out }), /checkout being inspected/);
  await assert.rejects(fs.access(out), /ENOENT/);
  const script = fileURLToPath(new URL('./inspect-default-build.mjs', import.meta.url));
  for (const args of [
    [],
    ['--out'],
    ['--out', '--check-inputs'],
    ['--check-inputs', 'extra'],
    ['--unknown'],
  ]) {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage:/);
  }
});

async function committedInspectorFixture(t) {
  const root = await fixture(t);
  for (const relative of [
    'scripts/inspect-default-build.mjs',
    'scripts/game-cli.mjs',
    'scripts/brand-icons.mjs',
    'scripts/frozen-source.mjs',
    'scripts/check-edition-source.mjs',
    'scripts/pack-indexes.mjs',
    'publishing/edition-admission.mjs',
    'publishing/edition-zip.mjs',
    'game/data-json.mjs',
    'game/content-launch.mjs',
    'game/edition-context.mjs',
    'game/editions/package-budget.mjs',
  ]) {
    await fs.mkdir(path.dirname(path.join(root, relative)), { recursive: true });
    await fs.copyFile(new URL(`../${relative}`, import.meta.url), path.join(root, relative));
  }
  // This tiny historical-style fixture has no localization/catalogue sentinel.
  // The production validation module must therefore never be invoked.
  await fs.writeFile(
    path.join(root, 'scripts/localization.mjs'),
    'export function validateLocalization() { throw new Error("Unexpected localization sentinel"); }\n',
  );
  await fs.mkdir(path.join(root, 'game/content'), { recursive: true });
  await fs.writeFile(
    path.join(root, 'game/content/soundtrack-catalogue.mjs'),
    'export const SOUNDTRACK_BUNDLED_ASSETS = [];\n',
  );
  await fs.mkdir(path.join(root, 'game/i18n'), { recursive: true });
  await fs.writeFile(
    path.join(root, 'game/i18n/index.mjs'),
    'export function t(key) { return key; }\n',
  );
  await fs.appendFile(path.join(root, '.gitignore'), 'reports/\n');
  await fs.mkdir(path.join(root, 'reports'));
  sourceGit(root, ['add', '.']);
  sourceGit(root, ['commit', '-qm', 'Exact inspector and bounded real dependencies']);
  return root;
}

test('committed inspector CLI writes only exact nonpromotable metadata and never overwrites it', async (t) => {
  const root = await committedInspectorFixture(t);
  const out = path.join(root, 'reports/default.json');
  const script = path.join(root, 'scripts/inspect-default-build.mjs');
  const run = (...args) =>
    spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });
  const first = run('--out', out);
  assert.equal(first.status, 0, first.stderr);
  const receipt = JSON.parse(first.stdout),
    report = JSON.parse(await fs.readFile(out, 'utf8'));
  assert.equal(report.sourceRevision, sourceGit(root, ['rev-parse', 'HEAD']));
  assert.equal(report.sourceTree, sourceGit(root, ['rev-parse', 'HEAD^{tree}']));
  assert.equal(report.includedInputsVerified, true);
  assert.equal(report.sourceEligibility.status, 'not-applicable');
  assert.equal(report.publicEligible, false);
  assert.equal(report.promotable, false);
  assert.equal(report.completeHostedOutput, false);
  assert.equal(report.reproducibleBuilds, 0);
  assert.equal(
    receipt.payloadBytesIncludingManifest,
    report.manifest.totalBytes + report.manifestDescriptor.bytes,
  );
  const { createHash } = await import('node:crypto');
  assert.equal(
    receipt.report.sha256,
    createHash('sha256')
      .update(await fs.readFile(out))
      .digest('hex'),
  );
  assert.deepEqual(await fs.readdir(path.join(root, 'reports')), ['default.json']);
  await assert.rejects(fs.access(path.join(root, 'dist')), /ENOENT/);
  assert.equal(sourceGit(root, ['status', '--porcelain']), '');
  const before = await fs.readFile(out);
  const again = run('--out', out);
  assert.equal(again.status, 1);
  assert.match(again.stderr, /already exists/);
  assert.deepEqual(await fs.readFile(out), before);
  const badOutput = run('--out', path.join(root, 'would-dirty-source.json'));
  assert.equal(badOutput.status, 1);
  assert.match(badOutput.stderr, /Git-ignored/);
});

test('source binding verifies available producer originals outside includes, including hidden edits', async (t) => {
  const root = await fixture(t);
  const name = 'authoring/producer/original.txt',
    target = path.join(root, name);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, 'Pinned producer original');
  sourceGit(root, ['add', name]);
  sourceGit(root, ['commit', '-qm', 'Producer original outside runtime includes']);
  const available = await verifyAvailableCommittedSources(root);
  assert.equal(available.files, 7);
  assert.equal(available.absentTrackedFiles, 0);
  assert.match(available.inventorySha256, /^[a-f0-9]{64}$/);
  sourceGit(root, ['update-index', '--assume-unchanged', name]);
  await fs.writeFile(target, 'Changed producer original');
  assert.equal(sourceGit(root, ['status', '--porcelain']), '');
  await inspectDefaultBuildInputs(root);
  await assert.rejects(
    verifyAvailableCommittedSources(root),
    /Available source differs.*authoring\/producer/,
  );
  await fs.writeFile(target, 'Pinned producer original');
  assert.deepEqual(await verifyAvailableCommittedSources(root), available);
  sourceGit(root, ['update-index', '--skip-worktree', name]);
  await fs.rm(target);
  const sparse = await verifyAvailableCommittedSources(root);
  assert.equal(sparse.absentTrackedFiles, 1);
  assert.equal(sparse.files, 6);
  assert.notEqual(sparse.inventorySha256, available.inventorySha256);
});
