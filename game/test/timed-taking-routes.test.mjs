import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTimedBorderCandidates } from '../content-design/timed-border-candidates.mjs';
import { withPressureDifficulty } from '../content-design/pressure-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT, CLASSES } from '../core/index.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import { authoritativeCheckpoint, recordInput, exportReplay, verifyReplay } from '../replay.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';
import { campaignKey } from '../library.mjs';
import { playTimedTakingRoute } from './helpers/timed-taking-evidence.mjs';

const fixture = JSON.parse(
  await readFile(new URL('./fixtures/timed-taking-routes.json', import.meta.url)),
);
const sources = new Map(
  ['v1', 'v2'].map((policy) => [
    policy,
    compileContentProject(
      policy === 'v2'
        ? withPressureDifficulty(createTimedBorderCandidates())
        : createTimedBorderCandidates(),
    ),
  ]),
);
const manifestFor = (row, mode = 'solo') =>
  resolveMission(sources.get(row.policy), row.id, { difficulty: row.difficulty, mode });

for (const policy of ['v1', 'v2'])
  test(`taking-route evidence pins the ${policy} matrix and labels additional probes separately`, () => {
    const ordinary = fixture.rows.filter(
      (row) => row.policy === policy && row.purpose === 'ordinary',
    );
    assert.equal(ordinary.length, 54);
    assert.equal(
      new Set(ordinary.map((row) => [row.id, row.difficulty, row.turnPolicy, row.seed].join('/')))
        .size,
      54,
    );
    for (const id of ['behind-the-patrol', 'second-landing', 'long-rail'])
      for (const difficulty of ['gentle', 'standard', 'expert'])
        for (const turnPolicy of ['immediate', 'grid-center'])
          assert.deepEqual(
            ordinary
              .filter(
                (row) =>
                  row.id === id && row.difficulty === difficulty && row.turnPolicy === turnPolicy,
              )
              .map((row) => row.seed)
              .sort((a, b) => a - b),
            {
              'behind-the-patrol': [1, 3, 10],
              'second-landing': [1, 2, 6],
              'long-rail': [1, 2, 3],
            }[id],
          );
  });

for (const policy of ['v1', 'v2'])
  test(`all authored anchors and an expired-then-relocated collection have played ${policy} evidence`, () => {
    for (const id of ['behind-the-patrol', 'second-landing', 'long-rail']) {
      const anchors = new Set(
        fixture.rows
          .filter((row) => row.policy === policy && row.id === id)
          .map((row) => JSON.stringify(row.observations.collectedAnchor)),
      );
      assert.equal(
        anchors.size,
        3,
        `${id}: all authored anchors are represented, not three correlated seeds`,
      );
    }
    const relocation = fixture.rows.find(
      (row) => row.policy === policy && row.purpose === 'miss-then-relocate',
    );
    assert.equal(relocation.observations.appearances, 2);
    assert.equal(
      relocation.observations.events.filter((event) => event.type === 'bonus.expired').length,
      1,
    );
  });

test('unchanged V1 inputs are not mistaken for pressure qualification', () => {
  const outcomes = { cleared: 0, loss: 0, incomplete: 0 };
  for (const row of fixture.rows.filter(
    (row) => row.policy === 'v1' && row.purpose === 'ordinary',
  )) {
    const run = createRun(manifestFor({ ...row, policy: 'v2' }).level, {
      seed: row.seed,
      classId: 'scout',
      turnPolicy: row.turnPolicy,
    });
    route: for (const { direction, ticks } of row.segments)
      for (let n = 0; n < ticks; n++) {
        stepRun(run, { direction }, FIXED_DT);
        if (run.classic.livesLost || run.status !== 'running') break route;
      }
    assert.equal(run.classic.timedBonuses.schedules[0].collections, 1);
    outcomes[run.classic.livesLost ? 'loss' : run.status === 'won' ? 'cleared' : 'incomplete']++;
  }
  assert.deepEqual(outcomes, { cleared: 14, loss: 28, incomplete: 12 });
});

for (const row of fixture.rows) {
  const label = [row.policy, row.id, row.difficulty, row.turnPolicy, row.seed, row.purpose].join(
    '/',
  );
  test(`timed pickup then no-loss clear and replay: ${label}`, () => {
    const manifest = manifestFor(row);
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    const { observations } = playTimedTakingRoute(manifest.level, row);
    assert.deepEqual(observations, row.observations);
  });
  test(`timed pickup remains equal in actual paired-board race: ${label}`, () => {
    const manifest = manifestFor(row, 'versus');
    const match = createDuel(
      manifest.level,
      { seed: row.seed, classId: 'scout', turnPolicy: row.turnPolicy },
      { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 },
    );
    assert.notEqual(match.runs[0].classic.timedBonuses, match.runs[1].classic.timedBonuses);
    resumeDuel(match);
    for (const { direction, ticks } of row.segments)
      for (let n = 0; n < ticks; n++) {
        assert.equal(match.status, 'running');
        stepDuel(match, [{ direction }, { direction }]);
        assert(match.runs.every((run) => run.classic.livesLost === 0));
      }
    assert.equal(match.status, 'finished');
    assert.equal(match.winner, null);
    for (const run of match.runs) {
      assert.equal(run.status, 'won');
      assert.equal(run.classic.timedBonuses.schedules[0].collections, 1);
      assert.equal(authoritativeCheckpoint(run).hash, row.observations.checkpoint);
    }
  });
}

for (const policy of ['v1', 'v2'])
  for (const id of ['behind-the-patrol', 'second-landing', 'long-rail'])
    test(`authored ${policy}/${id} pickup survives suspension and completes the same route`, async () => {
      const row = fixture.rows.find(
        (row) =>
          row.id === id &&
          row.policy === policy &&
          row.difficulty === 'standard' &&
          row.turnPolicy === 'immediate' &&
          row.purpose === 'ordinary',
      );
      const level = manifestFor(row).level;
      const campaign = {
        version: 'xonix-campaign.v1',
        id: 'timed-taking-save',
        revision: '1',
        levels: [level],
        classRecipes: CLASSES,
      };
      const key = campaignKey(campaign);
      let saved;
      playTimedTakingRoute(level, row, {
        replay: false,
        onStep(run, recorder, command) {
          if (run.tick === row.observations.collectionTick)
            saved = suspendSession({
              run,
              recorder,
              campaignKey: key,
              themeId: 'fpv',
              bodyId: 'quad',
              runId: 'timed-taking',
              continuation: command,
            });
        },
      });
      assert(saved);
      const restored = await restoreSession(saved, { campaign, campaignKey: key });
      assert.equal(restored.run.tick, row.observations.collectionTick);
      let tick = 0;
      for (const { direction, ticks } of row.segments)
        for (let n = 0; n < ticks; n++) {
          if (++tick <= row.observations.collectionTick) continue;
          recordInput(restored.recorder, { direction });
          stepRun(restored.run, { direction }, FIXED_DT);
          assert.equal(restored.run.classic.livesLost, 0);
        }
      assert.equal(restored.run.status, 'won');
      assert.equal(authoritativeCheckpoint(restored.run).hash, row.observations.checkpoint);
      assert.equal(verifyReplay(exportReplay(restored.recorder, restored.run)).match, true);
    });
