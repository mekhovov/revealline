import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compileContentProject } from '../game/content-design/project.mjs';
import { createUkrainianOrnamentJourney } from '../game/content-design/ukrainian-ornament-candidates.mjs';
import { createUkrainianOrnamentAtlasJourney } from '../game/content-design/ukrainian-ornament-atlas.mjs';
import { GAMEPLAY_TUNING_VERSION } from '../game/gameplay-tuning.mjs';
import { assessSpatialRoute, prepareSpatialMission } from './lib/spatial-challenge-assessment.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixtures = new URL('../game/test/fixtures/', import.meta.url);
const sourceGitBase = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
}).trim();
const study = compileContentProject(createUkrainianOrnamentJourney());
const atlas = compileContentProject(createUkrainianOrnamentAtlasJourney());
const pairSegments = (segments) =>
  segments.map((segment) =>
    Array.isArray(segment) ? segment : [segment.direction ?? null, segment.ticks],
  );
const objectSegments = (segments) =>
  pairSegments(segments).map(([direction, ticks]) => ({ direction, ticks }));
const outcome = (result) => ({
  status: result.status,
  ticks: result.ticks,
  cuts: result.cuts,
  losses: result.losses,
  failureCause: result.failureCause,
  coverage: result.coverage,
  coverageGoal: result.coverageGoal,
  checkpoint: result.checkpoint,
  sourceProjectIdentity: result.sourceProjectIdentity,
  authoredSimulationIdentity: result.authoredSimulationIdentity,
  simulationIdentity: result.simulationIdentity,
  levelIdentity: result.levelIdentity,
  ruleset: result.ruleset,
  gameplayTuning: result.gameplayTuning,
  objectives: result.objectives,
  replayVerified: result.replayVerified,
});
const replay = (project, missionId, difficulty, seed, turnPolicy, segments) => {
  const normalized = pairSegments(segments);
  return {
    segments: normalized,
    ...outcome(
      assessSpatialRoute(prepareSpatialMission(project, missionId, { difficulty }), {
        seed,
        turnPolicy,
        segments: objectSegments(normalized),
      }),
    ),
  };
};
const counts = (samples) =>
  Object.fromEntries(
    [...new Set(samples.map((sample) => sample.status))]
      .toSorted()
      .map((status) => [status, samples.filter((sample) => sample.status === status).length]),
  );
async function json(name) {
  return JSON.parse(await readFile(new URL(name, fixtures), 'utf8'));
}
async function buildStudyClear() {
  const old = await json('ukrainian-ornament-clear-routes.json');
  const rows = old.rows.map((row) => ({
    missionId: row.missionId,
    difficulty: row.difficulty,
    turnPolicy: row.turnPolicy,
    seed: row.seed,
    samples: (row.samples
      ? row.samples.map((sample) => [sample.sampleId, sample])
      : [
          ['opening', row.opening],
          ['original-continuation', row.originalContinuation],
          ['former-clear', row.result],
        ]
    ).map(([sampleId, sample]) => ({
      sampleId,
      ...replay(study, row.missionId, row.difficulty, row.seed, row.turnPolicy, sample.segments),
    })),
  }));
  const samples = rows.flatMap((row) => row.samples);
  return {
    format: 'UkrainianOrnamentV11ClearReplayAuditV1',
    sourceGitBase,
    gameplayVersion: GAMEPLAY_TUNING_VERSION,
    supersedes: {
      format: old.supersedes?.format ?? old.format,
      sourceProjectIdentity:
        old.supersedes?.sourceProjectIdentity ??
        old.rows[0].result?.sourceProjectIdentity ??
        '98161e7c0fba69c1',
      reason: 'The former v9-based clear evidence is not acceptance for the rebuilt v11 lineage.',
    },
    outcomes: counts(samples),
    rows,
  };
}
async function buildStudyMatrix() {
  const old = await json('ukrainian-ornament-routes.json');
  const rows = old.rows.map((row) => ({
    missionId: row.missionId,
    difficulty: row.difficulty,
    turnPolicy: row.turnPolicy,
    approach: row.approach,
    samples: (row.samples
      ? row.samples.map((sample) => [sample.sampleId, sample])
      : [
          ...row.attempts.map((sample, index) => [`attempt-${index + 1}`, sample]),
          ...(row.continuation ? [['continuation', row.continuation]] : []),
        ]
    ).map(([sampleId, sample]) => ({
      sampleId,
      seed: sample.seed ?? 1,
      ...replay(
        study,
        row.missionId,
        row.difficulty,
        sample.seed ?? 1,
        row.turnPolicy,
        sample.segments,
      ),
    })),
  }));
  const samples = rows.flatMap((row) => row.samples);
  return {
    format: 'UkrainianOrnamentV11MatrixReplayAuditV1',
    sourceGitBase,
    gameplayVersion: GAMEPLAY_TUNING_VERSION,
    supersedes: {
      format: old.supersedes?.format ?? old.format,
      sourceProjectIdentity: old.supersedes?.sourceProjectIdentity ?? '98161e7c0fba69c1',
      reason: 'The former v9-based matrix is retained in Git history and replayed here on v11.',
    },
    outcomes: counts(samples),
    rows,
  };
}
async function buildAtlas() {
  const old = await json('ukrainian-ornament-atlas-routes.json');
  const rows = old.rows.map((row) => ({
    missionId: row.missionId,
    difficulty: row.difficulty,
    turnPolicy: row.turnPolicy,
    seed: row.seed,
    samples: row.samples.map((sample) => ({
      sampleId: sample.sampleId ?? sample.stage,
      ...replay(atlas, row.missionId, row.difficulty, row.seed, row.turnPolicy, sample.segments),
    })),
  }));
  const samples = rows.flatMap((row) => row.samples);
  return {
    format: 'UkrainianOrnamentV11AtlasReplayAuditV1',
    sourceGitBase,
    gameplayVersion: GAMEPLAY_TUNING_VERSION,
    supersedes: {
      format: old.supersedes?.format ?? old.format,
      sourceProjectIdentity:
        old.supersedes?.sourceProjectIdentity ?? old.sourceIdentity?.sourceProjectIdentity,
      reason:
        'The former atlas evidence predates the v11 lineage rebuild and is not current acceptance.',
    },
    outcomes: counts(samples),
    rows,
  };
}

const outputs = [
  ['ukrainian-ornament-clear-routes.json', await buildStudyClear()],
  ['ukrainian-ornament-routes.json', await buildStudyMatrix()],
  ['ukrainian-ornament-atlas-routes.json', await buildAtlas()],
];
if (process.argv.includes('--write'))
  for (const [name, value] of outputs)
    await writeFile(new URL(name, fixtures), `${JSON.stringify(value, null, 2)}\n`);
else
  console.log(
    JSON.stringify(
      Object.fromEntries(outputs.map(([name, value]) => [name, value.outcomes])),
      null,
      2,
    ),
  );
