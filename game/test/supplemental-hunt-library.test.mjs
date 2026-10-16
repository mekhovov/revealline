import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  supplementalTeamSources,
  supplementalDuelSources,
  SUPPLEMENTAL_HUNT_ROUTE,
} from '../mission-library/supplemental-hunt.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { createTeamHuntTrainingCandidates } from '../content-design/team-hunt-training-candidates.mjs';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { createCandidateVersusHost } from '../content-design/versus-host.mjs';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import { buildOfflineDestinations } from '../../scripts/offline-destinations.mjs';
import { TEAM_OFFLINE_PROJECT_FACTORIES } from '../../scripts/offline-content.mjs';
import { classifyContent } from '../content-design/content-lifecycle.mjs';
import { createCoop } from '../coop/core.mjs';
import { createDuel } from '../multiplayer.mjs';
import { missionLibraryHref, readMissionLibraryReturn } from '../mission-library/handoff.mjs';

const { themes } = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url)),
);
const route = await loadAuthoredJourneyRoute(SUPPLEMENTAL_HUNT_ROUTE);
const teamSource = createTeamHuntTrainingCandidates();
const team = createCandidateTeamHost(teamSource, {
  corePackIds: teamSource.packs.map((p) => p.id),
});
const duel = createCandidateVersusHost(route.source, { themes, corePackIds: route.corePackIds });

test('Team and Duel Hunt owners coexist in the same cross-mode catalogue', () => {
  const library = createMissionLibrary([
    ...supplementalDuelSources({ themes, launch: () => true }),
    ...supplementalTeamSources({ launch: () => true }),
  ]);
  assert.equal(library.missions.length, 12);
  assert.equal(library.forMode('team').length, 6);
  assert.equal(library.forMode('versus').length, 6);
});

test('six Hunt lessons retain exact native Team/Duel handoffs, presets and independent continuation', async () => {
  for (const mode of ['team', 'versus']) {
    const make = mode === 'team' ? supplementalTeamSources : supplementalDuelSources;
    let request;
    const options = {
      themes,
      launch: (context) => {
        request = context;
        return true;
      },
    };
    assert.deepEqual(make({ ...options, activeRouteId: SUPPLEMENTAL_HUNT_ROUTE }), []);
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const [source] = make({ ...options, difficulty: () => difficulty });
      assert.equal(source.automaticContinuation, false);
      assert.equal(source.lifecycle, 'current');
      const library = createMissionLibrary([source]);
      assert.equal(library.missions.length, 6);
      assert.equal(library.forMode(mode).length, 6);
      for (const row of library.missions) {
        assert.equal(await library.launch(row, { mode }), true);
        assert.equal(request.libraryMissionId, row.id);
        assert.equal(request.mode, mode);
        const href = new URL(
          missionLibraryHref({
            baseURL: 'https://game.test/game/couch/',
            currentMode: mode === 'team' ? 'versus' : 'team',
            mode,
            journey: SUPPLEMENTAL_HUNT_ROUTE,
            missionId: row.id,
            sourceJourney: SUPPLEMENTAL_HUNT_ROUTE,
          }),
        );
        assert.equal(href.searchParams.get('library-mission'), row.id);
        assert.equal(
          readMissionLibraryReturn(href.searchParams, { mode }).journey,
          SUPPLEMENTAL_HUNT_ROUTE,
        );
        const host = mode === 'team' ? team : duel;
        const mission = host.catalog.find(JSON.parse(row.id)[3]);
        assert(mission, 'Receiving native host owns the exact selected mission');
        const native = host.row(mission, difficulty);
        assert(host.owns(native));
        assert.equal(native.difficulty, difficulty);
        assert.equal(
          mode === 'team' ? createCoop(native.level).status : createDuel(native.level).status,
          'ready',
        );
      }
    }
  }
});

test('Hunt admission has complete original artwork and exact offline destination ownership', async () => {
  assert(TEAM_OFFLINE_PROJECT_FACTORIES.some((row) => row[2] === SUPPLEMENTAL_HUNT_ROUTE));
  const destinations = buildOfflineDestinations({
    journeys: [{ route }],
    teamProjects: [{ routeId: SUPPLEMENTAL_HUNT_ROUTE, source: teamSource }],
    classicIndex: JSON.parse(
      await readFile(new URL('../content/mission-library-index.json', import.meta.url)),
    ),
    arenas: { rows: [], sourceId: 'test', editionId: 'test', packId: 'test', revision: 1 },
  });
  for (const [mode, source, make] of [
    ['team', teamSource, supplementalTeamSources],
    ['versus', route.source, supplementalDuelSources],
  ]) {
    assert.equal(
      classifyContent({
        family: mode === 'team' ? 'team' : 'journey',
        id: SUPPLEMENTAL_HUNT_ROUTE,
      }),
      'current',
    );
    const library = createMissionLibrary(make({ themes, launch: () => true }));
    for (const row of library.missions) {
      const destination = destinations.find((d) => d.mode === mode && d.libraryId === row.id);
      assert(destination, row.id);
      assert.deepEqual(destination.groups, [`${mode}:${source.packs[0].id}`]);
      assert.deepEqual(destination.runtimeGroups, [`runtime:${mode}`]);
    }
    for (const asset of source.assets) {
      const bytes = await readFile(new URL('../' + asset.path, import.meta.url));
      assert.equal(bytes.length, asset.bytes);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    }
  }
  assert.equal(classifyContent({ family: 'journey', id: 'military-pursuit-v1' }), null);
});
