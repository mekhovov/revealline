import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import {
  createEncounterSoloHost,
  createEncounterVersusHost,
} from '../content-design/encounter-host.mjs';
import { ENCOUNTER_VARIANTS } from '../hunt/preferences.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { validateLevel } from '../core/index.mjs';

const { themes } = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url)),
);

test('encounter selections retain union ownership, exact restore keys and per-source visual pins', async () => {
  let variant = 'authored';
  const host = createEncounterSoloHost(createOpeningCandidates({ artwork: true }), {
    themes,
    getEncounterVariant: () => variant,
  });
  try {
    const mission = host.catalog.missions[0];
    const original = host.select(mission, 'standard');
    const authoredCount = host.entries.length;
    assert.deepEqual(host.availableVariants(mission), ENCOUNTER_VARIANTS);
    assert.equal(
      host.entries.length,
      authoredCount,
      'Availability does not compile whole variants',
    );
    variant = 'off';
    assert.equal(host.select(mission, 'standard'), original);
    variant = 'hunt';
    const selection = host.select(mission, 'standard');
    assert.notEqual(selection.executionKey, original.executionKey);
    assert.equal(selection.campaign.levels[0].classic.hunt.mode, 'hunt');
    variant = 'authored';
    assert.equal(host.owns(selection), true);
    assert.equal(host.select(mission, 'expert', { selection }).encounterVariant, 'hunt');
    const progress = host.progressMission(selection, 0);
    assert.notEqual(progress.id, mission.id);
    assert.equal(host.selectProgress(progress.id, 'standard'), selection);
    assert.equal(host.selectProgress(mission.id, 'standard'), original);
    const identity = await host.prepareVisualIdentity({
      selection,
      level: selection.campaign.levels[0],
      association: { editionId: 'fixture', contentThemeId: 'horizon', mode: 'solo' },
    });
    assert.match(identity.owner.projectRevision, /^hunt-/);
    await assert.rejects(
      host.preparer.prepare({
        missionId: mission.id,
        difficulty: 'standard',
        seed: 1,
        turnPolicy: 'immediate',
        executionKey: selection.executionKey + '0',
      }),
      /exact owned encounter execution/,
    );
    const tuned = applyGameplayTuning(
      selection.campaign.levels[0],
      resolveGameplayTuning('standard', { playerSpeed: 0.75, enemySpeed: 2, enemyDensity: 2 }),
    );
    assert.equal(validateLevel(tuned).valid, true);
    for (const target of tuned.classic.hunt.targets.filter((target) => target.kind === 'runner')) {
      const actor = tuned.classic.combatPatrols.actors.find((actor) => actor.id === target.id);
      assert.ok(actor.speed <= tuned.rules.moveSpeed * 0.7);
    }
    assert.ok(tuned.enemies.length + tuned.classic.combatPatrols.actors.length <= 24);
  } finally {
    host.preparer.dispose();
  }
});

test('Versus variants preserve manifest ownership and immutable two-board source rows', () => {
  let variant = 'bonus';
  const host = createEncounterVersusHost(createOpeningCandidates({ artwork: true }), {
    themes,
    getEncounterVariant: () => variant,
  });
  const mission = host.catalog.missions[0],
    row = host.row(mission, 'standard');
  assert.equal(row.level.classic.hunt.mode, 'bonus');
  assert.equal(host.manifest(mission).level, row.level);
  assert.equal(host.visualThemeSelection(row, row.level).level, row.level);
  variant = 'capture-quota';
  const quota = host.row(mission, 'standard');
  assert.notEqual(quota.executionKey, row.executionKey);
  assert.equal(host.owns(row), true);
  assert.equal(host.manifest(mission).level.classic.hunt.mode, 'capture-quota');
  assert.equal(new Set(host.rows.map((item) => item.key)).size, host.rows.length);
});
