import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterProject } from '../content-design/starter.mjs';
import { editContentStructure as edit } from '../content-design/structure.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { forkMissionMap, createDraftHistory } from '../content-design/drafts.mjs';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { CONTENT_PROJECT_ITEM_LIMITS } from '../content-design/limits.mjs';

test('campaign band changes validate every existing member without retuning or moving missions', () => {
  const source = createStarterProject();
  source.missions[0].design.difficulty.band = 2;
  const before = structuredClone(source);
  const identity = resolveMission(compileContentProject(source), 'nearby-shore').simulationIdentity;
  const next = edit(source, {
    action: 'set-band',
    kind: 'campaign',
    id: 'horizon-school',
    band: 2,
  });
  assert.deepEqual(source, before);
  assert.equal(next.campaigns[0].band, 2);
  assert.deepEqual(next.campaigns[0].missionIds, source.campaigns[0].missionIds);
  assert.deepEqual(next.missions, source.missions);
  assert.deepEqual(next.maps, source.maps);
  assert.equal(
    resolveMission(compileContentProject(next), 'nearby-shore').simulationIdentity,
    identity,
  );
  const history = createDraftHistory(source);
  history.replace(next);
  assert.deepEqual(history.undo(), source);
  assert.deepEqual(history.redo(), next);
  for (const band of [0, 3, 13, 1.5])
    assert.throws(() =>
      edit(source, { action: 'set-band', kind: 'campaign', id: 'horizon-school', band }),
    );
  assert.throws(
    () =>
      edit(createStarterProject(), {
        action: 'set-band',
        kind: 'campaign',
        id: 'horizon-school',
        band: 2,
      }),
    /band/,
  );
  assert.throws(
    () => edit(source, { action: 'set-band', kind: 'mission', id: 'nearby-shore', band: 2 }),
    /campaign/,
  );
  assert.throws(() =>
    edit(source, {
      action: 'set-band',
      kind: 'campaign',
      id: 'horizon-school',
      band: 2,
      parentId: 'opening',
    }),
  );
  assert.deepEqual(source, before);
});

test('create packs, campaigns and starter missions with explicit valid membership', () => {
  const original = createStarterProject(),
    before = structuredClone(original);
  let draft = edit(original, { action: 'create', kind: 'pack', id: 'new-pack', name: 'New pack' });
  draft = edit(draft, {
    action: 'create',
    kind: 'campaign',
    id: 'new-campaign',
    name: 'New campaign',
    band: 1,
    parentId: 'new-pack',
  });
  draft = edit(draft, {
    action: 'create',
    kind: 'mission',
    id: 'new-mission',
    name: 'New mission',
    parentId: 'new-campaign',
  });
  assert.deepEqual(original, before);
  assert.deepEqual(draft.packs.at(-1).campaignIds, ['new-campaign']);
  assert.deepEqual(draft.campaigns.at(-1).missionIds, ['new-mission']);
  assert.equal(draft.maps.at(-1).id, 'new-mission');
  assert.equal(
    resolveMission(compileContentProject(draft), 'new-mission').officialProgressEligible,
    false,
  );
});

test('explicit material-ready Team template accepts shared terrain without migrating existing editions', () => {
  const source = createStarterProject(),
    before = structuredClone(source);
  const draft = edit(source, {
    action: 'create',
    kind: 'mission',
    id: 'material-route',
    name: 'Material study',
    template: 'team-materials',
    parentId: 'horizon-school',
  });
  assert.deepEqual(source, before);
  assert.equal(draft.missions.at(-1).team.format, 'TeamMissionV2');
  const changed = forkMissionMap(draft, 'material-route', {
    terrain: [{ id: 'bed', kind: 'slow', x: 30, y: 14, w: 5, h: 5 }],
  });
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    const manifest = resolveMission(compileContentProject(changed), 'material-route', {
      mode: 'team',
      difficulty,
    });
    assert.equal(manifest.level.version, 'revealline-coop-level.v3');
    assert.equal(manifest.level.terrain.length, 1);
    assert.equal(manifest.validation, 'compiled-candidate-not-playtested');
  }
  assert.deepEqual(draft.maps.at(-1).terrain, []);
});

