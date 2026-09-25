import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import {
  createTeamCompleteSpecialistOriginalCandidates,
  TEAM_COMPLETE_SPECIALIST_PROFILE_KEY,
} from '../content-design/team-complete-specialist-originals.mjs';
import { createTeamImpactOriginalCandidates } from '../content-design/team-impact-originals.mjs';
import { createTeamGreyboxEntry } from '../content-design/team-entry.mjs';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { createTeamJourneyProgress } from '../content-design/team-progress.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { isMissionLibrarySourceJourney } from '../mission-library/handoff.mjs';
import { teamJourneyLibrarySource } from '../mission-library/team-source.mjs';
import { createJourneyBackend } from '../journey/profile.mjs';
import { createCoop, startCoop, stepCoop } from '../coop/core.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { acquireCandidatePicture } from '../content-design/picture.mjs';
import { loadPreviewArtwork } from '../content-design/assets.mjs';
import {
  candidateTeamPictureFrame,
  createCandidateTeamPictures,
} from '../couch/candidate-team-pictures.mjs';

const source = createTeamCompleteSpecialistOriginalCandidates();
const journey = createCandidateTeamHost(source, {
  corePackIds: source.packs.map(({ id }) => id),
});
const originalSource = createTeamImpactOriginalCandidates();
const originalJourney = createCandidateTeamHost(originalSource, {
  corePackIds: originalSource.packs.map(({ id }) => id),
});
const first = journey.row(journey.catalog.missions[0], 'standard');
const next = journey.destination(first).next;
const route = JSON.parse(
  await readFile(new URL('./fixtures/team-pressure-opening-routes.json', import.meta.url)),
).rows.find(
  ({ missionId, difficulty }) => missionId === 'twin-landings' && difficulty === 'standard',
).log;
const pictureSnapshot = Object.freeze({
  resolved: { theme: { id: 'fpv', revision: 73 }, collection: null },
  canvas: {
    palette: {
      ink: '#f6f3e8',
      paper: '#071527',
      muted: '#a8b8cc',
      accent: '#ffd64a',
      safe: '#67aaff',
      danger: '#ff7169',
      field: '#10243e',
      grid: '#182b43',
      sky: '#233950',
      land: '#526e67',
    },
    motionScale: 1,
  },
  fonts: { ui: 'sans-serif', numeric: 'monospace' },
});

function finish(run) {
  startCoop(run);
  for (const segment of route)
    for (let tick = 0; tick < segment.ticks && run.status === 'running'; tick++)
      stepCoop(
        run,
        [segment.a, segment.b].map((direction) => ({
          direction,
          boost: false,
          support: false,
        })),
      );
  assert.equal(run.status, 'won');
}

async function candidatePicture(asset) {
  const bytes = await readFile(new URL('../' + asset.path, import.meta.url));
  const media = await loadPreviewArtwork(asset, {
    fetchAsset: async () => new Response(bytes),
    digest: (body) => webcrypto.subtle.digest('SHA-256', body),
  });
  return acquireCandidatePicture(asset, {
    loadArtwork: async () => media,
    decodeImage: async () => ({
      width: asset.width,
      height: asset.height,
      removeAttribute() {},
    }),
  });
}

test('the explicit reviewed route owns a separate profile and leaves ordinary Team unchanged', async () => {
  const reviewed = await createTeamGreyboxEntry({ reviewedSpecialists: true });
  const ordinary = await createTeamGreyboxEntry({ impact: true });
  try {
    assert.equal(
      reviewed.candidateProgress.backupFilename,
      `revealline-${TEAM_COMPLETE_SPECIALIST_PROFILE_KEY}-progress.json`,
    );
    assert.match(reviewed.candidateEditionLabel, /^reviewed specialist library/);
    assert.equal(reviewed.candidateJourney.catalog.missions.length, 12);
    assert.equal(
      reviewed.candidateJourney.row(reviewed.candidateJourney.catalog.missions[0]).level.revision,
      'partner-actions-5',
    );
    assert.equal(
      ordinary.candidateProgress.backupFilename,
      'revealline-team-trail-impact-originals-1-progress.json',
    );
    assert.equal(
      ordinary.candidateJourney.row(ordinary.candidateJourney.catalog.missions[0]).level.revision,
      'owned-trail-impact-1',
    );
    assert.equal(isMissionLibrarySourceJourney(TEAM_COMPLETE_SPECIALIST_PROFILE_KEY, 'team'), true);
    assert.equal(
      isMissionLibrarySourceJourney(TEAM_COMPLETE_SPECIALIST_PROFILE_KEY, 'solo'),
      false,
    );
  } finally {
    reviewed.candidateProgress.dispose();
    reviewed.candidatePreferences.dispose();
    ordinary.candidateProgress.dispose();
    ordinary.candidatePreferences.dispose();
  }
});

