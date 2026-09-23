import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJSON } from '../data-json.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import {
  freezePresentation,
  validateThemeBundle,
  resolvePresentation,
  presentationCoverage,
} from '../presentation/model.mjs';
import { reviseStudioTheme, studioSlotHistory } from '../presentation/studio-session.mjs';

const copy = (value) => structuredClone(value);
function deeplyFrozen(value) {
  return (
    !value ||
    typeof value !== 'object' ||
    (Object.isFrozen(value) && Object.values(value).every(deeplyFrozen))
  );
}

test('accepted immutable identity is reused while mutable caller inputs stay independently owned', () => {
  const source = copy(createDefaultThemeBundle());
  const accepted = validateThemeBundle(source);
  assert.notEqual(accepted, source);
  assert.ok(deeplyFrozen(accepted));
  const original = canonicalJSON(accepted);
  assert.equal(validateThemeBundle(accepted), accepted);
  assert.equal(validateThemeBundle(accepted, {}), accepted);
  source.assets[0].description = 'Caller mutation after admission';
  assert.equal(canonicalJSON(accepted), original);
  const changed = validateThemeBundle(source);
  assert.notEqual(changed, accepted);
  assert.equal(changed.assets[0].description, source.assets[0].description);
  source.assets[0].unknown = true;
  assert.throws(() => validateThemeBundle(source), /not supported/);
  assert.throws(() => {
    accepted.assets[0].description = 'Impossible mutation';
  }, TypeError);
  assert.equal(validateThemeBundle(accepted), accepted);
});

test('external deep freezing and the exported freeze helper never confer model trust', () => {
  const external = freezePresentation(copy(createDefaultThemeBundle()));
  assert.ok(deeplyFrozen(external));
  const accepted = validateThemeBundle(external);
  assert.notEqual(accepted, external);
  assert.equal(validateThemeBundle(accepted), accepted);
  const invalid = copy(external);
  invalid.assets[0].unknown = true;
  freezePresentation(invalid);
  assert.throws(() => validateThemeBundle(invalid), /not supported/);
});

test('proxy wrappers are copied and checked, not confused with an accepted target identity', () => {
  const target = copy(createDefaultThemeBundle());
  let inspected = 0;
  const proxy = new Proxy(target, {
    ownKeys(value) {
      inspected++;
      return Reflect.ownKeys(value);
    },
  });
  const accepted = validateThemeBundle(proxy);
  assert.notEqual(accepted, proxy);
  assert.ok(inspected > 0);
  target.assets[0].unknown = true;
  assert.throws(() => validateThemeBundle(proxy), /not supported/);
  const wrapper = new Proxy(accepted, {});
  const wrappedResult = validateThemeBundle(wrapper);
  assert.notEqual(wrappedResult, wrapper);
  assert.notEqual(wrappedResult, accepted);
  assert.equal(validateThemeBundle(wrappedResult), wrappedResult);
});

test('expected revision and option evaluation remain authoritative for accepted identities', () => {
  const accepted = createDefaultThemeBundle();
  assert.throws(
    () => validateThemeBundle(accepted, { expectedRevision: accepted.revision + 1 }),
    /Stale expected revision/,
  );
  const constrained = validateThemeBundle(accepted, { expectedRevision: accepted.revision });
  assert.notEqual(constrained, accepted);
  assert.equal(canonicalJSON(constrained), canonicalJSON(accepted));
  assert.throws(() => validateThemeBundle(accepted, null), TypeError);
  const failure = new Error('caller options failure');
  assert.throws(
    () =>
      validateThemeBundle(accepted, {
        get previous() {
          throw failure;
        },
      }),
    (error) => error === failure,
  );
  const reads = [];
  const checked = validateThemeBundle(accepted, {
    get previous() {
      reads.push('previous');
      return null;
    },
    get expectedRevision() {
      reads.push('expectedRevision');
      return accepted.revision;
    },
  });
  assert.deepEqual(reads, ['previous', 'expectedRevision']);
  assert.notEqual(checked, accepted);
});

test('an independently valid branded document cannot bypass stale or rewritten transition history', () => {
  const previous = createDefaultThemeBundle();
  const valid = reviseStudioTheme(previous, { tokens: { cyan: '#79dce8' } });
  assert.equal(validateThemeBundle(valid), valid);
  assert.throws(
    () => validateThemeBundle(valid, { previous, expectedRevision: previous.revision + 1 }),
    /Stale expected revision/,
  );
  const constrained = validateThemeBundle(valid, { previous, expectedRevision: previous.revision });
  assert.equal(canonicalJSON(constrained), canonicalJSON(valid));
  assert.notEqual(constrained, valid);
  const rewritten = copy(valid);
  rewritten.assets[0].description = 'Semantically valid but rewritten immutable history';
  const independentlyAccepted = validateThemeBundle(rewritten);
  assert.equal(validateThemeBundle(independentlyAccepted), independentlyAccepted);
  assert.throws(
    () => validateThemeBundle(independentlyAccepted, { previous }),
    /Immutable assets history changed/,
  );
  assert.throws(() => validateThemeBundle(previous, { previous }), /advance the same bundle/);
  const corruptPrevious = copy(previous);
  corruptPrevious.assets[0].unknown = true;
  assert.throws(() => validateThemeBundle(valid, { previous: corruptPrevious }), /not supported/);
});

test('cached documents do not bypass selection option ownership or change coverage and slot history', () => {
  const accepted = createDefaultThemeBundle();
  const cold = copy(accepted);
  const selected = accepted.slots[0].id;
  assert.deepEqual(resolvePresentation(accepted), resolvePresentation(cold));
  assert.deepEqual(presentationCoverage(accepted), presentationCoverage(cold));
  assert.deepEqual(studioSlotHistory(accepted, selected), studioSlotHistory(cold, selected));
  let getterCalls = 0;
  assert.throws(
    () =>
      resolvePresentation(accepted, {
        get themeId() {
          getterCalls++;
          return accepted.selection.theme.id;
        },
      }),
    /accessors/,
  );
  assert.equal(getterCalls, 0);
  assert.throws(() => resolvePresentation(accepted, { themeId: 'does-not-exist' }), /theme/i);
});

test('failed validation never brands the caller and later mutations always cross the boundary', () => {
  const source = copy(createDefaultThemeBundle());
  source.assets[0].unknown = true;
  assert.throws(() => validateThemeBundle(source), /not supported/);
  delete source.assets[0].unknown;
  const accepted = validateThemeBundle(source);
  assert.notEqual(accepted, source);
  source.assets[0].provenance.source = 'x'.repeat(8193);
  assert.throws(() => validateThemeBundle(source), /string exceeds/);
  assert.equal(validateThemeBundle(accepted), accepted);
});
