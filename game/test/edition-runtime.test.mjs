import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { projectEditionGuideScenario } from '../editions/selected-presentation.mjs';
import { createCompanyTheme } from '../company-campaigns/brands.mjs';
import { validateScenario } from '../content.mjs';
import {
  collectEditionEngineFiles,
  editionCodeDependencies,
  validateEditionCodeClosure,
} from '../../scripts/compile-edition.mjs';
import {
  EDITION_RUNTIME_ADAPTERS,
  projectEditionRuntimeImports,
  validateEditionHostRequests,
} from '../../scripts/edition-runtime.mjs';

const bytes = (text) => Buffer.from(text);
test('shared guide scenario projects selected appearance without changing a mechanic or recipe parameter', async () => {
  const source = JSON.parse(
      await fs.readFile(new URL('../content/scenarios/line-impact-demo.json', import.meta.url)),
    ),
    original = structuredClone(source),
    theme = createCompanyTheme('coupa');
  const projected = projectEditionGuideScenario(source, {
    theme,
    classes: [
      { id: 'scout', label: 'Connector', description: 'Shared practice class.', cooldown: 9999 },
    ],
  });
  assert.deepEqual(projected.level, original.level);
  assert.deepEqual(projected.settings, original.settings);
  assert.deepEqual(
    projected.classRecipes.map(({ label: _label, description: _description, ...recipe }) => recipe),
    original.classRecipes.map(({ label: _label, description: _description, ...recipe }) => recipe),
  );
  assert.deepEqual(projected.theme, theme);
  assert.deepEqual(projected.music, theme.soundtrack);
  assert.deepEqual(source, original);
  assert.equal(validateScenario(projected).valid, true);
  assert.ok(
    !JSON.stringify(projected).includes('FPV') &&
      !JSON.stringify(projected).includes('Orchard Circuit'),
  );
  const quiet = structuredClone(theme);
  delete quiet.soundtrack;
  assert.ok(
    !Object.hasOwn(
      projectEditionGuideScenario(source, { theme: quiet, classes: projected.classRecipes }),
      'music',
    ),
  );
  assert.throws(() => projectEditionGuideScenario(source, { theme, classes: [] }), /class labels/);
});
test('common host import projection closes over committed adapters without visiting historical registries', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'edition-runtime-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const originals = new Map([
    ['game/company.html', bytes('<html><script src="company-entry.mjs"></script></html>')],
    ['game/company-entry.mjs', bytes('export const canonical = "index.html";')],
    [
      'game/index.html',
      bytes(
        '<html><script src="app.mjs"></script><link rel="stylesheet" data-boot-href="ui/style.css"></html>',
      ),
    ],
    [
      'game/app.mjs',
      bytes(
        "import './content-design/route-loader.mjs'; export * from './runtime-library-sources.mjs'; import('./external-chapter-source.mjs'); import './replay-theater/examples.mjs';",
      ),
    ],
    ['game/ui/style.css', bytes('body{color:red}')],
    ['game/controller-lab/index.html', bytes('<html></html>')],
    ['game/replay-theater/index.html', bytes('<html></html>')],
    ['game/content/scenarios/line-impact-demo.json', bytes('{}')],
    ['game/editions/runtime-assets.json', bytes('[]')],
    ...Object.entries(EDITION_RUNTIME_ADAPTERS).flatMap(([request, adapter]) => [
      [request, bytes("import './MISSING_UNSELECTED_PRIVATE_SENTINEL.mjs';")],
      [adapter, bytes('export const selected = true;')],
    ]),
  ]);
  for (const [name, contents] of originals) {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.writeFile(path.join(root, name), contents);
  }
  const collected = await collectEditionEngineFiles({ root });
  for (const [request, adapter] of Object.entries(EDITION_RUNTIME_ADAPTERS)) {
    assert.ok(!collected.has(request));
    assert.ok(collected.has(adapter));
  }
  assert.ok(collected.has('game/index.html') && collected.has('game/ui/style.css'));
  assert.ok(
    collected.has('game/controller-lab/index.html') &&
      collected.has('game/replay-theater/index.html'),
  );
  assert.ok(collected.has('game/content/scenarios/line-impact-demo.json'));
  assert.deepEqual(
    collected.get('game/app.mjs'),
    originals.get('game/app.mjs'),
    'Collected source stays commit-verifiable.',
  );
  const projected = projectEditionRuntimeImports('game/app.mjs', collected.get('game/app.mjs'));
  assert.deepEqual(
    editionCodeDependencies('game/app.mjs', projected),
    Object.values(EDITION_RUNTIME_ADAPTERS).sort(),
  );
});

