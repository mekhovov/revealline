import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveContentJourney } from '../content-design/journey.mjs';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createJourneyCatalog } from '../journey/catalog.mjs';
import { createRun } from '../core/index.mjs';
import { createDuel } from '../multiplayer.mjs';
import { campaignKey } from '../library.mjs';
import { spawnSync } from 'node:child_process';

test('authored core order continues through campaigns and keeps the optional Remix separate', () => {
  const source = createOpeningCandidates();
  const before = structuredClone(source);
  const journey = resolveContentJourney(source, { packIds: ['journey-opening'] });
  assert.equal(journey.missions.length, 9);
  assert.equal(journey.campaigns.length, 2);
  assert.equal(journey.missions[2].levelId, 'two-keepers');
  assert.equal(journey.missions[3].levelId, 'nearby-shore');
  assert.equal(journey.missions[3].levelIndex, 0);
  assert(journey.missions.every((mission) => mission.source === 'candidate'));
  assert.equal(journey.officialProgressEligible, false);
  assert(Object.isFrozen(journey.campaigns[0].runtime.levels[0]));
  assert.deepEqual(source, before);
  const remix = resolveContentJourney(source, { packIds: ['opening-remixes'] });
  assert.equal(remix.missions.length, 1);
  assert.equal(remix.missions[0].levelId, 'horizon-remix');
  // Selection order is a filter, not a second authoring order.
  const all = resolveContentJourney(source, { packIds: ['opening-remixes', 'journey-opening'] });
  assert.equal(all.missions[9].levelId, 'horizon-remix');
  const catalog = createJourneyCatalog(
    journey.campaigns.map(({ packId, runtime }) => ({
      ...runtime,
      packId,
      source: 'candidate',
      modes: ['solo'],
    })),
  );
  assert.equal(catalog.next(journey.missions[2].id).id, journey.missions[3].id);
  assert.equal(catalog.next(journey.missions.at(-1).id), null);
});

test('all presets and supported modes resolve exact engine levels without legacy difficulty projection', () => {
  const source = createOpeningCandidates();
  const project = compileContentProject(source);
  const keys = new Set();
  let navigation;
  for (const mode of ['solo', 'versus']) {
    for (const [difficulty, lives] of [
      ['gentle', 5],
      ['standard', 3],
      ['expert', 2],
    ]) {
      const journey = resolveContentJourney(source, { mode, difficulty });
      const ids = journey.missions.map((mission) => mission.id);
      if (navigation) assert.deepEqual(ids, navigation);
      else navigation = ids;
      for (const { runtime, manifests } of journey.campaigns) {
        keys.add(campaignKey(runtime));
        for (const [index, level] of runtime.levels.entries()) {
          assert.deepEqual(
            manifests[index],
            resolveMission(project, level.id, { mode, difficulty }),
          );
          const run = mode === 'solo' ? createRun(level) : createDuel(level).runs[0];
          assert.equal(run.ruleset, 'xonix-core.v6');
          assert.equal(run.lives, lives);
          assert.equal(run.rules.moveSpeed, 10);
          assert.equal(run.coverage, 0);
          assert.equal(manifests[index].officialProgressEligible, false);
        }
      }
    }
  }
  assert.equal(keys.size, 9, 'Three presets per campaign, no mode-based physics drift.');
});

test('candidate navigation filters unsupported missions but refuses invalid or empty selections', () => {
  const source = createOpeningCandidates();
  source.missions[0].modes = ['versus'];
  const solo = resolveContentJourney(source);
  assert.equal(solo.missions[0].levelId, 'choose-your-share');
  assert.equal(solo.missions[0].levelIndex, 0);
  assert.equal(
    resolveContentJourney(source, { mode: 'versus' }).missions[0].levelId,
    'first-return',
  );
  for (const options of [
    { mode: 'team' },
    { difficulty: 'random' },
    { packIds: [] },
    { packIds: ['missing'] },
    { packIds: ['journey-opening', 'journey-opening'] },
    { officialProgressEligible: true },
  ])
    assert.throws(() => resolveContentJourney(source, options));
  source.packs.push({
    format: 'PackDesignV1',
    id: 'empty',
    revision: '1',
    name: 'Empty',
    campaignIds: [],
  });
  assert.throws(() => resolveContentJourney(source, { packIds: ['empty'] }), /no missions/);
});

test('CLI candidate Journey agrees with the shared registry and refuses contradictory modes', () => {
  const source = createOpeningCandidates();
  const cli = (...args) =>
    spawnSync(
      process.execPath,
      [
        new URL('../../scripts/compile-content-project.mjs', import.meta.url).pathname,
        '-',
        ...args,
      ],
      { input: JSON.stringify(source), encoding: 'utf8', maxBuffer: 1024 * 1024, timeout: 10000 },
    );
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    const result = cli('--journey', '--pack', 'journey-opening', '--difficulty', difficulty);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(
      JSON.parse(result.stdout),
      resolveContentJourney(source, {
        packIds: ['journey-opening'],
        difficulty,
      }),
    );
  }
  for (const args of [
    ['--journey', '--check'],
    ['--journey', '--mission', 'first-return'],
    ['--pack', 'journey-opening'],
    ['--journey', '--journey'],
    ['--journey', '--pack'],
    ['--journey', '--mode', 'team'],
  ])
    assert.equal(cli(...args).status, 1, args.join(' '));
});
