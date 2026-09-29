import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { decodeScreeningPNG } from './artwork-screening.mjs';
import { decodeIconMaster, ICON_MASTER } from './brand-icons.mjs';
import { nativeArt, makeICNS, ICNS_SIZES, manageNativeArt, parseArtArgs } from './native-art.mjs';

let cached;
const assets = () => (cached ??= nativeArt());
function png(bytes) {
  const { width, height, pixels } = decodeScreeningPNG(bytes);
  return {
    width,
    height,
    depth: bytes[24],
    colorType: bytes[25],
    pixel: (x, y) => [...pixels.subarray((y * width + x) * 3, (y * width + x) * 3 + 3)],
  };
}
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'revealline-native-art-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
test('iOS app icon and all splash slots preserve the generated master as opaque RGB', async () => {
  const master = decodeIconMaster(await fs.readFile(new URL(`../${ICON_MASTER}`, import.meta.url)));
  const images = assets().filter((entry) => entry.name.endsWith('.png'));
  assert.equal(images.length, 4);
  for (const [index, entry] of images.entries()) {
    const decoded = png(entry.bytes),
      size = index === 0 ? 1024 : 2732;
    assert.equal(decoded.width, size);
    assert.equal(decoded.height, size);
    assert.equal(decoded.depth, 8);
    assert.equal(decoded.colorType, 2);
    for (const [x, y] of [
      [0, 0],
      [Math.floor(size / 2), Math.floor(size / 2)],
      [size - 1, size - 1],
    ]) {
      const source =
        (Math.floor((y * master.height) / size) * master.width +
          Math.floor((x * master.width) / size)) *
        3;
      assert.deepEqual(decoded.pixel(x, y), [...master.pixels.subarray(source, source + 3)]);
    }
  }
  assert.deepEqual(images[1].bytes, images[2].bytes);
  assert.deepEqual(images[2].bytes, images[3].bytes);
});
test('ICNS length and seven typed PNG entries agree with their independently decoded sizes', () => {
  const bytes = assets().find((entry) => entry.name.endsWith('.icns')).bytes;
  assert.equal(bytes.subarray(0, 4).toString(), 'icns');
  assert.equal(bytes.readUInt32BE(4), bytes.length);
  let offset = 8;
  for (const [kind, size] of ICNS_SIZES) {
    assert.equal(bytes.subarray(offset, offset + 4).toString(), kind);
    const length = bytes.readUInt32BE(offset + 4);
    assert.ok(length > 8 && offset + length <= bytes.length);
    const decoded = png(bytes.subarray(offset + 8, offset + length));
    assert.equal(decoded.width, size);
    assert.equal(decoded.height, size);
    assert.equal(decoded.colorType, 2);
    offset += length;
  }
  assert.equal(offset, bytes.length);
});
test('native assets are byte deterministic and malformed ICNS image entries reject', () => {
  const second = nativeArt();
  assert.deepEqual(second, assets());
  assert.throws(() => makeICNS(new Map()), /16px RGB PNG/);
  assert.throws(() => makeICNS(new Map([[16, Buffer.alloc(100)]])), /16px RGB PNG/);
});
test('asset CLI is read-only by default and cannot target an arbitrary destination', () => {
  assert.deepEqual(parseArtArgs([]), { mode: 'verify', replace: false });
  assert.deepEqual(parseArtArgs(['--write', '--replace']), { mode: 'write', replace: true });
  for (const args of [
    ['--replace'],
    ['--out', '/tmp/other'],
    ['--verify', '--write'],
    ['--write', '--write'],
    ['--unknown'],
  ])
    assert.throws(() => parseArtArgs(args), /Usage/);
});
test('write creates missing fixed assets, verify preserves bytes, and replacement must be explicit', async (t) => {
  const root = await fixture(t);
  await assert.rejects(manageNativeArt({ root }), /missing or differs/);
  assert.deepEqual(await fs.readdir(root), []);
  const written = await manageNativeArt({ root, mode: 'write' });
  assert.equal(written.files.length, 5);
  assert.equal(
    written.files.every((entry) => entry.status === 'written'),
    true,
  );
  assert.equal(
    (await manageNativeArt({ root })).files.every((entry) => entry.status === 'verified'),
    true,
  );
  const chosen = path.join(root, written.files[0].name);
  await fs.writeFile(chosen, 'existing altered art');
  await assert.rejects(manageNativeArt({ root, mode: 'write' }), /Refusing to overwrite/);
  assert.equal(await fs.readFile(chosen, 'utf8'), 'existing altered art');
  await manageNativeArt({ root, mode: 'write', replace: true });
  await manageNativeArt({ root });
});
test('all destinations preflight before writes and parent symlinks never receive artwork', async (t) => {
  const root = await fixture(t);
  const last = path.join(root, assets().at(-1).name);
  await fs.mkdir(path.dirname(last), { recursive: true });
  await fs.writeFile(last, 'preserved');
  await assert.rejects(manageNativeArt({ root, mode: 'write' }), /Refusing to overwrite/);
  await assert.rejects(fs.stat(path.join(root, 'platforms/ios')), { code: 'ENOENT' });

  const linkedRoot = await fixture(t),
    elsewhere = await fixture(t);
  await fs.symlink(elsewhere, path.join(linkedRoot, 'platforms'));
  await assert.rejects(
    manageNativeArt({ root: linkedRoot, mode: 'write', replace: true }),
    /linked asset path/,
  );
  assert.deepEqual(await fs.readdir(elsewhere), []);
});
