import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  readSavedVisualCatalogue,
  SAVED_SOLO_VISUAL_SLOTS,
} from '../presentation/saved-visual-theme.mjs';
import {
  createVisualThemeCatalogue,
  VISUAL_THEME_CATALOGUE_LIMITS,
} from '../presentation/visual-theme-catalogue.mjs';
import { prepareCampaignVisualThemeContext } from '../presentation/visual-theme-identities.mjs';
import { hashPresentationBytes } from '../presentation/bundle.mjs';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { validateCompiledPresentation } from '../presentation/host.mjs';
const read = async (path) => JSON.parse(await fs.readFile(new URL(path, import.meta.url)));
const baseURL = 'https://game.test/releases/v1/game/presentation/compiled/';

test('shipped catalogue retains exact released FPV revisions and First Signal coverage', async () => {
  const source = await read('../presentation/visual-themes.json'),
    catalogue = createVisualThemeCatalogue(source);
  const campaign = {
    ...(await read('../content/campaign.json')),
    classRecipes: await read('../content/classes.json'),
  };
  const themes = (await read('../content/themes.json')).themes;
  const entry = createExecutionCatalog([{ campaign, themes }]).entries.find(
    (row) => row.difficulty === 'standard',
  );
  const releases = new Map([
    [54, '91a3d66966e1b1a3c2e9b5c68aebcc4be284edff4e7b9b272731a769a4f66ace'],
    [58, 'ae9949a7c8c8a24775e68317e5825e9b4b2e5ae1dfb9bcffdd749a5adc4cce54'],
  ]);
  for (const [revision, sha256] of releases) {
    const published = source.entries.find(
      (row) => row.id === 'field-kit-fpv' && row.revision === revision,
    );
    assert.ok(published);
    assert.equal(published.presentation.sha256, sha256);
    assert.equal(published.coverage.length, 12);
    const bytes = new Uint8Array(
      await fs.readFile(
        new URL(`../presentation/compiled/runtime.${sha256}.json`, import.meta.url),
      ),
    );
    assert.equal(await hashPresentationBytes(bytes), sha256);
    const runtime = validateCompiledPresentation(new TextDecoder().decode(bytes));
    for (const level of entry.campaign.levels) {
      const content = await prepareCampaignVisualThemeContext({
        entry,
        level,
        association: { editionId: 'field-kit', contentThemeId: 'fpv', mode: 'solo' },
      });
      const match = catalogue.resolve({ id: published.id, revision }, content);
      assert.equal(match.kind, 'compatible');
      catalogue.verifyPresentationIdentity(
        match,
        {
          source: runtime.source,
          theme: { id: runtime.resolved.theme.id, revision: runtime.resolved.theme.revision },
          collection: runtime.resolved.collection,
          sha256,
          slots: Object.keys(runtime.resolved.bindings),
        },
        SAVED_SOLO_VISUAL_SLOTS,
      );
    }
    for (const slot of SAVED_SOLO_VISUAL_SLOTS)
      assert.equal(runtime.resolved.assets[slot].quality.stage, 'reviewed', slot);
  }
});

test('catalogue reader uses the code-owned URL and rejects redirect, oversized and malformed replies', async () => {
  const source = await read('../presentation/visual-themes.json');
  const calls = [];
  const result = await readSavedVisualCatalogue({
    baseURL,
    fetch: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify(source));
    },
  });
  assert.deepEqual(result.snapshot(), source);
  assert.equal(calls[0].url, 'https://game.test/releases/v1/game/presentation/visual-themes.json');
  assert.equal(calls[0].options.redirect, 'error');
  for (const response of [
    new Response('{}'),
    new Response('null'),
    new Response(null, { status: 404 }),
    new Response(' ', {
      headers: { 'content-length': String(VISUAL_THEME_CATALOGUE_LIMITS.bytes + 1) },
    }),
    new Response(new Uint8Array(VISUAL_THEME_CATALOGUE_LIMITS.bytes + 1)),
  ]) {
    await assert.rejects(readSavedVisualCatalogue({ baseURL, fetch: async () => response }));
  }
  const redirected = new Response(JSON.stringify(source));
  Object.defineProperty(redirected, 'redirected', { value: true });
  await assert.rejects(
    readSavedVisualCatalogue({ baseURL, fetch: async () => redirected }),
    /unavailable/,
  );
});

test('catalogue cancellation closes the actual pending response stream', async () => {
  const controller = new AbortController();
  let started = false,
    cancelled = 0;
  const response = new Response(
    new ReadableStream({
      start() {
        started = true;
      },
      cancel() {
        cancelled++;
      },
    }),
  );
  const pending = readSavedVisualCatalogue({
    baseURL,
    signal: controller.signal,
    fetch: async () => response,
  });
  while (!started || !response.body.locked) await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(cancelled, 1);
  const stopped = new AbortController();
  stopped.abort();
  let reads = 0;
  await assert.rejects(
    readSavedVisualCatalogue({
      baseURL,
      signal: stopped.signal,
      fetch: async () => {
        reads++;
        return response;
      },
    }),
    { name: 'AbortError' },
  );
  assert.equal(reads, 0);
});
