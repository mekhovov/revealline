import { boundedJSON, exactKeys, required } from './data-json.mjs';

/** The public host root is shared; edition/release directories are not optional
 * installation roots. Query parameters never choose a catalog or package. */
export function optionalPracticeCatalogURL(href) {
  const location = new URL(href);
  if (!['http:', 'https:'].includes(location.protocol)) return null;
  const frozen =
    /^(.*\/)(?:editions\/[a-z][a-z0-9-]*\/)?releases\/v\d+\.\d+\.\d+\/site\/game\/(?:(?:controller-lab|couch)\/)?[^/]*$/.exec(
      location.pathname,
    );
  // The optional edition segment must be stripped before the ordinary frozen
  // matcher, whose prefix is intentionally permissive for project hosting.
  const edition =
    /^(.*\/)editions\/[a-z][a-z0-9-]*\/releases\/v\d+\.\d+\.\d+\/site\/game\/(?:(?:controller-lab|couch)\/)?[^/]*$/.exec(
      location.pathname,
    );
  const source = /^(.*\/)game\/(?:(?:controller-lab|couch)\/)?[^/]*$/.exec(location.pathname);
  const root = edition?.[1] ?? frozen?.[1] ?? source?.[1];
  if (!root || !/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(root)) return null;
  return new URL(root + 'practice/index.json', location.origin).href;
}

export function validateOptionalPracticeCatalog(input, indexURL) {
  const value = boundedJSON(input, { maxBytes: 16384, maxNodes: 256, maxArray: 8 });
  exactKeys(value, ['format', 'packages'], 'optional practice catalog');
  required(
    value.format === 'revealline-optional-package-launchers.v1' &&
      Array.isArray(value.packages) &&
      value.packages.length <= 8,
    'Invalid optional practice catalog.',
  );
  const base = new URL(indexURL),
    seen = new Set();
  return value.packages.map((item) => {
    exactKeys(item, ['id', 'name', 'href', 'version', 'revision'], 'optional practice entry');
    required(
      typeof item.id === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(item.id) && !seen.has(item.id),
      'Invalid or repeated optional practice package.',
    );
    required(
      typeof item.name === 'string' &&
        item.name.trim() &&
        item.name.length <= 120 &&
        !/[\x00-\x1f\x7f]/.test(item.name),
      'Invalid optional practice name.',
    );
    required(
      typeof item.version === 'string' &&
        /^v\d+\.\d+\.\d+$/.test(item.version) &&
        typeof item.revision === 'string' &&
        /^[A-Za-z0-9][A-Za-z0-9.-]{0,79}$/.test(item.revision),
      'Invalid optional practice revision.',
    );
    required(
      item.href === item.id + '/app/',
      'Optional practice must use its own stable launcher.',
    );
    seen.add(item.id);
    return Object.freeze({ ...item, url: new URL(item.href, base).href });
  });
}

/** Read only the small public launcher list after an explicit browse action.
 * This never fetches a package, registers a worker or opens player storage. */
export async function loadOptionalPracticeCatalog(
  indexURL,
  { fetcher = globalThis.fetch, signal } = {},
) {
  const response = await fetcher(indexURL, {
    signal,
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'error',
  });
  if (response.status === 404) return [];
  required(response.ok, 'Optional practice catalog is unavailable.');
  const advertised = response.headers?.get('content-length');
  required(!advertised || Number(advertised) <= 16384, 'Optional practice catalog is too large.');
  const reader = response.body?.getReader();
  required(reader, 'Optional practice catalog requires a bounded response.');
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      required(size <= 16384, 'Optional practice catalog is too large.');
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
  return validateOptionalPracticeCatalog(
    new TextDecoder('utf-8', { fatal: true }).decode(bytes),
    indexURL,
  );
}
