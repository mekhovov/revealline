import { boundedJSON, required } from '../data-json.mjs';
import { CREATOR_BUNDLE_LIMITS } from '../creator/bundle.mjs';

const EDITION = /^ed_[a-f0-9]{64}$/u;
const COLLECTION = /^co_[a-f0-9]{64}$/u;
const HASH = /^[a-f0-9]{64}$/u;
const SUBMISSION = /^[0-9a-f-]{16,64}$/iu;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SUBMISSION_STATES = new Set([
  'draft',
  'uploaded',
  'queued',
  'validating',
  'published',
  'rejected',
  'unlisted',
]);
const REPORT_REASONS = new Set(['broken', 'copyright', 'unsafe', 'misleading', 'other']);
const REPORT_STATES = new Set(['open', 'resolved']);
const REPORT_FIELDS = new Set([
  'id',
  'editionId',
  'reason',
  'details',
  'status',
  'createdAt',
  'resolvedAt',
  'resolution',
]);
const plain = (value, name, max, { empty = false } = {}) => {
  required(typeof value === 'string' && value.length <= max, `${name} is invalid.`);
  required(empty || value.length > 0, `${name} is required.`);
  return value;
};
const exactObject = (source, name, fields) => {
  required(source && typeof source === 'object' && !Array.isArray(source), `${name} is invalid.`);
  required(
    Object.keys(source).every((field) => fields.has(field)),
    `${name} contains unsupported fields.`,
  );
  return source;
};
const instant = (value, name) => {
  const timestamp = plain(value, name, 64);
  const parsed = new Date(timestamp);
  required(
    !Number.isNaN(parsed.getTime()) && parsed.toISOString() === timestamp,
    `${name} is invalid.`,
  );
  return timestamp;
};
const reportCursor = (value) => {
  const cursor = plain(value, 'Report cursor', 256);
  const separator = cursor.lastIndexOf('|');
  required(separator > 0 && separator < cursor.length - 1, 'Report cursor is invalid.');
  instant(cursor.slice(0, separator), 'Report cursor time');
  required(UUID_V4.test(cursor.slice(separator + 1)), 'Report cursor is invalid.');
  return cursor;
};
const moderationText = (value, name, max) => {
  required(typeof value === 'string', `${name} is invalid.`);
  const normalized = value.normalize('NFC').trim();
  required(
    normalized.length >= 1 &&
      normalized.length <= max &&
      !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(normalized),
    `${name} is invalid.`,
  );
  return normalized;
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
    collectionId: COLLECTION.test(source.collectionId) ? source.collectionId : null,
    latestEditionId: EDITION.test(source.latestEditionId) ? source.latestEditionId : null,
    latestVersion:
      typeof source.latestVersion === 'string' && source.latestVersion.length <= 64
        ? source.latestVersion
        : null,
    previewAvailable: source.previewAvailable === true,
  });
}

export function validateCommunitySubmission(source) {
  required(
    source && typeof source === 'object' && !Array.isArray(source),
    'Submission is invalid.',
  );
  required(SUBMISSION.test(source.id), 'Submission identity is invalid.');
  required(SUBMISSION_STATES.has(source.status), 'Submission status is invalid.');
  return Object.freeze({
    id: source.id,
    editionId: EDITION.test(source.editionId) ? source.editionId : null,
    status: source.status,
    rejectionCode:
      source.rejectionCode === null || source.rejectionCode === undefined
        ? null
        : plain(source.rejectionCode, 'Rejection code', 96),
    validationReport:
      source.validationReport && typeof source.validationReport === 'object'
        ? structuredClone(source.validationReport)
        : null,
    terminal: ['published', 'rejected', 'unlisted'].includes(source.status),
  });
}

