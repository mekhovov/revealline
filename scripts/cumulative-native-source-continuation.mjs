/** Scoped, immutable source review. This is not release or human acceptance. */
import { createHash } from 'node:crypto';

export const CUMULATIVE_NATIVE_REVIEW_PATH =
  'docs/verification/cumulative-native-source-continuation-2026-09-29/review.json';
export const CUMULATIVE_NATIVE_REVIEW_SHA256 =
  'b34e17ba177381b90128c3716f3d4609d1c7c8ecc4ce7f24ed53495479690ebf';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function cumulativeNativeContinuation(bytes) {
  if (!bytes || hash(bytes) !== CUMULATIVE_NATIVE_REVIEW_SHA256) return null;
  return JSON.parse(bytes);
}

/** Check source, original receipts and immutable ancestors before assembly. */
export async function readCumulativeNativeContinuation(read) {
  const bytes = await read(CUMULATIVE_NATIVE_REVIEW_PATH);
  const review = cumulativeNativeContinuation(bytes);
  if (!review) throw new Error('Cumulative source review changed; approval must reopen.');
  for (const pin of [...review.priorReviews, ...review.originalReceipts]) {
    const actual = await read(pin.path);
    if (actual.length !== pin.bytes || hash(actual) !== pin.sha256)
      throw new Error('Cumulative review evidence changed: ' + pin.path);
  }
  const cache = new Map();
  for (const [group, entry] of Object.entries(review.fingerprints)) {
    const parts = [];
    for (const pin of entry.inputs) {
      if (!cache.has(pin.path)) cache.set(pin.path, await read(pin.path));
      const actual = cache.get(pin.path);
      if (actual.length !== pin.bytes || hash(actual) !== pin.sha256)
        throw new Error('Cumulative source input changed: ' + pin.path);
      parts.push(actual);
    }
    if (hash(Buffer.concat(parts)) !== entry.currentSHA256)
      throw new Error('Cumulative source order changed: ' + group);
  }
  return bytes;
}

/** Team recipes and equipment still require their independent payload gates. */
export function cumulativeSourceReviewed(group, source, bytes, slotId) {
  const review = cumulativeNativeContinuation(bytes);
  if (!review || !Object.hasOwn(review.fingerprints, group)) return false;
  const entry = review.fingerprints[group];
  if (entry.slots && !entry.slots.includes(slotId)) return false;
  return (
    source ===
    (group === 'equipment'
      ? entry.currentSHA256
      : `${entry.paths.join('; ')} sha256:${entry.currentSHA256}`)
  );
}

export function cumulativeNativeEvidence(group) {
  return `Scoped ${group} functional source continuation: ${CUMULATIVE_NATIVE_REVIEW_PATH} sha256:${CUMULATIVE_NATIVE_REVIEW_SHA256}; generated, packaged, public, physical and human acceptance remain separate.`;
}
