import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTeamJourneyCandidates } from '../content-design/team-journey-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { withPressureDifficulty } from '../content-design/pressure-candidates.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { readCoopPack } from '../coop/library.mjs';
import {
  assessTeamPressureRoute,
  teamRouteTemplates,
} from '../../scripts/lib/team-pressure-assessment.mjs';

const source = createTeamJourneyCandidates(),
  before = structuredClone(source);
const nextSource = withPressureDifficulty(source),
  project = compileContentProject(nextSource);
const historical = compileContentProject(source);
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/team-pressure-assessment.json', import.meta.url)),
);
const templates = [];
for (const name of ['opening', 'foundation', 'material', 'roamer']) {
  const data = JSON.parse(
    await readFile(new URL(`./fixtures/team-${name}-routes.json`, import.meta.url)),
  );
  for (const kind of name === 'foundation' ? ['clear', 'mastery'] : ['routes'])
    for (const row of data[kind])
      templates.push({ id: `${name}/${kind}/${row.missionId}/${row.difficulty}`, ...row });
}

test('assessment covers every mission/preset without claiming unresolved paths impossible', () => {
  assert.equal(fixture.format, 'TeamPressureAssessmentV1');
  assert.equal(fixture.rows.length, 36);
  assert.equal(new Set(fixture.rows.map((r) => `${r.missionId}/${r.difficulty}`)).size, 36);
  for (const mission of project.missions)
    for (const difficulty of ['gentle', 'standard', 'expert'])
      assert(fixture.rows.some((r) => r.missionId === mission.id && r.difficulty === difficulty));
  assert.equal(fixture.rows.filter((r) => r.selected).length, 13);
  assert.equal(fixture.rows.filter((r) => !r.selected).length, 23);
  assert.equal(fixture.rows.flatMap((r) => r.timingProbe?.outcomes ?? []).length, 48);
  assert.deepEqual(source, before);
  assert.deepEqual(nextSource.maps, source.maps);
  assert.equal(nextSource.campaigns.length, 5);
  assert.equal(nextSource.packs.length, 5);
});

for (const row of fixture.rows) {
  const manifest = resolveMission(project, row.missionId, {
    mode: 'team',
    difficulty: row.difficulty,
  });
  test(`${row.missionId}/${row.difficulty}: exact candidate export/import retains stronger speed and old identity separation`, () => {
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    assert.equal(manifest.officialProgressEligible, false);
    assert.notEqual(
      manifest.simulationIdentity,
      resolveMission(historical, row.missionId, { mode: 'team', difficulty: row.difficulty })
        .simulationIdentity,
    );
    const pack = createTeamTestPack(nextSource, row.missionId, row.difficulty);
    assert.deepEqual(pack.levels, [manifest.level]);
    assert.deepEqual(readCoopPack(JSON.stringify(pack)), pack);
    assert.equal(manifest.level.rules.moveSpeed, 10);
    for (const actor of manifest.level.enemies) {
      const expected =
        (actor.type === 'claimed-rover' ? 1.6 : 2.4) *
        { gentle: 1, standard: 1.4, expert: 1.75 }[row.difficulty];
      assert(Math.abs(Math.hypot(actor.vx, actor.vy) - expected) < 1e-9);
    }
  });
  for (const kind of ['selected', 'lastFailure', 'timingProbe']) {
    const trial = row[kind];
    if (!trial) continue;
    test(`${row.missionId}/${row.difficulty}: ${kind} public commands reproduce every pinned outcome`, () => {
      const template = templates.find((t) => t.id === trial.templateId);
      assert(template);
      assert.equal(template.missionId, row.missionId);
      const savedLevel = structuredClone(manifest.level),
        savedInputs = structuredClone(template.log);
      if (kind === 'selected' || kind === 'timingProbe')
        assert.deepEqual(trial.outcomes.map((r) => `${r.jointCuts}/${r.swapped}`).sort(), [
          'false/false',
          'false/true',
          'true/false',
          'true/true',
        ]);
      for (const { jointCuts, swapped, ...expected } of trial.outcomes) {
        const options = { jointCuts, swapped, delayTicks: trial.delayTicks };
        const result = assessTeamPressureRoute(manifest.level, template.log, options);
        assert.deepEqual(result, expected);
        assert.deepEqual(assessTeamPressureRoute(manifest.level, template.log, options), result);
        if (kind === 'selected') {
          assert.equal(result.status, 'shared-no-loss-clear');
          assert.equal(result.firstDown, null);
          assert(result.closures.every((count) => count > 0));
          assert.equal(result.reserves, { gentle: 4, standard: 2, expert: 1 }[row.difficulty]);
          assert.deepEqual(result.supportUses, [0, 0]);
        }
        if (!jointCuts) assert.equal(result.jointEvents, 0);
      }
      assert.deepEqual(manifest.level, savedLevel);
      assert.deepEqual(template.log, savedInputs);
    });
  }
}

test('observer rejects unbounded inputs and reports artificial braking without applying it', () => {
  const level = resolveMission(project, 'twin-landings', { mode: 'team' }).level;
  const log = [
    { a: 'left', b: 'right', ticks: 3 },
    { a: null, b: null, ticks: 1 },
  ];
  const result = assessTeamPressureRoute(level, log);
  assert.equal(result.status, 'continuous-input-mismatch');
  assert.equal(result.tick, 3);
  for (const bad of [
    null,
    [],
    [{ a: 'sideways', b: null, ticks: 1 }],
    [{ a: null, b: null, ticks: 0 }],
    [{ a: null, b: null, ticks: 10001 }],
    Array(4).fill({ a: null, b: null, ticks: 10000 }),
  ])
    assert.throws(() => assessTeamPressureRoute(level, bad), /bounded/);
  for (const options of [
    { delayTicks: -1 },
    { delayTicks: 1201 },
    { delayTicks: 0.5 },
    { jointCuts: 1 },
    { swapped: 'false' },
  ])
    assert.throws(() => assessTeamPressureRoute(level, log, options));
  assert.throws(() => teamRouteTemplates(templates, 'twin-landings', 'random'));
  assert.equal(teamRouteTemplates(templates, 'divided-workshop', 'expert')[0].difficulty, 'expert');
});
