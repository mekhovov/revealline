import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRun, stepRun, FIXED_DT } from '../game/core/index.mjs';
import { createRecorder, recordInput, exportReplay } from '../game/replay.mjs';
import { validateQualification } from './solo-qualification.mjs';
import { inspectQualificationReplayPortability } from './solo-qualification-replay.mjs';

const originalHashes = {
  'long-rail': 'b9afaecaadcbd0f657dd8064b9f7932c0c7ec12d6433f7d2b76f60de7ef19528',
  sentry: '86cc1eea19e1d229dae865b368a94238de900ad83be5d9a4ee469b2e4dc3c0fd',
};
const patterns = [
  { name: 'nominal', ticks: () => 0 },
  ...[-6, -3, -2, -1, 1, 2, 3, 6].map((value) => ({
    name: `uniform ${value} ticks`,
    ticks: () => value,
  })),
  ...[1, 2, 3, 6].flatMap((value) => [
    {
      name: `first direction longer ${value} ticks`,
      ticks: (index) => (index % 2 ? -value : value),
    },
    {
      name: `second direction longer ${value} ticks`,
      ticks: (index) => (index % 2 ? value : -value),
    },
  ]),
];
const supplemental = (action) => action.label?.startsWith('supplemental-steering-');

for (const id of ['long-rail', 'sentry']) {
  const originalBytes = await readFile(
    new URL(
      `../docs/performance/fixtures/solo-remote-timing/${id}.qualification.fixture`,
      import.meta.url,
    ),
  );
  const original = JSON.parse(originalBytes);
  const fixture = JSON.parse(
    await readFile(
      new URL(
        `../docs/performance/fixtures/solo-latency-supplement/${id}.qualification.fixture`,
        import.meta.url,
      ),
    ),
  );

  test(`${id} supplement retains the exact original mission and public action subsequence`, () => {
    assert.equal(createHash('sha256').update(originalBytes).digest('hex'), originalHashes[id]);
    assert.doesNotThrow(() => validateQualification(fixture));
    assert.equal(fixture.timeoutMs, original.timeoutMs);
    assert.deepEqual(fixture.expectedReplayDefinition, original.expectedReplayDefinition);
    assert.deepEqual(
      fixture.actions.filter((action) => !supplemental(action)),
      original.actions,
    );
    assert.deepEqual(fixture.replayRequirements, {
      ...original.replayRequirements,
      directionChangesWithMovement: 20,
    });
    const added = fixture.actions.filter(supplemental);
    assert.equal(added.length, 22);
    assert.deepEqual(
      added,
      Array.from({ length: 22 }, (_, index) => ({
        type: 'key',
        key:
          id === 'sentry'
            ? index % 2
              ? 'ArrowRight'
              : 'ArrowLeft'
            : index % 2
              ? 'ArrowUp'
              : 'ArrowDown',
        ms: id === 'sentry' ? 500 : 1000,
        label: `supplemental-steering-${index + 1}`,
      })),
    );
  });

  for (const pattern of patterns)
    test(`${id} supplemental model preserves captures, meaningful motion and replay: ${pattern.name}`, () => {
      const definition = fixture.expectedReplayDefinition;
      const options = { ...definition.options, seed: 1 };
      const run = createRun(definition.level, options);
      const recorder = createRecorder(definition.level, options);
      let supplementalIndex = 0;
      for (const action of fixture.actions) {
        if (action.type !== 'key' && !(action.type === 'wait' && action.ms)) continue;
        const direction = action.type === 'key' ? action.key.slice(5).toLowerCase() : null;
        const ticks =
          Math.round((action.ms * 120) / 1000) +
          (supplemental(action) ? pattern.ticks(supplementalIndex++) : 0);
        for (let index = 0; index < ticks; index++) {
          assert.equal(
            run.status,
            'running',
            'No terminal result or recovery substitutes for steering',
          );
          recordInput(recorder, { direction });
          stepRun(run, { direction }, FIXED_DT);
        }
      }
      assert.equal(run.status, 'running');
      assert.equal(run.lives, 3);
      const verified = inspectQualificationReplayPortability(
        exportReplay(recorder, run),
        fixture.replayRequirements,
        definition,
      );
      assert.equal(verified.match, true);
      assert.equal(verified.status, 'pass');
      assert(verified.checks.every((check) => check.pass));
      assert(verified.features.directionChangesWithMovement >= 20);
    });
}
