import { required } from '../data-json.mjs';
import { hashPresentationBytes } from '../presentation/bundle.mjs';
import { inspectRewardMediaBytes, REWARD_MEDIA_LIMITS } from './media-format.mjs';
import { prepareRewardRasterOriginal } from './raster-original.mjs';

export function ownRewardVideoFile(file, limit, role) {
  let size;
  try {
    size = Object.getOwnPropertyDescriptor(Blob.prototype, 'size').get.call(file);
  } catch {
    throw new TypeError(`Choose a local ${role} original.`);
  }
  required(size > 0 && size <= limit, `The ${role} original exceeds its existing media limit.`);
  return Blob.prototype.slice.call(file, 0, size);
}

export function validateDiscoveryVideoInfo(info) {
  required(
    Number.isInteger(info?.width) &&
      info.width > 0 &&
      info.width <= 1920 &&
      Number.isInteger(info.height) &&
      info.height > 0 &&
      info.height <= 1080 &&
      Number.isFinite(info.durationSeconds) &&
      info.durationSeconds > 0 &&
      info.durationSeconds <= REWARD_MEDIA_LIMITS.durationSeconds,
    'Discovery clips require decoded video within 1920×1080 and 120 seconds.',
  );
}

/** Export the inspected complete original and the exact captured poster.
 * Playback-range selection never clips or re-encodes the original. Approval
 * remains with the selected Company source inventory at the receiving tool. */
export async function prepareDiscoveryVideoOriginal({ source, poster }, { signal } = {}) {
  signal?.throwIfAborted();
  validateDiscoveryVideoInfo(source?.info);
  const blob = ownRewardVideoFile(source.original, REWARD_MEDIA_LIMITS.sourceBytes, 'video');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  signal?.throwIfAborted();
  const sha256 = await hashPresentationBytes(bytes),
    mime = source.info.mime,
    extension = mime === 'video/mp4' ? 'mp4' : mime === 'video/webm' ? 'webm' : null;
  required(
    extension && sha256 === source.info.sha256 && bytes.length === source.info.bytes,
    'The clip differs from its inspected original.',
  );
  inspectRewardMediaBytes({ path: `clip.${extension}`, bytes: bytes.length }, 'video', bytes);
  required(
    poster?.capture?.sourceSha256 === sha256,
    'Capture a poster from this exact clip first.',
  );
  const picture = await prepareRewardRasterOriginal(
    {
      blob: poster.blob,
      sha256: poster.asset?.sha256,
      mime: 'image/png',
      name: 'discovery-clip-poster',
    },
    { signal },
  );
  required(
    blob.size + picture.blob.size <= REWARD_MEDIA_LIMITS.sourceBytes,
    'The clip and poster exceed the 32 MiB edition asset limit.',
  );
  signal?.throwIfAborted();
  return { video: { blob, filename: `discovery-clip.${extension}` }, poster: picture };
}
