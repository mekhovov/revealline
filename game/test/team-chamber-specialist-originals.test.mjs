import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import {
  createTeamChamberSpecialistOriginalCandidates,
  TEAM_CHAMBER_PARTNER_MISSIONS,
  TEAM_CHAMBER_PARTNER_PROFILE_KEY,
} from '../content-design/team-chamber-specialist-originals.mjs';
import { createTeamReturnSpecialistOriginalCandidates } from '../content-design/team-return-specialist-originals.mjs';
import { TEAM_FOUNDATION_FIRST_RETURNS } from '../content-design/team-journey-candidates.mjs';
import { createTeamGreyboxEntry } from '../content-design/team-entry.mjs';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { acquireCandidatePicture } from '../content-design/picture.mjs';
import { loadPreviewArtwork } from '../content-design/assets.mjs';
import { createCoop, FIXED_DT, SAFE, startCoop, stepCoop } from '../coop/core.mjs';
import {
  candidateTeamPictureFrame,
  createCandidateTeamPictures,
} from '../couch/candidate-team-pictures.mjs';
import { playTeamFoundationRoute } from './helpers/team-foundation-route.mjs';

const source = createTeamChamberSpecialistOriginalCandidates();
const previous = createTeamReturnSpecialistOriginalCandidates();
const project = compileContentProject(source);
const changed = new Set(TEAM_CHAMBER_PARTNER_MISSIONS);
const candidateHost = createCandidateTeamHost(source, {
  corePackIds: source.packs.map(({ id }) => id),
});
const previousHost = createCandidateTeamHost(previous, {
  corePackIds: previous.packs.map(({ id }) => id),
});
const pressureRoutes = JSON.parse(
  await readFile(new URL('./fixtures/team-pressure-foundation-routes.json', import.meta.url)),
);
const openingRoutes = JSON.parse(
  await readFile(new URL('./fixtures/team-opening-routes.json', import.meta.url)),
);
const command = (direction) => ({ direction, boost: false, support: false });
const firstReturns = Object.freeze({
  'divided-workshop': TEAM_FOUNDATION_FIRST_RETURNS['divided-workshop'],
  'shared-detour': ['left', 'right'],
});
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

test('the chamber specialist pair preserves maps, pictures and every earlier edition', () => {
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
      assert(mission.design.practices.includes('complementary-support-roles'));
    } else assert.deepEqual(mission, old);
  }
  assert.deepEqual(
    [
      'twin-depots',
      'crossed-gardens',
      'shared-lookout',
      'split-orchards',
      'weaver-crossing',
      'stepping-exchange',
      'switchback-partners',
    ].map((id) => {
      const mission = source.missions.find((candidate) => candidate.id === id);
      return [id, mission.revision];
    }),
    [
      ['twin-depots', 'partner-actions-1'],
      ['crossed-gardens', 'partner-actions-1'],
      ['shared-lookout', 'partner-actions-1'],
      ['split-orchards', 'partner-actions-2'],
      ['weaver-crossing', 'partner-actions-2'],
      ['stepping-exchange', 'partner-actions-3'],
      ['switchback-partners', 'partner-actions-3'],
    ],
    'all corrected predecessor ledger identities remain pinned',
  );
  assert.equal(
    source.missions.find(({ id }) => id === 'twin-landings').team.format,
    'TeamMissionV5',
  );
  assert.deepEqual(createTeamReturnSpecialistOriginalCandidates(), previous);
});

test('the chamber specialist candidate remains outside ordinary and public Team entry', async () => {
  const ordinary = await createTeamGreyboxEntry();
  try {
    for (const id of TEAM_CHAMBER_PARTNER_MISSIONS)
      assert.notEqual(missionRow(ordinary.candidateJourney, id).level.revision, source.revision);
    assert.equal(ordinary.candidateProgress.backupFilename, 'revealline-journey-progress.json');
    const publicHost = await readFile(
      new URL('../couch/relay-rescue.mjs', import.meta.url),
      'utf8',
    );
    assert.equal(publicHost.includes(TEAM_CHAMBER_PARTNER_PROFILE_KEY), false);
    assert.equal(publicHost.includes('chamberSpecialist:'), false);
  } finally {
    ordinary.candidateProgress.dispose();
    ordinary.candidatePreferences.dispose();
  }
});

