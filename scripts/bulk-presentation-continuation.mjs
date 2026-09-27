/** Source-bound scoped continuation; never grants release or human acceptance. */
import { createHash } from 'node:crypto';
export const BULK_PRESENTATION_REVIEW_PATH =
  'docs/verification/bulk-integration-presentation-continuation-2026-09-27/review.json';
export const BULK_PRESENTATION_REVIEW_SHA256 =
  'ad469766d926795fddca108b77042b226282cc17b3a130429ad2b548b5e2edf5';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function bulkPresentationContinuation(bytes) {
  if (!bytes || hash(bytes) !== BULK_PRESENTATION_REVIEW_SHA256) return null;
  return JSON.parse(bytes);
}

/** Authenticate current evidence and every immutable predecessor, before assembly. */
export async function readBulkPresentationContinuation(read) {
  const bytes = await read(BULK_PRESENTATION_REVIEW_PATH);
  const review = bulkPresentationContinuation(bytes);
  if (!review)
    throw new Error('Presentation continuation review bytes changed; approval must reopen.');
  for (const { path, sha256 } of Object.values(review.priorReviews))
    if (hash(await read(path)) !== sha256)
      throw new Error('Presentation predecessor review bytes changed: ' + path);
  return bytes;
}
