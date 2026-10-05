#!/usr/bin/env node
/** Reproducible headless play qualification. Uses public inputs and earned cards only. */
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { canonicalJSON } from '../game/data-json.mjs';
import {
  QUALIFICATION_BUILDS,
  NO_PULSE_QUALIFICATION_BUILDS,
  OVERFLIGHT_AUDIT_ROUTES,
  createOverflightAuditPilot,
  pilot,
  selectCard,
} from '../game/overflight/review-pilot.mjs';
export { QUALIFICATION_BUILDS } from '../game/overflight/review-pilot.mjs';
import {
  createOverflightRun,
  startOverflight,
  stepOverflight,
  chooseOverflightUpgrade,
  overflightSummary,
} from '../game/overflight/core.mjs';
import { compileOverflightProject, createOverflightProject } from '../game/overflight/project.mjs';

const round = (value) => Math.round(value * 100) / 100;
const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const evidenceDirectory = resolve(repositoryRoot, 'docs/qualification/overflight');
const implementationBaseMainSha = '2d447bc790bdf3951251c99041c8a918363ece0a';
const qualifiedSourcePaths = [
  'game/data-json.mjs',
  'game/overflight/core.mjs',
  'game/overflight/grid.mjs',
  'game/overflight/project.mjs',
  'game/overflight/review-pilot.mjs',
  'game/overflight/upgrades.mjs',
  'scripts/qualify-overflight.mjs',
];
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const jsonHash = (value) => sha256(canonicalJSON(value));

function sourceBindings() {
  return qualifiedSourcePaths.map((path) => {
    const bytes = readFileSync(resolve(repositoryRoot, path));
    return { path, bytes: bytes.length, sha256: sha256(bytes) };
  });
}

export function qualifyOverflight({
  seed = 17031991,
  direction = 'fan',
  airframes = 1,
  route = 'tight',
  limit = 480,
  project = null,
  encounterSet = 'front',
} = {}) {
  if (!QUALIFICATION_BUILDS[direction] && !NO_PULSE_QUALIFICATION_BUILDS[direction])
    throw new Error('Unknown qualification build.');
  if (!['tight', 'orbit', 'figure-eight', ...OVERFLIGHT_AUDIT_ROUTES].includes(route))
    throw new Error('Unknown pilot route.');
  const auditPilot = OVERFLIGHT_AUDIT_ROUTES.includes(route)
    ? createOverflightAuditPilot(route)
    : null;
  const compiled = compileOverflightProject(
    project ?? createOverflightProject({ seed, encounterSet }),
  );
  const run = createOverflightRun(compiled, { airframes });
  startOverflight(run);
  let input = {},
    firstDraft = null,
    evolution = null,
    draftBlocked = null;
  const samples = [];
  const densityPeaks = { opening: 0, developing: 0, late: 0, finale: 0 };
  const densityExposure = { above800Ticks: 0, longestAbove800Ticks: 0, peakAt: null };
  let above800Streak = 0,
    priorPeak = 0,
    firstAuditDamage = null;
  const auditMotion = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
    maximumDistanceFromStart: 0,
  };
  const started = performance.now();
  while (run.phase !== 'won' && run.phase !== 'lost' && run.time < limit) {
    while (run.phase === 'upgrade') {
      if (firstDraft === null) firstDraft = round(run.time);
      const card = selectCard(run, direction);
      if (!card) {
        draftBlocked = {
          time: round(run.time),
          offers: run.offers.map((offer) => offer.id),
          rerollsRemaining: run.progression.rerolls,
        };
        break;
      }
      if (!chooseOverflightUpgrade(run, card.id))
        throw new Error('Pilot selected an illegal card.');
      if (card.kind === 'evolution' && evolution === null) evolution = round(run.time);
    }
    if (draftBlocked) break;
    if (run.tick % 6 === 0) input = auditPilot ? auditPilot.input(run) : pilot(run, route);
    stepOverflight(run, input);
    if (
      auditPilot &&
      auditPilot.state.startedAt !== null &&
      firstAuditDamage === null &&
      run.stats.damageTaken > auditPilot.state.damageAtStart
    )
      firstAuditDamage = run.time;
    if (
      auditPilot &&
      auditPilot.state.startedAt !== null &&
      run.airframesRemaining === auditPilot.state.airframesAtStart
    ) {
      auditMotion.minX = Math.min(auditMotion.minX, run.player.x);
      auditMotion.maxX = Math.max(auditMotion.maxX, run.player.x);
      auditMotion.minY = Math.min(auditMotion.minY, run.player.y);
      auditMotion.maxY = Math.max(auditMotion.maxY, run.player.y);
      auditMotion.maximumDistanceFromStart = Math.max(
        auditMotion.maximumDistanceFromStart,
        Math.hypot(
          run.player.x - auditPilot.state.origin.x,
          run.player.y - auditPilot.state.origin.y,
        ),
      );
    }
    const window =
      run.time < 60
        ? 'opening'
        : run.time < 180
          ? 'developing'
          : run.time < 300
            ? 'late'
            : 'finale';
    densityPeaks[window] = Math.max(densityPeaks[window], run.stats.enemiesVisible);
    if (run.stats.enemiesVisible > 800) {
      densityExposure.above800Ticks++;
      densityExposure.longestAbove800Ticks = Math.max(
        densityExposure.longestAbove800Ticks,
        ++above800Streak,
      );
    } else above800Streak = 0;
    if (run.stats.enemiesVisible > priorPeak) {
      priorPeak = run.stats.enemiesVisible;
      densityExposure.peakAt = {
        time: run.time,
        visible: priorPeak,
        alive: run.stats.enemiesAlive,
        encounter: run.encounter,
        x: run.player.x,
        y: run.player.y,
        hull: run.player.hull,
      };
    }
    if (run.tick % 300 === 0)
      samples.push({
        time: run.time,
        hull: run.player.hull,
        alive: run.stats.enemiesAlive,
        visible: run.stats.enemiesVisible,
        kills: run.stats.kills,
        xp: run.progression.xp,
        choices: run.progression.choices,
      });
  }
  const summary = overflightSummary(run);
  return {
    direction,
    route,
    seed: run.seed,
    projectIdentity: compiled.projectIdentity,
    encounterSet: project ? null : encounterSet,
    airframes,
    qualification: 'ordinary-inputs-earned-upgrades-no-fixture',
    controller: 'deterministic-10hz-candidate-pilot-v1',
    ...(auditPilot
      ? {
          audit: {
            ...auditPilot.state,
            firstDamageAt: firstAuditDamage,
            firstAirframeMotion: {
              ...auditMotion,
              spanX: auditMotion.maxX - auditMotion.minX,
              spanY: auditMotion.maxY - auditMotion.minY,
            },
          },
        }
      : {}),
    outcome: draftBlocked ? 'draft-blocked' : summary.outcome,
    ...(draftBlocked ? { draftBlocked } : {}),
    simulatedSeconds: round(run.time),
    observedWallMilliseconds: round(performance.now() - started),
    firstDraftSeconds: firstDraft,
    primaryEvolutionSeconds: evolution,
    lastChoiceSeconds: summary.upgrades.at(-1)?.time ?? null,
    earnedChoices: run.progression.choices,
    kills: run.stats.kills,
    collectedXP: run.stats.xpCollected,
    groundXP: run.stats.xpOnGround,
    peakAlive: run.stats.peakAlive,
    peakVisible: run.stats.peakVisible,
    densityPeaks,
    densityExposure,
    damageTaken: run.stats.damageTaken,
    airframesRemaining: run.airframesRemaining,
    finalRemainingHull:
      run.enemies.find((enemy) => enemy.active && enemy.role === 'final')?.hp ?? null,
    build: summary.build,
    choices: summary.upgrades,
    samples,
  };
}

