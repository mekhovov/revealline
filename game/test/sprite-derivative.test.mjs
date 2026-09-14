import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { inflateSync } from 'node:zlib';
import {
  sampleFrame,
  encodeFrame,
  deriveFrame,
  digest,
} from '../../authoring/sprites/derivative.mjs';
import { compileSprites, verifySprites } from '../../authoring/sprites/cli.mjs';
import { decodeRGBA } from '../../authoring/library/fpv-role-presentations/png.mjs';

test('center sampling preserves all channels and the whole square frame', () => {
  const pixels = Buffer.from(
    Array.from({ length: 5 * 5 }, (_, i) => [i, 255 - i, i * 3, i * 7]).flat(),
  );
  assert.deepEqual(
    [...sampleFrame({ pixels, width: 5, height: 5 }, 2)],
    [6, 249, 18, 42, 8, 247, 24, 56, 16, 239, 48, 112, 18, 237, 54, 126],
  );
  assert.deepEqual(sampleFrame({ pixels, width: 5, height: 5 }, 5), pixels);
  const small = Buffer.from([8, 9, 10, 0]);
  assert.deepEqual(
    sampleFrame({ pixels: small, width: 1, height: 1 }, 2),
    Buffer.concat([small, small, small, small]),
  );
  assert.throws(() => sampleFrame({ pixels: Buffer.alloc(8), width: 1, height: 2 }, 2), /square/);
});

test('fixed PNG framing uses exact scanlines, valid checksum and two stored blocks at128px', () => {
  const pixels = Buffer.from(Array.from({ length: 128 * 128 * 4 }, (_, i) => i % 256));
  const png = encodeFrame(pixels, 128);
  assert.equal(png.length, 65737);
  assert.deepEqual(png, encodeFrame(pixels, 128));
  assert.equal(png.readUInt32BE(33), 65680);
  assert.equal(png.toString('ascii', 37, 41), 'IDAT');
  const zlib = png.subarray(41, 41 + 65680);
  assert.deepEqual([...zlib.subarray(0, 7)], [120, 1, 0, 255, 255, 0, 0]);
  assert.equal(zlib[65542], 1);
  const rows = inflateSync(zlib);
  for (let y = 0; y < 128; y++) {
    assert.equal(rows[y * 513], 0);
    assert.deepEqual(
      rows.subarray(y * 513 + 1, (y + 1) * 513),
      pixels.subarray(y * 512, (y + 1) * 512),
    );
  }
  assert.deepEqual(decodeRGBA(png).pixels, pixels);
  const broken = Buffer.from(png);
  broken[45] ^= 1;
  assert.throws(() => decodeRGBA(broken), /CRC/);
});

test('derivation refuses substituted parents/dimensions and keeps source bytes unchanged', () => {
  const png = encodeFrame(Buffer.from([1, 2, 3, 0, 4, 5, 6, 90, 7, 8, 9, 128, 10, 11, 12, 255]), 2);
  const before = Buffer.from(png);
  const identity = { bytes: png.length, sha256: digest(png), width: 2, height: 2 };
  const output = deriveFrame(png, identity, 32);
  assert.deepEqual(png, before);
  assert.equal(output.record.output.pixelsSha256, decodeRGBA(output.png).pixelsSha256);
  assert.deepEqual(output.record.frame, { crop: false, pivot: [0.5, 0.5], heading: 'north' });
  assert.throws(() => deriveFrame(png, { ...identity, sha256: '0'.repeat(64) }), /SHA-256/);
  assert.throws(() => deriveFrame(png, { ...identity, width: 3 }), /width/);
  assert.throws(() => deriveFrame(png, { ...identity, bytes: png.length + 1 }), /byte count/);
  assert.throws(() => deriveFrame(png, identity, 256), /size/);
});

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'revealline-sprite-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const directory = path.join(root, 'authoring/library/test');
  await fs.mkdir(directory, { recursive: true });
  const png = encodeFrame(Buffer.from([40, 80, 120, 128]), 1);
  const source = {
    id: 'test-body',
    path: 'authoring/library/test/source.png',
    bytes: png.length,
    sha256: digest(png),
    width: 1,
    height: 1,
  };
  await fs.writeFile(path.join(root, source.path), png);
  const spec = 'authoring/library/test/input.json';
  const data = { size: 32, sources: [source] };
  await fs.writeFile(path.join(root, spec), JSON.stringify(data));
  return { root, spec, data, out: 'authoring/library/test/export' };
}

test('compile and verify round trip has exact membership, stable outputs and exclusive directory', async (t) => {
  const options = await fixture(t);
  const first = await compileSprites(options);
  const verified = await verifySprites({
    root: options.root,
    manifest: `${options.out}/manifest.json`,
  });
  assert.deepEqual(first, verified);
  assert.deepEqual(await compileSprites({ ...options, out: `${options.out}-second` }), first);
  await assert.rejects(compileSprites(options), /EEXIST/);
  await fs.writeFile(path.join(options.root, options.out, 'extra.png'), 'unexpected');
  await assert.rejects(
    verifySprites({ root: options.root, manifest: `${options.out}/manifest.json` }),
    /membership/,
  );
});

test('verify detects altered pixels even when manifest output hashes are replaced', async (t) => {
  const options = await fixture(t);
  const manifest = await compileSprites(options);
  const output = path.join(options.root, options.out, manifest.entries[0].file);
  const wrong = encodeFrame(Buffer.alloc(32 * 32 * 4), 32);
  await fs.writeFile(output, wrong);
  await assert.rejects(
    verifySprites({ root: options.root, manifest: `${options.out}/manifest.json` }),
    /PNG differs/,
  );
  manifest.entries[0].output.sha256 = digest(wrong);
  await fs.writeFile(
    path.join(options.root, options.out, 'manifest.json'),
    JSON.stringify(manifest),
  );
  await assert.rejects(
    verifySprites({ root: options.root, manifest: `${options.out}/manifest.json` }),
    /ancestry or generator/,
  );
});

test('invalid cohort sources create no output and cannot escape through paths or symlinks', async (t) => {
  const options = await fixture(t);
  for (const patch of [
    { sha256: '0'.repeat(64) },
    { path: '../source.png' },
    { height: 2 },
    { id: null },
  ]) {
    await fs.writeFile(
      path.join(options.root, options.spec),
      JSON.stringify({ size: 32, sources: [{ ...options.data.sources[0], ...patch }] }),
    );
    await assert.rejects(compileSprites(options));
    await assert.rejects(fs.stat(path.join(options.root, options.out)), /ENOENT/);
  }
  await fs.writeFile(
    path.join(options.root, options.spec),
    JSON.stringify({ size: 32, sources: [options.data.sources[0], options.data.sources[0]] }),
  );
  await assert.rejects(compileSprites(options), /Unique/);
  await fs.writeFile(path.join(options.root, options.spec), JSON.stringify(options.data));
  await fs.rename(
    path.join(options.root, options.data.sources[0].path),
    path.join(options.root, 'original.png'),
  );
  await fs.symlink(
    path.join(options.root, 'original.png'),
    path.join(options.root, options.data.sources[0].path),
  );
  await assert.rejects(compileSprites(options), /Symbolic links/);
  await assert.rejects(compileSprites({ ...options, out: 'game/art' }), /Write only/);
});
