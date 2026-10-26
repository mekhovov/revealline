import test from 'node:test';
import assert from 'node:assert/strict';
import { qualificationDependencies } from './serve-fpv-regional-worker-qualification.mjs';

test('qualification captures static, lazy and worker URL dependencies within the repository', () => {
  assert.deepEqual(
    qualificationDependencies(
      "import './a.mjs'; export { x } from '../x.mjs'; import('./lazy.mjs'); new URL('./worker.mjs', import.meta.url);",
      'scripts/page.mjs',
    ),
    ['scripts/a.mjs', 'x.mjs', 'scripts/lazy.mjs', 'scripts/worker.mjs'],
  );
});
for (const source of [
  "import 'https://example.test/runtime.mjs'",
  "import '../../outside.mjs'",
  'import(variable)',
  'new URL(variable, import.meta.url)',
  'new Worker(new URL(variable, import.meta.url))',
  'fetch(new URL(variable, import.meta.url))',
  "import './unsafe.txt'",
])
  test(`qualification rejects unpinned source: ${source}`, () => {
    assert.throws(
      () => qualificationDependencies(source, 'scripts/page.mjs'),
      /Unpinned|Invalid qualification/,
    );
  });

test('qualification recognizes only the existing inert known-worker identity comparison', () => {
  const filename = 'optional-practice/civilian-fpv/aircraft-archive-verifier.mjs';
  const expression =
    "['./advanced-worker.mjs', '../fpv-worlds/advanced-worker.mjs'].some((path) => new URL(path, import.meta.url).href === url)";
  assert.deepEqual(qualificationDependencies(expression, filename), []);
  assert.throws(() => qualificationDependencies(expression, 'scripts/other.mjs'), /Unpinned/);
  assert.throws(
    () =>
      qualificationDependencies(
        expression.replace('../fpv-worlds/advanced-worker.mjs', './unknown.mjs'),
        filename,
      ),
    /Unpinned/,
  );
  assert.throws(
    () => qualificationDependencies(expression.replace('=== url', '=== fetch(url)'), filename),
    /Unpinned/,
  );
});
