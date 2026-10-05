// In-memory admission/closure check against the actual source tree. No release
// artifacts are published or written, and no admission checks are disabled.
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  collectEditionEngineFiles,
  collectEditionSelectedFiles,
  compileEdition,
} from '../../../scripts/compile-edition.mjs';
import { editionMenuSceneResources } from '../../../scripts/edition-runtime.mjs';
import { LAUNCHER_NAVIGATION_FILES } from '../../../scripts/offline-launcher.mjs';
import { COMPANY_PACKAGE_BUDGET } from '../../editions/package-budget.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const revision = () =>
  execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const sourceRevision = revision();
const captureStartedAt = new Date().toISOString();
const capturedInputs = new Map();
const changedDuringRead = new Set();
const diskRead = (name) => fs.readFile(new URL(`../../../${name}`, import.meta.url));
const remember = (name, bytes) => {
  const record = { path: name, bytes: bytes.length, sha256: hash(bytes) };
  const previous = capturedInputs.get(name);
  if (previous && (previous.bytes !== record.bytes || previous.sha256 !== record.sha256))
    changedDuringRead.add(name);
  else if (!previous) capturedInputs.set(name, record);
  return bytes;
};
const read = async (name) => remember(name, await diskRead(name));
const catalog = JSON.parse(await read('game/editions/catalog.json'));
const { version } = JSON.parse(await read('game/build-config.json'));
assert.match(version, /^v?\d+\.\d+\.\d+$/, 'Offline verification needs the existing build version');
const engine = await collectEditionEngineFiles({ root });
// The engine collector stores raw filesystem bytes. Projection happens later,
// inside compileEdition, and must never be compared with the unprojected source.
for (const [name, bytes] of engine) remember(name, bytes);

