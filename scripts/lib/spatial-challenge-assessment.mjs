// Offline route evidence. Only public inputs advance the simulation; geometry
// proposals never qualify a capture, a clear, or human difficulty by themselves.
import {
  createRun,
  stepRun,
  FIXED_DT,
  CELL,
  DIRECTIONS,
} from "../../game/core/index.mjs";
import { inspectCaptureSnapshot } from "../../game/core/capture-regions.mjs";
import { dataIdentity } from "../../game/data-json.mjs";
import { resolveMission } from "../../game/content-design/project.mjs";
import {
  applyGameplayTuning,
  resolveGameplayTuning,
} from "../../game/gameplay-tuning.mjs";
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from "../../game/replay.mjs";
import { bentFieldChoices } from "./bent-route-search.mjs";

const directions = [null, "left", "right", "up", "down"];
const policies = ["immediate", "grid-center"];
const MAX_TICKS = 120000;
function checkedOptions({ seed = 1, turnPolicy = "immediate" } = {}) {
  if (
    !Number.isInteger(seed) ||
    seed < 1 ||
    seed > 2147483647 ||
    !policies.includes(turnPolicy)
  )
    throw new TypeError("Invalid route seed or steering policy.");
  return { seed, turnPolicy, classId: "scout" };
}
function checkedSegments(segments) {
  if (
    !Array.isArray(segments) ||
    !segments.length ||
    segments.length > 1000 ||
    segments.some(
      (s) =>
        !s ||
        !directions.includes(s.direction) ||
        !Number.isSafeInteger(s.ticks) ||
        s.ticks < 1,
    ) ||
    segments.reduce((n, s) => n + s.ticks, 0) > MAX_TICKS
  )
    throw new TypeError("Invalid bounded route segments.");
}
function logStep(log, direction) {
  if (log.at(-1)?.direction === direction) log.at(-1).ticks++;
  else log.push({ direction, ticks: 1 });
}
function components(run) {
  return inspectCaptureSnapshot(run).components.map(
    ({ id, cells, retained, enemyIds }) => ({
      id,
      cells: cells.length,
      retained,
      enemyIds,
    }),
  );
}

/** Compile the authored preset before applying the same gp4 recipe as gameplay. */
export function prepareSpatialMission(
  project,
  missionId,
  { difficulty = "standard" } = {},
) {
  const manifest = resolveMission(project, missionId, { difficulty });
  const gameplayTuning = resolveGameplayTuning(difficulty);
  const level = applyGameplayTuning(manifest.level, gameplayTuning);
  return {
    missionId,
    difficulty,
    sourceProjectIdentity: dataIdentity(project.source),
    authoredSimulationIdentity: manifest.simulationIdentity,
    simulationIdentity: dataIdentity({ level, gameplayTuning }),
    gameplayTuning,
    level,
    roles: Object.fromEntries(
      project.missions
        .find((m) => m.id === missionId)
        .actors.map((a) => [a.id, a.role]),
    ),
  };
}

