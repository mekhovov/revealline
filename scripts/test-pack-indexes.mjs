import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPackIndexes, readPackJSON } from './pack-indexes.mjs';
import { generatePackCatalogs } from './generate-pack-catalogs.mjs';
import { expansionSources } from './verify-packs.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const index = (packs) => ({ format: 'xonix-pack-index.v1', packs });
const ref = (id) => ({ id, path: `${id}.json` });
async function fixture(t) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'pack-indexes-'));
  t.after(() => fs.rm(base, { recursive: true, force: true }));
  const packs = path.join(base, 'game/content/packs');
  await fs.mkdir(packs, { recursive: true });
  const write = (name, value) => fs.writeFile(path.join(packs, name), JSON.stringify(value));
  for (const id of ['night-shift', 'living-threads'])
    await fs.copyFile(
      path.join(root, `game/content/packs/${id}.json`),
      path.join(packs, `${id}.json`),
    );
  await write('index.json', index([ref('night-shift')]));
  await write('archive-index.json', index([ref('living-threads')]));
  return { base, packs, write };
}

test('active and archive navigation are exact generated authority for all twelve immutable editions', async () => {
  const sources = await readPackIndexes(root);
  assert.equal(sources.active.length, 8);
  assert.equal(sources.archive.length, 4);
  assert.deepEqual(
    sources.active.slice(0, 2).map((entry) => entry.id),
    ['fpv-arcade-r5', 'fpv-pressure-frontier'],
  );
  assert.deepEqual(
    sources.archive.map((entry) => entry.id),
    ['fpv-arcade-r4', 'fpv-arcade-r3', 'fpv-arcade-r2', 'fpv-arcade'],
  );
  assert.equal(new Set(sources.all.map((entry) => entry.id)).size, 12);
  assert.deepEqual(await generatePackCatalogs(), { active: 8, archive: 4, total: 12 });
});

test('archive index rejects cross-list duplicate IDs/paths, metadata-as-pack, malformed fields and traversal', async (t) => {
  const { base, write } = await fixture(t);
  for (const value of [
    index([ref('night-shift')]),
    index([{ id: 'different', path: 'night-shift.json' }]),
    index([{ id: 'escape', path: '../outside.json' }]),
    index([{ id: 'escape', path: 'nested/../../outside.json' }]),
    index([{ ...ref('living-threads'), optional: true }]),
    { ...index([]), unexpected: true },
    { format: 'unknown', packs: [] },
  ]) {
    await write('archive-index.json', value);
    await assert.rejects(readPackIndexes(base));
  }
  await write('archive-index.json', index([{ id: 'archive-index', path: 'archive-index.json' }]));
  await assert.rejects(generatePackCatalogs({ root: base, write: true }), /Invalid indexed pack/);
});

test('catalog generation validates archived pack content before writing either catalog and never alters pack bytes', async (t) => {
  const { base, packs, write } = await fixture(t);
  const file = path.join(packs, 'living-threads.json'),
    original = await fs.readFile(file);
  assert.deepEqual(await generatePackCatalogs({ root: base, write: true }), {
    active: 1,
    archive: 1,
    total: 2,
  });
  const before = await Promise.all(
    ['catalog.json', 'archive-catalog.json'].map((name) => fs.readFile(path.join(packs, name))),
  );
  const broken = JSON.parse(original);
  broken.id = 'foreign-pack';
  await write('living-threads.json', broken);
  await assert.rejects(generatePackCatalogs({ root: base, write: true }), /does not match/);
  for (const [i, name] of ['catalog.json', 'archive-catalog.json'].entries())
    assert.deepEqual(await fs.readFile(path.join(packs, name)), before[i]);
  await fs.writeFile(file, original);
  await generatePackCatalogs({ root: base, write: true });
  assert.deepEqual(await fs.readFile(file), original);
  const stale = JSON.parse(before[1]);
  stale.packs[0].campaigns[0].levels[0].name = 'Stale label';
  await write('archive-catalog.json', stale);
  await assert.rejects(generatePackCatalogs({ root: base }), /needs generation/);
});

test('optional missing archive supports old sources; a present symlink or oversized source cannot be treated as absent', async (t) => {
  const { base, packs } = await fixture(t);
  await fs.rm(path.join(packs, 'archive-index.json'));
  assert.equal((await readPackIndexes(base)).hasArchive, false);
  await fs.writeFile(path.join(packs, 'archive-catalog.json'), '{}');
  await assert.rejects(readPackIndexes(base), /requires its archive index/);
  await fs.rm(path.join(packs, 'archive-catalog.json'));
  await fs.symlink(path.join(packs, 'index.json'), path.join(packs, 'archive-index.json'));
  await assert.rejects(readPackIndexes(base), /symbolic links/);
  await fs.rm(path.join(packs, 'archive-index.json'));
  await fs.writeFile(path.join(packs, 'archive-index.json'), ' '.repeat(65537));
  await assert.rejects(readPackIndexes(base), /bounded regular/);
  await assert.rejects(readPackJSON(base, '../elsewhere.json', 100), /Unsafe/);
});

test('proof batch budget rejects during sequential loading before reading any remaining source', async (t) => {
  const { base, packs, write } = await fixture(t);
  await fs.rm(path.join(packs, 'archive-index.json'));
  const entries = ['one', 'two', 'three', 'unread-missing'].map(ref);
  await write('index.json', index(entries));
  // Each source is individually below24 MiB. The third crosses the unchanged
  // combined64 MiB bound; trying to load the fourth would produce ENOENT instead.
  const payload = 'x'.repeat(23 * 1024 * 1024);
  for (const { id, path: name } of entries.slice(0, 3)) await write(name, { id, payload });
  await assert.rejects(expansionSources({ sourceRoot: base }), /batch exceeds its byte budget/);
});
