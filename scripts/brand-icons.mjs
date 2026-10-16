/** Deterministic packaging of the generated FPV / LINE master; never redraws artwork. */
import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { deflateSync, inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ICON_MASTER = 'game/ui/art/identity/fpv-line/icon-master.png';
export const ICON_DERIVATION = 'nearest-neighbour-rgb-png-bounded-quantization.v1';
const masterURL = new URL(`../${ICON_MASTER}`, import.meta.url);
const PNG_MAGIC = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
let crcTable;
function crc32(buffer) {
  crcTable ??= Uint32Array.from({ length: 256 }, (_, n) => {
    for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
    return n >>> 0;
  });
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fail = (message) => {
  throw new Error(`FPV / LINE icon: ${message}`);
};
function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a),
    pb = Math.abs(p - b),
    pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Bounded RGB/RGBA8 decoder for our opaque, non-interlaced generated master. */
export function decodeIconMaster(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length > 16 * 1024 * 1024 || bytes.length < 45)
    fail('master must be a bounded PNG.');
  if (!bytes.subarray(0, 8).equals(PNG_MAGIC)) fail('master must be PNG.');
  let header,
    ended = false,
    dataEnded = false;
  const compressed = [];
  for (let offset = 8; offset < bytes.length; ) {
    if (offset + 12 > bytes.length) fail('truncated PNG chunk.');
    const length = bytes.readUInt32BE(offset),
      type = bytes.toString('ascii', offset + 4, offset + 8),
      next = offset + 12 + length;
    if (!/^[A-Za-z]{4}$/.test(type) || next > bytes.length) fail('invalid PNG chunk.');
    if (crc32(bytes.subarray(offset + 4, next - 4)) !== bytes.readUInt32BE(next - 4))
      fail('PNG checksum mismatch.');
    const payload = bytes.subarray(offset + 8, next - 4);
    if (!header) {
      if (type !== 'IHDR' || length !== 13) fail('missing PNG header.');
      const width = payload.readUInt32BE(0),
        height = payload.readUInt32BE(4),
        channels = payload[9] === 2 ? 3 : payload[9] === 6 ? 4 : 0;
      if (
        width !== height ||
        width < 16 ||
        width > 4096 ||
        payload[8] !== 8 ||
        !channels ||
        payload[10] ||
        payload[11] ||
        payload[12]
      )
        fail('master must be a square, non-interlaced RGB/RGBA8 PNG.');
      header = { width, height, channels };
    } else if (type === 'IDAT') {
      if (dataEnded) fail('PNG data chunks must be contiguous.');
      compressed.push(payload);
    } else {
      if (compressed.length) dataEnded = true;
      if (type === 'IEND') {
        if (length || !compressed.length || next !== bytes.length) fail('invalid PNG end.');
        ended = true;
      } else if (
        ['IHDR', 'tRNS', 'acTL', 'fcTL', 'fdAT'].includes(type) ||
        type[0] !== type[0].toLowerCase()
      )
        fail('unexpected PNG format or animation.');
    }
    offset = next;
  }
  if (!ended) fail('missing PNG end.');
  const { width, height, channels } = header;
  const stride = width * channels,
    expected = (stride + 1) * height;
  const raw = inflateSync(Buffer.concat(compressed), { maxOutputLength: expected });
  if (raw.length !== expected) fail('invalid PNG data length.');
  const decoded = Buffer.allocUnsafe(width * height * channels);
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1),
      filter = raw[row];
    if (filter > 4) fail('unsupported PNG filter.');
    for (let x = 0; x < stride; x++) {
      const at = y * stride + x,
        a = x >= channels ? decoded[at - channels] : 0,
        b = y ? decoded[at - stride] : 0,
        c = y && x >= channels ? decoded[at - stride - channels] : 0;
      const prediction =
        filter === 1
          ? a
          : filter === 2
            ? b
            : filter === 3
              ? Math.floor((a + b) / 2)
              : filter === 4
                ? paeth(a, b, c)
                : 0;
      decoded[at] = (raw[row + 1 + x] + prediction) & 255;
    }
  }
  const pixels = Buffer.allocUnsafe(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    if (channels === 4 && decoded[i * channels + 3] !== 255)
      fail('install master must be opaque; transparency is reserved for the wordmark.');
    decoded.copy(pixels, i * 3, i * channels, i * channels + 3);
  }
  return { width, height, pixels, sourceSha256: sha256(bytes) };
}

function chunk(type, data) {
  const label = Buffer.from(type),
    length = Buffer.alloc(4),
    sum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  sum.writeUInt32BE(crc32(Buffer.concat([label, data])));
  return Buffer.concat([length, label, data, sum]);
}

