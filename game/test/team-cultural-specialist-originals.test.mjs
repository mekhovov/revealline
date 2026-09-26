import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTeamCulturalSpecialistOriginalCandidates,
  TEAM_CULTURAL_SPECIALIST_PROFILE_KEY,
  TEAM_CULTURAL_SPECIALIST_REVISION,
  TEAM_CULTURAL_SPECIALIST_SELECTIONS,
  TEAM_CULTURAL_SPECIALIST_SOURCES,
} from '../content-design/team-cultural-specialist-originals.mjs';
import { createTeamCompleteSpecialistOriginalCandidates } from '../content-design/team-complete-specialist-originals.mjs';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { createTeamGreyboxEntry } from '../content-design/team-entry.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createCoop, SAFE, startCoop, stepCoop } from '../coop/core.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../content-design/default-entry.mjs';

const IDS = TEAM_CULTURAL_SPECIALIST_SELECTIONS.map(({ id }) => id);
const source = createTeamCulturalSpecialistOriginalCandidates();
const previous = createTeamCompleteSpecialistOriginalCandidates();
const project = compileContentProject(source);
const previousProject = compileContentProject(previous);
const command = (direction = null) => ({ direction, boost: false, support: false });
const routes = Object.freeze({
  'stepping-exchange': [
    [
      { a: 'down', ticks: 84 },
      { a: 'right', ticks: 280 },
    ],
    [
      { a: 'up', ticks: 80 },
      { a: 'right', ticks: 230 },
      { a: 'down', ticks: 80 },
    ],
  ],
  'divided-workshop': [
    [{ a: 'right', b: 'left', ticks: 240 }],
    [{ a: 'down', b: 'up', ticks: 240 }],
  ],
  'shared-detour': [
    [{ a: 'right', ticks: 360 }],
    [
      { b: 'up', ticks: 105 },
      { b: 'left', ticks: 165 },
      { b: 'down', ticks: 230 },
      { b: 'right', ticks: 90 },
      { b: 'up', ticks: 110 },
      { b: 'right', ticks: 40 },
    ],
  ],
});

const mission = (compiled, id) => compiled.missions.find((item) => item.id === id);
const map = (compiled, id) => {
  const owner = mission(compiled, id);
  return compiled.maps.find(
    (item) => item.source.id === owner.map.id && item.source.revision === owner.map.revision,
  );
};

test('three Team successors use bounded Ukrainian compositional references', () => {
  assert.deepEqual(IDS, ['stepping-exchange', 'divided-workshop', 'shared-detour']);
  for (const selection of TEAM_CULTURAL_SPECIALIST_SELECTIONS) {
    assert(previous.missions.some(({ id }) => id === selection.id));
    assert.equal(selection.approaches.length, 2);
    assert.equal(new Set(selection.approaches).size, 2);
    assert(selection.partnerBenefit.length > 50);
    assert(selection.sourceIds.every((id) => TEAM_CULTURAL_SPECIALIST_SOURCES[id]));
  }
  for (const item of Object.values(TEAM_CULTURAL_SPECIALIST_SOURCES)) {
    assert.match(item.url, /(museum\.mincult\.gov\.ua|opishne-museum\.gov\.ua)/);
    assert(item.observedVocabulary.length >= 3);
    assert.match(item.adaptationBoundary, /No .*cop/i);
  }
});

test('copy-on-write changes only the selected Team maps, guidance and owners', () => {
  const snapshot = structuredClone(previous);
  assert.deepEqual(createTeamCompleteSpecialistOriginalCandidates(), snapshot);
  assert.equal(source.revision, TEAM_CULTURAL_SPECIALIST_REVISION);
  assert.deepEqual(source.assets, previous.assets);
  assert.deepEqual(
    source.missions.map(({ id }) => id),
    previous.missions.map(({ id }) => id),
  );

  for (const current of source.missions) {
    const old = previous.missions.find(({ id }) => id === current.id);
    if (!IDS.includes(current.id)) assert.deepEqual(current, old);
    else {
      assert.equal(current.revision, TEAM_CULTURAL_SPECIALIST_REVISION);
      for (const key of [
        'id',
        'name',
        'spawnId',
        'modes',
        'actors',
        'objectives',
        'bonuses',
        'coverage',
        'timeLimitSeconds',
        'presentation',
        'team',
      ])
        assert.deepEqual(current[key], old[key], `${current.id}/${key}`);
      assert.deepEqual(current.design.introduces, old.design.introduces);
      assert(current.design.combines.includes('complementary-routes'));
    }
  }
});

test('ornament obstacles retain one playable field with explicit shared returns', () => {
  const expected = {
    'stepping-exchange': { walls: 6, safe: 6 },
    'divided-workshop': { walls: 8, safe: 4 },
    'shared-detour': { walls: 6, safe: 4 },
  };
  for (const id of IDS) {
    const before = map(previousProject, id);
    const current = map(project, id);
    assert.notEqual(current.geometryIdentity, before.geometryIdentity);
    assert.equal(current.source.walls.length, expected[id].walls);
    assert.equal(current.geometry.fieldComponents.length, 1);
    assert.equal(current.geometry.safeComponents.length, expected[id].safe);
    assert.deepEqual(
      current.geometry.diagnostics.map(({ code }) => code),
      ['disconnected-foundations'],
    );
  }
});

