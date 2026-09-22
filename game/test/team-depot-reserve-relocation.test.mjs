import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTeamDepotSpatialCandidates } from '../content-design/team-depot-spatial-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { assessTeamTimedRoute } from './helpers/team-timed-route.mjs';
import { page } from './helpers/coop-host.mjs';

const evidence = JSON.parse(
  await readFile(new URL('./fixtures/team-depot-reserve-relocation.json', import.meta.url)),
);
const source = createTeamDepotSpatialCandidates(),
  project = compileContentProject(source);
const summary = (r) =>
  Object.fromEntries(
    [
      'status',
      'tick',
      'coverage',
      'returns',
      'firstDown',
      'collected',
      'activated',
      'initialReserves',
      'finalReserves',
      'bothIdleTicks',
      'longestJointIdleTicks',
      'checkpoint',
    ].map((k) => [k, r[k]]),
  );
const resolve = (difficulty) => resolveMission(project, 'depot-dash', { mode: 'team', difficulty });

test('relocated reserve evidence inventories all presets and both seats/joint options', () => {
  assert.equal(evidence.format, 'TeamDepotReserveRelocationEvidenceV1');
  assert.equal(evidence.sourceRevision, source.revision);
  assert.deepEqual(
    evidence.rows.map((r) => r.difficulty),
    ['gentle', 'standard', 'expert'],
  );
  for (const row of evidence.rows) {
    assert(row.log.every((s) => s.a !== null || s.b !== null));
    assert.deepEqual(
      row.checks.map((c) => c.options),
      [false, true].flatMap((swapped) =>
        [false, true].map((jointCuts) => ({ seed: 17, delayTicks: 1, swapped, jointCuts })),
      ),
    );
  }
});

for (const row of evidence.rows) {
  for (const check of row.checks)
    test(`${row.difficulty}: relocated reserve while partner cuts ${JSON.stringify(check.options)}`, () => {
      const manifest = resolve(row.difficulty);
      assert.equal(manifest.simulationIdentity, row.simulationIdentity);
      const result = assessTeamTimedRoute(manifest.level, row.log, {
        ...check.options,
        observeBonusWindows: true,
      });
      assert.deepEqual(summary(result), check.result);
      assert.equal(result.status, 'shared-no-loss-clear');
      assert.equal(result.firstDown, null);
      assert.equal(result.finalReserves, result.initialReserves + 1);
      assert(result.longestJointIdleTicks <= 6);
      assert.deepEqual(
        result.activated,
        ['east-rover'],
        'Concurrent collection is not both-rover mastery',
      );
      const windows = result.bonusWindows.filter((e) => e.id === 'depot-reserve');
      assert.deepEqual(
        windows.map((e) => [e.type, e.tick, e.x, e.y]),
        [
          ['bonus.announced', 839, 19.5, 28.5],
          ['bonus.appeared', 959, 19.5, 28.5],
          ['bonus.expired', 2159, 19.5, 28.5],
          ['bonus.announced', 3119, 52.5, 7.5],
          ['bonus.appeared', 3239, 52.5, 7.5],
        ],
      );
      assert(windows[2].coverageBefore > windows[1].coverageAfter + 0.3);
      assert(windows[4].coverageBefore > windows[2].coverageAfter);
      assert.equal(result.collected.length, 2);
      const item = result.collected[1],
        collector = check.options.swapped ? 1 : 0;
      assert.deepEqual(
        [
          item.id,
          item.kind,
          item.tick,
          item.x,
          item.y,
          item.gain,
          item.reclaimedBeforeContactStep,
          item.partnerCutting,
          item.players,
        ],
        ['depot-reserve', 'extra-life', 3396, 52.5, 7.5, 1, false, true, [collector]],
      );
      assert(result.cutStarts.some((e) => e.player === 1 - collector && e.tick === 3330));
      for (const [tick, player] of [
        [3458, collector],
        [3525, 1 - collector],
      ]) {
        const bank = result.closures.find((e) => e.tick === tick);
        assert.equal(bank.player, player);
        assert.equal(bank.reason, 'return');
        assert(bank.coverage < 0.6, 'Contact is followed by meaningful unfinished territory');
      }
      assert(result.closures.some((e) => e.tick > 3525));
      assert(result.returns.every((n) => n >= 5));
    });

  test(`${row.difficulty}: actual keyboard host grants one reserve and completes`, async (t) => {
    const f = await page(t, { nativeFocus: true, nativeVisibility: true });
    await f.selectFile(JSON.stringify(createTeamTestPack(source, 'depot-dash', row.difficulty)));
    assert.equal(f.$('coop-pack-status').dataset.state, 'ready');
    f.$('coop-start').focus();
    f.tap('Enter');
    f.tick(2);
    const expected = row.checks.find((c) => !c.options.swapped && c.options.jointCuts).result;
    const keys = [
      { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' },
      { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
    ];
    let previous = [null, null],
      frames = 1;
    for (const s of row.log) {
      for (const [seat, direction] of [s.a, s.b].entries())
        if (direction && direction !== previous[seat]) f.tap(keys[seat][direction]);
      previous = [s.a, s.b];
      for (let n = 0; n < s.ticks && f.$('coop-overlay').hidden; n++) {
        f.tick();
        frames++;
        const reserves = expected.initialReserves + Number(frames >= 3397);
        assert.equal(
          f.$('coop-reserves').textContent,
          `${reserves} reserve${reserves === 1 ? '' : 's'}`,
        );
      }
      if (!f.$('coop-overlay').hidden) break;
    }
    assert.equal(f.$('coop-overlay-kicker').textContent, 'A WORLD YOU REVEALED TOGETHER');
    assert.equal(frames, expected.tick);
    assert.equal(f.$('coop-coverage').textContent, `${(expected.coverage * 100).toFixed(1)}%`);
    assert.deepEqual(f.visits, []);
  });
}

test('Standard finish is not advertised as a universal safe tail', () => {
  const log = evidence.rows.find((r) => r.difficulty === 'standard').log;
  for (const [difficulty, tick] of [
    ['gentle', 3835],
    ['expert', 3767],
  ]) {
    const result = assessTeamTimedRoute(resolve(difficulty).level, log, {
      seed: 17,
      delayTicks: 1,
    });
    assert.equal(result.status, 'first-knockdown');
    assert.equal(result.tick, tick);
    assert.equal(result.firstDown.cause, 'enemy-trail');
    assert.equal(result.firstDown.enemy, 'south-keeper');
    assert.equal(result.collected[1].partnerCutting, true);
  }
});
