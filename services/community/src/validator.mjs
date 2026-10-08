import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import pngjs from 'pngjs';
import { inspectCommunityPackage } from '../../../game/community/package-family.mjs';

const execFileAsync = promisify(execFile);
const { PNG } = pngjs;

export class ValidationInfrastructureError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'ValidationInfrastructureError';
  }
}

const collect = async (body, maxBytes) => {
  const chunks = [];
  let size = 0;
  for await (const value of body) {
    const chunk = Buffer.from(value);
    size += chunk.length;
    if (size > maxBytes) throw new TypeError('Package exceeds its declared byte length.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

export async function decodeCreatorPng(blob) {
  const bytes = Buffer.from(await blob.arrayBuffer());
  let decoded;
  try {
    decoded = PNG.sync.read(bytes, { checkCRC: true, skipRescale: true });
  } catch (error) {
    throw new TypeError('PNG payload could not be completely decoded.', { cause: error });
  }
  return { naturalWidth: decoded.width, naturalHeight: decoded.height };
}

/** Native Team stills also allow JPEG; decode pixels before trusting their dimensions. */
export async function decodeCommunityStill(blob) {
  if (blob.type !== 'image/jpeg') return decodeCreatorPng(blob);
  const root = await mkdtemp(path.join(os.tmpdir(), 'revealline-still-'));
  const file = path.join(root, 'source.jpg');
  try {
    await writeFile(file, Buffer.from(await blob.arrayBuffer()), { flag: 'wx', mode: 0o600 });
    let decoded;
    try {
      const { stdout } = await execFileAsync(
        'ffmpeg',
        [
          '-v',
          'error',
          '-xerror',
          '-nostdin',
          '-protocol_whitelist',
          'file',
          '-threads',
          '1',
          '-i',
          file,
          '-frames:v',
          '1',
          '-c:v',
          'png',
          '-f',
          'image2pipe',
          'pipe:1',
        ],
        { timeout: 20_000, maxBuffer: 32 * 1024 * 1024, encoding: 'buffer' },
      );
      decoded = stdout;
    } catch (error) {
      if (error?.code === 'ENOENT')
        throw new ValidationInfrastructureError('ffmpeg is unavailable.', { cause: error });
      throw new TypeError('JPEG payload could not be completely decoded.', { cause: error });
    }
    return decodeCreatorPng(new Blob([decoded], { type: 'image/png' }));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

export function createFfprobeVideoInspector({
  ffprobePath = 'ffprobe',
  timeoutMs = 20_000,
  runCommand = (command, args, options) => execFileAsync(command, args, options),
} = {}) {
  return async (blob) => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'revealline-video-'));
    const mime = blob.type;
    const file = path.join(root, mime === 'video/webm' ? 'source.webm' : 'source.mp4');
    const bytes = Buffer.from(await blob.arrayBuffer());
    try {
      await writeFile(file, bytes, { flag: 'wx', mode: 0o600 });
      let stdout;
      try {
        ({ stdout } = await runCommand(
          ffprobePath,
          [
            '-v',
            'error',
            '-protocol_whitelist',
            'file',
            '-threads',
            '1',
            '-probesize',
            '5000000',
            '-analyzeduration',
            '5000000',
            '-show_entries',
            'format=duration:stream=codec_type,width,height',
            '-of',
            'json',
            file,
          ],
          { timeout: timeoutMs, maxBuffer: 1024 * 1024 },
        ));
      } catch (error) {
        if (error?.code === 'ENOENT')
          throw new ValidationInfrastructureError('ffprobe is unavailable.', { cause: error });
        throw new TypeError('Video payload could not be decoded by ffprobe.', { cause: error });
      }
      let facts;
      try {
        facts = JSON.parse(stdout);
      } catch (error) {
        throw new TypeError('ffprobe returned invalid metadata.', { cause: error });
      }
      const video = facts.streams?.find((stream) => stream.codec_type === 'video');
      const durationSeconds = Number(facts.format?.duration);
      if (
        !Number.isInteger(video?.width) ||
        !Number.isInteger(video?.height) ||
        !Number.isFinite(durationSeconds) ||
        durationSeconds <= 0
      )
        throw new TypeError('Video payload has no bounded decodable picture and duration.');
      return {
        info: {
          sha256: createHash('sha256').update(bytes).digest('hex'),
          bytes: bytes.length,
          mime,
          width: video.width,
          height: video.height,
          durationSeconds,
        },
        dispose() {},
      };
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  };
}

export function createCreatorPackageValidator({
  inspectVideo = createFfprobeVideoInspector(),
  decodeImage = decodeCommunityStill,
} = {}) {
  return async ({ body, submission, validatorVersion }) => {
    try {
      const bytes = await collect(body, submission.actualSize);
      if (bytes.length !== submission.actualSize)
        throw new TypeError('Package byte length differs from its immutable submission.');
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      if (sha256 !== submission.packageSha256)
        throw new TypeError('Package SHA-256 differs from its immutable submission.');
      const inspected = await inspectCommunityPackage(new Blob([bytes]), {
        decodeImage,
        inspectVideo,
      });
      if (['team', 'fpv'].includes(inspected.family))
        return {
          accepted: true,
          report: {
            format:
              inspected.family === 'team'
                ? 'revealline-team-native'
                : inspected.prepared.manifest.format,
            family: inspected.family,
            editionId: inspected.editionId,
            runtimeIdentity: inspected.runtimeIdentity,
            validatorVersion,
            compiler: 'passed',
            media: inspected.family === 'fpv' ? 'hashed-and-model-validated' : 'native-validator',
            replay:
              inspected.family === 'team' &&
              !inspected.prepared.evidence?.some((row) => row.qualification === 'structural-only')
                ? 'native-campaign-evidence'
                : 'not-play-qualified',
            missions: inspected.missions,
            assets: inspected.prepared.assets?.size ?? inspected.prepared.assets?.length ?? 0,
          },
        };
      if (['classic', 'overflight'].includes(inspected.family))
        return {
          accepted: true,
          report: {
            format: inspected.pack.format,
            family: inspected.family,
            editionId: inspected.editionId,
            runtimeIdentity: inspected.runtimeIdentity,
            validatorVersion,
            compiler: 'passed',
            media: 'shared-runtime-assets',
            replay: 'not-play-qualified',
            missions: inspected.missions,
            assets: 0,
          },
        };
      const prepared = inspected.prepared;
      return {
        accepted: true,
        report: {
          format: prepared.manifest.format,
          editionId: prepared.editionId,
          validatorVersion,
          compiler: 'passed',
          media: 'decoded-and-hashed',
          replay: 'passed',
          missions: prepared.review.missions,
          assets: prepared.manifest.assets.length,
        },
      };
    } catch (error) {
      if (error instanceof ValidationInfrastructureError) throw error;
      return {
        accepted: false,
        rejectionCode: 'package_validation_failed',
        report: {
          validatorVersion,
          code: 'package_validation_failed',
          message: String(error?.message ?? error).slice(0, 500),
        },
      };
    }
  };
}

/** A top-down schematic of the first actual mission, never an invented gameplay image. */
function packageGeometryPreview(inspected) {
  const flight = inspected.family === 'fpv';
  const level = flight
    ? inspected.prepared.project.courses[0]
    : inspected.family === 'team'
      ? inspected.prepared.pack.levels[0]
      : inspected.pack.entries[0].level;
  const width = flight ? level.bounds.max.x - level.bounds.min.x : level.width;
  const height = flight ? level.bounds.max.z - level.bounds.min.z : level.height;
  const png = new PNG({
    width: 384,
    height: Math.max(128, Math.min(384, Math.round((384 * height) / width))),
  });
  const sx = png.width / width,
    sy = png.height / height;
  const project = (point) =>
    flight
      ? { x: (point.x - level.bounds.min.x) * sx, y: (point.z - level.bounds.min.z) * sy }
      : { x: point.x * sx, y: point.y * sy };
  function pixel(x, y, color) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
    const at = (y * png.width + x) * 4;
    png.data.set([...color, 255], at);
  }
  function rect(x, y, w, h, color) {
    for (let py = Math.max(0, Math.floor(y)); py < Math.min(png.height, y + h); py++)
      for (let px = Math.max(0, Math.floor(x)); px < Math.min(png.width, x + w); px++)
        pixel(px, py, color);
  }
  function mark(point, color, size = 5) {
    const p = project(point);
    rect(p.x - size, p.y - size, size * 2 + 1, size * 2 + 1, color);
  }
  rect(0, 0, png.width, png.height, [26, 44, 42]);
  for (let x = 0; x < png.width; x += flight ? 24 : sx) rect(x, 0, 1, png.height, [36, 58, 53]);
  for (let y = 0; y < png.height; y += flight ? 24 : sy) rect(0, y, png.width, 1, [36, 58, 53]);
  if (flight) {
    for (const obstacle of level.obstacles) {
      // Collision meshes are shown as their top-down bounds in this compact schematic.
      const x =
        obstacle.type === 'trimesh'
          ? obstacle.vertices.filter((_, i) => i % 3 === 0)
          : [obstacle.min.x, obstacle.max.x];
      const z =
        obstacle.type === 'trimesh'
          ? obstacle.vertices.filter((_, i) => i % 3 === 2)
          : [obstacle.min.z, obstacle.max.z];
      const low = project({ x: Math.min(...x), z: Math.min(...z) });
      rect(
        low.x,
        low.y,
        Math.max(2, (Math.max(...x) - Math.min(...x)) * sx),
        Math.max(2, (Math.max(...z) - Math.min(...z)) * sy),
        [105, 122, 103],
      );
    }
    for (const actor of level.actors ?? []) {
      for (const point of actor.path ?? []) mark(point, [105, 96, 75], 2);
      mark(actor.position, [239, 191, 91], 4);
    }
    mark(level.spawn, [119, 222, 236]);
  } else {
    for (const cell of level.safeRects ?? [])
      rect(cell.x * sx, cell.y * sy, cell.w * sx, cell.h * sy, [47, 105, 85]);
    for (const wall of level.walls)
      rect(wall.x * sx, wall.y * sy, (wall.w ?? 1) * sx, (wall.h ?? 1) * sy, [112, 128, 105]);
    for (const gate of level.shutters ?? [])
      for (const cell of gate.cells) rect(cell.x * sx, cell.y * sy, sx, sy, [228, 190, 93]);
    for (const enemy of level.enemies ?? []) mark(enemy, [239, 137, 104], 3);
    level.spawns.forEach((spawn, index) => mark(spawn, index ? [227, 175, 218] : [125, 224, 235]));
  }
  return png;
}

export async function readCreatorPreview(blobStore, row) {
  const header = await blobStore.openRange(row.blobKey, 0, 12);
  if (!header) return null;
  if (header.subarray(0, 8).toString('binary') !== 'RLCNB1\r\n') {
    if (
      !Number.isSafeInteger(row.actualSize) ||
      row.actualSize < 1 ||
      row.actualSize > 256 * 1024 * 1024
    )
      return null;
    const bytes = await blobStore.openRange(row.blobKey, 0, row.actualSize);
    if (!bytes || createHash('sha256').update(bytes).digest('hex') !== row.packageSha256)
      return null;
    let inspected;
    try {
      inspected = await inspectCommunityPackage(new Blob([bytes]), {
        decodeImage: decodeCommunityStill,
        inspectVideo: createFfprobeVideoInspector(),
      });
    } catch {
      return null;
    }
    if (!['classic', 'team', 'fpv'].includes(inspected.family)) return null;
    const png = packageGeometryPreview(inspected);
    const body = PNG.sync.write(png);
    return {
      body,
      mime: 'image/png',
      size: body.length,
      sha256: createHash('sha256').update(body).digest('hex'),
    };
  }
  const manifestLength = header.readUInt32BE(8);
  if (manifestLength < 1 || manifestLength > 2 * 1024 * 1024) return null;
  const encoded = await blobStore.openRange(row.blobKey, 12, 12 + manifestLength);
  if (!encoded) return null;
  let manifest;
  try {
    manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(encoded));
  } catch {
    return null;
  }
  const poster = manifest.assets?.find(
    (asset) => asset?.mime === 'image/png' && (asset.kind === undefined || asset.kind === 'poster'),
  );
  if (
    !poster ||
    !Number.isSafeInteger(poster.bytes) ||
    poster.bytes < 1 ||
    poster.bytes > 4 * 1024 * 1024
  )
    return null;
  const index = manifest.assets.indexOf(poster);
  const preceding = manifest.assets.slice(0, index);
  if (!preceding.every((asset) => Number.isSafeInteger(asset?.bytes) && asset.bytes > 0))
    return null;
  const start = 12 + manifestLength + preceding.reduce((total, asset) => total + asset.bytes, 0);
  const body = await blobStore.openRange(row.blobKey, start, start + poster.bytes);
  if (!body || createHash('sha256').update(body).digest('hex') !== poster.sha256) return null;
  return { body, mime: poster.mime, size: body.length, sha256: poster.sha256 };
}
