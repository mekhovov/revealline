import { createHash, randomUUID } from 'node:crypto';

export const SUBMISSION_STATES = Object.freeze([
  'draft',
  'uploaded',
  'queued',
  'validating',
  'published',
  'rejected',
]);

export const PACKAGE_MEDIA_TYPE = 'application/vnd.revealline.rlpack';

export class CommunityError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = 'CommunityError';
    this.statusCode = statusCode;
    this.code = code;
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
  return { limit, cursor: cursor ?? null };
}

export const toPublicEdition = (row) => ({
  editionId: row.editionId,
  slug: row.slug,
  title: row.title,
  description: row.description,
  version: row.editionVersion,
  packageSha256: row.packageSha256,
  packageSize: row.actualSize,
  publishedAt: row.publishedAt,
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
