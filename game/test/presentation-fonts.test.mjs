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

test('bootstrap faces use the same retained hash-addressed bytes as presentation fonts', async () => {
  const cssURL = new URL('../ui/field-kit-fonts.css', import.meta.url);
  const [css, provenance, studio] = await Promise.all([
    readFile(cssURL, 'utf8'),
    readFile(new URL('../ui/fonts/field-kit/provenance.json', import.meta.url), 'utf8').then(
      JSON.parse,
    ),
    readFile(new URL('../presentation/compiled/studio.json', import.meta.url), 'utf8').then(
      JSON.parse,
    ),
  ]);
  const faces = new Map(
    [...css.matchAll(/@font-face\s*\{([^}]+)\}/g)].map((match) => [
      match[1].match(/font-family:\s*'([^']+)'/)[1],
      match[1].match(/src:\s*url\('([^']+)'\)/)[1],
    ]),
  );
  assert.equal(faces.size, provenance.fonts.length);
  for (const font of provenance.fonts) {
    const source = faces.get(font.cssFamily);
    assert.equal(source, `../presentation/compiled/assets/${font.sha256}.woff2`);
    const [runtimeBytes, originalBytes] = await Promise.all([
      readFile(new URL(source, cssURL)),
      readFile(new URL(`../ui/fonts/field-kit/${font.file}`, import.meta.url)),
    ]);
    assert.deepEqual(runtimeBytes, originalBytes, `${font.family} keeps the approved glyphs`);
    assert.equal(runtimeBytes.length, font.bytes);
    assert.equal(await hashPresentationBytes(runtimeBytes), font.sha256);
    assert.ok(
      studio.assets.some((asset) => asset.kind === 'font' && asset.file?.sha256 === font.sha256),
      'The compiler must retain bootstrap font bytes even when another collection replaces a role',
    );
  }
});
