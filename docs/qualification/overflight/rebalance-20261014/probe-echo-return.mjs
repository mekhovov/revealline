/** Qualification-only remembered route goals; no simulation state or power grants. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import {
  createOverflightProject,
  compileOverflightProject,
} from '../../../../game/overflight/project.mjs';
import {
  createOverflightRun,
  startOverflight,
  stepOverflight,
  chooseOverflightUpgrade,
  overflightSummary,
} from '../../../../game/overflight/core.mjs';
import { overflightPayload } from '../../../../game/overflight/upgrades.mjs';
import { overflightAttackContains } from '../../../../game/overflight/tactics.mjs';
import { selectCard } from '../../../../game/overflight/review-pilot.mjs';

const here = (name) => new URL(name, import.meta.url);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const pilotSource = readFileSync(here('../../../../game/overflight/review-pilot.mjs'), 'utf8');
const originalScorer = pilotSource.slice(
  pilotSource.indexOf('function directionalPilot(run, route)'),
);
assert.ok(originalScorer.startsWith('function directionalPilot(run, route)'));
const scorerText = originalScorer
  .replace('function directionalPilot(run, route)', 'function directionalPilot(run, route, goal)')
  .replace(
    /  const phase = run.time[\s\S]*?  const final =/,
    '  let goalX = goal.x, goalY = goal.y;\n  const final =',
  );
assert.notEqual(scorerText, originalScorer);
// The original scorer is copied from the source-bound review pilot. Only its
// nearest-pickup/fallback goal block is replaced; threat prediction and legal
// steering/boost candidate evaluation are identical, including final-tank aims.
const scorer = Function(
  'overflightPayload',
  'overflightAttackContains',
  `${scorerText}; return directionalPilot;`,
)(overflightPayload, overflightAttackContains);
const baseline = JSON.parse(gunzipSync(readFileSync(here('balance-matrix-final.json.gz'))));
const sourceHashes = () =>
  baseline.source.map((entry) => ({
    path: entry.path,
    sha256: hash(readFileSync(here(`../../../../${entry.path}`))),
  }));
assert.deepEqual(sourceHashes(), baseline.source);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const bound = (run, x, y) => ({
  x: clamp(x, 90, run.compiled.arena.width - 90),
  y: clamp(y, 90, run.compiled.arena.height - 90),
});
function threatWeight(run, point) {
  let weight = 0;
  for (const enemy of run.enemies)
    if (enemy.active && enemy.warning <= 0) {
      const distance = dist(enemy, point);
      if (distance < 150) weight += (150 - distance) / 150;
    }
  return weight;
}
function salvageGoal(run, fallback) {
  const cells = new Map();
  for (const pickup of run.pickups) {
    if (!pickup.active || dist(pickup, run.player) > 650) continue;
    const key = `${Math.floor(pickup.x / 96)}:${Math.floor(pickup.y / 96)}`;
    const cluster = cells.get(key) ?? { value: 0, x: 0, y: 0 };
    cluster.value += pickup.value;
    cluster.x += pickup.x * pickup.value;
    cluster.y += pickup.y * pickup.value;
    cells.set(key, cluster);
  }
  let chosen = fallback,
    best = 0;
  for (const cluster of cells.values()) {
    if (cluster.value < 5) continue;
    const point = { x: cluster.x / cluster.value, y: cluster.y / cluster.value };
    const score =
      cluster.value / ((dist(point, run.player) + 80) * (1 + threatWeight(run, point) * 0.18));
    if (score > best) {
      best = score;
      chosen = point;
    }
  }
  return bound(run, chosen.x, chosen.y);
}
function controller(parameters) {
  let plan = [],
    stage = 0,
    due = 0;
  const history = [];
  function begin(run) {
    const player = run.player;
    let awayX = 0,
      awayY = 0;
    for (const enemy of run.enemies) {
      if (!enemy.active || enemy.warning > 0) continue;
      const d = dist(player, enemy);
      if (d < 420 && d > 0) {
        awayX += (player.x - enemy.x) / (d * (d + 40));
        awayY += (player.y - enemy.y) / (d * (d + 40));
      }
    }
    const heading = awayX || awayY ? Math.atan2(awayY, awayX) : player.heading;
    const ux = Math.cos(heading),
      uy = Math.sin(heading);
    const origin = { x: player.x, y: player.y };
    const end = bound(run, origin.x + ux * parameters.leg, origin.y + uy * parameters.leg);
    const left = bound(run, end.x - uy * parameters.width, end.y + ux * parameters.width);
    const right = bound(run, end.x + uy * parameters.width, end.y - ux * parameters.width);
    const side = threatWeight(run, left) <= threatWeight(run, right) ? 1 : -1;
    const px = -uy * side,
      py = ux * side;
    plan = [
      { ...end, seconds: parameters.leg / 160 },
      {
        ...bound(
          run,
          end.x + ux * 45 + px * parameters.width * 0.6,
          end.y + uy * 45 + py * parameters.width * 0.6,
        ),
        seconds: 0.9,
      },
      {
        ...bound(
          run,
          end.x - ux * 45 + px * parameters.width,
          end.y - uy * 45 + py * parameters.width,
        ),
        seconds: 0.9,
      },
      { ...bound(run, origin.x + px * 65, origin.y + py * 65), seconds: 3.2, return: true },
    ];
    stage = 0;
    due = run.time + plan[0].seconds;
    history.push({ time: run.time, origin, heading, plan: structuredClone(plan) });
  }
  return {
    history,
    input(run) {
      if (!plan.length) begin(run);
      if (run.time >= due || dist(run.player, plan[stage]) < 45) {
        stage++;
        if (stage >= plan.length) begin(run);
        else {
          if (plan[stage].return) Object.assign(plan[stage], salvageGoal(run, plan[stage]));
          due = run.time + plan[stage].seconds;
        }
      }
      return scorer(run, 'lure-return', plan[stage]);
    },
  };
}
function clone(value, seen = new Map()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);
  const result =
    value instanceof Map
      ? new Map()
      : value instanceof Set
        ? new Set()
        : ArrayBuffer.isView(value)
          ? value.slice()
          : Array.isArray(value)
            ? []
            : {};
  seen.set(value, result);
  if (value instanceof Map) for (const [k, v] of value) result.set(clone(k, seen), clone(v, seen));
  else if (value instanceof Set) for (const v of value) result.add(clone(v, seen));
  else for (const key of Object.keys(value)) result[key] = clone(value[key], seen);
  return result;
}
function drive(run, controls = null) {
  const choices = [],
    samples = [];
  let input = {},
    checkpoint = null;
  while (!['won', 'lost'].includes(run.phase) && run.time < 450) {
    while (run.phase === 'upgrade') {
      const offer = selectCard(run, 'echo');
      assert.ok(offer && chooseOverflightUpgrade(run, offer.id));
      choices.push({ time: run.time, id: offer.id });
    }
    if (controls && !checkpoint && run.time >= 240) checkpoint = clone(run);
    if (run.tick % 6 === 0) input = controls?.input(run) ?? {};
    stepOverflight(run, input);
    if (run.tick % 600 === 0)
      samples.push({
        time: run.time,
        x: run.player.x,
        y: run.player.y,
        hull: run.player.hull,
        airframes: run.airframesRemaining,
        xp: run.progression.xp,
        kills: run.stats.kills,
        visible: run.stats.enemiesVisible,
      });
  }
  return { summary: overflightSummary(run), build: run.build, choices, samples, checkpoint };
}
const presets = [
  { name: 'medium', leg: 360, width: 140 },
  { name: 'compact', leg: 280, width: 100 },
  { name: 'wide', leg: 420, width: 180 },
];
for (const parameters of presets) {
  const config = { encounterSet: 'front', difficulty: 'standard', seed: 17031991, rulesVersion: 3 };
  const run = createOverflightRun(compileOverflightProject(createOverflightProject(config)), {
    airframes: 3,
  });
  startOverflight(run);
  const controls = controller(parameters);
  const before = JSON.stringify(run);
  controls.input(run);
  assert.equal(JSON.stringify(run), before, 'Controller must not modify simulation state.');
  const active = drive(run, controls);
  const checkpoint = active.checkpoint;
  delete active.checkpoint;
  const none = active.summary.outcome === 'won' && checkpoint ? drive(checkpoint) : null;
  if (none) delete none.checkpoint;
  const receipt = {
    format: 'OverflightEchoReturnProbeV1',
    config,
    airframes: 3,
    buildPolicy: 'echo',
    parameters,
    sourceCommit: baseline.sourceCommit,
    source: sourceHashes(),
    sourceAtFinish: sourceHashes(),
    controllerSha256: hash(readFileSync(new URL(import.meta.url))),
    scorerSourceSha256: hash(pilotSource),
    scorerCopiedFunctionSha256: hash(originalScorer),
    scorerChange:
      'Replace nearest-pickup/fallback goal with an explicit latched route waypoint only.',
    active,
    none,
    routeHistory: controls.history,
    constraints:
      'Ordinary steering and boost only; legal earned drafts; no damage, XP, health, weapon, timer or position grants.',
  };
  assert.deepEqual(receipt.source, baseline.source);
  const output = here(`echo-return-${parameters.name}.json.gz`);
  const temporary = here(`echo-return-${parameters.name}.json.gz.tmp`);
  writeFileSync(temporary, gzipSync(JSON.stringify(receipt), { level: 9 }));
  renameSync(temporary, output);
  console.log(
    JSON.stringify({
      parameters,
      active: active.summary.outcome,
      time: active.summary.time,
      choices: active.choices,
      stats: active.summary.stats,
      unattended: none ? { outcome: none.summary.outcome, time: none.summary.time } : null,
    }),
  );
  if (active.summary.outcome === 'won') break;
}
