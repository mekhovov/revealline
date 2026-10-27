import { BACKUP_ARCHIVE_FORMAT, BACKUP_ARCHIVE_MAX_BYTES } from './backup-archive.mjs';

const decoder = new TextDecoder('utf-8', { fatal: true });
const CHUNK_BYTES = 64 * 1024;
const MAX_METADATA_BYTES = 64 * 1024;
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
const check = (signal) => signal?.throwIfAborted();
function requireValue(value, code, message) {
  if (value) return;
  const error = new TypeError(message);
  error.archiveCode = code;
  throw error;
}
const record = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max;
const filename = (value) => text(value, 200) && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);
const messages = (value, max) =>
  Array.isArray(value) && value.length <= max && value.every((item) => text(item, 1024));
const ids = new Set(['game', 'media', 'story', 'audio', 'coverage', 'journey']);
const extensions = {
  game: '.json',
  media: '.rlmedia',
  story: '.rlstory',
  audio: '.rlsound',
  coverage: '.json',
  journey: '.json',
};

function inspectManifest(value, entries) {
  requireValue(
    record(value) && value.format === BACKUP_ARCHIVE_FORMAT,
    'unsupported',
    'Unsupported backup archive format.',
  );
  requireValue(
    text(value.preparedAt, 32) &&
      Number.isFinite(Date.parse(value.preparedAt)) &&
      record(value.edition) &&
      text(value.edition.version, 128) &&
      text(value.edition.channel, 128) &&
      (value.edition.sourceRevision == null || text(value.edition.sourceRevision, 128)) &&
      text(value.scope, 1024) &&
      messages(value.exclusions, 64) &&
      messages(value.restoreOrder, 8) &&
      Array.isArray(value.files) &&
      value.files.length >= 4 &&
      value.files.length <= 6,
    'manifest',
    'Invalid archive manifest metadata.',
  );
  const byId = new Map(),
    byName = new Map();
  for (const file of value.files) {
    requireValue(
      record(file) &&
        ids.has(file.id) &&
        !byId.has(file.id) &&
        filename(file.filename) &&
        file.filename.endsWith(extensions[file.id]) &&
        !byName.has(file.filename) &&
        Number.isSafeInteger(file.bytes) &&
        file.bytes >= 0 &&
        /^[a-f0-9]{64}$/.test(file.sha256),
      'manifest',
      'Invalid or repeated archive component.',
    );
    const entry = entries.get(file.filename);
    requireValue(
      entry && entry.bytes === file.bytes,
      'manifest',
      'Archive component does not match its manifest.',
    );
    byId.set(file.id, file);
    byName.set(file.filename, file);
  }
  requireValue(
    ['media', 'story', 'audio', 'coverage'].every((id) => byId.has(id)) &&
      value.coverageReport === byId.get('coverage').filename &&
      entries.size === value.files.length + 2 &&
      !byName.has('archive-manifest.json') &&
      !byName.has('README.txt'),
    'manifest',
    'Missing or unlisted archive components.',
  );
  // Early v1 exports predate the explicit gameData field but contain game JSON.
  const gameData = value.gameData ?? (byId.has('game') ? 'included' : null);
  requireValue(
    (gameData === 'included' && byId.has('game')) ||
      (gameData === 'excluded-authored' && !byId.has('game') && byId.has('journey')),
    'manifest',
    'Archive game-data scope does not match its files.',
  );
  requireValue(
    (value.journey === 'not-included' && !byId.has('journey')) ||
      (['included', 'available-evidence-only'].includes(value.journey) && byId.has('journey')),
    'manifest',
    'Archive Journey scope does not match its files.',
  );
  return { manifest: { ...value, gameData }, byName };
}

/** Inspect only this app's flat, uncompressed v1 ZIP profile. No store, import
 * adapter or filesystem is opened. Header reads and CRC work are bounded; SHA
 * checks allocate one component at a time, never a second whole ZIP buffer. */
