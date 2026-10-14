import test from 'node:test';
import assert from 'node:assert/strict';
import { OVERFLIGHT_HUNT_MODE } from '../overflight/raid-mode.mjs';
import { createOverflightHuntReviewPilot } from '../overflight/raid-review-pilot.mjs';
import { overflightHuntBoostRecovery, spawnOverflightHuntEnemy } from '../overflight/raid-core.mjs';
import {
  applyOverflightHuntUpgrade,
  legalOverflightHuntUpgrades,
} from '../overflight/raid-upgrades.mjs';

for (const layout of ['relay-ruins-split-compound', 'river-port-twin-docks'])
  test(`baseline public-input review pilot routes around ${layout} cover`, () => {
    const mode = OVERFLIGHT_HUNT_MODE;
    const compiled = mode.compileProject(
      mode.createProject({ rulesVersion: 4, layout, seed: 17031991, difficulty: 'standard' }),
    );
    const run = mode.createRun(compiled, { airframes: 3, slowResume: true });
    // Withhold drafts to establish baseline capability; no flight/contact rules are altered.
    run.progression.maxChoices = 0;
    const pilot = createOverflightHuntReviewPilot({ route: 'objectives', build: 'pursuer' });
    mode.start(run);
    while (run.phase === 'playing' && run.time < 180) {
      const before = { x: run.player.x, y: run.player.y, hull: run.player.hull, tick: run.tick };
      const input = pilot.input(run);
      assert.deepEqual(
        { x: run.player.x, y: run.player.y, hull: run.player.hull, tick: run.tick },
        before,
        'The pilot may choose inputs, not move or protect the player.',
      );
      assert.ok(Math.hypot(input.x, input.y) <= 1.00000001);
      mode.step(run, input);
    }
    assert.equal(run.phase, 'won');
    assert.equal(run.hunt.objectivesCompleted, 7);
    assert.equal(run.progression.choices, 0);
  });

test('Rush plus a ranked cooldown and kill refund cannot advertise or admit an early boost', () => {
  const mode = OVERFLIGHT_HUNT_MODE;
  const compiled = mode.compileProject(mode.createProject({ rulesVersion: 4 }));
  const run = mode.createRun({ ...compiled, encounters: [] });
  mode.start(run);
  for (let rank = 1; rank <= 2; rank++)
    assert.equal(
      applyOverflightHuntUpgrade(
        run.build,
        legalOverflightHuntUpgrades(run.build).find(
          (offer) => offer.id === `boost-cooldown:${rank}`,
        ),
      ),
      true,
    );
  run.hunt.rushCharge = 20;
  spawnOverflightHuntEnemy(run, {
    family: 'patroller',
    x: run.player.x + 10,
    y: run.player.y,
    speed: 0,
    warning: 0,
  });
  mode.step(run, { x: 1, boost: true });
  const first = run.tick;
  assert.equal(run.stats.rushActivations, 1);
  assert.equal(run.stats.boostRefunds, 1);
  while (run.player.boostCooldown > 0) mode.step(run, { x: 1, boost: false });
  assert.ok(run.tick - first < 54);
  assert.ok(overflightHuntBoostRecovery(run) > 0);
  assert.equal(mode.boostRecovery(run), overflightHuntBoostRecovery(run));
  mode.step(run, { x: 1, boost: true });
  assert.equal(run.stats.boostsUsed, 1, 'Zero passive cooldown must not bypass the start floor.');
  while (run.tick - first < 53) mode.step(run, { x: 1, boost: false });
  assert.equal(overflightHuntBoostRecovery(run), 1 / 60);
  mode.step(run, { x: 1, boost: true });
  assert.equal(run.stats.boostsUsed, 2);
  assert.equal(run.tick - first, 54);
});
