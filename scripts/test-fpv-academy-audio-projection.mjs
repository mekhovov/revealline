import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { OPTIONAL_PACKAGE_POLICIES } from '../publishing/optional-package-policy.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = 'optional-practice/civilian-fpv/sim-presentation.mjs';
const bank = 'game/audio/human-reactions/portable.mjs';
const generator = 'scripts/refresh-fpv-academy-audio.mjs';
const policy = 'publishing/optional-package-policy.mjs';
const begin = '// BEGIN GENERATED ACADEMY SHARED AUDIO';
const end = '// END GENERATED ACADEMY SHARED AUDIO';
const source = await readFile(path.join(root, target), 'utf8');
const generated = source.slice(source.indexOf(begin), source.indexOf(end) + end.length);
const tree = parse(generated, { ecmaVersion: 'latest', sourceType: 'module' });
const factory = tree.body.find((node) => node.type === 'ExportNamedDeclaration').declaration
  .declarations[0].init.callee;
const modules = new Map(
  factory.body.body
    .filter((node) => node.type === 'ExpressionStatement')
    .map(({ expression }) => [expression.left.property.value, expression.right.callee]),
);
const externals = new Map(
  tree.body
    .filter((node) => node.type === 'ImportDeclaration')
    .map((node) => [
      path.posix.normalize(path.posix.join(path.posix.dirname(target), node.source.value)),
      node.specifiers[0].local.name,
    ]),
);
const parseBody = (text) => parse(text, { ecmaVersion: 'latest', sourceType: 'module' }).body;
function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value instanceof RegExp) return { source: value.source, flags: value.flags };
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !['start', 'end', 'raw'].includes(key))
        .map(([key, child]) => [key, normalize(child)]),
    );
  return value;
}

test('all three package inputs already admit the exact canonical sample bank', async () => {
  for (const host of ['civilian-flight', 'civilian-fpv', 'fpv-worlds'])
    assert.ok(OPTIONAL_PACKAGE_POLICIES[host].sharedFiles.includes(bank), host);
  assert.deepEqual([...externals.keys()].sort(), ['game/i18n/index.mjs', bank].sort());
  assert.equal(modules.size, 12);
  assert.ok(!modules.has(bank));
  const { HUMAN_REACTION_BANK } = await import('../' + bank);
  assert.ok(Object.isFrozen(HUMAN_REACTION_BANK));
  assert.equal(Object.keys(HUMAN_REACTION_BANK).length, 8);
  for (const clip of Object.values(HUMAN_REACTION_BANK))
    assert.ok(
      !generated.includes(clip.base64),
      'Sample payload is present only in its canonical module',
    );
});

test('every retained private module keeps its canonical declarations, imports and exports', async () => {
  const sourceHashes = factory.body.body.find(
    (node) => node.declarations?.[0]?.id.name === 'sourceHashes',
  ).declarations[0].init.arguments[0];
  const hashes = new Map(sourceHashes.properties.map((item) => [item.key.value, item.value.value]));
  assert.deepEqual([...hashes.keys()].sort(), [...modules.keys()].sort());
  for (const [file, projected] of modules) {
    const canonical = await readFile(path.join(root, file), 'utf8');
    assert.equal(hashes.get(file), createHash('sha256').update(canonical).digest('hex'), file);
    const expected = [],
      exports = [];
    for (const node of parseBody(canonical)) {
      if (node.type === 'ImportDeclaration') {
        const imported = path.posix.normalize(
          path.posix.join(path.posix.dirname(file), node.source.value),
        );
        assert.ok(externals.has(imported) || modules.has(imported), imported);
        const owner = externals.get(imported) ?? `modules[${JSON.stringify(imported)}]`;
        for (const item of node.specifiers)
          expected.push(
            ...parseBody(
              `const ${item.local.name} = ${owner}${item.type === 'ImportNamespaceSpecifier' ? '' : `[${JSON.stringify(item.type === 'ImportDefaultSpecifier' ? 'default' : item.imported.name)}]`};`,
            ),
          );
      } else {
        expected.push(node.declaration ?? node);
        if (node.type === 'ExportNamedDeclaration') {
          assert.ok(node.declaration, 'Current audio modules use declaration exports');
          exports.push(
            ...(node.declaration.type === 'VariableDeclaration'
              ? node.declaration.declarations.map((row) => row.id.name)
              : [node.declaration.id.name]),
          );
        }
      }
    }
    assert.deepEqual(normalize(projected.body.body.slice(0, -1)), normalize(expected), file);
    assert.deepEqual(
      projected.body.body.at(-1).argument.properties.map((item) => item.key.name ?? item.key.value),
      exports,
      file,
    );
  }
});

