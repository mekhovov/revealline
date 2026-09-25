import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import pngjs from 'pngjs';
import { importCreatorBundle } from '../../../game/creator/bundle.mjs';

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

export function createFfprobeVideoInspector({ ffprobePath = 'ffprobe', timeoutMs = 20_000 } = {}) {
  return async (blob) => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'revealline-video-'));
    const mime = blob.type;
    const file = path.join(root, mime === 'video/webm' ? 'source.webm' : 'source.mp4');
    const bytes = Buffer.from(await blob.arrayBuffer());
    try {
      await writeFile(file, bytes, { flag: 'wx', mode: 0o600 });
      let stdout;
      try {
        ({ stdout } = await execFileAsync(
          ffprobePath,
          [
            '-v',
            'error',
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
  decodeImage = decodeCreatorPng,
} = {}) {
  return async ({ body, submission, validatorVersion }) => {
    try {
      const bytes = await collect(body, submission.actualSize);
      if (bytes.length !== submission.actualSize)
        throw new TypeError('Package byte length differs from its immutable submission.');
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      if (sha256 !== submission.packageSha256)
        throw new TypeError('Package SHA-256 differs from its immutable submission.');
      const prepared = await importCreatorBundle(new Blob([bytes]), { decodeImage, inspectVideo });
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

export async function readCreatorPreview(blobStore, row) {
  const header = await blobStore.openRange(row.blobKey, 0, 12);
  if (!header || header.subarray(0, 8).toString('binary') !== 'RLCNB1\r\n') return null;
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
