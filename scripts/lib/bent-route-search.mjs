// Bounded offline geometry proposals. Every proposal still needs real input replay.
import { CELL, DIRECTIONS } from '../../game/core/index.mjs';
import { inspectCaptureSnapshot } from '../../game/core/capture-regions.mjs';

export function bentFieldChoices(run, cell, path, direction) {
  const x = cell % run.width,
    y = Math.floor(cell / run.width);
  const at = (cx, cy) =>
    cx < 0 || cy < 0 || cx >= run.width || cy >= run.height
      ? CELL.WALL
      : run.cells[cy * run.width + cx];
  const ray = (cx, cy, d, length) => {
    const v = DIRECTIONS[d],
      cells = [];
    for (let i = 0; i < length; i++) {
      cx += v.x;
      cy += v.y;
      const index = cy * run.width + cx;
      if (at(cx, cy) === CELL.WALL || run.classic.terrain[index] === 2) return null;
      cells.push(index);
      if (at(cx, cy) === CELL.SAFE) return { x: cx, y: cy, cells, safe: true };
    }
    return { x: cx, y: cy, cells, safe: false };
  };
  const back = { left: 'right', right: 'left', up: 'down', down: 'up' }[direction];
  const choices = [];
  for (const depth of [2, 3, 4, 5, 6, 8, 12, 16, 24]) {
    const first = ray(x, y, direction, depth);
    if (!first || first.safe) continue;
    for (const side of DIRECTIONS[direction].x ? ['up', 'down'] : ['left', 'right'])
      for (const across of [1, 2, 4, 8]) {
        const second = ray(first.x, first.y, side, across);
        if (!second) continue;
        const third = second.safe ? null : ray(second.x, second.y, back, run.width + run.height);
        if (!second.safe && !third?.safe) continue;
        const rays = [first, second, ...(third ? [third] : [])];
        const cells = rays.flatMap((r) => r.cells);
        if (new Set(cells).size !== cells.length) continue;
        choices.push({
          direction,
          path,
          length: cells.length,
          trail: cells.filter((i) => run.cells[i] === CELL.FIELD),
          legs: rays.map((r, i) => ({
            direction: [direction, side, back][i],
            x: r.x + 0.5,
            y: r.y + 0.5,
          })),
        });
      }
  }
  return choices;
}

export function sampleBentChoices(run, choices) {
  const sampled = [
    ...new Set([
      ...choices.slice(0, 150),
      ...Array.from({ length: 400 }, (_, i) => choices[Math.floor((i * choices.length) / 400)]),
    ]),
  ].filter(Boolean);
  for (const choice of sampled) {
    const snapshot = inspectCaptureSnapshot(run, { trailCells: choice.trail });
    const hazard = snapshot.filledCells.filter((i) => run.classic.terrain[i] === 2).length;
    choice.estimate =
      (snapshot.filledCells.length +
        choice.trail.length +
        hazard * 2000 +
        snapshot.affectedObjectiveIds.length * 800) /
      (choice.path.length + choice.length + 15);
  }
  return sampled.sort((a, b) => b.estimate - a.estimate).slice(0, 60);
}