const stableResults = (results) => results.map(({ observedWallMilliseconds, ...result }) => result);
const compactResult = ({ samples, ...result }) => result;

function retainEvidence(path, evidence) {
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx' });
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
}

function reportOutcomes(evidence) {
  for (const result of evidence.results)
    console.log(
      JSON.stringify({
        encounterSet: result.encounterSet,
        seed: result.seed,
        direction: result.direction,
        airframes: result.airframes,
        outcome: result.outcome,
        seconds: result.simulatedSeconds,
        firstDraft: result.firstDraftSeconds,
        evolution: result.primaryEvolutionSeconds,
        choices: result.earnedChoices,
        peakVisible: result.peakVisible,
        remaining: result.airframesRemaining,
      }),
    );
}

/** Source-bound receipts are working-tree evidence, not a release or device gate. */
export function createQualificationEvidence({
  seeds,
  airframes,
  compact = false,
  route = 'tight',
  encounterSets = ['front'],
  buildDirections = Object.keys(QUALIFICATION_BUILDS),
}) {
  const before = sourceBindings();
  const startedAt = new Date().toISOString();
  const results = [];
  const projects = encounterSets.flatMap((encounterSet) =>
    seeds.map((seed) => {
      const source = createOverflightProject({ seed, encounterSet });
      const compiled = compileOverflightProject(source);
      return {
        seed,
        encounterSet,
        projectId: compiled.id,
        projectIdentity: compiled.projectIdentity,
        sourceSha256: jsonHash(source),
      };
    }),
  );
  for (const encounterSet of encounterSets)
    for (const seed of seeds)
      for (const direction of buildDirections)
        for (const count of airframes) {
          const result = qualifyOverflight({
            seed,
            direction,
            airframes: count,
            route,
            encounterSet,
          });
          results.push(compact ? compactResult(result) : result);
        }
  const after = sourceBindings();
  if (jsonHash(before) !== jsonHash(after))
    throw new Error('Qualified source changed during the run; no receipt may be accepted.');
  return {
    format: 'OverflightAutomatedRoutesEvidenceV1',
    startedAt,
    completedAt: new Date().toISOString(),
    implementationBaseMainSha,
    gitHeadAtRun: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    }).trim(),
    sourceKind: 'working-tree-candidate',
    environment: { node: process.version, platform: process.platform, architecture: process.arch },
    sourceBindings: before,
    sourceSetSha256: jsonHash(before),
    projects,
    protocol: {
      encounterSets,
      seeds,
      airframes,
      buildDirections,
      route,
      simulationHz: 60,
      pilotHz: 10,
      maximumSimulatedSeconds: 480,
      regularSpawnEndsAtSeconds: 360,
      finalDefeatEndsImmediately: true,
      compact,
      sampleEverySeconds: compact ? null : 5,
      modificationsDuringRun: 'movement/boost inputs and legal earned-card choices/rerolls only',
    },
    scopeLimits: [
      'Deterministic headless candidate pilot with full game-state access; no fixture population, HP, damage or XP injection.',
      'Only the listed encounter sets, seeds, builds and deterministic pilot inputs are exercised; these are not exhaustive difficulty or balance results.',
      'A successful automated route establishes reachability for these inputs, not human difficulty, fun, accessibility or physical controller acceptance.',
      'Wall time includes the Node pilot and is observational only; it is not browser FPS, GPU, frame-time, heap, thermal or target-hardware evidence.',
      'Source hashes bind the listed simulation/compiler/driver files; this is not a complete repository, native package, Community or release acceptance receipt.',
      'Timestamps and observed wall times change on replay; deterministic result hashes exclude only observedWallMilliseconds.',
    ],
    deterministicResultsSha256: jsonHash(stableResults(results)),
    results,
  };
}

