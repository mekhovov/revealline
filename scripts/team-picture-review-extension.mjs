import { createHash } from 'node:crypto';

export const TEAM_PICTURE_REVIEW_EXTENSION_PATH =
  'docs/verification/team-picture-identity-extension/review.json';
export const TEAM_PICTURE_REVIEW_EXTENSION_SHA256 =
  '4fe87617a723983afc3c5a1d3807cc90a35b3548955e4675147c82f1ea3fc935';

/** A scoped continuation of the exact prior Team reviews, never a latest-source
 * approval. Missing/changed evidence or any other source fingerprint stays open. */
export function teamPictureReviewExtension(group, source, bytes) {
  if (
    !bytes ||
    !['team', 'equipment'].includes(group) ||
    createHash('sha256').update(bytes).digest('hex') !== TEAM_PICTURE_REVIEW_EXTENSION_SHA256
  )
    return null;
  const review = JSON.parse(bytes),
    fingerprint = review.fingerprints[group],
    expected =
      group === 'team'
        ? `${fingerprint.inputs.map((entry) => entry.path).join('; ')} sha256:${fingerprint.sha256}`
        : fingerprint.sha256;
  return source === expected
    ? `Authored-picture identity continuation only: ${TEAM_PICTURE_REVIEW_EXTENSION_PATH} sha256:${TEAM_PICTURE_REVIEW_EXTENSION_SHA256}`
    : null;
}