async function fixture(t) {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'fpv-audio-projection-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  for (const file of [generator, target, bank, policy, '.prettierrc.json', ...modules.keys()]) {
    await mkdir(path.dirname(path.join(temp, file)), { recursive: true });
    await copyFile(path.join(root, file), path.join(temp, file));
  }
  await symlink(path.join(root, 'node_modules'), path.join(temp, 'node_modules'));
  return {
    temp,
    run: (...args) =>
      execFileSync(process.execPath, [generator, ...args], { cwd: temp, stdio: 'pipe' }),
    read: (file) => readFile(path.join(temp, file), 'utf8'),
    write: (file, text) => writeFile(path.join(temp, file), text),
  };
}

test('real generation reproduces the projection and preserves surrounding native source', async (t) => {
  const f = await fixture(t);
  const result = JSON.parse(f.run('--check'));
  assert.equal(result.modules, 12);
  assert.equal(result.externalModules, 2);
  const native =
    source.slice(0, source.indexOf(begin)) + source.slice(source.indexOf(end) + end.length);
  await f.write(target, native.trimEnd() + '\n');
  f.run();
  const refreshed = await f.read(target);
  assert.equal(refreshed.slice(refreshed.indexOf(begin)).trimEnd(), generated);
  assert.equal(refreshed.slice(0, refreshed.indexOf(begin)).trimEnd(), native.trimEnd());
  f.run('--check');
});

test('removing canonical admission from any host fails before writing', async (t) => {
  const f = await fixture(t),
    original = await f.read(policy);
  for (const host of ['civilian-flight', 'civilian-fpv', 'fpv-worlds']) {
    const rows = Object.fromEntries(
      Object.entries(OPTIONAL_PACKAGE_POLICIES).map(([id, value]) => [
        id,
        id === host
          ? { ...value, sharedFiles: value.sharedFiles.filter((file) => file !== bank) }
          : value,
      ]),
    );
    await f.write(policy, `export const OPTIONAL_PACKAGE_POLICIES = ${JSON.stringify(rows)};`);
    assert.throws(() => f.run(), new RegExp(`Unadmitted shared audio external for ${host}`));
    assert.equal(await f.read(target), source);
  }
  await f.write(policy, original);
});

test('stateful, executable or changed bank exports fail before writing', async (t) => {
  const f = await fixture(t),
    original = await f.read(bank);
  for (const changed of [
    original + '\nglobalThis.audioSideEffect = true;',
    original.replace('export const', 'export let'),
    original.replace('HUMAN_REACTION_BANK', 'CHANGED_BANK'),
    original.replace('Object.freeze(', 'Object.seal('),
    original.replace('"duration":0.7', '"duration":Math.random()'),
    original.replace('"human-reaction-1"', '"changed-record"'),
    original.replace('"duration":0.7', '"duration":2'),
  ]) {
    assert.notEqual(changed, original);
    await f.write(bank, changed);
    assert.throws(() => f.run(), /Shared reaction bank must remain/);
    assert.equal(await f.read(target), source);
  }
});

test('unadmitted dependencies and malformed markers cannot overwrite the target', async (t) => {
  const f = await fixture(t),
    entry = 'optional-practice/civilian-fpv/world-audio.mjs';
  const original = await f.read(entry);
  await f.write(entry, original + '\nimport "./unadmitted.mjs";');
  assert.throws(() => f.run(), /Unexpected Academy audio dependency/);
  assert.equal(await f.read(target), source);
  await f.write(entry, original);
  const malformed = source.replace(end, '');
  await f.write(target, malformed);
  assert.throws(() => f.run(), /markers are malformed/);
  assert.equal(await f.read(target), malformed);
});
