import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTeamSpatialOriginalCandidates } from '../content-design/team-spatial-originals.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { measureTeamPartnerReturns } from './helpers/team-partner-return.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { playTeamFoundationRoute } from './helpers/team-foundation-route.mjs';
import { inspectTeamRoamerGoal } from './helpers/team-roamer-goal.mjs';
import { page } from './helpers/coop-host.mjs';
import { playSpecializedTeamRoute } from './helpers/team-specialized-host-route.mjs';
const evidence = JSON.parse(
  await readFile(new URL('./fixtures/team-partner-return-routes.json', import.meta.url)),
);
const project = compileContentProject(createTeamSpatialOriginalCandidates());
const full = JSON.parse(
  await readFile(new URL('./fixtures/team-partner-return-continuations.json', import.meta.url)),
);
test('partner-return inventory includes all presets, seats, joint settings and both absent-partner controls', () => {
  assert.equal(evidence.format, 'TeamPartnerReturnRoutesV1');
  assert.equal(evidence.missionId, 'shared-lookout');
  assert.equal(evidence.revision, project.source.revision);
  assert.deepEqual(
    evidence.rows.map((r) => r.difficulty),
    ['gentle', 'standard', 'expert'],
  );
  assert.equal(full.format, 'TeamPartnerReturnContinuationsV1');
  assert.equal(full.missionId, evidence.missionId);
  assert.equal(full.revision, evidence.revision);
  assert.deepEqual(
    full.rows.map((r) => r.difficulty),
    evidence.rows.map((r) => r.difficulty),
  );
  for (const row of full.rows) {
    const partial = evidence.rows.find((r) => r.difficulty === row.difficulty);
    assert.deepEqual(row.log.slice(0, partial.log.length), partial.log);
    assert.deepEqual(
      row.outcomes.map((o) => o.options),
      partial.outcomes.map((o) => o.options),
    );
    assert.equal(full.negative.filter((n) => n.difficulty === row.difficulty).length, 12);
  }
  for (const row of evidence.rows) {
    assert.deepEqual(
      row.outcomes.map((o) => o.options),
      [false, true].flatMap((swapped) =>
        [false, true].map((jointCuts) => ({ swapped, jointCuts })),
      ),
    );
    assert.deepEqual(
      row.negative.map((n) => n.absent),
      [0, 1],
    );
  }
});
for (const row of evidence.rows) {
  const manifest = resolveMission(project, evidence.missionId, {
    mode: 'team',
    difficulty: row.difficulty,
  });
  for (const outcome of row.outcomes)
    test(`${row.difficulty}/${JSON.stringify(outcome.options)}: both pilots bank on the partner's earlier return line`, () => {
      assert.equal(manifest.simulationIdentity, row.simulationIdentity);
      const r = measureTeamPartnerReturns(manifest.level, row.log, outcome.options);
      assert.equal(r.checkpoint, outcome.checkpoint);
      assert.equal(r.firstDown, null);
      assert.equal(r.status, 'running', 'Opening is not a whole-level clear');
      assert.equal(r.tick, row.difficulty === 'expert' ? 691 : 547);
      assert.equal(r.simultaneousTicks, row.difficulty === 'expert' ? 504 : 360);
      assert.equal(r.returns.length, 4);
      assert(
        r.rovers.every((e) => e.mode === 'dormant'),
        'Not roamer mastery',
      );
      assert(r.coverage < 0.1, 'Most of the spatial challenge remains');
      const partner = r.returns.filter((e) => e.partnerReturn);
      assert.deepEqual(partner.map((e) => e.player).sort(), [0, 1]);
      for (const e of partner) {
        assert.equal(e.previousOwner, 1 - e.player);
        assert(e.acquiredTick < e.tick);
        assert(
          !manifest.level.safeRects.some(
            (rect) =>
              e.cell % 72 >= rect.x &&
              e.cell % 72 < rect.x + rect.w &&
              Math.floor(e.cell / 72) >= rect.y &&
              Math.floor(e.cell / 72) < rect.y + rect.h,
          ),
          'Earned partner cell, not a permanent foundation',
        );
      }
      assert(r.players.every((p) => !p.cutting && p.direction === null));
    });
  for (const negative of row.negative)
    test(`${row.difficulty}/absent${negative.absent}: no partner bridge means no second bank`, () => {
      const log = row.log.map((s) => ({ ...s, [negative.absent === 0 ? 'a' : 'b']: null }));
      const r = measureTeamPartnerReturns(manifest.level, log);
      assert.equal(r.checkpoint, negative.checkpoint);
      assert.equal(r.firstDown, null);
      assert.equal(r.returns.length, 1);
      assert.equal(
        r.returns.some((e) => e.partnerReturn),
        false,
      );
      assert.equal(r.players[1 - negative.absent].cutting, true);
    });
}

for (const row of full.rows) {
  const manifest = resolveMission(project, full.missionId, {
    mode: 'team',
    difficulty: row.difficulty,
  });
  for (const expected of row.outcomes)
    test(`full/${row.difficulty}/${JSON.stringify(expected.options)}: cooperative opening remains useful in a no-loss finish`, () => {
      assert.equal(manifest.simulationIdentity, expected.simulationIdentity);
      const r = measureTeamPartnerReturns(manifest.level, row.log, expected.options);
      assert.equal(r.checkpoint, expected.checkpoint);
      assert.equal(r.status, 'won');
      assert.equal(r.firstDown, null);
      assert.equal(r.tick, expected.tick);
      assert.equal(r.coverage, expected.coverage);
      assert.equal(r.reserves, expected.reserves);
      assert.deepEqual(r.rovers, expected.roamers);
      assert.deepEqual(
        [0, 1].map((i) => r.returns.filter((e) => e.player === i).length),
        expected.returns,
      );
      assert.deepEqual(
        r.returns.slice(2, 4).map((e) => e.partnerReturn),
        [true, true],
      );
      assert.equal(r.simultaneousTicks, row.difficulty === 'expert' ? 504 : 360);
      const other = playTeamFoundationRoute(manifest.level, row.log, {
        ...expected.options,
        seed: 17,
        inspectGoal: inspectTeamRoamerGoal,
      });
      assert.equal(other.checkpoint, r.checkpoint);
      assert.equal(other.mastery.achieved, expected.mastery);
      assert.deepEqual(
        other.events.filter((e) => e.type === 'rover.warning' || e.type === 'rover.activated'),
        expected.roverEvents,
      );
    });
  test(`full/${row.difficulty}: actual keyboard cooperative opening and finish`, async (t) => {
    const f = await page(t, { nativeFocus: true, nativeVisibility: true });
    await f.selectFile(
      JSON.stringify(createTeamTestPack(project.source, full.missionId, row.difficulty)),
    );
    assert.equal(f.$('coop-pack-status').dataset.state, 'ready');
    f.$('coop-start').focus();
    f.tap('Enter');
    playSpecializedTeamRoute(f, project.source, full.missionId, row.difficulty, 'partner-full');
  });
}
for (const [i, row] of full.negative.entries())
  test(`full/${row.difficulty}/negative${i}: rejected tail preserves first failure`, () => {
    const level = resolveMission(project, full.missionId, {
      mode: 'team',
      difficulty: row.difficulty,
    }).level;
    const r = measureTeamPartnerReturns(level, row.log);
    assert.equal(r.tick, row.tick);
    assert.deepEqual(r.firstDown, row.failure);
    assert.equal(r.checkpoint, row.checkpoint);
  });
