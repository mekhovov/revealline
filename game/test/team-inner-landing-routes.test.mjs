import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTeamSpatialOriginalCandidates } from '../content-design/team-spatial-originals.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { playTeamFoundationRoute } from './helpers/team-foundation-route.mjs';
import { inspectTeamRoamerGoal } from './helpers/team-roamer-goal.mjs';
import { perimeterConnectedFoundations } from './helpers/team-foundation-goal.mjs';
import { page } from './helpers/coop-host.mjs';
import { playSpecializedTeamRoute } from './helpers/team-specialized-host-route.mjs';

const source = createTeamSpatialOriginalCandidates(),
  project = compileContentProject(source);
const evidence = JSON.parse(
  await readFile(new URL('./fixtures/team-inner-landing-routes.json', import.meta.url)),
);
const resolve = (difficulty) =>
  resolveMission(project, 'twin-depots', { mode: 'team', difficulty });
const play = (level, log, options) =>
  playTeamFoundationRoute(level, log, { ...options, inspectGoal: inspectTeamRoamerGoal });
function prefix(log, ticks) {
  const result = [];
  for (const s of log) {
    if (ticks <= 0) break;
    const n = Math.min(ticks, s.ticks);
    result.push({ ...s, ticks: n });
    ticks -= n;
  }
  return result;
}
function inside(level, index, foundation) {
  const r = level.safeRects[foundation],
    x = index % level.width,
    y = Math.floor(index / level.width);
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

test('inner-return evidence covers all partial presets and a separately qualified Standard finish', () => {
  assert.equal(evidence.format, 'TeamInnerLandingRoutesV1');
  assert.equal(evidence.revision, source.revision);
  assert.equal(evidence.partial.rows.length, 12);
  assert.equal(evidence.full.rows.length, 4);
  assert.deepEqual(
    evidence.negative.rows.map((r) => r.difficulty),
    ['gentle', 'standard', 'expert'],
  );
  for (const [kind, presets] of [
    ['partial', ['gentle', 'standard', 'expert']],
    ['full', ['standard']],
  ])
    for (const difficulty of presets) {
      const rows = evidence[kind].rows.filter((r) => r.difficulty === difficulty);
      assert.deepEqual(
        rows.map((r) => r.options),
        [false, true].flatMap((swapped) =>
          [false, true].map((jointCuts) => ({ seed: 17, delayTicks: 1, swapped, jointCuts })),
        ),
      );
    }
  assert.deepEqual(evidence.full.log.slice(0, evidence.partial.log.length), evidence.partial.log);
});

for (const kind of ['partial', 'full'])
  for (const row of evidence[kind].rows)
    test(`${kind}/${row.difficulty}/${JSON.stringify(row.options)}: genuine inner bank, redeparture and useful return`, () => {
      const manifest = resolve(row.difficulty),
        seat = row.options.swapped ? 0 : 1;
      assert.equal(manifest.simulationIdentity, row.simulationIdentity);
      const result = play(manifest.level, evidence[kind].log, row.options);
      assert.equal(result.checkpoint, row.checkpoint);
      assert.equal(result.evidence.downs, 0);
      assert.equal(result.run.team.reserves, { gentle: 4, standard: 2, expert: 1 }[row.difficulty]);
      assert.equal(result.simultaneousTicks, 0, 'Not a simultaneous-cooperation claim');
      const closures = result.events.filter((e) => e.type === 'cut.closed');
      assert.deepEqual(
        closures.slice(0, 2).map((e) => [e.tick, e.player, e.reason, e.cells]),
        [
          [390, seat, 'return', 29],
          [800, seat, 'return', 87],
        ],
      );
      for (const [tick, property, index, foundation] of [
        [391, 'cellIndex', 1552, 3],
        [489, 'departureIndex', 1048, 3],
        [801, 'cellIndex', 1065, 1],
      ]) {
        const snapshot = play(
          manifest.level,
          prefix(evidence.partial.log, tick - 1),
          row.options,
        ).run;
        assert.equal(snapshot.tick, tick);
        assert.equal(snapshot.players[seat][property], index);
        assert(inside(manifest.level, index, foundation));
        assert.equal(
          perimeterConnectedFoundations(snapshot).has(3),
          false,
          'Inner use precedes any perimeter connection',
        );
        if (tick === 489)
          assert(snapshot.events.some((e) => e.type === 'cut.started' && e.player === seat));
      }
      if (kind === 'partial') {
        assert.equal(result.run.status, 'running');
        assert.equal(result.run.tick, 802);
        assert.equal(result.run.coverage, 0.055133079847908745);
        assert(result.run.enemies.filter((e) => e.rover).every((e) => e.rover.mode === 'dormant'));
        assert.equal(result.mastery.achieved, false);
      } else {
        assert.equal(result.run.status, 'won');
        assert.equal(result.run.tick, 4822);
        assert.equal(result.run.coverage, 0.7946768060836502);
        assert.deepEqual(
          [0, 1].map((i) => closures.filter((e) => e.player === i && e.reason === 'return').length),
          [4, 4],
        );
        assert.deepEqual(
          result.run.enemies.filter((e) => e.rover).map((e) => [e.id, e.rover.mode]),
          [
            ['roamer-1', 'active'],
            ['roamer-2', 'dormant'],
          ],
        );
        assert.equal(
          result.mastery.achieved,
          false,
          'Alternative inner route is not both-rover mastery',
        );
      }
    });

for (const row of evidence.negative.rows)
  test(`${row.difficulty}: exposed outer-bottom shortcut retains first trail loss`, () => {
    const r = play(resolve(row.difficulty).level, prefix(evidence.negative.log, row.tick - 1), {
      seed: 17,
      delayTicks: 1,
    });
    assert.equal(r.run.tick, row.tick);
    assert.deepEqual(
      r.events.find((e) => e.type === 'player.downed'),
      row.failure,
    );
  });

for (const [kind, difficulty] of [
  ['partial', 'gentle'],
  ['partial', 'standard'],
  ['partial', 'expert'],
  ['full', 'standard'],
])
  test(`${kind}/${difficulty}: real keyboard inner-landing route`, async (t) => {
    const f = await page(t, { nativeFocus: true, nativeVisibility: true });
    await f.selectFile(JSON.stringify(createTeamTestPack(source, 'twin-depots', difficulty)));
    assert.equal(f.$('coop-pack-status').dataset.state, 'ready');
    f.$('coop-start').focus();
    f.tap('Enter');
    playSpecializedTeamRoute(f, source, 'twin-depots', difficulty, `inner-${kind}`);
  });
