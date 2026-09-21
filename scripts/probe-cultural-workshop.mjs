// Bounded omniscient route search: feasibility evidence only, not enjoyment,
// human timing or an automatic reason to publish a map. Never writes fixtures.
import { createCulturalWorkshopCandidates } from '../game/content-design/cultural-workshop-candidates.mjs';
import { compileContentProject, resolveMission } from '../game/content-design/project.mjs';
import { createRun, stepRun, FIXED_DT, CELL, DIRECTIONS } from '../game/core/index.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../game/replay.mjs';

const project = compileContentProject(createCulturalWorkshopCandidates());
const id = process.argv[2] ?? 'all',
  difficulty = process.argv[3] ?? 'standard',
  turnPolicy = process.argv[4] ?? 'immediate';
const maxMs = 20000;
function step(run, direction, segments) {
  stepRun(run, { direction }, FIXED_DT);
  if (segments.at(-1)?.[0] === direction) segments.at(-1)[1]++;
  else segments.push([direction, 1]);
}
function move(run, cell, segments) {
  const x = (cell % 72) + 0.5,
    y = Math.floor(cell / 72) + 0.5;
  for (let n = 0; n < 900; n++) {
    if (run.status !== 'running' || run.classic.livesLost) return false;
    const dx = x - run.player.x,
      dy = y - run.player.y;
    if (Math.abs(dx) < 0.045 && Math.abs(dy) < 0.045) return true;
    step(
      run,
      Math.abs(dx) >= 0.045 ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up',
      segments,
    );
    if (run.player.cutting) return false;
  }
  return false;
}
function choices(run) {
  const root = Math.floor(run.player.y) * 72 + Math.floor(run.player.x);
  const prior = new Map([[root, null]]),
    queue = [root],
    options = [];
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head],
      x = cell % 72,
      y = Math.floor(cell / 72);
    for (const [direction, v] of Object.entries(DIRECTIONS)) {
      const nx = x + v.x,
        ny = y + v.y;
      if (nx < 0 || nx >= 72 || ny < 0 || ny >= 36) continue;
      const next = ny * 72 + nx;
      if (run.cells[next] === CELL.SAFE && !prior.has(next)) {
        prior.set(next, cell);
        queue.push(next);
      }
      if (run.cells[next] !== CELL.FIELD) continue;
      let cx = nx,
        cy = ny,
        length = 0;
      while (cx >= 0 && cx < 72 && cy >= 0 && cy < 36 && run.cells[cy * 72 + cx] === CELL.FIELD) {
        length++;
        cx += v.x;
        cy += v.y;
      }
      if (cx < 0 || cx >= 72 || cy < 0 || cy >= 36 || run.cells[cy * 72 + cx] !== CELL.SAFE)
        continue;
      const path = [];
      for (let p = cell; p !== null; p = prior.get(p)) path.push(p);
      options.push({ direction, length, path: path.reverse() });
    }
  }
  options.sort((a, b) => a.length + a.path.length - b.length - b.path.length);
  return [
    ...new Set([
      ...options.slice(0, 12),
      ...Array.from({ length: 32 }, (_, n) => options[Math.floor((n * options.length) / 32)]),
    ]),
  ].filter(Boolean);
}
for (const mission of project.missions.filter((m) => id === 'all' || m.id === id)) {
  const manifest = resolveMission(project, mission.id, { difficulty });
  const options = { seed: 1, classId: 'scout', turnPolicy };
  let run = createRun(manifest.level, options),
    segments = [],
    cuts = 0;
  const start = Date.now();
  while (
    run.status === 'running' &&
    !run.classic.livesLost &&
    cuts < 32 &&
    Date.now() - start < maxMs
  ) {
    let best = null;
    for (const choice of choices(run)) {
      if (Date.now() - start >= maxMs) break;
      for (const wait of [0, 60, 180, 360]) {
        const next = structuredClone(run),
          steps = [];
        for (let n = 0; n < wait && next.status === 'running' && !next.classic.livesLost; n++)
          step(next, null, steps);
        if (!choice.path.every((cell) => move(next, cell, steps))) continue;
        let closed = false;
        for (let n = 0; n < 1000 && next.status === 'running' && !next.classic.livesLost; n++) {
          step(next, choice.direction, steps);
          if (next.events.some((event) => event.type === 'cut.closed')) {
            closed = true;
            break;
          }
        }
        if (next.classic.livesLost || (!closed && next.status !== 'won')) continue;
        const gain = next.claimedCount - run.claimedCount;
        if (gain <= 0 && next.status !== 'won') continue;
        const score = next.status === 'won' ? 1e9 : gain / (1 + (next.tick - run.tick) / 1200);
        if (!best || score > best.score) best = { next, steps, score };
      }
      if (best?.next.status === 'won') break;
    }
    if (!best) break;
    run = best.next;
    segments.push(...best.steps);
    cuts++;
  }
  if (run.status !== 'won') {
    console.log(
      JSON.stringify({
        mission: mission.id,
        difficulty,
        turnPolicy,
        status: 'route-not-found',
        coverage: run.coverage,
        cuts,
        elapsedMs: Date.now() - start,
      }),
    );
    continue;
  }
  // Prove the emitted route against a fresh unmodified run and public replay.
  const fresh = createRun(manifest.level, options),
    recorder = createRecorder(
      manifest.level,
      options,
      'omniscient-feasibility-not-human-validation',
    );
  for (const [direction, ticks] of segments)
    for (let n = 0; n < ticks; n++) {
      if (fresh.status !== 'running') throw new Error('Route input after completion');
      recordInput(recorder, { direction });
      stepRun(fresh, { direction }, FIXED_DT);
    }
  if (
    fresh.status !== 'won' ||
    fresh.classic.livesLost ||
    !verifyReplay(exportReplay(recorder, fresh)).match
  )
    throw new Error('Fresh route/replay qualification failed');
  const compact = [];
  for (const [direction, ticks] of segments) {
    if (compact.at(-1)?.[0] === direction) compact.at(-1)[1] += ticks;
    else compact.push([direction, ticks]);
  }
  console.log(
    JSON.stringify({
      mission: mission.id,
      difficulty,
      turnPolicy,
      status: 'won',
      seconds: fresh.time,
      cuts,
      simulationIdentity: manifest.simulationIdentity,
      checkpoint: authoritativeCheckpoint(fresh).hash,
      segments: compact,
    }),
  );
}