test('both chamber specialist rows acquire exact picture leases and reject stale rows', async () => {
  for (const id of TEAM_CHAMBER_PARTNER_MISSIONS) {
    const row = missionRow(candidateHost, id);
    const stale = missionRow(previousHost, id);
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
      attemptId: `chamber-picture-${id}`,
    };
    try {
      const binding = await owner.select(request);
      assert.deepEqual(
        candidateTeamPictureFrame(binding, row.level, pictureSnapshot),
        row.background,
      );
      assert.equal(binding.choice.levelRevision, source.revision);
      assert.equal(candidateTeamPictureFrame(binding, stale.level, pictureSnapshot), null);
      assert.equal(owner.confirm(request), binding);
      await assert.rejects(
        owner.select({ ...request, pack: structuredClone(stale.pack) }),
        /exact owned pack, level and theme/,
      );
    } finally {
      owner.dispose();
    }
  }
});

test('existing homogeneous campaign boundaries retain exact Journey order and direct Next', () => {
  assert.deepEqual(
    source.campaigns.flatMap(({ missionIds }) => missionIds),
    previous.campaigns.flatMap(({ missionIds }) => missionIds),
  );
  for (const missionId of TEAM_CHAMBER_PARTNER_MISSIONS) {
    const owner = source.campaigns.find(({ missionIds }) => missionIds.includes(missionId));
    assert.deepEqual(owner.missionIds, [missionId]);
    assert.equal(owner.revision, source.revision);
  }

  const host = createCandidateTeamHost(source, {
    corePackIds: source.packs.map(({ id }) => id),
  });
  for (const [from, to] of [
    ['stepping-exchange', 'divided-workshop'],
    ['divided-workshop', 'switchback-partners'],
    ['switchback-partners', 'shared-detour'],
    ['shared-detour', 'crossed-gardens'],
  ]) {
    const mission = host.catalog.missions.find(({ levelId }) => levelId === from);
    const destination = host.destination(host.row(mission));
    assert.equal(destination.next.mission.levelId, to);
    assert.equal(destination.crossesCampaign, true);
  }
});

test('only the selected chamber missions receive v9 specialist simulations', () => {
  const prior = compileContentProject(previous);
  for (const mission of source.missions)
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const actual = resolveMission(project, mission.id, { mode: 'team', difficulty });
      const old = resolveMission(prior, mission.id, { mode: 'team', difficulty });
      if (changed.has(mission.id)) {
        assert.equal(actual.level.version, 'revealline-coop-level.v7');
        assert.deepEqual(actual.level.supportRoles, ['interceptor', 'disruptor']);
        assert.equal(
          createTeamTestPack(source, mission.id, difficulty).ruleset,
          'revealline-coop.v9',
        );
        assert.notEqual(actual.simulationIdentity, old.simulationIdentity);
      } else {
        assert.deepEqual(actual.level, old.level);
        assert.equal(actual.simulationIdentity, old.simulationIdentity);
      }
    }
});

