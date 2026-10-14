/** Evidence harness only. Default uses the unchanged public pilot; --terrain-aware
 * selects an evidence-only visibility-graph extension, never production code. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { createExperimentalRaidPilot } from './experimental-raid-route-policy.mjs';
const terrainAware = process.argv.includes('--terrain-aware');
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
import { createOverflightHuntReviewPilot } from '../../../../game/overflight/raid-review-pilot.mjs';
import { overflightTerrainHit } from '../../../../game/overflight/terrain.mjs';
const paths = [
  'worlds.mjs',
  'raid-project.mjs',
  'raid-core.mjs',
  'raid-review-pilot.mjs',
  'terrain.mjs',
  'tactics.mjs',
  'tactical-view.mjs',
  'core.mjs',
];
const hashes = () =>
  Object.fromEntries(
    paths.map((path) => [
      path,
      createHash('sha256')
        .update(readFileSync(new URL(`../../../../game/overflight/${path}`, import.meta.url)))
        .digest('hex'),
    ]),
  );
const initialHashes = hashes();
const results = [];
for (const seed of [17031991, 17, 42]) {
  const project = createExperimentalOverflightWorldProject(createOverflightHuntProject, {
    seed,
    difficulty: 'standard',
  });
  const compiled = compileOverflightHuntProject(project);
  const run = createOverflightHuntRun(compiled, { airframes: 3 });
  const pilot = (terrainAware ? createExperimentalRaidPilot : createOverflightHuntReviewPilot)({
    route: 'objectives',
    build: 'pursuer',
  });
  const samples = [],
    choices = [];
  let nextSample = 0,
    blockedSteeringTicks = 0,
    draftError = false;
  startOverflightHunt(run);
  while (['playing', 'upgrade'].includes(run.phase) && run.time < 480) {
    if (run.phase === 'upgrade') {
      const card = pilot.choose(run);
      if (!card || !chooseOverflightHuntUpgrade(run, card.id)) {
        draftError = true;
        break;
      }
      choices.push({ time: run.time, id: card.id });
      continue;
    }
    const input = pilot.input(run);
    const p = run.player;
    const hit = overflightTerrainHit(
      run.terrain,
      p.x,
      p.y,
      p.x + input.x * 30,
      p.y + input.y * 30,
      p.radius,
    );
    if (hit) blockedSteeringTicks++;
    if (run.time >= nextSample) {
      samples.push({
        time: run.time,
        x: p.x,
        y: p.y,
        hull: p.hull,
        sector: run.hunt.sector,
        objectives: run.hunt.objectivesCompleted,
        input,
        obstacleAhead: hit?.obstacle?.id ?? null,
        remaining: run.enemies
          .filter((e) => e.active && e.objectiveId)
          .map((e) => ({ id: e.objectiveId, x: e.x, y: e.y, armor: e.armorSegments })),
      });
      nextSample += 2;
    }
    stepOverflightHunt(run, input, 1 / 60);
  }
  const summary = overflightHuntSummary(run);
  results.push({
    seed,
    projectId: compiled.id,
    projectIdentity: compiled.projectIdentity,
    outcome: draftError ? 'draft-error' : run.phase,
    time: run.time,
    objectivesCompleted: run.hunt.objectivesCompleted,
    kills: run.stats.kills,
    damageTaken: run.stats.damageTaken,
    airframesRemaining: run.airframesRemaining,
    blockedSteeringSeconds: blockedSteeringTicks / 60,
    choices,
    finalBarriers: run.terrain.obstacles
      .filter((o) => o.breakable)
      .map((o) => ({ id: o.id, active: o.active, hp: o.hp })),
    summary,
    samples,
  });
}
const afterHashes = hashes();
writeFileSync(
  new URL(
    terrainAware
      ? './experimental-raid-navigation-probe.json.gz'
      : './experimental-raid-probe.json.gz',
    import.meta.url,
  ),
  gzipSync(
    JSON.stringify(
      {
        format: 'OverflightExperimentalRaidEvidenceV1',
        commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        createdAt: new Date().toISOString(),
        policy: terrainAware
          ? 'Evidence-only derivative of objectives/pursuer pilot with visibility-graph routing around inflated terrain. Normal earned choices, steering and boost only.'
          : 'Existing objectives/pursuer public-input pilot, normal earned upgrade choices, no injected power or state edits.',
        limits: terrainAware
          ? 'Automated route reachability only, not human difficulty or native readability. No baseline-kit claim: normal earned upgrades remain enabled.'
          : 'The existing pilot has no obstacle-aware waypoint planning. These runs test this public-input route; failure does not establish geometric unreachability or human difficulty. No baseline-kit claim, because earned upgrades remain enabled.',
        sourceHashes: initialHashes,
        evidencePilotHashes: Object.fromEntries(
          [
            'experimental-raid-probe.mjs',
            'experimental-raid-route-policy.mjs',
            'experimental-raid-navigation.mjs',
          ].map((path) => [
            path,
            createHash('sha256')
              .update(readFileSync(new URL(path, import.meta.url)))
              .digest('hex'),
          ]),
        ),
        sourceStable: JSON.stringify(initialHashes) === JSON.stringify(afterHashes),
        settings: { difficulty: 'standard', airframes: 3, maxGameplaySeconds: 480 },
        results,
      },
      null,
      2,
    ) + '\n',
    { level: 9 },
  ),
);
console.log(
  JSON.stringify(
    results.map(
      ({ seed, outcome, time, objectivesCompleted, damageTaken, blockedSteeringSeconds }) => ({
        seed,
        outcome,
        time,
        objectivesCompleted,
        damageTaken,
        blockedSteeringSeconds,
      }),
    ),
    null,
    2,
  ),
);
