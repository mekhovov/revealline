// Bounded omniscient feasibility search, never human pacing/enjoyment evidence.
import { LIVEWIRE_FIRST_RETURNS } from '../game/content-design/livewire-candidates.mjs';
import { compileContentProject, resolveMission } from '../game/content-design/project.mjs';
import { createRun, stepRun, FIXED_DT, CELL, DIRECTIONS } from '../game/core/index.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../game/replay.mjs';
import { createWholeJourneyCandidates } from '../game/content-design/whole-journey-candidates.mjs';
import { withPressureDifficulty } from '../game/content-design/pressure-candidates.mjs';
const project = compileContentProject(withPressureDifficulty(createWholeJourneyCandidates()));
const difficulty = process.argv[3] ?? 'standard',
  turnPolicy = process.argv[4] ?? 'immediate';
const delaySeconds = Number(process.argv.find((a) => a.startsWith('--delay='))?.slice(8) ?? 0);
const maxMs = Number(process.argv.find((a) => a.startsWith('--max-ms='))?.slice(9) ?? 60000);
const missionId = process.argv[2];
if (!Object.hasOwn(LIVEWIRE_FIRST_RETURNS, missionId)) throw Error('Choose a Livewire mission ID');
if (
  !['gentle', 'standard', 'expert'].includes(difficulty) ||
  !['immediate', 'grid-center'].includes(turnPolicy)
)
  throw Error('Unknown preset or steering policy');
if (!Number.isSafeInteger(maxMs) || maxMs < 1000 || maxMs > 180000)
  throw Error('Budget must be1000..180000ms');
if (!Number.isFinite(delaySeconds) || delaySeconds < 0 || delaySeconds > 10)
  throw Error('Delay must be0..10seconds');
