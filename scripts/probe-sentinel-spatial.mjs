// Bounded omniscient feasibility search, never human pacing/enjoyment evidence.
import { readFileSync } from 'node:fs';
import { SENTINEL_FIRST_RETURNS } from '../game/content-design/sentinel-candidates.mjs';
import { createSentinelSpatialCandidates } from '../game/content-design/sentinel-spatial-candidates.mjs';
import { createSentinelInnerCandidates } from '../game/content-design/sentinel-inner-candidates.mjs';
import { compileContentProject, resolveMission } from '../game/content-design/project.mjs';
import { createRun, stepRun, FIXED_DT, CELL, DIRECTIONS } from '../game/core/index.mjs';
import { inspectCaptureSnapshot } from '../game/core/capture-regions.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../game/replay.mjs';
import {
  createSentinelGoalEvidence,
  observeSentinelGoal,
  inspectSentinelGoal,
} from '../game/test/helpers/sentinel-goal.mjs';
const project = compileContentProject(
  process.argv.includes('--inner-receiver')
    ? createSentinelInnerCandidates()
    : createSentinelSpatialCandidates(),
);
const difficulty = process.argv[3] ?? 'standard',
  turnPolicy = process.argv[4] ?? 'immediate';
const delaySeconds = Number(process.argv.find((a) => a.startsWith('--delay='))?.slice(8) ?? 0);
const maxMs = Number(process.argv.find((a) => a.startsWith('--max-ms='))?.slice(9) ?? 60000);
if (!Number.isSafeInteger(maxMs) || maxMs < 1000 || maxMs > 180000)
  throw new Error('Search budget must be1000..180000ms');