// Offline composition also reads this finite closure directly from disk, rather
// than from the supplied Map. Capture it before the first compile as well.
const directReadInputs = [
  ...LAUNCHER_NAVIGATION_FILES.map((name) => 'game/' + name),
  'game/i18n/index.mjs',
  'game/i18n/bootstrap.mjs',
  'game/i18n/style.css',
  'game/vendor/i18next-26.4.2.min.js',
  'game/offline/navigation.css',
  'game/edition-context.mjs',
  'game/editions/offline-client.mjs',
  ...['en', 'uk'].flatMap((language) =>
    ['common', 'interface', 'gameplay', 'controllerEditor', 'errors'].map(
      (namespace) => `game/locales/${language}/${namespace}.json`,
    ),
  ),
];
for (const name of directReadInputs) await read(name);
const limits = { files: COMPANY_PACKAGE_BUDGET.maxFiles, bytes: COMPANY_PACKAGE_BUDGET.maxBytes };
const editions = [];
for (const edition of catalog.editions) {
  const diagnostics = { sourceRevision };
  try {
    const files = new Map(engine);
    for (const [name, bytes] of await collectEditionSelectedFiles({
      catalog,
      editionIds: [edition.id],
      read,
    })) {
      files.set(name, bytes);
    }
    const input = [...files]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, bytes]) => [name, bytes.length, hash(bytes)]);
    diagnostics.inputInventorySha256 = hash(JSON.stringify(input));
    diagnostics.engineFiles = engine.size;
    const compiled = await compileEdition({
      catalog,
      editionIds: [edition.id],
      files,
      enginePaths: [...engine.keys()],
      version,
      sourceRevision,
      offline: { basePath: '/verification/' },
    });
    const required = [
      'game/ui/native-menus.mjs',
      'game/ui/native-menu.css',
      'game/ui/native-menu-icons.mjs',
      'game/ui/fonts/departure-mono/DepartureMono-Regular.woff2',
      'game/ui/fonts/departure-mono/LICENSE',
      ...editionMenuSceneResources([edition.id]),
    ];
    for (const name of required) assert.ok(compiled.files.has(name), `Missing ${name}`);
    const modeArt = [...compiled.files.keys()].filter((name) =>
      /menu-scenes\/(fpv|ukraine|retro|coupa)-(versus|team)(-portrait)?\.webp$/.test(name),
    );
    assert.deepEqual(modeArt, [], 'Solo editions must exclude multiplayer scenery');
    const manualFixtures = [...compiled.files.keys()].filter((name) =>
      name.startsWith('game/test/'),
    );
    assert.deepEqual(manualFixtures, [], 'Verification fixtures must stay outside player packages');
    const outputBytes = [...compiled.files.values()].reduce(
      (total, bytes) => total + bytes.length,
      0,
    );
    const output = [...compiled.files]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, bytes]) => [name, bytes.length, hash(bytes)]);
    Object.assign(diagnostics, {
      outputFiles: compiled.files.size,
      outputBytes,
      byteHeadroom: limits.bytes - outputBytes,
      outputInventorySha256: hash(JSON.stringify(output)),
    });
    diagnostics.largestFiles = [...output]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([path, bytes]) => ({ path, bytes }));
    diagnostics.generatedInventories = output
      .filter(([name]) =>
        [
          'offline-cache.json',
          'service-worker.js',
          'app/service-worker.js',
          'edition-build.json',
        ].includes(name),
      )
      .map(([path, bytes]) => ({ path, bytes }));
    // Check the returned artifact, including manifests and workers generated
    // after the offline builder checks its cache inventory's own limits.
    assert.ok(compiled.files.size <= limits.files, 'Final edition exceeds 2000 files');
    assert.ok(
      outputBytes <= limits.bytes,
      `Final edition exceeds ${COMPANY_PACKAGE_BUDGET.maxBytes / 1024 / 1024} MiB`,
    );
    editions.push({
      edition: edition.id,
      passed: true,
      sourceRevision,
      inputInventorySha256: hash(JSON.stringify(input)),
      engineFiles: engine.size,
      outputFiles: compiled.files.size,
      outputBytes,
      outputInventorySha256: hash(JSON.stringify(output)),
      requiredMenuFiles: required.length,
      multiplayerSceneFiles: modeArt.length,
      manualFixtureFiles: manualFixtures.length,
    });
    process.stderr.write(
      `${edition.id}: ${compiled.files.size} files, ${outputBytes} bytes; passed\n`,
    );
  } catch (error) {
    if (Number.isSafeInteger(error.outputFiles) && Number.isSafeInteger(error.outputBytes))
      Object.assign(diagnostics, {
        outputFiles: error.outputFiles,
        outputBytes: error.outputBytes,
        byteHeadroom: limits.bytes - error.outputBytes,
      });
    editions.push({ edition: edition.id, passed: false, ...diagnostics, error: error.message });
    process.stderr.write(`${edition.id}: ${error.message}\n`);
  }
}
const sourceChanges = [];
const inputInventory = [...capturedInputs.values()].sort((a, b) => a.path.localeCompare(b.path));
for (const before of inputInventory) {
  try {
    const bytes = await diskRead(before.path);
    const after = { bytes: bytes.length, sha256: hash(bytes) };
    if (
      changedDuringRead.has(before.path) ||
      before.bytes !== after.bytes ||
      before.sha256 !== after.sha256
    )
      sourceChanges.push({
        ...before,
        after,
        changedDuringRead: changedDuringRead.has(before.path),
      });
  } catch (error) {
    sourceChanges.push({ ...before, error: error.message });
  }
}
const sourceRevisionAtFinish = revision();
const passed = editions.every((edition) => edition.passed) && sourceChanges.length === 0;
process.stdout.write(
  `${JSON.stringify(
    {
      format: 'fpv-line-edition-package-verification.v2',
      date: new Date().toISOString(),
      scope:
        'In-memory working-tree capture with offline manifests and normal admission. The existing version is metadata only. No immutable HEAD, native build, installed offline run or publication qualification.',
      version,
      limits,
      sourceCapture: {
        kind: 'working-tree',
        startedAt: captureStartedAt,
        finishedAt: new Date().toISOString(),
        sourceRevisionAtStart: sourceRevision,
        sourceRevisionAtFinish,
        headUnchanged: sourceRevision === sourceRevisionAtFinish,
        unchanged: sourceChanges.length === 0,
        inputFiles: inputInventory.length,
        inputInventorySha256: hash(JSON.stringify(inputInventory)),
        inputInventory,
        changes: sourceChanges,
      },
      passed,
      editions,
    },
    null,
    2,
  )}\n`,
);
if (!passed) process.exitCode = 1;
