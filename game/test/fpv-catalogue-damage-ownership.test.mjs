import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogueDamageOwnership } from '../../docs/evidence/fpv-combat/catalogue-damage-ownership.mjs';
import {
  WORLD_CATALOGUE,
  BEGINNER_CATALOGUE,
} from '../../optional-practice/civilian-fpv/world-catalogue.mjs';
import {
  createEncounterDefinition,
  encounterPhysicsCourse,
} from '../../optional-practice/civilian-fpv/encounter-runtime.mjs';
import { courseFromProject } from '../../optional-practice/civilian-fpv/world-app.mjs';

test('imported actor settings cannot override the scene marker identity, declared type or transformed position', () => {
  const source = {
    format: 'FPVWorldProject.v1',
    id: 'ownership-import',
    title: 'Ownership import',
    world: { id: 'ownership-world' },
    courses: [],
    source: {
      anchors: [
        {
          id: 'canonical-actor',
          kind: 'actor',
          actorType: 'patrol',
          position: { x: 6, y: 0, z: -6 },
          settings: {
            id: 'unmatched-mesh',
            type: 'drone',
            position: { x: 123, y: 999, z: 88 },
            role: 'civilian',
            health: 75,
          },
        },
      ],
      colliders: [],
    },
  };
  const before = structuredClone(source),
    [actor] = courseFromProject(source).actors;
  assert.equal(actor.id, 'canonical-actor');
  assert.equal(actor.type, 'patrol');
  assert.deepEqual(actor.position, { x: 6000, y: 0, z: -6000 });
  assert.equal(actor.role, 'civilian');
  assert.equal(actor.health, 75);
  assert.deepEqual(source, before);
});

test('shipped actor inventory has stable unique IDs within every exact course and explicit supported types/roles', () => {
  const inventory = catalogueDamageOwnership();
  assert.equal(inventory.summary.entries, WORLD_CATALOGUE.length + BEGINNER_CATALOGUE.length);
  assert.equal(inventory.summary.actorOccurrences, 357);
  for (const source of inventory.sources) {
    assert.equal(new Set(source.actors.map(([id]) => id)).size, source.actorCount, source.id);
    for (const [id, type, role] of source.actors) {
      assert.match(id, /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/, source.id);
      assert.ok(
        ['patrol', 'sentry', 'vehicle', 'drone', 'hazard'].includes(type),
        `${source.id}/${id}`,
      );
      assert.ok(['hostile', 'civilian', 'rival', null].includes(role), `${source.id}/${id}`);
    }
    if (source.source === 'legacy') assert.equal(source.actorCount, 0);
  }
  assert.equal(inventory.regions.length, inventory.summary.regionalPins);
  for (const row of inventory.regions) assert.match(row.descriptorSha256, /^[a-f0-9]{64}$/);
});

test('ownership-only encounter projection retains every shipped authored actor and removes the second native owner', () => {
  // Identity callback deliberately isolates ownership. Real terrain/reachability
  // admission belongs to the separate catalogue matrix, not this lightweight check.
  let courses = 0,
    actors = 0;
  for (const entry of [...WORLD_CATALOGUE, ...BEGINNER_CATALOGUE]) {
    if (!entry.course.actors?.length) continue;
    const before = structuredClone(entry.course);
    const definition = createEncounterDefinition({
      course: entry.course,
      version: 2,
      population: 20,
      activity: 'continuous',
      admitActor: (actor) => actor,
      admitServicePad: () => null,
    });
    for (const source of entry.course.actors) {
      const owned = definition.actors.filter((actor) => actor.id === source.id);
      assert.equal(owned.length, 1, `${entry.id}/${source.id}`);
      assert.equal(owned[0].destructible, true);
      assert.equal(owned[0].role, 'hostile');
      actors++;
    }
    assert.deepEqual(encounterPhysicsCourse(entry.course).actors, []);
    assert.deepEqual(entry.course, before);
    courses++;
  }
  assert.equal(courses, 118);
  assert.equal(actors, 357);
});
