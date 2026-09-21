#!/usr/bin/env node
import { constants, openAsBlob } from 'node:fs';
import { open, lstat, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  boundedJSON,
  canonicalJSON,
  exactKeys,
  plainObject,
  required,
} from '../game/data-json.mjs';
import { MAX_BACKUP_BYTES, BACKUP_FORMAT, EXTERNAL_BACKUP_FORMAT } from '../game/backup.mjs';
import { BACKUP_SET_MAX_BYTES } from '../game/backup-set.mjs';
import { MEDIA_BUNDLE_FORMAT, MEDIA_BUNDLE_LIMITS } from '../game/media-bundle.mjs';
import { validateStoredStillMedia, storedStillHashes } from '../game/media-storage-record.mjs';
import { inspectStoryBundle } from '../game/story-bundle.mjs';
import {
  SOUNDTRACK_BUNDLE_FORMAT,
  SOUNDTRACK_BUNDLE_FORMAT_V2,
  SOUNDTRACK_BUNDLE_FORMAT_V3,
} from '../game/soundtrack-bundle.mjs';
import {
  resolveSoundtrackLibrary,
  SOUNDTRACK_FORMAT_V2,
  SOUNDTRACK_FORMAT_V3,
  SOUNDTRACK_LIMITS,
  soundtrackReferencedTracks,
} from '../game/soundtrack.mjs';
import { inspectMP3 } from '../game/mp3.mjs';
import { validateExternalChapterIndex } from '../game/external-chapter.mjs';

const REPORT_BYTES = 2 * 1024 * 1024;
const HASH = /^[a-f0-9]{64}$/;
const SUFFIX = { game: '.json', media: '.rlmedia', story: '.rlstory', audio: '.rlsound' };
const statIdentity = (s) => [s.dev, s.ino, s.mode, s.size, s.mtimeNs, s.ctimeNs].join(':');
const fail = (condition, message) => required(condition, `Backup set: ${message}`);
const text = (value, max = 256) =>
  typeof value === 'string' && value.length > 0 && value.length <= max;
const safeName = (value) =>
  text(value, 128) && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value) && !value.includes('..');
const json = (bytes, maxBytes, extra = {}) =>
  boundedJSON(new TextDecoder('utf-8', { fatal: true }).decode(bytes), {
    maxBytes,
    maxDepth: 30,
    maxNodes: 3400000,
    maxArray: 250000,
    maxString: maxBytes,
    ...extra,
  });
