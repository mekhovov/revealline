import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import {
  createSentinelCandidates,
  SENTINEL_LEARNING_ARCS,
  SENTINEL_FIRST_RETURNS,
  SENTINEL_REFERENCE_ADAPTATIONS,
} from '../content-design/sentinel-candidates.mjs';
import { createCrosswindCandidates } from '../content-design/crosswind-candidates.mjs';
import { SENTINEL_RECIPE } from '../content-design/catalogs.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { resolveContentJourney } from '../content-design/journey.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplay } from '../replay.mjs';

const source = createSentinelCandidates(),
  project = compileContentProject(source);
test('four spatial decisions form one learning arc, with a separate optional Remix and no speed reset', () => {
  assert.equal(
    source.missions[0].design.difficulty.band,
    createCrosswindCandidates().missions.at(-2).design.difficulty.band,
  );
  assert.equal(SENTINEL_LEARNING_ARCS.length, 1);
  assert.equal(SENTINEL_LEARNING_ARCS[0].missionIds.length, 4);
  assert.equal(SENTINEL_REFERENCE_ADAPTATIONS.length, 3);
  assert.deepEqual(
    source.missions.map((m) => m.encounter.shieldObjectiveIds.length),
    [1, 2, 3, 4, 3],
  );
  const identities = new Set();
  let band = 11;
  for (const [index, mission] of source.missions.entries()) {
    assert.deepEqual(mission.design.introduces, index ? [] : ['shield-relay-sentinel']);
    assert(mission.design.difficulty.band >= band);
    band = mission.design.difficulty.band;
    assert.equal(mission.timeLimitSeconds, 0);
    assert.equal(mission.presentation.backgroundAssetId, null);
    assert(mission.actors.every((actor) => actor.tier === 'measured'));
    assert(new Set(mission.actors.map((actor) => actor.role)).size <= 3);
    identities.add(project.maps.find((map) => map.source.id === mission.map.id).geometryIdentity);
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const solo = resolveMission(project, mission.id, { difficulty });
      assert.deepEqual(
        resolveMission(project, mission.id, { difficulty, mode: 'versus' }).level,
        solo.level,
      );
      assert.equal(solo.level.rules.moveSpeed, 10);
      assert.equal(solo.level.version, 'xonix-level.v8');
      assert.deepEqual(solo.level.encounter.shielded, SENTINEL_RECIPE.definition.shielded);
      assert.deepEqual(solo.level.encounter.exposed, SENTINEL_RECIPE.definition.exposed);
      assert(!solo.officialProgressEligible);
      assert(
        !solo.diagnostics.some(
          (d) => d.severity === 'error' || /auto-fill|blocked-relay/.test(d.code),
        ),
        mission.id,
      );
    }
  }
  assert.equal(identities.size, 5);
  assert.equal(
    resolveContentJourney(project, { packIds: ['journey-sentinel'] }).missions.length,
    4,
  );
  assert.throws(() => resolveContentJourney(project, { mode: 'team' }), /no missions/);
});

test('every initial field region is genuinely retained; no shield or remote half-board auto-fills', () => {
  for (const mission of source.missions) {
    const capture = inspectCaptureSnapshot(createRun(resolveMission(project, mission.id).level));
    assert.equal(capture.filledCells.length, 0, mission.id);
    assert.equal(capture.components.length, 1, mission.id);
    assert.deepEqual(capture.components[0].enemyIds, ['sentinel']);
  }
});

test('all assigned references have explicit non-final dispositions and shared preview geometry', async () => {
  const ledger = JSON.parse(
    await readFile(new URL('../../docs/research/xposed-journey-ledger.json', import.meta.url)),
  );
  assert.deepEqual(
    SENTINEL_REFERENCE_ADAPTATIONS.map((row) => row.reference).sort(),
    ledger.references
      .filter((row) => row.proposal?.campaign === 'Sentinel Crown')
      .map((row) => row.designKey)
      .sort(),
  );
  assert(SENTINEL_REFERENCE_ADAPTATIONS.every((row) => row.decision === 'redesign' && !row.final));
  for (const mission of source.missions) {
    const preview = prepareContentPreview(source, mission.id);
    assert.deepEqual(preview.manifest.level, resolveMission(project, mission.id).level);
    assert.equal(preview.scenario, null);
  }
});

test('CLI and Studio preserve the exact Sentinel manifest without public enrollment', async () => {
  const theme = JSON.parse(
    await readFile(new URL('../content-design/themes.json', import.meta.url)),
  ).themes.find((theme) => theme.id === 'horizon');
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    const preview = prepareContentPreview(source, 'first-relay', { theme, difficulty });
    const cli = spawnSync(
      process.execPath,
      [
        new URL('../../scripts/compile-content-project.mjs', import.meta.url).pathname,
        '-',
        '--mission',
        'first-relay',
        '--difficulty',
        difficulty,
      ],
      { input: JSON.stringify(source), encoding: 'utf8' },
    );
    assert.equal(cli.status, 0, cli.stderr);
    assert.deepEqual(JSON.parse(cli.stdout), preview.manifest);
    assert.equal(preview.scenario.format, 'xonix-playground.v9');
    assert.equal(preview.manifest.officialProgressEligible, false);
  }
});

for (const difficulty of ['gentle', 'standard', 'expert'])
  for (const turnPolicy of ['immediate', 'grid-center'])
    test(`${difficulty}/${turnPolicy}: five seconds to read the board and a real first return stay survivable`, () => {
      for (const mission of source.missions) {
        const level = resolveMission(project, mission.id, { difficulty }).level,
          options = { seed: 1, classId: 'scout', turnPolicy };
        const idle = createRun(level, options);
        for (let tick = 0; tick < 600; tick++) stepRun(idle, { direction: null }, FIXED_DT);
        assert.equal(idle.classic.livesLost, 0, mission.id + ': decision space');
        const run = createRun(level, options),
          recorder = createRecorder(level, options),
          denominator = run.totalClaimable;
        for (let tick = 0; tick < 1200 && !run.claimedCount && run.status === 'running'; tick++) {
          const input = { direction: SENTINEL_FIRST_RETURNS[mission.id] };
          recordInput(recorder, input);
          stepRun(run, input, FIXED_DT);
          assert.equal(run.classic.livesLost, 0, mission.id + ': departure at ' + run.tick);
        }
        assert(run.claimedCount > 0, mission.id);
        assert.notEqual(run.status, 'won', mission.id + ': trivial first cut');
        assert.equal(run.totalClaimable, denominator);
        assert.equal(run.encounter.stage, 'shielded');
        assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
      }
    });
