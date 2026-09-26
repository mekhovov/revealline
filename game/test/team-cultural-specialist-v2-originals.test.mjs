import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTeamCulturalSpecialistV2OriginalCandidates,
  TEAM_CULTURAL_SPECIALIST_V2_PROFILE_KEY,
  TEAM_CULTURAL_SPECIALIST_V2_REVISION,
  TEAM_CULTURAL_SPECIALIST_V2_SELECTIONS,
  TEAM_CULTURAL_SPECIALIST_V2_SOURCES,
} from '../content-design/team-cultural-specialist-v2-originals.mjs';
import { createTeamCulturalSpecialistOriginalCandidates } from '../content-design/team-cultural-specialist-originals.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../content-design/default-entry.mjs';
import { createTeamGreyboxEntry } from '../content-design/team-entry.mjs';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createCoop, SAFE, startCoop, stepCoop } from '../coop/core.mjs';
import { isMissionLibrarySourceJourney } from '../mission-library/handoff.mjs';
import { TEAM_LIBRARY_JOURNEY_EDITION } from '../mission-library/team-source.mjs';

const IDS = TEAM_CULTURAL_SPECIALIST_V2_SELECTIONS.map(({ id }) => id);
const source = createTeamCulturalSpecialistV2OriginalCandidates();
const previous = createTeamCulturalSpecialistOriginalCandidates();
const project = compileContentProject(source);
const previousProject = compileContentProject(previous);
const command = (direction = null) => ({ direction, boost: false, support: false });
const routes = Object.freeze({
  'crossed-gardens': [
    [{ a: 'right', ticks: 500 }],
    [
      { b: 'down', ticks: 50 },
      { b: null, ticks: 2 },
      { b: 'left', ticks: 500 },
    ],
  ],
  'split-orchards': [[{ a: 'right', ticks: 500 }], [{ b: 'left', ticks: 500 }]],
  'weaver-crossing': [
    [
      { a: 'down', ticks: 100 },
      { a: null, ticks: 2 },
      { a: 'right', ticks: 500 },
    ],
    [
      { b: 'up', ticks: 100 },
      { b: null, ticks: 2 },
      { b: 'left', ticks: 500 },
    ],
  ],
});
const fullRoutes = Object.freeze({
  'crossed-gardens': [
    [null, null, 1],
    ['up', null, 24],
    ['right', null, 246],
    [null, null, 1],
    ['right', null, 6],
    ['down', null, 72],
    ['left', null, 486],
    [null, null, 1],
    ['left', null, 6],
    ['down', null, 168],
    ['right', null, 468],
    ['up', null, 414],
    [null, null, 1],
    ['down', null, 246],
    ['left', null, 468],
    ['down', null, 96],
    ['right', null, 462],
    [null, null, 181],
    ['right', null, 6],
    ['up', null, 348],
    ['right', null, 276],
    ['down', null, 414],
    [null, null, 1],
    [null, 'right', 36],
    [null, 'down', 216],
    [null, 'left', 276],
    [null, 'up', 48],
    [null, 'left', 462],
    [null, null, 1],
    ['up', null, 54],
    ['left', null, 270],
  ],
  'split-orchards': [
    [null, null, 1],
    ['right', null, 234],
    [null, null, 1],
    ['right', null, 6],
    ['down', null, 24],
    ['left', null, 210],
    [null, null, 1],
    [null, 'left', 234],
    [null, null, 1],
    [null, 'left', 6],
    [null, 'down', 36],
    [null, 'right', 282],
    [null, null, 1],
    ['left', null, 6],
    ['up', null, 24],
    ['right', null, 492],
    ['up', null, 24],
    ['left', null, 282],
    [null, null, 1],
    ['left', null, 6],
    ['down', null, 24],
    ['left', null, 276],
    ['up', null, 12],
    ['right', null, 210],
    [null, null, 1],
    ['left', null, 6],
    ['up', null, 186],
    [null, null, 1],
    [null, 'right', 180],
    [null, null, 1],
    ['down', null, 186],
    ['left', null, 204],
    ['up', null, 12],
    ['left', null, 60],
    ['up', null, 174],
    [null, null, 1],
    [null, 'left', 246],
    [null, 'down', 258],
    [null, null, 1],
    [null, 'up', 414],
    [null, 'left', 492],
    [null, 'down', 414],
    [null, null, 1],
    [null, 'right', 492],
    [null, 'down', 6],
    [null, 'up', 48],
    [null, 'left', 486],
  ],
  'weaver-crossing': [
    [null, null, 1],
    [null, 'up', 282],
    [null, null, 181],
    [null, 'right', 144],
    [null, 'up', 6],
    [null, 'down', 420],
    [null, 'left', 192],
    [null, 'up', 414],
    [null, null, 1],
    [null, 'left', 468],
    [null, 'up', 6],
    [null, 'down', 414],
    [null, null, 181],
    ['up', null, 120],
    ['right', null, 240],
    ['down', null, 414],
    [null, null, 61],
    ['right', null, 96],
    ['down', null, 6],
    ['up', null, 414],
  ],
});
const mission = (compiled, id) => compiled.missions.find((item) => item.id === id);
const map = (compiled, id) => {
  const owner = mission(compiled, id);
  return compiled.maps.find(
    (item) => item.source.id === owner.map.id && item.source.revision === owner.map.revision,
  );
};

