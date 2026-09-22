import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import {
  createApexCandidates,
  APEX_FIRST_RETURNS,
  APEX_LEARNING_ARCS,
  APEX_REFERENCE_ADAPTATIONS,
} from '../content-design/apex-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { resolveContentJourney } from '../content-design/journey.mjs';
import { createCandidateSequence } from '../content-design/route.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplay } from '../replay.mjs';

const source = createApexCandidates(),
  project = compileContentProject(source);
test('Apex is a four-mission band-twelve capstone with no new rule and a voluntary Remix', () => {
  assert.equal(source.missions.length, 5);
  assert.deepEqual(
    APEX_LEARNING_ARCS[0].missionIds,
    source.missions.slice(0, 4).map((m) => m.id),
  );
  assert.deepEqual(APEX_LEARNING_ARCS[0].introduces, []);
  const geometry = new Set();
  for (const mission of source.missions) {
    assert.equal(mission.design.difficulty.band, 12);
    assert.deepEqual(mission.design.introduces, []);
    assert.equal(mission.timeLimitSeconds, 0);
    assert.equal(mission.presentation.backgroundAssetId, null);
    assert(mission.actors.every((actor) => actor.tier === 'measured'));
    assert(new Set(mission.actors.map((actor) => actor.role)).size <= 3);
    geometry.add(project.maps.find((map) => map.source.id === mission.map.id).geometryIdentity);
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const solo = resolveMission(project, mission.id, { difficulty });
      assert.deepEqual(
        resolveMission(project, mission.id, { difficulty, mode: 'versus' }).level,
        solo.level,
      );
      assert.equal(solo.level.rules.moveSpeed, 10);
      assert.equal(solo.level.version, 'xonix-level.v8');
      assert(!solo.officialProgressEligible);
      assert(
        !solo.diagnostics.some(
          (d) => d.severity === 'error' || /auto-fill|blocked-relay/.test(d.code),
        ),
        mission.id,
      );
    }
  }
  assert.equal(geometry.size, 5);
  const journey = resolveContentJourney(project),
    sequence = createCandidateSequence(journey, ['journey-apex']);
  assert.equal(sequence.next(journey.missions.find((m) => m.levelId === 'home-signal').id), null);
  assert.equal(sequence.isCore(journey.missions.find((m) => m.levelId === 'apex-remix').id), false);
  assert.throws(() => resolveContentJourney(project, { mode: 'team' }), /no missions/);
});

test('every initial field component is occupied; capstone references remain non-final proposals', async () => {
  for (const mission of source.missions) {
    const capture = inspectCaptureSnapshot(createRun(resolveMission(project, mission.id).level));
    assert.equal(capture.filledCells.length, 0, mission.id);
    assert(
      capture.components.every((component) => component.enemyIds.length > 0),
      mission.id,
    );
    const preview = prepareContentPreview(source, mission.id);
    assert.deepEqual(preview.manifest.level, resolveMission(project, mission.id).level);
  }
  const ledger = JSON.parse(
    await readFile(new URL('../../docs/research/xposed-journey-ledger.json', import.meta.url)),
  );
  assert.deepEqual(
    APEX_REFERENCE_ADAPTATIONS.map((row) => row.reference).sort(),
    ledger.references
      .filter((row) => row.proposal?.campaign === 'Apex Aurora')
      .map((row) => row.designKey)
      .sort(),
  );
  assert(APEX_REFERENCE_ADAPTATIONS.every((row) => row.decision === 'redesign' && !row.final));
});

test('CLI and Studio compile the same nullable-encounter successor', async () => {
  const theme = JSON.parse(
    await readFile(new URL('../content-design/themes.json', import.meta.url)),
  ).themes.find((theme) => theme.id === 'horizon');
  for (const missionId of ['final-broadcast', 'home-signal'])
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const preview = prepareContentPreview(source, missionId, { theme, difficulty });
      const cli = spawnSync(
        process.execPath,
        [
          new URL('../../scripts/compile-content-project.mjs', import.meta.url).pathname,
          '-',
          '--mission',
          missionId,
          '--difficulty',
          difficulty,
        ],
        { input: JSON.stringify(source), encoding: 'utf8' },
      );
      assert.equal(cli.status, 0, cli.stderr);
      assert.deepEqual(JSON.parse(cli.stdout), preview.manifest);
      assert.equal(preview.scenario.format, 'xonix-playground.v9');
    }
});

for (const difficulty of ['gentle', 'standard', 'expert'])
  for (const turnPolicy of ['immediate', 'grid-center'])
    test(`${difficulty}/${turnPolicy}: capstone decision space and first closures need no collected bonus`, () => {
      for (const mission of source.missions) {
        const level = resolveMission(project, mission.id, { difficulty }).level,
          options = { seed: 1, classId: 'scout', turnPolicy };
        const idle = createRun(level, options);
        for (let tick = 0; tick < 600; tick++) stepRun(idle, { direction: null }, FIXED_DT);
        assert.equal(idle.classic.livesLost, 0, mission.id + ': decision space');
        const run = createRun(level, options),
          recorder = createRecorder(level, options),
          denominator = run.totalClaimable;
        let collected = false;
        for (let tick = 0; tick < 1200 && !run.claimedCount && run.status === 'running'; tick++) {
          const input = { direction: APEX_FIRST_RETURNS[mission.id] };
          recordInput(recorder, input);
          stepRun(run, input, FIXED_DT);
          collected ||= run.events.some((event) => event.type === 'powerup.collected');
          assert.equal(run.classic.livesLost, 0, mission.id + ': departure at ' + run.tick);
        }
        assert(run.claimedCount > 0, mission.id);
        assert.notEqual(run.status, 'won', mission.id + ': trivial first cut');
        assert.equal(run.totalClaimable, denominator);
        assert.equal(collected, false);
        assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
      }
    });
