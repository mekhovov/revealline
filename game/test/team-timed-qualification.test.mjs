import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTeamTimedCandidates } from '../content-design/team-timed-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { assessTeamTimedRoute } from './helpers/team-timed-route.mjs';

const project = compileContentProject(createTeamTimedCandidates());
const evidence = JSON.parse(
  await readFile(new URL('./fixtures/team-timed-qualification.json', import.meta.url)),
);
const baseline = JSON.parse(
  await readFile(new URL('./fixtures/team-timed-routes.json', import.meta.url)),
);
const presets = ['gentle', 'standard', 'expert'];
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
const key = (r) => `${r.kind}/${r.missionId}/${r.difficulty}`;

test('qualification pins six mastery and nine alternate-taking families without replacing failed probes', () => {
  assert.equal(evidence.format, 'TeamTimedRouteQualificationV1');
  assert.equal(evidence.terminalActivationProbe.missionId, 'depot-dash');
  assert.equal(evidence.terminalActivationProbe.difficulty, 'expert');
  assert.deepEqual(
    evidence.terminalActivationProbe.checks.map((c) => JSON.stringify(c.options)),
    [false, true].flatMap((swapped) =>
      [false, true].map((jointCuts) =>
        JSON.stringify({ seed: 1, delayTicks: 0, swapped, jointCuts }),
      ),
    ),
  );
  const expected = [
    ...['coolant-crossing', 'depot-dash'].flatMap((id) => presets.map((d) => `mastery/${id}/${d}`)),
    ...['window-exchange', 'coolant-crossing', 'depot-dash'].flatMap((id) =>
      presets.map((d) => `alternate-taking/${id}/${d}`),
    ),
  ].sort();
  assert.deepEqual(evidence.rows.map(key).sort(), expected);
  for (const row of evidence.rows) {
    const seed = row.kind === 'mastery' ? 1 : 2,
      delay = row.kind === 'mastery' ? 0 : 30;
    assert.deepEqual(
      row.checks
        .map(
          (c) =>
            `${c.options.seed}/${c.options.delayTicks}/${c.options.swapped}/${c.options.jointCuts}`,
        )
        .sort(),
      [false, true].flatMap((s) => [false, true].map((j) => `${seed}/${delay}/${s}/${j}`)).sort(),
    );
    assert.equal(
      row.openingSegments,
      row.missionId === 'coolant-crossing' ? (row.kind === 'mastery' ? 8 : 9) : 7,
    );
  }
  assert.equal(
    baseline.rows.flatMap((r) => r.checks).filter((c) => c.result.status !== 'shared-no-loss-clear')
      .length,
    16,
  );
});

