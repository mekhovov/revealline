/** Derived pilot-height materials; original r4 collision vertices/indices remain exact. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {
  compileScenerySource,
  validateScenerySource,
  scenerySourceResources,
} from '../../indexed-scenery-cell.mjs';
const [baseline, output] = process.argv.slice(2);
assert(baseline && output, 'Provide preserved r4 input and a new output directory');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (value) => Buffer.from(JSON.stringify(value) + '\n');
const before = JSON.parse(await readFile(resolve(baseline, 'preparation.json')));
assert.equal(
  before.sceneryManifestSHA256,
  'e1d00292e1e98b9e99d325b398ec6ac7d07b2fcad73dc78417b305938c99e4b9',
);
const manifests = {},
  sourceRows = [],
  updated = [],
  unchangedSamples = [];
await mkdir(output, { recursive: false });
for (const kind of ['terrain', 'scenery']) {
  await mkdir(resolve(output, kind));
  const originalBytes = await readFile(resolve(baseline, kind, 'region.json'));
  assert.equal(hash(originalBytes), before[kind + 'ManifestSHA256']);
  const original = JSON.parse(originalBytes),
    manifest = structuredClone(original);
  manifest.revision = 'courtyard-r5';
  manifest.title = {
    en: 'Hillside Town — civic court materials',
    uk: 'Містечко на схилі — матеріали міського подвір’я',
  };
  const bytes = new Map();
  for (const item of original.assets) {
    const body = await readFile(resolve(baseline, kind, item.path));
    assert.equal(body.length, item.bytes);
    assert.equal(hash(body), item.sha256);
    bytes.set(item.path, body);
  }
  if (kind === 'scenery') {
    for (const asset of original.assets.filter((a) => a.kind === 'collision')) {
      const source = JSON.parse(bytes.get(asset.path)),
        cell = source.cell;
      assert.equal(source.format, 'FPVRegionIndexedScenery.v1');
      const oldGeometry = hash(
        json(cell.surfaces.map(({ id, positionsMm, indices }) => ({ id, positionsMm, indices }))),
      );
      const texture = source.textures[0],
        originalPixels = Buffer.from(texture.indicesBase64, 'base64'),
        pixels = Buffer.from(originalPixels);
      assert.equal(texture.width, 512);
      assert.equal(texture.height, 512);
      const originalPalette = [...texture.paletteRgb],
        protectedIndices = new Set();
      for (let y = 0; y < 512; y++)
        for (let x = 128; x < 416; x++)
          if (y < 144 || y >= 376) protectedIndices.add(originalPixels[y * 512 + x]);
      const available = Array.from({ length: 256 }, (_, i) => i).filter(
        (i) => !protectedIndices.has(i),
      );
      const authoredColors = new Map();
      const colorIndex = (rgb) => {
        const value = rgb.map((n) => Math.round(n / 4) * 4),
          key = value.join(',');
        if (!authoredColors.has(key)) {
          const index = available[authoredColors.size];
          assert(index !== undefined, 'Authored palette exceeds unused entries');
          texture.paletteRgb.splice(index * 3, 3, ...value);
          authoredColors.set(key, index);
        }
        return authoredColors.get(key);
      };
      // All licensed UVs use v=.775–.975. Reserve the unused middle strip,
      // leaving both possible vertical image conventions and a generous border untouched.
      const tiles = [
        [203, 193, 166],
        [160, 172, 152],
        [164, 96, 65],
        [114, 77, 46],
      ];
      for (let tile = 0; tile < tiles.length; tile++)
        for (let y = 0; y < 120; y++)
          for (let x = 0; x < 120; x++) {
            let rgb = tiles[tile],
              shade = 1;
            const noise = (((x * 13 + y * 19 + x * y * 3) % 11) - 5) / 500;
            if (tile < 2) {
              // Grounded stone plinth, restrained limewash grain, quiet upper timber band.
              if (y < 23) {
                const joint = y % 11 < 1 || (x + (Math.floor(y / 11) % 2) * 10) % 20 < 1;
                rgb = joint ? [104, 101, 88] : [155, 151, 130];
              } else if (y > 108 && y < 114) rgb = [106, 80, 52];
              shade += noise;
            } else if (tile === 2) {
              const joint = y % 15 < 2 || (x + (Math.floor(y / 15) % 2) * 10) % 20 < 1;
              shade = joint ? 0.73 : 1 + (y % 15) / 130 + noise;
            } else {
              shade = x % 15 < 1 ? 0.73 : 1 + noise + Math.sin(y * 0.3 + x) * 0.035;
            }
            pixels[(144 + y) * 512 + tile * 128 + 4 + x] = colorIndex(
              rgb.map((v) => Math.max(0, Math.min(255, Math.round(v * shade)))),
            );
          }
      // Existing kit samples outside the revised court keep identical level-zero texels.
      for (const binding of source.bindings)
        for (let i = 0; i < binding.uvs.length; i += 2) {
          const u = binding.uvs[i],
            v = binding.uvs[i + 1];
          assert(v >= 0.77 && v <= 0.98);
          for (const row of [Math.floor(v * 512), Math.floor((1 - v) * 512)]) {
            const at = Math.min(511, row) * 512 + Math.min(511, Math.floor(u * 512));
            assert.deepEqual(
              texture.paletteRgb.slice(pixels[at] * 3, pixels[at] * 3 + 3),
              originalPalette.slice(originalPixels[at] * 3, originalPixels[at] * 3 + 3),
            );
          }
        }
      texture.indicesBase64 = pixels.toString('base64');
      for (const binding of source.bindings) {
        const civic = binding.surfaceId.startsWith('terrace-1-1-court-'),
          market = binding.surfaceId.startsWith('terrace-1-1-street-');
        if ((!civic && !market) || binding.surfaceId.endsWith('-floor')) continue;
        const surface = cell.surfaces.find((s) => s.id === binding.surfaceId),
          p = surface.positionsMm,
          n = binding.normals;
        const lo = [0, 1, 2].map((k) => Math.min(...p.filter((_, i) => i % 3 === k))),
          hi = [0, 1, 2].map((k) => Math.max(...p.filter((_, i) => i % 3 === k)));
        const roof = binding.surfaceId.endsWith('-roof'),
          tile = roof ? (civic ? 2 : 3) : civic ? 0 : 1;
        const uv = [...binding.uvs];
        for (let i = 0; i < p.length; i += 3) {
          if (roof && n[i + 1] < 0.9) continue;
          const horizontal = roof ? 0 : Math.abs(n[i]) > Math.abs(n[i + 2]) ? 2 : 0,
            vertical = roof ? 2 : 1;
          const unit = (axis) =>
            hi[axis] === lo[axis] ? 0.5 : (p[i + axis] - lo[axis]) / (hi[axis] - lo[axis]);
          uv[(i / 3) * 2] = (tile * 128 + 4.5 + unit(horizontal) * 119) / 512;
          uv[(i / 3) * 2 + 1] = (144.5 + unit(vertical) * 119) / 512;
        }
        binding.uvs = uv;
        updated.push(binding.surfaceId);
      }
      const afterGeometry = hash(
        json(cell.surfaces.map(({ id, positionsMm, indices }) => ({ id, positionsMm, indices }))),
      );
      assert.equal(afterGeometry, oldGeometry);
      const checked = validateScenerySource(source),
        compiled = compileScenerySource(checked);
      sourceRows.push(checked);
      unchangedSamples.push({ chunk: cell.chunkId, collisionGeometrySHA256: oldGeometry });
      bytes.set(asset.path, json(source));
      const chunk = original.chunks.find((c) => c.assets.includes(asset.id));
      const scene = original.assets.find((a) => a.kind === 'scene' && chunk.assets.includes(a.id));
      bytes.set(scene.path, compiled.glb);
    }
  }
  for (const item of manifest.assets) {
    const body = bytes.get(item.path);
    item.bytes = body.length;
    item.sha256 = hash(body);
    await writeFile(resolve(output, kind, item.path), body);
  }
  manifests[kind] = manifest;
  await writeFile(resolve(output, kind, 'region.json'), json(manifest));
}
assert.equal(updated.length, 14);
const resources = scenerySourceResources(sourceRows);
assert.equal(resources.geometryBytes, before.geometryBytes);
assert.equal(resources.textureBytes, before.textureBytes);
assert.equal(resources.resourceBytes, before.resourceBytes);
for (const file of ['License.txt', 'source-provenance.json'])
  await writeFile(resolve(output, file), await readFile(resolve(baseline, file)));
const receipt = {
  ...before,
  sourceBytes: Object.values(manifests)
    .flatMap((m) => m.assets)
    .reduce((n, a) => n + a.bytes, 0),
  terrainManifestSHA256: hash(json(manifests.terrain)),
  sceneryManifestSHA256: hash(json(manifests.scenery)),
  materialRevision: 'courtyard-r5',
  materialSurfaces: updated,
  sharedTextures: resources.textures.size,
  collisionGeometry: unchangedSamples,
  sourceReady: false,
  note: 'All original licensed UV texels and a broad gutter retain exact RGB; unused palette entries and middle-strip texels carry original derived material patterns on 14 court surfaces. Distant mip appearance is subject to native review, not guaranteed unchanged.',
};
assert(receipt.sourceBytes < 64 * 1024 * 1024);
assert(receipt.retainedAndCandidateBytes < 8 * 1024 * 1024);
await writeFile(resolve(output, 'preparation.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
