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
  "import './unsafe.txt'",
])
  test(`qualification rejects unpinned source: ${source}`, () => {
    assert.throws(
      () => qualificationDependencies(source, 'scripts/page.mjs'),
      /Unpinned|Invalid qualification/,
    );
  });
