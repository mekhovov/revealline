import { createHash, randomUUID } from 'node:crypto';

export const SUBMISSION_STATES = Object.freeze([
  'draft',
  'uploaded',
  'queued',
  'validating',
  'published',
  'rejected',
  'unlisted',
]);

export const PACKAGE_MEDIA_TYPE = 'application/vnd.revealline.rlpack';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export class CommunityError extends Error {
  constructor(statusCode, code, message, { retryAfterSeconds = null } = {}) {
    super(message);
    this.name = 'CommunityError';
    this.statusCode = statusCode;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const fail = (statusCode, code, message) => {
  throw new CommunityError(statusCode, code, message);
};

const plainText = (value, field, { min = 0, max, multiline = false }) => {
  if (typeof value !== 'string') fail(400, 'invalid_request', `${field} must be text.`);
  const normalized = value.normalize('NFC').trim();
  if (normalized.length < min || normalized.length > max)
    fail(400, 'invalid_request', `${field} must contain ${min}-${max} characters.`);
  if (!multiline && /[\r\n]/u.test(normalized))
    fail(400, 'invalid_request', `${field} must be one line.`);
  if (/\p{Cc}/u.test(normalized.replace(/[\n\t]/gu, '')))
    fail(400, 'invalid_request', `${field} contains unsupported control characters.`);
  return normalized;
};

export const normalizeOwnerSubject = (value) =>
  plainText(value, 'owner subject', { min: 1, max: 200 });

export function validateCreateSubmission(input, { ownerSubject, maxPackageBytes }) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    fail(400, 'invalid_request', 'Request body must be an object.');
  const owner = normalizeOwnerSubject(ownerSubject);
  const slug = plainText(input.slug, 'slug', { min: 2, max: 64 });
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug))
    fail(400, 'invalid_request', 'slug must use lowercase letters, numbers, and single hyphens.');
  const editionVersion = plainText(input.version, 'version', { min: 1, max: 64 });
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(editionVersion))
    fail(400, 'invalid_request', 'version must be a semantic version such as 1.0.0.');
  const packageSha256 = plainText(input.packageSha256, 'packageSha256', {
    min: 64,
    max: 64,
  }).toLowerCase();
  if (!/^[a-f0-9]{64}$/u.test(packageSha256))
    fail(400, 'invalid_request', 'packageSha256 must be a lowercase SHA-256 digest.');
  const packageSize = Number(input.packageSize);
  if (!Number.isSafeInteger(packageSize) || packageSize < 1 || packageSize > maxPackageBytes)
    fail(400, 'invalid_request', `packageSize must be between 1 and ${maxPackageBytes} bytes.`);
  const title = plainText(input.title, 'title', { min: 1, max: 120 });
  const description = plainText(input.description ?? '', 'description', {
    max: 2_000,
    multiline: true,
  });
  return {
    id: randomUUID(),
    collectionId: createCollectionId({ ownerSubject: owner, slug }),
    editionId: createEditionId({ ownerSubject: owner, slug, editionVersion, packageSha256 }),
    ownerSubject: owner,
    slug,
    title,
    description,
    editionVersion,
    packageSha256,
    declaredSize: packageSize,
  };
}

export function createCollectionId({ ownerSubject, slug }) {
  const digest = createHash('sha256')
    .update('revealline-community-collection.v1\0')
    .update(ownerSubject)
    .update('\0')
    .update(slug)
    .digest('hex');
  return `co_${digest}`;
}

export function createEditionId({ ownerSubject, slug, editionVersion, packageSha256 }) {
  const digest = createHash('sha256')
    .update('revealline-community-edition.v1\0')
    .update(ownerSubject)
    .update('\0')
    .update(slug)
    .update('\0')
    .update(editionVersion)
    .update('\0')
    .update(packageSha256)
    .digest('hex');
  return `ed_${digest}`;
}

export const createValidationIdempotencyKey = ({ submissionId, packageSha256, validatorVersion }) =>
  createHash('sha256')
    .update('revealline-community-validation.v1\0')
    .update(submissionId)
    .update('\0')
    .update(packageSha256)
    .update('\0')
    .update(validatorVersion)
    .digest('hex');

