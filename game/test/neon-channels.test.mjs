import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildNeonChannels } from '../../scripts/build-neon-channels.mjs';
import { createRun, stepRun } from '../core/index.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplay } from '../replay.mjs';

test('Neon Channels imports reproduce the authored scenario and pack', async () => {
  const built = await buildNeonChannels();
  for (const name of ['scenario', 'pack']) {
    const saved = JSON.parse(
      await readFile(
        new URL(`../../authoring/library/neon-channels/${name}.json`, import.meta.url),
      ),
    );
    assert.deepEqual(saved, built[name]);
  }
});

for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`Neon Channels supports two corridor captures and exact replay in ${turnPolicy}`, async () => {
    const { scenario } = await buildNeonChannels();
    const options = { ...scenario.settings, turnPolicy, classRecipes: scenario.classRecipes };
    const run = createRun(scenario.level, options);
    const recorder = createRecorder(scenario.level, options, 'neon-channels-check');
    let captures = 0;
    for (const [direction, ticks] of [
      ['right', 252],
      ['up', 500],
      ['right', 264],
      ['down', 500],
    ]) {
      for (let tick = 0; tick < ticks; tick++) {
        const input = { direction };
        recordInput(recorder, input);
        stepRun(run, input);
        captures += run.events.filter((event) => event.type === 'cut.closed').length;
      }
    }
    assert.equal(run.status, 'running');
    assert.equal(run.lives, 3);
    assert.equal(captures, 2);
    assert.equal(run.claimedCount, 68);
    assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
  });
}
