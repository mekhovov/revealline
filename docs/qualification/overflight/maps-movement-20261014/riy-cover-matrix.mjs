/** Qualification only: earn complete runs using public input, then fork earned state.
 * Defaults to a no-simulation plan. Explicit --run and a fresh output file are required. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../../../../', import.meta.url);
const configURL = new URL('./riy-cover-config.json', import.meta.url);
const config = JSON.parse(readFileSync(configURL, 'utf8'));
const provenanceURL = new URL(config.sourceProvenance, import.meta.url);
const sourceProvenance = JSON.parse(readFileSync(provenanceURL, 'utf8'));
assert.equal(sourceProvenance.candidateCommit, config.expectedRuntimeCommit);
const args = process.argv.slice(2);
const arg = (name) => args.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const shard = (arg('part') ?? '0/1').split('/').map(Number);
assert.ok(
  shard.length === 2 && shard.every(Number.isInteger) && shard[0] >= 0 && shard[0] < shard[1],
);
const requested = arg('cases')?.split(',').map(Number);
assert.ok(
  !requested || requested.every((index) => config.cases.some((row) => row.index === index)),
);
const selected = config.cases.filter(
  (row) => row.index % shard[1] === shard[0] && (!requested || requested.includes(row.index)),
);
assert.deepEqual(selected.map((row) => row.index), [1], 'This probe is bounded to case 1 only.');
assert.equal(config.cases.length, 12);
assert.deepEqual(config.checkpoints, [60, 120, 180, 240]);
assert.equal(new Set(config.cases.map((row) => row.layout)).size, 12);
assert.equal(new Set(config.cases.map((row) => row.world)).size, 6);
assert.equal(new Set(config.cases.map((row) => row.seed)).size, 3);
for (const row of config.cases) {
  assert.deepEqual(
    row.branches.filter((branch) => !branch.supplemental).map((branch) => branch.checkpoint),
    config.checkpoints,
  );
  assert.ok(['survivor', 'riy'].includes(row.mode));
  assert.ok(config.builds.includes(row.build));
  assert.ok(['standard', 'veteran'].includes(row.difficulty));
  assert.ok([1, 3].includes(row.airframes));
  assert.ok(row.branches.every((branch) => config.policies.includes(branch.policy)));
}
const counts = (values) => {
  const result = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
};
function coverage(rows) {
  const branches = rows.flatMap((row) => row.branches.map((branch) => ({ ...row, ...branch })));
  return {
    baselines: rows.length,
    branches: branches.length,
    worlds: counts(rows.map((row) => row.world)),
    modes: counts(rows.map((row) => row.mode)),
    builds: counts(rows.map((row) => row.build)),
    seeds: counts(rows.map((row) => row.seed)),
    difficulty: counts(rows.map((row) => row.difficulty)),
    airframes: counts(rows.map((row) => row.airframes)),
    buildByMode: counts(rows.map((row) => `${row.mode}/${row.build}`)),
    difficultyByAirframes: counts(rows.map((row) => `${row.difficulty}/${row.airframes}`)),
    policies: counts(branches.map((row) => row.policy)),
    policyByMode: counts(branches.map((row) => `${row.mode}/${row.policy}`)),
    policyByCheckpoint: counts(branches.map((row) => `${row.checkpoint}/${row.policy}`)),
  };
}
const fullCoverage = coverage(config.cases);
for (const mode of ['survivor', 'riy'])
  for (const policy of config.policies)
    assert.ok(fullCoverage.policyByMode[`${mode}/${policy}`] > 0, `${mode}/${policy} missing`);
assert.equal(Object.keys(fullCoverage.difficultyByAirframes).length, 4);
const plan = {
  schema: 'OverflightExpandedEarnedMatrixPlanV1',
  simulationStarted: false,
  claim: config.coverageClaim,
  expectedRuntimeCommit: config.expectedRuntimeCommit,
  sourceProvenanceFile: config.sourceProvenance,
  fullCoverage,
  selectedCoverage: coverage(selected),
  selected,
};
if (!args.includes('--run') || args.includes('--plan')) {
  console.log(JSON.stringify(plan, null, 2));
  process.exit(0);
}

const output = arg('output');
assert.ok(output?.endsWith('.json.gz'), 'Use --output=<fresh-name>.json.gz for durable evidence.');
assert.ok(
  !existsSync(output) && !existsSync(`${output}.pending`),
  'Do not overwrite existing evidence.',
);
const wallBudget = Number(arg('wall-budget') ?? config.defaultWallBudgetSeconds);
assert.ok(Number.isFinite(wallBudget) && wallBudget > 0 && wallBudget <= 900);
const runtimeEntrypoints = [
  'game/overflight/project.mjs',
  'game/overflight/core.mjs',
  'game/overflight/riy-mode.mjs',
  'game/overflight/review-pilot.mjs',
];
// Trace relative static imports recursively so unrelated Raid edits do not invalidate
// Survivor evidence, while transitive shared-rule changes cannot silently pass.
function runtimeDependencies() {
  const found = new Map();
  const visit = (url) => {
    const path = fileURLToPath(url);
    if (found.has(path)) return;
    const source = readFileSync(url, 'utf8');
    found.set(path, url);
    for (const match of source.matchAll(/(?:from\s*|import\s*)['"](\.{1,2}\/[^'"]+)['"]/g))
      visit(new URL(match[1], url));
  };
  for (const entry of runtimeEntrypoints) visit(new URL(entry, root));
  return [...found.values()].sort((a, b) => a.href.localeCompare(b.href));
}
const runtimeURLs = runtimeDependencies();
const relative = (url) => fileURLToPath(url).slice(fileURLToPath(root).length);
const sourceURLs = [...runtimeURLs, configURL, provenanceURL, new URL(import.meta.url)];
const hashes = () =>
  Object.fromEntries(
    sourceURLs.map((url) => [
      relative(url),
      createHash('sha256').update(readFileSync(url)).digest('hex'),
    ]),
  );
const git = (...parameters) =>
  execFileSync('git', parameters, {
    cwd: fileURLToPath(root),
    encoding: 'utf8',
  }).trim();
git('diff', '--quiet', config.expectedRuntimeCommit, '--', ...runtimeURLs.map(relative));
const startHashes = hashes(),
  startHead = git('rev-parse', 'HEAD');
assert.equal(runtimeURLs.length, sourceProvenance.dependencyCount);
for (const [path, expected] of Object.entries(sourceProvenance.sourceHashes))
  assert.equal(startHashes[path], expected.candidate, `Candidate provenance mismatch: ${path}`);
const startedAt = new Date().toISOString(),
  startedClock = performance.now();
const deadline = startedClock + wallBudget * 1000;
let interrupted = false;
process.on('SIGINT', () => {
  interrupted = true;
});
process.on('SIGTERM', () => {
  interrupted = true;
});
const budgetExpired = () => interrupted || performance.now() >= deadline;

const project = await import(new URL('game/overflight/project.mjs', root));
const core = await import(new URL('game/overflight/core.mjs', root));
const { createOverflightRiyMode } = await import(new URL('game/overflight/riy-mode.mjs', root));
const { pilot, selectCard } = await import(new URL('game/overflight/review-pilot.mjs', root));
const { OVERFLIGHT_BATTLEFIELDS } = await import(new URL('game/overflight/battlefields.mjs', root));
const { overflightTerrainClear } = await import(new URL('game/overflight/terrain.mjs', root));
for (const row of selected)
  assert.ok(
    OVERFLIGHT_BATTLEFIELDS.some(
      (layout) => layout.id === row.layout && layout.world === row.world,
    ),
  );
const base = {
  createRun: core.createOverflightRun,
  step: core.stepOverflight,
  pilot,
  selectCard,
  createProject: project.createOverflightProject,
  compileProject: project.compileOverflightProject,
  defaultProject: null,
};
const modes = { survivor: base, riy: createOverflightRiyMode(base) };

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
    for (const [key, item] of value) copy.set(cloneState(key, seen), cloneState(item, seen));
  else if (value instanceof Set) for (const item of value) copy.add(cloneState(item, seen));
  else for (const key of Object.keys(value)) copy[key] = cloneState(value[key], seen);
  return copy;
}
function metric(run) {
  let sectors = 0,
    reachable = 0;
  for (const enemy of run.enemies)
    if (enemy.active && Math.hypot(enemy.x - run.player.x, enemy.y - run.player.y) < 300)
      sectors |=
        1 <<
        Math.floor(
          (Math.atan2(enemy.y - run.player.y, enemy.x - run.player.x) + Math.PI) / (Math.PI / 4),
        ) %
          8;
  for (const pickup of run.pickups)
    if (
      pickup.active &&
      overflightTerrainClear(
        run.terrain,
        run.player.x,
        run.player.y,
        pickup.x,
        pickup.y,
        run.player.radius,
      )
    )
      reachable += pickup.value;
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
function policyParameters(run, policy) {
  const player = run.player;
  const parameters = { origin: { x: player.x, y: player.y }, heading: player.heading };
  if (policy.startsWith('heading-')) parameters.heading = (Number(policy.slice(8)) * Math.PI) / 4;
  if (policy === 'wall') {
    const arena = run.compiled.arena;
    const candidates = [
      { id: 'arena-west', x: 0, y: player.y },
      { id: 'arena-east', x: arena.width, y: player.y },
      { id: 'arena-north', x: player.x, y: 0 },
      { id: 'arena-south', x: player.x, y: arena.height },
    ];
    for (const obstacle of run.terrain?.obstacles ?? [])
      if (obstacle.active !== false)
        candidates.push({
          id: obstacle.id,
          x: Math.max(obstacle.x, Math.min(obstacle.x + obstacle.width, player.x)),
          y: Math.max(obstacle.y, Math.min(obstacle.y + obstacle.height, player.y)),
          breakable: obstacle.breakable,
        });
    candidates.sort(
      (a, b) =>
        Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y) ||
        a.id.localeCompare(b.id),
    );
    parameters.wall = candidates[0];
    parameters.heading = Math.atan2(parameters.wall.y - player.y, parameters.wall.x - player.x);
  }
  return parameters;
}
function policyInput(policy, elapsed, parameters) {
  const result = { x: 0, y: 0, boost: false, focus: false };
  if (policy === 'park') return result;
  let angle = parameters.heading,
    sign = 1;
  if (policy === 'straight-shuttle') sign = Math.sin((elapsed * Math.PI) / 3) >= 0 ? 1 : -1;
  if (policy === 'tiny-circle') angle += elapsed * 9;
  if (policy === 'orbit') angle += elapsed * 0.8;
  return { ...result, x: Math.cos(angle) * sign, y: Math.sin(angle) * sign };
}
async function continueRun(run, row, policy = 'active', onCheckpoint = null) {
  const mode = modes[row.mode],
    initial = metric(run),
    trace = [initial],
    start = run.time;
  const parameters = policyParameters(run, policy),
    initialBuild = cloneState(run.build);
  const initialChoices = cloneState(run.progression.history);
  let input = { x: 0, y: 0, boost: false, focus: false },
    firstInput = true;
  let safeStart = start,
    safeKills = run.stats.kills,
    safeCollected = run.stats.xpCollected;
  let damage = run.stats.damageTaken,
    shield = run.stats.shieldBlocks;
  let lastSample = Math.floor(run.time / config.traceEverySeconds);
  let longest = { seconds: 0, kills: 0, collected: 0 },
    draftError = null,
    wallBudgetReached = false;
  while (['playing', 'upgrade'].includes(run.phase) && run.time < config.maxSimulationSeconds) {
    if (run.tick % 600 === 0) await new Promise((resolve) => setImmediate(resolve));
    if (run.tick % 60 === 0 && budgetExpired()) {
      wallBudgetReached = true;
      break;
    }
    if (run.phase === 'upgrade') {
      const card = mode.selectCard(run, row.build);
      if (!card || !core.chooseOverflightUpgrade(run, card.id)) {
        draftError = 'No legal earned card or confirmation failed';
        break;
      }
      continue;
    }
    onCheckpoint?.(run);
    if (firstInput || run.tick % 6 === 0) {
      firstInput = false;
      input =
        policy === 'active'
          ? mode.pilot(run, row.build)
          : policyInput(policy, run.time - start, parameters);
    }
    mode.step(run, input);
    if (run.stats.damageTaken !== damage || run.stats.shieldBlocks !== shield) {
      safeStart = run.time;
      safeKills = run.stats.kills;
      safeCollected = run.stats.xpCollected;
      damage = run.stats.damageTaken;
      shield = run.stats.shieldBlocks;
    }
    if (run.time - safeStart > longest.seconds)
      longest = {
        seconds: run.time - safeStart,
        kills: run.stats.kills - safeKills,
        collected: run.stats.xpCollected - safeCollected,
      };
    if (Math.floor(run.time / config.traceEverySeconds) > lastSample) {
      lastSample = Math.floor(run.time / config.traceEverySeconds);
      trace.push(metric(run));
    }
  }
  const final = metric(run);
  if (trace.at(-1).t !== final.t) trace.push(final);
  return {
    policy,
    policyParameters: parameters,
    checkpoint: start,
    phase: run.phase,
    time: run.time,
    censored: ['playing', 'upgrade'].includes(run.phase),
    wallBudgetReached,
    draftError,
    initial,
    final,
    initialBuild,
    finalBuild: run.build,
    initialChoices,
    longestSafeFarming: longest,
    stats: run.stats,
    choices: run.progression.history,
    damageCauses: run.stats.damageCauses,
    goals: run.goals,
    trace,
  };
}
const results = [];
function persist(complete = false) {
  const endHashes = hashes();
  const report = {
    schema: 'OverflightExpandedEarnedMatrixV1',
    complete,
    startedAt,
    savedAt: new Date().toISOString(),
    wallSeconds: (performance.now() - startedClock) / 1000,
    wallBudgetSeconds: wallBudget,
    expectedRuntimeCommit: config.expectedRuntimeCommit,
    startHead,
    endHead: git('rev-parse', 'HEAD'),
    sourceStable: JSON.stringify(startHashes) === JSON.stringify(endHashes),
    startHashes,
    endHashes,
    design: config,
    sourceProvenance,
    shard,
    selectedIndices: selected.map((row) => row.index),
    plannedCoverage: coverage(selected),
    notStarted: selected
      .filter((row) => !results.some((result) => result.index === row.index))
      .map((row) => row.index),
    limitations: [
      config.coverageClaim,
      'Build names are draft preferences; exact earned cards and builds are recorded, never injected.',
      'Missing checkpoints are unavailable, interrupted/capped branches inconclusive; neither is a pass.',
      'Policies continue unchanged after replacement and auto-resolve earned drafts; boost and Focus remain off.',
      'Wall holds one initial direction toward the closest cover/boundary; destroyed cover may cease blocking it.',
      'Tiny-circle/orbit are timed steering patterns, not teleportation or exact geometric routes after collisions.',
      'Direct-path reachable salvage is a geometric lower bound; it does not establish safe reachability.',
      'Active pilots and unattended losses do not establish ordinary-player difficulty, readability or enjoyment.',
      'Headless gameplay evidence does not establish browser render cadence or native presentation quality.',
    ],
    cases: results,
  };
  writeFileSync(`${output}.pending`, gzipSync(Buffer.from(JSON.stringify(report, null, 2) + '\n')));
  renameSync(`${output}.pending`, output);
}
persist();
for (const row of selected) {
  if (budgetExpired()) break;
  const mode = modes[row.mode];
  const compiled = mode.compileProject(
    mode.createProject({
      rulesVersion: config.rulesVersion,
      layout: row.layout,
      seed: row.seed,
      difficulty: row.difficulty,
    }),
  );
  const run = mode.createRun(compiled, { seed: row.seed, airframes: row.airframes });
  core.startOverflight(run);
  const snapshots = new Map();
  const baseline = await continueRun(run, row, 'active', (state) => {
    for (const checkpoint of config.checkpoints)
      if (!snapshots.has(checkpoint) && state.time >= checkpoint) {
        const copy = cloneState(state);
        assert.deepEqual(copy, state);
        assert.notEqual(copy.player, state.player);
        assert.notEqual(copy._grid.counts, state._grid.counts);
        snapshots.set(checkpoint, copy);
      }
  });
  const result = {
    ...row,
    projectIdentity: compiled.projectIdentity,
    balanceRevision: compiled.balanceRevision,
    baseline,
    branches: row.branches.map((branch) => ({ ...branch, unattendedCompletionGate: 'not-run' })),
  };
  results.push(result);
  persist();
  for (const [index, branch] of row.branches.entries()) {
    const snapshot = snapshots.get(branch.checkpoint);
    if (!snapshot) {
      result.branches[index] = {
        ...branch,
        unavailable: true,
        reason: `Active baseline ${baseline.phase} at ${baseline.time}s${baseline.censored ? ' (censored)' : ''}`,
        unattendedCompletionGate: 'unavailable',
      };
    } else if (budgetExpired()) {
      result.branches[index] = {
        ...branch,
        reason: 'Wall-clock budget exhausted before branch',
        unattendedCompletionGate: 'not-run',
      };
    } else {
      // The supplemental parked branch shares checkpoint 120, never the mutated continuation.
      const continuation = await continueRun(cloneState(snapshot), row, branch.policy);
      const remaining = compiled.duration - continuation.checkpoint;
      result.branches[index] = {
        ...continuation,
        requestedCheckpoint: branch.checkpoint,
        unavailable: false,
        remainingAtCheckpoint: remaining,
        unattendedCompletionGate:
          continuation.draftError || continuation.censored
            ? 'inconclusive'
            : remaining < 90
              ? 'out-of-scope'
              : continuation.phase === 'won'
                ? 'fail'
                : continuation.phase === 'lost'
                  ? 'pass'
                  : 'inconclusive',
      };
    }
    persist();
  }
  console.error(
    JSON.stringify({
      case: row.index,
      layout: row.layout,
      mode: row.mode,
      build: row.build,
      baseline: [baseline.phase, baseline.time],
      branches: result.branches.map((branch) => ({
        checkpoint: branch.requestedCheckpoint ?? branch.checkpoint,
        policy: branch.policy,
        phase: branch.phase,
        time: branch.time,
        gate: branch.unattendedCompletionGate,
        longestSafeFarming: branch.longestSafeFarming,
      })),
    }),
  );
}
persist(
  results.length === selected.length &&
    results.every(
      (row) =>
        !row.baseline.censored &&
        row.branches.every(
          (branch) => !['not-run', 'inconclusive'].includes(branch.unattendedCompletionGate),
        ),
    ),
);
