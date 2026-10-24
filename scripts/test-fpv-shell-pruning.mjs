import test from 'node:test';
import assert from 'node:assert/strict';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { parse } from 'acorn';
import { simShellPruningPlan } from './fpv-shell-pruning.mjs';

const file = 'game/edition-context.mjs';
const canonical = await readFile(new URL('../game/edition-context.mjs', import.meta.url), 'utf8');
const additionalNames = new Map([
  ['game/ui/celebration.mjs', ['advanceCelebration', 'skipCelebration']],
  ['game/ui/movement-audio.mjs', ['readMovementAudio']],
  ['game/text-face.mjs', ['canvasTextFonts']],
  ['game/enemy-stats.mjs', ['forkEnemyStatsSession']],
  ['game/ui/menu-audio.mjs', ['saveMenuAudio']],
]);
const additionalSources = new Map(
  await Promise.all(
    [...additionalNames.keys()].map(async (name) => [
      name,
      await readFile(new URL('../' + name, import.meta.url), 'utf8'),
    ]),
  ),
);
const expectedNames = [
  'editionIdentityId',
  'editionPublicSlug',
  'editionIdFromLocation',
  'parseEditionChannel',
  'installedStateKey',
  'editionAppIdentity',
  'validateCompanyInstallationReference',
  'officialContentOwner',
];
const sourceMap = (text = canonical, consumer = '') =>
  new Map([...additionalSources, [file, text], ['game/consumer.mjs', consumer]]);
const plan = (text = canonical, consumer = '', roots = {}) =>
  simShellPruningPlan(sourceMap(text, consumer), roots);

test('edition pruning retains its eight explicit unused function declarations', () => {
  const removals = plan().get(file);
  assert.deepEqual(
    removals.map(({ name }) => name),
    expectedNames,
  );
  for (const row of removals) {
    const nodes = parse(canonical.slice(row.start, row.end), {
      sourceType: 'module',
      ecmaVersion: 'latest',
    }).body;
    assert.equal(nodes.length, 1);
    assert.equal(nodes[0].type, 'ExportNamedDeclaration');
    assert.equal(nodes[0].declaration.type, 'FunctionDeclaration');
    assert.equal(nodes[0].declaration.id.name, row.name);
  }
  // Literal strings and comments alone cannot reach a lexical function.
  assert.deepEqual(
    plan(
      canonical + '\n// validateCompanyInstallationReference\nconst label = "installedStateKey";',
    ),
    plan(),
  );
});

test('new retained calls, references and exports stop SIM generation', () => {
  for (const body of [
    'validateCompanyInstallationReference({});',
    'const next = officialContentOwner;',
    'export const future = { editionAppIdentity };',
    'export function newCapability() { return installedStateKey(); }',
    'export { parseEditionChannel as parse };',
  ])
    assert.throws(() => plan(canonical + '\n' + body), /retained reference/);
  for (const name of expectedNames)
    assert.throws(() => plan(canonical, '', { [file]: { [name]: 'newSimRoot' } }), /root export/);
});

test('new named, aliased, namespace and indirect imports stop SIM generation', () => {
  for (const declaration of [
    "import { officialContentOwner } from './edition-context.mjs';",
    "import { installedStateKey as stateKey } from './edition-context.mjs';",
    "import * as edition from './edition-context.mjs';",
    "import { 'officialContentOwner' as owner } from './edition-context.mjs';",
    "import edition from './edition-context.mjs';",
    "const edition = import('./edition-context.mjs');",
    'const next = import(moduleName);',
    "export * from './edition-context.mjs';",
    "export { installedStateKey } from './edition-context.mjs';",
  ])
    assert.throws(() => plan(canonical, declaration), /SIM projection pruning needs review/);
  assert.deepEqual(
    plan(canonical, "import { resolveEditionContext } from './edition-context.mjs';"),
    plan(),
  );
});