/** Integer nearest-neighbour sizing preserves the generated pixels and full composition. */
export function encodeIconPNG(image, size) {
  if (!Number.isSafeInteger(size) || size < 16 || size > 4096)
    fail('size must be an integer between 16 and 4096.');
  if (
    !Number.isSafeInteger(image?.width) ||
    image.width !== image.height ||
    image.width < 16 ||
    image.width > 4096 ||
    !Buffer.isBuffer(image.pixels) ||
    image.pixels.length !== image.width * image.height * 3
  )
    fail('invalid decoded master.');
  const pixels = Buffer.allocUnsafe(size * size * 3);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const source =
        (Math.floor((y * image.height) / size) * image.width +
          Math.floor((x * image.width) / size)) *
        3;
      const target = (y * size + x) * 3;
      pixels[target] = image.pixels[source];
      pixels[target + 1] = image.pixels[source + 1];
      pixels[target + 2] = image.pixels[source + 2];
    }
  const stride = size * 3,
    rows = Buffer.allocUnsafe((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (stride + 1);
    rows[row] = 4;
    for (let x = 0; x < stride; x++) {
      const at = y * stride + x;
      rows[row + 1 + x] =
        (pixels[at] -
          paeth(
            x >= 3 ? pixels[at - 3] : 0,
            y ? pixels[at - stride] : 0,
            y && x >= 3 ? pixels[at - stride - 3] : 0,
          )) &
        255;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    PNG_MAGIC,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

let cached;
function masterCache() {
  const source = readFileSync(masterURL),
    digest = sha256(source);
  if (cached?.digest !== digest) {
    const image = decodeIconMaster(source);
    if (image.width < 512) fail('generated install master must be at least 512px.');
    cached = { digest, image, sizes: new Map() };
  }
  return cached;
}
function sizedIcon(master, size) {
  if (!master.sizes.has(size)) {
    let bytes = encodeIconPNG(master.image, size),
      channelBits = 8,
      maxChannelError = 0;
    // Only bounded install derivatives need this encoding optimization. Native
    // large slots retain RGB8 samples. The generated master is never modified.
    if (size <= 512 && bytes.length > 128 * 1024) {
      for (const bits of [6, 5]) {
        const levels = 2 ** bits - 1,
          pixels = Buffer.from(master.image.pixels);
        let error = 0;
        for (let i = 0; i < pixels.length; i++) {
          const value = Math.round((Math.round((pixels[i] * levels) / 255) * 255) / levels);
          error = Math.max(error, Math.abs(pixels[i] - value));
          pixels[i] = value;
        }
        bytes = encodeIconPNG({ ...master.image, pixels }, size);
        channelBits = bits;
        maxChannelError = error;
        if (bytes.length <= 128 * 1024) break;
      }
      if (bytes.length > 128 * 1024)
        fail(`${size}px icon exceeds the stable launcher's 128 KiB cap.`);
    }
    master.sizes.set(size, { bytes, channelBits, maxChannelError });
  }
  return Buffer.from(master.sizes.get(size).bytes);
}
export function brandIcon(size) {
  return sizedIcon(masterCache(), size);
}

export function generatedBrandIcons(sizes = [180, 192, 512]) {
  if (
    !Array.isArray(sizes) ||
    sizes.length > 16 ||
    sizes.some((size) => !Number.isSafeInteger(size) || size < 16 || size > 4096)
  )
    fail('supply at most 16 integer install sizes between 16 and 4096.');
  const master = masterCache();
  const entries = sizes.map((size) => ({
    name: `icons/icon-${size}.png`,
    bytes: sizedIcon(master, size),
  }));
  // The compatibility SVG remains self-contained and below its 64 KiB allowance.
  // High-resolution installs use the dedicated PNGs, not this small browser icon.
  const png = sizedIcon(master, 64);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><image width="64" height="64" href="data:image/png;base64,${png.toString('base64')}"/></svg>\n`;
  return [{ name: 'icons/icon.svg', bytes: Buffer.from(svg) }, ...entries];
}

/** Fixed browser/source derivatives. Native containers are managed by native-art.mjs. */
export async function manageBrandIcons({ write = false } = {}) {
  const master = masterCache();
  const entries = [16, 32, 180, 192, 512].map((size) => {
    const bytes = sizedIcon(master, size);
    if (bytes.length > 128 * 1024)
      fail(`${size}px icon exceeds the stable launcher's 128 KiB cap.`);
    return { name: `icon-${size}.png`, bytes };
  });
  const report = {
    format: 'fpv-line-install-icons.v1',
    source: ICON_MASTER,
    sourceSha256: master.digest,
    derivation: ICON_DERIVATION,
    note: 'Full composition retained with nearest-neighbour sizing. RGB8 is retained unless an install derivative exceeds 128 KiB; then 6-bit, followed if necessary by 5-bit, channel quantization is tried. Master and original remain unchanged; no artwork is redrawn.',
    quantization:
      'round(round(channel * (2^bits - 1) / 255) * 255 / (2^bits - 1)); applied only when needed to meet the unchanged install-file cap',
    files: entries.map(({ name, bytes }) => {
      const size = Number(name.match(/\d+/)[0]),
        encoding = master.sizes.get(size);
      return {
        name,
        bytes: bytes.length,
        sha256: sha256(bytes),
        channelBits: encoding.channelBits,
        maxChannelError: encoding.maxChannelError,
      };
    }),
  };
  entries.push({
    name: 'install-icons.json',
    bytes: Buffer.from(JSON.stringify(report, null, 2) + '\n'),
  });
  const directory = fileURLToPath(new URL('./', masterURL));
  const directoryInfo = await fs.lstat(directory);
  if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink())
    fail('asset directory must be real.');
  const prepared = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    let original = null;
    try {
      const stat = await fs.lstat(target);
      if (!stat.isFile() || stat.isSymbolicLink()) fail('derived asset must be a regular file.');
      original = await fs.readFile(target);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (!write && !original?.equals(entry.bytes)) fail(`derived asset differs: ${entry.name}`);
    prepared.push({ ...entry, target, original });
  }
  if (sha256(await fs.readFile(masterURL)) !== master.digest)
    fail('master changed during preparation.');
  for (const entry of prepared)
    if (write && !entry.original?.equals(entry.bytes))
      await fs.writeFile(entry.target, entry.bytes);
  return { ...report, mode: write ? 'write' : 'verify' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && !['--write', '--verify'].includes(args[0])))
    throw new Error('Usage: node scripts/brand-icons.mjs [--verify | --write]');
  console.log(JSON.stringify(await manageBrandIcons({ write: args[0] === '--write' }), null, 2));
}
