/** Evidence only: deliberate barrier passes followed by a normal complete Raid. */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { createExperimentalOverflightWorldProject } from '../../../../game/overflight/worlds.mjs';
import {
  createOverflightHuntProject,
  compileOverflightHuntProject,
} from '../../../../game/overflight/raid-project.mjs';
import {
  createOverflightHuntRun,
  startOverflightHunt,
  stepOverflightHunt,
  chooseOverflightHuntUpgrade,
  overflightHuntSummary,
} from '../../../../game/overflight/raid-core.mjs';
import { createExperimentalRaidPilot } from './experimental-raid-route-policy.mjs';
import { terrainWaypoint } from './experimental-raid-navigation.mjs';
import { qualifyWorld } from '../../../../scripts/qualify-overflight-worlds.mjs';
const gameDir = new URL('../../../../game/overflight/', import.meta.url);
const hashes = () =>
  Object.fromEntries(
    readdirSync(gameDir)
      .filter((p) => p.endsWith('.mjs'))
      .sort()
      .map((p) => [
        p,
        createHash('sha256')
          .update(readFileSync(new URL(p, gameDir)))
          .digest('hex'),
      ]),
  );
const beforeHashes = hashes(),
  commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const project = createExperimentalOverflightWorldProject(createOverflightHuntProject, {
  seed: 17,
  difficulty: 'standard',
});
const run = createOverflightHuntRun(compileOverflightHuntProject(project), { airframes: 3 });
const pilot = createExperimentalRaidPilot({ route: 'objectives', build: 'pursuer' });
const barrier = run.terrain.obstacles.find((o) => o.id === 'breach-north');
const approach = { x: barrier.x + barrier.width + 85, y: barrier.y + barrier.height / 2 };
const passThrough = { x: barrier.x - 55, y: approach.y };
let stage = 'approach',
  nextSample = 0,
  boostHeld = false;
const stages = [{ time: 0, stage }],
  strikes = [],
  samples = [],
  choices = [];
