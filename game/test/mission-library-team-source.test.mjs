import test from 'node:test';
import assert from 'node:assert/strict';
import { createTeamSpatialOriginalCandidates } from '../content-design/team-spatial-originals.mjs';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import {
  teamJourneyLibrarySource,
  teamArenaLibrarySource,
} from '../mission-library/team-source.mjs';
import { COOP_STARTER_PACK, coopGoalText } from '../coop/library.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { dataIdentity } from '../data-json.mjs';

const source = createTeamSpatialOriginalCandidates();
const journey = createCandidateTeamHost(source, {
  corePackIds: source.packs.map((pack) => pack.id),
});
const rows = (pack, artworkSource = null) =>
  pack.levels.map((level) => ({
    pack,
    level,
    levelId: level.id,
    packName: pack.name,
    title: level.name,
    goal: coopGoalText(level),
    artworkSource,
  }));

test('Team source has12 exact missions, cheap frozen details, and resolves current preset only on launch', async () => {
  let difficulty = 'expert',
    accepted;
  const owner = {
    ...journey,
    card() {
      throw new Error('Details must not create a diagram');
    },
  };
  const library = createMissionLibrary([
    teamJourneyLibrarySource({
      journey: owner,
      difficulty: () => difficulty,
      launch: (row) => {
        accepted = row;
        return true;
      },
    }),
  ]);
  assert.equal(library.missions.length, 12);
  const selected = library.missions[8],
    mission = journey.catalog.find(selected.runtimeId);
  assert.match(library.details(selected, 'team').challenge, /Band \d+\/12 · Expert/);
  assert.equal(library.details(selected, 'team').route, mission.hook);
  await library.launch(selected, { mode: 'team' });
  assert.equal(accepted, journey.row(mission, 'expert'));
  difficulty = 'gentle';
  await library.launch(selected, { mode: 'team' });
  assert.equal(accepted, journey.row(mission, 'gentle'));
  const manifest = journey.manifest(mission, 'gentle');
  assert(Object.isFrozen(manifest));
  assert.equal(journey.manifest({ ...mission }, 'gentle'), null);
  assert.equal(journey.manifest(mission, 'invalid'), null);
  assert.equal(journey.manifest(mission, 'gentle'), manifest);
});

test('Team imports retain exact pack, level and opaque artwork owner without aliasing identical Classic IDs', async () => {
  const pack = structuredClone(COOP_STARTER_PACK),
    artwork = Object.freeze({ opaque: true });
  const originalRows = rows(COOP_STARTER_PACK),
    localRows = rows(pack, artwork);
  let live = true,
    received;
  const custom = () =>
    teamArenaLibrarySource({
      rows: localRows,
      sourceId: 'team-custom:visit:1',
      editionId: `${pack.id}@${pack.revision}`,
      edition: 'Local edition',
      collection: 'Custom',
      isCurrent: () => live,
      launch: (row) => {
        received = row;
        return true;
      },
    });
  const library = createMissionLibrary([
    teamArenaLibrarySource({ rows: originalRows, launch: () => true }),
    custom(),
  ]);
  assert.equal(library.missions.length, 4);
  const selected = library.missions[3];
  assert.notEqual(selected.id, library.missions[1].id);
  await library.launch(selected, { mode: 'team' });
  assert.equal(received, localRows[1]);
  assert.equal(received.pack, pack);
  assert.equal(received.artworkSource, artwork);
  live = false;
  assert.equal(library.availability(selected, 'team').state, 'unavailable');
  assert.throws(() => library.launch(selected, { mode: 'team' }));
  live = true;
  library.register(custom());
  assert.throws(() => library.launch(selected, { mode: 'team' }), /stale/);
  assert.throws(
    () => teamArenaLibrarySource({ rows: localRows, launch: () => true }),
    /exact built-in/,
  );
});

test('Team card receipts distinguish the selected preset from an earlier or different edition', () => {
  const mission = journey.catalog.missions[0];
  let difficulty = 'expert';
  const receipt = {
    difficulty: 'standard',
    gameplayId: journey.row(mission, 'standard').simulationIdentity,
  };
  const profile = { clears: { team: { [mission.id]: receipt } }, skipped: { team: [] } };
  const library = createMissionLibrary([
    teamJourneyLibrarySource({
      journey,
      progress: { snapshot: () => profile },
      difficulty: () => difficulty,
      launch: () => true,
    }),
  ]);
  const selected = library.missions[0];
  assert.match(
    library.progress(selected, 'team'),
    /Cleared on standard · no clear recorded for this selected edition/,
  );
  difficulty = 'standard';
  assert.equal(library.progress(selected, 'team'), 'Cleared on standard · selected edition');
  receipt.gameplayId = 'older-simulation';
  assert.match(library.progress(selected, 'team'), /^Earlier edition cleared.*no clear recorded/);
});

test('a pressure host explicitly qualifies new Team receipt identity without upgrading historical clears', () => {
  const mission = journey.catalog.missions[0],
    row = journey.row(mission, 'standard');
  const receipt = { difficulty: 'standard', gameplayId: row.simulationIdentity };
  const profile = { clears: { team: { [mission.id]: receipt } }, skipped: { team: [] } };
  const expected = dataIdentity({
    ruleset: row.pack.ruleset,
    level: applyGameplayTuning(row.level, resolveGameplayTuning(row.difficulty)),
  });
  const source = teamJourneyLibrarySource({
    journey,
    progress: { snapshot: () => profile },
    gameplayIdentity: (owned) => {
      assert.strictEqual(owned, row);
      return expected;
    },
    launch: () => true,
  });
  assert.match(source.progress(mission), /^Earlier edition cleared/);
  receipt.gameplayId = expected;
  assert.equal(source.progress(mission), 'Cleared on standard · selected edition');
  receipt.gameplayId = dataIdentity({
    ruleset: row.pack.ruleset,
    level: applyGameplayTuning(
      row.level,
      resolveGameplayTuning(row.difficulty, { enemySpeed: 1.1 }),
    ),
  });
  assert.match(source.progress(mission), /^Earlier edition cleared/);
});
