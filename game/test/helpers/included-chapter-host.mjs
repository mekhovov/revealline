import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { includedChapterFixture } from '../fixtures/included-bundled.mjs';
import { presentationSoloPage as soloPage } from './presentation-responses.mjs';
import { classicLibrarySources } from '../../mission-library/classic-source.mjs';
import { createMissionLibrary } from '../../mission-library/library.mjs';

export async function includedChapterPage(t, { request = () => {} } = {}) {
  const fixture = await includedChapterFixture();
  const index = JSON.parse(
    await readFile(new URL('../../content/mission-library-index.json', import.meta.url), 'utf8'),
  );
  const catalog = JSON.parse(
    await readFile(new URL('../../content/packs/catalog.json', import.meta.url), 'utf8'),
  );
  const extendedIndex = { ...index, missions: [...index.missions, ...fixture.rows] };
  const extendedCatalog = { ...catalog, packs: [...catalog.packs, fixture.catalogEntry] };
  const model = createMissionLibrary(
    classicLibrarySources(extendedIndex, {
      availability: () => ({ state: 'ready' }),
      launch: () => true,
    }),
  );
  const row = model.missions
    .filter(
      (mission) => mission.ownerId === JSON.stringify(['classic', 'bundled', fixture.pack.id]),
    )
    .at(-1);
  assert.ok(row, 'Select the exact fixture owner, not a similarly named real chapter.');
  const p = await soloPage(t, {
    titleScreen: true,
    fetchJSON: (path) =>
      path === 'content/mission-library-index.json'
        ? extendedIndex
        : path === 'content/packs/catalog.json'
          ? extendedCatalog
          : undefined,
    fetchResponse: async (path) => {
      if (path === fixture.fetchPath) {
        await request(path);
        return new Response(fixture.bytes);
      }
    },
  });
  return { p, fixture, row };
}
