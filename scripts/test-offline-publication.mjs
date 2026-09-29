import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { buildOfflineContent, buildOfflineInventory } from './offline-content.mjs';
import { downloadFiles } from '../game/download-catalogue.mjs';
import { soundtrackDownloadVolumes } from '../game/soundtrack-download-volumes.mjs';
import { SOUNDTRACK_CATALOGUE } from '../game/content/soundtrack-catalogue.mjs';
import {
  addOfflineLauncher,
  LAUNCHER_CATALOG_KEYS,
  LAUNCHER_FILE_LIMIT,
  LAUNCHER_NAVIGATION_FILES,
} from './offline-launcher.mjs';
import { publishOfflineLauncher } from '../publishing/pages-controller/launcher.mjs';
import { validateEditionCodeClosure } from './compile-edition.mjs';

test('all official missions have gameplay-only closure and soundtrack groups exactly match Audio settings', async () => {
  const pack = Buffer.from('{"id":"chapter"}'),
    sha256 = createHash('sha256').update(pack).digest('hex');
  const entries = [
    { name: 'game/pack.json', bytes: pack },
    {
      name: 'game/content/mission-library-index.json',
      bytes: Buffer.from(
        JSON.stringify({
          missions: [
            {
              id: 'mission',
              packId: 'chapter',
              modes: ['solo'],
              sourceFile: { path: 'game/pack.json', bytes: pack.length, sha256 },
            },
          ],
        }),
      ),
    },
  ];
  const catalogue = await buildOfflineContent(entries, new Set(['game/pack.json']), '1.0.0');
  assert.equal(catalogue.missions.length, 1);
  assert.deepEqual(
    downloadFiles(catalogue, catalogue.missions[0].groups).map((file) => file.path),
    ['game/pack.json'],
  );
  assert.deepEqual(
    catalogue.groups.filter((group) => group.kind === 'soundtrack').map((group) => group.id),
    soundtrackDownloadVolumes(SOUNDTRACK_CATALOGUE).map(
      (volume) => `music:${volume.playlistId || volume.id}`,
    ),
  );
  const inventory = buildOfflineInventory(entries, catalogue, []);
  assert.equal(inventory.sizes.gameplayBytes, pack.length);
  assert.equal(
    inventory.files.filter((file) => file.kind === 'soundtrack').length,
    catalogue.files.filter((file) => file.kind === 'soundtrack').length,
  );
  assert.ok(inventory.sizes.soundtrackBytes > 330 * 1048576);
  const broken = entries.map((entry) => ({ ...entry, bytes: Buffer.from(entry.bytes) }));
  broken[0].bytes = Buffer.from('wrong');
  await assert.rejects(
    buildOfflineContent(broken, new Set(['game/pack.json']), '1.0.0'),
    /exact shipped dependency/,
  );
});

