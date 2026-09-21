// Extracted historical Signal test predicates; not runtime mastery awards.
import { CELL } from '../../core/index.mjs';
import { roverLinks } from './rover-goal.mjs';

const contains = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
function neutralized(run, rect) {
  for (let y = rect.y; y < rect.y + rect.h; y++)
    for (let x = rect.x; x < rect.x + rect.w; x++)
      if (run.cells[y * run.width + x] !== CELL.SAFE) return false;
  return true;
}
export function createSignalGoalEvidence(map, run) {
  if (!map?.terrain || !map?.foundations) throw Error('Signal evidence requires its authored map');
  const evidence = {
    map,
    bedAt: map.terrain.map(() => null),
    enteredAt: map.terrain.map(() => null),
    visitAt: map.foundations.map(() => null),
  };
  observeSignalGoal(run, evidence);
  return evidence;
}
export function observeSignalGoal(run, evidence) {
  const x = Math.floor(run.player.x),
    y = Math.floor(run.player.y);
  const { map, bedAt, enteredAt, visitAt } = evidence;
  map.terrain.forEach((rect, i) => {
    if (bedAt[i] === null && neutralized(run, rect)) bedAt[i] = run.tick;
    if (enteredAt[i] === null && contains(rect, x, y) && run.cells[y * run.width + x] !== CELL.SAFE)
      enteredAt[i] = run.tick;
  });
  map.foundations.forEach((rect, i) => {
    if (visitAt[i] === null && contains(rect, x, y)) visitAt[i] = run.tick;
  });
}
export function inspectSignalGoal({ missionId, run, evidence }) {
  const { map, bedAt, enteredAt, visitAt } = evidence;
  const allLinked = roverLinks(run, map.foundations);
  const conditions = {
    'soft-crossing': bedAt.every((t) => t !== null),
    'dry-spine': bedAt.some(
      (t, i) => t !== null && (enteredAt[1 - i] === null || t < enteredAt[1 - i]),
    ),
    'wide-approach': allLinked,
    'cool-the-crossing': bedAt[0] !== null && (visitAt[1] === null || bedAt[0] < visitAt[1]),
    'garden-refuges': allLinked && bedAt.some((t) => t !== null),
    'neutral-ground': bedAt.every((t) => t !== null),
    'signal-remix': allLinked && run.classic.powerups.every((p) => p.collectedTick === null),
  };
  if (!Object.hasOwn(conditions, missionId)) throw Error('Unknown Signal goal');
  return {
    achieved: run.status === 'won' && run.classic.livesLost === 0 && conditions[missionId],
    allLinked,
    bedAt: [...bedAt],
    enteredAt: [...enteredAt],
    visitAt: [...visitAt],
  };
}
