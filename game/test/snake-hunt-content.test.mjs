import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSnakeHuntCandidates,
  SNAKE_HUNT_STAGES,
} from '../content-design/snake-hunt-candidates.mjs';
import { createTeamSnakeHuntCandidates } from '../content-design/team-snake-hunt-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createTeamCampaignTestPack } from '../content-design/team-export.mjs';
import { dataIdentity } from '../data-json.mjs';

test('Snake chapters own distinct geometry and finite clear-all populations', () => {
  const source = createSnakeHuntCandidates({ artwork: false });
  assert.equal(source.campaigns.length, 8);
  assert.equal(source.missions.length, 48);
  assert.equal(
    new Set(SNAKE_HUNT_STAGES.map(({ walls, foundations }) => dataIdentity({ walls, foundations })))
      .size,
    48,
  );
  for (const mission of source.missions) {
    assert.equal(mission.hunt.mode, 'hunt');
    assert.equal(mission.hunt.quota, mission.hunt.targets.length);
    assert.equal(mission.timeLimitSeconds, 0);
    if (mission.snake.bonus === 'ordered')
      assert.deepEqual(
        mission.snake.order,
        mission.hunt.targets.map((target) => target.id),
      );
  }
});

test('Snake source compiles to explicit successors in every admitted mode and Team exports retain its recipe', () => {
  const solo = compileContentProject(createSnakeHuntCandidates({ artwork: false }));
  for (const mode of ['solo', 'versus']) {
    const manifest = resolveMission(solo, solo.source.missions[0].id, {
      mode,
      difficulty: 'standard',
    });
    assert.equal(manifest.level.version, 'xonix-level.v11');
    assert.deepEqual(manifest.level.snake, solo.source.missions[0].snake);
  }
  const teamSource = createTeamSnakeHuntCandidates({ artwork: false });
  const pack = createTeamCampaignTestPack(teamSource, teamSource.campaigns[0].id);
  assert.equal(pack.ruleset, 'revealline-coop.v12');
  assert.equal(pack.levels.length, 6);
  assert.equal(pack.levels[0].version, 'revealline-coop-level.v10');
  assert.deepEqual(pack.levels[0].snake, teamSource.missions[0].snake);
});

test('Snake source cannot silently enter the historical Team Hunt edition', () => {
  const source = createTeamSnakeHuntCandidates({ artwork: false });
  source.missions[0].team.format = 'TeamMissionV7';
  assert.throws(() => compileContentProject(source), /Snake edition/);
});
