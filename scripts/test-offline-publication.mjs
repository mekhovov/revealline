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
import { addOfflineLauncher } from './offline-launcher.mjs';
import { publishOfflineLauncher } from '../publishing/pages-controller/launcher.mjs';

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
  assert.equal((await fs.readdir(path.join(output, 'app'))).length, 10);
});
