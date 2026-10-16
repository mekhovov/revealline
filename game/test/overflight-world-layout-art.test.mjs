import test from 'node:test';
import assert from 'node:assert/strict';
import { dataIdentity } from '../data-json.mjs';
import {
  OVERFLIGHT_BATTLEFIELDS,
  createOverflightBattlefield,
} from '../overflight/battlefields.mjs';
import {
  createOverflightWorldPresentation,
  validateOverflightWorldPresentation,
  overflightWorldDefinition,
  applyOverflightWorld,
} from '../overflight/worlds.mjs';
import {
  validateOverflightPresentationCover,
  synchronizeOverflightPresentationCover,
  OVERFLIGHT_WORLD_KITS,
} from '../overflight/world-layout-presentation.mjs';
import { paintOverflightWorld } from '../presentation/overflight-world-art.mjs';
import { drawOverflightWorldModuleImage } from '../presentation/overflight-world-art-v2.mjs';
import {
  OVERFLIGHT_WORLD_ASSEMBLY_SLOTS,
  OVERFLIGHT_WORLD_MATERIAL_SLOTS,
  OVERFLIGHT_WORLD_IMAGE_SLOTS,
  overflightWorldImageSlots,
} from '../presentation/overflight-world-slots.mjs';
import { ASSET_SLOTS } from '../presentation/catalog.mjs';
import { worldAmbienceRecipe } from '../ui/world-ambience.mjs';

const arena = { width: 2880, height: 1080 };
function context() {
  const out = { rectangles: [], images: [], depth: 0 };
  return Object.assign(out, {
    save() {
      this.depth++;
    },
    restore() {
      this.depth--;
    },
    scale() {},
    translate() {},
    beginPath() {},
    rect() {},
    clip() {},
    fillRect(...args) {
      assert.ok(args.every(Number.isFinite));
      this.rectangles.push([this.fillStyle, ...args]);
    },
    drawImage(...args) {
      this.images.push(args);
    },
  });
}
test('18 authored layouts prepare bounded unique worlds with exact permanent-cover identity', () => {
  const signatures = new Set();
  for (const definition of OVERFLIGHT_BATTLEFIELDS) {
    const layout = createOverflightBattlefield(definition.id),
      before = structuredClone(layout),
      source = createOverflightWorldPresentation(definition.world, arena, { layout });
    assert.equal(source.format, 'OverflightWorldPresentationV2');
    validateOverflightWorldPresentation(source, arena);
    validateOverflightPresentationCover(source, layout.terrain);
    assert.deepEqual(layout, before, 'art preparation must not mutate combat definition');
    assert.deepEqual(
      source,
      createOverflightWorldPresentation(definition.world, arena, { layout }),
    );
    assert.ok(JSON.stringify(source).length < 32768);
    for (const obstacle of layout.terrain.obstacles) {
      const visual = source.assemblies.find((item) => item.coverId === obstacle.id);
      assert.equal(
        !!visual,
        !obstacle.breakable,
        'destroyed barriers must not remain baked into ground',
      );
    }
    const ctx = context();
    assert.equal(paintOverflightWorld(ctx, source, arena), true);
    assert.equal(ctx.depth, 0);
    assert.ok(ctx.rectangles.length > 100);
    assert.ok(ctx.rectangles.length < 100000, 'bounded one-time geometry preparation');
    signatures.add(dataIdentity(source));
  }
  assert.equal(signatures.size, 18);
});
test('all six world kits have distinct two-family construction, four props, three ground treatments and quiet ambience', () => {
  const identities = new Set(),
    sounds = new Set();
  for (const [world, kit] of Object.entries(OVERFLIGHT_WORLD_KITS)) {
    assert.ok(overflightWorldDefinition(world));
    assert.equal(new Set(kit.assemblies).size, 2);
    assert.equal(new Set(kit.props).size, 4);
    assert.equal(new Set(kit.materials).size, 3);
    identities.add(kit.assemblies.join(','));
    const audio = worldAmbienceRecipe(world);
    assert.ok(audio.tone.gain <= 0.009);
    sounds.add(JSON.stringify(audio));
  }
  assert.equal(identities.size, 6);
  assert.equal(sounds.size, 6);
  assert.deepEqual(
    Object.keys(OVERFLIGHT_WORLD_MATERIAL_SLOTS).sort(),
    ['earth', 'concrete', 'damaged', 'timber', 'masonry', 'metal'].sort(),
  );
  assert.ok(ASSET_SLOTS.length <= 512, 'new artwork stays inside existing global admission cap');
  assert.equal(new Set(OVERFLIGHT_WORLD_IMAGE_SLOTS).size, OVERFLIGHT_WORLD_IMAGE_SLOTS.length);
  for (const family of Object.values(OVERFLIGHT_WORLD_ASSEMBLY_SLOTS))
    for (const slot of Object.values(family))
      assert.ok(ASSET_SLOTS.some((entry) => entry.id === slot && !entry.required));
});
test('V2 interior assemblies cannot imply collision unrelated to authored cover', () => {
  const layout = createOverflightBattlefield('freight-depot-loading-loop'),
    source = createOverflightWorldPresentation(layout.world, arena, { layout }),
    item = source.assemblies.find((item) => item.coverId);
  item.x += 1;
  assert.throws(() => validateOverflightPresentationCover(source, layout.terrain), /footprint/);
  item.coverId = null;
  assert.throws(() => validateOverflightWorldPresentation(source, arena), /perimeter/);
});
test('native module images honor crop, pivot and occupied bounds without building-sized stretching', () => {
  const ctx = context(),
    image = { id: 'custom' };
  drawOverflightWorldModuleImage(
    ctx,
    {
      image,
      geometry: {
        frame: { x: 8, y: 16, width: 32, height: 32 },
        pivot: { x: 0.25, y: 0.75 },
        occupiedBounds: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
      },
    },
    100,
    200,
    32,
  );
  assert.deepEqual(ctx.images[0], [image, 16, 24, 16, 16, 100, 184, 16, 16]);
  const layout = createOverflightBattlefield('freight-depot-loading-loop'),
    source = createOverflightWorldPresentation(layout.world, arena, { layout });
  paintOverflightWorld(ctx, source, arena, {
    image: (slot) => (slot.startsWith('world.overflight.module.') ? { image } : null),
  });
  assert.ok(ctx.images.length > 50, 'large landmark is assembled from repeated modules');
  assert.ok(ctx.images.every((args) => args[7] <= 32 && args[8] <= 32));
});
test('V4 world application retains authored movement deck; legacy presentation remains V1', () => {
  const layout = createOverflightBattlefield('freight-depot-loading-loop');
  const project = {
    format: 'OverflightProjectV4',
    arena,
    battlefield: layout,
    encounters: [{ pattern: 'flank', movement: { preset: 'committed-flank' } }],
  };
  const applied = applyOverflightWorld(project, 'freight-depot');
  assert.deepEqual(applied.encounters, project.encounters);
  assert.equal(applied.encounterProfile, 'freight-depot.v2');
  assert.equal(
    createOverflightWorldPresentation('freight-depot', arena).format,
    'OverflightWorldPresentationV1',
  );
});
test('V2 path and artwork input bounds reject oversized or unknown sources', () => {
  const layout = createOverflightBattlefield('field-crossing-broken-crossroads');
  const create = () => createOverflightWorldPresentation(layout.world, arena, { layout });
  const invalid = create();
  invalid.paths[0].points[0].x = 4000;
  assert.throws(() => validateOverflightWorldPresentation(invalid, arena), /fit/);
  const unknown = create();
  unknown.regions[0].material = 'lava';
  assert.throws(() => validateOverflightWorldPresentation(unknown, arena), /material/);
  const long = create();
  long.assemblies = Array.from({ length: 25 }, (_, i) => ({
    ...long.assemblies[0],
    id: `extra-${i}`,
  }));
  assert.throws(() => validateOverflightWorldPresentation(long, arena), /budget/);
});

