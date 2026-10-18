import assert from 'node:assert/strict';
import test from 'node:test';
import {
  browserErrorDescription,
  restorationDiagnosticGate,
  mutationSignatures,
  playerPersistenceMutations,
  restoredFromBFCache,
  unexpectedBootMutations,
} from './demo-restoration-observation.mjs';

const change = (owner, key, extra = {}) => ({
  kind: 'mutation',
  api: 'Storage',
  owner,
  method: 'setItem',
  key,
  ...extra,
});

test('ordinary startup admits exact API, store, method and key, never a neighboring save', () => {
  const boot = change('localStorage', 'revealline.overflight.family-operation.v1');
  const admitted = mutationSignatures([boot]);
  assert.deepEqual(unexpectedBootMutations([boot], admitted), []);
  for (const event of [
    change('localStorage', 'revealline.overflight.save.v1'),
    { ...boot, method: 'removeItem' },
    { ...boot, owner: 'sessionStorage' },
    { ...boot, api: 'IndexedDB' },
  ])
    assert.equal(unexpectedBootMutations([event], admitted).length, 1);
});

test('only observed absent removals are no-ops; same-value writes remain visible', () => {
  const absent = change('sessionStorage', 'appearance', {
    method: 'removeItem',
    absentRemoval: true,
  });
  assert.deepEqual(playerPersistenceMutations([absent]), []);
  assert.equal(playerPersistenceMutations([{ ...absent, absentRemoval: false }]).length, 1);
  assert.equal(playerPersistenceMutations([{ ...absent, method: 'setItem' }]).length, 1);
});

test('managed media exemptions do not include player profiles or similarly named stores', () => {
  const media = change('revealline-soundtrack-v1/mediaBlobs', 'asset', {
    api: 'IndexedDB',
    method: 'put',
  });
  assert.deepEqual(playerPersistenceMutations([media]), []);
  for (const owner of [
    'revealline-soundtrack-v1/profiles',
    'revealline-journey-v1/profiles',
    'revealline-soundtrack-v1/mediaBlobs/archive',
  ])
    assert.equal(playerPersistenceMutations([{ ...media, owner }]).length, 1);
  assert.equal(playerPersistenceMutations([{ ...media, api: 'Storage' }]).length, 1);
});

test('BFCache admission requires original document and an actual persisted pageshow', () => {
  const before = { documentId: 'original' };
  assert.equal(
    restoredFromBFCache(before, {
      documentId: 'original',
      lifecycle: [{ type: 'pageshow', persisted: true }],
    }),
    true,
  );
  assert.equal(
    restoredFromBFCache(before, {
      documentId: 'new',
      lifecycle: [{ type: 'pageshow', persisted: true }],
    }),
    false,
  );
  assert.equal(
    restoredFromBFCache(before, {
      documentId: 'original',
      lifecycle: [{ type: 'pageshow', persisted: false }],
    }),
    false,
  );
  assert.equal(
    restoredFromBFCache(before, {
      documentId: 'original',
      lifecycle: [{ type: 'pagehide', persisted: true }],
    }),
    false,
  );
});

test('a transport error with empty stack still keeps its actual message', () => {
  assert.equal(
    browserErrorDescription({ stack: '', message: 'Native decode failed' }),
    'Native decode failed',
  );
});

test('strict diagnostics reject DOM-only errors and later-handled rejections', () => {
  assert.equal(restorationDiagnosticGate([], []), true);
  assert.equal(restorationDiagnosticGate([{ message: 'Failure' }], []), false);
  assert.equal(restorationDiagnosticGate([], [{ kind: 'window-error' }]), false);
  assert.equal(
    restorationDiagnosticGate([], [{ kind: 'unhandledrejection' }, { kind: 'rejectionhandled' }]),
    false,
  );
});