test('dynamic boot entry is explicit and unknown host JSON requests fail closed', () => {
  const known = "const appURL = new URL('./app.mjs', doc.currentScript.src).href; import(appURL);";
  assert.deepEqual(editionCodeDependencies('game/boot.mjs', bytes(known)), ['game/app.mjs']);
  assert.throws(
    () => editionCodeDependencies('game/other.mjs', bytes(known)),
    /Unresolved computed/,
  );
  assert.throws(
    () => editionCodeDependencies('game/boot.mjs', bytes('import(chosenPath);')),
    /Unresolved computed/,
  );
  assert.throws(
    () => editionCodeDependencies('game/boot.mjs', bytes(`// ${known}\nimport(appURL);`)),
    /Unresolved computed/,
  );
  validateEditionHostRequests(
    'game/app.mjs',
    bytes("getJSON('build-info.json'); getJSON('content/campaign.json');"),
  );
  for (const source of ["getJSON('content/private.json');", 'getJSON(chosenPath);'])
    assert.throws(
      () => validateEditionHostRequests('game/app.mjs', bytes(source)),
      /undeclared runtime JSON/,
    );
  assert.deepEqual(
    editionCodeDependencies(
      'game/replay-theater/index.html',
      bytes('<script src="../ui/direct-tool-launch.js" data-module="./app.mjs"></script>'),
    ),
    ['game/replay-theater/app.mjs', 'game/ui/direct-tool-launch.js'],
  );
  const tool =
    'const moduleURL = new URL(script.dataset.module, doc.baseURI).href; import(moduleURL);';
  assert.deepEqual(editionCodeDependencies('game/ui/direct-tool-launch.js', bytes(tool)), []);
  assert.throws(
    () => editionCodeDependencies('game/untrusted.js', bytes(tool)),
    /Unresolved computed/,
  );
  assert.throws(
    () =>
      editionCodeDependencies(
        'game/index.html',
        bytes('<script data-module="https://example.test/arbitrary.js"></script>'),
      ),
    /must be local/,
  );
});

test('declared canonical navigation and data requests must exist in the artifact', () => {
  const files = new Map([
    ['game/company.html', bytes('<html></html>')],
    ['game/index.html', bytes('<html></html>')],
    [
      'runtime-dependencies.json',
      bytes(
        JSON.stringify({
          format: 'revealline-runtime-dependencies.v1',
          entry: 'game/company.html',
          canonicalEntry: 'game/index.html',
          resources: ['game/build-config.json'],
        }),
      ),
    ],
  ]);
  assert.throws(() => validateEditionCodeClosure(files), /missing a declared runtime resource/);
  files.set('game/build-config.json', bytes('{}'));
  validateEditionCodeClosure(files);
  files.delete('game/index.html');
  assert.throws(() => validateEditionCodeClosure(files), /game\/index.html/);
});

test('shared runtime media ledger binds current font licenses, shell textures and licensed soundtrack bytes', async () => {
  const ledger = JSON.parse(
    await fs.readFile(new URL('../editions/runtime-assets.json', import.meta.url)),
  );
  const root = new URL('../../', import.meta.url);
  for (const record of ledger) {
    const payload = await fs.readFile(new URL(record.path, root));
    assert.equal(payload.length, record.bytes, record.path);
    assert.equal(createHash('sha256').update(payload).digest('hex'), record.sha256, record.path);
    for (const dependency of record.dependencies)
      assert.ok(ledger.some((entry) => entry.id === dependency));
  }
  assert.ok(ledger.some((entry) => entry.path.endsWith('.mp3')));
});
