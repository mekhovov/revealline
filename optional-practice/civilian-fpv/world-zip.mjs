/** Small interoperable STORE-only ZIP profile. Deflate/ZIP64/encryption/symlinks are rejected. */
import {
  WORLD_LIMITS,
  validateWorldPath,
  canonicalWorldJSON,
  resolveProject,
  inspectPack,
  preparePack,
} from './world-content.mjs';
const text = new TextEncoder(),
  decode = new TextDecoder('utf-8', { fatal: true });
const check = (ok, message) => {
  if (!ok) throw new TypeError(message);
};
export function worldCRC32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export async function exportEditableZip(project, { assets = new Map() } = {}) {
  const pack = await inspectPack(await preparePack(project, { assets }));
  const files = new Map([
    ['project.json', new Blob([canonicalWorldJSON(pack.project)])],
    ...pack.assets,
  ]);
  check(!pack.assets.has('project.json'), 'project.json is reserved.');
  const chunks = [],
    central = [];
  let offset = 0;
  for (const [path, blob] of files) {
    validateWorldPath(path);
    const name = text.encode(path),
      bytes = new Uint8Array(await blob.arrayBuffer()),
      crc = worldCRC32(bytes);
    const header = new Uint8Array(30 + name.length),
      h = new DataView(header.buffer);
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true);
    h.setUint16(6, 0x800, true);
    h.setUint32(14, crc, true);
    h.setUint32(18, bytes.length, true);
    h.setUint32(22, bytes.length, true);
    h.setUint16(26, name.length, true);
    header.set(name, 30);
    const entry = new Uint8Array(46 + name.length),
      c = new DataView(entry.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x800, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, bytes.length, true);
    c.setUint32(24, bytes.length, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    entry.set(name, 46);
    chunks.push(header, bytes);
    central.push(entry);
    offset += header.length + bytes.length;
  }
  const centralLength = central.reduce((n, v) => n + v.length, 0),
    end = new Uint8Array(22),
    e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, files.size, true);
  e.setUint16(10, files.size, true);
  e.setUint32(12, centralLength, true);
  e.setUint32(16, offset, true);
  const blob = new Blob([...chunks, ...central, end], { type: 'application/zip' });
  check(blob.size <= WORLD_LIMITS.packBytes, 'ZIP exceeds budget.');
  return blob;
}
export async function importEditableZip(blob) {
  check(
    blob instanceof Blob && blob.size <= WORLD_LIMITS.packBytes && blob.size >= 22,
    'Invalid ZIP size.',
  );
  const bytes = new Uint8Array(await blob.arrayBuffer()),
    view = new DataView(bytes.buffer),
    end = bytes.length - 22;
  check(
    view.getUint32(end, true) === 0x06054b50 && view.getUint16(end + 20, true) === 0,
    'ZIP must end with an uncommented directory record.',
  );
  const count = view.getUint16(end + 10, true),
    size = view.getUint32(end + 12, true),
    start = view.getUint32(end + 16, true);
  check(
    view.getUint16(end + 4, true) === 0 &&
      view.getUint16(end + 6, true) === 0 &&
      view.getUint16(end + 8, true) === count &&
      count > 0 &&
      count <= WORLD_LIMITS.files &&
      start + size === end,
    'Invalid ZIP central directory.',
  );
  const files = new Map(),
    folded = new Set();
  let c = start,
    expectedOffset = 0,
    total = 0;
  for (let i = 0; i < count; i++) {
    check(c + 46 <= end && view.getUint32(c, true) === 0x02014b50, 'Truncated ZIP directory.');
    const flags = view.getUint16(c + 8, true),
      method = view.getUint16(c + 10, true),
      crc = view.getUint32(c + 16, true),
      compressed = view.getUint32(c + 20, true),
      length = view.getUint32(c + 24, true),
      n = view.getUint16(c + 28, true),
      extra = view.getUint16(c + 30, true),
      comment = view.getUint16(c + 32, true),
      offset = view.getUint32(c + 42, true),
      attrs = view.getUint32(c + 38, true);
    check(
      flags === 0x800 &&
        method === 0 &&
        compressed === length &&
        extra === 0 &&
        comment === 0 &&
        view.getUint16(c + 34, true) === 0 &&
        ((attrs >>> 16) & 0xf000) !== 0xa000,
      'Only plain STORE ZIP entries are supported.',
    );
    check(
      c + 46 + n <= end && offset === expectedOffset && offset + 30 <= start,
      'Invalid ZIP entry offset.',
    );
    const path = decode.decode(bytes.subarray(c + 46, c + 46 + n));
    validateWorldPath(path);
    check(!folded.has(path.toLowerCase()), 'Duplicate ZIP path.');
    folded.add(path.toLowerCase());
    check(
      view.getUint32(offset, true) === 0x04034b50 &&
        view.getUint16(offset + 6, true) === flags &&
        view.getUint16(offset + 8, true) === method &&
        view.getUint32(offset + 14, true) === crc &&
        view.getUint32(offset + 18, true) === length &&
        view.getUint32(offset + 22, true) === length &&
        view.getUint16(offset + 26, true) === n &&
        view.getUint16(offset + 28, true) === 0,
      'ZIP local/directory metadata mismatch.',
    );
    const dataStart = offset + 30 + n,
      dataEnd = dataStart + length;
    check(
      dataEnd <= start &&
        decode.decode(bytes.subarray(offset + 30, dataStart)) === path &&
        (total += length) <= WORLD_LIMITS.packBytes,
      'ZIP data exceeds budget.',
    );
    const data = bytes.subarray(dataStart, dataEnd);
    check(worldCRC32(data) === crc, 'ZIP checksum mismatch.');
    files.set(path, new Blob([data]));
    expectedOffset = dataEnd;
    c += 46 + n;
  }
  check(
    c === end && expectedOffset === start && files.has('project.json'),
    'ZIP has missing or unlisted entries.',
  );
  const project = resolveProject(await files.get('project.json').text());
  files.delete('project.json');
  // Reuse hash, model and resource validation from the binary format before exposing editable content.
  const prepared = await inspectPack(await preparePack(project, { assets: files }));
  return { project: prepared.project, assets: prepared.assets };
}
