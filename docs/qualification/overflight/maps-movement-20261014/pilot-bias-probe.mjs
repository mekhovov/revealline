/** Read-only qualification: six fixed earned runs, public controls, no grants or rule edits.
 * Default is provenance/plan only. Execution requires --run and a new gzip evidence path. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../../../../', import.meta.url);
const configURL = new URL('./pilot-bias-config.json', import.meta.url);
const readJSON = (url) => JSON.parse(readFileSync(url, 'utf8'));
const config = readJSON(configURL);
const provenanceURL = new URL(config.sourceProvenance, import.meta.url);
const provenance = readJSON(provenanceURL);
const originalConfigURL = new URL(config.originalConfig, import.meta.url);
const originalConfig = readJSON(originalConfigURL);
const originalEvidenceURL = new URL(config.originalEvidence, import.meta.url);
const originalBuffer = gunzipSync(readFileSync(originalEvidenceURL));
const original = JSON.parse(originalBuffer);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const args = process.argv.slice(2);
const arg = (name) => args.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const relative = (url) => fileURLToPath(url).slice(fileURLToPath(root).length);
const git = (...parameters) =>
  execFileSync('git', parameters, {
    cwd: fileURLToPath(root),
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  }).trim();
const runtimeURLs = Object.keys(provenance.sourceHashes).map((path) => new URL(path, root));
const sourceURLs = [
  ...runtimeURLs,
  configURL,
  provenanceURL,
  originalConfigURL,
  new URL(import.meta.url),
];
const hashes = () =>
  Object.fromEntries(sourceURLs.map((url) => [relative(url), sha256(readFileSync(url))]));
const startHashes = hashes();
assert.equal(provenance.candidateCommit, config.expectedRuntimeCommit);
assert.equal(runtimeURLs.length, 33);
git('diff', '--quiet', config.expectedRuntimeCommit, '--', ...runtimeURLs.map(relative));
for (const [path, expected] of Object.entries(provenance.sourceHashes))
  assert.equal(startHashes[path], expected.candidate, `Runtime provenance mismatch: ${path}`);
assert.equal(original.complete, true);
assert.equal(original.sourceStable, true);
assert.equal(original.expectedRuntimeCommit, config.expectedRuntimeCommit);
assert.equal(config.cases.length, 6);
const selected = config.cases.map((entry) => {
  const row = originalConfig.cases.find((candidate) => candidate.index === entry.originalIndex);
  assert.ok(row);
  assert.ok(['tight', 'figure-eight'].includes(entry.route));
  assert.ok(['normal', 'priority'].includes(entry.focusPolicy));
  assert.ok(entry.focusPolicy !== 'priority' || row.mode === 'riy');
  const previous = original.cases.find((candidate) => candidate.index === row.index);
  for (const key of ['mode', 'world', 'layout', 'seed', 'build', 'difficulty', 'airframes'])
    assert.equal(previous[key], row[key], `Original evidence/config mismatch: ${row.index}/${key}`);
  const { branches, ...parameters } = row;
  return {
    ...parameters,
    ...entry,
    originalBaseline: {
      phase: previous.baseline.phase,
      time: previous.baseline.time,
      choices: previous.baseline.choices,
      finalBuild: previous.baseline.finalBuild,
      stats: previous.baseline.stats,
      goals: previous.baseline.goals,
    },
  };
});
assert.equal(selected.find((row) => row.originalIndex === 4).airframes, 1);
assert.equal(selected.find((row) => row.originalIndex === 7).airframes, 3);
const startHead = git('rev-parse', 'HEAD');
const plan = {
  schema: 'OverflightPilotBiasPlanV1',
  simulationStarted: false,
  expectedRuntimeCommit: config.expectedRuntimeCommit,
  head: startHead,
  runtimeDependencyCount: runtimeURLs.length,
  sourceHashes: startHashes,
  originalEvidenceRawSHA256: sha256(originalBuffer),
  originalEvidence: config.originalEvidence,
  selected,
  scope:
    'Exactly six fixed same-seed runs. Route/Focus changes only; earned card preferences remain identical. No parameter search.',
};
if (!args.includes('--run') || args.includes('--plan')) {
  console.log(JSON.stringify(plan, null, 2));
  process.exit(0);
}
const output = arg('output');
assert.ok(output?.endsWith('.json.gz'), 'A fresh --output=<name>.json.gz is required.');
assert.ok(!existsSync(output) && !existsSync(`${output}.pending`), 'Never overwrite evidence.');
const startedAt = new Date().toISOString(),
  startedClock = performance.now();
let interrupted = false;
process.on('SIGINT', () => {
  interrupted = true;
});
process.on('SIGTERM', () => {
  interrupted = true;
});
const budgetExpired = () =>
  interrupted || performance.now() - startedClock >= config.wallBudgetSeconds * 1000;
const project = await import(new URL('game/overflight/project.mjs', root));
const core = await import(new URL('game/overflight/core.mjs', root));
const { createOverflightRiyMode } = await import(new URL('game/overflight/riy-mode.mjs', root));
const { overflightRiyTarget } = await import(new URL('game/overflight/riy-core.mjs', root));
const { pilot, selectCard } = await import(new URL('game/overflight/review-pilot.mjs', root));
const { overflightTerrainClear } = await import(new URL('game/overflight/terrain.mjs', root));
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
const copy = (value) => JSON.parse(JSON.stringify(value));
const results = [];
function persist(complete = false) {
  const endHashes = hashes();
  const report = {
    schema: 'OverflightPilotBiasEvidenceV1',
    complete,
    startedAt,
    savedAt: new Date().toISOString(),
    wallSeconds: (performance.now() - startedClock) / 1000,
    expectedRuntimeCommit: config.expectedRuntimeCommit,
    startHead,
    endHead: git('rev-parse', 'HEAD'),
    sourceStable: JSON.stringify(startHashes) === JSON.stringify(endHashes),
    startHashes,
    endHashes,
    plan,
    config,
    sourceProvenance: provenance,
    notStarted: selected
      .filter((row) => !results.some((result) => result.id === row.id))
      .map((row) => row.id),
    limitations: [
      'Fixed automated controls are diagnostic, not ordinary-player completion rates or enjoyment evidence.',
      'Route names modify the existing fallback route; nearest salvage and final-target goals can override it.',
      'Priority Focus only permits the current eligible elite/final candidate; it does not select another target.',
      'Builds are earned with unchanged draft preferences. Exact choices and build states are retained.',
      'Direct-path reachable salvage is geometric, not necessarily safe through the crowd.',
      'Target snapshots/footprints use current positions. They do not predict future hit success.',
      'Other priority targets are sampled with a twelve-actor bound; all active elite/final actors are retained.',
      'Final armor/health of disappeared targets is not inferred; explicit observed state/events remain authoritative.',
    ],
    cases: results,
  };
  writeFileSync(`${output}.pending`, gzipSync(Buffer.from(JSON.stringify(report, null, 2) + '\n')));
  renameSync(`${output}.pending`, output);
}
function snapshot(run) {
  const p = run.player;
  let directReachable = 0,
    nearby = 0,
    onGround = 0;
  for (const pickup of run.pickups)
    if (pickup.active) {
      onGround += pickup.value;
      if (Math.hypot(pickup.x - p.x, pickup.y - p.y) < 300) nearby += pickup.value;
      if (overflightTerrainClear(run.terrain, p.x, p.y, pickup.x, pickup.y, p.radius))
        directReachable += pickup.value;
    }
  const pending = run._echoes
    .filter((effect) => effect.active)
    .map((effect) => ({
      x: effect.x,
      y: effect.y,
      radius: effect.radius,
      damage: effect.damage,
      remaining: effect.remaining,
      kind: effect.kind,
    }));
  const relevant = run.enemies.filter(
    (enemy) =>
      enemy.active &&
      (['elite', 'final', 'support'].includes(enemy.role) ||
        enemy.maxArmor > 0 ||
        enemy.markUntil > run.tick),
  );
  const targets = relevant.filter((enemy) => ['elite', 'final'].includes(enemy.role));
  targets.push(
    ...relevant
      .filter((enemy) => !['elite', 'final'].includes(enemy.role))
      .sort(
        (a, b) =>
          Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y) || a.id - b.id,
      )
      .slice(0, 12),
  );
  const candidate = run.riy ? overflightRiyTarget(run) : null;
  const lastDraft = run.progression.history.at(-1)?.time ?? 0;
  return {
    t: run.time,
    phase: run.phase,
    player: { x: p.x, y: p.y, heading: p.heading, hull: p.hull, lives: run.airframesRemaining },
    kills: run.stats.kills,
    damage: run.stats.damageTaken,
    shield: run.stats.shieldBlocks,
    goals: { ...run.goals },
    progression: {
      choices: run.progression.choices,
      earned: run.stats.xpEarned,
      collected: run.stats.xpCollected,
      onGround,
      directReachable,
      nearby,
      nextThreshold: run.progression.nextThreshold,
      deficit:
        run.progression.nextThreshold === null
          ? null
          : Math.max(0, run.progression.nextThreshold - run.progression.xp),
      secondsSinceDraft: run.time - lastDraft,
    },
    targets: targets.map((enemy) => ({
      id: enemy.id,
      family: enemy.family,
      role: enemy.role,
      x: enemy.x,
      y: enemy.y,
      hp: enemy.hp,
      maxHp: enemy.maxHp,
      armor: enemy.armor,
      maxArmor: enemy.maxArmor,
      armorSegments: enemy.armorSegments,
      exposureRemaining: enemy.exposureRemaining,
      attackWarning: enemy.attackWarning,
      spawnWarning: enemy.warning,
      marked: enemy.markUntil > run.tick,
      markUntil: enemy.markUntil,
      distance: Math.hypot(enemy.x - p.x, enemy.y - p.y),
      lineOfSight: overflightTerrainClear(run.terrain, p.x, p.y, enemy.x, enemy.y),
      directApproachClear: overflightTerrainClear(
        run.terrain,
        p.x,
        p.y,
        enemy.x,
        enemy.y,
        p.radius,
      ),
      pendingFootprints: pending.map((effect, index) => ({
        index,
        overlapsCurrentBody:
          Math.hypot(effect.x - enemy.x, effect.y - enemy.y) <= effect.radius + enemy.radius,
        lineOfSight: overflightTerrainClear(run.terrain, effect.x, effect.y, enemy.x, enemy.y),
      })),
    })),
    pendingPayloads: pending,
    riy: run.riy
      ? {
          phase: run.riy.phase,
          targetId: run.riy.targetId,
          candidateId: candidate?.id ?? null,
          candidateRole: candidate?.role ?? null,
          cooldown: run.riy.cooldown,
          focusRemaining: run.riy.focusRemaining,
          approachRemaining: run.riy.approachRemaining,
          commands: run.riy.commands,
          engagements: run.riy.engagements,
          escorts: run.riy.escorts.map((escort) => ({
            role: escort.role,
            x: escort.x,
            y: escort.y,
            heading: escort.heading,
            formationHeading: escort.formationHeading,
            shots: escort.shots,
            cooldown: escort.cooldown,
          })),
        }
      : null,
  };
}
persist();
for (const row of selected) {
  if (budgetExpired()) break;
  const mode = modes[row.mode];
  const compiled = mode.compileProject(
    mode.createProject({
      rulesVersion: originalConfig.rulesVersion,
      layout: row.layout,
      seed: row.seed,
      difficulty: row.difficulty,
    }),
  );
  const run = mode.createRun(compiled, { seed: row.seed, airframes: row.airframes });
  core.startOverflight(run);
  const result = {
    ...row,
    projectIdentity: compiled.projectIdentity,
    balanceRevision: compiled.balanceRevision,
    complete: false,
    trace: [snapshot(run)],
    events: [],
    drafts: [],
    inputDecisions: 0,
    focusPermitted: 0,
    focusSuppressed: 0,
  };
  results.push(result);
  persist();
  let input,
    lastSample = 0,
    lastSave = 0;
  let priorDamage = run.stats.damageTaken,
    priorLives = run.airframesRemaining;
  while (['playing', 'upgrade'].includes(run.phase) && run.time < config.maxSimulationSeconds) {
    if (run.tick % 600 === 0) await new Promise((resolve) => setImmediate(resolve));
    if (run.tick % 60 === 0 && budgetExpired()) {
      result.wallBudgetReached = true;
      break;
    }
    if (run.phase === 'upgrade') {
      const card = mode.selectCard(run, row.build);
      const before = snapshot(run);
      if (!card || !core.chooseOverflightUpgrade(run, card.id)) {
        result.draftError = 'No legal earned card or confirmation failed';
        break;
      }
      result.drafts.push({ t: run.time, card: card.id, before, build: copy(run.build) });
      continue;
    }
    if (!input || run.tick % 6 === 0) {
      input = mode.pilot(run, row.route);
      result.inputDecisions++;
      if (input.focus && row.focusPolicy === 'priority') {
        const target = overflightRiyTarget(run);
        if (!['elite', 'final'].includes(target?.role)) {
          input.focus = false;
          result.focusSuppressed++;
        }
      }
      if (input.focus) result.focusPermitted++;
    }
    mode.step(run, input);
    if (run.stats.damageTaken !== priorDamage || run.airframesRemaining !== priorLives) {
      result.events.push({
        t: run.time,
        kind: 'damage-or-replacement',
        damage: run.stats.damageTaken - priorDamage,
        livesBefore: priorLives,
        livesAfter: run.airframesRemaining,
        damageCauses: { ...run.stats.damageCauses },
        x: run.player.x,
        y: run.player.y,
      });
      priorDamage = run.stats.damageTaken;
      priorLives = run.airframesRemaining;
    }
    if (Math.floor(run.time / config.traceEverySeconds) > lastSample) {
      lastSample = Math.floor(run.time / config.traceEverySeconds);
      result.trace.push(snapshot(run));
    }
    if (run.time - lastSave >= 60) {
      lastSave = run.time;
      persist();
    }
  }
  result.phase = run.phase;
  result.time = run.time;
  result.censored = ['playing', 'upgrade'].includes(run.phase);
  result.complete = !result.censored && !result.draftError;
  result.stats = copy(run.stats);
  result.goals = { ...run.goals };
  result.choices = copy(run.progression.history);
  result.finalBuild = copy(run.build);
  result.final = snapshot(run);
  if (result.trace.at(-1).t !== result.final.t) result.trace.push(result.final);
  persist();
  console.error(
    JSON.stringify({
      id: row.id,
      originalIndex: row.originalIndex,
      mode: row.mode,
      build: row.build,
      difficulty: row.difficulty,
      airframes: row.airframes,
      route: row.route,
      focusPolicy: row.focusPolicy,
      phase: result.phase,
      time: result.time,
      choices: result.choices.length,
      originalPhase: row.originalBaseline.phase,
      originalTime: row.originalBaseline.time,
      finalBuild: result.finalBuild,
      goals: result.goals,
    }),
  );
}
persist(results.length === selected.length && results.every((result) => result.complete));