test('explicit Team template creates two-seat content with copy-on-write geometry and stable simulation names', () => {
  const source = createStarterProject();
  const draft = edit(source, {
    action: 'create',
    kind: 'mission',
    id: 'team-route',
    name: 'Partners',
    template: 'team-islands',
    parentId: 'horizon-school',
  });
  const mission = draft.missions.at(-1);
  assert.deepEqual(mission.modes, ['team']);
  assert.deepEqual(mission.team.spawnIds, ['west', 'east']);
  const initial = resolveMission(compileContentProject(draft), 'team-route', { mode: 'team' });
  const renamed = edit(draft, {
    action: 'rename',
    kind: 'mission',
    id: 'team-route',
    name: 'New display name',
  });
  assert.equal(
    resolveMission(compileContentProject(renamed), 'team-route', { mode: 'team' })
      .simulationIdentity,
    initial.simulationIdentity,
  );
  const duplicate = edit(draft, {
    action: 'duplicate',
    kind: 'mission',
    id: 'team-copy',
    name: 'Copy',
    sourceId: 'team-route',
  });
  const map = duplicate.maps.find((entry) => entry.id === 'team-route');
  const revised = forkMissionMap(duplicate, 'team-copy', {
    spawns: map.spawns.map((spawn) => (spawn.id === 'east' ? { ...spawn, x: 52.5 } : spawn)),
  });
  const result = resolveMission(compileContentProject(revised), 'team-copy', { mode: 'team' });
  assert.equal(result.level.spawns[1].x, 52.5);
  assert.equal(
    resolveMission(compileContentProject(revised), 'team-route', { mode: 'team' }).level.spawns[1]
      .x,
    51.5,
  );
  assert.equal(source.missions.length, 1);
  for (const template of ['automatic-team-conversion', null])
    assert.throws(
      () =>
        edit(source, {
          action: 'create',
          kind: 'mission',
          id: 'invalid',
          name: 'Invalid',
          template,
        }),
      /template/,
    );
});

test('duplicate shares an immutable map revision until editing only the copy', () => {
  const original = createStarterProject();
  const duplicate = edit(original, {
    action: 'duplicate',
    kind: 'mission',
    id: 'copy',
    name: 'Copy',
    sourceId: 'nearby-shore',
    parentId: 'horizon-school',
  });
  assert.equal(duplicate.maps.length, 1);
  assert.deepEqual(duplicate.missions[0].map, duplicate.missions[1].map);
  const changed = forkMissionMap(duplicate, 'copy', { foundations: [] });
  assert.deepEqual(changed.missions[0].map, original.missions[0].map);
  assert.notDeepEqual(changed.missions[1].map, changed.missions[0].map);
  assert.equal(changed.maps[0].foundations.length, 1);
  assert.equal(changed.maps[1].foundations.length, 0);
  assert.deepEqual(duplicate.missions[1].map, original.missions[0].map);
});

test('duplicate campaign copies its ordered missions, shares immutable maps and isolates later edits', () => {
  const source = createStarterProject(),
    before = structuredClone(source);
  const draft = edit(source, {
    action: 'duplicate',
    kind: 'campaign',
    id: 'second-school',
    name: 'Second school',
    sourceId: 'horizon-school',
    parentId: 'opening',
  });
  const copied = draft.campaigns.at(-1),
    copyId = copied.missionIds[0];
  assert.deepEqual(source, before);
  assert.deepEqual(draft.packs[0].campaignIds, ['horizon-school', 'second-school']);
  assert.notEqual(copyId, 'nearby-shore');
  assert.equal(copied.band, source.campaigns[0].band);
  assert.equal(draft.maps.length, source.maps.length);
  const renamed = edit(draft, {
    action: 'rename',
    kind: 'mission',
    id: copyId,
    name: 'Independent name',
  });
  assert.equal(renamed.missions[0].name, 'Nearby shore');
  const geometry = forkMissionMap(renamed, copyId, { foundations: [] });
  assert.deepEqual(geometry.missions[0], source.missions[0]);
  assert.notDeepEqual(geometry.missions.find((m) => m.id === copyId).map, source.missions[0].map);
  assert.deepEqual(
    draft,
    edit(source, {
      action: 'duplicate',
      kind: 'campaign',
      id: 'second-school',
      name: 'Second school',
      sourceId: 'horizon-school',
      parentId: 'opening',
    }),
    'Generated identities are deterministic.',
  );
});