function step(run, direction, log) {
  stepRun(run, { direction }, FIXED_DT);
  const last = log.at(-1);
  if (last?.direction === direction) last.ticks++;
  else log.push({ direction, ticks: 1 });
}
function point(run, x, y, log) {
  for (let i = 0; i < 900; i++) {
    if (run.status !== 'running' || run.classic.livesLost) return false;
    const dx = x - run.player.x,
      dy = y - run.player.y;
    if (Math.abs(dx) < 0.045 && Math.abs(dy) < 0.045) return true;
    step(run, Math.abs(dx) >= 0.045 ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up', log);
    if (run.player.cutting) return false;
  }
  return false;
}
function choices(run) {
  const root = Math.floor(run.player.y) * run.width + Math.floor(run.player.x);
  const prior = new Map([[root, null]]),
    queue = [root],
    candidates = [];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const cell = queue[cursor],
      x = cell % run.width,
      y = Math.floor(cell / run.width);
    for (const [direction, v] of Object.entries(DIRECTIONS)) {
      const nx = x + v.x,
        ny = y + v.y;
      if (nx < 0 || nx >= run.width || ny < 0 || ny >= run.height) continue;
      const n = ny * run.width + nx;
      if (run.cells[n] === CELL.SAFE && !prior.has(n)) {
        prior.set(n, cell);
        queue.push(n);
      }
      if (run.cells[n] !== CELL.FIELD) continue;
      let cx = nx,
        cy = ny,
        length = 0,
        lethal = false;
      while (
        cx >= 0 &&
        cx < run.width &&
        cy >= 0 &&
        cy < run.height &&
        run.cells[cy * run.width + cx] === CELL.FIELD
      ) {
        if (run.classic.terrain[cy * run.width + cx] === 2) lethal = true;
        length++;
        cx += v.x;
        cy += v.y;
      }
      if (
        lethal ||
        cx < 0 ||
        cx >= run.width ||
        cy < 0 ||
        cy >= run.height ||
        run.cells[cy * run.width + cx] !== CELL.SAFE
      )
        continue;
      const path = [];
      let p = cell;
      while (p !== null) {
        path.push(p);
        p = prior.get(p);
      }
      candidates.push({ direction, length, path: path.reverse() });
    }
  }
  candidates.sort((a, b) => a.path.length + a.length - b.path.length - b.length);
  return [
    ...new Set([
      ...candidates.slice(0, 16),
      ...Array.from({ length: 44 }, (_, i) => candidates[Math.floor((i * candidates.length) / 44)]),
    ]),
  ].filter(Boolean);
}
for (const mission of project.missions.filter((m) => m.id === missionId)) {
  const start = Date.now(),
    manifest = resolveMission(project, mission.id, { difficulty });
  const options = { seed: 1, classId: 'scout', turnPolicy };
  let run = createRun(manifest.level, options),
    log = [],
    cuts = 0;
  for (let tick = 0; tick < Math.round(delaySeconds / FIXED_DT); tick++) step(run, null, log);
  if (process.argv.includes('--teach-opening')) {
    for (
      let tick = 0;
      tick < 1000 && !run.claimedCount && run.status === 'running' && !run.classic.livesLost;
      tick++
    )
      step(run, LIVEWIRE_FIRST_RETURNS[mission.id], log);
    cuts++;
  }
  while (
    run.status === 'running' &&
    !run.classic.livesLost &&
    cuts < 32 &&
    Date.now() - start < maxMs
  ) {
    let best = null;
    for (const choice of choices(run)) {
      if (Date.now() - start >= maxMs) break;
      // Waiting is a legal choice on reclaimed ground, not a simulation edit.
      for (const waitTicks of [0, 60, 120, 240]) {
        const next = structuredClone(run),
          moves = [];
        for (
          let tick = 0;
          tick < waitTicks && next.status === 'running' && !next.classic.livesLost;
          tick++
        )
          step(next, null, moves);
        if (
          !choice.path.every((cell) =>
            point(next, (cell % run.width) + 0.5, Math.floor(cell / run.width) + 0.5, moves),
          )
        )
          continue;
        let closed = false;
        for (
          let tick = 0;
          tick < 1000 && next.status === 'running' && !next.classic.livesLost;
          tick++
        ) {
          step(next, choice.direction, moves);
          if (next.events.some((e) => e.type === 'cut.closed')) {
            closed = true;
            break;
          }
        }
        if (next.classic.livesLost || (!closed && next.status !== 'won')) continue;
        const gain = next.claimedCount - run.claimedCount;
        if (gain <= 0 && next.status !== 'won') continue;
        const score = gain / (next.tick - run.tick + 120) + (next.status === 'won' ? 1000 : 0);
        if (!best || score > best.score) best = { score, next, moves };
      }
    }
    if (!best) break;
    run = best.next;
    log.push(...best.moves);
    cuts++;
  }
  const verify = createRun(manifest.level, options),
    recorder = createRecorder(manifest.level, options),
    events = [],
    closures = [];
  for (const segment of log)
    for (let tick = 0; tick < segment.ticks; tick++) {
      recordInput(recorder, { direction: segment.direction });
      stepRun(verify, { direction: segment.direction }, FIXED_DT);
      for (const e of verify.events)
        if (['boss.warning', 'life.lost', 'cut.closed', 'lineImpact.created'].includes(e.type))
          events.push([verify.tick, e.type]);
      if (verify.events.some((e) => e.type === 'cut.closed'))
        closures.push([verify.tick, verify.coverage]);
    }
  if (authoritativeCheckpoint(verify).hash !== authoritativeCheckpoint(run).hash)
    throw Error('Fresh-input replay mismatch');
  if (!verifyReplay(exportReplay(recorder, verify)).match) throw Error('Public replay mismatch');
  const compact = [];
  for (const segment of log) {
    const last = compact.at(-1);
    if (last?.direction === segment.direction) last.ticks += segment.ticks;
    else compact.push({ ...segment });
  }
  console.log(
    JSON.stringify({
      id: mission.id,
      difficulty,
      turnPolicy,
      delaySeconds,
      status: run.status,
      simulationIdentity: manifest.simulationIdentity,
      ticks: run.tick,
      lives: run.lives,
      coverage: run.coverage,
      cuts: closures.length,
      searchSteps: cuts,
      checkpoint: authoritativeCheckpoint(run).hash,
      events,
      closures,
      segments: compact,
    }),
  );
}