function verifyEvidence(path, replay = false) {
  const evidence = JSON.parse(readFileSync(path, 'utf8'));
  if (evidence.format !== 'OverflightAutomatedRoutesEvidenceV1')
    throw new Error(`Unsupported evidence: ${path}`);
  if (
    evidence.sourceSetSha256 !== jsonHash(evidence.sourceBindings) ||
    evidence.sourceSetSha256 !== jsonHash(sourceBindings())
  )
    throw new Error(`Source binding mismatch: ${path}`);
  if (evidence.deterministicResultsSha256 !== jsonHash(stableResults(evidence.results)))
    throw new Error(`Results hash mismatch: ${path}`);
  for (const project of evidence.projects) {
    const source = createOverflightProject({
      seed: project.seed,
      encounterSet: project.encounterSet ?? 'front',
    });
    if (
      project.projectIdentity !== compileOverflightProject(source).projectIdentity ||
      project.sourceSha256 !== jsonHash(source)
    )
      throw new Error(`Project identity mismatch: ${path}`);
  }
  if (replay) {
    const result = createQualificationEvidence(evidence.protocol);
    if (result.deterministicResultsSha256 !== evidence.deterministicResultsSha256)
      throw new Error(`Deterministic replay mismatch: ${path}`);
  }
  return {
    file: path.slice(repositoryRoot.length),
    sourceMatches: true,
    projectIdentitiesMatch: true,
    resultsHashMatches: true,
    deterministicReplayMatches: replay ? true : null,
    runs: evidence.results.length,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const paths = ['automated-routes.json', 'additional-seeds.json', 'encounter-sets.json'].map(
    (name) => resolve(evidenceDirectory, name),
  );
  if (process.argv.includes('--write-evidence')) {
    mkdirSync(evidenceDirectory, { recursive: true });
    const baseline = createQualificationEvidence({ seeds: [17031991], airframes: [1, 3] });
    reportOutcomes(baseline);
    retainEvidence(paths[0], baseline);
    const additional = createQualificationEvidence({
      seeds: [42, 20261005],
      airframes: [3],
      compact: true,
      encounterSets: ['front', 'crossing', 'mixed'],
    });
    reportOutcomes(additional);
    retainEvidence(paths[1], additional);
    const encounters = createQualificationEvidence({
      seeds: [17031991],
      airframes: [3],
      compact: true,
      encounterSets: ['front', 'crossing', 'mixed'],
    });
    reportOutcomes(encounters);
    retainEvidence(paths[2], encounters);
    console.log(
      JSON.stringify(
        paths.map((path) => verifyEvidence(path)),
        null,
        2,
      ),
    );
  } else if (
    process.argv.includes('--verify-evidence') ||
    process.argv.includes('--replay-evidence')
  ) {
    console.log(
      JSON.stringify(
        paths.map((path) => verifyEvidence(path, process.argv.includes('--replay-evidence'))),
        null,
        2,
      ),
    );
  } else {
    const seed = Number(
      process.argv.find((value) => value.startsWith('--seed='))?.split('=')[1] ?? 17031991,
    );
    const route =
      process.argv.find((value) => value.startsWith('--route='))?.split('=')[1] ?? 'tight';
    const encounterSet =
      process.argv.find((value) => value.startsWith('--encounter-set='))?.split('=')[1] ?? 'front';
    const results = [];
    for (const direction of Object.keys(QUALIFICATION_BUILDS))
      for (const airframes of [1, 3])
        results.push(qualifyOverflight({ seed, direction, airframes, route, encounterSet }));
    console.log(
      JSON.stringify(
        {
          format: 'OverflightQualificationV1',
          note: 'Headless automated play is not a human fun, browser performance, or physical gamepad qualification.',
          results,
        },
        null,
        2,
      ),
    );
  }
}
