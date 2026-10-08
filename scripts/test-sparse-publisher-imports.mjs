import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, mkdir, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parse } from 'acorn';

const root = fileURLToPath(new URL('../', import.meta.url));
const scenarios = [
  {
    workflow: '.github/workflows/fastline-release.yml',
    step: 'Check out trusted guarded publisher',
    entry: 'publishing/fastline-release-publisher.mjs',
    exported: 'publishExactRelease',
  },
];

function selectedPaths(workflow, step) {
  const block = workflow.split(`- name: ${step}`)[1]?.split('- name:')[0];
  const patterns = block?.match(
    /sparse-checkout:\s*\|\n([\s\S]*?)\n\s*sparse-checkout-cone-mode:/,
  )?.[1];
  assert.ok(patterns, `Missing exact sparse checkout for ${step}`);
  return patterns
    .split('\n')
    .map((line) => line.trim().replace(/^\//, ''))
    .filter(Boolean);
}

// Traverse the actual static imports, but copy only files admitted by the
// workflow. Missing transitive dependencies must fail in the fresh Node process;
// the full source tree and node_modules are never available as a fallback.
async function sparseModules(entry, selected, directory) {
  const seen = new Set(),
    missing = [];
  const includes = (file) =>
    selected.some((item) => (item.endsWith('/') ? file.startsWith(item) : file === item));
  async function visit(file) {
    if (seen.has(file)) return;
    seen.add(file);
    assert.ok(
      !file.startsWith('../') && !path.isAbsolute(file),
      `Escaped local dependency: ${file}`,
    );
    const source = await readFile(path.join(root, file), 'utf8');
    if (includes(file)) {
      const destination = path.join(directory, file);
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(path.join(root, file), destination);
    } else missing.push(file);
    for (const node of parse(source, { ecmaVersion: 'latest', sourceType: 'module' }).body) {
      if (
        !['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(
          node.type,
        ) ||
        !node.source
      )
        continue;
      const specifier = node.source.value;
      if (specifier.startsWith('node:')) continue;
      assert.ok(
        specifier.startsWith('.'),
        `Publisher requires an installed dependency: ${specifier}`,
      );
      await visit(path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier)));
    }
  }
  await visit(entry);
  // The checked-in package type governs the vendored .js localization module.
  // Do not manufacture module semantics absent from the real sparse checkout.
  if (includes('package.json'))
    await copyFile(path.join(root, 'package.json'), path.join(directory, 'package.json'));
  return { files: [...seen], missing };
}

for (const scenario of scenarios) {
  test(`${scenario.workflow} boots its publisher from only the declared sparse module closure`, async (t) => {
    const workflow = await readFile(path.join(root, scenario.workflow), 'utf8');
    const selected = selectedPaths(workflow, scenario.step);
    const directory = await mkdtemp(path.join(tmpdir(), 'revealline-sparse-publisher-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const closure = await sparseModules(scenario.entry, selected, directory);
    const entry = path.join(directory, scenario.entry);
    const args = scenario.usage
      ? [entry, 'invalid-review-command']
      : [
          '--input-type=module',
          '--eval',
          `const publisher = await import(${JSON.stringify(pathToFileURL(entry).href)}); if (typeof publisher[${JSON.stringify(scenario.exported)}] !== 'function') throw new Error('Publisher export unavailable');`,
        ];
    const result = spawnSync(process.execPath, args, {
      cwd: directory,
      env: { PATH: process.env.PATH },
      encoding: 'utf8',
      timeout: 15000,
      maxBuffer: 1024 * 1024,
    });
    assert.ifError(result.error);
    const evidence = `${result.stderr}\nMissing workflow paths: ${closure.missing.join(', ')}`;
    assert.equal(result.status, scenario.usage ? 1 : 0, evidence);
    if (scenario.usage) assert.equal(result.stderr.trim(), scenario.usage, evidence);
    else assert.equal(result.stderr, '', evidence);
    assert.deepEqual(closure.missing, [], evidence);
  });
}
