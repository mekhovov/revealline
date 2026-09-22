import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import {
  createRelayCandidates,
  RELAY_ARCS,
  RELAY_FIRST_RETURNS,
  RELAY_REFERENCE_ADAPTATIONS,
} from '../content-design/relay-candidates.mjs';
import { createLivewireCandidates } from '../content-design/livewire-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { resolveContentJourney } from '../content-design/journey.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplay } from '../replay.mjs';

const source = createRelayCandidates(),
  project = compileContentProject(source);

test('relay candidates introduce one rule over two arcs without a speed or campaign-band reset', () => {
  assert.equal(
    source.missions[0].design.difficulty.band,
    createLivewireCandidates().missions.at(-2).design.difficulty.band,
  );
  assert.deepEqual(
    RELAY_ARCS.map((arc) => arc.missionIds.length),
    [3, 3],
  );
  assert.deepEqual(
    RELAY_ARCS.map((arc) => arc.introduces),
    ['permanent-relay-connectors', null],
  );
  const identities = new Set();
  let band = 9;
  for (const [index, mission] of source.missions.entries()) {
    assert.deepEqual(mission.design.introduces, index ? [] : ['permanent-relay-connectors']);
    assert(mission.design.difficulty.band >= band);
    band = mission.design.difficulty.band;
    assert.equal(mission.timeLimitSeconds, 0);
    assert.equal(mission.presentation.backgroundAssetId, null);
    assert(mission.objectives.every((objective) => objective.required && !objective.hidden));
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
      assert.equal(solo.level.version, 'xonix-level.v6');
      assert(!solo.officialProgressEligible);
      assert(
        !solo.diagnostics.some(
          (diagnostic) =>
            diagnostic.severity === 'error' || /auto-fill|blocked-relay/.test(diagnostic.code),
        ),
        mission.id,
      );
      assert.equal(solo.level.relayGates.gates.length, mission.relayLinks.length);
    }
  }
  assert.equal(identities.size, 7);
  assert.equal(resolveContentJourney(project, { packIds: ['journey-relay'] }).missions.length, 6);
  assert.throws(() => resolveContentJourney(project, { mode: 'team' }), /no missions/);
});

test('every initial field region has a genuine retaining enemy, never a gate-only anchor', () => {
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
        ['field-keeper', 'lane-emitter', 'impact-carrier'].includes(actor.role),
        `${mission.id}/${actor.id}`,
      );
  }
});

for (const difficulty of ['gentle', 'standard', 'expert'])
  for (const turnPolicy of ['immediate', 'grid-center'])
    test(`${difficulty}/${turnPolicy}: initial decision space and legal first return actually open a useful link`, () => {
      for (const mission of source.missions) {
        const level = resolveMission(project, mission.id, { difficulty }).level;
        const options = { seed: 1, classId: 'scout', turnPolicy },
          idle = createRun(level, options);
        for (let tick = 0; tick < 600; tick++) stepRun(idle, { direction: null }, FIXED_DT);
        assert.equal(idle.classic.livesLost, 0, `${mission.id}: decision space`);
        const run = createRun(level, options),
          recorder = createRecorder(level, options),
          denominator = run.totalClaimable;
        for (let tick = 0; tick < 1200 && !run.claimedCount && run.status === 'running'; tick++) {
          const input = { direction: RELAY_FIRST_RETURNS[mission.id] };
          recordInput(recorder, input);
          stepRun(run, input, FIXED_DT);
          assert.equal(run.classic.livesLost, 0, `${mission.id}: departure at ${run.tick}`);
        }
        assert(run.claimedCount > 0, mission.id);
        assert.notEqual(run.status, 'won', `${mission.id}: trivial first-cut clear`);
        assert.equal(run.totalClaimable, denominator);
        assert(
          run.relay.gates.some((gate) => gate.openedTick !== null),
          `${mission.id}: trigger was not taught`,
        );
        assert.equal(verifyReplay(exportReplay(recorder, run)).match, true, mission.id);
      }
    });

test('all four assigned reference motifs remain non-final proposals and use the shared Studio compiler', async () => {
  const ledger = JSON.parse(
    await readFile(new URL('../../docs/research/xposed-journey-ledger.json', import.meta.url)),
  );
  assert.deepEqual(
    RELAY_REFERENCE_ADAPTATIONS.map((row) => row.reference).sort(),
    ledger.references
      .filter((row) => row.proposal?.campaign === 'Relay Labyrinth')
      .map((row) => row.designKey)
      .sort(),
  );
  assert(RELAY_REFERENCE_ADAPTATIONS.every((row) => row.decision === 'redesign' && !row.final));
  for (const mission of source.missions) {
    const preview = prepareContentPreview(source, mission.id);
    assert.deepEqual(preview.manifest.level, resolveMission(project, mission.id).level);
    assert.equal(preview.scenario, null);
    assert(preview.capture.components.every((component) => component.retained));
    assert(preview.markers.relayTriggers.every((trigger) => trigger.visible));
  }
});

test('CLI and Studio resolve identical relay manifests without enrolling a published Journey', async () => {
  const theme = JSON.parse(
    await readFile(new URL('../content-design/themes.json', import.meta.url)),
  ).themes.find((theme) => theme.id === 'horizon');
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    const preview = prepareContentPreview(source, 'first-link', { theme, difficulty });
    const cli = spawnSync(
      process.execPath,
      [
        new URL('../../scripts/compile-content-project.mjs', import.meta.url).pathname,
        '-',
        '--mission',
        'first-link',
        '--difficulty',
        difficulty,
      ],
      { input: JSON.stringify(source), encoding: 'utf8' },
    );
    assert.equal(cli.status, 0, cli.stderr);
    assert.deepEqual(JSON.parse(cli.stdout), preview.manifest);
    assert.equal(preview.scenario.format, 'xonix-playground.v7');
    assert.equal(preview.manifest.officialProgressEligible, false);
  }
});
