import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPresentationHost } from '../presentation/host.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { hashPresentationBytes } from '../presentation/bundle.mjs';
import { compilePresentation } from '../../scripts/compile-presentation.mjs';

test('compiled Handjet, variable Exo 2 and Plex faces register their real role weights before use', async () => {
  const compiled = await compilePresentation(createDefaultThemeBundle(), new Map());
  const manifest = JSON.parse(new TextDecoder().decode(compiled.files.get('runtime.json')));
  const files = new Map(),
    expected = new Map();
  for (const [role, filename, weight] of [
    ['display', 'handjet-display-600.woff2', '600'],
    ['ui', 'exo2-ui-400-600.woff2', '400 600'],
    ['numeric', 'ibm-plex-mono-500.woff2', '500'],
  ]) {
    const bytes = new Uint8Array(
      await readFile(new URL(`../ui/fonts/field-kit/${filename}`, import.meta.url)),
    );
    const hash = await hashPresentationBytes(bytes),
      slot = `font.${role}`;
    const asset = manifest.resolved.assets[slot];
    Object.assign(asset, {
      id: `compiled.${role}`,
      kind: 'font',
      recipe: null,
      file: { sha256: hash, bytes: bytes.length, mime: 'font/woff2', width: null, height: null },
    });
    manifest.resolved.bindings[slot] = { id: asset.id, revision: 1 };
    manifest.urls[hash] = `./assets/${hash}.woff2`;
    files.set(`assets/${hash}.woff2`, bytes);
    expected.set(`RLAsset-${hash}`, { bytes, weight });
  }
  files.set('runtime.json', new TextEncoder().encode(JSON.stringify(manifest)));
  const registered = new Set(),
    decoded = [];
  const host = createPresentationHost({
    baseURL: 'https://game.test/game/presentation/compiled/',
    document: {
      fonts: { add: (face) => registered.add(face), delete: (face) => registered.delete(face) },
    },
    fetch: async (url) =>
      new Response(files.get(new URL(url).pathname.replace('/game/presentation/compiled/', ''))),
    fontFactory(family, bytes, descriptors) {
      const target = expected.get(family);
      assert.deepEqual(new Uint8Array(bytes), target.bytes);
      assert.deepEqual(descriptors, { weight: target.weight, style: 'normal', display: 'swap' });
      const face = {
        family,
        async load() {
          decoded.push(this);
          return this;
        },
      };
      return face;
    },
  });
  await host.load();
  assert.equal(decoded.length, 3);
  assert.deepEqual(registered, new Set(decoded));
  host.close();
  assert.equal(registered.size, 0);
});
