import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterProject } from '../content-design/starter.mjs';
import { editContentStructure as edit } from '../content-design/structure.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { forkMissionMap, createDraftHistory } from '../content-design/drafts.mjs';

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