const setStage = (value) => {
  if (stage !== value) {
    stage = value;
    stages.push({ time: run.time, stage });
  }
};
const move = (target) => {
  const point = terrainWaypoint(run.terrain, run.player, target, run.compiled.arena),
    dx = point.x - run.player.x,
    dy = point.y - run.player.y,
    d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: dy / d, boost: false };
};
const resources = () => ({
  kills: run.stats.kills,
  xpEarned: run.stats.xpEarned,
  score: run.hunt.score,
  rushCharge: run.hunt.rushCharge,
  pendingChoices: run.hunt.pendingChoices,
  armorHits: run.hunt.armorHits,
  objectives: run.hunt.objectivesCompleted,
  boostCooldown: run.player.boostCooldown,
});
startOverflightHunt(run);
while (['playing', 'upgrade'].includes(run.phase) && run.time < 480) {
  if (run.phase === 'upgrade') {
    const card = pilot.choose(run);
    if (!card || !chooseOverflightHuntUpgrade(run, card.id)) break;
    choices.push({ time: run.time, id: card.id });
    continue;
  }
  const p = run.player;
  let input;
  if (stage === 'approach' || stage === 'retreat') {
    // The deliberate contact ends inside the navigator's extra safety margin.
    // Retreat along the known clear east side using ordinary steering first.
    input = stage === 'retreat' ? { x: 1, y: 0, boost: false } : move(approach);
    if (Math.hypot(p.x - approach.x, p.y - approach.y) < 4) {
      setStage('wait');
      input = { x: 0, y: 0, boost: false };
    }
  } else if (stage === 'wait') {
    input = { x: 0, y: 0, boost: false };
    if (p.boostCooldown <= 0) {
      setStage('strike');
      boostHeld = true;
      input = { x: -1, y: 0, boost: true };
    }
  } else if (stage === 'strike') {
    input = { x: -1, y: 0, boost: boostHeld };
    if (!barrier.active) {
      setStage('pass-through');
      boostHeld = false;
    } else if (p.boostRemaining <= 0 && barrier.hp === 1) {
      setStage('retreat');
      boostHeld = false;
      input = { x: 1, y: 0, boost: false };
    }
  } else if (stage === 'pass-through') {
    input = move(passThrough);
    if (p.x < barrier.x - 40) {
      setStage('objectives');
      input = pilot.input(run);
    }
  } else input = pilot.input(run);
  const oldHP = barrier.hp,
    oldStrikeCount = run.terrain.strikes,
    before = resources(),
    beforeCooldown = p.boostCooldown;
  stepOverflightHunt(run, input, 1 / 60);
  if (barrier.hp !== oldHP)
    strikes.push({
      time: run.time,
      fromHP: oldHP,
      toHP: barrier.hp,
      strikesBefore: oldStrikeCount,
      strikesAfter: run.terrain.strikes,
      token: barrier.lastStrike,
      active: barrier.active,
      before,
      after: resources(),
      cooldownChange: p.boostCooldown - beforeCooldown,
      input,
      x: p.x,
      y: p.y,
    });
  if (run.time >= nextSample) {
    samples.push({
      time: run.time,
      stage,
      x: p.x,
      y: p.y,
      hull: p.hull,
      boost: p.boostRemaining,
      barrierHP: barrier.hp,
      barrierActive: barrier.active,
      objectives: run.hunt.objectivesCompleted,
    });
    nextSample += 1;
  }
}
const noRewardKeys = [
  'kills',
  'xpEarned',
  'score',
  'rushCharge',
  'pendingChoices',
  'armorHits',
  'objectives',
];
const summary = overflightHuntSummary(run);
const result = {
  seed: 17,
  outcome: run.phase,
  time: run.time,
  stage,
  strikes,
  stages,
  choices,
  samples,
  summary,
  finalTerrain: {
    strikes: run.terrain.strikes,
    revision: run.terrain.revision,
    barriers: run.terrain.obstacles
      .filter((o) => o.breakable)
      .map((o) => ({ id: o.id, hp: o.hp, active: o.active, lastStrike: o.lastStrike })),
  },
  checks: {
    exactlyTwoHits:
      strikes.length === 2 &&
      strikes[0].fromHP === 2 &&
      strikes[0].toHP === 1 &&
      strikes[1].fromHP === 1 &&
      strikes[1].toHP === 0,
    distinctBoostTokens: new Set(strikes.map((s) => s.token)).size === 2,
    noResourceAwardOnEitherHit:
      strikes.length === 2 &&
      strikes.every((s) => noRewardKeys.every((k) => s.before[k] === s.after[k])),
    noCooldownRefundOnEitherHit:
      strikes.length === 2 &&
      strikes.every((s) => s.cooldownChange > -0.05 && s.cooldownChange <= 0),
    fullObjectivesAfterDestruction: run.phase === 'won' && run.hunt.objectivesCompleted === 7,
    exactOnceDestruction: run.terrain.strikes === 2 && run.terrain.revision === 1,
  },
};
const baseline = [];
for (const world of ['field-crossing', 'freight-depot', 'relay-ruins'])
  baseline.push(
    qualifyWorld({ world, mode: 'raid', seed: 17031991, build: 'pursuer', baseline: true }),
  );
const metadata = {
  format: 'OverflightTerrainBarrierQualificationV1',
  commit,
  createdAt: new Date().toISOString(),
  sourceHashes: beforeHashes,
  sourceStable: JSON.stringify(beforeHashes) === JSON.stringify(hashes()),
  evidenceHashes: Object.fromEntries(
    [
      'experimental-raid-barrier-probe.mjs',
      'experimental-raid-route-policy.mjs',
      'experimental-raid-navigation.mjs',
    ].map((p) => [
      p,
      createHash('sha256')
        .update(readFileSync(new URL(p, import.meta.url)))
        .digest('hex'),
    ]),
  ),
  limits:
    'Accelerated automated correctness/reachability, not ordinary-player balance, native rendering or human readability. Barrier run earns upgrades; baseline runs disable upgrade offers before start and inject no power.',
  barrier: result,
  baseline,
};
writeFileSync(
  new URL('./experimental-raid-barrier-probe.json.gz', import.meta.url),
  gzipSync(JSON.stringify(metadata, null, 2) + '\n', { level: 9 }),
);
console.log(
  JSON.stringify(
    {
      barrier: {
        outcome: result.outcome,
        time: result.time,
        checks: result.checks,
        strikes: result.strikes,
      },
      baseline: baseline.map((r) => ({
        world: r.world,
        outcome: r.outcome,
        time: r.time,
        damage: r.damageTaken,
        objectives: r.objectives,
        choices: r.choices.length,
      })),
    },
    null,
    2,
  ),
);
