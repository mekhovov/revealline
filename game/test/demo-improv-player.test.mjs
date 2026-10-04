import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareImprovPlayer } from '../demo-improv-player.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { verifyReplay } from '../replay.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';

const pack = JSON.parse(
    await readFile(new URL('../content/packs/fpv-arcade-r5.json', import.meta.url)),
  ),
  level = applyGameplayTuning(pack.campaigns[0].levels[2], resolveGameplayTuning('standard'));

const options = (seed) => ({
  seed,
  turnPolicy: 'immediate',
  classId: 'scout',
  classRecipes: pack.classRecipes,
});

for (const policy of ['immediate', 'grid-center'])
  test(`${policy}: purposeful routes vary, close cuts and only lose to believable hazards`, async (t) => {
    const recordings = [],
      totals = { captures: 0, failures: 0 };
    for (const seed of [123, 987654321]) {
      const setup = { ...options(seed), turnPolicy: policy };
      const player = await prepareImprovPlayer(level, setup, { performanceSeed: seed });
      try {
        const recording = player.exportRecording();
        assert.equal(verifyReplay(recording).match, true);
        recordings.push(JSON.stringify(recording.segments));
        const run = createRun(level, setup),
          reverse = { up: 'down', down: 'up', left: 'right', right: 'left' };
        let captures = 0,
          losses = 0,
          bends = 0,
          exposedTicks = 0;
        const causes = [];
        for (const segment of recording.segments)
          for (let tick = 0; tick < segment.ticks; tick++) {
            const cutting = run.player.cutting,
              heading = run.player.direction;
            if (cutting) {
              exposedTicks++;
              assert.notEqual(
                segment.input.direction,
                reverse[heading],
                'Never reverse over a live cable.',
              );
            }
            stepRun(run, segment.input, FIXED_DT);
            if (cutting && run.player.cutting && run.player.direction !== heading) bends++;
            for (const event of run.events) {
              if (event.type === 'cut.closed') captures++;
              if (event.type === 'player.failed') {
                losses++;
                causes.push(event.cause);
                assert.ok(captures > 0, 'Show competence before an overreach.');
                assert.ok(exposedTicks >= 240, 'No immediate departure death.');
                assert.ok(
                  ['enemy-trail', 'enemy-player', 'boss-lane', 'combat-projectile'].includes(
                    event.cause,
                  ),
                );
              }
            }
            if (!run.player.cutting) exposedTicks = 0;
          }
        assert.ok(captures >= 1);
        assert.ok(losses <= 3, 'Losses cannot exceed the actual life budget.');
        assert.ok(bends >= 1, 'Demonstrate purposeful turns, not only straight cuts.');
        assert.equal(run.player.cutting, false, 'Finish at a meaningful route boundary.');
        t.diagnostic(JSON.stringify({ seed, captures, losses, causes, bends, ticks: run.tick }));
        player.play();
        while (player.phase === 'playing')
          for (const event of player.advance(0.25).events) {
            if (event.type === 'cut.closed') totals.captures++;
            if (event.type === 'player.failed') totals.failures++;
          }
        assert.equal(player.finalCheckpoint.matched, true);
        if (policy === 'grid-center' && seed === 987654321)
          assert.ok(
            player.state.tick > 7200,
            'A complete run can continue beyond both old time caps.',
          );
        assert.ok(
          ['won', 'lost'].includes(player.state.status),
          'Never end an unfinished performance.',
        );
      } finally {
        player.dispose();
      }
    }
    assert.notEqual(recordings[0], recordings[1]);
    assert.ok(totals.captures >= 1, 'The fallback includes useful real capture attempts.');
    if (policy === 'immediate') assert.ok(totals.failures >= 1, 'Real hazards still cause losses.');
  });

test('improvised preparation respects cancellation before it owns a player', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(prepareImprovPlayer(level, options(1), { signal: controller.signal }), {
    name: 'AbortError',
  });
});

test('cancellation during route planning stops before publishing a recording', async () => {
  const controller = new AbortController();
  const pending = prepareImprovPlayer(level, options(123), { signal: controller.signal });
  setTimeout(() => controller.abort(), 0);
  await assert.rejects(pending, { name: 'AbortError' });
});
