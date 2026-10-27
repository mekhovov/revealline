import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  REGIONAL_LIBRARY_PINS,
  applyRegionalAppearance,
} from '../../../optional-practice/civilian-fpv/regional-library.mjs';

/** Uses the exact, locally shipped immutable Regional sources. Geometry admission
 * still verifies every requested scene and collision payload; no simplified floor
 * or replacement spawn is supplied by this test fixture. */
export async function realRegionalGeometry(id) {
  const pin = REGIONAL_LIBRARY_PINS.find((row) => row.id === id);
  assert.ok(pin, id);
  const path = pin.pin.url.split('/').slice(6).join('/');
  const root = new URL(`../../../${path.slice(0, path.lastIndexOf('/') + 1)}`, import.meta.url);
  const descriptorBytes = await readFile(new URL('delivery.json', root));
  assert.equal(descriptorBytes.length, pin.pin.bytes);
  assert.equal(createHash('sha256').update(descriptorBytes).digest('hex'), pin.pin.sha256);
  const descriptor = JSON.parse(descriptorBytes);
  const base = new URL(`https://regional-flight-test.invalid/${pin.pin.sha256}/`);
  const bytes = new Map();
  const load = async (path) => {
    if (!bytes.has(path)) {
      const expected = descriptor.files.find((row) => row.path === path);
      assert.ok(expected, `Undeclared Regional asset: ${path}`);
      const value = await readFile(new URL(path, root));
      assert.equal(value.length, expected.bytes, path);
      assert.equal(createHash('sha256').update(value).digest('hex'), expected.sha256, path);
      bytes.set(path, value);
    }
    return bytes.get(path);
  };
  const source = (ref) => ({
    baseURL: new URL('.', new URL(ref.path, base)).href,
    async fetchImpl(input, { signal } = {}) {
      signal?.throwIfAborted();
      const url = new URL(input);
      assert.ok(url.href.startsWith(base.href) && !url.search && !url.hash);
      return new Response(await load(url.pathname.slice(base.pathname.length)));
    },
  });
  const configuration = applyRegionalAppearance(
    {
      manifest: JSON.parse(await load(descriptor.terrain.path)),
      source: source(descriptor.terrain),
      scenery: {
        manifest: JSON.parse(await load(descriptor.scenery.path)),
        source: source(descriptor.scenery),
      },
      geometryProfile: 'terrain-scenery-v1',
    },
    { id, sha256: pin.pin.sha256 },
  );
  return {
    ...configuration,
    reference: { id, revision: descriptor.revision, sha256: pin.pin.sha256 },
  };
}
