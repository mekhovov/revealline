import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createOverflightRun,
  spawnOverflightEnemy,
  startOverflight,
  stepOverflight,
} from '../overflight/core.mjs';
import { compileOverflightProject, createOverflightProject } from '../overflight/project.mjs';
import {
  applyOverflightUpgrade,
  legalOverflightUpgrades,
  overflightPayload,
} from '../overflight/upgrades.mjs';
import {
  NO_PULSE_QUALIFICATION_BUILDS,
  createOverflightAuditPilot,
  selectCard,
} from '../overflight/review-pilot.mjs';
import { qualifyOverflight } from '../../scripts/qualify-overflight.mjs';

const compiled = compileOverflightProject(createOverflightProject());
const quiet = () => {
  const source = structuredClone(compiled);
  source.encounters = [];
  source.goals.eliteAt = 10000;
  source.goals.finalAt = 20000;
  const run = createOverflightRun(source);
  startOverflight(run);
  return run;
};
const upgrade = (run, id) => {
  const offer = legalOverflightUpgrades(run.build, compiled.upgrades.modules).find(
    (card) => card.id === id,
  );
  assert.equal(applyOverflightUpgrade(run.build, offer, compiled.upgrades.modules), true);
};

test('evolved Fan clears late pursuers only inside a deliberately overlapped pass, without pulse', () => {
  const run = quiet();
  for (const rank of [2, 3, 4]) upgrade(run, `primary:wide:${rank}`);
  assert.equal(run.build.combat.length, 0);
  const settings = overflightPayload(run.build);
  assert.equal(settings.damage, 60);
  run.player.heading = 0;
  run._cooldowns.primary = 0;
  const targets = [-102, -34, 34, 102].map((offset) =>
    spawnOverflightEnemy(run, {
      x: run.player.x - 28,
      y: run.player.y + offset,
      hp: 120,
      speed: 0,
      warning: 0,
    }),
  );
  const singleHit = spawnOverflightEnemy(run, {
    x: run.player.x - 28,
    y: run.player.y,
    hp: 120,
    speed: 0,
    warning: 0,
  });
  for (let index = 0; index < 30; index++) stepOverflight(run);
  for (const enemy of targets) assert.equal(enemy.active, false);
  assert.equal(
    singleHit.hp,
    60,
    'a lone impact remains insufficient; overlap and positioning matter',
  );
  assert.equal(run.stats.kills, targets.length);
  assert.equal(run.stats.xpEarned, targets.length);
});

test('no-pulse policies reject pulse and the wrong support, even when no preferred draft remains', () => {
  for (const [direction, preferences] of Object.entries(NO_PULSE_QUALIFICATION_BUILDS)) {
    const run = quiet();
    const branch = direction.startsWith('fan') ? 'wide' : 'double';
    upgrade(run, `primary:${branch}:2`);
    run.phase = 'upgrade';
    run.progression.rerolls = 0;
    const wrongSupport = direction.endsWith('scanner') ? 'shield' : 'scanner';
    const legal = legalOverflightUpgrades(run.build, compiled.upgrades.modules);
    run.offers = legal.filter((card) => ['proximity-pulse', wrongSupport].includes(card.system));
    assert.equal(selectCard(run, direction), null);
    run.offers.push(legal.find((card) => card.system === 'side-burst'));
    const selected = selectCard(run, direction);
    assert.equal(selected.system, 'side-burst');
    assert.ok(preferences.some((prefix) => selected.id.startsWith(prefix)));
  }
});

test('audit probes wait for two pulse ranks and only return ordinary inputs', () => {
  const run = quiet();
  const audit = createOverflightAuditPilot('tiny-circle-after-pulse2');
  assert.equal(audit.state.startedAt, null);
  audit.input(run);
  assert.equal(audit.state.startedAt, null);
  upgrade(run, 'proximity-pulse:1');
  audit.input(run);
  assert.equal(audit.state.startedAt, null);
  upgrade(run, 'proximity-pulse:2');
  const before = structuredClone(run.build);
  const input = audit.input(run);
  assert.equal(audit.state.startedAt, run.time);
  assert.ok(Math.abs(Math.hypot(input.x, input.y) - 1) < 1e-12);
  assert.deepEqual(run.build, before, 'the audit controller only returns ordinary inputs');
  const wall = createOverflightAuditPilot('wall-after-pulse2');
  assert.deepEqual(wall.input(run), { x: -1, y: 0, boost: false });
});

test('both primary branches have an earned no-pulse completion route and retain the intended support', () => {
  for (const direction of ['fan-shield', 'echo-scanner']) {
    const result = qualifyOverflight({ direction, airframes: 3 });
    assert.equal(result.outcome, 'won');
    assert.equal(result.build.support.id, direction.split('-')[1]);
    assert.deepEqual(result.build.combat.map((module) => module.id).sort(), [
      'side-burst',
      'slow-field',
    ]);
    assert.equal(result.earnedChoices, 10);
    assert.equal(
      result.choices.some((choice) => choice.id.startsWith('proximity-pulse')),
      false,
    );
  }
});

test('fixed small-circle and wall input cannot turn early pulse ranks into a free sortie', () => {
  for (const route of ['tiny-circle-after-pulse2', 'wall-after-pulse2']) {
    const result = qualifyOverflight({ direction: 'systems', route, airframes: 1 });
    assert.equal(result.outcome, 'lost');
    assert.ok(result.audit.startedAt > 20);
    assert.ok(
      result.simulatedSeconds < 120,
      'ordinary opening threats must reach this simple policy before the elite',
    );
    if (route.startsWith('tiny-circle')) {
      assert.ok(result.audit.firstAirframeMotion.spanX < 50);
      assert.ok(result.audit.firstAirframeMotion.spanY < 50);
    }
  }
});
