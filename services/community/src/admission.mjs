import { createHash } from 'node:crypto';
import { CommunityError } from './domain.mjs';

export const DEFAULT_ADMISSION_POLICIES = Object.freeze({
  auth: Object.freeze({ limit: 30, windowMs: 5 * 60 * 1_000 }),
  report: Object.freeze({ limit: 6, windowMs: 60 * 60 * 1_000 }),
  submission: Object.freeze({ limit: 12, windowMs: 60 * 60 * 1_000 }),
  uploadBytes: Object.freeze({ limit: 2 * 1024 * 1024 * 1024, windowMs: 24 * 60 * 60 * 1_000 }),
});

const digest = (namespace, value) =>
  createHash('sha256')
    .update(`revealline-community-${namespace}.v1\0`)
    .update(String(value))
    .digest('hex');

const boundedIdentity = (value, name) => {
  if (typeof value !== 'string' || value.length < 1 || value.length > 512)
    throw new Error(`${name} must be a non-empty string of at most 512 characters.`);
  return value;
};

const validatePolicy = (policy, action) => {
  if (
    !policy ||
    !Number.isSafeInteger(policy.limit) ||
    policy.limit < 1 ||
    !Number.isSafeInteger(policy.windowMs) ||
    policy.windowMs < 1
  )
    throw new Error(`Admission policy ${action} needs positive safe-integer limit and windowMs.`);
  return policy;
};

export function createAdmissionController({ repository, policies = DEFAULT_ADMISSION_POLICIES }) {
  if (!repository?.consumeAdmission)
    throw new Error('The community repository must implement consumeAdmission.');
  const checked = Object.fromEntries(
    Object.entries(DEFAULT_ADMISSION_POLICIES).map(([action, fallback]) => [
      action,
      validatePolicy(policies[action] ?? fallback, action),
    ]),
  );

  return Object.freeze({
    async admit({ action, subject, cost = 1, idempotencyKey = null }) {
      const policy = checked[action];
      if (!policy) throw new Error(`Unsupported admission action: ${action}`);
      if (!Number.isSafeInteger(cost) || cost < 1)
        throw new Error('Admission cost must be a positive safe integer.');
      const checkedSubject = boundedIdentity(subject, 'Admission subject');
      const checkedIdempotencyKey =
        idempotencyKey === null
          ? null
          : boundedIdentity(idempotencyKey, 'Admission idempotency key');
      if (cost > policy.limit)
        throw new CommunityError(
          429,
          'quota_exceeded',
          'This operation is larger than the configured account quota.',
          { retryAfterSeconds: Math.ceil(policy.windowMs / 1_000) },
        );
      const result = await repository.consumeAdmission({
        action,
        subjectHash: digest('admission-subject', checkedSubject),
        idempotencyHash:
          checkedIdempotencyKey === null
            ? null
            : digest('admission-idempotency', checkedIdempotencyKey),
        cost,
        limit: policy.limit,
        windowMs: policy.windowMs,
      });
      if (!result.allowed)
        throw new CommunityError(
          429,
          'rate_limited',
          'Too many requests. Retry after the current limit window.',
          { retryAfterSeconds: result.retryAfterSeconds },
        );
      return result;
    },
  });
}