export async function inspectBackupArchive(
  blob,
  { signal, onProgress = () => {}, maxBytes = BACKUP_ARCHIVE_MAX_BYTES } = {},
) {
  check(signal);
  requireValue(
    Number.isSafeInteger(maxBytes) && maxBytes > 0 && maxBytes <= BACKUP_ARCHIVE_MAX_BYTES,
    'size',
    'Invalid archive inspection budget.',
  );
  requireValue(
    blob instanceof Blob && blob.size >= 22 && blob.size <= maxBytes,
    'size',
    'Archive exceeds the inspection size limit.',
  );
  async function read(start, size) {
    check(signal);
    requireValue(
      Number.isSafeInteger(start) &&
        Number.isSafeInteger(size) &&
        start >= 0 &&
        size >= 0 &&
        start + size <= blob.size,
      'structure',
      'Archive record is out of bounds.',
    );
    const bytes = new Uint8Array(await blob.slice(start, start + size).arrayBuffer());
    check(signal);
    requireValue(bytes.length === size, 'structure', 'Archive record is truncated.');
    return bytes;
  }
  const endAt = blob.size - 22,
    end = new DataView((await read(endAt, 22)).buffer);
  requireValue(
    end.getUint32(0, true) === 0x06054b50 && end.getUint16(20, true) === 0,
    'unsupported',
    'Expected an uncommented ZIP directory.',
  );
  const count = end.getUint16(10, true),
    directoryBytes = end.getUint32(12, true),
    directoryAt = end.getUint32(16, true);
  requireValue(
    end.getUint16(4, true) === 0 &&
      end.getUint16(6, true) === 0 &&
      end.getUint16(8, true) === count &&
      count > 2 &&
      count <= 16 &&
      directoryBytes <= 16 * 246 &&
      directoryAt + directoryBytes === endAt,
    'structure',
    'Invalid or oversized ZIP directory.',
  );
  const directory = await read(directoryAt, directoryBytes),
    view = new DataView(directory.buffer),
    entries = new Map(),
    names = new Set();
  let cursor = 0,
    localAt = 0;
  for (let index = 0; index < count; index++) {
    requireValue(
      cursor + 46 <= directoryBytes && view.getUint32(cursor, true) === 0x02014b50,
      'structure',
      'Invalid ZIP central entry.',
    );
    const flags = view.getUint16(cursor + 8, true),
      method = view.getUint16(cursor + 10, true),
      nameBytes = view.getUint16(cursor + 28, true),
      crc = view.getUint32(cursor + 16, true),
      bytes = view.getUint32(cursor + 24, true);
    requireValue(
      flags === 0 &&
        method === 0 &&
        view.getUint16(cursor + 6, true) <= 20 &&
        view.getUint16(cursor + 30, true) === 0 &&
        view.getUint16(cursor + 32, true) === 0 &&
        view.getUint16(cursor + 34, true) === 0 &&
        view.getUint32(cursor + 38, true) === 0,
      'unsupported',
      'Compressed, encrypted, extended or linked ZIP entries are unsupported.',
    );
    requireValue(
      nameBytes > 0 && nameBytes <= 200 && cursor + 46 + nameBytes <= directoryBytes,
      'structure',
      'Invalid ZIP filename length.',
    );
    let name;
    try {
      name = decoder.decode(directory.subarray(cursor + 46, cursor + 46 + nameBytes));
    } catch {
      requireValue(false, 'structure', 'Invalid ZIP filename encoding.');
    }
    requireValue(
      filename(name) && !names.has(name.toLowerCase()),
      'structure',
      'Unsafe or duplicate ZIP filename.',
    );
    requireValue(
      view.getUint32(cursor + 20, true) === bytes && view.getUint32(cursor + 42, true) === localAt,
      'structure',
      'Overlapping, reordered or inconsistent ZIP entry.',
    );
    const header = new DataView((await read(localAt, 30 + nameBytes)).buffer),
      bodyAt = localAt + 30 + nameBytes;
    requireValue(
      header.getUint32(0, true) === 0x04034b50 &&
        header.getUint16(4, true) === view.getUint16(cursor + 6, true) &&
        header.getUint16(6, true) === flags &&
        header.getUint16(8, true) === method &&
        header.getUint32(10, true) === view.getUint32(cursor + 12, true) &&
        header.getUint32(14, true) === crc &&
        header.getUint32(18, true) === bytes &&
        header.getUint32(22, true) === bytes &&
        header.getUint16(26, true) === nameBytes &&
        header.getUint16(28, true) === 0 &&
        new Uint8Array(header.buffer, 30).every(
          (byte, at) => byte === directory[cursor + 46 + at],
        ) &&
        bodyAt + bytes <= directoryAt,
      'structure',
      'ZIP local entry disagrees with its directory.',
    );
    names.add(name.toLowerCase());
    entries.set(name, { filename: name, bytes, crc, blob: blob.slice(bodyAt, bodyAt + bytes) });
    localAt = bodyAt + bytes;
    cursor += 46 + nameBytes;
  }
  requireValue(
    cursor === directoryBytes && localAt === directoryAt,
    'structure',
    'Unlisted ZIP data is unsupported.',
  );
  const manifestEntry = entries.get('archive-manifest.json'),
    readme = entries.get('README.txt');
  requireValue(
    manifestEntry &&
      readme &&
      manifestEntry.bytes <= MAX_METADATA_BYTES &&
      readme.bytes <= MAX_METADATA_BYTES,
    'manifest',
    'Missing or oversized archive instructions.',
  );
  let value;
  try {
    value = JSON.parse(await manifestEntry.blob.text());
  } catch {
    requireValue(false, 'manifest', 'Invalid archive manifest JSON.');
  }
  check(signal);
  const { manifest, byName } = inspectManifest(value, entries);
  let completed = 0;
  const files = [];
  for (const entry of entries.values()) {
    let crc = 0xffffffff;
    for (let offset = 0; offset < entry.bytes; offset += CHUNK_BYTES) {
      check(signal);
      const chunk = new Uint8Array(
        await entry.blob.slice(offset, offset + CHUNK_BYTES).arrayBuffer(),
      );
      check(signal);
      for (const byte of chunk) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
    }
    requireValue(
      (crc ^ 0xffffffff) >>> 0 === entry.crc,
      'integrity',
      'Archive ZIP checksum mismatch.',
    );
    const component = byName.get(entry.filename);
    if (component) {
      const hash = await crypto.subtle.digest('SHA-256', await entry.blob.arrayBuffer());
      check(signal);
      const sha256 = [...new Uint8Array(hash)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
      requireValue(sha256 === component.sha256, 'integrity', 'Archive component SHA-256 mismatch.');
      files.push(Object.freeze({ ...component, blob: entry.blob }));
    }
    onProgress({ completed: ++completed, total: entries.size, unit: 'files' });
    check(signal);
  }
  return Object.freeze({
    manifest: Object.freeze(manifest),
    files: Object.freeze(files),
    instructions: Object.freeze(
      [manifestEntry, readme].map(({ filename, bytes, blob }) =>
        Object.freeze({ filename, bytes, blob }),
      ),
    ),
  });
}
