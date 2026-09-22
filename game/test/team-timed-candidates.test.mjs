import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTeamTimedCandidates } from '../content-design/team-timed-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { createCoop, startCoop, stepCoop } from '../coop/core.mjs';
import { assessTeamTimedRoute } from './helpers/team-timed-route.mjs';

const source = createTeamTimedCandidates(),
  before = structuredClone(source),
  project = compileContentProject(source);
const evidence = JSON.parse(
  await readFile(new URL('./fixtures/team-timed-routes.json', import.meta.url)),
);
const themes = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url)),
).themes;
const summary = (r) => ({
  status: r.status,
  tick: r.tick,
  coverage: r.coverage,
  returns: r.returns,
  collected: r.collected.map((e) => e.kind),
  activated: r.activated,
  neutralized: r.neutralized,
  checkpoint: r.checkpoint,
});
const manifests = new Map();

test('three original Team greyboxes use shared pressure, controls, finite optional windows and no publication', () => {
  assert.equal(evidence.format, 'TeamTimedRouteEvidenceV1');
  assert.equal(evidence.rows.length, 18);
  assert.deepEqual(
    evidence.rows.map((r) => `${r.missionId}/${r.difficulty}/${r.kind}`).sort(),
    ['window-exchange', 'coolant-crossing', 'depot-dash']
      .flatMap((id) =>
        ['gentle', 'standard', 'expert'].flatMap((preset) =>
          ['pickup-free', 'taking'].map((kind) => `${id}/${preset}/${kind}`),
        ),
      )
      .sort(),
  );
  const optionKey = ({ seed, delayTicks, swapped, jointCuts }) =>
    `${seed}/${delayTicks}/${swapped}/${jointCuts}`;
  const expectedOptions = [
    '1/0/false/false',
    '1/0/false/true',
    '1/0/true/false',
    '1/0/true/true',
    '1/30/false/true',
    '2/30/false/true',
  ].sort();
  for (const row of evidence.rows)
    assert.deepEqual(row.checks.map((c) => optionKey(c.options)).sort(), expectedOptions);
  assert.equal(project.difficulty.id, 'journey-difficulty-v2');
  assert.equal(
    new Set(source.maps.map((m) => JSON.stringify([m.walls, m.foundations, m.terrain]))).size,
    3,
  );
  assert.deepEqual(
    source.missions.map((m) => m.design.difficulty.band),
    [4, 5, 6],
  );
  assert(
    source.missions.every(
      (m) =>
        m.timeLimitSeconds === 0 &&
        m.objectives.length === 0 &&
        m.presentation.backgroundAssetId === null,
    ),
  );
  assert.deepEqual(
    [
      ...new Set(source.missions.flatMap((m) => m.timedBonuses.schedules.map((s) => s.kind))),
    ].sort(),
    ['enemy-freeze', 'enemy-slow', 'extra-life', 'player-speed'],
  );
  assert(
    source.missions.every((m) =>
      m.timedBonuses.schedules.every((s) => s.maxCollections === 1 && s.maxAppearances === 3),
    ),
  );
  assert.deepEqual(createTeamTimedCandidates(), source);
  assert(source.missions.every((m) => themes.some((theme) => theme.id === m.presentation.themeId)));
});

for (const mission of source.missions)
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    const manifest = resolveMission(project, mission.id, { mode: 'team', difficulty });
    manifests.set(`${mission.id}/${difficulty}`, manifest);
    test(`${mission.id}/${difficulty}: exact compiled Team edition and topology`, () => {
      assert.equal(manifest.level.version, 'revealline-coop-level.v5');
      assert.equal(manifest.officialProgressEligible, false);
      assert.equal(manifest.level.rules.moveSpeed, 10);
      assert.equal(manifest.diagnostics.filter((d) => d.severity === 'error').length, 0);
      const expected = 3.2 * { gentle: 1, standard: 1.4, expert: 1.75 }[difficulty];
      for (const keeper of manifest.level.enemies.filter((e) => e.type === 'drifter'))
        assert(Math.abs(Math.hypot(keeper.vx, keeper.vy) - expected) < 1e-10);
      const pack = createTeamTestPack(source, mission.id, difficulty);
      assert.deepEqual(pack.levels, [manifest.level]);
      assert.equal(pack.ruleset, 'revealline-coop.v7');
    });
    for (const seed of [1, 2])
      test(`${mission.id}/${difficulty}/seed${seed}: both first-window alternatives materialize without unavoidable opening damage`, () => {
        const run = startCoop(createCoop(manifest.level, { seed })),
          events = [];
        for (let tick = 0; tick < 500; tick++) {
          stepCoop(
            run,
            [0, 1].map(() => ({ direction: null, boost: false, support: false })),
          );
          events.push(...structuredClone(run.events));
        }
        const announced = events.find((e) => e.type === 'bonus.announced'),
          appeared = events.find((e) => e.type === 'bonus.appeared');
        assert(announced && appeared);
        assert.equal(appeared.tick - announced.tick, 120);
        assert.deepEqual([appeared.x, appeared.y], [announced.x, announced.y]);
        assert(!events.some((e) => ['bonus.cancelled', 'player.downed'].includes(e.type)));
      });
  }

