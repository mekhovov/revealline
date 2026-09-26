import { freezeDesign } from './catalogs.mjs';

/** A publisher-pinned source snapshot retains the full navigation/progress contract.
 * Artwork remains in individually selectable packages and is never prefetched here. */
export async function loadRouteSnapshot(
  descriptor,
  { fetchAsset = (path, options) => fetch(new URL(path, import.meta.url), options), signal } = {},
) {
  if (
    !descriptor ||
    !/^runtime\/[a-z0-9-]+\.json$/.test(descriptor.path) ||
    !/^[a-f0-9]{64}$/.test(descriptor.sha256) ||
    !Number.isSafeInteger(descriptor.bytes) ||
    descriptor.bytes < 1 ||
    descriptor.bytes > 2 * 1024 * 1024
  )
    throw new Error('Invalid published Journey snapshot.');
  const response = await fetchAsset(descriptor.path, { signal, redirect: 'error' });
  if (!response.ok || response.redirected || !response.body?.getReader)
    throw new Error('The prepared Journey catalogue is unavailable.');
  const bytes = new Uint8Array(descriptor.bytes),
    reader = response.body.getReader();
  let length = 0;
  try {
    for (;;) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      if (length + value.length > bytes.length)
        throw new Error('Journey snapshot exceeds its pinned size.');
      bytes.set(value, length);
      length += value.length;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  if (length !== bytes.length) throw new Error('Journey snapshot is incomplete.');
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  if (hash !== descriptor.sha256) throw new Error('Journey snapshot failed integrity checking.');
  const route = JSON.parse(new TextDecoder().decode(bytes));
  if (route.id !== descriptor.id || !route.source || !Array.isArray(route.source.missions))
    throw new Error('Journey snapshot has a different edition.');
  return freezeDesign(route);
}
