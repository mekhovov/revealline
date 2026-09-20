import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterProject } from '../content-design/starter.mjs';
import {
  editContentStructure as edit,
  inspectContentRemoval as inspect,
} from '../content-design/structure.mjs';
import { createDraftHistory } from '../content-design/drafts.mjs';
import { compileContentProject } from '../content-design/project.mjs';

test('mission deletion refuses every parent and detaching one membership preserves all other uses', () => {
  let draft = edit(createStarterProject(), {
    action: 'create',
    kind: 'campaign',
    id: 'second',
    name: 'Second',
    band: 1,
  });
  draft = edit(draft, { action: 'place', kind: 'mission', id: 'nearby-shore', parentId: 'second' });
  const before = structuredClone(draft);
  const impact = inspect(draft, 'mission', 'nearby-shore');
  assert.equal(impact.deletable, false);
  assert.deepEqual(
    impact.dependencies.map((entry) => entry.id),
    ['horizon-school', 'second'],
  );
  assert(Object.isFrozen(impact.dependencies[0]));
  const remove = {
    action: 'delete',
    kind: 'mission',
    id: 'nearby-shore',
    confirmationId: 'nearby-shore',
  };
  assert.throws(() => edit(draft, remove), /horizon-school.*second/u);
  assert.deepEqual(draft, before);
  draft = edit(draft, {
    action: 'detach',
    kind: 'mission',
    id: 'nearby-shore',
    parentId: 'horizon-school',
  });
  assert.equal(draft.missions.length, 1);
  assert.notEqual(draft.campaigns[0].revision, before.campaigns[0].revision);
  assert.equal(draft.campaigns[1].revision, before.campaigns[1].revision);
  assert.deepEqual(draft.campaigns[1].missionIds, ['nearby-shore']);
  assert.throws(() => edit(draft, remove), /second/u);
  draft = edit(draft, {
    action: 'detach',
    kind: 'mission',
    id: 'nearby-shore',
    parentId: 'second',
  });
  assert.equal(inspect(draft, 'mission', 'nearby-shore').deletable, true);
  const removed = edit(draft, remove);
  assert.equal(removed.missions.length, 0);
  assert.deepEqual(removed.maps, before.maps);
  assert.deepEqual(removed.assets, before.assets);
  assert.equal(compileContentProject(removed).missions.length, 0);
});

test('campaigns and packs require explicit removal of their memberships; no cascade deletes children', () => {
  const source = createStarterProject();
  assert.deepEqual(inspect(source, 'campaign', 'horizon-school').dependencies, [
    { kind: 'pack', id: 'opening', relation: 'parent' },
    { kind: 'mission', id: 'nearby-shore', relation: 'member' },
  ]);
  assert.throws(
    () =>
      edit(source, { action: 'delete', kind: 'pack', id: 'opening', confirmationId: 'opening' }),
    /horizon-school/u,
  );
  let next = edit(source, {
    action: 'detach',
    kind: 'campaign',
    id: 'horizon-school',
    parentId: 'opening',
  });
  next = edit(next, { action: 'delete', kind: 'pack', id: 'opening', confirmationId: 'opening' });
  assert.equal(next.packs.length, 0);
  assert.deepEqual(next.campaigns, source.campaigns);
  assert.deepEqual(next.missions, source.missions);
  assert.throws(
    () =>
      edit(next, {
        action: 'delete',
        kind: 'campaign',
        id: 'horizon-school',
        confirmationId: 'horizon-school',
      }),
    /nearby-shore/u,
  );
  next = edit(next, {
    action: 'detach',
    kind: 'mission',
    id: 'nearby-shore',
    parentId: 'horizon-school',
  });
  next = edit(next, {
    action: 'delete',
    kind: 'campaign',
    id: 'horizon-school',
    confirmationId: 'horizon-school',
  });
  assert.equal(next.campaigns.length, 0);
  assert.deepEqual(next.missions, source.missions);
  assert.deepEqual(next.maps, source.maps);
});

test('deletion revalidates dependencies after inspection, requires exact confirmation, and supports exact undo', () => {
  const source = edit(createStarterProject(), {
    action: 'duplicate',
    kind: 'mission',
    id: 'copy',
    sourceId: 'nearby-shore',
    name: 'Copy',
  });
  const before = structuredClone(source);
  assert.equal(inspect(source, 'mission', 'copy').deletable, true);
  const remove = { action: 'delete', kind: 'mission', id: 'copy', confirmationId: 'copy' };
  for (const command of [
    { ...remove, confirmationId: 'nearby-shore' },
    { action: 'delete', kind: 'mission', id: 'copy' },
    { ...remove, cascade: true },
    { action: 'detach', kind: 'pack', id: 'opening' },
    { action: 'detach', kind: 'mission', id: 'copy', parentId: 'horizon-school' },
  ])
    assert.throws(() => edit(source, command));
  const changed = edit(source, {
    action: 'place',
    kind: 'mission',
    id: 'copy',
    parentId: 'horizon-school',
  });
  assert.throws(() => edit(changed, remove), /horizon-school/u);
  const history = createDraftHistory(source);
  history.replace(edit(source, remove));
  assert.equal(history.current().missions.length, 1);
  assert.deepEqual(history.undo(), before);
  assert.equal(history.redo().missions.length, 1);
  assert.deepEqual(source, before);
  assert.throws(() => inspect(source, 'map', 'island-map'), /existing/u);
  assert.throws(() => inspect(source, 'mission', 'missing'), /existing/u);
});
