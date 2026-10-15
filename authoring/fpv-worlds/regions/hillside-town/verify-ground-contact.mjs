/** Bind material-only contact footprints to immutable authored wall/floor geometry. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {
  HILLSIDE_CONTACT_FOOTPRINTS,
  createHillsideGroundSurface,
} from '../../../../optional-practice/civilian-fpv/regional/hillside-ground-surface.mjs';
const root = resolve(process.argv[2] ?? new URL('./delivery-town-r2/', import.meta.url).pathname);
const digest = (b) => createHash('sha256').update(b).digest('hex');
const bytes = await readFile(resolve(root, 'scenery/region.json'));
assert.equal(digest(bytes), '0d2f74e20cae601bf79dbcc4a5fa4819aadf4ee14c08eac59d43454848ea358a');
const manifest = JSON.parse(bytes),
  rows = [];
for (const asset of manifest.assets.filter((a) => a.path.endsWith('.json'))) {
  const bytes = await readFile(resolve(root, 'scenery', asset.path));
  assert.equal(bytes.length, asset.bytes);
  assert.equal(digest(bytes), asset.sha256);
  const source = JSON.parse(bytes),
    cell = source.cell ?? source;
  for (const [i, kind] of ['court', 'street'].entries()) {
    const prefix = `terrace-${cell.z}-${cell.x}-${kind}-`;
    const parts = cell.surfaces.filter((s) => s.id.startsWith(prefix) && !s.id.endsWith('-roof'));
    assert.equal(parts.length, 7);
    const min = [Infinity, Infinity, Infinity],
      max = [-Infinity, -Infinity, -Infinity];
    for (const p of parts)
      for (let n = 0; n < p.positionsMm.length; n++) {
        min[n % 3] = Math.min(min[n % 3], p.positionsMm[n]);
        max[n % 3] = Math.max(max[n % 3], p.positionsMm[n]);
      }
    const actual = [
      (min[0] + max[0]) / 2000,
      (min[2] + max[2]) / 2000,
      (max[0] - min[0]) / 2000,
      (max[2] - min[2]) / 2000,
    ];
    assert.deepEqual(actual, HILLSIDE_CONTACT_FOOTPRINTS[i]);
    assert.equal(min[1], cell.z * 12000);
    rows.push({ cell: cell.chunkId, kind, footprint: actual, groundMm: min[1] });
  }
}
assert.equal(rows.length, 18);
const samples = [];
for (const quality of ['performance', 'balanced', 'quality']) {
  const m = createHillsideGroundSurface({ quality, originMm: { x: 0, y: 0, z: 0 } });
  const shader = {
    uniforms: {},
    vertexShader: '#include <common>\n#include <begin_vertex>',
    fragmentShader: '#include <common>\n#include <color_fragment>',
  };
  m.onBeforeCompile(shader);
  assert(!shader.fragmentShader.includes('#include <color_fragment>\ndiffuseColor.rgb *= tint;'));
  assert(shader.fragmentShader.includes('contactBand*groundPlane*horizontal'));
  assert.deepEqual(
    shader.uniforms.hillsideContactA.value.toArray(),
    HILLSIDE_CONTACT_FOOTPRINTS[0],
  );
  const uniforms = shader.uniforms;
  for (const next of ['quality', 'performance', 'balanced'])
    m.userData.setRegionalSurfaceQuality(next);
  assert.equal(shader.uniforms, uniforms);
  assert.equal(m.map, null);
  samples.push({ quality, uniforms: 2, textureAdded: false });
  m.dispose();
}
console.log(
  JSON.stringify(
    {
      passed: true,
      sourceManifestSHA256: digest(bytes),
      footprints: rows,
      tiers: samples,
      scope:
        'Source-derived material-only footprint contract; native appearance and shader compilation remain pending. No geometry/collision/shadow-map changes.',
    },
    null,
    2,
  ),
);