test('changed declaration shape, missing modules and dynamic lexical access fail closed', () => {
  assert.throws(
    () =>
      plan(
        canonical.replace('export function officialContentOwner', 'function officialContentOwner'),
      ),
    /changed declaration/,
  );
  assert.throws(() => simShellPruningPlan(new Map(), {}), /missing module/);
  for (const statement of [
    'eval("installedStateKey()");',
    'export function future() { return eval("editionAppIdentity"); }',
    'const evaluate = eval;',
  ])
    assert.throws(() => plan(canonical + '\n' + statement), /dynamic scope access/);
});

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value instanceof RegExp) return { source: value.source, flags: value.flags };
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== 'start' && key !== 'end')
        .map(([key, child]) => [key, normalize(child)]),
    );
  return value;
}
function findProjectedModule(tree, target = file) {
  let result;
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (
      node.type === 'AssignmentExpression' &&
      node.left.type === 'MemberExpression' &&
      node.left.object.name === 'modules' &&
      node.left.property.value === target
    ) {
      assert.equal(result, undefined, 'Exactly one private module projection');
      result = node.right.callee;
    }
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === 'object') visit(child);
    }
  };
  visit(tree);
  assert.ok(result);
  return result;
}

test('six additional private helpers remain explicit whole-function omissions and fail closed on new use', () => {
  const removals = plan();
  for (const [target, names] of additionalNames) {
    const text = additionalSources.get(target),
      rows = removals.get(target);
    assert.deepEqual(
      rows.map(({ name }) => name),
      names,
    );
    for (const row of rows) {
      const node = parse(text.slice(row.start, row.end), {
        sourceType: 'module',
        ecmaVersion: 'latest',
      }).body[0];
      assert.equal(node.declaration.type, 'FunctionDeclaration');
      assert.equal(node.declaration.id.name, row.name);
      const used = sourceMap();
      used.set(target, text + `\nexport function futureUse() { return ${row.name}; }`);
      assert.throws(() => simShellPruningPlan(used, {}), /retained reference/);
      assert.throws(
        () => simShellPruningPlan(sourceMap(), { [target]: { [row.name]: 'futureRoot' } }),
        /root export/,
      );
      const changed = sourceMap();
      changed.set(
        target,
        text.slice(0, row.start) + `export const ${row.name} = () => null;` + text.slice(row.end),
      );
      assert.throws(() => simShellPruningPlan(changed, {}), /changed declaration/);
      const dependency = './' + target.slice('game/'.length);
      for (const consumer of [
        `import { ${row.name} as renamed } from '${dependency}';`,
        `import * as future from '${dependency}';`,
        `export { ${row.name} } from '${dependency}';`,
      ])
        assert.throws(() => plan(canonical, consumer), /SIM projection pruning needs review/);
    }
  }
});

test('all newly pruned projections retain canonical imports, declarations and remaining exports', async () => {
  const source = await readFile(
    new URL('../optional-practice/civilian-fpv/flight-fullscreen.mjs', import.meta.url),
    'utf8',
  );
  const tree = parse(source, { sourceType: 'module', ecmaVersion: 'latest' }),
    removals = plan();
  for (const [target, text] of additionalSources) {
    const projected = findProjectedModule(tree, target),
      omitted = new Set(removals.get(target).map(({ start }) => start)),
      canonicalNodes = parse(text, { sourceType: 'module', ecmaVersion: 'latest' }).body,
      importedNames = canonicalNodes
        .filter((node) => node.type === 'ImportDeclaration')
        .flatMap((node) => node.specifiers.map((specifier) => specifier.local.name));
    // The generator's import bindings precede the retained module declarations.
    assert.deepEqual(
      projected.body.body
        .slice(0, importedNames.length)
        .flatMap((node) => node.declarations.map(({ id }) => id.name)),
      importedNames,
      target,
    );
    const retained = canonicalNodes.filter(
      (node) => node.type !== 'ImportDeclaration' && !omitted.has(node.start),
    );
    assert.deepEqual(
      normalize(projected.body.body.slice(importedNames.length, -1)),
      normalize(retained.map((node) => node.declaration ?? node)),
      target,
    );
    const exported = retained
      .filter((node) => node.type === 'ExportNamedDeclaration')
      .flatMap(({ declaration }) =>
        declaration.type === 'VariableDeclaration'
          ? declaration.declarations.map(({ id }) => id.name)
          : [declaration.id.name],
      );
    assert.deepEqual(
      projected.body.body.at(-1).argument.properties.map((property) => property.key.name),
      exported,
      target,
    );
    for (const name of additionalNames.get(target)) assert.ok(!exported.includes(name));
  }
});

