import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareImprovPlayer } from '../demo-improv-player.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { verifyReplay } from '../replay.mjs';

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

test('uncovered installed level gets varied ordinary inputs, real captures and real mistakes', async () => {
  const recordings = [],
    totals = { captures: 0, failures: 0 };
  for (const seed of [123, 987654321]) {
    const player = await prepareImprovPlayer(level, options(seed), { performanceSeed: seed });
    try {
      const recording = player.exportRecording();
      assert.equal(verifyReplay(recording).match, true);
      recordings.push(JSON.stringify(recording.segments));
      player.play();
      while (player.phase === 'playing')
        for (const event of player.advance(0.25).events) {
          if (event.type === 'cut.closed') totals.captures++;
          if (event.type === 'player.failed') totals.failures++;
        }
      assert.equal(player.finalCheckpoint.matched, true);
      assert.ok(['running', 'won', 'lost'].includes(player.state.status));
    } finally {
      player.dispose();
    }
  }
  assert.notEqual(recordings[0], recordings[1]);
  assert.ok(totals.captures >= 1, 'The fallback includes useful real capture attempts.');
  assert.ok(totals.failures >= 1, 'The fallback includes ordinary player mistakes.');
});

test('improvised preparation respects cancellation before it owns a player', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(prepareImprovPlayer(level, options(1), { signal: controller.signal }), {
    name: 'AbortError',
  });
});