function closeRoute(run, segments, player) {
  const before = Uint8Array.from(run.cells);
  for (const segment of segments)
    for (let tick = 0; tick < segment.ticks && run.status === 'running'; tick++) {
      stepCoop(run, [command(segment.a), command(segment.b)]);
      assert.equal(
        run.events.some(({ type }) => type === 'player.downed'),
        false,
      );
      if (run.events.some(({ type, player: owner }) => type === 'cut.closed' && owner === player)) {
        return Array.from(run.cells, (cell, index) =>
          cell === SAFE && before[index] !== SAFE ? index : -1,
        ).filter((index) => index >= 0);
      }
    }
  assert.fail(`player ${player} did not close the rehearsed route`);
}

function safePath(level, cells, from, targets) {
  const targetSet = new Set(targets);
  const previous = new Int32Array(cells.length).fill(-1);
  const queue = [from];
  previous[from] = from;
  let found = targetSet.has(from) ? from : -1;
  for (let cursor = 0; cursor < queue.length && found < 0; cursor++) {
    const cell = queue[cursor];
    const x = cell % level.width;
    const y = Math.floor(cell / level.width);
    for (const neighbor of [
      x > 0 ? cell - 1 : -1,
      x + 1 < level.width ? cell + 1 : -1,
      y > 0 ? cell - level.width : -1,
      y + 1 < level.height ? cell + level.width : -1,
    ]) {
      if (neighbor < 0 || previous[neighbor] >= 0 || cells[neighbor] !== SAFE) continue;
      previous[neighbor] = cell;
      queue.push(neighbor);
      if (targetSet.has(neighbor)) {
        found = neighbor;
        break;
      }
    }
  }
  assert.notEqual(found, -1, 'a partner-owned safe route must be reachable');
  const path = [];
  for (let cell = found; cell !== from; cell = previous[cell]) path.push(cell);
  return path.reverse();
}

function traverseSafePath(run, seat, path) {
  stepCoop(run, [command(), command()]);
  for (const target of path) {
    const from = run.players[seat].cellIndex;
    const delta = target - from;
    const direction =
      delta === 1
        ? 'right'
        : delta === -1
          ? 'left'
          : delta === run.level.width
            ? 'down'
            : delta === -run.level.width
              ? 'up'
              : null;
    assert.notEqual(direction, null);
    for (let tick = 0; tick < 30 && run.players[seat].cellIndex !== target; tick++) {
      const directions = [null, null];
      directions[seat] = direction;
      stepCoop(run, directions.map(command));
      assert.equal(run.players[seat].cutting, false);
      assert.equal(
        run.events.some(({ type }) => type === 'player.downed'),
        false,
      );
    }
    assert.equal(run.players[seat].cellIndex, target);
  }
}

