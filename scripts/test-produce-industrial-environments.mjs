import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadPublishedStudio } from '../game/presentation/published-studio.mjs';
import { createDefaultThemeBundle } from '../game/presentation/catalog.mjs';
import { adoptStudioBundle } from '../game/presentation/studio-session.mjs';
import {
  createIndustrialEnvironmentBatch,
  compatibleStudioBaseline,
  INDUSTRIAL_ENVIRONMENT_DIRECTORY,
} from './produce-industrial-environments.mjs';
import { INDUSTRIAL_ENVIRONMENT_DATA } from '../game/presentation/industrial-environments-data.mjs';
import { importThemeBundle, verifyThemeAssets } from '../game/presentation/bundle.mjs';
import { resolvePresentation } from '../game/presentation/model.mjs';

test('all fourteen bounded native Studio packages regenerate retained sources and match terrain bindings', async () => {
  const batch = await createIndustrialEnvironmentBatch({ previous: INDUSTRIAL_ENVIRONMENT_DATA }),
    studio = await loadPublishedStudio({
      baseURL: new URL('../game/presentation/compiled/', import.meta.url),
      fetch: async (url) => new Response(await readFile(new URL(url))),
    }),
    before = JSON.stringify(studio.document),
    publishedSource = await readFile(
      new URL('../game/presentation/compiled/studio.json', import.meta.url),
    );
  assert.equal(batch.inventory.studioContract.slots, studio.document.slots.length);
  assert.equal(
    batch.inventory.studioContract.sourceSha256,
    createHash('sha256').update(publishedSource).digest('hex'),
  );
  assert.equal(batch.files.size, 16);
  assert.equal(batch.inventory.chapters.length, 14);
  assert.equal(batch.inventory.roomSources, 276);
  assert.equal(batch.inventory.roomPreparations, 756);
  assert.ok(batch.inventory.moduleBytes < 512 * 1024);
  assert.ok(batch.inventory.packageBytes < 20 * 1024 * 1024);
  for (const chapter of batch.inventory.chapters) {
    assert.ok(chapter.package.path.startsWith(`${INDUSTRIAL_ENVIRONMENT_DIRECTORY}/`));
    assert.equal(chapter.package.href, chapter.package.path);
    assert.ok(chapter.package.bytes < 2 * 1024 * 1024);
    assert.equal(chapter.package.decodedBytes, 3072);
    assert.ok(chapter.levelCount >= 6);
    assert.equal(chapter.sourceIds.length, chapter.levelCount);
    const imported = await importThemeBundle(new Blob([batch.files.get(chapter.package.path)]), {
        decodeImage: null,
      }),
      presentation = resolvePresentation(imported.document);
    assert.deepEqual(imported.document.slots, studio.document.slots);
    // This is the real UI boundary: adopt into its published workspace, then
    // verify both retained originals and imported pixels before staging.
    const adopted = adoptStudioBundle(studio.document, imported.document),
      accepted = resolvePresentation(adopted);
    await verifyThemeAssets(adopted, new Map([...studio.assets, ...imported.assets]));
    assert.equal(JSON.stringify(studio.document), before);
    for (const slot of ['terrain.wall', 'terrain.slow', 'terrain.lethal']) {
      const asset = presentation.assets[slot];
      assert.equal(asset.kind, 'image');
      assert.equal(accepted.assets[slot].file.sha256, asset.file.sha256);
      assert.ok(chapter.package.assets.some((a) => a.sha256 === asset.file.sha256));
    }
    for (const link of chapter.links) {
      assert.ok(chapter.modes.includes(link.mode));
      assert.match(link.href, /^(game|optional-practice)\//);
      assert.ok(!link.href.includes('://'));
    }
  }
});

test('chapter transport does not authorize an unpublished picture slot in the loaded Studio', async () => {
  const studio = await loadPublishedStudio({
    baseURL: new URL('../game/presentation/compiled/', import.meta.url),
    fetch: async (url) => new Response(await readFile(new URL(url))),
  });
  const unpublished = structuredClone(
    studio.document.slots.find((slot) => slot.id.startsWith('picture.retro.')),
  );
  unpublished.id = 'picture.retro.unpublished';
  unpublished.owner.levelId = 'unpublished-picture';
  const broader = createDefaultThemeBundle({ slots: [...studio.document.slots, unpublished] });
  const before = JSON.stringify(studio.document);
  assert.throws(
    () => adoptStudioBundle(studio.document, broader),
    /Unsupported imported slot contract: picture\.retro\.unpublished/,
  );
  assert.equal(JSON.stringify(studio.document), before);
});

test('published compatibility admits exact retained picture slots and rejects altered contracts', async () => {
  const studio = await loadPublishedStudio({
    baseURL: new URL('../game/presentation/compiled/', import.meta.url),
    fetch: async (url) => new Response(await readFile(new URL(url))),
  });
  const retained = JSON.parse(
    await readFile(
      new URL(
        '../authoring/library/fpv-field-kit/picture-migration-baseline.json',
        import.meta.url,
      ),
    ),
  );
  const current = new Set(createDefaultThemeBundle().slots.map((slot) => slot.id));
  const historical = studio.document.slots.filter((slot) => !current.has(slot.id));
  assert.equal(historical.length, 4);
  assert.deepEqual(
    compatibleStudioBaseline(studio.document, retained).slots,
    studio.document.slots,
  );
  const changed = structuredClone(studio.document);
  changed.slots.find((slot) => slot.id === historical[0].id).label += ' changed';
  assert.throws(() => compatibleStudioBaseline(changed, retained), /explicit compatible producer/);
  const changedPredecessor = structuredClone(retained);
  changedPredecessor.slots[0].label += ' changed';
  assert.throws(
    () => compatibleStudioBaseline(studio.document, changedPredecessor),
    /pinned predecessor/,
  );
});