test('cosmetic world selection preserves topology and synchronizing cover preserves custom art', () => {
  const layout = createOverflightBattlefield('freight-depot-dispatch-junction'),
    source = createOverflightWorldPresentation('orchard-strongpoint', arena, { layout });
  validateOverflightWorldPresentation(source, arena);
  validateOverflightPresentationCover(source, layout.terrain);
  assert.equal(source.world, 'orchard-strongpoint');
  assert.deepEqual(
    source.paths.map((path) => path.points),
    layout.routes.map((route) => route.points),
  );
  const cover = source.assemblies.find((item) => item.coverId),
    terrain = structuredClone(layout.terrain);
  cover.family = 'receiver';
  source.regions[0].material = 'metal';
  terrain.obstacles.find((item) => item.id === cover.coverId).width += 12;
  const removed = terrain.obstacles.find((item) => !item.breakable && item.id !== cover.coverId);
  terrain.obstacles = terrain.obstacles.filter((item) => item.id !== removed.id);
  const before = structuredClone(source),
    next = synchronizeOverflightPresentationCover(source, terrain);
  assert.deepEqual(source, before, 'input document remains intact');
  assert.deepEqual(next.regions, source.regions);
  assert.deepEqual(next.paths, source.paths);
  assert.deepEqual(next.landmarks, source.landmarks);
  assert.equal(next.assemblies.find((item) => item.coverId === cover.coverId).family, 'receiver');
  assert.ok(!next.assemblies.some((item) => item.coverId === removed.id));
  validateOverflightPresentationCover(next, terrain);
  const slots = overflightWorldImageSlots(next);
  assert.ok(slots.includes('world.overflight.material.metal'));
  assert.ok(slots.includes('world.overflight.module.receiver-panel'));
  assert.ok(slots.includes('world.overflight.prop.road'));
  assert.ok(!slots.includes('world.overflight.module.floodgate-panel'));
  assert.ok(slots.length < OVERFLIGHT_WORLD_IMAGE_SLOTS.length);
});

test('host-cropped world frames and original Studio atlases draw the same authored pixels', () => {
  const geometry = {
      frame: { x: 16, y: 32, width: 32, height: 32 },
      pivot: { x: 0.5, y: 0.5 },
      occupiedBounds: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
    },
    atlas = { width: 64, height: 96 },
    cropped = { width: 32, height: 32 },
    ctx = context();
  drawOverflightWorldModuleImage(ctx, { image: atlas, geometry }, 100, 100);
  drawOverflightWorldModuleImage(ctx, { image: cropped, geometry }, 100, 100);
  assert.deepEqual(ctx.images[0].slice(1, 5), [24, 40, 16, 16]);
  assert.deepEqual(ctx.images[1].slice(1, 5), [8, 8, 16, 16]);
  assert.deepEqual(ctx.images[0].slice(5), ctx.images[1].slice(5));
  for (const layout of [null, createOverflightBattlefield('field-crossing-broken-crossroads')]) {
    const source = createOverflightWorldPresentation('field-crossing', arena, { layout }),
      output = context();
    paintOverflightWorld(output, source, arena, { image: () => ({ image: cropped, geometry }) });
    assert.ok(output.images.length > 0);
    for (const args of output.images) {
      assert.ok(args[1] >= 0 && args[2] >= 0);
      assert.ok(
        args[1] + args[3] <= 32 && args[2] + args[4] <= 32,
        'source rectangle stays inside cropped bitmap',
      );
    }
  }
});