test('the second Team slice uses three additional bounded Ukrainian records', () => {
  assert.deepEqual(IDS, ['crossed-gardens', 'split-orchards', 'weaver-crossing']);
  for (const selection of TEAM_CULTURAL_SPECIALIST_V2_SELECTIONS) {
    assert(previous.missions.some(({ id }) => id === selection.id));
    assert.equal(selection.approaches.length, 2);
    assert.equal(new Set(selection.approaches).size, 2);
    assert(selection.partnerBenefit.length > 60);
    assert(selection.sourceIds.every((id) => TEAM_CULTURAL_SPECIALIST_V2_SOURCES[id]));
  }
  for (const item of Object.values(TEAM_CULTURAL_SPECIALIST_V2_SOURCES)) {
    assert.match(item.url, /^https:\/\/museum\.mincult\.gov\.ua\/collections\//);
    assert(item.observedVocabulary.length >= 3);
    assert.match(item.adaptationBoundary, /No .*cop/i);
  }
});

test('copy-on-write preserves every previous Team edition and unrelated mission', () => {
  const snapshot = structuredClone(previous);
  assert.deepEqual(createTeamCulturalSpecialistOriginalCandidates(), snapshot);
  assert.equal(source.revision, TEAM_CULTURAL_SPECIALIST_V2_REVISION);
  assert.deepEqual(source.assets, previous.assets);
  assert.deepEqual(
    source.missions.map(({ id }) => id),
    previous.missions.map(({ id }) => id),
  );
  for (const current of source.missions) {
    const old = previous.missions.find(({ id }) => id === current.id);
    if (!IDS.includes(current.id)) assert.deepEqual(current, old);
    else {
      assert.equal(current.revision, TEAM_CULTURAL_SPECIALIST_V2_REVISION);
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

test('the new ornament layouts remain connected and expose deliberate return components', () => {
  const expected = {
    'crossed-gardens': { walls: 6, terrain: 4 },
    'split-orchards': { walls: 8, terrain: 4 },
    'weaver-crossing': { walls: 8, terrain: 4 },
  };
  for (const id of IDS) {
    const before = map(previousProject, id);
    const current = map(project, id);
    assert.notEqual(current.geometryIdentity, before.geometryIdentity);
    assert.equal(current.source.walls.length, expected[id].walls);
    assert.equal(current.source.terrain.length, expected[id].terrain);
    assert.equal(current.geometry.fieldComponents.length, 1);
    assert(current.geometry.safeComponents.length >= 4);
    assert.deepEqual(
      current.geometry.diagnostics.map(({ code }) => code),
      ['disconnected-foundations'],
    );
  }
});

test('all presets preserve actors and keep both opening spawns safe while idle', () => {
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
  test(`${id} executes two different safe approaches on every preset and seed`, () => {
    for (const segments of routes[id])
      for (const difficulty of ['gentle', 'standard', 'expert'])
        for (const seed of [1, 7]) {
          const level = resolveMission(project, id, { mode: 'team', difficulty }).level;
          const run = startCoop(createCoop(level, { seed, jointCuts: false }));
          let downs = 0;
          let closed = null;
          route: for (const segment of segments)
            for (let tick = 0; tick < segment.ticks && run.status === 'running'; tick++) {
              stepCoop(run, [command(segment.a), command(segment.b)]);
              for (const event of run.events) {
                if (event.type === 'player.downed') downs++;
                if (event.type === 'cut.closed') {
                  closed = event.player;
                  break route;
                }
              }
            }
          assert.equal(run.status, 'running');
          assert.equal(downs, 0);
          assert.notEqual(closed, null);
          assert(run.coverage > 0 && run.coverage < level.goal.coverage);
          assert.equal(run.players[closed].cutting, false);
        }
  });

for (const id of IDS)
  test(`${id} leaves a no-Support route that the partner can use after both closures`, () => {
    for (const difficulty of ['gentle', 'standard', 'expert'])
      for (const seed of [1, 7]) {
        const level = resolveMission(project, id, { mode: 'team', difficulty }).level;
        const run = startCoop(createCoop(level, { seed, jointCuts: false }));
        const firstRoute = closeRoute(run, routes[id][0], 0);
        assert(firstRoute.length > 0);
        const secondRoute = closeRoute(run, routes[id][1], 1);
        assert(secondRoute.length > 0);
        const path = safePath(level, run.cells, run.players[1].cellIndex, firstRoute);
        assert(path.length > 0);
        traverseSafePath(run, 1, path);
        assert(firstRoute.includes(run.players[1].cellIndex));
        assert.equal(run.players[1].cutting, false);
        assert(run.players.every(({ support }) => support.uses === 0));
        assert(run.coverage > 0 && run.coverage < level.goal.coverage);
      }
  });

for (const id of IDS)
  test(`${id} has a pinned Standard no-Support full route without late cleanup`, () => {
    const level = resolveMission(project, id, { mode: 'team', difficulty: 'standard' }).level;
    const run = startCoop(createCoop(level, { seed: 17, jointCuts: false }));
    const closed = new Set();
    let downs = 0;
    for (const [a, b, ticks] of fullRoutes[id])
      for (let tick = 0; tick < ticks && run.status === 'running'; tick++) {
        stepCoop(run, [command(a), command(b)]);
        for (const event of run.events) {
          if (event.type === 'player.downed') downs++;
          if (event.type === 'cut.closed') closed.add(event.player);
        }
      }
    assert.equal(run.status, 'won');
    assert.equal(downs, 0);
    assert(run.coverage >= level.goal.coverage);
    assert.deepEqual([...closed].sort(), [0, 1]);
    assert(run.players.every(({ support }) => support.uses === 0));
    assert(run.time >= 30 && run.time <= 90, `completed in ${run.time}s`);
  });

test('the second cultural profile owns default Team entry and exact authored Next', () => {
  assert.equal(TEAM_CULTURAL_SPECIALIST_V2_PROFILE_KEY, 'team-cultural-specialist-originals-2');
  assert.equal(DEFAULT_JOURNEY_ROUTES.team, TEAM_CULTURAL_SPECIALIST_V2_PROFILE_KEY);
  assert.equal(TEAM_LIBRARY_JOURNEY_EDITION, TEAM_CULTURAL_SPECIALIST_V2_PROFILE_KEY);
  assert.equal(
    isMissionLibrarySourceJourney(TEAM_CULTURAL_SPECIALIST_V2_PROFILE_KEY, 'team'),
    true,
  );
  assert.equal(isMissionLibrarySourceJourney('team-cultural-specialist-originals-1', 'team'), true);
  const host = createCandidateTeamHost(source, {
    corePackIds: source.packs.map(({ id }) => id),
  });
  for (const [from, to] of [
    ['shared-detour', 'crossed-gardens'],
    ['crossed-gardens', 'split-orchards'],
    ['split-orchards', 'weaver-crossing'],
    ['weaver-crossing', 'shared-lookout'],
  ]) {
    const selected = host.catalog.missions.find(({ levelId }) => levelId === from);
    assert.equal(host.destination(host.row(selected)).next.mission.levelId, to);
  }
});

test('the Team entry factory gives the second cultural profile isolated progress ownership', async () => {
  const entry = await createTeamGreyboxEntry({ culturalSpecialistsV2: true });
  try {
    assert.equal(entry.candidateProgress.editionId, TEAM_CULTURAL_SPECIALIST_V2_PROFILE_KEY);
    assert.equal(
      entry.candidateProgress.backupFilename,
      'revealline-team-cultural-specialist-originals-2-progress.json',
    );
    const selected = entry.candidateJourney.catalog.missions.find(
      ({ levelId }) => levelId === 'crossed-gardens',
    );
    assert.equal(
      entry.candidateJourney.row(selected).level.revision,
      TEAM_CULTURAL_SPECIALIST_V2_REVISION,
    );
    assert.match(String(entry.candidateEditionLabel), /Ukrainian spatial specialist journey II/);
  } finally {
    entry.candidateProgress.dispose();
    entry.candidatePreferences.dispose();
  }
});
