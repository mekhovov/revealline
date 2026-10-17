/** Exact imported-content acceptance; never opens a browser or writes a player store. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const digest = (value) => hash(JSON.stringify(value));
export const PACK = Object.freeze({
  id: 'cc0-road-lab',
  title: 'Roadworks Practice Park',
  path: 'authoring/fpv-worlds/free-worlds/distribution/r1/cc0-road-lab/cc0-road-lab.r1.rlpack',
  bytes: 63754,
  sha256: '97fe29db831659500a8850ed0e0a0252c37b6a6c893b37536e1967404683c355',
  assetPath: 'models/cc0-road-lab.glb',
  assetBytes: 31796,
  assetSha256: '2750ad9f976270561277c5623bca10c2bee9cd874eec3a87686f1a4fefd3a944',
});
export function verifyC4ImportBytes(bytes) {
  assert(Buffer.isBuffer(bytes) && bytes.length === PACK.bytes, 'Unexpected pack length.');
  assert.equal(hash(bytes), PACK.sha256, 'Unexpected committed pack bytes.');
  return PACK;
}
/** Matches existing import-free continuity reader's structured-clone fingerprints.
 * Derives the expected row from actual inspected pack data, not browser injection.
 */
export function expectedC4AssetFingerprint() {
  return {
    key: digest([
      'Array',
      [
        ['string', PACK.id],
        ['string', PACK.assetPath],
      ],
    ]),
    sha256: digest([
      'Object',
      [
        ['blob', ['Blob', 'model/gltf-binary', PACK.assetBytes, PACK.assetSha256]],
        ['path', ['string', PACK.assetPath]],
        ['projectId', ['string', PACK.id]],
      ],
    ]),
  };
}
export function assertC4ImportedWorld(state, baseline) {
  assert.deepEqual(
    state.card,
    {
      id: PACK.id,
      title: PACK.title,
      digestPrefix: PACK.sha256.slice(0, 12),
    },
    'Require the visible imported pack card, not the template card.',
  );
  assert.equal(state.database?.name, 'revealline-fpv-worlds-v1');
  assert(!state.database.missing);
  assert(Number.isSafeInteger(state.database.version) && state.database.version > 0);
  for (const [name, minimum] of [
    ['projects', 2],
    ['revisions', 2],
    ['assets', 1],
  ]) {
    const store = state.database.stores?.find((item) => item.name === name);
    assert(Number.isSafeInteger(store?.count) && store.count >= minimum);
    assert.equal(store.rows.length, store.count);
    assert.equal(new Set(store.rows.map((row) => row.key)).size, store.count);
    assert(
      store.rows.every(
        (row) => /^[a-f0-9]{64}$/.test(row.key) && /^[a-f0-9]{64}$/.test(row.sha256),
      ),
    );
    assert.equal(store.sha256, digest(store.rows), 'Store fingerprint must match its rows.');
    if (name === 'assets')
      assert(
        store.rows.some(
          (row) => JSON.stringify(row) === JSON.stringify(expectedC4AssetFingerprint()),
        ),
        'Require the real model blob bytes, type, path and owning project.',
      );
  }
  if (baseline) assert.deepEqual(state, baseline, 'Imported world changed across restart.');
  return true;
}
/** These are observation predicates, not a browser controller or exercise proof. */
export function assertC4OfflineFlight(witness) {
  assert.equal(witness.networkProbeFailed, true);
  assert.equal(witness.processRestartConfirmed, true);
  assert.equal(witness.explicitArm, true);
  assert.equal(witness.replay, false);
  assert.equal(witness.before.visible, true);
  assert.equal(witness.after.visible, true);
  assert.equal(witness.before.gauge, 'Height');
  assert.equal(witness.after.gauge, 'Height');
  for (const item of [witness.before, witness.after, ...witness.paused])
    assert(Number.isFinite(item.height) && item.height >= 0 && item.height < 1);
  assert(witness.after.height - witness.before.height >= 0.2 - 1e-9);
  assert.equal(witness.explicitPause, true);
  assert(witness.paused.length >= 4 && witness.paused.length <= 8);
  const first = witness.paused[0];
  for (const item of witness.paused) {
    assert(item.visible && item.phase === 'paused' && item.gauge === 'Height');
    assert.equal(item.height, first.height);
    assert(Number.isFinite(item.at));
  }
  for (let index = 1; index < witness.paused.length; index++)
    assert(witness.paused[index].at >= witness.paused[index - 1].at);
  const elapsed = witness.paused.at(-1).at - first.at;
  assert(elapsed >= 600 && elapsed <= 2000);
  return { observed: true, exerciseCompleted: false, machineWideOutageQualified: false };
}
