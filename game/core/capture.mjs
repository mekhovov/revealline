import { CELL } from './registry.mjs';
import { EPS, capsuleTime, pointAt } from './geometry.mjs';
import { ownershipSpans, cellIndex } from './movement.mjs';

export function tracePlan(state, paths, duration) {
  const additions = [],
    cells = [],
    spans = ownershipSpans(paths);
  let cutting = state.player.cutting,
    started = null,
    closure = null,
    stop = null;
  for (const span of spans) {
    const kind = state.cells[span.index];
    if (kind === CELL.SAFE) {
      if (cutting) {
        closure = span.t0;
        break;
      }
      continue;
    }
    if (kind === CELL.WALL) {
      stop = span.t0;
      break;
    }
    if (!cutting) {
      if (state.player.graceUntil > state.time + span.t0 + EPS) {
        stop = span.t0;
        break;
      }
      started = span.t0;
      cutting = true;
    }
    additions.push(span);
    cells.push({ index: span.index, time: span.t0 });
  }
  // A path may finish exactly at the safe cell boundary. Its travel direction
  // determines the cell entered, avoiding an extra tick of ambiguous ownership.
  if (cutting && closure === null && spans.length) {
    const end = spans.at(-1),
      dx = Math.sign(end.x2 - end.x1),
      dy = Math.sign(end.y2 - end.y1);
    const index = cellIndex(end.x2 + dx * EPS * 4, end.y2 + dy * EPS * 4);
    if (state.cells[index] === CELL.SAFE) closure = end.t1;
  }
  return { additions, cells, started, closure, stop, duration };
}

function samePoint(a, b) {
  return Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS;
}
export function selfContact(state, trace, horizon) {
  const previous = state.trailSegments.map((s) => ({ ...s }));
  let best = null;
  const visited = new Set(state.trail.map((c) => c.index));
  let last = state.trail.at(-1)?.index;
  for (const cell of trace.cells) {
    if (cell.time > horizon + EPS) break;
    if (visited.has(cell.index) && cell.index !== last)
      best = Math.min(best ?? Infinity, cell.time);
    visited.add(cell.index);
    last = cell.index;
  }
  for (const s of trace.additions) {
    if (s.t0 > horizon + EPS) break;
    const fraction = s.t1 > s.t0 ? Math.min(1, (horizon - s.t0) / (s.t1 - s.t0)) : 1;
    const a = { x: s.x1, y: s.y1 },
      b = pointAt(a, { x: s.x2, y: s.y2 }, fraction);
    for (let i = 0; i < previous.length; i++) {
      const old = previous[i],
        tail = { x: old.x1, y: old.y1 },
        head = { x: old.x2, y: old.y2 };
      if (i === previous.length - 1 && samePoint(a, head)) {
        const dot = (b.x - a.x) * (head.x - tail.x) + (b.y - a.y) * (head.y - tail.y);
        const cross = (b.x - a.x) * (head.y - tail.y) - (b.y - a.y) * (head.x - tail.x);
        if (dot < -EPS && Math.abs(cross) < EPS) best = Math.min(best ?? Infinity, s.t0);
        continue;
      }
      const t = capsuleTime(a, b, tail, head, 0);
      if (t != null) best = Math.min(best ?? Infinity, s.t0 + (Math.min(s.t1, horizon) - s.t0) * t);
    }
    previous.push(s);
  }
  return best;
}

export function appendTrail(state, trace, time) {
  if (trace.started !== null && trace.started <= time + EPS && !state.player.cutting) {
    state.player.cutting = true;
    state.events.push({ type: 'cut.started', tick: state.tick, time: state.time + trace.started });
  }
  const have = new Set(state.trail.map((c) => c.index));
  for (const c of trace.cells)
    if (c.time < time + EPS && !have.has(c.index)) {
      have.add(c.index);
      state.trail.push({ x: c.index % 48, y: Math.floor(c.index / 48), index: c.index });
    }
  for (const s of trace.additions) {
    if (s.t0 >= time - EPS) continue;
    const end = pointAt(
      { x: s.x1, y: s.y1 },
      { x: s.x2, y: s.y2 },
      Math.min(1, (time - s.t0) / (s.t1 - s.t0)),
    );
    const next = { x1: s.x1, y1: s.y1, x2: end.x, y2: end.y },
      last = state.trailSegments.at(-1);
    const merge =
      last &&
      Math.abs(last.x2 - next.x1) < EPS &&
      Math.abs(last.y2 - next.y1) < EPS &&
      Math.abs(
        (last.x2 - last.x1) * (next.y2 - next.y1) - (last.y2 - last.y1) * (next.x2 - next.x1),
      ) < EPS &&
      (last.x2 - last.x1) * (next.x2 - next.x1) + (last.y2 - last.y1) * (next.y2 - next.y1) > 0;
    if (merge) {
      last.x2 = next.x2;
      last.y2 = next.y2;
    } else state.trailSegments.push(next);
  }
}

/** Four-neighbor enemy-seeded fill. Each field enemy center retains its region. */
export function commitCapture(state) {
  const secured = [];
  for (const c of state.trail)
    if (state.cells[c.index] === CELL.FIELD) {
      state.cells[c.index] = CELL.SAFE;
      secured.push(c.index);
    }
  const retained = new Uint8Array(48 * 36),
    queue = new Int32Array(48 * 36);
  let head = 0,
    tail = 0;
  for (const e of state.enemies)
    if (e.type !== 'border-patrol') {
      const index = cellIndex(e.x, e.y);
      if (state.cells[index] === CELL.FIELD && !retained[index]) {
        retained[index] = 1;
        queue[tail++] = index;
      }
    }
  while (head < tail) {
    const i = queue[head++],
      x = i % 48,
      y = Math.floor(i / 48);
    for (const n of [
      x > 0 ? i - 1 : -1,
      x < 47 ? i + 1 : -1,
      y > 0 ? i - 48 : -1,
      y < 35 ? i + 48 : -1,
    ])
      if (n >= 0 && state.cells[n] === CELL.FIELD && !retained[n]) {
        retained[n] = 1;
        queue[tail++] = n;
      }
  }
  for (let y = 1; y < 35; y++)
    for (let x = 1; x < 47; x++) {
      const i = y * 48 + x;
      if (state.cells[i] === CELL.FIELD && !retained[i]) {
        state.cells[i] = CELL.SAFE;
        secured.push(i);
      }
    }
  state.claimedCount += secured.length;
  state.coverage = state.claimedCount / state.totalClaimable;
  state.score += secured.length * state.rules.pointsPerCell;
  state.player.cutting = false;
  state.trail = [];
  state.trailSegments = [];
  state.events.push({
    type: 'cut.closed',
    tick: state.tick,
    time: state.time,
    cells: secured.length,
  });
  state.events.push({
    type: 'cells.claimed',
    tick: state.tick,
    time: state.time,
    indices: secured,
    coverage: state.coverage,
  });
  for (const objective of state.objectives)
    if (!objective.captured && state.cells[cellIndex(objective.x, objective.y)] === CELL.SAFE) {
      objective.captured = true;
      objective.revealed = true;
      state.score += state.rules.objectivePoints;
      state.events.push({
        type: 'objective.captured',
        tick: state.tick,
        time: state.time,
        id: objective.id,
      });
    }
}
