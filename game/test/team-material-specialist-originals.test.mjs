import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import {
  createTeamMaterialSpecialistOriginalCandidates,
  TEAM_MATERIAL_PARTNER_MISSIONS,
  TEAM_MATERIAL_PARTNER_PROFILE_KEY,
} from '../content-design/team-material-specialist-originals.mjs';
import { createTeamPartnerSpecialistOriginalCandidates } from '../content-design/team-partner-specialist-originals.mjs';
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
import { playTeamFoundationRoute } from './helpers/team-foundation-route.mjs';
import { inspectTeamMaterialGoal } from './helpers/team-material-goal.mjs';

const source = createTeamMaterialSpecialistOriginalCandidates();
const previous = createTeamPartnerSpecialistOriginalCandidates();
const project = compileContentProject(source);
const changed = new Set(TEAM_MATERIAL_PARTNER_MISSIONS);
const candidateHost = createCandidateTeamHost(source, {
  corePackIds: source.packs.map(({ id }) => id),
});
const previousHost = createCandidateTeamHost(previous, {
  corePackIds: previous.packs.map(({ id }) => id),
});
const materialRoutes = JSON.parse(
  await readFile(new URL('./fixtures/team-material-routes.json', import.meta.url)),
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

test('the second specialist pair preserves every accepted map, picture and historical edition', () => {
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
      assert(mission.design.combines.includes('complementary-support-roles'));
    } else if (mission.id === 'twin-depots') {
      assert.equal(mission.revision, 'partner-actions-1');
      assert.equal(mission.revision, previous.revision);
      assert(!mission.design.introduces.includes('complementary-support-roles'));
      assert(mission.design.practices.includes('complementary-support-roles'));
      assert.deepEqual(mission, old, 'the truthful Twin depots ledger remains unchanged');
    } else assert.deepEqual(mission, old);
  }
  assert.deepEqual(createTeamPartnerSpecialistOriginalCandidates(), previous);
});

test('the material candidate remains outside the ordinary and public Team entry', async () => {
  const ordinary = await createTeamGreyboxEntry();
  try {
    for (const id of TEAM_MATERIAL_PARTNER_MISSIONS)
      assert.notEqual(missionRow(ordinary.candidateJourney, id).level.revision, source.revision);
    assert.equal(ordinary.candidateProgress.backupFilename, 'revealline-journey-progress.json');
    const publicHost = await readFile(
      new URL('../couch/relay-rescue.mjs', import.meta.url),
      'utf8',
    );
    assert.equal(publicHost.includes(TEAM_MATERIAL_PARTNER_PROFILE_KEY), false);
    assert.equal(publicHost.includes('materialSpecialist:'), false);
  } finally {
    ordinary.candidateProgress.dispose();
    ordinary.candidatePreferences.dispose();
  }
});

