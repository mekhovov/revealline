import test from 'node:test';
import assert from 'node:assert/strict';
import { readPlayableTeamCampaign } from '../couch/creator-team-import.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { journeyTeamPackEdition } from '../coop/foundations.mjs';
import { validateCoopPack } from '../coop/recipes.mjs';
import { createCoop, startCoop, stepCoop, validateCoopLevel, FIXED_DT } from '../coop/core.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';

const valid = { valid: true, errors: [] };
const command = (direction = null) => ({ direction, boost: false, support: false });

function importedPack({ version = 6, difficulty = 'standard', hunters = true } = {}) {
  const level = structuredClone(COOP_STARTER_PACK.levels[0]);
  delete level.strongholds;
  delete level.encounter;
  Object.assign(level, {
    version: `revealline-coop-level.v${version}`,
    journeyDifficulty: difficulty,
    terrain: [],
  });
  if (version >= 6) level.lineImpact = { version: 'team-line-impact.v2', speed: 24 };
  if (version === 7) level.supportRoles = ['disruptor', 'interceptor'];
  if (!hunters) level.enemies = level.enemies.filter((enemy) => enemy.type !== 'hunter');
  return {
    ...structuredClone(COOP_STARTER_PACK),
    ...journeyTeamPackEdition(level),
    id: 'imported-hunter-tuning',
    revision: 'imported-hunter-tuning-1',
    name: 'Imported hunter tuning fixture',
    levels: [level],
  };
}

const readPack = (pack) =>
  readPlayableTeamCampaign(new Blob([JSON.stringify(pack)], { type: 'application/json' }));

async function acceptedLevel(pack) {
  assert.deepEqual(validateCoopLevel(pack.levels[0]), valid);
  assert.deepEqual(validateCoopPack(pack), valid);
  const imported = await readPack(pack);
  assert.equal(imported.kind, 'raw');
  assert.equal(imported.prepared, null);
  assert.deepEqual(imported.pack, pack, 'The real importer accepts this exact source.');
  return imported.pack.levels[0];
}

function observeCommittedHunter(run) {
  const warnings = new Set();
  for (let tick = 0; tick < 720 && run.status === 'running'; tick++) {
    // The authored starter's right departure exposes a trail within hunter range.
    // Only public input steps are used; no actor, trail or clock state is arranged.
    stepCoop(run, [command(), command('left')], FIXED_DT);
    for (const event of run.events) if (event.type === 'enemy.warning') warnings.add(event.enemy);
    const hunter = run.enemies.find((enemy) => enemy.type === 'hunter' && enemy.phase === 'commit');
    if (!hunter) continue;
    assert.ok(warnings.has(hunter.id), 'The attack must have a prior visible warning.');
    assert.ok(
      run.events.some((event) => event.type === 'enemy.commit' && event.enemy === hunter.id),
    );
    assert.equal(hunter.baseSpeed, 8, 'Impact editions retain the native hunter attack speed.');
    assert.ok(Math.abs(Math.hypot(hunter.vx, hunter.vy) - 8) < 1e-8);
    return;
  }
  assert.fail('Expected a real warned hunter commitment within six seconds of legal input.');
}

for (const version of [6, 7])
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    test(`raw Team v${version}/${difficulty}: accepted hunters tune and start with native committed attacks`, async () => {
      const pack = importedPack({ version, difficulty }),
        before = structuredClone(pack),
        source = await acceptedLevel(pack),
        acceptedBefore = structuredClone(source),
        tuning = resolveGameplayTuning(difficulty);
      const native = createCoop(source, { seed: 1, difficulty });
      assert.equal(native.enemies.filter((enemy) => enemy.type === 'hunter').length, 2);
      assert.ok(
        native.enemies
          .filter((enemy) => enemy.type === 'hunter')
          .every((enemy) => enemy.baseSpeed === 8),
      );

      const tuned = applyGameplayTuning(source, tuning);
      assert.deepEqual(validateCoopLevel(tuned), valid);
      assert.equal(Object.hasOwn(tuned, 'encounter'), false);
      assert.deepEqual(tuned.lineImpact, source.lineImpact);
      assert.deepEqual(tuned.supportRoles, source.supportRoles);
      assert.throws(() => applyGameplayTuning(tuned, tuning), /exactly once/);
      const run = createCoop(tuned, { seed: 1, difficulty });
      assert.equal(run.status, 'ready');
      startCoop(run);
      assert.equal(run.status, 'running');
      observeCommittedHunter(run);
      assert.equal(Object.hasOwn(run.level, 'encounter'), false);
      assert.deepEqual(source, acceptedBefore, 'Tuning and play preserve accepted imported data.');
      assert.deepEqual(pack, before, 'Import and play preserve caller-owned source.');
    });

    test(`raw Team v${version}/${difficulty}: hunter-free imports still tune and start`, async () => {
      const pack = importedPack({ version, difficulty, hunters: false }),
        source = await acceptedLevel(pack),
        before = structuredClone(source),
        tuned = applyGameplayTuning(source, resolveGameplayTuning(difficulty));
      assert.deepEqual(validateCoopLevel(tuned), valid);
      assert.equal(Object.hasOwn(tuned, 'encounter'), false);
      const run = startCoop(createCoop(tuned, { seed: 1, difficulty }));
      stepCoop(run, [command(), command()], FIXED_DT);
      assert.equal(run.status, 'running');
      assert.equal(run.tick, 1);
      assert.ok(run.enemies.every((enemy) => enemy.type === 'drifter'));
      assert.deepEqual(source, before);
    });
  }

test('raw Team v5 still rejects hunters before import acceptance', async () => {
  const pack = importedPack({ version: 5 });
  assert.equal(validateCoopLevel(pack.levels[0]).valid, false);
  assert.equal(validateCoopPack(pack).valid, false);
  await assert.rejects(readPack(pack), /Enemies must be unique bounded drifters or Hunters/);
  assert.throws(
    () => applyGameplayTuning(pack.levels[0], resolveGameplayTuning('standard')),
    /Invalid Team tuning source/,
  );
});

for (const version of [6, 7])
  test(`raw Team v${version} still rejects authored encounter overrides`, async () => {
    for (const encounter of [{}, { hunterAttackSpeed: 8 }]) {
      const pack = importedPack({ version });
      pack.levels[0].encounter = encounter;
      assert.equal(validateCoopLevel(pack.levels[0]).valid, false);
      assert.equal(validateCoopPack(pack).valid, false);
      await assert.rejects(readPack(pack), /Team bonus edition currently qualifies/);
      assert.throws(
        () => applyGameplayTuning(pack.levels[0], resolveGameplayTuning('standard')),
        /Invalid Team tuning source: The Team bonus edition currently qualifies/,
      );
    }
  });
