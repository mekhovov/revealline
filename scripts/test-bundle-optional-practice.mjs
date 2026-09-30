import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, symlink, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { parse } from 'acorn';
import { buildOptionalPractice } from './build-optional-practice.mjs';
import { ICON_MASTER } from './brand-icons.mjs';
import { optionalFPVSourceFixture } from '../publishing/optional-package-source-fixture.mjs';
const root = new URL('../', import.meta.url).pathname;

async function toolClosure(entry) {
  const files = new Map(),
    pending = [entry];
  while (pending.length) {
    const name = pending.pop();
    if (files.has(name)) continue;
    const bytes = await readFile(path.join(root, name));
    files.set(name, bytes);
    if (!/\.(?:mjs|js)$/.test(name)) continue;
    const visit = (node) => {
      if (!node || typeof node !== 'object') return;
      if (
        [
          'ImportDeclaration',
          'ExportNamedDeclaration',
          'ExportAllDeclaration',
          'ImportExpression',
        ].includes(node.type) &&
        typeof node.source?.value === 'string' &&
        node.source.value.startsWith('.')
      )
        pending.push(
          path.posix.normalize(path.posix.join(path.posix.dirname(name), node.source.value)),
        );
      for (const child of Object.values(node)) {
        if (Array.isArray(child)) child.forEach(visit);
        else if (child && typeof child === 'object') visit(child);
      }
    };
    visit(
      parse(bytes.toString(), { sourceType: 'module', ecmaVersion: 'latest', allowHashBang: true }),
    );
  }
  return files;
}

test('frozen optional CLI builds twice from actual committed inputs and refuses dirty or existing outputs', async (t) => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'optional-bundle-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const built = await buildOptionalPractice(root);
  const fpv = await optionalFPVSourceFixture(t);
  const selected = new Map([
    ...(await toolClosure('scripts/bundle-optional-practice.mjs')),
    ...built.inputs,
    ...fpv.files,
  ]);
  // The import closure finds builder modules, but not the PNG they read at runtime.
  const iconMaster = await readFile(path.join(root, ICON_MASTER));
  selected.set(ICON_MASTER, iconMaster);
  selected.set(
    'game/vendor/lz-string-1.5.0.min.js',
    await readFile(path.join(root, 'game/vendor/lz-string-1.5.0.min.js')),
  );
  selected.set(
    'game/vendor/LZ-STRING-LICENSE.txt',
    await readFile(path.join(root, 'game/vendor/LZ-STRING-LICENSE.txt')),
  );
  selected.set('package.json', Buffer.from('{"type":"module","version":"1.2.3"}\n'));
  selected.set('.gitignore', Buffer.from('node_modules\n.cache/\n'));
  for (const [name, bytes] of selected) {
    await mkdir(path.dirname(path.join(fixture, name)), { recursive: true });
    await writeFile(path.join(fixture, name), bytes);
  }
  await symlink(path.join(root, 'node_modules'), path.join(fixture, 'node_modules'));
  const git = (...args) => execFileSync('git', args, { cwd: fixture, encoding: 'utf8' }).trim();
  git('init', '-q');
  git('config', 'user.email', 'fixture@example.invalid');
  git('config', 'user.name', 'Fixture');
  git('add', '.');
  git('commit', '-qm', 'Optional fixture');
  const run = (out, extra = []) =>
    JSON.parse(
      execFileSync(
        process.execPath,
        ['scripts/bundle-optional-practice.mjs', '--out', out, ...extra],
        {
          cwd: fixture,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      ),
    );
  const first = run('.cache/first'),
    second = run('.cache/second');
  assert.equal(first.sourceRevision, git('rev-parse', 'HEAD'));
  assert.equal(first.sourceTree, git('rev-parse', 'HEAD^{tree}'));
  assert.equal(first.publicEligible, false);
  assert.equal(first.reproducibleBuilds, 2);
  assert.equal(first.committedInputsVerified, true);
  assert.equal(first.zipMembersVerified, true);
  assert.deepEqual(
    await readFile(path.join(first.output, 'optional-packages.json')),
    await readFile(path.join(second.output, 'optional-packages.json')),
  );
  const review = JSON.parse(
    await readFile(path.join(first.output, 'optional-package-review.json')),
  );
  assert.ok(review.packages[0].gates.every((gate) => gate.status === 'pending'));
  const both = run('.cache/both', ['--packages', 'civilian-fpv,civilian-flight']);
  assert.deepEqual(both.packageIds, ['civilian-flight', 'civilian-fpv']);
  assert.equal(both.publicEligible, false);
  assert.deepEqual(
    await readFile(path.join(first.output, 'distribution-optional-civilian-flight.zip')),
    await readFile(path.join(both.output, 'distribution-optional-civilian-flight.zip')),
    'Selecting a second package does not change historical package bytes',
  );
  const bothReview = JSON.parse(
    await readFile(path.join(both.output, 'optional-package-review.json')),
  );
  assert.equal(bothReview.packages.length, 2);
  assert.ok(
    bothReview.packages.every((item) => item.gates.every((gate) => gate.status === 'pending')),
  );
  assert.throws(
    () => run('.cache/duplicate', ['--packages', 'civilian-fpv,civilian-fpv']),
    /unique registered package IDs/,
  );
  assert.throws(() => run('.cache/first'), /immutable outputs are never overwritten/);
  await writeFile(path.join(fixture, ICON_MASTER), Buffer.concat([iconMaster, Buffer.from('\n')]));
  assert.throws(() => run('.cache/dirty-icon'), /clean committed source/);
  await writeFile(path.join(fixture, ICON_MASTER), iconMaster);
  await writeFile(path.join(fixture, 'optional-practice/civilian-flight/app.mjs'), '// changed\n');
  assert.throws(() => run('.cache/dirty'), /clean committed source/);
});
