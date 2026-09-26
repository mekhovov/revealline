import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import {
  createTeamPartnerSpecialistOriginalCandidates,
  TEAM_MATERIAL_SPECIALIST_CAMPAIGN_ID,
  TEAM_PARTNER_SPECIALIST_MISSIONS,
  TEAM_PARTNER_SPECIALIST_PROFILE_KEY,
  TEAM_PARTNER_SPECIALIST_SUCCESSOR_ROWS,
} from '../content-design/team-partner-specialist-originals.mjs';
import { createTeamSpecialistOriginalCandidates } from '../content-design/team-specialist-originals.mjs';
import { createTeamGreyboxEntry } from '../content-design/team-entry.mjs';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { acquireCandidatePicture } from '../content-design/picture.mjs';
import { loadPreviewArtwork } from '../content-design/assets.mjs';
import { createCoop, FIXED_DT, startCoop, stepCoop } from '../coop/core.mjs';
import { useSupport } from '../coop/threats.mjs';
import {
  candidateTeamPictureFrame,
  createCandidateTeamPictures,
} from '../couch/candidate-team-pictures.mjs';
import { measureTeamPartnerReturns } from './helpers/team-partner-return.mjs';

const source = createTeamPartnerSpecialistOriginalCandidates();
const previous = createTeamSpecialistOriginalCandidates();
const project = compileContentProject(source);
const changed = new Set(TEAM_PARTNER_SPECIALIST_MISSIONS);
const successorRows = new Set(TEAM_PARTNER_SPECIALIST_SUCCESSOR_ROWS);
const candidateHost = createCandidateTeamHost(source, {
  corePackIds: source.packs.map(({ id }) => id),
});
const previousHost = createCandidateTeamHost(previous, {
  corePackIds: previous.packs.map(({ id }) => id),
});
const partnerReturns = JSON.parse(
  await readFile(new URL('./fixtures/team-partner-return-routes.json', import.meta.url)),
);
const neutral = { direction: null, boost: false, support: false };
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

const missionRow = (host, id) =>
  host.row(
    host.catalog.missions.find(({ levelId }) => levelId === id),
    'standard',
  );

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

test('three truthful successor rows preserve maps, pictures and every historical project', () => {
  assert.deepEqual(source.maps, previous.maps);
  assert.deepEqual(source.assets, previous.assets);
  assert.deepEqual(
    source.missions.map(({ id }) => id),
    previous.missions.map(({ id }) => id),
  );
  for (const mission of source.missions) {
    const old = previous.missions.find(({ id }) => id === mission.id);
    assert.deepEqual(mission.presentation, old.presentation);
    if (changed.has(mission.id)) {
      assert.equal(mission.revision, source.revision);
      assert.equal(mission.team.format, 'TeamMissionV6');
      assert.deepEqual(mission.team.supportRoles, ['interceptor', 'disruptor']);
      assert(mission.design.combines.includes('complementary-support-roles'));
    } else if (mission.id === 'twin-depots') {
      assert.equal(mission.revision, source.revision);
      assert.deepEqual(
        { ...mission, revision: old.revision, design: old.design },
        old,
        'the learning-ledger successor advances its revision without changing runtime authoring',
      );
      assert(!mission.design.introduces.includes('complementary-support-roles'));
      assert(mission.design.practices.includes('complementary-support-roles'));
    } else assert.deepEqual(mission, old);
  }
  assert.deepEqual(
    source.missions
      .filter(({ id }) => successorRows.has(id))
      .map(({ id, revision }) => [id, revision]),
    TEAM_PARTNER_SPECIALIST_SUCCESSOR_ROWS.map((id) => [id, source.revision]),
  );
  assert.deepEqual(createTeamSpecialistOriginalCandidates(), previous);
});

test('homogeneous campaign boundaries retain journey order and cross them directly with Next', () => {
  assert.deepEqual(
    source.campaigns.flatMap(({ missionIds }) => missionIds),
    previous.campaigns.flatMap(({ missionIds }) => missionIds),
  );
  const material = source.campaigns.find(({ id }) => id === TEAM_MATERIAL_SPECIALIST_CAMPAIGN_ID);
  assert.deepEqual(material.missionIds, ['crossed-gardens']);
  assert.deepEqual(source.campaigns.find(({ id }) => id === 'shared-material-routes').missionIds, [
    'split-orchards',
    'weaver-crossing',
  ]);
  assert.deepEqual(source.campaigns.find(({ id }) => id === 'changing-common-ground').missionIds, [
    'shared-lookout',
  ]);
  assert.equal(
    source.campaigns.find(({ id }) => id === 'complementary-specialists').revision,
    source.revision,
    'The campaign identity advances with the Twin depots learning-ledger successor.',
  );
  assert.equal(
    source.packs.find(({ id }) => id === 'journey-team-changing-ground').revision,
    source.revision,
  );

  const host = createCandidateTeamHost(source, {
    corePackIds: source.packs.map(({ id }) => id),
  });
  for (const [from, to] of [
    ['shared-detour', 'crossed-gardens'],
    ['crossed-gardens', 'split-orchards'],
    ['shared-lookout', 'twin-depots'],
  ]) {
    const mission = host.catalog.missions.find(({ levelId }) => levelId === from);
    const destination = host.destination(host.row(mission));
    assert.equal(destination.next.mission.levelId, to);
    assert.equal(destination.crossesCampaign, true);
  }
});

