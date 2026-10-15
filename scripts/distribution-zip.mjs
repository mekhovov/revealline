/** Shared ZIP32 writer for complete builds and dependency-free release inspection. */
import path from 'node:path';
import { deflateRawSync } from 'node:zlib';

const fail = (message) => {
  throw new Error(message);
};

export function safeRelative(value) {
  if (
    typeof value !== 'string' ||
    !value ||
    value.includes('\\') ||
    /[\x00-\x1f]/.test(value) ||
    path.posix.isAbsolute(value) ||
    /^[A-Za-z]:/.test(value)
  )
    fail(`Unsafe relative path: ${String(value)}`);
  const parts = value.split('/');
  if (parts.some((p) => !p || p === '.' || p === '..')) fail(`Unsafe relative path: ${value}`);
  return value;
}

let crcTable;
export function crc32(buffer) {
  crcTable ??= Uint32Array.from({ length: 256 }, (_, n) => {
    for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
    return n >>> 0;
  });
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Fixed 1980 date, UTF-8, no host metadata or clock. STORE remains the default
 * for optional callers; source-admitted complete builds explicitly select
 * adaptive raw deflate (level 9, window 15, memory 8, default strategy).
 */
export function createZip(entries, { compression = 'stored' } = {}) {
  if (!['stored', 'adaptive'].includes(compression)) fail('Unknown ZIP compression contract');
  if (entries.length >= 65535) fail('ZIP64 is not supported');
  const local = [],
    central = [];
  let offset = 0;
  const names = new Set();
  for (const { name, bytes } of [...entries].sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  )) {
    safeRelative(name);
    if (names.has(name.toLowerCase())) fail('Duplicate or case-colliding ZIP member');
    names.add(name.toLowerCase());
    const filename = Buffer.from(name),
      data = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes),
      crc = crc32(data);
    if (filename.length > 65535 || data.length > 0xffffffff || offset > 0xffffffff)
      fail('ZIP64 is not supported');
    const deflated =
      compression === 'adaptive'
        ? deflateRawSync(data, { level: 9, windowBits: 15, memLevel: 8, strategy: 0 })
        : null;
    const method = deflated && deflated.length < data.length ? 8 : 0;
    const body = method === 8 ? deflated : data;
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x800, 6);
    header.writeUInt16LE(method, 8);
    header.writeUInt16LE(33, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(body.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(filename.length, 26);
    local.push(header, filename, body);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0x800, 8);
    directory.writeUInt16LE(method, 10);
    directory.writeUInt16LE(33, 14);
    directory.writeUInt32LE(crc, 16);
    directory.writeUInt32LE(body.length, 20);
    directory.writeUInt32LE(data.length, 24);
    directory.writeUInt16LE(filename.length, 28);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, filename);
    offset += header.length + filename.length + body.length;
  }
  const centralSize = central.reduce((n, b) => n + b.length, 0);
  if (offset + centralSize > 0xffffffff) fail('ZIP64 is not supported');
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...central, end]);
}