test('the reviewed selector lists twelve exact missions and launches its selected runtime row', async () => {
  let launched = null;
  const library = createMissionLibrary([
    teamJourneyLibrarySource({
      journey,
      editionId: TEAM_COMPLETE_SPECIALIST_PROFILE_KEY,
      edition: 'Team Journey · reviewed specialists',
      difficulty: () => 'expert',
      launch(row, context) {
        launched = { row, context };
        return true;
      },
    }),
  ]);
  assert.equal(library.missions.length, 12);
  assert(
    library.missions.every(({ editionId }) => editionId === TEAM_COMPLETE_SPECIALIST_PROFILE_KEY),
  );
  const mission = journey.catalog.missions.find(({ levelId }) => levelId === 'twin-depots');
  const selected = library.missions.find(({ runtimeId }) => runtimeId === mission.id);
  assert(selected);
  assert.equal(await library.launch(selected, { mode: 'team' }), true);
  assert.equal(launched.row, journey.row(mission, 'expert'));
  assert.equal(launched.context.libraryMissionId, selected.id);

  const originalLibrary = createMissionLibrary([
    teamJourneyLibrarySource({
      journey: originalJourney,
      editionId: 'team-trail-impact-originals-1',
      launch: () => true,
    }),
  ]);
  const originalMission = originalJourney.catalog.missions.find(
    ({ levelId }) => levelId === 'twin-depots',
  );
  const original = originalLibrary.missions.find(
    ({ runtimeId }) => runtimeId === originalMission.id,
  );
  assert.notEqual(original.id, selected.id);
  assert.equal(originalJourney.row(originalMission).level.revision, 'owned-trail-impact-1');
});

test('the reviewed first mission owns its exact picture lease', async () => {
  const owner = createCandidateTeamPictures({
    row: first,
    owns: journey.owns,
    getSnapshot: () => pictureSnapshot,
    acquire: () => candidatePicture(first.background),
  });
  const request = {
    pack: structuredClone(first.pack),
    levelId: first.level.id,
    themeId: 'fpv',
    attemptId: 'reviewed-team-first',
  };
  try {
    const binding = await owner.select(request);
    assert.equal(binding.choice.levelRevision, 'partner-actions-5');
    assert.deepEqual(
      candidateTeamPictureFrame(binding, first.level, pictureSnapshot),
      first.background,
    );
    assert.equal(owner.confirm(request), binding);
    assert.equal(
      candidateTeamPictureFrame(
        binding,
        originalJourney.row(originalJourney.catalog.missions[0]).level,
        pictureSnapshot,
      ),
      null,
    );
  } finally {
    owner.dispose();
  }
});

test('reviewed Next crosses the tutorial campaign and Continue stays in its isolated profile', async () => {
  assert.equal(next.mission.levelId, 'stepping-exchange');
  assert.equal(journey.destination(first).crossesCampaign, true);
  const database = managedIndexedDB();
  const backend = createJourneyBackend({
    ...database,
    profileKey: TEAM_COMPLETE_SPECIALIST_PROFILE_KEY,
  });
  const progress = createTeamJourneyProgress(journey, {
    backend,
    sessionId: 'reviewed-team',
  });
  await progress.load();
  assert.equal(progress.initial('standard'), first);
  const run = createCoop(first.level);
  assert.equal(progress.started(first, run), true);
  finish(run);
  assert.equal(progress.complete(run), true);
  await progress.retry();
  assert.equal(progress.initial('standard'), next);

  const reopened = createTeamJourneyProgress(journey, { backend });
  await reopened.load();
  assert.equal(reopened.initial('expert').mission.id, next.mission.id);
  assert.equal(reopened.initial('expert').difficulty, 'expert');
  assert.equal((await createJourneyBackend(database).read()).cursors.team, null);
  progress.dispose();
  reopened.dispose();
});