test('both new material rows acquire their exact picture lease and reject stale rows', async () => {
  for (const id of TEAM_MATERIAL_PARTNER_MISSIONS) {
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
      attemptId: `material-picture-${id}`,
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

test('the material pair occupies one homogeneous V6 campaign without changing Journey order', () => {
  assert.deepEqual(
    source.campaigns.flatMap(({ missionIds }) => missionIds),
    previous.campaigns.flatMap(({ missionIds }) => missionIds),
  );
  const owner = source.campaigns.find(({ id }) => id === 'shared-material-routes');
  assert.deepEqual(owner.missionIds, TEAM_MATERIAL_PARTNER_MISSIONS);
  assert.equal(owner.revision, source.revision);

  const host = createCandidateTeamHost(source, {
    corePackIds: source.packs.map(({ id }) => id),
  });
  for (const [from, to, crossesCampaign] of [
    ['crossed-gardens', 'split-orchards', true],
    ['split-orchards', 'weaver-crossing', false],
    ['weaver-crossing', 'shared-lookout', true],
  ]) {
    const mission = host.catalog.missions.find(({ levelId }) => levelId === from);
    const destination = host.destination(host.row(mission));
    assert.equal(destination.next.mission.levelId, to);
    assert.equal(destination.crossesCampaign, crossesCampaign);
  }
});

test('only the selected pair receives new simulation identities and v9 packs', () => {
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

test('Split orchards keeps a deterministic two-contributor material route after specialization', () => {
  const row = materialRoutes.routes.find(
    ({ missionId, difficulty }) => missionId === 'split-orchards' && difficulty === 'gentle',
  );
  const level = resolveMission(project, row.missionId, {
    mode: 'team',
    difficulty: row.difficulty,
  }).level;
  for (const jointCuts of [false, true])
    for (const swapped of [false, true]) {
      const options = { jointCuts, swapped, inspectGoal: inspectTeamMaterialGoal };
      const first = playTeamFoundationRoute(level, row.log, options);
      const repeat = playTeamFoundationRoute(level, row.log, options);
      assert.equal(first.checkpoint, repeat.checkpoint);
      assert.equal(first.run.status, 'running', 'the route is an opening, not a forced clear');
      assert.equal(first.evidence.downs, 0);
      assert.deepEqual([...first.evidence.closed].sort(), [0, 1]);
      assert.deepEqual(first.mastery.neutralized.sort(), ['east-orchard', 'west-orchard']);
      assert(first.run.coverage > 0.7);
    }
});

test('Weaver crossing deterministically exercises real Support while retaining its known route gap', () => {
  const row = materialRoutes.routes.find(
    ({ missionId, difficulty }) => missionId === 'weaver-crossing' && difficulty === 'gentle',
  );
  const level = resolveMission(project, row.missionId, {
    mode: 'team',
    difficulty: row.difficulty,
  }).level;
  const options = {
    jointCuts: true,
    supportTicks: [[20], [2780]],
    inspectGoal: inspectTeamMaterialGoal,
  };
  const first = playTeamFoundationRoute(level, row.log, options);
  const repeat = playTeamFoundationRoute(level, row.log, options);
  assert.equal(first.checkpoint, repeat.checkpoint);
  assert.equal(first.run.status, 'running', 'this is a bounded route, not a full-clear claim');
  assert.equal(
    first.evidence.downs,
    1,
    'the recorded route still has one recovery and is not accepted as balance-clear evidence',
  );
  assert.deepEqual([...first.evidence.closed].sort(), [0, 1]);
  assert(first.run.coverage > 0.69 && first.run.coverage < level.goal.coverage);
  assert.deepEqual(
    first.events
      .filter(({ type }) => type === 'support.pulse')
      .map(({ role, slowedEnemies, interceptedImpacts }) => ({
        role,
        slowedEnemies,
        interceptedImpacts,
      })),
    [
      { role: 'interceptor', slowedEnemies: [], interceptedImpacts: [] },
      { role: 'disruptor', slowedEnemies: ['keeper-3'], interceptedImpacts: [] },
    ],
  );
  assert.deepEqual(
    first.run.players.map(({ support }) => support.uses),
    [1, 1],
  );
});

for (const missionId of TEAM_MATERIAL_PARTNER_MISSIONS)
  test(`${missionId}: the two specialist actions remain complementary`, () => {
    const level = resolveMission(project, missionId, {
      mode: 'team',
      difficulty: 'standard',
    }).level;
    const run = createCoop(level);
    const [interceptor, disruptor] = run.players;
    const enemy = run.enemies[0];
    const events = [];
    const emit = (_run, type, detail) => events.push({ type, ...detail });

    Object.assign(enemy, { x: interceptor.x + 1, y: interceptor.y, slowUntil: 0, speedScale: 1 });
    run.impacts = [{ id: 51, player: 0, owner: enemy.id, x: interceptor.x + 1, y: interceptor.y }];
    useSupport(run, interceptor, emit);
    assert.equal(run.impacts.length, 0);
    assert.equal(enemy.speedScale, 1);

    Object.assign(enemy, { x: disruptor.x + 1, y: disruptor.y, slowUntil: 0, speedScale: 1 });
    run.impacts = [{ id: 52, player: 1, owner: enemy.id, x: disruptor.x + 1, y: disruptor.y }];
    useSupport(run, disruptor, emit);
    assert.deepEqual(
      run.impacts.map(({ id }) => id),
      [52],
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
        { role: 'interceptor', slowedEnemies: [], interceptedImpacts: [51] },
        { role: 'disruptor', slowedEnemies: [enemy.id], interceptedImpacts: [] },
      ],
    );
  });

test('all presets, spawn swaps and deterministic seeds keep both openings pressure-free', () => {
  for (const missionId of TEAM_MATERIAL_PARTNER_MISSIONS)
    for (const difficulty of ['gentle', 'standard', 'expert'])
      for (const swapped of [false, true])
        for (const seed of [1, 7, 19]) {
          const resolved = resolveMission(project, missionId, { mode: 'team', difficulty }).level;
          const level = structuredClone(resolved);
          if (swapped) level.spawns.reverse();
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