test('duplicate pack preserves order and shared membership inside an independent copied hierarchy', () => {
  let source = edit(createStarterProject(), {
    action: 'create',
    kind: 'campaign',
    id: 'practice',
    name: 'Practice',
    band: 1,
    parentId: 'opening',
  });
  source = edit(source, {
    action: 'place',
    kind: 'mission',
    id: 'nearby-shore',
    parentId: 'practice',
  });
  const before = structuredClone(source);
  const draft = edit(source, {
    action: 'duplicate',
    kind: 'pack',
    id: 'new-world',
    name: 'New world',
    sourceId: 'opening',
  });
  const pack = draft.packs.at(-1),
    campaigns = pack.campaignIds.map((id) => draft.campaigns.find((c) => c.id === id));
  assert.deepEqual(
    campaigns.map((c) => c.name),
    ['Horizon School', 'Practice'],
  );
  assert.deepEqual(campaigns[0].missionIds, campaigns[1].missionIds);
  assert.notEqual(campaigns[0].missionIds[0], 'nearby-shore');
  assert.equal(draft.missions.length, 2, 'Shared source mission is copied once.');
  assert.equal(draft.campaigns.length, 4);
  assert.equal(draft.maps.length, 1);
  assert.deepEqual(draft.packs[0], source.packs[0]);
  assert.deepEqual(draft.campaigns.slice(0, 2), source.campaigns);
  assert.deepEqual(source, before);
  const history = createDraftHistory(source);
  history.replace(draft);
  assert.deepEqual(history.undo(), source);
  assert.deepEqual(history.redo(), draft);
});

test('container duplication retains archived descendants, resets only the root and keeps original asset pins', () => {
  const source = createStarterProject();
  source.packs[0].archived = true;
  source.campaigns[0].archived = true;
  source.missions[0].archived = true;
  const draft = edit(source, {
    action: 'duplicate',
    kind: 'pack',
    id: 'copy',
    name: 'Copy',
    sourceId: 'opening',
  });
  assert.equal(draft.packs.at(-1).archived, undefined);
  assert.equal(draft.campaigns.at(-1).archived, true);
  assert.equal(draft.missions.at(-1).archived, true);
  assert.deepEqual(draft.missions.at(-1).presentation, source.missions[0].presentation);
  assert.deepEqual(draft.maps, source.maps);
  assert.deepEqual(draft.assets, source.assets);
  const empty = structuredClone(source);
  empty.packs[0].campaignIds = [];
  const result = edit(empty, {
    action: 'duplicate',
    kind: 'pack',
    id: 'blank',
    name: 'Blank',
    sourceId: 'opening',
  });
  assert.deepEqual(result.packs.at(-1).campaignIds, []);
  assert.equal(result.missions.length, 1);
});

test('whole-pack duplication shares original asset pins without copying bytes or granting qualification', () => {
  const source = createOpeningCandidates({ artwork: true });
  const draft = edit(source, {
    action: 'duplicate',
    kind: 'pack',
    id: 'new-horizon',
    name: 'New Horizon',
    sourceId: 'journey-opening',
  });
  assert.deepEqual(draft.assets, source.assets);
  assert.deepEqual(draft.maps, source.maps);
  assert.equal(draft.missions.length, source.missions.length + 9);
  const compiled = compileContentProject(draft);
  for (const mission of draft.missions.slice(source.missions.length)) {
    const original = source.missions.find((m) => m.name === mission.name);
    assert.deepEqual(mission.presentation, original.presentation);
    const manifest = resolveMission(compiled, mission.id);
    assert.equal(manifest.officialProgressEligible, false);
    assert(manifest.diagnostics.some((row) => row.code === 'candidate-art-not-visually-qualified'));
  }
});

test('container duplicate IDs remain bounded and generated collisions or budgets fail atomically', () => {
  const source = createStarterProject(),
    id = 'x'.repeat(80);
  const draft = edit(source, {
    action: 'duplicate',
    kind: 'pack',
    id,
    name: 'Long ID',
    sourceId: 'opening',
  });
  for (const item of [...draft.missions, ...draft.campaigns, ...draft.packs])
    assert(item.id.length <= 80);
  const collision = structuredClone(source);
  collision.missions.push(structuredClone(draft.missions.at(-1)));
  const before = structuredClone(collision);
  assert.throws(
    () =>
      edit(collision, {
        action: 'duplicate',
        kind: 'pack',
        id,
        name: 'Collision',
        sourceId: 'opening',
      }),
    /already exists/,
  );
  assert.deepEqual(collision, before);
  const full = createStarterProject();
  for (let i = 1; i < CONTENT_PROJECT_ITEM_LIMITS.missions; i++)
    full.missions.push({ ...structuredClone(full.missions[0]), id: `mission-${i}` });
  const fullBefore = structuredClone(full);
  assert.equal(compileContentProject(full).missions.length, CONTENT_PROJECT_ITEM_LIMITS.missions);
  assert.throws(
    () =>
      edit(full, {
        action: 'duplicate',
        kind: 'pack',
        id: 'overflow',
        name: 'Overflow',
        sourceId: 'opening',
      }),
    /missions exceeds its item budget/,
  );
  assert.deepEqual(full, fullBefore);
});

