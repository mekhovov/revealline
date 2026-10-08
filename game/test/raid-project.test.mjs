import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOverflightHuntProject,
  compileOverflightHuntProject,
  validateOverflightHuntProject,
  OVERFLIGHT_HUNT_ENCOUNTER_SETS,
  OVERFLIGHT_HUNT_COMPILED_FORMAT,
} from '../overflight/raid-project.mjs';
import {
  createOverflightProject,
  validateOverflightProject,
  OVERFLIGHT_SOLDIERS,
  OVERFLIGHT_MACHINERY,
} from '../overflight/project.mjs';
import {
  createOverflightHuntPackage,
  importOverflightHuntPackage,
  exportOverflightHuntPackage,
  createOverflightHuntLibrary,
} from '../overflight/raid-community.mjs';
import { createOverflightPackage, importOverflightPackage } from '../overflight/community.mjs';

const allActors = (project) =>
  project.encounters.flatMap((encounter) => [...encounter.packs, ...encounter.objectives]);
test('Raid native and Studio compile the same immutable source and exact resource closure', () => {
  const draft = createOverflightHuntProject();
  const native = compileOverflightHuntProject(draft),
    studio = compileOverflightHuntProject(JSON.stringify(draft));
  assert.deepEqual(native, studio);
  assert.equal(native.format, OVERFLIGHT_HUNT_COMPILED_FORMAT);
  assert.ok(Object.isFrozen(native.encounters[0].packs[0].route[0]));
  draft.encounters[0].packs[0].route[0].x += 10;
  assert.notEqual(native.projectIdentity, compileOverflightHuntProject(draft).projectIdentity);
  assert.deepEqual(native.resources, createOverflightProject().resources);
});
test('three finite sets cover shared roster and guarantee six milestone upgrades before the final tank', () => {
  const families = new Set();
  for (const encounterSet of OVERFLIGHT_HUNT_ENCOUNTER_SETS) {
    const project = compileOverflightHuntProject(createOverflightHuntProject({ encounterSet }));
    assert.deepEqual(
      project.encounters.map((e) => e.objectives.length),
      [3, 3, 1],
    );
    assert.deepEqual(
      project.encounters[1].objectives.map((e) => e.armorSegments),
      [1, 1, 2],
    );
    assert.equal(project.encounters[2].objectives[0].armorSegments, 3);
    assert.equal(project.upgrades.choices, 6 + project.upgrades.thresholds.length);
    assert.deepEqual(project.upgrades.thresholds, [10, 35]);
    assert.ok(
      project.encounters.reduce(
        (n, e) => n + e.packs.reduce((s, p) => s + p.count, 0) + e.objectives.length,
        0,
      ) <= project.population.capacity,
    );
    for (const actor of allActors(project)) families.add(actor.family);
  }
  for (const id of [...OVERFLIGHT_SOLDIERS, ...OVERFLIGHT_MACHINERY])
    assert.ok(families.has(id), id);
});
test('Raid rejects impossible objectives, resource drift, route mistakes and executable data', () => {
  for (const mutate of [
    (p) => (p.encounters[0].objectives[0].behavior = 'courier'),
    (p) => (p.encounters[1].objectives[0].armorSegments = 0),
    (p) => (p.encounters[2].objectives[0].family = 'utility-car'),
    (p) => (p.encounters[1].sector = 0),
    (p) => (p.encounters[0].packs[0].route[0].x = 6000),
    (p) => (p.encounters[0].packs[0].route = [{ x: 100, y: 100 }]),
    (p) =>
      (p.encounters[0].packs[0].route = [
        { x: 100, y: 100 },
        { x: 100, y: 100 },
      ]),
    (p) => (p.encounters[0].packs[0].count = 5000),
    (p) => (p.encounters[0].packs[0].speed = 190),
    (p) => (p.encounters[0].packs[0].family = 'unregistered'),
    (p) => (p.encounters[0].packs[0].behavior = 'shield'),
    (p) => (p.encounters[0].packs[0].id = p.encounters[0].objectives[0].id),
    (p) => p.resources.motion.revision++,
    (p) => (p.resources.script = 'arbitrary.js'),
    (p) => (p.upgrades.thresholds = [35, 10]),
    (p) => (p.upgrades.modules = p.upgrades.modules.slice(0, 4)),
    (p) => p.upgrades.modules.push('passive-damage'),
    (p) => (p.population.priorityAttacks = 3),
  ]) {
    const draft = createOverflightHuntProject();
    mutate(draft);
    assert.throws(() => compileOverflightHuntProject(draft));
  }
  const draft = createOverflightHuntProject();
  Object.defineProperty(draft, 'seed', {
    enumerable: true,
    get() {
      throw new Error('executed getter');
    },
  });
  assert.throws(
    () => compileOverflightHuntProject(draft),
    (error) => !error.message.includes('executed getter'),
  );
});
test('formation routes account for every member offset and cannot strand edge actors', () => {
  const project = createOverflightHuntProject(),
    pack = project.encounters[0].packs[0];
  Object.assign(pack, {
    count: 20,
    spacing: 40,
    x: 40,
    y: 200,
    route: [
      { x: 40, y: 200 },
      { x: 100, y: 200 },
    ],
  });
  assert.throws(() => compileOverflightHuntProject(project), /formation reaches beyond/);
});
test('surviving escorts cannot overlap a later sector beyond the visible specialist budget', () => {
  const project = createOverflightHuntProject();
  const next = project.encounters[1].packs.find((p) => p.behavior === 'brace');
  const old = project.encounters[0].packs.find((p) => p.behavior === 'brace');
  next.x = old.x + 100;
  next.y = old.y;
  next.route = structuredClone(old.route);
  assert.throws(() => compileOverflightHuntProject(project), /survivors stay on the map/);
});
test('Raid and Survivor portable formats cannot be silently interchanged', async () => {
  assert.throws(() => validateOverflightHuntProject(createOverflightProject()));
  assert.throws(() => validateOverflightProject(createOverflightHuntProject()));
  const raid = createOverflightHuntPackage(createOverflightHuntProject());
  await assert.rejects(() => importOverflightPackage(exportOverflightHuntPackage(raid)));
  await assert.rejects(() =>
    importOverflightHuntPackage(
      new Blob([JSON.stringify(createOverflightPackage(createOverflightProject()))]),
    ),
  );
});
test('author → preview → export → fresh-profile import → native play preserves definition', async () => {
  const authored = createOverflightHuntProject({ encounterSet: 'crossing', seed: 101 });
  authored.encounters[0].packs[0].route[0] = { x: 770, y: 390 };
  authored.encounters[1].objectives[0].x = 1320;
  authored.upgrades.thresholds = [12, 40];
  const preview = compileOverflightHuntProject(authored);
  const portable = exportOverflightHuntPackage(createOverflightHuntPackage(authored));
  let state = {
    format: 'revealline-overflight-hunt-library.v1',
    packages: {},
    localOwners: {},
    editions: {},
    generation: 0,
  };
  const library = createOverflightHuntLibrary({
    backend: {
      read: async () => structuredClone(state),
      update: async (fn) => (state = fn(structuredClone(state))),
      close() {},
    },
  });
  const imported = await importOverflightHuntPackage(portable),
    identity = await library.install(imported);
  assert.deepEqual(compileOverflightHuntProject((await library.load(identity)).project), preview);
  assert.equal((await library.list())[0].localOwned, true);
  await library.remove(identity);
  assert.deepEqual(await library.list(), []);
  library.dispose();
  const corrupt = structuredClone(imported);
  corrupt.dependencies.effects.revision++;
  await assert.rejects(
    () => importOverflightHuntPackage(new Blob([JSON.stringify(corrupt)])),
    /closure/,
  );
});
