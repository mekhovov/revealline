import { createHash } from 'node:crypto';

const fail = (message) => {
  throw new Error(message);
};
const safe = (name) =>
  typeof name === 'string' &&
  name.length <= 400 &&
  /^[A-Za-z0-9_-][A-Za-z0-9_.-]*(?:\/[A-Za-z0-9_-][A-Za-z0-9_.-]*)*$/.test(name);
export const editionHash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const table = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  return value >>> 0;
});
function crc(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = (value >>> 8) ^ table[(value ^ byte) & 255];
  return (value ^ 0xffffffff) >>> 0;
}

/** Bounded deterministic STORE ZIP. Fixed dates; no metadata, links or ZIP64. */
export function createEditionZip(files) {
  if (!(files instanceof Map) || !files.size || files.size > 20000)
    fail('Invalid edition ZIP inventory.');
  const locals = [],
    directory = [];
  let offset = 0;
  for (const [name, original] of [...files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (!safe(name) || !(original instanceof Uint8Array)) fail('Invalid edition ZIP member.');
    const data = Buffer.from(original),
      filename = Buffer.from(name),
      checksum = crc(data);
    if (offset + data.length > 950_000_000) fail('Edition ZIP exceeds its byte budget.');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(33, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(filename.length, 26);
    locals.push(local, filename, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(33, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(filename.length, 28);
    central.writeUInt32LE(offset, 42);
    directory.push(central, filename);
    offset += local.length + filename.length + data.length;
  }
  const centralBytes = directory.reduce((sum, bytes) => sum + bytes.length, 0),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(files.size, 8);
  end.writeUInt16LE(files.size, 10);
  end.writeUInt32LE(centralBytes, 12);
  end.writeUInt32LE(offset, 16);
  const result = Buffer.concat([...locals, ...directory, end]);
  if (result.length > 950_000_000) fail('Edition ZIP exceeds its byte budget.');
  return result;
}

/** Independently inspect original bytes against a closed expected member list. */
function parseEditionZip(original, expected = null) {
  if (
    !(original instanceof Uint8Array) ||
    original.length < 22 ||
    original.length > 950_000_000 ||
    (expected !== null && (!Array.isArray(expected) || !expected.length || expected.length > 20000))
  )
    fail('Invalid bounded edition ZIP.');
  const zip = Buffer.from(original.buffer, original.byteOffset, original.byteLength),
    end = zip.length - 22;
  if (
    zip.readUInt32LE(end) !== 0x06054b50 ||
    zip.readUInt16LE(end + 4) ||
    zip.readUInt16LE(end + 6) ||
    zip.readUInt16LE(end + 20)
  )
    fail('Invalid edition ZIP end record.');
  const count = zip.readUInt16LE(end + 10),
    start = zip.readUInt32LE(end + 16),
    size = zip.readUInt32LE(end + 12);
  if (
    !count ||
    count > 20000 ||
    (expected !== null && count !== expected.length) ||
    zip.readUInt16LE(end + 8) !== count ||
    start + size !== end
  )
    fail('Edition ZIP directory differs.');
  const wanted = new Map();
  for (const row of expected ?? []) {
    if (
      !safe(row.path) ||
      wanted.has(row.path) ||
      !Number.isSafeInteger(row.bytes) ||
      row.bytes < 0 ||
      !/^[0-9a-f]{64}$/.test(row.sha256)
    )
      fail('Invalid expected ZIP member.');
    wanted.set(row.path, row);
  }
  const members = new Map();
  let cursor = start,
    offset = 0;
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > end || zip.readUInt32LE(cursor) !== 0x02014b50)
      fail('Invalid ZIP central header.');
    const length = zip.readUInt16LE(cursor + 28),
      bytes = zip.readUInt32LE(cursor + 24),
      local = zip.readUInt32LE(cursor + 42);
    if (
      cursor + 46 + length > end ||
      zip.readUInt16LE(cursor + 8) !== 0x800 ||
      zip.readUInt16LE(cursor + 10) !== 0 ||
      zip.readUInt16LE(cursor + 30) ||
      zip.readUInt16LE(cursor + 32) ||
      zip.readUInt16LE(cursor + 34) ||
      zip.readUInt32LE(cursor + 38) ||
      zip.readUInt32LE(cursor + 20) !== bytes ||
      local !== offset
    )
      fail('Unsupported or overlapping ZIP member.');
    const name = new TextDecoder('utf-8', { fatal: true }).decode(
      zip.subarray(cursor + 46, cursor + 46 + length),
    );
    if (!safe(name)) fail('Invalid edition ZIP path.');
    const row = expected === null ? { bytes } : wanted.get(name);
    if (
      !row ||
      members.has(name) ||
      bytes !== row.bytes ||
      local + 30 + length + bytes > start ||
      zip.readUInt32LE(local) !== 0x04034b50
    )
      fail('Unexpected, duplicate or truncated ZIP member.');
    if (
      zip.readUInt16LE(local + 6) !== 0x800 ||
      zip.readUInt16LE(local + 8) ||
      zip.readUInt16LE(local + 26) !== length ||
      zip.readUInt16LE(local + 28) ||
      zip.readUInt32LE(local + 18) !== bytes ||
      zip.readUInt32LE(local + 22) !== bytes ||
      !zip
        .subarray(local + 30, local + 30 + length)
        .equals(zip.subarray(cursor + 46, cursor + 46 + length))
    )
      fail('ZIP local and central records differ.');
    const data = zip.subarray(local + 30 + length, local + 30 + length + bytes),
      checksum = crc(data);
    if (
      checksum !== zip.readUInt32LE(local + 14) ||
      checksum !== zip.readUInt32LE(cursor + 16) ||
      (expected !== null && editionHash(data) !== row.sha256)
    )
      fail('ZIP original member hash differs.');
    members.set(name, data);
    offset = local + 30 + length + bytes;
    cursor += 46 + length;
  }
  if (cursor !== end || offset !== start || (expected !== null && members.size !== wanted.size))
    fail('ZIP has undeclared trailing bytes.');
  return members;
}

/** Structural/CRC inspection for staging; use admission for expected SHA binding. */
export function readEditionZip(bytes) {
  return parseEditionZip(bytes);
}
export function inspectEditionZip(bytes, expected) {
  return parseEditionZip(bytes, expected);
}
