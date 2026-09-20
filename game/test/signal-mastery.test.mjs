import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSignalCandidates } from '../content-design/signal-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT, CELL } from '../core/index.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';

const fixture = JSON.parse(
  await readFile(new URL('./fixtures/signal-mastery-routes.json', import.meta.url)),
);
const extension = JSON.parse(
  await readFile(new URL('./fixtures/signal-mastery-extension-routes.json', import.meta.url)),
);
const source = createSignalCandidates(),
  project = compileContentProject(source);
const contains = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
function neutralized(run, rect) {
  for (let y = rect.y; y < rect.y + rect.h; y++)
    for (let x = rect.x; x < rect.x + rect.w; x++)
      if (run.cells[y * 72 + x] !== CELL.SAFE) return false;
  return true;
}
function connected(run, rects) {
  const start = rects[0].y * 72 + rects[0].x,
    seen = new Set([start]),
    queue = [start];
  for (let at = 0; at < queue.length; at++) {
    const cell = queue[at],
      x = cell % 72,
      y = Math.floor(cell / 72);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        ny = y + dy,
        n = ny * 72 + nx;
      if (nx < 0 || nx >= 72 || ny < 0 || ny >= 36 || seen.has(n) || run.cells[n] !== CELL.SAFE)
        continue;
      seen.add(n);
      queue.push(n);
    }
  }
  return rects.every((r) => seen.has(r.y * 72 + r.x));
}

test('Signal optional goals retain exact Standard routes and qualify the supplemental preset/steering routes', () => {
  assert.equal(fixture.format, 'SignalMasteryFeasibilityRoutesV1');
  assert.equal(fixture.seed, 1);
  assert.equal(fixture.difficulty, 'standard');
  assert.equal(fixture.turnPolicy, 'immediate');
  assert.deepEqual(
    fixture.rows.map((row) => row[0]),
    project.missions.map((m) => m.id),
  );
  assert.equal(extension.format, 'SignalMasteryExtensionRoutesV1');
  assert.equal(extension.seed, fixture.seed);
  assert.equal(extension.sets.length, 5);
  assert.equal(extension.sets.flatMap((set) => set.rows).length, 17);
  for (const set of extension.sets)
    assert.equal(new Set(set.rows.map(([id]) => id)).size, set.rows.length);
  const sets = [fixture, ...extension.sets];
  assert.equal(new Set(sets.map((set) => `${set.difficulty}/${set.turnPolicy}`)).size, 6);
  for (const {
    difficulty,
    turnPolicy,
    row: [id, identity, checkpoint, segments],
  } of sets.flatMap((set) => set.rows.map((row) => ({ ...set, row })))) {
    const mission = source.missions.find((m) => m.id === id),
      map = source.maps.find((m) => m.id === mission.map.id),
      manifest = resolveMission(project, id, { difficulty });
    assert.equal(manifest.simulationIdentity, identity, id);
    const options = { seed: fixture.seed, classId: 'scout', turnPolicy };
    const run = createRun(manifest.level, options),
      recorder = createRecorder(
        manifest.level,
        options,
        'mastery-feasibility-not-human-validation',
      );
    const bedAt = map.terrain.map(() => null),
      enteredAt = map.terrain.map(() => null),
      visitAt = map.foundations.map(() => null);
    const observe = () => {
      const x = Math.floor(run.player.x),
        y = Math.floor(run.player.y);
      map.terrain.forEach((rect, i) => {
        if (bedAt[i] === null && neutralized(run, rect)) bedAt[i] = run.tick;
        if (enteredAt[i] === null && contains(rect, x, y) && run.cells[y * 72 + x] !== CELL.SAFE)
          enteredAt[i] = run.tick;
      });
      map.foundations.forEach((rect, i) => {
        if (visitAt[i] === null && contains(rect, x, y)) visitAt[i] = run.tick;
      });
    };
    observe();
    for (const [direction, ticks] of segments) {
      assert(Number.isSafeInteger(ticks) && ticks > 0 && ticks <= 1000);
      for (let tick = 0; tick < ticks; tick++) {
        assert.equal(run.status, 'running', id);
        recordInput(recorder, { direction });
        stepRun(run, { direction }, FIXED_DT);
        observe();
        assert.equal(run.classic.livesLost, 0, id);
      }
    }
    assert.equal(run.status, 'won', id);
    assert.equal(run.classic.livesLost, 0, id);
    assert.equal(authoritativeCheckpoint(run).hash, checkpoint, id);
    assert.equal(verifyReplay(exportReplay(recorder, run)).match, true, id);
    if (id === 'soft-crossing' || id === 'neutral-ground')
      assert(
        bedAt.every((t) => t !== null),
        id,
      );
    if (id === 'dry-spine')
      assert(
        bedAt.some((t, i) => t !== null && (enteredAt[1 - i] === null || t < enteredAt[1 - i])),
        id,
      );
    if (id === 'cool-the-crossing')
      assert(bedAt[0] !== null && (visitAt[1] === null || bedAt[0] < visitAt[1]), id);
    if (['wide-approach', 'garden-refuges', 'signal-remix'].includes(id))
      assert(connected(run, map.foundations), id);
    if (id === 'garden-refuges')
      assert(
        bedAt.some((t) => t !== null),
        id,
      );
    if (id === 'signal-remix')
      assert(
        run.classic.powerups.every((p) => p.collectedTick === null),
        id,
      );
  }
});
