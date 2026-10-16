/** Earn builds through public input, then fork complete deterministic run state.
 * Cloning preserves earned state; it never grants equipment, health or rewards. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import {
  createOverflightProject,
  compileOverflightProject,
} from '../../../../game/overflight/project.mjs';
import {
  createOverflightRun,
  startOverflight,
  stepOverflight,
  chooseOverflightUpgrade,
} from '../../../../game/overflight/core.mjs';
import { createOverflightRiyMode } from '../../../../game/overflight/riy-mode.mjs';
import { pilot, selectCard } from '../../../../game/overflight/review-pilot.mjs';
import { OVERFLIGHT_BATTLEFIELDS } from '../../../../game/overflight/battlefields.mjs';
import { overflightTerrainClear } from '../../../../game/overflight/terrain.mjs';

const base = {
  createRun: createOverflightRun,
  step: stepOverflight,
  pilot,
  selectCard,
  createProject: createOverflightProject,
  compileProject: compileOverflightProject,
  defaultProject: null,
};
const modes = { survivor: base, riy: createOverflightRiyMode(base) };
const root = new URL('../../../../', import.meta.url);
const sourceFiles = [
  'core',
  'motion',
  'coordinated-movement',
  'tactics',
  'battlefields',
  'terrain',
  'grid',
  'project',
  'project-upgrade',
  'combat-profile',
  'flight-profile',
  'upgrades',
  'riy-core',
  'riy-mode',
  'riy-project',
  'riy-upgrades',
  'worlds',
  'world-layout-presentation',
  'review-pilot',
  'defeat-feed',
];
const hashes = () =>
  Object.fromEntries(
    [
      ...sourceFiles.map((id) => [
        `game/overflight/${id}.mjs`,
        new URL(`game/overflight/${id}.mjs`, root),
      ]),
      ['probe', new URL(import.meta.url)],
    ].map(([id, path]) => [id, createHash('sha256').update(readFileSync(path)).digest('hex')]),
  );
const head = () => execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const startHashes = hashes(),
  startedAt = new Date().toISOString(),
  startHead = head();
const checkpoints = [120, 180, 240],
  seeds = [17031991, 19910404, 26022022],
  builds = ['fan', 'echo', 'systems'];
const policies = ['park', 'straight-shuttle', 'tiny-circle'];
const maxSeconds = 720;
const shard = process.argv
  .find((x) => x.startsWith('--part='))
  ?.slice(7)
  .split('/')
  .map(Number) ?? [0, 1];
assert.ok(
  shard.length === 2 && shard.every(Number.isInteger) && shard[0] >= 0 && shard[0] < shard[1],
);
const cases = [];
const layouts = OVERFLIGHT_BATTLEFIELDS.filter((_, i) => i % 3 === 0);
for (let w = 0; w < layouts.length; w++)
  for (let m = 0; m < 2; m++)
    for (let s = 0; s < seeds.length; s++) {
      const index = cases.length;
      cases.push({
        index,
        layout: layouts[w].id,
        world: layouts[w].world,
        mode: ['survivor', 'riy'][m],
        seed: seeds[s],
        build: builds[(w + s) % 3],
        difficulty: (w + s + m) % 2 ? 'veteran' : 'standard',
        airframes: (w + 2 * s + m) % 2 ? 1 : 3,
        policies: checkpoints.map((_, c) => policies[(s + c) % policies.length]),
      });
    }
const requested = process.argv
  .find((arg) => arg.startsWith('--cases='))
  ?.slice(8)
  .split(',')
  .map(Number);
const selected = cases
  .filter((c) => c.index % shard[1] === shard[0] && (!requested || requested.includes(c.index)))
  .slice(0, process.argv.includes('--smoke') ? 1 : undefined);

function cloneState(value, seen = new Map()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);
  if (ArrayBuffer.isView(value)) {
    const copy = new value.constructor(value);
    seen.set(value, copy);
    return copy;
  }
  if (value instanceof ArrayBuffer) {
    const copy = value.slice(0);
    seen.set(value, copy);
    return copy;
  }
  const copy = Array.isArray(value)
    ? []
    : value instanceof Map
      ? new Map()
      : value instanceof Set
        ? new Set()
        : Object.create(Object.getPrototypeOf(value));
  seen.set(value, copy);
  if (value instanceof Map)
    for (const [k, v] of value) copy.set(cloneState(k, seen), cloneState(v, seen));
  else if (value instanceof Set) for (const v of value) copy.add(cloneState(v, seen));
  else for (const key of Object.keys(value)) copy[key] = cloneState(value[key], seen);
  return copy;
}
function metric(run) {
  let sectors = 0,
    reachable = 0;
  for (const e of run.enemies)
    if (e.active && Math.hypot(e.x - run.player.x, e.y - run.player.y) < 300)
      sectors |=
        1 <<
        Math.floor((Math.atan2(e.y - run.player.y, e.x - run.player.x) + Math.PI) / (Math.PI / 4)) %
          8;
  for (const p of run.pickups)
    if (
      p.active &&
      overflightTerrainClear(run.terrain, run.player.x, run.player.y, p.x, p.y, run.player.radius)
    )
      reachable += p.value;
  return {
    t: run.time,
    x: run.player.x,
    y: run.player.y,
    heading: run.player.heading,
    hull: run.player.hull,
    lives: run.airframesRemaining,
    kills: run.stats.kills,
    damage: run.stats.damageTaken,
    shield: run.stats.shieldBlocks,
    earned: run.stats.xpEarned,
    collected: run.stats.xpCollected,
    reachable,
    sectors,
    pattern: run.encounter,
    warningDeferrals: run.stats.warningDeferrals ?? 0,
    motionDeferrals: run.stats.motionDeferrals ?? 0,
  };
}
function policyInput(policy, t, heading) {
  if (policy === 'park') return { x: 0, y: 0, boost: false, focus: false };
  if (policy === 'tiny-circle')
    return { x: Math.cos(t * 9), y: Math.sin(t * 9), boost: false, focus: false };
  const sign = Math.sin((t * Math.PI) / 3) >= 0 ? 1 : -1;
  return { x: Math.cos(heading) * sign, y: Math.sin(heading) * sign, boost: false, focus: false };
}
function continueRun(run, config, policy = 'active', onCheckpoint = null) {
  const mode = modes[config.mode],
    initial = metric(run),
    trace = [initial],
    start = run.time,
    heading = run.player.heading;
  let input = { x: 0, y: 0, boost: false, focus: false },
    safeStart = start,
    safeKills = run.stats.kills,
    safeCollected = run.stats.xpCollected;
  let damage = run.stats.damageTaken,
    shield = run.stats.shieldBlocks,
    lastSample = Math.floor(run.time / 5);
  let longest = { seconds: 0, kills: 0, collected: 0 },
    draftError = null;
  while (['playing', 'upgrade'].includes(run.phase) && run.time < maxSeconds) {
    if (run.phase === 'upgrade') {
      const card = mode.selectCard(run, config.build);
      if (!card || !chooseOverflightUpgrade(run, card.id)) {
        draftError = 'No legal card or confirmation failed';
        break;
      }
      continue;
    }
    onCheckpoint?.(run);
    if (run.tick % 6 === 0)
      input =
        policy === 'active'
          ? mode.pilot(run, config.build)
          : policyInput(policy, run.time - start, heading);
    mode.step(run, input);
    if (run.stats.damageTaken !== damage || run.stats.shieldBlocks !== shield) {
      safeStart = run.time;
      safeKills = run.stats.kills;
      safeCollected = run.stats.xpCollected;
      damage = run.stats.damageTaken;
      shield = run.stats.shieldBlocks;
    }
    const interval = run.time - safeStart;
    if (interval > longest.seconds)
      longest = {
        seconds: interval,
        kills: run.stats.kills - safeKills,
        collected: run.stats.xpCollected - safeCollected,
      };
    if (Math.floor(run.time / 5) > lastSample) {
      lastSample = Math.floor(run.time / 5);
      trace.push(metric(run));
    }
  }
  const final = metric(run);
  if (trace.at(-1).t !== final.t) trace.push(final);
  return {
    policy,
    checkpoint: start,
    phase: run.phase,
    time: run.time,
    censored: !draftError && run.phase === 'playing',
    draftError,
    initial,
    final,
    longestSafeFarming: longest,
    stats: run.stats,
    choices: run.progression.history,
    damageCauses: run.stats.damageCauses,
    goals: run.goals,
    trace,
  };
}
const results = [];
for (const config of selected) {
  const mode = modes[config.mode],
    compiled = mode.compileProject(
      mode.createProject({
        rulesVersion: 4,
        layout: config.layout,
        seed: config.seed,
        difficulty: config.difficulty,
      }),
    );
  const run = mode.createRun(compiled, { seed: config.seed, airframes: config.airframes });
  startOverflight(run);
  const snapshots = new Map();
  const baseline = continueRun(run, config, 'active', (state) => {
    for (const checkpoint of checkpoints)
      if (!snapshots.has(checkpoint) && state.time >= checkpoint) {
        const copy = cloneState(state);
        assert.deepEqual(copy, state);
        assert.notEqual(copy.player, state.player);
        assert.notEqual(copy._grid.counts, state._grid.counts);
        snapshots.set(checkpoint, copy);
      }
  });
  const branches = checkpoints.map((checkpoint, i) => {
    const copy = snapshots.get(checkpoint);
    if (!copy)
      return {
        checkpoint,
        policy: config.policies[i],
        unavailable: true,
        reason: `Active baseline ${baseline.phase} at ${baseline.time}s`,
        unattendedCompletionGate: 'unavailable',
      };
    const result = continueRun(copy, config, config.policies[i]);
    return {
      ...result,
      unavailable: false,
      remainingAtCheckpoint: compiled.duration - checkpoint,
      unattendedCompletionGate:
        result.draftError || result.censored
          ? 'inconclusive'
          : result.phase === 'won'
            ? 'fail'
            : 'pass',
    };
  });
  const row = {
    ...config,
    projectIdentity: compiled.projectIdentity,
    balanceRevision: compiled.balanceRevision,
    baseline,
    branches,
  };
  results.push(row);
  console.error(
    JSON.stringify({
      case: config.index,
      ...config,
      baseline: [baseline.phase, baseline.time],
      branches: branches.map((b) => ({
        checkpoint: b.checkpoint,
        policy: b.policy,
        phase: b.phase,
        time: b.time,
        gate: b.unattendedCompletionGate,
        longestSafeFarming: b.longestSafeFarming,
      })),
    }),
  );
}
const endHashes = hashes();
const report = {
  schema: 'OverflightEarnedCheckpointMatrixV1',
  startedAt,
  endedAt: new Date().toISOString(),
  startHead,
  endHead: head(),
  sourceStable: JSON.stringify(startHashes) === JSON.stringify(endHashes),
  startHashes,
  endHashes,
  shard,
  design: {
    baselineCount: 36,
    plannedBranchCount: 108,
    seeds,
    builds,
    checkpoints,
    policies,
    maxSeconds,
    traceEverySeconds: 5,
    rotation:
      'Each world/mode sees all three seeds and builds; difficulty and airframes alternate by world, seed and mode. Each baseline branches into one rotating policy per checkpoint.',
  },
  limitations: [
    'Pairwise dimension coverage, not the full Cartesian matrix.',
    'Only the first layout in each world; cover-layout evidence remains in the fixed-lane probe.',
    'A baseline that cannot reach a checkpoint yields an unavailable branch, not a pass.',
    'Remaining gameplay is continued through defeat or completion, capped at 720 seconds; cap/draft failure is inconclusive.',
    'An unattended win is rejected; a loss does not establish enjoyment, visual readability or acceptable active-pilot difficulty.',
    'Direct-path reachable salvage may omit valid bent routes.',
    'Review pilots are correctness instruments, not ordinary-player difficulty evidence.',
  ],
  cases: results,
};
const output = process.argv.find((x) => x.endsWith('.json') || x.endsWith('.json.gz'));
const bytes = Buffer.from(JSON.stringify(report, null, 2) + '\n');
if (output) writeFileSync(output, output.endsWith('.gz') ? gzipSync(bytes) : bytes);
else console.log(bytes.toString());
