import { required } from '../data-json.mjs';

const TUS_VERSION = '1.0.0';
const DEFAULT_CHUNK_BYTES = 4 * 1024 * 1024;
const encode = (value) => {
  const bytes = new TextEncoder().encode(String(value));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};
const metadataHeader = (metadata) =>
  Object.entries(metadata ?? {})
    .map(([key, value]) => {
      required(/^[A-Za-z0-9_-]+$/u.test(key), 'Upload metadata key is invalid.');
      return `${key} ${encode(value)}`;
    })
    .join(',');
const uploadError = async (response, action) => {
  if (response.ok) return;
  const message = (await response.text()).slice(0, 500).trim();
  throw new Error(`${action} failed (${response.status})${message ? `: ${message}` : '.'}`);
};
const storageKey = (descriptor) =>
  `revealline.community.tus.v1:${descriptor.packageSha256}:${descriptor.packageSize}:${descriptor.metadata?.submissionId ?? ''}`;

/** Bounded tus 1.0 client for the service's creation, HEAD and PATCH contract.
 * The retained URL contains no credential and lets a later invocation resume
 * at the authoritative server offset after interruption or page reload. */
export function createTusBrowserUpload({
  baseURL,
  fetchImpl = globalThis.fetch,
  storage = globalThis.localStorage,
  chunkBytes = DEFAULT_CHUNK_BYTES,
} = {}) {
  required(typeof fetchImpl === 'function', 'Upload network adapter is required.');
  required(Number.isSafeInteger(chunkBytes) && chunkBytes > 0, 'Upload chunk size is invalid.');
  const base = new URL(baseURL ?? '/', globalThis.location?.href ?? 'https://local/');
  const sameOriginURL = (value, relativeTo = base) => {
    const result = new URL(value, relativeTo);
    required(result.origin === base.origin, 'Upload service returned a cross-origin location.');
    return result;
  };
  const stored = {
    get(key) {
      try {
        return storage?.getItem?.(key) ?? null;
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        storage?.setItem?.(key, value);
      } catch {
        // The active invocation can continue even when persistence is unavailable.
      }
    },
    remove(key) {
      try {
        storage?.removeItem?.(key);
      } catch {
        // Nothing sensitive is retained by this module outside the storage adapter.
      }
    },
  };
  return async ({ descriptor, blob, onProgress, authHeaders }) => {
    required(
      descriptor?.protocol === 'tus-1.0' && descriptor.resumable === true,
      'Unsupported resumable upload instructions.',
    );
    required(
      blob instanceof Blob && blob.size === descriptor.packageSize,
      'Upload bytes differ from the declared package.',
    );
    const auth = typeof authHeaders === 'function' ? await authHeaders() : {};
    const common = { ...auth, 'tus-resumable': TUS_VERSION };
    const key = storageKey(descriptor);
    let uploadURL = stored.get(key);
    let offset = 0;

    if (uploadURL) {
      const resumed = await fetchImpl(sameOriginURL(uploadURL), {
        method: 'HEAD',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: common,
      });
      if (resumed.status === 404 || resumed.status === 410) {
        stored.remove(key);
        uploadURL = null;
      } else {
        await uploadError(resumed, 'Upload resume');
        offset = Number(resumed.headers.get('upload-offset'));
        required(
          Number.isSafeInteger(offset) && offset >= 0 && offset <= blob.size,
          'Server upload offset is invalid.',
        );
      }
    }

    if (!uploadURL) {
      const endpoint = sameOriginURL(descriptor.href);
      const created = await fetchImpl(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          ...common,
          'upload-length': String(blob.size),
          'upload-metadata': metadataHeader(descriptor.metadata),
        },
      });
      await uploadError(created, 'Upload creation');
      required(created.status === 201, 'Upload service did not create a tus resource.');
      const location = created.headers.get('location');
      required(location, 'Upload service omitted the resumable location.');
      uploadURL = sameOriginURL(location, endpoint).href;
      stored.set(key, uploadURL);
    }

    onProgress?.({ uploaded: offset, total: blob.size });
    while (offset < blob.size) {
      const end = Math.min(blob.size, offset + chunkBytes);
      let patched;
      try {
        patched = await fetchImpl(uploadURL, {
          method: 'PATCH',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: {
            ...common,
            'content-type': 'application/offset+octet-stream',
            'upload-offset': String(offset),
          },
          body: blob.slice(offset, end),
        });
      } catch (error) {
        throw new Error(`Upload interrupted at ${offset} bytes. Try publishing again to resume.`, {
          cause: error,
        });
      }
      await uploadError(patched, 'Upload chunk');
      const next = Number(patched.headers.get('upload-offset'));
      required(
        Number.isSafeInteger(next) && next > offset && next <= blob.size,
        'Server upload offset did not advance.',
      );
      offset = next;
      onProgress?.({ uploaded: offset, total: blob.size });
    }
    stored.remove(key);
    return Object.freeze({ uploaded: offset, total: blob.size, resumable: true });
  };
}
