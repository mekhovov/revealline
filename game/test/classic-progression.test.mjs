import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, getSummary, FIXED_DT, CLASSES } from '../core/index.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplay } from '../replay.mjs';
import { createDifficultyContext, CLASSIC_GENTLE_POLICY_VERSION } from '../campaign-difficulty.mjs';
import { emptyProgress, awardCompletion } from '../progress.mjs';
import { retryExplanation } from '../ui/retry-view.mjs';

const level = {
  version: 'xonix-level.v4',
  id: 'classic-progress',
  name: 'Pickup progress',
  revision: '1',
  width: 72,
  height: 36,
  encounter: null,
  classic: {
    version: 'classic.v1',
    terrain: [],
    powerups: [{ id: 'life', kind: 'extra-life', x: 60.5, y: 15.5 }],
  },
  spawn: { x: 60.5, y: 0.5 },
  goal: { coverage: 0.1 },
  enemies: [{ id: 'seed', type: 'bouncer', x: 20.5, y: 18.5, vx: 0, vy: 0 }],
  rules: { lives: 3, respawnSeconds: 0.1, graceSeconds: 0 },
};
const campaign = {
  version: 'xonix-campaign.v1',
  id: 'classic-progress-campaign',
  revision: '1',
  levels: [level],
  classRecipes: CLASSES,
};
function flight(turnPolicy) {
  const options = { classId: 'scout', classRecipes: CLASSES, seed: 1, turnPolicy };
  const run = createRun(level, options),
    recorder = createRecorder(level, options, 'classic-progress-test');
  const advance = (direction, ticks) => {
    for (let t = 0; t < ticks; t++) {
      assert.ok(['running', 'respawning'].includes(run.status));
      const input = { direction };
      stepRun(run, input, FIXED_DT);
      recordInput(recorder, input);
    }
  };
  return { run, recorder, advance };
}
for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`${turnPolicy}: an earned extra life preserves a clean win and is accepted by progression`, () => {
    const { run, recorder, advance } = flight(turnPolicy);
    for (let i = 0; i < 700 && run.status === 'running'; i++) advance('down', 1);
    assert.equal(run.status, 'won');
    assert.equal(run.lives, 4);
    assert.equal(run.classic.livesLost, 0);
    const summary = getSummary(run);
    assert.equal(summary.medal, 'gold');
    assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
    const next = awardCompletion(emptyProgress(campaign), campaign, summary, {
      runId: `clean-${turnPolicy}`,
    });
    assert.equal(next.clears[level.id].clean, true);
    assert.equal(next.clears[level.id].medals, 3);
  });
  test(`${turnPolicy}: replacing a lost life does not recreate clean play or a gold medal`, () => {
    const { run, recorder, advance } = flight(turnPolicy);
    advance('down', 35);
    for (let i = 0; i < 35 && run.status === 'running'; i++) advance('up', 1);
    assert.equal(run.status, 'respawning');
    assert.equal(run.classic.livesLost, 1);
    while (run.status === 'respawning') advance(null, 1);
    for (let i = 0; i < 700 && run.status === 'running'; i++) advance('down', 1);
    assert.equal(run.status, 'won');
    assert.equal(run.lives, 3);
    assert.equal(run.classic.livesLost, 1);
    const summary = getSummary(run);
    assert.equal(summary.medal, 'silver');
    assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
    const progress = emptyProgress(campaign);
    const next = awardCompletion(progress, campaign, summary, { runId: `recovered-${turnPolicy}` });
    assert.equal(next.clears[level.id].clean, false);
    assert.equal(next.clears[level.id].medals, 2);
    for (const patch of [
      { livesLost: undefined },
      { livesLost: -1 },
      { lives: 9 },
      { livesLost: 65 },
      { medal: 'gold' },
    ])
      assert.equal(
        awardCompletion(progress, campaign, { ...summary, ...patch }, { runId: 'invalid' }),
        progress,
      );
  });
}

test('classic Gentle has its own policy and scales every moving classic role without editing the source', () => {
  const source = structuredClone(campaign);
  source.levels[0].enemies.push(
    {
      id: 'contour',
      type: 'contour-patrol',
      edge: { x: 1, y: 1, side: 'north' },
      clockwise: true,
      speed: 4,
    },
    { id: 'rover', type: 'claimed-rover', x: 30.5, y: 20.5, vx: 4, vy: -3 },
    { id: 'eroder', type: 'eroder', x: 40.5, y: 20.5, vx: 3, vy: -2 },
  );
  const before = structuredClone(source),
    context = createDifficultyContext(source, 'gentle');
  assert.deepEqual(source, before);
  assert.equal(context.policyVersion, CLASSIC_GENTLE_POLICY_VERSION);
  assert.notEqual(context.campaignKey, context.baseCampaignKey);
  const gentle = context.campaign.levels[0];
  assert.equal(gentle.rules.lives, 5);
  assert.equal(gentle.enemies[1].speed, 2.4);
  assert.equal(gentle.enemies[2].vx, 2.4);
  assert.equal(gentle.enemies[3].vy, -1.2);
  assert.deepEqual(gentle.classic, level.classic);
  assert.equal(createRun(gentle).ruleset, 'xonix-core.v5');
});

test('lethal terrain has a readable terminal explanation without changing recovery UI', () => {
  const result = retryExplanation({
    status: 'lost',
    ruleset: 'xonix-core.v5',
    failureCause: 'lethal-terrain',
  });
  assert.match(result.reason, /lethal field/);
  assert.match(result.tip, /enclose/);
  assert.equal(retryExplanation({ status: 'respawning', failureCause: 'lethal-terrain' }), null);
});
