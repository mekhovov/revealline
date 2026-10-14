import test from 'node:test';
import assert from 'node:assert/strict';
import { OVERFLIGHT_HUNT_MODE } from '../overflight/raid-mode.mjs';
import { createOverflightHuntReviewPilot } from '../overflight/raid-review-pilot.mjs';

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
