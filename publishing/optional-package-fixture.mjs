/** Synthetic reviewed bytes for automated tests only, never release evidence. */
import { buildOptionalPractice } from '../scripts/build-optional-practice.mjs';
import { createOptionalPackageCandidate } from './optional-package-candidate.mjs';
import { createOptionalPackageReview } from './optional-package-admission.mjs';
import { editionJSON, editionDescriptor } from './edition-candidate.mjs';
import { editionHash } from './edition-zip.mjs';
export async function optionalPackageFixture({
  version = 'v1.2.3',
  sourceRevision = 'a'.repeat(40),
  sourceTree = 'b'.repeat(40),
  basePath = '/revealline/',
} = {}) {
  const built = await buildOptionalPractice(new URL('../', import.meta.url).pathname, {
    engineCommit: sourceRevision,
    engineTree: sourceTree,
    basePath,
  });
  const candidate = createOptionalPackageCandidate({ built, version, sourceRevision, sourceTree });
  const envelope = {
    format: 'revealline-optional-packages.v1',
    version,
    sourceRevision,
    sourceTree,
    packages: [candidate.package],
  };
  const envelopeBytes = editionJSON(envelope),
    review = createOptionalPackageReview(envelopeBytes);
  for (const gate of review.packages[0].gates) {
    const path = `review-optional-${gate.id}.txt`,
      bytes = Buffer.from(`SYNTHETIC TEST ONLY: ${gate.id}`);
    candidate.files.set(path, bytes);
    Object.assign(gate, {
      status: 'passed',
      reviewer: 'Synthetic test fixture',
      reviewedAt: '2026-09-28T10:00:00Z',
      evidence: { ...editionDescriptor(path, bytes), publication: 'public', approved: true },
    });
  }
  const reviewBytes = editionJSON(review);
  candidate.files.set('optional-packages.json', envelopeBytes);
  candidate.files.set('optional-package-review.json', reviewBytes);
  return {
    ...candidate,
    built,
    envelope,
    review,
    envelopeBytes,
    reviewBytes,
    release: {
      version,
      basePath,
      envelopeSha256: editionHash(envelopeBytes),
      reviewSha256: editionHash(reviewBytes),
      packageIds: ['civilian-flight'],
      activePackageIds: ['civilian-flight'],
    },
  };
}