/** Assess an authored or searched sequence, retaining unsuccessful evidence too. */
export function assessSpatialRoute(
  prepared,
  { segments, seed = 1, turnPolicy = "immediate" },
) {
  checkedSegments(segments);
  const options = checkedOptions({ seed, turnPolicy });
  const run = createRun(prepared.level, options);
  const recorder = createRecorder(prepared.level, options);
  const played = [],
    events = [],
    closures = [];
  const initialComponents = components(run);
  const actors = run.enemies.map((enemy) => ({
    id: enemy.id,
    type: enemy.type,
    role: prepared.roles[enemy.id] ?? "tuning-added-field-keeper",
    retainsField: initialComponents.some((c) => c.enemyIds.includes(enemy.id)),
  }));
  let exposureTicks = 0,
    currentExposureTicks = 0,
    maxExposureTicks = 0;
  let firstCoverageMetTick = null,
    allRequiredCapturedTick = null;
  const requiredIds = run.objectives.filter((o) => o.required).map((o) => o.id);
  let departureComponents = initialComponents;
  let departureCoverage = 0;
  outer: for (const segment of segments)
    for (let n = 0; n < segment.ticks; n++) {
      if (run.status !== "running" || run.classic.livesLost) break outer;
      const wasCutting = run.player.cutting;
      const trailLength = run.trail.length;
      recordInput(recorder, { direction: segment.direction });
      stepRun(run, { direction: segment.direction }, FIXED_DT);
      logStep(played, segment.direction);
      if (run.events.some((e) => e.type === "cut.started")) {
        departureComponents = components(run);
        departureCoverage = run.coverage;
      }
      if (
        wasCutting ||
        run.player.cutting ||
        run.events.some((e) => e.type === "cut.closed")
      ) {
        exposureTicks++;
        currentExposureTicks++;
        maxExposureTicks = Math.max(maxExposureTicks, currentExposureTicks);
      }
      for (const event of run.events) {
        if (event.type === "cells.claimed") {
          events.push({
            tick: run.tick,
            type: event.type,
            cells: event.indices.length,
            coverage: event.coverage,
            neutralizedSlowCells: event.indices.filter(
              (i) => run.classic.terrain[i] === 1,
            ).length,
            neutralizedLethalCells: event.indices.filter(
              (i) => run.classic.terrain[i] === 2,
            ).length,
          });
        } else if (event.type !== "signal.changed") events.push({ ...event });
        if (event.type === "cut.closed")
          closures.push({
            tick: run.tick,
            claimedCells: event.cells,
            coverage: run.coverage,
            coverageGain: run.coverage - departureCoverage,
            exposureTicks: currentExposureTicks,
            // The last movement can add another cell before closing; this is
            // explicitly the pre-step count, not an exact line-only predicate.
            trailCellsBeforeClosingStep: trailLength,
            departureComponents,
            retainedComponents: components(run),
            capturedObjectiveIds: run.events
              .filter((e) => e.type === "objective.captured")
              .map((e) => e.id),
            openedGateIds: run.events
              .filter((e) => e.type === "relay.opened")
              .map((e) => e.id),
          });
      }
      if (!run.player.cutting) currentExposureTicks = 0;
      if (run.coverage >= prepared.level.goal.coverage)
        firstCoverageMetTick ??= run.tick;
      if (
        requiredIds.length &&
        run.objectives.every((o) => !o.required || o.captured)
      )
        allRequiredCapturedTick ??= run.tick;
    }
  const replay = verifyReplay(exportReplay(recorder, run));
  if (!replay.match) throw new Error("Spatial route public replay mismatch.");
  const status = run.classic.livesLost
    ? "life-lost"
    : run.status === "won"
      ? "no-loss-clear"
      : run.status === "running"
        ? "route-exhausted"
        : run.status;
  return {
    format: "SpatialRouteEvidenceV1",
    missionId: prepared.missionId,
    difficulty: prepared.difficulty,
    seed,
    turnPolicy,
    sourceProjectIdentity: prepared.sourceProjectIdentity,
    authoredSimulationIdentity: prepared.authoredSimulationIdentity,
    simulationIdentity: prepared.simulationIdentity,
    levelIdentity: dataIdentity(prepared.level),
    gameplayTuning: prepared.gameplayTuning,
    ruleset: run.ruleset,
    status,
    qualification:
      status === "no-loss-clear"
        ? "legal-route-and-replay-only"
        : "needs-new-route-not-proven-impossible",
    ticks: run.tick,
    seconds: run.time,
    losses: run.classic.livesLost,
    failureCause: run.failureCause,
    coverage: run.coverage,
    coverageGoal: prepared.level.goal.coverage,
    claimedCells: run.claimedCount,
    totalClaimable: run.totalClaimable,
    cuts: closures.length,
    exposureTicks,
    maxExposureTicks,
    firstCoverageMetTick,
    allRequiredCapturedTick,
    ticksAfterRequiredObjectives:
      allRequiredCapturedTick === null
        ? null
        : run.tick - allRequiredCapturedTick,
    ticksAfterFirstCoverage:
      firstCoverageMetTick === null ? null : run.tick - firstCoverageMetTick,
    initialComponents,
    finalComponents: components(run),
    actors,
    objectives: run.objectives.map(({ id, required, captured }) => ({
      id,
      required,
      captured,
    })),
    closures,
    events,
    segments: played,
    replayVerified: true,
    checkpoint: authoritativeCheckpoint(run).hash,
  };
}