for (const row of evidence.rows)
  for (const check of row.checks) {
    const { swapped, jointCuts, delayTicks } = check.options;
    test(`${key(row)}/swap${swapped}/joint${jointCuts}: real collection, cooperative return and full clear`, () => {
      const manifest = resolveMission(project, row.missionId, {
        mode: 'team',
        difficulty: row.difficulty,
      });
      assert.equal(manifest.simulationIdentity, row.simulationIdentity);
      const actual = assessTeamTimedRoute(manifest.level, row.log, check.options);
      assert.deepEqual(summary(actual), check.result);
      assert.deepEqual(
        summary(assessTeamTimedRoute(manifest.level, row.log, check.options)),
        check.result,
      );
      assert.equal(actual.status, 'shared-no-loss-clear');
      assert.equal(actual.firstDown, null);
      assert(actual.returns.every((n) => n >= 2));
      assert(actual.simultaneousTicks > 0);
      assert.equal(actual.collected.length, 1);
      const item = actual.collected[0],
        collector = item.players[0],
        partner = 1 - collector;
      assert.equal(item.partnerCutting, true);
      assert.equal(
        item.kind,
        {
          'window-exchange': 'enemy-slow',
          'coolant-crossing': 'enemy-freeze',
          'depot-dash': 'player-speed',
        }[row.missionId],
      );
      if (row.kind === 'alternate-taking')
        assert.deepEqual(
          [item.x, item.y],
          {
            'window-exchange': [8.5, 8.5],
            'coolant-crossing': [54.5, 29.5],
            'depot-dash': [52.5, 29.5],
          }[row.missionId],
        );
      const closures = actual.closures.filter((c) => c.reason === 'return' && c.tick > item.tick);
      if (row.missionId === 'window-exchange')
        assert(closures.some((c) => c.player === partner && c.slow && c.x > 37));
      if (row.missionId === 'coolant-crossing') {
        assert(
          closures.some(
            (c) =>
              c.player === partner &&
              c.freeze &&
              c.x >= 33 - 1e-8 &&
              c.x <= 39 + 1e-8 &&
              c.y >= 15 - 1e-8 &&
              c.y <= 20 + 1e-8,
          ),
        );
        if (row.kind === 'mastery')
          assert.equal(
            actual.neutralized,
            true,
            'All three authored terrain beds must really be reclaimed.',
          );
      }
      if (row.missionId === 'depot-dash') {
        assert(
          closures.some(
            (c) =>
              c.player === collector &&
              c.speed &&
              c.x >= 30 &&
              c.x <= 42 &&
              Math.abs(c.y - (row.kind === 'mastery' ? 6 : 30)) < 1e-8,
          ),
        );
        assert(
          closures.some(
            (c) =>
              c.player === partner &&
              c.x >= 30 &&
              c.x <= 42 &&
              Math.abs(c.y - (row.kind === 'mastery' ? 33 : 3)) < 1e-8,
          ),
        );
        if (row.kind === 'mastery') {
          assert.deepEqual(actual.activated, ['east-rover', 'west-rover']);
          const bothActive = Math.max(...Object.values(actual.activatedAt));
          assert(
            actual.tick - bothActive >= 120,
            'Both roamers must be active for actual continuing play, not just the winning tick.',
          );
          assert(
            actual.cutStarts.some(
              (s) =>
                s.tick >= bothActive &&
                actual.closures.some(
                  (c) => c.player === s.player && c.reason === 'return' && c.tick > s.tick,
                ),
            ),
          );
        }
      }
      const opening = assessTeamTimedRoute(
        manifest.level,
        row.log.slice(0, row.openingSegments),
        check.options,
      );
      assert.equal(
        opening.bothIdleTicks,
        delayTicks,
        'Only the explicit delayed-start probe may contain joint idle ticks.',
      );
    });
  }

for (const row of baseline.rows.filter(
  (r) =>
    r.kind === 'taking' &&
    (r.missionId === 'coolant-crossing' ||
      (r.missionId === 'depot-dash' && r.difficulty !== 'standard')),
))
  test(`${row.missionId}/${row.difficulty}: earlier ordinary clear is not retroactively mastery`, () => {
    const manifest = resolveMission(project, row.missionId, {
      mode: 'team',
      difficulty: row.difficulty,
    });
    const r = assessTeamTimedRoute(manifest.level, row.log);
    assert.equal(r.status, 'shared-no-loss-clear');
    if (row.missionId === 'coolant-crossing') assert.equal(r.neutralized, false);
    else assert.equal(r.activated.length, 1);
  });

for (const check of evidence.terminalActivationProbe.checks)
  test(`terminal activation is not two-rover handling/swap${check.options.swapped}/joint${check.options.jointCuts}`, () => {
    const row = evidence.terminalActivationProbe;
    const manifest = resolveMission(project, row.missionId, {
      mode: 'team',
      difficulty: row.difficulty,
    });
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    const actual = assessTeamTimedRoute(manifest.level, row.log, check.options);
    assert.deepEqual(summary(actual), check.result);
    assert.equal(actual.status, 'shared-no-loss-clear');
    assert.deepEqual(actual.activated, ['east-rover', 'west-rover']);
    const bothActive = Math.max(...Object.values(actual.activatedAt));
    assert.equal(bothActive, actual.tick);
    assert(!actual.cutStarts.some((s) => s.tick >= bothActive));
  });
