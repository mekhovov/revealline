import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import { prepareClassicEnvironments } from '../snake/classic-environment.mjs';
import {
  acceptAttemptAppearance,
  restoreAttemptAppearance,
  snapshotAttemptAppearance,
  requireAcceptedAttemptAppearance,
} from '../presentation/attempt-appearance.mjs';
import { resolveIndustrialEnvironment } from '../presentation/industrial-environments.mjs';
import { prepareClassicSnakeLevel } from '../snake/classic-setup.mjs';
import { createClassicSnake, exportClassicSnakeReplay } from '../snake/classic-core.mjs';

const military = {
  artRevision: 'industrial-roster-v3',
  collection: { id: 'military-field', revision: 'r1' },
};
const lookup = await prepareClassicEnvironments(CLASSIC_SNAKE_LEVELS, { official: true });
const eligible = CLASSIC_SNAKE_LEVELS.filter((entry) => lookup(entry, 'solo'));

test('all twelve official Living Routes boards acquire chapter materials in every local seat mode', () => {
  assert.equal(eligible.length, 12);
  const definitions = new Set();
  for (const entry of eligible)
    for (const mode of ['solo', 'versus', 'team']) {
      const accepted = acceptAttemptAppearance(lookup(entry, mode), military);
      assert.ok(accepted.environmentPin);
      definitions.add(resolveIndustrialEnvironment(accepted.environmentPin).id);
      const portable = snapshotAttemptAppearance(accepted);
      assert.throws(() => requireAcceptedAttemptAppearance(portable), /./);
      assert.deepEqual(
        snapshotAttemptAppearance(restoreAttemptAppearance(portable, lookup(entry, mode))),
        portable,
      );
    }
  assert.equal(definitions.size, 2);
});

test('installed editions cannot acquire official environment ownership through copied IDs or level bytes', async () => {
  const community = await prepareClassicEnvironments(eligible, { official: false });
  for (const entry of eligible) assert.equal(community(entry, 'solo'), null);
  const changed = structuredClone(eligible[0]);
  changed.level.width += 1;
  const candidate = await prepareClassicEnvironments([changed], { official: true });
  assert.equal(candidate(changed, 'solo'), null);
});

test('saved materials authenticate the exact original board and mode; absent historical artwork stays absent', () => {
  const entry = eligible[0];
  const original = acceptAttemptAppearance(lookup(entry, 'solo'), military);
  const saved = snapshotAttemptAppearance(original);
  assert.throws(() => restoreAttemptAppearance(saved, lookup(eligible[1], 'solo')), /./);
  assert.throws(() => restoreAttemptAppearance(saved, lookup(entry, 'team')), /./);
  assert.equal(restoreAttemptAppearance(null, lookup(entry, 'solo')), null);
  assert.equal(
    acceptAttemptAppearance(lookup(entry, 'solo'), { ...military, artRevision: null })
      .environmentPin,
    null,
  );
  assert.equal(
    acceptAttemptAppearance(lookup(entry, 'solo'), { ...military, collection: null })
      .environmentPin,
    null,
  );
  const forged = structuredClone(saved);
  forged.environmentPin.appearanceSha256 = '0'.repeat(64);
  assert.throws(() => restoreAttemptAppearance(forged, lookup(entry, 'solo')), /./);
});

test('accepting, saving and restoring chapter appearances does not alter the native Snake replay', () => {
  for (const entry of eligible) {
    const level = prepareClassicSnakeLevel(entry, { pace: 'normal', targetRules: 'varied' });
    const run = createClassicSnake(level, { seed: 17 });
    const before = exportClassicSnakeReplay(run);
    const original = acceptAttemptAppearance(lookup(entry, 'solo'), military);
    restoreAttemptAppearance(snapshotAttemptAppearance(original), lookup(entry, 'solo'));
    assert.deepEqual(exportClassicSnakeReplay(run), before);
  }
});

test('an authenticated lookup cannot be reused for a copied or later edited catalogue entry', async () => {
  const entry = eligible[0];
  assert.equal(lookup({ ...entry }, 'solo'), null);
  const mutable = structuredClone(entry),
    local = await prepareClassicEnvironments([mutable], { official: true });
  assert.ok(local(mutable, 'solo'));
  mutable.level.width += 1;
  assert.equal(local(mutable, 'solo'), null);
});
