import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTeamTimedCandidates } from '../content-design/team-timed-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { assessTeamTimedRoute } from './helpers/team-timed-route.mjs';
import { page } from './helpers/coop-host.mjs';
import { teamEditionRoute, playTeamEditionRoute } from './helpers/team-edition-host-route.mjs';
import { replayTeamCommands } from './helpers/coop-win.mjs';

const read = async (name) =>
  JSON.parse(await readFile(new URL(`./fixtures/${name}.json`, import.meta.url)));
const evidence = await read('team-timed-host-routes');
const qualification = await read('team-timed-qualification');
const original = await read('team-timed-routes');
const source = createTeamTimedCandidates();
const project = compileContentProject(source);
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

  async function verifyKeyboard(t, complete = true) {
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
    const reference = teamEditionRoute(source, row.missionId, row.difficulty);
    const historical = row.checks.find((c) => !c.options.swapped && c.options.jointCuts).result;
    const pickup = reference.pickups[0];
    assert.deepEqual(
      [pickup.kind, pickup.players, pickup.partnerCutting],
      [historical.collected[0].kind, historical.collected[0].players, true],
    );
    const effect = {
      'enemy-slow': /^Enemies slow \d+s$/,
      'enemy-freeze': /^Enemies frozen \d+s$/,
      'player-speed': /^Pilot 2 speed \d+s$/,
    }[pickup.kind];
    // The live strip can show an upcoming pickup alongside an active effect.
    const hasEffect = (text) => text.split(' · ').some((part) => effect.test(part));
    const seen = new Set();
    let firstEffectTick = null;
    const inspectFrame = (tick) => {
      seen.add(f.$('coop-bonus-live').textContent);
      if (firstEffectTick === null && hasEffect(f.$('coop-bonus-live').textContent)) {
        firstEffectTick = tick;
        const collector = pickup.players[0];
        const label = {
          'enemy-slow': 'enemies slow',
          'enemy-freeze': 'enemies frozen',
          'player-speed': 'pilot speed',
        }[pickup.kind];
        assert(
          f
            .$('coop-message')
            .textContent.startsWith(`${['Sunflower', 'Skyline'][collector]} collected ${label}.`),
          f.$('coop-message').textContent,
        );
        assert.equal(f.$(`coop-state-${1 - collector}`).textContent, 'Line exposed');
      }
      assert.equal(
        f.$('coop-reserves').textContent,
        `${historical.initialReserves} reserve${historical.initialReserves === 1 ? '' : 's'}`,
      );
    };
    if (complete) playTeamEditionRoute(f, source, row.missionId, row.difficulty, inspectFrame);
    else {
      // A recorded command stream exhausted before its final bank must not win.
      // Preserve the historical adjustment above; qualify this current boundary
      // with the current route instead of replaying obsolete movement timing.
      let tick = 1;
      const played = replayTeamCommands(f, reference.commands.slice(1, -1), () =>
        inspectFrame(++tick),
      );
      assert.equal(played + 1, reference.run.tick - 1);
      assert.equal(f.$('coop-overlay').hidden, true);
      assert.notEqual(
        f.$('coop-coverage').textContent,
        `${(reference.run.coverage * 100).toFixed(1)}%`,
      );
      assert(firstEffectTick !== null);
      assert.deepEqual(reference.commands.at(-1), reference.commands.at(-2));
      f.tick();
      inspectFrame(reference.run.tick);
      assert.equal(f.$('coop-overlay').hidden, false);
      assert.equal(f.$('coop-overlay-kicker').textContent, 'A WORLD YOU REVEALED TOGETHER');
      assert.equal(
        f.$('coop-coverage').textContent,
        `${(reference.run.coverage * 100).toFixed(1)}%`,
      );
    }
    assert.equal(f.$('coop-menu').hidden, true);
    assert.equal(firstEffectTick, pickup.activationTick, [...seen].join('; '));
    assert(seen.has('Pickup incoming'));
    assert(seen.has('1 timed pickup available'));
    assert([...seen].some(hasEffect), [...seen].join('; '));
    assert.deepEqual(f.visits, []);
    t.diagnostic(
      'Production keyboard/input/import/host modules with current tuned public routes; historical authored proofs above retained. Finite DOM/Canvas, not native timing, controllers, two-human play or public deployment.',
    );
  }
  test(`${label} actual imported Team host collects and clears by keyboard at its unchanged live seed`, (t) =>
    verifyKeyboard(t));
  if (row.unadjustedKeyboardProbe)
    test(`${label} preserves keyboard exhaustion before the final return frame`, (t) =>
      verifyKeyboard(t, false));
}