function cutChoices(run, limit) {
  const root = Math.floor(run.player.y) * run.width + Math.floor(run.player.x);
  const prior = new Map([[root, null]]),
    queue = [root],
    departures = [];
  for (let n = 0; n < queue.length; n++) {
    const cell = queue[n],
      x = cell % run.width,
      y = Math.floor(cell / run.width);
    for (const [direction, v] of Object.entries(DIRECTIONS)) {
      const nx = x + v.x,
        ny = y + v.y;
      if (nx < 0 || ny < 0 || nx >= run.width || ny >= run.height) continue;
      const next = ny * run.width + nx;
      if (run.cells[next] === CELL.SAFE && !prior.has(next)) {
        prior.set(next, cell);
        queue.push(next);
      } else if (run.cells[next] === CELL.FIELD)
        departures.push({ cell, direction });
    }
  }
  const sampled = [
    ...new Set([
      ...departures.slice(0, 12),
      ...Array.from(
        { length: limit },
        (_, i) => departures[Math.floor((i * departures.length) / limit)],
      ),
    ]),
  ].filter(Boolean);
  const choices = [];
  for (const { cell, direction } of sampled) {
    const path = [];
    for (let p = cell; p !== null; p = prior.get(p)) path.push(p);
    path.reverse();
    const v = DIRECTIONS[direction],
      trail = [];
    let x = cell % run.width,
      y = Math.floor(cell / run.width);
    for (let n = 0; n < run.width + run.height; n++) {
      x += v.x;
      y += v.y;
      if (x < 0 || y < 0 || x >= run.width || y >= run.height) break;
      const index = y * run.width + x;
      if (run.cells[index] === CELL.WALL || run.classic.terrain[index] === 2)
        break;
      if (run.cells[index] === CELL.SAFE) {
        choices.push({
          path,
          trail,
          length: trail.length,
          legs: [{ direction, x: x + 0.5, y: y + 0.5 }],
        });
        break;
      }
      trail.push(index);
    }
    choices.push(...bentFieldChoices(run, cell, path, direction));
  }
  // Frozen snapshots are a ranking heuristic only. The enemy can move into a
  // different component before closure; every candidate is played to validate.
  const geometric = [
    ...new Set([
      ...choices.filter((c) => c.legs.length === 1),
      ...Array.from(
        { length: limit * 3 },
        (_, i) => choices[Math.floor((i * choices.length) / (limit * 3))],
      ),
    ]),
  ].filter(Boolean);
  for (const choice of geometric) {
    const snapshot = inspectCaptureSnapshot(run, { trailCells: choice.trail });
    choice.rank =
      (snapshot.filledCells.length +
        choice.trail.length +
        snapshot.affectedObjectiveIds.length * 200) /
      (choice.path.length + choice.length + 10);
  }
  const ranked = [...geometric].sort((a, b) => b.rank - a.rank);
  const shortest = [...geometric].sort(
    (a, b) => a.path.length + a.length - b.path.length - b.length,
  );
  const straight = shortest.filter((choice) => choice.legs.length === 1);
  // A promising frozen-time enclosure can be unavailable at every sampled
  // departure. Keep cheap legal slices instead of starving them out of search.
  return [
    ...new Set([
      ...ranked.slice(0, Math.ceil(limit / 2)),
      ...shortest.slice(0, Math.ceil(limit / 4)),
      ...straight.slice(0, Math.ceil(limit / 4)),
      ...ranked,
    ]),
  ].slice(0, limit);
}

/** Small deterministic greedy feasibility probe, bounded by simulated ticks.
 * A successful route proves possibility; a failed search does not prove impossibility.
 * It sees full simulation state and therefore cannot stand in for human play. */