async function readAt(handle, size, position = 0) {
  const bytes = Buffer.alloc(size);
  let read = 0;
  while (read < size) {
    const result = await handle.read(bytes, read, size - read, position + read);
    fail(result.bytesRead > 0, 'file was truncated during verification.');
    read += result.bytesRead;
  }
  return bytes;
}
async function hashRange(handle, position, bytes) {
  const buffer = Buffer.alloc(65536),
    hash = createHash('sha256');
  for (let read = 0; read < bytes; ) {
    const result = await handle.read(
      buffer,
      0,
      Math.min(buffer.length, bytes - read),
      position + read,
    );
    fail(result.bytesRead > 0, 'file was truncated during verification.');
    hash.update(buffer.subarray(0, result.bytesRead));
    read += result.bytesRead;
  }
  return hash.digest('hex');
}
async function withFile(path, limit, work) {
  const before = await lstat(path, { bigint: true });
  fail(
    before.isFile() && !before.isSymbolicLink(),
    `${basename(path)} must be a regular file, not a symlink.`,
  );
  fail(
    before.size > 0n && before.size <= BigInt(limit),
    `${basename(path)} exceeds its byte bound.`,
  );
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = await handle.stat({ bigint: true });
    fail(statIdentity(opened) === statIdentity(before), `${basename(path)} changed while opening.`);
    const result = await work(handle, Number(before.size));
    fail(
      statIdentity(await handle.stat({ bigint: true })) === statIdentity(before) &&
        statIdentity(await lstat(path, { bigint: true })) === statIdentity(before),
      `${basename(path)} changed during verification.`,
    );
    return { ...result, path, identity: statIdentity(before) };
  } finally {
    await handle.close();
  }
}
function validateReport(report, reportName, reportBytes) {
  exactKeys(
    report,
    [
      'report',
      'reportVersion',
      'preparedAt',
      'edition',
      'generations',
      'mediaScope',
      'domains',
      'coverage',
      'detachedStories',
      'exclusions',
      'restoreOrder',
      'files',
      'note',
      ...(report.reportVersion === 2 ? ['referenceOnlyMusic', 'musicRecoveryNotice'] : []),
    ],
    'coverage report',
  );
  fail(
    report.report === 'RevealLine backup set coverage' && [1, 2].includes(report.reportVersion),
    'unsupported report format/version.',
  );
  fail(
    text(report.preparedAt, 40) && Number.isFinite(Date.parse(report.preparedAt)),
    'invalid preparation time.',
  );
  exactKeys(report.edition, ['version', 'channel', 'sourceRevision'], 'coverage edition');
  fail(
    text(report.edition.version, 64) &&
      text(report.edition.channel, 128) &&
      (report.edition.sourceRevision === null ||
        (typeof report.edition.sourceRevision === 'string' &&
          /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(report.edition.sourceRevision))),
    'invalid edition identity.',
  );
  exactKeys(report.generations, ['media', 'story', 'audio'], 'coverage generations');
  fail(
    Object.values(report.generations).every((n) => Number.isSafeInteger(n) && n >= 0),
    'invalid generations.',
  );
  fail(
    Array.isArray(report.files) && report.files.length === 4,
    'report requires four component files.',
  );
  const ids = new Set(),
    names = new Set([reportName.toLowerCase()]);
  let total = reportBytes;
  for (const row of report.files) {
    exactKeys(row, ['id', 'filename', 'bytes', 'sha256', 'status'], 'coverage file');
    fail(
      Object.hasOwn(SUFFIX, row.id) && !ids.has(row.id),
      'duplicate or unsupported component id.',
    );
    fail(
      safeName(row.filename) && row.filename.endsWith(SUFFIX[row.id]),
      'unsafe component filename or wrong suffix.',
    );
    fail(!names.has(row.filename.toLowerCase()), 'duplicate component filename.');
    fail(
      Number.isSafeInteger(row.bytes) &&
        row.bytes > 0 &&
        row.bytes <= (row.id === 'game' ? MAX_BACKUP_BYTES : MEDIA_BUNDLE_LIMITS.bytes),
      'invalid component byte length.',
    );
    fail(
      typeof row.sha256 === 'string' && HASH.test(row.sha256) && row.status === 'Prepared',
      'invalid component hash/status.',
    );
    ids.add(row.id);
    names.add(row.filename.toLowerCase());
    total += row.bytes;
  }
  fail(total <= BACKUP_SET_MAX_BYTES, 'combined files and report exceed the preparation bound.');
  fail(Array.isArray(report.domains) && report.domains.length === 3, 'invalid domain coverage.');
  const domains = new Set();
  for (const row of report.domains) {
    exactKeys(row, ['id', 'metadataSha256', 'originals', 'originalBytes'], 'domain coverage');
    fail(
      ['media', 'story', 'audio'].includes(row.id) && !domains.has(row.id),
      'duplicate/unsupported domain coverage.',
    );
    fail(
      typeof row.metadataSha256 === 'string' &&
        HASH.test(row.metadataSha256) &&
        Number.isSafeInteger(row.originals) &&
        row.originals >= 0 &&
        row.originals <= 4096 &&
        Number.isSafeInteger(row.originalBytes) &&
        row.originalBytes >= 0 &&
        row.originalBytes <= MEDIA_BUNDLE_LIMITS.bytes,
      'invalid domain counts or hash.',
    );
    domains.add(row.id);
  }
  fail(
    Array.isArray(report.detachedStories) && report.detachedStories.length <= 4096,
    'invalid detached story list.',
  );
  for (const row of report.detachedStories) {
    exactKeys(row, ['id', 'sha256'], 'detached story');
    fail(
      text(row.id, 80) && typeof row.sha256 === 'string' && HASH.test(row.sha256),
      'invalid detached story identity.',
    );
  }
  const referenceOnlyMusic = report.reportVersion === 2 ? report.referenceOnlyMusic : [];
  fail(
    Array.isArray(referenceOnlyMusic) && referenceOnlyMusic.length <= SOUNDTRACK_LIMITS.tracks * 2,
    'invalid reference-only music list.',
  );
  const referenceIds = new Set();
  for (const row of referenceOnlyMusic) {
    exactKeys(row, ['id', 'title', 'sha256'], 'reference-only recording');
    fail(
      text(row.id, 120) &&
        text(row.title, 160) &&
        HASH.test(row.sha256) &&
        !referenceIds.has(row.id),
      'invalid or duplicate reference-only recording identity.',
    );
    referenceIds.add(row.id);
  }
  if (report.reportVersion === 2)
    fail(
      referenceOnlyMusic.length
        ? text(report.musicRecoveryNotice, 2048) && /without audio/.test(report.musicRecoveryNotice)
        : report.musicRecoveryNotice === '',
      'reference-only music requires an explicit audio-omission notice.',
    );
  fail(
    report.coverage ===
      (report.detachedStories.length
        ? referenceOnlyMusic.length
          ? 'incomplete: detached story originals and reference-only music'
          : 'incomplete: detached story originals'
        : referenceOnlyMusic.length
          ? 'incomplete: reference-only music'
          : 'saved referenced inventory'),
    'coverage label differs from detached inventory.',
  );
  fail(text(report.mediaScope, 512) && text(report.note, 2048), 'invalid coverage scope/note.');
  for (const key of ['exclusions', 'restoreOrder'])
    fail(
      Array.isArray(report[key]) &&
        report[key].length <= 32 &&
        report[key].every((s) => text(s, 1024)),
      `invalid ${key}.`,
    );
  return report;
}
async function readContainer(handle, bytes, magic, maxManifest) {
  fail(bytes >= 12, 'truncated binary component.');
  const header = await readAt(handle, 12);
  const matchedMagic = (Array.isArray(magic) ? magic : [magic]).find((candidate) =>
    header.subarray(0, 8).equals(Buffer.from(candidate)),
  );
  fail(matchedMagic, 'unsupported binary component format.');
  const length = header.readUInt32BE(8);
  fail(
    length > 0 && length <= maxManifest && 12 + length <= bytes,
    'invalid component manifest length.',
  );
  return {
    manifest: json(await readAt(handle, length, 12), maxManifest),
    offset: 12 + length,
    magic: matchedMagic,
  };
}
async function checkAssets(handle, bytes, offset, assets, wanted, maxAsset, inspect = null) {
  fail(
    Array.isArray(assets) && assets.length <= 512 && wanted.size === assets.length,
    'component requires every referenced original and no extras.',
  );
  let previous = '',
    originalBytes = 0;
  for (const row of assets) {
    exactKeys(row, ['sha256', 'bytes'], 'component original');
    fail(
      typeof row.sha256 === 'string' &&
        HASH.test(row.sha256) &&
        row.sha256 > previous &&
        wanted.has(row.sha256),
      'duplicate, unordered or unreferenced original.',
    );
    fail(
      Number.isSafeInteger(row.bytes) &&
        row.bytes > 0 &&
        row.bytes <= maxAsset &&
        offset + row.bytes <= bytes,
      'invalid original byte length.',
    );
    fail(
      (await hashRange(handle, offset, row.bytes)) === row.sha256,
      'original SHA-256 differs from its component manifest.',
    );
    await inspect?.(row, offset);
    previous = row.sha256;
    offset += row.bytes;
    originalBytes += row.bytes;
  }
  fail(offset === bytes, 'component has trailing bytes.');
  return { originals: assets.length, originalBytes };
}
const domainResult = (document, counts) => ({
  metadataSha256: createHash('sha256').update(canonicalJSON(document)).digest('hex'),
  ...counts,
});
async function inspectComponent(id, path, handle, bytes) {
  if (id === 'game') {
    const value = json(await readAt(handle, bytes), MAX_BACKUP_BYTES);
    fail(
      [BACKUP_FORMAT, EXTERNAL_BACKUP_FORMAT].includes(value.format),
      'unsupported game-data format.',
    );
    exactKeys(
      value,
      [
        'format',
        'library',
        'packs',
        'session',
        ...(value.format === EXTERNAL_BACKUP_FORMAT ? ['externalChapters'] : []),
      ],
      'game-data envelope',
    );
    fail(
      plainObject(value.library) &&
        plainObject(value.packs) &&
        (value.session === null || plainObject(value.session)),
      'incomplete game-data envelope.',
    );
    if (value.format === EXTERNAL_BACKUP_FORMAT)
      validateExternalChapterIndex(value.externalChapters);
    return {
      format: value.format,
      inspection: 'bounded JSON envelope; replay/earned ownership not evaluated',
    };
  }
  if (id === 'story') {
    const checked = await inspectStoryBundle(await openAsBlob(path)),
      detached = checked.document.stories
        .filter((s) => !checked.document.originals.includes(s.source.sha256))
        .map((s) => ({ id: s.id, sha256: s.source.sha256 }));
    return {
      format: checked.format,
      document: checked.document,
      still: checked.still,
      detached,
      domain: domainResult(checked.document, {
        originals: checked.assets.length,
        originalBytes: checked.assets.reduce((sum, a) => sum + a.blob.size, 0),
      }),
    };
  }
  if (id === 'media') {
    const { manifest, offset } = await readContainer(
      handle,
      bytes,
      'RLMDB1\r\n',
      MEDIA_BUNDLE_LIMITS.manifestBytes,
    );
    exactKeys(manifest, ['format', 'document', 'assets'], 'still bundle');
    fail(manifest.format === MEDIA_BUNDLE_FORMAT, 'unsupported still component format.');
    const document = validateStoredStillMedia(manifest.document),
      wanted = storedStillHashes(document),
      counts = await checkAssets(
        handle,
        bytes,
        offset,
        manifest.assets,
        wanted,
        MEDIA_BUNDLE_LIMITS.sourceBytes,
        async (row) => {
          for (const asset of document.library.assets.filter((a) => a.sha256 === row.sha256))
            fail(asset.bytes === row.bytes, 'picture byte length differs from metadata.');
        },
      );
    return { format: manifest.format, document, domain: domainResult(document, counts) };
  }
  const { manifest, offset, magic } = await readContainer(
    handle,
    bytes,
    ['RLSTB1\r\n', 'RLSTB2\r\n', 'RLSTB3\r\n'],
    SOUNDTRACK_LIMITS.metadataBytes + 65536,
  );
  const v3 = magic === 'RLSTB3\r\n',
    v2 = magic === 'RLSTB2\r\n';
  exactKeys(
    manifest,
    ['format', 'library', 'assets', ...(v3 ? ['referenceOnlyTrackIds'] : [])],
    'soundtrack bundle',
  );
  fail(
    manifest.format ===
      (v3
        ? SOUNDTRACK_BUNDLE_FORMAT_V3
        : v2
          ? SOUNDTRACK_BUNDLE_FORMAT_V2
          : SOUNDTRACK_BUNDLE_FORMAT),
    'unsupported audio component format.',
  );
  const library = resolveSoundtrackLibrary(manifest.library);
  fail(
    (library.format === SOUNDTRACK_FORMAT_V2) === v2 &&
      (library.format === SOUNDTRACK_FORMAT_V3) === v3,
    'soundtrack bundle/library versions differ.',
  );
  const tracks = soundtrackReferencedTracks(library),
    refs = new Set(v3 ? library.referenceOnlyTrackIds : []);
  if (v3)
    fail(
      canonicalJSON(manifest.referenceOnlyTrackIds) ===
        canonicalJSON(library.referenceOnlyTrackIds),
      'reference-only music differs from its soundtrack manifest.',
    );
  if (v2 || v3) {
    fail(
      library.catalogTracks.every(
        (track) => refs.has(track.id) || library.installedTrackIds.includes(track.id),
      ),
      'audio component requires every permitted catalogue original.',
    );
    fail(
      (library.bonusAlbums ?? []).every((album) => album.downloaded),
      'audio component requires every permitted bonus original.',
    );
  }
  const omittedHashes = new Set(
    tracks.filter((track) => refs.has(track.id)).map((track) => track.asset.sha256),
  );
  fail(
    tracks.every((track) => !omittedHashes.has(track.asset.sha256) || refs.has(track.id)),
    'all aliases of reference-only music must omit audio.',
  );
  const wanted = new Map(
      tracks
        .filter((track) => !refs.has(track.id))
        .map((track) => [track.asset.sha256, track.asset]),
    ),
    blob = await openAsBlob(path),
    counts = await checkAssets(
      handle,
      bytes,
      offset,
      manifest.assets,
      wanted,
      SOUNDTRACK_LIMITS.trackBytes,
      async (row, start) => {
        const facts = await inspectMP3(blob.slice(start, start + row.bytes));
        fail(
          canonicalJSON(facts) === canonicalJSON(wanted.get(row.sha256)),
          'MP3 framing differs from soundtrack metadata.',
        );
      },
    );
  return {
    format: manifest.format,
    referenceOnlyMusic: tracks
      .filter((track) => refs.has(track.id))
      .map((track) => ({ id: track.id, title: track.title, sha256: track.asset.sha256 })),
    domain: domainResult(library, counts),
  };
}

