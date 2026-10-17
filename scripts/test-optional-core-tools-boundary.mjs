import test from 'node:test';
import assert from 'node:assert/strict';
import { optionalModuleDependencies } from './build-optional-practice.mjs';
import { OPTIONAL_PACKAGE_POLICIES } from '../publishing/optional-package-policy.mjs';
import { validateOptionalModuleClosure } from '../publishing/optional-module-closure.mjs';
import { readFile } from 'node:fs/promises';

const file = 'optional-practice/civilian-fpv/sim-presentation.mjs';
const source = '../../game/ui/global-settings-tools.mjs';
const dependencies = (code, name = file, id = 'civilian-fpv') =>
  optionalModuleDependencies(name, Buffer.from(code), OPTIONAL_PACKAGE_POLICIES[id]);

test('only the declared lazy core tools capability is outside the optional offline closure', () => {
  for (const id of ['civilian-flight', 'civilian-fpv', 'fpv-worlds'])
    assert.deepEqual(dependencies(`export const load = () => import('${source}');`, file, id), []);
  assert.deepEqual(dependencies(`import '${source}';`), ['game/ui/global-settings-tools.mjs']);
  assert.deepEqual(dependencies(`import('${source}');`, 'optional-practice/civilian-fpv/app.mjs'), [
    'game/ui/global-settings-tools.mjs',
  ]);
  assert.deepEqual(dependencies("import('../../game/app.mjs');"), ['game/app.mjs']);
});

test('the optional core extension cannot widen module or network admission', () => {
  for (const code of [
    'import(url);',
    "import('https://example.test/tools.mjs');",
    "fetch('../../game/ui/global-settings-tools.mjs');",
    "window.fetch('../../game/ui/global-settings-tools.mjs');",
  ])
    assert.throws(() => dependencies(code));
});

test('only the shared platform adapter may lazily load the native host bridge', () => {
  const bridge = '../native/bridge.mjs';
  for (const id of ['civilian-fpv', 'fpv-worlds'])
    assert.deepEqual(dependencies(`import('${bridge}');`, 'game/platform.mjs', id), []);
  assert.deepEqual(dependencies(`import '${bridge}';`, 'game/platform.mjs'), ['native/bridge.mjs']);
  assert.deepEqual(dependencies(`import('${bridge}');`, 'game/other.mjs'), ['native/bridge.mjs']);
  assert.deepEqual(dependencies("import('../native/other.mjs');", 'game/platform.mjs'), [
    'native/other.mjs',
  ]);
});

const bridgeCode = "import(new URL('../native/bridge.mjs', import.meta.url).href)";
const invalidBridgeImports = [
  bridgeCode.replace('../native/bridge.mjs', '../native/other.mjs'),
  bridgeCode.replace('../native/bridge.mjs', 'https://example.test/bridge.mjs'),
  bridgeCode.replace('import.meta.url', 'location.href'),
  bridgeCode.replace('.href)', "['href'])"),
  bridgeCode.replace('new URL', 'new OtherURL'),
  bridgeCode.replace('new URL', 'URL'),
  bridgeCode.replace('.href)', '.href, { with: { type: "json" } })'),
  bridgeCode.replace('.href)', '.href, { with: { type: fetch("https://example.test/") } })'),
  bridgeCode.replace('import.meta.url)', 'import.meta.url, extra)'),
  `class Boundary { #href; load() { return ${bridgeCode.replace('.href', '.#href')}; } }`,
  'import(url)',
];
const undeclaredPolicy = { coreOnlyImports: [] };

test('the canonical generated iOS bridge URL remains a narrowly scoped builder capability', () => {
  for (const id of ['civilian-flight', 'civilian-fpv', 'fpv-worlds'])
    assert.deepEqual(dependencies(bridgeCode, 'game/platform.mjs', id), []);
  assert.throws(() => dependencies(bridgeCode, 'game/other.mjs'));
  assert.throws(() =>
    optionalModuleDependencies('game/platform.mjs', Buffer.from(bridgeCode), undeclaredPolicy),
  );
  for (const invalid of invalidBridgeImports)
    assert.throws(() => dependencies(invalid, 'game/platform.mjs'), invalid);
});

test('published optional archives enforce the same native bridge boundary as their builder', () => {
  const closure = (
    code,
    owner = 'game/platform.mjs',
    policy = OPTIONAL_PACKAGE_POLICIES['civilian-fpv'],
  ) => validateOptionalModuleClosure(new Map([[owner, Buffer.from(code)]]), policy);
  for (const id of ['civilian-flight', 'civilian-fpv', 'fpv-worlds'])
    assert.deepEqual(closure(bridgeCode, 'game/platform.mjs', OPTIONAL_PACKAGE_POLICIES[id]), {
      modules: 1,
      imports: 0,
    });
  assert.throws(() => closure(bridgeCode, 'game/other.mjs'));
  assert.throws(() => closure(bridgeCode, 'game/platform.mjs', undeclaredPolicy));
  for (const invalid of invalidBridgeImports) assert.throws(() => closure(invalid), invalid);
  assert.throws(() => closure("import '../native/bridge.mjs'"), /dependency is missing/);
});

test('literal lazy capabilities cannot hide side effects in import options', () => {
  const code = `import('${source}', { with: { type: fetch('https://example.test/') } })`;
  assert.throws(() => dependencies(code), /import options/);
  assert.throws(
    () =>
      validateOptionalModuleClosure(
        new Map([[file, Buffer.from(code)]]),
        OPTIONAL_PACKAGE_POLICIES['civilian-fpv'],
      ),
    /import options/,
  );
});

test('the production platform adapter retains the original generated-bridge form in web archives', async () => {
  const bytes = await readFile(new URL('../game/platform.mjs', import.meta.url));
  assert.ok(bytes.toString().includes(bridgeCode));
  for (const id of ['civilian-flight', 'civilian-fpv', 'fpv-worlds']) {
    assert.deepEqual(
      optionalModuleDependencies('game/platform.mjs', bytes, OPTIONAL_PACKAGE_POLICIES[id]),
      [],
    );
    assert.deepEqual(
      validateOptionalModuleClosure(
        new Map([['game/platform.mjs', bytes]]),
        OPTIONAL_PACKAGE_POLICIES[id],
      ),
      { modules: 1, imports: 0 },
    );
  }
});
