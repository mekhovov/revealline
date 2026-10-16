import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTeamDepotSpatialCandidates } from '../content-design/team-depot-spatial-candidates.mjs';
import { createTeamWindowSpatialCandidates } from '../content-design/team-window-spatial-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { assessTeamTimedRoute } from './helpers/team-timed-route.mjs';
import { page } from './helpers/coop-host.mjs';
import {
  playSpecializedTeamRoute,
  playSpecializedTeamBonusRoute,
} from './helpers/team-specialized-host-route.mjs';
import { createCoop, startCoop, stepCoop } from '../coop/core.mjs';

const evidence = JSON.parse(
  await readFile(new URL('./fixtures/team-depot-spatial-routes.json', import.meta.url)),
);
const source = createTeamDepotSpatialCandidates(),
  old = createTeamWindowSpatialCandidates();
const project = compileContentProject(source),
  baseline = compileContentProject(old);
const presets = ['gentle', 'standard', 'expert'];
const resolve = (p, difficulty, id = 'depot-dash') =>
  resolveMission(p, id, { mode: 'team', difficulty });
const summary = (r) => ({
  status: r.status,
  tick: r.tick,
  coverage: r.coverage,
  returns: r.returns,
  firstDown: r.firstDown,
  collected: r.collected,
  activated: r.activated,
  initialReserves: r.initialReserves,
  finalReserves: r.finalReserves,
  bothIdleTicks: r.bothIdleTicks,
  longestJointIdleTicks: r.longestJointIdleTicks,
  checkpoint: r.checkpoint,
});

test('Depot changes two headings only; older editions and Window refinement remain intact', () => {
  assert.equal(source.revision, 'depot-spatial-1');
  assert.notEqual(source.id, old.id);
  assert.deepEqual(source.maps, old.maps);
  for (const difficulty of presets) {
    const a = resolve(baseline, difficulty).level,
      b = structuredClone(resolve(project, difficulty).level);
    assert.notEqual(a.revision, b.revision);
    assert.equal(b.enemies.length, 4);
    assert.equal(b.enemies[0].vx, 0);
    assert.equal(b.enemies[1].vx, 0);
    assert(b.enemies[0].vy > 0 && b.enemies[1].vy < 0);
    for (let i = 0; i < 2; i++) {
      assert(
        Math.abs(
          Math.hypot(a.enemies[i].vx, a.enemies[i].vy) -
            Math.hypot(b.enemies[i].vx, b.enemies[i].vy),
        ) < 1e-12,
      );
      b.enemies[i].vx = a.enemies[i].vx;
      b.enemies[i].vy = a.enemies[i].vy;
    }
    b.revision = a.revision;
    assert.deepEqual(b, a);
    for (const id of ['window-exchange', 'coolant-crossing'])
      assert.deepEqual(
        resolve(project, difficulty, id).level,
        resolve(baseline, difficulty, id).level,
      );
    const pictured = createTeamDepotSpatialCandidates({ artwork: true });
    assert.deepEqual(
      prepareContentPreview(pictured, 'depot-dash', { mode: 'team', difficulty }).manifest.level,
      resolve(project, difficulty).level,
    );
    assert.equal(
      pictured.missions.at(-1).presentation.backgroundAssetId,
      'team-windows-depot-dash',
    );
  }
  const edited = createTeamDepotSpatialCandidates();
  edited.missions.at(-1).actors[0].heading[0] = 1;
  assert.deepEqual(createTeamDepotSpatialCandidates(), source);
  assert.deepEqual(createTeamWindowSpatialCandidates(), old);
});

test('historical Expert corner circuit demonstrates inversion; candidate retains inner field at every preset', () => {
  for (const difficulty of presets) {
    const before = assessTeamTimedRoute(resolve(baseline, difficulty).level, evidence.circuit, {
      seed: 17,
      delayTicks: 1,
    });
    assert.equal(before.tick, 967);
    assert.equal(before.firstDown, null);
    assert.deepEqual(before.activated, []);
    assert.equal(
      before.status,
      difficulty === 'expert' ? 'shared-no-loss-clear' : 'route-exhausted',
    );
    assert.equal(
      before.coverage,
      difficulty === 'expert' ? 0.8562618595825426 : 0.18785578747628084,
    );
    for (const seed of [1, 17, 41])
      for (const delayTicks of [0, 1, 30]) {
        const after = assessTeamTimedRoute(resolve(project, difficulty).level, evidence.circuit, {
          seed,
          delayTicks,
        });
        assert.equal(after.status, 'route-exhausted');
        assert.equal(after.firstDown, null);
        assert.equal(after.coverage, 0.18785578747628084);
        assert.deepEqual(after.returns, [3, 3]);
      }
  }
});

