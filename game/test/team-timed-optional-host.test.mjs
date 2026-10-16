import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTeamTimedCandidates } from '../content-design/team-timed-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { assessTeamTimedRoute } from './helpers/team-timed-route.mjs';
import { page } from './helpers/coop-host.mjs';
import { playCurrentTeamRoute } from './helpers/current-team-route.mjs';

const read = async (name) =>
  JSON.parse(await readFile(new URL(`./fixtures/${name}.json`, import.meta.url)));
const evidence = await read('team-timed-optional-host');
const original = await read('team-timed-routes');
const source = createTeamTimedCandidates();
const project = compileContentProject(source);
const oldRoute = (row) => {
  const matches = original.rows.filter(
    (r) =>
      r.missionId === row.missionId && r.difficulty === row.difficulty && r.kind === 'pickup-free',
  );
  assert.equal(matches.length, 1);
  return matches[0].log;
};
const summary = (r) => ({
  status: r.status,
  tick: r.tick,
  coverage: r.coverage,
  returns: r.returns,
  collected: r.collected.map((e) => e.kind),
  initialReserves: r.initialReserves,
  finalReserves: r.finalReserves,
  checkpoint: r.checkpoint,
});

test('optional routes cover all three timed maps and presets without replacing historical evidence', () => {
  assert.equal(evidence.format, 'TeamTimedOptionalHostEvidenceV1');
  assert.deepEqual(
    evidence.rows.map((r) => `${r.missionId}/${r.difficulty}`).sort(),
    source.missions
      .flatMap((m) => ['gentle', 'standard', 'expert'].map((d) => `${m.id}/${d}`))
      .sort(),
  );
  for (const row of evidence.rows) {
    const adapted = row.missionId === 'coolant-crossing' && row.difficulty === 'expert';
    assert.equal(Object.hasOwn(row, 'log'), adapted);
    assert.equal(Object.hasOwn(row, 'unadaptedProbe'), adapted);
    if (!adapted) {
      assert.equal(row.source, 'team-timed-routes.json');
      assert.equal(row.kind, 'pickup-free');
    }
    assert.deepEqual(
      row.checks.map((c) => c.options),
      [false, true].flatMap((swapped) =>
        [false, true].map((jointCuts) => ({ seed: 17, delayTicks: 1, swapped, jointCuts })),
      ),
    );
    assert.equal(row.keyboard.status, 'won');
  }
});

for (const row of evidence.rows) {
  const label = `${row.missionId}/${row.difficulty}`;
  const log = row.log ?? oldRoute(row);
  for (const check of row.checks)
    test(`${label} clears without any pickup ${JSON.stringify(check.options)}`, () => {
      const manifest = resolveMission(project, row.missionId, {
        mode: 'team',
        difficulty: row.difficulty,
      });
      assert.equal(manifest.simulationIdentity, row.simulationIdentity);
      const result = assessTeamTimedRoute(manifest.level, log, check.options);
      assert.deepEqual(summary(result), check.result);
      assert.equal(result.status, 'shared-no-loss-clear');
      assert.equal(result.firstDown, null);
      assert.deepEqual(result.collected, []);
      assert.equal(result.finalReserves, result.initialReserves);
      assert(result.returns.every((n) => n >= 2));
    });
  if (row.unadaptedProbe)
    test(`${label} retains the old live-seed failed pickup-free attempt`, () => {
      const probe = row.unadaptedProbe;
      assert.equal(probe.source, 'team-timed-routes.json');
      assert.equal(probe.kind, 'pickup-free');
      assert.deepEqual(probe.options, { seed: 17, delayTicks: 1, swapped: false, jointCuts: true });
      const { level } = resolveMission(project, row.missionId, {
        mode: 'team',
        difficulty: row.difficulty,
      });
      const result = assessTeamTimedRoute(level, oldRoute(row), probe.options);
      assert.deepEqual(summary(result), probe.result);
      assert.equal(result.status, 'first-knockdown');
      assert.deepEqual(
        result.collected.map((e) => e.kind),
        ['enemy-freeze'],
      );
    });
  test(`${label} actual keyboard host clears with no observed pickup grant or active effect`, async (t) => {
    const f = await page(t, { nativeFocus: true, nativeVisibility: true });
    await f.selectFile(JSON.stringify(createTeamTestPack(source, row.missionId, row.difficulty)));
    assert.equal(f.$('coop-pack-status').dataset.state, 'ready');
    assert.equal(f.$('coop-difficulty').value, row.difficulty);
    f.$('coop-start').focus();
    f.tap('Enter');
    const reserves = row.checks[1].result.initialReserves;
    const reference = playCurrentTeamRoute(f, source, row.missionId, row.difficulty, () => {
      assert.equal(
        f.$('coop-reserves').textContent,
        `${reserves} reserve${reserves === 1 ? '' : 's'}`,
      );
      assert.doesNotMatch(
        f.$('coop-bonus-live').textContent,
        /Pilot [12] speed|Enemies slow|Enemies frozen/,
      );
      assert.doesNotMatch(
        f.$('coop-message').textContent,
        /(?:Sunflower|Skyline)(?: \+ (?:Sunflower|Skyline))? collected|one shared reserve gained|shared reserves already full/,
      );
    });
    assert(!reference.events.some((event) => event.type === 'powerup.collected'));
    assert(
      [0, 1].every(
        (seat) =>
          reference.events.filter(
            (event) =>
              event.type === 'cut.closed' && event.player === seat && event.reason === 'return',
          ).length >= 2,
      ),
    );
    assert.equal(f.$('coop-menu').hidden, true);
    assert.equal(f.$('coop-overlay').hidden, false);
    assert.equal(f.$('coop-overlay-kicker').textContent, 'A WORLD YOU REVEALED TOGETHER');
    assert.deepEqual(f.visits, []);
    t.diagnostic(
      'Driven-frame HUD evidence; no engine injection, physical controller or human-balance claim.',
    );
  });
}
