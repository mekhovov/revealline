// Reuses reviewed route inputs across presets/steering to find scoped evidence,
// never to award mastery, retune content or infer human enjoyment.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createSignalCandidates } from '../game/content-design/signal-candidates.mjs';
import { compileContentProject, resolveMission } from '../game/content-design/project.mjs';
import { createRun, stepRun, FIXED_DT, CELL } from '../game/core/index.mjs';
import { authoritativeCheckpoint } from '../game/replay.mjs';

const source = createSignalCandidates();
const project = compileContentProject(source);
const inputs = [];
const candidates = [];
for (const kind of ['mastery', 'clear', 'timing']) {
  const path = `game/test/fixtures/signal-${kind}-routes.json`;
  const bytes = await readFile(new URL(`../${path}`, import.meta.url));
  const fixture = JSON.parse(bytes);
  inputs.push({ path, sha256: createHash('sha256').update(bytes).digest('hex') });
  const sets = kind === 'mastery' ? [fixture] : fixture.sets;
  for (const [setIndex, set] of sets.entries()) {
    if (kind === 'clear' && !set.bonuses) continue;
    for (const [id, , , segments] of set.rows)
      candidates.push({ id, input: path, setIndex, segments });
  }
}

const contains = (rect, x, y) =>
  x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
const cellsOf = (rect, width) =>
  Array.from(
    { length: rect.w * rect.h },
    (_, n) => (rect.y + Math.floor(n / rect.w)) * width + rect.x + (n % rect.w),
  );

function sample(manifest, map, turnPolicy, segments) {
  const run = createRun(manifest.level, { seed: 1, classId: 'scout', turnPolicy });
  const beds = map.terrain.map((rect) => cellsOf(rect, run.width));
  const neutralizedAt = beds.map(() => null);
  const enteredAt = beds.map(() => null);
  const visitedAt = map.foundations.map(() => null);
  const usedSegments = [];
  const observe = () => {
    const x = Math.floor(run.player.x),
      y = Math.floor(run.player.y);
    beds.forEach((cells, index) => {
      if (neutralizedAt[index] === null && cells.every((cell) => run.cells[cell] === CELL.SAFE))
        neutralizedAt[index] = run.tick;
      if (
        enteredAt[index] === null &&
        contains(map.terrain[index], x, y) &&
        run.cells[y * run.width + x] !== CELL.SAFE
      )
        enteredAt[index] = run.tick;
    });
    map.foundations.forEach((rect, index) => {
      if (visitedAt[index] === null && contains(rect, x, y)) visitedAt[index] = run.tick;
    });
  };
  observe();
  for (const [direction, ticks] of segments) {
    let used = 0;
    for (; used < ticks && run.status === 'running'; used++) {
      stepRun(run, { direction }, FIXED_DT);
      observe();
      if (run.classic.livesLost > 0) return { result: 'life-lost' };
    }
    if (used) usedSegments.push([direction, used]);
    if (run.status !== 'running') break;
  }
  if (run.status !== 'won') return { result: 'not-cleared' };
  const queue = [map.foundations[0].y * run.width + map.foundations[0].x];
  const seen = new Set(queue);
  for (let at = 0; at < queue.length; at++) {
    const x = queue[at] % run.width,
      y = Math.floor(queue[at] / run.width);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        ny = y + dy,
        cell = ny * run.width + nx;
      if (
        nx >= 0 &&
        nx < run.width &&
        ny >= 0 &&
        ny < run.height &&
        !seen.has(cell) &&
        run.cells[cell] === CELL.SAFE
      ) {
        seen.add(cell);
        queue.push(cell);
      }
    }
  }
  const linked = map.foundations.every((rect) => seen.has(rect.y * run.width + rect.x));
  const id = manifest.missionId;
  const achieved = {
    'soft-crossing': neutralizedAt.every((tick) => tick !== null),
    'dry-spine': neutralizedAt.some(
      (tick, i) => tick !== null && (enteredAt[1 - i] === null || tick < enteredAt[1 - i]),
    ),
    'wide-approach': linked,
    'cool-the-crossing':
      neutralizedAt[0] !== null && (visitedAt[1] === null || neutralizedAt[0] < visitedAt[1]),
    'garden-refuges': linked && neutralizedAt.some((tick) => tick !== null),
    'neutral-ground': neutralizedAt.every((tick) => tick !== null),
    'signal-remix':
      linked && run.classic.powerups.every((powerup) => powerup.collectedTick === null),
  }[id];
  return {
    result: achieved ? 'sampled-mastery' : 'ordinary-clear-only',
    checkpoint: authoritativeCheckpoint(run).hash,
    clearTicks: run.tick,
    segments: usedSegments,
    neutralizedAt,
    enteredAt,
    visitedAt,
    foundationsLinked: linked,
  };
}

const rows = [];
for (const difficulty of ['gentle', 'standard', 'expert'])
  for (const turnPolicy of ['immediate', 'grid-center'])
    for (const mission of source.missions) {
      const manifest = resolveMission(project, mission.id, { difficulty });
      const map = source.maps.find((entry) => entry.id === mission.map.id);
      const outcomes = {};
      let evidence = null;
      for (const candidate of candidates.filter((entry) => entry.id === mission.id)) {
        const result = sample(manifest, map, turnPolicy, candidate.segments);
        outcomes[result.result] = (outcomes[result.result] ?? 0) + 1;
        if (result.result === 'sampled-mastery') {
          evidence = { input: candidate.input, setIndex: candidate.setIndex, ...result };
          break;
        }
      }
      rows.push({
        id: mission.id,
        difficulty,
        turnPolicy,
        simulationIdentity: manifest.simulationIdentity,
        outcomes,
        evidence,
      });
    }
process.stdout.write(
  JSON.stringify(
    {
      format: 'SignalMasteryCoverageObservationV1',
      qualification: 'sampled-route-predicates-not-awards-or-human-validation',
      seed: 1,
      inputs,
      rows,
      limitations: [
        'Candidates are finite existing routes; failure to find one is not an impossibility proof.',
        'Routes stop at the first terminal tick; emitted segments exclude unused source inputs.',
        'All authored bonuses remain present. No level, speed, quota or source fixture is changed.',
        'This does not qualify arbitrary delays, alternative seeds, physical controls or enjoyment.',
      ],
    },
    null,
    2,
  ) + '\n',
);
