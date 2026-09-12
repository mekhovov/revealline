import test from 'node:test';
import assert from 'node:assert/strict';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { createDifficultyNavigation, difficultyCue } from '../difficulty-navigation.mjs';
import { createRun, stepRun, getSummary, FIXED_DT } from '../core/index.mjs';
import { emptyLibrary, recordLibraryCompletion, progressFor } from '../library.mjs';
import { campaignSelection } from '../continuation.mjs';

const campaign = {
  version: 'xonix-campaign.v1',
  id: 'navigation-chapter',
  revision: '1',
  levels: Array.from({ length: 3 }, (_, index) => ({
    version: 'xonix-level.v1',
    id: `navigation-${index + 1}`,
    revision: '1',
    name: `Navigation ${index + 1}`,
    width: 48,
    height: 36,
    spawn: { x: 24.5, y: 0.5 },
    enemies: [{ id: 'east', type: 'bouncer', x: 40.5, y: 25.5, vx: 0, vy: 0 }],
    goal: { coverage: 0.3 },
  })),
};
const catalog = createExecutionCatalog([{ campaign }]);
const [standard, gentle] = catalog.entries;
function complete(library, entry, index) {
  const run = createRun(entry.campaign.levels[index]);
  for (let tick = 0; tick < 2000 && run.status === 'running'; tick++)
    stepRun(run, { direction: 'down' }, FIXED_DT);
  assert.equal(run.status, 'won');
  return recordLibraryCompletion(library, {
    campaign: entry.campaign,
    result: getSummary(run),
    runId: `${entry.difficulty}-${index}`,
    themeId: 'fpv',
    bodyId: 'fpv-body',
  });
}

test('a real Gentle clear opens Standard navigation without awarding Standard statistics', () => {
  const navigation = createDifficultyNavigation();
  const original = emptyLibrary();
  const empty = navigation.access(standard, original.campaigns);
  assert.equal(navigation.access(gentle, original.campaigns), empty);
  assert.equal(
    navigation.playable(standard, original.campaigns, progressFor(original, standard.campaign), 1),
    false,
  );
  const library = complete(original, gentle, 0);
  const progress = progressFor(library, standard.campaign);
  const after = navigation.access(standard, library.campaigns);
  assert.notEqual(after, empty);
  assert.equal(navigation.access(gentle, library.campaigns), after);
  assert.equal(navigation.selection(standard, library.campaigns, progress).levelIndex, 1);
  assert.equal(navigation.playable(standard, library.campaigns, progress, 1), true);
  assert.equal(navigation.playable(standard, library.campaigns, progress, 2), false);
  assert.deepEqual(progress.clears, {});
  assert.equal(library.scores.length, 1);
  assert.equal(library.scores[0].campaignKey, gentle.executionKey);
  assert.ok(navigation.bodies(standard, library.campaigns, progress).has('fpv-racer'));
  const achievements = navigation.achievements(standard, library.campaigns, progress);
  assert.equal(achievements.find((item) => item.id === 'first-light').earned, true);
  assert.equal(achievements.find((item) => item.id === 'first-light').scope, 'shared');
  assert.equal(achievements.find((item) => item.id === 'clear-skies').earned, false);
  assert.equal(achievements.find((item) => item.id === 'golden-line').earned, false);
  assert.equal(achievements.find((item) => item.id === 'golden-line').scope, 'standard');
  const gentleAchievements = navigation.achievements(
    gentle,
    library.campaigns,
    progressFor(library, gentle.campaign),
  );
  assert.equal(gentleAchievements.find((item) => item.id === 'golden-line').earned, true);
  assert.equal(gentleAchievements.find((item) => item.id === 'golden-line').scope, 'gentle');
  assert.deepEqual(original, emptyLibrary());
});

test('mixed-mode completion reaches overview while explicit replay and imported replacement remain exact', () => {
  const navigation = createDifficultyNavigation();
  let library = emptyLibrary();
  for (let index = 0; index < 3; index++)
    library = complete(library, index % 2 ? standard : gentle, index);
  for (const entry of [standard, gentle]) {
    const progress = progressFor(library, entry.campaign);
    const selection = navigation.selection(entry, library.campaigns, progress);
    assert.equal(selection.overview, true);
    assert.equal(selection.completed, 3);
    assert.equal(selection.levelIndex, 2);
    const replay = navigation.selection(entry, library.campaigns, progress, {
      levelId: 'navigation-1',
    });
    assert.equal(replay.overview, false);
    assert.equal(replay.levelIndex, 0);
    assert.ok(
      navigation.milestones(entry, library.campaigns, progress).every((tier) => tier.earned),
    );
  }
  const removed = emptyLibrary();
  assert.equal(
    navigation.selection(standard, removed.campaigns, progressFor(removed, standard.campaign))
      .levelIndex,
    0,
  );
  assert.equal(navigation.access(standard, removed.campaigns).count, 0);
});

test('a reconstructed content catalog invalidates cached access and ordinary challenge navigation stays unchanged', () => {
  const navigation = createDifficultyNavigation();
  const library = complete(emptyLibrary(), gentle, 0);
  const first = navigation.access(standard, library.campaigns);
  const reinstalled = createExecutionCatalog([{ campaign }]).entries[0];
  const second = navigation.access(reinstalled, library.campaigns);
  assert.notEqual(first, second);
  assert.deepEqual(first, second);
  const challenge = { campaign };
  const progress = progressFor(library, campaign);
  assert.equal(navigation.access(challenge, library.campaigns), null);
  assert.deepEqual(
    navigation.selection(challenge, library.campaigns, progress),
    campaignSelection(progress, campaign),
  );
});

test('current flight and next-attempt difficulty have distinct, truthful cues', () => {
  for (const entry of [standard, gentle]) {
    const opposite = entry.difficulty === 'standard' ? 'gentle' : 'standard';
    for (const state of [{ started: true }, { started: false, recovering: true }]) {
      const cue = difficultyCue({ entry, nextMode: opposite, ...state });
      assert.ok(cue.copy.includes(`This flight stays ${cue.current}.`));
      assert.match(cue.copy, /Resume and Load keep/);
      assert.match(cue.retry, /from the beginning/);
      assert.ok(!cue.retry.includes(`beginning on ${cue.current}.`));
    }
    const ready = difficultyCue({ entry, nextMode: entry.difficulty, started: false });
    assert.equal(ready.retry, '');
    assert.match(ready.copy, /scores and medals stay separate/);
    const replayReady = difficultyCue({ entry, nextMode: opposite, started: false });
    assert.equal(replayReady.retry, '');
    assert.ok(replayReady.copy.includes(`This prepared flight starts on ${ready.current}.`));
    assert.match(replayReady.copy, /saved choice for later fresh attempts/);
    assert.equal(
      difficultyCue({ entry, nextMode: opposite, started: true, practice: true }).available,
      false,
    );
  }
  assert.equal(
    difficultyCue({ entry: { campaign }, nextMode: 'gentle', started: false }).available,
    false,
  );
  assert.throws(
    () => difficultyCue({ entry: standard, nextMode: 'custom', started: true }),
    /difficulty/,
  );
});
