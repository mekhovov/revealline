/** Compare independent steering implementations without creating reward budgets. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { canonicalJSON, dataIdentity } from '../game/data-json.mjs';
import { CLASSIC_SNAKE_LEVELS } from '../game/snake/classic-catalogue.mjs';
import { prepareClassicSnakeLevel } from '../game/snake/classic-setup.mjs';
import {
  createClassicSnake,
  queueClassicSnakeTurn,
  stepClassicSnake,
  exportClassicSnakeReplay,
  restoreClassicSnakeReplay,
} from '../game/snake/classic-core.mjs';
import { classicSnakeRatingForRecord } from '../game/snake/classic-ratings.mjs';
import { proveClassicSnakeV4 } from '../game/test/helpers/classic-snake-v4-playthrough.mjs';
import { visibleSnakeRouteTurn } from './lib/snake-visible-route-pilot.mjs';
import { clearanceSnakeRouteTurn } from './lib/snake-clearance-route-pilot.mjs';

const sha = (value) => createHash('sha256').update(value).digest('hex');
const directory = new URL('../docs/verification/snake-remaster/', import.meta.url);
const rows = [];
for (const suffix of [
  'open-loop',
  'two-landings',
  'first-baffle',
  'offset-docks',
  'room-to-follow',
]) {
  const entry = CLASSIC_SNAKE_LEVELS.find((e) => e.id === `classic-snake-${suffix}`);
  const level = prepareClassicSnakeLevel(entry, { pace: 'normal' });
  assert.equal(level.version, 'classic-snake-level.v1');
  assert.equal(level.targetMovement, 'still');
  assert.equal(level.wrap, false);
  const playVisible = (pilot) => {
    const run = createClassicSnake(level, { seed: 17, mode: 'solo' });
    let stop = 'finished';
    while (run.status === 'running' && run.tick < 1024) {
      const snake = run.snakes[0];
      const turn = pilot({
        width: level.width,
        height: level.height,
        walls: level.walls,
        body: snake.body,
        direction: snake.direction,
        target: run.target,
      });
      if (!turn) {
        stop = 'no-current-path';
        break;
      }
      queueClassicSnakeTurn(run, 0, turn);
      stepClassicSnake(run);
    }
    if (run.tick === 1024 && run.status === 'running') stop = 'bounded-step-limit';
    return { replay: exportClassicSnakeReplay(run), stop };
  };
  const { replay: visibleReplay, stop } = playVisible(visibleSnakeRouteTurn);
  const { replay: clearanceReplay, stop: clearanceStop } = playVisible(clearanceSnakeRouteTurn);
  const generalReplay = proveClassicSnakeV4(level, {
    seed: 17,
    mode: 'solo',
    maxSteps: 1800,
    maxBacktracks: 32,
  });
  const summarize = (replay) => {
    const restored = restoreClassicSnakeReplay(replay, { level });
    assert.deepEqual(exportClassicSnakeReplay(restored), replay);
    return {
      status: restored.status,
      moves: restored.tick,
      catches: restored.catches,
      inputChanges: replay.turns.length,
      routeIdentity: sha(canonicalJSON(replay.turns)),
    };
  };
  const visible = summarize(visibleReplay),
    general = summarize(generalReplay),
    clearance = summarize(clearanceReplay);
  assert.equal(general.status, 'won');
  const rating = classicSnakeRatingForRecord({
    clear: true,
    policy: 'mission',
    mode: 'solo',
    seed: 17,
    levelIdentity: dataIdentity(level),
    fewestMoves: visible.status === 'won' ? Math.min(visible.moves, general.moves) : general.moves,
  });
  rows.push({
    levelId: entry.id,
    name: entry.level.name,
    levelIdentity: dataIdentity(level),
    mode: 'solo',
    pace: 'normal',
    seed: 17,
    role: suffix === 'open-loop' ? 'published-control' : 'completion-only-candidate',
    eligibility: rating.calibrated ? 'existing-fixed-budget' : 'completion-only',
    visiblePilot: { ...visible, stop },
    generalPilot: general,
    clearancePilot: { ...clearance, stop: clearanceStop },
    distinctClearanceWin:
      clearance.status === 'won' && clearance.routeIdentity !== general.routeIdentity,
    differentInputRoutes: visible.routeIdentity !== general.routeIdentity,
    proposedBudget: null,
    visibleReplay,
    generalReplay,
    clearanceReplay,
  });
}
const report = {
  format: 'classic-snake-rating-evidence.v2',
  scope:
    'Five exact normal-pace Solo seed-17 setups. Separate steering implementations, not independent players or repeated human observations. No pace copies count as additional evidence.',
  methods: {
    visible:
      'Shortest path on currently visible stationary-target board; conservative occupied tail; no future simulation, hidden RNG, retry, backtracking or fallback strategy.',
    clearance:
      'Visible-state weighted path: one cost per move plus two per adjacent wall, cable or boundary cell; replans each move, retains the tail, and never reads future state. Trades route length for current clearance; not guaranteed safer.',
    general:
      'Existing scored qualification search with simulated candidate moves, escape-space ranking and bounded backtracking. This remains solvability evidence, not human difficulty.',
  },
  sources: await Promise.all(
    [
      'scripts/review-snake-rating-evidence.mjs',
      'scripts/lib/snake-visible-route-pilot.mjs',
      'scripts/lib/snake-clearance-route-pilot.mjs',
      'game/test/helpers/classic-snake-v4-playthrough.mjs',
      'game/snake/classic-core.mjs',
    ].map(async (path) => ({
      path,
      sha256: sha(await readFile(new URL(`../${path}`, import.meta.url))),
    })),
  ),
  summary: {
    setups: rows.length,
    completionOnlyCandidates: rows.filter((r) => r.role === 'completion-only-candidate').length,
    bothStrategiesClear: rows.filter((r) => r.visiblePilot.status === 'won').length,
    differentInputRoutes: rows.filter((r) => r.differentInputRoutes).length,
    clearanceWins: rows.filter((r) => r.clearancePilot.status === 'won').length,
    distinctClearanceWins: rows.filter((r) => r.distinctClearanceWin).length,
    clearanceStopped: rows.filter((r) => r.clearancePilot.status !== 'won').length,
    proposedNewBudgets: 0,
    humanObservations: 0,
  },
  decision:
    'Retain completion-only for all candidates. Separate algorithms are not automatically separate strategies; compare input journals explicitly. Neither route diversity nor algorithm agreement establishes a fair silver/gold margin, Team coordination cost or real-time execution difficulty.',
  rows,
};
const output = JSON.stringify(report, null, 2) + '\n';
const file = new URL('rating-independent-evidence.json', directory);
if (process.argv.includes('--check')) assert.equal(await readFile(file, 'utf8'), output);
else await writeFile(file, output);
console.log(JSON.stringify(report.summary));
