import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTeamSpatialOriginalCandidates } from '../content-design/team-spatial-originals.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { playTeamFoundationRoute } from './helpers/team-foundation-route.mjs';
import { inspectTeamRoamerGoal } from './helpers/team-roamer-goal.mjs';
import { page } from './helpers/coop-host.mjs';

const read = async (name) =>
  JSON.parse(await readFile(new URL(`./fixtures/${name}.json`, import.meta.url)));
const evidence = await read('team-inner-landing-continuations');
const opening = (await read('team-inner-landing-routes')).partial.log;
const source = createTeamSpatialOriginalCandidates(),
  project = compileContentProject(source);
const resolve = (difficulty) =>
  resolveMission(project, 'twin-depots', { mode: 'team', difficulty });
const play = (level, log, options) =>
  playTeamFoundationRoute(level, log, { ...options, inspectGoal: inspectTeamRoamerGoal });
test('two remaining presets preserve the verified inner-use opening and four seat/control variants', () => {
  assert.equal(evidence.format, 'TeamInnerLandingContinuationsV1');
  assert.equal(evidence.revision, source.revision);
  assert.deepEqual(evidence.negativeOptions, { seed: 17, delayTicks: 1, jointCuts: true });
  assert.deepEqual(
    evidence.rows.map((r) => r.difficulty),
    ['gentle', 'expert'],
  );
  for (const row of evidence.rows) {
    assert.deepEqual(row.log.slice(0, opening.length), opening);
    assert.deepEqual(
      row.outcomes.map((o) => o.options),
      [false, true].flatMap((swapped) =>
        [false, true].map((jointCuts) => ({ seed: 17, delayTicks: 1, swapped, jointCuts })),
      ),
    );
    assert.equal(evidence.negative.filter((n) => n.difficulty === row.difficulty).length, 12);
  }
});
for (const row of evidence.rows) {
  for (const expected of row.outcomes)
    test(`${row.difficulty}/${JSON.stringify(expected.options)}: inner-first full finish is not patrol mastery`, () => {
      const manifest = resolve(row.difficulty),
        r = play(manifest.level, row.log, expected.options);
      assert.equal(manifest.simulationIdentity, expected.simulationIdentity);
      assert.equal(r.checkpoint, expected.checkpoint);
      assert.equal(r.run.status, 'won');
      assert.equal(r.run.tick, expected.tick);
      assert.equal(r.run.coverage, expected.coverage);
      assert.equal(r.run.team.reserves, expected.reserves);
      assert.equal(r.evidence.downs, 0);
      assert.equal(r.simultaneousTicks, 0);
      assert.equal(r.mastery.achieved, false);
      assert.deepEqual(
        [0, 1].map(
          (i) =>
            r.events.filter(
              (e) => e.type === 'cut.closed' && e.reason === 'return' && e.player === i,
            ).length,
        ),
        expected.returns,
      );
      assert.deepEqual(
        r.run.enemies.filter((e) => e.rover).map((e) => ({ id: e.id, mode: e.rover.mode })),
        expected.roamers,
      );
    });
  test(`${row.difficulty}: full inner-first route through real keyboard host`, async (t) => {
    const f = await page(t, { nativeFocus: true, nativeVisibility: true });
    await f.selectFile(JSON.stringify(createTeamTestPack(source, 'twin-depots', row.difficulty)));
    assert.equal(f.$('coop-pack-status').dataset.state, 'ready');
    f.$('coop-start').focus();
    f.tap('Enter');
    f.tick(2);
    const keys = [
      { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' },
      { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
    ];
    let previous = [null, null],
      frames = 1;
    const expected = row.outcomes[0];
    for (const s of row.log) {
      for (const [seat, d] of [s.a, s.b].entries())
        if (d && d !== previous[seat]) f.tap(keys[seat][d]);
      previous = [s.a, s.b];
      for (let n = 0; n < s.ticks && f.$('coop-overlay').hidden; n++) {
        f.tick();
        frames++;
        assert.equal(
          f.$('coop-reserves').textContent,
          `${expected.reserves} reserve${expected.reserves === 1 ? '' : 's'}`,
        );
        assert.doesNotMatch(f.$('coop-message').textContent, /needs a rescue|reserve used/);
        if (frames === 391) assert.equal(f.$('coop-coverage').textContent, '1.4%');
        if (frames === 801) assert.equal(f.$('coop-coverage').textContent, '5.5%');
      }
      if (!f.$('coop-overlay').hidden) break;
    }
    assert.equal(frames, expected.tick);
    assert.equal(f.$('coop-coverage').textContent, `${(expected.coverage * 100).toFixed(1)}%`);
    assert.equal(f.$('coop-overlay-kicker').textContent, 'A WORLD YOU REVEALED TOGETHER');
    assert.deepEqual(f.visits, []);
  });
}
for (const [index, row] of evidence.negative.entries())
  test(`${row.difficulty}/negative${index}: unsuccessful branch preserves its first loss`, () => {
    const log = [];
    let remaining = row.tick - 1;
    for (const segment of row.log) {
      if (remaining <= 0) break;
      const ticks = Math.min(segment.ticks, remaining);
      log.push({ ...segment, ticks });
      remaining -= ticks;
    }
    const r = play(resolve(row.difficulty).level, log, evidence.negativeOptions);
    assert.equal(r.run.tick, row.tick);
    assert.deepEqual(
      r.events.find((e) => e.type === 'player.downed'),
      row.failure,
    );
    assert.equal(r.checkpoint, row.checkpoint);
  });
