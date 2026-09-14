import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJSON } from '../data-json.mjs';
import { normalizedLevel } from '../core/level.mjs';
import { CLASSES } from '../core/registry.mjs';
import {
  STILL_STORAGE_FORMAT,
  validateStoredStillMedia,
  validateGenericMediaLibrary,
  createStoredStillIdentityCatalog,
} from '../media-storage-record.mjs';
import {
  STILL_RESIDENCY_FORMAT,
  validateStillResidency,
  upgradeStillResidency,
  stillResidencyIdentityDocument,
  residentStillHashes,
  assertRetainedStillResidency,
  detachStillOriginals,
  reattachStillOriginals,
} from '../still-residency.mjs';
import { mediaFixture, libraryRecord, assetRecord } from './helpers/media-fixtures.mjs';

const A = 'a'.repeat(64),
  B = 'b'.repeat(64),
  C = 'c'.repeat(64);
function fixture() {
  const f = mediaFixture(true),
    entry = f.catalog.entries.find((item) => item.difficulty === 'standard'),
    campaign = {
      ...structuredClone(entry.baseCampaign),
      levels: entry.baseCampaign.levels.map(normalizedLevel),
      classRecipes: structuredClone(entry.baseCampaign.classRecipes ?? CLASSES),
    },
    document = validateStoredStillMedia({
      format: STILL_STORAGE_FORMAT,
      owners: [{ campaign, themeIds: ['fpv'] }],
      library: libraryRecord(f.identity),
      legacy: { format: 'revealline-managed-bytes.v1', items: [] },
    });
  return { ...f, document, resident: upgradeStillResidency(document) };
}

test('explicit migration preserves exact immutable owner, picture revision and difficulty identity', () => {
  const f = fixture();
  assert.equal(f.resident.format, STILL_RESIDENCY_FORMAT);
  assert.deepEqual(f.resident.originals, [A]);
  assert.deepEqual(stillResidencyIdentityDocument(f.resident), f.document);
  assert.deepEqual(upgradeStillResidency(f.resident), f.resident);
  const catalog = createStoredStillIdentityCatalog(stillResidencyIdentityDocument(f.resident));
  for (const difficulty of ['standard', 'gentle'])
    assert.deepEqual(catalog.resolve(f.request(difficulty)), f.identity);
  assert.throws(() => validateStoredStillMedia(f.resident));
  assert.throws(() => validateGenericMediaLibrary(f.resident));
  assert.throws(
    () => upgradeStillResidency({ ...f.resident, format: 'revealline-still-storage.v3' }),
    /Unsupported still residency source format/,
  );
});

test('explicit detach and restore change residency only; an ordinary edit cannot offload', () => {
  const { document, resident } = fixture(),
    before = canonicalJSON(resident),
    detached = detachStillOriginals(resident, [A]);
  assert.deepEqual(detached.originals, []);
  assert.equal(residentStillHashes(detached).size, 0);
  assert.deepEqual(stillResidencyIdentityDocument(detached), document);
  assert.equal(canonicalJSON(resident), before);
  assert.throws(() => assertRetainedStillResidency(resident, detached), /cannot detach/);
  const restored = reattachStillOriginals(detached, [A]);
  assert.deepEqual(restored, resident);
  assert.deepEqual(assertRetainedStillResidency(detached, restored), resident);
  assert.throws(() => detachStillOriginals(detached, [A]), /already detached/);
  assert.throws(() => reattachStillOriginals(resident, [A]), /already resident/);
  assert.throws(() => reattachStillOriginals(detached, [B]), /Only known rich/);
});

