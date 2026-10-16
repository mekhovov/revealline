import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INDUSTRIAL_MATERIAL_REVISION,
  INDUSTRIAL_MATERIALS,
  industrialMaterialPixels,
  drawIndustrialMaterialSpecimen,
} from '../presentation/industrial-materials.mjs';
import { militaryFieldPixels } from '../presentation/military-field-art.mjs';
import { createArcadeAdapter, getArcadeCollection } from '../presentation/industrial-arcade.mjs';
import { INDUSTRIAL_BUILTIN_SPRITES } from '../presentation/industrial-arcade-builtins.mjs';
import { drawClassicTerrain } from '../ui/classic-view.mjs';
import { prepareCoopMaterialSample } from '../couch/coop-terrain-trail.mjs';
import { createWorkshopTexture } from '../../optional-practice/civilian-fpv/world-visuals.mjs';

test('shared material sources stay opaque at compact and detailed sizes without changing released tiles', () => {
  for (const size of [16, 32, 128]) {
    const samples = INDUSTRIAL_MATERIALS.map((material) =>
      industrialMaterialPixels({ width: size, height: size }, material),
    );
    assert.equal(new Set(samples.map(({ rgba }) => Buffer.from(rgba).toString('base64'))).size, 3);
    for (const sample of samples)
      for (let at = 3; at < sample.rgba.length; at += 4)
        assert.equal(sample.rgba[at], 255, 'Decoration must not reveal a concealed photograph.');
  }
  const size = { width: 16, height: 16 };
  assert.deepEqual(
    militaryFieldPixels(size, 'terrain.wall', { revision: 'unknown' }),
    militaryFieldPixels(size, 'terrain.wall'),
  );
  assert.notDeepEqual(
    militaryFieldPixels(size, 'terrain.wall', { revision: INDUSTRIAL_MATERIAL_REVISION }),
    militaryFieldPixels(size, 'terrain.wall'),
  );
  for (const width of [0, 15, 129, Infinity, 16.5])
    assert.throws(() => industrialMaterialPixels({ width, height: 16 }, 'earth'));
});

function artFixture(slot, sha256 = INDUSTRIAL_BUILTIN_SPRITES[slot][0]) {
  return {
    image: { width: 16, height: 16 },
    asset: { id: `${slot}.field-kit`, file: { width: 16, height: 16, sha256 } },
    geometry: { pivot: { x: 0.5, y: 0.5 } },
  };
}
function factory() {
  const canvases = [];
  return {
    canvases,
    canvasFactory() {
      const canvas = {
        getContext() {
          return {
            drawImage() {},
            getImageData: () => ({ data: new Uint8ClampedArray(16 * 16 * 4) }),
            putImageData(value) {
              canvas.pixels = new Uint8ClampedArray(value.data);
            },
          };
        },
      };
      canvases.push(canvas);
      return canvas;
    },
  };
}
test('Capture and creator adapters replace only verified built-in material frames; Team receives only opted-in surfaces', () => {
  const owner = factory(),
    frames = {
      'terrain.wall': artFixture('terrain.wall'),
      'terrain.slow': artFixture('terrain.slow'),
      'terrain.lethal': artFixture('terrain.lethal', 'company-custom-art'),
    },
    base = { image: (slot) => frames[slot] },
    collection = getArcadeCollection('military-field', 'r1');
  const adapter = createArcadeAdapter({ ...owner, reviewRevision: INDUSTRIAL_MATERIAL_REVISION }),
    sample = adapter.resolve(base, collection);
  assert.equal(
    sample.image('terrain.lethal'),
    frames['terrain.lethal'],
    'Company/custom artwork has priority.',
  );
  assert.deepEqual(
    sample.image('terrain.wall').image.pixels,
    industrialMaterialPixels({ width: 16, height: 16 }, 'concrete').rgba,
  );
  const team = prepareCoopMaterialSample(sample);
  assert.equal(team[1], sample.image('terrain.slow'));
  assert.equal(team[2], null, 'Custom art cannot become a sample through its slot name.');
  const released = createArcadeAdapter({ ...factory(), reviewRevision: null });
  assert.equal(prepareCoopMaterialSample(released.resolve(base, collection))[1], null);
  adapter.clear();
  assert.ok(owner.canvases.every((canvas) => canvas.width === 0 && canvas.height === 0));
  assert.equal(frames['terrain.wall'].image.width, 16, 'The shared original stays alive.');
  released.clear();
});

test('functional slow and lethal markers are painted after decorative material images', () => {
  const calls = [],
    ctx = {};
  for (const name of [
    'save',
    'restore',
    'drawImage',
    'beginPath',
    'moveTo',
    'lineTo',
    'stroke',
    'strokeRect',
  ])
    ctx[name] = (...args) => calls.push([name, ...args]);
  for (const kind of ['slow', 'lethal']) {
    calls.length = 0;
    drawClassicTerrain(
      ctx,
      { terrain: [{ x: 2, y: 3, kind }] },
      { safe: '#ffffff', danger: '#ff0000' },
      { slowTerrain: {}, lethalTerrain: {} },
    );
    const image = calls.findIndex(([name]) => name === 'drawImage'),
      marker = calls.findIndex(([name]) => name === 'stroke');
    assert.ok(image >= 0 && marker > image);
    assert.deepEqual(
      calls[image].slice(2),
      [32, 48, 16, 16],
      'The original cell footprint stays exact.',
    );
  }
});

test('native SIM uses the same material source only for selected Military Field roles and keeps authored maps unchanged', () => {
  for (const [role, material] of [
    ['concrete', 'concrete'],
    ['grass', 'earth'],
    ['steel', 'metal'],
  ]) {
    const sample = createWorkshopTexture(role, {
      collectionId: 'military-field',
      reviewRevision: INDUSTRIAL_MATERIAL_REVISION,
    });
    assert.deepEqual(
      [...sample.image.data],
      [...industrialMaterialPixels({ width: 128, height: 128 }, material).rgba],
    );
    assert.equal(
      sample.userData.materialRole,
      role,
      'Native material/collision semantics are unchanged.',
    );
    const released = createWorkshopTexture(role, {
      collectionId: 'military-field',
      reviewRevision: null,
    });
    assert.notDeepEqual(sample.image.data, released.image.data);
    const other = createWorkshopTexture(role, {
        collectionId: 'industrial-workshop',
        reviewRevision: INDUSTRIAL_MATERIAL_REVISION,
      }),
      otherReleased = createWorkshopTexture(role, {
        collectionId: 'industrial-workshop',
        reviewRevision: null,
      });
    assert.deepEqual(other.image.data, otherReleased.image.data);
    for (const texture of [sample, released, other, otherReleased]) texture.dispose();
  }
});

test('creator specimen restores caller state and has no external canvas allocation', () => {
  const state = [],
    ctx = {
      globalAlpha: 0.25,
      fillStyle: '#000000',
      save() {
        state.push([this.globalAlpha, this.fillStyle]);
      },
      restore() {
        [this.globalAlpha, this.fillStyle] = state.pop();
      },
      fillRect() {
        assert.equal(this.globalAlpha, 1);
      },
    };
  drawIndustrialMaterialSpecimen(ctx, { material: 'metal', width: 48, height: 48 });
  assert.equal(ctx.globalAlpha, 0.25);
  assert.equal(ctx.fillStyle, '#000000');
});
