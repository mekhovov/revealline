import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, realpath, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildProject } from './game-cli.mjs';
import {
  readExternalDistributionEntries,
  validateExternalDistributionConfig,
} from './external-distribution.mjs';
import { EXTERNAL_CATALOG } from '../game/external-chapter-catalog.mjs';
const source = fileURLToPath(new URL('../', import.meta.url));
const option = {
  format: 'revealline-external-distribution.v1',
  catalog: 'game/content/external-worlds.json',
};
const sha = (b) => createHash('sha256').update(b).digest('hex');
async function directory(t) {
  const p = await realpath(await mkdtemp(path.join(os.tmpdir(), 'revealline-external-build-')));
  t.after(() => rm(p, { recursive: true, force: true }));
  return p;
}

test('absent opt-in leaves old builds byte-identical and never reads external source', async (t) => {
  const dir = await directory(t),
    root = path.join(dir, 'source'),
    out = path.join(dir, 'out');
  await mkdir(path.join(root, 'game'), { recursive: true });
  await writeFile(
    path.join(root, 'game/index.html'),
    '<html><head></head><body>Old source</body></html>',
  );
  await writeFile(
    path.join(root, 'game/build-config.json'),
    JSON.stringify({ version: 'fixture', entry: 'game/index.html', include: ['game'] }),
  );
  await buildProject({ root, out });
  const before = await readFile(path.join(out, 'distribution.zip'));
  await mkdir(path.join(root, 'optional'), { recursive: true });
  await writeFile(path.join(root, 'optional', 'media.rlmedia'), 'excluded malformed source');
  await buildProject({ root, out });
  assert.deepEqual(await readFile(path.join(out, 'distribution.zip')), before);
  assert.deepEqual(await readExternalDistributionEntries('/not-present'), []);
  for (const bad of [
    null,
    {},
    { ...option, format: 'revealline-external-distribution.v2' },
    { ...option, catalog: '../external.json' },
    { ...option, extra: true },
  ])
    assert.throws(() => validateExternalDistributionConfig(bad));
});

test('catalog symlink and missing catalog refuse before source compiler import or output creation', async (t) => {
  const dir = await directory(t),
    root = path.join(dir, 'source');
  await mkdir(path.join(root, 'game/content'), { recursive: true });
  await assert.rejects(readExternalDistributionEntries(root, option), /ENOENT/);
  await symlink(path.join(source, option.catalog), path.join(root, option.catalog));
  await assert.rejects(readExternalDistributionEntries(root, option), /symbolic links/);
});

test('explicit real-source build ships sixteen exact generated bodies once in loose/ZIP/manifest and excludes them from all core metadata', async (t) => {
  const dir = await directory(t),
    out = path.join(dir, 'out');
  await buildProject({
    root: source,
    out,
    version: 'external-check',
    sourceRevision: 'd'.repeat(40),
  });
  const manifest = JSON.parse(await readFile(path.join(out, 'manifest.json'))),
    offline = JSON.parse(await readFile(path.join(out, 'offline-cache.json'))),
    zip = await readFile(path.join(out, 'distribution.zip'));
  const wanted = new Map(
    EXTERNAL_CATALOG.chapters.flatMap((c) => ['pack', 'media'].map((k) => [c[k].path, c[k]])),
  );
  assert.equal(wanted.size, 16);
  for (const [name, pin] of wanted) {
    const records = manifest.files.filter((f) => f.path === name);
    assert.equal(records.length, 1);
    assert.equal(records[0].bytes, pin.bytes);
    assert.equal(records[0].sha256, pin.sha256);
    const bytes = await readFile(path.join(out, name));
    assert.equal(bytes.length, pin.bytes);
    assert.equal(sha(bytes), pin.sha256);
    assert(!offline.files.some((f) => f.path === name));
    assert(!offline.optionalPacks.some((f) => f.path === name));
  }
  const counts = new Map();
  let offset = 0;
  while (zip.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(zip.readUInt16LE(offset + 8), 0);
    const bytes = zip.readUInt32LE(offset + 18),
      n = zip.readUInt16LE(offset + 26),
      extra = zip.readUInt16LE(offset + 28),
      start = offset + 30 + n + extra,
      name = zip.subarray(offset + 30, offset + 30 + n).toString();
    if (wanted.has(name)) {
      counts.set(name, (counts.get(name) || 0) + 1);
      assert.equal(sha(zip.subarray(start, start + bytes)), wanted.get(name).sha256);
    }
    offset = start + bytes;
  }
  assert.equal(zip.readUInt32LE(offset), 0x02014b50);
  assert.equal(counts.size, 16);
  assert([...counts.values()].every((n) => n === 1));
  const legacy = JSON.parse(await readFile(path.join(source, 'game/content/optional-worlds.json')));
  for (const old of legacy.packs) {
    assert(offline.optionalPacks.some((f) => f.path === old.path));
    assert.equal(manifest.files.find((f) => f.path === old.path).sha256, old.sha256);
  }
  assert.equal(offline.optionalPacks.length, 10);
  assert(offline.files.some((f) => f.path === option.catalog));
  assert(offline.files.reduce((n, f) => n + f.bytes, 0) < 64 * 1048576);
  assert(
    !manifest.files.some((f) =>
      /authoring\/library\/(route-worlds|external-chapter-pilot|ukraine-route-art|retro-route-art|spend-route-art|sentinel-circuit|sentinel-circuit-art|sentinel-circuit-external|sentinel-theme-art|sentinel-theme-chapters)\//.test(
        f.path,
      ),
    ),
  );
  const worker = await readFile(path.join(out, 'service-worker.js'), 'utf8');
  for (const name of wanted.keys())
    assert(
      !worker.includes(name),
      'No external body URL is registered in core or legacy worker metadata',
    );
});
