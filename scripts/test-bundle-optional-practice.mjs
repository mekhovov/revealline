import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, symlink, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parse } from 'acorn';
import { buildOptionalPractice } from './build-optional-practice.mjs';
import { ICON_MASTER } from './brand-icons.mjs';
import { optionalFPVSourceFixture } from '../publishing/optional-package-source-fixture.mjs';
const root = new URL('../', import.meta.url).pathname;

test('maintainer recipe adds a temporary fourth app, launches, updates, rolls back and retires it without publication', async (t) => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'practice-fourth-app-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const selected = new Map([
    ...(await toolClosure('scripts/bundle-optional-practice.mjs')),
    ...(await toolClosure('publishing/optional-package-fixture.mjs')),
    ...(await toolClosure('publishing/optional-package-promotion.mjs')),
  ]);
  for (const packageId of ['civilian-flight', 'civilian-fpv', 'fpv-worlds']) {
    const built = await buildOptionalPractice(root, { packageId });
    for (const [name, bytes] of built.inputs) selected.set(name, bytes);
  }
  const sampleId = 'sample-flight';
  for (const [name, bytes] of [...selected])
    if (name.startsWith('optional-practice/civilian-flight/')) {
      const target = name.replace('/civilian-flight/', '/sample-flight/');
      selected.set(
        target,
        /\.(?:mjs|json|webmanifest|html|md)$/.test(name)
          ? Buffer.from(
              bytes
                .toString()
                .replaceAll('civilian-flight', sampleId)
                .replaceAll('Civilian flight gym', 'Unpublished sample gym'),
            )
          : bytes,
      );
    }
  const policyName = 'publishing/optional-package-policy.mjs';
  selected.set(
    policyName,
    Buffer.from(
      selected
        .get(policyName)
        .toString()
        .replace(
          '  ...BASE_OPTIONAL_PACKAGE_POLICIES,',
          `  ...BASE_OPTIONAL_PACKAGE_POLICIES,
  'sample-flight': Object.freeze({ ...BASE_OPTIONAL_PACKAGE_POLICIES['civilian-flight'], root: 'optional-practice/sample-flight/', entry: 'optional-practice/sample-flight/index.html', template: 'optional-practice/worker-template.mjs' }),`,
        ),
    ),
  );
  for (const name of [
    ICON_MASTER,
    'game/vendor/lz-string-1.5.0.min.js',
    'game/vendor/LZ-STRING-LICENSE.txt',
  ])
    selected.set(name, await readFile(path.join(root, name)));
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
  git('commit', '-qm', 'Unpublished fourth-app recipe');
  const result = JSON.parse(
    execFileSync(
      process.execPath,
      ['scripts/bundle-optional-practice.mjs', '--preview', '.cache/preview'],
      { cwd: fixture, encoding: 'utf8' },
    ),
  );
  assert.equal(result.publicEligible, false);
  assert.equal(result.packages.length, 4);
  assert(result.packages.every((item) => item.readyToBundle));
  const catalog = JSON.parse(
    await readFile(path.join(fixture, '.cache/preview/practice/index.json')),
  );
  assert.equal(catalog.packages.find((item) => item.id === sampleId).href, 'sample-flight/app/');
  const pointer = JSON.parse(
    await readFile(path.join(fixture, '.cache/preview/practice/sample-flight/app/current.json')),
  );
  assert.equal(pointer.entry, 'optional-practice/sample-flight/index.html');
  assert.match(
    await readFile(path.join(fixture, '.cache/preview/practice/index.html'), 'utf8'),
    /Unpublished sample gym/,
  );
  const localImport = (name) => import(pathToFileURL(path.join(fixture, name)).href);
  const { optionalPackageFixture: make } = await localImport(
    'publishing/optional-package-fixture.mjs',
  );
  const { frozenOptionalPackageOverlay: overlay, selectRetainedOptionalPackageRelease: rollback } =
    await localImport('publishing/optional-package-promotion.mjs');
  const previous = await make({ packageId: sampleId, version: 'v1.2.2' });
  const current = await make({ packageId: sampleId, version: 'v1.2.3' });
  previous.release.activePackageIds = [];
  const selector = {
    format: 'revealline-optional-package-publication.v1',
    releases: [previous.release, current.release],
  };
  const readers = {
    targetBasePath: '/revealline/',
    resolveReleaseIdentity: async (version) =>
      [previous, current].find((f) => f.envelope.version === version).envelope,
    readReleaseAsset: async (version, name) =>
      [previous, current].find((f) => f.envelope.version === version).files.get(name),
  };
  const published = await overlay(selector, readers);
  assert.equal(
    JSON.parse(published.get('practice/sample-flight/app/current.json')).version,
    'v1.2.3',
  );
  const rolled = await overlay(
    await rollback(selector, { version: 'v1.2.2', packageIds: [sampleId] }, readers),
    readers,
  );
  assert.equal(JSON.parse(rolled.get('practice/sample-flight/app/current.json')).version, 'v1.2.2');
  for (const [name, bytes] of published)
    if (name.includes('/releases/')) assert.deepEqual(rolled.get(name), bytes);
  const retired = await overlay(
    {
      ...selector,
      releases: selector.releases.map((release) => ({ ...release, activePackageIds: [] })),
    },
    readers,
  );
  assert.deepEqual(JSON.parse(retired.get('practice/index.json')).packages, []);
  assert(!retired.has('practice/sample-flight/app/current.json'));
  assert(
    !Object.keys(
      (await import('../publishing/optional-package-policy.mjs')).OPTIONAL_PACKAGE_POLICIES,
    ).includes(sampleId),
  );
});

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
