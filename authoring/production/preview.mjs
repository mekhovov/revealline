import { t } from '../../game/i18n/index.mjs';
import { validateSourcePath } from './model.mjs';

export const PREVIEW_BYTES = 8 * 1024 * 1024;
export const PREVIEW_PIXELS = 8 * 1024 * 1024;
export function sourceURL(sourcePath, rootURL) {
  validateSourcePath(sourcePath);
  const root = new URL(rootURL);
  if (
    !['http:', 'https:'].includes(root.protocol) ||
    root.username ||
    root.password ||
    root.search ||
    root.hash ||
    !root.pathname.endsWith('/')
  )
    throw new Error(t("tools:serveTheRepositoryOverLocalhostOrHttps"));
  const url = new URL(sourcePath, root);
  if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname))
    throw new Error(t("tools:onlySourcesInThisServedRepositoryCanBePreviewed"));
  return url.href;
}
function checkAbort(signal) {
  if (signal?.aborted) throw new Error(t("tools:previewCancelled"));
}
function abortable(promise, signal) {
  checkAbort(signal);
  return new Promise((resolve, reject) => {
    const aborted = () => reject(new Error(t("tools:previewCancelled")));
    signal?.addEventListener('abort', aborted, { once: true });
    Promise.resolve(promise)
      .then(resolve, reject)
      .finally(() => signal?.removeEventListener('abort', aborted));
  });
}
export async function readSourceBytes(
  url,
  maxBytes,
  { signal, fetchSource = globalThis.fetch } = {},
) {
  checkAbort(signal);
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > PREVIEW_BYTES)
    throw new Error(t("tools:aBoundedSourceSizeUpTo8MibIsRequired"));
  const response = await abortable(
    fetchSource(url, { signal, redirect: 'error', credentials: 'same-origin', cache: 'no-store' }),
    signal,
  );
  if (!response.ok || response.redirected || (response.url && response.url !== url)) {
    void response.body?.cancel().catch(() => {});
    throw new Error(t("tools:sourceUnavailableAtItsDeclaredPath"));
  }
  if (Number(response.headers.get('content-length') || 0) > maxBytes) {
    void response.body?.cancel().catch(() => {});
    throw new Error(t("tools:sourceExceedsThePreviewLimit"));
  }
  if (!response.body?.getReader)
    throw new Error(t("tools:boundedSourceReadingIsUnavailableInThisBrowser"));
  const reader = response.body.getReader(),
    chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await abortable(reader.read(), signal);
      checkAbort(signal);
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error(t("tools:sourceExceedsThePreviewLimit"));
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
export async function loadProductionImage(
  entry,
  {
    rootURL,
    signal,
    fetchSource = globalThis.fetch,
    cryptoSource = globalThis.crypto,
    urlAPI = URL,
    makeImage = () => document.createElement('img'),
  } = {},
) {
  const { file, width, height } = entry;
  const url = sourceURL(file.path, rootURL);
  if (!['original', 'poster', 'concept'].includes(entry.role) || !file.path.endsWith('.png'))
    throw new Error(t("tools:onlyAnExplicitPngOriginalPosterOrConceptCanBe"));
  if (
    !Number.isSafeInteger(file.bytes) ||
    file.bytes < 1 ||
    file.bytes > PREVIEW_BYTES ||
    !/^[a-f0-9]{64}$/.test(file.sha256)
  )
    throw new Error(t("tools:thisPreviewAcceptsDeclaredPngFilesUpTo8Mib"));
  if (
    ![width, height].every((x) => Number.isSafeInteger(x) && x > 0 && x <= 4096) ||
    width * height > PREVIEW_PIXELS
  )
    throw new Error(t("tools:thisPreviewAcceptsUpTo4096PixelsPerEdgeAnd"));
  const bytes = await readSourceBytes(url, file.bytes, { signal, fetchSource });
  checkAbort(signal);
  if (bytes.length !== file.bytes)
    throw new Error(t("tools:sourceByteCountDiffersFromTheDeclaredOriginal"));
  const digest = new Uint8Array(
    await abortable(cryptoSource.subtle.digest('SHA-256', bytes), signal),
  );
  if (Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('') !== file.sha256)
    throw new Error(t("tools:sourceSha256DiffersFromTheDeclaredOriginal"));
  const data = new DataView(bytes.buffer);
  if (
    bytes.length < 24 ||
    data.getUint32(0) !== 0x89504e47 ||
    data.getUint32(4) !== 0x0d0a1a0a ||
    data.getUint32(12) !== 0x49484452 ||
    data.getUint32(16) !== width ||
    data.getUint32(20) !== height
  )
    throw new Error(t("tools:pngDimensionsDifferFromTheDeclaredOriginal"));
  checkAbort(signal);
  const image = makeImage(),
    objectURL = urlAPI.createObjectURL(new Blob([bytes], { type: 'image/png' }));
  let disposed = false;
  const dispose = () => {
    if (!disposed) {
      disposed = true;
      image.removeAttribute('src');
      urlAPI.revokeObjectURL(objectURL);
    }
  };
  try {
    image.alt = t("tools:sourcePreview", { value1: file.path });
    image.src = objectURL;
    await abortable(image.decode(), signal);
    checkAbort(signal);
    if (image.naturalWidth !== width || image.naturalHeight !== height)
      throw new Error(t("tools:decodedDimensionsDifferFromTheDeclaredOriginal"));
    return { image, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