for (const row of evidence.rows)
  for (const check of row.checks) {
    const { seed, delayTicks, swapped, jointCuts } = check.options;
    test(`${row.missionId}/${row.difficulty}/${row.kind}/seed${seed}/delay${delayTicks}/swap${swapped}/joint${jointCuts}: recorded public outcome`, () => {
      const manifest = manifests.get(`${row.missionId}/${row.difficulty}`);
      assert.equal(manifest.simulationIdentity, row.simulationIdentity);
      const actual = assessTeamTimedRoute(manifest.level, row.log, check.options);
      assert.deepEqual(summary(actual), check.result);
      assert.deepEqual(
        summary(assessTeamTimedRoute(manifest.level, row.log, check.options)),
        check.result,
      );
      if (delayTicks === 0) {
        assert.equal(actual.status, 'shared-no-loss-clear');
        assert(actual.returns.every((n) => n >= 2));
        assert.equal(actual.firstDown, null);
        assert.equal(actual.collected.length, row.kind === 'taking' ? 1 : 0);
        if (row.kind === 'taking') {
          const collection = actual.collected[0],
            collector = collection.players[0],
            partner = 1 - collector;
          assert.equal(collection.partnerCutting, true);
          assert(Number.isFinite(collection.x) && Number.isFinite(collection.y));
          if (row.missionId === 'window-exchange')
            assert(
              actual.closures.some(
                (c) =>
                  c.reason === 'return' &&
                  c.player === partner &&
                  c.slow &&
                  c.tick > collection.tick &&
                  c.x < 35 !== collection.x < 35,
              ),
            );
          if (row.missionId === 'coolant-crossing')
            assert(
              actual.closures.some(
                (c) =>
                  c.player === partner &&
                  c.reason === 'return' &&
                  c.freeze &&
                  c.x >= 33 &&
                  c.x <= 39 &&
                  Math.abs(c.y - 15) < 1e-8,
              ),
            );
          if (row.missionId === 'depot-dash') {
            assert(
              actual.closures.some(
                (c) =>
                  c.player === collector &&
                  c.reason === 'return' &&
                  c.speed &&
                  c.x >= 30 &&
                  c.x <= 42 &&
                  Math.abs(c.y - 6) < 1e-8,
              ),
            );
            assert(
              actual.closures.some(
                (c) =>
                  c.reason === 'return' &&
                  c.player === partner &&
                  c.x >= 30 &&
                  c.x <= 42 &&
                  Math.abs(c.y - 33) < 1e-8,
              ),
            );
          }
          const count = row.missionId === 'coolant-crossing' ? 8 : 7;
          const opening = assessTeamTimedRoute(
            manifest.level,
            row.log.slice(0, count),
            check.options,
          );
          assert.equal(
            opening.bothIdleTicks,
            0,
            'The authored collection sequence cannot require joint idle waiting.',
          );
        }
      }
      assert.deepEqual(source, before);
    });
  }

for (const difficulty of ['gentle', 'standard', 'expert'])
  for (const swapped of [false, true])
    test(`Depot/${difficulty}/swap${swapped}: rejected full-height shortcut stays rejected`, () => {
      const route = [
        ['up', 'up', 198],
        ['down', 'down', 408],
        ['right', 'left', 120],
        ['up', 'up', 408],
        ['right', 'left', 72],
        ['down', 'down', 408],
      ].map(([a, b, ticks]) => ({ a, b, ticks }));
      const result = assessTeamTimedRoute(manifests.get(`depot-dash/${difficulty}`).level, route, {
        swapped,
      });
      assert.notEqual(result.status, 'shared-no-loss-clear');
      assert(result.coverage < 0.78);
    });

test('route evidence refuses an artificial neutral brake before executing it', () => {
  const level = manifests.get('window-exchange/standard').level;
  const result = assessTeamTimedRoute(level, [
    { a: 'up', b: null, ticks: 1 },
    { a: null, b: null, ticks: 1 },
  ]);
  assert.equal(result.status, 'artificial-neutral-brake');
  assert.equal(result.tick, 1);
  assert.throws(() => assessTeamTimedRoute(level, [{ a: 'teleport', b: null, ticks: 1 }]));
});