test('all presets preserve rules, actors, specialist ownership and safe idle openings', () => {
  for (const id of IDS)
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const before = resolveMission(previousProject, id, { mode: 'team', difficulty });
      const current = resolveMission(project, id, { mode: 'team', difficulty });
      assert.deepEqual(current.level.rules, before.level.rules);
      assert.deepEqual(current.level.enemies, before.level.enemies);
      assert.deepEqual(current.level.goal, before.level.goal);
      assert.deepEqual(current.level.lineImpact, before.level.lineImpact);
      assert.deepEqual(current.level.supportRoles, ['interceptor', 'disruptor']);
      assert.notEqual(current.simulationIdentity, before.simulationIdentity);

      for (const seed of [1, 7, 19]) {
        const run = startCoop(createCoop(current.level, { seed, jointCuts: false }));
        const positions = run.players.map(({ x, y }) => [x, y]);
        for (let tick = 0; tick < 300; tick++) stepCoop(run, [command(), command()]);
        assert.equal(run.status, 'running');
        assert.equal(run.coverage, 0);
        assert.equal(
          run.events.some(({ type }) => type === 'player.downed'),
          false,
        );
        assert.deepEqual(
          run.players.map(({ x, y }) => [x, y]),
          positions,
        );
      }
    }
});

for (const id of IDS)
  test(`${id} executes two distinct safe approaches on every preset and seed`, () => {
    for (const segments of routes[id])
      for (const difficulty of ['gentle', 'standard', 'expert'])
        for (const seed of [1, 7]) {
          const level = resolveMission(project, id, { mode: 'team', difficulty }).level;
          const run = startCoop(createCoop(level, { seed, jointCuts: false }));
          let downs = 0;
          const closed = new Set();
          for (const segment of segments)
            for (let tick = 0; tick < segment.ticks && run.status === 'running'; tick++) {
              stepCoop(run, [command(segment.a), command(segment.b)]);
              for (const event of run.events) {
                if (event.type === 'player.downed') downs++;
                if (event.type === 'cut.closed') closed.add(event.player);
              }
            }
          assert.equal(run.status, 'running');
          assert.equal(downs, 0);
          assert(closed.size >= 1);
          assert(run.coverage > 0 && run.coverage < level.goal.coverage);
          for (const seat of closed) {
            const player = run.players[seat];
            assert.equal(player.cutting, false);
            assert.equal(run.cells[player.cellIndex], SAFE);
          }
        }
  });

test('the new profile owns exact Next while the complete-specialist edition remains selectable', () => {
  assert.equal(TEAM_CULTURAL_SPECIALIST_PROFILE_KEY, 'team-cultural-specialist-originals-1');
  assert.deepEqual(DEFAULT_JOURNEY_ROUTES, {
    solo: 'whole-spatial-v25',
    versus: 'whole-spatial-v25',
    team: TEAM_CULTURAL_SPECIALIST_PROFILE_KEY,
  });
  const host = createCandidateTeamHost(source, {
    corePackIds: source.packs.map(({ id }) => id),
  });
  const oldHost = createCandidateTeamHost(previous, {
    corePackIds: previous.packs.map(({ id }) => id),
  });
  const currentStepping = host.catalog.missions.find(
    ({ levelId }) => levelId === 'stepping-exchange',
  );
  const previousStepping = oldHost.catalog.missions.find(
    ({ levelId }) => levelId === 'stepping-exchange',
  );
  assert.notEqual(
    host.row(currentStepping).level.revision,
    oldHost.row(previousStepping).level.revision,
  );
  for (const [from, to] of [
    ['twin-landings', 'stepping-exchange'],
    ['stepping-exchange', 'divided-workshop'],
    ['divided-workshop', 'switchback-partners'],
    ['switchback-partners', 'shared-detour'],
    ['shared-detour', 'crossed-gardens'],
  ]) {
    const selected = host.catalog.missions.find(({ levelId }) => levelId === from);
    assert.equal(host.destination(host.row(selected)).next.mission.levelId, to);
  }
});

test('the entry factory gives the cultural successor isolated progress ownership', async () => {
  const entry = await createTeamGreyboxEntry({ culturalSpecialists: true });
  try {
    assert.equal(entry.candidateProgress.editionId, TEAM_CULTURAL_SPECIALIST_PROFILE_KEY);
    assert.equal(
      entry.candidateProgress.backupFilename,
      'revealline-team-cultural-specialist-originals-1-progress.json',
    );
    const selected = entry.candidateJourney.catalog.missions.find(
      ({ levelId }) => levelId === 'stepping-exchange',
    );
    assert.equal(
      entry.candidateJourney.row(selected).level.revision,
      TEAM_CULTURAL_SPECIALIST_REVISION,
    );
    assert.match(String(entry.candidateEditionLabel), /Ukrainian spatial specialist journey/);
  } finally {
    entry.candidateProgress.dispose();
    entry.candidatePreferences.dispose();
  }
});
