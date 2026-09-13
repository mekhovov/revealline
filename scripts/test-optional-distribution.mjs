import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink, realpath } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { buildProject, collectBuildFiles } from './game-cli.mjs';
import { readOptionalDistributionEntries } from './optional-distribution.mjs';
const source = fileURLToPath(new URL('../', import.meta.url));
const all = JSON.parse(await readFile(path.join(source, 'game/content/optional-worlds.json')));
const item = all.packs[0];
async function fixture(t, chapter = item) {
  const dir = await realpath(await mkdtemp(path.join(os.tmpdir(), 'revealline-optional-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const root = path.join(dir, 'source'),
    out = path.join(dir, 'out');
  const put = async (name, value) => {
    await mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await writeFile(path.join(root, name), value);
  };
  await put('game/index.html', '<!doctype html><html><head></head><body>Fixture</body></html>');
  await put('game/offline.mjs', 'export const present = true;\n');
  await put(
    'game/offline/service-worker.template.js',
    await readFile(path.join(source, 'game/offline/service-worker.template.js')),
  );
  await put('game/content/optional-worlds.json', JSON.stringify({ ...all, packs: [chapter] }));
  await put(chapter.path, await readFile(path.join(source, chapter.path)));
  const config = { version: 'fixture-1', entry: 'game/index.html', include: ['game'] };
  const saveConfig = () => put('game/build-config.json', JSON.stringify(config));
  await saveConfig();
  const optIn = {
    format: 'revealline-optional-distribution.v1',
    catalog: 'game/content/optional-worlds.json',
  };
  return { root, out, dir, put, config, saveConfig, optIn };
}
test('absent versioned opt-in preserves complete build bytes regardless of optional source bodies', async (t) => {
  const f = await fixture(t);
  await buildProject(f);
  const first = await readFile(path.join(f.out, 'distribution.zip'));
  await f.put(item.path, 'not included and not parsed');
  await buildProject(f);
  assert.deepEqual(await readFile(path.join(f.out, 'distribution.zip')), first);
  assert.equal((await collectBuildFiles(f.root)).includes(item.path), false);
  assert.deepEqual(await readOptionalDistributionEntries(f.root), []);
});
test('explicit optional publication is complete in manifest/ZIP and absent from automatic core cache', async (t) => {
  const f = await fixture(t);
  f.config.optionalChapters = f.optIn;
  await f.saveConfig();
  await buildProject(f);
  const manifest = JSON.parse(await readFile(path.join(f.out, 'manifest.json'))),
    offline = JSON.parse(await readFile(path.join(f.out, 'offline-cache.json')));
  const record = manifest.files.find((entry) => entry.path === item.path);
  assert.equal(record.bytes, item.bytes);
  assert.equal(record.sha256, item.sha256);
  assert.deepEqual(
    await readFile(path.join(f.out, item.path)),
    await readFile(path.join(source, item.path)),
  );
  assert.equal(
    offline.files.some((entry) => entry.path === item.path),
    false,
  );
  assert.equal(
    offline.files.some((entry) => entry.path === f.optIn.catalog),
    true,
  );
  assert.ok(offline.files.reduce((total, entry) => total + entry.bytes, 0) < 64 * 1048576);
  const zip = await readFile(path.join(f.out, 'distribution.zip'));
  assert.ok(
    zip.includes(Buffer.from(item.path)) &&
      zip.includes(await readFile(path.join(source, item.path))),
  );
  assert.ok(
    !manifest.files.some(
      (entry) => entry.path.includes('/originals/') || entry.path.includes('/prompts/'),
    ),
  );
  const again = path.join(f.dir, 'same');
  await buildProject({ root: f.root, out: again });
  assert.deepEqual(await readFile(path.join(again, 'distribution.zip')), zip);
});
test('bad optional hash, path, symbolic source and duplicate default inclusion preserve prior output', async (t) => {
  const f = await fixture(t);
  await buildProject(f);
  const before = await readFile(path.join(f.out, 'distribution.zip'));
  f.config.optionalChapters = f.optIn;
  await f.saveConfig();
  await f.put(item.path, 'bad');
  await assert.rejects(buildProject(f), /hash differs/);
  assert.deepEqual(await readFile(path.join(f.out, 'distribution.zip')), before);
  await f.put(
    'game/content/optional-worlds.json',
    JSON.stringify({ ...all, packs: [{ ...item, path: '../foreign.json' }] }),
  );
  await assert.rejects(buildProject(f), /exact local distribution/);
  await f.put('game/content/optional-worlds.json', JSON.stringify({ ...all, packs: [item] }));
  await rm(path.join(f.root, item.path));
  await symlink(path.join(source, item.path), path.join(f.root, item.path));
  await assert.rejects(buildProject(f), /symbolic links/);
  await rm(path.join(f.root, item.path));
  await f.put(item.path, await readFile(path.join(source, item.path)));
  f.config.include.push(item.path);
  await f.saveConfig();
  await assert.rejects(buildProject(f), /outside automatic build/);
  assert.deepEqual(await readFile(path.join(f.out, 'distribution.zip')), before);
});

test('Route Choices publishes its exact original body once in loose/manifest/ZIP while core preparation stays small', async (t) => {
  const chapter = all.packs.find((entry) => entry.id === 'fpv-route-choices');
  assert.ok(chapter);
  const f = await fixture(t, chapter);
  f.config.optionalChapters = f.optIn;
  await f.saveConfig();
  assert.equal((await collectBuildFiles(f.root)).includes(chapter.path), false);
  await buildProject({ ...f, version: 'v0.34.0', sourceRevision: 'a'.repeat(40) });
  const manifest = JSON.parse(await readFile(path.join(f.out, 'manifest.json'))),
    offline = JSON.parse(await readFile(path.join(f.out, 'offline-cache.json'))),
    original = await readFile(path.join(source, chapter.path));
  const entries = manifest.files.filter((entry) => entry.path === chapter.path);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].sha256, chapter.sha256);
  assert.equal(entries[0].bytes, original.length);
  assert.deepEqual(await readFile(path.join(f.out, chapter.path)), original);
  assert.equal(
    offline.files.some((entry) => entry.path === chapter.path),
    false,
  );
  assert.ok(offline.files.some((entry) => entry.path === f.optIn.catalog));
  assert.ok(offline.optionalPacks.some((entry) => entry.path === chapter.path));
  assert.ok(offline.files.reduce((total, entry) => total + entry.bytes, 0) < 64 * 1048576);
  const zip = await readFile(path.join(f.out, 'distribution.zip'));
  let offset = 0,
    matches = 0;
  while (zip.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(zip.readUInt16LE(offset + 8), 0);
    const length = zip.readUInt32LE(offset + 18),
      nameLength = zip.readUInt16LE(offset + 26),
      extraLength = zip.readUInt16LE(offset + 28),
      start = offset + 30 + nameLength + extraLength,
      name = zip.subarray(offset + 30, offset + 30 + nameLength).toString();
    if (name === chapter.path) {
      matches++;
      assert.deepEqual(zip.subarray(start, start + length), original);
    }
    offset = start + length;
  }
  assert.equal(zip.readUInt32LE(offset), 0x02014b50);
  assert.equal(matches, 1);
  assert.equal(
    manifest.files.some((entry) => /\/originals\/|\/routes\.json$/.test(entry.path)),
    false,
  );
});