/** Verify a supplied report and regular destination files without importing,
 * adopting, opening a media database, decoding native media or granting ownership.
 * File/parent identity checks establish a stable observation, not an FS lock.
 */
export async function checkBackupSet({ reportPath, directory } = {}) {
  fail(typeof reportPath === 'string' && reportPath.length > 0, 'supply --report FILE.');
  const reportFile = resolve(reportPath),
    chosenDirectory = resolve(directory ?? dirname(reportFile)),
    dirBefore = await lstat(chosenDirectory, { bigint: true });
  fail(
    dirBefore.isDirectory() && !dirBefore.isSymbolicLink(),
    'component directory must be a real directory, not a symlink.',
  );
  const dir = await realpath(chosenDirectory),
    records = [];
  const reportRead = await withFile(reportFile, REPORT_BYTES, async (handle, bytes) => ({
    bytes,
    sha256: await hashRange(handle, 0, bytes),
    report: validateReport(
      json(await readAt(handle, bytes), REPORT_BYTES),
      basename(reportFile),
      bytes,
    ),
  }));
  records.push(reportRead);
  const report = reportRead.report,
    inspected = new Map(),
    files = [];
  for (const id of ['game', 'media', 'story', 'audio']) {
    const row = report.files.find((file) => file.id === id),
      path = join(dir, row.filename),
      result = await withFile(
        path,
        id === 'game' ? MAX_BACKUP_BYTES : MEDIA_BUNDLE_LIMITS.bytes,
        async (handle, bytes) => {
          fail(bytes === row.bytes, `${row.filename} byte length differs from report.`);
          const sha256 = await hashRange(handle, 0, bytes);
          fail(sha256 === row.sha256, `${row.filename} SHA-256 differs from report.`);
          return { inspection: await inspectComponent(id, path, handle, bytes), bytes, sha256 };
        },
      );
    records.push(result);
    inspected.set(id, result.inspection);
    if (id !== 'game') {
      const expected = report.domains.find((domain) => domain.id === id);
      fail(
        canonicalJSON(result.inspection.domain) ===
          canonicalJSON({
            metadataSha256: expected.metadataSha256,
            originals: expected.originals,
            originalBytes: expected.originalBytes,
          }),
        `${id} coverage differs from actual component inventory.`,
      );
    }
    files.push({
      id,
      filename: row.filename,
      bytes: result.bytes,
      sha256: result.sha256,
      format: result.inspection.format,
    });
  }
  fail(
    canonicalJSON(inspected.get('story').still) === canonicalJSON(inspected.get('media').document),
    'story poster context differs from the paired still component.',
  );
  fail(
    canonicalJSON(inspected.get('story').detached) === canonicalJSON(report.detachedStories),
    'detached story coverage differs from actual component.',
  );
  fail(
    canonicalJSON(inspected.get('audio').referenceOnlyMusic) ===
      canonicalJSON(report.reportVersion === 2 ? report.referenceOnlyMusic : []),
    'reference-only music coverage differs from actual component.',
  );
  for (const record of records)
    fail(
      statIdentity(await lstat(record.path, { bigint: true })) === record.identity,
      'a file changed before final verification.',
    );
  fail(
    statIdentity(await lstat(chosenDirectory, { bigint: true })) === statIdentity(dirBefore),
    'component directory changed during verification.',
  );
  return {
    status: 'verified',
    verification:
      'Exact bytes match the supplied coverage report; bounded component metadata, referenced-original hashes and MP3 framing checked.',
    report: { filename: basename(reportFile), bytes: reportRead.bytes, sha256: reportRead.sha256 },
    edition: report.edition,
    coverage: report.coverage,
    detachedStories: report.detachedStories,
    referenceOnlyMusic: report.reportVersion === 2 ? report.referenceOnlyMusic : [],
    musicRecoveryNotice: report.reportVersion === 2 ? report.musicRecoveryNotice : '',
    files,
    notVerified: [
      'Report authenticity or trusted source provenance',
      'Music licensing authority or availability of reference-only recordings',
      'Game replay validity or earned-picture/story ownership',
      'Native image/video/audio decoding and audible playback',
      'Successful restore, compatibility with another edition, or offline availability',
    ],
  };
}