export function searchSpatialRoute(
  prepared,
  {
    seed = 1,
    turnPolicy = "immediate",
    policy = "ordinary",
    simulationTickBudget = 60000,
    candidateLimit = 16,
    maxCuts = 12,
    initialDelayTicks = 0,
    initialSegments = [],
  } = {},
) {
  const options = checkedOptions({ seed, turnPolicy });
  if (initialSegments.length) checkedSegments(initialSegments);
  if (
    !["ordinary", "efficient"].includes(policy) ||
    !Number.isSafeInteger(simulationTickBudget) ||
    simulationTickBudget < 1 ||
    simulationTickBudget > 1000000 ||
    !Number.isSafeInteger(candidateLimit) ||
    candidateLimit < 1 ||
    candidateLimit > 64 ||
    !Number.isSafeInteger(maxCuts) ||
    maxCuts < 1 ||
    maxCuts > 64 ||
    !Number.isSafeInteger(initialDelayTicks) ||
    initialDelayTicks < 0 ||
    initialDelayTicks > 1200
  )
    throw new TypeError("Invalid bounded spatial search settings.");
  let run = createRun(prepared.level, options),
    usedTicks = 0;
  const segments = [],
    attempts = [],
    selectedAttempts = [];
  const waitTicks = policy === "ordinary" ? [0] : [0, 60, 120];
  const step = (state, direction, log) => {
    if (
      usedTicks >= simulationTickBudget ||
      state.tick >= MAX_TICKS ||
      state.status !== "running" ||
      state.classic.livesLost
    )
      return false;
    stepRun(state, { direction }, FIXED_DT);
    usedTicks++;
    logStep(log, direction);
    return true;
  };
  for (let n = 0; n < initialDelayTicks; n++)
    if (!step(run, null, segments)) break;
  for (const segment of initialSegments)
    for (let n = 0; n < segment.ticks; n++) {
      if (!step(run, segment.direction, segments))
        throw new Error("Route prefix cannot continue.");
    }
  if (run.classic.livesLost || run.player.cutting)
    throw new Error(
      "Route prefix must finish without a loss on reclaimed ground.",
    );
  for (
    let cut = 0;
    cut < maxCuts &&
    run.status === "running" &&
    !run.classic.livesLost &&
    usedTicks < simulationTickBudget;
    cut++
  ) {
    let best = null;
    for (const choice of cutChoices(run, candidateLimit))
      for (const wait of waitTicks) {
        if (usedTicks >= simulationTickBudget) break;
        const next = structuredClone(run),
          moves = [];
        for (let n = 0; n < wait; n++) if (!step(next, null, moves)) break;
        let blocked = false,
          closed = false;
        const tolerance = Math.max(
          0.045,
          (next.rules.moveSpeed * FIXED_DT) / 2 + 1e-6,
        );
        for (const cell of choice.path) {
          const x = (cell % run.width) + 0.5,
            y = Math.floor(cell / run.width) + 0.5;
          for (let n = 0; n < 900; n++) {
            const dx = x - next.player.x,
              dy = y - next.player.y;
            if (Math.abs(dx) < tolerance && Math.abs(dy) < tolerance) break;
            const direction =
              Math.abs(dx) >= tolerance
                ? dx > 0
                  ? "right"
                  : "left"
                : dy > 0
                  ? "down"
                  : "up";
            if (
              !step(next, direction, moves) ||
              next.player.cutting ||
              n === 899
            ) {
              blocked = true;
              break;
            }
          }
          if (blocked) break;
        }
        if (!blocked)
          legs: for (const leg of choice.legs) {
            const axis = DIRECTIONS[leg.direction].x ? "x" : "y";
            let stationaryTicks = 0;
            for (let n = 0; n < 1200; n++) {
              if (Math.abs(next.player[axis] - leg[axis]) < tolerance) break;
              const before = { x: next.player.x, y: next.player.y };
              if (!step(next, leg.direction, moves)) break legs;
              if (next.events.some((e) => e.type === "cut.closed")) {
                closed = true;
                break legs;
              }
              // A buffered turn may spend its first tick finishing movement on
              // the previous axis. Only a sustained stop is a blocked proposal.
              stationaryTicks =
                Math.hypot(next.player.x - before.x, next.player.y - before.y) <
                1e-9
                  ? stationaryTicks + 1
                  : 0;
              if (stationaryTicks > 6 || n === 1199) break legs;
            }
          }
        const gain = next.claimedCount - run.claimedCount;
        const objectiveGain =
          next.objectives.filter((o) => o.captured).length -
          run.objectives.filter((o) => o.captured).length;
        const valid =
          !next.classic.livesLost &&
          (closed || next.status === "won") &&
          (gain > 0 || objectiveGain > 0);
        attempts.push({
          cut,
          startTick: run.tick,
          waitTicks: wait,
          ticks: next.tick - run.tick,
          status: next.classic.livesLost
            ? "life-lost"
            : valid
              ? "legal-closure"
              : "unfinished",
          gain,
          objectiveGain,
          segments: moves,
          failureCause: next.failureCause,
          failureActorId:
            next.events.find((e) => e.type === "player.failed")?.actorId ??
            null,
        });
        if (!valid) continue;
        const score =
          (gain + objectiveGain * 200) /
            (next.tick - run.tick + (policy === "ordinary" ? 0 : 120)) +
          (next.status === "won" ? 10000 : 0);
        if (!best || score > best.score)
          best = { next, moves, score, attemptIndex: attempts.length - 1 };
        if (policy === "ordinary" || next.status === "won") break;
      }
    if (!best) break;
    selectedAttempts.push(best.attemptIndex);
    run = best.next;
    for (const segment of best.moves)
      for (let n = 0; n < segment.ticks; n++)
        logStep(segments, segment.direction);
  }
  // Empty search evidence must still reproduce the untouched board. One legal
  // neutral input is explicit rather than inventing a successful route.
  if (!segments.length) segments.push({ direction: null, ticks: 1 });
  return {
    ...assessSpatialRoute(prepared, { segments, seed, turnPolicy }),
    search: {
      policy,
      simulationTickBudget,
      simulatedTicks: usedTicks,
      candidateLimit,
      maxCuts,
      initialDelayTicks,
      initialSegments,
      waitTicks,
      attempts,
      selectedAttempts,
      exhausted: usedTicks >= simulationTickBudget,
    },
  };
}
