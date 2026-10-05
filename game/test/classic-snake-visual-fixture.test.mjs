import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { exportClassicSnakeReplay } from '../snake/classic-core.mjs';
import {
  createSnakeVisualFixture,
  selectSnakeVisualProof,
} from './manual/snake-visual-fixture.mjs';

test('manual visual controls seek actual interference in every display mode and finish their exact verified route', async () => {
  const { proofs } = JSON.parse(
    await readFile(new URL('./fixtures/classic-snake-v4-proofs.json', import.meta.url)),
  );
  for (const mode of ['solo', 'team', 'versus'])
    for (const signal of ['local', 'broadcast']) {
      const proof = selectSnakeVisualProof(proofs, { mode, signal });
      const fixture = createSnakeVisualFixture(proof, mode);
      assert.equal(fixture.seekBurst(), true, `${mode}/${signal} must expose a real active burst`);
      const tick = fixture.match.runs[0].tick;
      assert.ok(tick > 0);
      fixture.step();
      assert.equal(fixture.match.runs[0].tick, tick + 1);
      while (fixture.step()) {
        /* Follow accepted journal inputs to their verified outcome. */
      }
      assert.equal(fixture.match.result, mode === 'versus' ? 'draw' : 'won');
      for (const run of fixture.match.runs)
        assert.deepEqual(exportClassicSnakeReplay(run), proof.replay);
    }
});
