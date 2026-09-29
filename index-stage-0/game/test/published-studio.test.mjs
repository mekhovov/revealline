import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { reviseStudioTheme } from '../presentation/studio-session.mjs';
import { loadPublishedStudio } from '../presentation/published-studio.mjs';
import { iconForSlot } from '../presentation/icons.mjs';
import { encodeSpritePNG } from '../../scripts/produce-field-kit-sprites.mjs';
import { compilePresentation } from '../../scripts/compile-presentation.mjs';
import {
  hashPresentationBytes,
  exportThemeBundle,
  importThemeBundle,
} from '../presentation/bundle.mjs';

async function fixture() {
  const base = createDefaultThemeBundle(),
    slot = base.slots.find((s) => s.id === 'icon.play');
  const bytes = encodeSpritePNG(iconForSlot(slot.id)),
    hash = await hashPresentationBytes(bytes);
  const asset = {
    ...structuredClone(base.assets.find((a) => a.id === 'icon.play.default')),
    id: 'icon.play.production',
    kind: 'image',
    recipe: null,
    geometry: slot.geometry,
    file: { sha256: hash, bytes: bytes.length, mime: 'image/png', width: 24, height: 24 },
    quality: { stage: 'produced', evidence: [] },
  };
  const document = reviseStudioTheme(base, {
    assets: [asset],
    bindings: { [slot.id]: { id: asset.id, revision: 1 } },
  });
  const assets = new Map([[hash, new Blob([bytes], { type: 'image/png' })]]);
  const compiled = await compilePresentation(document, assets);
  return { document, assets, compiled, hash };
}
const baseURL = 'https://game.example/releases/v0.49.0/site/game/presentation/compiled/';
test('release studio adopts exact current assets and preserves export bytes without storage', async () => {
  const f = await fixture(),
    requests = [];
  const fetch = async (url, options) => {
    requests.push({ url, options });
    const key = url.slice(baseURL.length);
    assert.ok(url.startsWith(baseURL));
    return new Response(f.compiled.files.get(key), { status: 200 });
  };
  const loaded = await loadPublishedStudio({ baseURL, fetch });
  assert.deepEqual(loaded.document, f.document);
  assert.equal(requests.length, 2);
  assert.ok(requests.every((r) => r.options.redirect === 'error'));
  const exported = await exportThemeBundle(loaded.document, loaded.assets);
  const roundTrip = await importThemeBundle(exported, { decodeImage: null });
  assert.deepEqual(
    new Uint8Array(await roundTrip.assets.get(f.hash).arrayBuffer()),
    new Uint8Array(await f.assets.get(f.hash).arrayBuffer()),
  );
});
test('source absence is explicit; malformed metadata, redirects and corrupt bodies reject atomically', async () => {
  assert.equal(
    await loadPublishedStudio({ baseURL, fetch: async () => new Response('', { status: 404 }) }),
    null,
  );
  await assert.rejects(
    loadPublishedStudio({ baseURL, fetch: async () => new Response('{malformed') }),
  );
  const f = await fixture();
  await assert.rejects(
    loadPublishedStudio({
      baseURL,
      fetch: async (url) =>
        new Response(
          url.endsWith('studio.json') ? f.compiled.files.get('studio.json') : new Uint8Array(3),
        ),
    }),
    /truncated/,
  );
  await assert.rejects(
    loadPublishedStudio({
      baseURL,
      fetch: async () => ({ ok: true, redirected: true, status: 200 }),
    }),
    /request failed/,
  );
});
test('cancellation interrupts a pending release reader and never returns partial assets', async () => {
  const f = await fixture(),
    owner = new AbortController();
  let requested;
  const started = new Promise((resolve) => {
    requested = resolve;
  });
  const pending = loadPublishedStudio({
    baseURL,
    signal: owner.signal,
    fetch: async (url, { signal }) => {
      if (url.endsWith('studio.json')) return new Response(f.compiled.files.get('studio.json'));
      requested();
      return new Promise((_, reject) =>
        signal.addEventListener('abort', () => reject(new DOMException('Stopped', 'AbortError')), {
          once: true,
        }),
      );
    },
  });
  await started;
  owner.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});
