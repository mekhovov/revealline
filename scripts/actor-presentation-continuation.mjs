/** Validation plumbing only: no successor pin, quality stage or production wiring.
 * A future integration must supply its independently reviewed, code-owned pin;
 * never derive that authority from an uploaded bundle or the record itself.
 * This is an admission manifest, not a self-contained human review certificate.
 * Final integration, evidence and review of the code-owned pin remain separate.
 * Payload matching supplements, never replaces, the original Team recipe/default/
 * inherited-image and equipment PNG guards. Audio approval remains separate. */
import { createHash } from 'node:crypto';
import {
  BULK_PRESENTATION_REVIEW_PATH,
  BULK_PRESENTATION_REVIEW_SHA256,
} from './bulk-presentation-continuation.mjs';

export const ACTOR_CONTINUATION_FORMAT = 'revealline-actor-presentation-continuation.v1';
// Existing production100 effects20 authority, not a new actor approval. This
// exact root advances only effects; the other renderer groups retain its bulk
// presentation ancestor. Audio references are authenticated, never admitted.
export const ACTOR_EFFECTS20_REVIEW_PATH =
  'docs/verification/bulk-queue-audio-effects-2026-09-28/review.json';
export const ACTOR_EFFECTS20_REVIEW_SHA256 =
  '5ec246c93cf5dfe6d5a3f6538788d618575037a11d2c1890d88d0257f2e7d0b3';
const GROUPS = ['motion', 'effects', 'team', 'equipment'];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const digest = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const check = (valid, message) => {
  if (!valid) throw new TypeError(`Actor continuation: ${message}`);
};
const plain = (value) =>
  value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
const pathValid = (value) =>
  typeof value === 'string' &&
  value.length <= 240 &&
  value.split('/').every((part) => /^[\w.-]+$/.test(part) && part !== '.' && part !== '..');
function keys(value, expected) {
  check(plain(value), 'expected a plain record');
  const own = Reflect.ownKeys(value);
  check(
    own.every(
      (name) =>
        typeof name === 'string' &&
        Object.getOwnPropertyDescriptor(value, name).enumerable &&
        Object.hasOwn(Object.getOwnPropertyDescriptor(value, name), 'value'),
    ),
    'unexpected record property',
  );
  own.sort();
  check(JSON.stringify(own) === JSON.stringify([...expected].sort()), 'unexpected record fields');
}
function canonical(value, seen = new Set()) {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return JSON.stringify(value);
  if (typeof value === 'number') {
    check(Number.isFinite(value), 'payload number must be finite');
    return JSON.stringify(value);
  }
  check((Array.isArray(value) || plain(value)) && !seen.has(value), 'payload must be acyclic JSON');
  seen.add(value);
  const names = Reflect.ownKeys(value);
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    check(
      typeof name === 'string' && Object.hasOwn(descriptor, 'value'),
      'payload accessor or symbol',
    );
    check(
      descriptor.enumerable || (Array.isArray(value) && name === 'length'),
      'hidden payload field',
    );
  }
  let result;
  if (Array.isArray(value)) {
    check(
      names.length === value.length + 1 &&
        Array.from({ length: value.length }, (_, i) => String(i)).every((name) =>
          Object.hasOwn(value, name),
        ),
      'sparse payload',
    );
    result = `[${value.map((entry) => canonical(entry, seen)).join(',')}]`;
  } else
    result = `{${names
      .sort()
      .map((name) => `${JSON.stringify(name)}:${canonical(value[name], seen)}`)
      .join(',')}}`;
  seen.delete(value);
  return result;
}

/** Read exact bytes and immutable ancestry, then verify the reviewed source closure.
 * Each record covers a nonempty subset of the four existing renderer groups.
 * reviewedRecord is caller-owned code authority, not user/content input.
 * A missing pin, draft, read failure or mismatch throws before a matcher exists. */
