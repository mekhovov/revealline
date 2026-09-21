import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createCulturalWorkshopCandidates,
  CULTURAL_WORKSHOP_ARCS,
} from '../content-design/cultural-workshop-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { createRun, stepRun, FIXED_DT, CELL } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const themes = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url)),
).themes;
test('eight distinct shared-framework greyboxes preserve sources and explicit successor pressure', () => {
  const source = createCulturalWorkshopCandidates(),
    before = structuredClone(source);
  const project = compileContentProject(source);
  assert.deepEqual(source, before);
  assert.equal(source.difficultyCatalogId, 'journey-difficulty-v2');
  assert.equal(project.missions.length, 8);
  assert.equal(project.campaigns.length, 2);
  assert.deepEqual(
    CULTURAL_WORKSHOP_ARCS.flatMap((arc) => arc.missionIds),
    project.missions.map((m) => m.id),
  );
  assert.equal(new Set(project.maps.map((map) => map.geometryIdentity)).size, 8);
  for (const mission of project.missions) {
    assert.deepEqual(mission.modes, ['solo', 'versus']);
    assert.equal(mission.timeLimitSeconds, 0);
    assert.equal(mission.bonuses.length, 0);
    assert.equal(mission.presentation.backgroundAssetId, null, 'Greybox is not final artwork');
    assert.deepEqual(mission.design.introduces, [], 'These optional arcs recombine known rules');
    assert.deepEqual(mission.design.durationSeconds, [60, 150]);
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const solo = resolveMission(project, mission.id, { difficulty });
      const versus = resolveMission(project, mission.id, { difficulty, mode: 'versus' });
      assert.equal(solo.simulationIdentity, versus.simulationIdentity);
      assert.deepEqual(solo.level, versus.level);
      assert.equal(solo.level.rules.moveSpeed, 10);
      assert.equal(solo.officialProgressEligible, false);
      assert(
        solo.level.enemies
          .filter((e) => e.type === 'bouncer')
          .every(
            (e) =>
              Math.abs(
                Math.hypot(e.vx, e.vy) - { gentle: 3.2, standard: 4.48, expert: 5.6 }[difficulty],
              ) < 1e-9,
          ),
      );
    }
  }
});

test('open motifs have no isolated field pockets and every reclaimed component has usable departures', () => {
  const project = compileContentProject(createCulturalWorkshopCandidates());
  for (const map of project.maps) {
    assert.equal(map.geometry.fieldComponents.length, 1, map.source.id);
    assert(
      map.geometry.safeComponents.every((c) => c.departures.length >= 4),
      map.source.id,
    );
    assert.deepEqual(
      map.geometry.diagnostics.map((d) => d.code),
      ['disconnected-foundations'],
      map.source.id,
    );
    assert(map.geometry.foundationCount > 0 && map.geometry.eligibleCount > 1500, map.source.id);
    for (const spawn of map.source.spawns)
      assert.equal(
        map.geometry.cells[Math.floor(spawn.y) * 72 + Math.floor(spawn.x)],
        CELL.SAFE,
        map.source.id,
      );
  }
});

test('all Studio previews compile exact maps and ten-second spawn observations stay lossless on each preset', () => {
  const source = createCulturalWorkshopCandidates();
  const project = compileContentProject(source);
  for (const mission of source.missions) {
    const preview = prepareContentPreview(source, mission.id, {
      theme: themes.find((t) => t.id === mission.presentation.themeId),
    });
    assert(preview.scenario);
    assert.equal(preview.capture.filledCells.length, 0, mission.id);
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const m = resolveMission(project, mission.id, { difficulty }),
        run = createRun(m.level, { seed: 1 });
      const peer = createRun(m.level, { seed: 1 });
      for (let n = 0; n < 1200; n++) {
        stepRun(run, { direction: null }, FIXED_DT);
        stepRun(peer, { direction: null }, FIXED_DT);
      }
      assert.equal(run.lives, m.level.rules.lives, mission.id);
      assert.equal(run.status, 'running', mission.id);
      assert.deepEqual(authoritativeCheckpoint(run), authoritativeCheckpoint(peer));
    }
  }
});
