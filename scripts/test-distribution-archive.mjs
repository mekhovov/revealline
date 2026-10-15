import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  buildProject,
  createZip,
  crc32,
  DISTRIBUTION_ARCHIVE_FORMAT,
  MAX_DISTRIBUTION_EXPANDED_BYTES,
  readBuildConfig,
} from './game-cli.mjs';
import { distributionArchive } from './controller-confirm-browser-fixture.mjs';

const contract = {
  format: DISTRIBUTION_ARCHIVE_FORMAT,
  maxExpandedBytes: MAX_DISTRIBUTION_EXPANDED_BYTES,
};
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function fixture(t, admitted = true) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'distribution-archive-')));
  t.after(() => fs.rm(root, { force: true, recursive: true }));
  await fs.mkdir(path.join(root, 'game'));
  const config = {
    version: '0.1.0',
    entry: 'game/index.html',
    include: ['game'],
    ...(admitted ? { distributionArchive: contract } : {}),
  };
  await fs.writeFile(path.join(root, 'game/build-config.json'), JSON.stringify(config));
  await fs.writeFile(
    path.join(root, 'game/index.html'),
    `<head></head><main>${'complete original '.repeat(4000)}</main>`,
  );
  await fs.writeFile(path.join(root, 'game/license.txt'), 'Retained license text.');
  const noise = Buffer.concat(
    Array.from({ length: 512 }, (_, index) =>
      createHash('sha256').update(`noise-${index}`).digest(),
    ),
  );
  await fs.writeFile(path.join(root, 'game/original.bin'), noise);
  return { root, out: path.join(root, 'output'), config, sourceRevision: 'a'.repeat(40) };
}
function directory(zip) {
  const rows = [];
  let cursor = zip.readUInt32LE(zip.length - 6);
  while (zip.readUInt32LE(cursor) === 0x02014b50) {
    const nameLength = zip.readUInt16LE(cursor + 28);
    const local = zip.readUInt32LE(cursor + 42);
    rows.push({
      name: zip.subarray(cursor + 46, cursor + 46 + nameLength).toString(),
      cursor,
      local,
      method: zip.readUInt16LE(cursor + 10),
      size: zip.readUInt32LE(cursor + 20),
      start: local + 30 + nameLength,
    });
    cursor += 46 + nameLength;
  }
  return rows;
}
async function readAll(t, file, manifest) {
  const reader = await distributionArchive(file);
  t.after(() => reader.close());
  for (const row of manifest.files) {
    const bytes = await reader(row.path);
    assert.equal(bytes.length, row.bytes);
    assert.equal(sha(bytes), row.sha256);
  }
  return reader;
}

test('source-admitted complete archive is deterministic, mixed, lossless and independently readable', async (t) => {
  const f = await fixture(t);
  await buildProject(f);
  const file = path.join(f.out, 'distribution.zip');
  const first = await fs.readFile(file);
  const manifest = JSON.parse(await fs.readFile(path.join(f.out, 'manifest.json')));
  assert.deepEqual(manifest.distributionArchive, contract);
  const rows = directory(first);
  assert.ok(rows.some((row) => row.method === 8));
  assert.ok(rows.some((row) => row.method === 0));
  assert.equal(rows.find((row) => row.name === 'game/original.bin').method, 0);
  const reader = await readAll(t, file, manifest);
  assert.deepEqual(
    await reader('manifest.json'),
    await fs.readFile(path.join(f.out, 'manifest.json')),
  );
  await buildProject(f);
  assert.deepEqual(await fs.readFile(file), first);
  assert.ok(first.length < manifest.totalBytes);
});

test('unmarked builds and default createZip retain STORE bytes for optional callers', async (t) => {
  const f = await fixture(t, false);
  await buildProject(f);
  const file = path.join(f.out, 'distribution.zip');
  const archive = await fs.readFile(file);
  assert.ok(directory(archive).every((row) => row.method === 0));
  const manifest = JSON.parse(await fs.readFile(path.join(f.out, 'manifest.json')));
  assert.equal(Object.hasOwn(manifest, 'distributionArchive'), false);
  await readAll(t, file, manifest);
  const entries = [{ name: 'optional.txt', bytes: Buffer.from('repeat '.repeat(200)) }];
  const stored = createZip(entries);
  assert.deepEqual(stored, createZip(entries, { compression: 'stored' }));
  assert.equal(directory(stored)[0].method, 0);
  assert.equal(stored.readUInt32LE(14), crc32(entries[0].bytes));
  assert.throws(() => createZip(entries, { compression: 'unknown' }), /Unknown ZIP compression/);
});

