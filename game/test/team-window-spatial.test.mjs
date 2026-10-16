import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTeamWindowSpatialCandidates } from '../content-design/team-window-spatial-candidates.mjs';
import { createTeamTimedCandidates } from '../content-design/team-timed-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { assessTeamTimedRoute } from './helpers/team-timed-route.mjs';
import { page } from './helpers/coop-host.mjs';
import {
  playSpecializedTeamRoute,
  playSpecializedTeamBonusRoute,
} from './helpers/team-specialized-host-route.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { createContentDraftSession } from '../content-design/session.mjs';
import { TEAM_TIMED_ART_CANDIDATES } from '../content-design/team-timed-art.mjs';

const read = async (name) =>
  JSON.parse(await readFile(new URL(`./fixtures/${name}.json`, import.meta.url)));
const evidence = await read('team-window-spatial-routes');
const historical = await read('team-timed-routes');
const source = createTeamWindowSpatialCandidates(),
  project = compileContentProject(source),
  old = createTeamTimedCandidates(),
  baseline = compileContentProject(old);
const presets = ['gentle', 'standard', 'expert'];
const resolve = (p, difficulty, id = 'window-exchange') =>
  resolveMission(p, id, { mode: 'team', difficulty });
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
  simultaneousTicks: r.simultaneousTicks,
  checkpoint: r.checkpoint,
});

test('Window successor changes two actor placements, not geometry, speeds, quotas or schedules', () => {
  assert.equal(source.revision, 'window-spatial-1');
  assert.deepEqual(source.maps, old.maps);
  for (const difficulty of presets) {
    const a = resolve(baseline, difficulty).level,
      b = structuredClone(resolve(project, difficulty).level);
    assert.notEqual(b.revision, a.revision);
    assert.equal(b.enemies.length, 4);
    for (let i = 0; i < 4; i++)
      assert(
        Math.abs(
          Math.hypot(a.enemies[i].vx, a.enemies[i].vy) -
            Math.hypot(b.enemies[i].vx, b.enemies[i].vy),
        ) < 1e-12,
      );
    for (const i of [0, 3]) assert.deepEqual(b.enemies[i], a.enemies[i]);
    assert.deepEqual([b.enemies[1].x, b.enemies[1].y, b.enemies[1].vx], [8.5, 28.5, 0]);
    assert.deepEqual([b.enemies[2].x, b.enemies[2].y, b.enemies[2].vx], [63.5, 7.5, 0]);
    b.enemies = structuredClone(a.enemies);
    b.revision = a.revision;
    assert.deepEqual(b, a);
    for (const id of ['coolant-crossing', 'depot-dash'])
      assert.deepEqual(
        resolve(project, difficulty, id).level,
        resolve(baseline, difficulty, id).level,
      );
  }
  const draft = createTeamWindowSpatialCandidates();
  draft.missions[0].actors[1].x = 11.5;
  assert.deepEqual(createTeamWindowSpatialCandidates(), source);
  assert.deepEqual(createTeamTimedCandidates(), old);
});

test('old fast paths remain historical controls, not new balance proof', () => {
  for (const difficulty of presets) {
    const row = historical.rows.find(
      (r) =>
        r.missionId === 'window-exchange' &&
        r.difficulty === difficulty &&
        r.kind === 'pickup-free',
    );
    const before = assessTeamTimedRoute(resolve(baseline, difficulty).level, row.log, {
      seed: 17,
      delayTicks: 1,
    });
    const after = assessTeamTimedRoute(resolve(project, difficulty).level, row.log, {
      seed: 17,
      delayTicks: 1,
    });
    assert.equal(before.status, 'shared-no-loss-clear');
    assert.equal(after.status, 'route-exhausted');
    assert.equal(after.firstDown, null);
    assert(after.coverage < 0.31);
    assert(after.coverage < before.coverage);
  }
});

test('all 27 representative first-return combinations remain usable', () => {
  for (const difficulty of presets)
    for (const a of ['up', 'down', 'left'])
      for (const b of ['up', 'down', 'right']) {
        const r = assessTeamTimedRoute(resolve(project, difficulty).level, [{ a, b, ticks: 212 }], {
          seed: 17,
          delayTicks: 1,
        });
        assert.equal(r.firstDown, null);
        assert.deepEqual(r.returns, [1, 1]);
        assert(r.coverage <= 0.012);
      }
});

test('ordinary and cooperation routes cover each preset; relocation is explicitly inventoried', () => {
  assert.equal(evidence.format, 'TeamWindowSpatialEvidenceV1');
  assert.equal(evidence.missionId, 'window-exchange');
  assert.equal(evidence.rows.length, 9);
  assert.equal(new Set(evidence.rows.map((r) => `${r.difficulty}/${r.kind}`)).size, 9);
  for (const kind of ['pickup-free', 'cooperation'])
    assert.deepEqual(
      evidence.rows.filter((r) => r.kind === kind).map((r) => r.difficulty),
      presets,
    );
  assert.deepEqual(
    evidence.rows.filter((r) => r.kind === 'relocation').map((r) => r.difficulty),
    presets,
  );
  for (const row of evidence.rows) {
    assert(
      row.log.every((s) => s.a !== null || s.b !== null),
      'No parked waiting segment',
    );
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
  }
});

