import { boundedJSON, required } from '../data-json.mjs';
import { CREATOR_BUNDLE_LIMITS } from '../creator/bundle.mjs';

const EDITION = /^ed_[a-f0-9]{64}$/u;
const HASH = /^[a-f0-9]{64}$/u;
const SUBMISSION = /^[0-9a-f-]{16,64}$/iu;
const plain = (value, name, max, { empty = false } = {}) => {
  required(typeof value === 'string' && value.length <= max, `${name} is invalid.`);
  required(empty || value.length > 0, `${name} is required.`);
  return value;
};
const json = async (response) => {
  const text = await response.text();
  let value;
  try {
    value = boundedJSON(text, {
      maxBytes: 256 * 1024,
      maxNodes: 10_000,
      maxDepth: 12,
    });
  } catch {
    throw new Error('The community service returned unreadable data.');
  }
  if (!response.ok)
    throw new Error(value?.error?.message || `Community request failed (${response.status}).`);
  return value;
};

export function validateCommunityEdition(source) {
  required(source && typeof source === 'object' && !Array.isArray(source), 'Edition is invalid.');
  required(EDITION.test(source.editionId), 'Edition identity is invalid.');
  required(HASH.test(source.packageSha256), 'Package identity is invalid.');
  required(
    Number.isSafeInteger(source.packageSize) &&
      source.packageSize > 0 &&
      source.packageSize <= CREATOR_BUNDLE_LIMITS.bytes,
    'Package size is unsupported.',
  );
  const publishedAt = plain(source.publishedAt, 'Publication time', 64);
  required(Number.isFinite(Date.parse(publishedAt)), 'Publication time is invalid.');
  return Object.freeze({
    editionId: source.editionId,
    slug: plain(source.slug, 'Collection slug', 64),
    title: plain(source.title, 'Title', 120),
    description: plain(source.description ?? '', 'Description', 2_000, {
      empty: true,
    }),
    version: plain(source.version, 'Version', 64),
    packageSha256: source.packageSha256,
    packageSize: source.packageSize,
    publishedAt,
  });
}

const headers = async (provider, authenticated) => {
  if (!authenticated) return {};
  required(typeof provider === 'function', 'A configured creator account is required to publish.');
  const result = await provider();
  required(result && typeof result === 'object', 'Creator authentication is unavailable.');
  return result;
};

/** Fetch is injected so the static game can use the self-hosted service without
 * coupling catalog browsing to authentication, tus, or a hosting provider. */
export function createCommunityClient({
  baseURL,
  fetchImpl = globalThis.fetch,
  authHeaders,
  resumableUpload,
} = {}) {
  required(typeof fetchImpl === 'function', 'Community network adapter is required.');
  const base = new URL(baseURL ?? '/community-api/', globalThis.location?.href ?? 'https://local/');
  const request = (path, init = {}) => fetchImpl(new URL(path.replace(/^\//u, ''), base), init);
  return Object.freeze({
    async catalog({ cursor = null, limit = 50 } = {}) {
      const url = new URL('v1/catalog', base);
      url.searchParams.set('limit', String(limit));
      if (cursor) url.searchParams.set('cursor', cursor);
      const body = await json(await fetchImpl(url));
      required(Array.isArray(body.editions), 'Catalog response is invalid.');
      return Object.freeze({
        editions: Object.freeze(body.editions.map(validateCommunityEdition)),
        nextCursor: body.nextCursor === null ? null : plain(body.nextCursor, 'Cursor', 256),
      });
    },
    async edition(editionId) {
      required(EDITION.test(editionId), 'Choose a valid community edition.');
      const body = await json(await request(`v1/catalog/${editionId}`));
      return validateCommunityEdition(body.edition);
    },
    async download(edition) {
      const safe = validateCommunityEdition(edition);
      const response = await request(`v1/catalog/${safe.editionId}/download`);
      if (!response.ok) throw new Error(`Community download failed (${response.status}).`);
      const blob = await response.blob();
      required(blob.size === safe.packageSize, 'Downloaded package size differs from the catalog.');
      return blob;
    },
    async createSubmission(metadata) {
      const response = await request('v1/submissions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(await headers(authHeaders, true)),
        },
        body: JSON.stringify(metadata),
      });
      return json(response);
    },
    async uploadSubmission(created, blob, { onProgress } = {}) {
      const descriptor = created?.upload;
      required(
        descriptor && typeof descriptor.href === 'string',
        'Upload instructions are missing.',
      );
      if (descriptor.resumable) {
        required(
          typeof resumableUpload === 'function',
          'This server requires the configured resumable upload adapter.',
        );
        return resumableUpload({ descriptor, blob, onProgress, authHeaders });
      }
      required(descriptor.method === 'PUT', 'Unsupported upload instructions.');
      const response = await fetchImpl(new URL(descriptor.href, base), {
        method: 'PUT',
        headers: {
          'content-type': descriptor.mediaType || 'application/octet-stream',
          ...(await headers(authHeaders, true)),
        },
        body: blob,
      });
      onProgress?.({ uploaded: blob.size, total: blob.size });
      return json(response);
    },
    async submit(submissionId) {
      required(SUBMISSION.test(submissionId), 'Submission identity is invalid.');
      return json(
        await request(`v1/submissions/${submissionId}/submit`, {
          method: 'POST',
          headers: await headers(authHeaders, true),
        }),
      );
    },
    async submission(submissionId) {
      required(SUBMISSION.test(submissionId), 'Submission identity is invalid.');
      return json(
        await request(`v1/submissions/${submissionId}`, {
          headers: await headers(authHeaders, true),
        }),
      );
    },
  });
}
