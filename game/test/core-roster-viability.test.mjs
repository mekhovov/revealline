import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRun, stepRun, FIXED_DT, CLASSES } from '../core/index.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplay } from '../replay.mjs';
import { loadInputs, digest } from '../../scripts/verify-campaign.mjs';
import { expansionSources } from '../../scripts/verify-packs.mjs';

const { campaign, classes } = await loadInputs();
const campaignProof = JSON.parse(
  await readFile(new URL('../replays/campaign-routes.json', import.meta.url), 'utf8'),
);
const packProof = JSON.parse(
  await readFile(new URL('../replays/expansion-routes.json', import.meta.url), 'utf8'),
);
const sources = [
  ...campaign.levels.map((level) => ({ level, classes, routes: campaignProof.routes })),
  ...(await expansionSources()).flatMap((pack) =>
    pack.campaigns.flatMap((campaign) =>
      campaign.levels.map((level) => ({
        level,
        classes: pack.classRecipes,
        routes: packProof.routes.filter((route) => route.packId === pack.id),
      })),
    ),
  ),
];

for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`${turnPolicy}: all seven loadouts can clear all eighteen supplied maps without mandatory action, supplies or switching`, () => {
    const before = digest(sources);
    assert.equal(sources.length, 18);
    for (const { level, classes, routes } of sources) {
      const route = routes.find(
        (route) => route.levelId === level.id && route.turnPolicy === turnPolicy,
      );
      assert.equal(route.levelSha256, digest(level));
      assert.equal(classes.length, 7);
      for (const recipe of classes) {
        const state = createRun(level, {
          classId: recipe.id,
          classRecipes: classes,
          turnPolicy,
          seed: 1,
        });
        const label = `${level.id}/${recipe.id}/${turnPolicy}`;
        for (const segment of route.segments)
          for (let i = 0; i < segment.ticks && state.status === 'running'; i++)
            stepRun(
              state,
              { direction: segment.input.direction, boost: segment.input.boost, action: false },
              FIXED_DT,
            );
        assert.equal(state.status, 'won', label);
        assert.equal(state.lives, state.rules.lives, label);
        assert.equal(state.activeClassId, recipe.id, label);
        assert.equal(state.classHistory.length, 1, label);
        assert.equal(state.ability.ammo, 0, label);
        assert.ok(state.coverage >= level.goal.coverage - 1e-9, label);
        assert.ok(
          state.objectives.every((objective) => !objective.required || objective.captured),
          label,
        );
      }
    }
    assert.equal(digest(sources), before);
  });

  test(`${turnPolicy}: an impact abort leaves the same attempt able to complete a legal recut`, () => {
    const state = createRun(
      {
        version: 'xonix-level.v1',
        id: 'impact-recut',
        revision: '1',
        width: 48,
        height: 36,
        spawn: { x: 24.5, y: 0.5 },
        goal: { coverage: 0.4 },
        enemies: [{ id: 'anchor', type: 'bouncer', x: 40.5, y: 24.5, vx: 0, vy: 0 }],
        rules: { timeLimitSeconds: 12, cutTimeLimitSeconds: 5, maxTrailCells: 34 },
      },
      { classId: 'impact', turnPolicy },
    );
    stepRun(state, { direction: 'down' }, 0.5);
    assert.equal(state.player.cutting, true);
    stepRun(state, { action: true });
    assert.equal(state.status, 'respawning');
    assert.equal(state.claimedCount, 0);
    assert.equal(state.lives, 3);
    const cooldownUntil = state.ability.cooldownUntil;
    stepRun(state, {}, 2);
    assert.equal(state.status, 'running');
    assert.equal(state.ability.cooldownUntil, cooldownUntil);
    stepRun(state, { direction: 'down' }, 5);
    assert.equal(state.status, 'won');
    assert.equal(state.lives, 3);
    assert.ok(state.time < cooldownUntil, 'Ordinary cuts remain available during pulse cooldown.');
  });

  test(`${turnPolicy}: a stopped live cut still reaches its deadline for shield and fiber`, () => {
    for (const classId of ['interceptor', 'fiber']) {
      const state = createRun(
        {
          version: 'xonix-level.v1',
          id: 'stopped-cut',
          revision: '1',
          width: 48,
          height: 36,
          spawn: { x: 24.5, y: 0.5 },
          goal: { coverage: 0.4 },
          rules: { cutTimeLimitSeconds: 0.3 },
        },
        { classId, turnPolicy },
      );
      stepRun(state, { direction: 'down' }, 0.25);
      const x = state.player.x,
        y = state.player.y;
      stepRun(state, { action: true }, 0.15);
      assert.equal(state.lives, 2, classId);
      assert.equal(state.failureCause, 'cut-timeout', classId);
      assert.equal(state.player.x, x);
      assert.equal(state.player.y, y);
      assert.equal(state.claimedCount, 0);
    }
  });
}

test('every loadout preserves the distinct off-center turning behavior through portable replay', () => {
  const level = {
    version: 'xonix-level.v1',
    id: 'roster-turns',
    revision: '1',
    width: 48,
    height: 36,
    spawn: { x: 6.5, y: 0.5 },
    goal: { coverage: 1 },
  };
  for (const recipe of CLASSES) {
    const positions = {};
    for (const turnPolicy of ['immediate', 'grid-center']) {
      const options = { classId: recipe.id, turnPolicy };
      const state = createRun(level, options),
        recorder = createRecorder(level, options, 'turn-policy-regression');
      for (const direction of ['right', 'down'])
        for (let tick = 0; tick < 3; tick++) {
          const input = { direction };
          stepRun(state, input);
          recordInput(recorder, input);
        }
      const result = verifyReplay(exportReplay(recorder, state));
      assert.equal(result.match, true);
      positions[turnPolicy] = { x: state.player.x, y: state.player.y };
    }
    assert.ok(Math.abs(positions.immediate.x - 6.7) < 1e-7, recipe.id);
    assert.ok(Math.abs(positions.immediate.y - 0.7) < 1e-7, recipe.id);
    assert.ok(Math.abs(positions['grid-center'].x - 6.9) < 1e-7, recipe.id);
    assert.equal(positions['grid-center'].y, 0.5, recipe.id);
  }
});
