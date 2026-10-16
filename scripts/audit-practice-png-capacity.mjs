/** Bounded, read-only feasibility audit. Never writes images or changes a build. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { inflateSync, deflateSync } from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const magic = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const table = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = table[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}
function parsePNG(bytes) {
  if (!bytes.subarray(0, 8).equals(magic)) throw new Error('Not a PNG.');
  const result = [];
  for (let offset = 8; offset < bytes.length; ) {
    if (offset + 12 > bytes.length) throw new Error('Truncated PNG chunk.');
    const length = bytes.readUInt32BE(offset),
      end = offset + length + 12;
    if (end > bytes.length) throw new Error('PNG chunk exceeds input.');
    if (crc(bytes.subarray(offset + 4, end - 4)) !== bytes.readUInt32BE(end - 4))
      throw new Error('PNG checksum differs.');
    result.push({
      type: bytes.toString('ascii', offset + 4, offset + 8),
      data: bytes.subarray(offset + 8, end - 4),
      raw: bytes.subarray(offset, end),
    });
    offset = end;
  }
  if (result[0]?.type !== 'IHDR' || result[0].data.length !== 13 || result.at(-1)?.type !== 'IEND')
    throw new Error('PNG header/end is absent.');
  if (result.some((chunk) => chunk.type === 'acTL'))
    throw new Error('Animated PNG is out of scope.');
  if (result.some((chunk) => chunk.type === 'tRNS'))
    throw new Error('PNG tRNS transparency is out of scope for this diagnostic.');
  return result;
}
function idat(data) {
  const bytes = Buffer.alloc(data.length + 12);
  bytes.writeUInt32BE(data.length);
  bytes.write('IDAT', 4);
  data.copy(bytes, 8);
  bytes.writeUInt32BE(crc(bytes.subarray(4, -4)), bytes.length - 4);
  return bytes;
}
function replaceIDAT(original, replacements) {
  let inserted = false;
  return Buffer.concat([
    magic,
    ...original.flatMap((chunk) => {
      if (chunk.type !== 'IDAT') return [chunk.raw];
      if (inserted) return [];
      inserted = true;
      return replacements;
    }),
  ]);
}
const nonIDAT = (chunks) =>
  Buffer.concat(chunks.filter((chunk) => chunk.type !== 'IDAT').map((chunk) => chunk.raw));
function ffmpeg(args, input) {
  const result = spawnSync(
    'ffmpeg',
    ['-v', 'error', '-nostdin', '-threads', '1', '-filter_threads', '1', ...args],
    {
      input,
      maxBuffer: 128 * 1024 * 1024,
      timeout: 60_000,
      killSignal: 'SIGKILL',
    },
  );
  if (result.status !== 0) throw new Error(result.error?.message || result.stderr.toString());
  return result.stdout;
}

export function decodeAuditPNG(bytes) {
  const chunks = parsePNG(bytes),
    header = chunks[0].data,
    width = header.readUInt32BE(0),
    height = header.readUInt32BE(4),
    color = header[9];
  if (
    !width ||
    !height ||
    header[8] !== 8 ||
    ![2, 6].includes(color) ||
    header[10] ||
    header[11] ||
    header[12] !== 0 ||
    width * height > 16_777_216
  )
    throw new Error('Trial only supports bounded non-interlaced RGB/RGBA8 PNGs.');
  const filtered = inflateSync(
    Buffer.concat(chunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data)),
    { maxOutputLength: 80 * 1024 * 1024 },
  );
  const expected = (width * (color === 2 ? 3 : 4) + 1) * height;
  if (filtered.length !== expected) throw new Error('Unexpected PNG scanline length.');
  const channels = color === 2 ? 3 : 4,
    stride = width * channels;
  const decoded = Buffer.alloc(stride * height),
    rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const kind = filtered[y * (stride + 1)];
    if (kind > 4) throw new Error('Unsupported PNG row filter.');
    for (let x = 0; x < stride; x++) {
      const at = y * stride + x,
        a = x >= channels ? decoded[at - channels] : 0,
        b = y ? decoded[at - stride] : 0,
        c = y && x >= channels ? decoded[at - stride - channels] : 0;
      const p = a + b - c,
        pa = Math.abs(p - a),
        pb = Math.abs(p - b),
        pc = Math.abs(p - c);
      const predict =
        kind === 0
          ? 0
          : kind === 1
            ? a
            : kind === 2
              ? b
              : kind === 3
                ? Math.floor((a + b) / 2)
                : pa <= pb && pa <= pc
                  ? a
                  : pb <= pc
                    ? b
                    : c;
      decoded[at] = (filtered[y * (stride + 1) + 1 + x] + predict) & 255;
    }
  }
  for (let pixel = 0; pixel < width * height; pixel++) {
    decoded.copy(rgba, pixel * 4, pixel * channels, pixel * channels + 3);
    rgba[pixel * 4 + 3] = channels === 4 ? decoded[pixel * channels + 3] : 255;
  }
  return { chunks, header, width, height, color, filtered, rgba };
}

export function measureLosslessPNG(bytes, { withFFmpeg = false } = {}) {
  const { chunks, header, width, height, color, filtered, rgba: pixels } = decodeAuditPNG(bytes);
  const deflated = deflateSync(filtered, { level: 9 });
  if (!inflateSync(deflated).equals(filtered)) throw new Error('Filtered bytes changed.');
  const candidates = [
    { method: 'original', bytes },
    { method: 'zlib9-original-filters', bytes: replaceIDAT(chunks, [idat(deflated)]) },
  ];
  if (withFFmpeg) {
    const encoded = ffmpeg(
      [
        '-i',
        'pipe:0',
        '-frames:v',
        '1',
        '-c:v',
        'png',
        '-threads',
        '1',
        '-pix_fmt',
        color === 2 ? 'rgb24' : 'rgba',
        '-compression_level',
        '9',
        '-pred',
        'mixed',
        '-f',
        'image2pipe',
        'pipe:1',
      ],
      bytes,
    );
    const encodedChunks = parsePNG(encoded);
    if (!encodedChunks[0].data.equals(header)) throw new Error('Encoder changed PNG header.');
    candidates.push({
      method: 'ffmpeg-png9-mixed',
      bytes: replaceIDAT(
        chunks,
        encodedChunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.raw),
      ),
    });
  }
  const options = candidates.map((candidate) => {
    const projected = parsePNG(candidate.bytes);
    const pixelsEqual =
      candidate.method === 'original' || pixels.equals(decodeAuditPNG(candidate.bytes).rgba);
    const headerEqual = projected[0].data.equals(header);
    const ancillaryEqual = nonIDAT(projected).equals(nonIDAT(chunks));
    if (!pixelsEqual || !headerEqual || !ancillaryEqual)
      throw new Error('Lossless PNG verification failed.');
    return {
      method: candidate.method,
      bytes: candidate.bytes.length,
      sha256: hash(candidate.bytes),
      exactRGBA: pixelsEqual,
      exactIHDR: headerEqual,
      exactNonIDATChunks: ancillaryEqual,
    };
  });
  const best = [...options].sort((a, b) => a.bytes - b.bytes)[0];
  return {
    width,
    height,
    rgbaSha256: hash(pixels),
    options,
    best,
    savedBytes: bytes.length - best.bytes,
  };
}

async function fetchBounded(url, limit) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
    redirect: 'error',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Cannot read audit input: ${url}`);
  const parts = [];
  let bytes = 0;
  for await (const part of response.body) {
    bytes += part.length;
    if (bytes > limit) throw new Error('Audit input exceeds its bound.');
    parts.push(part);
  }
  return Buffer.concat(parts);
}

export async function auditPracticePNGs({
  out,
  baseURL = 'https://mekhovov.github.io/revealline/',
  maxFiles = 30,
  maxInputBytes = 100_000_000,
  withFFmpeg = false,
} = {}) {
  if (
    !out ||
    !Number.isSafeInteger(maxFiles) ||
    maxFiles < 1 ||
    maxFiles > 30 ||
    !Number.isSafeInteger(maxInputBytes) ||
    maxInputBytes < 1 ||
    maxInputBytes > 100_000_000 ||
    typeof withFFmpeg !== 'boolean'
  )
    throw new Error('Use a new report path and at most 30 files / 100 MB input.');
  const output = path.resolve(out);
  try {
    await fs.lstat(output);
    throw new Error('Audit report already exists.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const manifestBytes = await fetchBounded(new URL('manifest.json', baseURL), 8 * 1024 * 1024),
    manifest = JSON.parse(manifestBytes),
    catalogueBytes = await fetchBounded(new URL('offline-content.json', baseURL), 8 * 1024 * 1024),
    cataloguePin = manifest.files.find((file) => file.path === 'offline-content.json');
  if (cataloguePin?.sha256 !== hash(catalogueBytes) || cataloguePin.bytes !== catalogueBytes.length)
    throw new Error(
      'Live catalogue changed or differs from the observed manifest. Retry from one deployment.',
    );
  const catalogue = JSON.parse(catalogueBytes);
  const rows = [],
    skipped = [];
  let inputBytes = 0,
    attemptedFiles = 0;
  for (const file of manifest.files
    .filter((file) => file.path.endsWith('.png'))
    .sort((a, b) => b.bytes - a.bytes)) {
    if (attemptedFiles >= maxFiles) break;
    if (inputBytes + file.bytes > maxInputBytes) continue;
    if (
      !/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(file.path) ||
      file.path.split('/').some((part) => part === '..')
    )
      throw new Error('Unsafe manifest path.');
    let bytes;
    try {
      bytes = await fs.readFile(path.join(ROOT, file.path));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      skipped.push({ path: file.path, reason: 'not present locally' });
      continue;
    }
    if (bytes.length !== file.bytes || hash(bytes) !== file.sha256) {
      skipped.push({ path: file.path, reason: 'local bytes differ from hosted pin' });
      continue;
    }
    attemptedFiles += 1;
    inputBytes += bytes.length;
    let measured;
    try {
      measured = measureLosslessPNG(bytes, { withFFmpeg });
    } catch (error) {
      skipped.push({
        path: file.path,
        sourceSha256: file.sha256,
        bytes: bytes.length,
        reason: 'measurement-failed',
        error: error.message,
      });
      console.error(`PNG audit failed for ${file.path}: ${error.message}`);
      continue;
    }
    rows.push({
      path: file.path,
      sourceSha256: file.sha256,
      originalBytes: bytes.length,
      constraintClass: file.path.startsWith('authoring/')
        ? 'authoring-original-contract-review-required'
        : file.path.startsWith('game/presentation/compiled/')
          ? 'generated-runtime-projection-review-required'
          : 'hash-pinned-runtime-asset-review-required',
      publishedOriginalBundleReferences: (catalogue.originals || [])
        .filter((item) => item.sha256 === file.sha256)
        .map((item) => ({ parent: item.parent, offset: item.offset, bytes: item.bytes })),
      ...measured,
    });
    console.error(
      `PNG audit ${rows.length}/${maxFiles}: ${file.path}; best saving ${measured.savedBytes} bytes`,
    );
  }
  const report = {
    format: 'revealline-practice-png-capacity-audit.v1',
    observedAt: new Date().toISOString(),
    sourceRevision: manifest.sourceRevision,
    hostManifest: {
      url: new URL('manifest.json', baseURL).href,
      bytes: manifestBytes.length,
      sha256: hash(manifestBytes),
    },
    tool: withFFmpeg
      ? ffmpeg(['-version']).toString().split('\n')[0]
      : `Node zlib ${process.versions.zlib}`,
    node: process.version,
    method:
      'Preserve IHDR and every non-IDAT chunk; compare exact RGBA with a bounded RGB/RGBA8 PNG decoder; original-filter zlib9 always, FFmpeg PNG9 mixed prediction only when explicitly enabled; never choose growth.',
    withFFmpeg,
    maxFiles,
    maxInputBytes,
    measuredFiles: rows.length,
    attemptedFiles,
    inputBytes,
    measuredInputBytes: rows.reduce((total, row) => total + row.originalBytes, 0),
    candidateBytes: rows.reduce((total, row) => total + row.best.bytes, 0),
    measuredSavingsBytes: rows.reduce((total, row) => total + row.savedBytes, 0),
    savingsByConstraint: Object.fromEntries(
      [...new Set(rows.map((row) => row.constraintClass))].map((category) => [
        category,
        rows
          .filter((row) => row.constraintClass === category)
          .reduce((total, row) => total + row.savedBytes, 0),
      ]),
    ),
    publicEligible: false,
    implementationPerformed: false,
    imagesWritten: 0,
    note: 'Measured candidates are not approved build projections. Source images, original downloads, byte-pinned descriptors and retained releases are unchanged. No extrapolation beyond these files or whole-site capacity claim.',
    rows,
    skipped,
  };
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  return {
    output,
    sourceRevision: report.sourceRevision,
    measuredFiles: report.measuredFiles,
    inputBytes,
    measuredSavingsBytes: report.measuredSavingsBytes,
    savingsByConstraint: report.savingsByConstraint,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (
    ![4, 5].includes(process.argv.length) ||
    process.argv[2] !== '--out' ||
    (process.argv.length === 5 && process.argv[4] !== '--with-ffmpeg')
  )
    throw new Error(
      'Usage: node scripts/audit-practice-png-capacity.mjs --out NEW_REPORT.json [--with-ffmpeg]',
    );
  console.log(
    JSON.stringify(
      await auditPracticePNGs({
        out: process.argv[3],
        withFFmpeg: process.argv[4] === '--with-ffmpeg',
      }),
      null,
      2,
    ),
  );
}
