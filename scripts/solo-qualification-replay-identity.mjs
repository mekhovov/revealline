import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

// Hash only the already acquired public export at paused boundaries. Retain two
// scalar receipts, never another recording string or any live game state.
export function createQualificationReplayIdentity() {
  const report = {
    format: 'SoloPublicReplayIdentityPairV1',
    mode: 'exact-public-bytes-pair',
    status: 'pending',
    observations: [],
    scope:
      'Exact public replay bytes before and after same-context page reload; no OS/browser-restart or disk-flush guarantee.',
  };
  let failed = false;
  const fail = (message) => {
    failed = true;
    report.status = 'failed';
    report.failure = message;
    throw new Error(message);
  };
  return {
    report,
    observe(text) {
      if (failed) fail('Public replay identity already failed');
      if (report.observations.length >= 2) fail('Public replay identity export cap exceeded');
      if (typeof text !== 'string') fail('Public replay identity requires exported text');
      const bytes = Buffer.byteLength(text);
      if (bytes === 0 || bytes > 32 * 1024 ** 2) fail('Public replay identity byte bound exceeded');
      const identity = { bytes, sha256: createHash('sha256').update(text).digest('hex') };
      report.observations.push(identity);
      if (report.observations.length === 2) {
        const first = report.observations[0];
        if (first.bytes !== bytes || first.sha256 !== identity.sha256)
          fail('Public replay changed after saved-flight reload');
        report.status = 'pass';
      }
      return identity;
    },
    finish() {
      if (failed || report.observations.length !== 2 || report.status !== 'pass')
        fail('Two equal public replay exports are required');
      assert.equal(report.observations.length, 2);
      return report;
    },
  };
}
