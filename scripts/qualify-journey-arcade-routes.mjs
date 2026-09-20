// Compare renewed Arcade routes against preserved v1 checkpoints before emitting any fixture.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createOpeningCandidates } from '../game/content-design/horizon-candidates.mjs';
import { compileContentProject, resolveMission } from '../game/content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../game/core/index.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../game/replay.mjs';

const update = process.argv.includes('--write');
const source = createOpeningCandidates();
const current = compileContentProject(source);
source.policyId = 'journey-v1';
const legacy = compileContentProject(source);
let verified = 0;
for (const filename of ['horizon-greybox-routes.json', 'horizon-preset-routes.json']) {
  const url = new URL(`../game/test/fixtures/${filename}`, import.meta.url);
  const oldUrl = new URL(`../game/test/fixtures/legacy-${filename}`, import.meta.url);
  const original = await readFile(oldUrl, 'utf8');
  const fixture = JSON.parse(original);
  for (const { difficulty, turnPolicy, rows } of fixture.sets ?? [
    { difficulty: 'standard', turnPolicy: 'immediate', rows: fixture.rows },
  ]) {
    for (const row of rows) {
      const [id, identity, checkpoint, segments] = row;
      const oldManifest = resolveMission(legacy, id, { difficulty });
      const nextManifest = resolveMission(current, id, { difficulty });
      assert.equal(oldManifest.simulationIdentity, identity, `${id}: legacy identity changed`);
      const options = { seed: 1, classId: 'scout', turnPolicy };
      const oldRun = createRun(oldManifest.level, options);
      const nextRun = createRun(nextManifest.level, options);
      const recorder = createRecorder(nextManifest.level, options);
      for (const [direction, ticks] of segments) {
        for (let tick = 0; tick < ticks; tick++) {
          assert.equal(nextRun.status, 'running');
          stepRun(oldRun, { direction }, FIXED_DT);
          recordInput(recorder, { direction });
          stepRun(nextRun, { direction }, FIXED_DT);
          assert.equal(nextRun.lives, nextManifest.level.rules.lives);
        }
      }
      const before = authoritativeCheckpoint(oldRun),
        after = authoritativeCheckpoint(nextRun);
      assert.equal(before.hash, checkpoint, `${id}: legacy checkpoint changed`);
      assert.equal(nextRun.status, 'won');
      // The explicit action policy is committed in classic state; every other
      // future-affecting section must retain exactly the same route outcome.
      const { classic: oldClassic, ...oldSections } = before.sections;
      const { classic: newClassic, ...newSections } = after.sections;
      assert.deepEqual(newSections, oldSections, `${id}: non-policy outcome changed`);
      assert.notEqual(newClassic, oldClassic);
      assert.equal(verifyReplay(exportReplay(recorder, nextRun)).match, true);
      row[1] = nextManifest.simulationIdentity;
      row[2] = after.hash;
      verified++;
    }
  }
  fixture.policyId = 'journey-arcade-v2';
  if (update) await writeFile(url, JSON.stringify(fixture, null, 2) + '\n');
  else assert.deepEqual(JSON.parse(await readFile(url, 'utf8')), fixture);
}
console.log(
  JSON.stringify({
    verified,
    legacyPolicy: 'journey-v1',
    policy: 'journey-arcade-v2',
    updated: update,
  }),
);