test('legacy hashes migrate as required resident and cannot be released by a chapter proposal', () => {
  const generic = { format: 'revealline-managed-bytes.v1', items: [{ id: 'legacy', sha256: B }] },
    upgraded = upgradeStillResidency(generic);
  assert.deepEqual(upgraded.originals, [B]);
  assert.deepEqual(upgraded.legacy, generic);
  assert.throws(() => validateStillResidency({ ...upgraded, originals: [] }), /legacy original/);
  assert.throws(() => detachStillOriginals(upgraded, [B]), /Only known rich/);
  const { document } = fixture(),
    shared = upgradeStillResidency({
      ...document,
      legacy: { ...generic, items: [{ id: 'same-hash', sha256: A }] },
    });
  assert.deepEqual(shared.originals, [A]);
  assert.throws(() => detachStillOriginals(shared, [A]), /legacy references/);
});

test('foreign owner, changed original identity and missing history never become valid residency changes', () => {
  const { resident } = fixture();
  const foreign = structuredClone(resident);
  foreign.library.presentations[0].identity.baseCampaignKey += '-foreign';
  assert.throws(() => validateStillResidency(foreign), /execution catalog/);
  const changed = structuredClone(resident);
  changed.library.assets[0].provenance.credit = 'Changed original authority';
  assert.throws(() => assertRetainedStillResidency(resident, changed), /immutable asset/);
  const removed = structuredClone(resident);
  removed.library.assets = [];
  removed.library.presentations = [];
  removed.library.assignments = [];
  removed.originals = [];
  assert.throws(() => assertRetainedStillResidency(resident, removed), /immutable asset/);
  const owner = structuredClone(resident);
  owner.owners = [];
  assert.throws(() => validateStillResidency(owner), /execution catalog/);
});

test('ordinary append retains earlier detached history without inventing resident bytes', () => {
  const { resident } = fixture(),
    detached = detachStillOriginals(resident, [A]),
    next = structuredClone(detached);
  next.library.assets.push({ ...assetRecord('second-picture'), sha256: B });
  next.originals = [B];
  const checked = assertRetainedStillResidency(detached, next);
  assert.deepEqual(checked.originals, [B]);
  assert.deepEqual(checked.library.assets[0], resident.library.assets[0]);
  assert.deepEqual(checked.library.presentations, resident.library.presentations);
  assert.deepEqual(residentStillHashes(checked), new Set([B]));
});

test('residency and change lists reject unknown, duplicate, accessor and unbounded inputs', () => {
  const { resident } = fixture();
  for (const originals of [[B], [A, A], [null], [17], [{ hash: A }]])
    assert.throws(() => validateStillResidency({ ...resident, originals }));
  assert.throws(() => validateStillResidency({ ...resident, unexpected: true }), /still residency/);
  for (const selected of [[], [A, A], [B], [null], [A, B, C, 'd'.repeat(64)], A, `["${A}"]`])
    assert.throws(() => detachStillOriginals(resident, selected));
  let calls = 0;
  const accessor = { ...resident };
  Object.defineProperty(accessor, 'originals', {
    enumerable: true,
    get() {
      calls++;
      return [A];
    },
  });
  assert.throws(() => validateStillResidency(accessor), /accessors/);
  const selected = [];
  Object.defineProperty(selected, '0', {
    enumerable: true,
    get() {
      calls++;
      return A;
    },
  });
  assert.throws(() => detachStillOriginals(resident, selected), /accessors/);
  assert.equal(calls, 0);
});

test('validated output is detached, frozen and canonically orders only the resident set', () => {
  const { resident } = fixture(),
    source = structuredClone(resident);
  source.library.assets.push({ ...assetRecord('second-picture'), sha256: B });
  source.originals = [B, A];
  const accepted = validateStillResidency(source),
    before = canonicalJSON(accepted);
  assert.deepEqual(accepted.originals, [A, B]);
  source.originals.length = 0;
  source.library.assets[0].provenance.credit = 'Late edit';
  assert.equal(canonicalJSON(accepted), before);
  assert.throws(() => accepted.originals.pop(), TypeError);
  assert.throws(() => {
    accepted.owners[0].campaign.id = 'other';
  }, TypeError);
  const hashes = residentStillHashes(accepted);
  hashes.clear();
  assert.deepEqual(accepted.originals, [A, B]);
});