test('order edits affect the selected parent without silently detaching shared membership', () => {
  let draft = edit(createStarterProject(), {
    action: 'duplicate',
    kind: 'mission',
    id: 'copy',
    name: 'Copy',
    sourceId: 'nearby-shore',
    parentId: 'horizon-school',
  });
  draft = edit(draft, {
    action: 'create',
    kind: 'campaign',
    id: 'other',
    name: 'Other',
    band: 1,
    parentId: 'opening',
  });
  draft = edit(draft, { action: 'place', kind: 'mission', id: 'copy', parentId: 'other' });
  draft = edit(draft, {
    action: 'reorder',
    kind: 'mission',
    id: 'copy',
    parentId: 'horizon-school',
    offset: -1,
  });
  assert.deepEqual(draft.campaigns[0].missionIds, ['copy', 'nearby-shore']);
  assert.deepEqual(draft.campaigns[1].missionIds, ['copy']);
  draft = edit(draft, {
    action: 'reorder',
    kind: 'campaign',
    id: 'other',
    parentId: 'opening',
    offset: -1,
  });
  assert.deepEqual(draft.packs[0].campaignIds, ['other', 'horizon-school']);
  draft = edit(draft, { action: 'create', kind: 'pack', id: 'second', name: 'Second' });
  draft = edit(draft, { action: 'reorder', kind: 'pack', id: 'second', offset: -1 });
  assert.deepEqual(
    draft.packs.map((pack) => pack.id),
    ['second', 'opening'],
  );
});

test('rename preserves simulation, while history owns undo/redo of structural edits', () => {
  const original = createStarterProject(),
    history = createDraftHistory(original);
  const identity = resolveMission(
    compileContentProject(original),
    'nearby-shore',
  ).simulationIdentity;
  history.replace(
    edit(original, { action: 'rename', kind: 'mission', id: 'nearby-shore', name: 'Renamed' }),
  );
  assert.equal(
    resolveMission(compileContentProject(history.current()), 'nearby-shore').simulationIdentity,
    identity,
  );
  assert.equal(history.undo().missions[0].name, 'Nearby shore');
  assert.equal(history.redo().missions[0].name, 'Renamed');
});

test('invalid references, duplicate IDs, campaign bands and unsupported operations fail atomically', () => {
  const source = createStarterProject(),
    original = JSON.stringify(source);
  const invalid = [
    { action: 'create', kind: 'mission', id: 'nearby-shore', name: 'Duplicate' },
    { action: 'create', kind: 'mission', id: 'new', name: 'New', parentId: 'missing' },
    { action: 'create', kind: 'campaign', id: 'new', name: 'New', band: 13 },
    { action: 'duplicate', kind: 'mission', id: 'copy', name: 'Copy', sourceId: 'missing' },
    { action: 'place', kind: 'mission', id: 'nearby-shore', parentId: 'horizon-school' },
    {
      action: 'reorder',
      kind: 'mission',
      id: 'nearby-shore',
      parentId: 'horizon-school',
      offset: -1,
    },
    { action: 'delete', kind: 'mission', id: 'nearby-shore' },
    { action: 'rename', kind: 'mission', id: 'nearby-shore', name: 'New', publish: true },
  ];
  for (const command of invalid) {
    assert.throws(() => edit(source, command));
    assert.equal(JSON.stringify(source), original);
  }
  const higher = edit(source, {
    action: 'create',
    kind: 'campaign',
    id: 'advanced',
    name: 'Advanced',
    band: 8,
  });
  assert.throws(
    () =>
      edit(higher, { action: 'place', kind: 'mission', id: 'nearby-shore', parentId: 'advanced' }),
    /band/,
  );
});
