import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTeamTimedCandidates } from '../content-design/team-timed-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { assessTeamTimedRoute } from './helpers/team-timed-route.mjs';
import { page } from './helpers/coop-host.mjs';

const read = async (name) =>
  JSON.parse(await readFile(new URL(`./fixtures/${name}.json`, import.meta.url)));
const evidence = await read('team-timed-host-routes');
const qualification = await read('team-timed-qualification');
const original = await read('team-timed-routes');
const source = createTeamTimedCandidates();
const project = compileContentProject(source);
const keys = [
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' },
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
];
const summary = (r) => ({
  status: r.status,
  tick: r.tick,
  coverage: r.coverage,
  returns: r.returns,
  collected: r.collected.map(({ kind, tick, players, x, y, partnerCutting }) => ({
    kind,
    tick,
    players,
    x,
    y,
    partnerCutting,
  })),
  initialReserves: r.initialReserves,
  finalReserves: r.finalReserves,
  checkpoint: r.checkpoint,
});
const find = (rows, row, kind) => {
  const matches = rows.filter(
    (r) => r.missionId === row.missionId && r.difficulty === row.difficulty && r.kind === kind,
  );
  assert.equal(matches.length, 1);
  return matches[0];
};

test('live-seed qualification covers every authored timed mission and preset exactly once', () => {
  assert.equal(evidence.format, 'TeamTimedHostRouteEvidenceV1');
  assert.equal(evidence.source, 'team-timed-qualification.json');
  assert.equal(evidence.kind, 'alternate-taking');
  assert.deepEqual(
    evidence.rows.map((r) => `${r.missionId}/${r.difficulty}`).sort(),
    source.missions
      .flatMap((m) => ['gentle', 'standard', 'expert'].map((d) => `${m.id}/${d}`))
      .sort(),
  );
  for (const row of evidence.rows) {
    assert.deepEqual(
      row.checks.map((check) => check.options),
      [false, true].flatMap((swapped) =>
        [false, true].map((jointCuts) => ({ seed: 17, delayTicks: 30, swapped, jointCuts })),
      ),
    );
    assert.equal(row.unadaptedProbe.source, 'team-timed-routes.json');
    assert.equal(row.unadaptedProbe.kind, 'taking');
    assert.deepEqual(row.unadaptedProbe.options, {
      seed: 17,
      delayTicks: 0,
      swapped: false,
      jointCuts: true,
    });
    const depotStandard = row.missionId === 'depot-dash' && row.difficulty === 'standard';
    assert.deepEqual(
      row.keyboard.adjustments,
      depotStandard ? [{ segment: 6, fromTicks: 5, toTicks: 6 }] : [],
    );
    assert.equal(row.keyboard.status, 'won');
    assert.equal(Object.hasOwn(row, 'unadjustedKeyboardProbe'), depotStandard);
    if (depotStandard) assert.equal(row.unadjustedKeyboardProbe.status, 'running');
  }
});

