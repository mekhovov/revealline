import { createHash } from 'node:crypto';

// Only this exact, code-owned text projection may satisfy its historical pin.
// It removes one retired-content assessment clause. Source fingerprints, prior
// reviews, outcomes and retained renderer assessments are byte-for-byte intact.
// This is migration provenance, never approval of newer source or artwork.
const projections = Object.freeze([
  {
    path: 'docs/verification/fpv-family-effects-continuation-2026-09-28/review.json',
    originalSHA256: '1a72688bfca58ddd75f18b7719f5021972fb1ed88a1c6e043e63abef2e848ba9',
    sha256: '5dda0ea57365afd8bb2767075973d0d7d6b520de225bca8d43325e70090a0bcb',
    bytes: 8995,
  },
  {
    path: 'docs/verification/fpv-family-effects-continuation-2026-09-28/main-rebase-review.json',
    originalSHA256: '5f234d657c95047ae677757259999196571d0b2c3e10d084c59c1457d804eea7',
    sha256: '9a89fc929937b26e040e1740787989ca3bbeb9ad75dd372db3a952a6ebfea630',
    bytes: 9438,
  },
]);

export function matchesRetainedReviewEvidence(path, bytes, expectedSHA256) {
  const digest = createHash('sha256').update(bytes).digest('hex');
  return (
    digest === expectedSHA256 ||
    projections.some(
      (projection) =>
        path === projection.path &&
        expectedSHA256 === projection.originalSHA256 &&
        bytes.byteLength === projection.bytes &&
        digest === projection.sha256,
    )
  );
}