test('recorded chamber routes remain deterministic two-contributor play', () => {
  const rows = [
    ...pressureRoutes.rows.filter(({ missionId }) => missionId === 'divided-workshop'),
    ...openingRoutes.routes.filter(({ missionId }) => missionId === 'shared-detour'),
  ];
  assert.deepEqual(
    rows.map(({ missionId, difficulty }) => `${missionId}/${difficulty}`),
    ['divided-workshop/standard', 'divided-workshop/expert', 'shared-detour/standard'],
  );
  for (const row of rows) {
    const level = resolveMission(project, row.missionId, {
      mode: 'team',
      difficulty: row.difficulty,
    }).level;
    const options = [false, true].flatMap((swapped) =>
      [false, true].map((jointCuts) => ({ swapped, jointCuts })),
    );
    for (const choice of options) {
      const routeOptions = { ...choice, inspectGoal: () => ({ achieved: false }) };
      const first = playTeamFoundationRoute(level, row.log, routeOptions);
      const repeat = playTeamFoundationRoute(level, row.log, routeOptions);
      assert.equal(first.checkpoint, repeat.checkpoint);
      assert.equal(first.evidence.downs, 0);
      assert.deepEqual([...first.evidence.closed].sort(), [0, 1]);
      const closureCounts = [0, 1].map(
        (seat) =>
          first.events.filter(({ type, player }) => type === 'cut.closed' && player === seat)
            .length,
      );
      if (row.missionId === 'divided-workshop') {
        const expected = row.outcomes.find(
          ({ swapped, jointCuts }) => swapped === choice.swapped && jointCuts === choice.jointCuts,
        );
        assert.equal(first.run.status, 'won');
        assert(first.run.coverage >= level.goal.coverage);
        assert.deepEqual(closureCounts, expected.closures);
        assert.equal(first.simultaneousTicks, expected.simultaneousTicks);
      } else {
        assert.equal(first.run.status, 'running');
        assert(first.run.coverage > 0.3 && first.run.coverage < level.goal.coverage);
        assert.deepEqual(closureCounts, choice.swapped ? [2, 3] : [3, 2]);
        assert.equal(first.simultaneousTicks, 108);
        assert.deepEqual(
          first.run.players.map(({ support }) => support.uses),
          [0, 0],
          'this bounded opening is deterministic route evidence, not a Support or balance claim',
        );
      }
    }
  }
});

test('all presets, spawn orders, seeds and joint-cut settings preserve safe simultaneous openings', () => {
  for (const missionId of TEAM_CHAMBER_PARTNER_MISSIONS)
    for (const difficulty of ['gentle', 'standard', 'expert'])
      for (const swapped of [false, true])
        for (const jointCuts of [false, true])
          for (const seed of [1, 7, 19]) {
            const resolved = resolveMission(project, missionId, { mode: 'team', difficulty }).level;
            const level = structuredClone(resolved);
            const directions = [...firstReturns[missionId]];
            if (swapped) {
              level.spawns.reverse();
              directions.reverse();
            }

            const idle = startCoop(createCoop(level, { seed, jointCuts }));
            const positions = idle.players.map(({ x, y }) => [x, y]);
            for (let tick = 0; tick < 5 / FIXED_DT; tick++) {
              stepCoop(idle, [command(null), command(null)]);
              assert(!idle.events.some(({ type }) => type === 'player.downed'));
            }
            assert.equal(idle.coverage, 0);
            assert.deepEqual(
              idle.players.map(({ x, y }) => [x, y]),
              positions,
            );

            const run = startCoop(createCoop(level, { seed, jointCuts }));
            const closed = new Set();
            let simultaneousTicks = 0;
            for (let tick = 0; tick < 800 && closed.size < 2 && run.status === 'running'; tick++) {
              stepCoop(
                run,
                directions.map((direction, seat) => command(closed.has(seat) ? null : direction)),
              );
              if (run.players.every(({ cutting }) => cutting)) simultaneousTicks++;
              assert(!run.events.some(({ type }) => type === 'player.downed'));
              for (const event of run.events)
                if (event.type === 'cut.closed') closed.add(event.player);
            }
            assert.deepEqual([...closed].sort(), [0, 1]);
            assert(simultaneousTicks > 0);
            assert(run.coverage > 0 && run.coverage < level.goal.coverage);
            assert(
              run.players.every(
                (player) => !player.cutting && run.cells[player.cellIndex] === SAFE,
              ),
            );
          }
});
