import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { resolveContentJourney } from '../content-design/journey.mjs';
import { createContentExecutionCatalog } from '../content-design/execution.mjs';
import { editContentStructure as edit } from '../content-design/structure.mjs';
import { createDraftHistory } from '../content-design/drafts.mjs';

test('archive and restore preserve definitions and gameplay while every preset omits archived memberships', () => {
  const source = createOpeningCandidates(),
    original = structuredClone(source);
  const navigation = resolveContentJourney(source).missions;
  for (const [kind, id, count] of [
    ['mission', 'first-return', 9],
    ['campaign', 'prologue', 7],
    ['pack', 'journey-opening', 1],
  ]) {
    const archived = edit(source, { action: 'archive', kind, id });
    assert.equal(archived[`${kind}s`].find((entry) => entry.id === id).archived, true);
    assert.deepEqual(archived.maps, source.maps);
    for (const field of ['missions', 'campaigns', 'packs'])
      assert.equal(archived[field].length, source[field].length);
    for (const mode of ['solo', 'versus']) {
      const executions = createContentExecutionCatalog(archived, { mode });
      for (const difficulty of ['gentle', 'standard', 'expert']) {
        const journey = resolveContentJourney(archived, { mode, difficulty });
        assert.equal(journey.missions.length, count);
        assert.deepEqual(executions.journey(difficulty).missions, journey.missions);
      }
    }
    const before = resolveMission(compileContentProject(source), 'first-return');
    const after = resolveMission(compileContentProject(archived), 'first-return');
    assert.equal(after.simulationIdentity, before.simulationIdentity);
    assert.equal(after.officialProgressEligible, false);
    const restored = edit(archived, { action: 'restore', kind, id });
    assert.equal(
      Object.hasOwn(
        restored[`${kind}s`].find((entry) => entry.id === id),
        'archived',
      ),
      false,
    );
    assert.deepEqual(resolveContentJourney(restored).missions, navigation);
    assert.throws(() => edit(archived, { action: 'archive', kind, id }), /already/u);
    assert.throws(() => edit(restored, { action: 'restore', kind, id }), /not archived/u);
  }
  assert.deepEqual(source, original);
});

test('archiving a pack does not archive shared campaigns or erase their membership in another pack', () => {
  let source = createOpeningCandidates();
  source = edit(source, { action: 'create', kind: 'pack', id: 'shared', name: 'Shared' });
  source = edit(source, { action: 'place', kind: 'campaign', id: 'prologue', parentId: 'shared' });
  const archived = edit(source, { action: 'archive', kind: 'pack', id: 'journey-opening' });
  assert.deepEqual(archived.campaigns, source.campaigns);
  assert.deepEqual(archived.missions, source.missions);
  const journey = resolveContentJourney(archived);
  assert.equal(journey.missions.length, 4);
  assert.equal(journey.missions.filter((mission) => mission.packId === 'shared').length, 3);
  assert(!journey.missions.some((mission) => mission.packId === 'journey-opening'));
  assert.throws(
    () => resolveContentJourney(archived, { packIds: ['journey-opening'] }),
    /no missions/u,
  );
});

test('archive is not validation bypass or cascade deletion; copies are active and Undo restores exact source', () => {
  const source = createOpeningCandidates();
  for (const kind of ['mission', 'campaign', 'pack']) {
    const invalid = structuredClone(source);
    invalid[`${kind}s`][0].archived = 'yes';
    assert.throws(() => compileContentProject(invalid), /boolean/u);
  }
  const archived = edit(source, { action: 'archive', kind: 'mission', id: 'first-return' });
  assert.throws(
    () =>
      edit(archived, {
        action: 'delete',
        kind: 'mission',
        id: 'first-return',
        confirmationId: 'first-return',
      }),
    /prologue/u,
  );
  const broken = structuredClone(archived);
  broken.missions[0].coverage = -1;
  assert.throws(() => compileContentProject(broken), /coverage/u);
  const duplicate = edit(archived, {
    action: 'duplicate',
    kind: 'mission',
    id: 'active-copy',
    sourceId: 'first-return',
    name: 'Active copy',
    parentId: 'prologue',
  });
  assert.equal(Object.hasOwn(duplicate.missions.at(-1), 'archived'), false);
  assert.deepEqual(duplicate.missions.at(-1).map, source.missions[0].map);
  assert(
    resolveContentJourney(duplicate).missions.some((mission) => mission.levelId === 'active-copy'),
  );
  const history = createDraftHistory(source);
  history.replace(archived);
  assert.deepEqual(history.undo(), source);
  assert.deepEqual(history.redo(), archived);
  assert.deepEqual(compileContentProject(JSON.stringify(archived)).source, archived);
});