test('generated edition context exactly retains canonical declarations and behavior', async () => {
  const source = await readFile(
    new URL('../optional-practice/civilian-fpv/flight-fullscreen.mjs', import.meta.url),
    'utf8',
  );
  const tree = parse(source, { sourceType: 'module', ecmaVersion: 'latest' });
  const projected = findProjectedModule(tree);
  const omitted = new Set(
    plan()
      .get(file)
      .map(({ start }) => start),
  );
  const retained = parse(canonical, { sourceType: 'module', ecmaVersion: 'latest' })
    .body.filter((node) => !omitted.has(node.start))
    .map((node) => node.declaration ?? node);
  assert.deepEqual(normalize(projected.body.body.slice(0, -1)), normalize(retained));
  const returned = projected.body.body.at(-1);
  assert.equal(returned.type, 'ReturnStatement');
  assert.deepEqual(
    returned.argument.properties.map((property) => property.key.name),
    ['validateEditionId', 'resolveEditionContext'],
  );
  const actual = vm.runInNewContext(`(${source.slice(projected.start, projected.end)})()`);
  const expected = await import('../game/edition-context.mjs');
  for (const options of [
    { version: 'DEV' },
    { version: 'v1.2.3' },
    { version: '1.2.3', editionId: 'droneaid-nl-community' },
  ])
    assert.equal(
      JSON.stringify(actual.resolveEditionContext(options)),
      JSON.stringify(expected.resolveEditionContext(options)),
    );
  for (const id of ['droneaid', 'alpha-1'])
    assert.equal(actual.validateEditionId(id), expected.validateEditionId(id));
  for (const id of ['', 'bad identity', '../escape']) {
    assert.throws(() => actual.validateEditionId(id), /Invalid edition identity/);
    assert.throws(() => expected.validateEditionId(id), /Invalid edition identity/);
  }
  assert.throws(() => actual.resolveEditionContext({ version: 'invalid' }), /stable release/);
});

test('the real generator refuses upstream reachability before writing either output', async (t) => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const temp = await mkdtemp(path.join(os.tmpdir(), 'fpv-shell-pruning-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  await mkdir(path.join(temp, 'game'));
  await mkdir(path.join(temp, 'scripts'));
  await mkdir(path.join(temp, 'optional-practice/civilian-fpv'), { recursive: true });
  for (const entry of await readdir(path.join(root, 'game'))) {
    if (entry === 'edition-context.mjs') continue;
    await symlink(path.join(root, 'game', entry), path.join(temp, 'game', entry));
  }
  for (const name of [
    'refresh-fpv-play-shell.mjs',
    'fpv-shell-pruning.mjs',
    'edition-code-indentation.mjs',
  ])
    await copyFile(path.join(root, 'scripts', name), path.join(temp, 'scripts', name));
  await symlink(path.join(root, 'node_modules'), path.join(temp, 'node_modules'));
  const outputs = ['flight-fullscreen.mjs', 'flight-fullscreen.css'];
  for (const name of outputs)
    await copyFile(
      path.join(root, 'optional-practice/civilian-fpv', name),
      path.join(temp, 'optional-practice/civilian-fpv', name),
    );
  const before = await Promise.all(
    outputs.map((name) => readFile(path.join(temp, 'optional-practice/civilian-fpv', name))),
  );
  await writeFile(
    path.join(temp, file),
    canonical + '\nexport function futureUse() { return installedStateKey(); }\n',
  );
  assert.throws(
    () =>
      execFileSync(process.execPath, ['scripts/refresh-fpv-play-shell.mjs'], {
        cwd: temp,
        stdio: 'pipe',
      }),
    /SIM projection pruning needs review: retained reference game\/edition-context.mjs:installedStateKey/,
  );
  assert.deepEqual(
    await Promise.all(
      outputs.map((name) => readFile(path.join(temp, 'optional-practice/civilian-fpv', name))),
    ),
    before,
    'The generator must fail before touching even its disposable outputs',
  );
  assert.equal(
    await readFile(new URL('../game/edition-context.mjs', import.meta.url), 'utf8'),
    canonical,
  );
});
