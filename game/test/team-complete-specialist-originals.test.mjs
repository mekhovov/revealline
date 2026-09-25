import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import {
  createTeamCompleteSpecialistOriginalCandidates,
  TEAM_COMPLETE_SPECIALIST_PROFILE_KEY,
  TEAM_SPECIALIST_DISPOSITIONS,
} from '../content-design/team-complete-specialist-originals.mjs';
import { createTeamChamberSpecialistOriginalCandidates } from '../content-design/team-chamber-specialist-originals.mjs';
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
import { measureTeamPartnerReturns } from './helpers/team-partner-return.mjs';

const source = createTeamCompleteSpecialistOriginalCandidates();
const previous = createTeamChamberSpecialistOriginalCandidates();
const project = compileContentProject(source);
const candidateHost = createCandidateTeamHost(source, {
  corePackIds: source.packs.map(({ id }) => id),
});
const previousHost = createCandidateTeamHost(previous, {
  corePackIds: previous.packs.map(({ id }) => id),
});
const pressureRoutes = JSON.parse(
  await readFile(new URL('./fixtures/team-pressure-opening-routes.json', import.meta.url)),
);
const openingRoutes = JSON.parse(
  await readFile(new URL('./fixtures/team-opening-routes.json', import.meta.url)),
);
const command = (direction) => ({ direction, boost: false, support: false });
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

test('the final successor changes only Twin landings and preserves every historical source', () => {
  assert.deepEqual(source.maps, previous.maps);
  assert.deepEqual(source.assets, previous.assets);
  assert.deepEqual(
    source.missions.map(({ id }) => id),
    previous.missions.map(({ id }) => id),
  );
  for (const mission of source.missions) {
    const old = previous.missions.find(({ id }) => id === mission.id);
    assert.deepEqual(mission.presentation, old.presentation);
    if (mission.id === 'twin-landings') {
      assert.equal(old.team.format, 'TeamMissionV5');
      assert.equal(mission.revision, source.revision);
      assert.equal(mission.team.format, 'TeamMissionV6');
      assert.deepEqual(mission.team.supportRoles, ['interceptor', 'disruptor']);
      assert.deepEqual(mission.design.introduces, ['team-foundations']);
      assert(!mission.design.practices.includes('complementary-support-roles'));
      assert(mission.design.combines.includes('optional-specialist-support'));
    } else assert.deepEqual(mission, old);
  }
  assert.deepEqual(createTeamChamberSpecialistOriginalCandidates(), previous);
});

test('the complete specialist candidate remains outside ordinary and public Team entry', async () => {
  const ordinary = await createTeamGreyboxEntry();
  try {
    assert.notEqual(
      missionRow(ordinary.candidateJourney, 'twin-landings').level.revision,
      source.revision,
    );
    assert.equal(ordinary.candidateProgress.backupFilename, 'revealline-journey-progress.json');
    const publicHost = await readFile(
      new URL('../couch/relay-rescue.mjs', import.meta.url),
      'utf8',
    );
    assert.equal(publicHost.includes(TEAM_COMPLETE_SPECIALIST_PROFILE_KEY), false);
    assert.equal(publicHost.includes('completeSpecialist:'), false);
  } finally {
    ordinary.candidateProgress.dispose();
    ordinary.candidatePreferences.dispose();
  }
});

test('Twin landings acquires its exact successor picture lease and rejects the stale row', async () => {
  const row = missionRow(candidateHost, 'twin-landings');
  const stale = missionRow(previousHost, 'twin-landings');
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
    attemptId: 'complete-picture-twin-landings',
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
});

test('the disposition audit covers every Team mission exactly once at its effective revision', () => {
  assert.equal(TEAM_SPECIALIST_DISPOSITIONS.length, 12);
  assert.deepEqual(
    TEAM_SPECIALIST_DISPOSITIONS.map(({ missionId }) => missionId),
    source.missions.map(({ id }) => id),
  );
  assert.equal(new Set(TEAM_SPECIALIST_DISPOSITIONS.map(({ missionId }) => missionId)).size, 12);
  for (const disposition of TEAM_SPECIALIST_DISPOSITIONS) {
    const mission = source.missions.find(({ id }) => id === disposition.missionId);
    assert.equal(disposition.revision, mission.revision);
    assert.equal(mission.team.format, 'TeamMissionV6');
    assert.deepEqual(mission.team.supportRoles, ['interceptor', 'disruptor']);
    assert(disposition.reason.length > 20);
  }
  for (const campaign of source.campaigns) {
    const formats = new Set(
      campaign.missionIds.map(
        (missionId) => source.missions.find(({ id }) => id === missionId).team.format,
      ),
    );
    assert.equal(formats.size, 1);
  }
});