const visits = new WeakMap();
const goalEvidence = new WeakMap();
const mastery = process.argv.includes('--mastery');
function step(run, direction, log) {
  stepRun(run, { direction }, FIXED_DT);
  if (!goalEvidence.has(run)) goalEvidence.set(run, createSentinelGoalEvidence());
  observeSentinelGoal(run, goalEvidence.get(run));
  let used = visits.get(run);
  if (!used) {
    used = new Set();
    visits.set(run, used);
  }
  for (const gate of run.relay.gates)
    if (
      gate.openedTick !== null &&
      gate.cells.includes(Math.floor(run.player.y) * run.width + Math.floor(run.player.x))
    )
      used.add(gate.id);
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
    raw = [];
  const at = (x, y) =>
    x < 0 || y < 0 || x >= run.width || y >= run.height ? CELL.WALL : run.cells[y * run.width + x];
  const ray = (x, y, d, limit = 100) => {
    const v = DIRECTIONS[d],
      cells = [];
    let cx = x,
      cy = y;
    for (let i = 0; i < limit; i++) {
      cx += v.x;
      cy += v.y;
      if (at(cx, cy) === CELL.WALL) return null;
      cells.push(cy * run.width + cx);
      if (at(cx, cy) === CELL.SAFE) return { cells, x: cx, y: cy, safe: true };
    }
    return { cells, x: cx, y: cy, safe: false };
  };
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const cell = queue[cursor],
      x = cell % run.width,
      y = Math.floor(cell / run.width);
    for (const [d, v] of Object.entries(DIRECTIONS)) {
      const nx = x + v.x,
        ny = y + v.y,
        n = ny * run.width + nx;
      if (at(nx, ny) === CELL.SAFE && !prior.has(n)) {
        prior.set(n, cell);
        queue.push(n);
      }
      if (at(nx, ny) !== CELL.FIELD) continue;
      let length = 0,
        cx = x,
        cy = y;
      while (at(cx + v.x, cy + v.y) === CELL.FIELD) {
        length++;
        cx += v.x;
        cy += v.y;
      }
      const path = [];
      let p = cell;
      while (p !== null) {
        path.push(p);
        p = prior.get(p);
      }
      path.reverse();
      const add = (legs, cells) => {
        if (new Set(cells).size !== cells.length || cells.some((i) => run.classic.terrain[i] === 2))
          return;
        const core = run.enemies.find((enemy) => enemy.id === run.level.encounter.enemyId);
        if (cells.includes(Math.floor(core.y) * run.width + Math.floor(core.x))) return;
        const trail = cells.filter((i) => run.cells[i] === CELL.FIELD);
        if (!trail.length) return;
        raw.push({ path, legs, trail, travel: path.length + cells.length, direction: d });
      };
      const straight = ray(x, y, d);
      if (straight?.safe)
        add([{ direction: d, x: straight.x + 0.5, y: straight.y + 0.5 }], straight.cells);
      for (const depth of [...new Set([2, 4, 8, 12, length])].filter((n) => n <= length))
        for (const side of v.x ? ['up', 'down'] : ['left', 'right'])
          for (const across of [1, 2, 4, 8]) {
            const first = ray(x, y, d, depth);
            if (!first || first.safe) continue;
            const second = ray(first.x, first.y, side, across);
            if (!second || second.safe) continue;
            const back = ray(
              second.x,
              second.y,
              { up: 'down', down: 'up', left: 'right', right: 'left' }[d],
            );
            if (!back?.safe) continue;
            add(
              [
                { direction: d, x: first.x + 0.5, y: first.y + 0.5 },
                { direction: side, x: second.x + 0.5, y: second.y + 0.5 },
                {
                  direction: { up: 'down', down: 'up', left: 'right', right: 'left' }[d],
                  x: back.x + 0.5,
                  y: back.y + 0.5,
                },
              ],
              [...first.cells, ...second.cells, ...back.cells],
            );
          }
    }
  }
  raw.sort((a, b) => a.travel - b.travel);
  const seekRelease =
    mastery && run.level.id === 'sentinel-remix' && run.encounter.stage !== 'shielded';
  const sampled = [
    ...new Set([
      ...raw.slice(0, 400),
      ...(seekRelease ? raw.filter((c) => c.trail.length >= 16).slice(0, 400) : []),
      ...Array.from({ length: 500 }, (_, i) => raw[Math.floor((i * raw.length) / 500)]),
    ]),
  ].filter(Boolean);
  for (const c of sampled) {
    const snapshot = inspectCaptureSnapshot(run, { trailCells: c.trail });
    const shields = snapshot.affectedObjectiveIds.filter((id) =>
      run.level.encounter.shieldObjectiveIds.includes(id),
    ).length;
    c.estimate = (snapshot.filledCells.length + c.trail.length + shields * 800) / (c.travel + 15);
    if (seekRelease && c.trail.length >= 16) c.estimate += 10000;
  }
  sampled.sort((a, b) => b.estimate - a.estimate);
  const travel = [];
  if (mastery)
    for (const gate of run.relay.gates) {
      if (gate.openedTick === null || visits.get(run)?.has(gate.id)) continue;
      const target = gate.cells.find((cell) => prior.has(cell));
      if (target === undefined) continue;
      const path = [];
      let p = target;
      while (p !== null) {
        path.push(p);
        p = prior.get(p);
      }
      path.reverse();
      travel.push({ path, legs: [], direction: 'visit', travelOnly: true });
    }
  // Keep simple strip-closing alternatives even when high-gain bent candidates
  // dominate the frozen heuristic. All choices still require actual simulation.
  const straight = raw.filter((choice) => choice.legs.length === 1);
  return [
    ...new Set([
      ...travel,
      ...sampled.slice(0, 70),
      ...straight.slice(0, 16),
      ...Array.from({ length: 32 }, (_, i) => straight[Math.floor((i * straight.length) / 32)]),
    ]),
  ].filter(Boolean);
}
function followCut(run, choice, log) {
  for (const leg of choice.legs) {
    const horizontal = ['left', 'right'].includes(leg.direction),
      axis = horizontal ? 'x' : 'y',
      target = leg[axis];
    for (let tick = 0; tick < 1000; tick++) {
      if (run.status !== 'running' || run.classic.livesLost) return run.status === 'won';
      if (Math.abs(run.player[axis] - target) < 0.045) break;
      const before = run.player[axis];
      step(run, leg.direction, log);
      if (run.events.some((e) => e.type === 'cut.closed')) return true;
      if (Math.abs(run.player[axis] - before) < 1e-9) return false;
      if (tick === 999) return false;
    }
  }
  return false;
}
for (const mission of project.missions.filter(
  (m) => !process.argv[2] || process.argv[2] === 'all' || m.id === process.argv[2],
)) {
  const start = Date.now(),
    manifest = resolveMission(project, mission.id, { difficulty });
  const options = { seed: 1, classId: 'scout', turnPolicy };
  let run = createRun(manifest.level, options),
    log = [],
    cuts = 0;
  const resumePath = process.argv.find((arg) => arg.startsWith('--resume='))?.slice(9);
  if (resumePath) {
    const prefix = readFileSync(resumePath, 'utf8')
      .trim()
      .split('\n')
      .map(JSON.parse)
      .find(
        (row) =>
          row.id === mission.id && row.difficulty === difficulty && row.turnPolicy === turnPolicy,
      );
    if (!prefix || prefix.simulationIdentity !== manifest.simulationIdentity)
      throw Error('Missing or stale route prefix');
    for (const segment of prefix.segments)
      for (let tick = 0; tick < segment.ticks; tick++) {
        step(run, segment.direction, log);
        if (run.events.some((e) => e.type === 'cut.closed')) cuts++;
      }
    if (authoritativeCheckpoint(run).hash !== prefix.checkpoint)
      throw Error('Prefix checkpoint mismatch');
  }
  for (let tick = 0; tick < Math.round(delaySeconds / FIXED_DT); tick++) step(run, null, log);
  const openingWait = Number(
    process.argv.find((arg) => arg.startsWith('--opening-wait='))?.slice(15) ?? 0,
  );
  for (let tick = 0; tick < openingWait; tick++) step(run, null, log);
  if (process.argv.includes('--teach-opening') && !resumePath) {
    for (
      let tick = 0;
      tick < 1000 && !run.claimedCount && run.status === 'running' && !run.classic.livesLost;
      tick++
    )
      step(run, SENTINEL_FIRST_RETURNS[mission.id], log);
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
      for (const waitTicks of [0, 60, 120, 240, 600, 960]) {
        const next = structuredClone(run),
          moves = [];
        visits.set(next, new Set(visits.get(run) ?? []));
        goalEvidence.set(
          next,
          structuredClone(goalEvidence.get(run) ?? createSentinelGoalEvidence()),
        );
        for (
          let tick = 0;
          tick < waitTicks && next.status === 'running' && !next.classic.livesLost;
          tick++
        )
          step(next, null, moves);
        if (
          next.status === 'won' &&
          !next.classic.livesLost &&
          (!mastery ||
            inspectSentinelGoal({
              missionId: mission.id,
              run: next,
              evidence: goalEvidence.get(next),
            }).achieved)
        ) {
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
        const closed = choice.travelOnly ? false : followCut(next, choice, moves);
        if (next.classic.livesLost || (!closed && !choice.travelOnly && next.status !== 'won'))
          continue;
        const gain = next.claimedCount - run.claimedCount;
        const useGain = (visits.get(next)?.size ?? 0) - (visits.get(run)?.size ?? 0);
        if (gain <= 0 && next.status !== 'won' && !(mastery && useGain > 0)) continue;
        const relayGain =
          next.relay.gates.filter((g) => g.openedTick !== null).length -
          run.relay.gates.filter((g) => g.openedTick !== null).length;
        if (process.argv.includes('--early-relays') && next.status === 'won' && relayGain > 0)
          continue;
        if (
          process.argv.includes('--use-links') &&
          next.status === 'won' &&
          next.relay.gates.length &&
          (visits.get(next)?.size ?? 0) === 0
        )
          continue;
        const shieldGain =
          next.objectives.filter((o) => o.captured).length -
          run.objectives.filter((o) => o.captured).length;
        if (mastery) {
          const before = goalEvidence.get(run) ?? createSentinelGoalEvidence(),
            after = goalEvidence.get(next);
          const newly = [...after.shields].filter(([id]) => !before.shields.has(id));
          if (
            mission.id === 'twin-receivers' &&
            newly.some(([id]) => id === 'west-shield') &&
            !before.shields.has('east-shield')
          )
            continue;
          if (mission.id === 'crown-audience' && newly.length > 1) continue;
          if (
            mission.id === 'relay-perimeter' &&
            next.encounter.stage !== 'shielded' &&
            !inspectSentinelGoal({ missionId: mission.id, run: next, evidence: after }).condition
          )
            continue;
          // Search pruning only: keep maneuvering room for the optional 16-cell release.
          if (
            mission.id === 'sentinel-remix' &&
            next.cells.reduce((n, c) => n + Number(c === CELL.FIELD), 0) < 64 &&
            next.status !== 'won'
          )
            continue;
          if (
            next.status === 'won' &&
            !inspectSentinelGoal({ missionId: mission.id, run: next, evidence: after }).achieved
          )
            continue;
        }
        const score =
          (gain +
            shieldGain * 800 +
            (process.argv.includes('--relay-first') ? relayGain * 1000 : 0) +
            (mastery || process.argv.includes('--use-links') ? useGain * 1500 : 0)) /
            (next.tick - run.tick + 120) +
          (next.status === 'won' ? 1000 : 0);
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
        if (
          [
            'boss.warning',
            'life.lost',
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
      goal: inspectSentinelGoal({
        missionId: mission.id,
        run,
        evidence: goalEvidence.get(run) ?? createSentinelGoalEvidence(),
      }),
    }),
  );
}
