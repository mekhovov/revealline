// Bounded omniscient feasibility search, never human pacing/enjoyment evidence.
import { readFileSync } from 'node:fs';
import { compileContentProject, resolveMission } from '../../game/content-design/project.mjs';
import { createRun, stepRun, FIXED_DT, CELL, DIRECTIONS } from '../../game/core/index.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../../game/replay.mjs';
import { createWholeJourneyCandidates } from '../../game/content-design/whole-journey-candidates.mjs';
import { withPressureDifficulty } from '../../game/content-design/pressure-candidates.mjs';
import { bentFieldChoices, sampleBentChoices } from './bent-route-search.mjs';
export function probePressureRoute(
  FIRST_RETURNS,
  createProject = () => withPressureDifficulty(createWholeJourneyCandidates()),
  searchPolicy = {},
) {
  const difficulty = process.argv[3] ?? 'standard',
    turnPolicy = process.argv[4] ?? 'immediate';
  const delaySeconds = Number(process.argv.find((a) => a.startsWith('--delay='))?.slice(8) ?? 0);
  const resumePath = process.argv.find((a) => a.startsWith('--resume='))?.slice(9);
  const seed = Number(process.argv.find((a) => a.startsWith('--seed='))?.slice(7) ?? 1);
  // Offline experiment only: forbid adding waits while searching. A declared
  // initial delay or an exact resumed prefix remains part of the public log.
  const searchWaitTicks = process.argv.includes('--no-wait') ? [0] : [0, 60, 120, 240, 600, 960];
  if (!Number.isSafeInteger(seed) || seed < 1 || seed > 2147483647)
    throw Error('Seed must fit a positive int32');
  const maxMs = Number(process.argv.find((a) => a.startsWith('--max-ms='))?.slice(9) ?? 60000);
  const missionId = process.argv[2];
  if (!Object.hasOwn(FIRST_RETURNS, missionId)) throw Error('Choose a supported mission ID');
  if (
    !['gentle', 'standard', 'expert'].includes(difficulty) ||
    !['immediate', 'grid-center'].includes(turnPolicy)
  )
    throw Error('Unknown preset or steering policy');
  if (!Number.isSafeInteger(maxMs) || maxMs < 1000 || maxMs > 180000)
    throw Error('Budget must be1000..180000ms');
  if (!Number.isFinite(delaySeconds) || delaySeconds < 0 || delaySeconds > 10)
    throw Error('Delay must be0..10seconds');
  const project = compileContentProject(createProject());
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
      candidates = [],
      bent = [];
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
        const path = [];
        let p = cell;
        while (p !== null) {
          path.push(p);
          p = prior.get(p);
        }
        path.reverse();
        if (searchPolicy.bentCuts) bent.push(...bentFieldChoices(run, cell, path, direction));
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
        candidates.push({ direction, length, path });
      }
    }
    candidates.sort((a, b) => a.path.length + a.length - b.path.length - b.length);
    return [
      ...(searchPolicy.bentCuts ? sampleBentChoices(run, bent) : []),
      ...new Set([
        ...candidates.slice(0, 16),
        ...Array.from(
          { length: 44 },
          (_, i) => candidates[Math.floor((i * candidates.length) / 44)],
        ),
      ]),
    ].filter(Boolean);
  }
  for (const mission of project.missions.filter((m) => m.id === missionId)) {
    const start = Date.now(),
      manifest = resolveMission(project, mission.id, { difficulty }),
      level = searchPolicy.prepareLevel
        ? searchPolicy.prepareLevel(manifest.level, difficulty)
        : manifest.level;
    const options = { seed, classId: 'scout', turnPolicy };
    let run = createRun(level, options),
      log = [],
      cuts = 0;
    if (resumePath) {
      const data = JSON.parse(readFileSync(resumePath, 'utf8'));
      const row = (data.rows ?? [data]).find(
        (r) =>
          r.id === mission.id &&
          r.difficulty === difficulty &&
          r.turnPolicy === turnPolicy &&
          (r.seed ?? 1) === seed,
      );
      if (!row || row.simulationIdentity !== manifest.simulationIdentity)
        throw Error('Missing or stale prefix');
      if (
        !Array.isArray(row.segments) ||
        row.segments.length > 1000 ||
        row.segments.some(
          (s) =>
            ![null, 'left', 'right', 'up', 'down'].includes(s.direction) ||
            !Number.isSafeInteger(s.ticks) ||
            s.ticks < 1,
        ) ||
        row.segments.reduce((n, s) => n + s.ticks, 0) > 120000
      )
        throw Error('Invalid bounded prefix');
      for (const { direction, ticks } of row.segments)
        for (let t = 0; t < ticks; t++) {
          if (run.status !== 'running' || run.classic.livesLost)
            throw Error('Prefix continued past completion/loss');
          step(run, direction, log);
          if (run.events.some((e) => e.type === 'cut.closed')) cuts++;
        }
      if (authoritativeCheckpoint(run).hash !== row.checkpoint)
        throw Error('Prefix checkpoint mismatch');
      if (
        run.status === 'won' &&
        searchPolicy.acceptCompletion &&
        !searchPolicy.acceptCompletion(run)
      )
        throw Error('Completed prefix does not meet the requested offline target');
    }
    for (let tick = 0; tick < Math.round(delaySeconds / FIXED_DT); tick++) step(run, null, log);
    if (process.argv.includes('--teach-opening') && !resumePath) {
      for (
        let tick = 0;
        tick < 1000 && !run.claimedCount && run.status === 'running' && !run.classic.livesLost;
        tick++
      )
        step(run, FIRST_RETURNS[mission.id], log);
      cuts++;
    }
    while (
      run.status === 'running' &&
      !run.classic.livesLost &&
      cuts < 32 &&
      Date.now() - start < maxMs
    ) {
      let best = null;
      for (const choice of [{ direction: null, path: [] }, ...choices(run)]) {
        if (Date.now() - start >= maxMs) break;
        // Waiting is a legal choice on reclaimed ground, not a simulation edit.
        for (const waitTicks of searchWaitTicks) {
          const next = structuredClone(run),
            moves = [];
          for (
            let tick = 0;
            tick < waitTicks && next.status === 'running' && !next.classic.livesLost;
            tick++
          )
            step(next, null, moves);
          if (next.status === 'won' && !next.classic.livesLost) {
            if (searchPolicy.acceptCompletion && !searchPolicy.acceptCompletion(next)) continue;
            best = { score: 10000, next, moves };
            break;
          }
          if (!choice.direction) continue;
          if (
            !choice.path.every((cell) =>
              point(next, (cell % run.width) + 0.5, Math.floor(cell / run.width) + 0.5, moves),
            )
          )
            continue;
          let closed = false;
          if (choice.legs) {
            legs: for (const leg of choice.legs) {
              const axis = DIRECTIONS[leg.direction].x ? 'x' : 'y';
              for (let tick = 0; tick < 1000; tick++) {
                if (next.status !== 'running' || next.classic.livesLost) break legs;
                if (Math.abs(next.player[axis] - leg[axis]) < 0.045) break;
                const before = next.player[axis];
                step(next, leg.direction, moves);
                if (next.events.some((e) => e.type === 'cut.closed')) {
                  closed = true;
                  break legs;
                }
                if (Math.abs(next.player[axis] - before) < 1e-9 || tick === 999) break legs;
              }
            }
          } else
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
          if (
            next.status === 'won' &&
            searchPolicy.acceptCompletion &&
            !searchPolicy.acceptCompletion(next)
          )
            continue;
          const gain = next.claimedCount - run.claimedCount;
          if (gain <= 0 && next.status !== 'won') continue;
          const objectiveGain =
            next.objectives.filter((o) => o.captured).length -
            run.objectives.filter((o) => o.captured).length;
          const defaultScore =
            (gain + objectiveGain * 800) / (next.tick - run.tick + 120) +
            (next.status === 'won' ? 1000 : 0);
          const score = searchPolicy.scoreCandidate
            ? searchPolicy.scoreCandidate({ run, next, defaultScore })
            : defaultScore;
          if (!best || score > best.score) best = { score, next, moves };
        }
      }
      if (!best) break;
      run = best.next;
      log.push(...best.moves);
      cuts++;
    }
    const verify = createRun(level, options),
      recorder = createRecorder(level, options),
      events = [],
      closures = [];
    for (const segment of log)
      for (let tick = 0; tick < segment.ticks; tick++) {
        recordInput(recorder, { direction: segment.direction });
        stepRun(verify, { direction: segment.direction }, FIXED_DT);
        for (const e of verify.events)
          if (
            [
              'boss.warning',
              'player.failed',
              'cut.closed',
              'lineImpact.created',
              'relay.opened',
              'objective.captured',
              'encounter.stageChanged',
              'encounter.defeated',
            ].includes(e.type)
          )
            events.push([verify.tick, e.type, e.id ?? null]);
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
        seed,
        status: run.status,
        simulationIdentity: manifest.simulationIdentity,
        ticks: run.tick,
        lives: run.lives,
        coverage: run.coverage,
        cuts: closures.length,
        searchSteps: cuts,
        searchWaitTicks,
        checkpoint: authoritativeCheckpoint(run).hash,
        events,
        closures,
        segments: compact,
      }),
    );
  }
}
