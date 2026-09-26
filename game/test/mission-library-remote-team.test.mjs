import test from 'node:test';
import assert from 'node:assert/strict';
import { createRemoteTeamLibrarySources } from '../mission-library/remote-team.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import {
  teamJourneyLibrarySource,
  teamArenaLibrarySource,
} from '../mission-library/team-source.mjs';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { createTeamCulturalSpecialistOriginalCandidates } from '../content-design/team-cultural-specialist-originals.mjs';
import { COOP_STARTER_PACK, coopGoalText } from '../coop/library.mjs';

test('remote Team browser preserves all12 Journey and2 Classic receiving identities without artwork', async (t) => {
  t.mock.method(globalThis, 'fetch', () => {
    throw new Error('Browsing must not fetch artwork.');
  });
  const source = createTeamCulturalSpecialistOriginalCandidates();
  const journey = createCandidateTeamHost(source, {
    corePackIds: source.packs.map((pack) => pack.id),
  });
  const receiving = createMissionLibrary([
    teamJourneyLibrarySource({ journey, launch: () => true }),
    teamArenaLibrarySource({
      rows: COOP_STARTER_PACK.levels.map((level) => ({
        title: level.name,
        packName: COOP_STARTER_PACK.name,
        goal: coopGoalText(level),
        levelId: level.id,
        level,
        pack: COOP_STARTER_PACK,
        artworkSource: null,
      })),
      launch: () => true,
    }),
  ]);
  let request = null;
  const browsing = createMissionLibrary(
    createRemoteTeamLibrarySources({
      difficulty: () => 'expert',
      launch: (context) => {
        request = context;
        return true;
      },
    }),
  );
  assert.equal(browsing.missions.length, 14);
  assert.deepEqual(
    browsing.missions.map((row) => row.id),
    receiving.missions.map((row) => row.id),
  );
  assert.equal(browsing.forMode('solo').length, 0);
  assert.equal(browsing.forMode('versus').length, 0);
  for (const row of browsing.missions) {
    assert.equal(browsing.availability(row, 'team').state, 'ready');
    assert.equal(browsing.progress(row, 'team'), '', 'No invented cross-host clears.');
    assert.equal(await browsing.launch(row, { mode: 'team' }), true);
    assert.equal(request.libraryMissionId, row.id);
    assert.equal(request.mode, 'team');
  }
  assert.match(browsing.details(browsing.missions[0], 'team').challenge, /Expert/);
  assert.doesNotMatch(browsing.details(browsing.missions.at(-1), 'team').challenge, /Band/);
});