test('the direct content-design entry uses its isolated profile and is not publicly enrolled', async () => {
  const entry = await createTeamGreyboxEntry({ partnerSpecialist: true });
  const ordinary = await createTeamGreyboxEntry();
  try {
    assert.equal(
      entry.candidateProgress.backupFilename,
      `revealline-${TEAM_PARTNER_SPECIALIST_PROFILE_KEY}-progress.json`,
    );
    assert.match(String(entry.candidateEditionLabel), /^partner-action specialist edition/);
    assert.equal(entry.candidateJourney.officialProgressEligible, false);
    for (const id of TEAM_PARTNER_SPECIALIST_SUCCESSOR_ROWS)
      assert.equal(missionRow(entry.candidateJourney, id).level.revision, source.revision);

    assert.equal(ordinary.candidateProgress.backupFilename, 'revealline-journey-progress.json');
    assert.equal(ordinary.candidateEditionLabel, '');
    assert.notEqual(
      missionRow(ordinary.candidateJourney, 'twin-depots').level.revision,
      source.revision,
    );

    const publicHost = await readFile(
      new URL('../couch/relay-rescue.mjs', import.meta.url),
      'utf8',
    );
    assert.equal(publicHost.includes(TEAM_PARTNER_SPECIALIST_PROFILE_KEY), false);
    assert.equal(publicHost.includes('partnerSpecialist:'), false);
  } finally {
    entry.candidateProgress.dispose();
    entry.candidatePreferences.dispose();
    ordinary.candidateProgress.dispose();
    ordinary.candidatePreferences.dispose();
  }
});

test('all three current successor rows own exact picture leases and reject stale or foreign rows', async () => {
  for (const id of TEAM_PARTNER_SPECIALIST_SUCCESSOR_ROWS) {
    const row = missionRow(candidateHost, id);
    const stale = missionRow(previousHost, id);
    const foreign = missionRow(
      candidateHost,
      TEAM_PARTNER_SPECIALIST_SUCCESSOR_ROWS.find((candidate) => candidate !== id),
    );
    assert.equal(row.level.revision, source.revision);
    assert.notEqual(stale.level.revision, row.level.revision);
    assert.throws(
      () =>
        createCandidateTeamPictures({
          row: stale,
          owns: candidateHost.owns,
          getSnapshot: () => pictureSnapshot,
          acquire: () => candidatePicture(stale.background),
        }),
      /owned Team candidate/,
    );

    const owner = createCandidateTeamPictures({
      row,
      owns: candidateHost.owns,
      getSnapshot: () => pictureSnapshot,
      acquire: () => candidatePicture(row.background),
    });
    const request = {
      pack: structuredClone(row.pack),
      levelId: row.level.id,
      themeId: 'fpv',
      attemptId: `partner-picture-${id}`,
    };
    try {
      const binding = await owner.select(request);
      assert.deepEqual(
        candidateTeamPictureFrame(binding, row.level, pictureSnapshot),
        row.background,
      );
      assert.equal(binding.choice.levelRevision, source.revision);
      assert.equal(candidateTeamPictureFrame(binding, stale.level, pictureSnapshot), null);
      assert.equal(candidateTeamPictureFrame(binding, foreign.level, pictureSnapshot), null);
      assert.equal(owner.confirm(request), binding);
      await assert.rejects(
        owner.select({ ...request, pack: structuredClone(stale.pack) }),
        /exact owned pack, level and theme/,
      );
      await assert.rejects(
        owner.select({ ...request, levelId: foreign.level.id }),
        /exact owned pack, level and theme/,
      );
    } finally {
      owner.dispose();
    }
  }
});

