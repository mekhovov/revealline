import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { matchesRetainedReviewEvidence } from './retained-review-evidence.mjs';

const root = new URL('../', import.meta.url);
const receipts = JSON.parse(
  await readFile(new URL('docs/migrations/retained-review-evidence.json', root)),
).items;
for (const receipt of receipts) {
  const bytes = await readFile(new URL(receipt.path, root));

  test('retained assessment has its own exact byte identity and explicit historical mapping', () => {
    const digest = createHash('sha256').update(bytes).digest('hex');
    assert.equal(bytes.length, receipt.bytes);
    assert.equal(digest, receipt.sha256);
    assert.notEqual(digest, receipt.previousSHA256);
    assert.ok(matchesRetainedReviewEvidence(receipt.path, bytes, receipt.previousSHA256));
    assert.ok(matchesRetainedReviewEvidence(receipt.path, bytes, digest));
  });

  test('the historical mapping rejects a different path, expected identity or edited payload', () => {
    assert.equal(
      matchesRetainedReviewEvidence('docs/verification/other.json', bytes, receipt.previousSHA256),
      false,
    );
    assert.equal(matchesRetainedReviewEvidence(receipt.path, bytes, '0'.repeat(64)), false);
    const changed = Buffer.from(bytes);
    changed[changed.length - 1] ^= 1;
    assert.equal(
      matchesRetainedReviewEvidence(receipt.path, changed, receipt.previousSHA256),
      false,
    );
    assert.equal(
      matchesRetainedReviewEvidence(
        receipt.path,
        Buffer.concat([bytes, Buffer.from(' ')]),
        receipt.previousSHA256,
      ),
      false,
    );
  });

  test('ordinary exact evidence remains exact without a migration mapping', () => {
    const plain = Buffer.from('{"status":"pending"}');
    const digest = createHash('sha256').update(plain).digest('hex');
    assert.ok(matchesRetainedReviewEvidence('docs/verification/example.json', plain, digest));
    assert.equal(
      matchesRetainedReviewEvidence(
        'docs/verification/example.json',
        plain,
        receipt.previousSHA256,
      ),
      false,
    );
  });
}