test('ordinary and relocation routes cover each preset and both seats/joint-cut options', () => {
  assert.equal(evidence.format, 'TeamDepotSpatialEvidenceV1');
  assert.equal(evidence.rows.length, 6);
  for (const kind of ['pickup-free', 'relocation'])
    assert.deepEqual(
      evidence.rows.filter((r) => r.kind === kind).map((r) => r.difficulty),
      presets,
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
    test(`${row.difficulty}/${row.kind}: no-loss public route ${JSON.stringify(check.options)}`, () => {
      const manifest = resolve(project, row.difficulty);
      assert.equal(manifest.simulationIdentity, row.simulationIdentity);
      const result = assessTeamTimedRoute(manifest.level, row.log, {
        ...check.options,
        observeBonusWindows: true,
      });
      assert.deepEqual(summary(result), check.result);
      assert.equal(result.status, 'shared-no-loss-clear');
      assert.equal(result.firstDown, null);
      if (row.kind === 'pickup-free') {
        assert.deepEqual(result.collected, []);
        assert.deepEqual(result.activated, ['east-rover', 'west-rover']);
      } else {
        assert.equal(result.collected.length, 1);
        const item = result.collected[0],
          collector = check.options.swapped ? 0 : 1;
        assert.deepEqual(
          [
            item.id,
            item.tick,
            item.x,
            item.y,
            item.reclaimedBeforeContactStep,
            item.partnerCutting,
          ],
          ['depot-speed', 2747, 19.5, 6.5, false, false],
        );
        assert.deepEqual(item.players, [collector]);
        assert.deepEqual(
          result.activated,
          ['east-rover'],
          'Relocation is not both-rover or concurrent-partner mastery.',
        );
        const windows = result.bonusWindows.filter((e) => e.id === 'depot-speed');
        assert.deepEqual(
          windows.map((e) => [e.type, e.tick, e.x, e.y]),
          [
            ['bonus.announced', 239, 52.5, 29.5],
            ['bonus.appeared', 359, 52.5, 29.5],
            ['bonus.expired', 1559, 52.5, 29.5],
            ['bonus.announced', 2519, 19.5, 6.5],
            ['bonus.appeared', 2639, 19.5, 6.5],
          ],
        );
        assert(windows[2].coverageBefore > windows[1].coverageAfter + 0.1);
        assert(windows[4].coverageBefore > windows[2].coverageAfter + 0.1);
        assert.equal(windows[4].anchorBefore, 0);
        const banks = result.closures.filter((c) => c.tick === 2877 || c.tick === 3109);
        assert.equal(banks.length, 2);
        assert(
          banks.every(
            (c) => c.player === collector && c.reason === 'return' && c.speed && c.coverage < 0.54,
          ),
        );
        assert(
          result.cutStarts.some((e) => e.player === collector && e.tick > 2877 && e.tick < 3109),
        );
        // Accepted cell ownership, not floor(y=6) at an exact upper-foundation edge.
        const level = structuredClone(manifest.level);
        if (check.options.swapped) level.spawns.reverse();
        const run = startCoop(createCoop(level, { seed: 17, jointCuts: check.options.jointCuts }));
        const landings = [];
        outer: for (const s of [{ a: null, b: null, ticks: 1 }, ...row.log])
          for (let n = 0; n < s.ticks; n++) {
            const directions = check.options.swapped ? [s.b, s.a] : [s.a, s.b];
            stepCoop(
              run,
              directions.map((direction) => ({ direction, boost: false, support: false })),
            );
            if ([2877, 3109].includes(run.tick)) {
              const index = run.players[collector].cellIndex,
                x = index % 72,
                y = Math.floor(index / 72);
              landings.push(
                level.safeRects.findIndex(
                  (r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h,
                ),
              );
            }
            if (run.tick === 3109) break outer;
          }
        assert.deepEqual(landings, [2, 3]);
      }
      assert(result.returns.every((n) => n >= 3));
      assert.equal(result.finalReserves, result.initialReserves);
      assert(result.longestJointIdleTicks <= 6);
    });
  test(`${row.difficulty}/${row.kind}: real keyboard host matches the route`, async (t) => {
    const f = await page(t, { nativeFocus: true, nativeVisibility: true });
    await f.selectFile(JSON.stringify(createTeamTestPack(source, 'depot-dash', row.difficulty)));
    assert.equal(f.$('coop-pack-status').dataset.state, 'ready');
    f.$('coop-start').focus();
    f.tap('Enter');
    if (row.kind === 'pickup-free') {
      playSpecializedTeamRoute(f, source, 'depot-dash', row.difficulty, 'depot-pickup-free');
      return;
    }
    playSpecializedTeamBonusRoute(f, source, 'depot-dash', row.difficulty, 'depot-relocation');
  });
}