export async function readActorPresentationContinuation({ read, reviewedRecord } = {}) {
  check(typeof read === 'function', 'a byte reader is required');
  keys(reviewedRecord, ['path', 'sha256']);
  const pin = Object.freeze({ ...reviewedRecord });
  check(
    pathValid(pin.path) && pin.path.startsWith('docs/verification/') && digest(pin.sha256),
    'an explicit reviewed record pin is required',
  );
  const snapshot = new Map();
  const readBytes = async (path) => {
    if (snapshot.has(path)) return snapshot.get(path);
    const bytes = await read(path);
    check(Buffer.isBuffer(bytes) || bytes instanceof Uint8Array, `missing byte input: ${path}`);
    const owned = Buffer.from(bytes);
    snapshot.set(path, owned);
    return owned;
  };
  const bytes = await readBytes(pin.path);
  check(hash(bytes) === pin.sha256, 'reviewed record bytes changed');
  const review = JSON.parse(bytes);
  keys(review, ['format', 'status', 'priorReview', 'fingerprints']);
  check(
    review.format === ACTOR_CONTINUATION_FORMAT && review.status === 'reviewed',
    'record is not reviewed',
  );
  keys(review.priorReview, ['path', 'sha256']);
  const currentEffects =
    review.priorReview.path === ACTOR_EFFECTS20_REVIEW_PATH &&
    review.priorReview.sha256 === ACTOR_EFFECTS20_REVIEW_SHA256;
  check(
    currentEffects ||
      (review.priorReview.path === BULK_PRESENTATION_REVIEW_PATH &&
        review.priorReview.sha256 === BULK_PRESENTATION_REVIEW_SHA256),
    'wrong immutable predecessor',
  );

  // The current pinned graph contains exactly17 unique records. Preserve the
  // historical16 ceiling for the old root; no caller can select another graph.
  const ancestorLimit = currentEffects ? 17 : 16;
  const ancestors = new Map();
  async function ancestor(ref) {
    check(plain(ref) && pathValid(ref.path) && digest(ref.sha256), 'invalid ancestor reference');
    const known = ancestors.get(ref.path);
    if (known) {
      check(known.sha256 === ref.sha256 && known.record, 'conflicting or cyclic ancestor');
      return known.record;
    }
    check(ancestors.size < ancestorLimit, 'ancestor limit exceeded');
    const entry = { sha256: ref.sha256, record: null };
    ancestors.set(ref.path, entry);
    const body = await readBytes(ref.path);
    check(hash(body) === ref.sha256, `ancestor bytes changed: ${ref.path}`);
    const record = JSON.parse(body);
    for (const child of [
      ...(record.priorReview ? [record.priorReview] : []),
      ...(record.priorEquipmentReview ? [record.priorEquipmentReview] : []),
      ...Object.values(record.priorReviews ?? {}),
    ])
      await ancestor(child);
    entry.record = record;
    return record;
  }
  const prior = await ancestor(review.priorReview),
    bulk = currentEffects ? ancestors.get(BULK_PRESENTATION_REVIEW_PATH).record : prior,
    sources = new Map(),
    payloads = new Map();
  check(plain(review.fingerprints), 'expected renderer groups');
  const groups = Object.keys(review.fingerprints);
  check(
    groups.length > 0 && groups.every((group) => GROUPS.includes(group)),
    'invalid renderer groups',
  );
  keys(review.fingerprints, groups);
  for (const group of groups) {
    const value = review.fingerprints[group],
      before = (currentEffects && group === 'effects' ? prior : bulk).fingerprints[group];
    keys(value, ['group', 'priorSHA256', 'currentSHA256', 'paths', 'inputs', 'slots', 'payloads']);
    check(
      value.group === group && value.priorSHA256 === before.currentSHA256,
      'wrong group or predecessor fingerprint',
    );
    check(JSON.stringify(value.slots) === JSON.stringify(before.slots), 'slot membership changed');
    keys(value.payloads, before.slots);
    check(Object.values(value.payloads).every(digest), 'invalid payload digest');
    check(
      Array.isArray(value.inputs) && value.inputs.length > 0 && value.inputs.length <= 128,
      'invalid source closure',
    );
    const paths = value.inputs.map((input) => {
      keys(input, ['path', 'bytes', 'sha256']);
      check(
        pathValid(input.path) &&
          Number.isSafeInteger(input.bytes) &&
          input.bytes >= 0 &&
          digest(input.sha256),
        'invalid source input',
      );
      return input.path;
    });
    check(
      new Set(paths).size === paths.length && value.paths === paths.join('; '),
      'source order or membership changed',
    );
    check(digest(value.currentSHA256), 'invalid source fingerprint');
    const aggregate = createHash('sha256');
    for (const input of value.inputs) {
      const body = await readBytes(input.path);
      check(
        body.length === input.bytes && hash(body) === input.sha256,
        `source bytes changed: ${input.path}`,
      );
      aggregate.update(body);
    }
    check(aggregate.digest('hex') === value.currentSHA256, 'source fingerprint changed');
    sources.set(
      group,
      group === 'equipment' ? value.currentSHA256 : `${value.paths} sha256:${value.currentSHA256}`,
    );
    payloads.set(group, new Map(Object.entries(value.payloads)));
  }
  return Object.freeze({
    record: pin,
    matches(input) {
      try {
        if (!plain(input)) return false;
        const { group, slotId, source, payload } = input;
        if (
          !sources.has(group) ||
          sources.get(group) !== source ||
          !payloads.get(group).has(slotId)
        )
          return false;
        return hash(canonical(payload)) === payloads.get(group).get(slotId);
      } catch {
        return false;
      }
    },
  });
}
