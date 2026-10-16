import { required } from '../data-json.mjs';
import { LIMITS, validateThemeBundle } from './model.mjs';
import { verifyThemeAssets } from './bundle.mjs';
import { decodePresentationDocument } from './document-codec.mjs';

const extensions = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'font/ttf': 'ttf',
  'font/otf': 'otf',
  'font/woff2': 'woff2',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
};
const abort = (signal) => {
  if (signal?.aborted) throw new DOMException('Release asset load cancelled.', 'AbortError');
};
/** Read only the release's fixed compiler output. Uploaded manifests cannot
 * choose a URL. Studio storage and player storage are never touched here. */
export async function loadPublishedStudio({
  fetch = globalThis.fetch,
  baseURL = new URL('./compiled/', import.meta.url),
  signal,
} = {}) {
  const base = new URL(baseURL);
  required(
    !base.search && !base.hash && base.pathname.endsWith('/'),
    'Invalid release asset base.',
  );
  const cancellation = new AbortController();
  const cancel = () => cancellation.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  const requestSignal = cancellation.signal;
  const bytesAt = async (relative, limit, optional = false) => {
    abort(requestSignal);
    const url = new URL(relative, base);
    const response = await fetch(url.href, {
      signal: requestSignal,
      redirect: 'error',
      cache: 'no-cache',
    });
    abort(requestSignal);
    if (optional && response.status === 404) return null;
    required(response.ok && !response.redirected, 'Release asset request failed.');
    if (response.url) required(response.url === url.href, 'Release asset URL changed.');
    const length = response.headers.get('content-length');
    if (length !== null)
      required(
        /^\d+$/.test(length) && Number(length) <= limit,
        'Release asset exceeds its byte budget.',
      );
    const reader = response.body?.getReader();
    required(reader, 'Release asset body is unavailable.');
    const chunks = [];
    let total = 0;
    try {
      while (true) {
        abort(requestSignal);
        const { value, done } = await reader.read();
        abort(requestSignal);
        if (done) break;
        total += value.length;
        required(total <= limit, 'Release asset exceeds its byte budget.');
        chunks.push(value);
      }
    } catch (error) {
      await reader.cancel().catch(() => {});
      throw error;
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(total);
    let at = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, at);
      at += chunk.length;
    }
    return bytes;
  };
  try {
    const source = await bytesAt('studio.json', LIMITS.manifestBytes, true);
    if (!source) return null;
    const document = validateThemeBundle(
      decodePresentationDocument(new TextDecoder('utf-8', { fatal: true }).decode(source)),
    );
    const files = new Map(
      document.assets.filter((a) => a.file).map((a) => [a.file.sha256, a.file]),
    );
    required(
      [...files.values()].reduce((sum, f) => sum + f.bytes, 0) <= LIMITS.bundleBytes,
      'Release assets exceed the theme budget.',
    );
    const assets = new Map();
    // Four bounded readers avoid opening hundreds of simultaneous connections.
    const pending = [...files];
    let index = 0;
    const load = async () => {
      while (index < pending.length && !cancellation.signal.aborted) {
        const [hash, file] = pending[index++];
        const bytes = await bytesAt(`assets/${hash}.${extensions[file.mime]}`, file.bytes);
        required(bytes.length === file.bytes, 'Release asset is truncated.');
        assets.set(hash, new Blob([bytes], { type: file.mime }));
      }
    };
    const results = await Promise.allSettled(
      Array.from({ length: Math.min(4, pending.length) }, () =>
        load().catch((error) => {
          cancellation.abort();
          throw error;
        }),
      ),
    );
    for (const result of results) if (result.status === 'rejected') throw result.reason;
    abort(signal);
    return { document, assets: await verifyThemeAssets(document, assets, { signal }) };
  } finally {
    cancellation.abort();
    signal?.removeEventListener('abort', cancel);
  }
}
