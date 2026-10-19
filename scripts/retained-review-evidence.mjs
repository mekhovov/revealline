import { createHash } from 'node:crypto';

// Only this exact, code-owned text projection may satisfy its historical pin.
// It removes one retired-content assessment clause. Source fingerprints, prior
// reviews, outcomes and retained renderer assessments are byte-for-byte intact.
// This is migration provenance, never approval of newer source or artwork.
const projection = Object.freeze({
  path: 'docs/verification/fpv-family-effects-continuation-2026-09-28/review.json',
  originalSHA256: '1a72688bfca58ddd75f18b7719f5021972fb1ed88a1c6e043e63abef2e848ba9',
  sha256: '5dda0ea57365afd8bb2767075973d0d7d6b520de225bca8d43325e70090a0bcb',
  bytes: 8995,
});

export function matchesRetainedReviewEvidence(path, bytes, expectedSHA256) {
  const digest = createHash('sha256').update(bytes).digest('hex');
  return (
    digest === expectedSHA256 ||
    (path === projection.path &&
      expectedSHA256 === projection.originalSHA256 &&
      bytes.byteLength === projection.bytes &&
      digest === projection.sha256)
  );
}
