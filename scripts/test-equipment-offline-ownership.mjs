import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { addOfflineEntries } from './game-cli.mjs';
import { downloadFiles } from '../game/download-catalogue.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const equipmentPath = 'game/content/packs/equipment-workshop.json';
const owner = 'chapter:equipment-workshop';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const read = (name) => readFile(new URL('../' + name, import.meta.url));

async function fixture() {
  const index = JSON.parse(await read('game/content/mission-library-index.json'));
  const missions = index.missions.filter((row) => row.packId === 'equipment-workshop');
  const body = await read(equipmentPath);
  const pin = { path: equipmentPath, bytes: body.length, sha256: digest(body) };
  assert.equal(pin.bytes, 11127024);
  assert.equal(pin.sha256, 'a015f79c47d8bac6cd09ba04e50c0c98d759e523eea7d225edbe62a8a5254054');
  const equipmentMissions = missions.filter((row) => row.packId === 'equipment-workshop');
  assert.equal(equipmentMissions.length, 3);
  for (const mission of equipmentMissions) assert.deepEqual(mission.sourceFile, pin);
  // Exercise the real production ownership/finalization path with real content,
  // without preparing the complete runtime, source projections or release ZIP.
  const entries = [
    {
      name: 'game/index.html',
      bytes: Buffer.from('<html><head></head><body>Ownership fixture</body></html>'),
    },
    { name: 'game/offline.mjs', bytes: Buffer.from('export {};') },
    {
      name: 'game/content/mission-library-index.json',
      bytes: Buffer.from(JSON.stringify({ ...index, missions })),
    },
    { name: 'game/content/packs/index.json', bytes: await read('game/content/packs/index.json') },
    { name: equipmentPath, bytes: body },
  ];
  return { entries, equipmentMissions, pin };
}

const prepare = (entries) =>
  addOfflineEntries(
    root,
    entries,
    { version: 'equipment-ownership-fixture', sourceRevision: 'a'.repeat(40) },
    { optionalOffline: [] },
  );
const json = (entries, name) => JSON.parse(entries.find((entry) => entry.name === name).bytes);

test('Workshop download ownership preserves its exact selectable body and all three missions', async () => {
  const { entries, equipmentMissions, pin } = await fixture();
  await prepare(entries);
  const offline = json(entries, 'offline-cache.json');
  const catalogue = json(entries, 'offline-content.json');
  assert(!offline.files.some((entry) => entry.path === equipmentPath));
  assert(offline.files.some((entry) => entry.path === 'game/content/packs/index.json'));
  assert.deepEqual(
    offline.downloadFiles.filter((entry) => entry.path === equipmentPath),
    [{ ...pin, kind: 'gameplay' }],
  );
  const chapter = catalogue.groups.find((group) => group.id === owner);
  assert.deepEqual(chapter.files, [equipmentPath]);
  assert.deepEqual(chapter.requires, ['shared']);
  assert.deepEqual(chapter.modes, ['solo', 'versus']);
  assert.equal(chapter.current, true);
  assert.equal(chapter.category, 'chapter');
  assert.deepEqual(downloadFiles(catalogue, [owner]), [{ ...pin, kind: 'gameplay' }]);
  for (const mission of equipmentMissions) {
    const emitted = catalogue.missions.find((row) => row.id === mission.id);
    assert.deepEqual(emitted.groups, [owner]);
    assert.deepEqual(downloadFiles(catalogue, emitted.groups), [{ ...pin, kind: 'gameplay' }]);
  }
});

for (const mutation of ['missing', 'same-length corrupt'])
  test(`Workshop download ownership rejects a ${mutation} shipped body before publishing metadata`, async () => {
    const { entries } = await fixture();
    const index = entries.findIndex((entry) => entry.name === equipmentPath);
    if (mutation === 'missing') entries.splice(index, 1);
    else entries[index].bytes[entries[index].bytes.length - 1] ^= 1;
    await assert.rejects(prepare(entries), /Offline mission has no exact shipped dependency/);
    for (const name of ['offline-content.json', 'offline-cache.json', 'service-worker.js'])
      assert(!entries.some((entry) => entry.name === name), name);
  });
