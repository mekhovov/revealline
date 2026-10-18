import { required } from './data-json.mjs';
import { BACKUP_SET_MAX_BYTES, prepareBackupSet, prepareMediaBackupSet } from './backup-set.mjs';
import { t } from './i18n/index.mjs';

export const BACKUP_ARCHIVE_FORMAT = 'revealline-backup-archive.v1';
const JOURNEY_MAX_BYTES = 16 * 1024 * 1024;
export const BACKUP_ARCHIVE_MAX_BYTES = BACKUP_SET_MAX_BYTES + JOURNEY_MAX_BYTES + 128 * 1024;
const CHUNK_BYTES = 64 * 1024;
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
const check = (signal) => signal?.throwIfAborted();
const encoder = new TextEncoder();
const asciiName = (name) =>
  typeof name === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(name);

/** Stored ZIP records (PKWARE APPNOTE 4.3): no compression, encryption, ZIP64
 * or extraction paths. Keep original Blobs; read CRC in bounded chunks. */
export async function createBackupZip(
  files,
  { signal, onProgress = () => {}, maxBytes = BACKUP_ARCHIVE_MAX_BYTES } = {},
) {
  required(
    Number.isSafeInteger(maxBytes) && maxBytes > 0 && maxBytes <= BACKUP_ARCHIVE_MAX_BYTES,
    'Invalid archive byte budget.',
  );
  required(
    Array.isArray(files) && files.length > 0 && files.length <= 16,
    'Invalid archive file count.',
  );
  const names = new Set();
  let expected = 22;
  for (const file of files) {
    required(
      asciiName(file.filename) && !names.has(file.filename),
      'Invalid or duplicate archive filename.',
    );
    names.add(file.filename);
    required(
      file.blob instanceof Blob && file.blob.size === file.bytes,
      'Archive member size changed.',
    );
    expected += file.bytes + 76 + 2 * encoder.encode(file.filename).length;
    required(expected <= maxBytes, 'Archive exceeds its bounded preparation budget.');
  }
  const parts = [],
    directory = [];
  let offset = 0,
    completed = 0;
  for (const file of files) {
    check(signal);
    let crc = 0xffffffff;
    for (let start = 0; start < file.bytes; start += CHUNK_BYTES) {
      check(signal);
      const chunk = new Uint8Array(await file.blob.slice(start, start + CHUNK_BYTES).arrayBuffer());
      check(signal);
      for (const byte of chunk) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const name = encoder.encode(file.filename),
      local = new Uint8Array(30 + name.length),
      central = new Uint8Array(46 + name.length),
      a = new DataView(local.buffer),
      b = new DataView(central.buffer);
    a.setUint32(0, 0x04034b50, true);
    a.setUint16(4, 20, true);
    a.setUint16(12, 33, true); // 1980-01-01; capture time belongs to the manifest.
    a.setUint32(14, crc, true);
    a.setUint32(18, file.bytes, true);
    a.setUint32(22, file.bytes, true);
    a.setUint16(26, name.length, true);
    local.set(name, 30);
    b.setUint32(0, 0x02014b50, true);
    b.setUint16(4, 20, true);
    b.setUint16(6, 20, true);
    b.setUint16(14, 33, true);
    b.setUint32(16, crc, true);
    b.setUint32(20, file.bytes, true);
    b.setUint32(24, file.bytes, true);
    b.setUint16(28, name.length, true);
    b.setUint32(42, offset, true);
    central.set(name, 46);
    parts.push(local, file.blob);
    directory.push(central);
    offset += local.length + file.bytes;
    onProgress({ completed: ++completed, total: files.length });
  }
  check(signal);
  const end = new Uint8Array(22),
    view = new DataView(end.buffer),
    directoryBytes = directory.reduce((sum, value) => sum + value.length, 0);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, files.length, true);
  view.setUint16(10, files.length, true);
  view.setUint32(12, directoryBytes, true);
  view.setUint32(16, offset, true);
  return new Blob([...parts, ...directory, end], { type: 'application/zip' });
}

