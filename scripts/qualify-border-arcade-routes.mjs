// Renew policy identities only after proving legacy checkpoints and identical route outcomes.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createBorderCandidates } from '../game/content-design/border-candidates.mjs';
import { compileContentProject, resolveMission } from '../game/content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../game/core/index.mjs';
import { projectClassicState } from '../game/core/classic-state.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../game/replay.mjs';

const update = process.argv.includes('--write');
const projects = new Map();
for (const bonuses of [true, false]) {
  const source = createBorderCandidates();
  if (!bonuses) for (const mission of source.missions) mission.bonuses = [];
  const current = compileContentProject(source);
  source.policyId = 'journey-v1';
  projects.set(bonuses, { current, legacy: compileContentProject(source) });
}
const outputs = [];
let verified = 0;
for (const filename of ['border-clear-routes.json', 'border-timing-routes.json']) {
  const url = new URL(`../game/test/fixtures/${filename}`, import.meta.url);
  const legacyUrl = new URL(`../game/test/fixtures/legacy-${filename}`, import.meta.url);
  const fixture = JSON.parse(await readFile(legacyUrl, 'utf8'));
  for (const set of fixture.sets) {
    const difficulty = set.difficulty ?? fixture.difficulty;
    const turnPolicy = set.turnPolicy ?? fixture.turnPolicy;
    const { current, legacy } = projects.get(set.bonuses ?? true);
    for (const row of set.rows) {
      const [id, identity, checkpoint, segments] = row;
      const oldManifest = resolveMission(legacy, id, { difficulty });
      const nextManifest = resolveMission(current, id, { difficulty });
      assert.equal(oldManifest.simulationIdentity, identity, `${id}: legacy identity changed`);
      const options = { seed: fixture.seed ?? 1, classId: 'scout', turnPolicy };
      const oldRun = createRun(oldManifest.level, options);
      const nextRun = createRun(nextManifest.level, options);
      const oldRecorder = createRecorder(oldManifest.level, options);
      const nextRecorder = createRecorder(nextManifest.level, options);
      for (const [direction, ticks] of segments) {
        assert(Number.isSafeInteger(ticks) && ticks > 0 && ticks <= 1000);
        for (let tick = 0; tick < ticks; tick++) {
          for (const [run, recorder] of [
            [oldRun, oldRecorder],
            [nextRun, nextRecorder],
          ]) {
            assert.equal(run.status, 'running', `${id}: input after completion`);
            recordInput(recorder, { direction });
            stepRun(run, { direction }, FIXED_DT);
            assert.equal(run.lives, nextManifest.level.rules.lives, `${id}: life lost`);
          }
        }
      }
      const before = authoritativeCheckpoint(oldRun);
      const after = authoritativeCheckpoint(nextRun);
      assert.equal(before.hash, checkpoint, `${id}: legacy checkpoint changed`);
      assert.equal(nextRun.status, 'won', id);
      const { classic: oldClassic, ...oldSections } = before.sections;
      const { classic: newClassic, ...newSections } = after.sections;
      assert.deepEqual(newSections, oldSections, `${id}: non-classic outcome changed`);
      assert.notEqual(newClassic, oldClassic);
      const projected = projectClassicState(nextRun);
      assert.deepEqual(projected.definition.arcadeActions, { version: 'arcade-actions.v1' });
      delete projected.definition.arcadeActions;
      assert.deepEqual(projected, projectClassicState(oldRun), `${id}: classic outcome changed`);
      assert.equal(verifyReplay(exportReplay(oldRecorder, oldRun)).match, true);
      assert.equal(verifyReplay(exportReplay(nextRecorder, nextRun)).match, true);
      row[1] = nextManifest.simulationIdentity;
      row[2] = after.hash;
      verified++;
    }
  }
  fixture.policyId = 'journey-arcade-v2';
  outputs.push({ url, fixture });
}
// No fixture is changed until every preserved route and both replay generations pass.
for (const { url, fixture } of outputs) {
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