test('Studio inspection prepares a separate pictured project; draft Undo preserves its edition', async () => {
  const pictured = createTeamWindowSpatialCandidates({ artwork: true }),
    session = createContentDraftSession(old);
  assert.deepEqual(pictured.assets, structuredClone(TEAM_TIMED_ART_CANDIDATES));
  assert.deepEqual(session.current(), old);
  for (const difficulty of presets) {
    const manifest = prepareContentPreview(pictured, 'window-exchange', {
      mode: 'team',
      difficulty,
    }).manifest;
    assert.deepEqual(manifest.level, resolve(project, difficulty).level);
    assert.equal(manifest.background.id, 'team-windows-window-exchange');
    assert.equal(manifest.officialProgressEligible, false);
  }
  assert.throws(() => session.replace(pictured), /different project/);
  assert.deepEqual(session.current(), old);
  const applied = createContentDraftSession(pictured),
    edit = structuredClone(pictured);
  edit.name = 'Local test edit';
  applied.replace(edit);
  assert.deepEqual(applied.current(), edit);
  applied.undo();
  assert.deepEqual(applied.current(), pictured);
  applied.redo();
  assert.deepEqual(applied.current(), edit);
  const host = await readFile(new URL('../studio/studio.mjs', import.meta.url), 'utf8');
  const start = host.indexOf("$('team-timed-originals').onclick");
  const action = host.slice(start, host.indexOf("$('crosswind').onclick", start));
  assert.match(action, /if \(!discardSource\(\)\) return/);
  assert.match(action, /team-window-edition/);
  assert.match(action, /createTeamWindowSpatialCandidates/);
  assert.match(action, /inspectSource\(\)/);
  assert.doesNotMatch(action, /session.replace|queueSave|launchPreview/);
});

for (const row of evidence.rows) {
  const manifest = resolve(project, row.difficulty);
  for (const check of row.checks)
    test(`${row.difficulty}/${row.kind}/swap${check.options.swapped}/joint${check.options.jointCuts}: directional clear`, () => {
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
      );
      assert.equal(r.status, 'shared-no-loss-clear');
      assert.equal(r.firstDown, null);
      assert(r.returns.every((n) => n >= 3));
      assert.equal(r.finalReserves, r.initialReserves);
      assert(r.bothIdleTicks <= 90);
      if (row.kind === 'pickup-free') assert.deepEqual(r.collected, []);
      else {
        assert.equal(r.collected.length, 1);
        const item = r.collected[0];
        assert.equal(item.kind, 'enemy-slow');
        assert.equal(item.activationTick, item.tick + 1);
        assert.equal(item.untilTick - item.activationTick, 720);
        assert.equal(
          item.reclaimedBeforeContactStep,
          false,
          'Detour reaches a still-unclaimed pickup',
        );
        assert(r.closures.some((c) => c.reason === 'return' && c.tick > item.tick && c.slow));
        if (row.kind === 'cooperation') {
          assert.equal(item.partnerCutting, true);
          assert.deepEqual([item.x, item.y], [8.5, 8.5]);
          assert(item.tick >= 359 && item.tick < 1559);
          assert(
            r.closures.some(
              (c) =>
                c.reason === 'return' &&
                c.player !== item.players[0] &&
                c.tick > item.tick &&
                c.slow,
            ),
            'Partner banks a cut during shared slow',
          );
        } else {
          assert.deepEqual(
            r.bonusWindows.slice(0, 5).map((e) => [e.type, e.tick, e.x, e.y]),
            [
              ['bonus.announced', 239, 8.5, 8.5],
              ['bonus.appeared', 359, 8.5, 8.5],
              ['bonus.expired', 1559, 8.5, 8.5],
              ['bonus.announced', 2519, 63.5, 27.5],
              ['bonus.appeared', 2639, 63.5, 27.5],
            ],
          );
          assert.deepEqual([item.x, item.y], [63.5, 27.5]);
          assert(item.tick > 2639 && item.tick < 3839);
          const [, first, expiry, , second] = r.bonusWindows;
          assert(expiry.coverageBefore > first.coverageAfter + 0.05);
          assert(second.coverageBefore > expiry.coverageAfter + 0.05);
          assert.equal(second.anchorBefore, 0);
          assert.equal(second.anchorAfter, 0);
        }
      }
    });

  test(`${row.difficulty}/${row.kind}: actual keyboard host matches exact clear and pickup cues`, async (t) => {
    const f = await page(t, { nativeFocus: true, nativeVisibility: true });
    await f.selectFile(
      JSON.stringify(createTeamTestPack(source, 'window-exchange', row.difficulty)),
    );
    assert.equal(f.$('coop-pack-status').dataset.state, 'ready');
    f.$('coop-start').focus();
    f.tap('Enter');
    if (row.kind === 'pickup-free') {
      playSpecializedTeamRoute(f, source, 'window-exchange', row.difficulty, 'window-pickup-free');
      return;
    }
    playSpecializedTeamBonusRoute(
      f,
      source,
      'window-exchange',
      row.difficulty,
      `window-${row.kind}`,
    );
  });
}
