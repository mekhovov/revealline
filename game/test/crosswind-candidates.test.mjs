import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import {
  createCrosswindCandidates,
  CROSSWIND_ARCS,
  CROSSWIND_FIRST_RETURNS,
  CROSSWIND_REFERENCE_ADAPTATIONS,
} from '../content-design/crosswind-candidates.mjs';
import { createRelayCandidates } from '../content-design/relay-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { resolveContentJourney } from '../content-design/journey.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';
import { directionalView } from '../ui/directional-view.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplay } from '../replay.mjs';

const source = createCrosswindCandidates(),
  project = compileContentProject(source);

test('Crosswind begins at the prior band and adds one shared rule over two distinct arcs', () => {
  assert.equal(
    source.missions[0].design.difficulty.band,
    createRelayCandidates().missions.at(-2).design.difficulty.band,
  );
  assert.deepEqual(
    CROSSWIND_ARCS.map((arc) => arc.missionIds.length),
    [3, 3],
  );
  assert.deepEqual(
    CROSSWIND_ARCS.map((arc) => arc.introduces),
    ['directional-speed-fields', null],
  );
  const identities = new Set();
  let band = 10;
  for (const [index, mission] of source.missions.entries()) {
    assert.deepEqual(mission.design.introduces, index ? [] : ['directional-speed-fields']);
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
      assert.equal(solo.level.version, 'xonix-level.v7');
      assert(!solo.officialProgressEligible);
      assert(
        !solo.diagnostics.some(
          (d) => d.severity === 'error' || /auto-fill|blocked-relay/.test(d.code),
        ),
        mission.id,
      );
      assert(solo.level.directionalFields.zones.length >= 2);
    }
  }
  assert.equal(identities.size, 7);
  assert.equal(
    resolveContentJourney(project, { packIds: ['journey-crosswind'] }).missions.length,
    6,
  );
  assert.throws(() => resolveContentJourney(project, { mode: 'team' }), /no missions/);
});

test('all initial field components are retained by actual actors rather than arrows or empty geometry', () => {
  for (const mission of source.missions) {
    const run = createRun(resolveMission(project, mission.id).level),
      capture = inspectCaptureSnapshot(run);
    assert.equal(capture.filledCells.length, 0, mission.id);
    assert(
      capture.components.every((component) => component.retained),
      mission.id,
    );
    const anchors = new Set(capture.components.flatMap((component) => component.enemyIds));
    for (const actor of mission.actors)
      assert.equal(
        anchors.has(actor.id),
        ['field-keeper', 'lane-emitter', 'territory-eroder'].includes(actor.role),
        `${mission.id}/${actor.id}`,
      );
  }
});

for (const difficulty of ['gentle', 'standard', 'expert'])
  for (const turnPolicy of ['immediate', 'grid-center'])
    test(`${difficulty}/${turnPolicy}: safe decision space and a real first return neutralize marked field`, () => {
      for (const mission of source.missions) {
        const level = resolveMission(project, mission.id, { difficulty }).level,
          options = { seed: 1, classId: 'scout', turnPolicy },
          idle = createRun(level, options);
        for (let tick = 0; tick < 600; tick++) stepRun(idle, { direction: null }, FIXED_DT);
        assert.equal(idle.classic.livesLost, 0, `${mission.id}: decision space`);
        const run = createRun(level, options),
          recorder = createRecorder(level, options),
          denominator = run.totalClaimable,
          marked = directionalView(run).cells.length;
        for (let tick = 0; tick < 1200 && !run.claimedCount && run.status === 'running'; tick++) {
          const input = { direction: CROSSWIND_FIRST_RETURNS[mission.id] };
          recordInput(recorder, input);
          stepRun(run, input, FIXED_DT);
          assert.equal(run.classic.livesLost, 0, `${mission.id}: departure at ${run.tick}`);
        }
        assert(run.claimedCount > 0, mission.id);
        assert.notEqual(run.status, 'won', `${mission.id}: trivial first-cut clear`);
        assert.equal(run.totalClaimable, denominator);
        assert(
          directionalView(run).cells.length < marked,
          `${mission.id}: first closure must teach neutralization`,
        );
        assert.equal(verifyReplay(exportReplay(recorder, run)).match, true, mission.id);
      }
    });

test('all five reference motifs have explicit non-final dispositions and shared preview geometry', async () => {
  const ledger = JSON.parse(
    await readFile(new URL('../../docs/research/xposed-journey-ledger.json', import.meta.url)),
  );
  assert.deepEqual(
    CROSSWIND_REFERENCE_ADAPTATIONS.map((row) => row.reference).sort(),
    ledger.references
      .filter((row) => row.proposal?.campaign === 'Crosswind Array')
      .map((row) => row.designKey)
      .sort(),
  );
  assert(CROSSWIND_REFERENCE_ADAPTATIONS.every((row) => row.decision === 'redesign' && !row.final));
  for (const mission of source.missions) {
    const preview = prepareContentPreview(source, mission.id);
    assert.deepEqual(preview.manifest.level, resolveMission(project, mission.id).level);
    assert.equal(preview.scenario, null);
    assert(preview.capture.components.every((component) => component.retained));
  }
});

test('CLI and Studio preserve the same directional manifest without public enrollment', async () => {
  const theme = JSON.parse(
    await readFile(new URL('../content-design/themes.json', import.meta.url)),
  ).themes.find((theme) => theme.id === 'horizon');
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    const preview = prepareContentPreview(source, 'read-the-arrows', { theme, difficulty });
    const cli = spawnSync(
      process.execPath,
      [
        new URL('../../scripts/compile-content-project.mjs', import.meta.url).pathname,
        '-',
        '--mission',
        'read-the-arrows',
        '--difficulty',
        difficulty,
      ],
      { input: JSON.stringify(source), encoding: 'utf8' },
    );
    assert.equal(cli.status, 0, cli.stderr);
    assert.deepEqual(JSON.parse(cli.stdout), preview.manifest);
    assert.equal(preview.scenario.format, 'xonix-playground.v8');
    assert.equal(preview.manifest.officialProgressEligible, false);
  }
});