test('only the two selected simulations adopt the v9 complementary-role runtime', () => {
  for (const mission of source.missions) {
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const actual = resolveMission(project, mission.id, { mode: 'team', difficulty });
      const old = resolveMission(compileContentProject(previous), mission.id, {
        mode: 'team',
        difficulty,
      });
      if (changed.has(mission.id)) {
        assert.equal(actual.level.version, 'revealline-coop-level.v7');
        assert.deepEqual(actual.level.supportRoles, ['interceptor', 'disruptor']);
        assert.equal(
          createTeamTestPack(source, mission.id, difficulty).ruleset,
          'revealline-coop.v9',
        );
        assert.notEqual(actual.simulationIdentity, old.simulationIdentity);
      } else if (mission.id === 'twin-depots') {
        assert.deepEqual(
          { ...actual.level, revision: old.level.revision },
          old.level,
          'Only the authored learning-ledger revision advances.',
        );
        assert.equal(actual.simulationIdentity, old.simulationIdentity);
      } else {
        assert.deepEqual(actual.level, old.level);
        assert.equal(actual.simulationIdentity, old.simulationIdentity);
      }
    }
  }
});

test('Shared lookout deterministically lets both pilots bank on ground earned by the partner', () => {
  for (const row of partnerReturns.rows) {
    const level = resolveMission(project, 'shared-lookout', {
      mode: 'team',
      difficulty: row.difficulty,
    }).level;
    for (const { options } of row.outcomes) {
      const first = measureTeamPartnerReturns(level, row.log, options);
      const repeat = measureTeamPartnerReturns(level, row.log, options);
      assert.equal(first.firstDown, null);
      assert.equal(first.status, 'running');
      assert.equal(first.checkpoint, repeat.checkpoint);
      assert.deepEqual(
        first.returns
          .filter(({ partnerReturn }) => partnerReturn)
          .map(({ player }) => player)
          .sort(),
        [0, 1],
      );
      for (const event of first.returns.filter(({ partnerReturn }) => partnerReturn)) {
        assert.equal(event.previousOwner, 1 - event.player);
        assert(event.acquiredTick < event.tick);
      }
    }
  }
});

test('Crossed gardens gives pressure protection and enemy control to different seats', () => {
  const level = resolveMission(project, 'crossed-gardens', {
    mode: 'team',
    difficulty: 'standard',
  }).level;
  const run = createCoop(level);
  const [interceptor, disruptor] = run.players;
  const enemy = run.enemies[0];
  const events = [];
  const emit = (_run, type, detail) => events.push({ type, ...detail });

  Object.assign(enemy, { x: interceptor.x + 1, y: interceptor.y, slowUntil: 0, speedScale: 1 });
  run.impacts = [{ id: 41, player: 0, owner: enemy.id, x: interceptor.x + 1, y: interceptor.y }];
  useSupport(run, interceptor, emit);
  assert.equal(run.impacts.length, 0);
  assert.equal(enemy.speedScale, 1);

  Object.assign(enemy, { x: disruptor.x + 1, y: disruptor.y, slowUntil: 0, speedScale: 1 });
  run.impacts = [{ id: 42, player: 1, owner: enemy.id, x: disruptor.x + 1, y: disruptor.y }];
  useSupport(run, disruptor, emit);
  assert.deepEqual(
    run.impacts.map(({ id }) => id),
    [42],
  );
  assert.equal(enemy.speedScale, 0.5);
  assert.deepEqual(
    events
      .filter(({ type }) => type === 'support.pulse')
      .map(({ role, slowedEnemies, interceptedImpacts }) => ({
        role,
        slowedEnemies,
        interceptedImpacts,
      })),
    [
      { role: 'interceptor', slowedEnemies: [], interceptedImpacts: [41] },
      { role: 'disruptor', slowedEnemies: [enemy.id], interceptedImpacts: [] },
    ],
  );
});

test('both successor openings remain free of unavoidable pressure at every preset and seed', () => {
  for (const missionId of TEAM_PARTNER_SPECIALIST_MISSIONS)
    for (const difficulty of ['gentle', 'standard', 'expert'])
      for (const seed of [1, 7, 19]) {
        const level = resolveMission(project, missionId, { mode: 'team', difficulty }).level;
        const run = startCoop(createCoop(level, { seed }));
        const positions = run.players.map(({ x, y }) => [x, y]);
        for (let tick = 0; tick < 5 / FIXED_DT; tick++) {
          stepCoop(run, [neutral, neutral]);
          assert(
            !run.events.some(({ type }) => type === 'player.downed' || type === 'rover.warning'),
          );
        }
        assert.equal(run.status, 'running');
        assert.equal(run.coverage, 0);
        assert.deepEqual(
          run.players.map(({ x, y }) => [x, y]),
          positions,
        );
      }
});