export function validateCommunityReport(source) {
  exactObject(source, 'Report', REPORT_FIELDS);
  required(UUID_V4.test(source.id), 'Report identity is invalid.');
  required(EDITION.test(source.editionId), 'Reported edition identity is invalid.');
  required(REPORT_REASONS.has(source.reason), 'Report reason is invalid.');
  const details = plain(source.details, 'Report details', 2_000, { empty: true });
  required(REPORT_STATES.has(source.status), 'Report status is invalid.');
  const createdAt = instant(source.createdAt, 'Report creation time');
  let resolvedAt = null;
  let resolution = null;
  if (source.status === 'open') {
    required(
      source.resolvedAt === null && source.resolution === null,
      'Open report resolution is invalid.',
    );
  } else {
    resolvedAt = instant(source.resolvedAt, 'Report resolution time');
    resolution = plain(source.resolution, 'Report resolution', 1_000);
  }
  return Object.freeze({
    id: source.id,
    editionId: source.editionId,
    reason: source.reason,
    details,
    status: source.status,
    createdAt,
    resolvedAt,
    resolution,
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
  const request = (path, init = {}) =>
    fetchImpl(new URL(path.replace(/^\//u, ''), base), {
      credentials: 'same-origin',
      ...init,
    });
  return Object.freeze({
    async catalog({ cursor = null, limit = 20, query = '' } = {}) {
      required(
        Number.isSafeInteger(limit) && limit >= 1 && limit <= 50,
        'Catalog page size is invalid.',
      );
      required(typeof query === 'string' && query.length <= 160, 'Catalog search is invalid.');
      const url = new URL('v1/catalog', base);
      url.searchParams.set('limit', String(limit));
      if (cursor) url.searchParams.set('cursor', cursor);
      if (query.trim()) url.searchParams.set('q', query.trim());
      const body = await json(await fetchImpl(url, { credentials: 'same-origin' }));
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
    async preview(edition) {
      const safe = validateCommunityEdition(edition);
      required(safe.previewAvailable, 'This edition has no catalog preview.');
      const response = await request(`v1/catalog/${safe.editionId}/preview`);
      if (!response.ok) throw new Error(`Community preview failed (${response.status}).`);
      const type = response.headers.get('content-type')?.split(';')[0];
      required(
        ['image/png', 'image/jpeg'].includes(type),
        'Community preview type is unsupported.',
      );
      const blob = await response.blob();
      required(blob.size > 0 && blob.size <= 4 * 1024 * 1024, 'Community preview is too large.');
      return blob;
    },
    async reportEdition(editionId, { reason, details = '' } = {}) {
      required(EDITION.test(editionId), 'Choose a valid community edition.');
      required(REPORT_REASONS.has(reason), 'Choose a report reason.');
      required(
        typeof details === 'string' && details.length <= 2_000,
        'Report details are invalid.',
      );
      return json(
        await request(`v1/catalog/${editionId}/reports`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ reason, details }),
        }),
      );
    },
    async listAdminReports({ status = 'open', limit = 20, cursor = null } = {}) {
      required(REPORT_STATES.has(status), 'Report status filter is invalid.');
      required(
        Number.isSafeInteger(limit) && limit >= 1 && limit <= 50,
        'Report page size is invalid.',
      );
      if (cursor !== null) reportCursor(cursor);
      const url = new URL('v1/admin/reports', base);
      url.searchParams.set('status', status);
      url.searchParams.set('limit', String(limit));
      if (cursor) url.searchParams.set('cursor', cursor);
      const body = await json(
        await fetchImpl(url, {
          credentials: 'same-origin',
          headers: await headers(authHeaders, true),
        }),
      );
      exactObject(body, 'Report queue response', new Set(['reports', 'nextCursor']));
      required(
        Array.isArray(body.reports) && body.reports.length <= limit,
        'Report queue response is invalid.',
      );
      return Object.freeze({
        reports: Object.freeze(body.reports.map(validateCommunityReport)),
        nextCursor: body.nextCursor === null ? null : reportCursor(body.nextCursor),
      });
    },
    async resolveAdminReport(reportId, resolution) {
      required(UUID_V4.test(reportId), 'Report identity is invalid.');
      const safeResolution = moderationText(resolution, 'Report resolution', 1_000);
      const body = await json(
        await request(`v1/admin/reports/${reportId}/resolve`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(await headers(authHeaders, true)),
          },
          body: JSON.stringify({ resolution: safeResolution }),
        }),
      );
      exactObject(body, 'Report resolution response', new Set(['report', 'reused']));
      required(typeof body.reused === 'boolean', 'Report resolution response is invalid.');
      const report = validateCommunityReport(body.report);
      required(
        report.id === reportId && report.status === 'resolved',
        'Resolved report differs from the request.',
      );
      return Object.freeze({ report, reused: body.reused });
    },
    async adminUnlistEdition(editionId, reason) {
      required(EDITION.test(editionId), 'Choose a valid community edition.');
      const safeReason = moderationText(reason, 'Unlisting reason', 2_000);
      const body = await json(
        await request(`v1/admin/catalog/${editionId}/unlist`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(await headers(authHeaders, true)),
          },
          body: JSON.stringify({ reason: safeReason }),
        }),
      );
      exactObject(body, 'Administrative unlisting response', new Set(['editionId', 'status']));
      required(
        body.editionId === editionId && body.status === 'unlisted',
        'Unlisted edition differs from the request.',
      );
      return Object.freeze({ editionId: body.editionId, status: body.status });
    },
    async unlistEdition(editionId) {
      required(EDITION.test(editionId), 'Choose a valid community edition.');
      const body = await json(
        await request(`v1/publications/${editionId}/unlist`, {
          method: 'POST',
          headers: await headers(authHeaders, true),
        }),
      );
      return validateCommunitySubmission(body.submission);
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
        credentials: 'same-origin',
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
      const body = await json(
        await request(`v1/submissions/${submissionId}`, {
          headers: await headers(authHeaders, true),
        }),
      );
      return Object.freeze({
        ...body,
        submission: validateCommunitySubmission(body.submission),
      });
    },
  });
}
