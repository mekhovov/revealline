import { validateAssetRevision } from '../../../game/presentation/model.mjs';
import { imagePresentation } from '../../../game/presentation/runtime.mjs';

export const ROSTER_MANIFEST = 'authoring/library/fpv-body-roster-candidates/manifest.json';
export const ROSTER_MANIFEST_SHA256 =
  '49c0ff40b5107eafe39b65a827339608b11b2a534d8a96767617c90b68651535';
export const ROSTER_ROLES = Object.freeze([
  'scout',
  'bomber',
  'carrier',
  'interceptor',
  'fiber',
  'impact',
  'trapper',
]);
const root = new URL('../../../', import.meta.url),
  hash = async (bytes) =>
    [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('');

/** Fixed, unapproved C3 cohort. No supplied paths, release pins or registration. */
export async function loadRosterReview({
  signal,
  fetch: request = globalThis.fetch,
  decode = (bytes) => createImageBitmap(new Blob([bytes], { type: 'image/png' })),
  timeoutMs = 15000,
} = {}) {
  const controller = new AbortController(),
    frames = new Map();
  let released = false;
  const release = () => {
    released = true;
    for (const frame of frames.values()) frame.image.close?.();
    frames.clear();
  };
  const aborted = () => {
    if (controller.signal.aborted || released)
      throw new DOMException('Roster loading cancelled.', 'AbortError');
  };
  const read = async (path, limit) => {
    aborted();
    const response = await request(new URL(path, root), {
      signal: controller.signal,
      redirect: 'error',
    });
    aborted();
    if (!response.ok || response.redirected || !response.body?.getReader)
      throw new Error(`Roster file unavailable: ${path}`);
    const reader = response.body.getReader(),
      chunks = [];
    let length = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        aborted();
        if (done) break;
        length += value.byteLength;
        if (length > limit) throw new Error(`Roster byte budget exceeded: ${path}`);
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    const result = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return result;
  };
  let cancel, timer;
  const stopped = new Promise((_, reject) => {
    cancel = () => {
      controller.abort();
      reject(new DOMException('Roster loading cancelled.', 'AbortError'));
    };
    signal?.addEventListener('abort', cancel, { once: true });
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('Roster loading timed out.'));
    }, timeoutMs);
    if (signal?.aborted) cancel();
  });
  try {
    return await Promise.race([
      stopped,
      (async () => {
        const bytes = await read(ROSTER_MANIFEST, 98304);
        if ((await hash(bytes)) !== ROSTER_MANIFEST_SHA256)
          throw new Error('Roster manifest differs from the exact v6 cohort.');
        const manifest = JSON.parse(new TextDecoder().decode(bytes));
        for (const [path, expected] of Object.entries(manifest.sources))
          if ((await hash(await read(path, 262144))) !== expected)
            throw new Error(`Roster source fingerprint differs: ${path}`);
        for (const record of manifest.assets) {
          const asset = validateAssetRevision(record.assetRevision),
            png = await read(record.path, record.bytes);
          if (png.length !== record.bytes || (await hash(png)) !== record.sha256)
            throw new Error(`Roster image bytes differ: ${record.slot}`);
          const image = await decode(png);
          if (controller.signal.aborted || released) {
            image.close?.();
            aborted();
          }
          frames.set(record.slot, { image, geometry: imagePresentation(asset), asset });
          if (image.width !== record.width || image.height !== record.height)
            throw new Error(`Roster image dimensions differ: ${record.slot}`);
        }
        aborted();
        return { frames, manifest, release };
      })(),
    ]);
  } catch (error) {
    release();
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
    controller.abort();
  }
}
