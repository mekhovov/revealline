import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTeamTimedCandidates } from '../content-design/team-timed-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { FIELD } from '../coop/core.mjs';
import { assessTeamTimedRoute } from './helpers/team-timed-route.mjs';
import { page } from './helpers/coop-host.mjs';

const evidence = JSON.parse(
  await readFile(new URL('./fixtures/team-coolant-relocation.json', import.meta.url)),
);
const source = createTeamTimedCandidates(),
  project = compileContentProject(source);
const summary = (r) => ({
  status: r.status,
  tick: r.tick,
  coverage: r.coverage,
  returns: r.returns,
  firstDown: r.firstDown,
  collected: r.collected,
  initialReserves: r.initialReserves,
  finalReserves: r.finalReserves,
  bothIdleTicks: r.bothIdleTicks,
  longestJointIdleTicks: r.longestJointIdleTicks,
  checkpoint: r.checkpoint,
});
const keys = [
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' },
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
];

test('Coolant recovery inventory covers every preset and seat/joint configuration without changing its edition', () => {
  assert.equal(evidence.format, 'TeamCoolantRelocationEvidenceV1');
  assert.equal(evidence.missionId, 'coolant-crossing');
  assert.deepEqual(
    evidence.rows.map((r) => r.difficulty),
    ['gentle', 'standard', 'expert'],
  );
  for (const row of evidence.rows) {
    assert.deepEqual(
      row.checks.map((c) => c.options),
      [false, true].flatMap((swapped) =>
        [false, true].map((jointCuts) => ({
          seed: 17,
          delayTicks: 1,
          swapped,
          jointCuts,
          observeBonusWindows: true,
        })),
      ),
    );
    assert(
      row.log.every((segment) => segment.a !== null || segment.b !== null),
      'No parked waiting segment',
    );
  }
});