for (const row of evidence.rows) {
  const label = `${row.missionId}/${row.difficulty}`;
  const route = find(qualification.rows, row, evidence.kind);
  for (const check of row.checks)
    test(`${label} live seed preserves exact public-input evidence ${JSON.stringify(check.options)}`, () => {
      const manifest = resolveMission(project, row.missionId, {
        mode: 'team',
        difficulty: row.difficulty,
      });
      assert.equal(manifest.simulationIdentity, row.simulationIdentity);
      assert.equal(check.options.seed, 17);
      assert.equal(check.options.delayTicks, 30);
      const result = assessTeamTimedRoute(manifest.level, route.log, check.options);
      assert.deepEqual(summary(result), check.result);
      assert.equal(result.status, 'shared-no-loss-clear');
      assert.equal(result.collected.length, 1);
      assert.equal(result.collected[0].partnerCutting, true);
      assert.equal(result.finalReserves, result.initialReserves);
      assert(result.returns.every((n) => n >= 2));
    });

  test(`${label} retains the unadapted seed-1 route as a negative live-seed control`, () => {
    const probe = row.unadaptedProbe;
    const old = find(original.rows, row, probe.kind);
    const { level } = resolveMission(project, row.missionId, {
      mode: 'team',
      difficulty: row.difficulty,
    });
    const result = assessTeamTimedRoute(level, old.log, probe.options);
    assert.deepEqual(summary(result), probe.result);
    assert.notEqual(result.status, 'shared-no-loss-clear');
    assert.equal(result.collected.length, 0);
  });

  async function verifyKeyboard(t, adjusted = true) {
    const f = await page(t, { nativeFocus: true, nativeVisibility: true });
    const pack = createTeamTestPack(source, row.missionId, row.difficulty);
    await f.selectFile(JSON.stringify(pack));
    assert.equal(
      f.$('coop-pack-status').dataset.state,
      'ready',
      f.$('coop-pack-status').textContent,
    );
    assert.equal(f.$('coop-difficulty').value, row.difficulty);
    f.$('coop-start').focus();
    f.tap('Enter');
    const expected = row.checks.find((c) => !c.options.swapped && c.options.jointCuts).result;
    const observed = adjusted ? row.keyboard : row.unadjustedKeyboardProbe;
    const log = structuredClone(route.log);
    if (adjusted)
      for (const change of row.keyboard.adjustments) {
        assert.equal(log[change.segment].ticks, change.fromTicks);
        log[change.segment].ticks = change.toTicks;
      }
    const effect = {
      'enemy-slow': /^Enemies slow \d+s$/,
      'enemy-freeze': /^Enemies frozen \d+s$/,
      'player-speed': /^Pilot 2 speed \d+s$/,
    }[expected.collected[0].kind];
    // First RAF establishes the timestamp; 30 subsequent fixed steps are the
    // explicitly recorded quarter-second idle start. No runtime state override.
    f.tick(31);
    const seen = new Set();
    let frames = 0;
    let firstEffectTick = null;
    let previous = [null, null];
    for (const segment of log) {
      // A repeated segment value is a held intent, not a fresh gesture after
      // capture. Production clears that seat and requires deliberate rearming.
      for (const [seat, direction] of [segment.a, segment.b].entries())
        if (direction && direction !== previous[seat]) f.tap(keys[seat][direction]);
      previous = [segment.a, segment.b];
      for (let n = 0; n < segment.ticks && f.$('coop-overlay').hidden; n++) {
        f.tick();
        frames++;
        seen.add(f.$('coop-bonus-live').textContent);
        if (firstEffectTick === null && effect.test(f.$('coop-bonus-live').textContent)) {
          firstEffectTick = frames + 30;
          const collector = expected.collected[0].players[0];
          const pickup = {
            'enemy-slow': 'enemies slow',
            'enemy-freeze': 'enemies frozen',
            'player-speed': 'pilot speed',
          }[expected.collected[0].kind];
          assert(
            f
              .$('coop-message')
              .textContent.startsWith(
                `${['Sunflower', 'Skyline'][collector]} collected ${pickup}.`,
              ),
            f.$('coop-message').textContent,
          );
          assert.equal(f.$(`coop-state-${1 - collector}`).textContent, 'Line exposed');
        }
        assert.equal(
          f.$('coop-reserves').textContent,
          `${expected.initialReserves} reserve${expected.initialReserves === 1 ? '' : 's'}`,
        );
      }
      if (!f.$('coop-overlay').hidden) break;
    }
    assert.equal(f.$('coop-menu').hidden, true);
    assert.equal(f.$('coop-overlay').hidden, observed.status === 'running');
    if (observed.status === 'won')
      assert.equal(f.$('coop-overlay-kicker').textContent, 'A WORLD YOU REVEALED TOGETHER');
    // These are observed UI projections, not equality with the direct-core
    // replay checksum. Capture-release batching and effect activation differ.
    assert.equal(f.$('coop-coverage').textContent, observed.coverageText);
    assert.equal(frames + 30, observed.tick);
    assert.equal(firstEffectTick, observed.firstEffectTick);
    assert(seen.has('Pickup incoming'));
    assert(seen.has('1 timed pickup available'));
    assert(
      [...seen].some((text) => effect.test(text)),
      [...seen].join('; '),
    );
    assert.deepEqual(f.visits, []);
    t.diagnostic(
      'Production keyboard/input/import/host modules; finite DOM/Canvas. Not native timing, controllers, two-human play, or public deployment.',
    );
  }
  test(`${label} actual imported Team host collects and clears by keyboard at its unchanged live seed`, (t) =>
    verifyKeyboard(t));
  if (row.unadjustedKeyboardProbe)
    test(`${label} preserves keyboard exhaustion before the explicit return-frame adjustment`, (t) =>
      verifyKeyboard(t, false));
}