test('Twin landings keeps its campaign boundary and direct Next into Stepping exchange', () => {
  const owner = source.campaigns.find(({ missionIds }) => missionIds.includes('twin-landings'));
  assert.deepEqual(owner.missionIds, ['twin-landings']);
  assert.equal(owner.revision, source.revision);
  const host = createCandidateTeamHost(source, {
    corePackIds: source.packs.map(({ id }) => id),
  });
  const mission = host.catalog.missions.find(({ levelId }) => levelId === 'twin-landings');
  const destination = host.destination(host.row(mission));
  assert.equal(destination.next.mission.levelId, 'stepping-exchange');
  assert.equal(destination.crossesCampaign, true);
});

test('only Twin landings receives the final v9 simulation identity', () => {
  const prior = compileContentProject(previous);
  for (const mission of source.missions)
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const actual = resolveMission(project, mission.id, { mode: 'team', difficulty });
      const old = resolveMission(prior, mission.id, { mode: 'team', difficulty });
      if (mission.id === 'twin-landings') {
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

test('Twin landings retains deterministic no-Support full clears on recorded presets', () => {
  const rows = pressureRoutes.rows.filter(({ missionId }) => missionId === 'twin-landings');
  assert.deepEqual(
    rows.map(({ difficulty }) => difficulty),
    ['standard', 'expert'],
  );
  for (const row of rows) {
    const level = resolveMission(project, row.missionId, {
      mode: 'team',
      difficulty: row.difficulty,
    }).level;
    for (const expected of row.outcomes.slice(0, 4)) {
      const { jointCuts, swapped } = expected;
      const options = {
        jointCuts,
        swapped,
        inspectGoal: () => ({ achieved: true }),
      };
      const first = playTeamFoundationRoute(level, row.log, options);
      const repeat = playTeamFoundationRoute(level, row.log, options);
      assert.equal(first.checkpoint, repeat.checkpoint);
      assert.equal(first.run.status, 'won');
      assert.equal(first.evidence.downs, 0);
      assert.deepEqual([...first.evidence.closed].sort(), [0, 1]);
      assert(first.run.coverage >= level.goal.coverage);
      assert.equal(
        first.events.some(({ type }) => type === 'support.pulse'),
        false,
      );
      assert(first.run.players.every(({ support }) => support.uses === 0));
      assert.deepEqual(
        [0, 1].map(
          (seat) =>
            first.events.filter(({ type, player }) => type === 'cut.closed' && player === seat)
              .length,
        ),
        expected.closures,
      );
      assert.equal(first.simultaneousTicks, expected.simultaneousTicks);
    }
  }
});

test('the recorded opening still establishes a real partner-owned return', () => {
  const row = openingRoutes.routes.find(({ missionId }) => missionId === 'twin-landings');
  const level = resolveMission(project, row.missionId, {
    mode: 'team',
    difficulty: row.difficulty,
  }).level;
  for (const jointCuts of [false, true])
    for (const swapped of [false, true]) {
      const result = measureTeamPartnerReturns(level, row.log, { jointCuts, swapped });
      assert.equal(result.firstDown, null);
      assert.equal(result.status, 'running');
      const returns = result.returns.filter(({ partnerReturn }) => partnerReturn);
      assert.equal(returns.length, 1);
      assert.equal(returns[0].previousOwner, 1 - returns[0].player);
      assert.deepEqual(
        {
          tick: returns[0].tick,
          cell: returns[0].cell,
          cells: returns[0].cells,
          acquiredTick: returns[0].acquiredTick,
        },
        { tick: 3477, cell: 2120, cells: 22, acquiredTick: 1231 },
        'the bounded opening retains the same acquired return without claiming a clear',
      );
      assert.equal(result.coverage, 0.384549356223176);
    }
});

test('all presets, spawn orders, seeds and joint-cut settings keep the tutorial opening safe', () => {
  for (const difficulty of ['gentle', 'standard', 'expert'])
    for (const swapped of [false, true])
      for (const jointCuts of [false, true])
        for (const seed of [1, 7, 19]) {
          const resolved = resolveMission(project, 'twin-landings', {
            mode: 'team',
            difficulty,
          }).level;
          const level = structuredClone(resolved);
          const directions = ['left', 'right'];
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
            run.players.every((player) => !player.cutting && run.cells[player.cellIndex] === SAFE),
          );
          assert(run.players.every(({ support }) => support.uses === 0));
        }
});