for (const row of evidence.rows) {
  const manifest = resolveMission(project, evidence.missionId, {
    mode: 'team',
    difficulty: row.difficulty,
  });
  for (const check of row.checks)
    test(`${row.difficulty}/swap${check.options.swapped}/joint${check.options.jointCuts}: real expiry, relocated contact and return`, () => {
      assert.equal(manifest.simulationIdentity, row.simulationIdentity);
      const r = assessTeamTimedRoute(manifest.level, row.log, check.options);
      assert.deepEqual(summary(r), check.result);
      assert.deepEqual(r.bonusWindows, row.bonusWindows);
      assert.equal(
        r.checkpoint,
        assessTeamTimedRoute(manifest.level, row.log, {
          ...check.options,
          observeBonusWindows: false,
        }).checkpoint,
        'Read-only observations cannot alter simulation or event history',
      );
      assert.equal(r.status, 'shared-no-loss-clear');
      assert.equal(r.firstDown, null);
      assert(r.returns.every((n) => n >= 3));
      assert.equal(r.initialReserves, r.finalReserves);
      assert(r.bothIdleTicks <= 30);
      assert.equal(r.longestJointIdleTicks, 6);
      assert.deepEqual(
        r.bonusWindows.map((e) => [e.type, e.tick, e.x, e.y]),
        [
          ['bonus.announced', 359, 54.5, 29.5],
          ['bonus.appeared', 479, 54.5, 29.5],
          ['bonus.expired', 1679, 54.5, 29.5],
          ['bonus.announced', 2639, 17.5, 6.5],
          ['bonus.appeared', 2759, 17.5, 6.5],
        ],
      );
      const [announce, first, expiry, again, second] = r.bonusWindows;
      assert.equal(first.tick - announce.tick, 120);
      assert.equal(expiry.tick - first.tick, 1200);
      assert.equal(again.tick - expiry.tick, 960);
      assert.equal(second.tick - again.tick, 120);
      for (const event of [again, second])
        assert.deepEqual([event.anchorBefore, event.anchorAfter], [FIELD, FIELD]);
      assert(
        expiry.coverageBefore - first.coverageAfter > 0.25,
        'First window contains meaningful earned territory',
      );
      assert(
        second.coverageBefore - expiry.coverageAfter > 0.09,
        'Recovery through the next appearance contains real additional captures',
      );
      assert(
        r.closures.some(
          (c) => c.reason === 'return' && c.tick > first.tick && c.tick <= expiry.tick,
        ),
      );
      assert(
        r.closures.some(
          (c) => c.reason === 'return' && c.tick > expiry.tick && c.tick <= second.tick,
        ),
      );
      assert.equal(r.collected.length, 1);
      const item = r.collected[0];
      assert.deepEqual(
        [item.id, item.kind, item.x, item.y],
        ['coolant-freeze', 'enemy-freeze', 17.5, 6.5],
      );
      assert(item.tick > second.tick && item.tick < second.tick + 1200);
      assert.equal(
        item.partnerCutting,
        false,
        'This is recovery feasibility, not cooperation mastery',
      );
      assert.equal(item.reclaimedBeforeContactStep, row.difficulty === 'expert');
      assert.equal(item.activationTick, item.tick + 1);
      assert.equal(item.untilTick - item.activationTick, 360);
      assert(
        r.closures.some(
          (c) =>
            c.player === item.players[0] && c.reason === 'return' && c.tick > item.tick && c.freeze,
        ),
      );
    });

  test(`${row.difficulty}: actual keyboard host misses the first freeze, collects the second and clears`, async (t) => {
    const f = await page(t, { nativeFocus: true, nativeVisibility: true });
    await f.selectFile(
      JSON.stringify(createTeamTestPack(source, evidence.missionId, row.difficulty)),
    );
    assert.equal(f.$('coop-pack-status').dataset.state, 'ready');
    assert.equal(f.$('coop-difficulty').value, row.difficulty);
    f.$('coop-start').focus();
    f.tap('Enter');
    f.tick(2);
    const expected = row.checks.find((c) => !c.options.swapped && c.options.jointCuts).result;
    let frames = 1,
      previous = [null, null],
      firstEffect = null;
    const transitions = [];
    for (const segment of row.log) {
      for (const [seat, direction] of [segment.a, segment.b].entries())
        if (direction && direction !== previous[seat]) f.tap(keys[seat][direction]);
      previous = [segment.a, segment.b];
      for (let n = 0; n < segment.ticks && f.$('coop-overlay').hidden; n++) {
        f.tick();
        frames++;
        const live = f.$('coop-bonus-live').textContent;
        const phase = /^Enemies frozen \d+s$/.test(live) ? 'effect' : live;
        if (transitions.at(-1)?.phase !== phase) transitions.push({ frame: frames, phase });
        if (firstEffect === null && phase === 'effect') {
          firstEffect = frames;
          assert.match(
            f.$('coop-message').textContent,
            new RegExp(
              `^${['Sunflower', 'Skyline'][expected.collected[0].players[0]]} collected enemies frozen\\.`,
            ),
          );
        }
        assert.equal(
          f.$('coop-reserves').textContent,
          `${expected.initialReserves} reserve${expected.initialReserves === 1 ? '' : 's'}`,
        );
      }
      if (!f.$('coop-overlay').hidden) break;
    }
    t.diagnostic(
      JSON.stringify({
        frames,
        coverage: f.$('coop-coverage').textContent,
        firstEffect,
        transitions,
      }),
    );
    assert.equal(f.$('coop-overlay-kicker').textContent, 'A WORLD YOU REVEALED TOGETHER');
    assert.equal(frames, expected.tick);
    assert.equal(f.$('coop-coverage').textContent, `${(expected.coverage * 100).toFixed(1)}%`);
    assert.deepEqual(transitions, [
      { frame: 2, phase: '' },
      { frame: 360, phase: 'Pickup incoming' },
      { frame: 480, phase: '1 timed pickup available' },
      { frame: 1680, phase: '' },
      { frame: 2640, phase: 'Pickup incoming' },
      { frame: 2760, phase: '1 timed pickup available' },
      { frame: expected.collected[0].activationTick, phase: 'effect' },
      { frame: expected.collected[0].untilTick, phase: '' },
    ]);
    assert.equal(firstEffect, expected.collected[0].activationTick);
    assert.deepEqual(f.visits, []);
  });
}
