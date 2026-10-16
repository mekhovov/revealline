import test from 'node:test';
import assert from 'node:assert/strict';
import { optionalModuleDependencies } from './build-optional-practice.mjs';
import { OPTIONAL_PACKAGE_POLICIES } from '../publishing/optional-package-policy.mjs';

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
