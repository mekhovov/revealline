/** Exact scoped Team functional review; immutable ancestor records are never edited. */
import { createHash } from 'node:crypto';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const reviewedRecord = '7ecaeb6dc9c2fcf1804ed364ef1b818e3323f4a390629fd4575c0772cf4df45b';
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
}) {
  if (!reviewBytes || hash(reviewBytes) !== reviewedRecord) return unreviewed();
  const review = JSON.parse(reviewBytes);
  const role = review.recipes.find((entry) => entry.slot === slotId);
  if (
    !role ||
    source !==
      `${review.fingerprint.inputs.map((entry) => entry.path).join('; ')} sha256:${review.fingerprint.sha256}` ||
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
    evidence: [
      `Team functional scope only: docs/verification/team37/review.json sha256:${reviewedRecord}`,
    ],
  };
}
