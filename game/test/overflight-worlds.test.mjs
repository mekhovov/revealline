import test from 'node:test';
import assert from 'node:assert/strict';
import { dataIdentity } from '../data-json.mjs';
import {
  OVERFLIGHT_WORLDS,
  createOverflightWorldPresentation,
  applyOverflightWorld,
  validateOverflightWorldPresentation,
  createExperimentalOverflightWorldProject,
} from '../overflight/worlds.mjs';
import { overflightTerrainClear } from '../overflight/terrain.mjs';
import { createOverflightProject, compileOverflightProject } from '../overflight/project.mjs';
import {
  createOverflightRiyProject,
  compileOverflightRiyProject,
} from '../overflight/riy-project.mjs';
import {
  createOverflightHuntProject,
  compileOverflightHuntProject,
} from '../overflight/raid-project.mjs';
import { createOverflightPackage, validateOverflightPackage } from '../overflight/community.mjs';
import {
  createOverflightRiyPackage,
  validateOverflightRiyPackage,
} from '../overflight/riy-community.mjs';
import {
  createOverflightHuntPackage,
  validateOverflightHuntPackage,
} from '../overflight/raid-community.mjs';
import { paintOverflightWorld } from '../presentation/overflight-world-art.mjs';
import { OVERFLIGHT_WORLD_IMAGE_SLOTS } from '../presentation/overflight-world-slots.mjs';
import { ASSET_SLOTS, createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { adoptStudioBundle } from '../presentation/studio-session.mjs';

const modes = [
  [
    createOverflightProject,
    compileOverflightProject,
    createOverflightPackage,
    validateOverflightPackage,
  ],
  [
    createOverflightRiyProject,
    compileOverflightRiyProject,
    createOverflightRiyPackage,
    validateOverflightRiyPackage,
  ],
  [
    createOverflightHuntProject,
    compileOverflightHuntProject,
    createOverflightHuntPackage,
    validateOverflightHuntPackage,
  ],
];
test('all worlds compile, preserve exact dependency closure, and import through every native mode', () => {
  for (const { id: world } of OVERFLIGHT_WORLDS)
    for (const difficulty of ['relaxed', 'standard', 'veteran'])
      for (const [create, compile, pack, validate] of modes) {
        const project = create({ rulesVersion: 3, difficulty, world });
        const compiled = compile(project);
        assert.equal(compiled.presentation.world, world);
        assert.equal(compiled.encounterProfile, `${world}.v1`);
        const exported = JSON.parse(JSON.stringify(pack(project)));
        assert.equal(compile(validate(exported).project).projectIdentity, compiled.projectIdentity);
        assert.equal(exported.dependencies.world.id, 'overflight-worlds');
        delete exported.dependencies.world;
        assert.throws(() => validate(exported), /dependency closure/);
      }
});
test('cosmetic edits preserve records while authored encounters receive distinct identities', () => {
  for (const [create, compile] of modes) {
    const original = create({ rulesVersion: 3 });
    assert.equal(compile(original).projectIdentity, dataIdentity(original));
    const decorated = applyOverflightWorld(original, 'field-crossing', { encounters: false });
    assert.equal(compile(decorated).projectIdentity, compile(original).projectIdentity);
    decorated.presentation = createOverflightWorldPresentation('relay-ruins', decorated.arena);
    assert.equal(compile(decorated).projectIdentity, compile(original).projectIdentity);
    assert.notEqual(compile(decorated).visualIdentity, compile(original).visualIdentity);
    const authored = applyOverflightWorld(original, 'relay-ruins');
    assert.notEqual(compile(authored).projectIdentity, compile(original).projectIdentity);
  }
});
test('legacy authored projects remain unchanged and reject unsupported presentation capability', () => {
  for (const [create, compile] of modes) {
    const project = create();
    assert.equal(compile(project).projectIdentity, dataIdentity(project));
    project.presentation = createOverflightWorldPresentation('field-crossing', project.arena);
    assert.throws(() => compile(project), /current rules/);
  }
});
test('open arena validation rejects tall interior props and invalid resource revisions', () => {
  const arena = { width: 2880, height: 1080 };
  const source = createOverflightWorldPresentation('field-crossing', arena);
  source.landmarks.find((item) => item.kind === 'tree').y = 500;
  assert.throws(() => validateOverflightWorldPresentation(source, arena), /perimeter/);
  source.landmarks.find((item) => item.kind === 'tree').y = 16;
  source.resource.revision = 2;
  assert.throws(() => validateOverflightWorldPresentation(source, arena), /resource/);
});
test('every authored world fits supported arena sizes and paints through shared native primitives', () => {
  for (const arena of [
    { width: 960, height: 540 },
    { width: 2880, height: 1080 },
    { width: 5760, height: 2160 },
  ])
    for (const { id } of OVERFLIGHT_WORLDS) {
      const presentation = createOverflightWorldPresentation(id, arena);
      validateOverflightWorldPresentation(presentation, arena);
      let rectangles = 0,
        saves = 0;
      const ctx = {
        save: () => saves++,
        restore: () => saves--,
        scale() {},
        fillRect: () => rectangles++,
      };
      assert.equal(paintOverflightWorld(ctx, presentation, arena), true);
      assert.ok(rectangles > 100);
      assert.equal(saves, 0);
    }
});

test('world pacing preserves opening choices and only reduces the late collection thresholds', () => {
  const original = createOverflightProject({ rulesVersion: 3 });
  for (const { id: world } of OVERFLIGHT_WORLDS) {
    const authored = applyOverflightWorld(original, world);
    assert.deepEqual(
      authored.upgrades.thresholds.slice(0, 6),
      original.upgrades.thresholds.slice(0, 6),
    );
    assert.equal(authored.upgrades.thresholds.length, original.upgrades.thresholds.length);
    assert.ok(
      authored.upgrades.thresholds
        .slice(6)
        .every((threshold, index) => threshold < original.upgrades.thresholds[index + 6]),
    );
  }
});

test('experimental Raid authoring places objectives and route markers outside solid cover', () => {
  const source = createExperimentalOverflightWorldProject(createOverflightHuntProject);
  compileOverflightHuntProject(source);
  for (const encounter of source.encounters) {
    for (const point of [
      encounter.entry,
      ...encounter.objectives,
      ...encounter.packs,
      ...[...encounter.objectives, ...encounter.packs].flatMap((actor) => actor.route),
    ])
      assert.ok(overflightTerrainClear(source.terrain, point.x, point.y, point.x, point.y, 28));
  }
});

test('experimental authoring rejects unreachable supply cases and reward spots in every mode', () => {
  for (const [create, compile] of modes) {
    const original = createExperimentalOverflightWorldProject(create);
    assert.doesNotThrow(() => compile(original));
    for (const [x, y] of [
      [350, 240], // The supply case itself is inside permanent cover.
      [455, 240], // Clear case, but the repair reward at x=411 is covered.
      [482, 240], // Reward is outside cover, but lacks the drone's nine-unit clearance.
    ]) {
      const project = structuredClone(original);
      Object.assign(project.props[0], { x, y });
      assert.throws(() => compile(project), /Supply case .* every reward need drone clearance/);
    }
  }
});

test('world packages reject extra or altered dependency references as well as missing ones', () => {
  for (const [create, , pack, validate] of modes) {
    const project = create({ rulesVersion: 3, world: 'freight-depot' });
    for (const change of [
      (dependencies) => {
        dependencies.world.revision++;
      },
      (dependencies) => {
        dependencies.world.id = 'relay-ruins';
      },
      (dependencies) => {
        dependencies.unused = { id: 'overflight-worlds', revision: 1 };
      },
    ]) {
      const exported = pack(project);
      change(exported.dependencies);
      assert.throws(() => validate(exported), /dependency closure/);
    }
  }
});

test('decorative artwork slots admit exact optional contracts and feed the shared native painter', () => {
  const current = createDefaultThemeBundle(),
    old = structuredClone(current);
  old.slots = old.slots.filter((slot) => !OVERFLIGHT_WORLD_IMAGE_SLOTS.includes(slot.id));
  for (const theme of old.themes)
    for (const id of OVERFLIGHT_WORLD_IMAGE_SLOTS) delete theme.bindings[id];
  const before = structuredClone(old),
    adopted = adoptStudioBundle(old, current);
  assert.deepEqual(old, before);
  for (const id of OVERFLIGHT_WORLD_IMAGE_SLOTS) {
    const slot = ASSET_SLOTS.find((slot) => slot.id === id);
    assert.equal(slot.required, false);
    assert.deepEqual(slot.dimensions, { width: 32, height: 32 });
    assert.ok(adopted.slots.some((slot) => slot.id === id));
  }
  const image = { width: 32, height: 32 },
    draws = [];
  const ctx = {
    save() {},
    restore() {},
    scale() {},
    fillRect() {},
    drawImage(...args) {
      draws.push(args);
    },
  };
  const arena = { width: 2880, height: 1080 };
  const source = createOverflightWorldPresentation('field-crossing', arena);
  const identity = dataIdentity(source);
  paintOverflightWorld(ctx, source, arena, {
    image: (slot) =>
      slot === 'world.overflight.material.earth' || slot === 'world.overflight.prop.tree'
        ? { image }
        : null,
  });
  assert.ok(draws.length > 100);
  assert.ok(draws.every((args) => args[0] === image));
  assert.equal(dataIdentity(source), identity);
});
