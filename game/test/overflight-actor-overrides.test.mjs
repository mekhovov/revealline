import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareOverflightActorOverrides } from '../overflight/actor-overrides.mjs';
import {
  INDUSTRIAL_BUILTIN_MACHINERY_GEOMETRY,
  INDUSTRIAL_BUILTIN_SPRITES,
} from '../presentation/industrial-arcade-builtins.mjs';
import { createArcadeAdapter, getArcadeCollection } from '../presentation/industrial-arcade.mjs';
import { OVERFLIGHT_MACHINERY_ALIASES } from '../presentation/overflight-actor-slots.mjs';
import { imagePresentation } from '../presentation/runtime.mjs';

const manifest = JSON.parse(
  readFileSync(new URL('../presentation/compiled/runtime.json', import.meta.url)),
);
function fixture(slot, change) {
  const asset = structuredClone(manifest.resolved.assets[slot]);
  change?.(asset.geometry);
  if (change) asset.revision++;
  const source = {
    asset,
    image: { width: asset.geometry.frame.width, height: asset.geometry.frame.height },
    geometry: imagePresentation(asset),
  };
  return { source, snapshot: { image: (id) => (id === slot ? source : null) } };
}

// Keep the small code-owned comparison in sync with the published original;
// an asset revision number alone must never decide whether artwork was edited.
test('machinery alias geometry matches the published stock rasters', () => {
  for (const slot of Object.values(OVERFLIGHT_MACHINERY_ALIASES)) {
    const asset = manifest.resolved.assets[slot];
    assert.ok(INDUSTRIAL_BUILTIN_SPRITES[slot].includes(asset.file.sha256));
    assert.deepEqual(INDUSTRIAL_BUILTIN_MACHINERY_GEOMETRY[slot], asset.geometry);
  }
});

test('untouched aliases retain native machinery despite adapted paint bounds', () => {
  for (const slot of Object.values(OVERFLIGHT_MACHINERY_ALIASES)) {
    const { source, snapshot } = fixture(slot);
    const canvases = [];
    const adapter = createArcadeAdapter({
      canvasFactory: () => {
        const canvas = {
          getContext: () => ({
            drawImage() {},
            getImageData: () => ({
              data: new Uint8ClampedArray(source.image.width * source.image.height * 4),
            }),
            putImageData() {},
          }),
        };
        canvases.push(canvas);
        return canvas;
      },
    });
    try {
      const adapted = adapter.resolve(snapshot, getArcadeCollection('military-field'));
      assert.notEqual(adapted.image(slot).image, source.image);
      assert.deepEqual(prepareOverflightActorOverrides(adapted).summary, []);
      assert.equal(canvases.length, 1);
    } finally {
      adapter.clear();
    }
    assert.ok(canvases.every((canvas) => canvas.width === 0 && canvas.height === 0));
  }
});

for (const [name, change] of Object.entries({
  pivot: (geometry) => {
    geometry.pivot.x = 0.3;
  },
  crop: (geometry) => {
    geometry.frame.x = 1;
    geometry.frame.width -= 2;
  },
  'occupied bounds': (geometry) => {
    geometry.occupiedBounds.width -= 1 / 32;
  },
})) {
  test(`same-raster machinery ${name} edits survive the adapter and native preparation`, () => {
    for (const [family, slot] of Object.entries(OVERFLIGHT_MACHINERY_ALIASES)) {
      const { source, snapshot } = fixture(slot, change);
      const adapter = createArcadeAdapter({
        canvasFactory: () => assert.fail('Authored geometry must not allocate recolored art'),
      });
      try {
        const adapted = adapter.resolve(snapshot, getArcadeCollection('military-field'));
        assert.equal(adapted.image(slot), source);
        const prepared = prepareOverflightActorOverrides(adapted);
        assert.equal(prepared.has(family), true);
        assert.equal(prepared.entries[0].override.source, source);
        assert.deepEqual(
          prepared.entries[0].override.source.geometry,
          imagePresentation(source.asset),
        );
        assert.equal(prepared.summary[0].sha256, manifest.resolved.assets[slot].file.sha256);
        assert.equal(prepared.summary[0].revision, source.asset.revision);
        assert.deepEqual(prepareOverflightActorOverrides(adapted).summary, prepared.summary);
      } finally {
        adapter.clear();
      }
    }
  });
}
