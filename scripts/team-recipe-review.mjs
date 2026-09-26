/** Exact scoped Team functional review; immutable ancestor records are never edited. */
import { createHash } from 'node:crypto';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const reviewedRecord = '7ecaeb6dc9c2fcf1804ed364ef1b818e3323f4a390629fd4575c0772cf4df45b';
const successorRecord = '45e41eee3cacac251ede3f0304834a1fda311f8bd70f4d0b66aaceb493b8fc05';
const continuationRecord = 'fbc818dcfbbfd2cf1985017417959c82741162842cd3c7293f5be67fc594ef35';
const priorReviewPath = 'docs/verification/team37/review.json';
const successorReviewPath = 'docs/verification/team-specialist-cues-2026-09-24/review.json';
const continuationReviewPath = 'docs/verification/v0.132.5-presentation-continuation/review.json';
const canonical = (value) => JSON.stringify(sort(value));
function sort(value) {
  if (Array.isArray(value)) return value.map(sort);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sort(value[key])]),
    );
  return value;
}
const digest = (value) => hash(canonical(value));
const unreviewed = () => ({
  stage: 'source',
  evidence: ['Connected Team recipe; exact scoped functional review inputs did not match.'],
});

export function fieldKitTeamRecipeQuality({
  slotId,
  source,
  recipe,
  defaultAsset,
  inheritedAssets,
  reviewBytes,
  successorReviewBytes,
  continuationReviewBytes,
}) {
  if (!reviewBytes || hash(reviewBytes) !== reviewedRecord) return unreviewed();
  const review = JSON.parse(reviewBytes);
  let evidence = `Team functional scope only: ${priorReviewPath} sha256:${reviewedRecord}`;
  const originalSource = `${review.fingerprint.inputs.map((entry) => entry.path).join('; ')} sha256:${review.fingerprint.sha256}`;
  if (source !== originalSource) {
    if (!successorReviewBytes || hash(successorReviewBytes) !== successorRecord)
      return unreviewed();
    const successor = JSON.parse(successorReviewBytes);
    if (
      successor.format !== 'revealline-scoped-team-recipe-review-successor.v1' ||
      successor.priorReview?.path !== priorReviewPath ||
      successor.priorReview?.sha256 !== reviewedRecord ||
      successor.priorReview?.fingerprintSHA256 !== review.fingerprint.sha256 ||
      successor.fingerprint?.group !== 'team' ||
      successor.fingerprint?.paths !==
        review.fingerprint.inputs.map((entry) => entry.path).join('; ')
    )
      return unreviewed();
    const successorSource = `${successor.fingerprint.paths} sha256:${successor.fingerprint.sha256}`;
    if (source === successorSource) {
      evidence = `Team specialist functional successor: ${successorReviewPath} sha256:${successorRecord}; prior ${priorReviewPath} sha256:${reviewedRecord}`;
    } else {
      if (!continuationReviewBytes || hash(continuationReviewBytes) !== continuationRecord)
        return unreviewed();
      const continuation = JSON.parse(continuationReviewBytes);
      if (
        continuation.format !== 'revealline-v0.132.5-presentation-continuation.v1' ||
        continuation.priorReviews?.team?.path !== priorReviewPath ||
        continuation.priorReviews?.team?.sha256 !== reviewedRecord ||
        continuation.priorReviews?.teamSuccessor?.path !== successorReviewPath ||
        continuation.priorReviews?.teamSuccessor?.sha256 !== successorRecord ||
        continuation.priorReviews?.teamSuccessor?.fingerprintSHA256 !==
          successor.fingerprint.sha256 ||
        continuation.fingerprints?.team?.group !== 'team' ||
        continuation.fingerprints?.team?.priorSHA256 !== successor.fingerprint.sha256 ||
        source !==
          `${continuation.fingerprints.team.paths} sha256:${continuation.fingerprints.team.currentSHA256}`
      )
        return unreviewed();
      evidence = `v0.132.5 exact Team continuation: ${continuationReviewPath} sha256:${continuationRecord}; prior ${successorReviewPath} sha256:${successorRecord}; original ${priorReviewPath} sha256:${reviewedRecord}`;
    }
  }
  const role = review.recipes.find((entry) => entry.slot === slotId);
  if (
    !role ||
    !recipe ||
    digest(recipe) !== role.recipePayloadSHA256 ||
    !defaultAsset ||
    digest(defaultAsset) !== role.defaultRecordSHA256
  )
    return unreviewed();
  for (const expected of review.inheritedImages) {
    const asset = inheritedAssets?.[expected.asset.id];
    // Fresh assembly must match the complete original produced revision 1.
    // Immutable retention separately preserves the reviewed revision 2.
    // Actual original bytes have already been authenticated by production add().
    if (
      !asset ||
      asset.revision !== 1 ||
      asset.kind !== 'image' ||
      asset.quality?.stage !== 'produced' ||
      digest(asset) !== expected.assemblyRecordSHA256
    )
      return unreviewed();
  }
  return {
    stage: 'reviewed',
    evidence: [evidence],
  };
}