test('publisher copies only the frozen lightweight launcher and points at the immutable edition', async (t) => {
  const root = path.resolve(import.meta.dirname, '..'),
    entries = [{ name: 'game/installed-app.mjs', bytes: Buffer.from('') }];
  for (const size of [180, 192, 512])
    entries.push({ name: `icons/icon-${size}.png`, bytes: Buffer.from('fixture icon') });
  await addOfflineLauncher(root, entries, '1.0.0');
  const launcher = new Map(
    entries
      .filter((entry) => entry.name.startsWith('app/'))
      .map((entry) => [entry.name, entry.bytes]),
  );
  validateEditionCodeClosure(launcher);
  const dependencies = [
    'edition-context.mjs',
    'profile-writer.mjs',
    'i18n/index.mjs',
    'i18n/bootstrap.mjs',
    'i18n/catalogs.mjs',
    'i18n/style.css',
    'vendor/i18next-26.4.2.min.js',
    ...LAUNCHER_NAVIGATION_FILES,
    'i18n/content-registry.mjs',
    'navigation.css',
  ];
  const workerSource = launcher.get('app/service-worker.js').toString();
  const workerConfig = JSON.parse(workerSource.match(/const CONFIG = (\{[^\n]+\});/)[1]);
  const workerFiles = new Map(workerConfig.files.map((file) => [file.path, file]));
  for (const name of dependencies) {
    const bytes = launcher.get(`app/${name}`);
    assert.ok(bytes, name);
    assert.ok(bytes.length <= LAUNCHER_FILE_LIMIT, name);
    assert.deepEqual(workerFiles.get(name), {
      path: name,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }
  const prefix = 'globalThis.RevealLineTranslations = ';
  const catalogSource = launcher.get('app/i18n/catalogs.mjs').toString();
  const resources = JSON.parse(
    catalogSource.slice(catalogSource.indexOf(prefix) + prefix.length, -2),
  );
  for (const language of ['en', 'uk'])
    for (const [namespace, keys] of Object.entries(LAUNCHER_CATALOG_KEYS))
      assert.ok(keys.every((key) => Object.hasOwn(resources[language][namespace], key)));
  assert.ok(catalogSource.length < LAUNCHER_FILE_LIMIT);
  assert.ok(launcher.get('app/i18n/content-registry.mjs').length < 256);
  for (const language of ['en', 'uk']) {
    assert.ok(resources[language].interface.controllerReady);
    assert.ok(resources[language].common['controls.south']);
    assert.ok(resources[language].controllerEditor.done);
    assert.ok(!resources[language].content);
  }
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'revealline-launcher-test-'));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  const source = path.join(temp, 'frozen'),
    output = path.join(temp, 'published');
  for (const entry of entries.filter((entry) => entry.name.startsWith('app/'))) {
    await fs.mkdir(path.dirname(path.join(source, entry.name)), { recursive: true });
    await fs.writeFile(path.join(source, entry.name), entry.bytes);
  }
  assert.equal(await publishOfflineLauncher(source, output, 'v1.0.0'), true);
  const manifest = JSON.parse(await fs.readFile(path.join(output, 'app/manifest.webmanifest')));
  assert.equal(manifest.id, './');
  assert.equal(manifest.scope, '../');
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(output, 'app/current.json'))), {
    version: 'v1.0.0',
    scope: '../releases/v1.0.0/site/',
  });
  assert.equal(
    await fs.readFile(path.join(output, 'app/service-worker.js'), 'utf8'),
    await fs.readFile(path.join(source, 'app/service-worker.js'), 'utf8'),
  );
  assert.deepEqual(await fs.readdir(output), ['app']);
  const published = new Map();
  async function collect(directory, prefix = 'app') {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await collect(file, `${prefix}/${entry.name}`);
      else published.set(`${prefix}/${entry.name}`, await fs.readFile(file));
    }
  }
  await collect(path.join(output, 'app'));
  assert.equal(published.size, 17 + LAUNCHER_NAVIGATION_FILES.length + 2);
  validateEditionCodeClosure(published);
  const navigationPath = path.join(source, 'app/ui/controller-navigation.mjs');
  const navigationBytes = await fs.readFile(navigationPath);
  await fs.rm(navigationPath);
  await assert.rejects(
    publishOfflineLauncher(source, path.join(temp, 'broken-navigation'), 'v1.0.0'),
    /missing an imported dependency: ui\/controller-navigation\.mjs/,
  );
  await fs.writeFile(navigationPath, Buffer.alloc(LAUNCHER_FILE_LIMIT + 1));
  await assert.rejects(
    publishOfflineLauncher(source, path.join(temp, 'oversize-navigation'), 'v1.0.0'),
    /exceeded its file budget: ui\/controller-navigation\.mjs/,
  );
  await fs.writeFile(navigationPath, navigationBytes);
  const profileWriter = await fs.readFile(path.join(source, 'app/profile-writer.mjs'));
  await fs.rm(path.join(source, 'app/profile-writer.mjs'));
  await assert.rejects(
    publishOfflineLauncher(source, path.join(temp, 'broken-profile'), 'v1.0.0'),
    /missing an imported dependency: profile-writer\.mjs/,
  );
  await fs.writeFile(path.join(source, 'app/profile-writer.mjs'), profileWriter);
  await fs.rm(path.join(source, 'app/i18n/catalogs.mjs'));
  await assert.rejects(
    publishOfflineLauncher(source, path.join(temp, 'broken-catalog'), 'v1.0.0'),
    /missing an imported dependency: i18n\/catalogs\.mjs/,
  );
  // Historical frozen launchers with no such imports remain byte-preserving.
  await fs.writeFile(path.join(source, 'app/installed-app.mjs'), 'export const historical = true;');
  await fs.writeFile(path.join(source, 'app/app.mjs'), 'export const historical = true;');
  await fs.writeFile(
    path.join(source, 'app/index.html'),
    '<!doctype html><link rel="stylesheet" href="app.css"><script type="module" src="app.mjs"></script>',
  );
  assert.equal(await publishOfflineLauncher(source, path.join(temp, 'historical'), 'v1.0.0'), true);
  assert.equal((await fs.readdir(path.join(temp, 'historical/app'))).length, 10);
});
