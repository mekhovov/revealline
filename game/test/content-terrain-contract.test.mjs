import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterProject } from '../content-design/starter.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { paintContentMap } from '../content-design/map-view.mjs';
import { createMissionCard, paintMissionThumbnail } from '../content-design/mission-card.mjs';
import { createRun, stepRun, CELL, FIXED_DT } from '../core/index.mjs';
import { foundationCompatibleView } from '../ui/foundation-view.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';

function source() {
  const project = createStarterProject();
  project.maps[0].spawns[0].x = 36.5;
  project.maps[0].terrain = [
    { id: 'slow', kind: 'slow', x: 10, y: 10, w: 2, h: 2 },
    { id: 'lethal', kind: 'lethal', x: 15, y: 10, w: 2, h: 2 },
    { id: 'protected', kind: 'lethal', x: 30, y: 15, w: 2, h: 2 },
  ];
  project.maps[0].walls = [{ x: 20, y: 10, w: 2, h: 2 }];
  project.missions[0].coverage = 0.95;
  return project;
}
function surface() {
  const calls = [];
  const ctx = new Proxy(
    {},
    {
      get:
        (_, method) =>
        (...args) => {
          assert(args.every((value) => typeof value !== 'number' || Number.isFinite(value)));
          calls.push([method, ...args]);
        },
    },
  );
  return { ctx, calls };
}
function hasLine(calls, x, y, size, diagonal) {
  return calls.some(([method, ex, ey], i) => {
    const [prior, sx, sy] = calls[i - 1] ?? [];
    return (
      method === 'lineTo' &&
      prior === 'moveTo' &&
      sx > x &&
      ex < x + size &&
      Math.min(sy, ey) > y &&
      Math.max(sy, ey) < y + size &&
      sx !== ex &&
      (diagonal ? sy !== ey : sy === ey)
    );
  });
}

test('Studio and player diagrams distinguish slow dashes and lethal crosses without color or capture overlays', () => {
  const project = source(),
    before = structuredClone(project);
  const preview = prepareContentPreview(project, 'nearby-shore');
  for (const [width, paint] of [
    [1008, (ctx) => paintContentMap(ctx, preview, { showCapture: false })],
    [288, (ctx) => paintMissionThumbnail(ctx, createMissionCard(preview.manifest))],
  ]) {
    const { ctx, calls } = surface(),
      unit = width / 72;
    paint(ctx);
    assert(
      hasLine(calls, 10 * unit, 10 * unit, unit, false),
      'Slow field needs horizontal dashes.',
    );
    assert(
      hasLine(calls, 15 * unit, 10 * unit, unit, true),
      'Lethal field needs a diagonal cross.',
    );
    assert(
      !hasLine(calls, 30 * unit, 15 * unit, unit, true),
      'Permanent foundation neutralizes underlying lethal terrain.',
    );
    assert(
      !hasLine(calls, 20 * unit, 10 * unit, unit, true),
      'Walls must not borrow the lethal symbol.',
    );
  }
  assert.deepEqual(project, before);
});

for (const difficulty of ['gentle', 'standard', 'expert'])
  for (const turnPolicy of ['immediate', 'grid-center']) {
    test(`${difficulty}/${turnPolicy}: slow field changes only player speed and a wall never closes a cut`, () => {
      const project = createStarterProject();
      project.maps[0].spawns[0] = { id: 'home', x: 0.5, y: 18.5 };
      project.maps[0].terrain = [{ id: 'slow', kind: 'slow', x: 1, y: 18, w: 3, h: 1 }];
      project.missions[0].actors[0] = {
        id: 'keeper',
        role: 'field-keeper',
        tier: 'measured',
        x: 50.5,
        y: 10.5,
        heading: [1, 0],
      };
      const manifest = resolveMission(compileContentProject(project), 'nearby-shore', {
        difficulty,
      });
      const run = createRun(manifest.level, { turnPolicy });
      for (let tick = 0; tick < 12; tick++) stepRun(run, { direction: 'right' }, FIXED_DT);
      assert(Math.abs(run.player.x - 1.25) < 1e-8);
      assert(
        Math.abs(run.enemies[0].x - 50.5 - manifest.level.enemies[0].vx * 12 * FIXED_DT) < 1e-8,
      );
      assert.equal(run.lives, manifest.level.rules.lives);

      const wallProject = createStarterProject();
      wallProject.maps[0].spawns[0].x = 36.5;
      wallProject.maps[0].walls = [{ x: 36, y: 8, w: 2, h: 2 }];
      const wallLevel = resolveMission(compileContentProject(wallProject), 'nearby-shore', {
        difficulty,
      }).level;
      const wallRun = createRun(wallLevel, { turnPolicy });
      for (let tick = 0; tick < 120; tick++) stepRun(wallRun, { direction: 'down' }, FIXED_DT);
      assert.equal(wallRun.claimedCount, 0);
      assert(wallRun.trail.length > 0 && wallRun.player.cutting);
      assert(wallRun.player.y < 8);
      assert.equal(wallRun.player.speed, 0);
      assert.equal(wallRun.lives, wallLevel.rules.lives);
    });

    test(`${difficulty}/${turnPolicy}: compiler, runtime and replay preserve terrain neutralization and protected foundations`, () => {
      const project = compileContentProject(source());
      const manifest = resolveMission(project, 'nearby-shore', { difficulty });
      const paired = resolveMission(project, 'nearby-shore', { difficulty, mode: 'versus' });
      assert.deepEqual(paired.level, manifest.level);
      const run = createRun(manifest.level, { turnPolicy });
      const recorder = createRecorder(manifest.level, { turnPolicy });
      const denominator = run.totalClaimable;
      const initial = foundationCompatibleView(run);
      assert.equal(initial.terrain.length, 8);
      assert.equal(run.cells[15 * 72 + 30], CELL.SAFE);
      assert.equal(run.classic.terrain[15 * 72 + 30], 2);
      for (let tick = 0; tick < 450 && !run.claimedCount; tick++) {
        const input = { direction: 'down' };
        recordInput(recorder, input);
        stepRun(run, input, FIXED_DT);
      }
      assert(run.claimedCount > 0, 'Legal closure must occur.');
      assert.equal(run.lives, manifest.level.rules.lives);
      assert.equal(run.cells[10 * 72 + 10], CELL.SAFE);
      assert.equal(run.cells[10 * 72 + 15], CELL.SAFE);
      assert.equal(run.cells[10 * 72 + 20], CELL.WALL);
      assert.equal(run.classic.terrain[10 * 72 + 10], 1);
      assert.equal(run.classic.terrain[10 * 72 + 15], 2);
      assert.equal(run.totalClaimable, denominator);
      const checkpoint = authoritativeCheckpoint(run);
      assert.deepEqual(foundationCompatibleView(run).terrain, []);
      assert.deepEqual(
        authoritativeCheckpoint(run),
        checkpoint,
        'Projection cannot alter the attempt.',
      );
      assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
    });
  }
