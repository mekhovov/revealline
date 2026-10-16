import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateOptionalModuleClosure } from '../publishing/optional-module-closure.mjs';

const parser = await readFile(new URL('../publishing/vendor/acorn-8.18.0.mjs', import.meta.url));
assert.equal(parser.length, 233301);
assert.equal(
  createHash('sha256').update(parser).digest('hex'),
  '953573b8fdab71599749ea5f2b33d3e760c2116178f9423ee7458dbe39d59453',
);

const moduleBytes = (text) => Buffer.from(text);
const fixture = () =>
  new Map([
    ['app/main.mjs', moduleBytes("import './scene.mjs';")],
    ['app/scene.mjs', moduleBytes("export { value } from './nested/compiler.mjs';")],
    ['app/nested/compiler.mjs', moduleBytes('export const value = 1;')],
  ]);
assert.deepEqual(validateOptionalModuleClosure(fixture(), {}), { modules: 3, imports: 2 });
const missing = fixture();
missing.delete('app/nested/compiler.mjs');
assert.throws(
  () => validateOptionalModuleClosure(missing, {}),
  /scene.mjs -> app\/nested\/compiler.mjs/,
);
let checks = 4;
for (const source of [
  "export * from './missing.mjs';",
  "import('./missing.mjs');",
  "import('https://example.org/code.mjs');",
  'import(variable);',
  "import '../../outside.mjs';",
]) {
  const files = fixture();
  files.set('app/nested/compiler.mjs', moduleBytes(source));
  assert.throws(() => validateOptionalModuleClosure(files, {}), /Optional archive module/);
  checks++;
}
const optional = fixture();
optional.set('app/nested/compiler.mjs', moduleBytes("import('../../core/tool.mjs');"));
const policy = {
  coreOnlyImports: [{ from: 'app/nested/compiler.mjs', source: '../../core/tool.mjs' }],
};
validateOptionalModuleClosure(optional, policy);
checks++;
optional.set('app/nested/compiler.mjs', moduleBytes("import '../../core/tool.mjs';"));
assert.throws(() => validateOptionalModuleClosure(optional, policy), /dependency is missing/);
checks++;
// Traversal uses only the archive map: a real file elsewhere on disk cannot help.
const absent = new Map([
  ['scripts/check.mjs', moduleBytes("import './check-optional-module-closure.mjs';")],
]);
assert.throws(() => validateOptionalModuleClosure(absent, {}), /dependency is missing/);
checks++;
console.log(
  JSON.stringify({
    status: 'pass',
    checks,
    scope: 'Bounded archive module graph; no source-tree fallback or code execution',
  }),
);