const instructions = `FPV / LINE portable archive

This ZIP preserves the component files as exported. It is not a backup of every
browser or device store. Read archive-manifest.json and the original coverage
report before relying on it. Missing originals, reference-only music, unavailable
Journey evidence and excluded profiles cannot be recovered from this archive.

1. Keep this ZIP somewhere separate from the game's browser storage. A requested
   download does not confirm that the browser saved a file. Check its size and
   that it opens. This archive is unencrypted; share it only intentionally.
2. In Saves & loads, choose Inspect an archive and extract files, then download
   the checked component files. Or extract the ZIP using your device's archive
   tool. On iPhone or iPad, find it in Files and tap it to create a folder. Keep
   all the extracted filenames intact.
3. Restore pictures (.rlmedia), stories (.rlstory) and music (.rlsound) through
   their existing import reviews. If listed, review game-data JSON in Saves & loads.
   Authored Journey archives exclude Legacy game data and the unfinished flight;
   export that attempt separately if needed.
4. If a Journey JSON is listed in the manifest, open the same edition's Keep your
   Journey screen, inspect the file and explicitly restore that progress.
5. Each restore has its own review. This is not an automatic, atomic multi-store
   replacement. Keep a backup of the destination's current data before restoring.

The game does not restore the ZIP automatically. Its inspector checks and offers
the original component files; each still needs its separate import review.
The SHA-256 and byte lengths in the manifest identify the original bytes; ZIP CRC32
checks accidental transport damage and is not proof of a trusted source.

Переносний архів FPV / LINE

Цей ZIP зберігає файли у вигляді, в якому їх експортовано. Це не резервна копія
всіх сховищ браузера чи пристрою. Прочитайте archive-manifest.json та звіт про
покриття. Відсутні оригінали, музика лише з посиланнями, недоступні дані Journey
та виключені профілі не можуть бути відновлені з цього архіву.

1. Зберігайте ZIP окремо від сховища гри. Запит завантаження не підтверджує, що
   файл збережено. Перевірте розмір і відкриття. Архів не зашифровано.
2. На екрані збережень перевірте архів і завантажте перевірені компоненти. Або
   розпакуйте ZIP засобами пристрою. На iPhone або iPad знайдіть його у «Файлах»
   і торкніться, щоб створити папку. Не змінюйте назви розпакованих файлів.
3. Через наявні екрани перевірки імпорту відновіть зображення (.rlmedia), історії
   (.rlstory) та музику (.rlsound). Якщо є JSON даних гри, перевірте його у
   «Збереження й завантаження». Архів авторського Journey не містить даних Legacy
   та незавершеного польоту; за потреби експортуйте цю спробу окремо.
4. Якщо маніфест містить JSON Journey, відкрийте екран збереження Journey у тому
   самому виданні, перевірте файл і явно відновіть поступ.
5. Кожне відновлення перевіряється окремо. Це не автоматична спільна транзакція.
   Перед відновленням збережіть резервну копію поточних даних на іншому пристрої.

Гра не відновлює ZIP автоматично: перевірка надає початкові файли компонентів,
кожен з яких потребує окремої перевірки імпорту. SHA-256 та розміри у маніфесті
визначають початкові байти; CRC32 ZIP виявляє випадкове пошкодження,
але не доводить надійність джерела.
`;

/** Wrap existing reviewed exports, borrowing the live Journey owner when present.
 * No store is written, initialized, closed, migrated or replaced by this module. */
export async function prepareBackupArchive(source, { signal, onProgress = () => {} } = {}) {
  const authored = source.archiveProfile != null;
  required(
    !authored ||
      (source.archiveProfile.kind === 'authored-journey' &&
        typeof source.archiveProfile.identity === 'function' &&
        !!source.journey),
    'Unsupported archive profile owner.',
  );
  const journeyIdentity = source.journey?.identity(),
    inventorySource = authored
      ? { ...source, gameIdentity: source.archiveProfile.identity }
      : source,
    set = await (authored ? prepareMediaBackupSet : prepareBackupSet)(inventorySource, {
      signal,
      onProgress,
    }),
    files = [...set.files],
    prefix = set.files
      .find((file) => file.id === 'coverage')
      .filename.replace(/-coverage\.json$/, '');
  const assertGameCurrent = () => {
    set.assertGameCurrent();
    required(
      !source.journey || source.journey.identity() === journeyIdentity,
      'Journey progress changed. Prepare the archive again.',
    );
  };
  let journey = 'not-included';
  assertGameCurrent();
  if (source.journey) {
    onProgress(t('interface:backupArchive.readingJourney'));
    const result = await source.journey.read({ signal });
    check(signal);
    assertGameCurrent();
    required(
      typeof result.raw === 'string' && typeof result.partial === 'boolean',
      'Invalid Journey export result.',
    );
    const blob = new Blob([result.raw], { type: 'application/json' });
    required(blob.size <= JOURNEY_MAX_BYTES, 'Journey backup exceeds its existing import budget.');
    const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    check(signal);
    assertGameCurrent();
    journey = result.partial ? 'available-evidence-only' : 'included';
    files.push({
      id: 'journey',
      filename: `${prefix}-journey${result.partial ? '-recovery' : ''}.json`,
      blob,
      bytes: blob.size,
      sha256: [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join(''),
    });
  }
  const report = {
    format: BACKUP_ARCHIVE_FORMAT,
    preparedAt: set.coverage.preparedAt,
    edition: set.coverage.edition,
    scope: authored
      ? 'Saved shared media and the current authored Journey owner; no legacy game-data JSON or unfinished flight'
      : 'Current game profile, saved shared media and the current Journey owner when present',
    gameData: authored ? 'excluded-authored' : 'included',
    journey,
    coverageReport: set.files.find((file) => file.id === 'coverage').filename,
    files: files.map(({ id, filename, bytes, sha256 }) => ({ id, filename, bytes, sha256 })),
    exclusions: [
      ...set.coverage.exclusions,
      'Browser and device settings, download caches and separately stored simulator records',
      ...(journey === 'not-included'
        ? ['Journey progress: no current Journey owner in this screen']
        : []),
      ...(journey === 'available-evidence-only'
        ? ['Journey performance comparisons or replays that could not be read']
        : []),
    ],
    restoreOrder: [
      ...set.coverage.restoreOrder,
      ...(journey === 'not-included'
        ? []
        : ['Inspect and restore Journey JSON through Keep your Journey in the same edition']),
    ],
    note: 'Extract before importing. Components retain their existing separate reviews; restore is not atomic. Download requested does not confirm a saved file.',
  };
  const metadata = (filename, text) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    return { filename, blob, bytes: blob.size };
  };
  onProgress(t('interface:backupArchive.packaging'));
  const blob = await createBackupZip(
    [
      metadata('archive-manifest.json', JSON.stringify(report, null, 2) + '\n'),
      metadata('README.txt', instructions),
      ...files,
    ],
    { signal },
  );
  check(signal);
  assertGameCurrent();
  return Object.freeze({
    files: [{ id: 'archive', filename: `${prefix}.zip`, blob, bytes: blob.size }],
    coverage: set.coverage,
    archiveReport: report,
    assertGameCurrent,
  });
}
