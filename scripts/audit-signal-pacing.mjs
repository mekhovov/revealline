// Read-only, exact-fixture review. These measurements never retune a level or
// certify human difficulty, low-risk cleanup, enjoyment, or release eligibility.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createSignalCandidates } from '../game/content-design/signal-candidates.mjs';
import { compileContentProject, resolveMission } from '../game/content-design/project.mjs';
import { createRun, stepRun, FIXED_DT, CELL } from '../game/core/index.mjs';
import { authoritativeCheckpoint } from '../game/replay.mjs';

const source = createSignalCandidates();
const project = compileContentProject(source);
const inputs = [];
const rows = [];
for (const kind of ['clear', 'mastery']) {
  const path = `game/test/fixtures/signal-${kind}-routes.json`;
  const bytes = await readFile(new URL(`../${path}`, import.meta.url));
  const fixture = JSON.parse(bytes);
  inputs.push({ path, sha256: createHash('sha256').update(bytes).digest('hex') });
  const routes =
    kind === 'mastery'
      ? fixture.rows
      : fixture.sets.find(
          (set) => set.bonuses && set.difficulty === 'standard' && set.turnPolicy === 'immediate',
        ).rows;
  for (const [id, identity, expectedCheckpoint, segments] of routes) {
    const manifest = resolveMission(project, id);
    assert.equal(manifest.simulationIdentity, identity, `${id}: stale input identity`);
    const run = createRun(manifest.level, { seed: 1, classId: 'scout', turnPolicy: 'immediate' });
    const areas = manifest.level.classic.terrain;
    let materialDone = null,
      closures = 0,
      tailClosures = 0,
      exposedTicks = 0,
      longestTrail = 0;
    for (const [direction, ticks] of segments) {
      assert(Number.isSafeInteger(ticks) && ticks > 0 && ticks <= 1000);
      for (let tick = 0; tick < ticks; tick++) {
        assert.equal(run.status, 'running', `${id}: inputs beyond terminal state`);
        stepRun(run, { direction }, FIXED_DT);
        assert.equal(run.classic.livesLost, 0, `${id}: route lost a life`);
        exposedTicks += run.player.cutting ? 1 : 0;
        longestTrail = Math.max(longestTrail, run.trail.length);
        for (const event of run.events)
          if (event.type === 'cut.closed') {
            closures++;
            if (materialDone !== null) tailClosures++;
          }
        if (
          materialDone === null &&
          areas.every((area) => {
            for (let y = area.y; y < area.y + area.h; y++)
              for (let x = area.x; x < area.x + area.w; x++)
                if (run.cells[y * run.width + x] !== CELL.SAFE) return false;
            return true;
          })
        )
          materialDone = { tick: run.tick, coverage: run.coverage };
      }
    }
    assert.equal(run.status, 'won', id);
    assert.equal(authoritativeCheckpoint(run).hash, expectedCheckpoint, `${id}: stale outcome`);
    const target = source.missions.find((mission) => mission.id === id).design.durationSeconds;
    rows.push({
      id,
      route: kind,
      simulationIdentity: identity,
      checkpoint: expectedCheckpoint,
      clearTicks: run.tick,
      clearSeconds: run.tick * FIXED_DT,
      closures,
      exposedTicks,
      longestSampledTrailCells: longestTrail,
      fullMaterialNeutralization: materialDone,
      ticksAfterFullMaterialNeutralization:
        materialDone === null ? null : run.tick - materialDone.tick,
      closuresAfterFullMaterialNeutralization: tailClosures,
      authoredDurationHypothesisSeconds: target,
      belowAuthoredDurationHypothesis: run.tick * FIXED_DT < target[0],
      lowRiskCleanup: 'not-assessed',
    });
  }
}
assert.equal(rows.length, 14);
process.stdout.write(
  JSON.stringify(
    {
      format: 'SignalPacingObservationV1',
      evidence: 'deterministic-omniscient-fixtures-not-human-playtesting',
      difficulty: 'standard',
      turnPolicy: 'immediate',
      seed: 1,
      inputs,
      rows,
      limitations: [
        'A material-neutralized tail may still contain meaningful enemy or frontier pressure.',
        'A shortest or scripted clear is not a target for normal player duration.',
        'Trail length is sampled after ticks; a closing tick can clear the trail before sampling.',
        'Optional mastery remains independent of an ordinary clear.',
        'No source, fixture, release gate, or player progress is changed.',
      ],
    },
    null,
    2,
  ) + '\n',
);
