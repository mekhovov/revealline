import { required } from '../data-json.mjs';
import { hashPresentationBytes } from '../presentation/bundle.mjs';
import { inspectRewardMediaBytes, REWARD_MEDIA_LIMITS } from './media-format.mjs';

const extensions = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const cancelled = (signal) => {
  if (signal?.aborted) throw new DOMException('Asset handoff cancelled.', 'AbortError');
};

/** Transfer an existing exact original, never a rendered screenshot or re-encode.
 * This is an ephemeral file operation, not an approval or an asset registry. */
export async function prepareRewardRasterOriginal(
  { blob, sha256, mime, name = 'picture' },
  { signal } = {},
) {
  cancelled(signal);
  required(
    blob instanceof Blob && blob.size > 0 && blob.size <= REWARD_MEDIA_LIMITS.imageBytes,
    'Choose an exact raster original within the existing 4 MiB image limit.',
  );
  required(
    extensions[mime] && /^[a-f0-9]{64}$/.test(sha256),
    'The original needs a supported raster MIME and exact SHA-256.',
  );
  const bytes = new Uint8Array(await blob.arrayBuffer());
  cancelled(signal);
  required(
    (await hashPresentationBytes(bytes)) === sha256,
    'The original differs from its saved SHA-256.',
  );
  cancelled(signal);
  const filename = `${
    String(name)
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .slice(0, 100) || 'picture'
  }.${extensions[mime]}`;
  inspectRewardMediaBytes({ path: filename, bytes: bytes.length }, 'poster', bytes);
  return { blob, bytes, sha256, mime, filename };
}