test('source admission is strict, capped at the existing 1 GiB envelope and includes manifest bytes', async (t) => {
  const f = await fixture(t);
  for (const value of [
    null,
    {},
    { ...contract, format: 'future' },
    { ...contract, maxExpandedBytes: MAX_DISTRIBUTION_EXPANDED_BYTES + 1 },
    { ...contract, maxExpandedBytes: true },
    { ...contract, extra: true },
  ]) {
    await fs.writeFile(
      path.join(f.root, 'game/build-config.json'),
      JSON.stringify({ ...f.config, distributionArchive: value }),
    );
    await assert.rejects(readBuildConfig(f.root), /archive contract/);
  }
  await fs.writeFile(path.join(f.root, 'game/build-config.json'), JSON.stringify(f.config));
  await buildProject(f);
  const manifest = JSON.parse(await fs.readFile(path.join(f.out, 'manifest.json')));
  const original = await fs.readFile(path.join(f.out, 'distribution.zip'));
  // The payload fits this lower limit, but its manifest does not; preserve prior output.
  f.config.distributionArchive = { ...contract, maxExpandedBytes: manifest.totalBytes + 20 };
  await fs.writeFile(path.join(f.root, 'game/build-config.json'), JSON.stringify(f.config));
  await assert.rejects(buildProject(f), /expanded-byte bound/);
  assert.deepEqual(await fs.readFile(path.join(f.out, 'distribution.zip')), original);
});

test('reader rejects unknown methods, bad headers, overlap, CRC corruption, trailing and truncated archives', async (t) => {
  const f = await fixture(t);
  await buildProject(f);
  const original = await fs.readFile(path.join(f.out, 'distribution.zip'));
  const html = directory(original).find((row) => row.name === 'game/index.html');
  const mutations = [
    (zip) => {
      zip.writeUInt16LE(99, html.cursor + 10);
      zip.writeUInt16LE(99, html.local + 8);
    },
    (zip) => {
      zip.writeUInt16LE(0, html.local + 8);
    },
    (zip) => {
      zip.writeUInt32LE(0, html.cursor + 42);
    },
    (zip) => {
      zip[html.start] ^= 0xff;
    },
    (zip) => {
      zip.writeUInt32LE(0, html.cursor + 16);
      zip.writeUInt32LE(0, html.local + 14);
    },
    (zip) => {
      zip.writeUInt16LE(65535, zip.length - 12);
    },
  ];
  for (let index = 0; index < mutations.length; index++) {
    const zip = Buffer.from(original);
    mutations[index](zip);
    const file = path.join(f.root, `bad-${index}.zip`);
    await fs.writeFile(file, zip);
    await assert.rejects(async () => {
      let reader;
      try {
        reader = await distributionArchive(file);
        await reader('game/index.html');
      } finally {
        await reader?.close();
      }
    });
  }
  for (const [name, zip] of [
    ['trailing', Buffer.concat([original, Buffer.from('extra')])],
    ['truncated', original.subarray(0, -1)],
  ]) {
    const file = path.join(f.root, `${name}.zip`);
    await fs.writeFile(file, zip);
    await assert.rejects(distributionArchive(file));
  }
});

test('compressed unmarked archives and manifest/content hash mismatches are refused', async (t) => {
  const f = await fixture(t, false);
  await buildProject(f);
  const manifest = JSON.parse(await fs.readFile(path.join(f.out, 'manifest.json')));
  const entries = await Promise.all(
    [...manifest.files.map((row) => row.path), 'manifest.json'].map(async (name) => ({
      name,
      bytes: await fs.readFile(path.join(f.out, name)),
    })),
  );
  const file = path.join(f.root, 'unmarked-compressed.zip');
  await fs.writeFile(file, createZip(entries, { compression: 'adaptive' }));
  await assert.rejects(distributionArchive(file), /Unmarked archive/);
  entries.find((entry) => entry.name === 'game/license.txt').bytes[0] ^= 1;
  await fs.writeFile(file, createZip(entries));
  const reader = await distributionArchive(file);
  t.after(() => reader.close());
  await assert.rejects(reader('game/license.txt'), /SHA-256/);
});