export const packageBlobKey = (sha256) => `packages/sha256/${sha256.slice(0, 2)}/${sha256}.rlpack`;

export function parseCatalogQuery(query, { defaultLimit = 20, maxLimit = 50 } = {}) {
  const limit = query?.limit === undefined ? defaultLimit : Number(query.limit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > maxLimit)
    fail(400, 'invalid_request', `limit must be between 1 and ${maxLimit}.`);
  const cursor = query?.cursor;
  if (cursor !== undefined && !/^\d{4}-\d\d-\d\dT[^|]+\|ed_[a-f0-9]{64}$/u.test(cursor))
    fail(400, 'invalid_request', 'cursor is invalid.');
  const search = plainText(query?.q ?? '', 'q', { max: 160, multiline: false });
  return { limit, cursor: cursor ?? null, search };
}

export function validateReport(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    fail(400, 'invalid_request', 'Request body must be an object.');
  const reason = plainText(input.reason, 'reason', { min: 3, max: 64 });
  if (!['broken', 'copyright', 'unsafe', 'misleading', 'other'].includes(reason))
    fail(400, 'invalid_request', 'Choose a supported report reason.');
  const details = plainText(input.details ?? '', 'details', { max: 2_000, multiline: true });
  return { reason, details };
}

export function parseReportQuery(query, { defaultLimit = 20, maxLimit = 50 } = {}) {
  const limit = query?.limit === undefined ? defaultLimit : Number(query.limit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > maxLimit)
    fail(400, 'invalid_request', `limit must be between 1 and ${maxLimit}.`);
  const status = query?.status ?? 'open';
  if (!['open', 'resolved'].includes(status))
    fail(400, 'invalid_request', 'status must be open or resolved.');
  const cursor = query?.cursor;
  if (cursor !== undefined) {
    const separator = typeof cursor === 'string' ? cursor.lastIndexOf('|') : -1;
    const timestamp = separator < 0 ? '' : cursor.slice(0, separator);
    const reportId = separator < 0 ? '' : cursor.slice(separator + 1);
    const parsedTimestamp = new Date(timestamp);
    if (
      !UUID_V4.test(reportId) ||
      Number.isNaN(parsedTimestamp.getTime()) ||
      parsedTimestamp.toISOString() !== timestamp
    )
      fail(400, 'invalid_request', 'cursor is invalid.');
  }
  return { limit, status, cursor: cursor ?? null };
}

export function validateReportId(value) {
  if (typeof value !== 'string' || !UUID_V4.test(value))
    fail(400, 'invalid_request', 'report id is invalid.');
  return value;
}

export function validateReportResolution(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    fail(400, 'invalid_request', 'Request body must be an object.');
  return plainText(input.resolution, 'resolution', { min: 1, max: 1_000, multiline: true });
}

export const toAdminReport = (row) => ({
  id: row.id,
  editionId: row.editionId,
  reason: row.reason,
  details: row.details,
  status: row.status,
  createdAt: row.createdAt,
  resolvedAt: row.resolvedAt ?? null,
  resolution: row.resolution ?? null,
});

export const toPublicEdition = (row) => ({
  editionId: row.editionId,
  collectionId: row.collectionId,
  slug: row.slug,
  title: row.title,
  description: row.description,
  version: row.editionVersion,
  packageSha256: row.packageSha256,
  packageSize: row.actualSize,
  publishedAt: row.publishedAt,
  latestEditionId: row.latestEditionId,
  latestVersion: row.latestVersion,
  previewAvailable: true,
});

export const toOwnerSubmission = (row) => ({
  id: row.id,
  editionId: row.editionId,
  slug: row.slug,
  title: row.title,
  description: row.description,
  version: row.editionVersion,
  packageSha256: row.packageSha256,
  packageSize: row.declaredSize,
  status: row.status,
  rejectionCode: row.rejectionCode ?? null,
  validationReport: row.validationReport ?? null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});