const DOWNLOAD_HELP =
  'Keep one downloaded set in a separate folder with the exact coverage-report filenames. Browser-renamed files (for example, with (1)) are not selected automatically; do not mix older exports or guess the newest file.';

const HELP = `Usage: node scripts/check-backup-set.mjs --report FILE [--directory DIR]\n\nRead-only check of the coverage JSON and its four downloaded component files.\nDIR defaults to the report's directory. Keep the exported filenames together.\n${DOWNLOAD_HELP}\nNo imports, database writes, media playback or profile adoption. A verified\nresult matches the supplied report; it does not grant earned ownership or\nprove native decoding, restoration or offline playback.\n`;
async function main(args) {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    process.stdout.write(HELP);
    return;
  }
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const flags = { '--report': 'reportPath', '--directory': 'directory' },
      key = Object.hasOwn(flags, args[i]) ? flags[args[i]] : null;
    fail(
      key && args[i + 1] && !args[i + 1].startsWith('--') && !Object.hasOwn(options, key),
      'unknown, missing or duplicate CLI option. Use --help.',
    );
    options[key] = args[i + 1];
  }
  process.stdout.write(JSON.stringify(await checkBackupSet(options), null, 2) + '\n');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n${DOWNLOAD_HELP}\n`);
    process.exitCode = 1;
  });
